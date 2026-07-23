import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { PortfolioGrid } from '@/maisvencedores/components/members/PortfolioGrid';
import { useMembers } from '@/maisvencedores/hooks/useMembers';
import { Loader2 } from 'lucide-react';

export default function MembersPortfolio() {
  const { members, loading } = useMembers();

  // Só entram no portfólio os membros COM foto — card de iniciais fica feio na vitrine.
  const mappedMembers = members.filter((m) => m.photoUrl).map((m) => ({
    id: m.id,
    userId: m.userId,
    companyName: m.companyName,
    nomeCompleto: m.nomeCompleto,
    profissao: m.profissao || undefined,
    telefone: m.telefone || undefined,
    segment: m.segment || '',
    description: m.description || '',
    photo: m.photoUrl || undefined,
    website: m.website || undefined,
    instagram: m.instagram || undefined,
    email: m.email || undefined,
    linkedin: m.linkedin || undefined,
    services: m.services,
    faixa: m.faixa,
    isNewMember: m.isNewMember,
    joinedAt: m.createdAt,
    onboardingCompleted: true,
  }));

  return (
    <div className="min-h-screen">
      <MembersHeader 
        title="Portfólio de Membros"
        subtitle="Conecte-se com empresários da comunidade"
      />
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum membro aprovado ainda.
          </div>
        ) : (
          <PortfolioGrid members={mappedMembers} />
        )}
      </div>
    </div>
  );
}
