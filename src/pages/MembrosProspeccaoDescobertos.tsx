import { lazy, Suspense } from "react";
import { MembrosLayout } from "@/components/membros/MembrosLayout";
const ProspeccaoDescobertos = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoDescobertos"));
export default function MembrosProspeccaoDescobertos() {
  return (
    <MembrosLayout>
      <Suspense fallback={<div className="p-8 text-center text-white/60">Carregando...</div>}>
        <ProspeccaoDescobertos />
      </Suspense>
    </MembrosLayout>
  );
}
