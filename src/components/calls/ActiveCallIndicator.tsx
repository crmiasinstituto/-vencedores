import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallContext } from '@/contexts/CallContext';
import { formatDuration } from '@/hooks/useWavoip';

export const ActiveCallIndicator: React.FC = () => {
  const { activeCall, endCall, setShowActiveCallModal } = useCallContext();

  if (!activeCall) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className="flex items-center gap-3 bg-green-600/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-2xl shadow-green-600/30 cursor-pointer hover:bg-green-600 transition-colors"
        onClick={() => setShowActiveCallModal(true)}
      >
        <Phone className="w-4 h-4 animate-pulse" />
        <span className="text-sm font-medium truncate max-w-[150px]">
          {activeCall.peerName || activeCall.peerPhone}
        </span>
        <span className="text-sm font-mono">{formatDuration(activeCall.duration)}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); endCall(); }}
          className="h-7 w-7 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white ml-1"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
