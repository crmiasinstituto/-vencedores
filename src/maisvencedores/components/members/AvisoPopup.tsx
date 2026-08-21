import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Megaphone } from 'lucide-react';
import { useAvisos } from '@/maisvencedores/hooks/useAvisos';

/**
 * Popup de aviso da comunidade.
 *
 * Mostra UM por vez, o de maior prioridade — empilhar dois modais um sobre o outro é a forma
 * mais rápida de fazer o membro fechar tudo no reflexo, sem ler nenhum.
 */
export function AvisoPopup() {
  const { popups, marcarVisto } = useAvisos();
  const aviso = popups[0];
  if (!aviso) return null;

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) marcarVisto(aviso.id); }}>
      <DialogContent className="max-w-lg overflow-hidden p-0 gap-0">
        {aviso.image_url && (
          <img src={aviso.image_url} alt="" className="w-full h-44 object-cover" />
        )}
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-2 text-gold">
            <Megaphone className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider font-medium">Comunidade</span>
          </div>

          <h2 className="text-xl font-display font-bold text-foreground">{aviso.title}</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{aviso.content}</p>

          <div className="flex items-center gap-2 pt-2">
            {aviso.link_url && (
              <Button variant="gold" asChild className="gap-1">
                <a
                  href={aviso.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => marcarVisto(aviso.id)}
                >
                  {aviso.link_label || 'Saiba mais'}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            )}
            <Button variant="ghost" onClick={() => marcarVisto(aviso.id)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
