// ============================================================
// MembrosProspeccaoMeusLeads — lista pessoal do membro
//
// Mostra os leads que o membro "salvou" via "Virar Lead" no diagnóstico.
// Origem: tabela prospeccao_member_leads (criada na Fase 1).
// Cada lead linka pro diagnóstico original (lê-se PDF + score + dores).
// ============================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { MembrosLayout } from "@/components/membros/MembrosLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Phone,
  Instagram,
  Globe,
  MapPin,
  FileText,
  ChevronRight,
  Inbox,
  Loader2,
} from "lucide-react";
import { getMemberContextSync } from "@/modules/prospeccao/lib/context";

interface MemberLead {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  site: string | null;
  cidade: string | null;
  uf: string | null;
  categoria: string | null;
  status: string;
  tags: string[] | null;
  notes: string | null;
  prospeccao_diagnostico_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  reuniao_marcada: "Reunião marcada",
  negociacao: "Negociação",
  convertido: "Convertido",
  descartado: "Descartado",
  sem_resposta: "Sem resposta",
};

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  em_contato: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  reuniao_marcada: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  negociacao: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  convertido: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  descartado: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  sem_resposta: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export default function MembrosProspeccaoMeusLeads() {
  const [leads, setLeads] = useState<MemberLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    let alive = true;
    (async () => {
      const ctx = getMemberContextSync();
      if (!ctx?.member_id) {
        if (alive) setLoading(false);
        return;
      }
      const { data, error } = await (supabase as any)
        .from("prospeccao_member_leads")
        .select("*")
        .eq("member_id", ctx.member_id)
        .order("created_at", { ascending: false });
      if (!alive) return;
      if (!error && data) setLeads(data as MemberLead[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await (supabase as any)
      .from("prospeccao_member_leads")
      .update({ status: newStatus })
      .eq("id", id);
    if (!error) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    }
  };

  const filtered = leads.filter((l) => {
    const matchSearch =
      !search ||
      l.nome.toLowerCase().includes(search.toLowerCase()) ||
      l.cidade?.toLowerCase().includes(search.toLowerCase()) ||
      l.categoria?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <MembrosLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Meus Leads</h1>
          <p className="text-white/50 text-sm mt-1">
            Leads salvos das suas prospecções com diagnóstico anexo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Buscar por nome, cidade, nicho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-12 text-center">
              <Inbox className="w-12 h-12 mx-auto mb-4 text-white/30" />
              <p className="text-white/60">
                {leads.length === 0
                  ? "Você ainda não salvou nenhum lead."
                  : "Nenhum lead com esses filtros."}
              </p>
              {leads.length === 0 && (
                <Link to="/membros/prospeccao">
                  <Button variant="link" className="mt-2 text-[#3B82F6]">
                    Começar uma prospecção
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((lead, i) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-white truncate">{lead.nome}</h3>
                          <Badge variant="outline" className={STATUS_COLORS[lead.status] || ""}>
                            {STATUS_LABELS[lead.status] || lead.status}
                          </Badge>
                          {typeof lead.metadata?.score_geral === "number" && (
                            <Badge variant="outline" className="text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10">
                              Score {Number(lead.metadata.score_geral).toFixed(1)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-white/60">
                          {lead.cidade && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.cidade}{lead.uf && `/${lead.uf}`}</span>
                          )}
                          {lead.categoria && <span>{lead.categoria}</span>}
                          {lead.whatsapp && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.whatsapp}</span>}
                          {lead.instagram && <span className="flex items-center gap-1"><Instagram className="w-3 h-3" />@{lead.instagram}</span>}
                          {lead.site && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Site</span>}
                        </div>
                        {lead.notes && (
                          <p className="text-xs text-white/50 mt-2 line-clamp-2">{lead.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                          <SelectTrigger className="w-[150px] h-8 bg-white/5 border-white/10 text-white text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {lead.prospeccao_diagnostico_id && (
                          <Link
                            to={`/membros/prospeccao/diagnostico/${lead.prospeccao_diagnostico_id}`}
                            className="flex items-center gap-1 text-xs text-[#3B82F6] hover:underline"
                          >
                            <FileText className="w-3 h-3" /> Ver diagnóstico
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </MembrosLayout>
  );
}
