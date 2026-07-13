import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, Users, Package, Palette, Settings, Shield, 
  Target, Image, Phone, Zap, Instagram, CheckCircle2, Clock, AlertCircle,
  Download, Loader2, History, Brain, Lightbulb, TrendingUp, RefreshCw
} from 'lucide-react';
import { exportClientToPDF } from '@/utils/exportClientPDF';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientData {
  client: any;
  audience: any;
  products: any;
  branding: any;
  operations: any;
  policies: any;
  goals: any;
  materials: any;
  technical: any;
  expansion: any;
}

interface ChangeRecord {
  id: string;
  changed_by: string;
  change_reason: string;
  changed_fields: any;
  previous_values: any;
  new_values: any;
  created_at: string;
}

interface ClientDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: ClientData | null;
  lead: any;
}

const DataField = ({ label, value }: { label: string; value: any }) => {
  if (!value || (typeof value === 'string' && !value.trim())) return null;
  
  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">
        {typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}
      </p>
    </div>
  );
};

const JsonField = ({ label, value }: { label: string; value: any }) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  
  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-sm text-foreground">
        {Array.isArray(value) ? (
          <ul className="list-disc list-inside space-y-1">
            {value.map((item, i) => (
              <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
            ))}
          </ul>
        ) : (
          <pre className="text-xs bg-muted/30 p-2 rounded overflow-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, children, isEmpty }: { 
  title: string; 
  icon: any; 
  children: React.ReactNode;
  isEmpty?: boolean;
}) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
    {isEmpty ? (
      <p className="text-sm text-muted-foreground italic">Nenhum dado preenchido</p>
    ) : (
      children
    )}
  </div>
);

export function ClientDetailModal({ open, onClose, data, lead }: ClientDetailModalProps) {
  const [exporting, setExporting] = useState(false);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [regeneratingInsights, setRegeneratingInsights] = useState(false);

  useEffect(() => {
    if (open && data?.client?.id) {
      fetchChanges();
    }
  }, [open, data?.client?.id]);

  async function fetchChanges() {
    if (!data?.client?.id) return;
    
    setLoadingChanges(true);
    try {
      const { data: changesData, error } = await supabase
        .from('client_onboarding_changes')
        .select('*')
        .eq('client_id', data.client.id)
        .order('created_at', { ascending: false });

      if (!error && changesData) {
        setChanges(changesData);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setLoadingChanges(false);
    }
  }

  async function regenerateInsights() {
    if (!lead?.instagram) {
      toast.error('Cliente não possui Instagram cadastrado');
      return;
    }

    setRegeneratingInsights(true);
    try {
      const { data: insightsData, error } = await supabase.functions.invoke('generate-client-insights', {
        body: {
          instagram_username: lead.instagram,
          client_name: data?.client?.responsible_name,
          company_name: data?.client?.company_name
        }
      });

      if (error) throw error;

      if (insightsData.success) {
        // Update client with new insights
        await supabase
          .from('clients')
          .update({ 
            ai_insights: insightsData.aiInsights,
            instagram_data: insightsData.instagramData
          } as any)
          .eq('id', data?.client?.id);

        toast.success('Insights regenerados com sucesso!');
        // Reload the page to see new insights
        window.location.reload();
      }
    } catch (err) {
      console.error('Erro ao regenerar insights:', err);
      toast.error('Erro ao regenerar insights');
    } finally {
      setRegeneratingInsights(false);
    }
  }

  if (!data) return null;

  const { client, audience, products, branding, operations, policies, goals, materials, technical, expansion } = data;
  const aiInsights = client?.ai_insights;

  const getStatusBadge = () => {
    switch (client?.status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Concluído
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
            <Clock className="w-3 h-3 mr-1" />
            Em andamento ({client.onboarding_step}/12)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getPotentialBadge = (value: string) => {
    if (!value) return 'bg-muted text-muted-foreground';
    const level = value.split(' - ')[0].toLowerCase();
    const colors: Record<string, string> = {
      alto: 'bg-green-500/20 text-green-400',
      médio: 'bg-yellow-500/20 text-yellow-400',
      baixo: 'bg-red-500/20 text-red-400'
    };
    return colors[level] || colors.médio;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-start gap-4">
            {lead?.instagram_profile_pic_url ? (
              <img
                src={lead.instagram_profile_pic_url}
                alt={lead.name}
                className="w-16 h-16 rounded-full border-2 border-primary/30 object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">
                  {(lead?.name || client?.responsible_name || 'C').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <DialogTitle className="text-xl">{client?.company_name || 'Cliente'}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>{client?.responsible_name}</span>
                {lead?.instagram && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Instagram className="w-3 h-3" />
                      {lead.instagram}
                    </span>
                  </>
                )}
                {lead?.whatsapp && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {lead.whatsapp}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3">
                {getStatusBadge()}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setExporting(true);
                    try {
                      exportClientToPDF(data, lead?.name);
                      toast.success('PDF exportado com sucesso!');
                    } catch (err) {
                      toast.error('Erro ao exportar PDF');
                    } finally {
                      setExporting(false);
                    }
                  }}
                  disabled={exporting}
                  className="gap-1"
                >
                  {exporting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  Exportar PDF
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="empresa" className="w-full">
          <div className="px-6 border-b border-border">
            <TabsList className="h-auto p-0 bg-transparent gap-2 flex-wrap">
              <TabsTrigger value="empresa" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Building2 className="w-3 h-3 mr-1" /> Empresa
              </TabsTrigger>
              <TabsTrigger value="publico" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Users className="w-3 h-3 mr-1" /> Público
              </TabsTrigger>
              <TabsTrigger value="produtos" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Package className="w-3 h-3 mr-1" /> Produtos
              </TabsTrigger>
              <TabsTrigger value="marca" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Palette className="w-3 h-3 mr-1" /> Marca
              </TabsTrigger>
              <TabsTrigger value="operacoes" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Settings className="w-3 h-3 mr-1" /> Operações
              </TabsTrigger>
              <TabsTrigger value="politicas" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Shield className="w-3 h-3 mr-1" /> Políticas
              </TabsTrigger>
              <TabsTrigger value="metas" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Target className="w-3 h-3 mr-1" /> Metas
              </TabsTrigger>
              <TabsTrigger value="materiais" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Image className="w-3 h-3 mr-1" /> Materiais
              </TabsTrigger>
              <TabsTrigger value="tecnico" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Phone className="w-3 h-3 mr-1" /> Técnico
              </TabsTrigger>
              <TabsTrigger value="expansao" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Zap className="w-3 h-3 mr-1" /> Expansão
              </TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <Brain className="w-3 h-3 mr-1" /> Insights IA
              </TabsTrigger>
              <TabsTrigger value="historico" className="data-[state=active]:bg-primary/20 rounded-md px-3 py-1.5 text-xs">
                <History className="w-3 h-3 mr-1" /> Histórico
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[50vh] p-6">
            <TabsContent value="empresa" className="mt-0 space-y-4">
              <SectionCard title="Identificação da Empresa" icon={Building2} isEmpty={!client}>
                <DataField label="Nome da Empresa" value={client?.company_name} />
                <DataField label="Responsável" value={client?.responsible_name} />
                <DataField label="Cargo" value={client?.position} />
                <DataField label="Tempo de Empresa" value={client?.company_age} />
                <DataField label="Número de Funcionários" value={client?.employees_count} />
                <DataField label="Endereço Completo" value={client?.full_address} />
                <DataField label="Regiões Atendidas" value={client?.served_regions} />
                <DataField label="Descrição do Negócio" value={client?.business_description} />
                <DataField label="Diferencial Principal" value={client?.main_differential} />
                <DataField label="Principal Dor do Cliente" value={client?.client_main_pain} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="publico" className="mt-0 space-y-4">
              <SectionCard title="Público-Alvo" icon={Users} isEmpty={!audience}>
                <DataField label="Perfil Principal do Público" value={audience?.main_audience_profile} />
                <DataField label="Quem Decide a Compra" value={audience?.purchase_decision_maker} />
                <DataField label="Quem Usa o Produto" value={audience?.product_user} />
                <DataField label="Principais Objeções" value={audience?.main_objections} />
                <DataField label="Gatilhos de Compra" value={audience?.purchase_triggers} />
                <DataField label="Canais Preferidos" value={audience?.preferred_channels} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="produtos" className="mt-0 space-y-4">
              <SectionCard title="Produtos e Serviços" icon={Package} isEmpty={!products}>
                <JsonField label="Lista de Produtos" value={products?.products_list} />
                <DataField label="Mais Vendidos" value={products?.best_sellers} />
                <DataField label="Produtos Sazonais" value={products?.seasonal_products} />
                <DataField label="Produtos Não Oferecidos" value={products?.non_offered_products} />
                <DataField label="Margens de Lucro" value={products?.profit_margins} />
                <DataField label="Aprovação de Descontos" value={products?.discount_approval} />
                <DataField label="Política de Troca" value={products?.exchange_policy} />
                <DataField label="Política de Reserva" value={products?.reservation_policy} />
                <DataField label="Formas de Pagamento" value={products?.payment_methods} />
                <DataField label="Promoções" value={products?.promotions} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="marca" className="mt-0 space-y-4">
              <SectionCard title="Marca e Tom de Voz" icon={Palette} isEmpty={!branding}>
                <DataField label="Nome da IA" value={branding?.ai_name} />
                <DataField label="Tom da Marca" value={branding?.brand_tone} />
                <DataField label="Estilo de Apresentação da IA" value={branding?.ai_presentation_style} />
                <DataField label="Introdução da IA" value={branding?.ai_introduction} />
                <DataField label="Tratamento ao Cliente" value={branding?.client_treatment} />
                <DataField label="Frases para Usar" value={branding?.phrases_to_use} />
                <DataField label="Frases para Evitar" value={branding?.phrases_to_avoid} />
                <DataField label="Comportamentos da Marca" value={branding?.brand_behaviors} />
                <DataField label="Erros Graves" value={branding?.serious_mistakes} />
                <DataField label="Vocabulário de Produto" value={branding?.product_vocabulary} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="operacoes" className="mt-0 space-y-4">
              <SectionCard title="Operações" icon={Settings} isEmpty={!operations}>
                <DataField label="Objetivo Principal da IA" value={operations?.ai_main_objective} />
                <DataField label="Sistemas Atuais" value={operations?.current_systems} />
                <DataField label="Integrações" value={operations?.integrations} />
                <DataField label="Integrações Desejadas" value={operations?.desired_integrations} />
                <DataField label="Fluxos de Atendimento" value={operations?.attendance_flows} />
                <DataField label="Escopo de Automação" value={operations?.automation_scope} />
                <DataField label="Gatilhos para Humano" value={operations?.human_escalation_triggers} />
                <DataField label="Tempo Máximo de Resposta" value={operations?.max_response_time} />
                <DataField label="Scripts de Vendas" value={operations?.sales_scripts} />
                <DataField label="Dados do Cliente Requeridos" value={operations?.required_client_data} />
                <DataField label="Canais de Marketing" value={operations?.marketing_channels} />
                <DataField label="Anúncios Pagos" value={operations?.paid_ads} />
                <DataField label="Metas de Crescimento" value={operations?.growth_goals} />
                <DataField label="Base de Clientes" value={operations?.client_database} />
                <DataField label="Usa Linguagem Visual" value={operations?.use_visual_language} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="politicas" className="mt-0 space-y-4">
              <SectionCard title="Políticas" icon={Shield} isEmpty={!policies}>
                <DataField label="Salvar Dados Pessoais" value={policies?.save_personal_data} />
                <DataField label="Restrições com Concorrentes" value={policies?.competitor_restrictions} />
                <DataField label="Políticas de Desconto" value={policies?.discount_policies} />
                <DataField label="Tratamento de Clientes Insatisfeitos" value={policies?.unsatisfied_client_handling} />
                <DataField label="Bônus Automáticos" value={policies?.auto_bonuses} />
                <DataField label="Palavras Proibidas" value={policies?.forbidden_words} />
                <DataField label="Rotinas de Follow-up" value={policies?.followup_routines} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="metas" className="mt-0 space-y-4">
              <SectionCard title="Metas e Expectativas" icon={Target} isEmpty={!goals}>
                <DataField label="Expectativas com a IA" value={goals?.ai_expectations} />
                <DataField label="KPIs para Medir" value={goals?.kpis_to_measure} />
                <DataField label="Critérios de Sucesso" value={goals?.success_criteria} />
                <DataField label="Critérios de Falha" value={goals?.failure_criteria} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="materiais" className="mt-0 space-y-4">
              <SectionCard title="Materiais" icon={Image} isEmpty={!materials}>
                {materials?.logo_url && (
                  <div className="py-2 border-b border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Logo</p>
                    <img src={materials.logo_url} alt="Logo" className="max-h-20 rounded" />
                  </div>
                )}
                <DataField label="Textos da Marca" value={materials?.brand_texts} />
                <DataField label="Catálogos/Manuais" value={materials?.catalogs_manuals} />
                <JsonField label="Fotos de Produtos" value={materials?.product_photos} />
                <JsonField label="Depoimentos" value={materials?.testimonials} />
                <JsonField label="Mídia do Ambiente" value={materials?.environment_media} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="tecnico" className="mt-0 space-y-4">
              <SectionCard title="Configuração Técnica" icon={Phone} isEmpty={!technical}>
                <DataField label="Email do Parceiro" value={technical?.partner_email} />
                <DataField label="Horário de Operação" value={technical?.operation_hours} />
                <DataField label="Redirecionamento Fora do Horário" value={technical?.after_hours_redirect} />
                <DataField label="Tempo de Resposta Fora do Horário" value={technical?.after_hours_response_time} />
                <JsonField label="Contatos Principais" value={technical?.main_contacts} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="expansao" className="mt-0 space-y-4">
              <SectionCard title="Expansão e Automação" icon={Zap} isEmpty={!expansion}>
                <DataField label="Múltiplos Canais" value={expansion?.multiple_channels} />
                <DataField label="Funções da IA" value={expansion?.ai_functions} />
                <DataField label="Fluxos de Automação" value={expansion?.automation_flows} />
                <DataField label="Redirecionamento Fora de Contexto" value={expansion?.out_of_context_redirect} />
                <DataField label="Mensagens Especiais" value={expansion?.special_messages} />
                <DataField label="Quantidade de Follow-ups" value={expansion?.followup_count} />
                <DataField label="Intervalos de Follow-up" value={expansion?.followup_intervals} />
                <DataField label="Funcionalidades Futuras" value={expansion?.future_features} />
                <JsonField label="Top 10 FAQs" value={expansion?.top_10_faqs} />
              </SectionCard>
            </TabsContent>

            {/* AI Insights Tab */}
            <TabsContent value="insights" className="mt-0 space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Insights de IA</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateInsights}
                    disabled={regeneratingInsights || !lead?.instagram}
                    className="gap-1"
                  >
                    {regeneratingInsights ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Regenerar
                  </Button>
                </div>

                {aiInsights ? (
                  <div className="space-y-4">
                    {/* Niche */}
                    <div className="bg-primary/10 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">🎯 Nicho Identificado</p>
                      <p className="font-medium text-foreground">{aiInsights.nicho}</p>
                    </div>

                    {/* Potential Badges */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className={`rounded-lg p-3 text-center ${getPotentialBadge(aiInsights.potencial_captacao)}`}>
                        <p className="text-xs opacity-80">Captação</p>
                        <p className="font-bold text-sm">{aiInsights.potencial_captacao?.split(' - ')[0] || 'N/A'}</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${getPotentialBadge(aiInsights.potencial_vendas)}`}>
                        <p className="text-xs opacity-80">Vendas</p>
                        <p className="font-bold text-sm">{aiInsights.potencial_vendas?.split(' - ')[0] || 'N/A'}</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${getPotentialBadge(aiInsights.potencial_gestao)}`}>
                        <p className="text-xs opacity-80">Gestão</p>
                        <p className="font-bold text-sm">{aiInsights.potencial_gestao?.split(' - ')[0] || 'N/A'}</p>
                      </div>
                    </div>

                    {/* AI Suggestions */}
                    {aiInsights.sugestoes_ia?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          Sugestões de IA
                        </p>
                        <ul className="space-y-1">
                          {aiInsights.sugestoes_ia.map((sugestao: string, i: number) => (
                            <li key={i} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {sugestao}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Automations */}
                    {aiInsights.automacoes_recomendadas?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Automações Recomendadas
                        </p>
                        <ul className="space-y-1">
                          {aiInsights.automacoes_recomendadas.map((auto: string, i: number) => (
                            <li key={i} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-yellow-500">⚡</span>
                              {auto}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Pain Points */}
                    {aiInsights.pontos_dor?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Pontos de Dor Detectados
                        </p>
                        <ul className="space-y-1">
                          {aiInsights.pontos_dor.map((dor: string, i: number) => (
                            <li key={i} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-red-500">!</span>
                              {dor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Customer Experience */}
                    {aiInsights.experiencia_cliente?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          ✨ Experiência do Cliente
                        </p>
                        <ul className="space-y-1">
                          {aiInsights.experiencia_cliente.map((exp: string, i: number) => (
                            <li key={i} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-purple-500">★</span>
                              {exp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Business Management */}
                    {aiInsights.gestao_empresarial?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          📊 Gestão Empresarial
                        </p>
                        <ul className="space-y-1">
                          {aiInsights.gestao_empresarial.map((gestao: string, i: number) => (
                            <li key={i} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-blue-500">📈</span>
                              {gestao}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Customer Success */}
                    {aiInsights.customer_success?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          🎯 Customer Success
                        </p>
                        <ul className="space-y-1">
                          {aiInsights.customer_success.map((cs: string, i: number) => (
                            <li key={i} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              {cs}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhum insight disponível</p>
                    {lead?.instagram && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={regenerateInsights}
                        disabled={regeneratingInsights}
                        className="mt-4"
                      >
                        Gerar Insights
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="historico" className="mt-0 space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                  <History className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Histórico de Alterações</h3>
                </div>

                {loadingChanges ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : changes.length > 0 ? (
                  <div className="space-y-4">
                    {changes.map((change) => (
                      <motion.div
                        key={change.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border-l-2 border-primary/30 pl-4 py-2"
                      >
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>📅</span>
                          <span>
                            {format(new Date(change.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm mt-1">
                          <span className="text-muted-foreground">Alterado por:</span>{' '}
                          <span className="font-medium text-foreground capitalize">{change.changed_by}</span>
                        </p>
                        {change.change_reason && (
                          <p className="text-sm mt-1">
                            <span className="text-muted-foreground">Motivo:</span>{' '}
                            <span className="text-foreground italic">"{change.change_reason}"</span>
                          </p>
                        )}
                        {change.changed_fields && (
                          <p className="text-sm mt-1">
                            <span className="text-muted-foreground">Campos:</span>{' '}
                            <span className="text-foreground font-mono text-xs">
                              {Array.isArray(change.changed_fields) 
                                ? change.changed_fields.join(', ') 
                                : JSON.stringify(change.changed_fields)}
                            </span>
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma alteração registrada</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
