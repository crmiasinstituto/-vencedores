import { useState } from 'react';
import { Bell, Music, Plus, Settings, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManualControlsProps {
  onPlayBell: () => void;
  onPlayF1: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  autoPlay: boolean;
  onAutoPlayChange: (value: boolean) => void;
}

export function ManualControls({ 
  onPlayBell, 
  onPlayF1, 
  volume, 
  onVolumeChange,
  autoPlay,
  onAutoPlayChange
}: ManualControlsProps) {
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    instagram: '',
    product: 'Imersão Do VHS ao Prompt',
    amount: '97'
  });

  const handleSimulateSale = async () => {
    if (!formData.name || !formData.whatsapp) {
      toast.error('Nome e WhatsApp são obrigatórios');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('sales_events')
        .insert({
          name: formData.name,
          whatsapp: formData.whatsapp.replace(/\D/g, ''),
          instagram: formData.instagram || null,
          product_name: formData.product,
          amount: parseFloat(formData.amount),
          source: 'manual',
          payment_method: 'Simulação'
        });

      if (error) throw error;

      toast.success('Venda simulada com sucesso!');
      setIsSimulateOpen(false);
      setFormData({
        name: '',
        whatsapp: '',
        instagram: '',
        product: 'Imersão Do VHS ao Prompt',
        amount: '97'
      });
    } catch (error) {
      console.error('Erro ao simular venda:', error);
      toast.error('Erro ao simular venda');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button 
        onClick={onPlayBell}
        className="bg-yellow text-carbon hover:bg-yellow/90"
      >
        <Bell className="w-4 h-4 mr-2" />
        Tocar Sino
      </Button>

      <Button 
        onClick={onPlayF1}
        variant="outline"
        className="border-yellow text-yellow hover:bg-yellow/10"
      >
        <Music className="w-4 h-4 mr-2" />
        Tocar F1
      </Button>

      <Dialog open={isSimulateOpen} onOpenChange={setIsSimulateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Simular Venda
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simular Venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Comprador *</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="João Silva"
              />
            </div>
            <div>
              <Label>WhatsApp *</Label>
              <Input 
                value={formData.whatsapp}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="11999999999"
              />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input 
                value={formData.instagram}
                onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                placeholder="@usuario"
              />
            </div>
            <div>
              <Label>Produto</Label>
              <Input 
                value={formData.product}
                onChange={(e) => setFormData(prev => ({ ...prev, product: e.target.value }))}
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input 
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <Button 
              onClick={handleSimulateSale} 
              className="w-full bg-yellow text-carbon hover:bg-yellow/90"
              disabled={isLoading}
            >
              {isLoading ? 'Simulando...' : 'Simular Venda'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações de Áudio</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                Volume: {Math.round(volume * 100)}%
              </Label>
              <Slider
                value={[volume * 100]}
                onValueChange={([val]) => onVolumeChange(val / 100)}
                max={100}
                step={5}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-play ao receber venda</Label>
              <Switch
                checked={autoPlay}
                onCheckedChange={onAutoPlayChange}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
