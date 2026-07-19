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
 * O time escolhe o produto e a forma de pagamento; o valor vem da tabela de preços fixa. Além de
 * à vista e 12x, tem "Sinal + boleto": o cliente deu uma entrada e parcelou o restante em boletos
 * (aí o time informa o valor cheio, o sinal e quantos boletos, e o sistema calcula cada boleto).
 *
 * Captura também os dados fiscais: e-mail, CPF e endereço (e do casal, a 2ª pessoa). A venda
 * guarda um snapshot do valor, então mexer no preço depois não altera vendas antigas.
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

const SINAL = 'sinal_boleto';
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const num = (s: string) => Number(String(s).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0;

type Venda = {
  id: string;
  produto_nome: string;
  forma_pagamento: string;
  parcelas: number;
  valor_parcela: number | null;
  valor_entrada: number | null;
  valor_total: number;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_nome_2: string | null;
  email: string | null;
  cpf: string | null;
  created_at: string;
};

export default function AdminVendasFormacao() {
  const { toast } = useToast();

  const [produtoId, setProdutoId] = useState('fpi_fpo');
  const [opcaoId, setOpcaoId] = useState('avista'); // 'avista' | '12x' | 'sinal_boleto'

  // Cliente (pessoa 1)
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  // Casal (pessoa 2)
  const [nome2, setNome2] = useState('');
  const [telefone2, setTelefone2] = useState('');
  const [email2, setEmail2] = useState('');
  const [cpf2, setCpf2] = useState('');
  const [obs, setObs] = useState('');

  // Sinal + boleto
  const [totalSinal, setTotalSinal] = useState('');
  const [entrada, setEntrada] = useState('');
  const [nBoletos, setNBoletos] = useState('1');

  const [salvando, setSalvando] = useState(false);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);

  const produto = PRODUTOS.find((p) => p.id === produtoId)!;
  const opcaoCatalogo = produto.opcoes.find((o) => o.id === opcaoId);
  const ehSinal = opcaoId === SINAL;

  // Troca de produto: volta pra 1ª opção e sugere o valor à vista no modo sinal.
  useEffect(() => {
    setOpcaoId(produto.opcoes[0].id);
  }, [produtoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao entrar no modo sinal, pré-preenche o total com o preço à vista do produto.
  useEffect(() => {
    if (ehSinal && !totalSinal) {
      const avista = produto.opcoes.find((o) => o.id === 'avista');
      if (avista) setTotalSinal(String(avista.total));
    }
  }, [ehSinal]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSinalN = num(totalSinal);
  const entradaN = num(entrada);
  const nBoletosN = Math.max(1, parseInt(nBoletos || '1', 10) || 1);
  const restante = Math.max(0, totalSinalN - entradaN);
  const valorBoleto = restante / nBoletosN;

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

  const limpar = () => {
    setNome(''); setTelefone(''); setEmail(''); setCpf(''); setEndereco('');
    setNome2(''); setTelefone2(''); setEmail2(''); setCpf2('');
    setObs(''); setTotalSinal(''); setEntrada(''); setNBoletos('1');
  };

  const registrar = async () => {
    if (!nome.trim()) { toast({ title: 'Informe o nome do cliente', variant: 'destructive' }); return; }
    if (produto.casal && !nome2.trim()) { toast({ title: 'No casal, informe as duas pessoas', variant: 'destructive' }); return; }
    if (ehSinal) {
      if (totalSinalN <= 0) { toast({ title: 'Informe o valor total', variant: 'destructive' }); return; }
      if (entradaN <= 0 || entradaN >= totalSinalN) { toast({ title: 'O sinal deve ser maior que zero e menor que o total', variant: 'destructive' }); return; }
    }

    const payload = ehSinal
      ? { forma_pagamento: SINAL, parcelas: nBoletosN, valor_parcela: valorBoleto, valor_entrada: entradaN, valor_total: totalSinalN }
      : { forma_pagamento: opcaoCatalogo!.id, parcelas: opcaoCatalogo!.parcelas, valor_parcela: opcaoCatalogo!.parcela ?? null, valor_entrada: null, valor_total: opcaoCatalogo!.total };

    setSalvando(true);
    const { error } = await (supabase as any).from('vendas_formacao').insert({
      produto: produto.id,
      produto_nome: produto.nome,
      ...payload,
      cliente_nome: nome.trim(),
      cliente_telefone: telefone.trim() || null,
      email: email.trim() || null,
      cpf: cpf.trim() || null,
      endereco: endereco.trim() || null,
      cliente_nome_2: produto.casal ? nome2.trim() : null,
      cliente_telefone_2: produto.casal ? telefone2.trim() || null : null,
      email_2: produto.casal ? email2.trim() || null : null,
      cpf_2: produto.casal ? cpf2.trim() || null : null,
      observacao: obs.trim() || null,
    });
    setSalvando(false);
    if (error) { toast({ title: 'Não deu pra registrar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Venda registrada', description: `${produto.nome} — ${brl(payload.valor_total)}` });
    limpar();
    carregar();
  };

  const totais = useMemo(() => ({
    qtd: vendas.length,
    soma: vendas.reduce((s, v) => s + Number(v.valor_total || 0), 0),
  }), [vendas]);

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">IAS Instituto</p>
        <h1 className="text-2xl font-display font-bold text-foreground">Vendas — Formações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre a venda de FPI, FPO e FPI+FPO com os dados do cliente e a forma de pagamento.
        </p>
      </div>

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
                <button key={p.id} onClick={() => setProdutoId(p.id)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${produtoId === p.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>
                  <span className="flex items-center gap-2">{p.casal && <Users className="w-4 h-4" />}{p.nome}</span>
                  {produtoId === p.id && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <div className="flex flex-wrap gap-2">
              {produto.opcoes.map((o) => (
                <button key={o.id} onClick={() => setOpcaoId(o.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${opcaoId === o.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>
                  {o.label}
                </button>
              ))}
              <button onClick={() => setOpcaoId(SINAL)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${ehSinal ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>
                Sinal + boleto
              </button>
            </div>

            {ehSinal ? (
              <div className="space-y-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor total</Label>
                    <Input value={totalSinal} onChange={(e) => setTotalSinal(e.target.value)} placeholder="7140" inputMode="decimal" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sinal (entrada)</Label>
                    <Input value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder="2000" inputMode="decimal" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nº de boletos</Label>
                    <Input value={nBoletos} onChange={(e) => setNBoletos(e.target.value)} placeholder="6" inputMode="numeric" />
                  </div>
                </div>
                <p className="text-sm text-foreground">
                  Restante <strong>{brl(restante)}</strong> em {nBoletosN}x de <strong>{brl(valorBoleto)}</strong> no boleto.
                  <span className="text-muted-foreground"> Total {brl(totalSinalN)}.</span>
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">Valor total: </span>
                <span className="text-lg font-bold text-foreground">{brl(opcaoCatalogo?.total || 0)}</span>
                {opcaoCatalogo?.parcela && <span className="text-sm text-muted-foreground"> · {opcaoCatalogo.parcelas}x de {brl(opcaoCatalogo.parcela)}</span>}
              </div>
            )}
          </div>

          {/* Dados do cliente */}
          <div className="space-y-3">
            <Label>{produto.casal ? 'Pessoa 1' : 'Dados do cliente'}</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone / WhatsApp" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" />
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="CPF" inputMode="numeric" />
            </div>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço (rua, número, cidade, CEP)" />
          </div>

          {produto.casal && (
            <div className="space-y-3">
              <Label>Pessoa 2</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={nome2} onChange={(e) => setNome2(e.target.value)} placeholder="Nome completo" />
                <Input value={telefone2} onChange={(e) => setTelefone2(e.target.value)} placeholder="Telefone / WhatsApp" />
                <Input value={email2} onChange={(e) => setEmail2(e.target.value)} placeholder="E-mail" type="email" />
                <Input value={cpf2} onChange={(e) => setCpf2(e.target.value)} placeholder="CPF" inputMode="numeric" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Textarea id="obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: sinal no PIX, boletos mensais; turma de agosto…" />
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
            <div className="rounded-xl border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">Nenhuma venda registrada ainda.</div>
          ) : (
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {vendas.map((v) => (
                <div key={v.id} className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{v.cliente_nome}{v.cliente_nome_2 ? ` e ${v.cliente_nome_2}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{v.produto_nome}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{brl(Number(v.valor_total))}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {v.forma_pagamento === 'avista' ? 'À vista'
                          : v.forma_pagamento === SINAL ? `Sinal ${brl(Number(v.valor_entrada || 0))} + ${v.parcelas}x boleto`
                          : `${v.parcelas}x`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                    {v.cliente_telefone && <p>{v.cliente_telefone}{v.email ? ` · ${v.email}` : ''}</p>}
                    {!v.cliente_telefone && v.email && <p>{v.email}</p>}
                    {v.cpf && <p>CPF {v.cpf}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
