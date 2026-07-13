import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Rocket, Lightbulb, Zap, Target, CheckCircle, ArrowRight, Clock, Shield, Smartphone, TrendingUp, Users, MessageCircle, Database, BarChart3, Brain, Headphones, ShoppingCart, Calendar, Instagram, Mail, Globe, Building, Briefcase, GraduationCap, Heart, Home, Car, Scale, Megaphone, Store, Camera, Scissors, Utensils, Dumbbell, PiggyBank, TreePine, Calculator } from "lucide-react";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import AnimatedBackground from "@/components/background/AnimatedBackground";
import LazyAIBrain3D from "@/components/lazy/LazyAIBrain3D";
import Card3D from "@/components/cards/Card3D";
import LazyChatSimulator from "@/components/lazy/LazyChatSimulator";
import { ScrollAnimation, StaggerAnimation, AnimatedCounter } from "@/components/animations/ScrollAnimations";
import { ROICalculator } from "@/components/calculators/ROICalculator";
import { QuickROICalculator } from "@/components/calculators/QuickROICalculator";
import { AnimatedCounter as NewAnimatedCounter } from "@/components/ui/AnimatedCounter";
import heroImage from "@/assets/hero-ai-agent.jpg";
import clinicIcon from "@/assets/clinic-icon.jpg";
import eventsIcon from "@/assets/events-icon.jpg";
import educationIcon from "@/assets/education-icon.jpg";
import squaadLogo from "@/assets/squaad-logo.jpeg";
const Index = () => {
  const handleCTAClick = () => {
    // WhatsApp com mensagem personalizada
    window.open("https://wa.me/5575998261542?text=Quero saber mais sobre implantação de IA para empresas", "_blank");
  };
  return <>
      <SEOHead />
      <Header />
      <AnimatedBackground />
      <div className="relative min-h-screen text-foreground pt-14 sm:pt-16 lg:pt-20 z-10 isolate">
      {/* 1️⃣ SEÇÃO HERO */}
      <section id="home" className="relative min-h-[calc(100vh-80px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 overflow-hidden">
        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            {/* Conteúdo principal */}
            <ScrollAnimation direction="left" className="text-center lg:text-left">
              <Badge className="bg-primary/20 text-primary border-primary/30 mb-6 text-sm font-medium justify-center lg:justify-start font-space-grotesk">
                <Rocket className="w-4 h-4 mr-2" />
                Esquadrão IA 24h
              </Badge>
              
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6 leading-tight font-space-grotesk">
                <span className="holographic-text">🚀 Seu esquadrão de IA</span><br />
                <span className="text-foreground">executando 24h por dia.</span><br />
                <span className="text-foreground">Sem falhas. Sem limites.</span>
              </h1>
              
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl lg:max-w-none leading-relaxed">
                Agentes especializados que automatizam processos, atendem clientes e fecham vendas enquanto você dorme. 
                Nossa + que Vencedores executa, você apenas colhe os resultados.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button onClick={handleCTAClick} className="btn-cta text-xs sm:text-sm lg:text-base pulse-glow py-3 px-6 sm:py-4 sm:px-8" size="lg">
                  👉 Quero Meu Esquadrão Agora
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline"
                      size="lg" 
                      className="border-primary/30 text-primary hover:bg-primary/10 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm lg:text-base font-semibold bg-white/10 backdrop-blur-sm hover:backdrop-blur-md transition-all duration-300 animate-pulse"
                    >
                      <Calculator className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      💰 Calcule Sua Economia
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-center text-2xl font-bold text-primary flex items-center justify-center gap-2">
                        <Calculator className="h-6 w-6" />
                        Calcule Quanto Você Pode Economizar
                      </DialogTitle>
                    </DialogHeader>
                    <QuickROICalculator onLeadCapture={handleCTAClick} />
                  </DialogContent>
                </Dialog>
              </div>
              
              {/* Economic Preview */}
              <ScrollAnimation direction="up" delay={0.8}>
                <div className="mt-12 max-w-md mx-auto lg:mx-0">
                  <Card className="glass-container border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
                    <CardContent className="p-6 text-center lg:text-left">
                      <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <span className="text-sm font-medium text-muted-foreground">Economia típica:</span>
                      </div>
                      <div className="text-3xl font-bold mb-2">
                        <NewAnimatedCounter 
                          from={0} 
                          to={180000} 
                          prefix="R$ " 
                          suffix="/ano"
                          className="text-green-600"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        *Baseado em empresas com 5-20 funcionários
                      </p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-primary border-primary/30 hover:bg-primary/10">
                            👉 Calcule o SEU potencial
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-center text-2xl font-bold text-primary flex items-center justify-center gap-2">
                              <Calculator className="h-6 w-6" />
                              Calcule Quanto Você Pode Economizar
                            </DialogTitle>
                          </DialogHeader>
                          <QuickROICalculator onLeadCapture={handleCTAClick} />
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                </div>
              </ScrollAnimation>

              <div className="mt-12 flex flex-wrap justify-center lg:justify-start gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>IA de Alta Performance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Suporte Dedicado</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Integração Omnichannel</span>
                </div>
              </div>
            </ScrollAnimation>

            {/* AI Brain 3D */}
            <ScrollAnimation direction="right" className="flex justify-center items-center">
              <div className="w-full max-w-xs sm:max-w-sm md:max-w-lg h-64 sm:h-80 md:h-96 lg:h-[500px] overflow-hidden">
                <LazyAIBrain3D scale={0.5} />
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* 2️⃣ SEÇÃO O QUE FAZEMOS */}
      <section id="services" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 xl:px-12 glass-container relative overflow-hidden isolate">
        <div className="container mx-auto">
          <ScrollAnimation direction="up" className="text-center mb-12 sm:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
              <span className="text-gradient">💡 Mais lucro,</span> menos gargalos.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Transforme sua operação com agentes inteligentes que trabalham sem parar
            </p>
          </ScrollAnimation>

          <StaggerAnimation direction="up" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {[{
              icon: <Target className="w-8 h-8" />,
              title: "Processos Mapeados",
              description: "Identificamos e automatizamos cada etapa do seu negócio"
            }, {
              icon: <Users className="w-8 h-8" />,
              title: "Agentes Personalizados",
              description: "IA treinada especificamente para o seu segmento"
            }, {
              icon: <Globe className="w-8 h-8" />,
              title: "Integração Omnichannel",
              description: "WhatsApp, Instagram, chat, email - todos os canais integrados"
            }, {
              icon: <Clock className="w-8 h-8" />,
              title: "Suporte Contínuo",
              description: "Monitoramento e otimização constante dos resultados"
            }].map((benefit, index) => <Card3D key={index} title={benefit.title} description={benefit.description} icon={benefit.icon} className="text-center">
                <div className="mt-4">
                  <AnimatedCounter from={0} to={24} suffix="h" className="text-2xl font-bold text-primary" />
                  <p className="text-xs text-muted-foreground">funcionando</p>
                </div>
              </Card3D>)}
          </StaggerAnimation>

          <ScrollAnimation direction="up" className="text-center mt-12">
            <Button onClick={handleCTAClick} className="btn-secondary">
              👉 Descubra Como Funciona
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </ScrollAnimation>
        </div>
      </section>

      {/* Chat Simulator */}
      <LazyChatSimulator onLeadCapture={lead => console.log('Lead capturado:', lead)} />

      {/* 3️⃣ SEÇÃO TECNOLOGIA E INFRAESTRUTURA */}
      <section id="tech" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 xl:px-12 neural-bg relative overflow-hidden isolate">
        <div className="container mx-auto">
          <ScrollAnimation direction="up" className="text-center mb-12 sm:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
              <span className="text-gradient">🚀 Tecnologia de</span><br />
              Alta Performance
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Infraestrutura robusta que suporta operações empresariais de qualquer escala
            </p>
          </ScrollAnimation>

          <StaggerAnimation direction="up" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-12 sm:mb-16">
            {[{
              icon: <Database className="w-8 h-8" />,
              title: "Banco de Dados",
              description: "Infraestrutura escalável com backup automático e segurança enterprise"
            }, {
              icon: <BarChart3 className="w-8 h-8" />,
              title: "Dashboard & BI",
              description: "Analytics em tempo real com insights inteligentes para tomada de decisão"
            }, {
              icon: <Brain className="w-8 h-8" />,
              title: "IA Avançada",
              description: "Machine Learning e NLP de última geração para conversas naturais"
            }, {
              icon: <Shield className="w-8 h-8" />,
              title: "Segurança LGPD",
              description: "Conformidade total com proteção de dados e criptografia avançada"
            }].map((tech, index) => <Card3D key={index} title={tech.title} description={tech.description} icon={tech.icon} className="text-center" variant="highlight">
                <div className="mt-4">
                  <AnimatedCounter from={0} to={99} suffix="%" className="text-2xl font-bold text-background" />
                  <p className="text-xs text-background/70">uptime</p>
                </div>
              </Card3D>)}
          </StaggerAnimation>

          <ScrollAnimation direction="up" className="text-center">
            <Button onClick={handleCTAClick} className="btn-secondary">
              👉 Conheça Nossa Infraestrutura
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </ScrollAnimation>
        </div>
      </section>

      {/* 4️⃣ SEÇÃO AGENTES ESPECIALIZADOS */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 xl:px-12 tech-grid relative overflow-hidden isolate">
        <div className="container mx-auto">
          <ScrollAnimation direction="up" className="text-center mb-12 sm:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
              <span className="text-gradient">🤖 Agentes Especializados</span><br />
              para Cada Função
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Uma equipe completa de IA trabalhando 24h para maximizar seus resultados
            </p>
          </ScrollAnimation>

          <StaggerAnimation direction="up" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[{
              icon: <Headphones className="w-8 h-8" />,
              title: "SDR Automatizado",
              description: "Prospecção inteligente, qualificação de leads e agendamento de reuniões"
            }, {
              icon: <ShoppingCart className="w-8 h-8" />,
              title: "Agente de Pré-Venda",
              description: "Nutrição de leads, apresentação de produtos e preparo para fechamento"
            }, {
              icon: <TrendingUp className="w-8 h-8" />,
              title: "Agente de Vendas",
              description: "Apresentações personalizadas, negociação e fechamento automatizado"
            }, {
              icon: <Users className="w-8 h-8" />,
              title: "Pós-Venda & Suporte",
              description: "Onboarding, suporte técnico e acompanhamento de satisfação"
            }, {
              icon: <Calendar className="w-8 h-8" />,
              title: "Follow-up Inteligente",
              description: "Retomada automática de conversas, lembretes e reativação de leads"
            }, {
              icon: <Instagram className="w-8 h-8" />,
              title: "Social Selling",
              description: "Automação para Instagram, LinkedIn e outras redes sociais"
            }].map((agent, index) => <Card3D key={index} title={agent.title} description={agent.description} icon={agent.icon} className="float-animation" variant="highlight">
                <div className="mt-4 flex justify-center">
                  <Badge className="bg-white/20 text-white border-white/30">
                    <Brain className="w-3 h-3 mr-1" />
                    AI-Powered
                  </Badge>
                </div>
              </Card3D>)}
          </StaggerAnimation>
        </div>
      </section>

      {/* 5️⃣ SEÇÃO SOLUÇÕES POR NICHO */}
      <section id="solutions" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 xl:px-12 glass-container relative overflow-hidden isolate">
        <div className="container mx-auto">
          <ScrollAnimation direction="up" className="text-center mb-12 sm:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
              <span className="text-gradient">⚡ Escolha sua solução</span><br />
              e escale resultados.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Soluções específicas para cada tipo de negócio, prontas para implementar
            </p>
          </ScrollAnimation>

          <StaggerAnimation direction="up" staggerDelay={0.1} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {[{
              icon: clinicIcon,
              emoji: "🩺",
              title: "DR. IA Resolve",
              subtitle: "Clínicas e Saúde",
              description: "Automatize agendamentos, confirme consultas e ofereça suporte 24h aos pacientes.",
              features: ["Agendamento automático", "Confirmação de consultas", "Suporte pós-atendimento", "Lembretes personalizados"],
              iconLucide: <Heart className="w-6 h-6" />
            }, {
              icon: eventsIcon,
              emoji: "🎉",
              title: "IA Celebration",
              subtitle: "Eventos e Buffets",
              description: "Gerencie orçamentos, confirme datas e acompanhe todo o processo do evento.",
              features: ["Orçamentos automáticos", "Gestão de datas", "Confirmações", "Follow-up de clientes"],
              iconLucide: <Calendar className="w-6 h-6" />
            }, {
              icon: educationIcon,
              emoji: "📚",
              title: "IA EduMentorFlow",
              subtitle: "Educação e Cursos",
              description: "Automatize pré-vendas, suporte a alunos e agendamento de mentorias.",
              features: ["Pré-venda automatizada", "Suporte a estudantes", "Agendamento de aulas", "Acompanhamento pedagógico"],
              iconLucide: <GraduationCap className="w-6 h-6" />
            }, {
              emoji: "🏢",
              title: "IA Corporate",
              subtitle: "Empresas e B2B",
              description: "Gestão completa de leads B2B, apresentações e propostas comerciais automatizadas.",
              features: ["Lead scoring automático", "Propostas personalizadas", "Pipeline inteligente", "CRM integrado"],
              iconLucide: <Building className="w-6 h-6" />
            }, {
              emoji: "🏠",
              title: "IA Residence",
              subtitle: "Imobiliárias",
              description: "Qualifique compradores, agende visitas e gerencie todo processo de venda de imóveis.",
              features: ["Qualificação de leads", "Agendamento de visitas", "Cálculo de financiamento", "Follow-up automático"],
              iconLucide: <Home className="w-6 h-6" />
            }, {
              emoji: "⚖️",
              title: "IA Advocate",
              subtitle: "Advocacia",
              description: "Pré-atendimento jurídico, triagem de casos e agendamento de consultas especializadas.",
              features: ["Triagem de casos", "Pré-atendimento", "Agendamento", "Documentação automática"],
              iconLucide: <Scale className="w-6 h-6" />
            }, {
              emoji: "💼",
              title: "IA Consultant",
              subtitle: "Consultorias",
              description: "Qualificação de prospects, apresentação de serviços e agendamento de diagnósticos.",
              features: ["Qualificação de prospects", "Apresentação de casos", "Agendamento", "Proposta automática"],
              iconLucide: <Briefcase className="w-6 h-6" />
            }, {
              emoji: "🛒",
              title: "IA Commerce",
              subtitle: "E-commerce",
              description: "Suporte a compras, recomendações personalizadas e recovery de carrinho abandonado.",
              features: ["Suporte de vendas", "Recomendações IA", "Recovery de carrinho", "Pós-venda automático"],
              iconLucide: <Store className="w-6 h-6" />
            }, {
              emoji: "🚗",
              title: "IA Auto",
              subtitle: "Concessionárias",
              description: "Qualificação de interessados, agendamento de test-drive e acompanhamento de vendas.",
              features: ["Lead scoring", "Agendamento test-drive", "Seguros e financiamento", "Pós-venda"],
              iconLucide: <Car className="w-6 h-6" />
            }, {
              emoji: "📸",
              title: "IA Studio",
              subtitle: "Estúdios Fotográficos",
              description: "Agendamento de sessões, orçamentos personalizados e acompanhamento de entregas.",
              features: ["Agendamento de sessões", "Orçamentos automáticos", "Galeria de trabalhos", "Entrega de fotos"],
              iconLucide: <Camera className="w-6 h-6" />
            }, {
              emoji: "✂️",
              title: "IA Beauty",
              subtitle: "Salões e Estética",
              description: "Agendamento de serviços, lembretes de retorno e programas de fidelidade automáticos.",
              features: ["Agendamento online", "Lembretes automáticos", "Fidelidade", "Upsell de serviços"],
              iconLucide: <Scissors className="w-6 h-6" />
            }, {
              emoji: "🍽️",
              title: "IA Food",
              subtitle: "Restaurantes",
              description: "Reservas, pedidos delivery, cardápio digital e feedback automatizado de clientes.",
              features: ["Reservas automáticas", "Pedidos delivery", "Cardápio digital", "Feedback de clientes"],
              iconLucide: <Utensils className="w-6 h-6" />
            }, {
              emoji: "💪",
              title: "IA Fitness",
              subtitle: "Academias e Personal",
              description: "Agendamento de aulas, planos de treino personalizados e acompanhamento de evolução.",
              features: ["Agendamento de aulas", "Planos personalizados", "Evolução física", "Nutrição automática"],
              iconLucide: <Dumbbell className="w-6 h-6" />
            }, {
              emoji: "💰",
              title: "IA Finance",
              subtitle: "Consultorias Financeiras",
              description: "Análise de perfil, recomendações de investimento e acompanhamento de carteira.",
              features: ["Perfil de investidor", "Recomendações IA", "Acompanhamento", "Educação financeira"],
              iconLucide: <PiggyBank className="w-6 h-6" />
            }, {
              emoji: "🌲",
              title: "IA Green",
              subtitle: "Sustentabilidade",
              description: "Projetos ambientais, consultoria em sustentabilidade e compensação de carbono.",
              features: ["Projetos ambientais", "Auditoria sustentável", "Compensação carbono", "Relatórios ESG"],
              iconLucide: <TreePine className="w-6 h-6" />
            }, {
              emoji: "📢",
              title: "IA Marketing",
              subtitle: "Agências e Marketing",
              description: "Gestão de campanhas, análise de performance e otimização automática de anúncios.",
              features: ["Gestão de campanhas", "ROI automático", "A/B testing", "Relatórios inteligentes"],
              iconLucide: <Megaphone className="w-6 h-6" />
            }].map((solution, index) => <Card key={index} className="solution-card pulse-glow hover-scale">
                <CardContent className="p-4">
                  <div className="text-center mb-4">
                    {solution.icon && <div className="w-12 h-12 mx-auto mb-3 rounded-full overflow-hidden">
                        <img src={solution.icon} alt={solution.title} className="w-full h-full object-cover" />
                      </div>}
                    
                    <h3 className="text-lg font-bold holographic-text mb-1">{solution.title}</h3>
                    <p className="text-primary font-medium text-sm">{solution.subtitle}</p>
                  </div>
                  
                  <p className="text-muted-foreground mb-4 leading-relaxed text-sm">{solution.description}</p>
                  
                  <ul className="space-y-1 mb-4">
                    {solution.features.map((feature, idx) => <li key={idx} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>)}
                  </ul>
                  
                  <Button onClick={handleCTAClick} className="w-full btn-secondary text-sm">
                    Saiba mais
                    <ArrowRight className="w-3 h-3 ml-2" />
                  </Button>
                </CardContent>
              </Card>)}
          </StaggerAnimation>
        </div>
      </section>

      {/* 6️⃣ SEÇÃO CASOS DE USO */}
      <section id="cases" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 xl:px-12 neural-bg relative overflow-hidden isolate">
        <div className="container mx-auto">
          <ScrollAnimation direction="up" className="text-center mb-12 sm:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
              <span className="text-gradient">📊 Casos de Uso</span><br />
              Reais de Sucesso
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Veja como nossa IA já está transformando negócios em diferentes setores
            </p>
          </ScrollAnimation>

          <StaggerAnimation direction="up" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[{
              title: "Clínica aumentou 300% confirmações",
              description: "IA reduziu faltas e otimizou agenda médica",
              metrics: ["300% mais confirmações", "50% menos faltas", "24h atendimento"],
              sector: "Saúde"
            }, {
              title: "E-commerce dobrou conversão noturna",
              description: "Atendimento 24h capturou vendas perdidas",
              metrics: ["200% mais vendas noturnas", "85% satisfação", "15min tempo resposta"],
              sector: "E-commerce"
            }, {
              title: "Escola particular 5x mais matrículas",
              description: "IA qualificou leads e agendou visitas automaticamente",
              metrics: ["500% mais matrículas", "90% leads qualificados", "0 perda de contato"],
              sector: "Educação"
            }, {
              title: "Advocacia triplicou consultas",
              description: "Pré-atendimento jurídico 24h captou mais casos",
              metrics: ["300% mais consultas", "95% precisão triagem", "24h primeira resposta"],
              sector: "Jurídico"
            }, {
              title: "Imobiliária 400% mais visitas agendadas",
              description: "IA qualificou compradores e otimizou agenda",
              metrics: ["400% mais visitas", "80% leads qualificados", "3x velocidade resposta"],
              sector: "Imobiliário"
            }, {
              title: "Buffet reduziu 90% reuniões desnecessárias",
              description: "IA filtrou orçamentos e pré-selecionou clientes",
              metrics: ["90% menos reuniões", "70% mais contratos", "5x ROI investimento"],
              sector: "Eventos"
            }].map((useCase, index) => <Card3D key={index} title={useCase.title} description={useCase.description} className="hover-scale">
                <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">{useCase.sector}</Badge>
                <div className="space-y-2 mt-4">
                  {useCase.metrics.map((metric, idx) => <div key={idx} className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{metric}</span>
                    </div>)}
                </div>
              </Card3D>)}
          </StaggerAnimation>

          <ScrollAnimation direction="up" className="text-center mt-12">
            <Button onClick={handleCTAClick} className="btn-cta pulse-glow">
              👉 Quero Resultados Como Estes
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </ScrollAnimation>
        </div>
      </section>

      {/* 🧮 SEÇÃO CALCULADORA ROI */}
      <section id="roi-calculator" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 xl:px-12 glass-container relative overflow-hidden isolate">
        <div className="container mx-auto">
          <ScrollAnimation direction="up" className="text-center mb-12 sm:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
              <span className="text-gradient">💰 Calculadora de ROI</span><br />
              Descubra sua Economia com Agentes IA
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Calcule em tempo real quanto você pode economizar substituindo funcionários por nossa solução de IA
            </p>
          </ScrollAnimation>

          <ScrollAnimation direction="up">
            <ROICalculator onLeadCapture={handleCTAClick} />
          </ScrollAnimation>
        </div>
      </section>

      {/* 7️⃣ SEÇÃO POR QUE ESCOLHER */}
      <section id="differentials" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 xl:px-12 tech-grid relative overflow-hidden isolate">
        <div className="container mx-auto">
          <ScrollAnimation direction="up" className="text-center mb-12 sm:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
              <span className="text-gradient">🔥 Por que escolher a</span> <span className="holographic-text font-space-grotesk">+ que Vencedores</span>?
            </h2>
          </ScrollAnimation>

          <StaggerAnimation direction="up" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {[{
              icon: <Clock className="w-8 h-8" />,
              title: "Executa 24/7",
              description: "Inteligência que nunca para, nunca falha e está sempre aprendendo"
            }, {
              icon: <Zap className="w-8 h-8" />,
              title: "Suporte Rápido",
              description: "Time especializado pronto para otimizar seus resultados"
            }, {
              icon: <TrendingUp className="w-8 h-8" />,
              title: "Fluxos Exclusivos",
              description: "Processos únicos desenvolvidos para o seu nicho específico"
            }, {
              icon: <Shield className="w-8 h-8" />,
              title: "Alinhado à LGPD",
              description: "Segurança e conformidade total com as leis de proteção de dados"
            }].map((differential, index) => <Card3D key={index} title={differential.title} description={differential.description} icon={differential.icon} className="text-center float-animation" variant="highlight">
                <div className="mt-4">
                  <div className="w-8 h-8 mx-auto bg-white/20 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-background" />
                  </div>
                </div>
              </Card3D>)}
          </StaggerAnimation>
        </div>
      </section>

      {/* 8️⃣ SEÇÃO FINAL (CTA FORTE) */}
      <section id="contact" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 xl:px-12 relative overflow-hidden glass-container isolate">
        {/* Subtle background effect - contained */}
        <div className="container mx-auto relative z-10">
          <ScrollAnimation direction="up" className="text-center max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-6 font-space-grotesk">
              <span className="holographic-text">✨ Entre para o esquadrão</span><br />
              da automação de elite.
            </h2>
            
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Chega de gargalos. Seu esquadrão de IA especializado roda seu negócio enquanto você dorme.
            </p>
            
            <Button onClick={handleCTAClick} className="btn-cta text-xs sm:text-sm lg:text-base py-3 px-6 sm:py-4 sm:px-8 lg:py-6 lg:px-12 pulse-glow mb-8" size="lg">
              👉 Fale com um Especialista + que Vencedores Agora
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ml-2 sm:ml-3" />
            </Button>
            
            <StaggerAnimation direction="up" className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                <span>Implementação em 24h</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>Garantia de Resultados</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Suporte Especializado</span>
              </div>
            </StaggerAnimation>
          </ScrollAnimation>
        </div>
      </section>

      {/* FOOTER SIMPLES */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 xl:px-12 border-t border-border">
        <div className="container mx-auto flex flex-col items-center gap-6">
          <img 
            src={squaadLogo} 
            alt="+ que Vencedores Business Solutions" 
            className="h-16 md:h-20 w-auto"
          />
          <p className="text-muted-foreground text-center">
            © 2025 + que Vencedores - Esquadrão de IA de Alta Performance. Todos os direitos reservados.
          </p>
        </div>
      </footer>
      </div>
    </>;
};
export default Index;