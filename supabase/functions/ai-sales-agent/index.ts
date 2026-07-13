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
  'Access-Control-Allow-Origin': 'https://squaad.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

// Tool definitions for the AI agent
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'schedule_meeting',
      description: 'Schedule a meeting/call with the lead. Use when the lead agrees to a meeting or requests one.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Meeting date in ISO format (YYYY-MM-DD)' },
          time: { type: 'string', description: 'Meeting time (HH:MM)' },
          notes: { type: 'string', description: 'Meeting notes or agenda' },
        },
        required: ['date', 'time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'qualify_bant',
      description: 'Update BANT qualification for the lead based on conversation insights.',
      parameters: {
        type: 'object',
        properties: {
          budget: { type: 'string', description: 'Budget info extracted from conversation' },
          authority: { type: 'string', description: 'Decision-maker info' },
          need: { type: 'string', description: 'Pain points / needs identified' },
          timeline: { type: 'string', description: 'Urgency / timeline mentioned' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_stage',
      description: 'Move the lead to a different pipeline stage/column.',
      parameters: {
        type: 'object',
        properties: {
          stage: {
            type: 'string',
            description: 'New stage name. Common stages: lead_novo, em_contato, qualificado, proposta_enviada, negociacao, ganho, perdido',
          },
        },
        required: ['stage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transfer_to_human',
      description: 'Flag the conversation for human takeover. Use when the lead requests a human, the conversation is too complex, or the lead is frustrated.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the transfer is needed' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_followup',
      description: 'Schedule a follow-up message to be sent later.',
      parameters: {
        type: 'object',
        properties: {
          delay_hours: { type: 'number', description: 'Hours to wait before sending' },
          message: { type: 'string', description: 'Follow-up message content' },
        },
        required: ['delay_hours', 'message'],
      },
    },
  },
]

function buildSystemPrompt(config: any, lead: any): string {
  const parts: string[] = []

  parts.push('Voce e um agente de vendas IA da SQUAAD. Responda em portugues brasileiro, de forma natural e conversacional via WhatsApp.')
  parts.push('Mantenha respostas curtas e diretas (maximo 3-4 frases). Nunca pareca um robo.')

  if (config.persona) {
    parts.push(`\n## Persona\n${config.persona}`)
  }

  if (config.skills && Array.isArray(config.skills)) {
    const skillsText = config.skills.map((s: any) => `- ${s.title}: ${s.content}`).join('\n')
    if (skillsText) parts.push(`\n## Habilidades\n${skillsText}`)
  }

  if (config.product_info) {
    parts.push(`\n## Produtos/Servicos\n${config.product_info}`)
  }

  if (config.restrictions) {
    parts.push(`\n## Restricoes\n${config.restrictions}`)
  }

  if (lead) {
    const leadInfo: string[] = []
    if (lead.name) leadInfo.push(`Nome: ${lead.name}`)
    if (lead.company_name) leadInfo.push(`Empresa: ${lead.company_name}`)
    if (lead.title) leadInfo.push(`Cargo: ${lead.title}`)
    if (lead.source) leadInfo.push(`Origem: ${lead.source}`)
    if (lead.tags && lead.tags.length > 0) leadInfo.push(`Tags: ${lead.tags.join(', ')}`)
    if (leadInfo.length > 0) {
      parts.push(`\n## Informacoes do Lead\n${leadInfo.join('\n')}`)
    }
  }

  parts.push('\n## Ferramentas Disponiveis')
  parts.push('Voce pode usar ferramentas para: agendar reunioes, qualificar o lead (BANT), mover o lead de estagio, transferir para humano, e agendar follow-ups.')
  parts.push('Use as ferramentas quando apropriado, mas sempre responda ao lead com uma mensagem.')

  return parts.join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, lead_id, instance_id, from_number } = await req.json()

    if (!message || !instance_id) {
      return new Response(JSON.stringify({ error: 'message and instance_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch triggers from UAZAPI to check keyword and lead filters
    const { data: inst } = await supabase
      .from('whatsapp_instances')
      .select('instance_token')
      .eq('id', instance_id)
      .single()

    if (!inst?.instance_token) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_instance_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch triggers from UAZAPI
    let triggers: any[] = []
    try {
      const trigRes = await fetch('https://squaad.uazapi.com/trigger/list', {
        headers: { 'token': inst.instance_token },
      })
      const trigData = await trigRes.json()
      triggers = Array.isArray(trigData) ? trigData : []
    } catch (e) {
      console.error('Failed to fetch triggers:', e)
    }

    // Find matching trigger: keyword match + active
    const msgLower = message.toLowerCase().trim()
    const matchedTrigger = triggers.find((t: any) => {
      if (!t.active) return false
      if (t.type !== 'agent') return false
      const keywords = (t.wordsToStart || '').toLowerCase().split(',').map((k: string) => k.trim()).filter(Boolean)
      if (keywords.length === 0) return false // No keywords = don't auto-trigger from our side
      return keywords.some((kw: string) => msgLower.includes(kw))
    })

    if (!matchedTrigger) {
      console.log(`No keyword trigger matched for message "${message.substring(0, 30)}", skipping`)
      return new Response(JSON.stringify({ ok: true, skipped: 'no_keyword_match' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Trigger matched: ${matchedTrigger.id}, keyword: ${matchedTrigger.wordsToStart}, agent: ${matchedTrigger.agent_id}`)

    // 1b. Get agent config
    const { data: agentConfig, error: configErr } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('instance_id', instance_id)
      .limit(1)
      .maybeSingle()

    if (configErr || !agentConfig) {
      console.log(`No agent config for instance ${instance_id}, skipping AI response`)
      return new Response(JSON.stringify({ ok: true, skipped: 'no_agent_config' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1c. Check lead filter from trigger (e.g., lead must be in specific column)
    // 2. Fetch lead info
    let lead: any = null
    if (lead_id) {
      const { data } = await supabase
        .from('crm_leads')
        .select('id, name, company_name, title, source, tags, whatsapp, board_id, column_id, chatbot_paused_until')
        .eq('id', lead_id)
        .single()
      lead = data

      // Check lead filter from trigger (column match)
      if (matchedTrigger.lead_field && matchedTrigger.lead_value && lead) {
        const fieldMap: Record<string, string> = { crm_column_id: 'column_id', crm_board_id: 'board_id' }
        const dbField = fieldMap[matchedTrigger.lead_field] || matchedTrigger.lead_field
        const leadValue = lead[dbField]
        if (matchedTrigger.lead_operator === 'equals' && leadValue !== matchedTrigger.lead_value) {
          console.log(`Lead filter failed: ${dbField}=${leadValue} != ${matchedTrigger.lead_value}`)
          return new Response(JSON.stringify({ ok: true, skipped: 'lead_filter_mismatch' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Check if chatbot is paused for this lead
      if (lead?.chatbot_paused_until) {
        const pausedUntil = new Date(lead.chatbot_paused_until)
        if (pausedUntil > new Date()) {
          console.log(`Chatbot paused for lead ${lead_id} until ${lead.chatbot_paused_until}`)
          return new Response(JSON.stringify({ ok: true, skipped: 'chatbot_paused' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // 3. Fetch recent conversation history (last 20 messages)
    const historyQuery = supabase
      .from('whatsapp_messages')
      .select('direction, content, message_type, created_at')
      .eq('instance_id', instance_id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (lead_id) {
      historyQuery.eq('lead_id', lead_id)
    } else if (from_number) {
      historyQuery.eq('remote_phone', from_number)
    }

    const { data: recentMessages } = await historyQuery

    // Build conversation history for AI context (reverse to chronological)
    const chatHistory = (recentMessages || []).reverse().map((m: any) => ({
      role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: m.content || (m.message_type !== 'text' ? `[${m.message_type}]` : ''),
    })).filter((m: any) => m.content)

    // 4. Build system prompt
    const systemPrompt = buildSystemPrompt(agentConfig, lead)

    // 5. Call AI Gateway
    const apiKey = await getIntegrationKey('lovable', 'LOVABLE_API_KEY')
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const apiUrl = AI_GATEWAY_URL

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: message },
    ]

    console.log(`Calling AI for lead ${lead_id || from_number}, history: ${chatHistory.length} msgs`)

    const aiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('AI API error:', errText)
      throw new Error(`AI API error: ${aiRes.status}`)
    }

    const aiData = await aiRes.json()
    const aiMessage = aiData.choices?.[0]?.message
    const aiContent = aiMessage?.content || ''
    const toolCalls = aiMessage?.tool_calls || []

    // 6. Process tool calls
    const toolResults: any[] = []
    for (const tc of toolCalls) {
      const fn = tc.function?.name
      let args: any = {}
      try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}

      console.log(`Tool call: ${fn}`, args)

      switch (fn) {
        case 'schedule_meeting': {
          if (lead_id) {
            await supabase.from('crm_activities').insert({
              lead_id,
              type: 'meeting',
              title: `Reuniao agendada: ${args.date} ${args.time}`,
              description: args.notes || 'Agendado pelo agente IA',
              due_date: `${args.date}T${args.time}:00`,
              status: 'pending',
            })
            toolResults.push({ tool: fn, success: true })
          }
          break
        }
        case 'qualify_bant': {
          if (lead_id) {
            const bant: any = {}
            if (args.budget) bant.budget = args.budget
            if (args.authority) bant.authority = args.authority
            if (args.need) bant.need = args.need
            if (args.timeline) bant.timeline = args.timeline
            await supabase.from('crm_leads').update({
              bant_qualification: bant,
              updated_at: new Date().toISOString(),
            }).eq('id', lead_id)
            toolResults.push({ tool: fn, success: true })
          }
          break
        }
        case 'update_lead_stage': {
          if (lead_id && lead?.board_id) {
            // Find the column with matching name
            const { data: columns } = await supabase
              .from('crm_columns')
              .select('id, name')
              .eq('board_id', lead.board_id)
            const targetCol = columns?.find((c: any) =>
              c.name.toLowerCase().replace(/\s+/g, '_') === args.stage ||
              c.name.toLowerCase().includes(args.stage.replace(/_/g, ' '))
            )
            if (targetCol) {
              await supabase.from('crm_leads').update({
                column_id: targetCol.id,
                updated_at: new Date().toISOString(),
              }).eq('id', lead_id)
              toolResults.push({ tool: fn, success: true, column: targetCol.name })
            } else {
              toolResults.push({ tool: fn, success: false, error: 'Column not found' })
            }
          }
          break
        }
        case 'transfer_to_human': {
          if (lead_id) {
            // Pause chatbot for 24 hours
            const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            await supabase.from('crm_leads').update({
              chatbot_paused_until: pauseUntil,
              updated_at: new Date().toISOString(),
            }).eq('id', lead_id)
            await supabase.from('crm_activities').insert({
              lead_id,
              type: 'note',
              title: 'Transferido para atendimento humano',
              description: `Motivo: ${args.reason}. Chatbot pausado por 24h.`,
              status: 'pending',
            })
            toolResults.push({ tool: fn, success: true })
          }
          break
        }
        case 'send_followup': {
          if (lead_id) {
            const sendAt = new Date(Date.now() + (args.delay_hours || 1) * 60 * 60 * 1000).toISOString()
            await supabase.from('crm_activities').insert({
              lead_id,
              type: 'follow_up',
              title: `Follow-up agendado (${args.delay_hours}h)`,
              description: args.message,
              due_date: sendAt,
              status: 'pending',
            })
            toolResults.push({ tool: fn, success: true })
          }
          break
        }
      }
    }

    // 7. Send the AI response back via WhatsApp
    if (aiContent && from_number && instance_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      try {
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/uazapi-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            action: 'send_text',
            instance_id,
            phone: from_number,
            message: aiContent,
            lead_id: lead_id || null,
          }),
        })

        const sendData = await sendRes.json()
        console.log(`AI response sent to ${from_number}:`, sendData?.success ? 'OK' : 'FAIL')
      } catch (e) {
        console.error('Failed to send AI response:', e)
      }
    }

    // 8. Log conversation in crm_activities
    if (lead_id) {
      await supabase.from('crm_activities').insert({
        lead_id,
        type: 'note',
        title: 'Resposta do Agente IA',
        description: `Mensagem do lead: "${message?.substring(0, 100)}"\nResposta IA: "${aiContent?.substring(0, 200)}"${toolCalls.length > 0 ? `\nFerramentas usadas: ${toolCalls.map((t: any) => t.function?.name).join(', ')}` : ''}`,
        status: 'completed',
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      response: aiContent,
      tool_calls: toolResults,
      tokens: aiData.usage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('ai-sales-agent error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
