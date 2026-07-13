/**
 * LivePreviewIframe — iframe sem flicker pra preview live.
 *
 * Diferente de <iframe srcDoc={html}> que recarrega o documento inteiro a cada
 * mudança (causando flash branco), este componente escreve direto no
 * contentDocument via ref. Mantém scroll position e sem piscar.
 */

import { useEffect, useRef } from 'react';

interface Props {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function LivePreviewIframe({ html, className, style }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const writeContent = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
    };

    // Se o iframe já carregou, atualiza direto. Caso contrário, espera load.
    if (iframe.contentDocument?.readyState === 'complete' || iframe.contentDocument?.readyState === 'interactive') {
      writeContent();
    } else {
      iframe.addEventListener('load', writeContent, { once: true });
    }
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Preview ao vivo"
      className={className}
      style={style}
      sandbox="allow-same-origin"
    />
  );
}
