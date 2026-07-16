import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

/**
 * Todo o conteúdo aqui descrevia a SQUAAD — agência de agentes de IA — com a
 * palavra "SQUAAD" trocada por "+ que Vencedores" num find-replace. O resultado
 * afirmava ao Google, via schema.org, que "a + que Vencedores é um esquadrão de
 * agentes de IA especializados", com telefone inventado e canonical apontando
 * pra squaad.com.br. Os dados abaixo vêm da landing aprovada da comunidade.
 */

// Sem domínio próprio definido ainda: derivar da origem evita repetir o erro de
// chumbar um domínio que não é nosso. Trocar por constante quando o DNS existir.
const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

const SEOHead = ({
  title = "+ que Vencedores — Comunidade do IAS Instituto",
  description = "A comunidade de desenvolvimento pessoal, profissional e financeiro do IAS Instituto. Aulas, treinamentos e cursos com Isaac Santos e os treinadores do Instituto — gratuitos nos primeiros 12 meses.",
  keywords = "+ que Vencedores, IAS Instituto, Isaac Santos, desenvolvimento pessoal, comunidade, espiritualidade, inteligência emocional, vida financeira, produtividade, relacionamentos, comunicação, mentalidade vencedora",
  image = "/og-image.jpg",
  url = siteUrl,
}: SEOHeadProps) => {
  return (
    <Helmet>
      {/* Título e Meta Tags Básicas */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="IAS Instituto" />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <meta name="language" content="pt-BR" />
      <meta name="geo.region" content="BR" />
      <meta name="geo.country" content="Brasil" />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="+ que Vencedores" />
      <meta property="og:locale" content="pt_BR" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />

      {/* Schema.org. Era SoftwareApplication/B2B Software — a comunidade é uma
          organização de educação, não um produto de software. */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "Comunidade + que Vencedores",
          description,
          url,
          foundingDate: "2019",
          parentOrganization: {
            "@type": "Organization",
            name: "IAS Instituto",
          },
          founder: {
            "@type": "Person",
            name: "Isaac Santos",
            jobTitle: "Fundador do IAS Instituto",
          },
          address: {
            "@type": "PostalAddress",
            addressCountry: "BR",
          },
          knowsAbout: [
            "Espiritualidade",
            "Comunicação",
            "Inteligência Emocional",
            "Relacionamentos",
            "Vida Financeira",
            "Produtividade",
            "Desenvolvimento Pessoal",
          ],
        })}
      </script>

      <link rel="canonical" href={url} />

      {/* Favicon e Icons.
          Apontavam pra /squaad-favicon.png — arquivo que nunca existiu no public/.
          Toda página com <SEOHead> servia um link de favicon quebrado. */}
      <link rel="icon" href="/favicon.png" type="image/png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/favicon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />

      <meta name="theme-color" content="#3B82F6" />

      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
    </Helmet>
  );
};

export default SEOHead;
