import { useState, useEffect, useRef } from 'react';
import { Search, X, User, Building2, GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { LeadDetailModal } from '@/components/crm/LeadDetailModal';

interface SearchResult {
  id: string;
  name: string;
  type: 'crm_lead' | 'client' | 'vhs_participant' | 'lead';
  subtitle: string;
}

interface CRMLead {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  instagram?: string;
  instagram_profile_pic_url?: string;
  company_name?: string;
  notes?: string;
  tags?: string[];
  lead_score: number;
  potential_value?: number;
  scheduled_call_at?: string;
  priority: string;
  column_id: string;
  source?: string;
  created_at?: string;
}

interface CRMColumn {
  id: string;
  name: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // LeadView state
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [leadColumns, setLeadColumns] = useState<CRMColumn[]>([]);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }

    const timeout = setTimeout(async () => {
      const all: SearchResult[] = [];
      const q = `%${query}%`;

      const [crmRes, clientRes, vhsRes, leadRes] = await Promise.all([
        supabase.from('crm_leads').select('id, name, whatsapp, email').or(`name.ilike.${q},whatsapp.ilike.${q},email.ilike.${q}`).limit(5),
        supabase.from('clients').select('id, company_name, responsible_name').or(`company_name.ilike.${q},responsible_name.ilike.${q}`).limit(5),
        supabase.from('vhs_participants').select('id, name, whatsapp').or(`name.ilike.${q},whatsapp.ilike.${q}`).limit(5),
        supabase.from('leads').select('id, name, whatsapp').or(`name.ilike.${q},whatsapp.ilike.${q}`).limit(5),
      ]);

      crmRes.data?.forEach(r => all.push({ id: r.id, name: r.name, type: 'crm_lead', subtitle: r.whatsapp || r.email || '' }));
      clientRes.data?.forEach(r => all.push({ id: r.id, name: r.company_name, type: 'client', subtitle: r.responsible_name }));
      vhsRes.data?.forEach(r => all.push({ id: r.id, name: r.name, type: 'vhs_participant', subtitle: r.whatsapp }));
      leadRes.data?.forEach(r => all.push({ id: r.id, name: r.name, type: 'lead', subtitle: r.whatsapp }));

      setResults(all);
      setOpen(all.length > 0);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const typeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'crm_lead': return <User className="w-3 h-3 text-blue-400" />;
      case 'client': return <Building2 className="w-3 h-3 text-green-400" />;
      case 'vhs_participant': return <GraduationCap className="w-3 h-3 text-primary" />;
      default: return <User className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const typeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'crm_lead': return 'CRM';
      case 'client': return 'Cliente';
      case 'vhs_participant': return 'VHS';
      default: return 'Lead';
    }
  };

  const openLeadProfile = async (crmLeadId: string) => {
    const [leadRes, colsRes] = await Promise.all([
      supabase.from('crm_leads').select('*').eq('id', crmLeadId).single(),
      supabase.from('crm_columns').select('id, name').order('sort_order'),
    ]);
    if (leadRes.data) {
      setSelectedLead(leadRes.data as unknown as CRMLead);
      setLeadColumns(colsRes.data || []);
      setLeadModalOpen(true);
    }
  };

  const handleSelect = async (result: SearchResult) => {
    setOpen(false);
    setQuery('');

    if (result.type === 'crm_lead') {
      await openLeadProfile(result.id);
    } else if (result.type === 'lead') {
      // Find corresponding crm_lead by source_lead_id or whatsapp
      const { data: crmLead } = await supabase
        .from('crm_leads')
        .select('id')
        .or(`source_lead_id.eq.${result.id},whatsapp.eq.${result.subtitle}`)
        .limit(1)
        .maybeSingle();
      
      if (crmLead) {
        await openLeadProfile(crmLead.id);
      } else {
        navigate('/admin/crm');
      }
    } else if (result.type === 'client') {
      navigate('/admin/onboarding');
    } else {
      navigate('/admin/clientes');
    }
  };

  const handleSaveLead = async (data: Partial<CRMLead>) => {
    if (!selectedLead) return;
    await supabase.from('crm_leads').update(data as any).eq('id', selectedLead.id);
  };

  return (
    <>
      <div ref={ref} className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar UUID, nome, WhatsApp..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pl-9 h-9 bg-card border-border text-sm"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}

        {open && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent/10 text-left text-sm transition-colors"
              >
                {typeIcon(r.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-foreground truncate">{r.name}</p>
                  <p className="text-muted-foreground text-xs truncate">{r.subtitle}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{typeLabel(r.type)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <LeadDetailModal
        isOpen={leadModalOpen}
        onClose={() => { setLeadModalOpen(false); setSelectedLead(null); }}
        lead={selectedLead}
        columns={leadColumns}
        onSave={handleSaveLead}
        mode="edit"
      />
    </>
  );
}
