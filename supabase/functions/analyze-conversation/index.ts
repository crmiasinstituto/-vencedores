import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
}

const SYSTEM_PROMPT = `Você é um analista de inteligência comercial da SQUAAD. Analise a conversa abaixo entre nosso time (outbound) e o lead (inbound).

Retorne APENAS um JSON válido, sem markdown, sem blocos de código, com a seguinte estrutura:
{
  "sentiment": "positivo|neutro|negativo|frustrado",
  "interest_level": 0-100,
  "key_topics": ["topico1", "topico2"],
  "objections": ["objecao identificada"],
  "pain_points": ["dor mencionada"],
  "opportunities": ["oportunidade de venda"],
  "suggested_actions": ["acao sugerida para o vendedor"],
  "summary": "resumo em 2-3 frases do estado da negociacao"
}

Regras:
- interest_level: 0 = nenhum interesse, 100 = pronto para comprar
- Se não houver informação suficiente para um campo, retorne array vazio [] ou "neutro"
- Foque em insights acionáveis para o vendedor
- Analise o tom emocional do lead, não do vendedor`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { lead_id } = await req.json()
    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'lead_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Throttle: check last analysis time
    const { data: lastInsight } = await supabase
      .from('lead_conversation_insights')
      .select('analyzed_at')
      .eq('lead_id', lead_id)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastInsight) {
      const lastTime = new Date(lastInsight.analyzed_at).getTime()
      const now = Date.now()
      const minutesSince = (now - lastTime) / 60000
      if (minutesSince < 30) {
        console.log(`Throttled: last analysis was ${minutesSince.toFixed(1)} min ago for lead ${lead_id}`)
        return new Response(JSON.stringify({ ok: true, throttled: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Fetch last 30 messages for context
    const { data: messages, error: msgErr } = await supabase
      .from('whatsapp_messages')
      .select('direction, content, message_type, created_at')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: true })
      .limit(30)

    if (msgErr || !messages || messages.length < 3) {
      console.log(`Not enough messages for analysis: ${messages?.length || 0}`)
      return new Response(JSON.stringify({ ok: true, skipped: 'insufficient_messages' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build conversation text
    const conversationText = messages.map(m => {
      const role = m.direction === 'inbound' ? 'LEAD' : 'VENDEDOR'
      const content = m.content || (m.message_type !== 'text' ? `[${m.message_type}]` : '[sem conteúdo]')
      return `${role}: ${content}`
    }).join('\n')

    // Call OpenAI
    const openaiKey = await getIntegrationKey("openai", "OPENAI_API_KEY")
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Conversa com ${messages.length} mensagens:\n\n${conversationText}` },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('OpenAI error:', errText)
      throw new Error(`OpenAI API error: ${openaiRes.status}`)
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content || '{}'
    
    // Parse JSON response (handle potential markdown wrapping)
    let analysis: any
    try {
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysis = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse OpenAI response:', rawContent)
      analysis = { sentiment: 'neutro', interest_level: 0, summary: rawContent, key_topics: [], objections: [], pain_points: [], opportunities: [], suggested_actions: [] }
    }

    // Save insight
    const { error: insertErr } = await supabase
      .from('lead_conversation_insights')
      .insert({
        lead_id,
        message_count: messages.length,
        sentiment: analysis.sentiment || 'neutro',
        interest_level: Math.min(100, Math.max(0, analysis.interest_level || 0)),
        key_topics: analysis.key_topics || [],
        objections: analysis.objections || [],
        pain_points: analysis.pain_points || [],
        opportunities: analysis.opportunities || [],
        suggested_actions: analysis.suggested_actions || [],
        raw_summary: analysis.summary || '',
        metadata: { model: 'gpt-4o-mini', tokens: openaiData.usage },
      })

    if (insertErr) {
      console.error('Error saving insight:', insertErr)
      throw insertErr
    }

    console.log(`Analysis saved for lead ${lead_id}: sentiment=${analysis.sentiment}, interest=${analysis.interest_level}`)

    return new Response(JSON.stringify({ ok: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('analyze-conversation error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
