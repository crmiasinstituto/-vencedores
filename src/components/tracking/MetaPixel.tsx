import { useEffect } from 'react';

// Pixel oficial do BM + que Vencedores Business Solution, criado via Graph API em 20/05/2026
// vinculado a ad account act_900122122945508 (BM - + que Vencedores).
// Substitui os IDs antigos: 1405201087970275 (era App ID, nao Pixel: bug)
// e 1539997653754027 (Pixel da ad account pessoal Caduh, descontinuado).
const META_PIXEL_ID = '960069026909883';

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
  window.fbq('track', 'PageView');
};

export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
  }
};

export const MetaPixel = () => {
  useEffect(() => {
    initMetaPixel();
  }, []);

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
