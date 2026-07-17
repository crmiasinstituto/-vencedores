import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { MembershipProvider } from "./contexts/MembershipContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { MembersLayout } from "./components/members/MembersLayout";

// Landing pública + área de netweaving. Veio do repo mais-que-vencedores-portal, onde morava
// sozinha num domínio e por isso ocupava '/', '/membros' e '/auth'. No app unificado esses
// três já têm dono (redirect, LMS do acelerador e admin do CRM), então tudo desce pra baixo
// de /maisvencedores.
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const RecuperarSenha = lazy(() => import("./pages/auth/RecuperarSenha"));
const NovaSenha = lazy(() => import("./pages/auth/NovaSenha"));

const MembersDashboard = lazy(() => import("./pages/members/MembersDashboard"));
const MembersPortfolio = lazy(() => import("./pages/members/MembersPortfolio"));
const MembersTraining = lazy(() => import("./pages/members/MembersTraining"));
const MembersEvents = lazy(() => import("./pages/members/MembersEvents"));
const MembersAdvertising = lazy(() => import("./pages/members/MembersAdvertising"));
const MembersReferrals = lazy(() => import("./pages/members/MembersReferrals"));
const MembersSales = lazy(() => import("./pages/members/MembersSales"));
const MembersProfile = lazy(() => import("./pages/members/MembersProfile"));
const MembersSettings = lazy(() => import("./pages/members/MembersSettings"));
const MembersOnboarding = lazy(() => import("./pages/members/MembersOnboarding"));

/**
 * Tudo abaixo de /maisvencedores.
 *
 * O AuthProvider daqui é o do netweaving (Supabase Auth puro) e cobre também as telas de
 * /admin/maisvencedores — ver MaisVencedoresAdminRoutes. Ele não conflita com o useAdminAuth
 * do CRM: os dois leem a mesma sessão do supabase.auth, cada um respondendo uma pergunta
 * diferente (quem é você / você é admin).
 */
export default function MaisVencedoresRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route index element={<Index />} />
        <Route path="login" element={<Login />} />
        <Route path="recuperar-senha" element={<RecuperarSenha />} />
        <Route path="nova-senha" element={<NovaSenha />} />
        <Route path="cadastro" element={<Signup />} />
        <Route path="convite/:code" element={<Signup />} />

        {/* O onboarding fica FORA do MembersLayout: quem ainda não preencheu o perfil não
            deve ver a sidebar de membro. */}
        <Route
          path="membros/onboarding"
          element={
            <ProtectedRoute>
              <MembershipProvider>
                <MembersOnboarding />
              </MembershipProvider>
            </ProtectedRoute>
          }
        />

        <Route path="membros" element={<MembersLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<MembersDashboard />} />
          <Route path="portfolio" element={<MembersPortfolio />} />
          <Route path="treinamentos" element={<MembersTraining />} />
          <Route path="eventos" element={<MembersEvents />} />
          <Route path="publicidade" element={<MembersAdvertising />} />
          <Route path="indicacoes" element={<MembersReferrals />} />
          <Route path="vendas" element={<MembersSales />} />
          <Route path="perfil" element={<MembersProfile />} />
          <Route path="configuracoes" element={<MembersSettings />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
