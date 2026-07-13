import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";

const TermosDeUso = () => {
  return (
    <>
      <SEOHead 
        title="Termos de Uso | + que Vencedores - Automação com IA"
        description="Termos de Uso da + que Vencedores. Conheça as condições de uso dos nossos serviços de automação com inteligência artificial."
        url="https://squaad.com.br/termos"
      />
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Link to="/">
            <Button variant="ghost" className="mb-8 gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Button>
          </Link>

          <h1 className="text-4xl font-bold text-foreground mb-8">Termos de Uso</h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 text-muted-foreground">
            <p className="text-sm text-muted-foreground">
              Última atualização: 30 de Janeiro de 2026
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar os serviços da + que Vencedores Business Solutions ("+ que Vencedores", "nós", "nosso"), você concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Descrição dos Serviços</h2>
              <p>
                A + que Vencedores oferece soluções de automação empresarial utilizando inteligência artificial, incluindo:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Agentes de IA para atendimento automatizado 24 horas</li>
                <li>Automação de processos de vendas e captação de clientes</li>
                <li>Integração omnichannel (WhatsApp, Instagram, e-mail, chat)</li>
                <li>Dashboards de analytics e gestão</li>
                <li>Consultoria e implementação de soluções de IA</li>
                <li>Treinamentos e imersões sobre inteligência artificial</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. Uso Aceitável</h2>
              <p>Você concorda em não utilizar nossos serviços para:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Violar qualquer lei ou regulamento aplicável</li>
                <li>Enviar spam, mensagens não solicitadas ou conteúdo ofensivo</li>
                <li>Tentar acessar sistemas ou dados sem autorização</li>
                <li>Interferir ou interromper nossos serviços ou servidores</li>
                <li>Coletar informações de outros usuários sem consentimento</li>
                <li>Usar os serviços para atividades fraudulentas ou enganosas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Conta e Segurança</h2>
              <p>
                Ao criar uma conta ou fornecer informações para contratação de serviços, você é responsável por:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Fornecer informações precisas e atualizadas</li>
                <li>Manter a confidencialidade de suas credenciais de acesso</li>
                <li>Notificar imediatamente sobre qualquer uso não autorizado</li>
                <li>Todas as atividades realizadas em sua conta</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo, marca, logotipos, software e tecnologia da + que Vencedores são protegidos por direitos autorais e propriedade intelectual. Você não pode:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Copiar, modificar ou distribuir nosso conteúdo sem autorização</li>
                <li>Usar nossa marca ou logotipos sem permissão expressa</li>
                <li>Fazer engenharia reversa de nossos sistemas ou software</li>
                <li>Remover avisos de direitos autorais ou propriedade</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Pagamentos e Cancelamentos</h2>
              <p>
                Os termos de pagamento são definidos em contrato específico para cada cliente. Em geral:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Os valores de setup são cobrados antes do início da implementação</li>
                <li>Mensalidades são cobradas conforme data de vencimento acordada</li>
                <li>Cancelamentos devem ser solicitados com antecedência mínima de 30 dias</li>
                <li>Reembolsos são avaliados caso a caso conforme política vigente</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Limitação de Responsabilidade</h2>
              <p>
                A + que Vencedores não se responsabiliza por:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Danos indiretos, incidentais ou consequenciais</li>
                <li>Perda de dados ou lucros cessantes</li>
                <li>Interrupções temporárias nos serviços por manutenção</li>
                <li>Ações de terceiros ou integrações externas</li>
                <li>Resultados específicos de vendas ou conversões</li>
              </ul>
              <p className="mt-4">
                Nossos resultados apresentados são baseados em casos reais, mas podem variar conforme o segmento, implementação e uso dos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Modificações dos Termos</h2>
              <p>
                Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas serão comunicadas por e-mail ou através de nosso site. O uso continuado dos serviços após modificações constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">9. Lei Aplicável</h2>
              <p>
                Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será resolvida no foro da Comarca de Feira de Santana, Estado da Bahia.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">10. Contato</h2>
              <p>
                Para dúvidas sobre estes Termos de Uso, entre em contato:
              </p>
              <ul className="list-none mt-4 space-y-2">
                <li><strong>E-mail:</strong> contato@squaad.com.br</li>
                <li><strong>WhatsApp:</strong> +55 (75) 99826-1542</li>
                <li><strong>Site:</strong> www.squaad.com.br</li>
              </ul>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <Link to="/privacidade" className="text-primary hover:underline">
              Ver Política de Privacidade →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default TermosDeUso;
