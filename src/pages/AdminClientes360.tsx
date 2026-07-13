import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, GraduationCap, Briefcase, Crown, MessageSquare, Phone, Instagram, AlertTriangle, Star, TrendingUp } from 'lucide-react';
import { ClientProfile360 } from '@/components/admin/ClientProfile360';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UnifiedContact {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  instagram?: string;
  stage: 'prospect' | 'lead_qualificado' | 'aluno' | 'elite';
  source: string;
  education_level?: string;
  onboarding_completed?: boolean;
  onboarding_step?: number;
  last_interaction?: string;
  has_overdue?: boolean;
  products?: string[];
  raw: any;
}

type FilterType = 'all' | 'vhs' | 'crm' | 'onboarding' | 'superior';

export default function AdminClientes360() {
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedContact, setSelectedContact] = useState<UnifiedContact | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    const [vhsRes, crmRes, clientsRes, salesRes, paymentsRes] = await Promise.all([
      supabase.from('vhs_participants').select('*'),
      supabase.from('crm_leads').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('sales_events').select('*'),
      supabase.from('payments').select('contract_id, status').eq('status', 'overdue'),
    ]);

    const unified: UnifiedContact[] = [];
    const seen = new Set<string>();

    // VHS participants
    vhsRes.data?.forEach(p => {
      const key = p.whatsapp;
      if (seen.has(key)) return;
      seen.add(key);

      const sales = salesRes.data?.filter(s => s.whatsapp === p.whatsapp) || [];
      const isAluno = p.onboarding_completed;
      const isSuperior = p.ai_experience_level === 'avancado' || p.current_situation === 'empresario';

      unified.push({
        id: p.id,
        name: p.name,
        whatsapp: p.whatsapp,
        email: p.email || undefined,
        stage: isAluno && isSuperior ? 'elite' : isAluno ? 'aluno' : 'lead_qualificado',
        source: 'VHS',
        education_level: p.ai_experience_level || undefined,
        onboarding_completed: p.onboarding_completed || false,
        onboarding_step: p.onboarding_step || 0,
        last_interaction: p.updated_at || p.created_at || undefined,
        products: sales.map(s => s.product_name),
        raw: p,
      });
    });

    // CRM leads
    crmRes.data?.forEach(l => {
      const key = l.whatsapp;
      if (seen.has(key)) return;
      seen.add(key);

      unified.push({
        id: l.id,
        name: l.name,
        whatsapp: l.whatsapp,
        email: l.email || undefined,
        instagram: l.instagram || undefined,
        stage: 'prospect',
        source: 'CRM',
        last_interaction: l.updated_at || l.created_at || undefined,
        raw: l,
      });
    });

    // Clients (onboarding)
    clientsRes.data?.forEach(c => {
      const key = c.responsible_name;
      if (seen.has(key)) return;

      unified.push({
        id: c.id,
        name: c.responsible_name || c.company_name,
        whatsapp: '',
        stage: c.status === 'completed' ? 'aluno' : 'lead_qualificado',
        source: 'Onboarding',
        onboarding_completed: c.status === 'completed',
        onboarding_step: c.onboarding_step,
        last_interaction: c.updated_at,
        raw: c,
      });
    });

    setContacts(unified);
    setLoading(false);
  };

  const filtered = contacts.filter(c => {
    const matchSearch = !searchTerm || 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.whatsapp.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchFilter = true;
    if (filter === 'vhs') matchFilter = c.source === 'VHS';
    if (filter === 'crm') matchFilter = c.source === 'CRM';
    if (filter === 'onboarding') matchFilter = c.source === 'Onboarding';
    if (filter === 'superior') matchFilter = c.education_level === 'avancado' || c.stage === 'elite';

    return matchSearch && matchFilter;
  });

  const stageBadge = (stage: UnifiedContact['stage']) => {
    const config = {
      prospect: { label: 'Prospect', className: 'bg-muted text-muted-foreground' },
      lead_qualificado: { label: 'Qualificado', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      aluno: { label: 'Aluno', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      elite: { label: 'Elite', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    };
    const c = config[stage];
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const getAlertBorder = (contact: UnifiedContact) => {
    if (contact.education_level === 'avancado' && contact.stage === 'elite') return 'border-l-4 border-l-purple-500';
    if (contact.has_overdue) return 'border-l-4 border-l-red-500';
    if (contact.last_interaction) {
      const daysSince = (Date.now() - new Date(contact.last_interaction).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 10) return 'border-l-4 border-l-amber-500';
    }
    if (contact.onboarding_completed && (contact.education_level === 'avancado' || contact.stage === 'elite')) return 'border-l-4 border-l-green-500';
    return '';
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'vhs', label: 'Alunos VHS' },
    { key: 'crm', label: 'Leads CRM' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'superior', label: 'Nível Avançado' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Central do Cliente 360
        </h1>
        <p className="text-sm text-muted-foreground">{contacts.length} contatos no ecossistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, WhatsApp ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Última Interação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(contact => (
                  <TableRow key={`${contact.source}-${contact.id}`} className={`cursor-pointer hover:bg-accent/5 ${getAlertBorder(contact)}`} onClick={() => setSelectedContact(contact)}>
                    <TableCell className="font-medium text-foreground">{contact.name}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.whatsapp || '-'}</TableCell>
                    <TableCell>{stageBadge(contact.stage)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{contact.source}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {contact.last_interaction ? format(new Date(contact.last_interaction), "dd/MM/yy", { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {contact.whatsapp && (
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${contact.whatsapp.replace(/\D/g, '')}`, '_blank'); }}>
                          <MessageSquare className="w-4 h-4 text-green-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum contato encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Profile Modal */}
      {selectedContact && (
        <ClientProfile360
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
}
