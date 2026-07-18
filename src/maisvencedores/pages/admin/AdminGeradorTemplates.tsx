import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Copy, FileDown, RotateCcw } from 'lucide-react';

/**
 * Gerador de templates do Instituto (e-mail, comunicado, certificado, post) com IA.
 *
 * Chama a função serverless da Netlify /.netlify/functions/gerar-template, que roda o Claude no
 * servidor (a chave da Anthropic fica na env da Netlify, nunca no navegador). Fica na Netlify
 * porque o Supabase está no teto de 100 edge functions.
 *
 * O "Baixar PDF" abre o HTML numa janela e chama a impressão do navegador — a pessoa escolhe
 * "Salvar como PDF". Simples e com texto nítido, sem biblioteca de PDF.
 */

const TIPOS = [
  { id: 'email', label: 'E-mail' },
  { id: 'comunicado', label: 'Comunicado' },
  { id: 'certificado', label: 'Certificado' },
  { id: 'post', label: 'Post / imagem' },
];

type Resultado = { subject: string; preheader: string; html_content: string };

export default function AdminGeradorTemplates() {
  const { toast } = useToast();
  const [tipo, setTipo] = useState('email');
  const [prompt, setPrompt] = useState('');
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  const gerar = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Descreva o que você quer gerar', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch('/.netlify/functions/gerar-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, prompt, extra_context: extra }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || 'Falha ao gerar');
      setRes({ subject: data.subject, preheader: data.preheader, html_content: data.html_content });
    } catch (e) {
      toast({ title: 'Não deu pra gerar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copiarHtml = async () => {
    if (!res) return;
    await navigator.clipboard.writeText(res.html_content);
    toast({ title: 'HTML copiado' });
  };

  const baixarPdf = () => {
    if (!res) return;
    const w = window.open('', '_blank');
    if (!w) {
      toast({ title: 'Libere o pop-up pra baixar o PDF', variant: 'destructive' });
      return;
    }
    w.document.write(res.html_content);
    w.document.close();
    w.focus();
    // Espera o layout assentar antes de abrir a impressão.
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">IAS Instituto</p>
        <h1 className="text-2xl font-display font-bold text-foreground">Gerador de Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Descreva o que precisa e a IA monta a peça com a marca da comunidade. Depois é só copiar o
          HTML ou baixar em PDF.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulário */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Tipo de peça</Label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTipo(t.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    tipo === t.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">O que você quer comunicar?</Label>
            <Textarea
              id="prompt"
              rows={5}
              placeholder="Ex.: e-mail de boas-vindas para quem acabou de entrar na comunidade, convidando a completar o perfil e entrar no grupo do WhatsApp."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="extra">Detalhes a respeitar (opcional)</Label>
            <Input
              id="extra"
              placeholder="Link, data, nome de um treinamento, tom específico…"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={gerar} disabled={loading} variant="gold">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando…</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" /> Gerar</>
              )}
            </Button>
            {res && (
              <Button variant="outline" onClick={gerar} disabled={loading}>
                <RotateCcw className="w-4 h-4 mr-2" /> Gerar de novo
              </Button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          {res ? (
            <>
              <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                <p className="text-xs text-muted-foreground">Assunto</p>
                <p className="text-sm font-medium text-foreground">{res.subject}</p>
                {res.preheader && <p className="text-xs text-muted-foreground mt-1">{res.preheader}</p>}
              </div>
              <div className="overflow-hidden rounded-xl border border-border/50 bg-white">
                <iframe
                  title="Prévia do template"
                  srcDoc={res.html_content}
                  className="h-[520px] w-full"
                  sandbox=""
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copiarHtml}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar HTML
                </Button>
                <Button variant="outline" onClick={baixarPdf}>
                  <FileDown className="w-4 h-4 mr-2" /> Baixar PDF
                </Button>
              </div>
            </>
          ) : (
            <div className="flex h-[520px] items-center justify-center rounded-xl border border-dashed border-border/50 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                A prévia da peça aparece aqui depois de gerar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
