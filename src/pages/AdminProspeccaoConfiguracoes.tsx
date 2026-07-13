import { lazy, Suspense } from "react";
const ProspeccaoConfiguracoes = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoConfiguracoes"));
export default function AdminProspeccaoConfiguracoes() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando...</div>}>
      <ProspeccaoConfiguracoes />
    </Suspense>
  );
}
