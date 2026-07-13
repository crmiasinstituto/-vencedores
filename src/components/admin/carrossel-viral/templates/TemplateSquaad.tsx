// Template + que Vencedores — branding amarelo + preto, identidade visual da squad
import type { SlideTemplateProps } from './types';
import { BackgroundLayer } from './BackgroundLayer';
import { resolveTheme } from './themeUtils';

export function TemplateSquaad({
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

  const t = resolveTheme(theme, {
    accent: '#facc15',
    textColor: '#ffffff',
    bg: '#0a0a0a',
  });

  // Capa: bg = accent, conteudo = bg. Restante: bg padrao
  const slideBg = isFirst ? t.accent : t.bg;
  const slideColor = isFirst ? '#0a0a0a' : t.textColor;

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: slideBg,
        color: slideColor,
        fontFamily: t.family,
        display: 'flex',
        flexDirection: 'column',
        padding: 80,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <BackgroundLayer imageUrl={imageUrl} intensity="strong" />

      {/* Decoração: triângulo accent no canto */}
      {!isFirst && !imageUrl && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderTop: `180px solid ${t.accent}`,
            borderLeft: '180px solid transparent',
            zIndex: 1,
          }}
        />
      )}

      {/* Header com logo */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 60,
        }}
      >
        {config.logoUrl ? (
          <img
            src={config.logoUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ height: 70, width: 70, borderRadius: 14, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              padding: '14px 24px',
              background: isFirst ? '#0a0a0a' : t.accent,
              color: isFirst ? t.accent : '#0a0a0a',
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 4,
              borderRadius: 8,
            }}
          >
            + que Vencedores
          </div>
        )}

        <span
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: isFirst ? '#0a0a0a' : '#a1a1aa',
            opacity: isFirst ? 0.6 : 1,
          }}
        >
          {String(slideIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
        </span>
      </div>

      {/* Conteudo */}
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
        {isFirst ? (
          <>
            <div
              style={{
                fontSize: 28 * t.scale,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 6,
                marginBottom: 30,
                opacity: 0.8,
              }}
            >
              {config.topic ? 'Carrossel' : 'IA First'}
            </div>
            <h1
              style={{
                fontSize: 110 * t.scale,
                fontWeight: t.weight,
                lineHeight: 0.95,
                margin: 0,
                marginBottom: 40,
                letterSpacing: -3,
              }}
            >
              {titulo}
            </h1>
            <p
              style={{
                fontSize: 34 * t.scale,
                lineHeight: 1.4,
                fontWeight: 500,
                whiteSpace: 'pre-line',
                opacity: 0.85,
                margin: 0,
              }}
            >
              {texto}
            </p>
          </>
        ) : (
          <>
            <div
              style={{
                width: 70,
                height: 6,
                background: t.accent,
                marginBottom: 30,
              }}
            />
            <h2
              style={{
                fontSize: 64 * t.scale,
                fontWeight: t.weight,
                lineHeight: 1.05,
                margin: 0,
                marginBottom: 40,
                color: t.accent,
                letterSpacing: -1,
              }}
            >
              {titulo}
            </h2>
            <p
              style={{
                fontSize: 38 * t.scale,
                lineHeight: 1.45,
                whiteSpace: 'pre-line',
                color: '#e4e4e7',
                margin: 0,
              }}
            >
              {texto}
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 40,
          paddingTop: 30,
          borderTop: isFirst ? '2px solid rgba(0,0,0,0.15)' : '2px solid #27272a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 600, opacity: 0.7 }}>
          {config.handle || '@seu_perfil'}
        </span>
        {isLast ? (
          <span style={{ fontSize: 24, fontWeight: 700, color: t.accent }}>link na bio</span>
        ) : (
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              opacity: 0.7,
              color: isFirst ? '#0a0a0a' : t.accent,
            }}
          >
            →
          </span>
        )}
      </div>
    </div>
  );
}
