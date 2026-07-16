import { useState } from 'react';
import { MemberProfile, FAIXAS, FAIXA_INFO } from '@/maisvencedores/types/member';
import { MemberCard } from './MemberCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Grid, List } from 'lucide-react';

interface PortfolioGridProps {
  members: MemberProfile[];
}

export function PortfolioGrid({ members }: PortfolioGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [faixaFilter, setFaixaFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredMembers = members.filter(member => {
    const busca = searchTerm.toLowerCase();
    const matchesSearch =
      member.nomeCompleto.toLowerCase().includes(busca) ||
      (member.profissao?.toLowerCase().includes(busca) ?? false) ||
      (member.companyName?.toLowerCase().includes(busca) ?? false) ||
      (member.services?.some(s => s.toLowerCase().includes(busca)) ?? false);

    const matchesFaixa = faixaFilter === 'all' || member.faixa === faixaFilter;

    return matchesSearch && matchesFaixa;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, profissão ou serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card/50 border-border/50"
          />
        </div>

        {/* Filtro de faixa */}
        <Select value={faixaFilter} onValueChange={setFaixaFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-card/50 border-border/50">
            <SelectValue placeholder="Faixa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as faixas</SelectItem>
            {FAIXAS.map(f => (
              <SelectItem key={f} value={f}>{FAIXA_INFO[f].nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Toggle */}
        <div className="flex gap-1 bg-card/50 rounded-lg p-1 border border-border/50">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredMembers.length} membro{filteredMembers.length !== 1 ? 's' : ''} encontrado{filteredMembers.length !== 1 ? 's' : ''}
      </p>

      {/* Grid */}
      <div className={
        viewMode === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'flex flex-col gap-3'
      }>
        {filteredMembers.map(member => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {/* Empty State */}
      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum membro encontrado com os filtros selecionados.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => {
              setSearchTerm('');
              setFaixaFilter('all');
            }}
          >
            Limpar Filtros
          </Button>
        </div>
      )}
    </div>
  );
}
