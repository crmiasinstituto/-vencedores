import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Polaroid } from "@/components/disc/Polaroid";
import { MilestoneOverlay } from "@/components/disc/MilestoneOverlay";
import { VictoriaOverlay } from "@/components/disc/VictoriaOverlay";

interface MuralLead {
  id: string;
  name: string;
  profile_pic_url: string | null;
  created_at: string;
  instagram: string | null;
  is_member: boolean;
}

interface PositionedLead extends MuralLead {
  x: number;
  y: number;
  rotation: number;
  size: number;
  fresh: boolean;
}

const VICTORIA_HANDLE = "victoriacoutinh0";

const MAX_POLAROIDS = 120;

function seededRand(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return ((h >>> 0) % 10_000) / 10_000;
  };
}

function densityForCount(n: number): number {
  if (n <= 6) return 0.13;     // poucos: maiores e centralizados
  if (n <= 20) return 0.10;
  if (n <= 40) return 0.085;
  if (n <= 70) return 0.07;
  if (n <= 110) return 0.055;
  return 0.045;
}

// Gera ordem em espiral a partir do centro: 0 = centro, 1 = direita, 2 = baixo-direita...
function spiralCells(cols: number, rows: number): { col: number; row: number }[] {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const cells: { col: number; row: number; dist: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = c - cx;
      const dy = r - cy;
      cells.push({ col: c, row: r, dist: dx * dx + dy * dy });
    }
  }
  cells.sort((a, b) => a.dist - b.dist);
  return cells.map(({ col, row }) => ({ col, row }));
}

function layout(leads: MuralLead[], areaW: number, areaH: number): PositionedLead[] {
  if (areaW === 0 || areaH === 0) return [];
  const density = densityForCount(leads.length);
  const size = Math.max(80, areaW * density);
  const polaroidH = size * 1.2;
  const cellW = size * 1.08;
  const cellH = polaroidH * 1.08;
  const cols = Math.max(2, Math.floor(areaW / cellW));
  const rows = Math.max(2, Math.floor(areaH / cellH));
  const order = spiralCells(cols, rows);
  const usableCells = order.length;
  const visible = leads.slice(0, Math.min(leads.length, usableCells, MAX_POLAROIDS));

  // Offsets pra centralizar o "bloco" usado no meio da área
  const gridW = cols * cellW;
  const gridH = rows * cellH;
  const offsetX = (areaW - gridW) / 2;
  const offsetY = (areaH - gridH) / 2;

  return visible.map((lead, idx) => {
    const rand = seededRand(lead.id);
    const cell = order[idx] || order[0];
    const baseX = offsetX + cell.col * cellW + (cellW - size) / 2;
    const baseY = offsetY + cell.row * cellH + (cellH - polaroidH) / 2;
    const jitterX = (rand() - 0.5) * cellW * 0.18;
    const jitterY = (rand() - 0.5) * cellH * 0.14;
    const rotation = (rand() - 0.5) * 14; // -7 a +7
    return {
      ...lead,
      x: baseX + jitterX,
      y: baseY + jitterY,
      rotation,
      size,
      fresh: false,
    };
  });
}

export default function ReprogrameTelao() {
  const [leads, setLeads] = useState<MuralLead[]>([]);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(true);
  const [gridMode, setGridMode] = useState(false);
  const [areaSize, setAreaSize] = useState({ w: 0, h: 0 });
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [victoriaActive, setVictoriaActive] = useState(false);
  const areaRef = useRef<HTMLDivElement | null>(null);
  // Phones dos alunos (10 últimos dígitos) pra detectar mentorados
  const memberPhonesRef = useRef<Set<string>>(new Set());
  // Fila de leads "frescos" pra animar 1 de cada vez (evita embolar quando vários chegam juntos)
  const freshQueueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const processQueueRef = useRef<(() => void) | null>(null);
  const victoriaShownRef = useRef<Set<string>>(new Set());

  // Processa a fila de freshIds: 1 polaroid grande no centro por vez (~2.2s cada)
  // Se for a Victoria, dispara overlay "Te amo meu Amor" antes (10s) e só depois mostra a polaroid.
  const processQueue = useCallback(() => {
    if (processingRef.current) return;
    const next = freshQueueRef.current.shift();
    if (!next) return;
    processingRef.current = true;

    setLeads((prev) => {
      const lead = prev.find((l) => l.id === next);
      const isVictoria =
        lead?.instagram?.toLowerCase() === VICTORIA_HANDLE &&
        !victoriaShownRef.current.has(next);

      if (isVictoria) {
        victoriaShownRef.current.add(next);
        setVictoriaActive(true);
        // 10s do overlay, depois mostra a polaroid normal
        setTimeout(() => {
          setVictoriaActive(false);
          setFreshId(next);
          setTimeout(() => {
            setFreshId(null);
            setTimeout(() => {
              processingRef.current = false;
              if (freshQueueRef.current.length > 0) processQueue();
            }, 250);
          }, 2200);
        }, 10_000);
      } else {
        setFreshId(next);
        setTimeout(() => {
          setFreshId(null);
          setTimeout(() => {
            processingRef.current = false;
            if (freshQueueRef.current.length > 0) processQueue();
          }, 250);
        }, 2200);
      }

      return prev;
    });
  }, []);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  // Carrega lista de phones de members 1x no boot (refresh a cada 5 min)
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await (supabase as any).from("members").select("phone");
      const set = new Set<string>();
      for (const m of data || []) {
        if (!m?.phone) continue;
        const clean = String(m.phone).replace(/\D/g, "");
        if (clean.length >= 10) set.add(clean.slice(-10));
      }
      memberPhonesRef.current = set;
    };
    fetchMembers();
    const t = setInterval(fetchMembers, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // QR code estático apontando pra /r10x
  // Usa VITE_R10X_PUBLIC_URL (domínio público, ex: https://crm.squaad.com.br)
  // Cai pro window.origin apenas se não estiver definida — necessário porque celular
  // não consegue acessar localhost.
  useEffect(() => {
    const envBase = (import.meta.env.VITE_R10X_PUBLIC_URL || "").replace(/\/$/, "");
    const baseUrl =
      envBase ||
      (typeof window !== "undefined" && window.location.origin) ||
      "https://squaad.com.br";
    QRCode.toDataURL(`${baseUrl}/r10x`, {
      width: 900,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    }).then(setQrDataUrl).catch(() => {});
  }, []);

  // Carregar leads iniciais
  // Cast `as any` porque os campos `evento`/`authorized_mural` foram adicionados
  // via migration nova e ainda não constam em src/integrations/supabase/types.ts.
  const loadLeads = useCallback(async (markNewAsFresh: boolean) => {
    const { data, error } = await (supabase as any)
      .from("crm_leads")
      .select("id, name, instagram, whatsapp, instagram_profile_pic_url, created_at")
      .eq("evento", "reprograme-se-10x")
      .eq("authorized_mural", true)
      .order("created_at", { ascending: false })
      .limit(MAX_POLAROIDS);
    if (error) {
      console.error("[telao] load error", error);
      return;
    }
    const phones = memberPhonesRef.current;
    const incoming: MuralLead[] = (data || []).map((r: any) => {
      const last10 = String(r.whatsapp || "").replace(/\D/g, "").slice(-10);
      return {
        id: r.id,
        name: r.name,
        instagram: r.instagram || null,
        profile_pic_url: r.instagram_profile_pic_url,
        created_at: r.created_at,
        is_member: last10.length === 10 && phones.has(last10),
      };
    });
    setLeads((prev) => {
      if (markNewAsFresh && prev.length > 0) {
        const prevIds = new Set(prev.map((l) => l.id));
        const novos = incoming.filter((l) => !prevIds.has(l.id));
        // Enfileira do mais antigo pro mais novo pra ordem correta
        for (let i = novos.length - 1; i >= 0; i--) {
          const id = novos[i].id;
          if (!freshQueueRef.current.includes(id)) {
            freshQueueRef.current.push(id);
          }
        }
        if (novos.length > 0) processQueueRef.current?.();
      }
      return incoming;
    });
  }, []);

  const loadInitial = useCallback(() => loadLeads(false), [loadLeads]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Realtime — INSERT e UPDATE no mesmo handler pra evitar explosão de tipos
  useEffect(() => {
    const channel = supabase
      .channel("disc-mural-r10x")
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "crm_leads",
          filter: "evento=eq.reprograme-se-10x",
        },
        (payload: any) => {
          const eventType = payload.eventType || payload.event;
          const row = payload.new;
          if (!row) return;

          const phones = memberPhonesRef.current;
          const last10 = String(row.whatsapp || "").replace(/\D/g, "").slice(-10);
          const mkLead = (): MuralLead => ({
            id: row.id,
            name: row.name,
            instagram: row.instagram || null,
            profile_pic_url: row.instagram_profile_pic_url,
            created_at: row.created_at,
            is_member: last10.length === 10 && phones.has(last10),
          });

          if (eventType === "INSERT") {
            if (!row.authorized_mural) return;
            setLeads((prev) => {
              if (prev.some((l) => l.id === row.id)) return prev;
              return [mkLead(), ...prev];
            });
            if (!freshQueueRef.current.includes(row.id)) {
              freshQueueRef.current.push(row.id);
              processQueueRef.current?.();
            }
          } else if (eventType === "UPDATE") {
            setLeads((prev) => {
              const exists = prev.some((l) => l.id === row.id);
              if (!row.authorized_mural) return prev.filter((l) => l.id !== row.id);
              if (exists) {
                return prev.map((l) =>
                  l.id === row.id ? { ...l, ...mkLead() } : l,
                );
              }
              return [mkLead(), ...prev];
            });
          } else if (eventType === "DELETE") {
            const oldId = (payload.old || {}).id;
            if (oldId) setLeads((prev) => prev.filter((l) => l.id !== oldId));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Polling fallback (a cada 4s) — garante telão atualizado mesmo se WS cair
  useEffect(() => {
    const t = setInterval(() => {
      loadLeads(true);
    }, 4000);
    return () => clearInterval(t);
  }, [loadLeads]);

  // Detecta se está rodando dentro de iframe (modo "embed" na apresentação)
  const isEmbedded = typeof window !== "undefined" && window.self !== window.top;

  // Fullscreen + atalhos (atalhos só funcionam quando o telão é a janela principal)
  useEffect(() => {
    if (isEmbedded) return; // dentro da apresentação, atalhos pertencem ao slide host
    const enterFs = () => {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") setGridMode((v) => !v);
      else if (e.key === "r" || e.key === "R") loadInitial();
      else if (e.key === "h" || e.key === "H") setQrVisible((v) => !v);
      else if (e.key === "Enter") enterFs();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [loadInitial, isEmbedded]);

  // Medir área do mural
  useEffect(() => {
    const measure = () => {
      if (areaRef.current) {
        const r = areaRef.current.getBoundingClientRect();
        setAreaSize({ w: r.width, h: r.height });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [qrVisible]);

  const positioned = useMemo(
    () => layout(leads, areaSize.w, areaSize.h),
    [leads, areaSize],
  );

  const positionedFinal: PositionedLead[] = useMemo(() => {
    if (!gridMode) return positioned;
    // Modo grid alinhado: zera rotações
    return positioned.map((p) => ({ ...p, rotation: 0 }));
  }, [positioned, gridMode]);

  return (
    <>
      <Helmet>
        <title>Mural · Reprograme-se 10X</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Playfair+Display:ital,wght@1,500;1,600&display=swap"
          rel="stylesheet"
        />
      </Helmet>
      <div className="h-screen w-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white flex flex-col overflow-hidden select-none relative">
        <MilestoneOverlay count={leads.length} />
        <VictoriaOverlay active={victoriaActive} />
        {/* Top bar */}
        <header className="px-10 pt-6 flex items-center justify-between flex-shrink-0">
          <img
            src="/squaad-logo.png"
            alt="+ que Vencedores"
            className="h-12 w-auto object-contain"
            draggable={false}
          />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Evento ao vivo</p>
            <p className="text-base uppercase tracking-[0.28em] text-zinc-200 font-medium mt-1">
              Reprograme-se 10X · 2026
            </p>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 flex min-h-0 px-6 pt-4 pb-2 gap-6">
          {/* Mural */}
          <div
            ref={areaRef}
            className={`relative flex-1 min-h-0 rounded-2xl bg-zinc-950/40 border border-zinc-800/50 overflow-hidden ${
              qrVisible ? "" : ""
            }`}
            style={{ flexBasis: qrVisible ? "70%" : "100%" }}
          >
            <AnimatePresence>
              {positionedFinal.map((p) => {
                const isFresh = p.id === freshId;
                // Tamanho que a polaroid terá durante a "exibição grande" no centro
                const bigScale = Math.min(
                  3.2,
                  Math.max(1.8, (areaSize.h * 0.5) / (p.size * 1.2)),
                );
                const centerX = areaSize.w / 2 - p.size / 2;
                const centerY = areaSize.h / 2 - (p.size * 1.2) / 2;

                if (isFresh) {
                  // Sequência: aparece no centro grande → segura ~1.4s → desliza e encolhe pra posição final
                  return (
                    <motion.div
                      key={p.id}
                      initial={{
                        left: centerX,
                        top: centerY,
                        scale: 0,
                        opacity: 0,
                        zIndex: 30,
                      }}
                      animate={{
                        left:    [centerX, centerX, centerX, p.x],
                        top:     [centerY, centerY, centerY, p.y],
                        scale:   [0,       bigScale, bigScale, 1],
                        opacity: [0,       1,        1,        1],
                      }}
                      transition={{
                        duration: 2.2,
                        times: [0, 0.18, 0.6, 1],
                        ease: ["easeOut", "linear", "easeInOut"],
                      }}
                      exit={{ scale: 0, opacity: 0 }}
                      style={{ position: "absolute" }}
                    >
                      <Polaroid
                        primeiroNome={(p.name || "").split(" ")[0] || "Você"}
                        profilePicUrl={p.profile_pic_url}
                        rotation={p.rotation}
                        size={p.size}
                        fresh={true}
                        isMember={p.is_member}
                      />
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={p.id}
                    initial={false}
                    animate={{ left: p.x, top: p.y, scale: 1, opacity: 1, zIndex: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 24 }}
                    style={{ position: "absolute" }}
                  >
                    <Polaroid
                      primeiroNome={(p.name || "").split(" ")[0] || "Você"}
                      profilePicUrl={p.profile_pic_url}
                      rotation={p.rotation}
                      size={p.size}
                      fresh={false}
                      isMember={p.is_member}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {leads.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-2xl font-light">
                Aguardando os primeiros prósperos...
              </div>
            )}
          </div>

          {/* QR Code */}
          {qrVisible && (
            <aside
              style={{ flexBasis: "30%" }}
              className="flex flex-col items-center justify-center text-center gap-6"
            >
              <div className="bg-white p-2 rounded-2xl shadow-[0_30px_80px_-10px_rgba(250,200,0,0.25)] ring-1 ring-white/10">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-[min(21vw,340px)] h-auto block"
                  />
                )}
              </div>
              <div className="px-2">
                <p className="text-3xl font-bold leading-tight tracking-tight">
                  ESCANEIE E DESCUBRA<br />
                  <span className="text-[#3B82F6]">SEU PERFIL</span>
                </p>
                <p className="text-sm text-zinc-400 mt-3 tracking-wide">
                  Análise DISC + IA · 90 segundos
                </p>
                <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#3B82F6]/45 bg-[#3B82F6]/8">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="#3B82F6" aria-hidden="true">
                    <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm10 2c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3h10zm-5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm5.5-1.25a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                  </svg>
                  <span className="font-bold tracking-tight text-[#3B82F6]" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.02em' }}>
                    @carloseduardo.ia
                  </span>
                </div>
              </div>
            </aside>
          )}
        </main>

        {/* Footer premium */}
        <footer className="relative flex-shrink-0 px-12 pb-7 pt-5">
          {/* Linha divisória dourada com fade */}
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#3B82F6]/50 to-transparent" />

          <div className="flex items-center justify-between gap-6">
            {/* Contador à esquerda */}
            <div className="flex items-baseline gap-4">
              <motion.span
                key={leads.length}
                initial={{ scale: 1.2, color: "#3B82F6" }}
                animate={{ scale: 1, color: "#3B82F6" }}
                transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
                className="text-6xl font-black tabular-nums tracking-tight leading-none"
                style={{ textShadow: "0 0 40px rgba(250,200,0,0.3)" }}
              >
                {String(leads.length).padStart(2, "0")}
              </motion.span>
              <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                  Já participaram
                </p>
                <p className="text-base uppercase tracking-[0.18em] text-zinc-200 font-medium">
                  Pessoas Prósperas
                </p>
              </div>
            </div>

            {/* Mantra ao centro/direita em itálico */}
            <div className="text-right max-w-md">
              <p
                className="text-2xl text-white/90 italic leading-snug"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                "Eu sou próspero, capaz e abundante"
              </p>
              <p className="text-[11px] uppercase tracking-[0.4em] text-[#3B82F6]/80 mt-2 font-medium">
                #Reprograme10X
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
