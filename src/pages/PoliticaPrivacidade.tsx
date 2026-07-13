import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";

const PoliticaPrivacidade = () => {
  return (
    <>
      <SEOHead 
        title="Política de Privacidade | + que Vencedores - Automação com IA"
        description="Política de Privacidade da + que Vencedores. Saiba como coletamos, usamos e protegemos seus dados pessoais."
        url="https://squaad.com.br/privacidade"
      />
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Link to="/">
            <Button variant="ghost" className="mb-8 gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Button>
          </Link>

          <h1 className="text-4xl font-bold text-foreground mb-8">Política de Privacidade</h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 text-muted-foreground">
            <p className="text-sm text-muted-foreground">
              Última atualização: 30 de Janeiro de 2026
            </p>

            <p className="text-lg">
              A + que Vencedores Business Solutions ("+ que Vencedores", "nós", "nosso") está comprometida com a proteção de sua privacidade e dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Dados que Coletamos</h2>
              <p>Podemos coletar os seguintes tipos de dados:</p>
              
              <h3 className="text-xl font-medium text-foreground mt-6 mb-3">1.1 Dados fornecidos por você:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Nome completo</li>
                <li>Número de WhatsApp e telefone</li>
                <li>Endereço de e-mail</li>
                <li>Nome da empresa e cargo</li>
                <li>Perfil do Instagram (quando fornecido)</li>
                <li>Informações sobre seu negócio e necessidades</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground mt-6 mb-3">1.2 Dados coletados automaticamente:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Endereço IP e localização aproximada (cidade/estado)</li>
                <li>Informações do dispositivo e navegador</li>
                <li>Páginas visitadas e tempo de permanência</li>
                <li>Origem do tráfego (como você chegou ao nosso site)</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground mt-6 mb-3">1.3 Dados de redes sociais:</h3>
              <p>
                Quando você fornece seu perfil do Instagram, podemos coletar informações públicas disponíveis, como nome de usuário, foto de perfil, biografia e publicações públicas, para personalizar nossa comunicação e oferecer um atendimento mais relevante.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Como Usamos seus Dados</h2>
              <p>Utilizamos seus dados para:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Entrar em contato sobre nossos serviços e soluções</li>
                <li>Personalizar mensagens e ofertas de acordo com seu perfil</li>
                <li>Processar pagamentos e gerenciar contratos</li>
                <li>Fornecer suporte técnico e atendimento ao cliente</li>
                <li>Enviar comunicações sobre atualizações, novidades e eventos</li>
                <li>Melhorar nossos serviços e experiência do usuário</li>
                <li>Cumprir obrigações legais e regulatórias</li>
                <li>Realizar análises estatísticas e de mercado</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. Base Legal para Tratamento</h2>
              <p>Tratamos seus dados com base nas seguintes bases legais da LGPD:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Consentimento:</strong> Quando você preenche formulários ou fornece informações voluntariamente</li>
                <li><strong>Execução de Contrato:</strong> Para prestação de serviços contratados</li>
                <li><strong>Legítimo Interesse:</strong> Para melhorar nossos serviços e comunicação</li>
                <li><strong>Obrigação Legal:</strong> Para cumprir exigências fiscais e regulatórias</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Compartilhamento de Dados</h2>
              <p>Seus dados podem ser compartilhados com:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Parceiros de tecnologia:</strong> Plataformas de automação, CRM e ferramentas de comunicação necessárias para prestação dos serviços</li>
                <li><strong>Processadores de pagamento:</strong> Para processamento seguro de transações financeiras</li>
                <li><strong>Autoridades legais:</strong> Quando exigido por lei ou ordem judicial</li>
              </ul>
              <p className="mt-4">
                <strong>Não vendemos seus dados pessoais a terceiros</strong> para fins de marketing ou publicidade.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Segurança dos Dados</h2>
              <p>Implementamos medidas técnicas e organizacionais para proteger seus dados, incluindo:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Criptografia de dados em trânsito e em repouso</li>
                <li>Controles de acesso restritos</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups regulares e planos de recuperação</li>
                <li>Treinamento da equipe sobre proteção de dados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Seus Direitos (LGPD)</h2>
              <p>Você tem os seguintes direitos sobre seus dados:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Acesso:</strong> Solicitar informações sobre quais dados possuímos sobre você</li>
                <li><strong>Correção:</strong> Solicitar correção de dados incompletos ou imprecisos</li>
                <li><strong>Eliminação:</strong> Solicitar exclusão de seus dados pessoais</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Revogação:</strong> Retirar seu consentimento a qualquer momento</li>
                <li><strong>Oposição:</strong> Opor-se ao tratamento de dados em determinadas situações</li>
                <li><strong>Informação:</strong> Saber com quem seus dados são compartilhados</li>
              </ul>
              <p className="mt-4">
                Para exercer qualquer desses direitos, entre em contato através dos canais listados abaixo.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Cookies e Tecnologias Similares</h2>
              <p>Utilizamos cookies para:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Lembrar suas preferências e sessão</li>
                <li>Analisar o tráfego e uso do site</li>
                <li>Personalizar conteúdo e anúncios</li>
                <li>Medir a eficácia de campanhas de marketing</li>
              </ul>
              <p className="mt-4">
                Você pode gerenciar ou desativar cookies através das configurações do seu navegador.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Retenção de Dados</h2>
              <p>
                Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política, ou conforme exigido por lei. Dados de clientes são mantidos durante a vigência do contrato e por até 5 anos após o término, para fins fiscais e legais.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">9. Transferência Internacional</h2>
              <p>
                Alguns de nossos parceiros de tecnologia podem estar localizados fora do Brasil. Nesses casos, garantimos que a transferência de dados seja realizada em conformidade com a LGPD, utilizando cláusulas contratuais padrão ou outros mecanismos legais apropriados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">10. Alterações na Política</h2>
              <p>
                Esta política pode ser atualizada periodicamente. Alterações significativas serão comunicadas por e-mail ou através de aviso em nosso site. Recomendamos revisar esta página regularmente.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">11. Contato e Encarregado (DPO)</h2>
              <p>
                Para dúvidas, solicitações ou exercício de direitos relacionados à privacidade e proteção de dados:
              </p>
              <ul className="list-none mt-4 space-y-2">
                <li><strong>E-mail:</strong> privacidade@squaad.com.br</li>
                <li><strong>WhatsApp:</strong> +55 (75) 99826-1542</li>
                <li><strong>Site:</strong> www.squaad.com.br</li>
              </ul>
              <p className="mt-4">
                Responderemos às suas solicitações no prazo de até 15 dias úteis, conforme estabelecido pela LGPD.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <Link to="/termos" className="text-primary hover:underline">
              Ver Termos de Uso →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default PoliticaPrivacidade;
