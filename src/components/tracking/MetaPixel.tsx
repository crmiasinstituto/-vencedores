import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Pixel oficial passado pelo Carlos (26/07). Trackeia PageView em toda rota + eventos custom
// (ex.: cadastrorpg10x no cadastro, empresas na página de empresas).
const META_PIXEL_ID = '712222119442137';

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: (...args: any[]) => void;
  }
}

export const initMetaPixel = () => {
  if (typeof window === 'undefined' || window.fbq) return;

  const f = window;
  const b = document;
  const n = 'script';

  const fbq: any = function (...args: any[]) {
    fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
  };

  if (!f._fbq) f._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [] as any[];
  f.fbq = fbq;

  const s = b.createElement(n) as HTMLScriptElement;
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const fjs = b.getElementsByTagName(n)[0];
  fjs?.parentNode?.insertBefore(s, fjs);

  window.fbq('init', META_PIXEL_ID);
  // O PageView do carregamento inicial sai pelo efeito de rota do <MetaPixel/>.
};

/** Evento padrão da Meta (Lead, Purchase, CompleteRegistration...). */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) window.fbq('track', eventName, params);
};

/** Evento customizado (empresas, cadastrorpg10x...). */
export const trackCustom = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) window.fbq('trackCustom', eventName, params);
};

export const MetaPixel = () => {
  const location = useLocation();
  const iniciado = useRef(false);

  useEffect(() => {
    initMetaPixel();
    iniciado.current = true;
  }, []);

  // PageView a cada mudança de rota (inclui o primeiro carregamento).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) window.fbq('track', 'PageView');
  }, [location.pathname]);

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: 'none' }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
};
