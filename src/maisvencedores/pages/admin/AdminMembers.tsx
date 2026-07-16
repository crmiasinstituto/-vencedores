import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CheckCircle, XCircle, MoreHorizontal, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Faixa } from '@/maisvencedores/types/member';
import { FAIXAS, FAIXA_INFO } from '@/maisvencedores/types/member';

interface Member {
  id: string;
  user_id: string;
  company_name: string;
  owner_name: string;
  photo_url: string | null;
  segment: string | null;
  faixa: Faixa;
  faixa_declarada: Faixa | null;
  is_approved: boolean;
  created_at: string;
  email: string | null;
}

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroFaixa, setFiltroFaixa] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true, approved_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) throw error;
      toast.success('Membro aprovado!');
      fetchMembers();
    } catch (error) {
      toast.error('Erro ao aprovar membro');
    }
  };

  const moverParaFaixa = async (profileId: string, novaFaixa: Faixa) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ faixa: novaFaixa })
        .eq('id', profileId);

      if (error) throw error;
      toast.success(`Movido para a Faixa ${FAIXA_INFO[novaFaixa].nome}`);
      fetchMembers();
    } catch (error) {
      toast.error('Erro ao alterar a faixa');
    }
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm('Tem certeza que deseja remover este membro?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;
      toast.success('Membro removido');
      fetchMembers();
    } catch (error) {
      toast.error('Erro ao remover membro');
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      member.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
      member.email?.toLowerCase().includes(search.toLowerCase());

    const casaFaixa = filtroFaixa === 'all' || member.faixa === filtroFaixa;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'approved' && member.is_approved) ||
      (filterStatus === 'pending' && !member.is_approved);

    return matchesSearch && casaFaixa && matchesStatus;
  });


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestão de Membros do ecossistema</h1>
        <p className="text-muted-foreground">Aprovar, editar e acompanhar a faixa de cada membro</p>
      </div>

      {/* Filters */}
      <Card className="bg-card/50 border-gold/20">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, empresa ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filtroFaixa} onValueChange={setFiltroFaixa}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Faixa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as faixas</SelectItem>
                {FAIXAS.map((f) => (
                  <SelectItem key={f} value={f}>
                    Faixa {FAIXA_INFO[f].nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card className="bg-card/50 border-gold/20">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Faixa</TableHead>
                  <TableHead>Declarou ser</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.photo_url || undefined} />
                          <AvatarFallback>
                            {member.owner_name?.charAt(0) || 'M'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.company_name || 'Sem empresa'}</p>
                          <p className="text-sm text-muted-foreground">{member.owner_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{member.segment || '-'}</TableCell>
                    <TableCell>
                      {/* O que a PESSOA disse ser. Fica ao lado da oficial de propósito: é a
                          comparação entre as duas que o time usa pra decidir a aprovação. */}
                      {member.faixa_declarada ? (
                        <span className={FAIXA_INFO[member.faixa_declarada].texto}>
                          {FAIXA_INFO[member.faixa_declarada].nome}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">nao informou</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${FAIXA_INFO[member.faixa]?.fundo} ${FAIXA_INFO[member.faixa]?.texto} ${FAIXA_INFO[member.faixa]?.borda}`}>
                        {member.faixa.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.is_approved ? (
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          Aprovado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!member.is_approved && (
                            <DropdownMenuItem onClick={() => handleApprove(member.id)}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                              Aprovar
                            </DropdownMenuItem>
                          )}
                          {/* A progressão inteira, gerada de FAIXAS: uma faixa nova
                              aparece aqui sozinha. Cada faixa sobrepõe a anterior, então
                              mover é trocar, nunca acumular. */}
                          {FAIXAS.filter((f) => f !== member.faixa).map((f) => (
                            <DropdownMenuItem key={f} onClick={() => moverParaFaixa(member.id, f)}>
                              Mover para Faixa {FAIXA_INFO[f].nome}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            onClick={() => handleDelete(member.id)}
                            className="text-red-500"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
