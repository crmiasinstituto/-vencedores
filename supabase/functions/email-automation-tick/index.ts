import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function renderJsonToHtml(node: any): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(renderJsonToHtml).join("");
  if (typeof node === "string") return node;

  const type = node.type;
  const text = node.text;
  const content = node.content;
  const attrs = node.attrs || {};

  if (type === "text") {
    let result = (text || "").replace(/[&<>]/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "bold") result = `<strong>${result}</strong>`;
        if (mark.type === "italic") result = `<em>${result}</em>`;
        if (mark.type === "underline") result = `<u>${result}</u>`;
        if (mark.type === "link") result = `<a href="${mark.attrs?.href || '#'}">${result}</a>`;
      }
    }
    return result;
  }

  const inner = renderJsonToHtml(content);
  const align = attrs.textAlign ? ` style="text-align:${attrs.textAlign};"` : "";

  switch (type) {
    case "doc": return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">${inner}</body></html>`;
    case "paragraph": return `<p${align}>${inner}</p>`;
    case "heading": return `<h${attrs.level || 1}${align}>${inner}</h${attrs.level || 1}>`;
    case "bulletList": return `<ul>${inner}</ul>`;
    case "orderedList": return `<ol>${inner}</ol>`;
    case "listItem": return `<li>${inner}</li>`;
    case "horizontalRule": return `<hr/>`;
    case "image": return `<img src="${attrs.src || ''}" alt="${attrs.alt || ''}" style="max-width:100%;"/>`;
    case "spacer": return `<div style="height:${attrs.height || 16}px;"></div>`;
    case "variable": return `{{${attrs.id || attrs.name || ''}}}`;
    default: return inner;
  }
}

interface FlowNode { id: string; type: string; data: any; position: { x: number; y: number }; }
interface FlowEdge { id?: string; source: string; target: string; sourceHandle?: string; }

// Fluxos antigos salvaram campos que não existem em crm_leads (vieram do template do CRM):
// sales_score vira lead_score; sales_stage/status viram a coluna do funil na condição.
const LEAD_FIELD_ALIASES: Record<string, string> = { sales_score: "lead_score", sales_stage: "column_name" };
const UPDATABLE_LEAD_FIELDS = new Set(["lead_score", "source", "priority", "evento"]);

function fillLeadVars(text: string, lead: { name?: string | null } | null): string {
  const nome = lead?.name || "";
  return text
    .replace(/\{\{\s*nome\s*\}\}/g, nome)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, nome.split(" ")[0]);
}

function getNextNode(flow: any, fromNodeId: string, branch?: "yes" | "no"): FlowNode | null {
  const edges: FlowEdge[] = flow.edges || [];
  const nodes: FlowNode[] = flow.nodes || [];
  const candidates = edges.filter((e) => e.source === fromNodeId);
  let match: FlowEdge | undefined;
  if (branch) match = candidates.find((e) => e.sourceHandle === branch);
  if (!match) match = candidates[0];
  if (!match) return null;
  return nodes.find((n) => n.id === match!.target) || null;
}

function calculateWaitDate(duration: number, unit: string): Date {
  const date = new Date();
  if (unit === "minutos") date.setMinutes(date.getMinutes() + duration);
  else if (unit === "horas") date.setHours(date.getHours() + duration);
  else date.setDate(date.getDate() + duration);
  return date;
}

async function evaluateBranch(supabase: any, leadId: string, condition: any): Promise<boolean> {
  const field = LEAD_FIELD_ALIASES[condition.condition_field] ?? condition.condition_field;
  const op = condition.condition_op || "=";
  const value = condition.condition_value;
  if (!field) return true;

  let currentValue: any = null;
  if (field === "email_opened" || field === "email_clicked") {
    const { count } = await supabase
      .from("email_sends")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .not(field === "email_opened" ? "opened_at" : "clicked_at", "is", null);
    // Valor vazio, "sim" ou "true" = "abriu/clicou?"; "não"/"false" = o contrário
    const esperado = !/^(n[aã]o|false|0|no)$/i.test(String(value ?? "").trim());
    const bate = ((count || 0) > 0) === esperado;
    return op === "!=" ? !bate : bate;
  } else if (field === "has_tag") {
    const { data: lead } = await supabase.from("crm_leads").select("tags").eq("id", leadId).single();
    currentValue = (lead?.tags || []).includes(value);
    return Boolean(currentValue);
  } else if (field === "column_name") {
    // Compara pelo nome da coluna (ex: "Qualificado"), sem diferenciar maiúsculas
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("column:crm_columns(name)")
      .eq("id", leadId)
      .single();
    const atual = String(lead?.column?.name || "").trim().toLowerCase();
    const alvo = String(value || "").trim().toLowerCase();
    if (op === "!=") return atual !== alvo;
    return atual === alvo;
  } else {
    const { data: lead } = await supabase.from("crm_leads").select(field).eq("id", leadId).single();
    currentValue = lead?.[field];
  }

  switch (op) {
    case "=":  return String(currentValue) === String(value);
    case "!=": return String(currentValue) !== String(value);
    case ">":  return Number(currentValue) > Number(value);
    case "<":  return Number(currentValue) < Number(value);
    default:   return false;
  }
}

async function executeNode(supabase: any, run: any, node: FlowNode) {
  const leadId = run.lead_id;

  switch (node.type) {
    case "trigger": {
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "wait": {
      const duration = node.data.duration || 1;
      const unit = node.data.unit || "dias";
      const next = getNextNode(run.flow, node.id);
      if (!next) return { done: true, status: "completed" };
      return { done: false, nextNodeId: next.id, nextAt: calculateWaitDate(duration, unit) };
    }

    case "waitUntilDate": {
      const eventDate = node.data.event_date;
      const offset = node.data.offset || 0;
      const offsetUnit = node.data.offset_unit || "dias";
      const next = getNextNode(run.flow, node.id);
      if (!next) return { done: true, status: "completed" };
      if (!eventDate) return { done: false, nextNodeId: next.id, nextAt: new Date() };
      const evMs = new Date(`${eventDate}T09:00:00-03:00`).getTime();
      const offsetMs = (offsetUnit === "horas" ? 3600000 : 86400000) * offset;
      const fireAt = new Date(evMs - offsetMs);
      if (fireAt.getTime() <= Date.now()) return { done: false, nextNodeId: next.id, nextAt: new Date() };
      return { done: false, nextNodeId: next.id, nextAt: fireAt };
    }

    case "sendEmail": {
      const templateId = node.data.template_id;
      if (!templateId) {
        const next = getNextNode(run.flow, node.id);
        return { done: false, nextNodeId: next?.id, nextAt: new Date() };
      }
      const { data: template } = await supabase
        .from("email_templates")
        .select("id, name, subject, html_content, content_json")
        .eq("id", templateId)
        .single();
      if (!template) {
        const next = getNextNode(run.flow, node.id);
        return { done: false, nextNodeId: next?.id, nextAt: new Date() };
      }
      const { data: lead } = await supabase.from("crm_leads").select("id, name, email").eq("id", leadId).single();
      if (!lead?.email) {
        const next = getNextNode(run.flow, node.id);
        return { done: false, nextNodeId: next?.id, nextAt: new Date() };
      }

      // Se este no ja mandou e-mail pra este run, nao manda de novo.
      //
      // Cenario: o tick morre depois do fetch do send-email-campaign e antes de
      // gravar o proximo no. Na retentativa o no roda inteiro outra vez e cria
      // uma campanha temporaria NOVA — o indice unico nao ve duplicata porque o
      // campaign_id e outro, e o lead recebe o mesmo e-mail duas vezes.
      const { data: jaMandou } = await supabase
        .from("email_campaigns")
        .select("id")
        .eq("source_type", "automation")
        .contains("audience_filters", { automation_run_id: run.id, node_id: node.id, run_started_at: run.started_at })
        .limit(1);
      if (jaMandou && jaMandou.length > 0) {
        console.log(`[run ${run.id}] no ${node.id} ja enviou e-mail antes, pulando reenvio`);
        const next = getNextNode(run.flow, node.id);
        return { done: false, nextNodeId: next?.id, nextAt: new Date() };
      }

      const html = template.html_content || renderJsonToHtml(template.content_json);
      const { data: tempCampaign, error: campErr } = await supabase
        .from("email_campaigns")
        .insert({
          name: `[Auto] ${template.name}`,
          subject: node.data.subject || template.subject || "(sem assunto)",
          template_id: templateId,
          html_content: html,
          status: "draft",
          source_type: "automation",
          automation_id: run.automation_id,
          // node_id entra aqui pra permitir o guard de reenvio acima.
          // run_started_at separa as passagens: quem se reinscreve recomeça o run (novo started_at)
          // e recebe o e-mail de novo; retentativa dentro da mesma passagem continua barrada.
          audience_filters: { lead_ids: [leadId], automation_run_id: run.id, node_id: node.id, run_started_at: run.started_at },
        })
        .select("id")
        .single();

      if (campErr || !tempCampaign) {
        console.error(`[run ${run.id}] insert email_campaigns falhou:`, campErr);
        const next = getNextNode(run.flow, node.id);
        return { done: false, nextNodeId: next?.id, nextAt: new Date() };
      }

      // O send-email-campaign só envia pra quem está na fila (email_campaign_leads); sem
      // popular a fila ele acha "fila vazia", conclui a campanha e nenhum e-mail sai.
      // A RPC já tira descadastrados e quem pediu pra não receber e-mail.
      const { data: naFila, error: filaErr } = await supabase.rpc("populate_email_campaign_leads", {
        p_campaign_id: tempCampaign.id,
      });
      if (filaErr || !naFila) {
        console.warn(`[run ${run.id}] lead ${leadId} fora da fila do e-mail (descadastrado ou opt-out)`, filaErr);
        const next = getNextNode(run.flow, node.id);
        return { done: false, nextNodeId: next?.id, nextAt: new Date() };
      }

      const fnRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          campaign_id: tempCampaign.id,
          html,
          audience_override: { lead_ids: [leadId] },
        }),
      });
      if (!fnRes.ok) console.error(`[run ${run.id}] send-email-campaign failed:`, await fnRes.text());

      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "updateField": {
      const field = LEAD_FIELD_ALIASES[node.data.field] ?? node.data.field;
      const value = node.data.value;
      if (field && UPDATABLE_LEAD_FIELDS.has(field) && value !== undefined && value !== "") {
        const { error } = await supabase
          .from("crm_leads")
          .update({ [field]: field === "lead_score" ? Number(value) : value })
          .eq("id", leadId);
        if (error) console.error(`[run ${run.id}] updateField ${field} falhou:`, error);
      } else if (field) {
        console.warn(`[run ${run.id}] updateField: campo "${node.data.field}" não existe em crm_leads, pulando`);
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "addTag": {
      const tag = node.data.tag;
      if (tag) {
        const { data: lead } = await supabase.from("crm_leads").select("tags").eq("id", leadId).single();
        const current = (lead?.tags || []) as string[];
        if (!current.includes(tag)) {
          await supabase.from("crm_leads").update({ tags: [...current, tag] }).eq("id", leadId);
        }
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "createTask": {
      const { data: lead } = await supabase.from("crm_leads").select("board_id, name").eq("id", leadId).single();
      const title = fillLeadVars(node.data.title || "Tarefa automática", lead);
      // A tela de tarefas (Operações) lê da tabela tasks; o crm_activities fica pro histórico do lead.
      const { error: taskErr } = await supabase.from("tasks").insert({
        title,
        description: `Criada pela automação${node.data.team ? ` · time ${node.data.team}` : ""}`,
        type: "task",
        status: "pending",
        lead_id: leadId,
        due_date: new Date(Date.now() + Number(node.data.due_in_hours || 24) * 3600_000).toISOString(),
      });
      if (taskErr) console.error(`[run ${run.id}] createTask falhou:`, taskErr);
      await supabase.from("crm_activities").insert({
        lead_id: leadId,
        board_id: lead?.board_id || null,
        activity_type: "automation_task",
        description: title,
        metadata: { automation_run_id: run.id },
      });
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "branch": {
      const result = await evaluateBranch(supabase, leadId, node.data);
      const handle = result ? "yes" : "no";
      const next = getNextNode(run.flow, node.id, handle);
      if (!next) return { done: true, status: "completed" };
      return { done: false, nextNodeId: next.id, nextAt: new Date() };
    }

    case "sendWhatsapp": {
      // BLOQUEADO em automação: blast WhatsApp só via wa_campaigns com instância dedicada (anti-ban).
      // Mensagem unitária de automação OK desde que use instância ativa atendimento.
      const message = node.data.message || "";
      if (message) {
        const { data: lead } = await supabase
          .from("crm_leads")
          .select("whatsapp, name, whatsapp_opt_in")
          .eq("id", leadId)
          .single();
        if (lead?.whatsapp && lead.whatsapp_opt_in) {
          // Onboarding URL única do lead (Masterclass IA wizard)
          let onboardingUrl = "";
          try {
            const { data: tk } = await supabase.rpc("onboarding_ensure_token", { p_lead_id: leadId });
            if (tk) {
              const baseUrl = Deno.env.get("APP_URL") || "https://squaad.com.br";
              onboardingUrl = `${baseUrl}/m/${tk}`;
            }
          } catch (e) { /* tolera, segue sem o link */ }

          const text = message
            .replace(/\{\{nome\}\}/g, lead.name || "")
            .replace(/\{\{primeiro_nome\}\}/g, (lead.name || "").split(" ")[0])
            .replace(/\{\{onboarding_url\}\}/g, onboardingUrl)
            .replace(/\{\{link_plataforma\}\}/g, onboardingUrl)
            .replace(/\{\{acessar_plataforma\}\}/g, onboardingUrl);
          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("api_url, api_key, provider")
            .eq("status", "connected")
            .eq("provider", "uazapi")
            .limit(1)
            .maybeSingle();
          if (instance?.api_url && instance?.api_key) {
            try {
              await fetch(`${instance.api_url}/send/text`, {
                method: "POST",
                headers: { "Content-Type": "application/json", token: instance.api_key },
                body: JSON.stringify({ number: lead.whatsapp, text }),
              });
            } catch (e) {
              console.error("Erro WhatsApp automação:", e);
            }
          }
        } else {
          console.log(`[automation] skip WhatsApp para lead ${leadId}: sem opt-in ou sem whatsapp`);
        }
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "inviteGroup": {
      const groupLink = node.data.group_link || "";
      const message = node.data.message || "";
      if (groupLink) {
        const { data: lead } = await supabase
          .from("crm_leads")
          .select("whatsapp, name, whatsapp_opt_in")
          .eq("id", leadId)
          .single();
        if (lead?.whatsapp && lead.whatsapp_opt_in) {
          const text = (message + "\n\n" + groupLink)
            .replace(/\{\{nome\}\}/g, lead.name || "")
            .replace(/\{\{primeiro_nome\}\}/g, (lead.name || "").split(" ")[0]);
          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("api_url, api_key, provider")
            .eq("status", "connected")
            .eq("provider", "uazapi")
            .limit(1)
            .maybeSingle();
          if (instance?.api_url && instance?.api_key) {
            try {
              await fetch(`${instance.api_url}/send/text`, {
                method: "POST",
                headers: { "Content-Type": "application/json", token: instance.api_key },
                body: JSON.stringify({ number: lead.whatsapp, text }),
              });
            } catch (e) {
              console.error("Erro envio convite grupo:", e);
            }
          }
        }
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "sendWhatsappCloud": {
      const templateName = node.data.template_name || "";
      const language = node.data.language || "pt_BR";
      const rawParams: string[] = node.data.template_params || [];
      if (templateName) {
        // crm_leads não tem coluna "empresa": pedir ela fazia a consulta falhar, o lead vinha
        // vazio e o passo pulava sem enviar e sem avisar. {{empresa}} fica vazio.
        const { data: lead, error: leadErr } = await supabase
          .from("crm_leads")
          .select("whatsapp, name, whatsapp_opt_in")
          .eq("id", leadId)
          .single();
        const motivoPulo = leadErr ? `erro ao ler o lead: ${leadErr.message}`
          : !lead?.whatsapp ? "lead sem WhatsApp"
          : !lead.whatsapp_opt_in ? "lead sem permissão de WhatsApp (opt-in)" : null;
        if (motivoPulo) {
          console.warn(`[run ${run.id}] WhatsApp pulado: ${motivoPulo}`);
          await supabase.from("crm_activities").insert({
            lead_id: leadId,
            activity_type: "automation_error",
            description: `Automação: WhatsApp "${templateName}" não foi enviado — ${motivoPulo}`,
            metadata: { automation_id: run.automation_id, run_id: run.id, node_id: node.id },
          });
        }
        if (lead?.whatsapp && lead.whatsapp_opt_in) {
          const resolvedParams = rawParams.map((p: string) =>
            p
              .replace(/\{\{nome\}\}/g, lead.name || "")
              .replace(/\{\{primeiro_nome\}\}/g, (lead.name || "").split(" ")[0])
              .replace(/\{\{empresa\}\}/g, ""),
          );
          // Com mais de um número na API oficial, o modelo só existe na conta (WABA) onde foi
          // aprovado. Sem instance_id o wa-send-cloud pega um número qualquer e a Meta recusa
          // ("template does not exist"). Usa o número escolhido no passo ou o dono do modelo.
          let instanceId: string | undefined = node.data.instance_id || undefined;
          if (!instanceId) {
            const { data: tpl } = await supabase
              .from("whatsapp_cloud_templates")
              .select("meta_waba_id")
              .eq("name", templateName)
              .eq("language", language)
              .maybeSingle();
            if (tpl?.meta_waba_id) {
              const { data: inst } = await supabase
                .from("whatsapp_instances")
                .select("id")
                .eq("provider", "cloud_api")
                .eq("business_account_id", tpl.meta_waba_id)
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();
              instanceId = inst?.id;
            }
          }
          try {
            const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-send-cloud`;
            const waRes = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                phone: lead.whatsapp,
                action: "send_template",
                template_name: templateName,
                template_language: language,
                template_params: resolvedParams.length > 0 ? resolvedParams : undefined,
                lead_id: leadId,
                sent_by: "automation",
                instance_id: instanceId,
              }),
            });
            const waBody = await waRes.text();
            if (waRes.ok) {
              // Marca a mensagem com a automação: é o que alimenta os números da lista e o relatório.
              let messageId: string | undefined;
              try { messageId = JSON.parse(waBody)?.message_id; } catch { /* ignora */ }
              if (messageId) {
                const { data: msg } = await supabase
                  .from("whatsapp_messages")
                  .select("id, metadata")
                  .eq("whatsapp_message_id", messageId)
                  .maybeSingle();
                if (msg) {
                  await supabase.from("whatsapp_messages").update({
                    metadata: { ...(msg.metadata || {}), automation_id: run.automation_id, automation_run_id: run.id, node_id: node.id },
                  }).eq("id", msg.id);
                }
              }
            } else {
              console.error(`[run ${run.id}] WhatsApp Cloud falhou:`, waBody);
              await supabase.from("crm_activities").insert({
                lead_id: leadId,
                activity_type: "automation_error",
                description: `Automação: WhatsApp "${templateName}" não foi enviado — ${waBody.slice(0, 300)}`,
                metadata: { automation_id: run.automation_id, run_id: run.id, node_id: node.id },
              });
            }
          } catch (e) {
            console.error("Erro WhatsApp Cloud API automacao:", e);
          }
        }
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "moveLead": {
      const updates: Record<string, any> = {};
      if (node.data.column_id) updates.column_id = node.data.column_id;
      if (node.data.board_id) updates.board_id = node.data.board_id;
      if (Object.keys(updates).length > 0) {
        await supabase.from("crm_leads").update(updates).eq("id", leadId);
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "assignTo": {
      // Atribui responsável (assigned_to) ao lead
      const target = node.data.assigned_to || node.data.value;
      if (target) {
        // "Sem responsável" no editor vem como __unassigned__: limpa em vez de gravar o marcador
        const assigned = target === "__unassigned__" ? null : target;
        await supabase.from("crm_leads").update({ assigned_to: assigned }).eq("id", leadId);
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "updateScore": {
      // Soma/subtrai do lead_score (delta pode ser negativo)
      const delta = Number(node.data.delta || 0);
      if (delta !== 0) {
        const { data: lead } = await supabase.from("crm_leads").select("lead_score").eq("id", leadId).single();
        const curr = Number(lead?.lead_score || 0);
        const next = Math.max(0, Math.min(100, curr + delta));
        await supabase.from("crm_leads").update({ lead_score: next }).eq("id", leadId);
      }
      const n = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: n?.id, nextAt: new Date() };
    }

    case "notifyTeam": {
      // Notificação interna pra um membro do time
      const targetMember = node.data.member_id && node.data.member_id !== "__unassigned__" ? node.data.member_id : null;
      const { data: lead } = await supabase.from("crm_leads").select("name").eq("id", leadId).single();
      const title = fillLeadVars(node.data.title || "Automação", lead);
      const message = fillLeadVars(node.data.message || "", lead);
      try {
        // O sino do admin (NotificationBell) lê admin_notifications
        const { error: notifErr } = await supabase.from("admin_notifications").insert({
          type: "automation",
          title,
          description: message || null,
          link: `/admin/crm?lead=${leadId}`,
          severity: "info",
          lead_id: leadId,
          metadata: { automation_id: run.automation_id, automation_run_id: run.id, target_member: targetMember },
        });
        if (notifErr) console.error(`[run ${run.id}] notifyTeam falhou:`, notifErr);
        await supabase.from("crm_activities").insert({
          lead_id: leadId,
          activity_type: "automation_notify",
          description: `${title}: ${message}`.slice(0, 500),
          metadata: { automation_run_id: run.id, target_member: targetMember },
        });
      } catch (e) { console.error("notifyTeam falhou:", e); }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "webhook": {
      // POST pra URL externa com payload do lead
      const url = node.data.url;
      if (url) {
        try {
          const { data: lead } = await supabase.from("crm_leads").select("*").eq("id", leadId).single();
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "automation_step",
              automation_id: run.automation_id,
              run_id: run.id,
              lead,
              extra: node.data.payload || {},
            }),
          });
        } catch (e) { console.error("webhook falhou:", e); }
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }

    case "waitBusinessHours": {
      // Se for fora do horário comercial (seg-sex 9h-18h Brasil), segura até o próximo slot
      const now = new Date();
      const brOffset = -3 * 60; // UTC-3 (sem DST)
      const local = new Date(now.getTime() + (brOffset - now.getTimezoneOffset()) * 60_000);
      const day = local.getUTCDay(); // 0=dom, 6=sáb (em UTC-3 representado)
      const hour = local.getUTCHours();
      const isBusinessHour = day >= 1 && day <= 5 && hour >= 9 && hour < 18;
      let nextAt = new Date();
      if (!isBusinessHour) {
        // Calcula próximo dia útil 9h Brasil em UTC
        const target = new Date(local);
        if (day === 0) target.setUTCDate(target.getUTCDate() + 1); // domingo → segunda
        else if (day === 6) target.setUTCDate(target.getUTCDate() + 2); // sábado → segunda
        else if (hour >= 18) target.setUTCDate(target.getUTCDate() + 1); // depois das 18, próximo dia
        // 9h Brasil = 12h UTC
        target.setUTCHours(12, 0, 0, 0);
        // Se cair em fim de semana após shift, ajusta de novo
        const d2 = target.getUTCDay();
        if (d2 === 0) target.setUTCDate(target.getUTCDate() + 1);
        else if (d2 === 6) target.setUTCDate(target.getUTCDate() + 2);
        nextAt = target;
      }
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt };
    }

    case "end": {
      return { done: true, status: "completed" };
    }

    default: {
      console.warn(`Node type desconhecido: ${node.type}`);
      const next = getNextNode(run.flow, node.id);
      return { done: false, nextNodeId: next?.id, nextAt: new Date() };
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: runs } = await supabase
      .from("email_automation_runs")
      .select("id, automation_id, lead_id, current_node_id, scheduled_next_at, status, context, started_at, automation:email_automations(flow_json, is_active)")
      .eq("status", "active")
      .lte("scheduled_next_at", new Date().toISOString())
      .limit(50);

    if (!runs || runs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let completed = 0;

    for (const run of runs) {
      const flow = (run as any).automation?.flow_json;
      const isActive = (run as any).automation?.is_active;
      if (!flow || !isActive) {
        await supabase
          .from("email_automation_runs")
          .update({ status: "cancelled", completed_at: new Date().toISOString() })
          .eq("id", run.id);
        continue;
      }
      // RESERVA ATOMICA DO RUN.
      //
      // O SELECT acima nao travava nada: dois ticks sobrepostos (cron a cada
      // minuto + um tick lento, ou um disparo manual junto) pegavam o MESMO run
      // e executavam o mesmo no de e-mail — o lead recebia duas vezes. O indice
      // unico de email_sends nao pega isso porque cada execucao cria a sua
      // propria campanha temporaria.
      //
      // Aqui empurramos `scheduled_next_at` pra frente condicionando em
      // (status, no atual, vencimento). Quem chegar depois nao casa mais com o
      // `lte(agora)` e desiste. O UPDATE do Postgres reavalia o WHERE depois de
      // pegar o lock da linha, entao so um dos dois ganha.
      const agoraIso = new Date().toISOString();
      const reservaAte = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data: reservado } = await supabase
        .from("email_automation_runs")
        .update({ scheduled_next_at: reservaAte })
        .eq("id", run.id)
        .eq("status", "active")
        .eq("current_node_id", run.current_node_id)
        .lte("scheduled_next_at", agoraIso)
        .select("id");
      if (!reservado || reservado.length === 0) {
        console.log(`[run ${run.id}] outro tick ja pegou este run, pulando`);
        continue;
      }

      const nodes: FlowNode[] = flow.nodes || [];
      const node = nodes.find((n) => n.id === run.current_node_id);
      if (!node) {
        await supabase
          .from("email_automation_runs")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", run.id);
        continue;
      }
      try {
        const result = await executeNode(supabase, { ...run, flow }, node);
        if (result.done) {
          await supabase
            .from("email_automation_runs")
            .update({ status: result.status || "completed", completed_at: new Date().toISOString() })
            .eq("id", run.id);
          completed++;
        } else if (result.nextNodeId) {
          await supabase
            .from("email_automation_runs")
            .update({
              current_node_id: result.nextNodeId,
              scheduled_next_at: (result.nextAt || new Date()).toISOString(),
            })
            .eq("id", run.id);
        } else {
          await supabase
            .from("email_automation_runs")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", run.id);
          completed++;
        }
        processed++;
      } catch (err: any) {
        console.error(`Erro run ${run.id}:`, err);
        await supabase
          .from("email_automation_runs")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", run.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, completed, total: runs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
