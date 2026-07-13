import jsPDF from 'jspdf';

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

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const addSection = (doc: jsPDF, title: string, fields: { label: string; value: any }[], yPos: number): number => {
  let y = yPos;
  const pageHeight = doc.internal.pageSize.height;
  const marginBottom = 20;
  
  // Section title
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 254, 67); // + que Vencedores Yellow
  doc.text(title, 15, y);
  y += 8;
  
  doc.setDrawColor(255, 254, 67);
  doc.line(15, y, 195, y);
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  
  for (const field of fields) {
    const value = formatValue(field.value);
    if (!value) continue;
    
    if (y > pageHeight - marginBottom) {
      doc.addPage();
      y = 20;
    }
    
    // Label
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(field.label + ':', 15, y);
    y += 5;
    
    // Value - split long text
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const maxWidth = 175;
    const lines = doc.splitTextToSize(value, maxWidth);
    
    for (const line of lines) {
      if (y > pageHeight - marginBottom) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 15, y);
      y += 5;
    }
    y += 3;
  }
  
  return y + 5;
};

export function exportClientToPDF(data: ClientData, leadName?: string) {
  const doc = new jsPDF();
  const { client, audience, products, branding, operations, policies, goals, materials, technical, expansion } = data;
  
  // Header with dark background
  doc.setFillColor(11, 13, 16); // + que Vencedores Carbon
  doc.rect(0, 0, 210, 45, 'F');
  
  // Company name
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 254, 67); // + que Vencedores Yellow
  doc.text(client?.company_name || 'Cliente', 15, 20);
  
  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(`Responsável: ${client?.responsible_name || leadName || 'N/A'}`, 15, 30);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 15, 38);
  
  // Status
  const status = client?.status === 'completed' ? 'Concluído' : 
                 client?.status === 'in_progress' ? `Em andamento (${client.onboarding_step}/12)` : 'Pendente';
  doc.setTextColor(255, 254, 67);
  doc.text(`Status: ${status}`, 140, 30);
  
  let y = 55;
  
  // Section 1: Company Info
  y = addSection(doc, '1. IDENTIFICAÇÃO DA EMPRESA', [
    { label: 'Nome da Empresa', value: client?.company_name },
    { label: 'Responsável', value: client?.responsible_name },
    { label: 'Cargo', value: client?.position },
    { label: 'Tempo de Empresa', value: client?.company_age },
    { label: 'Número de Funcionários', value: client?.employees_count },
    { label: 'Endereço Completo', value: client?.full_address },
    { label: 'Regiões Atendidas', value: client?.served_regions },
    { label: 'Descrição do Negócio', value: client?.business_description },
    { label: 'Diferencial Principal', value: client?.main_differential },
    { label: 'Principal Dor do Cliente', value: client?.client_main_pain },
  ], y);
  
  // Section 2: Audience
  y = addSection(doc, '2. PÚBLICO-ALVO', [
    { label: 'Perfil Principal do Público', value: audience?.main_audience_profile },
    { label: 'Quem Decide a Compra', value: audience?.purchase_decision_maker },
    { label: 'Quem Usa o Produto', value: audience?.product_user },
    { label: 'Principais Objeções', value: audience?.main_objections },
    { label: 'Gatilhos de Compra', value: audience?.purchase_triggers },
    { label: 'Canais Preferidos', value: audience?.preferred_channels },
  ], y);
  
  // Section 3: Products
  y = addSection(doc, '3. PRODUTOS E SERVIÇOS', [
    { label: 'Lista de Produtos', value: products?.products_list },
    { label: 'Mais Vendidos', value: products?.best_sellers },
    { label: 'Produtos Sazonais', value: products?.seasonal_products },
    { label: 'Produtos Não Oferecidos', value: products?.non_offered_products },
    { label: 'Margens de Lucro', value: products?.profit_margins },
    { label: 'Aprovação de Descontos', value: products?.discount_approval },
    { label: 'Política de Troca', value: products?.exchange_policy },
    { label: 'Política de Reserva', value: products?.reservation_policy },
    { label: 'Formas de Pagamento', value: products?.payment_methods },
    { label: 'Promoções', value: products?.promotions },
  ], y);
  
  // Section 4: Branding
  y = addSection(doc, '4. MARCA E TOM DE VOZ', [
    { label: 'Nome da IA', value: branding?.ai_name },
    { label: 'Tom da Marca', value: branding?.brand_tone },
    { label: 'Estilo de Apresentação da IA', value: branding?.ai_presentation_style },
    { label: 'Introdução da IA', value: branding?.ai_introduction },
    { label: 'Tratamento ao Cliente', value: branding?.client_treatment },
    { label: 'Frases para Usar', value: branding?.phrases_to_use },
    { label: 'Frases para Evitar', value: branding?.phrases_to_avoid },
    { label: 'Comportamentos da Marca', value: branding?.brand_behaviors },
    { label: 'Erros Graves', value: branding?.serious_mistakes },
    { label: 'Vocabulário de Produto', value: branding?.product_vocabulary },
  ], y);
  
  // Section 5: Operations
  y = addSection(doc, '5. OPERAÇÕES', [
    { label: 'Objetivo Principal da IA', value: operations?.ai_main_objective },
    { label: 'Sistemas Atuais', value: operations?.current_systems },
    { label: 'Integrações', value: operations?.integrations },
    { label: 'Integrações Desejadas', value: operations?.desired_integrations },
    { label: 'Fluxos de Atendimento', value: operations?.attendance_flows },
    { label: 'Escopo de Automação', value: operations?.automation_scope },
    { label: 'Gatilhos para Humano', value: operations?.human_escalation_triggers },
    { label: 'Tempo Máximo de Resposta', value: operations?.max_response_time },
    { label: 'Scripts de Vendas', value: operations?.sales_scripts },
    { label: 'Dados do Cliente Requeridos', value: operations?.required_client_data },
    { label: 'Canais de Marketing', value: operations?.marketing_channels },
    { label: 'Anúncios Pagos', value: operations?.paid_ads },
    { label: 'Metas de Crescimento', value: operations?.growth_goals },
    { label: 'Base de Clientes', value: operations?.client_database },
    { label: 'Usa Linguagem Visual', value: operations?.use_visual_language },
  ], y);
  
  // Section 6: Policies
  y = addSection(doc, '6. POLÍTICAS', [
    { label: 'Salvar Dados Pessoais', value: policies?.save_personal_data },
    { label: 'Restrições com Concorrentes', value: policies?.competitor_restrictions },
    { label: 'Políticas de Desconto', value: policies?.discount_policies },
    { label: 'Tratamento de Clientes Insatisfeitos', value: policies?.unsatisfied_client_handling },
    { label: 'Bônus Automáticos', value: policies?.auto_bonuses },
    { label: 'Palavras Proibidas', value: policies?.forbidden_words },
    { label: 'Rotinas de Follow-up', value: policies?.followup_routines },
  ], y);
  
  // Section 7: Goals
  y = addSection(doc, '7. METAS E EXPECTATIVAS', [
    { label: 'Expectativas com a IA', value: goals?.ai_expectations },
    { label: 'KPIs para Medir', value: goals?.kpis_to_measure },
    { label: 'Critérios de Sucesso', value: goals?.success_criteria },
    { label: 'Critérios de Falha', value: goals?.failure_criteria },
  ], y);
  
  // Section 8: Materials
  y = addSection(doc, '8. MATERIAIS', [
    { label: 'Logo', value: materials?.logo_url ? 'Disponível' : null },
    { label: 'Textos da Marca', value: materials?.brand_texts },
    { label: 'Catálogos/Manuais', value: materials?.catalogs_manuals },
    { label: 'Fotos de Produtos', value: materials?.product_photos },
    { label: 'Depoimentos', value: materials?.testimonials },
    { label: 'Mídia do Ambiente', value: materials?.environment_media },
  ], y);
  
  // Section 9: Technical
  y = addSection(doc, '9. CONFIGURAÇÃO TÉCNICA', [
    { label: 'Email do Parceiro', value: technical?.partner_email },
    { label: 'Horário de Operação', value: technical?.operation_hours },
    { label: 'Redirecionamento Fora do Horário', value: technical?.after_hours_redirect },
    { label: 'Tempo de Resposta Fora do Horário', value: technical?.after_hours_response_time },
    { label: 'Contatos Principais', value: technical?.main_contacts },
  ], y);
  
  // Section 10: Expansion
  y = addSection(doc, '10. EXPANSÃO E AUTOMAÇÃO', [
    { label: 'Múltiplos Canais', value: expansion?.multiple_channels },
    { label: 'Funções da IA', value: expansion?.ai_functions },
    { label: 'Fluxos de Automação', value: expansion?.automation_flows },
    { label: 'Redirecionamento Fora de Contexto', value: expansion?.out_of_context_redirect },
    { label: 'Mensagens Especiais', value: expansion?.special_messages },
    { label: 'Quantidade de Follow-ups', value: expansion?.followup_count },
    { label: 'Intervalos de Follow-up', value: expansion?.followup_intervals },
    { label: 'Funcionalidades Futuras', value: expansion?.future_features },
    { label: 'Top 10 FAQs', value: expansion?.top_10_faqs },
  ], y);
  
  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`+ que Vencedores - Onboarding de Cliente | Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
  }
  
  // Save the PDF
  const fileName = `${(client?.company_name || 'cliente').toLowerCase().replace(/\s+/g, '-')}-onboarding.pdf`;
  doc.save(fileName);
}
