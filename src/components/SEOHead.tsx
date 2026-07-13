import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

const SEOHead = ({ 
  title = "+ que Vencedores - Esquadrão de IA para Automatizar seu Negócio 24h | Agentes Especializados em Vendas e Atendimento",
  description = "Transforme seu negócio com o + que Vencedores - esquadrão de agentes IA especializados. Automatize vendas, atendimento e suporte 24h. Solução omnichannel com ROI previsível. Teste grátis!",
  keywords = "esquadrão de IA, automação empresarial, agentes de inteligência artificial, automação de vendas, atendimento automatizado, + que Vencedores, IA para empresas, automação de processos, CRM com IA, vendas automáticas, suporte 24h, omnichannel, chatbot inteligente, automação WhatsApp, agentes especializados, ROI automação, inteligência artificial B2B",
  image = "/og-image.jpg",
  url = "https://squaad.com.br"
}: SEOHeadProps) => {
  return (
    <Helmet>
      {/* Título e Meta Tags Básicas */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="+ que Vencedores" />
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
      <meta property="twitter:creator" content="@squaad" />

      {/* Schema.org para Negócios Locais */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "+ que Vencedores",
          "description": description,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "category": "B2B Software",
            "priceCurrency": "BRL"
          },
          "provider": {
            "@type": "Organization",
            "name": "+ que Vencedores",
            "url": url,
            "logo": `${url}/logo.png`,
            "contactPoint": {
              "@type": "ContactPoint",
              "telephone": "+55-11-99999-9999",
              "contactType": "customer service",
              "availableLanguage": "Portuguese"
            },
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "BR",
              "addressRegion": "São Paulo"
            }
          },
          "featureList": [
            "Automação com Esquadrão de IA",
            "Atendimento Especializado 24h",
            "Integração Omnichannel",
            "Agentes IA Especializados",
            "Dashboard e Analytics",
            "ROI Previsível",
            "Automação de Alta Performance"
          ]
        })}
      </script>

      {/* FAQ Schema */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "O que é a + que Vencedores?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "A + que Vencedores é um esquadrão de agentes de IA especializados que automatiza processos empresariais, vendas e atendimento 24 horas por dia com alta performance e ROI previsível."
              }
            },
            {
              "@type": "Question", 
              "name": "Como funciona a integração omnichannel?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Nosso esquadrão integra WhatsApp, Instagram, chat do site, email e outros canais em uma única operação inteligente, permitindo atendimento unificado com agentes especializados."
              }
            },
            {
              "@type": "Question",
              "name": "Quais setores podem usar a + que Vencedores?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Atendemos clínicas, eventos, educação, e-commerce, imobiliárias, advocacia, consultorias e diversos outros setores que precisam de automação de alta performance."
              }
            }
          ]
        })}
      </script>

      {/* Links Canônicos */}
      <link rel="canonical" href={url} />
      
      {/* Favicon e Icons */}
      <link rel="icon" href="/squaad-favicon.png" type="image/png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/squaad-favicon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/squaad-favicon.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/squaad-favicon.png" />
      
      {/* Manifest */}
      <link rel="manifest" href="/site.webmanifest" />
      <meta name="theme-color" content="#3B82F6" />
      
      {/* DNS Prefetch para Performance */}
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      <link rel="dns-prefetch" href="//wa.me" />
      
      {/* Preload Critical Resources */}
      <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    </Helmet>
  );
};

export default SEOHead;