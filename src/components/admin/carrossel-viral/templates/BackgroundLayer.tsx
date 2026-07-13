// Camada de imagem de fundo + overlay escuro pra manter legibilidade do texto
// Usada por todos os templates quando o slide tem imageUrl

interface BackgroundLayerProps {
  imageUrl?: string;
  intensity?: 'soft' | 'medium' | 'strong';
}

const overlays: Record<NonNullable<BackgroundLayerProps['intensity']>, string> = {
  soft: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.55) 100%)',
  medium: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.78) 100%)',
  strong: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.92) 100%)',
};

export function BackgroundLayer({ imageUrl, intensity = 'medium' }: BackgroundLayerProps) {
  if (!imageUrl) return null;
  return (
    <>
      <img
        src={imageUrl}
        crossOrigin="anonymous"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: overlays[intensity],
          zIndex: 0,
        }}
      />
    </>
  );
}
