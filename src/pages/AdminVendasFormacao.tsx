import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, Users, DollarSign, ShoppingBag } from 'lucide-react';

/**
 * Vendas das formações do Instituto (FPI, FPO, FPI+FPO) — ferramenta interna.
 *
 * O time escolhe o produto e a forma de pagamento (o valor é preenchido sozinho pela tabela de
 * preços), põe nome e telefone do cliente e registra. Embaixo, a lista e os totais.
 *
 * Preços são fixos (catálogo abaixo). Se mudarem, é só editar PRODUTOS — nada de banco. A venda
 * guarda um snapshot do valor, então mexer no preço não altera vendas antigas.
 */

type Opcao = { id: string; label: string; total: number; parcelas: number; parcela?: number };
type Produto = { id: string; nome: string; casal?: boolean; opcoes: Opcao[] };

const PRODUTOS: Produto[] = [
  {
    id: 'fpi_fpo',
    nome: 'FPI + FPO (completo)',
    opcoes: [
      { id: 'avista', label: 'À vista — 15% off', total: 7140, parcelas: 1 },
      { id: '12x', label: '12x de R$ 700,00', total: 8400, parcelas: 12, parcela: 700 },
    ],
  },
  {
    id: 'fpi_fpo_casal',
    nome: 'FPI + FPO — Casal',
    casal: true,
    opcoes: [
      { id: 'avista', label: 'À vista — R$ 7.140 cada', total: 14280, parcelas: 1 },
      { id: '12x', label: '12x de R$ 1.190,00', total: 14280, parcelas: 12, parcela: 1190 },
    ],
  },
  {
    id: 'fpi',
    nome: 'Practitioner (só FPI)',
    opcoes: [
      { id: 'avista', label: 'À vista — 15% off', total: 5100, parcelas: 1 },
      { id: '12x', label: '12x de R$ 500,00', total: 6000, parcelas: 12, parcela: 500 },
    ],
  },
  {
    id: 'fpo',
    nome: 'Palestrantes e Oradores (só FPO)',
    opcoes: [
      { id: 'avista', label: 'À vista — 15% off', total: 4080, parcelas: 1 },
      { id: '12x', label: '12x de R$ 400,00', total: 4800, parcelas: 12, parcela: 400 },
    ],
  },
];

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

type Venda = {
  id: string;
  produto_nome: string;
  forma_pagamento: string;
  parcelas: number;
  valor_parcela: number | null;
  valor_total: number;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_nome_2: string | null;
  created_at: string;
};

export default function AdminVendasFormacao() {
  const { toast } = useToast();

  const [produtoId, setProdutoId] = useState<string>('fpi_fpo');
  const [opcaoId, setOpcaoId] = useState<string>('avista');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [nome2, setNome2] = useState('');
  const [telefone2, setTelefone2] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);

  const produto = PRODUTOS.find((p) => p.id === produtoId)!;
  const opcao = produto.opcoes.find((o) => o.id === opcaoId) || produto.opcoes[0];

  // Quando troca de produto, garante uma opção válida.
  useEffect(() => {
    if (!produto.opcoes.some((o) => o.id === opcaoId)) setOpcaoId(produto.opcoes[0].id);
  }, [produtoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await (supabase as any)
      .from('vendas_formacao')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setVendas((data as Venda[]) || []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, []);

  const registrar = async () => {
    if (!nome.trim()) {
      toast({ title: 'Informe o nome do cliente', variant: 'destructive' });
      return;
    }
    if (produto.casal && !nome2.trim()) {
      toast({ title: 'No casal, informe o nome das duas pessoas', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const { error } = await (supabase as any).from('vendas_formacao').insert({
      produto: produto.id,
      produto_nome: produto.nome,
      forma_pagamento: opcao.id,
      parcelas: opcao.parcelas,
      valor_parcela: opcao.parcela ?? null,
      valor_total: opcao.total,
      cliente_nome: nome.trim(),
      cliente_telefone: telefone.trim() || null,
      cliente_nome_2: produto.casal ? nome2.trim() : null,
      cliente_telefone_2: produto.casal ? telefone2.trim() || null : null,
      observacao: obs.trim() || null,
    });
    setSalvando(false);
    if (error) {
      toast({ title: 'Não deu pra registrar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Venda registrada', description: `${produto.nome} — ${brl(opcao.total)}` });
    setNome(''); setTelefone(''); setNome2(''); setTelefone2(''); setObs('');
    carregar();
  };

  const totais = useMemo(() => {
    const soma = vendas.reduce((s, v) => s + Number(v.valor_total || 0), 0);
    return { qtd: vendas.length, soma };
  }, [vendas]);

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">IAS Instituto</p>
        <h1 className="text-2xl font-display font-bold text-foreground">Vendas — Formações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre a venda de FPI, FPO e FPI+FPO. O valor é preenchido pela tabela de preços.
        </p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <ShoppingBag className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{totais.qtd}</p>
          <p className="text-xs text-muted-foreground">Vendas registradas</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <DollarSign className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{brl(totais.soma)}</p>
          <p className="text-xs text-muted-foreground">Total em vendas</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulário */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Produto</Label>
            <div className="grid gap-2">
              {PRODUTOS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProdutoId(p.id)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                    produtoId === p.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {p.casal && <Users className="w-4 h-4" />}
                    {p.nome}
                  </span>
                  {produtoId === p.id && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <div className="flex flex-wrap gap-2">
              {produto.opcoes.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOpcaoId(o.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    opcaoId === o.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <span className="text-sm text-muted-foreground">Valor total: </span>
              <span className="text-lg font-bold text-foreground">{brl(opcao.total)}</span>
              {opcao.parcela && (
                <span className="text-sm text-muted-foreground"> · {opcao.parcelas}x de {brl(opcao.parcela)}</span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">{produto.casal ? 'Nome (pessoa 1)' : 'Nome do cliente'}</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">{produto.casal ? 'Telefone (pessoa 1)' : 'Telefone'}</Label>
              <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>

          {produto.casal && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome2">Nome (pessoa 2)</Label>
                <Input id="nome2" value={nome2} onChange={(e) => setNome2(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel2">Telefone (pessoa 2)</Label>
                <Input id="tel2" value={telefone2} onChange={(e) => setTelefone2(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Textarea id="obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: parcelado no cartão do emissor, turma de agosto…" />
          </div>

          <Button onClick={registrar} disabled={salvando} variant="gold">
            {salvando ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando…</>) : (<><Check className="w-4 h-4 mr-2" /> Registrar venda</>)}
          </Button>
        </div>

        {/* Lista */}
        <div>
          <Label className="mb-2 block">Vendas registradas</Label>
          {carregando ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
          ) : vendas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
              Nenhuma venda registrada ainda.
            </div>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {vendas.map((v) => (
                <div key={v.id} className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {v.cliente_nome}{v.cliente_nome_2 ? ` e ${v.cliente_nome_2}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.produto_nome}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{brl(Number(v.valor_total))}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {v.forma_pagamento === 'avista' ? 'À vista' : `${v.parcelas}x`}
                      </p>
                    </div>
                  </div>
                  {v.cliente_telefone && (
                    <p className="text-xs text-muted-foreground mt-1">{v.cliente_telefone}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
