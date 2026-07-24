import { LegalLayout, Secao } from './LegalLayout';

export default function Privacidade() {
  return (
    <LegalLayout titulo="Política de Privacidade" atualizacao="24 de julho de 2026">
      <p className="text-white/70">
        Esta Política de Privacidade descreve como a <strong>IAS Institute LTDA</strong>, responsável pela
        Comunidade <strong>+ que Vencedores</strong> ("nós"), coleta, usa, compartilha e protege os dados
        pessoais de quem acessa nossa plataforma, se cadastra na comunidade ou se comunica conosco ("você").
        Tratamos seus dados em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>

      <Secao titulo="1. Quem é o responsável pelos dados">
        <p>
          O controlador dos seus dados é a IAS Institute LTDA, com sede na Rua Patativas 308, Sala 406, Imbui,
          Salvador/BA. Para qualquer assunto sobre privacidade, fale com a gente em{' '}
          <a href="mailto:contato@iasinstituto.com.br" className="underline hover:text-white">contato@iasinstituto.com.br</a>.
        </p>
      </Secao>

      <Secao titulo="2. Quais dados coletamos">
        <p>Coletamos apenas o necessário para você participar da comunidade:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Cadastro:</strong> nome, e-mail, telefone/WhatsApp, cidade e, quando você informa, foto de perfil, Instagram, profissão, data de nascimento e CPF.</li>
          <li><strong>Participação:</strong> sua faixa, treinamentos, eventos, indicações e interações dentro da plataforma.</li>
          <li><strong>Compras de formações/eventos:</strong> processadas por parceiros de pagamento (ex.: Eduzz), que nos informam a confirmação da compra e os dados de contato do comprador.</li>
          <li><strong>Navegação:</strong> dados técnicos como endereço IP, tipo de dispositivo e cookies, para o funcionamento e a segurança do site.</li>
        </ul>
      </Secao>

      <Secao titulo="3. Como usamos seus dados">
        <ul className="list-disc space-y-1 pl-5">
          <li>Criar e gerenciar seu acesso à comunidade;</li>
          <li>Enviar comunicações da comunidade (boas-vindas, avisos de eventos, conteúdos e novidades);</li>
          <li>Registrar sua evolução (faixa, treinamentos, indicações);</li>
          <li>Dar suporte e responder às suas solicitações;</li>
          <li>Cumprir obrigações legais e garantir a segurança da plataforma.</li>
        </ul>
      </Secao>

      <Secao titulo="4. Comunicações por e-mail e WhatsApp">
        <p>
          Ao se cadastrar ou informar seu contato, você concorda em receber comunicações da comunidade por
          <strong> e-mail</strong> e por <strong>WhatsApp</strong>. Usamos a API oficial do WhatsApp (Meta) apenas
          para mensagens relacionadas à sua participação (confirmações, links de grupo, avisos de eventos e conteúdos).
          Você pode pedir para parar de receber a qualquer momento — respondendo à mensagem, usando o link de
          descadastro nos e-mails, ou escrevendo para contato@iasinstituto.com.br.
        </p>
      </Secao>

      <Secao titulo="5. Com quem compartilhamos">
        <p>
          <strong>Nós não vendemos seus dados.</strong> Compartilhamos apenas com prestadores que operam a
          plataforma em nosso nome, sob contrato e obrigação de sigilo:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Infraestrutura e banco de dados</strong> (hospedagem segura da aplicação);</li>
          <li><strong>Envio de e-mails</strong> (provedor de e-mail transacional);</li>
          <li><strong>WhatsApp/Meta</strong> (mensageria oficial), conforme as políticas da Meta Platforms;</li>
          <li><strong>Plataformas de pagamento</strong> (ex.: Eduzz) para processar compras.</li>
        </ul>
        <p>Também podemos compartilhar dados quando exigido por lei ou por autoridade competente.</p>
      </Secao>

      <Secao titulo="6. Cookies">
        <p>
          Usamos cookies e tecnologias semelhantes para manter você conectado, lembrar preferências e entender o uso
          do site. Você pode gerenciar cookies nas configurações do seu navegador; alguns recursos podem não
          funcionar sem eles.
        </p>
      </Secao>

      <Secao titulo="7. Segurança e retenção">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda
          ou alteração. Guardamos seus dados enquanto durar sua participação na comunidade e pelo prazo necessário
          para cumprir obrigações legais. Depois disso, eles são eliminados ou anonimizados.
        </p>
      </Secao>

      <Secao titulo="8. Seus direitos (LGPD)">
        <p>Você pode, a qualquer momento, solicitar:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>portabilidade e informação sobre com quem compartilhamos;</li>
          <li>revogação do consentimento e exclusão dos dados tratados com base nele.</li>
        </ul>
        <p>
          Para exercer seus direitos, escreva para{' '}
          <a href="mailto:contato@iasinstituto.com.br" className="underline hover:text-white">contato@iasinstituto.com.br</a>.
        </p>
      </Secao>

      <Secao titulo="9. Menores de idade">
        <p>
          A comunidade é destinada a maiores de 18 anos. Não coletamos intencionalmente dados de menores sem o
          consentimento dos responsáveis.
        </p>
      </Secao>

      <Secao titulo="10. Alterações desta política">
        <p>
          Podemos atualizar esta política para refletir melhorias ou mudanças legais. A versão vigente está sempre
          nesta página, com a data de atualização no topo.
        </p>
      </Secao>
    </LegalLayout>
  );
}
