import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCRAP_BASE = "https://api.scrapecreators.com";

interface ScrapPost {
  caption?: string;
  like_count?: number;
  comment_count?: number;
  taken_at_timestamp?: number;
  display_url?: string;
  media_type?: string;
  permalink?: string;
}

interface ScrapProfile {
  username?: string;
  full_name?: string;
  biography?: string;
  follower_count?: number;
  following_count?: number;
  media_count?: number;
  category?: string;
  is_business_account?: boolean;
  is_verified?: boolean;
  profile_pic_url_hd?: string;
  profile_pic_url?: string;
  external_url?: string;
  business_email?: string;
  business_phone_number?: string;
}

async function fetchScrap(path: string, params: Record<string, string>, apiKey: string) {
  const url = new URL(SCRAP_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ScrapCreator ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function downloadProfilePic(
  url: string,
  username: string,
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const path = `masterclass/${username}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("instagram-profiles")
      .upload(path, blob, { contentType: blob.type, upsert: true });

    if (error) {
      console.warn("storage upload failed", error.message);
      return null;
    }

    const { data } = supabase.storage.from("instagram-profiles").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn("profile pic download failed", (e as Error).message);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("SCRAPCREATOR_API_KEY") ?? Deno.env.get("SCRAPECREATORS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "SCRAPCREATOR_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const { username: rawUsername } = await req.json();
    if (!rawUsername || typeof rawUsername !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "username required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const username = rawUsername.replace("@", "").trim().toLowerCase();
    console.log("🔍 Scraping Instagram via ScrapCreator:", username);

    const profileRaw = await fetchScrap("/v1/instagram/profile", { handle: username }, apiKey);

    const data = profileRaw?.data?.user ?? profileRaw?.user ?? profileRaw?.data ?? profileRaw ?? {};
    const profile: ScrapProfile = {
      username: data.username ?? username,
      full_name: data.full_name ?? data.fullName,
      biography: data.biography ?? data.bio,
      follower_count: data.edge_followed_by?.count ?? data.follower_count ?? data.followers,
      following_count: data.edge_follow?.count ?? data.following_count ?? data.following,
      media_count: data.edge_owner_to_timeline_media?.count ?? data.media_count ?? data.posts_count,
      category: data.category_name ?? data.category,
      is_business_account: data.is_business_account,
      is_verified: data.is_verified,
      profile_pic_url_hd: data.profile_pic_url_hd ?? data.profile_pic_url,
      profile_pic_url: data.profile_pic_url,
      external_url: data.external_url,
      business_email: data.business_email,
      business_phone_number: data.business_phone_number,
    };

    let posts: ScrapPost[] = [];
    try {
      const postsRaw = await fetchScrap("/v1/instagram/posts", { handle: username }, apiKey);
      const list = postsRaw?.data?.items ?? postsRaw?.items ?? postsRaw?.posts ?? [];
      posts = list.slice(0, 6).map((p: Record<string, unknown>) => ({
        caption:
          (p.caption as { text?: string } | string | undefined) &&
          (typeof p.caption === "string" ? p.caption : (p.caption as { text?: string }).text),
        like_count: p.like_count as number,
        comment_count: p.comment_count as number,
        taken_at_timestamp: p.taken_at_timestamp as number,
        display_url: p.display_url as string,
        media_type: p.media_type as string,
        permalink: p.permalink as string,
      }));
    } catch (e) {
      console.warn("posts fetch failed", (e as Error).message);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let storedProfilePic: string | null = null;
    const picSource = profile.profile_pic_url_hd ?? profile.profile_pic_url;
    if (picSource) {
      storedProfilePic = await downloadProfilePic(picSource, username, supabase);
    }

    const result = {
      success: true,
      username,
      profile,
      posts,
      profilePicPath: storedProfilePic ?? picSource ?? null,
      summary: {
        followers: profile.follower_count ?? 0,
        following: profile.following_count ?? 0,
        posts_count: profile.media_count ?? 0,
        bio: profile.biography ?? "",
        category: profile.category ?? null,
        is_business: !!profile.is_business_account,
        is_verified: !!profile.is_verified,
        recent_captions: posts
          .map((p) => p.caption)
          .filter(Boolean)
          .slice(0, 3),
      },
    };

    console.log("✅ Scrap complete:", {
      followers: result.summary.followers,
      posts: posts.length,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ masterclass-instagram-scrap error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
