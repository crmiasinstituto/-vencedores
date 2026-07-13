// ============================================================
// VirarLeadModal — bifurca em 2 modos:
//
// 1. Admin (CRM + que Vencedores): cria em `crm_leads` com board_id + column_id
//    (kanban embutido — sem tabela `deals` separada). Schema + que Vencedores usa
//    `whatsapp` (não phone), e `crm_boards`/`crm_columns`.
//
// 2. Membro (Método + que Vencedores): cria em `prospeccao_member_leads` (lista
//    pessoal sem pipeline). UI simplificada: nome + whatsapp + tag + notes.
//
// Edge function `prospeccao-virar-lead` aceita ambos via campo `audience`
// (resolvido via member_id no body).
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Loader2, CheckCircle2, Phone, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { getProspeccaoContext, type ProspeccaoContext } from "../lib/context";

interface CrmBoard { id: string; name: string; }
interface CrmColumn { id: string; name: string; board_id: string; sort_order: number; }
interface TeamMember { id: string; name: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  leadDescobertoIds: string[];
  leadDescobertoNome?: string;
  leadDescobertoTelefone?: string | null;
}

export function VirarLeadModal(props: Props) {
  const [ctx, setCtx] = useState<ProspeccaoContext | null>(null);

  useEffect(() => {
    if (!props.open) return;
    getProspeccaoContext().then(setCtx);
  }, [props.open]);

  if (!ctx) {
    return (
      <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return ctx.audience === "admin"
    ? <VirarLeadAdminModal {...props} />
    : <VirarLeadMembroModal {...props} memberId={ctx.member_id!} />;
}

// ============================================================
// MODO ADMIN — board/column do CRM + que Vencedores
// ============================================================
function VirarLeadAdminModal({ open, onClose, leadDescobertoIds, leadDescobertoNome, leadDescobertoTelefone }: Props) {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<CrmBoard[]>([]);
  const [columns, setColumns] = useState<CrmColumn[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [boardId, setBoardId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [tag, setTag] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [attachLink, setAttachLink] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setPhone(leadDescobertoTelefone || "");
  }, [open, leadDescobertoTelefone]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const [bRes, cRes, tRes] = await Promise.all([
        (supabase as any).from("crm_boards").select("id, name").eq("is_active", true).order("sort_order", { ascending: true }),
        (supabase as any).from("crm_columns").select("id, name, board_id, sort_order").order("sort_order", { ascending: true }),
        // team_members pode não existir em todos CRMs — fallback gracioso
        (supabase as any).from("team_members").select("id, name").eq("is_active", true).order("name").then(
          (r) => r,
          () => ({ data: [], error: null })
        ),
      ]);
      if (!alive) return;
      setBoards((bRes.data as CrmBoard[]) || []);
      setColumns((cRes.data as CrmColumn[]) || []);
      setTeamMembers((tRes.data as TeamMember[]) || []);
      if (bRes.data && bRes.data.length > 0) setBoardId(bRes.data[0].id);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    const cs = columns.filter((c) => c.board_id === boardId);
    if (cs.length > 0) setColumnId(cs[0].id);
    else setColumnId("");
  }, [boardId, columns]);

  const filteredColumns = columns.filter((c) => c.board_id === boardId);
  const phoneNormalizado = phone.replace(/\D/g, "");
  const phoneValido = phoneNormalizado.length >= 10;

  const handleSubmit = async () => {
    if (!boardId || !columnId) return toast.error("Escolhe board e coluna");
    if (leadDescobertoIds.length === 1 && !phoneValido) {
      return toast.error("WhatsApp obrigatório (mín 10 dígitos com DDD)");
    }
    setSubmitting(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data, error } = await supabase.functions.invoke("prospeccao-virar-lead", {
        body: {
          lead_descoberto_ids: leadDescobertoIds,
          board_id: boardId,
          column_id: columnId,
          assigned_to: assignedTo || undefined,
          tags: tag ? [tag] : [],
          phone_override: phoneValido ? phoneNormalizado : undefined,
          notes: notes || undefined,
          attach_diagnosis_link: attachLink,
          user_id: userId,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const results = (data?.results || []) as Array<{ lead_descoberto_id: string; lead_id?: string; ok: boolean; erro?: string; }>;
      const sucessos = results.filter((r) => r.ok);
      const falhas = results.filter((r) => !r.ok);
      if (sucessos.length > 0) {
        toast.success(`${sucessos.length} lead${sucessos.length > 1 ? "s criados" : " criado"} no CRM${falhas.length > 0 ? ` (${falhas.length} falharam)` : ""}`);
      }
      if (falhas.length > 0 && sucessos.length === 0) toast.error(`Falha: ${falhas[0].erro}`);
      if (sucessos.length === 1 && sucessos[0].lead_id) {
        onClose();
        navigate(`/admin/crm`);
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-primary mb-1">
            <Star className="h-3 w-3" /> VIRAR LEAD NO CRM + que Vencedores
          </div>
          <DialogTitle>
            {leadDescobertoIds.length === 1
              ? leadDescobertoNome || "Lead"
              : `${leadDescobertoIds.length} leads selecionados`}
          </DialogTitle>
          <DialogDescription>
            Cria registro em <code>crm_leads</code> no kanban escolhido.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            <Field label="Board">
              <Select value={boardId} onChange={setBoardId}>
                {boards.length === 0 && <option value="">Nenhum board ativo</option>}
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Coluna inicial">
              <Select value={columnId} onChange={setColumnId}>
                {filteredColumns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            {teamMembers.length > 0 && (
              <Field label="Atribuir a (opcional)">
                <Select value={assignedTo} onChange={setAssignedTo}>
                  <option value="">— sem responsável —</option>
                  {teamMembers.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </Select>
              </Field>
            )}
            {leadDescobertoIds.length === 1 && (
              <Field label={`WhatsApp${!leadDescobertoTelefone ? " — não detectado, preencha manual" : ""}`}>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className={`pl-9 ${!phoneValido ? "border-amber-500/40 focus-visible:ring-amber-500/30" : ""}`}
                  />
                </div>
                {!phoneValido && phone.length > 0 && (
                  <p className="text-[11px] text-amber-500 mt-1">Mínimo 10 dígitos com DDD</p>
                )}
              </Field>
            )}
            <Field label="Tag (opcional)">
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="prospeccao-estetica-sp" />
            </Field>
            <Field label="Notas adicionais (opcional)">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações sobre o lead..." rows={2} />
            </Field>
            <label className="flex items-start gap-2 cursor-pointer text-sm">
              <Checkbox checked={attachLink} onCheckedChange={(v) => setAttachLink(!!v)} className="mt-0.5" />
              <span>Anexar resumo do diagnóstico nas notas do lead</span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || submitting || !boardId || !columnId} className="gap-2">
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Criando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" />Criar {leadDescobertoIds.length > 1 ? `${leadDescobertoIds.length} leads` : "lead"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MODO MEMBRO — lista pessoal (prospeccao_member_leads)
// ============================================================
function VirarLeadMembroModal({ open, onClose, leadDescobertoIds, leadDescobertoNome, leadDescobertoTelefone, memberId }: Props & { memberId: string }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [tag, setTag] = useState("");
  const [notes, setNotes] = useState("");
  const [attachLink, setAttachLink] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setPhone(leadDescobertoTelefone || "");
  }, [open, leadDescobertoTelefone]);

  const phoneNormalizado = phone.replace(/\D/g, "");

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("prospeccao-virar-lead", {
        body: {
          lead_descoberto_ids: leadDescobertoIds,
          tags: tag ? [tag] : [],
          phone_override: phoneNormalizado.length >= 10 ? phoneNormalizado : undefined,
          notes: notes || undefined,
          attach_diagnosis_link: attachLink,
          member_id: memberId,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const results = (data?.results || []) as Array<{ lead_descoberto_id: string; lead_id?: string; ok: boolean; erro?: string; }>;
      const sucessos = results.filter((r) => r.ok);
      const falhas = results.filter((r) => !r.ok);
      if (sucessos.length > 0) {
        toast.success(`${sucessos.length} lead${sucessos.length > 1 ? "s salvos" : " salvo"} em Meus Leads`);
      }
      if (falhas.length > 0 && sucessos.length === 0) toast.error(`Falha: ${falhas[0].erro}`);
      if (sucessos.length >= 1) {
        onClose();
        navigate("/membros/prospeccao/meus-leads");
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-primary mb-1">
            <UserPlus className="h-3 w-3" /> SALVAR EM MEUS LEADS
          </div>
          <DialogTitle>
            {leadDescobertoIds.length === 1
              ? leadDescobertoNome || "Lead"
              : `${leadDescobertoIds.length} leads selecionados`}
          </DialogTitle>
          <DialogDescription>
            Adiciona à sua lista pessoal de leads — você acompanha o status e o diagnóstico fica anexado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {leadDescobertoIds.length === 1 && (
            <Field label="WhatsApp (opcional)">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="pl-9"
                />
              </div>
            </Field>
          )}
          <Field label="Tag (opcional)">
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="estetica-cliente-em-potencial" />
          </Field>
          <Field label="Notas pessoais">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="O que vc achou desse lead? Próximo passo?" rows={3} />
          </Field>
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <Checkbox checked={attachLink} onCheckedChange={(v) => setAttachLink(!!v)} className="mt-0.5" />
            <span>Anexar resumo do diagnóstico</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" />Salvar {leadDescobertoIds.length > 1 ? `${leadDescobertoIds.length} leads` : "lead"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode; }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
    >
      {children}
    </select>
  );
}
