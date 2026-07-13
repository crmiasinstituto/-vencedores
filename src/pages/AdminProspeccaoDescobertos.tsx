import { lazy, Suspense } from "react";
const ProspeccaoDescobertos = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoDescobertos"));
export default function AdminProspeccaoDescobertos() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando...</div>}>
      <ProspeccaoDescobertos />
    </Suspense>
  );
}
