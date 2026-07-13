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
  timestamp: string;
}

interface InstagramData {
  followers: number;
  following: number;
  biography: string;
  category: string;
  fullName: string;
  posts: PostData[];
  stories: string[];
  highlights: string[];
  profilePicUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, leadName, context } = await req.json();
    
    if (!username) {
      return new Response(
        JSON.stringify({ error: 'Username is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const cleanUsername = username.replace('@', '').trim();
    console.log('🔍 Analyzing Instagram profile:', cleanUsername, leadName ? `for ${leadName}` : '');

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

    console.log('📡 Fetching Instagram data from RapidAPI...');
    
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

    if (!profileResponse.ok) {
      console.error('❌ Instagram API error:', profileResponse.status, profileResponse.statusText);
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado ou privado', fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const instagramData = await profileResponse.json();
    console.log('✅ Instagram profile received:', { 
      username: instagramData.username,
      followers: instagramData.edge_followed_by?.count,
      fullName: instagramData.full_name
    });

    // Extract posts
    let postsData: PostData[] = [];
    
    if (postsResponse && postsResponse.ok) {
      try {
        const postsJson = await postsResponse.json();
        if (Array.isArray(postsJson)) {
          postsData = postsJson.slice(0, 12).map((post: any) => ({
            caption: post.edge_media_to_caption?.edges?.[0]?.node?.text || post.caption || post.text || '',
            likes: post.edge_liked_by?.count || post.like_count || 0,
            comments: post.edge_media_to_comment?.count || post.comment_count || 0,
            timestamp: post.taken_at_timestamp ? new Date(post.taken_at_timestamp * 1000).toISOString() : ''
          })).filter((p: PostData) => p.caption);
          console.log(`📝 Fetched ${postsData.length} posts from posts endpoint`);
        }
      } catch (e) {
        console.log('⚠️ Error parsing posts response:', e.message);
      }
    }
    
    if (postsData.length === 0 && instagramData.edge_owner_to_timeline_media?.edges) {
      postsData = instagramData.edge_owner_to_timeline_media.edges.slice(0, 12).map((edge: any) => ({
        caption: edge.node?.edge_media_to_caption?.edges?.[0]?.node?.text || '',
        likes: edge.node?.edge_liked_by?.count || 0,
        comments: edge.node?.edge_media_to_comment?.count || 0,
        timestamp: edge.node?.taken_at_timestamp ? new Date(edge.node.taken_at_timestamp * 1000).toISOString() : ''
      })).filter((p: PostData) => p.caption);
      console.log(`📝 Fetched ${postsData.length} posts from profile timeline`);
    }

    // Stories
    let storiesData: string[] = [];
    try {
      const storiesResponse = await fetch(
        `https://instagram-looter2.p.rapidapi.com/stories?username=${cleanUsername}`,
        { headers: rapidApiHeaders }
      );
      if (storiesResponse.ok) {
        const storiesJson = await storiesResponse.json();
        if (Array.isArray(storiesJson)) {
          storiesData = storiesJson.slice(0, 5).map((story: any) => story.caption || story.text || story.title || '').filter(Boolean);
          console.log(`📖 Fetched ${storiesData.length} stories`);
        }
      }
    } catch (e) {
      console.log('⚠️ Stories not available:', e.message);
    }

    // Highlights
    let highlightsData: string[] = [];
    if (instagramData.edge_highlight_reels?.edges) {
      highlightsData = instagramData.edge_highlight_reels.edges.slice(0, 10).map((edge: any) => edge.node?.title || '').filter(Boolean);
      console.log(`⭐ Found ${highlightsData.length} highlights`);
    }

    const profileData: InstagramData = {
      followers: instagramData.edge_followed_by?.count || 0,
      following: instagramData.edge_follow?.count || 0,
      biography: instagramData.biography || '',
      category: instagramData.category_name || 'Usuário',
      fullName: instagramData.full_name || '',
      posts: postsData,
      stories: storiesData,
      highlights: highlightsData,
      profilePicUrl: instagramData.profile_pic_url_hd || instagramData.profile_pic_url || ''
    };

    console.log('📊 Profile data compiled:', {
      followers: profileData.followers,
      posts: profileData.posts.length,
      stories: profileData.stories.length,
      highlights: profileData.highlights.length
    });

    // Save profile picture to Supabase Storage
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
            .upload(fileName, imageBuffer, { contentType: 'image/jpeg', upsert: true });

          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('instagram-profiles').getPublicUrl(fileName);
            savedImagePath = publicUrl;
            console.log('✅ Profile picture saved:', savedImagePath);
          } else {
            console.error('❌ Error uploading image:', uploadError);
          }
        }
      } catch (error) {
        console.error('❌ Error processing profile picture:', error);
      }
    }

    // Generate personalized message
    console.log('🤖 Generating personalized message with GPT...');
    
    const postsSection = profileData.posts.length > 0 
      ? profileData.posts.map((p, i) => `${i + 1}. "${p.caption.substring(0, 200)}${p.caption.length > 200 ? '...' : ''}" (${p.likes.toLocaleString('pt-BR')} likes)`).join('\n')
      : 'Não disponíveis';

    // Prompt B2B (Landing Page SQUAAD)
    const promptB2B = `
Você é um especialista em soluções empresariais de IA da SQUAAD. Crie uma mensagem IMPACTANTE para um potencial cliente B2B.

DADOS DO PERFIL INSTAGRAM:
- Nome: ${leadName || profileData.fullName || 'Amigo(a)'}
- Username: @${cleanUsername}
- Seguidores: ${profileData.followers.toLocaleString('pt-BR')}
- Bio: "${profileData.biography}"
- Categoria: ${profileData.category}
- Posts recentes: ${postsSection}

CONTEXTO SQUAAD:
- A SQUAAD é especialista em implementar IA para empresas
- Foco em: Captação de clientes, Vendas automatizadas, Gestão empresarial inteligente
- Resultados comprovados: 42% de economia mensal para clientes
- Presente no Brasil, Chile e Portugal
- Diretores: Carlos Eduardo (Estratégias) e Fabio Petrillo (Tecnologias)
- Atendimento 24/7 com agentes de IA que nunca dormem

INSTRUÇÕES OBRIGATÓRIAS:
1. **Analise o perfil** para identificar o nicho de negócio do lead
2. **Estrutura da mensagem**:
   - Cumprimento: "Opa ${leadName || profileData.fullName || 'amigo(a)'}, tudo belê? 😄"
   - Reconhecimento do trabalho/negócio do lead baseado nas postagens e bio
   - Pergunta sobre desafios na captação de clientes, vendas ou gestão
   - Proposta de como a IA da SQUAAD pode resolver essas dores
   - Menção a automação de atendimento, vendas 24/7, e economia de tempo
   - Convite para consultoria gratuita com os diretores Carlos Eduardo e Fabio
   - CTA: "Quer descobrir como a IA pode transformar seu negócio? 🚀"

3. **Foque em benefícios B2B**: automação de vendas, atendimento 24/7, economia de tempo, escala do negócio, captação inteligente de leads
4. **Tom**: Brasileiro informal, profissional mas acessível
5. **Emojis estratégicos**: 🤖💰🚀📈✨
6. **Limite**: 700-950 caracteres

Responda APENAS com a mensagem personalizada.
`;

    // Prompt VHS - TOM NATURAL de conversa WhatsApp entre amigos
    const promptVHS = `
Você é o Carlos Eduardo, co-fundador da SQUAAD, mandando uma mensagem REAL no WhatsApp para alguém que acabou de se cadastrar na Imersão "Do VHS ao Prompt". Escreva como se fosse uma conversa REAL entre dois amigos.

DADOS DO PERFIL INSTAGRAM (use para personalizar):
- Nome: ${leadName || profileData.fullName || 'Amigo(a)'}
- Username: @${cleanUsername}
- Seguidores: ${profileData.followers.toLocaleString('pt-BR')}
- Seguindo: ${profileData.following.toLocaleString('pt-BR')}
- Bio: "${profileData.biography}"
- Categoria: ${profileData.category}

ÚLTIMAS POSTAGENS (leia e mencione algo específico):
${postsSection}

STORIES: ${profileData.stories.length > 0 ? profileData.stories.join(' | ') : 'Não disponíveis'}
DESTAQUES: ${profileData.highlights.length > 0 ? profileData.highlights.join(', ') : 'Não disponíveis'}

SOBRE A IMERSÃO (mencione de forma CASUAL):
- Nome: Do VHS ao Prompt
- Data: 01 de Março de 2026, 09h às 15h (6h ao vivo e online)
- Valor: R$ 97
- Proposta: Ensinar profissionais a usar IA no dia a dia pra ganhar tempo e dinheiro

REGRAS ABSOLUTAS DE TOM:
1. Escreva como uma mensagem REAL de WhatsApp entre amigos
2. Use linguagem 100% natural brasileira: "e aí", "massa", "bora", "cara", "mano", "tá ligado", "show"
3. PROIBIDO frases de marketing: "garanta sua vaga", "transforme sua vida", "oportunidade única", "não perca"
4. PROIBIDO excesso de emojis - use no máximo 3-4 no total
5. Mencione algo ESPECÍFICO do perfil (um post, a bio, o nicho)
6. Faça uma pergunta GENUÍNA sobre o trabalho/vida da pessoa
7. Mencione a imersão como quem convida um amigo pra algo legal, não como vendedor
8. Limite: 400-600 caracteres (mensagem curta, como no WhatsApp de verdade)

EXEMPLO DO TOM DESEJADO (NÃO copie, apenas inspire-se):
"E aí [nome]! Vi lá no teu insta que tu trabalha com [nicho] né? Massa demais! To organizando uma imersão sobre IA dia 01/03, 6 horas de conteúdo prático… acho que tu ia curtir demais. Como tá o movimento aí no [negócio]? 😄"

Responda APENAS com a mensagem, sem aspas, sem explicações.
`;

    const isVHS = context === 'vhs';
    const prompt = isVHS ? promptVHS : promptB2B;
    
    console.log('🎯 Using prompt for context:', isVHS ? 'VHS (natural WhatsApp tone)' : 'B2B (SQUAAD)');
    
    let personalizedMessage = isVHS
      ? `E aí ${leadName || cleanUsername}! Vi teu perfil e curti demais o que tu compartilha! To organizando uma imersão sobre IA dia 01/03, 6 horas de conteúdo prático pra quem quer usar isso no dia a dia. Acho que tu ia curtir! Bora trocar uma ideia? 😄`
      : `Opa ${leadName || cleanUsername}, tudo belê? 😄 Vi seu negócio e curti demais! A SQUAAD ajuda empresários como você a automatizar captação de clientes, vendas e gestão com IA. Nossos clientes economizam em média 42% por mês! Quer uma consultoria gratuita? 🚀`;

    try {
      const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.9
        })
      });

      if (openAiResponse.ok) {
        const aiData = await openAiResponse.json();
        personalizedMessage = aiData.choices[0]?.message?.content?.trim() || personalizedMessage;
        console.log('✅ Generated personalized message:', personalizedMessage.substring(0, 100) + '...');
      } else {
        const errorText = await openAiResponse.text();
        console.error('❌ OpenAI API error:', openAiResponse.status, errorText);
      }
    } catch (openAiError) {
      console.error('❌ OpenAI fetch error:', openAiError);
    }

    const simplifiedPosts = profileData.posts.map(p => p.caption);

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
          posts: simplifiedPosts,
          stories: profileData.stories,
          highlights: profileData.highlights,
          profilePicUrl: profileData.profilePicUrl
        },
        profilePicPath: savedImagePath,
        personalizedMessage: personalizedMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in analyze-instagram-profile function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message, fallback: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
