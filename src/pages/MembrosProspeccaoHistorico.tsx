import { lazy, Suspense } from "react";
import { MembrosLayout } from "@/components/membros/MembrosLayout";
const ProspeccaoHistorico = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoHistorico"));
export default function MembrosProspeccaoHistorico() {
  return (
    <MembrosLayout>
      <Suspense fallback={<div className="p-8 text-center text-white/60">Carregando histórico...</div>}>
        <ProspeccaoHistorico />
      </Suspense>
    </MembrosLayout>
  );
}
