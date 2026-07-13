// instagram-snapshot-cron
// Tira snapshots semanais do Instagram dos leads com handle ativo,
// pra rastrear evolução de posicionamento — especialmente após DISC/PDF.
//
// Modos:
//   - body { mode: 'weekly' }       → roda leads com último snapshot > 6 dias OU sem snapshot
//   - body { lead_ids: [uuid,...] } → força snapshot agora pra esses leads
//   - body { lead_id: uuid }        → idem, single
//
// Auth: pg_cron usa x-cron-trigger header. Chamadas humanas usam JWT do admin.

import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-trigger",
};

const SC_BASE = "https://api.scrapecreators.com";
const MIN_DAYS_BETWEEN_SNAPSHOTS = 6;
const MAX_LEADS_PER_RUN = 60; // limite de proteção pra não estourar conta

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PostMetric {
  type: string;
  likes: number;
  comments: number;
  caption: string;
  taken_at: string | null;
  shortcode: string | null;
}

async function scrapeOne(handle: string, scKey: string) {
  const cleanHandle = handle.replace(/^@/, "").trim();
  if (!cleanHandle) return { ok: false, error: "handle vazio" } as const;

  // 1. Profile
  const profRes = await fetch(
    `${SC_BASE}/v1/instagram/profile?handle=${encodeURIComponent(cleanHandle)}`,
    { headers: { "x-api-key": scKey } }
  );
  if (!profRes.ok) {
    return { ok: false, error: `profile HTTP ${profRes.status}` } as const;
  }
  const profJson = await profRes.json();
  const user = profJson?.data?.user;
  if (!user?.username) {
    return { ok: false, error: "perfil nao encontrado" } as const;
  }

  // 2. Posts
  let postsRaw: any[] = [];
  try {
    const r = await fetch(
      `${SC_BASE}/v2/instagram/user/posts?handle=${encodeURIComponent(cleanHandle)}`,
      { headers: { "x-api-key": scKey } }
    );
    if (r.ok) {
      const j = await r.json();
      postsRaw = (j?.items || []).slice(0, 12);
    }
  } catch (_e) {
    // posts são best-effort
  }

  // 3. Métricas agregadas
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const postsMetrics: PostMetric[] = postsRaw.map((p: any) => {
    const ts = p.taken_at_timestamp ? Number(p.taken_at_timestamp) * 1000 : null;
    return {
      type: p.media_type || p.product_type || (p.is_video ? "video" : "image"),
      likes: p.like_count || p.edge_liked_by?.count || 0,
      comments: p.comment_count || p.edge_media_to_comment?.count || 0,
      caption:
        (p.caption?.text || p.edge_media_to_caption?.edges?.[0]?.node?.text || "").slice(0, 600),
      taken_at: ts ? new Date(ts).toISOString() : null,
      shortcode: p.shortcode || p.code || null,
    };
  });

  const postsLast30d = postsMetrics.filter((p) => {
    if (!p.taken_at) return false;
    return new Date(p.taken_at).getTime() > thirtyDaysAgo;
  }).length;

  const totalLikes = postsMetrics.reduce((s, p) => s + p.likes, 0);
  const totalComments = postsMetrics.reduce((s, p) => s + p.comments, 0);
  const avgLikes = postsMetrics.length ? totalLikes / postsMetrics.length : 0;
  const avgComments = postsMetrics.length ? totalComments / postsMetrics.length : 0;
  const followers = user.edge_followed_by?.count || 0;
  const engagement = followers > 0 ? (avgLikes + avgComments) / followers : 0;

  // Top hashtags
  const tagCount = new Map<string, number>();
  for (const p of postsMetrics) {
    const tags = p.caption.match(/#[a-z0-9_]+/gi) || [];
    for (const t of tags) {
      const k = t.toLowerCase();
      tagCount.set(k, (tagCount.get(k) || 0) + 1);
    }
  }
  const topHashtags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t);

  return {
    ok: true as const,
    snapshot: {
      username: user.username,
      full_name: user.full_name || null,
      biography: user.biography || null,
      category:
        user.category_name || user.business_category_name || user.overall_category_name || null,
      external_url: user.external_url || null,
      profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url || null,
      followers,
      following: user.edge_follow?.count || 0,
      posts_count: user.edge_owner_to_timeline_media?.count || 0,
      is_verified: !!user.is_verified,
      is_business: !!(user.is_business_account || user.is_professional_account),
      is_private: !!user.is_private,
      posts_metrics: postsMetrics,
      engagement_rate: engagement,
      posts_last_30d: postsLast30d,
      avg_likes: avgLikes,
      avg_comments: avgComments,
      top_hashtags: topHashtags,
      raw_profile: user,
      raw_posts: postsRaw,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SC_KEY = Deno.env.get("SCRAPECREATORS_API_KEY");

  if (!SC_KEY) {
    return json({ success: false, error: "SCRAPECREATORS_API_KEY não configurada" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));

  // === Seleção de leads ===
  let leads: { id: string; instagram: string | null }[] = [];

  if (Array.isArray(body.lead_ids) && body.lead_ids.length > 0) {
    const { data } = await supabase
      .from("crm_leads")
      .select("id, instagram")
      .in("id", body.lead_ids)
      .not("instagram", "is", null);
    leads = (data || []) as any[];
  } else if (body.lead_id) {
    const { data } = await supabase
      .from("crm_leads")
      .select("id, instagram")
      .eq("id", body.lead_id)
      .not("instagram", "is", null)
      .maybeSingle();
    if (data) leads = [data as any];
  } else {
    // mode === 'weekly' (default)
    // pega leads com instagram + último snapshot mais antigo que MIN_DAYS_BETWEEN_SNAPSHOTS
    // ou sem nenhum snapshot
    const cutoff = new Date(
      Date.now() - MIN_DAYS_BETWEEN_SNAPSHOTS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: candidates } = await supabase
      .from("crm_leads")
      .select(
        `id, instagram,
         latest_snapshot:instagram_snapshots(scraped_at)`
      )
      .not("instagram", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);

    leads = (candidates || []).filter((l: any) => {
      const last = l.latest_snapshot?.[0]?.scraped_at;
      return !last || last < cutoff;
    }).slice(0, MAX_LEADS_PER_RUN);
  }

  console.log(`[ig-snapshot] iniciando ${leads.length} leads`);

  let inserted = 0;
  const errors: Array<{ lead_id: string; handle: string | null; error: string }> = [];

  for (const lead of leads) {
    if (!lead.instagram) continue;
    try {
      const r = await scrapeOne(lead.instagram, SC_KEY);
      if (!r.ok) {
        errors.push({ lead_id: lead.id, handle: lead.instagram, error: r.error });
        continue;
      }
      const { error: insErr } = await supabase
        .from("instagram_snapshots")
        .insert({ lead_id: lead.id, ...r.snapshot });
      if (insErr) {
        errors.push({ lead_id: lead.id, handle: lead.instagram, error: `insert: ${insErr.message}` });
        continue;
      }

      // Atualiza foto do crm_leads se mudou
      if (r.snapshot.profile_pic_url) {
        await supabase
          .from("crm_leads")
          .update({ instagram_profile_pic_url: r.snapshot.profile_pic_url })
          .eq("id", lead.id);
      }
      inserted++;
      // pequena pausa pra não pressionar a API
      await new Promise((res) => setTimeout(res, 250));
    } catch (e: any) {
      errors.push({ lead_id: lead.id, handle: lead.instagram, error: String(e?.message ?? e) });
    }
  }

  console.log(
    `[ig-snapshot] concluído inserted=${inserted} errors=${errors.length}`
  );

  return json({ success: true, total: leads.length, inserted, errors });
});
