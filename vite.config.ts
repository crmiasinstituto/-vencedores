import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8083,
    proxy: {
      // Espelha o Netlify Edge Function /__sb/* (DNS-bypass proxy pro Supabase).
      // Em produção quem serve isso é netlify/edge-functions/sb.ts.
      // Em dev local fazemos proxy direto pro Supabase pra evitar 404.
      "/__sb": {
        target: "https://iymlwsawrmghhbawiavz.supabase.co",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/__sb/, ""),
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      '@wavoip/wavoip-api',
      'react-dom/server.browser',
      '@maily-to/render',
      '@maily-to/core',
      '@maily-to/core/extensions',
      '@maily-to/core/blocks',
    ],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
