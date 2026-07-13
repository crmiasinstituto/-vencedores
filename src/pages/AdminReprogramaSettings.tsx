import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Trash2, RefreshCw, ExternalLink, Heart, GraduationCap, Sparkles, Users, EyeOff, Eye, Mic2, Copy, Check, ShieldAlert, ShieldOff, ShieldCheck,
} from "lucide-react";
import { WhatsAppHealthPanel } from "@/components/admin/WhatsAppHealthPanel";

const CERIMONIALISTA_BIOS: { id: string; label: string; duration: string; text: string }[] = [
  {
    id: "ultracurta",
    label: "Versão ultracurta · ~20s",
    duration: "20 segundos",
    text:
      "Empresário, fundador da + que Vencedores — o esquadrão de IA que automatiza negócios 24h. Começou aos 15 anos como operador de máquina, foi o menor aprendiz contratado pela Pirelli na América Latina e hoje ajuda empresas a faturarem mais com IA aplicada. Recebam, com muita energia, Carlos Eduardo!",
  },
  {
    id: "curta",
    label: "Versão curta · ~40s (recomendada)",
    duration: "40 segundos",
    text:
      "Aos 15 anos, começou como operador de máquina copiadora. Aos 17, virou o menor aprendiz contratado pela Pirelli em toda a América Latina. Aos 23, fundou junto com a irmã o que viria a ser a TuttiBelle, e nunca mais parou. Hoje é o fundador da + que Vencedores — o esquadrão de Inteligência Artificial que automatiza negócios 24 horas por dia — e ajuda empresários a transformarem IA em receita recorrente. Vocês estão prestes a viver uma palestra que vai mudar o jeito que você enxerga IA pra sempre. Recebam, com muita energia, Carlos Eduardo!",
  },
  {
    id: "padrao",
    label: "Versão padrão · ~1min",
    duration: "1 minuto",
    text:
      "O nosso próximo convidado começou cedo — aos 15 anos era operador de máquina copiadora. Aos 17, foi selecionado como o menor aprendiz contratado pela Pirelli em toda a América Latina. Aos 23, fundou com a irmã, Ana Kariny, a TuttiBelle, que rapidamente entrou em fase de crescimento real. Pouco depois, deixou a Pirelli pra empreender de corpo e alma — e em poucos anos aposentou os próprios pais. Hoje é o fundador da + que Vencedores, o esquadrão de Inteligência Artificial que automatiza negócios 24 horas por dia, e mentor de dezenas de empresários que estão usando IA pra escalar com método. Em poucos minutos, você vai viver uma palestra que vai te mostrar, na prática, como reprogramar o seu negócio em 10 vezes. Recebam, com muita energia, Carlos Eduardo!",
  },
];

// Catálogo de slides que podem ser ocultados via painel.
// O `id` deve casar com o id="..." do slide em public/apresentacoes/reprograme-10x.html
// (e o slide precisa ter `data-toggleable-label` no HTML também, pra a apresentação
// saber que ele é controlado por config).
const TOGGLEABLE_SLIDES: { id: string; label: string; hint: string }[] = [
  {
    id: "slide-masterclass",
    label: "Masterclass · CTA preço (R$ 47 / 100 vagas)",
    hint: "Oculto por padrão — vira o creative do WhatsApp recovery pra leads que não compraram em 20min.",
  },
  {
    id: "slide-estudo-caso",
    label: "Estudo de caso · Clínica (ANTES/DEPOIS)",
    hint: "Oculto por padrão — reativa quando quiser usar pra prova social.",
  },
];

interface MuralLead {
  id: string;
  name: string;
  instagram: string;
  whatsapp: string;
  instagram_profile_pic_url: string | null;
  authorized_mural: boolean;
  disc_profile: string | null;
  created_at: string;
  is_member?: boolean;
}

const EVENTO = "reprograme-se-10x";

export default function AdminReprogramaSettings() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<MuralLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberPhones, setMemberPhones] = useState<Set<string>>(new Set());
  const [hiddenSlideIds, setHiddenSlideIds] = useState<Set<string>>(new Set());
  const [savingSlides, setSavingSlides] = useState(false);
  const [copiedBioId, setCopiedBioId] = useState<string | null>(null);
  const [rateLimitDisabled, setRateLimitDisabled] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<string | null>(null);
  const [savingRateLimit, setSavingRateLimit] = useState(false);
  const [rateLimitWindowCount, setRateLimitWindowCount] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function copyBio(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBioId(id);
      setTimeout(() => setCopiedBioId((prev) => (prev === id ? null : prev)), 2000);
      toast({ title: "Copiado!", description: "Cola no WhatsApp da cerimonialista." });
    } catch {
      toast({ title: "Falha ao copiar", description: "Seleciona o texto manualmente.", variant: "destructive" });
    }
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const [leadsRes, membersRes, settingsAllRes, rlWindowRes] = await Promise.all([
        (supabase as any)
          .from("crm_leads")
          .select("id, name, instagram, whatsapp, instagram_profile_pic_url, authorized_mural, disc_profile, created_at")
          .eq("evento", EVENTO)
          .order("created_at", { ascending: false }),
        (supabase as any).from("members").select("phone, status"),
        (supabase as any).from("r10x_settings").select("key, value").in("key", [
          "hidden_slide_ids",
          "disc_rate_limit_disabled",
          "disc_rate_limit_disabled_until",
        ]),
        (supabase as any).from("disc_rate_limits").select("id", { count: "exact", head: true }).gte("created_at", oneMinuteAgo),
      ]);

      const settingsMap = new Map((settingsAllRes?.data || []).map((r: any) => [r.key, r.value]));
      const rawHidden = (settingsMap.get("hidden_slide_ids") as string[] | undefined) || [];
      setHiddenSlideIds(new Set(rawHidden));
      setRateLimitDisabled(settingsMap.get("disc_rate_limit_disabled") === true);
      const u = settingsMap.get("disc_rate_limit_disabled_until");
      setRateLimitUntil(u ? String(u) : null);
      setRateLimitWindowCount(rlWindowRes?.count || 0);

      const phones = new Set<string>();
      for (const m of membersRes.data || []) {
        if (!m?.phone) continue;
        const clean = String(m.phone).replace(/\D/g, "");
        if (clean.length >= 10) phones.add(clean.slice(-10)); // 10 últimos dígitos
      }
      setMemberPhones(phones);

      const enriched: MuralLead[] = (leadsRes.data || []).map((l: MuralLead) => {
        const last10 = (l.whatsapp || "").replace(/\D/g, "").slice(-10);
        return { ...l, is_member: phones.has(last10) };
      });
      setLeads(enriched);
    } catch (e: any) {
      toast({ title: "Erro ao carregar leads", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function clearMural() {
    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("crm_leads")
        .update({ authorized_mural: false, updated_at: new Date().toISOString() })
        .eq("evento", EVENTO)
        .eq("authorized_mural", true);
      if (error) throw error;
      toast({ title: "Mural zerado", description: "Leads preservados, apenas ocultos do telao." });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Falha ao limpar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteOne(id: string) {
    const { error } = await (supabase as any)
      .from("crm_leads")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Falha", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  async function disableRateLimitFor(hours: number) {
    setSavingRateLimit(true);
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const updates = [
      { key: "disc_rate_limit_disabled", value: true, updated_at: new Date().toISOString() },
      { key: "disc_rate_limit_disabled_until", value: until, updated_at: new Date().toISOString() },
    ];
    const { error } = await (supabase as any)
      .from("r10x_settings")
      .upsert(updates, { onConflict: "key" });
    setSavingRateLimit(false);
    if (error) {
      toast({ title: "Falha", description: error.message, variant: "destructive" });
      return;
    }
    setRateLimitDisabled(true);
    setRateLimitUntil(until);
    toast({
      title: `Rate limit DESLIGADO por ${hours}h`,
      description: `Religa automaticamente em ${hours} hora${hours > 1 ? "s" : ""}. Banner amarelo vai aparecer em todas as páginas admin até lá.`,
    });
  }

  async function reenableRateLimit() {
    setSavingRateLimit(true);
    const { error } = await (supabase as any)
      .from("r10x_settings")
      .upsert(
        { key: "disc_rate_limit_disabled", value: false, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSavingRateLimit(false);
    if (error) {
      toast({ title: "Falha", description: error.message, variant: "destructive" });
      return;
    }
    setRateLimitDisabled(false);
    setRateLimitUntil(null);
    toast({ title: "Rate limit ATIVADO", description: "Anti-abuse de 5/min por IP voltou." });
  }

  function fmtRemaining(): string {
    if (!rateLimitUntil) return "sem expiração";
    const ms = new Date(rateLimitUntil).getTime() - nowTick;
    if (ms <= 0) return "expirado (vai religar na próxima request)";
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}min restantes`;
    return `${h}h ${m.toString().padStart(2, "0")}min restantes`;
  }

  const isEffectivelyDisabled =
    rateLimitDisabled && (!rateLimitUntil || new Date(rateLimitUntil).getTime() > nowTick);

  async function clearRateLimits() {
    const { error } = await (supabase as any).from("disc_rate_limits").delete().gte("created_at", "1970-01-01");
    if (error) {
      toast({ title: "Falha", description: error.message, variant: "destructive" });
      return;
    }
    setRateLimitWindowCount(0);
    toast({ title: "Tabela limpa", description: "Histórico de rate limit zerado." });
  }

  async function toggleSlideHidden(slideId: string) {
    setSavingSlides(true);
    const next = new Set(hiddenSlideIds);
    if (next.has(slideId)) next.delete(slideId);
    else next.add(slideId);
    const arr = Array.from(next);
    const { error } = await (supabase as any)
      .from("r10x_settings")
      .upsert({ key: "hidden_slide_ids", value: arr, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSavingSlides(false);
    if (error) {
      toast({ title: "Falha ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setHiddenSlideIds(next);
    toast({
      title: next.has(slideId) ? "Slide ocultado" : "Slide reativado",
      description: "Recarregue a apresentação pra ver o efeito.",
    });
  }

  async function toggleMural(lead: MuralLead) {
    const { error } = await (supabase as any)
      .from("crm_leads")
      .update({ authorized_mural: !lead.authorized_mural })
      .eq("id", lead.id);
    if (error) {
      toast({ title: "Falha", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, authorized_mural: !lead.authorized_mural } : l));
  }

  const memberCount = leads.filter((l) => l.is_member).length;
  const muralCount = leads.filter((l) => l.authorized_mural).length;

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
            Palestras / Apresentação
          </p>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-[#3B82F6]" />
            Reprograme-se 10X
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de leads, mural ao vivo e easter eggs do evento.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/telao", "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" /> Abrir /telao
          </Button>
          <Button variant="outline" onClick={() => window.open("/apresentacoes/reprograme-10x.html", "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" /> Abrir apresentação
          </Button>
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Total leads</div>
          <div className="text-3xl font-bold mt-1">{leads.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">No mural</div>
          <div className="text-3xl font-bold mt-1 text-[#3B82F6]">{muralCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Mentorados</div>
          <div className="text-3xl font-bold mt-1 text-emerald-400">{memberCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Marcos</div>
          <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
            10 · 15 · 30 · 45 · 60 · 80 · 110 · 145 · 160 · 200 · 300
          </div>
        </div>
      </div>

      {/* Easter eggs */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-400" />
          Easter eggs
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configurações especiais que rodam automaticamente no mural durante o evento.
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex items-start gap-3 p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
            <Heart className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">"Te amo meu Amor" para @victoriacoutinh0</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Quando esse handle aparecer no mural, vai mostrar overlay romântico por ~10s antes da polaroid surgir. Ativo automaticamente.
              </div>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <GraduationCap className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Selo MENTORADO nos alunos</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Leads cujo whatsapp coincide com algum aluno da área de membros ganham selo dourado MENTORADO na polaroid. Ativo automaticamente.
              </div>
            </div>
          </li>
        </ul>
      </section>

      {/* Apresentação pessoal pra cerimonialista */}
      <section className="rounded-xl border border-[#3B82F6]/25 bg-[#3B82F6]/5 p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mic2 className="w-4 h-4 text-[#3B82F6]" />
          Apresentação pra cerimonialista
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          3 versões prontas pra mandar pra quem vai te chamar no palco. Clica em copiar e cola no WhatsApp.
        </p>
        <div className="mt-4 space-y-3">
          {CERIMONIALISTA_BIOS.map((bio) => (
            <div key={bio.id} className="rounded-lg border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-sm font-medium">{bio.label}</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyBio(bio.id, bio.text)}
                  className="flex-shrink-0"
                >
                  {copiedBioId === bio.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {bio.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Slides ocultos da apresentação */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-zinc-300" />
          Slides ocultos da apresentação
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Controla quais slides aparecem em <code>/apresentacoes/reprograme-10x.html</code>.
          Mudança vale na próxima vez que a apresentação for aberta.
        </p>
        <ul className="mt-4 space-y-2">
          {TOGGLEABLE_SLIDES.map((s) => {
            const hidden = hiddenSlideIds.has(s.id);
            return (
              <li
                key={s.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background/40"
              >
                <button
                  onClick={() => toggleSlideHidden(s.id)}
                  disabled={savingSlides}
                  className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                    hidden
                      ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                      : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                  }`}
                  title={hidden ? "Clique pra reativar" : "Clique pra ocultar"}
                >
                  {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {s.label}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${
                        hidden
                          ? "bg-zinc-700/60 text-zinc-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {hidden ? "Oculto" : "Visível"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.hint}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Saúde WhatsApp + controles anti-bloqueio */}
      <WhatsAppHealthPanel />

      {/* Anti-abuse / Rate limit */}
      <section
        className={`rounded-xl border p-5 ${
          isEffectivelyDisabled
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border bg-card"
        }`}
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {isEffectivelyDisabled ? (
            <ShieldOff className="w-4 h-4 text-amber-400" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          )}
          Rate limit do /disc
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Limite normal: <strong>5 requests/min por IP</strong>. Em evento com WiFi compartilhado, todos os leads
          saem do mesmo IP — desliga por algumas horas e religa sozinho depois.
        </p>
        <div className="mt-4 flex items-start gap-3 flex-wrap">
          {isEffectivelyDisabled ? (
            <>
              <div className="px-4 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 font-medium flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                DESLIGADO · {fmtRemaining()}
              </div>
              <Button
                variant="outline"
                onClick={reenableRateLimit}
                disabled={savingRateLimit}
                className="border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
              >
                <ShieldCheck className="w-4 h-4 mr-2" /> Religar agora
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={savingRateLimit}>
                    Estender prazo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Estender por…</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => disableRateLimitFor(2)}>+ 2 horas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => disableRateLimitFor(4)}>+ 4 horas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => disableRateLimitFor(6)}>+ 6 horas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => disableRateLimitFor(8)}>+ 8 horas</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={savingRateLimit}
                  className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                >
                  <ShieldOff className="w-4 h-4 mr-2" /> Desligar pro evento (escolher duração)
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Religa automaticamente em…</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => disableRateLimitFor(2)}>2 horas (palestra curta)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => disableRateLimitFor(4)}>4 horas (recomendado)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => disableRateLimitFor(6)}>6 horas (evento longo)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => disableRateLimitFor(8)}>8 horas (dia inteiro)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={clearRateLimits}>
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Zerar tabela
          </Button>
          <div className="text-xs text-muted-foreground self-center">
            Último minuto: <strong className="text-foreground">{rateLimitWindowCount}</strong> requests
          </div>
        </div>
        {isEffectivelyDisabled && (
          <p className="text-xs text-amber-300/80 mt-3 leading-relaxed">
            ⚠️ Banner amarelo apareceu em <strong>todas</strong> as páginas do admin. Quando o tempo acabar, o sistema religa sozinho.
          </p>
        )}
      </section>

      {/* Limpar mural */}
      <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-red-300">
          <Trash2 className="w-4 h-4" />
          Zerar mural (fase de teste)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Deleta TODOS os leads do evento <code>reprograme-se-10x</code>. Use antes da palestra real começar.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4">
              <Trash2 className="w-4 h-4 mr-2" /> Limpar mural agora
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar todos os leads do Reprograme 10X?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai apagar permanentemente {leads.length} {leads.length === 1 ? "lead" : "leads"} do evento.
                Não dá pra desfazer. Confirma?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={clearMural} className="bg-red-600 hover:bg-red-700">
                Sim, limpar tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      {/* Lista de leads */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Users className="w-4 h-4" />
          Leads capturados ({leads.length})
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Foto</th>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">@instagram</th>
                <th className="text-left px-4 py-3">DISC</th>
                <th className="text-left px-4 py-3">Selos</th>
                <th className="text-left px-4 py-3">Mural</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhum lead ainda. Roda um pelo /r10x pra testar.
                  </td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    {l.instagram_profile_pic_url ? (
                      <img
                        src={l.instagram_profile_pic_url}
                        alt={l.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs">
                        {(l.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">@{l.instagram}</td>
                  <td className="px-4 py-3">
                    {l.disc_profile ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] text-xs font-semibold">
                        {l.disc_profile}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {l.is_member && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <GraduationCap className="w-3 h-3" />
                        Mentorado
                      </span>
                    )}
                    {l.instagram?.toLowerCase() === "victoriacoutinh0" && (
                      <span className="ml-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/30">
                        <Heart className="w-3 h-3" /> Easter egg
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleMural(l)}
                      className={`text-xs px-2 py-1 rounded border ${
                        l.authorized_mural
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      {l.authorized_mural ? "Visível" : "Oculto"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteOne(l.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
