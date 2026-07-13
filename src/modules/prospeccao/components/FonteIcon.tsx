// ============================================================
// FonteIcon — Ícones oficiais das marcas (Simple Icons + custom)
//
// Substitui os emojis genéricos por logos brand-color reais.
// Usa react-icons/si (Simple Icons) + react-icons/fa pra
// fontes que não têm logo no SI.
// ============================================================

import {
  SiGooglemaps,
  SiGoogle,
  SiInstagram,
  SiFacebook,
  SiYoutube,
  SiTiktok,
  SiTripadvisor,
  SiGlassdoor,
  SiMeta,
  SiGoogleads,
  SiIfood,
  SiPagespeedinsights,
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import { Brain, Globe, Star, Search, AlertOctagon, Stethoscope, ShoppingBag } from "lucide-react";

interface IconProps {
  className?: string;
  size?: number;
}

// Cores oficiais das marcas (hex)
const BRAND_COLORS: Record<string, string> = {
  google_maps: "#4285F4",
  google_reviews: "#FBBC04",
  google_ads: "#4285F4",
  google_ad_library: "#4285F4",
  posicao_google: "#4285F4",
  pagespeed: "#5184EC",
  instagram: "#E4405F",
  facebook: "#1877F2",
  linkedin_company: "#0A66C2",
  linkedin_founder: "#0A66C2",
  youtube: "#FF0000",
  tiktok: "#000000",
  tripadvisor: "#34E0A1",
  mercado_livre: "#FFE600",
  glassdoor: "#0CAA41",
  meta_ads: "#0866FF",
  fb_ad_library: "#0866FF",
  ifood: "#EA1D2C",
  doctoralia: "#00BFA0",
  reclame_aqui: "#E40514",
  contexto_negocio: "#3B82F6",
  site: "#94a3b8",
};

export function FonteIcon({ fonte, className = "h-5 w-5", size }: { fonte: string } & IconProps) {
  const color = BRAND_COLORS[fonte] || "#94a3b8";
  const style = { color };
  const sz = size ?? undefined;

  const props = { className, style, size: sz };

  switch (fonte) {
    // Google family
    case "google_maps":
      return <SiGooglemaps {...props} />;
    case "google_reviews":
      return <Star {...props} fill={color} strokeWidth={1} />;
    case "google_ads":
    case "google_ad_library":
      return <SiGoogleads {...props} />;
    case "posicao_google":
      return <SiGoogle {...props} />;
    case "pagespeed":
      return <SiPagespeedinsights {...props} />;

    // Meta family
    case "instagram":
      return <SiInstagram {...props} />;
    case "facebook":
      return <SiFacebook {...props} />;
    case "meta_ads":
    case "fb_ad_library":
      return <SiMeta {...props} />;

    // Others
    case "linkedin_company":
    case "linkedin_founder":
      return <FaLinkedin {...props} />;
    case "youtube":
      return <SiYoutube {...props} />;
    case "tiktok":
      return <SiTiktok {...props} />;
    case "tripadvisor":
      return <SiTripadvisor {...props} />;
    case "mercado_livre":
      return <ShoppingBag {...props} fill={color} stroke="white" strokeWidth={1.5} />;
    case "glassdoor":
      return <SiGlassdoor {...props} />;
    case "ifood":
      return <SiIfood {...props} />;

    // Custom (sem logo no Simple Icons)
    case "doctoralia":
      return <Stethoscope {...props} />;
    case "reclame_aqui":
      return <AlertOctagon {...props} fill={color} stroke="white" />;

    // Internas / genéricas
    case "contexto_negocio":
      return <Brain {...props} />;
    case "site":
      return <Globe {...props} />;

    default:
      return <Search {...props} />;
  }
}
