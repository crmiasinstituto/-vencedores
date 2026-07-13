// ============================================================
// API client — invoca edge functions do módulo prospeccao
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { getProspeccaoContext, withContextBody } from "./context";
import type {
  AnalisarInput,
  AnalisarOutput,
  BuscarInput,
  BuscarOutput,
  DetectarIntentOutput,
  Diagnostico,
  LeadDescoberto,
  ProspeccaoBusca,
  TemplateNicho,
} from "../types";

export interface DirectLeadOutput {
  busca_id: string;
  lead_descoberto_id: string;
  lead: LeadDescoberto;
}

export async function criarLeadDireto(input: {
  type: "instagram" | "site";
  value: string;
  fontes?: string[];
}): Promise<DirectLeadOutput> {
  const ctx = await getProspeccaoContext();
  const { data, error } = await supabase.functions.invoke("prospeccao-direct-lead", {
    body: withContextBody(ctx, input),
  });
  if (error) throw new Error(error.message || "Falha ao criar lead direto");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function detectarIntent(query: string): Promise<DetectarIntentOutput> {
  const { data, error } = await supabase.functions.invoke("prospeccao-detectar-intent", {
    body: { query },
  });
  if (error) throw new Error(error.message || "Falha ao detectar intent");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function buscar(input: BuscarInput): Promise<BuscarOutput> {
  const ctx = await getProspeccaoContext();
  const { data, error } = await supabase.functions.invoke("prospeccao-buscar", {
    body: withContextBody(ctx, input),
  });
  if (error) throw new Error(error.message || "Falha ao buscar");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listarTemplatesNicho(): Promise<TemplateNicho[]> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_templates_nicho")
    .select("*")
    .eq("is_active", true)
    .order("display_name");
  if (error) throw error;
  return (data || []) as TemplateNicho[];
}

export async function getBusca(buscaId: string): Promise<ProspeccaoBusca> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_buscas")
    .select("*")
    .eq("id", buscaId)
    .single();
  if (error) throw error;
  return data as ProspeccaoBusca;
}

export interface DiagnosticoSummary {
  id: string;
  lead_descoberto_id: string;
  score_geral: number | null;
  status: string;
  created_at: string;
}

// Busca diagnósticos existentes pra um lead específico (por handle IG ou url_site)
export async function buscarDiagnosticosExistentes(
  type: "instagram" | "site",
  value: string
): Promise<Array<{ diagnostico_id: string; lead_descoberto_id: string; lead_nome: string; score_geral: number | null; created_at: string; }>> {
  let leadsQuery;
  if (type === "instagram") {
    const handle = value.replace(/^@/, "").replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "").replace(/\/$/, "").trim();
    if (!handle) return [];
    leadsQuery = (supabase as any).from("prospeccao_leads_descobertos")
      .select("id, nome")
      .ilike("instagram_handle", handle);
  } else {
    let url = value.trim();
    if (!url.startsWith("http")) url = `https://${url}`;
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return [];
    }
    leadsQuery = (supabase as any).from("prospeccao_leads_descobertos")
      .select("id, nome")
      .ilike("url_site", `%${host}%`);
  }
  const { data: leadsData } = await leadsQuery;
  if (!leadsData || leadsData.length === 0) return [];
  const leadIds = leadsData.map((l) => l.id);

  const { data: diagsData } = await (supabase as any)
    .from("prospeccao_diagnosticos")
    .select("id, lead_descoberto_id, score_geral, created_at")
    .in("lead_descoberto_id", leadIds)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!diagsData) return [];
  return diagsData.map((d) => {
    const l = leadsData.find((x) => x.id === d.lead_descoberto_id);
    return {
      diagnostico_id: d.id,
      lead_descoberto_id: d.lead_descoberto_id,
      lead_nome: l?.nome || "—",
      score_geral: d.score_geral,
      created_at: d.created_at,
    };
  });
}

export async function listarDiagnosticosDaBusca(buscaId: string): Promise<DiagnosticoSummary[]> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_diagnosticos")
    .select("id, lead_descoberto_id, score_geral, status, created_at")
    .eq("busca_id", buscaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as DiagnosticoSummary[];
}

export async function listarLeadsDescobertos(buscaId: string): Promise<LeadDescoberto[]> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_leads_descobertos")
    .select("*")
    .eq("busca_id", buscaId)
    .order("nota_google", { ascending: true, nullsFirst: false }) // pior reviews primeiro = mais dor
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as LeadDescoberto[];
}

export interface DiagnosticoHistorico {
  id: string;
  lead_descoberto_id: string;
  busca_id: string | null;
  score_geral: number | null;
  status: string;
  custo_total: number;
  created_at: string;
  fontes_consultadas: string[];
  // dados do lead (join)
  lead_nome: string | null;
  lead_cidade: string | null;
  lead_uf: string | null;
  lead_categoria: string | null;
  lead_instagram_handle: string | null;
  lead_url_site: string | null;
}

/** Lista todos diagnósticos completos do ator atual (admin/membro), mais novos primeiro. */
export async function listarHistoricoDiagnosticos(limite = 50): Promise<DiagnosticoHistorico[]> {
  const ctx = await getProspeccaoContext();
  let q = (supabase as any)
    .from("prospeccao_diagnosticos")
    .select(`
      id, lead_descoberto_id, busca_id, score_geral, status, custo_total,
      created_at, fontes_consultadas,
      prospeccao_leads_descobertos!inner (
        nome, cidade, uf, categoria, instagram_handle, url_site
      )
    `)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (ctx.audience === "member" && ctx.member_id) {
    q = q.eq("created_by_member_id", ctx.member_id);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((d: any) => ({
    id: d.id,
    lead_descoberto_id: d.lead_descoberto_id,
    busca_id: d.busca_id,
    score_geral: d.score_geral,
    status: d.status,
    custo_total: d.custo_total || 0,
    created_at: d.created_at,
    fontes_consultadas: d.fontes_consultadas || [],
    lead_nome: d.prospeccao_leads_descobertos?.nome ?? null,
    lead_cidade: d.prospeccao_leads_descobertos?.cidade ?? null,
    lead_uf: d.prospeccao_leads_descobertos?.uf ?? null,
    lead_categoria: d.prospeccao_leads_descobertos?.categoria ?? null,
    lead_instagram_handle: d.prospeccao_leads_descobertos?.instagram_handle ?? null,
    lead_url_site: d.prospeccao_leads_descobertos?.url_site ?? null,
  }));
}

export async function listarBuscasRecentes(limite = 20): Promise<ProspeccaoBusca[]> {
  const ctx = await getProspeccaoContext();
  let q = (supabase as any).from("prospeccao_buscas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  // Membro só vê as próprias buscas (admin vê tudo)
  if (ctx.audience === "member" && ctx.member_id) {
    q = q.eq("created_by_member_id", ctx.member_id);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ProspeccaoBusca[];
}

// Retorna quantos diagnósticos cada busca já tem
export async function contarDiagnosticosPorBusca(buscaIds: string[]): Promise<Record<string, { total: number; melhor_score: number | null; primeiro_diagnostico_id: string | null }>> {
  if (buscaIds.length === 0) return {};
  const { data, error } = await (supabase as any)
    .from("prospeccao_diagnosticos")
    .select("id, busca_id, score_geral")
    .in("busca_id", buscaIds);
  if (error) throw error;
  const result: Record<string, { total: number; melhor_score: number | null; primeiro_diagnostico_id: string | null }> = {};
  for (const d of data || []) {
    const k = (d as { busca_id: string }).busca_id;
    const score = (d as { score_geral: number | null }).score_geral;
    const id = (d as { id: string }).id;
    if (!result[k]) result[k] = { total: 0, melhor_score: null, primeiro_diagnostico_id: null };
    result[k].total++;
    if (score !== null && (result[k].melhor_score === null || score > (result[k].melhor_score as number))) {
      result[k].melhor_score = score;
    }
    if (!result[k].primeiro_diagnostico_id) result[k].primeiro_diagnostico_id = id;
  }
  return result;
}

export async function atualizarLeadDescoberto(
  id: string,
  patch: Partial<LeadDescoberto>
): Promise<LeadDescoberto> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_leads_descobertos")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as LeadDescoberto;
}

export interface PromptConfig {
  id: string;
  key: string;
  label: string;
  descricao: string | null;
  prompt_text: string;
  variables_help: Record<string, string>;
  ai_model: string;
  temperature: number;
  tom_voz: string;
  is_active: boolean;
  updated_at: string;
}

export async function listarPromptsConfig(): Promise<PromptConfig[]> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_prompts_config")
    .select("*")
    .order("label");
  if (error) throw error;
  return (data || []) as PromptConfig[];
}

export async function atualizarPromptConfig(
  id: string,
  patch: Partial<Pick<PromptConfig, "prompt_text" | "ai_model" | "temperature" | "tom_voz" | "is_active">>
): Promise<PromptConfig> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_prompts_config")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as PromptConfig;
}

export async function descartarLeadsDescobertos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await (supabase as any)
    .from("prospeccao_leads_descobertos")
    .update({ status: "descartado" })
    .in("id", ids);
  if (error) throw error;
}

export async function analisar(input: AnalisarInput): Promise<AnalisarOutput> {
  const ctx = await getProspeccaoContext();
  const { data, error } = await supabase.functions.invoke("prospeccao-analisar", {
    body: withContextBody(ctx, input),
  });
  if (error) throw new Error(error.message || "Falha ao analisar");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getDiagnostico(diagnosticoId: string): Promise<Diagnostico> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_diagnosticos")
    .select("*")
    .eq("id", diagnosticoId)
    .single();
  if (error) throw error;
  return data as unknown as Diagnostico;
}

export async function getDiagnosticoByLead(
  leadDescobertoId: string
): Promise<Diagnostico | null> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_diagnosticos")
    .select("*")
    .eq("lead_descoberto_id", leadDescobertoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Diagnostico) || null;
}

export async function getLeadDescoberto(id: string): Promise<LeadDescoberto> {
  const { data, error } = await (supabase as any)
    .from("prospeccao_leads_descobertos")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as LeadDescoberto;
}
