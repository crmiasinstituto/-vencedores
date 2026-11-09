/**
 * Utilitários de exibição das conversas de WhatsApp.
 *
 * 3,9 mil leads vieram de planilha com nome "null"/"nan" — eles apareciam assim na lista,
 * no cabeçalho do chat e no painel. Nome lixo é tratado como "sem nome" e a tela mostra o
 * telefone formatado no lugar.
 */
const NOME_LIXO = /^(null|nan|undefined|none|-|\.)$/i;

export function nomeValido(nome: string | null | undefined): string | null {
  const t = String(nome ?? '').trim();
  if (!t || NOME_LIXO.test(t)) return null;
  return t;
}

/** Texto curto da última mensagem para a lista de conversas. */
export function previewMensagem(tipo: string | null | undefined, conteudo: string | null | undefined): string {
  const texto = String(conteudo ?? '').replace(/\s+/g, ' ').trim();
  switch (tipo) {
    case 'text':
    case 'template':
    case 'interactive':
    case 'button':
    case 'reaction':
      // Template e botão também têm texto: mostra o texto, não "📎 template".
      return texto || (tipo === 'template' ? '📋 Modelo enviado' : '');
    case 'image': return texto ? `📷 ${texto}` : '📷 Foto';
    case 'video': return texto ? `🎥 ${texto}` : '🎥 Vídeo';
    case 'audio':
    case 'ptt': return '🎤 Áudio';
    case 'document': return texto ? `📄 ${texto}` : '📄 Documento';
    case 'sticker': return '💟 Figurinha';
    case 'location': return '📍 Localização';
    case 'contact':
    case 'contacts': return '👤 Contato';
    default: return texto || (tipo ? `📎 ${tipo}` : '');
  }
}
