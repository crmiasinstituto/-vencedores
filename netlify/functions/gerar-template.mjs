/**
 * gerar-template — função serverless da Netlify.
 *
 * Gera um template HTML (e-mail, comunicado, certificado, post) da Comunidade + que Vencedores
 * usando o Claude (Anthropic). Fica na Netlify — e não no Supabase — porque o projeto está no
 * teto de 100 edge functions do Supabase; função da Netlify não conta nesse limite.
 *
 * A chave da Anthropic vem de process.env.ANTHROPIC_API_KEY (Netlify env var), nunca do
 * navegador. Chamada em POST /.netlify/functions/gerar-template com { tipo, prompt, extra_context }.
 */

const GUIDELINES = `Você gera peças em HTML para a Comunidade + que Vencedores, do IAS Instituto (fundada por Isaac Santos). É uma comunidade de desenvolvimento pessoal, profissional, espiritual e financeiro.

TOM:
- Humano, próximo e inspirador. Nada de hype, nada de "cara de robô".
- Zero emoji. Nunca invente prova social (números, nomes, depoimentos) que não venham no brief.
- Português brasileiro caloroso e direto. PROIBIDO travessão/em dash longo — use vírgula, ponto ou dois pontos.

DESIGN (marca azul, cabeçalho em TEXTO, sem logo de imagem externa):
- Cabeçalho: faixa azul (#1b3fd1), à esquerda o wordmark em texto branco: "<strong style="font-weight:800">+</strong> que Vencedores". Padding 18px 28px.
- Paleta: azul #1b3fd1, tinta #0b0e14, texto #3a4252, fundos #f4f6fb e #ffffff.
- Fonte: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif.
- Container central: max-width 640px, margin auto, fundo branco, border-radius 14px, border 1px solid #e6e9f2, overflow hidden.
- Títulos: font-weight 700, cor #0b0e14, 22-28px. Corpo: 15-16px, line-height 1.7, cor #3a4252.
- Botão/CTA (quando fizer sentido): fundo #1b3fd1, texto branco, padding 14px 32px, border-radius 10px, font-weight 700, sem sublinhado.
- Rodapé discreto ao final: "IAS Instituto — Comunidade + que Vencedores".
- Use tabelas (role="presentation") pra compatibilidade com Gmail/Outlook quando o tipo for e-mail ou comunicado.
- Para "certificado": layout paisagem, moldura elegante, nome grande no centro, espaço pra assinatura de Isaac Santos.
- Placeholders entre colchetes pro que o brief não definir: [Nome], [Data], [Link], [Detalhe]. Variáveis Mustache quando fizer sentido: {{primeiro_nome}}.

RESPONDA APENAS um JSON válido (zero markdown, zero texto fora do JSON):
{
  "subject": "Assunto/título curto (use {{primeiro_nome}} se for e-mail)",
  "preheader": "Uma linha de resumo/preview",
  "html_content": "<!DOCTYPE html>... HTML completo e autossuficiente, com todo o CSS inline"
}`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function parseJsonLoose(text) {
  const t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(t);
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY não configurada na Netlify' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const tipo = (body.tipo || 'email').toString();
  const prompt = (body.prompt || '').toString().trim();
  const extra = (body.extra_context || '').toString().trim();
  if (!prompt) return json({ error: 'Descreva o que você quer gerar (campo prompt).' }, 400);

  const userText =
    `Tipo de peça: ${tipo}.\n\nBrief:\n"${prompt}"\n` +
    (extra ? `\nContexto adicional a respeitar:\n${extra}\n` : '') +
    `\nGere a peça completa seguindo o padrão da marca. Retorne APENAS o JSON especificado.`;

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: GUIDELINES,
        messages: [{ role: 'user', content: userText }],
      }),
    });
  } catch (e) {
    return json({ error: `Falha ao chamar o Claude: ${e.message}` }, 502);
  }

  if (!res.ok) {
    const err = await res.text();
    return json({ error: `Claude ${res.status}: ${err.slice(0, 300)}` }, 502);
  }

  const data = await res.json();
  // O sonnet-5 devolve um bloco de "thinking" antes do texto — pegue o bloco de tipo 'text',
  // não o content[0] (que pode ser o raciocínio).
  const text = Array.isArray(data?.content)
    ? data.content.find((b) => b?.type === 'text')?.text
    : undefined;
  if (!text) return json({ error: 'Claude não retornou conteúdo.' }, 502);

  let parsed;
  try { parsed = parseJsonLoose(text); }
  catch { return json({ error: 'Claude retornou um formato inesperado. Tente de novo.' }, 502); }

  const clean = (s) => String(s || '').replace(/—/g, ',');
  return json({
    success: true,
    provider: 'claude',
    subject: clean(parsed.subject),
    preheader: clean(parsed.preheader),
    html_content: clean(parsed.html_content),
  });
};
