/**
 * Copia texto pra área de transferência, com plano B.
 *
 * `navigator.clipboard` só existe em CONTEXTO SEGURO (https ou localhost). Em http puro o
 * navegador nem expõe a API — e o `writeText` estoura. Foi o que aconteceu com o link de
 * indicação: o domínio subiu em http (o SSL do Netlify ainda não tinha sido emitido) e o botão
 * respondia "Erro ao copiar" pra todo mundo.
 *
 * Isso não é só transitório: o link de indicação é o produto — se ele depende do certificado
 * ter sido emitido, ele quebra de novo no próximo domínio novo. O plano B é o
 * `document.execCommand('copy')`, que é obsoleto mas funciona em http e em navegador velho.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (!texto) return false;

  // Caminho bom: só existe em https/localhost.
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Permissão negada ou clipboard indisponível: cai no plano B.
    }
  }

  // Plano B: textarea fora da tela + execCommand. Feio, obsoleto, e funciona onde o outro não.
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    // Fora da vista, mas NÃO display:none nem visibility:hidden — o select() não funciona
    // em elemento que o navegador considera invisível.
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, texto.length); // iOS ignora o select() sozinho
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
