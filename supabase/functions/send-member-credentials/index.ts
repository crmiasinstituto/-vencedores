// Envia credenciais de acesso da Area de Membros SQUAAD via WhatsApp
// Para 2 casos:
//   - novo contratante recém-aprovado
//   - novo preposto cadastrado (manda tanto pro preposto quanto pro contratante)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MEMBERS_LOGIN_URL = "https://squaad.com.br/membros/login";

function buildMemberMessage(member: any, options: { is_preposto: boolean; contratante?: any }): string {
  const firstName = (member.name || "").split(" ")[0];
  if (options.is_preposto && options.contratante) {
    return `Opaa ${firstName}! 🎓

Voce foi indicado por *${options.contratante.name}* como aluno do programa SQUAAD Business Solutions — boraa pra cima!

*Seu acesso ja esta liberado na area de membros:*

🔗 Link: ${MEMBERS_LOGIN_URL}
📧 Email: ${member.email}
🔑 Senha inicial: ${member.phone || "(solicite ao admin)"}

Depois que logar, voce pode trocar pra uma senha propria em "Meu Perfil".

*O que voce tem acesso:*
• Aulas do Metodo SQUAAD organizadas em trilhas
• Lives ao vivo com o Carlos Eduardo e o time
• Comunidade exclusiva
• PDFs e materiais de apoio de cada aula
• Certificados e conquistas

Qualquer duvida e so chamar aqui. Bons estudos!

*SQUAAD Business Solutions*`;
  }

  return `Opaaa ${firstName}! 🎉

*Bem-vindo a SQUAAD Business Solutions!* Seu acesso a area de membros ja esta liberado.

🔗 Link de acesso: ${MEMBERS_LOGIN_URL}
📧 Email: ${member.email}
🔑 Senha inicial: ${member.phone || "(verifique com o admin)"}

Depois de logar voce pode trocar pra uma senha propria em "Meu Perfil".

*No seu painel voce encontra:*
• Todas as aulas organizadas por trilha
• Lives ao vivo agendadas
• Comunidade de alunos SQUAAD
• PDFs e materiais de cada aula
• Suporte direto

${(member.welcome_message || "")}

Qualquer duvida, chama aqui. Bons estudos e vamos pra cima!

*SQUAAD Business Solutions*`;
}

function buildContratanteNotice(contratante: any, preposto: any, relationship: string): string {
  const firstName = (contratante.name || "").split(" ")[0];
  return `Opaaa ${firstName}!

Acabamos de liberar o acesso a area de membros SQUAAD para *${preposto.name}* (${relationship || "preposto indicado por voce"}).

📧 Email dele: ${preposto.email}
🔗 Link: ${MEMBERS_LOGIN_URL}

Ele recebeu as credenciais direto no WhatsApp dele (${preposto.phone}) e ja pode comecar.

Voce pode acompanhar o progresso dele pelo painel (badges, aulas concluidas, ranking) — toda evolucao dele conta pro seu programa.

*SQUAAD Business Solutions*`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { member_id, force = false } = await req.json();
    if (!member_id) throw new Error("member_id required");

    // Atomic dedup lock: try to update credentials_sent_at to NOW() only if it's NULL
    // or older than 5 minutes. If another concurrent call already claimed the slot, skip.
    const fiveMinAgoIso = new Date(Date.now() - 5 * 60_000).toISOString();
    if (!force) {
      const { data: claimed } = await supabase.from("members")
        .update({ credentials_sent_at: new Date().toISOString() })
        .eq("id", member_id)
        .or(`credentials_sent_at.is.null,credentials_sent_at.lt.${fiveMinAgoIso}`)
        .select("id")
        .maybeSingle();
      if (!claimed) {
        return new Response(JSON.stringify({
          ok: true, skipped: "already_sent_recently",
          message: "Credenciais ja enviadas nos ultimos 5 minutos",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: member, error } = await supabase.from("members")
      .select("*").eq("id", member_id).single();
    if (error || !member) throw new Error(`Member not found: ${error?.message}`);
    if (!member.phone || !member.email) throw new Error("Member sem telefone ou email");

    // Pick active WhatsApp instance — uazapi 1-a-1 (NUNCA a Cloud API de blast,
    // que nao envia mensagem 1-a-1 e fazia o envio falhar com success:false).
    const { data: instance } = await supabase.from("whatsapp_instances")
      .select("id, instance_name")
      .eq("status", "connected")
      .eq("provider", "uazapi")
      .or("is_dedicated_blast.is.null,is_dedicated_blast.eq.false")
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    if (!instance) throw new Error("Nenhuma instancia WhatsApp conectada");

    const isPreposto = member.member_role === "preposto" && member.contratante_member_id;
    let contratante: any = null;
    if (isPreposto) {
      const { data } = await supabase.from("members")
        .select("id, name, phone, email").eq("id", member.contratante_member_id).maybeSingle();
      contratante = data;
    }

    const results: any[] = [];

    // 1) Sempre manda credenciais pro proprio membro
    const memberMsg = buildMemberMessage(member, { is_preposto: isPreposto, contratante });
    const r1 = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({
        action: "send_text",
        instance_id: instance.id,
        phone: member.phone,
        message: memberMsg,
        sent_by: "credentials",
      }),
    });
    const r1j = await r1.json();
    results.push({ target: "member", phone: member.phone, success: r1j?.success !== false });

    // 2) Se preposto, notifica o contratante
    if (isPreposto && contratante?.phone) {
      const contratanteMsg = buildContratanteNotice(contratante, member, member.relationship || "");
      const r2 = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({
          action: "send_text",
          instance_id: instance.id,
          phone: contratante.phone,
          message: contratanteMsg,
          sent_by: "credentials",
        }),
      });
      const r2j = await r2.json();
      results.push({ target: "contratante", phone: contratante.phone, success: r2j?.success !== false });
    }

    // No modo !force o credentials_sent_at ja foi setado atomicamente no inicio.
    // No modo force (reenvio manual), registra agora se algum envio deu certo.
    if (force && results.some((r) => r.success)) {
      await supabase.from("members")
        .update({ credentials_sent_at: new Date().toISOString() })
        .eq("id", member_id);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-credentials] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
