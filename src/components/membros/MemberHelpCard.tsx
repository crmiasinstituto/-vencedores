import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Wrench, Headphones, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Card "Travado nessa aula?" com 2 botoes: CS e Suporte Tecnico.
// Click abre modal opcional pra detalhar o motivo. Envia via
// request-member-help, que dispara WhatsApp pro contato configurado
// em /admin/configuracoes (service=cs_contact / tech_support, campo
// account_id = telefone).

interface Props {
  lessonId?: string;
  className?: string;
}

type ContactType = 'cs' | 'support';

const OPTIONS: Record<ContactType, { label: string; description: string; icon: typeof Phone; color: string }> = {
  cs: {
    label: 'Falar com CS',
    description: 'Travamento de jornada ou duvida sobre o programa',
    icon: Headphones,
    color: '#3B82F6',
  },
  support: {
    label: 'Suporte Tecnico',
    description: 'Bug, integracao ou ajuda tecnica especifica',
    icon: Wrench,
    color: '#60A5FA',
  },
};

export function MemberHelpCard({ lessonId, className }: Props) {
  const [openType, setOpenType] = useState<ContactType | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [labels, setLabels] = useState<Record<ContactType, string | null>>({ cs: null, support: null });
  const [activeMap, setActiveMap] = useState<Record<ContactType, boolean>>({ cs: true, support: true });

  // Le labels personalizados via RPC publica (sem expor telefone).
  // Admin renomeia em /admin/configuracoes; aqui rende o nome que ele setou.
  useEffect(() => {
    (supabase as any).rpc('get_help_contact_labels').then(({ data }: any) => {
      if (!Array.isArray(data)) return;
      const next: Record<ContactType, string | null> = { cs: null, support: null };
      const act: Record<ContactType, boolean> = { cs: true, support: true };
      for (const r of data) {
        const t: ContactType | null = r.service === 'cs_contact' ? 'cs' : r.service === 'tech_support' ? 'support' : null;
        if (!t) continue;
        next[t] = r.display_label || null;
        act[t] = !!r.is_active;
      }
      setLabels(next);
      setActiveMap(act);
    });
  }, []);

  async function submit() {
    if (!openType) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-member-help', {
        body: {
          contact_type: openType,
          reason: reason.trim() || undefined,
          lesson_id: lessonId || undefined,
        },
      });

      if (error || (data && (data as any).error)) {
        const msg = (data && (data as any).error) || error?.message || 'Erro inesperado';
        toast.error(msg);
      } else {
        toast.success(
          (data && (data as any).message) || `Mensagem enviada. ${OPTIONS[openType].label} vai te chamar no WhatsApp.`,
          { duration: 6000 },
        );
        setOpenType(null);
        setReason('');
      }
    } catch (e) {
      toast.error('Erro de rede. Tenta de novo em 1 minuto.');
    } finally {
      setSending(false);
    }
  }

  const visibleTypes = (Object.keys(OPTIONS) as ContactType[]).filter((t) => activeMap[t]);
  if (visibleTypes.length === 0) return null;

  return (
    <>
      <div className={`flex items-center gap-2 flex-wrap rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 ${className || ''}`}>
        <div className="flex items-center gap-1.5 text-[11px] text-white/50 mr-1">
          <MessageCircle className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Travou? Chama o time:</span>
        </div>
        {visibleTypes.map((type) => {
          const opt = OPTIONS[type];
          const Icon = opt.icon;
          const displayName = labels[type] || opt.label;
          return (
            <button
              key={type}
              onClick={() => {
                setOpenType(type);
                setReason('');
              }}
              title={opt.description}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 transition-all text-xs"
            >
              <Icon className="w-3.5 h-3.5" style={{ color: opt.color }} />
              <span className="text-white/80 group-hover:text-white">{displayName}</span>
            </button>
          );
        })}
      </div>

      <Dialog open={openType !== null} onOpenChange={(o) => !o && setOpenType(null)}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openType && (
                <>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${OPTIONS[openType].color}20` }}
                  >
                    {(() => {
                      const Icon = OPTIONS[openType].icon;
                      return <Icon className="w-3.5 h-3.5" style={{ color: OPTIONS[openType].color }} />;
                    })()}
                  </div>
                  {labels[openType] || OPTIONS[openType].label}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Conta brevemente o que tá travando. A pessoa recebe seu pedido no WhatsApp
              e te contacta. Pode deixar em branco se for so um "oi, vamos conversar".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-white/60">Motivo (opcional)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Nao consigo terminar a tarefa X; meu agente nao responde igual no video; etc."
              rows={4}
              maxLength={500}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3B82F6]/40"
            />
            <p className="text-[10px] text-white/30 text-right">{reason.length}/500</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpenType(null)}
              disabled={sending}
              className="text-white/60 hover:text-white hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={sending}
              className="bg-[#3B82F6] hover:bg-[#FFE066] text-black font-semibold"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <>Enviar pelo WhatsApp</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
