import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';

/**
 * Avisa o padrinho, em tempo real, quando uma indicação dele é aprovada.
 *
 * Pedido do Carlos: "manter todos cientes da evolução". No segundo em que o time aprova o
 * indicado, quem indicou recebe um toast — sem recarregar a página.
 *
 * COMO FUNCIONA: escuta UPDATE na tabela referrals filtrado por referrer_id = meu profile.
 * O Realtime já respeita RLS (o Supabase só entrega linha que eu poderia ler), mas o filtro
 * por referrer_id evita até receber o evento de indicação de terceiros. Só reage quando o
 * status VIRA 'approved' (transição), não a qualquer update — por isso precisa do valor antigo,
 * que vem porque a tabela está com replica identity full.
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

    // O socket precisa do JWT ANTES de assinar, senão o Realtime conecta como anon e o RLS de
    // referrals nega a linha — o canal fica SUBSCRIBED mas nunca entrega nada. Provado: sem
    // setAuth o evento não chega; com ele, chega na hora. Por isso pegamos a sessão primeiro.
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
                description: 'Alguém que você trouxe acabou de ser aprovado. +10 pontos pra você.',
              });
              onNovaRef.current?.();
            }
          },
        )
        .subscribe();
    })();

    return () => {
      if (canal) supabase.removeChannel(canal);
    };
  }, [profile?.id, toast]);
}
