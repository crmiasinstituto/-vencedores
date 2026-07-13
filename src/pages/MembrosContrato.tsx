import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileSignature, ShieldCheck, CheckCircle2, Download } from 'lucide-react';

interface StatusResp {
  ok: boolean;
  has_contract: boolean;
  signature_required: boolean;
  signature_status: string | null;
  signed: boolean;
  pdf_url: string | null;
  can_sign: boolean;
  product: string | null;
  modality: string | null;
  member: Record<string, any>;
}

type Clause = { t: 'h1' | 'p' | 'b'; s: string };
interface ContractDoc {
  preambulo: string;
  clauses: Clause[];
  contratada: { nome: string; cnpj: string; cidade: string };
  local_data: string;
  anexo: {
    contratante: [string, string][];
    modalidade: [string, string][];
    financeiro: [string, string][];
    acesso: [string, string][];
  };
}

export default function MembrosContrato() {
  const navigate = useNavigate();
  const { token } = useParams<{ token?: string }>(); // rota publica /assinar/:token
  const isTokenMode = !!token;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [signing, setSigning] = useState(false);
  const [doc, setDoc] = useState<ContractDoc | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [nameTyped, setNameTyped] = useState('');
  const [accept, setAccept] = useState(false);
  const sessionRef = useRef<any>(null);

  const readSession = () => {
    const raw = localStorage.getItem('squaad_member_session');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  const call = async (action: string, extra: any = {}) => {
    const auth = isTokenMode ? { sign_token: token } : { session_token: sessionRef.current?.session_token };
    const { data, error } = await supabase.functions.invoke('member-contract', {
      body: { ...auth, action, ...extra },
    });
    if (error) throw new Error(error.message);
    if (data && data.ok === false) throw new Error(data.error || 'Erro');
    return data;
  };

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const data = await call('preview');
      setDoc(data.contract);
    } catch (e: any) {
      toast.error('Nao consegui carregar o contrato: ' + (e.message || ''));
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (!isTokenMode) {
      const s = readSession();
      if (!s?.session_token) { navigate('/membros/login'); return; }
      sessionRef.current = s;
    }
    (async () => {
      try {
        const data: StatusResp = await call('status');
        setStatus(data);
        setNameTyped(data.member?.name || '');
        if (!data.signed && data.has_contract) await loadPreview();
      } catch (e: any) {
        toast.error(e.message || 'Falha ao carregar contrato');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sign = async () => {
    if (!accept) { toast.error('Marque a caixa de aceite para continuar'); return; }
    if (nameTyped.trim().split(/\s+/).length < 2) { toast.error('Digite seu nome completo'); return; }
    setSigning(true);
    try {
      const data = await call('sign', { name_typed: nameTyped.trim(), accept_terms: true });
      toast.success('Contrato assinado! Acesso liberado.');
      setStatus((p) => p ? { ...p, signed: true, pdf_url: data.pdf_url } : p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error(e.message || 'Falha ao assinar');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24 text-white/70">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando seu contrato...
        </div>
      </Shell>
    );
  }

  if (!status?.has_contract) {
    return (
      <Shell>
        <Card>
          <p className="text-white/80">Nao ha contrato pendente.</p>
          <Button className="mt-4" onClick={() => navigate('/membros/login')}>Ir para a area de membros</Button>
        </Card>
      </Shell>
    );
  }

  if (status.signed) {
    return (
      <Shell>
        <Card>
          <div className="text-center py-6">
            <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Contrato assinado com sucesso</h2>
            <p className="text-white/70 max-w-md mx-auto">
              {isTokenMode
                ? 'Seu acesso foi liberado! Enviamos seu login da area de membros no seu WhatsApp. Uma copia da via assinada tambem foi enviada.'
                : 'Seu acesso as aulas ja esta liberado. Uma copia da sua via assinada foi enviada pelo WhatsApp.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              {status.pdf_url && (
                <a href={status.pdf_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Baixar contrato</Button>
                </a>
              )}
              <Button className="bg-[#3B82F6] text-black hover:bg-[#e0b400]"
                onClick={() => navigate(isTokenMode ? '/membros/login' : '/membros')}>
                {isTokenMode ? 'Acessar a area de membros' : 'Comecar as aulas'}
              </Button>
            </div>
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5">
        <div className="inline-flex items-center gap-2 text-[#3B82F6] text-sm font-semibold mb-2">
          <FileSignature className="h-4 w-4" /> Contrato de Mentoria
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          {status.product || 'Mentoria + que Vencedores'} <span className="text-white/50 text-base sm:text-lg">({status.modality})</span>
        </h1>
        <p className="text-white/60 mt-1 text-sm">
          Leia o contrato abaixo e assine no fim da pagina pra deixar tudo certinho.
        </p>
      </div>

      {/* Documento (responsivo, branco tipo papel) */}
      <div className="rounded-2xl border border-white/10 bg-white text-neutral-800 overflow-hidden">
        {loadingPreview || !doc ? (
          <div className="flex items-center justify-center py-24 text-neutral-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando contrato...
          </div>
        ) : (
          <div className="max-h-[62vh] overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            <ContractView doc={doc} product={status.product} modality={status.modality} member={status.member} />
          </div>
        )}
      </div>

      {/* Assinatura */}
      <div className="mt-5 rounded-2xl border border-[#3B82F6]/30 bg-[#3B82F6]/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-[#3B82F6] mt-0.5 shrink-0" />
          <div className="text-white/70 text-sm">
            Ao assinar, voce declara ter lido e concordado com todas as clausulas. Registramos seu nome,
            CPF, data/hora e IP como prova do aceite (Lei 14.063/2020 e MP 2.200-2/2001).
          </div>
        </div>

        <div className="mt-4">
          <Label className="text-white/70 text-xs">Digite seu nome completo para assinar</Label>
          <Input
            value={nameTyped}
            onChange={(e) => setNameTyped(e.target.value)}
            className="bg-white/5 border-white/10 text-white mt-1"
            placeholder="Seu nome completo"
          />
        </div>

        <label className="flex items-start gap-3 mt-4 cursor-pointer">
          <Checkbox checked={accept} onCheckedChange={(v) => setAccept(!!v)} className="mt-0.5" />
          <span className="text-white/80 text-sm">
            Li e aceito integralmente os termos do Contrato de Prestacao de Servicos de Mentoria + que Vencedores.
          </span>
        </label>

        <Button
          onClick={sign}
          disabled={signing || !accept}
          className="mt-5 w-full bg-[#3B82F6] text-black hover:bg-[#e0b400] font-semibold"
        >
          {signing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSignature className="h-4 w-4 mr-2" />}
          Assinar contrato e liberar acesso
        </Button>
      </div>
    </Shell>
  );
}

function ContractView({ doc, product, modality, member }: {
  doc: ContractDoc; product: string | null; modality: string | null; member: Record<string, any>;
}) {
  return (
    <div className="text-[13px] sm:text-sm leading-relaxed">
      <div className="text-center border-b border-neutral-200 pb-4 mb-5">
        <div className="text-[10px] tracking-widest text-neutral-400 font-semibold">+ que Vencedores BUSINESS SOLUTION</div>
        <h2 className="text-lg sm:text-xl font-bold text-neutral-900 mt-1">
          CONTRATO DE PRESTACAO DE SERVICOS DE MENTORIA
        </h2>
        <p className="text-xs text-neutral-500 mt-1">{product} · {modality}</p>
      </div>

      <p className="text-neutral-700 mb-4">{doc.preambulo}</p>

      {doc.clauses.map((c, i) => {
        if (c.t === 'h1') return <h3 key={i} className="font-bold text-neutral-900 mt-4 mb-1.5">{c.s}</h3>;
        if (c.t === 'b') return (
          <p key={i} className="text-neutral-700 mb-1 pl-4 relative">
            <span className="absolute left-0 text-[#b8901a]">•</span>{c.s}
          </p>
        );
        return <p key={i} className="text-neutral-700 mb-2 text-justify">{c.s}</p>;
      })}

      {/* Anexo I */}
      <div className="mt-6 pt-4 border-t border-neutral-200">
        <h3 className="font-bold text-neutral-900 mb-3">ANEXO I - QUALIFICACAO DAS PARTES E CONDICOES COMERCIAIS</h3>
        <AnexoBlock title="1. Dados do Contratante (Aluno / Mentorado)" rows={doc.anexo.contratante} />
        <AnexoBlock title="2. Modalidade da Mentoria" rows={doc.anexo.modalidade} />
        <AnexoBlock title="3. Condicoes Financeiras" rows={doc.anexo.financeiro} />
        <AnexoBlock title="4. Acesso a Plataforma e Suporte" rows={doc.anexo.acesso} />
      </div>

      {/* Assinaturas */}
      <div className="mt-6 pt-4 border-t border-neutral-200 text-neutral-700">
        <p className="mb-4">{doc.local_data}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <div className="italic text-neutral-800 text-base mb-1" style={{ fontFamily: 'Georgia, serif' }}>
              + que Vencedores Business Solution
            </div>
            <div className="border-t border-neutral-400 pt-1 text-xs">
              <div className="font-semibold">{doc.contratada.nome}</div>
              <div>CNPJ: {doc.contratada.cnpj}</div>
              <div className="text-neutral-500">CONTRATADA</div>
            </div>
          </div>
          <div>
            <div className="h-6" />
            <div className="border-t border-neutral-400 pt-1 text-xs">
              <div className="font-semibold uppercase">{member.name}</div>
              <div>CPF: {member.cpf || '________'}</div>
              <div className="text-neutral-500">CONTRATANTE / ALUNO</div>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/40 p-3 text-xs text-neutral-600">
          O registro de aceite (nome, CPF, data/hora e IP) sera preenchido no momento da sua assinatura
          eletronica, com validade juridica (Lei 14.063/2020 e MP 2.200-2/2001).
        </div>
      </div>
    </div>
  );
}

function AnexoBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-neutral-900 bg-neutral-100 rounded px-2 py-1 mb-2">{title}</div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex flex-col">
            <dt className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</dt>
            <dd className="text-neutral-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #14141f 55%, #0a0a0a 100%)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">{children}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">{children}</div>;
}
