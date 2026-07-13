import { useEffect, useState } from "react";
import { Send, Loader2, Sparkles, Copy, MessageCircle, Instagram, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getProspeccaoContext, withContextBody } from "../lib/context";

type Canal = "whatsapp" | "instagram_dm" | "email";

interface Props {
  open: boolean;
  onClose: () => void;
  diagnosticoId: string;
  leadNome?: string;
  leadTelefone?: string | null;
  leadInstagram?: string | null;
  leadEmail?: string | null;
}

export function EnviarDiagnosticoModal({
  open,
  onClose,
  diagnosticoId,
  leadNome,
  leadTelefone,
  leadInstagram,
  leadEmail,
}: Props) {
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [emailDestino, setEmailDestino] = useState("");
  const [emailAssunto, setEmailAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [gancho, setGancho] = useState("");
  const [variant, setVariant] = useState(0);
  const [includeLink, setIncludeLink] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const printUrl = typeof window !== "undefined"
    ? `${window.location.origin}/admin/prospeccao/diagnostico/${diagnosticoId}/print`
    : "";

  useEffect(() => {
    if (!open) return;
    if (leadTelefone) setCanal("whatsapp");
    else if (leadInstagram) setCanal("instagram_dm");
    else if (leadEmail) setCanal("email");
    setEmailDestino(leadEmail || "");
    setEmailAssunto(leadNome ? `Diagnóstico de prospecção — ${leadNome}` : "Diagnóstico de prospecção");
  }, [open, leadTelefone, leadInstagram, leadEmail, leadNome]);

  useEffect(() => {
    if (!open) return;
    gerar(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canal]);

  const gerar = async (v = variant) => {
    setGenerating(true);
    try {
      const ctx = await getProspeccaoContext();
      const { data, error } = await supabase.functions.invoke("prospeccao-gerar-mensagem", {
        body: withContextBody(ctx, { diagnostico_id: diagnosticoId, canal, variant: v }),
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setMensagem(data?.mensagem || "");
      setGancho(data?.gancho_principal || "");
      setVariant(v);
    } catch (err) {
      toast.error(`Erro IA: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const mensagemFinal = includeLink ? `${mensagem.trim()}\n\n${printUrl}` : mensagem;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mensagemFinal);
      toast.success("Copiado pra área de transferência");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const handleSendWhatsApp = async () => {
    if (!leadTelefone) return toast.error("Lead sem telefone");
    setSending(true);
    try {
      // Envia pela API NAO-OFICIAL (UAZAPI, numero do Carlos). Nunca a instancia
      // dedicada de blast. Ver [[feedback_wa_instance_filter]].
      const { data: insts } = await (supabase as any)
        .from("whatsapp_instances")
        .select("id")
        .eq("provider", "uazapi")
        .eq("status", "connected")
        .neq("is_dedicated_blast", true)
        .order("created_at")
        .limit(1);
      const instanceId = insts?.[0]?.id;
      if (!instanceId) {
        toast.error("Nenhuma instancia WhatsApp (UAZAPI) conectada");
        return;
      }
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: { action: "send_text", instance_id: instanceId, number: leadTelefone, text: mensagemFinal, readchat: true },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Mensagem enviada via WhatsApp ✅");
      onClose();
    } catch (err) {
      toast.error(`Falha WhatsApp: ${(err as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  const handleOpenWhatsAppManual = () => {
    if (!leadTelefone) return;
    const phone = leadTelefone.replace(/\D/g, "");
    const formatted = phone.startsWith("55") ? phone : `55${phone}`;
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(mensagemFinal)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSendInstagramMock = async () => {
    setSending(true);
    // Copia a mensagem pro clipboard (IG não aceita pré-preencher DM via URL)
    try {
      await navigator.clipboard.writeText(mensagemFinal);
    } catch {/* ignore */}
    // Abre o DM direto no IG via deep-link (https://ig.me/m/USERNAME)
    if (leadInstagram) {
      const handle = leadInstagram.replace(/^@/, "");
      const url = `https://ig.me/m/${handle}`;
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Mensagem copiada · abrindo DM no Instagram (cole com Cmd+V)");
    } else {
      toast.error("Lead sem @ Instagram");
    }
    setSending(false);
    onClose();
  };

  // Layout padrao + que Vencedores pro email (header da marca + mensagem + CTA do diagnostico).
  const buildEmailHtml = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cta = includeLink && printUrl
      ? `<div style="margin-top:24px"><a href="${printUrl}" style="display:inline-block;background:#f5b301;color:#000;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px">Ver meu diagnostico completo</a></div>`
      : "";
    return `<div style="background:#0b0b0f;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#15151c;border-radius:16px;overflow:hidden;border:1px solid #ffffff14">
    <div style="background:#000;padding:20px 24px;border-bottom:1px solid #ffffff14">
      <span style="color:#f5b301;font-weight:800;letter-spacing:2px;font-size:15px">+ que Vencedores</span>
    </div>
    <div style="padding:24px">
      <p style="white-space:pre-wrap;line-height:1.6;font-size:15px;color:#e8e8ea;margin:0">${esc(mensagem.trim())}</p>
      ${cta}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #ffffff14;color:#777;font-size:11px">
      + que Vencedores Business Solutions, Inteligencia Artificial para Negocios
    </div>
  </div>
</div>`;
  };

  const handleSendEmail = async () => {
    if (!emailDestino || !emailDestino.includes("@")) {
      return toast.error("Informe um email valido");
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-campaign", {
        body: { test_email: emailDestino.trim(), subject: emailAssunto, html: buildEmailHtml() },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Email enviado ✅");
      onClose();
    } catch (err) {
      toast.error(`Falha email: ${(err as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  const handleOpenMailto = () => {
    if (!emailDestino) return;
    const url = `mailto:${emailDestino}?subject=${encodeURIComponent(emailAssunto)}&body=${encodeURIComponent(mensagemFinal)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-primary mb-1">
            <Send className="h-3 w-3" />
            ENVIAR DIAGNÓSTICO
          </div>
          <DialogTitle>{leadNome || "Lead"}</DialogTitle>
          <DialogDescription>Mensagem gerada por IA com tom direto e consultivo — edita à vontade antes de enviar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Canal */}
          <div className="flex gap-2">
            <ChannelButton
              active={canal === "whatsapp"}
              disabled={!leadTelefone}
              onClick={() => setCanal("whatsapp")}
              icon={<Phone className="h-4 w-4" />}
              label="WhatsApp"
              meta={leadTelefone || "sem telefone"}
            />
            <ChannelButton
              active={canal === "instagram_dm"}
              disabled={false}
              onClick={() => setCanal("instagram_dm")}
              icon={<Instagram className="h-4 w-4" />}
              label="DM Instagram"
              meta={leadInstagram ? `@${leadInstagram}` : "sem @ Instagram"}
            />
            <ChannelButton
              active={canal === "email"}
              disabled={false}
              onClick={() => setCanal("email")}
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              meta={leadEmail || "preencher abaixo"}
            />
          </div>

          {/* Campo de email — só pra canal email */}
          {canal === "email" && (
            <div className="space-y-2 rounded-md border border-border bg-card/40 p-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Destinatário
                </label>
                <input
                  type="email"
                  value={emailDestino}
                  onChange={(e) => setEmailDestino(e.target.value)}
                  placeholder="contato@empresa.com"
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Assunto
                </label>
                <input
                  type="text"
                  value={emailAssunto}
                  onChange={(e) => setEmailAssunto(e.target.value)}
                  placeholder="Diagnóstico de prospecção"
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">💡 Enviado pelo + que Vencedores com o template padrão da marca (Resend). Se o lead já tem email, é só 1 clique; senão, preencha acima.</p>
            </div>
          )}

          {/* Mensagem */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Mensagem
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => gerar((variant + 1) % 3)}
                disabled={generating}
                className="h-7 gap-1 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                Regenerar
              </Button>
            </div>
            <div className="relative">
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder={generating ? "Gerando..." : "Mensagem aparecerá aqui..."}
                rows={9}
                disabled={generating}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none font-mono leading-relaxed"
              />
              {generating && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-md">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>
            {gancho && (
              <p className="text-[11px] text-muted-foreground">
                💡 Gancho: <span className="text-foreground/80">{gancho}</span>
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">{mensagem.length} chars</p>
          </div>

          {/* Anexar link */}
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <Checkbox checked={includeLink} onCheckedChange={(v) => setIncludeLink(!!v)} className="mt-0.5" />
            <div className="space-y-1">
              <span>Anexar link do diagnóstico em PDF (público)</span>
              {includeLink && <code className="block text-[10px] text-muted-foreground break-all">{printUrl}</code>}
            </div>
          </label>
        </div>

        <DialogFooter className="flex-wrap">
          <Button variant="ghost" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            <Copy className="h-4 w-4" />Copiar
          </Button>
          {canal === "whatsapp" && leadTelefone && (
            <>
              <Button variant="outline" onClick={handleOpenWhatsAppManual} className="gap-2">
                <MessageCircle className="h-4 w-4" />Abrir WhatsApp
              </Button>
              <Button onClick={handleSendWhatsApp} disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar via WhatsApp
              </Button>
            </>
          )}
          {canal === "instagram_dm" && (
            <Button onClick={handleSendInstagramMock} disabled={sending || !leadInstagram} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
              Abrir DM no Instagram
            </Button>
          )}
          {canal === "email" && (
            <>
              <Button variant="outline" onClick={handleOpenMailto} disabled={!emailDestino} className="gap-2">
                <Mail className="h-4 w-4" />Abrir cliente
              </Button>
              <Button onClick={handleSendEmail} disabled={sending || !emailDestino} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar email
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChannelButton({
  active, disabled, onClick, icon, label, meta,
}: {
  active: boolean; disabled: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; meta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex items-center gap-2 rounded-lg border p-3 transition-colors text-left ${
        active
          ? "border-primary/50 bg-primary/5 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {icon}
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[10px] truncate">{meta}</div>
      </div>
    </button>
  );
}
