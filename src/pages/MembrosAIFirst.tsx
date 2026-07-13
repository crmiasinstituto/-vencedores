import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MembrosLayout } from '@/components/membros/MembrosLayout';
import { AcceleratorCard } from '@/components/membros/accelerators/AcceleratorCard';
import {
  CATEGORY_CONFIG,
  hasDetailContent,
  type Accelerator,
} from '@/components/membros/accelerators/types';
import { Input } from '@/components/ui/input';
import {
  File,
  Search,
  Sparkles,
  Wrench,
  BookOpen,
  LayoutTemplate,
  FileText,
  Lock,
} from 'lucide-react';

const db = supabase as any;

// Aceleradores AI FIRST: membros NOVOS liberam 15 dias apos assinar o contrato
// (com contrato vigente). Membros ja ativos (signature_required=false) ficam sempre liberados.
const AI_FIRST_UNLOCK_DAYS = 15;

interface GateState {
  checked: boolean;
  unlocked: boolean;
  unlockDate: Date | null;
  expired: boolean;
}

const CATEGORY_ICON: Record<string, any> = {
  geral: FileText,
  template: LayoutTemplate,
  ferramenta: Wrench,
  guia: BookOpen,
};

const CATEGORY_OPTIONS = ['todos', 'template', 'ferramenta', 'guia', 'geral'];

export default function MembrosAIFirst() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<Accelerator[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [gate, setGate] = useState<GateState>({ checked: false, unlocked: false, unlockDate: null, expired: false });

  useEffect(() => {
    (async () => {
      const g = await checkGate();
      setGate(g);
      if (g.unlocked) await loadFiles();
      else setLoading(false);
    })();
  }, []);

  const checkGate = async (): Promise<GateState> => {
    try {
      const raw = localStorage.getItem('squaad_member_session');
      if (!raw) return { checked: true, unlocked: false, unlockDate: null, expired: false };
      const sess = JSON.parse(raw);
      const { data: contract } = await db.from('member_contracts')
        .select('signed_at, access_ends_on, signature_required')
        .eq('member_id', sess.member_id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();

      // Membro ja ativo (nao e do fluxo novo) ou sem contrato: sempre liberado.
      if (!contract || contract.signature_required !== true || !contract.signed_at) {
        return { checked: true, unlocked: true, unlockDate: null, expired: false };
      }

      // Membro novo que assinou: libera 15 dias apos a assinatura, com contrato vigente.
      const unlockDate = new Date(contract.signed_at);
      unlockDate.setDate(unlockDate.getDate() + AI_FIRST_UNLOCK_DAYS);
      const today = new Date();
      const expired = !!contract.access_ends_on && new Date(contract.access_ends_on + 'T23:59:59') < today;
      const unlocked = today >= unlockDate && !expired;
      return { checked: true, unlocked, unlockDate, expired };
    } catch {
      return { checked: true, unlocked: false, unlockDate: null, expired: false };
    }
  };

  const loadFiles = async () => {
    const { data } = await db
      .from('member_files')
      .select('*')
      .eq('is_published', true)
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });

    setFiles(data || []);
    setLoading(false);
  };

  const openAccelerator = async (a: Accelerator) => {
    if (hasDetailContent(a)) {
      navigate(`/membros/ai-first/${a.slug}`);
      return;
    }
    // Arquivo simples: baixa direto e conta o download.
    await db
      .from('member_files')
      .update({ download_count: (a.download_count || 0) + 1 })
      .eq('id', a.id);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === a.id ? { ...f, download_count: (f.download_count || 0) + 1 } : f
      )
    );
    window.open(a.file_url, '_blank');
  };

  const filtered = files.filter((f) => {
    const matchSearch =
      !search ||
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.description?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'todos' || f.category === category;
    return matchSearch && matchCategory;
  });

  const featured = files.filter((f) => f.is_featured);

  // Agrupa por categoria (visão "todos")
  const grouped: Record<string, Accelerator[]> = {};
  for (const f of filtered) {
    const cat = f.category || 'geral';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  }
  // Ordem fixa: template primeiro (os aceleradores), depois o resto.
  const groupOrder = ['template', 'ferramenta', 'guia', 'geral'].filter(
    (c) => grouped[c]?.length
  );

  if (gate.checked && !gate.unlocked) {
    return (
      <MembrosLayout>
        <div className="max-w-xl mx-auto text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#3B82F6]/10 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-[#3B82F6]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-[#3B82F6]" /> AI FIRST
          </h1>
          {gate.expired ? (
            <p className="text-white/60">
              Seu contrato nao esta vigente. Fale com o suporte para reativar o acesso aos aceleradores.
            </p>
          ) : (
            <>
              <p className="text-white/60">
                Os aceleradores AI FIRST liberam <b className="text-white">15 dias apos a assinatura do seu contrato</b>.
              </p>
              {gate.unlockDate && (
                <p className="text-[#3B82F6] font-semibold mt-3">
                  Disponivel a partir de {gate.unlockDate.toLocaleDateString('pt-BR')}
                </p>
              )}
              <p className="text-white/40 text-sm mt-4">
                Enquanto isso, aproveite as aulas e as lives na sua trilha principal.
              </p>
            </>
          )}
        </div>
      </MembrosLayout>
    );
  }

  return (
    <MembrosLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#3B82F6]" />
              AI FIRST
            </h1>
            <p className="text-white/40 mt-1">
              Aceleradores: templates, ferramentas e guias prontos pra você usar no seu desenvolvimento
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Buscar aceleradores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl"
            />
          </div>
        </div>

        {/* Destaques */}
        {!loading && !search && category === 'todos' && featured.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#3B82F6]" />
              Destaques
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((file, i) => (
                <AcceleratorCard
                  key={file.id}
                  accelerator={file}
                  index={i}
                  onClick={openAccelerator}
                />
              ))}
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_OPTIONS.map((cat) => {
            const isActive = category === cat;
            const config = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30'
                    : 'bg-white/5 text-white/50 border border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                {cat === 'todos' ? 'Todos' : config?.label || cat}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <File className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/40">Nenhum acelerador encontrado</p>
          </div>
        ) : category === 'todos' ? (
          // Grouped view
          groupOrder.map((cat) => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.geral;
            const Icon = CATEGORY_ICON[cat] || FileText;
            return (
              <div key={cat} className="space-y-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Icon className="w-5 h-5" style={{ color: config.color }} />
                  {config.label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped[cat].map((file, i) => (
                    <AcceleratorCard
                      key={file.id}
                      accelerator={file}
                      index={i}
                      onClick={openAccelerator}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Flat grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((file, i) => (
              <AcceleratorCard
                key={file.id}
                accelerator={file}
                index={i}
                onClick={openAccelerator}
              />
            ))}
          </div>
        )}
      </div>
    </MembrosLayout>
  );
}
