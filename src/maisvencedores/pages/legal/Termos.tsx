import { LegalLayout, Secao } from './LegalLayout';

export default function Termos() {
  return (
    <LegalLayout titulo="Termos de Uso" atualizacao="24 de julho de 2026">
      <p className="text-white/70">
        Estes Termos de Uso regem o acesso e a participação na Comunidade <strong>+ que Vencedores</strong>,
        uma iniciativa da <strong>IAS Institute LTDA</strong>. Ao se cadastrar ou usar a plataforma, você declara
        que leu e concorda com estes termos e com a nossa Política de Privacidade.
      </p>

      <Secao titulo="1. A comunidade">
        <p>
          A + que Vencedores é uma comunidade de desenvolvimento pessoal, profissional, espiritual e financeiro,
          com aulas, treinamentos, eventos e conteúdos. A participação é focada em evolução e relacionamento —
          <strong> não é uma oportunidade de renda e não promete ganhos financeiros</strong> de qualquer natureza.
        </p>
      </Secao>

      <Secao titulo="2. Cadastro e conta">
        <p>
          Para participar, você cria uma conta com dados verdadeiros e mantém suas credenciais em sigilo. Você é
          responsável pela atividade na sua conta. Podemos suspender ou encerrar contas que violem estes termos,
          usem dados falsos ou prejudiquem outros membros.
        </p>
      </Secao>

      <Secao titulo="3. Faixas">
        <p>
          A evolução na comunidade acontece por <strong>faixas</strong>, que refletem a jornada de formação e
          participação de cada pessoa. A faixa é <strong>declarada e reconhecida pela equipe</strong> conforme os
          treinamentos concluídos — ela <strong>não é comprada</strong> nem concedida automaticamente por indicar
          pessoas.
        </p>
      </Secao>

      <Secao titulo="4. Programa de indicação">
        <p>
          Você pode convidar outras pessoas com seu link de indicação. As indicações geram <strong>pontos</strong>
          {' '}dentro da comunidade, usados para reconhecimento e recompensas internas. Esses pontos{' '}
          <strong>não representam dinheiro, comissão ou remuneração</strong> e não podem ser convertidos em valores.
        </p>
      </Secao>

      <Secao titulo="5. Conduta">
        <p>Ao participar, você concorda em não:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>usar a plataforma para fins ilícitos, ofensivos ou enganosos;</li>
          <li>importunar, discriminar ou prejudicar outros membros;</li>
          <li>divulgar spam, correntes ou ofertas não autorizadas;</li>
          <li>copiar, revender ou redistribuir os conteúdos sem autorização.</li>
        </ul>
      </Secao>

      <Secao titulo="6. Conteúdo e propriedade intelectual">
        <p>
          As aulas, materiais, marca e identidade visual da + que Vencedores e do IAS Instituto são protegidos e
          pertencem à IAS Institute LTDA ou a seus licenciadores. Seu acesso é pessoal e intransferível, apenas
          para uso dentro da comunidade.
        </p>
      </Secao>

      <Secao titulo="7. Comunicações">
        <p>
          Ao se cadastrar, você autoriza o recebimento de comunicações por e-mail e WhatsApp relacionadas à sua
          participação. Você pode cancelar o recebimento a qualquer momento, conforme descrito na Política de
          Privacidade.
        </p>
      </Secao>

      <Secao titulo="8. Formações e pagamentos">
        <p>
          O acesso à comunidade pode ser gratuito por período determinado, conforme divulgado. Formações, eventos e
          produtos pagos são processados por parceiros (ex.: Eduzz), e eventuais condições de compra, cancelamento e
          reembolso seguem as regras do respectivo parceiro e a legislação aplicável.
        </p>
      </Secao>

      <Secao titulo="9. Isenções e limitação de responsabilidade">
        <p>
          Os conteúdos têm finalidade educativa e de desenvolvimento. Os resultados dependem do empenho e do contexto
          de cada pessoa e não são garantidos. Na máxima extensão permitida por lei, não nos responsabilizamos por
          decisões tomadas com base no conteúdo nem por indisponibilidades temporárias da plataforma.
        </p>
      </Secao>

      <Secao titulo="10. Encerramento">
        <p>
          Você pode encerrar sua conta quando quiser, escrevendo para contato@iasinstituto.com.br. Podemos encerrar
          ou suspender o acesso em caso de violação destes termos.
        </p>
      </Secao>

      <Secao titulo="11. Alterações e lei aplicável">
        <p>
          Podemos atualizar estes termos; a versão vigente fica sempre nesta página. Estes termos são regidos pelas
          leis do Brasil, e fica eleito o foro da comarca de Salvador/BA para dirimir eventuais controvérsias.
        </p>
      </Secao>
    </LegalLayout>
  );
}
