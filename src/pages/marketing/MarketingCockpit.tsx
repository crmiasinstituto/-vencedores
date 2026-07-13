import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ArrowLeft, RefreshCw, TrendingUp, DollarSign, Eye, MousePointer, MessageCircle,
  Users, Play, Pause, Target, Zap, AlertTriangle, CheckCircle, Info, BarChart3, Megaphone,
  Brain, ArrowDownRight, MessageSquare, Heart, Bookmark, Timer, Wallet, Rocket,
  Lightbulb, Crosshair, Video, Flame, Star, Trophy, Loader2, Pencil,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useMarketingCockpit, type AIInsight, type CampaignSummary, type MarketingKPIs, type InsightAction, type AdsetSummary } from "@/hooks/useMarketingCockpit";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const CHART_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#22c55e", "#ec4899"];
const GRADIENT_CARDS = {
  spend: "from-violet-50 to-violet-100 border-violet-200",
  impressions: "from-cyan-50 to-cyan-100 border-cyan-200",
  clicks: "from-amber-50 to-amber-100 border-amber-200",
  conversations: "from-emerald-50 to-emerald-100 border-emerald-200",
  cpc: "from-blue-50 to-blue-100 border-blue-200",
  ctr: "from-pink-50 to-pink-100 border-pink-200",
  reach: "from-indigo-50 to-indigo-100 border-indigo-200",
  frequency: "from-orange-50 to-orange-100 border-orange-200",
};

// Ref codes + que Vencedores para Click-to-WhatsApp
const CAMPAIGN_REF_CODES: Record<string, string> = {
  MASTERCLASS_SSA: "Masterclass IA Salvador (09/06)",
  MASTERCLASS_GERAL: "Masterclass IA Geral",
  CBO_PROSPECCAO: "CBO - Prospeccao Geral",
  RETARGET_LP: "Retargeting Landing Page",
  RETARGET_VIDEO: "Retargeting Video 75%",
  LAL_COMPRADORES: "Lookalike Compradores Masterclass",
  R10X: "Reprograme 10x",
};

export default function MarketingCockpit() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = useMarketingCockpit(days);

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
  const formatPercent = (v: number) => `${v.toFixed(2)}%`;
  const formatCompact = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return formatNumber(v);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/marketing"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></Link>
          <div>
            <h1 className="text-3xl font-bold">Cockpit de Marketing</h1>
            <p className="text-muted-foreground">Carregando dados da Meta API...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse space-y-2"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-8 bg-muted rounded w-1/2" /></div></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800">Erro ao conectar com a Meta API</h3>
                <p className="text-sm text-red-700">{(error as Error)?.message ?? "Sem dados"}</p>
              </div>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
              <RefreshCw className="h-4 w-4 mr-2" />Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { accountBalance, campaigns, campaignSummaries, adsets, dailyData, kpis, aiInsights } = data;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const pausedCampaigns = campaigns.filter((c) => c.status === "PAUSED").length;

  const funnelData = [
    { name: "Impressoes", value: kpis.totalImpressions, color: "#8b5cf6" },
    { name: "Alcance", value: kpis.totalReach, color: "#06b6d4" },
    { name: "Cliques", value: kpis.totalClicks, color: "#f59e0b" },
    { name: "Link Clicks", value: kpis.totalLinkClicks, color: "#ec4899" },
    { name: "Conversas", value: kpis.totalConversations, color: "#22c55e" },
    { name: "1a Resposta", value: kpis.totalFirstReply, color: "#10b981" },
  ];

  const spendDistribution = campaignSummaries.map((c, i) => ({
    name: c.name.length > 25 ? c.name.substring(0, 25) + "..." : c.name,
    value: c.spend,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const engagementBreakdown = [
    { name: "Video Views", value: kpis.totalVideoViews, color: "#ef4444" },
    { name: "Reactions", value: kpis.totalReactions, color: "#8b5cf6" },
    { name: "Link Clicks", value: kpis.totalLinkClicks, color: "#06b6d4" },
    { name: "Comments", value: kpis.totalComments, color: "#f59e0b" },
    { name: "Saves", value: kpis.totalSaves, color: "#22c55e" },
  ].filter((e) => e.value > 0);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/admin/marketing"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></Link>
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-7 w-7 text-violet-600" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                Cockpit de Marketing AI
              </h1>
            </div>
            <p className="text-muted-foreground">Dados ao vivo da Meta Ads API, analise inteligente de campanhas</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <Badge variant="default" className="bg-green-600"><Zap className="h-3 w-3 mr-1" />API Conectada</Badge>
        <Badge variant="outline"><Megaphone className="h-3 w-3 mr-1" />{activeCampaigns} ativas / {pausedCampaigns} pausadas</Badge>
        <Badge variant="secondary"><Timer className="h-3 w-3 mr-1" />Ultimos {days} dias</Badge>
      </div>

      <Separator />

      {/* Account Balance */}
      {accountBalance && (
        <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl"><Wallet className="h-8 w-8 text-emerald-400" /></div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Saldo Disponivel na Conta</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatCurrency(accountBalance.availableBalance)}</p>
                  <p className="text-xs text-slate-400 mt-1">{accountBalance.fundingSource}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Total Gasto</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(accountBalance.amountSpent)}</p>
                  <p className="text-xs text-slate-500">historico</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Limite da Conta</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(accountBalance.spendCap)}</p>
                  <p className="text-xs text-slate-500">spend cap</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Gasto/Dia (Media)</p>
                  <p className="text-xl font-bold text-amber-400">{formatCurrency(kpis.totalSpend / (days || 1))}</p>
                  <p className="text-xs text-slate-500">
                    ~{Math.floor(accountBalance.availableBalance / (kpis.totalSpend / (days || 1) || 1))} dias restantes
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#334155" strokeWidth="3" />
                    <path
                      d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={accountBalance.spendCap > 0 ? (accountBalance.amountSpent / accountBalance.spendCap > 0.9 ? "#ef4444" : "#22c55e") : "#22c55e"}
                      strokeWidth="3"
                      strokeDasharray={`${accountBalance.spendCap > 0 ? (accountBalance.amountSpent / accountBalance.spendCap) * 100 : 0}, 100`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {accountBalance.spendCap > 0 ? `${((accountBalance.amountSpent / accountBalance.spendCap) * 100).toFixed(0)}%` : "N/A"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Uso do Limite</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Investimento" value={formatCurrency(kpis.totalSpend)} sub={`${formatCurrency(kpis.totalSpend / days)}/dia`} icon={DollarSign} cls={GRADIENT_CARDS.spend} color="violet" />
        <KpiCard label="Impressoes" value={formatCompact(kpis.totalImpressions)} sub={`CPM: ${formatCurrency(kpis.avgCPM)}`} icon={Eye} cls={GRADIENT_CARDS.impressions} color="cyan" />
        <KpiCard label="Cliques" value={formatCompact(kpis.totalClicks)} sub={`CPC: ${formatCurrency(kpis.avgCPC)}`} icon={MousePointer} cls={GRADIENT_CARDS.clicks} color="amber" />
        <KpiCard label="Conversas" value={formatNumber(kpis.totalConversations)} sub={`Custo: ${formatCurrency(kpis.costPerConversation)}/cada`} icon={MessageCircle} cls={GRADIENT_CARDS.conversations} color="emerald" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Alcance" value={formatCompact(kpis.totalReach)} icon={Users} cls={GRADIENT_CARDS.reach} color="indigo" />
        <Card className={`bg-gradient-to-br ${GRADIENT_CARDS.ctr}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-pink-600 uppercase tracking-wide">CTR</p>
                <p className="text-2xl font-bold text-pink-900">{formatPercent(kpis.avgCTR)}</p>
              </div>
              <Badge variant={kpis.avgCTR > 1.5 ? "default" : "secondary"} className="text-xs">
                {kpis.avgCTR > 2 ? "Otimo" : kpis.avgCTR > 1.5 ? "Bom" : "Regular"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${GRADIENT_CARDS.frequency}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Frequencia</p>
                <p className="text-2xl font-bold text-orange-900">{kpis.avgFrequency.toFixed(1)}x</p>
              </div>
              <Badge variant={kpis.avgFrequency > 3 ? "destructive" : kpis.avgFrequency > 2.5 ? "secondary" : "default"} className="text-xs">
                {kpis.avgFrequency > 3 ? "Saturado" : kpis.avgFrequency > 2.5 ? "Alerta" : "OK"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${GRADIENT_CARDS.cpc}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Conversao</p>
                <p className="text-2xl font-bold text-blue-900">{formatPercent(kpis.conversionRate)}</p>
                <p className="text-xs text-blue-600 mt-1">clique &rarr; conversa</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <Card className="border-violet-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-violet-600" />Insights AI, Analise Inteligente</CardTitle>
            <CardDescription>Recomendacoes automaticas baseadas na performance das campanhas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiInsights.map((insight, i) => <InsightCard key={i} insight={insight} campaignSummaries={campaignSummaries} onRefetch={refetch} />)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="daily">Performance Diaria</TabsTrigger>
          <TabsTrigger value="funnel">Funil de Conversao</TabsTrigger>
          <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          <TabsTrigger value="messenger">Messenger</TabsTrigger>
          <TabsTrigger value="strategy">Estrategia &amp; Growth</TabsTrigger>
          <TabsTrigger value="attribution">Atribuicao &amp; CAPI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Investimento Diario">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "dd/MM")} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")} formatter={(v: number) => [formatCurrency(v), "Investimento"]} />
                <Area type="monotone" dataKey="spend" stroke="#8b5cf6" fill="url(#colorSpend)" strokeWidth={2} />
              </AreaChart>
            </ChartCard>
            <ChartCard title="Cliques vs Conversas">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "dd/MM")} fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} />
                <Tooltip labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")} formatter={(v: number, name: string) => [formatNumber(v), name === "clicks" ? "Cliques" : "Conversas"]} />
                <Legend formatter={(v) => (v === "clicks" ? "Cliques" : "Conversas")} />
                <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="conversations" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
            {spendDistribution.length > 0 && (
              <ChartCard title="Distribuicao de Investimento">
                <PieChart>
                  <Pie data={spendDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`} labelLine={false}>
                    {spendDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ChartCard>
            )}
            <ChartCard title="Evolucao do CPC">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "dd/MM")} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")} formatter={(v: number) => [formatCurrency(v), "CPC"]} />
                <Line type="monotone" dataKey="cpc" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          {campaignSummaries.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Sem campanhas com dados no periodo.</CardContent></Card>
          ) : (
            <>
              {campaignSummaries.map((c, i) => (
                <CampaignCard key={i} campaign={c} campaignAdsets={adsets.filter((a) => a.campaign_id === c.id)} formatCurrency={formatCurrency} formatNumber={formatNumber} formatPercent={formatPercent} onRefetch={refetch} />
              ))}
              <ChartCard title="Comparativo, Custo por Conversa" height={300}>
                <BarChart data={campaignSummaries.map((c) => ({
                  name: c.name.length > 25 ? c.name.substring(0, 25) + "..." : c.name,
                  costPerConversation: c.costPerConversation,
                  conversations: c.conversations,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis yAxisId="left" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} />
                  <Tooltip formatter={(v: number, name: string) => [name === "costPerConversation" ? formatCurrency(v) : formatNumber(v), name === "costPerConversation" ? "Custo/Conversa" : "Conversas"]} />
                  <Legend formatter={(v) => (v === "costPerConversation" ? "Custo/Conversa" : "Conversas")} />
                  <Bar yAxisId="left" dataKey="costPerConversation" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="conversations" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>
            </>
          )}
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Impressoes vs Alcance">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                  <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "dd/MM")} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")} formatter={(v: number, name: string) => [formatNumber(v), name === "impressions" ? "Impressoes" : "Alcance"]} />
                <Legend formatter={(v) => (v === "impressions" ? "Impressoes" : "Alcance")} />
                <Area type="monotone" dataKey="impressions" stroke="#06b6d4" fill="url(#colorImpressions)" strokeWidth={2} />
                <Area type="monotone" dataKey="reach" stroke="#8b5cf6" fill="url(#colorReach)" strokeWidth={2} />
              </AreaChart>
            </ChartCard>
            <ChartCard title="CTR Diario">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "dd/MM")} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")} formatter={(v: number) => [formatPercent(v), "CTR"]} />
                <Line type="monotone" dataKey="ctr" stroke="#ec4899" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Video Views Diarios</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "dd/MM")} fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")} formatter={(v: number) => [formatNumber(v), "Views"]} />
                    <Bar dataKey="videoViews" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funil de Marketing Completo</CardTitle>
              <CardDescription>Da impressao ate a primeira resposta no Messenger</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {funnelData.map((step, i) => {
                  const maxValue = funnelData[0].value || 1;
                  const percentage = (step.value / maxValue) * 100;
                  const prevValue = i > 0 ? funnelData[i - 1].value : step.value;
                  const dropRate = prevValue > 0 ? ((prevValue - step.value) / prevValue) * 100 : 0;
                  return (
                    <div key={step.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: step.color }} />
                          <span className="font-medium">{step.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{formatCompact(step.value)}</span>
                          {i > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <ArrowDownRight className="h-3 w-3 mr-1 text-red-500" />
                              -{dropRate.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Progress value={percentage} className="h-8" />
                    </div>
                  );
                })}
              </div>
              <Separator className="my-6" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FunnelStat value={`${kpis.totalImpressions > 0 ? ((kpis.totalClicks / kpis.totalImpressions) * 100).toFixed(2) : 0}%`} label="Impressao &rarr; Clique" color="text-violet-600" />
                <FunnelStat value={`${kpis.totalClicks > 0 ? ((kpis.totalLinkClicks / kpis.totalClicks) * 100).toFixed(1) : 0}%`} label="Clique &rarr; Link Click" color="text-cyan-600" />
                <FunnelStat value={formatPercent(kpis.conversionRate)} label="Clique &rarr; Conversa" color="text-emerald-600" />
                <FunnelStat value={`${kpis.totalConversations > 0 ? ((kpis.totalFirstReply / kpis.totalConversations) * 100).toFixed(1) : 0}%`} label="Conversa &rarr; Resposta" color="text-pink-600" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MiniStat icon={Play} color="text-red-500" value={formatCompact(kpis.totalVideoViews)} label="Video Views" />
            <MiniStat icon={Heart} color="text-pink-500" value={formatNumber(kpis.totalReactions)} label="Reacoes" />
            <MiniStat icon={MessageSquare} color="text-blue-500" value={formatNumber(kpis.totalComments)} label="Comentarios" />
            <MiniStat icon={Bookmark} color="text-yellow-500" value={formatNumber(kpis.totalSaves)} label="Salvamentos" />
            <MiniStat icon={MousePointer} color="text-cyan-500" value={formatCompact(kpis.totalLinkClicks)} label="Link Clicks" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {engagementBreakdown.length > 0 && (
              <ChartCard title="Breakdown de Engajamento">
                <PieChart>
                  <Pie data={engagementBreakdown} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {engagementBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatNumber(v)} />
                </PieChart>
              </ChartCard>
            )}
            <ChartCard title="Engajamento Diario">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "dd/MM")} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")} formatter={(v: number) => [formatNumber(v), "Engajamento"]} />
                <Bar dataKey="engagement" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="messenger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funil de Messenger, Profundidade das Conversas</CardTitle>
              <CardDescription>Analise de engajamento das conversas iniciadas pelo Meta Ads</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignSummaries.map((c, i) => (
                  <div key={i} className="space-y-2 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{c.name}</h4>
                      <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                        {c.status === "ACTIVE" ? "Ativa" : "Pausada"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                      <MessengerStat value={c.conversations} label="Conversas Iniciadas" color="text-emerald-600" />
                      <MessengerStat value={c.firstReply} label="1a Resposta" color="text-blue-600" />
                      <MessengerStat value={c.messengerDepth2} label="2+ Mensagens" color="text-violet-600" />
                      <MessengerStat value={c.messengerDepth3} label="3+ Mensagens" color="text-pink-600" />
                      <MessengerStat value={c.messengerDepth5} label="5+ Mensagens" color="text-amber-600" />
                    </div>
                    {c.conversations > 0 && (
                      <div className="flex gap-2 text-xs flex-wrap">
                        <Badge variant="outline">Taxa resposta: {((c.firstReply / c.conversations) * 100).toFixed(0)}%</Badge>
                        <Badge variant="outline">Engajamento profundo: {((c.messengerDepth5 / c.conversations) * 100).toFixed(0)}%</Badge>
                        <Badge variant="outline">Custo/conversa: {formatCurrency(c.costPerConversation)}</Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GradientStat value={formatNumber(kpis.totalConversations)} label="Total Conversas" cls="from-emerald-50 to-emerald-100 border-emerald-200" textCls="text-emerald-800" subCls="text-emerald-600" />
            <GradientStat value={formatNumber(kpis.totalFirstReply)} label="Primeiras Respostas" cls="from-blue-50 to-blue-100 border-blue-200" textCls="text-blue-800" subCls="text-blue-600" />
            <GradientStat value={formatCurrency(kpis.costPerConversation)} label="Custo/Conversa" cls="from-violet-50 to-violet-100 border-violet-200" textCls="text-violet-800" subCls="text-violet-600" />
            <GradientStat value={`${kpis.totalConversations > 0 ? ((kpis.totalFirstReply / kpis.totalConversations) * 100).toFixed(0) : 0}%`} label="Taxa de Resposta" cls="from-pink-50 to-pink-100 border-pink-200" textCls="text-pink-800" subCls="text-pink-600" />
          </div>
        </TabsContent>

        <TabsContent value="attribution" className="space-y-4">
          <AttributionPanel refCodes={CAMPAIGN_REF_CODES} />
        </TabsContent>

        <TabsContent value="strategy" className="space-y-4">
          <StrategyAndGrowthPanel kpis={kpis} campaignSummaries={campaignSummaries} formatCurrency={formatCurrency} formatNumber={formatNumber} formatPercent={formatPercent} />
        </TabsContent>
      </Tabs>

      {kpis.bestCampaign && (
        <Card className="bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-amber-600" />
              <div>
                <h3 className="font-bold text-amber-800">Melhor Campanha do Periodo</h3>
                <p className="text-lg font-semibold text-amber-900">{kpis.bestCampaign}</p>
                <p className="text-sm text-amber-700">Maior numero de conversas geradas no periodo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============== Sub-components ==============

function KpiCard({ label, value, sub, icon: Icon, cls, color }: { label: string; value: string; sub?: string; icon: any; cls: string; color: string }) {
  const textCls: Record<string, string> = {
    violet: "text-violet-900",
    cyan: "text-cyan-900",
    amber: "text-amber-900",
    emerald: "text-emerald-900",
    indigo: "text-indigo-900",
  };
  const subCls: Record<string, string> = {
    violet: "text-violet-600",
    cyan: "text-cyan-600",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    indigo: "text-indigo-600",
  };
  const iconCls: Record<string, string> = {
    violet: "text-violet-500",
    cyan: "text-cyan-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
    indigo: "text-indigo-500",
  };
  return (
    <Card className={`bg-gradient-to-br ${cls}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-medium ${subCls[color]} uppercase tracking-wide`}>{label}</p>
            <p className={`text-2xl font-bold ${textCls[color]}`}>{value}</p>
            {sub && <p className={`text-xs ${subCls[color]} mt-1`}>{sub}</p>}
          </div>
          <Icon className={`h-8 w-8 ${iconCls[color]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

async function executeInsightAction(
  action: InsightAction,
  campaignSummaries: CampaignSummary[],
): Promise<{ success: number; failed: number; errors: string[] }> {
  const byId = new Map(campaignSummaries.map((c) => [c.id, c]));
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  if (action.type === "reallocate" && action.fromCampaignId && action.toCampaignId && action.deltaPct) {
    const ops = [
      supabase.functions.invoke("marketing-meta", { body: { action: "update_budget", meta_campaign_id: action.fromCampaignId, delta_pct: -Math.abs(action.deltaPct) } }),
      supabase.functions.invoke("marketing-meta", { body: { action: "update_budget", meta_campaign_id: action.toCampaignId, delta_pct: Math.abs(action.deltaPct) } }),
    ];
    const results = await Promise.all(ops);
    results.forEach((r) => {
      if (r.error || !r.data?.success) { failed++; errors.push(r.error?.message || r.data?.error || "erro"); }
      else success++;
    });
    return { success, failed, errors };
  }

  if (action.type === "pause_campaigns") {
    const ops = action.targetCampaignIds.map((id) =>
      supabase.functions.invoke("marketing-meta", { body: { action: "set_status", meta_campaign_id: id, activate: false } }),
    );
    const results = await Promise.all(ops);
    results.forEach((r) => {
      if (r.error || !r.data?.success) { failed++; errors.push(r.error?.message || r.data?.error || "erro"); }
      else success++;
    });
    return { success, failed, errors };
  }

  // boost_budget / cut_budget - backend calcula delta % a partir dos adsets atuais
  const deltaPct = action.deltaPct || 0;
  const ops = action.targetCampaignIds.map((id) =>
    supabase.functions.invoke("marketing-meta", { body: { action: "update_budget", meta_campaign_id: id, delta_pct: deltaPct } }),
  );
  const results = await Promise.all(ops);
  results.forEach((r: any) => {
    if (r.error || !r.data?.success) { failed++; errors.push(r.error?.message || r.data?.error || "erro"); }
    else success++;
  });
  // unused agora, mas mantenho byId pra log/debug futuro
  void byId;
  return { success, failed, errors };
}

function InsightCard({ insight, campaignSummaries, onRefetch }: { insight: AIInsight; campaignSummaries: CampaignSummary[]; onRefetch: () => void }) {
  const [applying, setApplying] = useState(false);
  const styles = {
    success: { bg: "bg-green-50 border-green-200", icon: CheckCircle, iconColor: "text-green-600", titleColor: "text-green-800", textColor: "text-green-700", btnVariant: "default" as const },
    warning: { bg: "bg-yellow-50 border-yellow-200", icon: AlertTriangle, iconColor: "text-yellow-600", titleColor: "text-yellow-800", textColor: "text-yellow-700", btnVariant: "outline" as const },
    danger: { bg: "bg-red-50 border-red-200", icon: AlertTriangle, iconColor: "text-red-600", titleColor: "text-red-800", textColor: "text-red-700", btnVariant: "destructive" as const },
    info: { bg: "bg-blue-50 border-blue-200", icon: Info, iconColor: "text-blue-600", titleColor: "text-blue-800", textColor: "text-blue-700", btnVariant: "default" as const },
  };
  const style = styles[insight.type];
  const Icon = style.icon;

  const handleApply = async () => {
    if (!insight.actionable) return;
    setApplying(true);
    try {
      const r = await executeInsightAction(insight.actionable, campaignSummaries);
      if (r.success > 0 && r.failed === 0) {
        toast.success(`Aplicado em ${r.success} campanha(s)`);
      } else if (r.success > 0 && r.failed > 0) {
        toast.warning(`Aplicado em ${r.success}, falhou em ${r.failed}: ${r.errors[0] || ""}`);
      } else {
        toast.error(`Falhou: ${r.errors[0] || "erro desconhecido"}`);
      }
      onRefetch();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${style.bg}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 ${style.iconColor}`} />
        <div className="flex-1">
          <h4 className={`font-semibold text-sm ${style.titleColor}`}>{insight.title}</h4>
          <p className={`text-xs mt-1 ${style.textColor}`}>{insight.description}</p>
          {insight.action && <p className={`text-xs mt-2 font-medium ${style.titleColor}`}>&rarr; {insight.action}</p>}
          {insight.actionable && (
            <Button
              size="sm"
              variant={style.btnVariant}
              className="mt-2 h-7 text-xs"
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
              {insight.actionable.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type BudgetSuggestion = {
  deltaPct: number;
  label: string;
  reason: string;
  tone: "green" | "red" | "amber" | "neutral";
};

function computeBudgetSuggestion(c: CampaignSummary): BudgetSuggestion {
  const spend = c.spend;
  const cpc = c.cpc;
  const ctr = c.ctr;
  const freq = c.frequency;
  const conv = c.conversations;
  const cpconv = c.costPerConversation;

  // Gastou mas nao converteu nada
  if (conv === 0 && spend >= 50) {
    return { deltaPct: -30, label: "Reduzir 30%", reason: "Gasto sem conversa, reavaliar criativo/publico", tone: "red" };
  }
  // Custo por conversa muito alto
  if (conv > 0 && cpconv > 30) {
    return { deltaPct: -20, label: "Reduzir 20%", reason: `Custo/conversa R$${cpconv.toFixed(2)} acima do ideal`, tone: "red" };
  }
  // Frequencia saturada
  if (freq > 3) {
    return { deltaPct: -20, label: "Reduzir 20%", reason: `Frequencia ${freq.toFixed(1)}x indica publico saturado`, tone: "red" };
  }
  // Vencedora absoluta: tudo verde
  if (cpc > 0 && cpc < 1.8 && ctr > 2 && (conv === 0 || cpconv < 20)) {
    return { deltaPct: 20, label: "Aumentar 20%", reason: "CPC baixo + CTR alto, escalar agora", tone: "green" };
  }
  // Boa performance moderada
  if (cpc > 0 && cpc < 2.5 && ctr > 1.5) {
    return { deltaPct: 10, label: "Aumentar 10%", reason: "Performance acima da media", tone: "green" };
  }
  // CTR fraco
  if (ctr > 0 && ctr < 1) {
    return { deltaPct: -10, label: "Reduzir 10%", reason: `CTR ${ctr.toFixed(2)}% abaixo do esperado`, tone: "amber" };
  }
  return { deltaPct: 0, label: "Manter", reason: "Metricas estaveis, sem mudanca recomendada", tone: "neutral" };
}

function CampaignCard({ campaign, campaignAdsets, formatCurrency, formatNumber, formatPercent, onRefetch }: { campaign: CampaignSummary; campaignAdsets: AdsetSummary[]; formatCurrency: (v: number) => string; formatNumber: (v: number) => string; formatPercent: (v: number) => string; onRefetch: () => void }) {
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [showAdsets, setShowAdsets] = useState(false);

  const suggestion = computeBudgetSuggestion(campaign);
  const currentBudget = campaign.dailyBudget || 0;

  const handleToggleStatus = async () => {
    const activate = campaign.status !== "ACTIVE";
    setLoading("status");
    try {
      const { data, error } = await supabase.functions.invoke("marketing-meta", {
        body: { action: "set_status", meta_campaign_id: campaign.id, activate },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.success(activate ? "Campanha ativada" : "Campanha pausada");
      onRefetch();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const applyBudget = async (value: number, sourceLabel: string) => {
    if (!value || value < 1) {
      toast.error("Orcamento minimo: R$1,00");
      return;
    }
    setLoading(sourceLabel);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-meta", {
        body: { action: "update_budget", meta_campaign_id: campaign.id, daily_budget_brl: value },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao atualizar");
      toast.success(`Orcamento atualizado para R$${value.toFixed(2)}/dia`);
      setEditingBudget(false);
      setNewBudget("");
      onRefetch();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateBudget = async () => {
    const value = parseFloat(newBudget.replace(",", "."));
    await applyBudget(value, "budget");
  };

  const applyDelta = async (deltaPct: number, sourceLabel: string) => {
    setLoading(sourceLabel);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-meta", {
        body: { action: "update_budget", meta_campaign_id: campaign.id, delta_pct: deltaPct },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao atualizar");
      const newVal = Number(data?.new_daily_budget_brl ?? 0);
      const prevVal = Number(data?.previous_daily_budget_brl ?? 0);
      toast.success(`Orcamento ${deltaPct > 0 ? "+" : ""}${deltaPct}%: R$${prevVal.toFixed(2)} -> R$${newVal.toFixed(2)}/dia`);
      onRefetch();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleQuickAdjust = async (deltaPct: number, sourceLabel: string) => {
    await applyDelta(deltaPct, sourceLabel);
  };

  const handleApplySuggestion = async () => {
    if (suggestion.deltaPct === 0) {
      toast.info("Sugestao IA: manter orcamento atual");
      return;
    }
    await applyDelta(suggestion.deltaPct, "suggestion");
  };

  const handleAdsetToggle = async (adsetId: string, activate: boolean) => {
    const key = `adset-${adsetId}`;
    setLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-meta", {
        body: { action: "set_adset_status", adset_id: adsetId, activate },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.success(activate ? "Adset ativado" : "Adset pausado");
      onRefetch();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className={campaign.status === "ACTIVE" ? "border-green-200" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">{campaign.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{campaign.objective.replace("OUTCOME_", "")}</Badge>
            <Badge variant={campaign.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
              {campaign.status === "ACTIVE" ? "Ativa" : "Pausada"}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-3">
          <MetricCell label="Investimento" value={formatCurrency(campaign.spend)} />
          <MetricCell label="Impressoes" value={formatNumber(campaign.impressions)} />
          <MetricCell label="Alcance" value={formatNumber(campaign.reach)} />
          <MetricCell label="Cliques" value={formatNumber(campaign.clicks)} />
          <MetricCell label="CPC" value={formatCurrency(campaign.cpc)} highlight={campaign.cpc < 1.8 ? "green" : campaign.cpc > 3 ? "red" : undefined} />
          <MetricCell label="CTR" value={formatPercent(campaign.ctr)} highlight={campaign.ctr > 2 ? "green" : campaign.ctr < 1 ? "red" : undefined} />
          <MetricCell label="Conversas" value={String(campaign.conversations)} highlight="green" />
          <MetricCell label="Custo/Conv." value={formatCurrency(campaign.costPerConversation)} highlight={campaign.costPerConversation > 0 && campaign.costPerConversation < 15 ? "green" : campaign.costPerConversation > 30 ? "red" : undefined} />
          <MetricCell label="Frequencia" value={campaign.frequency.toFixed(1) + "x"} highlight={campaign.frequency > 3 ? "red" : campaign.frequency > 2.5 ? "yellow" : undefined} />
        </div>

        <Separator className="my-3" />

        {/* Linha 1: status + orcamento atual + sugestao IA */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <Button
            variant={campaign.status === "ACTIVE" ? "destructive" : "default"}
            size="sm"
            onClick={handleToggleStatus}
            disabled={loading !== null}
          >
            {loading === "status" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : campaign.status === "ACTIVE" ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {campaign.status === "ACTIVE" ? "Pausar campanha" : "Ativar campanha"}
          </Button>

          <div className="flex items-center gap-2 text-xs">
            <Wallet className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Orcamento atual:</span>
            <span className="font-semibold">{currentBudget > 0 ? `${formatCurrency(currentBudget)}/dia` : "indisponivel"}</span>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs ${
              suggestion.tone === "green" ? "bg-green-50 border-green-200 text-green-800" :
              suggestion.tone === "red" ? "bg-red-50 border-red-200 text-red-800" :
              suggestion.tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-800" :
              "bg-muted border-muted-foreground/20 text-muted-foreground"
            }`}
            title={suggestion.reason}
          >
            <Brain className="h-3 w-3" />
            <span className="font-medium">Sugestao IA: {suggestion.label}</span>
            {suggestion.deltaPct !== 0 && (
              <Button
                size="sm"
                variant={suggestion.tone === "green" ? "default" : suggestion.tone === "red" ? "destructive" : "outline"}
                className="h-6 px-2 text-xs ml-1"
                disabled={loading !== null}
                onClick={handleApplySuggestion}
              >
                {loading === "suggestion" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
              </Button>
            )}
          </div>
        </div>

        {/* Linha 2: ajustes rapidos + edicao manual */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Ajuste rapido:</span>
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-red-200 text-red-700 hover:bg-red-50" disabled={loading !== null} onClick={() => handleQuickAdjust(-20, "minus20")}>
              {loading === "minus20" ? <Loader2 className="h-3 w-3 animate-spin" /> : "-20%"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-red-200 text-red-700 hover:bg-red-50" disabled={loading !== null} onClick={() => handleQuickAdjust(-10, "minus10")}>
              {loading === "minus10" ? <Loader2 className="h-3 w-3 animate-spin" /> : "-10%"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50" disabled={loading !== null} onClick={() => handleQuickAdjust(10, "plus10")}>
              {loading === "plus10" ? <Loader2 className="h-3 w-3 animate-spin" /> : "+10%"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50" disabled={loading !== null} onClick={() => handleQuickAdjust(20, "plus20")}>
              {loading === "plus20" ? <Loader2 className="h-3 w-3 animate-spin" /> : "+20%"}
            </Button>
          </div>

          {editingBudget ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                className="w-24 h-8 text-sm"
                placeholder={currentBudget > 0 ? currentBudget.toFixed(2) : "5.00"}
                min="1"
                step="0.50"
                onKeyDown={(e) => e.key === "Enter" && handleUpdateBudget()}
              />
              <span className="text-xs text-muted-foreground">/dia</span>
              <Button size="sm" onClick={handleUpdateBudget} disabled={loading !== null}>
                {loading === "budget" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingBudget(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => { setEditingBudget(true); setNewBudget(currentBudget > 0 ? currentBudget.toFixed(2) : ""); }}>
              <Pencil className="h-3 w-3 mr-1" />
              Valor manual
            </Button>
          )}
        </div>

        {/* Conjuntos de anuncios (adsets) expansiveis */}
        {campaignAdsets.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdsets((v) => !v)}
            >
              <Target className="h-3 w-3" />
              {showAdsets ? "Ocultar" : "Ver"} conjuntos de anuncios ({campaignAdsets.length})
            </button>
            {showAdsets && (
              <div className="mt-2 space-y-2">
                {campaignAdsets.map((adset) => {
                  const cpmAlert = adset.cpm > 50;
                  const cpmDanger = adset.cpm > 80;
                  return (
                    <div key={adset.id} className={`p-2.5 rounded-md border text-xs ${cpmDanger ? "bg-red-50 border-red-300" : cpmAlert ? "bg-amber-50 border-amber-200" : "bg-muted/30"}`}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{adset.name}</span>
                            <Badge variant={adset.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                              {adset.status === "ACTIVE" ? "Ativo" : "Pausado"}
                            </Badge>
                            {cpmDanger && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">CPM CRITICO</Badge>}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={adset.status === "ACTIVE" ? "destructive" : "default"}
                          className="h-6 px-2 text-[11px]"
                          disabled={loading !== null}
                          onClick={() => handleAdsetToggle(adset.id, adset.status !== "ACTIVE")}
                        >
                          {loading === `adset-${adset.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : adset.status === "ACTIVE" ? (
                            <><Pause className="h-3 w-3 mr-1" />Pausar</>
                          ) : (
                            <><Play className="h-3 w-3 mr-1" />Ativar</>
                          )}
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-[11px]">
                        <div><span className="text-muted-foreground">Orçam.:</span> <span className="font-medium">{adset.dailyBudget > 0 ? `${formatCurrency(adset.dailyBudget)}/d` : "CBO"}</span></div>
                        <div><span className="text-muted-foreground">Gasto:</span> <span className="font-medium">{formatCurrency(adset.spend)}</span></div>
                        <div><span className="text-muted-foreground">CPM:</span> <span className={`font-bold ${cpmDanger ? "text-red-700" : cpmAlert ? "text-amber-700" : adset.cpm < 25 ? "text-green-700" : ""}`}>{formatCurrency(adset.cpm)}</span></div>
                        <div><span className="text-muted-foreground">CPC:</span> <span className="font-medium">{formatCurrency(adset.cpc)}</span></div>
                        <div><span className="text-muted-foreground">CTR:</span> <span className="font-medium">{formatPercent(adset.ctr)}</span></div>
                        <div><span className="text-muted-foreground">Cliques:</span> <span className="font-medium">{formatNumber(adset.clicks)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCell({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "red" | "yellow" }) {
  const colors = { green: "text-green-700", red: "text-red-600", yellow: "text-yellow-600" } as const;
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${highlight ? colors[highlight] : ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function ChartCard({ title, children, height = 280 }: { title: string; children: React.ReactElement; height?: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function FunnelStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: label }} />
    </div>
  );
}

function MiniStat({ icon: Icon, color, value, label }: { icon: any; color: string; value: string; label: string }) {
  return (
    <Card><CardContent className="p-5 text-center">
      <Icon className={`h-6 w-6 mx-auto ${color} mb-2`} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent></Card>
  );
}

function MessengerStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function GradientStat({ value, label, cls, textCls, subCls }: { value: string; label: string; cls: string; textCls: string; subCls: string }) {
  return (
    <Card className={`bg-gradient-to-br ${cls}`}>
      <CardContent className="p-5 text-center">
        <p className={`text-3xl font-bold ${textCls}`}>{value}</p>
        <p className={`text-xs ${subCls}`}>{label}</p>
      </CardContent>
    </Card>
  );
}

// ============== STRATEGY & GROWTH (Educacao/IA benchmarks) ==============

function StrategyAndGrowthPanel({ kpis, campaignSummaries, formatCurrency, formatNumber, formatPercent }: { kpis: MarketingKPIs; campaignSummaries: CampaignSummary[]; formatCurrency: (v: number) => string; formatNumber: (v: number) => string; formatPercent: (v: number) => string }) {
  // Benchmarks Educacao/Cursos IA Brasil (2026)
  const benchmarks = {
    cpc: { value: 1.80, label: "CPC Medio Mercado", yours: kpis.avgCPC },
    ctr: { value: 1.50, label: "CTR Medio Mercado", yours: kpis.avgCTR },
    costPerConv: { value: 22.00, label: "Custo/Conversa Mercado", yours: kpis.costPerConversation },
    frequency: { value: 2.5, label: "Frequencia Ideal", yours: kpis.avgFrequency },
    convRate: { value: 6.0, label: "Conv. Rate Mercado", yours: kpis.conversionRate },
  };

  const competitorProfiles = [
    {
      name: "Cursos de IA Generativa (Mid-Ticket)",
      strategy: "VSL longo + webinar gratuito + remarketing pesado. Foco em transformacao profissional. Funil: anuncio video curto, webinar, oferta unica.",
      adSpend: "R$15-40K/mes",
      bestCreative: "VSL 3-5min com cases de alunos faturando R$10-30k/mes apos curso",
      cpc: "R$1,50-2,80",
      ctr: "1,2-2,5%",
    },
    {
      name: "Mentorias e Comunidades (Ticket Alto)",
      strategy: "Conteudo de autoridade + UGC de alunos + escassez por turma. Captura via WhatsApp ou aplicacao. Segmentacao por interesse em empreendedorismo.",
      adSpend: "R$20-60K/mes",
      bestCreative: "Reels do mentor em ambiente premium + carrossel de resultados de alunos",
      cpc: "R$1,80-3,50",
      ctr: "1,0-2,0%",
    },
    {
      name: "Eventos Presenciais IA/Tech",
      strategy: "Hooks de FOMO + countdown + ingresso urgencia. Captura via lead form ou Click-to-WhatsApp. Segmentacao geo + interesse profissional.",
      adSpend: "R$8-25K/mes (por evento)",
      bestCreative: "Video 15s com prova social (sala lotada, depoimentos rapidos) + CTA Garantir vaga",
      cpc: "R$1,20-2,40",
      ctr: "1,5-3,0%",
    },
  ];

  const creativeIdeas = [
    {
      type: "VIDEO HOOK - PARADA DE SCROLL",
      icon: Video,
      color: "text-red-600 bg-red-50 border-red-200",
      scripts: [
        {
          title: "Hook: O Custo de Ficar Parado",
          script: '"Enquanto voce ainda manda lead pro CRM na mao, tem gente faturando R$15k/mes com IA fazendo isso por elas." [B-roll de tela CRM + dashboards] "Na Masterclass de Salvador eu te mostro EXATAMENTE como." CTA: "Garanta sua vaga, restam X lugares"',
          duration: "30s",
          format: "Reels/Stories",
        },
        {
          title: "Bastidores + que Vencedores",
          script: '"Deixa eu te mostrar uma sala de operacao real de uma empresa que automatizou tudo com IA..." [POV CRM rodando sozinho] [Atendente recebendo lead ja qualificado] "Cada decisao ta no dado, ninguem mais perde tempo." CTA: "Veja o metodo presencialmente"',
          duration: "45s",
          format: "Feed/Reels",
        },
        {
          title: "Depoimento de Aluno (UGC)",
          script: '[Aluno olhando pra camera] "Eu trabalhava 12h por dia e ainda tava perdendo lead..." [Print de mensagem ignorada] "Depois da Masterclass, automatizei o funil inteiro e em 60 dias estourei meu mes." [Print de resultado] CTA: "Pode ser sua proxima historia"',
          duration: "60s",
          format: "Feed",
        },
      ],
    },
    {
      type: "COPY PARA MESSENGER / WHATSAPP",
      icon: MessageCircle,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      scripts: [
        {
          title: "Urgencia + Escassez",
          script: 'HEADLINE: "Restam X vagas pra Masterclass IA Salvador (09/06)"\nBODY: "Vou mostrar presencialmente o mesmo metodo que ja implementamos em grandes empresas pra faturar R$5k a R$15k/mes com IA pra negocios. Sem teoria, sem promessa magica, so o COMO."\nCTA: "QUERO GARANTIR MINHA VAGA"',
          duration: "N/A",
          format: "Messenger Campaign",
        },
        {
          title: "Educativo + CTA Suave",
          script: 'HEADLINE: "3 sinais de que sua operacao precisa de IA AGORA"\nBODY: "1. Voce ou seu time atende lead na mao (e perde leads)\n2. Voce nao sabe quanto custa cada cliente novo\n3. Voce repete a mesma tarefa toda semana\nSe marcou 1 ou mais, isso aqui pode mudar tudo."\nCTA: "QUERO ENTENDER O METODO"',
          duration: "N/A",
          format: "Engagement",
        },
      ],
    },
    {
      type: "CAMPANHAS DE EVENTO",
      icon: Star,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      scripts: [
        {
          title: "Pre-Lancamento (T-30 dias)",
          script: '"Vai rolar em Salvador a Masterclass que mostra COMO faturar de R$5k a R$15k/mes com IA." [Imagem do palco/local] "Eu vou pessoalmente apresentar o metodo que ja implementamos em grandes empresas." CTA: "Lista de espera AQUI"',
          duration: "30s",
          format: "Reach",
        },
        {
          title: "Aquecimento (T-10 dias)",
          script: '"Olha o que disse quem ja participou..." [3-4 depoimentos rapidos de alunos] "Faltam X dias pra Masterclass IA Salvador, vai virar antes que voce perceba." CTA: "Garanta sua presenca"',
          duration: "15s",
          format: "Stories + Feed",
        },
        {
          title: "Urgencia (T-3 dias)",
          script: '"Hoje fechamos vendas. Quem ja ta dentro vai aprender o metodo. Quem deixar pra depois, espera o proximo." [Countdown visual] CTA: "ULTIMAS VAGAS, COMPRAR AGORA"',
          duration: "15s",
          format: "Reels + Stories",
        },
      ],
    },
  ];

  const growthStrategies = [
    {
      title: "ESCALAR CAMPANHA MAIS EFICIENTE",
      priority: "ALTA",
      impact: "Imediato",
      description: campaignSummaries.length > 0 ? `Sua melhor campanha tem CPC de ${formatCurrency(campaignSummaries[0]?.cpc || 0)}. Aumente o orcamento em 20% a cada 3 dias, monitorando o CPC e a frequencia.` : "Identifique a campanha com menor custo/conversa e escale 20%/3dias.",
      metrics: `CPC atual medio: ${formatCurrency(kpis.avgCPC)} | Meta: manter abaixo de R$1,80`,
    },
    {
      title: "RENOVAR CRIATIVOS",
      priority: kpis.avgFrequency > 2.5 ? "CRITICA" : "ALTA",
      impact: "7-14 dias",
      description: `Frequencia em ${kpis.avgFrequency.toFixed(1)}x. Produza 3-5 novos criativos: depoimento de aluno, bastidores, hook de dor, hook de aspiracao, UGC.`,
      metrics: "Meta: reduzir frequencia para abaixo de 2.0x com criativos novos",
    },
    {
      title: "RETARGETING EM 3 CAMADAS",
      priority: "ALTA",
      impact: "14-30 dias",
      description: "Audiencias: 1) Assistiu video 75%+ (quente), 2) Visitou LP mas nao comprou (morno), 3) Iniciou conversa mas nao comprou (recuperacao). 20% do budget em retargeting.",
      metrics: "Benchmark: CPC 30-50% menor que prospeccao",
    },
    {
      title: "LOOKALIKE DE COMPRADORES KIRVANO",
      priority: "ALTA",
      impact: "14-21 dias",
      description: "Criar Lookalike 1% dos compradores da Masterclass (via Kirvano webhook ja sincronizado). Tende a ter CPC 20-40% menor.",
      metrics: `Base atual: alimentada via Kirvano + CAPI Purchase event`,
    },
    {
      title: "FUNIL DE CONTEUDO ORGANICO + PAGO",
      priority: "MEDIA",
      impact: "30-60 dias",
      description: "Postar 3-5 Reels/semana com conteudo de IA pra negocios. Reels que viralizam vira criativo pago, autoridade reduz CPC.",
      metrics: "Meta: 2-3 Reels com 100K+ views/mes alimentando pago",
    },
    {
      title: "INDICACAO DE ALUNO",
      priority: "MEDIA",
      impact: "30-90 dias",
      description: "Programa: aluno indica 3 pessoas, ganha 1 mentoria 1:1 com Carlos. Custo de aquisicao via indicacao: praticamente zero.",
      metrics: "Benchmark: 15-25% dos alunos ativos indicam",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Benchmarks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-600" />Sua Performance vs Mercado de Educacao/IA</CardTitle>
          <CardDescription>Benchmarks do segmento de cursos de IA, mentorias e eventos profissionais no Brasil</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Object.entries(benchmarks).map(([key, b]) => {
              const isGood = key === "frequency"
                ? b.yours <= b.value
                : key === "cpc" || key === "costPerConv"
                  ? b.yours > 0 && b.yours <= b.value
                  : b.yours >= b.value;
              return (
                <div key={key} className={`p-4 rounded-lg border ${isGood ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{b.label}</span>
                    {isGood ? <Badge className="bg-green-600 text-xs">Acima</Badge> : <Badge variant="destructive" className="text-xs">Abaixo</Badge>}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Voce</p>
                      <p className={`text-lg font-bold ${isGood ? "text-green-700" : "text-red-600"}`}>
                        {key === "cpc" || key === "costPerConv" ? formatCurrency(b.yours) : formatPercent(b.yours)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Mercado</p>
                      <p className="text-lg font-bold text-slate-500">
                        {key === "cpc" || key === "costPerConv" ? formatCurrency(b.value) : formatPercent(b.value)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Concorrentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Crosshair className="h-5 w-5 text-violet-600" />Perfil dos Concorrentes, Segmento Educacao/IA</CardTitle>
          <CardDescription>Analise dos principais perfis e suas estrategias de trafego</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {competitorProfiles.map((comp, i) => (
              <div key={i} className="p-4 rounded-lg border bg-slate-50 space-y-3">
                <h4 className="font-bold text-sm flex items-center gap-2"><Megaphone className="h-4 w-4 text-violet-500" />{comp.name}</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">Estrategia:</span>
                    <p className="text-slate-600 mt-0.5">{comp.strategy}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">Budget: {comp.adSpend}</Badge>
                    <Badge variant="outline" className="text-xs">CPC: {comp.cpc}</Badge>
                    <Badge variant="outline" className="text-xs">CTR: {comp.ctr}</Badge>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Criativo Top:</span>
                    <p className="text-slate-600 mt-0.5">{comp.bestCreative}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Growth Strategies */}
      <Card className="border-violet-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-violet-600" />Plano de Growth, Acoes Priorizadas</CardTitle>
          <CardDescription>Estrategias ordenadas por prioridade e impacto no crescimento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {growthStrategies.map((strategy, i) => (
              <div key={i} className={`p-4 rounded-lg border ${strategy.priority === "CRITICA" ? "bg-red-50 border-red-200" : strategy.priority === "ALTA" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-400">#{i + 1}</span>
                    <h4 className="font-bold text-sm">{strategy.title}</h4>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={strategy.priority === "CRITICA" ? "destructive" : strategy.priority === "ALTA" ? "default" : "secondary"} className="text-xs">{strategy.priority}</Badge>
                    <Badge variant="outline" className="text-xs"><Timer className="h-3 w-3 mr-1" />{strategy.impact}</Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-700 mb-2">{strategy.description}</p>
                <p className="text-[10px] text-slate-500 font-mono bg-white/50 p-1 rounded">{strategy.metrics}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Criativos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-600" />Roteiros de Criativos &amp; Campanhas</CardTitle>
          <CardDescription>Scripts prontos para produzir, baseados nos formatos que mais convertem no segmento Educacao/IA</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {creativeIdeas.map((category, i) => {
              const Icon = category.icon;
              return (
                <div key={i} className="space-y-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${category.color}`}>
                    <Icon className="h-4 w-4" />
                    <span className="font-bold text-sm">{category.type}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {category.scripts.map((script, j) => (
                      <div key={j} className="p-4 rounded-lg border bg-white space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="font-semibold text-sm">{script.title}</h5>
                          <div className="flex gap-1">
                            {script.duration !== "N/A" && <Badge variant="outline" className="text-[10px]">{script.duration}</Badge>}
                            <Badge variant="secondary" className="text-[10px]">{script.format}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{script.script}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Reestruturacao de Funil */}
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-600" />Reestruturacao de Funil em 3 Camadas</CardTitle>
          <CardDescription>De campanhas avulsas para funil estrategico</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FunnelLayerCard title="TOPO, Prospeccao" budget="50% budget" color="cyan" items={["Objetivo: Alcance / Video Views", "Publico: Interesses amplos + LAL 5-10%", "Formato: Reels 15-30s (educativo)", "Meta: CPM abaixo de R$25", "Exclusao: compradores atuais"]} />
            <FunnelLayerCard title="MEIO, Engajamento" budget="30% budget" color="amber" items={["Objetivo: Conversas Messenger / LP", "Publico: Retargeting video 50%+", "Formato: Carrossel + Depoimento de aluno", "Meta: Custo/conversa abaixo de R$15", "Foco em prova social"]} />
            <FunnelLayerCard title="FUNDO, Conversao" budget="20% budget" color="emerald" items={["Objetivo: Compras Masterclass", "Publico: LAL 1% compradores + quentes", "Formato: Oferta direta + urgencia", "Meta: ROAS acima de 3x", "CTA agressivo com escassez"]} />
          </div>
          <p className="text-xs text-emerald-700 font-medium mt-3">
            Resultado esperado: Frequencia cai de {kpis.avgFrequency.toFixed(1)}x para 1,2-1,5x | Custo/conversa cai de {formatCurrency(kpis.costPerConversation)} para R$8-12
          </p>
        </CardContent>
      </Card>

      {/* Calendario de Eventos + que Vencedores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-600" />Calendario de Lancamentos + que Vencedores 2026</CardTitle>
          <CardDescription>Planejamento de campanhas por evento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { month: "MAI", name: "Pre-Lancamento Salvador", hook: "Lista de espera Masterclass", offer: "Vagas limitadas", active: true },
              { month: "JUN", name: "Masterclass IA Salvador", hook: "Como faturar R$5-15k/mes com IA", offer: "Ticket R$47 (de R$497)", active: false },
              { month: "JUL", name: "Pos-Venda Mentoria", hook: "Upsell para alunos Masterclass", offer: "Mentoria 1:1 + grupo", active: false },
              { month: "AGO", name: "Masterclass Sao Paulo", hook: "Replicar metodo em SP", offer: "Early bird R$77", active: false },
              { month: "SET", name: "Reprograme 10x", hook: "Programa de 10 semanas", offer: "Lancamento de turma", active: false },
              { month: "OUT", name: "Black Marketing", hook: "Antecipacao Black Friday", offer: "Bundle Masterclass + R10x", active: false },
              { month: "NOV", name: "Black Friday + que Vencedores", hook: "Maior desconto do ano", offer: "Ate 50% OFF", active: false },
              { month: "DEZ", name: "Planejamento 2027", hook: "Comece o ano com IA", offer: "Pre-venda Mentoria 2027", active: false },
            ].map((c, i) => (
              <div key={i} className={`p-3 rounded-lg border text-xs space-y-1 ${c.active ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-400" : "bg-muted/20"}`}>
                <div className="flex items-center justify-between">
                  <Badge variant={c.active ? "default" : "outline"} className="text-[10px]">{c.month}</Badge>
                  {c.active && <Badge className="bg-emerald-600 text-[10px]">AGORA</Badge>}
                </div>
                <p className="font-bold">{c.name}</p>
                <p className="text-muted-foreground">{c.hook}</p>
                <p className="text-emerald-700 font-medium">{c.offer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analise dos Criativos Atuais */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-orange-600" />Diagnostico Rapido dos Anuncios Atuais</CardTitle>
          <CardDescription>O que esta funcionando e o que precisa de atencao</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border bg-white space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" />O que esta funcionando</h4>
              <ul className="text-xs space-y-1 text-slate-700">
                {kpis.avgCPC > 0 && kpis.avgCPC < 1.8 && <li>- CPC abaixo do mercado ({formatCurrency(kpis.avgCPC)} vs R$1,80 benchmark)</li>}
                {kpis.avgCTR > 1.5 && <li>- CTR acima da media ({formatPercent(kpis.avgCTR)} vs 1,5% benchmark)</li>}
                {kpis.totalVideoViews > 0 && <li>- Videos gerando engajamento ({formatNumber(kpis.totalVideoViews)} views)</li>}
                {kpis.totalSaves > 0 && <li>- Conteudo sendo salvo ({kpis.totalSaves} salvamentos, sinal de valor)</li>}
                <li>- Funil Meta -&gt; LP -&gt; Kirvano -&gt; CRM -&gt; CAPI esta integrado</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border bg-white space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Oportunidades de Melhoria</h4>
              <ul className="text-xs space-y-1 text-slate-700">
                {kpis.avgFrequency > 2.5 && <li>- <strong>Frequencia alta ({kpis.avgFrequency.toFixed(1)}x)</strong>, audiencia ja vista demais, precisa de criativos frescos</li>}
                {kpis.conversionRate > 0 && kpis.conversionRate < 5 && <li>- <strong>Conversao baixa ({formatPercent(kpis.conversionRate)})</strong>, revisar landing page e CTA</li>}
                <li>- <strong>Falta UGC de alunos</strong>, depoimento de quem ja fez Masterclass converte 2-3x mais que criativo profissional</li>
                <li>- <strong>Testar Reels curtos (15s)</strong>, formato com CTR 40% maior que video longo no segmento</li>
                <li>- <strong>Implementar retargeting estruturado</strong>, ainda nao temos camadas separadas por temperatura</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border bg-white space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2"><Rocket className="h-4 w-4 text-violet-600" />Proximos Passos (Sprint de 2 Semanas)</h4>
              <ul className="text-xs space-y-1 text-slate-700">
                <li>1. <strong>Coletar 3 UGCs</strong> de alunos da Masterclass (depoimento celular, 30-60s)</li>
                <li>2. <strong>Produzir 2 Reels de 15s</strong> com hooks de parada (ver roteiros acima)</li>
                <li>3. <strong>Configurar retargeting 3 camadas</strong> (Video 75%, LP visit, Conversa sem compra)</li>
                <li>4. <strong>Criar LAL 1% dos compradores Kirvano</strong> (Custom Audience ja exportada via CRM)</li>
                <li>5. <strong>Rotacionar criativos a cada 7-10 dias</strong> pra manter frequencia abaixo de 2.0x</li>
                <li>6. <strong>Testar campanha de compras diretas</strong> (OUTCOME_SALES) com pixel Purchase vs conversa atual</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelLayerCard({ title, budget, color, items }: { title: string; budget: string; color: "cyan" | "amber" | "emerald"; items: string[] }) {
  const map = {
    cyan: { border: "border-cyan-300", bg: "bg-cyan-50", badge: "bg-cyan-600", text: "text-cyan-700" },
    amber: { border: "border-amber-300", bg: "bg-amber-50", badge: "bg-amber-600", text: "text-amber-700" },
    emerald: { border: "border-emerald-300", bg: "bg-emerald-50", badge: "bg-emerald-600", text: "text-emerald-700" },
  };
  const c = map[color];
  return (
    <div className={`p-4 rounded-lg border-2 ${c.border} ${c.bg} space-y-2`}>
      <div className="flex items-center justify-between">
        <Badge className={c.badge}>{title}</Badge>
        <span className={`text-sm font-bold ${c.text}`}>{budget}</span>
      </div>
      <ul className="text-[11px] text-slate-600 space-y-1">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

// ============== ATTRIBUTION PANEL ==============

function AttributionPanel({ refCodes }: { refCodes: Record<string, string> }) {
  const refEntries = Object.entries(refCodes);
  return (
    <div className="space-y-6">
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-violet-600" />Sistema de Atribuicao Ponta a Ponta</CardTitle>
          <CardDescription>Rastreio completo: Meta Ad &rarr; WhatsApp &rarr; LP &rarr; Kirvano &rarr; CRM &rarr; Venda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              {[
                { label: "Meta Ad Click", color: "bg-blue-100 border-blue-300 text-blue-700", icon: "Meta" },
                { label: "LP / WhatsApp", color: "bg-green-100 border-green-300 text-green-700", icon: "LP" },
                { label: "Lead Criado", color: "bg-violet-100 border-violet-300 text-violet-700", icon: "Lead" },
                { label: "Kirvano Pagamento", color: "bg-cyan-100 border-cyan-300 text-cyan-700", icon: "Kirvano" },
                { label: "CRM POS_VENDA", color: "bg-amber-100 border-amber-300 text-amber-700", icon: "CRM" },
                { label: "CAPI Purchase", color: "bg-emerald-100 border-emerald-300 text-emerald-700", icon: "CAPI" },
                { label: "Venda Atribuida", color: "bg-pink-100 border-pink-300 text-pink-700", icon: "Sale" },
              ].map((step, i) => (
                <React.Fragment key={i}>
                  <div className={`px-3 py-2 rounded-lg border font-medium ${step.color}`}>
                    {step.label}
                  </div>
                  {i < 6 && <span className="text-muted-foreground font-bold">&rarr;</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-white space-y-2">
                <div className="flex items-center gap-2"><Badge className="bg-blue-600">1</Badge><h4 className="font-bold text-sm">Ref Codes no WhatsApp</h4></div>
                <p className="text-xs text-slate-600">
                  Cada campanha tem um codigo [REF:CODIGO] na mensagem pre-preenchida do anuncio Click-to-WhatsApp.
                  Quando o lead manda a mensagem, o CRM identifica de qual campanha veio.
                </p>
                <Badge variant="outline" className="text-xs">Status: Configurado</Badge>
              </div>
              <div className="p-4 rounded-lg border bg-white space-y-2">
                <div className="flex items-center gap-2"><Badge className="bg-emerald-600">2</Badge><h4 className="font-bold text-sm">Meta Conversions API</h4></div>
                <p className="text-xs text-slate-600">
                  Quando o lead avanca no pipeline (lead, agendado, comprou), o CRM e o webhook Kirvano enviam o evento
                  de volta para o Meta via CAPI. Isso permite otimizar campanhas para COMPRAS reais.
                </p>
                <Badge variant="outline" className="text-xs">Status: Ativo (Pixel: 960069026909883)</Badge>
              </div>
              <div className="p-4 rounded-lg border bg-white space-y-2">
                <div className="flex items-center gap-2"><Badge className="bg-amber-600">3</Badge><h4 className="font-bold text-sm">Custom Audiences</h4></div>
                <p className="text-xs text-slate-600">
                  Exportar leads e compradores como Custom Audiences no Meta.
                  Criar retargeting para quem iniciou conversa mas nao comprou + LAL dos compradores.
                </p>
                <Badge variant="outline" className="text-xs">Status: Pronto para uso</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-600" />Mapa de Eventos, Meta Conversions API</CardTitle>
          <CardDescription>Eventos disparados automaticamente conforme o lead avanca</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-semibold">Trigger</th>
                  <th className="text-left p-2 font-semibold">Evento Meta</th>
                  <th className="text-left p-2 font-semibold">Para que serve</th>
                  <th className="text-center p-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { stage: "LP form preenchido", event: "Lead", purpose: "Registra lead no Meta para otimizacao", active: true },
                  { stage: "Click WA Ad", event: "Contact", purpose: "Inicio de conversa via Meta Ads", active: true },
                  { stage: "Lead agendado (CRM)", event: "Schedule", purpose: "Meta otimiza para agendamentos reais", active: true },
                  { stage: "Lead atendido (CRM)", event: "CompleteRegistration", purpose: "Confirma comparecimento, alimenta LAL", active: true },
                  { stage: "Compra Kirvano", event: "Purchase", purpose: "Registra venda para calcular ROAS real", active: true },
                  { stage: "FOLLOWUP", event: "-", purpose: "Cadencia interna (nao dispara)", active: false },
                  { stage: "PERDIDO", event: "-", purpose: "Nao envia para Meta", active: false },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-medium">{row.stage}</td>
                    <td className="p-2"><code className="bg-muted px-1 py-0.5 rounded text-[10px]">{row.event}</code></td>
                    <td className="p-2 text-slate-600">{row.purpose}</td>
                    <td className="p-2 text-center">
                      <Badge variant={row.active ? "default" : "secondary"} className="text-[10px]">{row.active ? "Ativo" : "N/A"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-800">
              <strong>Impacto:</strong> Com Purchase via CAPI, o Meta otimiza campanhas para COMPRADORES (nao apenas cliques).
              Tende a reduzir custo por venda em 30-50% e aumentar a qualidade dos leads.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-600" />Codigos de Rastreio (Ref Codes)</CardTitle>
          <CardDescription>Configure esses codigos na mensagem pre-preenchida de cada anuncio Click-to-WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-800 mb-1">Como usar:</p>
              <p className="text-xs text-emerald-700">Meta Ads Manager &rarr; Anuncio &rarr; Mensagem pre-preenchida, adicione o codigo ao final:</p>
              <code className="text-xs bg-white p-1.5 rounded block mt-1 text-emerald-900">"Oi! Vi seu anuncio sobre a Masterclass IA e quero saber mais! [REF:MASTERCLASS_SSA]"</code>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Codigo</th>
                    <th className="text-left p-2 font-semibold">Campanha</th>
                    <th className="text-left p-2 font-semibold">Texto para o Anuncio</th>
                  </tr>
                </thead>
                <tbody>
                  {refEntries.map(([code, name], i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="p-2"><code className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-[10px] font-bold">[REF:{code}]</code></td>
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-slate-500 font-mono text-[10px]">Oi! Vi seu anuncio e quero saber mais! [REF:{code}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Trophy className="h-5 w-5 text-amber-400" />Melhores Praticas, Atribuicao</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-amber-400">Para os Anuncios</h4>
              <BulletList items={[
                "Use Click-to-WhatsApp ou direcione pra LP /masterclass-ia, nao link externo aleatorio",
                "Sempre inclua [REF:CODIGO] na mensagem pre-preenchida",
                "Um codigo diferente por campanha/conjunto de anuncios",
                "Campanhas de LP: use UTM params (utm_source=meta&utm_campaign=...)",
              ]} />
            </div>
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-amber-400">Para o Pipeline</h4>
              <BulletList items={[
                "Mova leads no Kanban em tempo real, cada mudanca dispara CAPI",
                "Webhook Kirvano dispara Purchase automaticamente no Meta + email confirmacao Resend",
                "Em POS_VENDA, o valor da venda alimenta ROAS real",
                "Atualize Custom Audiences semanalmente via export do CRM",
              ]} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="text-xs space-y-2 text-slate-300">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2">
          <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
