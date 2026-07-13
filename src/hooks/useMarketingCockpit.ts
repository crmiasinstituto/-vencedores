import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaAccountBalance {
  id: string;
  name: string;
  balance: number;
  amountSpent: number;
  spendCap: number;
  availableBalance: number;
  fundingSource: string;
  accountStatus: number;
  currency?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaCampaignInsight {
  campaign_name: string;
  campaign_id: string;
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  cpc: string;
  cpm: string;
  ctr: string;
  frequency: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
}

export interface MetaDailyInsight {
  campaign_name: string;
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  cpc: string;
  cpm: string;
  ctr: string;
  frequency: string;
  actions?: MetaAction[];
  date_start: string;
  date_stop: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  objective: string;
  dailyBudget: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  conversations: number;
  costPerConversation: number;
  videoViews: number;
  engagement: number;
  linkClicks: number;
  comments: number;
  reactions: number;
  saves: number;
  shares: number;
  messengerDepth2: number;
  messengerDepth3: number;
  messengerDepth5: number;
  firstReply: number;
  leads: number;
  purchases: number;
}

export interface DailyData {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversations: number;
  cpc: number;
  ctr: number;
  videoViews: number;
  engagement: number;
}

export interface MarketingKPIs {
  totalSpend: number;
  totalImpressions: number;
  totalReach: number;
  totalClicks: number;
  avgCPC: number;
  avgCPM: number;
  avgCTR: number;
  avgFrequency: number;
  totalConversations: number;
  costPerConversation: number;
  totalVideoViews: number;
  totalEngagement: number;
  totalLinkClicks: number;
  totalComments: number;
  totalReactions: number;
  totalSaves: number;
  totalFirstReply: number;
  totalLeads: number;
  totalPurchases: number;
  conversionRate: number;
  bestCampaign: string;
  worstCampaign: string;
}

export type InsightActionType =
  | "boost_budget"     // aumentar daily_budget % nos targetCampaignIds
  | "cut_budget"       // reduzir daily_budget % nos targetCampaignIds
  | "pause_campaigns"  // pausar campanhas saturadas
  | "reallocate";      // cortar uma e aumentar outra

export interface InsightAction {
  type: InsightActionType;
  label: string;                     // texto do botao
  deltaPct?: number;                 // p/ boost/cut/reallocate
  targetCampaignIds: string[];       // a quais campanhas aplica
  fromCampaignId?: string;           // p/ reallocate
  toCampaignId?: string;             // p/ reallocate
}

export interface AdsetSummary {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  optimization_goal: string | null;
  dailyBudget: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  frequency: number;
}

export interface AIInsight {
  type: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
  action?: string;
  actionable?: InsightAction;
}

function getActionValue(actions: MetaAction[] | undefined, actionType: string): number {
  if (!actions) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? Number(action.value) : 0;
}

export function useMarketingCockpit(days: number = 30) {
  return useQuery({
    queryKey: ["marketing-cockpit", days],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("marketing-meta", {
        body: { action: "cockpit_data", days },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha ao buscar dados Meta");

      const accountBalance = (data.accountBalance ?? null) as MetaAccountBalance | null;
      const campaigns = (data.campaigns ?? []) as MetaCampaign[];
      const insights = (data.insights ?? []) as MetaCampaignInsight[];
      const dailyRaw = (data.daily ?? []) as MetaDailyInsight[];
      const adsetBudgets = (data.adsetBudgets ?? {}) as Record<string, { dailyCents: number; activeCount: number; total: number }>;
      const adsetsRaw = (data.adsets ?? []) as Array<Record<string, any>>;
      const adsets: AdsetSummary[] = adsetsRaw.map((a) => ({
        id: String(a.id),
        name: String(a.name ?? ""),
        campaign_id: String(a.campaign_id ?? ""),
        status: String(a.status ?? "UNKNOWN"),
        optimization_goal: a.optimization_goal ?? null,
        dailyBudget: Number(a.daily_budget_brl ?? 0),
        spend: Number(a.spend ?? 0),
        impressions: Number(a.impressions ?? 0),
        reach: Number(a.reach ?? 0),
        clicks: Number(a.clicks ?? 0),
        cpm: Number(a.cpm ?? 0),
        cpc: Number(a.cpc ?? 0),
        ctr: Number(a.ctr ?? 0),
        frequency: Number(a.frequency ?? 0),
      }));

      const campaignSummaries: CampaignSummary[] = insights.map((insight) => {
        const campaign = campaigns.find((c) => c.id === insight.campaign_id);
        const conversations =
          getActionValue(insight.actions, "onsite_conversion.messaging_conversation_started_7d") ||
          getActionValue(insight.actions, "onsite_conversion.messaging_first_reply");
        const spend = Number(insight.spend ?? 0);
        // Daily budget: usa o da campanha (CBO) ou soma dos adsets (ABO)
        const campaignDailyCents = Number(campaign?.daily_budget || 0);
        const adsetSumCents = adsetBudgets[insight.campaign_id]?.dailyCents ?? 0;
        const dailyBudget = (campaignDailyCents > 0 ? campaignDailyCents : adsetSumCents) / 100;
        return {
          id: insight.campaign_id,
          name: insight.campaign_name,
          status: campaign?.status || "UNKNOWN",
          objective: campaign?.objective || "",
          dailyBudget,
          spend,
          impressions: Number(insight.impressions ?? 0),
          reach: Number(insight.reach ?? 0),
          clicks: Number(insight.clicks ?? 0),
          cpc: Number(insight.cpc ?? 0),
          cpm: Number(insight.cpm ?? 0),
          ctr: Number(insight.ctr ?? 0),
          frequency: Number(insight.frequency ?? 0),
          conversations,
          costPerConversation: conversations > 0 ? spend / conversations : 0,
          videoViews: getActionValue(insight.actions, "video_view"),
          engagement: getActionValue(insight.actions, "post_engagement"),
          linkClicks: getActionValue(insight.actions, "link_click"),
          comments: getActionValue(insight.actions, "comment"),
          reactions: getActionValue(insight.actions, "post_reaction"),
          saves: getActionValue(insight.actions, "onsite_conversion.post_net_save"),
          shares: getActionValue(insight.actions, "post"),
          messengerDepth2: getActionValue(
            insight.actions,
            "onsite_conversion.messaging_user_depth_2_message_send",
          ),
          messengerDepth3: getActionValue(
            insight.actions,
            "onsite_conversion.messaging_user_depth_3_message_send",
          ),
          messengerDepth5: getActionValue(
            insight.actions,
            "onsite_conversion.messaging_user_depth_5_message_send",
          ),
          firstReply: getActionValue(insight.actions, "onsite_conversion.messaging_first_reply"),
          leads:
            getActionValue(insight.actions, "lead") ||
            getActionValue(insight.actions, "onsite_conversion.lead_grouped"),
          purchases:
            getActionValue(insight.actions, "purchase") ||
            getActionValue(insight.actions, "offsite_conversion.fb_pixel_purchase"),
        };
      });

      const dailyData: DailyData[] = dailyRaw
        .map((d) => ({
          date: d.date_start,
          spend: Number(d.spend ?? 0),
          impressions: Number(d.impressions ?? 0),
          reach: Number(d.reach ?? 0),
          clicks: Number(d.clicks ?? 0),
          conversations: getActionValue(
            d.actions,
            "onsite_conversion.messaging_conversation_started_7d",
          ),
          cpc: Number(d.cpc ?? 0),
          ctr: Number(d.ctr ?? 0),
          videoViews: getActionValue(d.actions, "video_view"),
          engagement: getActionValue(d.actions, "post_engagement"),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalSpend = campaignSummaries.reduce((s, c) => s + c.spend, 0);
      const totalClicks = campaignSummaries.reduce((s, c) => s + c.clicks, 0);
      const totalConversations = campaignSummaries.reduce((s, c) => s + c.conversations, 0);
      const totalImpressions = campaignSummaries.reduce((s, c) => s + c.impressions, 0);

      const kpis: MarketingKPIs = {
        totalSpend,
        totalImpressions,
        totalReach: campaignSummaries.reduce((s, c) => s + c.reach, 0),
        totalClicks,
        avgCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
        avgCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
        avgCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        avgFrequency:
          campaignSummaries.length > 0
            ? campaignSummaries.reduce((s, c) => s + c.frequency, 0) / campaignSummaries.length
            : 0,
        totalConversations,
        costPerConversation: totalConversations > 0 ? totalSpend / totalConversations : 0,
        totalVideoViews: campaignSummaries.reduce((s, c) => s + c.videoViews, 0),
        totalEngagement: campaignSummaries.reduce((s, c) => s + c.engagement, 0),
        totalLinkClicks: campaignSummaries.reduce((s, c) => s + c.linkClicks, 0),
        totalComments: campaignSummaries.reduce((s, c) => s + c.comments, 0),
        totalReactions: campaignSummaries.reduce((s, c) => s + c.reactions, 0),
        totalSaves: campaignSummaries.reduce((s, c) => s + c.saves, 0),
        totalFirstReply: campaignSummaries.reduce((s, c) => s + c.firstReply, 0),
        totalLeads: campaignSummaries.reduce((s, c) => s + c.leads, 0),
        totalPurchases: campaignSummaries.reduce((s, c) => s + c.purchases, 0),
        conversionRate: totalClicks > 0 ? (totalConversations / totalClicks) * 100 : 0,
        bestCampaign:
          campaignSummaries.length > 0
            ? campaignSummaries.reduce((best, c) => (c.conversations > best.conversations ? c : best)).name
            : "",
        worstCampaign:
          campaignSummaries.length > 0
            ? campaignSummaries.reduce((worst, c) =>
                c.costPerConversation > worst.costPerConversation && c.conversations > 0 ? c : worst,
              ).name
            : "",
      };

      const aiInsights = generateAIInsights(kpis, campaignSummaries);

      return {
        accountBalance,
        campaigns,
        campaignSummaries,
        adsets,
        dailyData,
        kpis,
        aiInsights,
        errors: (data.errors ?? []) as string[],
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

function generateAIInsights(kpis: MarketingKPIs, campaigns: CampaignSummary[]): AIInsight[] {
  const insights: AIInsight[] = [];
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");

  // Frequency
  if (kpis.avgFrequency > 3) {
    const saturated = campaigns.filter((c) => c.frequency > 3).map((c) => c.id);
    insights.push({
      type: "danger",
      title: "Saturacao de Audiencia",
      description: `Frequencia media de ${kpis.avgFrequency.toFixed(1)}x. Audiencia esta vendo os anuncios demais, causando fadiga de criativo.`,
      action: "Expandir publico-alvo ou renovar criativos urgentemente.",
      actionable: saturated.length > 0 ? {
        type: "cut_budget",
        label: `Reduzir 20% nas ${saturated.length} saturadas`,
        deltaPct: -20,
        targetCampaignIds: saturated,
      } : undefined,
    });
  } else if (kpis.avgFrequency > 2.5) {
    insights.push({
      type: "warning",
      title: "Frequencia em Alerta",
      description: `Frequencia media de ${kpis.avgFrequency.toFixed(1)}x. Proximidade do limite de saturacao.`,
      action: "Monitorar e preparar novos criativos para rotacao.",
    });
  }

  // CPC (benchmark Educacao/IA: <R$1,80 otimo, >R$3,00 ruim)
  if (kpis.avgCPC > 0 && kpis.avgCPC < 1.8) {
    const winners = activeCampaigns.filter((c) => c.cpc > 0 && c.cpc < 1.8).map((c) => c.id);
    insights.push({
      type: "success",
      title: "CPC Excelente",
      description: `CPC medio de R$${kpis.avgCPC.toFixed(2)} esta abaixo de R$1,80, otimo para o segmento Educacao/IA.`,
      actionable: winners.length > 0 ? {
        type: "boost_budget",
        label: `Escalar 10% em ${winners.length} campanha(s)`,
        deltaPct: 10,
        targetCampaignIds: winners,
      } : undefined,
    });
  } else if (kpis.avgCPC > 3.0) {
    const expensive = activeCampaigns.filter((c) => c.cpc > 3).map((c) => c.id);
    insights.push({
      type: "danger",
      title: "CPC Elevado",
      description: `CPC medio de R$${kpis.avgCPC.toFixed(2)} acima do benchmark do segmento. Revisar segmentacao e criativos.`,
      action: "Testar novos publicos (lookalike de compradores) e formatos.",
      actionable: expensive.length > 0 ? {
        type: "cut_budget",
        label: `Reduzir 20% em ${expensive.length} com CPC alto`,
        deltaPct: -20,
        targetCampaignIds: expensive,
      } : undefined,
    });
  }

  // CTR
  if (kpis.avgCTR > 2.0) {
    const ctrWinners = activeCampaigns.filter((c) => c.ctr > 2).map((c) => c.id);
    insights.push({
      type: "success",
      title: "CTR Acima da Media",
      description: `Taxa de cliques de ${kpis.avgCTR.toFixed(2)}% indica boa relevancia dos anuncios.`,
      actionable: ctrWinners.length > 0 ? {
        type: "boost_budget",
        label: `Escalar 10% em ${ctrWinners.length} campanha(s)`,
        deltaPct: 10,
        targetCampaignIds: ctrWinners,
      } : undefined,
    });
  } else if (kpis.avgCTR > 0 && kpis.avgCTR < 1.0) {
    const lowCtr = activeCampaigns.filter((c) => c.ctr > 0 && c.ctr < 1).map((c) => c.id);
    insights.push({
      type: "danger",
      title: "CTR Baixo",
      description: `Taxa de cliques de ${kpis.avgCTR.toFixed(2)}% abaixo do ideal. Os criativos nao estao engajando.`,
      action: "Revisar hooks, thumbnails e CTA dos anuncios.",
      actionable: lowCtr.length > 0 ? {
        type: "cut_budget",
        label: `Reduzir 10% em ${lowCtr.length} com CTR baixo`,
        deltaPct: -10,
        targetCampaignIds: lowCtr,
      } : undefined,
    });
  }

  // Conversion rate
  if (kpis.conversionRate > 8) {
    insights.push({
      type: "success",
      title: "Conversao Alta",
      description: `${kpis.conversionRate.toFixed(1)}% dos cliques geram conversa, excelente funil.`,
    });
  } else if (kpis.conversionRate > 0 && kpis.conversionRate < 3) {
    insights.push({
      type: "warning",
      title: "Conversao Baixa",
      description: `Apenas ${kpis.conversionRate.toFixed(1)}% dos cliques geram conversa. Possivel problema na landing page ou no CTA.`,
      action: "Revisar a experiencia pos-clique e o fluxo de conversa.",
    });
  }

  // Cost per conversation (benchmark IA/cursos: <R$15 otimo, >R$30 ruim)
  if (kpis.costPerConversation > 0 && kpis.costPerConversation < 15) {
    const cheapConvWinners = activeCampaigns
      .filter((c) => c.conversations > 0 && c.costPerConversation < 15)
      .map((c) => c.id);
    insights.push({
      type: "success",
      title: "Custo por Conversa Otimo",
      description: `R$${kpis.costPerConversation.toFixed(2)} por conversa, abaixo do benchmark do segmento Educacao.`,
      actionable: cheapConvWinners.length > 0 ? {
        type: "boost_budget",
        label: `Escalar 20% em ${cheapConvWinners.length} vencedora(s)`,
        deltaPct: 20,
        targetCampaignIds: cheapConvWinners,
      } : undefined,
    });
  } else if (kpis.costPerConversation > 30) {
    const expensiveConv = activeCampaigns
      .filter((c) => c.costPerConversation > 30 && c.conversations > 0)
      .map((c) => c.id);
    insights.push({
      type: "danger",
      title: "Custo por Conversa Alto",
      description: `R$${kpis.costPerConversation.toFixed(2)} por conversa acima do ideal.`,
      action: "Otimizar campanhas de menor performance ou realocar orcamento.",
      actionable: expensiveConv.length > 0 ? {
        type: "cut_budget",
        label: `Reduzir 20% em ${expensiveConv.length} cara(s)`,
        deltaPct: -20,
        targetCampaignIds: expensiveConv,
      } : undefined,
    });
  }

  // Campaign comparison
  if (campaigns.length > 1) {
    const sorted = [...campaigns].sort((a, b) => a.costPerConversation - b.costPerConversation);
    const best = sorted.find((c) => c.conversations > 0);
    const worst = [...sorted].reverse().find((c) => c.conversations > 0);
    if (best && worst && best.name !== worst.name) {
      const savings = worst.costPerConversation - best.costPerConversation;
      if (savings > 2) {
        insights.push({
          type: "info",
          title: "Oportunidade de Realocacao",
          description: `"${best.name.substring(0, 30)}..." tem custo/conversa R$${savings.toFixed(2)} menor que "${worst.name.substring(0, 30)}...".`,
          action: "Considere realocar orcamento da campanha mais cara para a mais eficiente.",
          actionable: {
            type: "reallocate",
            label: `Realocar 20% de "${worst.name.substring(0, 20)}" para "${best.name.substring(0, 20)}"`,
            deltaPct: 20,
            targetCampaignIds: [worst.id, best.id],
            fromCampaignId: worst.id,
            toCampaignId: best.id,
          },
        });
      }
    }
  }

  // Video performance
  if (kpis.totalVideoViews > 0) {
    const viewRate = kpis.totalImpressions > 0 ? (kpis.totalVideoViews / kpis.totalImpressions) * 100 : 0;
    if (viewRate > 15) {
      insights.push({
        type: "success",
        title: "Videos Performando Bem",
        description: `${viewRate.toFixed(0)}% das impressoes geraram visualizacao de video, conteudo relevante.`,
      });
    }
  }

  // Saves
  if (kpis.totalSaves > 0) {
    insights.push({
      type: "info",
      title: "Conteudo Sendo Salvo",
      description: `${kpis.totalSaves} salvamentos indicam conteudo de alto valor percebido pela audiencia.`,
    });
  }

  // Messenger depth
  const totalDepth5 = campaigns.reduce((s, c) => s + c.messengerDepth5, 0);
  if (kpis.totalConversations > 0 && totalDepth5 > 0) {
    const engagementRate = (totalDepth5 / kpis.totalConversations) * 100;
    if (engagementRate > 40) {
      insights.push({
        type: "success",
        title: "Conversas Profundas",
        description: `${engagementRate.toFixed(0)}% das conversas chegam a 5+ mensagens, leads quentes.`,
      });
    }
  }

  return insights;
}
