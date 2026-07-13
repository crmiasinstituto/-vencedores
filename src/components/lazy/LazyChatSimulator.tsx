import { lazy, Suspense, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Lazy load the chat component
const ChatSimulator = lazy(() => import('@/components/chat/ChatSimulator'));

interface LazyChatSimulatorProps {
  onLeadCapture?: (data: any) => void;
}

export default function LazyChatSimulator({ onLeadCapture }: LazyChatSimulatorProps) {
  const [shouldLoad, setShouldLoad] = useState(false);

  if (!shouldLoad) {
    return (
      <Button
        onClick={() => setShouldLoad(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg hover:scale-110 transition-transform"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Suspense fallback={
      <div className="fixed bottom-6 right-6 z-50">
        <div className="w-14 h-14 rounded-full bg-primary animate-pulse" />
      </div>
    }>
      <ChatSimulator onLeadCapture={onLeadCapture} />
    </Suspense>
  );
}