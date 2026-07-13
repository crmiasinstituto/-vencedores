// Template Highlight — texto enorme com palavras-chave em accent. Glow purple/amber.
import type { SlideTemplateProps } from './types';
import { BackgroundLayer } from './BackgroundLayer';
import { resolveTheme } from './themeUtils';

function highlightKeywords(text: string, accent: string): React.ReactNode[] {
  const keywords = [
    /\b\d+([\.,]\d+)?(%|\w+)?\b/g,
    /\bbilhões?\b/gi,
    /\bmilhões?\b/gi,
    /\bnunca\b/gi,
    /\bsempre\b/gi,
    /\btodos?\b/gi,
    /\bninguém\b/gi,
  ];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const matches: Array<{ index: number; length: number; text: string }> = [];

  for (const regex of keywords) {
    let m: RegExpExecArray | null;
    const re = new RegExp(regex.source, regex.flags);
    while ((m = re.exec(text)) !== null) {
      matches.push({ index: m.index, length: m[0].length, text: m[0] });
    }
  }

  matches.sort((a, b) => a.index - b.index);

  const filtered: typeof matches = [];
  for (const m of matches) {
    if (!filtered.some((f) => m.index >= f.index && m.index < f.index + f.length)) {
      filtered.push(m);
    }
  }

  for (const m of filtered) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push(
      <span key={`${m.index}-${m.text}`} style={{ color: accent, fontWeight: 900 }}>
        {m.text}
      </span>,
    );
    lastIndex = m.index + m.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

export function TemplateHighlight({
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
    accent: '#fbbf24',
    textColor: '#ffffff',
    bg: '#0a0a0a',
  });

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: t.bg
          ? `radial-gradient(ellipse at top left, ${t.bg} 0%, ${t.bg} 100%)`
          : 'radial-gradient(ellipse at top left, #1e1b4b 0%, #0a0a0a 60%, #000000 100%)',
        color: t.textColor,
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

      {/* Glow circular */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${t.accent}28 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 22px',
            background: `${t.accent}1f`,
            border: `1px solid ${t.accent}66`,
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 700,
            color: t.accent,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: t.accent,
              boxShadow: `0 0 12px ${t.accent}`,
            }}
          />
          {isFirst ? 'leia até o fim' : isLast ? 'final' : 'continue'}
        </div>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#71717a' }}>
          {String(slideIndex + 1).padStart(2, '0')} · {String(totalSlides).padStart(2, '0')}
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
        <h1
          style={{
            fontSize: (isFirst ? 100 : 62) * t.scale,
            fontWeight: t.weight,
            lineHeight: 1,
            margin: 0,
            marginBottom: 50,
            letterSpacing: -3,
            background: `linear-gradient(180deg, ${t.textColor} 0%, #a1a1aa 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {titulo}
        </h1>

        <p
          style={{
            fontSize: 40 * t.scale,
            lineHeight: 1.45,
            whiteSpace: 'pre-line',
            fontWeight: 500,
            color: '#e4e4e7',
            margin: 0,
          }}
        >
          {highlightKeywords(texto, t.accent)}
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 40,
          paddingTop: 30,
          borderTop: '1px solid #27272a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 22, color: '#71717a', fontWeight: 600 }}>
          {config.handle || '@seu_perfil'}
        </span>
        {isLast ? (
          <span
            style={{
              padding: '14px 30px',
              background: t.accent,
              color: '#0a0a0a',
              borderRadius: 999,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            LINK NA BIO
          </span>
        ) : (
          <span style={{ fontSize: 22, color: t.accent, fontWeight: 700 }}>→</span>
        )}
      </div>
    </div>
  );
}
