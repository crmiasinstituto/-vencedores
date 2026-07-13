// Painel de status + reenvio manual do PDF DISC no LeadDetailModal.
// Aparece SÓ se o lead tem registro em disc_pdf_requests OU se é lead do
// evento R10X com DISC concluído (que era pra ter recebido).
//
// Quando aparece:
//   - status SENT: badge verde + horário
//   - status FAILED ou PROCESSING/PENDING travado: badge vermelho com motivo
//     + botão "Reenviar PDF agora" (chama disc-pdf-deliver com lead_id)
//   - se mensagem de erro indicar número inválido, mostra dica pra editar
//     o WhatsApp na aba "Dados" antes de reenviar
//
// Usa disc-pdf-deliver edge function (já deployada) — passa retry=true pra
// forçar nova tentativa mesmo que já exista um registro recente.

import { useEffect, useState, useCallback } from "react";
import { Loader2, FileText, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  leadId: string;
  leadEvento?: string | null;
  leadDiscProfile?: string | null;
  leadWhatsapp?: string;
}

interface PdfRequest {
  id: string;
  status: "pending" | "processing" | "sent" | "failed";
  error_msg: string | null;
  requested_at: string;
  sent_at: string | null;
  attempts: number | null;
}

function classifyError(err: string | null): { label: string; isPhone: boolean; hint: string | null } {
  if (!err) return { label: "Falha ao enviar", isPhone: false, hint: null };
  const e = err.toLowerCase();
  if (e.includes("is not on whatsapp")) {
    return {
      label: "Esse número não tem WhatsApp ativo",
      isPhone: true,
      hint: "Pergunta pro lead se ele cadastrou WhatsApp errado. Edite na aba 'Dados' (formato: 55+DDD+9+8 = 13 dígitos) e clique em 'Reenviar PDF'.",
    };
  }
  if (e.includes("failed to get user info") || e.includes("user info")) {
    return {
      label: "WhatsApp não respondeu (provavelmente número não tem conta)",
      isPhone: true,
      hint: "O número parece estar bem formatado mas o WhatsApp não confirma se ele existe. Tente reenviar — se persistir, confirme o número com o lead.",
    };
  }
  if (e.includes("timeout") || e.includes("etimedout")) {
    return { label: "Timeout no envio", isPhone: false, hint: "Tente reenviar — provavelmente foi instabilidade momentânea." };
  }
  if (e.includes("json at position") || e.includes("unexpected") && e.includes("json")) {
    return { label: "Resposta corrompida do servidor WhatsApp", isPhone: false, hint: "Bug do UAZAPI no pico. Tente reenviar agora — provavelmente funciona." };
  }
  return { label: err.slice(0, 120), isPhone: false, hint: null };
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export function DiscPdfPanel({ leadId, leadEvento, leadDiscProfile, leadWhatsapp }: Props) {
  const [request, setRequest] = useState<PdfRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("disc_pdf_requests")
      .select("id, status, error_msg, requested_at, sent_at, attempts")
      .eq("lead_id", leadId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequest(data || null);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isR10xLead = leadEvento === "reprograme-se-10x";
  const completedDisc = !!leadDiscProfile;

  // Não mostra painel se não for lead do evento R10X (ou se nunca pediu PDF)
  if (!isR10xLead && !request) return null;

  async function handleResend() {
    setResending(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("disc-pdf-deliver", {
        body: { lead_id: leadId, retry: true },
      });
      if (error) throw error;
      toast.success("PDF colocado na fila", {
        description: "O envio acontece em background. Pode levar até 1-2min pra chegar no WhatsApp.",
      });
      // Aguarda 2s e refaz fetch pra mostrar status atualizado
      setTimeout(fetchStatus, 2_000);
    } catch (e: any) {
      toast.error("Falha ao reenviar", { description: e?.message?.slice(0, 200) });
    } finally {
      setResending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Verificando status do PDF DISC…
      </div>
    );
  }

  // Caso 1: lead do R10X com DISC concluído MAS sem registro de PDF — provavelmente não clicou no botão
  if (!request && isR10xLead && completedDisc) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-sm">PDF DISC nunca foi solicitado</strong>
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                não clicou
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Esse lead completou o DISC mas saiu da tela antes de clicar no botão "Baixar PDF".
              Você pode enviar manualmente:
            </p>
          </div>
          <Button size="sm" onClick={handleResend} disabled={resending} className="flex-shrink-0">
            {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
            Enviar PDF
          </Button>
        </div>
      </div>
    );
  }

  // Caso 2: tem registro de PDF
  if (request) {
    const errClass = classifyError(request.error_msg);

    if (request.status === "sent") {
      return (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm">PDF DISC entregue</strong>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300">
                  enviado
                </Badge>
                {request.sent_at && (
                  <span className="text-[11px] text-muted-foreground">{fmtAgo(request.sent_at)}</span>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={handleResend} disabled={resending} className="flex-shrink-0">
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Reenviar
            </Button>
          </div>
        </div>
      );
    }

    if (request.status === "failed") {
      return (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm">PDF DISC não foi entregue</strong>
                <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-300">
                  falhou {request.attempts ? `(${request.attempts}x)` : ""}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{fmtAgo(request.requested_at)}</span>
              </div>
              <div className="mt-1.5 text-xs text-red-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{errClass.label}</span>
              </div>
              {errClass.isPhone && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1.5">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>
                    WhatsApp atual: <code className="font-mono text-foreground">{leadWhatsapp || "—"}</code>.{" "}
                    {errClass.hint}
                  </span>
                </div>
              )}
              {!errClass.isPhone && errClass.hint && (
                <p className="text-[11px] text-muted-foreground mt-1.5">{errClass.hint}</p>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleResend}
              disabled={resending}
              className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white"
            >
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Reenviar agora
            </Button>
          </div>
        </div>
      );
    }

    // pending/processing
    return (
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
        <div className="flex items-start gap-3">
          <Loader2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0 animate-spin" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-sm">PDF DISC na fila</strong>
              <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300">
                {request.status}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{fmtAgo(request.requested_at)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Processamento em background, geralmente leva 1-3min. Se travou aqui, clique em reenviar.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleResend} disabled={resending} className="flex-shrink-0">
            {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Forçar reenvio
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
