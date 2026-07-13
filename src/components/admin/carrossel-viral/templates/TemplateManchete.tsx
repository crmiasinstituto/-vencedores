// Template Manchete — estilo jornal/breaking news. Vermelho urgente + texto serif
import type { SlideTemplateProps } from './types';
import { resolveTheme } from './themeUtils';

export function TemplateManchete({ titulo, texto, slideIndex, totalSlides, config, imageUrl, theme }: SlideTemplateProps) {
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === totalSlides - 1;
  const t = resolveTheme(theme, {
    accent: '#dc2626',
    textColor: '#0a0a0a',
    bg: '#fafaf9',
    family: 'serif',
  });

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: t.bg,
        color: t.textColor,
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top bar vermelho — BREAKING */}
      <div
        style={{
          background: t.accent,
          color: '#ffffff',
          padding: '24px 60px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 900,
          fontSize: 26,
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 0 0 4px rgba(255,255,255,0.3)',
            }}
          />
          {isFirst ? 'URGENTE' : isLast ? 'CONCLUSÃO' : 'ATENÇÃO'}
        </div>
        <span style={{ fontWeight: 600, opacity: 0.9 }}>
          {slideIndex + 1} / {totalSlides}
        </span>
      </div>

      {/* Categoria + data */}
      <div
        style={{
          padding: '30px 60px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '4px solid #0a0a0a',
          paddingBottom: 20,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: t.accent,
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          {config.topic || 'Análise'}
        </span>
        <span style={{ fontSize: 20, color: '#71717a', fontWeight: 600 }}>
          1 mai 2026 · 3 min de leitura
        </span>
      </div>

      {/* Foto da reportagem (estilo jornal) */}
      {imageUrl && (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            overflow: 'hidden',
            position: 'relative',
            borderBottom: '4px solid #0a0a0a',
          }}
        >
          <img
            src={imageUrl}
            crossOrigin="anonymous"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Headline */}
      <div
        style={{
          flex: 1,
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: t.family,
            fontSize: (isFirst ? 88 : 62) * t.scale,
            fontWeight: t.weight,
            lineHeight: 1.05,
            margin: 0,
            marginBottom: 40,
            color: t.textColor,
            letterSpacing: -1,
          }}
        >
          {titulo}
        </h1>

        {/* Lede */}
        <div
          style={{
            display: 'flex',
            gap: 24,
          }}
        >
          <div
            style={{
              width: 8,
              flexShrink: 0,
              background: t.accent,
              borderRadius: 4,
            }}
          />
          <p
            style={{
              fontSize: 36 * t.scale,
              lineHeight: 1.45,
              whiteSpace: 'pre-line',
              fontWeight: 400,
              color: '#27272a',
              margin: 0,
              fontFamily: t.family,
            }}
          >
            {texto}
          </p>
        </div>
      </div>

      {/* Footer estilo jornal */}
      <div
        style={{
          padding: '24px 60px',
          background: '#0a0a0a',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 900, letterSpacing: 3, fontSize: 22 }}>
            {(config.handle || '@seu_perfil').toUpperCase()}
          </span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ opacity: 0.7 }}>{config.authorName || 'Por Seu Nome'}</span>
        </div>
        {isLast && (
          <span
            style={{
              padding: '8px 18px',
              background: t.accent,
              fontWeight: 700,
              borderRadius: 4,
              letterSpacing: 1,
            }}
          >
            LINK NA BIO
          </span>
        )}
      </div>
    </div>
  );
}
