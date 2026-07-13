import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, Loader2, Copy, Download, CalendarHeart } from 'lucide-react';

type Form = Record<string, string>;

const EMPTY: Form = {
  nome_evento: '', promessa: '', publico_alvo: '', dor_central: '',
  frequencia_semestre: '', carga_horaria: '', formato: 'presencial',
  local: '', data: '', checkin: '', inicio: '', termino: '',
  precificacao_modelo: 'gratuito', valor: '', n_criativos: '', orcamento_divulgacao: '',
  oferta: '',
  missao: '', instituto_nome: '', curriculo: '', qtd_clientes: '', tempo_mercado: '',
  papeis: '', historia: '', provas_sociais: '', quebra_objecoes: '',
};

// Campo estavel (fora do componente-pai) pra nao perder foco a cada tecla.
function Field({ label, value, onChange, ph, area }: {
  label: string; value: string; onChange: (e: any) => void; ph?: string; area?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {area
        ? <Textarea value={value} onChange={onChange} placeholder={ph} rows={3} />
        : <Input value={value} onChange={onChange} placeholder={ph} />}
    </div>
  );
}

// Render markdown leve (sem dependencia): titulos, negrito, listas, paragrafos.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: JSX.Element[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(<ul key={`ul${out.length}`} className="list-disc pl-6 space-y-1 my-2">{list.map((li, i) => <li key={i}>{renderInline(li)}</li>)}</ul>);
      list = [];
    }
  };
  lines.forEach((raw) => {
    const l = raw.trimEnd();
    if (/^###\s+/.test(l)) { flush(); out.push(<h3 key={out.length} className="text-base font-semibold mt-4 mb-1">{renderInline(l.replace(/^###\s+/, ''))}</h3>); }
    else if (/^##\s+/.test(l)) { flush(); out.push(<h2 key={out.length} className="text-lg font-bold mt-5 mb-1 text-primary">{renderInline(l.replace(/^##\s+/, ''))}</h2>); }
    else if (/^#\s+/.test(l)) { flush(); out.push(<h1 key={out.length} className="text-xl font-bold mt-2 mb-2">{renderInline(l.replace(/^#\s+/, ''))}</h1>); }
    else if (/^[-*]\s+/.test(l)) { list.push(l.replace(/^[-*]\s+/, '')); }
    else if (l.trim() === '') { flush(); }
    else { flush(); out.push(<p key={out.length} className="my-1 leading-relaxed">{renderInline(l)}</p>); }
  });
  flush();
  return <div className="text-sm text-foreground">{out}</div>;
}

export default function EstruturarEvento() {
  const [f, setF] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<{ titulo: string; markdown: string } | null>(null);
  const set = (k: string) => (e: any) => setF((s) => ({ ...s, [k]: e.target.value }));

  const gerar = async () => {
    if (!f.nome_evento.trim() || !f.dor_central.trim()) {
      toast.error('Preencha ao menos o nome do evento e a dor central da audiencia.');
      return;
    }
    setLoading(true);
    setDoc(null);
    try {
      const { data, error } = await supabase.functions.invoke('event-architect', { body: f });
      if (error || !data?.success) {
        const msg = data?.error === 'sem_credito'
          ? 'Sem credito na Anthropic. Recarregue para gerar o documento.'
          : (error?.message ?? data?.error ?? 'desconhecido');
        toast.error('Erro ao gerar: ' + msg);
        return;
      }
      setDoc({ titulo: data.titulo, markdown: data.markdown });
      toast.success('Estrutura do evento gerada!');
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const copiar = () => { if (doc) { navigator.clipboard.writeText(doc.markdown); toast.success('Documento copiado!'); } };
  const baixar = () => {
    if (!doc) return;
    const blob = new Blob([doc.markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(f.nome_evento || 'evento').replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <CalendarHeart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Como estruturar um evento</h1>
          <p className="text-sm text-muted-foreground">Especialista em Eventos ISCA + PNL: colete os dados e gere a estrutura completa em 3 blocos narrativos.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. O Evento</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <Field label="Nome do evento *" value={f.nome_evento} onChange={set('nome_evento')} ph="Ex: Imersao IA na Pratica" />
          <Field label="Promessa de entrega *" value={f.promessa} onChange={set('promessa')} ph="O que a pessoa sai sabendo/tendo" />
          <Field label="Publico-alvo" value={f.publico_alvo} onChange={set('publico_alvo')} ph="Quem e a audiencia" />
          <Field label="Dor / desejo central *" value={f.dor_central} onChange={set('dor_central')} ph="A dor principal que o evento resolve" area />
          <Field label="Frequencia no semestre" value={f.frequencia_semestre} onChange={set('frequencia_semestre')} ph="Quantos eventos ISCA no semestre" />
          <Field label="Carga horaria" value={f.carga_horaria} onChange={set('carga_horaria')} ph="Ex: 4 horas" />
          <div className="space-y-1">
            <Label className="text-xs">Formato</Label>
            <select value={f.formato} onChange={set('formato')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
              <option value="hibrido">Hibrido</option>
            </select>
          </div>
          <Field label="Local" value={f.local} onChange={set('local')} ph="Endereco ou plataforma" />
          <Field label="Data" value={f.data} onChange={set('data')} ph="Ex: 15/08/2026" />
          <Field label="Horario de check-in" value={f.checkin} onChange={set('checkin')} ph="Ex: 18h30" />
          <Field label="Inicio" value={f.inicio} onChange={set('inicio')} ph="Ex: 19h" />
          <Field label="Termino" value={f.termino} onChange={set('termino')} ph="Ex: 23h" />
          <div className="space-y-1">
            <Label className="text-xs">Precificacao</Label>
            <select value={f.precificacao_modelo} onChange={set('precificacao_modelo')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="gratuito">Gratuito</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <Field label="Valor (se pago)" value={f.valor} onChange={set('valor')} ph="Ex: R$ 97" />
          <Field label="Qtd de criativos de anuncio" value={f.n_criativos} onChange={set('n_criativos')} ph="Ex: 6" />
          <Field label="Orcamento de divulgacao" value={f.orcamento_divulgacao} onChange={set('orcamento_divulgacao')} ph="Ex: R$ 3.000" />
          <div className="md:col-span-2">
            <Field label="Oferta ancorada no fim" value={f.oferta} onChange={set('oferta')} ph="O que voce vende no final e por quanto" area />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. Sua Autoridade</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <Field label="Sua missao" value={f.missao} onChange={set('missao')} ph="A transformacao que voce gera no mundo" area />
          <Field label="Instituto proprio (nome, se houver)" value={f.instituto_nome} onChange={set('instituto_nome')} ph="Nome do instituto ou deixe vazio" />
          <Field label="Curriculo resumido" value={f.curriculo} onChange={set('curriculo')} ph="Formacao, feitos, reconhecimentos" area />
          <Field label="Quantidade de clientes" value={f.qtd_clientes} onChange={set('qtd_clientes')} ph="Ex: +500 clientes" />
          <Field label="Tempo de mercado" value={f.tempo_mercado} onChange={set('tempo_mercado')} ph="Ex: 8 anos" />
          <Field label="Escritor / palestrante / treinador?" value={f.papeis} onChange={set('papeis')} ph="Marque o que se aplica" />
          <div className="md:col-span-2">
            <Field label="Sua historia (ligada a transformacao que gera)" value={f.historia} onChange={set('historia')} ph="Resuma a virada que te trouxe ate aqui" area />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3. Provas e Objecoes</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Provas sociais" value={f.provas_sociais} onChange={set('provas_sociais')} ph="Depoimentos, resultados, cases (um por linha)" area />
          <Field label="Objecoes comuns a quebrar" value={f.quebra_objecoes} onChange={set('quebra_objecoes')} ph="As desculpas/medos que travam a compra (um por linha)" area />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={gerar} disabled={loading} size="lg">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando estrutura...</> : <><Sparkles className="h-4 w-4 mr-2" />Gerar estrutura do evento</>}
        </Button>
      </div>

      {doc && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{doc.titulo}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copiar}><Copy className="h-4 w-4 mr-1" />Copiar</Button>
              <Button variant="outline" size="sm" onClick={baixar}><Download className="h-4 w-4 mr-1" />Baixar .md</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Markdown text={doc.markdown} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
