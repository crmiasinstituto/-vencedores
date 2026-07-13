// Helper: transcreve um audio/video URL via Soniox async + polling.
// Soniox aceita arquivos de qualquer tamanho via audio_url (B2/S3/etc).
// Para 9min de aula, leva ~30s. Para 1h, leva ~2-4min.
import { supabase } from '@/integrations/supabase/client';

const SONIOX_API = 'https://api.soniox.com/v1';

export interface TranscribeProgress {
  stage: 'fetching_key' | 'starting' | 'queued' | 'processing' | 'completed' | 'error';
  message: string;
  audio_ms?: number;
  elapsed_s?: number;
}

interface SonioxJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  audio_duration_ms: number | null;
  error_type?: string;
  error_message?: string;
}

/**
 * Transcreve um audio/video remoto via Soniox.
 * @param audioUrl URL HTTP publica (B2, S3, etc)
 * @param onProgress callback chamado a cada mudanca de estado
 * @returns texto transcrito em portugues
 */
export async function transcribeWithSoniox(
  audioUrl: string,
  onProgress?: (p: TranscribeProgress) => void,
): Promise<string> {
  // 1. Pega chave Soniox via edge function (nao expoe a chave no bundle)
  onProgress?.({ stage: 'fetching_key', message: 'Pegando chave Soniox...' });
  const { data: keyData, error: keyErr } = await supabase.functions.invoke('get-soniox-token');
  if (keyErr || !keyData?.api_key) {
    throw new Error('Falha ao obter chave Soniox: ' + (keyErr?.message || 'sem chave'));
  }
  const apiKey = keyData.api_key as string;

  // 2. Cria job de transcricao
  // Context hint: lista de termos do glossario que o Soniox deve reconhecer
  // melhor. Reduz erros como "squide", "squad", "esquad" -> + que Vencedores.
  const SQUAAD_CONTEXT = `Glossario + que Vencedores: + que Vencedores, Metodo + que Vencedores, MentorIA + que Vencedores, Carlos Eduardo, Claude, Claude Code, ChatGPT, OpenAI, Anthropic, agente IA, automacao IA, CRM IA.`;

  onProgress?.({ stage: 'starting', message: 'Iniciando transcricao Soniox...' });
  const startRes = await fetch(`${SONIOX_API}/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      model: 'stt-async-preview',
      language_hints: ['pt'],
      enable_speaker_diarization: false,
      context: SQUAAD_CONTEXT,
    }),
  });
  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Soniox falhou ao iniciar (${startRes.status}): ${errText.slice(0, 250)}`);
  }
  const job: SonioxJob = await startRes.json();

  // 3. Polling — checa a cada 5s, max 10min
  const startTime = Date.now();
  const MAX_WAIT_MS = 10 * 60 * 1000;
  let lastStatus: SonioxJob['status'] = job.status;
  let pollCount = 0;

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_WAIT_MS) {
      throw new Error('Soniox nao completou em 10min — talvez o video seja muito longo');
    }

    pollCount++;
    const checkRes = await fetch(`${SONIOX_API}/transcriptions/${job.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!checkRes.ok) {
      // Tolera 1-2 erros transientes
      if (pollCount > 3) {
        const errText = await checkRes.text();
        throw new Error(`Soniox poll falhou (${checkRes.status}): ${errText.slice(0, 200)}`);
      }
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }
    const status: SonioxJob = await checkRes.json();
    lastStatus = status.status;

    if (status.status === 'completed') {
      onProgress?.({
        stage: 'completed',
        message: 'Transcricao completa, baixando texto...',
        audio_ms: status.audio_duration_ms || 0,
        elapsed_s: Math.round(elapsed / 1000),
      });
      break;
    }
    if (status.status === 'error') {
      throw new Error(`Soniox erro: ${status.error_message || status.error_type || 'desconhecido'}`);
    }

    onProgress?.({
      stage: status.status,
      message: status.status === 'queued'
        ? `Na fila Soniox (${Math.round(elapsed / 1000)}s)`
        : `Transcrevendo audio (${Math.round(elapsed / 1000)}s, audio ${Math.round((status.audio_duration_ms || 0) / 1000)}s)`,
      audio_ms: status.audio_duration_ms || 0,
      elapsed_s: Math.round(elapsed / 1000),
    });

    await new Promise(r => setTimeout(r, 5000));
  }

  // 4. Pega o texto final
  const transcriptRes = await fetch(`${SONIOX_API}/transcriptions/${job.id}/transcript`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!transcriptRes.ok) {
    throw new Error(`Soniox transcript fetch falhou (${transcriptRes.status})`);
  }
  const data = await transcriptRes.json();
  let text = (data.text || '').trim();
  if (!text && Array.isArray(data.tokens)) {
    text = data.tokens.map((t: any) => t.text || '').join('').trim();
  }
  if (!text) throw new Error('Soniox completou mas sem texto');

  return postProcessTranscription(text);
}

/**
 * Pos-processamento: corrige variacoes comuns que o Soniox erra:
 * - "squide", "squad", "esquad", "squad" -> "+ que Vencedores"
 * - "metodo squide" -> "Metodo + que Vencedores"
 * - "mentor ia" -> "MentorIA"
 * - Capitaliza marcas e nomes proprios.
 */
export function postProcessTranscription(text: string): string {
  let out = text;

  // Variantes do nome + que Vencedores (case-insensitive, word boundary)
  const squaadVariants = [
    'squide', 'squad', 'esquade', 'esquad', 'squade',
    's q u a a d', 's q u a d', 'squaad', 'esquaad',
  ];
  for (const v of squaadVariants) {
    const re = new RegExp(`\\b${v.replace(/ /g, '\\s+')}\\b`, 'gi');
    out = out.replace(re, '+ que Vencedores');
  }

  // Mentor IA -> MentorIA
  out = out.replace(/\bmentor\s*i\.?\s*a\.?\b/gi, 'MentorIA');
  out = out.replace(/\bmentoria\s*i\.?\s*a\.?\b/gi, 'MentorIA');

  // Metodo + que Vencedores com inicial maiuscula
  out = out.replace(/\bmetodo\s+squaad\b/gi, 'Metodo + que Vencedores');

  // Marcas comuns
  out = out.replace(/\bcloud\b/gi, (m) => {
    // Soniox confunde "Cloud" com "Claude" frequentemente, mas so quando precedido
    // por "do" ou contexto. Deixar manual para evitar trocar Cloud (nuvem) errado.
    return m;
  });
  out = out.replace(/\bclod\b/gi, 'Claude');
  out = out.replace(/\bclode\b/gi, 'Claude');
  out = out.replace(/\bclaud\b/gi, 'Claude');

  // ChatGPT
  out = out.replace(/\bchat\s*g\s*p\s*t\b/gi, 'ChatGPT');
  out = out.replace(/\bxat\s*gpt\b/gi, 'ChatGPT');

  // OpenAI / Anthropic
  out = out.replace(/\bopen\s*ai\b/gi, 'OpenAI');
  out = out.replace(/\banthropic\b/gi, 'Anthropic');

  return out;
}
