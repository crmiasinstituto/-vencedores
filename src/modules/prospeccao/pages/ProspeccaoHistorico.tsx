// ============================================================
// ProspeccaoHistorico — lista todas as análises (diagnósticos completos)
//
// Acesso:
//  - admin: /admin/prospeccao/historico
//  - membro: /membros/prospeccao/historico
//
// Cada item mostra: nome do lead, score, fontes consultadas, data,
// e link "Ver diagnóstico" pra abrir o diagnóstico completo.
// Filtros: busca textual, range de score, ordenação.
// ============================================================

import { startTransition, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, History, Search, Filter, Star, MapPin, Instagram, Globe, ChevronRight, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as api from "../lib/api";
import { routeTo } from "../lib/context";

export default function ProspeccaoHistorico() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<"todos" | "alta" | "media" | "baixa">("todos");

  const { data: diagnosticos = [], isLoading } = useQuery({
    queryKey: ["prospeccao", "historico"],
    queryFn: () => api.listarHistoricoDiagnosticos(100),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    return diagnosticos.filter((d) => {
      const matchSearch =
        !search ||
        d.lead_nome?.toLowerCase().includes(search.toLowerCase()) ||
        d.lead_cidade?.toLowerCase().includes(search.toLowerCase()) ||
        d.lead_categoria?.toLowerCase().includes(search.toLowerCase());

      const score = Number(d.score_geral || 0);
      const matchScore =
        scoreFilter === "todos" ||
        (scoreFilter === "alta" && score < 4) ||
        (scoreFilter === "media" && score >= 4 && score < 7) ||
        (scoreFilter === "baixa" && score >= 7);

      return matchSearch && matchScore;
    });
  }, [diagnosticos, search, scoreFilter]);

  const totalGasto = diagnosticos.reduce((sum, d) => sum + (d.custo_total || 0), 0);
  const scoreMedio = diagnosticos.length > 0
    ? diagnosticos.filter((d) => d.score_geral !== null).reduce((sum, d) => sum + Number(d.score_geral), 0) / diagnosticos.filter((d) => d.score_geral !== null).length
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => startTransition(() => navigate(routeTo()))}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
              <History className="h-7 w-7 text-primary" />
              Histórico de Análises
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Todas as prospecções analisadas — clique pra ver o diagnóstico completo
            </p>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      {!isLoading && diagnosticos.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Total análises" value={diagnosticos.length} icon={<FileText className="h-4 w-4" />} />
          <StatCard label="Score médio" value={scoreMedio.toFixed(1) + "/10"} icon={<Star className="h-4 w-4 fill-current" />} color="text-amber-500" />
          <StatCard label="Custo total" value={"R$ " + (totalGasto * 5.5).toFixed(2)} icon={<History className="h-4 w-4" />} />
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cidade, nicho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={scoreFilter} onValueChange={(v: typeof scoreFilter) => setScoreFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os scores</SelectItem>
            <SelectItem value="alta">🔥 Alta dor (&lt;4)</SelectItem>
            <SelectItem value="media">⚠️ Média dor (4-7)</SelectItem>
            <SelectItem value="baixa">✅ Pouca dor (≥7)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card/30 p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {diagnosticos.length === 0
              ? "Nenhuma análise feita ainda."
              : "Nenhum resultado com esses filtros."}
          </p>
          {diagnosticos.length === 0 && (
            <Button
              variant="link"
              className="mt-2"
              onClick={() => startTransition(() => navigate(routeTo()))}
            >
              Começar uma prospecção
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d, i) => (
            <DiagnosticoCard key={d.id} d={d} index={i} navigate={navigate} />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center mt-6">
        {filtered.length} de {diagnosticos.length} análise{diagnosticos.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function StatCard({ label, value, icon, color = "text-foreground" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-4">
      <div className={`flex items-center gap-2 mb-1 ${color}`}>{icon}<span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DiagnosticoCard({ d, index, navigate }: { d: api.DiagnosticoHistorico; index: number; navigate: (path: string) => void }) {
  const score = Number(d.score_geral || 0);
  const tier = score < 4 ? "alta" : score < 7 ? "media" : "baixa";
  const tierColor = tier === "alta" ? "text-rose-500 bg-rose-500/10 border-rose-500/30" : tier === "media" ? "text-amber-500 bg-amber-500/10 border-amber-500/30" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
  const tierLabel = tier === "alta" ? "🔥 Alta dor" : tier === "media" ? "⚠️ Média dor" : "✅ Pouca dor";

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      onClick={() => startTransition(() => navigate(routeTo(`/diagnostico/${d.id}`)))}
      className="group w-full text-left rounded-xl border border-border/60 bg-card/30 hover:border-primary/40 hover:bg-card/60 transition-all p-4 flex items-center gap-4"
    >
      {/* Score */}
      <div className={`shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-lg border ${tierColor}`}>
        <span className="text-2xl font-bold leading-none">{d.score_geral !== null ? Number(d.score_geral).toFixed(1) : "—"}</span>
        <span className="text-[9px] mt-0.5 opacity-80">/ 10</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-foreground truncate">{d.lead_nome || "Lead"}</h3>
          <span className={`shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierColor}`}>{tierLabel}</span>
        </div>
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground">
          {d.lead_categoria && <span>{d.lead_categoria}</span>}
          {d.lead_cidade && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {d.lead_cidade}{d.lead_uf ? `/${d.lead_uf}` : ""}
            </span>
          )}
          {d.lead_instagram_handle && (
            <span className="flex items-center gap-1">
              <Instagram className="h-3 w-3" />
              @{d.lead_instagram_handle}
            </span>
          )}
          {d.lead_url_site && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {d.lead_url_site.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 25)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-1.5">
          {d.fontes_consultadas?.length || 0} fontes · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </motion.button>
  );
}
