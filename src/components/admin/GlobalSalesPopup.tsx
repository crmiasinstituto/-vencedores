import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playSalesCelebration } from "@/lib/sales-sounds";
import { X, Minimize2, PartyPopper, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Sale {
  id: string;
  name: string;
  instagram?: string | null;
  instagram_profile_pic_url?: string | null;
  product_name: string;
  amount: number;
  created_at: string;
}

const POPUP_DURATION_MS = 8000;
const SOUND_THROTTLE_MS = 3000;

export function GlobalSalesPopup() {
  const [sale, setSale] = useState<Sale | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [queue, setQueue] = useState<Sale[]>([]);
  const lastSoundRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const channel = supabase
      .channel("global-sales-popup")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales_events" },
        (payload) => {
          const s = payload.new as Sale;
          setQueue((prev) => [...prev, s]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (sale || queue.length === 0) return;
    const next = queue[0];
    setQueue((prev) => prev.slice(1));
    setSale(next);
    setMinimized(false);

    if (soundEnabled) {
      const now = Date.now();
      if (now - lastSoundRef.current > SOUND_THROTTLE_MS) {
        lastSoundRef.current = now;
        playSalesCelebration({ volume: 0.6 });
      }
    }

    timerRef.current = setTimeout(() => {
      setSale(null);
    }, POPUP_DURATION_MS);

    return () => clearTimeout(timerRef.current);
  }, [sale, queue, soundEnabled]);

  const dismiss = () => {
    clearTimeout(timerRef.current);
    setSale(null);
  };

  const minimize = () => setMinimized(true);

  const restore = () => {
    setMinimized(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSale(null), POPUP_DURATION_MS);
  };

  return (
    <>
      <AnimatePresence>
        {sale && !minimized && (
          <motion.div
            key={sale.id}
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-[100] w-[340px] rounded-xl border-2 border-yellow bg-card shadow-2xl overflow-hidden"
          >
            <div className="bg-yellow/10 px-4 py-2 flex items-center justify-between">
              <span className="text-yellow font-bold text-sm flex items-center gap-1.5">
                <PartyPopper className="w-4 h-4" /> NOVA VENDA!
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1 rounded hover:bg-yellow/20 text-muted-foreground"
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                <button onClick={minimize} className="p-1 rounded hover:bg-yellow/20 text-muted-foreground">
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={dismiss} className="p-1 rounded hover:bg-yellow/20 text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              {sale.instagram_profile_pic_url ? (
                <img
                  src={sale.instagram_profile_pic_url}
                  alt={sale.name}
                  className="w-14 h-14 rounded-full border-2 border-yellow object-cover shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-yellow/20 border-2 border-yellow flex items-center justify-center shrink-0">
                  <span className="text-2xl font-bold text-yellow">
                    {(sale.name || "?")[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate text-sm">{sale.name}</div>
                {sale.instagram && (
                  <div className="text-xs text-muted-foreground truncate">@{sale.instagram}</div>
                )}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-xs text-muted-foreground truncate">{sale.product_name}</span>
                  <span className="text-base font-bold text-green-500 shrink-0">
                    R$ {Number(sale.amount || 0).toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
            </div>
            <div className="h-1 bg-muted">
              <motion.div
                className="h-full bg-yellow"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: POPUP_DURATION_MS / 1000, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sale && minimized && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={restore}
            className="fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full bg-yellow text-yellow-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
          >
            <PartyPopper className="w-5 h-5" />
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {queue.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
