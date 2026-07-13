import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  UserCheck,
  Users,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Star,
  Loader2,
  Copy,
  ExternalLink,
  Bot,
  Phone,
  Mail,
  Briefcase,
  Calendar,
  Link2,
  FileText,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
  photo_url: string | null;
  resume_notes: string | null;
  interview_date: string | null;
  interview_url: string | null;
  interview_notes: string | null;
  ai_analysis: any;
  rating: number | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  registered: { label: "Registrado", color: "text-gray-400", bgColor: "bg-gray-500/10 border-gray-500/20" },
  interview_scheduled: { label: "Entrevista Agendada", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
  interviewed: { label: "Entrevistado", color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
  approved: { label: "Aprovado", color: "text-green-400", bgColor: "bg-green-500/10 border-green-500/20" },
  rejected: { label: "Rejeitado", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20" },
};

const STATUS_ORDER = ["registered", "interview_scheduled", "interviewed", "approved", "rejected"];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.registered;
  return <Badge variant="outline" className={`${cfg.bgColor} ${cfg.color} text-xs`}>{cfg.label}</Badge>;
}

function RatingStars({ rating, onRate, size = "sm" }: { rating: number | null; onRate?: (r: number) => void; size?: "sm" | "md" }) {
  const s = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${s} ${i <= (rating || 0) ? "text-yellow-500 fill-yellow-500" : "text-gray-600"} ${onRate ? "cursor-pointer hover:text-yellow-400" : ""}`}
          onClick={() => onRate?.(i)}
        />
      ))}
    </div>
  );
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const color = value >= 7 ? "bg-green-500" : value >= 5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}/10</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminRecrutamento() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPosition, setNewPosition] = useState("");

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editInterviewDate, setEditInterviewDate] = useState("");
  const [editInterviewUrl, setEditInterviewUrl] = useState("");
  const [editInterviewNotes, setEditInterviewNotes] = useState("");
  const [editResumeNotes, setEditResumeNotes] = useState("");
  const [editRating, setEditRating] = useState<number | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCandidates(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar candidatos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = candidates.length;
    const scheduled = candidates.filter((c) => c.status === "interview_scheduled").length;
    const approved = candidates.filter((c) => c.status === "approved").length;
    const rejected = candidates.filter((c) => c.status === "rejected").length;
    return { total, scheduled, approved, rejected };
  }, [candidates]);

  // Filtered list
  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.position || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || c.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [candidates, search, filterStatus]);

  // Pipeline groups
  const pipeline = useMemo(() => {
    const groups: Record<string, Candidate[]> = {};
    STATUS_ORDER.forEach((s) => (groups[s] = []));
    candidates.forEach((c) => {
      if (groups[c.status]) groups[c.status].push(c);
      else groups.registered.push(c);
    });
    return groups;
  }, [candidates]);

  // Add candidate
  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }
    try {
      const { error } = await (supabase as any).from("candidates").insert({
        name: newName.trim(),
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
        position: newPosition.trim() || null,
        status: "registered",
      });
      if (error) throw error;
      toast.success("Candidato adicionado!");
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewPosition("");
      setAddOpen(false);
      fetchCandidates();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // Open detail
  const openDetail = (c: Candidate) => {
    setSelectedCandidate(c);
    setEditName(c.name);
    setEditEmail(c.email || "");
    setEditPhone(c.phone || "");
    setEditPosition(c.position || "");
    setEditStatus(c.status);
    setEditInterviewDate(c.interview_date ? c.interview_date.slice(0, 16) : "");
    setEditInterviewUrl(c.interview_url || "");
    setEditInterviewNotes(c.interview_notes || "");
    setEditResumeNotes(c.resume_notes || "");
    setEditRating(c.rating);
    setDetailOpen(true);
  };

  // Save detail
  const handleSaveDetail = async () => {
    if (!selectedCandidate) return;
    try {
      const { error } = await (supabase as any).from("candidates").update({
        name: editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        position: editPosition.trim() || null,
        status: editStatus,
        interview_date: editInterviewDate ? new Date(editInterviewDate).toISOString() : null,
        interview_url: editInterviewUrl.trim() || null,
        interview_notes: editInterviewNotes.trim() || null,
        resume_notes: editResumeNotes.trim() || null,
        rating: editRating,
        updated_at: new Date().toISOString(),
      }).eq("id", selectedCandidate.id);
      if (error) throw error;
      toast.success("Candidato atualizado!");
      setDetailOpen(false);
      fetchCandidates();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // AI analysis
  const handleAnalyze = async () => {
    if (!selectedCandidate) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-candidate", {
        body: { candidateId: selectedCandidate.id },
      });
      if (error) throw error;
      if (data?.analysis) {
        setSelectedCandidate({ ...selectedCandidate, ai_analysis: data.analysis });
        toast.success("Analise concluida!");
        fetchCandidates();
      } else {
        toast.error("Nao foi possivel gerar a analise.");
      }
    } catch (err: any) {
      toast.error("Erro na analise: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Copy link
  const copyFormLink = () => {
    const url = `${window.location.origin}/entrevista/form`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary" />
            Recrutamento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestao de candidatos e processos seletivos
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Candidato
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Candidato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input placeholder="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input placeholder="email@exemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="(00) 00000-0000" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vaga</Label>
                <Input placeholder="Ex: Desenvolvedor, Designer..." value={newPosition} onChange={(e) => setNewPosition(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleAdd}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-gray-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total candidatos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.scheduled}</p>
                <p className="text-xs text-muted-foreground">Entrevistas agendadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="formulario">Formulario Publico</TabsTrigger>
        </TabsList>

        {/* ─── Pipeline Tab ─────────────────────────────────────────────── */}
        <TabsContent value="pipeline" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STATUS_ORDER.map((status) => {
                const cfg = STATUS_CONFIG[status];
                const items = pipeline[status];
                return (
                  <div key={status} className="min-w-[260px] w-[260px] flex-shrink-0">
                    <div className={`rounded-lg border ${cfg.bgColor} p-3 mb-3`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                        <Badge variant="outline" className={`${cfg.bgColor} ${cfg.color} text-xs`}>
                          {items.length}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {items.map((c) => (
                        <Card
                          key={c.id}
                          className="border-gray-700 cursor-pointer hover:border-primary/40 transition-colors"
                          onClick={() => openDetail(c)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium text-white truncate">{c.name}</p>
                              {c.rating && <RatingStars rating={c.rating} />}
                            </div>
                            {c.position && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                {c.position}
                              </p>
                            )}
                            {c.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {c.phone}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <StatusBadge status={c.status} />
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {items.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum candidato</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Lista Tab ────────────────────────────────────────────────── */}
        <TabsContent value="lista" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, vaga ou email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed border-gray-700">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum candidato encontrado.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <Card
                  key={c.id}
                  className="border-gray-700 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => openDetail(c)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {c.position && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {c.position}
                            </span>
                          )}
                          {c.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {c.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <RatingStars rating={c.rating} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Formulario Tab ───────────────────────────────────────────── */}
        <TabsContent value="formulario" className="mt-4">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-primary" />
                Formulario Publico de Entrevista
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Compartilhe este link com os candidatos para que possam se cadastrar diretamente no processo seletivo.
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/entrevista/form`}
                  className="font-mono text-sm"
                />
                <Button onClick={copyFormLink} variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Link
                </Button>
              </div>
              <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center space-y-3">
                <Link2 className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  O formulario coleta: nome, e-mail, telefone e vaga de interesse.
                  <br />
                  Os candidatos aparecem automaticamente na aba Pipeline com status "Registrado".
                </p>
                <Button variant="outline" size="sm" onClick={() => window.open("/entrevista/form", "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir Formulario
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Candidate Detail Dialog ─────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Detalhes do Candidato
            </DialogTitle>
          </DialogHeader>

          {selectedCandidate && (
            <div className="space-y-6 py-2">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vaga</Label>
                  <Input value={editPosition} onChange={(e) => setEditPosition(e.target.value)} />
                </div>
              </div>

              {/* Status & Rating */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Avaliacao</Label>
                  <div className="pt-1">
                    <RatingStars rating={editRating} onRate={setEditRating} size="md" />
                  </div>
                </div>
              </div>

              {/* Interview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Data da Entrevista
                  </Label>
                  <Input
                    type="datetime-local"
                    value={editInterviewDate}
                    onChange={(e) => setEditInterviewDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5" />
                    Link da Entrevista (Meet)
                  </Label>
                  <Input
                    placeholder="https://meet.google.com/..."
                    value={editInterviewUrl}
                    onChange={(e) => setEditInterviewUrl(e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Notas do Curriculo
                </Label>
                <Textarea
                  placeholder="Observacoes sobre o curriculo do candidato..."
                  value={editResumeNotes}
                  onChange={(e) => setEditResumeNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Notas da Entrevista
                </Label>
                <Textarea
                  placeholder="Anotacoes durante/apos a entrevista..."
                  value={editInterviewNotes}
                  onChange={(e) => setEditInterviewNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* AI Analysis */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1 text-base">
                    <Bot className="w-4 h-4 text-primary" />
                    Analise por IA
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando...</>
                    ) : (
                      <><Bot className="w-4 h-4 mr-2" />Analisar</>
                    )}
                  </Button>
                </div>

                {selectedCandidate.ai_analysis ? (
                  <Card className="border-primary/20">
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        <ScoreBar value={selectedCandidate.ai_analysis.communication_score || 0} label="Comunicacao" />
                        <ScoreBar value={selectedCandidate.ai_analysis.technical_score || 0} label="Tecnico" />
                        <ScoreBar value={selectedCandidate.ai_analysis.culture_fit || 0} label="Fit Cultural" />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Score Geral:</span>
                        <Badge className={`${
                          (selectedCandidate.ai_analysis.overall_score || 0) >= 7
                            ? "bg-green-500/20 text-green-400"
                            : (selectedCandidate.ai_analysis.overall_score || 0) >= 5
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                        }`}>
                          {(selectedCandidate.ai_analysis.overall_score || 0).toFixed(1)} / 10
                        </Badge>
                      </div>

                      {selectedCandidate.ai_analysis.strengths?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-green-400 mb-1">Pontos Fortes</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {selectedCandidate.ai_analysis.strengths.map((s: string, i: number) => (
                              <li key={i} className="flex items-start gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedCandidate.ai_analysis.weaknesses?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-red-400 mb-1">Pontos a Melhorar</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {selectedCandidate.ai_analysis.weaknesses.map((w: string, i: number) => (
                              <li key={i} className="flex items-start gap-1">
                                <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedCandidate.ai_analysis.recommendation && (
                        <div>
                          <p className="text-xs font-semibold text-primary mb-1">Recomendacao</p>
                          <p className="text-xs text-muted-foreground">{selectedCandidate.ai_analysis.recommendation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed border-gray-700">
                    <CardContent className="py-6 text-center text-muted-foreground text-sm">
                      Nenhuma analise realizada. Clique em "Analisar" para gerar uma avaliacao por IA.
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Timeline</Label>
                <div className="text-xs text-muted-foreground space-y-1 border-l-2 border-gray-700 pl-3">
                  <p>
                    <span className="text-white">Criado:</span>{" "}
                    {new Date(selectedCandidate.created_at).toLocaleString("pt-BR")}
                  </p>
                  {selectedCandidate.updated_at !== selectedCandidate.created_at && (
                    <p>
                      <span className="text-white">Ultima atualizacao:</span>{" "}
                      {new Date(selectedCandidate.updated_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {selectedCandidate.interview_date && (
                    <p>
                      <span className="text-white">Entrevista:</span>{" "}
                      {new Date(selectedCandidate.interview_date).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveDetail}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
