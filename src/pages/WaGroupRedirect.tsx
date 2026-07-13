/**
 * WaGroupRedirect
 *
 * Rota /g/:slug pra redirecionar cliques de links do WhatsApp (em templates Meta)
 * pra URL real do grupo. Permite ter URL própria no template (squaad.com.br/g/X)
 * em vez de chat.whatsapp.com direto (que Meta bloqueia em botões).
 *
 * Bônus: rastreia click_count e last_click_at via RPC resolve_wa_group_redirect.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function WaGroupRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('slug_missing');
      return;
    }
    (async () => {
      const { data, error: err } = await (supabase.rpc as any)('resolve_wa_group_redirect', {
        p_slug: slug,
      });
      if (err || !data) {
        setError('group_not_found');
        return;
      }
      // Redirect imediato pro grupo
      window.location.replace(data as string);
    })();
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <h1 className="text-2xl font-semibold mb-2">Link inválido</h1>
            <p className="text-zinc-400">
              {error === 'group_not_found'
                ? 'Esse link de grupo não está mais ativo. Fale com quem te enviou.'
                : 'Não conseguimos resolver o link agora. Tente em alguns segundos.'}
            </p>
          </>
        ) : (
          <>
            <div className="inline-block w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
            <h1 className="text-xl font-semibold mb-1">Te levando pro grupo do WhatsApp...</h1>
            <p className="text-zinc-400 text-sm">Se não abrir em 3 segundos, atualiza a página.</p>
          </>
        )}
      </div>
    </div>
  );
}
