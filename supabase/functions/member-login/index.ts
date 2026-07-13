// ============================================================
// member-login (verify_jwt: false)
//
// Substitui o login direto via `from('members').select('*').eq('email', ...)`
// que vazava password_hash e session_token de todos os membros via anon.
//
// Body: { email, credential }
//   - credential = senha OU telefone (legacy "phone como fallback").
//
// Fluxo:
//   1) Lookup member por email (service_role bypassa RLS).
//   2) Match: phone normalizado == credential, OU verifyPassword(pbkdf2).
//   3) Se member.status != 'active': 403.
//   4) Gera session_token, salva, insere member_session, marca first_login.
//   5) Retorna { session_token, member: { id, name, email, avatar_url } }.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── verifyPassword (PBKDF2-SHA256, mesmo formato do src/lib/memberCrypto.ts) ─
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as any, iterations },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith("pbkdf2$")) return false;
  const [, iterStr, saltB64, hashB64] = stored.split("$");
  const iterations = parseInt(iterStr, 10) || 100_000;
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const got = await derive(password, salt, iterations);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
  return diff === 0;
}

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { email, credential } = await req.json().catch(() => ({} as any));
    if (!email || !credential || typeof email !== "string" || typeof credential !== "string") {
      return json({ error: "email e credential são obrigatórios" }, 400);
    }
    const normEmail = email.trim().toLowerCase();
    if (normEmail.length < 4) return json({ error: "Email inválido" }, 400);
    const cred = credential.trim();
    if (cred.length < 6) return json({ error: "Credencial muito curta" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: member, error: lookupErr } = await supabase
      .from("members")
      .select("id, name, email, phone, status, avatar_url, password_hash, xp")
      .eq("email", normEmail)
      .maybeSingle();

    if (lookupErr) {
      console.error("[member-login] lookup:", lookupErr);
      return json({ error: "Erro no servidor" }, 500);
    }
    if (!member) {
      // Mensagem GENÉRICA para não enumerar usuários cadastrados.
      return json({ error: "Acesso não encontrado" }, 401);
    }

    // Match: (a) telefone igual ao normalizado, OU (b) senha PBKDF2 confere.
    const normCred = normalizePhone(cred);
    const phoneMatches = normCred && member.phone && normCred === member.phone;
    let passwordMatches = false;
    if (!phoneMatches && member.password_hash) {
      try {
        passwordMatches = await verifyPassword(cred, member.password_hash);
      } catch {
        passwordMatches = false;
      }
    }
    if (!phoneMatches && !passwordMatches) {
      return json({ error: "Acesso não encontrado" }, 401);
    }

    if (member.status !== "active") {
      const reason = member.status === "blocked"
        ? "Acesso bloqueado por pendência financeira"
        : "Aguardando aprovação";
      return json({ error: reason, status: member.status }, 403);
    }

    const sessionToken = generateToken();
    const now = new Date().toISOString();
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabase.from("members").update({
      session_token: sessionToken,
      session_device: userAgent,
      session_started_at: now,
      last_active_at: now,
      updated_at: now,
    }).eq("id", member.id);

    await supabase.from("member_sessions").insert({
      member_id: member.id,
      device_info: userAgent,
      started_at: now,
    });

    // First-login milestone (idempotente)
    const { data: existingMs } = await supabase
      .from("member_milestones")
      .select("id")
      .eq("member_id", member.id)
      .eq("milestone_type", "first_login")
      .maybeSingle();

    if (!existingMs) {
      await supabase.from("member_milestones").insert({
        member_id: member.id,
        milestone_type: "first_login",
        milestone_name: "Primeiro Login",
        description: "Fez o primeiro login na plataforma",
        xp_earned: 50,
      });
      await supabase
        .from("members")
        .update({ xp: (member.xp || 0) + 50 })
        .eq("id", member.id);
    }

    return json({
      session_token: sessionToken,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        avatar_url: member.avatar_url,
      },
    });
  } catch (e) {
    console.error("[member-login] fatal:", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
