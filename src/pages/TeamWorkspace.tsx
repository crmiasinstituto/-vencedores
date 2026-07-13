// Espaco do time (/time): unica pagina que o acesso externo enxerga.
// Tabs: Acervo (pastas + arquivos no B2) e Quadro (Trello). Gated pelo
// useTeamAuth; sem sessao redireciona pro login. Layout proprio, sem o
// chrome do admin.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTeamAuth } from '@/hooks/useTeamAuth';
import DriveExplorer from '@/components/drive/DriveExplorer';
import TeamBoard from '@/components/drive/TeamBoard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FolderLock, LogOut, Loader2, HardDrive, KanbanSquare } from 'lucide-react';

export default function TeamWorkspace() {
  const { user, loading, logout } = useTeamAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/time/login', { replace: true });
  }, [loading, user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/time/login', { replace: true });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet><title>Acervo do Time · + que Vencedores</title></Helmet>

      {/* Header */}
      <header className="border-b border-border bg-card/50 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#3B82F6]/10">
              <FolderLock className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <span className="font-semibold text-sm">Acervo do Time</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="acervo">
          <TabsList className="mb-4">
            <TabsTrigger value="acervo"><HardDrive className="w-4 h-4 mr-1.5" /> Acervo</TabsTrigger>
            <TabsTrigger value="quadro"><KanbanSquare className="w-4 h-4 mr-1.5" /> Quadro</TabsTrigger>
          </TabsList>
          <TabsContent value="acervo">
            <DriveExplorer actorName={user.name} />
          </TabsContent>
          <TabsContent value="quadro">
            <TeamBoard actorName={user.name} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
