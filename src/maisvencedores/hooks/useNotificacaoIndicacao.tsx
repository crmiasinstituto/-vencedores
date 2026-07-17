import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';

/**
 * Avisa o padrinho, em tempo real, sobre dois momentos da jornada de quem ele trouxe:
 *
 *   1. INDICAÇÃO APROVADA (UPDATE em referrals → status 'approved'): a pessoa entrou de fato.
 *      Vale +1 ponto (modelo novo do Carlos, 18/07: indicação direta = 1, compra = 10).
 *   2. COMPRA (INSERT em referral_conversions): o indicado comprou algo na Eduzz/outra
 *      plataforma. Vale +10 pontos. É o evento mais valioso — o padrinho é avisado na hora.
 *
 * COMO FUNCIONA: dois canais Realtime filtrados por referrer_id = meu profile. O Realtime já
 * respeita RLS (só entrega linha que eu poderia ler), e o filtro evita receber evento de
 * terceiros. Na aprovação, só reage à VIRADA de status (precisa do valor antigo → replica
 * identity full em referrals).
 *
 * O socket precisa do JWT ANTES de assinar, senão conecta como anon e o RLS nega a linha — o
 * canal fica SUBSCRIBED mas nunca entrega nada. Por isso pegamos a sessão primeiro.
 *
 * Monta uma vez por sessão de membro (ver MembersLayout). onNova permite ao chamador também
 * atualizar contadores/badges.
 */
export function useNotificacaoIndicacao(onNova?: () => void) {
  const { profile } = useProfile();
  const { toast } = useToast();
  const onNovaRef = useRef(onNova);
  onNovaRef.current = onNova;

  useEffect(() => {
    const meuId = profile?.id;
    if (!meuId) return;

    let canal: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);

      canal = supabase
        .channel(`indicacoes:${meuId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'referrals',
            filter: `referrer_id=eq.${meuId}`,
          },
          (payload) => {
            const novo = payload.new as { status?: string };
            const antigo = payload.old as { status?: string };
            // Só o momento da virada. Um update qualquer (ex.: correção de faixa) não dispara.
            if (novo?.status === 'approved' && antigo?.status !== 'approved') {
              toast({
                title: 'Sua indicação foi aprovada',
                description: 'Alguém que você trouxe acabou de ser aprovado. +1 ponto pra você.',
              });
              onNovaRef.current?.();
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'referral_conversions',
            filter: `referrer_id=eq.${meuId}`,
          },
          (payload) => {
            const conv = payload.new as { pontos?: number; produto?: string };
            const pts = conv?.pontos ?? 10;
            toast({
              title: 'Alguém que você indicou comprou!',
              description: conv?.produto
                ? `${conv.produto} — +${pts} pontos pra você.`
                : `+${pts} pontos pra você.`,
            });
            onNovaRef.current?.();
          },
        )
        .subscribe();
    })();

    return () => {
      if (canal) supabase.removeChannel(canal);
    };
  }, [profile?.id, toast]);
}
