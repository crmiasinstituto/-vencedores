import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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

interface PostData {
  caption: string;
  likes: number;
  comments: number;
}

interface InstagramData {
  followers: number;
  following: number;
  biography: string;
  category: string;
  fullName: string;
  posts: PostData[];
  profilePicUrl: string;
}

interface AIInsights {
  nicho: string;
  sugestoes_ia: string[];
  automacoes_recomendadas: string[];
  experiencia_cliente: string[];
  gestao_empresarial: string[];
  customer_success: string[];
  pontos_dor: string[];
  potencial_captacao: string;
  potencial_vendas: string;
  potencial_gestao: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instagram_username, client_name, company_name, whatsapp } = await req.json();
    
    if (!instagram_username) {
      return new Response(
        JSON.stringify({ error: 'Instagram username is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const cleanUsername = instagram_username.replace('@', '').trim();
    console.log('🔍 Generating insights for:', cleanUsername, 'Company:', company_name);

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    const openAiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!rapidApiKey || !openAiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const rapidApiHeaders = {
      'X-Rapidapi-Key': rapidApiKey,
      'X-Rapidapi-Host': 'instagram-looter2.p.rapidapi.com'
    };

    // Fetch Instagram profile data
    console.log('📡 Fetching Instagram data from RapidAPI...');
    
    let profileData: InstagramData = {
      followers: 0,
      following: 0,
      biography: '',
      category: 'Empresa',
      fullName: client_name || '',
      posts: [],
      profilePicUrl: ''
    };
    
    let instagramFetchSuccess = false;
    
    try {
      const [profileResponse, postsResponse] = await Promise.all([
        fetch(`https://instagram-looter2.p.rapidapi.com/profile?username=${cleanUsername}`, {
          method: 'GET',
          headers: rapidApiHeaders
        }),
        fetch(`https://instagram-looter2.p.rapidapi.com/posts?username=${cleanUsername}&count=12`, {
          method: 'GET',
          headers: rapidApiHeaders
        }).catch(e => {
          console.log('⚠️ Posts endpoint failed:', e.message);
          return null;
        })
      ]);

      if (profileResponse.ok) {
        const instagramData = await profileResponse.json();
        console.log('✅ Instagram profile received:', { 
          username: instagramData.username,
          followers: instagramData.edge_followed_by?.count
        });

        // Extract posts
        let postsData: PostData[] = [];
        
        if (postsResponse && postsResponse.ok) {
          try {
            const postsJson = await postsResponse.json();
            if (Array.isArray(postsJson)) {
              postsData = postsJson.slice(0, 12).map((post: any) => ({
                caption: post.edge_media_to_caption?.edges?.[0]?.node?.text || post.caption || '',
                likes: post.edge_liked_by?.count || post.like_count || 0,
                comments: post.edge_media_to_comment?.count || post.comment_count || 0
              })).filter((p: PostData) => p.caption);
            }
          } catch (e) {
            console.log('⚠️ Error parsing posts response');
          }
        }
        
        if (postsData.length === 0 && instagramData.edge_owner_to_timeline_media?.edges) {
          postsData = instagramData.edge_owner_to_timeline_media.edges.slice(0, 12).map((edge: any) => ({
            caption: edge.node?.edge_media_to_caption?.edges?.[0]?.node?.text || '',
            likes: edge.node?.edge_liked_by?.count || 0,
            comments: edge.node?.edge_media_to_comment?.count || 0
          })).filter((p: PostData) => p.caption);
        }

        profileData = {
          followers: instagramData.edge_followed_by?.count || 0,
          following: instagramData.edge_follow?.count || 0,
          biography: instagramData.biography || '',
          category: instagramData.category_name || 'Empresa',
          fullName: instagramData.full_name || client_name || '',
          posts: postsData,
          profilePicUrl: instagramData.profile_pic_url_hd || instagramData.profile_pic_url || ''
        };
        
        instagramFetchSuccess = true;
      } else {
        console.log('⚠️ Instagram API returned non-OK status:', profileResponse.status);
      }
    } catch (instagramError) {
      console.error('⚠️ Instagram fetch error:', instagramError);
    }

    // Download and save profile picture
    let savedImagePath = '';
    if (profileData.profilePicUrl) {
      console.log('🖼️ Downloading profile picture...');
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const imageResponse = await fetch(profileData.profilePicUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const fileName = `${cleanUsername}_${Date.now()}.jpg`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('instagram-profiles')
            .upload(fileName, imageBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('instagram-profiles')
              .getPublicUrl(fileName);
            
            savedImagePath = publicUrl;
            console.log('✅ Profile picture saved:', savedImagePath);
          }
        }
      } catch (error) {
        console.error('❌ Error processing profile picture:', error);
      }
    }

    // Generate AI insights
    console.log('🤖 Generating AI insights with GPT-4o...');
    
    const postsSection = profileData.posts.length > 0 
      ? profileData.posts.map((p, i) => `${i + 1}. "${p.caption.substring(0, 200)}${p.caption.length > 200 ? '...' : ''}" (${p.likes.toLocaleString('pt-BR')} likes)`).join('\n')
      : 'Não disponíveis';

    const insightsPrompt = `
Você é um consultor especialista em IA empresarial da SQUAAD. Analise este perfil de negócio e gere insights estratégicos DIFERENCIADOS para implementação de agentes de IA.

DADOS DO PERFIL:
- Nome: ${client_name || profileData.fullName}
- Empresa: ${company_name || 'Não informado'}
- Username: @${cleanUsername}
- Seguidores: ${profileData.followers > 0 ? profileData.followers.toLocaleString('pt-BR') : 'Não disponível'}
- Bio: "${profileData.biography || 'Não disponível'}"
- Categoria: ${profileData.category}

ÚLTIMAS POSTAGENS:
${postsSection}

GERE UM RELATÓRIO ESTRATÉGICO EM JSON COM INSIGHTS DIFERENCIADOS:

{
  "nicho": "Segmento de atuação identificado com detalhes específicos",
  "sugestoes_ia": [
    "Agente de IA para atendimento 24/7 com personalidade da marca",
    "Sistema de qualificação de leads via WhatsApp com scoring automático",
    "Agente de vendas consultivas que entende o catálogo completo",
    "Assistente de pós-venda para aumentar retenção e indicações",
    "Automação de agendamentos e confirmações inteligentes"
  ],
  "automacoes_recomendadas": [
    "Fluxo de boas-vindas personalizado por segmento de cliente",
    "Recuperação automática de clientes inativos com ofertas personalizadas",
    "Sistema de NPS automatizado com ações baseadas na nota",
    "Follow-up inteligente que aprende o melhor horário de contato",
    "Integração com CRM para histórico completo de interações"
  ],
  "experiencia_cliente": [
    "Ideia 1 para melhorar jornada do cliente com IA",
    "Ideia 2 para personalização da experiência",
    "Ideia 3 para surpreender e encantar clientes"
  ],
  "gestao_empresarial": [
    "Ideia 1 para dashboards e relatórios automáticos",
    "Ideia 2 para otimização de processos internos",
    "Ideia 3 para tomada de decisão baseada em dados"
  ],
  "customer_success": [
    "Ideia 1 para reduzir churn e aumentar LTV",
    "Ideia 2 para programa de fidelidade com IA",
    "Ideia 3 para upsell e cross-sell automatizado"
  ],
  "pontos_dor": [
    "Problema 1 urgente que a IA resolve imediatamente",
    "Problema 2 que gera perda de receita hoje",
    "Problema 3 que compromete a experiência do cliente"
  ],
  "potencial_captacao": "Alto/Médio/Baixo - Justificativa específica para este negócio",
  "potencial_vendas": "Alto/Médio/Baixo - Justificativa específica para este negócio",
  "potencial_gestao": "Alto/Médio/Baixo - Justificativa específica para este negócio"
}

IMPORTANTE:
- Seja ESPECÍFICO para o nicho identificado, não genérico
- Considere o tamanho do perfil (seguidores) para calibrar as sugestões
- Foque em ideias que geram ROI rápido e mensurável
- Inclua pelo menos uma ideia inovadora/diferenciada em cada categoria
- Se não houver dados de Instagram, gere insights baseados no nome da empresa e contexto

Responda APENAS com o JSON, sem texto adicional.
`;

    let aiInsights: AIInsights = {
      nicho: 'Não identificado',
      sugestoes_ia: [],
      automacoes_recomendadas: [],
      experiencia_cliente: [],
      gestao_empresarial: [],
      customer_success: [],
      pontos_dor: [],
      potencial_captacao: 'Médio',
      potencial_vendas: 'Médio',
      potencial_gestao: 'Médio'
    };

    try {
      const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: insightsPrompt }],
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (openAiResponse.ok) {
        const aiData = await openAiResponse.json();
        const rawContent = aiData.choices[0]?.message?.content?.trim() || '';
        
        // Parse JSON from response
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
          console.log('✅ AI insights generated successfully');
        }
      } else {
        const errorText = await openAiResponse.text();
        console.error('❌ OpenAI API error:', openAiResponse.status, errorText);
      }
    } catch (aiError) {
      console.error('❌ Error generating AI insights:', aiError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        username: cleanUsername,
        instagramData: {
          followers: profileData.followers,
          following: profileData.following,
          biography: profileData.biography,
          category: profileData.category,
          fullName: profileData.fullName,
          posts: profileData.posts.map(p => p.caption)
        },
        profilePicUrl: savedImagePath || profileData.profilePicUrl,
        aiInsights
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in generate-client-insights function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message,
        fallback: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
