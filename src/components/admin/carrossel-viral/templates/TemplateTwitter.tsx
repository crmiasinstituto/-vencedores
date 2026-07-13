// Template Twitter/X — cada slide vira um tweet, com avatar/handle/likes/retweets
// Visual reconhecível: gera curiosidade, parece print de tweet viral
import type { SlideTemplateProps } from './types';
import { resolveTheme } from './themeUtils';

function shortNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function TemplateTwitter({ titulo, texto, slideIndex, totalSlides, config, imageUrl, theme }: SlideTemplateProps) {
  const t = resolveTheme(theme, {
    accent: '#1d9bf0',
    textColor: '#ffffff',
    bg: '#000000',
  });
  // Numeros fakes que crescem ao longo do carrossel pra dar sensacao de viralizacao
  const baseFactor = 1 + slideIndex * 0.4;
  const replies = Math.floor(420 * baseFactor + slideIndex * 80);
  const retweets = Math.floor(1280 * baseFactor + slideIndex * 200);
  const likes = Math.floor(8400 * baseFactor + slideIndex * 1500);
  const views = Math.floor(280000 * baseFactor + slideIndex * 50000);

  const initials = (config.authorName || 'SN')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: '#000000',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        boxSizing: 'border-box',
      }}
    >
      {/* Card do tweet */}
      <div
        style={{
          width: '100%',
          background: '#000000',
          border: '2px solid #2f3336',
          borderRadius: 24,
          padding: 50,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header: avatar + nome + handle + X logo */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 30 }}>
          {/* Avatar */}
          {config.avatarUrl ? (
            <img
              src={config.avatarUrl}
              alt=""
              crossOrigin="anonymous"
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                objectFit: 'cover',
                marginRight: 20,
                background: '#1d9bf0',
              }}
            />
          ) : (
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1d9bf0, #0c7abf)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 38,
                marginRight: 20,
              }}
            >
              {initials || '@'}
            </div>
          )}

          {/* Nome / handle */}
          <div style={{ flex: 1, paddingTop: 5 }}>
            <div
              style={{
                color: '#ffffff',
                fontSize: 32,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {config.authorName || 'Seu Nome'}
              {/* Verified badge */}
              <svg width="32" height="32" viewBox="0 0 22 22" fill="#1d9bf0">
                <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
              </svg>
            </div>
            <div style={{ color: '#71767b', fontSize: 26, fontWeight: 400, marginTop: 4 }}>
              {config.handle || '@seu_perfil'}
            </div>
          </div>

          {/* X logo */}
          <svg width="50" height="50" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>

        {/* Texto principal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {slideIndex === 0 && (
            <h2
              style={{
                color: t.textColor,
                fontSize: 46 * t.scale,
                fontWeight: t.weight === 900 ? 900 : 800,
                lineHeight: 1.2,
                marginBottom: 24,
                letterSpacing: -0.5,
              }}
            >
              {titulo}
            </h2>
          )}

          <p
            style={{
              color: t.textColor,
              fontSize: 38 * t.scale,
              lineHeight: 1.4,
              whiteSpace: 'pre-line',
              fontWeight: 400,
              margin: 0,
            }}
          >
            {texto}
          </p>

          {/* Imagem anexada estilo tweet com mídia */}
          {imageUrl && (
            <div
              style={{
                marginTop: 30,
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid #2f3336',
                width: '100%',
                aspectRatio: '16 / 9',
                position: 'relative',
              }}
            >
              <img
                src={imageUrl}
                crossOrigin="anonymous"
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div style={{ color: '#71767b', fontSize: 22, marginTop: 30, marginBottom: 24 }}>
          {String(Math.floor(Math.random() * 12) + 1)}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')} PM · 1 mai 2026
        </div>

        {/* Stats divider */}
        <div style={{ borderTop: '1px solid #2f3336', paddingTop: 24 }}>
          <div style={{ color: '#71767b', fontSize: 22, marginBottom: 24 }}>
            <span style={{ color: '#ffffff', fontWeight: 700 }}>{shortNumber(views)}</span> visualizações
          </div>

          {/* Action icons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#71767b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#71767b">
                <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z" />
              </svg>
              <span style={{ fontSize: 24 }}>{shortNumber(replies)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#71767b">
                <path d="M4.5 3.88l4.432 4.43-1.06 1.06L5 6.51V17.5c0 .55.45 1 1 1h7v1.5H6c-1.379 0-2.5-1.121-2.5-2.5V6.51L1.13 8.87.07 7.81zm15 6.61V17c0 .55-.45 1-1 1h-7v1.5h7c1.379 0 2.5-1.121 2.5-2.5v-6.99l2.37 2.37 1.06-1.06-4.43-4.43z" />
              </svg>
              <span style={{ fontSize: 24 }}>{shortNumber(retweets)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#f91880">
                <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z" />
              </svg>
              <span style={{ color: '#f91880', fontSize: 24, fontWeight: 600 }}>{shortNumber(likes)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#71767b">
                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71zm2.5-1c-.552 0-1 .45-1 1v15.55l6.5-4.64 6.5 4.64V4.5c0-.55-.448-1-1-1z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Slide indicator no canto */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            right: 50,
            color: '#71767b',
            fontSize: 18,
          }}
        >
          {slideIndex + 1} / {totalSlides}
        </div>
      </div>
    </div>
  );
}
