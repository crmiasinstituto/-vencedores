import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Check, X, Loader2, ExternalLink, Clock, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FAIXA_INFO } from '@/maisvencedores/types/member';
import {
  useTreinamentosPendentes,
  type TreinamentoPendente,
} from '@/maisvencedores/hooks/useModeracaoTreinamentos';

/**
 * Fila de aprovação: treinamento publicado por membro entra aqui e não vai ao ar até
 * um admin aprovar. Editar um já aprovado devolve o treinamento para esta fila.
 */
export function FilaModeracaoTreinamentos({ onMudou }: { onMudou?: () => void }) {
  const { pendentes, loading, moderando, moderar } = useTreinamentosPendentes();
  const [recusando, setRecusando] = useState<TreinamentoPendente | null>(null);
  const [motivo, setMotivo] = useState('');

  const aprovar = async (t: TreinamentoPendente) => {
    if (await moderar(t.id, true)) onMudou?.();
  };

  const confirmarRecusa = async () => {
    if (!recusando) return;
    if (await moderar(recusando.id, false, motivo.trim() || undefined)) onMudou?.();
    setRecusando(null);
    setMotivo('');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (pendentes.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50 border-dashed">
        <CardContent className="py-12 text-center space-y-2">
          <Inbox className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
          <p className="font-medium text-foreground">Nada esperando aprovação</p>
          <p className="text-sm text-muted-foreground">
            Treinamento publicado por membro aparece aqui antes de ir ao ar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {pendentes.map((t) => (
          <Card key={t.id} className="bg-card/50 border-gold/20">
            <CardContent className="p-4 flex gap-4">
              {t.thumbnail_url ? (
                <img
                  src={t.thumbnail_url}
                  alt={t.title}
                  className="w-32 h-20 object-cover rounded shrink-0"
                />
              ) : (
                <div className="w-32 h-20 rounded bg-muted/30 shrink-0" />
              )}

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{t.title}</h3>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(t.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">
                  por <strong className="text-foreground">{t.autor_nome || 'Membro'}</strong>
                  {t.autor_faixa && ` · ${FAIXA_INFO[t.autor_faixa]?.nome || t.autor_faixa}`}
                </p>

                {t.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {t.categoria || 'Sem categoria'}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    A partir da {FAIXA_INFO[t.faixa_minima]?.nome || t.faixa_minima}
                  </Badge>
                  {t.duration && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t.duration}
                    </Badge>
                  )}
                  {t.video_url && (
                    <a
                      href={t.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-gold hover:underline inline-flex items-center gap-1"
                    >
                      Ver o vídeo <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() => aprovar(t)}
                  disabled={moderando === t.id}
                >
                  {moderando === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Publicar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setRecusando(t)}
                  disabled={moderando === t.id}
                >
                  <X className="h-3.5 w-3.5" />
                  Recusar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(recusando)} onOpenChange={(o) => !o && setRecusando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar “{recusando?.title}”</DialogTitle>
            <DialogDescription>
              O autor vê o motivo na tela dele e pode corrigir e reenviar. Deixar em branco
              recusa sem explicação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex: o vídeo está privado, ninguém consegue abrir."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarRecusa}>
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
