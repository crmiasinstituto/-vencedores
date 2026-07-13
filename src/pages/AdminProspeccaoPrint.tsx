// PDF print page — não usa AdminLayout (página de impressão pura)
import { lazy, Suspense } from "react";
const ProspeccaoDiagnosticoPrint = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoDiagnosticoPrint"));
export default function AdminProspeccaoPrint() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Preparando PDF...</div>}>
      <ProspeccaoDiagnosticoPrint />
    </Suspense>
  );
}
