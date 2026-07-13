// ============================================================
// MembrosProspeccao — wrapper que monta o módulo Prospecção Pro
// dentro do MembrosLayout (área de membros do Método + que Vencedores).
//
// O contexto (lib/context.ts) detecta automaticamente que o ator é
// membro via localStorage 'squaad_member_session' e:
//  - Filtra buscas/diagnósticos pra mostrar só os do membro
//  - Aplica cota mensal (90 dias trial + 50 análises/mês)
//  - VirarLeadModal vira a versão "salvar em meus leads"
//
// Acesso: /membros/prospeccao (via MembrosLayout NAV_ITEMS)
// ============================================================

import { lazy, Suspense } from "react";
import { MembrosLayout } from "@/components/membros/MembrosLayout";
import { CotaIndicador } from "@/modules/prospeccao/components/CotaIndicador";

const ProspeccaoSearch = lazy(() => import("@/modules/prospeccao/pages/ProspeccaoSearch"));

export default function MembrosProspeccao() {
  return (
    <MembrosLayout>
      <div className="space-y-6">
        <CotaIndicador />
        <Suspense fallback={<div className="p-8 text-center text-white/60">Carregando módulo...</div>}>
          <ProspeccaoSearch />
        </Suspense>
      </div>
    </MembrosLayout>
  );
}
