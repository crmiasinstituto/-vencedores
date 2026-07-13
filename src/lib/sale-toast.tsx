import { toast } from "sonner";
import { PartyPopper } from "lucide-react";
import { playSalesCelebration } from "@/lib/sales-sounds";

interface Sale {
  id: string;
  name: string;
  instagram?: string | null;
  instagram_profile_pic_url?: string | null;
  product_name: string;
  amount: number;
}

// Throttle: se chegarem 5 vendas em 3s, toca o som 1x só (evita cacofonia).
let lastSoundAt = 0;
const SOUND_THROTTLE_MS = 3000;

function maybePlaySound(volume = 0.7) {
  const now = Date.now();
  if (now - lastSoundAt < SOUND_THROTTLE_MS) return;
  lastSoundAt = now;
  playSalesCelebration({ volume });
}

export function showSaleToast(sale: Sale, opts: { volume?: number; durationMs?: number } = {}) {
  maybePlaySound(opts.volume);

  toast.custom(
    () => (
      <div className="flex items-center gap-3 bg-card border-2 border-yellow rounded-xl shadow-lg p-3 min-w-[300px]">
        {sale.instagram_profile_pic_url ? (
          <img
            src={sale.instagram_profile_pic_url}
            alt={sale.name}
            className="w-12 h-12 rounded-full border-2 border-yellow object-cover shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-yellow/20 border-2 border-yellow flex items-center justify-center shrink-0">
            <PartyPopper className="w-6 h-6 text-yellow" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-yellow font-bold text-sm">🎉 NOVA VENDA</span>
          </div>
          <div className="font-semibold text-foreground truncate">{sale.name}</div>
          {sale.instagram && (
            <div className="text-xs text-muted-foreground truncate">@{sale.instagram}</div>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-xs text-muted-foreground truncate">{sale.product_name}</span>
            <span className="text-sm font-bold text-green-500 shrink-0">
              R$ {Number(sale.amount || 0).toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      duration: opts.durationMs ?? 6000,
      position: "top-right",
    },
  );
}
