import React from 'react';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCallContext } from '@/contexts/CallContext';

interface CallButtonProps {
  phoneNumber: string;
  leadId?: string;
  showLabel?: boolean;
  size?: 'sm' | 'default' | 'icon';
}

export const CallButton: React.FC<CallButtonProps> = ({ phoneNumber, leadId, showLabel = false, size = 'icon' }) => {
  const { device, deviceLoading, isConnected, activeCall, requestCall } = useCallContext();

  const handleCall = async () => {
    if (!isConnected || activeCall) return;
    // Abre o modal em PENDING — o wavoip so dispara depois que o user
    // escolher um playbook (ou clicar "Sem coach"). Antes a ligacao saia
    // antes do user ter chance de escolher coach, o que causava call
    // sem coach ou interrupcao constante.
    await requestCall(phoneNumber, leadId);
  };

  if (deviceLoading) {
    return (
      <Button size={size} variant="ghost" disabled className="text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (!device) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size={size} variant="ghost" disabled className="text-muted-foreground opacity-50">
            <Phone className="w-4 h-4" />
            {showLabel && <span className="ml-1.5">Ligar</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Configure o WaVoIP nas configurações</TooltipContent>
      </Tooltip>
    );
  }

  if (!isConnected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size={size} variant="ghost" disabled className="text-yellow-500/70">
            <Phone className="w-4 h-4" />
            {showLabel && <span className="ml-1.5">Desconectado</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>WaVoIP desconectado</TooltipContent>
      </Tooltip>
    );
  }

  if (activeCall) {
    return (
      <Button size={size} variant="ghost" disabled className="text-red-400">
        <PhoneOff className="w-4 h-4" />
        {showLabel && <span className="ml-1.5">Em chamada</span>}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size={size} variant="ghost" onClick={handleCall} className="text-green-400 hover:text-green-300 hover:bg-green-500/10">
          <Phone className="w-4 h-4 animate-pulse" />
          {showLabel && <span className="ml-1.5">Ligar</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ligar via WhatsApp</TooltipContent>
    </Tooltip>
  );
};

export const CallButtonIcon: React.FC<{ phoneNumber: string; leadId?: string }> = (props) => (
  <CallButton {...props} size="icon" />
);
