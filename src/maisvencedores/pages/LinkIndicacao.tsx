import { useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * O link rastreado de indicação: /i/<codigo>[?d=<destino>]
 *
 * É a porta única de toda indicação do ecossistema. O membro compartilha SEMPRE este link;
 * o destino é que muda:
 *
 *   /i/ABC123            -> cadastro do + que Vencedores
 *   /i/ABC123?d=rpx10x   -> Reprograme-se 10X
 *
 * Um código, vários destinos. É o que o Carlos pediu: "quando gerar link de qualquer
 * indicação, tanto de Reprograme-se quanto do +vencedores, você tem que rastrear".
 *
 * O que acontece aqui:
 *   1. registra o clique (referral_clicks, via RPC SECURITY DEFINER — anon não escreve direto)
 *   2. guarda o código no localStorage, porque a compra pode acontecer dias depois
 *   3. redireciona pro destino
 *
 * O passo 3 NÃO espera o passo 1: rastreio nunca pode segurar a pessoa na frente de uma tela
 * branca. Se a chamada falhar, perdemos um clique — não a visita.
 */

const CHAVE_ATRIBUICAO = 'mv_indicacao';
const VALIDADE_DIAS = 90;

/**
 * Onde este destino leva, já com o código no parâmetro certo.
 *
 * Quem responde é o banco (checkout_destinos), não um switch aqui: cada gateway carrega o
 * rastreio num parâmetro diferente (Hotmart usa `src`, Eduzz e Kirvano usam `utm_source`), e
 * vai entrar checkout novo depois. Com isso, cadastrar um destino é inserir uma linha — não
 * mexer neste arquivo e fazer deploy.
 */
async function resolverDestino(destino: string, codigo: string): Promise<string> {
  const { data, error } = await supabase.rpc('resolver_destino_indicacao', {
    p_codigo: codigo,
    p_slug: destino,
  });

  // Falhou a consulta? A pessoa clicou num link e tem que chegar em algum lugar. O cadastro é
  // o destino padrão, e o clique já foi registrado de qualquer forma.
  if (error || !data) {
    console.error('Falha ao resolver destino da indicação:', error);
    return `/maisvencedores/convite/${codigo}`;
  }

  return (data as { url: string }).url;
}

export function guardarAtribuicao(codigo: string, destino: string) {
  try {
    localStorage.setItem(
      CHAVE_ATRIBUICAO,
      JSON.stringify({ codigo, destino, em: Date.now() }),
    );
  } catch {
    /* modo anônimo / storage cheio: segue sem atribuição */
  }
}

/** O código guardado, se ainda dentro da janela. Usado no cadastro. */
export function lerAtribuicao(): string | null {
  try {
    const cru = localStorage.getItem(CHAVE_ATRIBUICAO);
    if (!cru) return null;
    const { codigo, em } = JSON.parse(cru);
    if (!codigo || !em) return null;
    if (Date.now() - em > VALIDADE_DIAS * 24 * 60 * 60 * 1000) return null;
    return codigo as string;
  } catch {
    return null;
  }
}

export default function LinkIndicacao() {
  const { codigo } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // StrictMode monta duas vezes em dev; sem isto o clique entra duplicado.
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;

    if (!codigo) {
      navigate('/maisvencedores', { replace: true });
      return;
    }

    const destino = searchParams.get('d') || 'maisvencedores';
    guardarAtribuicao(codigo, destino);

    // Dispara e segue: não damos await antes de redirecionar.
    const utm: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      if (k.startsWith('utm_')) utm[k] = v;
    });

    supabase
      .rpc('registrar_clique_indicacao', {
        p_codigo: codigo,
        p_destino: destino,
        p_referer: document.referrer || null,
        p_utm: Object.keys(utm).length ? utm : null,
      })
      .then(({ error }) => {
        if (error) console.error('Falha ao registrar clique de indicação:', error);
      });

    resolverDestino(destino, codigo).then((alvo) => {
      if (alvo.startsWith('http')) {
        window.location.replace(alvo);
      } else {
        navigate(alvo, { replace: true });
      }
    });
  }, [codigo, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </div>
  );
}
