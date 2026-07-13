// Template Noir — preto puro, tipografia forte, número gigante de fundo. Estilo Frank Costa.
import type { SlideTemplateProps } from './types';
import { BackgroundLayer } from './BackgroundLayer';
import { resolveTheme } from './themeUtils';

export function TemplateNoir({
  titulo,
  texto,
  slideIndex,
  totalSlides,
  config,
  imageUrl,
  theme,
}: SlideTemplateProps) {
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === totalSlides - 1;
  const slideNumber = String(slideIndex + 1).padStart(2, '0');

  const t = resolveTheme(theme, {
    accent: '#facc15',
    textColor: '#ffffff',
    bg: '#000000',
  });

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: t.bg,
        color: t.textColor,
        fontFamily: t.family,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 80,
        boxSizing: 'border-box',
      }}
    >
      <BackgroundLayer imageUrl={imageUrl} intensity="strong" />

      {/* Número gigante de fundo */}
      {!isFirst && !isLast && !imageUrl && (
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -60,
            fontSize: 720,
            fontWeight: 900,
            color: t.accent,
            opacity: 0.08,
            lineHeight: 1,
            letterSpacing: -40,
          }}
        >
          {slideNumber}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 60,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 600, color: t.accent, letterSpacing: 1 }}>
          {config.handle || '@seu_perfil'}
        </span>
        <span style={{ fontSize: 22, color: '#71717a', fontWeight: 500 }}>
          {slideIndex + 1} / {totalSlides}
        </span>
      </div>

      {/* Conteudo principal */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {isFirst && (
          <div
            style={{
              fontSize: 28 * t.scale,
              fontWeight: 600,
              color: t.accent,
              textTransform: 'uppercase',
              letterSpacing: 4,
              marginBottom: 30,
            }}
          >
            Carrossel
          </div>
        )}

        <h1
          style={{
            fontSize: (isFirst ? 96 : 64) * t.scale,
            fontWeight: t.weight,
            lineHeight: 1.05,
            marginBottom: 40,
            color: t.textColor,
            letterSpacing: -2,
          }}
        >
          {titulo}
        </h1>

        <div
          style={{
            width: 100,
            height: 6,
            background: t.accent,
            marginBottom: 40,
          }}
        />

        <p
          style={{
            fontSize: 36 * t.scale,
            lineHeight: 1.45,
            color: '#e4e4e7',
            whiteSpace: 'pre-line',
            fontWeight: 400,
          }}
        >
          {texto}
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 40,
          paddingTop: 30,
          borderTop: '2px solid #27272a',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 22, color: '#71717a', fontWeight: 500 }}>
          {config.authorName || 'Seu Nome'}
        </span>
        {isLast && (
          <span
            style={{
              fontSize: 26,
              color: t.accent,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            → arrasta
          </span>
        )}
      </div>
    </div>
  );
}
