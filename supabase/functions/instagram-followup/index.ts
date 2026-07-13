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

const UAZAPI_BASE_URL = 'https://squaad.uazapi.com'
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

function normalizeBRPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('55') && clean.length === 12) {
    return clean.slice(0, 4) + '9' + clean.slice(4)
  }
  return clean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const LOVABLE_API_KEY = await getIntegrationKey('lovable', 'LOVABLE_API_KEY')
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')

    const body = await req.json().catch(() => ({}))
    const { lead_id } = body

    // Load agent config to check if IG follow-up is enabled
    const { data: agentConfig } = await supabase
      .from('agent_configs')
      .select('ig_followup_enabled, ig_followup_delay_min, ig_followup_context')
      .eq('ig_followup_enabled', true)
      .limit(1)
      .maybeSingle()

    if (!agentConfig && !lead_id) {
      return new Response(JSON.stringify({ ok: true, skipped: 'ig_followup_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const threshold = agentConfig?.ig_followup_delay_min || body.minutes_threshold || 60
    const productContext = agentConfig?.ig_followup_context || 'Metodo SQUAAD - Mentoria onde o empresario aprende a construir suas proprias solucoes com IA.'

    // Get connected WhatsApp instance
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_token')
      .eq('status', 'connected')
      .limit(1)

    if (!instances?.[0]) {
      return new Response(JSON.stringify({ error: 'No connected instance' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const instance = instances[0]

    // Find leads that need follow-up
    let leadsToFollow: any[] = []

    if (lead_id) {
      // Specific lead
      const { data } = await supabase.from('crm_leads')
        .select('id, name, whatsapp, instagram, tags')
        .eq('id', lead_id)
        .single()
      if (data) leadsToFollow = [data]
    } else {
      // Auto-detect: leads with last inbound message > threshold minutes ago
      // and no outbound message after that, and no 'instagram_followup_sent' tag
      const cutoff = new Date(Date.now() - threshold * 60 * 1000).toISOString()

      const { data: recentLeads } = await supabase
        .from('crm_leads')
        .select('id, name, whatsapp, instagram, tags')
        .not('tags', 'cs', '{instagram_followup_sent}')
        .not('whatsapp', 'is', null)

      if (recentLeads) {
        for (const lead of recentLeads) {
          // Check last message timing
          const { data: lastInbound } = await supabase
            .from('whatsapp_messages')
            .select('created_at')
            .eq('remote_phone', normalizeBRPhone(lead.whatsapp.replace(/\D/g, '')))
            .eq('direction', 'inbound')
            .order('created_at', { ascending: false })
            .limit(1)

          if (!lastInbound?.length) continue

          const lastInboundAt = new Date(lastInbound[0].created_at)
          if (lastInboundAt > new Date(cutoff)) continue // Too recent

          // Check if we already sent an outbound after the inbound
          const { data: lastOutbound } = await supabase
            .from('whatsapp_messages')
            .select('created_at')
            .eq('remote_phone', normalizeBRPhone(lead.whatsapp.replace(/\D/g, '')))
            .eq('direction', 'outbound')
            .gt('created_at', lastInbound[0].created_at)
            .limit(1)

          if (lastOutbound?.length) continue // Already followed up

          leadsToFollow.push(lead)
        }
      }
    }

    console.log(`[IG-FOLLOWUP] ${leadsToFollow.length} leads to follow up`)

    const results: any[] = []

    for (const lead of leadsToFollow.slice(0, 5)) { // Max 5 per run
      try {
        const instagram = lead.instagram?.replace('@', '').trim()

        let igData: any = null
        let storiesText = ''
        let postsText = ''
        let bioText = ''

        // Scrape Instagram if handle exists and RapidAPI key available
        if (instagram && RAPIDAPI_KEY) {
          console.log(`[IG-FOLLOWUP] Scraping @${instagram} for ${lead.name}`)

          const rapidHeaders = {
            'X-Rapidapi-Key': RAPIDAPI_KEY,
            'X-Rapidapi-Host': 'instagram-looter2.p.rapidapi.com',
          }

          // Fetch profile + posts
          const [profileRes, postsRes, storiesRes] = await Promise.all([
            fetch(`https://instagram-looter2.p.rapidapi.com/profile?username=${instagram}`, { headers: rapidHeaders }).catch(() => null),
            fetch(`https://instagram-looter2.p.rapidapi.com/posts?username=${instagram}&count=6`, { headers: rapidHeaders }).catch(() => null),
            fetch(`https://instagram-looter2.p.rapidapi.com/stories?username=${instagram}`, { headers: rapidHeaders }).catch(() => null),
          ])

          if (profileRes?.ok) {
            const profile = await profileRes.json()
            bioText = profile.biography || ''
            igData = {
              fullName: profile.full_name || '',
              followers: profile.edge_followed_by?.count || 0,
              biography: bioText,
              category: profile.category_name || '',
            }

            // Extract posts from profile timeline (more reliable than separate endpoint)
            const timelinePosts = profile.edge_owner_to_timeline_media?.edges || []
            if (timelinePosts.length > 0) {
              postsText = timelinePosts.slice(0, 6).map((edge: any) => {
                const caption = edge.node?.edge_media_to_caption?.edges?.[0]?.node?.text || ''
                return caption.substring(0, 200)
              }).filter(Boolean).join('\n---\n')
              console.log(`[IG-FOLLOWUP] Got ${timelinePosts.length} posts from profile timeline`)
            }

            // Extract highlights titles
            const highlights = profile.edge_highlight_reels?.edges || []
            if (highlights.length > 0) {
              const highlightTitles = highlights.map((h: any) => h.node?.title || '').filter(Boolean)
              if (highlightTitles.length > 0) {
                postsText += '\n\nDestaques do perfil: ' + highlightTitles.join(', ')
              }
            }
          }

          if (!postsText && postsRes?.ok) {
            try {
              const posts = await postsRes.json()
              if (Array.isArray(posts)) {
                postsText = posts.slice(0, 5).map((p: any) => {
                  const caption = p.edge_media_to_caption?.edges?.[0]?.node?.text || p.caption || ''
                  return caption.substring(0, 200)
                }).filter(Boolean).join('\n---\n')
              }
            } catch {}
          }

          // Try stories from primary endpoint
          if (storiesRes?.ok) {
            try {
              const stories = await storiesRes.json()
              if (Array.isArray(stories) && stories.length > 0) {
                storiesText = stories.slice(0, 5).map((s: any) =>
                  s.caption || s.text || s.title || '(story visual - sem texto)'
                ).join('\n')
              }
            } catch {}
          }

          // Fallback: try alternative stories endpoint
          if (!storiesText) {
            try {
              const altStoriesRes = await fetch(
                `https://instagram-looter2.p.rapidapi.com/user-stories?username=${instagram}`,
                { headers: rapidHeaders }
              )
              if (altStoriesRes?.ok) {
                const altStories = await altStoriesRes.json()
                const storyItems = altStories?.items || altStories?.reel?.items || (Array.isArray(altStories) ? altStories : [])
                if (storyItems.length > 0) {
                  storiesText = storyItems.slice(0, 5).map((s: any) => {
                    // Extract any text from story overlays/stickers
                    const texts: string[] = []
                    if (s.caption) texts.push(s.caption)
                    if (s.story_bloks_stickers) {
                      for (const st of s.story_bloks_stickers) {
                        if (st.bloks_sticker?.sticker_data?.ig_mention) texts.push('@' + st.bloks_sticker.sticker_data.ig_mention.username)
                      }
                    }
                    if (s.story_locations) texts.push('Local: ' + s.story_locations.map((l: any) => l.location?.name || '').join(', '))
                    if (s.story_hashtags) texts.push('Tags: ' + s.story_hashtags.map((h: any) => '#' + h.hashtag?.name || '').join(' '))
                    if (s.story_music_stickers) texts.push('Musica: ' + (s.story_music_stickers[0]?.music_asset_info?.display_artist || '') + ' - ' + (s.story_music_stickers[0]?.music_asset_info?.title || ''))
                    return texts.length > 0 ? texts.join(' | ') : '(story visual)'
                  }).filter((t: string) => t !== '(story visual)').join('\n')
                  console.log(`[IG-FOLLOWUP] Got ${storyItems.length} stories from alt endpoint`)
                }
              }
            } catch (e) {
              console.log(`[IG-FOLLOWUP] Alt stories endpoint failed: ${e}`)
            }
          }

          console.log(`[IG-FOLLOWUP] Scraped: bio=${bioText.length}c, posts=${postsText.length}c, stories=${storiesText.length}c`)
        }

        // Generate personalized follow-up message with AI
        const systemPrompt = `Voce e um closer humano da SQUAAD. Voce acabou de stalkear o Instagram do lead e vai mandar uma mensagem DISRUPTIVA no WhatsApp que faca o lead pensar "uau, que abordagem diferente".

OBJETIVO: Reengajar o lead que parou de responder. A mensagem tem que ser tao pessoal e especifica que o lead fique impressionado.

REGRAS INEGOCIAVEIS:
1. SEM emoji. Zero. Nenhum.
2. SEM tracejao longo. Use virgula e ponto.
3. Tom de AMIGO que realmente viu o conteudo, nao de vendedor.
4. MAXIMO 4 linhas.
5. PRIORIDADE ABSOLUTA: Se tiver STORIES, use o story como gancho principal. Stories sao o conteudo mais pessoal e recente.
6. Se nao tiver stories, use o POST mais recente.
7. Se nao tiver posts, use a BIO.
8. NUNCA diga "vi seu perfil" ou "vi suas redes". Seja ESPECIFICO. Cite o restaurante, a roupa, a viagem, o treino, o filho, a reuniao, o evento.
9. A pergunta tem que ser GENUINA sobre o conteudo, nao sobre vendas.
10. A conexao com o produto deve parecer um insight natural, tipo "inclusive isso me lembrou que..."
11. NUNCA use "Aproveitando" ou "E aproveitando" - parece script.

PRODUTO: ${productContext}

EXEMPLOS DE MENSAGENS DISRUPTIVAS:

Com STORY de restaurante:
"Oi Ana, voce almocou no Madero hoje ne, que lugar top. Me diz, vale a pena pra levar a familia ou e mais pra rolezinho? Pergunto porque quero te ver nesse pique de quem curte coisas boas e ao mesmo tempo ta pronta pra construir algo grande com IA no seu negocio."

Com STORY de treino:
"Fala Pedro, vi que voce ta puxando ferro cedo hoje, disciplina insana. Me conta, faz quanto tempo que treina nesse ritmo? Porque essa mesma disciplina que voce tem no treino e exatamente o que precisa pra dominar IA no seu negocio."

Com POST de evento:
"Carla, vi que voce participou daquele evento de empreendedores semana passada, muito massa. O que mais te marcou la? Pergunto porque o Metodo SQUAAD e justamente pra quem ja ta nesse nivel e quer dar o proximo passo com IA."

SEM dados do Instagram:
"Oi [nome], passando aqui porque fiquei pensando no nosso papo. Me diz uma coisa, qual e a tarefa que mais consome seu tempo hoje no negocio? Porque geralmente e exatamente essa que a gente resolve primeiro com IA no Metodo SQUAAD."`

        let userPrompt = `Lead: ${lead.name}`
        if (igData) {
          userPrompt += `\nInstagram: @${instagram}`
          if (igData.biography) userPrompt += `\nBio: ${igData.biography}`
          if (igData.category) userPrompt += `\nCategoria: ${igData.category}`
          if (igData.followers) userPrompt += `\nSeguidores: ${igData.followers}`
        }
        if (storiesText) {
          userPrompt += `\n\nStories recentes:\n${storiesText}`
        }
        if (postsText) {
          userPrompt += `\n\nPosts recentes:\n${postsText}`
        }
        if (!igData && !storiesText && !postsText) {
          userPrompt += '\n(Sem dados do Instagram disponíveis, use gancho genérico)'
        }

        userPrompt += '\n\nGere APENAS a mensagem de follow-up, nada mais.'

        const aiRes = await fetch(AI_GATEWAY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.8,
            max_tokens: 300,
          }),
        })

        if (!aiRes.ok) {
          console.error(`[IG-FOLLOWUP] AI error for ${lead.name}: ${aiRes.status}`)
          continue
        }

        const aiData = await aiRes.json()
        let followUpMsg = aiData.choices?.[0]?.message?.content || ''

        // Clean up: remove quotes, trim
        followUpMsg = followUpMsg.replace(/^["']|["']$/g, '').trim()

        if (!followUpMsg) {
          console.error(`[IG-FOLLOWUP] Empty AI response for ${lead.name}`)
          continue
        }

        console.log(`[IG-FOLLOWUP] Message for ${lead.name}: ${followUpMsg.substring(0, 80)}...`)

        // Send WhatsApp message
        const cleanPhone = normalizeBRPhone(lead.whatsapp.replace(/\D/g, ''))
        const sendRes = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ number: cleanPhone, text: followUpMsg }),
        })

        const sendData = await sendRes.json()
        const sent = sendRes.ok && !sendData.error

        // Save outbound message
        await supabase.from('whatsapp_messages').insert({
          instance_id: instance.id,
          remote_phone: cleanPhone,
          direction: 'outbound',
          content: followUpMsg,
          message_type: 'text',
          status: sent ? 'sent' : 'failed',
          lead_id: lead.id,
          metadata: {
            senderName: 'SQUAAD AI',
            type: 'instagram_followup',
            instagram_scraped: !!igData,
            has_stories: storiesText.length > 0,
          },
        })

        // Tag the lead so we don't repeat
        const currentTags = lead.tags || []
        if (!currentTags.includes('instagram_followup_sent')) {
          await supabase.from('crm_leads')
            .update({ tags: [...currentTags, 'instagram_followup_sent'] })
            .eq('id', lead.id)
        }

        // Log activity
        await supabase.from('crm_activities').insert({
          lead_id: lead.id,
          activity_type: 'ai_followup',
          description: `Follow-up IA enviado via WhatsApp (Instagram scrape: ${igData ? 'sim' : 'nao'})`,
          metadata: {
            message: followUpMsg,
            instagram_data: igData,
            stories_found: storiesText.length > 0,
            posts_found: postsText.length > 0,
          },
        })

        results.push({ lead: lead.name, sent, message: followUpMsg.substring(0, 100) })
      } catch (e: any) {
        console.error(`[IG-FOLLOWUP] Error for ${lead.name}:`, e.message)
        results.push({ lead: lead.name, error: e.message })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[IG-FOLLOWUP] Fatal:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
