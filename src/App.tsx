import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useState, useEffect, lazy, Suspense } from "react";

// Públicos: a masterclass fica estática (alvo principal de venda hoje)
import MasterclassIA from "./pages/MasterclassIA";
import NotFound from "./pages/NotFound";
import { LeadCapturePopup } from "./components/lead/LeadCapturePopup";

// Outras landings ficam lazy pra não pesar nessa rota
const Index = lazy(() => import("./pages/Index"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const EventPlanning = lazy(() => import("./pages/EventPlanning"));
const VHSaoPrompt = lazy(() => import("./pages/VHSaoPrompt"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const ReprogrameLanding = lazy(() => import("./pages/r10x/ReprogrameLanding"));
const ReprogrameDisc = lazy(() => import("./pages/r10x/ReprogrameDisc"));
const ReprogrameTelao = lazy(() => import("./pages/r10x/ReprogrameTelao"));
const CollectiveEventLanding = lazy(() => import("./pages/CollectiveEventLanding"));
const EventSelfRegister = lazy(() => import("./pages/EventSelfRegister"));
const EventPublicEntry = lazy(() => import("./pages/EventPublicEntry"));
const WaGroupRedirect = lazy(() => import("./pages/WaGroupRedirect"));

// Onboarding (lazy: usuário só chega via link)
const OnboardingWelcome = lazy(() => import("./pages/OnboardingWelcome"));
const OnboardingStep = lazy(() => import("./pages/OnboardingStep"));
const VHSOnboardingStart = lazy(() => import("./pages/VHSOnboardingStart"));
const VHSOnboardingStep = lazy(() => import("./pages/VHSOnboardingStep"));
const VHSOnboardingComplete = lazy(() => import("./pages/VHSOnboardingComplete"));
const MetodoSquaadOnboarding = lazy(() => import("./pages/MetodoSquaadOnboarding"));
const MasterclassOnboarding = lazy(() => import("./pages/MasterclassOnboarding"));
const InterviewForm = lazy(() => import("./pages/InterviewForm"));
const AdminReprogramaSettings = lazy(() => import("./pages/AdminReprogramaSettings"));
const EstruturarEvento = lazy(() => import("./pages/EstruturarEvento"));
const CriarMeuEvento = lazy(() => import("./pages/CriarMeuEvento"));

// Admin (lazy: só admin logado acessa)
const AdminLayout = lazy(() => import("./components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCRM = lazy(() => import("./pages/AdminCRM"));
const AdminAgenda = lazy(() => import("./pages/AdminAgenda"));
const AdminFunil = lazy(() => import("./pages/AdminFunil"));
const AdminEquipe = lazy(() => import("./pages/AdminEquipe"));
const AdminRoleplay = lazy(() => import("./pages/AdminRoleplay"));
const AdminGrupos = lazy(() => import("./pages/AdminGrupos"));
const AdminClientes360 = lazy(() => import("./pages/AdminClientes360"));
const SalesDashboard = lazy(() => import("./pages/SalesDashboard"));
const AdminRecebimentos = lazy(() => import("./pages/AdminRecebimentos"));
const AdminFinanceiro = lazy(() => import("./pages/AdminFinanceiro"));
const AdminWhatsApp = lazy(() => import("./pages/AdminWhatsApp"));
const AdminCallMetrics = lazy(() => import("./pages/AdminCallMetrics"));
const AdminOnboarding = lazy(() => import("./pages/AdminOnboarding"));
const AdminVHSParticipants = lazy(() => import("./pages/AdminVHSParticipants"));
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
const AdminImportarKirvano = lazy(() => import("./pages/AdminImportarKirvano"));
const AdminProspeccao = lazy(() => import("./pages/AdminProspeccao"));
const AdminProspeccaoDescobertos = lazy(() => import("./pages/AdminProspeccaoDescobertos"));
const AdminProspeccaoDiagnostico = lazy(() => import("./pages/AdminProspeccaoDiagnostico"));
const AdminProspeccaoPrint = lazy(() => import("./pages/AdminProspeccaoPrint"));
const AdminProspeccaoConfiguracoes = lazy(() => import("./pages/AdminProspeccaoConfiguracoes"));
const AdminProspeccaoHistorico = lazy(() => import("./pages/AdminProspeccaoHistorico"));
const AdminRecrutamento = lazy(() => import("./pages/AdminRecrutamento"));
const AdminMembros = lazy(() => import("./pages/AdminMembros"));

// Marketing module (Email + WhatsApp blast + Automações)
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
const MembrosLogin = lazy(() => import("./pages/MembrosLogin"));
// Acervo do Time (storage B2 + quadro Trello). Acesso externo do time + admin.
const TeamLogin = lazy(() => import("./pages/TeamLogin"));
const TeamWorkspace = lazy(() => import("./pages/TeamWorkspace"));
const AdminAcervo = lazy(() => import("./pages/AdminAcervo"));
const MeetRoom = lazy(() => import("./pages/MeetRoom"));
const RecordingTemplate = lazy(() => import("./pages/RecordingTemplate"));

// Member area pages (student-facing)
const MembrosDashboard = lazy(() => import("./pages/MembrosDashboard"));
const MembrosMeet = lazy(() => import("./pages/MembrosMeet"));
const MembrosTrilhas = lazy(() => import("./pages/MembrosTrilhas"));
const MembrosAula = lazy(() => import("./pages/MembrosAula"));
const MembrosAIFirst = lazy(() => import("./pages/MembrosAIFirst"));
const MembrosDicionario = lazy(() => import("./pages/MembrosDicionario"));
const MembrosAcelerador = lazy(() => import("./pages/MembrosAcelerador"));
const MembrosPerfil = lazy(() => import("./pages/MembrosPerfil"));
const MembrosContrato = lazy(() => import("./pages/MembrosContrato"));
const MembrosProspeccao = lazy(() => import("./pages/MembrosProspeccao"));
const MembrosProspeccaoDescobertos = lazy(() => import("./pages/MembrosProspeccaoDescobertos"));
const MembrosProspeccaoDiagnostico = lazy(() => import("./pages/MembrosProspeccaoDiagnostico"));
const MembrosProspeccaoMeusLeads = lazy(() => import("./pages/MembrosProspeccaoMeusLeads"));
const MembrosProspeccaoHistorico = lazy(() => import("./pages/MembrosProspeccaoHistorico"));

// Componente que verifica a rota antes de mostrar o popup
const ConditionalLeadPopup = ({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const location = useLocation();
  const isMainLandingPage = location.pathname === '/';
  if (!isMainLandingPage) return null;
  // Esconder também em rotas públicas dedicadas (telão/captura de evento)
  if (
    location.pathname.startsWith('/r10x') ||
    location.pathname === '/telao' ||
    location.pathname.startsWith('/r/') ||
    location.pathname.startsWith('/g/')
  ) return null;
  return <LeadCapturePopup isOpen={isOpen} onClose={onClose} />;
};

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin" />
  </div>
);

// URL limpa da apresentacao Masterclass (sem .html). Em producao o Netlify reescreve
// /apresentacoes/masterclass-ia-negocios -> .html (URL fica limpa, React nem carrega).
// Em dev/preview local (sem rewrite) cai no SPA e aqui redirecionamos pro arquivo estatico.
const MasterclassDeckRedirect = () => {
  useEffect(() => {
    window.location.replace("/apresentacoes/masterclass-ia-negocios.html");
  }, []);
  return null;
};

const App = () => {
  const [showLeadPopup, setShowLeadPopup] = useState(false);

  useEffect(() => {
    const leadCaptured = localStorage.getItem('lead_captured');
    const captureDate = localStorage.getItem('lead_captured_date');
    if (!leadCaptured || (captureDate &&
        new Date().getTime() - new Date(captureDate).getTime() > 30 * 24 * 60 * 60 * 1000)) {
      setShowLeadPopup(true);
    }
  }, []);

  const handleCloseLeadPopup = () => {
    setShowLeadPopup(false);
  };

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
           <BrowserRouter>
            <ConditionalLeadPopup
              isOpen={showLeadPopup}
              onClose={handleCloseLeadPopup}
            />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/admin/auth" element={<AdminAuth />} />
                <Route path="/onboarding/:token" element={<OnboardingWelcome />} />
                <Route path="/onboarding/:token/step/:step" element={<OnboardingStep />} />
                <Route path="/evento-planejamento" element={<EventPlanning />} />
                <Route path="/entrevista/form" element={<InterviewForm />} />
                <Route path="/vhs-ao-prompt" element={<VHSaoPrompt />} />
                <Route path="/masterclass-ia" element={<MasterclassIA />} />
                <Route path="/vhs/onboarding" element={<VHSOnboardingStart />} />
                <Route path="/vhs/onboarding/step/:step" element={<VHSOnboardingStep />} />
                <Route path="/vhs/onboarding/complete" element={<VHSOnboardingComplete />} />
                <Route path="/termos" element={<TermosDeUso />} />
                <Route path="/privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/metodo-squaad/onboarding/:token" element={<MetodoSquaadOnboarding />} />
                <Route path="/masterclass/onboarding/:token" element={<MasterclassOnboarding />} />
                <Route path="/m/:token" element={<MasterclassOnboarding />} />
                {/* Reprograme-se 10X — DISC Lead Magnet */}
                <Route path="/r10x" element={<ReprogrameLanding />} />
                <Route path="/r10x/disc" element={<ReprogrameDisc />} />
                <Route path="/telao" element={<ReprogrameTelao />} />
                {/* Landing publica: estruturar seu proprio evento (lead magnet) */}
                <Route path="/criar-meu-evento" element={<CriarMeuEvento />} />
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
                <Route path="/membros/login" element={<MembrosLogin />} />
                <Route path="/membros" element={<MembrosDashboard />} />
                <Route path="/membros/trilhas" element={<MembrosTrilhas />} />
                <Route path="/membros/aula/:lessonId" element={<MembrosAula />} />
                <Route path="/membros/meet/:roomId" element={<MembrosMeet />} />
                <Route path="/membros/ai-first" element={<MembrosAIFirst />} />
                <Route path="/membros/dicionario" element={<MembrosDicionario />} />
                <Route path="/membros/ai-first/:slug" element={<MembrosAcelerador />} />
                <Route path="/membros/perfil" element={<MembrosPerfil />} />
                <Route path="/membros/contrato" element={<MembrosContrato />} />
                <Route path="/assinar/:token" element={<MembrosContrato />} />
                <Route path="/membros/prospeccao" element={<MembrosProspeccao />} />
                <Route path="/membros/prospeccao/busca/:buscaId" element={<MembrosProspeccaoDescobertos />} />
                <Route path="/membros/prospeccao/diagnostico/:diagnosticoId" element={<MembrosProspeccaoDiagnostico />} />
                <Route path="/membros/prospeccao/diagnostico/:diagnosticoId/print" element={<AdminProspeccaoPrint />} />
                <Route path="/membros/prospeccao/meus-leads" element={<MembrosProspeccaoMeusLeads />} />
                <Route path="/membros/prospeccao/historico" element={<MembrosProspeccaoHistorico />} />

                {/* Admin routes - wrapped in AdminLayout */}
                <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
                <Route path="/admin/crm" element={<AdminLayout><AdminCRM /></AdminLayout>} />
                <Route path="/admin/clientes" element={<AdminLayout><AdminClientes360 /></AdminLayout>} />
                <Route path="/admin/vendas" element={<AdminLayout><SalesDashboard /></AdminLayout>} />
                <Route path="/admin/recebimentos" element={<AdminLayout><AdminRecebimentos /></AdminLayout>} />
                <Route path="/admin/financeiro" element={<AdminLayout><AdminFinanceiro /></AdminLayout>} />
                <Route path="/admin/whatsapp" element={<AdminLayout><AdminWhatsApp /></AdminLayout>} />
                <Route path="/admin/ligacoes" element={<AdminLayout><AdminCallMetrics /></AdminLayout>} />
                <Route path="/admin/onboarding" element={<AdminLayout><AdminOnboarding /></AdminLayout>} />
                <Route path="/admin/vhs/participantes" element={<AdminLayout><AdminVHSParticipants /></AdminLayout>} />
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
                <Route path="/admin/roleplay" element={<AdminLayout><AdminRoleplay /></AdminLayout>} />
                <Route path="/admin/grupos" element={<AdminLayout><AdminGrupos /></AdminLayout>} />
                <Route path="/admin/prospeccao" element={<AdminLayout><AdminProspeccao /></AdminLayout>} />
                <Route path="/admin/prospeccao/busca/:buscaId" element={<AdminLayout><AdminProspeccaoDescobertos /></AdminLayout>} />
                <Route path="/admin/prospeccao/diagnostico/:diagnosticoId" element={<AdminLayout><AdminProspeccaoDiagnostico /></AdminLayout>} />
                <Route path="/admin/prospeccao/diagnostico/:diagnosticoId/print" element={<AdminProspeccaoPrint />} />
                <Route path="/admin/prospeccao/configuracoes" element={<AdminLayout><AdminProspeccaoConfiguracoes /></AdminLayout>} />
                <Route path="/admin/prospeccao/historico" element={<AdminLayout><AdminProspeccaoHistorico /></AdminLayout>} />
                <Route path="/admin/recrutamento" element={<AdminLayout><AdminRecrutamento /></AdminLayout>} />
                <Route path="/admin/membros" element={<AdminLayout><AdminMembros /></AdminLayout>} />
                <Route path="/admin/acervo" element={<AdminLayout><AdminAcervo /></AdminLayout>} />
                <Route path="/admin/configuracoes" element={<AdminLayout><AdminConfiguracoes /></AdminLayout>} />
                <Route path="/admin/importar-kirvano" element={<AdminLayout><AdminImportarKirvano /></AdminLayout>} />
                <Route path="/admin/apresentacoes/reprograme-10x" element={<AdminLayout><AdminReprogramaSettings /></AdminLayout>} />
                <Route path="/admin/apresentacoes/estruturar-evento" element={<AdminLayout><EstruturarEvento /></AdminLayout>} />
                <Route path="/apresentacoes/masterclass-ia-negocios" element={<MasterclassDeckRedirect />} />

                {/* Marketing module — Email + WhatsApp blast + Automações */}
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
