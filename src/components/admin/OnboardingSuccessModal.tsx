import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Copy, Check, Download, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';

interface OnboardingSuccessModalProps {
  open: boolean;
  onClose: () => void;
  link: string;
  token: string;
}

export function OnboardingSuccessModal({ open, onClose, link, token }: OnboardingSuccessModalProps) {
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && link) {
      generateQRCode();
    }
  }, [open, link]);

  async function generateQRCode() {
    try {
      const dataUrl = await QRCode.toDataURL(link, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error('Erro ao gerar QR Code:', err);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadQRCode() {
    if (!qrCodeDataUrl) return;
    
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `qrcode-${token}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR Code baixado!');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="w-6 h-6" />
            Onboarding Criado com Sucesso!
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* QR Code */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center"
          >
            {qrCodeDataUrl ? (
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <img 
                  src={qrCodeDataUrl} 
                  alt="QR Code do Onboarding" 
                  className="w-48 h-48"
                />
              </div>
            ) : (
              <div className="w-48 h-48 bg-muted rounded-xl flex items-center justify-center">
                <span className="text-muted-foreground">Gerando QR Code...</span>
              </div>
            )}
          </motion.div>

          {/* Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Link do Onboarding:
            </label>
            <div className="flex gap-2">
              <Input 
                value={link} 
                readOnly 
                className="text-xs font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={copyLink}
              className="flex-1 gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copiar Link
            </Button>
            <Button 
              variant="outline" 
              onClick={downloadQRCode}
              disabled={!qrCodeDataUrl}
              className="flex-1 gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar QR Code
            </Button>
          </div>

          <Button 
            onClick={onClose} 
            className="w-full"
          >
            Fechar
          </Button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
