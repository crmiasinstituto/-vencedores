import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phase1, phase2, phase3 } = await req.json();
    const openAIApiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const prompt = `Você é um estrategista de eventos empresariais de alto nível. Com base nos dados abaixo, gere um Playbook completo para um evento presencial.

DADOS DO EVENTO:

FASE 1 - ICP:
- Identidade: ${JSON.stringify(phase1.identity)}
- Dores: ${JSON.stringify(phase1.pains)}
- Desejos: ${JSON.stringify(phase1.desires)}
- Objeções: ${JSON.stringify(phase1.objections)}

FASE 2 - POSICIONAMENTO:
- Transformação: ${JSON.stringify(phase2.transformation)}
- Diferencial: ${JSON.stringify(phase2.differential)}

FASE 3 - PRIMAL BRANDING:
- Crença: ${phase3.belief}
- Inimigos: ${JSON.stringify(phase3.enemy)}
- Linguagem interna: ${JSON.stringify(phase3.language)}
- Rituais: ${JSON.stringify(phase3.ritual)}
- Fundadores: ${JSON.stringify(phase3.founders)}

Gere o playbook no seguinte formato JSON (APENAS JSON, sem markdown):
{
  "icpDocument": "Documento completo de 200-300 palavras descrevendo o ICP ideal, suas dores, desejos e como abordá-lo",
  "manifesto": "Texto inspiracional de 150-200 palavras que capture a essência e crença do evento",
  "namesSuggestions": [
    {"name": "Nome 1", "tagline": "Tagline impactante", "justification": "Por que esse nome funciona"},
    {"name": "Nome 2", "tagline": "Tagline impactante", "justification": "Por que esse nome funciona"},
    {"name": "Nome 3", "tagline": "Tagline impactante", "justification": "Por que esse nome funciona"}
  ],
  "pitch60s": "Script de pitch de 60 segundos pronto para usar",
  "participantJourney": {
    "before": "Estratégia de engajamento antes do evento",
    "during": "Experiência durante o evento",
    "after": "Follow-up e conversão pós-evento"
  },
  "salesCopy": {
    "headline": "Headline principal de vendas",
    "bullets": ["Benefício 1", "Benefício 2", "Benefício 3"],
    "cta": "Call to action poderoso"
  }
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um especialista em eventos empresariais e branding. Sempre responda apenas com JSON válido, sem markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let playbook;
    try {
      playbook = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
    } catch {
      playbook = JSON.parse(content);
    }

    return new Response(JSON.stringify({ playbook }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating playbook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
