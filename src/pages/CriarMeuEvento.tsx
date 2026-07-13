import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateEventPDF } from '@/utils/eventPdf';
import { toast } from 'sonner';

type Dict = Record<string, string>;

const GOLD = '#3B82F6';

// input estavel (fora do componente) pra nao perder foco
function Field({ label, value, onChange, ph, area, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; ph?: string; area?: boolean; type?: string;
}) {
  const cls = 'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#3B82F6] focus:outline-none transition';
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/70">{label}</label>
      {area
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} rows={3} className={cls} />
        : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} className={cls} />}
    </div>
  );
}

export default function CriarMeuEvento() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [lead, setLead] = useState<Dict>({ nome: '', whatsapp: '', instagram: '', email: '', cpf: '' });
  const [consent, setConsent] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [ev, setEv] = useState<Dict>({
    nome_evento: '', promessa: '', publico_alvo: '', dor_central: '', formato: 'presencial',
    frequencia_semestre: '', carga_horaria: '', local: '', data: '', precificacao_modelo: 'gratuito',
    valor: '', n_criativos: '', orcamento_divulgacao: '', oferta: '',
    missao: '', instituto_nome: '', curriculo: '', qtd_clientes: '', tempo_mercado: '', papeis: '', historia: '',
    provas_sociais: '', quebra_objecoes: '',
  });
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<{ titulo: string; markdown: string; ig?: any } | null>(null);

  const sl = (k: string) => (v: string) => setLead((s) => ({ ...s, [k]: v }));
  const se = (k: string) => (v: string) => setEv((s) => ({ ...s, [k]: v }));

  const capturar = async () => {
    if (!lead.nome.trim() || (!lead.whatsapp.trim() && !lead.email.trim())) {
      toast.error('Preencha ao menos nome e WhatsApp (ou email).'); return;
    }
    if (!consent) { toast.error('Marque o consentimento de uso dos dados.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('event-architect', { body: { action: 'capturar', ...lead } });
      if (error || !data?.success) { toast.error('Erro ao registrar: ' + (error?.message ?? data?.error ?? '')); return; }
      setLeadId(data.lead_id);
      setStep(2);
    } catch (e: any) { toast.error('Erro: ' + (e?.message ?? e)); }
    finally { setLoading(false); }
  };

  const gerar = async () => {
    if (!ev.nome_evento.trim() || !ev.dor_central.trim()) {
      toast.error('Preencha o nome do evento e a dor central.'); return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('event-architect', { body: { action: 'gerar', lead_id: leadId, instagram: lead.instagram, ...ev } });
      if (error || !data?.success) {
        const msg = data?.error === 'sem_credito' ? 'A IA esta temporariamente indisponivel. Tente em instantes.' : (error?.message ?? data?.error ?? '');
        toast.error('Erro ao gerar: ' + msg); return;
      }
      setDoc({ titulo: data.titulo, markdown: data.markdown, ig: data.ig });
      setStep(3);
    } catch (e: any) { toast.error('Erro: ' + (e?.message ?? e)); }
    finally { setLoading(false); }
  };

  const baixar = async () => {
    if (!doc) return;
    try { await generateEventPDF(ev.nome_evento || 'Meu Evento', doc.markdown, doc.ig); }
    catch (e: any) { toast.error('Erro ao gerar PDF: ' + (e?.message ?? e)); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      <div className="max-w-3xl mx-auto px-5 py-10 md:py-16">
        {/* header */}
        <div className="mb-8">
          <div className="text-xs font-bold tracking-[4px] uppercase" style={{ color: GOLD }}>Metodo + que Vencedores</div>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-2 leading-tight">
            Estruture seu evento <span style={{ color: GOLD }}>que vende</span>
          </h1>
          <p className="text-white/60 mt-2 text-sm md:text-base">
            Responda algumas perguntas e receba um documento estrategico completo do seu evento, no metodo dos eventos ISCA, pronto pra baixar em PDF.
          </p>
        </div>

        {/* stepper */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex-1 h-1 rounded-full" style={{ background: step >= n ? GOLD : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        {/* STEP 1 - captura */}
        {step === 1 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
            <h2 className="text-lg font-bold">Primeiro, quem e voce?</h2>
            <p className="text-white/50 text-sm -mt-2">Pra gente enviar seu documento e falar com voce.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Nome completo *" value={lead.nome} onChange={sl('nome')} ph="Seu nome" />
              <Field label="WhatsApp *" value={lead.whatsapp} onChange={sl('whatsapp')} ph="(00) 00000-0000" />
              <Field label="Instagram" value={lead.instagram} onChange={sl('instagram')} ph="@seuperfil" />
              <Field label="Email" value={lead.email} onChange={sl('email')} ph="voce@email.com" type="email" />
              <Field label="CPF" value={lead.cpf} onChange={sl('cpf')} ph="000.000.000-00" />
            </div>
            <label className="flex items-start gap-2 text-xs text-white/50 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#3B82F6]" />
              <span>Autorizo o uso dos meus dados para contato e envio de conteudos do Metodo + que Vencedores, conforme a LGPD.</span>
            </label>
            <button onClick={capturar} disabled={loading}
              className="w-full py-3 rounded-lg font-bold text-black transition disabled:opacity-60"
              style={{ background: GOLD }}>
              {loading ? 'Registrando...' : 'Comecar a estruturar'}
            </button>
          </div>
        )}

        {/* STEP 2 - perguntas */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
              <h2 className="text-lg font-bold">Sobre o seu evento</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Nome do evento *" value={ev.nome_evento} onChange={se('nome_evento')} ph="Ex: Imersao IA na Pratica" />
                <Field label="Promessa (o que a pessoa sai tendo)" value={ev.promessa} onChange={se('promessa')} ph="A grande promessa" />
                <Field label="Publico-alvo" value={ev.publico_alvo} onChange={se('publico_alvo')} ph="Quem voce quer na sala" />
                <Field label="Dor / desejo central *" value={ev.dor_central} onChange={se('dor_central')} ph="A dor que o evento resolve" area />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70">Formato</label>
                  <select value={ev.formato} onChange={(e) => se('formato')(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white focus:border-[#3B82F6] focus:outline-none">
                    <option value="presencial">Presencial</option><option value="online">Online</option><option value="hibrido">Hibrido</option>
                  </select>
                </div>
                <Field label="Frequencia no semestre" value={ev.frequencia_semestre} onChange={se('frequencia_semestre')} ph="Ex: 2 eventos" />
                <Field label="Carga horaria" value={ev.carga_horaria} onChange={se('carga_horaria')} ph="Ex: 4 horas" />
                <Field label="Local" value={ev.local} onChange={se('local')} ph="Cidade / plataforma" />
                <Field label="Data" value={ev.data} onChange={se('data')} ph="Ex: 15/08" />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70">Precificacao</label>
                  <select value={ev.precificacao_modelo} onChange={(e) => se('precificacao_modelo')(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white focus:border-[#3B82F6] focus:outline-none">
                    <option value="gratuito">Gratuito</option><option value="pago">Pago</option>
                  </select>
                </div>
                <Field label="Valor (se pago)" value={ev.valor} onChange={se('valor')} ph="Ex: R$ 97" />
                <Field label="Qtd de criativos de anuncio" value={ev.n_criativos} onChange={se('n_criativos')} ph="Ex: 6" />
                <Field label="Orcamento de divulgacao" value={ev.orcamento_divulgacao} onChange={se('orcamento_divulgacao')} ph="Ex: R$ 3.000" />
                <div className="md:col-span-2">
                  <Field label="Oferta ancorada no fim" value={ev.oferta} onChange={se('oferta')} ph="O que voce vende no final e por quanto" area />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
              <h2 className="text-lg font-bold">Sua autoridade e provas</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Sua missao" value={ev.missao} onChange={se('missao')} ph="A transformacao que voce gera" area />
                <Field label="Instituto proprio (se houver)" value={ev.instituto_nome} onChange={se('instituto_nome')} ph="Nome do instituto" />
                <Field label="Curriculo resumido" value={ev.curriculo} onChange={se('curriculo')} ph="Formacao, feitos" area />
                <Field label="Quantidade de clientes" value={ev.qtd_clientes} onChange={se('qtd_clientes')} ph="Ex: +500" />
                <Field label="Tempo de mercado" value={ev.tempo_mercado} onChange={se('tempo_mercado')} ph="Ex: 8 anos" />
                <Field label="Escritor / palestrante / treinador?" value={ev.papeis} onChange={se('papeis')} ph="O que se aplica" />
                <div className="md:col-span-2">
                  <Field label="Sua historia (ligada a transformacao)" value={ev.historia} onChange={se('historia')} ph="A virada que te trouxe ate aqui" area />
                </div>
                <Field label="Provas sociais" value={ev.provas_sociais} onChange={se('provas_sociais')} ph="Depoimentos, resultados (um por linha)" area />
                <Field label="Objecoes comuns a quebrar" value={ev.quebra_objecoes} onChange={se('quebra_objecoes')} ph="As desculpas que travam a compra" area />
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border p-6 text-center" style={{ borderColor: 'rgba(250,200,0,0.3)' }}>
                <div className="animate-pulse font-bold" style={{ color: GOLD }}>Montando seu projeto estrategico...</div>
                <p className="text-white/50 text-sm mt-1">Nosso especialista em eventos ISCA esta escrevendo sua estrutura completa. Isso leva de 1 a 2 minutos, nao feche a pagina.</p>
              </div>
            ) : (
              <button onClick={gerar} className="w-full py-3.5 rounded-lg font-bold text-black" style={{ background: GOLD }}>
                Gerar minha estrutura de evento
              </button>
            )}
          </div>
        )}

        {/* STEP 3 - resultado */}
        {step === 3 && doc && (
          <div className="rounded-2xl border p-8 text-center space-y-5" style={{ borderColor: 'rgba(250,200,0,0.3)', background: 'rgba(250,200,0,0.04)' }}>
            <div className="text-5xl">🎯</div>
            <h2 className="text-2xl font-extrabold">Seu projeto de evento esta pronto!</h2>
            <p className="text-white/60 max-w-md mx-auto">
              Montamos a estrutura estrategica completa do <strong style={{ color: GOLD }}>{ev.nome_evento}</strong>, nos 3 blocos que capturam, retem e vendem. Baixe seu PDF e leve pro palco.
            </p>
            <button onClick={baixar} className="px-8 py-3.5 rounded-lg font-bold text-black" style={{ background: GOLD }}>
              Baixar meu PDF
            </button>
            <p className="text-white/30 text-xs">Nossa equipe do Metodo + que Vencedores pode te ajudar a executar esse evento. Em breve entramos em contato.</p>
          </div>
        )}

        <div className="text-center text-white/20 text-xs mt-10">Metodo + que Vencedores, eventos que transformam audiencia em cliente.</div>
      </div>
    </div>
  );
}
