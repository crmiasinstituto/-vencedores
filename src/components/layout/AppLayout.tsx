// Shim de AppLayout para o módulo Marketing. As páginas do pacote esperam
// envolver o conteúdo em <AppLayout>. No CRM + que Vencedores, as rotas /admin/* já
// passam pelo AdminLayout via React Router (Route layout), então aqui o
// AppLayout só passa os children sem nada extra.
import type { ReactNode } from 'react';

export function AppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default AppLayout;
