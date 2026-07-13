import { lazy, Suspense } from "react";
const ProspeccaoDiagnostico = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoDiagnostico"));
export default function AdminProspeccaoDiagnostico() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando...</div>}>
      <ProspeccaoDiagnostico />
    </Suspense>
  );
}
