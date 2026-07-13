/**
 * marketing-ai-template
 *
 * Gera template de email a partir de:
 *  - prompt texto (mode: 'text')
 *  - áudio base64 do navegador (mode: 'audio') → Gemini multimodal entende áudio direto
 *
 * Usa Google Gemini 1.5 Flash (multimodal: text + audio).
 * Fallback OpenAI se Gemini falhar.
 *
 * Retorna: { subject, preheader, html_content }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// === resolver de chave de integracao (fonte unica = tabela integration_keys, /admin/configuracoes) ===
// Le do banco primeiro; cai no env var como fallback retrocompat. Suporta instancia-por-cliente.
let _keyClient: any = null;
async function getIntegrationKey(service: string, envFallback?: string): Promise<string | null> {
  try {
    if (!_keyClient) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      _keyClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    }
    const { data } = await _keyClient
      .from("integration_keys")
      .select("api_key, is_active")
      .eq("service", service)
      .maybeSingle();
    if (data && data.is_active && data.api_key) return String(data.api_key).trim();
  } catch (_) { /* cai no fallback */ }
  return (envFallback ? Deno.env.get(envFallback) : null) || null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
};

const BRAND_GUIDELINES = `Você gera templates de email HTML pra SQUAAD Business Solutions. Siga o padrão de marca:

DESIGN:
- Logo SQUAAD em 140px à esquerda, padding 12px 28px no header
- 3 variações de header (escolha a que melhor combina com o tom):
  - Preto (#000000) + logo branca: https://iymlwsawrmghhbawiavz.supabase.co/storage/v1/object/public/email-assets/brand/squaad-logo-001.jpg
  - Cinza claro (#e8e8e8) + logo preta: https://iymlwsawrmghhbawiavz.supabase.co/storage/v1/object/public/email-assets/brand/squaad-logo-002.jpg
  - Amarelo (#FAC800) + logo preta: https://iymlwsawrmghhbawiavz.supabase.co/storage/v1/object/public/email-assets/brand/squaad-logo-003.jpg
- Paleta: #0a0a0a, #FAC800, #917D3D, #e8e8e8, #f5f5f5
- Container: max-width 600px, border-radius 12px, border 1px solid #e5e5e5, fundo branco
- Fonte: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif
- Headlines: font-weight 600-700, letter-spacing -0.01em, font-size 22-26px
- Corpo: 15px, line-height 1.65, cor #333
- CTAs: padding 14px 32px, border-radius 8px, font-weight 700, letter-spacing 0.02em, UPPERCASE

COPY:
- Português brasileiro direto, sem floreio
- PROIBIDO usar em dash longo (—). Use vírgula, ponto ou dois pontos.
- Variáveis disponíveis (formato Mustache): {{primeiro_nome}}, {{nome}}, {{empresa}}, {{email}}, {{telefone}}, {{cidade}}, {{estado}}, {{vendedor}}
- Placeholders pra edição manual entre colchetes: [Nome do produto], [Data], [Detalhe]
- CTA único e claro
- Tom: conselheiro de negócios, não vendedor agressivo

ESTRUTURA HTML (tabela-based pra compatibilidade Outlook/Gmail):
<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
  <tr><td style="background:[COR_HEADER];padding:12px 28px;text-align:left;">
    <img src="[URL_LOGO]" alt="SQUAAD" width="140" style="display:block;width:140px;height:auto;border:0;"/>
  </td></tr>
  <tr><td style="padding:36px 32px;">
    <h1>...</h1>
    <p>...</p>
    <table role="presentation" style="margin:0 auto;"><tr><td style="background:#FAC800;border-radius:8px;padding:14px 32px;">
      <a href="[URL]" style="color:#000;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.02em;">CTA</a>
    </td></tr></table>
  </td></tr>
</table></body></html>

FORMATO DE RESPOSTA OBRIGATÓRIO:
Responda APENAS um JSON válido (zero markdown, zero texto adicional):
{
  "subject": "Assunto do email, pode usar {{primeiro_nome}}",
  "preheader": "Texto curto preview no inbox",
  "html_content": "<!DOCTYPE html>... HTML completo"
}`;

async function callGemini(parts: any[], geminiApiKey: string): Promise<{ subject: string; preheader: string; html_content: string; transcript?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      systemInstruction: { parts: [{ text: BRAND_GUIDELINES }] },
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini sem resposta');

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini retornou JSON inválido: ${text.slice(0, 200)}`);
  }

  if (!parsed.subject || !parsed.html_content) throw new Error('Gemini sem subject ou html_content');

  // Sanity: remove em dash
  parsed.subject = String(parsed.subject).replace(/—/g, ',');
  parsed.html_content = String(parsed.html_content).replace(/—/g, ',');
  parsed.preheader = String(parsed.preheader || '').replace(/—/g, ',');

  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = (await getIntegrationKey("gemini", "GEMINI_API_KEY")) || "";
    const OPENAI_API_KEY = (await getIntegrationKey("openai", "OPENAI_API_KEY")) || "";
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');

    const body = await req.json();
    const { mode, prompt, audio_base64, audio_mime, extra_context } = body as {
      mode: 'text' | 'audio';
      prompt?: string;
      audio_base64?: string;
      audio_mime?: string;
      extra_context?: string;
    };

    const parts: any[] = [];
    let transcript: string | undefined;
    const ctx = extra_context && extra_context.trim()
      ? `\n\nContexto adicional importante a respeitar:\n${extra_context.trim()}\n`
      : '';

    if (mode === 'audio') {
      if (!audio_base64) throw new Error('audio_base64 obrigatório no modo audio');
      // Gemini aceita áudio direto via inlineData (base64 + mimeType)
      parts.push({
        inlineData: {
          mimeType: audio_mime || 'audio/webm',
          data: audio_base64,
        },
      });
      parts.push({
        text: `Esse áudio é o briefing do template de email. Escute, entenda o que o usuário quer comunicar, e gere o template SQUAAD seguindo as guidelines do system prompt. Inclua no campo "transcript" do JSON a transcrição em PT-BR do áudio.${ctx}`,
      });
    } else {
      if (!prompt || !prompt.trim()) throw new Error('prompt obrigatório no modo text');
      parts.push({ text: `Brief do usuário:\n\n"${prompt.trim()}"\n${ctx}\nGere o template completo seguindo o padrão SQUAAD. Use a variação de cor do header que melhor combina com o tom da mensagem. Retorne APENAS o JSON conforme especificado.` });
    }

    const result = await callGemini(parts, GEMINI_API_KEY);
    transcript = (result as any).transcript;

    return new Response(
      JSON.stringify({
        success: true,
        provider: 'gemini',
        transcript,
        subject: result.subject,
        preheader: result.preheader,
        html_content: result.html_content,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[marketing-ai-template]', err);
    return new Response(
      JSON.stringify({ error: err.message || 'erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
