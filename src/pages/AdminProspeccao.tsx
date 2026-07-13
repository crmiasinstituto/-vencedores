// ============================================================
// AdminProspeccao — wrapper que monta o módulo Prospecção Pro
// dentro do AdminLayout do CRM + que Vencedores.
//
// As 5 páginas reais ficam em src/modules/prospeccao/pages/.
// O App.tsx faz routing direto pra elas via lazy imports
// (ver routes-snippet aplicado).
//
// Esta página é a "home" admin do módulo (rota /admin/prospeccao) e
// funciona como entrada — mostra a tela de busca.
// ============================================================

import { lazy, Suspense } from "react";

const ProspeccaoSearch = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoSearch"));

export default function AdminProspeccao() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando módulo de prospecção...</div>}>
      <ProspeccaoSearch />
    </Suspense>
  );
}
