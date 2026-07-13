import React from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCallContext } from '@/contexts/CallContext';

export const IncomingCallModal: React.FC = () => {
  const { incomingOffer, showIncomingModal, setShowIncomingModal, answerCall, rejectCall } = useCallContext();

  if (!incomingOffer) return null;

  return (
    <Dialog open={showIncomingModal} onOpenChange={(open) => { if (!open) rejectCall(); }}>
      <DialogContent className="sm:max-w-md bg-gradient-to-b from-[#1a1a2e] to-[#0f3443] border-green-500/30 text-white">
        <div className="flex flex-col items-center py-8 gap-5">
          {/* Animated avatar */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
            <div className="relative">
              {incomingOffer.profilePicture ? (
                <img src={incomingOffer.profilePicture} alt="" className="w-28 h-28 rounded-full object-cover ring-4 ring-green-500/40 animate-bounce" style={{ animationDuration: '2s' }} />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-600/40 to-emerald-700/40 flex items-center justify-center ring-4 ring-green-500/30 animate-bounce" style={{ animationDuration: '2s' }}>
                  <User className="w-14 h-14 text-green-300" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="text-center">
            <p className="text-sm text-green-400 font-medium mb-1">📞 Chamada recebida</p>
            <h3 className="text-2xl font-bold">{incomingOffer.peerName || incomingOffer.peerPhone}</h3>
            {incomingOffer.peerName && (
              <p className="text-sm text-white/50 mt-1">{incomingOffer.peerPhone}</p>
            )}
            {incomingOffer.leadId && (
              <p className="text-xs text-green-300/60 mt-1">Lead encontrado no CRM ✓</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-8 mt-4">
            <Button
              size="lg"
              onClick={rejectCall}
              className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
            <Button
              size="lg"
              onClick={answerCall}
              className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30 animate-pulse"
            >
              <Phone className="w-7 h-7" />
            </Button>
          </div>
          <div className="flex items-center gap-16 text-xs text-white/40">
            <span>Rejeitar</span>
            <span>Atender</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
