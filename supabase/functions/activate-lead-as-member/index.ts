// Ativa um lead fechado como aluno: cria member, contrato, payment,
// move post_sale_stage para 'active' e dispara envio de credenciais via WhatsApp.
// Idempotente — se o lead ja tem member ativo, retorna ok sem duplicar.
//
// Financeiro: quando payment_method e cartao/pix/boleto, gera cobranca no Asaas
// (invoiceUrl deixa o cliente escolher cartao/pix/boleto, parcelando no cartao no checkout)
// e manda o link no WhatsApp. Metodos 'other'/'bank_transfer' = ja recebido fora, marca pago.
// 'vip' = parceria, nao gera nada. Asaas exige CPF/CNPJ no cadastro.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Formas de pagamento que geram link de cobranca externo (Asaas)
const LINK_METHODS = ["credit_card", "pix", "boleto"];

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const {
      lead_id,
      program = "metodo-squaad",
      payment_method = "credit_card",
      num_installments,
      entry_value,
      total_value: overrideTotal,
      cpf: bodyCpf,
      send_credentials = true,
      // Preposto opcional: { name, phone, email?, job_title?, relationship? }.
      // Quando presente, o comprador (lead) vira o contratante (dono do contrato) e
      // QUEM recebe o login + entra no grupo e o preposto, nao o lead.
      preposto = null,
      force = false,
    } = body;
    if (!lead_id) throw new Error("lead_id required");

    // Load lead
    const { data: lead, error: leadErr } = await supabase.from("crm_leads")
      .select("id, name, email, whatsapp, cpf, potential_value, deal_value, post_sale_stage")
      .eq("id", lead_id).single();
    if (leadErr || !lead) throw new Error(`Lead nao encontrado: ${leadErr?.message}`);

    // CPF: prioriza o que veio no body (digitado na ativacao), senao usa o do lead
    const providedCpf = bodyCpf ? String(bodyCpf).replace(/\D/g, "") : null;
    const validCpf = providedCpf && (providedCpf.length === 11 || providedCpf.length === 14)
      ? providedCpf : null;
    const existingLeadCpf = lead.cpf ? String(lead.cpf).replace(/\D/g, "") : null;
    const effectiveCpf = validCpf || existingLeadCpf;

    // Se veio CPF novo e o lead nao tinha, persiste no lead
    if (validCpf && !existingLeadCpf) {
      await supabase.from("crm_leads").update({ cpf: validCpf }).eq("id", lead_id);
    }

    // Resolve quem sera o MEMBRO/ACESSO: se vier preposto, o membro e o preposto;
    // senao, e o proprio lead. O comprador (lead) sempre fica como dono da venda
    // (lead + contrato), mas quando ha preposto ele NAO vira membro da area de membros:
    // so o preposto entra la e no grupo. Ou seja, SO UM membro por ativacao.
    const normPhone = normalizePhone(lead.whatsapp || "");
    if (!normPhone) throw new Error("Lead sem WhatsApp — nao posso criar member");

    const prepostoPhone = preposto?.phone ? normalizePhone(String(preposto.phone)) : "";
    const usePreposto = !!(preposto && prepostoPhone);

    const memberName = usePreposto
      ? ((preposto.name && String(preposto.name).trim()) || "Preposto")
      : (lead.name || "Aluno SQUAAD");
    const memberPhone = usePreposto ? prepostoPhone : normPhone;
    const memberEmail = usePreposto
      ? ((preposto.email && String(preposto.email).trim())
          ? String(preposto.email).trim().toLowerCase()
          : `55${prepostoPhone}@squaad.com`)
      : ((lead.email && lead.email.trim())
          ? lead.email.trim().toLowerCase()
          : `55${normPhone}@squaad.com`);
    // So quando e preposto: registra que ele e funcionario/indicado do comprador.
    const memberExtra: Record<string, any> = usePreposto
      ? { relationship: preposto.relationship || "funcionario", job_title: preposto.job_title || null }
      : {};
    const welcomeMsg = usePreposto
      ? `Acesso liberado${lead.name ? ` (indicado por ${(lead.name || "").split(" ")[0]})` : ""}.`
      : `Bem-vindo ${(lead.name || "").split(" ")[0]}! Seu acesso foi liberado apos o fechamento.`;

    // 1) Member — upsert por email (do preposto OU do lead). So UM membro por ativacao.
    const totalValue = Number(overrideTotal ?? lead.deal_value ?? lead.potential_value ?? 0);
    let memberId: string | null = null;
    let memberAlreadyActive = false;

    const { data: existing } = await supabase.from("members")
      .select("id, name, status, credentials_sent_at").eq("email", memberEmail).maybeSingle();

    if (existing) {
      memberId = existing.id;
      memberAlreadyActive = existing.status === "active";
      if (!force && memberAlreadyActive) {
        // Just ensure lead linkage is correct
        await supabase.from("crm_leads").update({
          post_sale_stage: "active",
          updated_at: new Date().toISOString(),
        }).eq("id", lead_id);
        return new Response(JSON.stringify({
          ok: true, skipped: "member_already_active", member_id: memberId,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Refresh status if it was blocked/pending/expired
      await supabase.from("members").update({
        status: "active",
        phone: memberPhone,
        name: memberName || existing.name,
        program,
        crm_lead_id: lead_id,
        member_role: "contratante",
        approved_at: new Date().toISOString(),
        approved_by: "admin-activate-lead",
        updated_at: new Date().toISOString(),
        ...memberExtra,
        ...(effectiveCpf ? { cpf: effectiveCpf } : {}),
      }).eq("id", existing.id);
    } else {
      const { data: created, error: memberErr } = await supabase.from("members").insert({
        name: memberName,
        email: memberEmail,
        phone: memberPhone,
        program,
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: "admin-activate-lead",
        crm_lead_id: lead_id,
        member_role: "contratante",
        welcome_message: welcomeMsg,
        ...memberExtra,
        ...(effectiveCpf ? { cpf: effectiveCpf } : {}),
      }).select("id").single();
      if (memberErr) throw new Error(`Falha criando member: ${memberErr.message}`);
      memberId = created.id;
    }

    // Login + entrada no grupo vao sempre pro membro criado/atualizado acima
    // (que e o preposto quando informado, senao o proprio lead).
    const accessMemberId: string = memberId!;
    const accessPhone: string = memberPhone;
    const accessName: string = memberName;

    // 2) Contract — cria se nao existir ainda pra esse lead
    let contractId: string | null = null;
    let signToken: string | null = null;
    let signatureRequired = false;
    const isVip = payment_method === "vip";
    // NUNCA gera cobranca Asaas automaticamente. So quando explicitamente pedido
    // (generate_asaas === true). Ordem do Carlos: nada de boleto sem ser mandado.
    const shouldGenerateLink = !isVip && body.generate_asaas === true && LINK_METHODS.includes(payment_method);
    let contractCreated = false;
    const { data: existingContract } = await supabase.from("member_contracts")
      .select("id, sign_token, signature_required, signature_status").eq("crm_lead_id", lead_id).maybeSingle();
    if (existingContract) {
      contractId = existingContract.id;
      signToken = existingContract.sign_token;
      signatureRequired = existingContract.signature_required !== false && existingContract.signature_status !== "signed";
    } else if (totalValue > 0) {
      const installments = Math.max(1, Math.min(12, Number(num_installments) || 1));
      const entry = Number(entry_value ?? (installments === 1 ? totalValue : 0)) || 0;
      const installmentValue = installments === 1 ? totalValue : (totalValue - entry) / installments;
      // Quando gera link, a entrada/parcela ainda NAO foi paga (vai pro Asaas).
      const entryPaidNow = !isVip && !shouldGenerateLink && entry > 0;

      // Parametros do contrato legal (MentorIA=3m / Metodo Squaad=12m) para
      // a assinatura eletronica na area de membros (edge member-contract).
      const isMetodo = String(program).toLowerCase().includes("metodo");
      const vigenciaMonths = isMetodo ? 12 : 3;
      const productLabel = isMetodo ? "Metodo Squaad" : "MentorIA";
      const modalityLabel = isMetodo ? "Mentoria 12 Meses" : "Mentoria 3 Meses";
      const accessStart = new Date();
      const accessEnd = new Date();
      accessEnd.setMonth(accessEnd.getMonth() + vigenciaMonths);

      const { data: contract, error: contractErr } = await supabase.from("member_contracts").insert({
        member_id: memberId,
        crm_lead_id: lead_id,
        program,
        total_value: totalValue,
        entry_value: entry,
        entry_method: entry > 0 ? payment_method : null,
        entry_paid: entryPaidNow,
        entry_paid_at: entryPaidNow ? new Date().toISOString() : null,
        num_installments: installments,
        installment_value: installmentValue,
        payment_method,
        status: isVip ? "vip" : "active",
        gateway: isVip ? "vip" : (shouldGenerateLink ? "asaas" : "manual"),
        // Contrato legal + assinatura eletronica
        product_label: productLabel,
        modality_label: modalityLabel,
        vigencia_months: vigenciaMonths,
        access_starts_on: accessStart.toISOString().slice(0, 10),
        access_ends_on: accessEnd.toISOString().slice(0, 10),
        template_version: "v1",
        signature_required: true,
        signature_status: "pending_data",
        notes: isVip
          ? `Venda VIP / Parceria — nao contabiliza no financeiro (lead ${lead_id})`
          : `Ativacao automatica via CRM (lead ${lead_id})`,
      }).select("id, sign_token").single();
      if (contractErr) throw new Error(`Falha criando contrato: ${contractErr.message}`);
      contractId = contract.id;
      signToken = contract.sign_token;
      signatureRequired = true;
      contractCreated = true;

      // 3) Payments — pula tudo se for VIP (parceria nao gera cobranca)
      if (!isVip) {
        const today = new Date().toISOString().slice(0, 10);
        // Quando gera link: parcelas ficam PENDING (aguardando pagamento Asaas).
        // Quando NAO gera link (other/bank_transfer): mantem comportamento antigo (marca pago).
        if (installments === 1) {
          await supabase.from("member_payments").insert({
            contract_id: contractId,
            member_id: memberId,
            installment_number: 1,
            value: totalValue,
            due_date: today,
            status: shouldGenerateLink ? "pending" : "paid",
            ...(shouldGenerateLink
              ? { payment_method, notes: "Cobranca via Asaas — aguardando pagamento" }
              : { paid_at: new Date().toISOString(), paid_value: totalValue, payment_method, notes: "Pagamento integral no fechamento" }),
          });
        } else {
          if (entry > 0) {
            await supabase.from("member_payments").insert({
              contract_id: contractId,
              member_id: memberId,
              installment_number: 0,
              value: entry,
              due_date: today,
              status: shouldGenerateLink ? "pending" : "paid",
              ...(shouldGenerateLink
                ? { payment_method, notes: "Entrada — cobranca via Asaas" }
                : { paid_at: new Date().toISOString(), paid_value: entry, payment_method, notes: "Entrada" }),
            });
          }
          for (let i = 1; i <= installments; i++) {
            const due = new Date();
            due.setMonth(due.getMonth() + i);
            await supabase.from("member_payments").insert({
              contract_id: contractId,
              member_id: memberId,
              installment_number: i,
              value: installmentValue,
              due_date: due.toISOString().slice(0, 10),
              status: "pending",
              payment_method,
            });
          }
        }
      }
    }

    // 3.5) Geracao da cobranca no Asaas (so quando metodo gera link e contrato novo)
    let paymentLink: string | null = null;
    let paymentLinkError: string | null = null;
    let paymentLinkSent = false;
    if (shouldGenerateLink && contractId && contractCreated) {
      if (!effectiveCpf) {
        paymentLinkError = "CPF/CNPJ ausente — preencha o CPF do aluno para gerar a cobranca no Asaas.";
      } else {
        try {
          // Primeira parcela pendente (entrada=0 se existir, senao parcela 1 ou a vista)
          const { data: firstPending } = await supabase.from("member_payments")
            .select("id")
            .eq("contract_id", contractId)
            .eq("status", "pending")
            .order("installment_number", { ascending: true })
            .limit(1).maybeSingle();

          if (firstPending?.id) {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/asaas-create-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({ payment_id: firstPending.id, member_id: memberId, contract_id: contractId }),
            });
            const j = await r.json();
            if (r.ok && j?.url) {
              paymentLink = j.url;
            } else {
              paymentLinkError = j?.error || "Falha ao gerar cobranca no Asaas";
            }
          } else {
            paymentLinkError = "Nenhuma parcela pendente para cobrar";
          }
        } catch (e: any) {
          paymentLinkError = `Erro Asaas: ${e?.message || e}`;
        }
      }

      // Envia o link no WhatsApp do aluno (best-effort)
      if (paymentLink) {
        try {
          const { data: inst } = await supabase.from("whatsapp_instances")
            .select("id, status, provider, is_dedicated_blast")
            .eq("provider", "uazapi").eq("status", "connected")
            .or("is_dedicated_blast.is.null,is_dedicated_blast.eq.false")
            .order("created_at", { ascending: true }).limit(1).maybeSingle();
          if (inst?.id) {
            const firstName = (lead.name || "Aluno").split(" ")[0];
            const msg = `Ola ${firstName}! Para concluir sua matricula no SQUAAD, segue o link de pagamento:\n\n${paymentLink}\n\nVoce pode pagar via PIX, boleto ou cartao de credito (parcelando no cartao no proprio checkout). Qualquer duvida estou a disposicao.`;
            const proxyRes = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-proxy`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({
                action: "send_text",
                instance_id: inst.id,
                phone: normPhone,
                message: msg,
                sent_by: "auto_payment_link",
                delay: 1500,
              }),
            });
            const pj = await proxyRes.json();
            paymentLinkSent = !!pj?.success;
          }
        } catch (e) {
          console.warn("[activate-lead] payment link WhatsApp send failed:", e);
        }
      }
    }

    // 2.5) Enterprise: auto-cria enrollment Metodo SQUAAD pra ele ter acesso completo
    let enrollmentCreated = false;
    if (program === "enterprise") {
      try {
        const { data: existingEnrollment } = await supabase.from("metodo_squaad_enrollments")
          .select("id").eq("crm_lead_id", lead_id).maybeSingle();
        if (!existingEnrollment) {
          await supabase.from("metodo_squaad_enrollments").insert({
            crm_lead_id: lead_id,
            name: lead.name,
            whatsapp: normPhone,
            status: "completed",
            program: "Enterprise + Metodo SQUAAD",
          });
          enrollmentCreated = true;
        }
      } catch (e) {
        console.warn("[activate-lead] enterprise enrollment failed:", e);
      }
    }

    // 4) Update CRM lead
    await supabase.from("crm_leads").update({
      post_sale_stage: "active",
      updated_at: new Date().toISOString(),
    }).eq("id", lead_id);

    await supabase.from("crm_activities").insert({
      lead_id,
      activity_type: "member_activated",
      description: isVip
        ? `Lead ativado como aluno VIP/Parceria (${program}). Valor registrado: R$ ${totalValue.toFixed(2)} — nao contabiliza no financeiro.`
        : `Lead ativado como aluno (${program}).${usePreposto ? ` Acesso pro preposto ${accessName}.` : ""} Valor: R$ ${totalValue.toFixed(2)} em ${num_installments || 1}x via ${payment_method}.${paymentLink ? " Cobranca Asaas gerada." : paymentLinkError ? ` Cobranca NAO gerada: ${paymentLinkError}` : ""}`,
      metadata: {
        member_id: memberId,
        contract_id: contractId,
        total_value: totalValue,
        is_vip: isVip,
        is_preposto: usePreposto,
        enterprise_enrollment_created: enrollmentCreated,
        payment_link: paymentLink,
        payment_link_error: paymentLinkError,
      },
    });

    // 5) No ato da compra: manda o LINK DE ASSINATURA do contrato. O acesso
    // (credenciais de login) so e liberado DEPOIS que o aluno assina — quem
    // dispara as credenciais e a edge member-contract, logo apos o aceite.
    // Sem contrato pra assinar (VIP/parceria): manda as credenciais direto.
    let credentialsSent = false;
    let contractLinkSent = false;
    const doOnboarding = !memberAlreadyActive || force;
    if (doOnboarding && signatureRequired && signToken) {
      try {
        const { data: inst } = await supabase.from("whatsapp_instances")
          .select("id").eq("provider", "uazapi").eq("status", "connected")
          .or("is_dedicated_blast.is.null,is_dedicated_blast.eq.false")
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (inst?.id) {
          const firstName = (accessName || "Aluno").split(" ")[0];
          const signUrl = `https://squaad.com.br/assinar/${signToken}`;
          const msg = `Opaa ${firstName}! 🎉 Sua vaga no SQUAAD esta confirmada.\n\nPara liberar o acesso a area de membros, assine seu contrato de mentoria (e digital, leva 1 minuto):\n\n👉 ${signUrl}\n\nAssim que assinar, seu login e liberado automaticamente e voce recebe os dados de acesso aqui mesmo. Qualquer duvida e so chamar!\n\n*SQUAAD Business Solutions*`;
          const r = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ action: "send_text", instance_id: inst.id, phone: accessPhone, message: msg, sent_by: "contract_link", delay: 1500 }),
          });
          const j = await r.json();
          contractLinkSent = !!j?.success;
        }
      } catch (e) {
        console.warn("[activate-lead] contract link send failed:", e);
      }
    } else if (doOnboarding && send_credentials) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/send-member-credentials`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ member_id: accessMemberId, force: true }),
        });
        const j = await r.json();
        credentialsSent = !!j?.ok;
      } catch (e) {
        console.warn("[activate-lead] credentials send failed:", e);
      }
    }

    // 6) Adicionar ao grupo WhatsApp do programa + msg de boas-vindas (best-effort)
    let groupAdded = false;
    let groupWelcomeSent = false;
    let groupName: string | null = null;
    if (!memberAlreadyActive || force) {
      try {
        const GROUP_SELECT = "id, group_jid, instance_id, name, welcome_message";
        // Grupo do proprio programa
        let { data: group } = await supabase
          .from("whatsapp_groups").select(GROUP_SELECT)
          .eq("linked_program", program).maybeSingle();
        // Fallback temporario: enquanto o programa nao tem grupo proprio, usa o de outro.
        // mentoria compartilha o grupo do metodo-squaad ate ser desmembrado (basta criar
        // um whatsapp_groups com linked_program='mentoria' que esse fallback para de agir).
        const GROUP_FALLBACK: Record<string, string> = { mentoria: "metodo-squaad" };
        if (!group && GROUP_FALLBACK[program]) {
          const fb = await supabase
            .from("whatsapp_groups").select(GROUP_SELECT)
            .eq("linked_program", GROUP_FALLBACK[program]).maybeSingle();
          group = fb.data;
        }
        if (group?.group_jid && group?.instance_id) {
          groupName = group.name;
          const proxyUrl = `${SUPABASE_URL}/functions/v1/uazapi-proxy`;
          const proxyHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` };

          // Adicionar participante
          const addRes = await fetch(proxyUrl, {
            method: "POST",
            headers: proxyHeaders,
            body: JSON.stringify({
              action: "group_add_participant",
              instance_id: group.instance_id,
              group_jid: group.group_jid,
              phone: accessPhone,
            }),
          });
          const addJson = await addRes.json();
          groupAdded = !!addJson?.success;

          // Mensagem curta no grupo (so envia se conseguiu adicionar)
          if (groupAdded) {
            const firstName = (accessName || "Aluno").split(" ")[0];
            const customWelcome = (group.welcome_message || "").trim();
            const welcomeText = customWelcome
              ? customWelcome
                  .replace(/\{\{\s*nome\s*\}\}/gi, firstName)
                  .replace(/\{\{\s*name\s*\}\}/gi, firstName)
              : `Pessoal, recebam o ${firstName} no Metodo SQUAAD! 🎉 Bem-vindo a comunidade.`;
            const groupTarget = group.group_jid.includes("@") ? group.group_jid : `${group.group_jid}@g.us`;
            const msgRes = await fetch(proxyUrl, {
              method: "POST",
              headers: proxyHeaders,
              body: JSON.stringify({
                action: "send_text",
                instance_id: group.instance_id,
                phone: groupTarget,
                message: welcomeText,
                sent_by: "auto_member_welcome",
                delay: 2000,
              }),
            });
            const msgJson = await msgRes.json();
            groupWelcomeSent = !!msgJson?.success;
          }

          await supabase.from("crm_activities").insert({
            lead_id,
            activity_type: "member_added_to_group",
            description: groupAdded
              ? `${accessName} adicionado(a) ao grupo ${group.name || group.group_jid}${groupWelcomeSent ? " + boas-vindas enviadas" : ""}.`
              : `Falha ao adicionar ${accessName} ao grupo ${group.name || group.group_jid}.`,
            metadata: { member_id: accessMemberId, is_preposto: usePreposto, group_id: group.id, added: groupAdded, welcome_sent: groupWelcomeSent },
          });
        } else {
          console.log(`[activate-lead] sem grupo vinculado ao programa "${program}" — pule add-to-group`);
        }
      } catch (e) {
        console.warn("[activate-lead] group add/welcome failed:", e);
      }
    }

    return new Response(JSON.stringify({
      ok: true, member_id: memberId, contract_id: contractId,
      is_preposto: usePreposto, access_name: accessName, access_phone: accessPhone,
      total_value: totalValue, credentials_sent: credentialsSent,
      contract_link_sent: contractLinkSent,
      is_vip: isVip, enterprise_enrollment_created: enrollmentCreated,
      group_added: groupAdded, group_welcome_sent: groupWelcomeSent, group_name: groupName,
      payment_link: paymentLink, payment_link_error: paymentLinkError, payment_link_sent: paymentLinkSent,
      email: memberEmail, phone: memberPhone,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[activate-lead] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
