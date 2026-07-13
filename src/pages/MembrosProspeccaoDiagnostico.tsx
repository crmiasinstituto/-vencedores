import { lazy, Suspense } from "react";
import { MembrosLayout } from "@/components/membros/MembrosLayout";
const ProspeccaoDiagnostico = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoDiagnostico"));
export default function MembrosProspeccaoDiagnostico() {
  return (
    <MembrosLayout>
      <Suspense fallback={<div className="p-8 text-center text-white/60">Carregando...</div>}>
        <ProspeccaoDiagnostico />
      </Suspense>
    </MembrosLayout>
  );
}
