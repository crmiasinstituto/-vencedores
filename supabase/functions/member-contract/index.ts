// member-contract - Contrato de Mentoria com assinatura eletronica nativa
// (Lei 14.063/2020 + MP 2.200-2/2001).
// Auth: sign_token (link publico enviado no ato da compra) OU session_token (aluno logado).
// Assinatura direta (sem coleta de dados). Apos assinar, libera as credenciais de login.
// preview retorna o contrato ESTRUTURADO (render responsivo no front); o PDF sai na assinatura.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GOLD = rgb(0.98, 0.784, 0);
const BLACK = rgb(0.05, 0.05, 0.06);
const TEXT = rgb(0.12, 0.12, 0.13);
const GRAY = rgb(0.45, 0.45, 0.48);
const GRAY_LIGHT = rgb(0.82, 0.82, 0.84);
const CNPJ_SQUAAD = "51.944.592/0001-30";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const CONTENT_W = A4[0] - MARGIN * 2;

function contractParams(contract: any): { product: string; modality: string; vigencia: number } {
  if (contract?.product_label && contract?.modality_label && contract?.vigencia_months) {
    return { product: contract.product_label, modality: contract.modality_label, vigencia: contract.vigencia_months };
  }
  const program = String(contract?.program || "").toLowerCase();
  if (program.includes("metodo") || program === "metodo-squaad") {
    return { product: "Metodo Squaad", modality: "Mentoria 12 Meses", vigencia: 12 };
  }
  return { product: "MentorIA", modality: "Mentoria 3 Meses", vigencia: 3 };
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "________";
  const dt = typeof d === "string" ? new Date(d.length <= 10 ? d + "T12:00:00" : d) : d;
  if (isNaN(dt.getTime())) return "________";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
}
function addMonths(input: string | Date | null | undefined, months: number): Date | null {
  if (!input) return null;
  const dt = typeof input === "string" ? new Date(input.length <= 10 ? input + "T12:00:00" : input) : new Date(input);
  if (isNaN(dt.getTime())) return null;
  dt.setMonth(dt.getMonth() + months);
  return dt;
}
function fmtDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}
function fmtMoney(v: number | null | undefined): string {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function paymentLabel(m: string | null | undefined): string {
  switch (String(m || "").toLowerCase()) {
    case "pix": return "PIX";
    case "boleto": return "Boleto";
    case "cartao_credito": case "credit_card": case "cartao": return "Cartao de credito";
    case "cartao_debito": return "Cartao de debito";
    case "bank_transfer": return "Transferencia bancaria";
    case "dinheiro": return "Dinheiro / presencial";
    case "vip": return "Cortesia / Parceria";
    default: return m ? String(m) : "________";
  }
}

type Block = { t: "h1"; s: string } | { t: "p"; s: string } | { t: "b"; s: string };

const PREAMBULO =
  'As Partes abaixo qualificadas resolvem firmar o presente CONTRATO DE PRESTACAO DE SERVICOS DE MENTORIA, ' +
  'doravante denominado simplesmente "Contrato", com fundamento nos artigos aplicaveis do Codigo Civil Brasileiro, ' +
  'no Codigo de Defesa do Consumidor e demais legislacoes pertinentes, mediante as clausulas e condicoes a seguir:';

const CLAUSES: Block[] = [
  { t: "h1", s: "CLAUSULA PRIMEIRA - DAS PARTES" },
  { t: "p", s: "1.1. CONTRATADA: SQUAAD BUSINESS SOLUTION, pessoa juridica de direito privado, inscrita no CNPJ no 51.944.592/0001-30, com sede na Av. Adenil Falcao, no 334, Feira de Santana/BA, doravante denominada CONTRATADA ou SQUAAD." },
  { t: "p", s: "1.2. CONTRATANTE: pessoa devidamente qualificada no Anexo I deste Contrato, doravante denominada ALUNO ou MENTORADO." },
  { t: "h1", s: "CLAUSULA SEGUNDA - DO OBJETO" },
  { t: "p", s: "2.1. O presente Contrato tem por objeto a prestacao de servicos de mentoria hibrida, composta por:" },
  { t: "b", s: "Aulas gravadas disponibilizadas em plataforma digital de acesso exclusivo;" },
  { t: "b", s: "Encontros online ao vivo (mentorias em grupo), conforme cronograma do Anexo I;" },
  { t: "b", s: "Materiais didaticos, PDFs, frameworks e ferramentas exclusivas da metodologia SQUAAD;" },
  { t: "b", s: "Acesso a comunidade/grupo de suporte pelo periodo contratado." },
  { t: "p", s: "2.2. A mentoria e ofertada nas modalidades de 3 (tres) meses e 12 (doze) meses, conforme especificado no Anexo I." },
  { t: "p", s: "2.3. Todo conteudo, metodologia, materiais, gravacoes e recursos fornecidos pela CONTRATADA sao protegidos pela legislacao de propriedade intelectual e direitos autorais." },
  { t: "p", s: "2.4. A presente mentoria nao concede certificacao de carga horaria. Caso haja emissao de declaracao de participacao, os criterios serao informados formalmente pela CONTRATADA, podendo incluir frequencia minima nos encontros ao vivo." },
  { t: "h1", s: "CLAUSULA TERCEIRA - DO PRAZO E DO ACESSO A PLATAFORMA" },
  { t: "p", s: "3.1. A vigencia deste Contrato inicia-se na data do pagamento do sinal, primeira parcela ou pagamento integral, o que ocorrer primeiro." },
  { t: "p", s: "3.2. O acesso ao conteudo gravado na plataforma estara disponivel durante toda a vigencia do contrato, conforme modalidade contratada (3 ou 12 meses), encerrando-se automaticamente ao termino do periodo, salvo nova contratacao." },
  { t: "p", s: "3.3. O acesso ao conteudo sera liberado em ate 2 (dois) dias uteis apos a confirmacao do pagamento." },
  { t: "p", s: "3.4. Eventuais instabilidades tecnicas de terceiros (servidor, internet, plataforma) nao gerarao direito a reembolso ou extensao automatica de prazo." },
  { t: "p", s: "3.5. O login e senha de acesso a plataforma sao intransferiveis e de uso exclusivo do ALUNO. O compartilhamento implica rescisao imediata sem reembolso." },
  { t: "p", s: "3.6. Upgrades da modalidade de 3 para 12 meses poderao ser realizados mediante solicitacao formal e pagamento da diferenca proporcional, a criterio da CONTRATADA." },
  { t: "h1", s: "CLAUSULA QUARTA - DOS ENCONTROS ONLINE AO VIVO E DAS GRAVACOES" },
  { t: "p", s: "4.1. Os encontros ao vivo ocorrerao conforme frequencia, duracao e formato descritos no Anexo I, podendo ser individuais ou em grupo." },
  { t: "p", s: "4.2. A ausencia do ALUNO em encontros ao vivo nao gera direito a reposicao, desconto ou reembolso." },
  { t: "p", s: "4.3. A CONTRATADA podera remarcar encontros por razoes operacionais, tecnicas ou de forca maior, comunicando com antecedencia minima de 48 (quarenta e oito) horas." },
  { t: "p", s: "4.4. Os encontros ao vivo poderao ser gravados e disponibilizados na plataforma a exclusivo criterio da CONTRATADA. As gravacoes nao substituem a participacao ao vivo, sendo disponibilizadas como material complementar, sem garantia de prazo de disponibilizacao." },
  { t: "p", s: "4.5. Eventuais alteracoes em conteudos programaticos, professores convidados, ordem de modulos ou cronograma nao configurarao inadimplemento contratual, desde que nao haja prejuizo essencial ao programa principal contratado." },
  { t: "p", s: "4.6. A remarcacao nao caracteriza inadimplemento contratual nem gera direito a indenizacao." },
  { t: "h1", s: "CLAUSULA QUINTA - DAS RESPONSABILIDADES DO ALUNO" },
  { t: "p", s: "5.1. O ALUNO declara estar em condicoes fisicas, emocionais e psicologicas adequadas para participar das atividades." },
  { t: "p", s: "5.2. Os servicos prestados nao constituem terapia, tratamento medico, psicologico ou aconselhamento clinico." },
  { t: "p", s: "5.3. O ALUNO compromete-se a dedicar o tempo necessario a execucao das atividades propostas, reconhecendo que resultados dependem de sua aplicacao pratica." },
  { t: "p", s: "5.4. E vedada a participacao de menores de 18 anos sem autorizacao expressa de responsavel legal." },
  { t: "h1", s: "CLAUSULA SEXTA - DO PAGAMENTO" },
  { t: "p", s: "6.1. Os valores, condicoes de pagamento, parcelamento e vencimentos constam do Anexo I." },
  { t: "p", s: "6.2. O pagamento do sinal, matricula ou primeira parcela implica aceite integral deste Contrato." },
  { t: "p", s: "6.3. Em caso de parcelamento via cartao de credito, a prestacao de servico segue independentemente de eventual cancelamento do cartao pelo ALUNO." },
  { t: "h1", s: "CLAUSULA SETIMA - DA INADIMPLENCIA" },
  { t: "p", s: "7.1. O atraso no pagamento de qualquer parcela acarretara: a) Multa moratoria de 2% (dois por cento); b) Juros de mora de 1% (um por cento) ao mes, calculados pro rata die; c) Correcao monetaria pelo indice legal aplicavel." },
  { t: "p", s: "7.2. O atraso superior a 30 (trinta) dias podera ensejar a suspensao de acessos, encontros e demais beneficios." },
  { t: "p", s: "7.3. Permanecendo o debito por mais de 60 (sessenta) dias, a CONTRATADA podera, mediante notificacao previa ao ALUNO, considerar vencidas antecipadamente todas as parcelas vincendas e adotar medidas extrajudiciais e judiciais cabiveis, incluindo protesto e inclusao em orgaos de protecao ao credito." },
  { t: "p", s: "7.4. O nao comparecimento do ALUNO aos encontros ou sua inatividade na plataforma nao afastam a obrigacao de pagamento." },
  { t: "h1", s: "CLAUSULA OITAVA - DO CANCELAMENTO E REEMBOLSO" },
  { t: "p", s: "8.1. O ALUNO podera exercer o direito de arrependimento no prazo de 7 (sete) dias corridos apos a compra, nos termos do art. 49 do CDC, com reembolso integral." },
  { t: "p", s: "8.2. Nao havera reembolso por mera desistencia do ALUNO apos o prazo legal, ressalvadas as hipoteses legais de inadimplemento da CONTRATADA." },
  { t: "p", s: "8.3. A CONTRATADA podera, a seu exclusivo criterio, conceder credito para utilizacao em futuras turmas ou autorizar transferencia da vaga a terceiro previamente aprovado." },
  { t: "p", s: "8.4. A ausencia do ALUNO em aulas ou encontros nao sera considerada desistencia contratual." },
  { t: "h1", s: "CLAUSULA NONA - DO SUPORTE E CANAIS DE ATENDIMENTO" },
  { t: "p", s: "9.1. Os canais de suporte (WhatsApp, e-mail, grupo exclusivo) e respectivos horarios de atendimento serao informados no Anexo I ou na area de membros." },
  { t: "p", s: "9.2. O suporte abrange duvidas sobre os conteudos e metodologia; nao inclui consultoria individual ilimitada fora do escopo contratado." },
  { t: "p", s: "9.3. O tempo de resposta padrao e de ate 2 (dois) dias uteis." },
  { t: "h1", s: "CLAUSULA DECIMA - DA PROPRIEDADE INTELECTUAL" },
  { t: "p", s: "10.1. Todo o conteudo (gravacoes, materiais, PDFs, scripts, metodologias, frameworks, marcas e denominacoes) e de propriedade exclusiva da CONTRATADA." },
  { t: "p", s: "10.2. E expressamente proibido ao ALUNO: reproduzir, adaptar, comercializar, ministrar, distribuir, gravar ou compartilhar qualquer material sem autorizacao previa e escrita da CONTRATADA." },
  { t: "p", s: "10.3. O descumprimento desta clausula sujeitara o ALUNO ao pagamento de multa compensatoria correspondente ao valor total do contrato, deduzidos os valores ja pagos, ou ao prejuizo efetivamente comprovado pela CONTRATADA, caso este seja superior, sem prejuizo das demais medidas judiciais cabiveis." },
  { t: "h1", s: "CLAUSULA DECIMA PRIMEIRA - DA RESCISAO PELA CONTRATADA" },
  { t: "p", s: "11.1. A CONTRATADA podera rescindir este Contrato imediatamente, sem reembolso, nas seguintes hipoteses: a) Fraude ou falsidade de informacoes prestadas pelo ALUNO; b) Pirataria, reproducao ou distribuicao nao autorizada de conteudos; c) Uso indevido da marca SQUAAD ou de seus produtos para fins comerciais; d) Ataques, ofensas ou condutas que prejudiquem a comunidade ou a reputacao da CONTRATADA; e) Descumprimento grave de qualquer clausula deste Contrato." },
  { t: "p", s: "11.2. Nos casos previstos no item 11.1, o ALUNO perdera o acesso a plataforma e a todos os beneficios contratados, sem direito a reembolso ou compensacao." },
  { t: "h1", s: "CLAUSULA DECIMA SEGUNDA - DO SIGILO E CONFIDENCIALIDADE" },
  { t: "p", s: "12.1. O ALUNO compromete-se a manter sigilo absoluto sobre informacoes pessoais, estrategicas ou financeiras compartilhadas por terceiros durante os encontros." },
  { t: "p", s: "12.2. E proibida a gravacao de audio, video ou qualquer forma de registro dos encontros ao vivo sem autorizacao expressa da CONTRATADA." },
  { t: "p", s: "12.3. O descumprimento desta clausula enseja responsabilizacao civil e criminal." },
  { t: "h1", s: "CLAUSULA DECIMA TERCEIRA - DO USO DE IMAGEM" },
  { t: "p", s: "13.1. O ALUNO autoriza gratuitamente a captacao, utilizacao, reproducao, edicao e divulgacao de sua imagem, voz e depoimentos durante as atividades, para fins institucionais, promocionais, comerciais e educacionais da CONTRATADA, por prazo indeterminado, em ambito nacional e internacional." },
  { t: "h1", s: "CLAUSULA DECIMA QUARTA - DA PROTECAO DE DADOS (LGPD)" },
  { t: "p", s: "14.1. O ALUNO autoriza o tratamento de seus dados pessoais para execucao do Contrato, comunicacao institucional, envio de materiais, cumprimento de obrigacoes legais e oferta de servicos relacionados." },
  { t: "p", s: "14.2. O tratamento observara a Lei no 13.709/2018 (LGPD)." },
  { t: "h1", s: "CLAUSULA DECIMA QUINTA - DA LIMITACAO DE RESPONSABILIDADE E RESULTADOS" },
  { t: "p", s: "15.1. A CONTRATADA compromete-se a fornecer o treinamento, a metodologia, os materiais e o suporte previstos neste Contrato." },
  { t: "p", s: "15.2. A CONTRATADA nao garante resultados financeiros, profissionais ou empresariais especificos. Os resultados dependem de dedicacao, comprometimento e aplicacao pratica do ALUNO." },
  { t: "p", s: "15.3. Fatores externos alheios ao controle da CONTRATADA, mercado, concorrencia, sazonalidade, contexto do negocio do ALUNO, nao sao de sua responsabilidade." },
  { t: "h1", s: "CLAUSULA DECIMA SEXTA - DO CODIGO DE CONDUTA" },
  { t: "p", s: "16.1. O ALUNO compromete-se a manter postura respeitosa em todos os ambientes da mentoria (encontros, grupos, plataforma)." },
  { t: "p", s: "16.2. Sao consideradas condutas inadequadas, sujeitas as sancoes da Clausula Decima Primeira: ofensas, assedio moral ou sexual, spam, promocao comercial nao autorizada, ataques a reputacao da SQUAAD ou de participantes." },
  { t: "h1", s: "CLAUSULA DECIMA SETIMA - DA FORCA MAIOR" },
  { t: "p", s: "17.1. Nenhuma das partes sera responsabilizada por descumprimento decorrente de forca maior ou caso fortuito, incluindo pandemias, desastres naturais, interrupcoes de infraestrutura digital, greves ou determinacoes governamentais." },
  { t: "h1", s: "CLAUSULA DECIMA OITAVA - DA RENOVACAO E ENCERRAMENTO" },
  { t: "p", s: "18.1. Encerrado o prazo contratado, o acesso a plataforma e a todos os beneficios sera encerrado automaticamente, independentemente de aviso previo, salvo nova contratacao formalizada entre as partes." },
  { t: "p", s: "18.2. Nao havera renovacao automatica sem anuencia expressa do ALUNO." },
  { t: "h1", s: "CLAUSULA DECIMA NONA - DA ASSINATURA ELETRONICA" },
  { t: "p", s: "19.1. As partes reconhecem como validas as assinaturas eletronicas e o aceite eletronico realizados por plataformas digitais, com os mesmos efeitos juridicos da assinatura fisica, nos termos da Lei no 14.063/2020 e da MP no 2.200-2/2001." },
  { t: "p", s: "19.2. O registro de aceite eletronico contera: nome completo, CPF, data/hora e endereco IP do ALUNO, constituindo prova suficiente da manifestacao de vontade." },
  { t: "h1", s: "CLAUSULA VIGESIMA - DAS DISPOSICOES GERAIS" },
  { t: "p", s: "20.1. A tolerancia de uma parte para com a outra nao constituira novacao, renuncia ou alteracao contratual." },
  { t: "p", s: "20.2. A nulidade de qualquer clausula nao afetara a validade das demais." },
  { t: "p", s: "20.3. Este Contrato obriga as partes, seus herdeiros e sucessores." },
  { t: "h1", s: "CLAUSULA VIGESIMA PRIMEIRA - DO FORO" },
  { t: "p", s: "21.1. Fica eleito o Foro da Comarca de Feira de Santana/BA para dirimir quaisquer controversias decorrentes deste Contrato, ressalvadas as hipoteses de competencia absoluta previstas em lei." },
];

async function loadLogo(doc: PDFDocument): Promise<any | null> {
  try {
    const res = await fetch("https://squaad.com.br/squaad-logo-pdf.png");
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    try { return await doc.embedPng(bytes); } catch { return await doc.embedJpg(bytes); }
  } catch { return null; }
}

async function buildContractPdf(opts: {
  member: any; contract: any; signed: boolean;
  acceptance?: { name_typed: string; ip: string; user_agent: string; accepted_at: Date };
}): Promise<Uint8Array> {
  const { member, contract, signed, acceptance } = opts;
  const params = contractParams(contract);
  const startDate: string | Date = contract.access_starts_on || member.approved_at || contract.created_at || new Date();
  const endDate: Date | null = contract.access_ends_on
    ? (typeof contract.access_ends_on === "string" ? new Date(contract.access_ends_on + "T12:00:00") : contract.access_ends_on)
    : addMonths(startDate, params.vigencia || 12);

  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const logo = await loadLogo(doc);

  let page: any;
  let y = 0;
  let pageNo = 0;

  function drawHeader() {
    page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GOLD });
    const topY = A4[1] - 44;
    if (logo) { const h = 26; const w = (logo.width / logo.height) * h; page.drawImage(logo, { x: MARGIN, y: topY - 4, width: w, height: h }); }
    else { page.drawText("SQUAAD", { x: MARGIN, y: topY, size: 16, font: helvBold, color: BLACK }); }
    page.drawText("Contrato de Prestacao de Servicos de Mentoria", { x: A4[0] - MARGIN - helv.widthOfTextAtSize("Contrato de Prestacao de Servicos de Mentoria", 8), y: topY + 2, size: 8, font: helv, color: GRAY });
    page.drawText("Documento Confidencial", { x: A4[0] - MARGIN - helv.widthOfTextAtSize("Documento Confidencial", 7), y: topY - 9, size: 7, font: helv, color: GRAY_LIGHT });
    page.drawLine({ start: { x: MARGIN, y: A4[1] - 60 }, end: { x: A4[0] - MARGIN, y: A4[1] - 60 }, thickness: 0.5, color: GRAY_LIGHT });
  }
  function drawFooter() {
    page.drawLine({ start: { x: MARGIN, y: 46 }, end: { x: A4[0] - MARGIN, y: 46 }, thickness: 0.5, color: GRAY_LIGHT });
    page.drawText(`Pagina ${pageNo}`, { x: MARGIN, y: 34, size: 7, font: helv, color: GRAY });
    const foot = "SQUAAD Business Solution   -   squaad.com.br";
    page.drawText(foot, { x: A4[0] - MARGIN - helv.widthOfTextAtSize(foot, 7), y: 34, size: 7, font: helv, color: GRAY });
  }
  function newPage() { page = doc.addPage(A4); pageNo += 1; drawHeader(); drawFooter(); y = A4[1] - 78; }
  function ensure(space: number) { if (y - space < 58) newPage(); }
  function wrap(text: string, font: any, size: number, maxW: number): string[] {
    const words = String(text).split(/\s+/); const lines: string[] = []; let line = "";
    for (const w of words) { const test = line ? line + " " + w : w; if (font.widthOfTextAtSize(test, size) > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); return lines;
  }
  function para(text: string, o: { size?: number; font?: any; color?: any; gap?: number; indent?: number; leading?: number } = {}) {
    const size = o.size ?? 9.5; const font = o.font ?? helv; const color = o.color ?? TEXT; const indent = o.indent ?? 0; const leading = o.leading ?? 1.4;
    for (const ln of wrap(text, font, size, CONTENT_W - indent)) { ensure(size * leading); page.drawText(ln, { x: MARGIN + indent, y, size, font, color }); y -= size * leading; }
    y -= o.gap ?? 5;
  }
  function heading(text: string) { ensure(24); y -= 4; page.drawText(text, { x: MARGIN, y, size: 10.5, font: helvBold, color: BLACK }); y -= 15; }
  function line() { page.drawLine({ start: { x: MARGIN, y: y }, end: { x: MARGIN + 240, y: y }, thickness: 0.8, color: BLACK }); }

  newPage();
  y -= 6;
  page.drawText("CONTRATO DE PRESTACAO", { x: MARGIN, y, size: 20, font: helvBold, color: BLACK }); y -= 24;
  page.drawText("DE SERVICOS DE MENTORIA", { x: MARGIN, y, size: 20, font: helvBold, color: BLACK }); y -= 20;
  page.drawText("SQUAAD Business Solution  -  Documento Contratual", { x: MARGIN, y, size: 9, font: helv, color: GRAY }); y -= 22;

  if (!signed) {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: 260, height: 20, color: rgb(1, 0.96, 0.75) });
    page.drawText("MINUTA - AGUARDANDO SEU ACEITE ELETRONICO", { x: MARGIN + 8, y: y + 2, size: 8, font: helvBold, color: rgb(0.5, 0.4, 0) });
    y -= 28;
  }

  para(PREAMBULO, { gap: 10 });
  for (const b of CLAUSES) { if (b.t === "h1") heading(b.s); else if (b.t === "b") para("-  " + b.s, { indent: 14, gap: 3 }); else para(b.s); }

  ensure(200); y -= 6;
  const localData = fmtDate(startDate);
  para(`Feira de Santana/BA, ${localData}.`, { gap: 24 });

  ensure(90);
  page.drawText("SQUAAD Business Solution", { x: MARGIN, y: y + 4, size: 15, font: italic, color: BLACK });
  y -= 8; line(); y -= 12;
  page.drawText("SQUAAD BUSINESS SOLUTION", { x: MARGIN, y, size: 8.5, font: helvBold, color: BLACK }); y -= 11;
  page.drawText(`CNPJ: ${CNPJ_SQUAAD}`, { x: MARGIN, y, size: 8.5, font: helv, color: TEXT }); y -= 11;
  page.drawText("CONTRATADA", { x: MARGIN, y, size: 8, font: helv, color: GRAY }); y -= 26;

  ensure(90);
  if (signed && acceptance) page.drawText(acceptance.name_typed || member.name, { x: MARGIN, y: y + 4, size: 15, font: italic, color: BLACK });
  y -= 8; line(); y -= 12;
  page.drawText(String(member.name || "").toUpperCase(), { x: MARGIN, y, size: 8.5, font: helvBold, color: BLACK }); y -= 11;
  page.drawText(`CPF: ${member.cpf || "________"}`, { x: MARGIN, y, size: 8.5, font: helv, color: TEXT }); y -= 11;
  page.drawText("CONTRATANTE / ALUNO", { x: MARGIN, y, size: 8, font: helv, color: GRAY }); y -= 24;

  ensure(70);
  page.drawRectangle({ x: MARGIN, y: y - 46, width: CONTENT_W, height: 54, borderColor: GOLD, borderWidth: 1, color: rgb(0.99, 0.98, 0.93) });
  page.drawText("REGISTRO DE ACEITE ELETRONICO", { x: MARGIN + 10, y: y - 6, size: 8.5, font: helvBold, color: BLACK });
  if (signed && acceptance) {
    page.drawText(`Contratante: ${member.name} - CPF: ${member.cpf || "-"}`, { x: MARGIN + 10, y: y - 18, size: 8, font: helv, color: TEXT });
    page.drawText(`Data/Hora do aceite: ${fmtDateTime(acceptance.accepted_at)}  |  IP: ${acceptance.ip || "-"}`, { x: MARGIN + 10, y: y - 29, size: 8, font: helv, color: TEXT });
    page.drawText("Aceite realizado mediante confirmacao eletronica com validade juridica (Lei 14.063/2020 e MP 2.200-2/2001).", { x: MARGIN + 10, y: y - 40, size: 7, font: helv, color: GRAY });
  } else {
    page.drawText("O registro de aceite (nome, CPF, data/hora e IP) sera preenchido no momento da assinatura eletronica.", { x: MARGIN + 10, y: y - 20, size: 8, font: helv, color: GRAY });
  }
  y -= 60;

  newPage(); y -= 4;
  page.drawText("ANEXO I - QUALIFICACAO DAS PARTES E CONDICOES COMERCIAIS", { x: MARGIN, y, size: 12, font: helvBold, color: BLACK }); y -= 14;
  page.drawText("SQUAAD Business Solution  -  Parte integrante do Contrato de Mentoria", { x: MARGIN, y, size: 8, font: helv, color: GRAY }); y -= 20;

  function field(label: string, value: string) {
    ensure(20);
    page.drawText(label, { x: MARGIN, y, size: 8, font: helvBold, color: GRAY }); y -= 11;
    para(value && String(value).trim() ? String(value) : "________", { gap: 6, size: 9.5 });
  }
  function sectionTitle(t: string) {
    ensure(22); y -= 4;
    page.drawRectangle({ x: MARGIN, y: y - 3, width: CONTENT_W, height: 15, color: rgb(0.96, 0.96, 0.97) });
    page.drawText(t, { x: MARGIN + 6, y, size: 9, font: helvBold, color: BLACK }); y -= 20;
  }

  sectionTitle("1. DADOS DO CONTRATANTE (ALUNO / MENTORADO)");
  field("Nome Completo", member.name);
  field("CPF", member.cpf);
  field("E-mail", member.email);
  field("Celular / WhatsApp", member.phone);

  sectionTitle("2. MODALIDADE DA MENTORIA E TURMA");
  field("Modalidade", params.modality);
  field("Descricao do Produto", params.product);
  field("Data de Inicio", fmtDate(startDate));
  field("Data de Encerramento", fmtDate(endDate));

  sectionTitle("3. CONDICOES FINANCEIRAS");
  field("Valor Total do Contrato", `R$ ${fmtMoney(contract.total_value)}`);
  const parcelas = Number(contract.num_installments || 1);
  field("Forma de Pagamento", parcelas > 1 ? `Parcelado em ${parcelas}x` : "A vista");
  if (Number(contract.entry_value || 0) > 0) field("Sinal / Entrada", `R$ ${fmtMoney(contract.entry_value)}`);
  if (parcelas > 1) field("Parcelamento", `${parcelas} parcelas de R$ ${fmtMoney(contract.installment_value)}`);
  field("Meio de Pagamento", paymentLabel(contract.payment_method || contract.entry_method));

  sectionTitle("4. ACESSO A PLATAFORMA E SUPORTE");
  field("Plataforma", "Area de Membros SQUAAD");
  field("URL de Acesso", "https://squaad.com.br/membros/login");
  field("Periodo de Acesso", `${fmtDate(startDate)} a ${fmtDate(endDate)}`);
  field("Canal de Suporte", "WhatsApp, grupo exclusivo e area de membros");

  ensure(150); y -= 6;
  para(`Feira de Santana/BA, ${localData}.`, { gap: 20 });
  ensure(80);
  page.drawText("SQUAAD Business Solution", { x: MARGIN, y: y + 4, size: 14, font: italic, color: BLACK });
  y -= 8; line(); y -= 12;
  page.drawText("SQUAAD BUSINESS SOLUTION - CONTRATADA", { x: MARGIN, y, size: 8, font: helvBold, color: BLACK }); y -= 22;
  if (signed && acceptance) page.drawText(acceptance.name_typed || member.name, { x: MARGIN, y: y + 4, size: 14, font: italic, color: BLACK });
  y -= 8; line(); y -= 12;
  page.drawText(`${String(member.name || "").toUpperCase()} - CONTRATANTE / ALUNO`, { x: MARGIN, y, size: 8, font: helvBold, color: BLACK });

  return await doc.save();
}

async function uploadToB2(bytes: Uint8Array, key: string): Promise<string> {
  const endpoint = Deno.env.get("S3_ENDPOINT") || Deno.env.get("B2_ENDPOINT");
  const bucket = Deno.env.get("S3_BUCKET") || Deno.env.get("B2_BUCKET");
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY") || Deno.env.get("B2_ACCESS_KEY");
  const secretAccessKey = Deno.env.get("S3_SECRET_KEY") || Deno.env.get("B2_SECRET_KEY");
  const region = Deno.env.get("S3_REGION") || Deno.env.get("B2_REGION") || "us-east-005";
  const publicUrl = Deno.env.get("S3_PUBLIC_URL") || Deno.env.get("B2_PUBLIC_URL");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Storage B2/S3 nao configurado");
  const client = new AwsClient({ accessKeyId, secretAccessKey, region, service: "s3" });
  const url = `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  const res = await client.fetch(url, { method: "PUT", body: bytes as any, headers: { "Content-Type": "application/pdf" } });
  if (!res.ok) throw new Error(`Falha no upload B2 (${res.status}): ${await res.text()}`);
  return publicUrl ? `${publicUrl.replace(/\/$/, "")}/${key}` : url;
}

async function sha256hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as any);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendWhatsappCopy(supabase: any, phone: string, message: string): Promise<boolean> {
  try {
    if (!phone) return false;
    const { data: instance } = await supabase.from("whatsapp_instances").select("id").eq("status", "connected").eq("provider", "uazapi").or("is_dedicated_blast.is.null,is_dedicated_blast.eq.false").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!instance) return false;
    const r = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` }, body: JSON.stringify({ action: "send_text", instance_id: instance.id, phone, message, sent_by: "contract" }) });
    const j = await r.json().catch(() => ({}));
    return j?.success !== false;
  } catch { return false; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const body = await req.json();
    const { session_token, sign_token, action } = body || {};

    // Auth: sign_token (link publico enviado no ato da compra) OU session_token (aluno logado).
    let member: any = null;
    let contract: any = null;
    if (sign_token) {
      const { data: c } = await supabase.from("member_contracts").select("*").eq("sign_token", sign_token).maybeSingle();
      if (!c) return json({ ok: false, error: "Link de contrato invalido ou expirado" }, 401);
      contract = c;
      const { data: m } = await supabase.from("members").select("*").eq("id", c.member_id).maybeSingle();
      member = m;
    } else if (session_token) {
      const { data: m } = await supabase.from("members").select("*").eq("session_token", session_token).maybeSingle();
      if (!m) return json({ ok: false, error: "Sessao invalida" }, 401);
      member = m;
      const { data: c } = await supabase.from("member_contracts").select("*").eq("member_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      contract = c;
    } else {
      return json({ ok: false, error: "session_token ou sign_token ausente" }, 401);
    }
    if (!member) return json({ ok: false, error: "Membro nao encontrado" }, 404);

    if (action === "status") {
      const params = contract ? contractParams(contract) : null;
      return json({
        ok: true,
        has_contract: !!contract,
        signature_required: contract ? contract.signature_required !== false : false,
        signature_status: contract?.signature_status || null,
        signed: contract?.signature_status === "signed",
        pdf_url: contract?.pdf_url || null,
        can_sign: !!contract && contract.signature_status !== "signed",
        product: params?.product || null,
        modality: params?.modality || null,
        member: { name: member.name, email: member.email, phone: member.phone, cpf: member.cpf },
      });
    }

    if (action === "preview") {
      if (!contract) return json({ ok: false, error: "Nenhum contrato encontrado para este aluno" }, 404);
      const params = contractParams(contract);
      const startDate: string | Date = contract.access_starts_on || member.approved_at || contract.created_at || new Date();
      const endDate: Date | null = contract.access_ends_on
        ? new Date(String(contract.access_ends_on) + "T12:00:00")
        : addMonths(startDate, params.vigencia || 12);
      const parcelas = Number(contract.num_installments || 1);
      return json({
        ok: true,
        contract: {
          preambulo: PREAMBULO,
          clauses: CLAUSES,
          contratada: { nome: "SQUAAD BUSINESS SOLUTION", cnpj: CNPJ_SQUAAD, cidade: "Feira de Santana/BA" },
          local_data: `Feira de Santana/BA, ${fmtDate(startDate)}.`,
          anexo: {
            contratante: [
              ["Nome Completo", member.name || "________"],
              ["CPF", member.cpf || "________"],
              ["E-mail", member.email || "________"],
              ["Celular / WhatsApp", member.phone || "________"],
            ],
            modalidade: [
              ["Modalidade", params.modality],
              ["Descricao do Produto", params.product],
              ["Data de Inicio", fmtDate(startDate)],
              ["Data de Encerramento", fmtDate(endDate)],
            ],
            financeiro: [
              ["Valor Total do Contrato", `R$ ${fmtMoney(contract.total_value)}`],
              ["Forma de Pagamento", parcelas > 1 ? `Parcelado em ${parcelas}x` : "A vista"],
              ...(Number(contract.entry_value || 0) > 0 ? [["Sinal / Entrada", `R$ ${fmtMoney(contract.entry_value)}`]] : []),
              ...(parcelas > 1 ? [["Parcelamento", `${parcelas} parcelas de R$ ${fmtMoney(contract.installment_value)}`]] : []),
              ["Meio de Pagamento", paymentLabel(contract.payment_method || contract.entry_method)],
            ],
            acesso: [
              ["Plataforma", "Area de Membros SQUAAD"],
              ["URL de Acesso", "https://squaad.com.br/membros/login"],
              ["Periodo de Acesso", `${fmtDate(startDate)} a ${fmtDate(endDate)}`],
              ["Canal de Suporte", "WhatsApp, grupo exclusivo e area de membros"],
            ],
          },
        },
      });
    }

    if (action === "sign") {
      if (!contract) return json({ ok: false, error: "Nenhum contrato encontrado" }, 404);
      if (contract.signature_status === "signed") return json({ ok: true, already_signed: true, pdf_url: contract.pdf_url });
      if (!body.accept_terms) return json({ ok: false, error: "E necessario aceitar os termos" }, 400);
      const nameTyped = String(body.name_typed || "").trim();
      if (nameTyped.replace(/\s+/g, " ").length < 5) return json({ ok: false, error: "Digite seu nome completo para assinar" }, 400);

      const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "").split(",")[0].trim();
      const userAgent = req.headers.get("user-agent") || "";
      const acceptedAt = new Date();
      const bytes = await buildContractPdf({ member, contract, signed: true, acceptance: { name_typed: nameTyped, ip, user_agent: userAgent, accepted_at: acceptedAt } });
      const hash = await sha256hex(bytes);
      const key = `contracts/${contract.id}/${acceptedAt.getTime()}-contrato-assinado.pdf`;
      const pdfUrl = await uploadToB2(bytes, key);

      const params = contractParams(contract);
      const snapshot = { name: member.name, cpf: member.cpf, email: member.email, phone: member.phone, product: params.product, modality: params.modality, total_value: contract.total_value, num_installments: contract.num_installments, installment_value: contract.installment_value, payment_method: contract.payment_method };
      const { error: cErr } = await supabase.from("member_contracts").update({ signature_status: "signed", signed_at: acceptedAt.toISOString(), signature_ip: ip || null, signature_user_agent: userAgent || null, signature_name_typed: nameTyped, signer_snapshot: snapshot, pdf_url: pdfUrl, pdf_hash: hash }).eq("id", contract.id);
      if (cErr) return json({ ok: false, error: `Falha ao registrar assinatura: ${cErr.message}` }, 500);

      const firstName = String(member.name || "").split(" ")[0];
      const copyMsg = `Opaa ${firstName}!\n\nSeu *contrato de mentoria SQUAAD* foi assinado com sucesso e seu acesso as aulas ja esta liberado.\n\nGuarde sua via assinada:\n${pdfUrl}\n\nAssinado eletronicamente em ${fmtDateTime(acceptedAt)} (validade juridica - Lei 14.063/2020).\n\n*SQUAAD Business Solutions*`;
      const channels: string[] = [];
      if (await sendWhatsappCopy(supabase, member.phone, copyMsg)) channels.push("whatsapp:member");
      if (member.member_role === "preposto" && member.contratante_member_id) {
        const { data: cont } = await supabase.from("members").select("name, phone").eq("id", member.contratante_member_id).maybeSingle();
        if (cont?.phone) { const cMsg = `Ola ${String(cont.name || "").split(" ")[0]}! O contrato de mentoria de *${member.name}* foi assinado e o acesso liberado. Via assinada: ${pdfUrl}`; if (await sendWhatsappCopy(supabase, cont.phone, cMsg)) channels.push("whatsapp:contratante"); }
      }
      if (channels.length) await supabase.from("member_contracts").update({ copy_sent_at: new Date().toISOString(), copy_sent_channels: channels }).eq("id", contract.id);

      // Acesso as aulas so e liberado apos a assinatura: envia agora as credenciais de login.
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-member-credentials`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` }, body: JSON.stringify({ member_id: member.id, force: true }) });
      } catch (_) { /* best-effort */ }

      return json({ ok: true, signed: true, pdf_url: pdfUrl, hash, copy_sent_channels: channels });
    }

    return json({ ok: false, error: `Acao desconhecida: ${action}` }, 400);
  } catch (e: any) {
    console.error("[member-contract] error:", e);
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
});
