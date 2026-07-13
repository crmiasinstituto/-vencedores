import { lazy, Suspense } from "react";
const ProspeccaoHistorico = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoHistorico"));
export default function AdminProspeccaoHistorico() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando histórico...</div>}>
      <ProspeccaoHistorico />
    </Suspense>
  );
}
