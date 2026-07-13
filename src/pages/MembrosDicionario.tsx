import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MembrosLayout } from '@/components/membros/MembrosLayout';
import { Input } from '@/components/ui/input';
import { Search, BookOpen, Utensils } from 'lucide-react';

const db = supabase as any;

interface Term {
  id: string;
  term: string;
  aliases: string[] | null;
  category: string;
  emoji: string | null;
  analogy: string | null;
  definition: string;
  sort_order: number | null;
}

export default function MembrosDicionario() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('glossary_terms')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
      setTerms(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return terms;
    return terms.filter((t) =>
      t.term.toLowerCase().includes(s) ||
      t.definition.toLowerCase().includes(s) ||
      (t.analogy || '').toLowerCase().includes(s) ||
      (t.aliases || []).some((a) => a.toLowerCase().includes(s)),
    );
  }, [terms, q]);

  const byCategory = useMemo(() => {
    const map: Record<string, Term[]> = {};
    filtered.forEach((t) => {
      (map[t.category] = map[t.category] || []).push(t);
    });
    return Object.entries(map);
  }, [filtered]);

  return (
    <MembrosLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <BookOpen className="w-6 h-6 text-[#3B82F6]" />
            Dicionario
          </h1>
          <p className="text-sm text-white/50 mt-1 flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5" />
            Todo termo tecnico explicado com uma analogia de restaurante.
          </p>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Buscar termo (ex: API, deploy, CRM)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white"
          />
        </div>

        {loading ? (
          <p className="text-center text-white/40 py-12 text-sm">Carregando...</p>
        ) : byCategory.length === 0 ? (
          <p className="text-center text-white/40 py-12 text-sm">Nenhum termo encontrado.</p>
        ) : (
          byCategory.map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#3B82F6]/80">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-[#3B82F6]/40 transition-colors">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xl leading-none">{t.emoji || '📌'}</span>
                      <h3 className="font-bold text-white">{t.term}</h3>
                    </div>
                    {t.analogy && (
                      <p className="text-sm text-[#3B82F6]/90 mb-1.5 flex gap-1.5">
                        <Utensils className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{t.analogy}</span>
                      </p>
                    )}
                    <p className="text-sm text-white/60">{t.definition}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </MembrosLayout>
  );
}
