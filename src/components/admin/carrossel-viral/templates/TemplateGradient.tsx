// Template Gradient — moderno, gradiente roxo/laranja vibrante, vibe de criador novo
import type { SlideTemplateProps } from './types';
import { BackgroundLayer } from './BackgroundLayer';
import { resolveTheme } from './themeUtils';

const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
];

export function TemplateGradient({ titulo, texto, slideIndex, totalSlides, config, imageUrl, theme }: SlideTemplateProps) {
  const gradient = gradients[slideIndex % gradients.length];
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === totalSlides - 1;
  const t = resolveTheme(theme, {
    accent: '#ffffff',
    textColor: '#ffffff',
    bg: gradient,
  });

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: theme?.bgColor ?? gradient,
        fontFamily: t.family,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        boxSizing: 'border-box',
      }}
    >
      <BackgroundLayer imageUrl={imageUrl} intensity="soft" />

      {/* Glassmorphism card */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: imageUrl ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 1,
          borderRadius: 40,
          border: '2px solid rgba(255, 255, 255, 0.25)',
          padding: 70,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          color: '#ffffff',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 50,
          }}
        >
          <div
            style={{
              padding: '12px 28px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 999,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 1,
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            {String(slideIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            {config.handle || '@seu_perfil'}
          </div>
        </div>

        {/* Conteudo */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <h1
            style={{
              fontSize: (isFirst ? 92 : 60) * t.scale,
              fontWeight: t.weight,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 36,
              letterSpacing: -2,
              textShadow: '0 4px 20px rgba(0,0,0,0.2)',
              color: t.textColor,
            }}
          >
            {titulo}
          </h1>

          <p
            style={{
              fontSize: 38 * t.scale,
              lineHeight: 1.45,
              whiteSpace: 'pre-line',
              fontWeight: 500,
              opacity: 0.95,
              margin: 0,
              textShadow: '0 2px 10px rgba(0,0,0,0.15)',
              color: t.textColor,
            }}
          >
            {texto}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 30,
            borderTop: '1px solid rgba(255, 255, 255, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 600, opacity: 0.85 }}>
            {config.authorName || 'Seu Nome'}
          </span>
          {isLast && (
            <span
              style={{
                padding: '14px 32px',
                background: '#ffffff',
                color: '#000000',
                borderRadius: 999,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              link na bio →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
