import { lazy } from "react";
import { Routes, Route } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";

// Admin do netweaving. No repo do portal isto era /admin e tinha o próprio AdminLayout, com um
// gate que chamava has_role()/user_roles — nenhum dos dois existe neste banco, então aquele
// gate nunca deixou ninguém entrar. Aqui as telas entram debaixo do AdminLayout do CRM, cujo
// useAdminAuth resolve is_admin() no servidor: um porteiro só pro /admin inteiro.
// pages/admin/AdminLayout.tsx do portal ficou obsoleto e não é usado.
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminMembers = lazy(() => import("./pages/admin/AdminMembers"));
const AdminEvents = lazy(() => import("./pages/admin/AdminEvents"));
const AdminTrainings = lazy(() => import("./pages/admin/AdminTrainings"));
const AdminGeradorTemplates = lazy(() => import("./pages/admin/AdminGeradorTemplates"));
const AdminAvisos = lazy(() => import("./pages/admin/AdminAvisos"));

/**
 * Tudo abaixo de /admin/maisvencedores. O AdminLayout do CRM (que já barra não-admin) envolve
 * este componente no App.tsx — aqui dentro é só o roteamento.
 *
 * O AuthProvider aparece de novo porque telas daqui usam componentes compartilhados do portal
 * (ImageUpload, por exemplo) que chamam useAuth pra montar o caminho do arquivo no Storage.
 */
export default function MaisVencedoresAdminRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="membros" element={<AdminMembers />} />
        <Route path="eventos" element={<AdminEvents />} />
        <Route path="treinamentos" element={<AdminTrainings />} />
        <Route path="avisos" element={<AdminAvisos />} />
        <Route path="templates" element={<AdminGeradorTemplates />} />
        {/* 'Negócios Gerados' (AdminDeals) e 'Anúncios' (AdminAdvertisements) saíram em
            15/07/2026 a pedido do Carlos. Eram do modelo de netweaving; o ecossistema do IAS
            é transformação de vida, não geração de lead entre membros. Os arquivos das duas
            telas seguem em pages/admin/ caso voltem. */}
      </Routes>
    </AuthProvider>
  );
}
