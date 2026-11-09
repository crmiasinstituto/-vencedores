import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Estado {
  nao_contatar: boolean;
  nao_contatar_motivo: string | null;
  nao_contatar_em: string | null;
  nao_contatar_origem: string | null;
}

const ORIGEM: Record<string, string> = {
  manual: 'marcado pela equipe',
  resposta: 'a pessoa pediu pelo WhatsApp',
};

/**
 * Trava "Não contatar" do lead. Ligada, o lead sai de todas as campanhas de e-mail e
 * WhatsApp e as automações pulam os envios pra ele (o banco sincroniza email_opted_out e a
 * tag whatsapp_optout — ver migração 20261109120000_nao_contatar).
 */
export function NaoContatarButton({ leadId, compact = false }: { leadId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  const { data: estado, isLoading } = useQuery({
    queryKey: ['lead-nao-contatar', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<Estado | null> => {
      const { data, error } = await supabase
        .from('crm_leads' as any)
        .select('nao_contatar, nao_contatar_motivo, nao_contatar_em, nao_contatar_origem')
        .eq('id', leadId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Estado) || null;
    },
  });

  const mudar = useMutation({
    mutationFn: async (ligar: boolean) => {
      const { error } = await supabase
        .from('crm_leads' as any)
        .update(
          ligar
            ? { nao_contatar: true, nao_contatar_origem: 'manual', nao_contatar_motivo: motivo.trim() || 'Marcado pela equipe' }
            : { nao_contatar: false },
        )
        .eq('id', leadId);
      if (error) throw error;
      await supabase.from('crm_activities').insert({
        lead_id: leadId,
        activity_type: 'nao_contatar',
        description: ligar
          ? `Marcado como NÃO CONTATAR${motivo.trim() ? `: ${motivo.trim()}` : ''}`
          : 'Liberado para receber mensagens de novo',
        metadata: { origem: 'manual' },
      } as any);
    },
    onSuccess: (_d, ligar) => {
      toast.success(ligar ? 'Pronto: esse lead não recebe mais e-mail nem WhatsApp' : 'Lead liberado para receber mensagens');
      setOpen(false);
      setMotivo('');
      qc.invalidateQueries({ queryKey: ['lead-nao-contatar', leadId] });
      qc.invalidateQueries({ queryKey: ['audience-count'] });
    },
    onError: (e: any) => toast.error(`Não consegui salvar: ${e.message}`),
  });

  if (isLoading || !estado) {
    return compact ? null : (
      <Button size="sm" variant="outline" disabled className="h-7 gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    );
  }

  const bloqueado = estado.nao_contatar;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            'h-7 gap-1.5 text-xs font-medium',
            bloqueado
              ? 'border-red-500/50 bg-red-500/15 text-red-500 hover:bg-red-500/25 hover:text-red-500'
              : 'text-muted-foreground hover:text-red-500 hover:border-red-500/40',
          )}
          title={bloqueado ? 'Este lead está bloqueado para envios' : 'Bloquear envios para este lead'}
        >
          <Ban className="h-3.5 w-3.5" />
          {bloqueado ? 'Não contatar' : compact ? 'Bloquear' : 'Não contatar'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        {bloqueado ? (
          <>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
                <Ban className="h-4 w-4" /> Bloqueado para envios
              </p>
              <p className="text-xs text-muted-foreground">
                Não entra em campanhas de e-mail nem de WhatsApp, e as automações pulam os envios.
              </p>
            </div>
            <div className="rounded-md border bg-muted/40 p-2.5 text-xs space-y-1">
              {estado.nao_contatar_motivo && <p className="text-foreground">{estado.nao_contatar_motivo}</p>}
              <p className="text-muted-foreground">
                {ORIGEM[estado.nao_contatar_origem || ''] || 'bloqueado'}
                {estado.nao_contatar_em &&
                  ` · ${formatDistanceToNow(new Date(estado.nao_contatar_em), { addSuffix: true, locale: ptBR })}`}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              disabled={mudar.isPending}
              onClick={() => mudar.mutate(false)}
            >
              {mudar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Liberar para receber de novo
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Não enviar mais nada para este lead?</p>
              <p className="text-xs text-muted-foreground">
                Ele sai de todas as campanhas de e-mail e WhatsApp, e as automações pulam os envios.
                Dá pra liberar de novo depois. O atendimento manual pelo chat continua funcionando.
              </p>
            </div>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional). Ex.: pediu pra sair da lista"
              rows={2}
              className="text-xs resize-none"
            />
            <Button
              size="sm"
              className="w-full gap-1.5 bg-red-600 hover:bg-red-700 text-white"
              disabled={mudar.isPending}
              onClick={() => mudar.mutate(true)}
            >
              {mudar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Bloquear envios
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NaoContatarButton;
