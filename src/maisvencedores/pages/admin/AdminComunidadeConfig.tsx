import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, GraduationCap, Users } from 'lucide-react';
import type { Faixa } from '@/maisvencedores/types/member';
import { FAIXAS, FAIXA_INFO, nivelDaFaixa } from '@/maisvencedores/types/member';
import { useFaixaMinimaPublicar } from '@/maisvencedores/hooks/useComunidadeConfig';

const db = supabase as any;

/**
 * Configurações da comunidade.
 *
 * Existe porque "quem pode publicar treinamento" estava escrito dentro da policy do banco:
 * mudar de marrom para roxo exigiria uma migration. Aqui a decisão é do admin.
 */
export default function AdminComunidadeConfig() {
  const { faixa, loading, salvando, salvar } = useFaixaMinimaPublicar();
  const [contagem, setContagem] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await db.from('profiles').select('faixa');
      const mapa: Record<string, number> = {};
      for (const p of (data || []) as { faixa: Faixa }[]) {
        if (p.faixa) mapa[p.faixa] = (mapa[p.faixa] || 0) + 1;
      }
      setContagem(mapa);
    })();
  }, []);

  // Quantas pessoas a escolha atual alcança — a faixa é hierarquia, então conta da
  // escolhida para cima. Mostrar isso evita liberar para 111 pessoas achando que são 19.
  const alcancados = faixa
    ? FAIXAS.filter((f) => nivelDaFaixa(f) >= nivelDaFaixa(faixa)).reduce(
        (soma, f) => soma + (contagem[f] || 0),
        0,
      )
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Regras da comunidade</p>
      </div>

      <Card className="bg-card/50 border-gold/20 max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-gold" />
            Publicação de treinamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A partir de qual faixa o membro pode subir treinamento na comunidade. Vale da faixa
            escolhida <strong>para cima</strong> — quem sobe de faixa não perde o acesso.
          </p>

          <div className="space-y-2">
            <Label>Faixa mínima para publicar</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : (
              <Select
                value={faixa ?? 'marrom'}
                onValueChange={(v: Faixa) => salvar(v)}
                disabled={salvando}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAIXAS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FAIXA_INFO[f].nome}
                      {contagem[f] ? ` · ${contagem[f]} membro(s)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!loading && (
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 p-3">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm">
                Hoje isso alcança{' '}
                <Badge variant="secondary" className="mx-0.5">
                  {alcancados} membro{alcancados === 1 ? '' : 's'}
                </Badge>
                {faixa && (
                  <>
                    {' '}
                    — {FAIXA_INFO[faixa].nome} e acima.
                  </>
                )}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Quem publica só edita e remove o próprio treinamento. Você continua podendo
            despublicar qualquer um na tela de Treinamentos, onde também aparece o autor de cada
            conteúdo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
