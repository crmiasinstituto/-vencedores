import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { lazy, Suspense } from "react";

import NotFound from "./pages/NotFound";

// Públicas
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const EventPlanning = lazy(() => import("./pages/EventPlanning"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const CollectiveEventLanding = lazy(() => import("./pages/CollectiveEventLanding"));
const EventSelfRegister = lazy(() => import("./pages/EventSelfRegister"));
const EventPublicEntry = lazy(() => import("./pages/EventPublicEntry"));
const WaGroupRedirect = lazy(() => import("./pages/WaGroupRedirect"));
const InterviewForm = lazy(() => import("./pages/InterviewForm"));

// Admin
const AdminLayout = lazy(() => import("./components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCRM = lazy(() => import("./pages/AdminCRM"));
const AdminAgenda = lazy(() => import("./pages/AdminAgenda"));
const AdminFunil = lazy(() => import("./pages/AdminFunil"));
const AdminEquipe = lazy(() => import("./pages/AdminEquipe"));
const AdminGrupos = lazy(() => import("./pages/AdminGrupos"));
const AdminClientes360 = lazy(() => import("./pages/AdminClientes360"));
const SalesDashboard = lazy(() => import("./pages/SalesDashboard"));
const AdminRecebimentos = lazy(() => import("./pages/AdminRecebimentos"));
const AdminFinanceiro = lazy(() => import("./pages/AdminFinanceiro"));
const AdminWhatsApp = lazy(() => import("./pages/AdminWhatsApp"));
const AdminCallMetrics = lazy(() => import("./pages/AdminCallMetrics"));
const AdminMarketing = lazy(() => import("./pages/AdminMarketing"));
const AdminCredenciamento = lazy(() => import("./pages/AdminCredenciamento"));
const AdminPortaria = lazy(() => import("./pages/AdminPortaria"));
const AdminSocialSelling = lazy(() => import("./pages/AdminSocialSelling"));
const AdminMarketingIA = lazy(() => import("./pages/AdminMarketingIA"));
const AdminCarrosselViral = lazy(() => import("./pages/AdminCarrosselViral"));
const AdminOperacoes = lazy(() => import("./pages/AdminOperacoes"));
const AdminPlaybooks = lazy(() => import("./pages/AdminPlaybooks"));
const AdminAgentes = lazy(() => import("./pages/AdminAgentes"));
const AdminConfiguracoes = lazy(() => import("./pages/AdminConfiguracoes"));
const AdminCredenciais = lazy(() => import("./pages/AdminCredenciais"));
const AdminVendasFormacao = lazy(() => import("./pages/AdminVendasFormacao"));
const AdminImportarKirvano = lazy(() => import("./pages/AdminImportarKirvano"));
const AdminRecrutamento = lazy(() => import("./pages/AdminRecrutamento"));
const AdminMembros = lazy(() => import("./pages/AdminMembros"));

// Marketing (Email + WhatsApp blast + Automações)
const MarketingDashboard = lazy(() => import("./pages/marketing/MarketingDashboard"));
const EmailMarketingHub = lazy(() => import("./pages/marketing/EmailMarketingHub"));
const EmailCampaignNew = lazy(() => import("./pages/marketing/EmailCampaignNew"));
const EmailCampaignDetail = lazy(() => import("./pages/marketing/EmailCampaignDetail"));
const EmailTemplates = lazy(() => import("./pages/marketing/EmailTemplates"));
const EmailTemplateEditor = lazy(() => import("./pages/marketing/EmailTemplateEditor"));
const MarketingAutomations = lazy(() => import("./pages/marketing/MarketingAutomations"));
const MarketingAutomationEditor = lazy(() => import("./pages/marketing/MarketingAutomationEditor"));
const WhatsAppTemplates = lazy(() => import("./pages/marketing/WhatsAppTemplates"));
const WhatsAppTemplateNew = lazy(() => import("./pages/marketing/WhatsAppTemplateNew"));
const SalesCampaigns = lazy(() => import("./pages/marketing/SalesCampaigns"));
const SalesCampaignNew = lazy(() => import("./pages/marketing/SalesCampaignNew"));
const SalesCampaignDetail = lazy(() => import("./pages/marketing/SalesCampaignDetail"));
const EmailConfigSettings = lazy(() => import("./pages/marketing/EmailConfigSettings"));
const WhatsAppInstancesMkt = lazy(() => import("./pages/marketing/WhatsAppInstances"));
const MetaAdsIntegration = lazy(() => import("./pages/marketing/MetaAdsIntegration"));
const MidiaNovaCampanha = lazy(() => import("./pages/marketing/MidiaNovaCampanha"));
const MidiaDashboard = lazy(() => import("./pages/marketing/MidiaDashboard"));
const MarketingCockpit = lazy(() => import("./pages/marketing/MarketingCockpit"));
const CriativosLab = lazy(() => import("./pages/marketing/CriativosLab"));
const CollectiveEventsHub = lazy(() => import("./pages/marketing/CollectiveEventsHub"));
const CollectiveEventDetail = lazy(() => import("./pages/marketing/CollectiveEventDetail"));

// Acervo do Time (storage B2 + quadro Trello). Acesso externo do time + admin.
const TeamLogin = lazy(() => import("./pages/TeamLogin"));
const TeamWorkspace = lazy(() => import("./pages/TeamWorkspace"));
const AdminAcervo = lazy(() => import("./pages/AdminAcervo"));
const MeetRoom = lazy(() => import("./pages/MeetRoom"));
const RecordingTemplate = lazy(() => import("./pages/RecordingTemplate"));

// + que Vencedores (netweaving) — portado do repo mais-que-vencedores-portal.
// Landing pública em /maisvencedores, área do membro em /maisvencedores/membros e o admin
// dele em /admin/maisvencedores. Os dois /membros ficam separados de propósito: este é
// netweaving (portfólio, indicações, ranking) e o de baixo é o LMS do acelerador.
const MaisVencedoresRoutes = lazy(() => import("./maisvencedores/MaisVencedoresRoutes"));
const MaisVencedoresAdminRoutes = lazy(() => import("./maisvencedores/MaisVencedoresAdminRoutes"));
// Link rastreado de indicação. Fica na raiz (/i/:codigo) de propósito: é um link que o membro
// cola no WhatsApp, então cada caractere conta.
const LinkIndicacao = lazy(() => import("./maisvencedores/pages/LinkIndicacao"));

// Área do membro (LMS). A autenticação ainda é a antiga, por token custom —
// a migração pro Supabase Auth é a próxima etapa do merge.
const MembrosLogin = lazy(() => import("./pages/MembrosLogin"));
const MembrosDashboard = lazy(() => import("./pages/MembrosDashboard"));
const MembrosMeet = lazy(() => import("./pages/MembrosMeet"));
const MembrosTrilhas = lazy(() => import("./pages/MembrosTrilhas"));
const MembrosAula = lazy(() => import("./pages/MembrosAula"));
const MembrosPerfil = lazy(() => import("./pages/MembrosPerfil"));
const MembrosContrato = lazy(() => import("./pages/MembrosContrato"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const App = () => {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Públicas */}
                <Route path="/" element={<Navigate to="/maisvencedores" replace />} />

                {/* + que Vencedores: landing + netweaving. O /* é necessário porque
                    MaisVencedoresRoutes tem o próprio <Routes> aninhado. */}
                <Route path="/maisvencedores/*" element={<MaisVencedoresRoutes />} />
                {/* Link de indicação rastreado: registra o clique e manda pro destino. */}
                <Route path="/i/:codigo" element={<LinkIndicacao />} />

                <Route path="/admin/auth" element={<AdminAuth />} />
                <Route path="/evento-planejamento" element={<EventPlanning />} />
                <Route path="/entrevista/form" element={<InterviewForm />} />
                <Route path="/termos" element={<TermosDeUso />} />
                <Route path="/privacidade" element={<PoliticaPrivacidade />} />
                {/* Eventos coletivos (Masterclass, Workshop, Aulão) */}
                <Route path="/r/:token" element={<CollectiveEventLanding />} />
                {/* Auto-cadastro publico de inscritos (QR do evento no credenciamento) */}
                <Route path="/inscricao/:token" element={<EventSelfRegister />} />
                {/* Link do evento postado nos grupos: identifica/captura lead + presenca */}
                <Route path="/evento/:token" element={<EventPublicEntry />} />
                {/* Redirect pra grupo WhatsApp (Meta bloqueia chat.whatsapp.com em botões) */}
                <Route path="/g/:slug" element={<WaGroupRedirect />} />
                {/* Acervo do Time: acesso externo independente (so essa pagina) */}
                <Route path="/time/login" element={<TeamLogin />} />
                <Route path="/time" element={<TeamWorkspace />} />

                {/* Área do membro */}
                <Route path="/membros/login" element={<MembrosLogin />} />
                <Route path="/membros" element={<MembrosDashboard />} />
                <Route path="/membros/trilhas" element={<MembrosTrilhas />} />
                <Route path="/membros/aula/:lessonId" element={<MembrosAula />} />
                <Route path="/membros/meet/:roomId" element={<MembrosMeet />} />
                <Route path="/membros/perfil" element={<MembrosPerfil />} />
                <Route path="/membros/contrato" element={<MembrosContrato />} />
                <Route path="/assinar/:token" element={<MembrosContrato />} />

                {/* Admin */}
                <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
                <Route path="/admin/crm" element={<AdminLayout><AdminCRM /></AdminLayout>} />
                <Route path="/admin/clientes" element={<AdminLayout><AdminClientes360 /></AdminLayout>} />
                <Route path="/admin/vendas" element={<AdminLayout><SalesDashboard /></AdminLayout>} />
                <Route path="/admin/vendas-formacoes" element={<AdminLayout><AdminVendasFormacao /></AdminLayout>} />
                <Route path="/admin/recebimentos" element={<AdminLayout><AdminRecebimentos /></AdminLayout>} />
                <Route path="/admin/financeiro" element={<AdminLayout><AdminFinanceiro /></AdminLayout>} />
                <Route path="/admin/whatsapp" element={<AdminLayout><AdminWhatsApp /></AdminLayout>} />
                <Route path="/admin/ligacoes" element={<AdminLayout><AdminCallMetrics /></AdminLayout>} />
                <Route path="/admin/marketing" element={<AdminLayout><AdminMarketing /></AdminLayout>} />
                <Route path="/admin/social-selling" element={<AdminLayout><AdminSocialSelling /></AdminLayout>} />
                <Route path="/configuracoes/social-selling" element={<Navigate to="/admin/social-selling" replace />} />
                <Route path="/configuracoes" element={<Navigate to="/admin/configuracoes" replace />} />
                <Route path="/admin/marketing-ia" element={<AdminLayout><AdminMarketingIA /></AdminLayout>} />
                <Route path="/admin/carrossel-viral" element={<AdminLayout><AdminCarrosselViral /></AdminLayout>} />
                <Route path="/admin/operacoes" element={<AdminLayout><AdminOperacoes /></AdminLayout>} />
                <Route path="/admin/playbooks" element={<AdminLayout><AdminPlaybooks /></AdminLayout>} />
                <Route path="/admin/agentes" element={<AdminLayout><AdminAgentes /></AdminLayout>} />
                <Route path="/admin/agenda" element={<AdminLayout><AdminAgenda /></AdminLayout>} />
                <Route path="/admin/funil" element={<AdminLayout><AdminFunil /></AdminLayout>} />
                <Route path="/admin/equipe" element={<AdminLayout><AdminEquipe /></AdminLayout>} />
                <Route path="/admin/grupos" element={<AdminLayout><AdminGrupos /></AdminLayout>} />
                <Route path="/admin/recrutamento" element={<AdminLayout><AdminRecrutamento /></AdminLayout>} />
                <Route path="/admin/membros" element={<AdminLayout><AdminMembros /></AdminLayout>} />
                {/* Admin do netweaving. Fica debaixo do AdminLayout do CRM de propósito: um
                    porteiro só (useAdminAuth → is_admin()) pro /admin inteiro. Não confundir
                    /admin/membros (membros do LMS) com /admin/maisvencedores/membros
                    (empresas do netweaving) — são cadastros diferentes. */}
                <Route path="/admin/maisvencedores/*" element={<AdminLayout><MaisVencedoresAdminRoutes /></AdminLayout>} />
                <Route path="/admin/acervo" element={<AdminLayout><AdminAcervo /></AdminLayout>} />
                <Route path="/admin/configuracoes" element={<AdminLayout><AdminConfiguracoes /></AdminLayout>} />
                <Route path="/admin/credenciais" element={<AdminLayout><AdminCredenciais /></AdminLayout>} />
                <Route path="/admin/importar-kirvano" element={<AdminLayout><AdminImportarKirvano /></AdminLayout>} />

                {/* Marketing — Email + WhatsApp blast + Automações */}
                <Route path="/admin/marketing/email" element={<AdminLayout><MarketingDashboard /></AdminLayout>} />
                <Route path="/admin/marketing/campanhas" element={<AdminLayout><EmailMarketingHub /></AdminLayout>} />
                <Route path="/admin/marketing/campanhas/nova" element={<AdminLayout><EmailCampaignNew /></AdminLayout>} />
                <Route path="/admin/marketing/campanhas/:id" element={<AdminLayout><EmailCampaignDetail /></AdminLayout>} />
                <Route path="/admin/marketing/templates" element={<AdminLayout><EmailTemplates /></AdminLayout>} />
                <Route path="/admin/marketing/templates/:id" element={<AdminLayout><EmailTemplateEditor /></AdminLayout>} />
                <Route path="/admin/marketing/automacoes" element={<AdminLayout><MarketingAutomations /></AdminLayout>} />
                <Route path="/admin/marketing/automacoes/:id" element={<AdminLayout><MarketingAutomationEditor /></AdminLayout>} />
                <Route path="/admin/marketing/wa-templates" element={<AdminLayout><WhatsAppTemplates /></AdminLayout>} />
                <Route path="/admin/marketing/wa-templates/novo" element={<AdminLayout><WhatsAppTemplateNew /></AdminLayout>} />
                <Route path="/admin/marketing/wa-campanhas" element={<AdminLayout><SalesCampaigns /></AdminLayout>} />
                <Route path="/admin/marketing/wa-campanhas/nova" element={<AdminLayout><SalesCampaignNew /></AdminLayout>} />
                <Route path="/admin/marketing/wa-campanhas/:id" element={<AdminLayout><SalesCampaignDetail /></AdminLayout>} />
                <Route path="/admin/marketing/configuracoes" element={<AdminLayout><EmailConfigSettings /></AdminLayout>} />
                <Route path="/admin/marketing/instancias" element={<AdminLayout><WhatsAppInstancesMkt /></AdminLayout>} />
                <Route path="/admin/marketing/integracoes/meta" element={<AdminLayout><MetaAdsIntegration /></AdminLayout>} />
                <Route path="/admin/marketing/midia/nova-campanha" element={<AdminLayout><MidiaNovaCampanha /></AdminLayout>} />
                <Route path="/admin/marketing/midia" element={<AdminLayout><MarketingCockpit /></AdminLayout>} />
                <Route path="/admin/marketing/midia/campanhas" element={<AdminLayout><MidiaDashboard /></AdminLayout>} />
                <Route path="/admin/marketing/criativos/lab" element={<AdminLayout><CriativosLab /></AdminLayout>} />
                <Route path="/admin/marketing/eventos-coletivos" element={<AdminLayout><CollectiveEventsHub /></AdminLayout>} />
                <Route path="/admin/marketing/eventos-coletivos/:id" element={<AdminLayout><CollectiveEventDetail /></AdminLayout>} />
                <Route path="/admin/credenciamento" element={<AdminLayout><AdminCredenciamento /></AdminLayout>} />
                {/* Modo Portaria: mobile, sem o chrome do admin, pro time na porta */}
                <Route path="/admin/credenciar/:eventId" element={<AdminPortaria />} />

                <Route path="/meet/:roomId" element={<MeetRoom />} />
                <Route path="/recording-template" element={<RecordingTemplate />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
