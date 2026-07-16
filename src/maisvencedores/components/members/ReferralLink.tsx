import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, QrCode, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReferralLinkProps {
  referralCode: string;
}

export function ReferralLink({ referralCode }: ReferralLinkProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  // /i/ e o link RASTREADO: ele registra o clique e so entao manda pro cadastro. Antes isto
  // apontava pra /convite/:code — rota que nao existe desde que o portal virou
  // /maisvencedores/*, entao o link do membro dava 404.
  const referralUrl = `${window.location.origin}/i/${referralCode}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast({ title: 'Link copiado!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Convite + que Vencedores',
          text: 'Junte-se ao + que Vencedores comigo!',
          url: referralUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Seu Link de Indicação</h3>
        <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded-full font-medium">
          {referralCode}
        </span>
      </div>
      
      <div className="flex gap-2">
        <Input 
          value={referralUrl} 
          readOnly 
          className="bg-background text-sm"
        />
        <Button variant="outline" size="icon" onClick={copyToClipboard}>
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="gold" className="flex-1" onClick={shareLink}>
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar
        </Button>
        <Button variant="outline" size="icon">
          <QrCode className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Cada indicação que se cadastrar usando seu link vale 10 pontos no ranking!
      </p>
    </div>
  );
}
