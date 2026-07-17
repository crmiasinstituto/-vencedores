import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Check, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Cofre de credenciais das integrações, gerenciado pelo admin.
 *
 * Pedido do Carlos: um lugar no front pra alimentar as chaves (Resend, LiveKit, IA...) sem
 * depender de mim nem do painel do Supabase.
 *
 * SEGURANÇA — o valor guardado NUNCA volta pra cá. A tela só sabe se cada chave está
 * "configurada" (via credenciais_status, que devolve booleano) e permite gravar uma nova por
 * cima. O segredo não trafega pro navegador de ninguém. Ver a migration do cofre.
 */

type Slot = {
  slug: string;
  nome: string;
  descricao: string;
  grupo: string;
};

// As integrações que o ecossistema usa. Data-driven: acrescentar aqui é uma linha.
const SLOTS: Slot[] = [
  { slug: 'resend_api_key', nome: 'Resend — API Key', grupo: 'E-mail',
    descricao: 'Chave do Resend para o admin disparar comunicados por e-mail. Também exige o SPF do domínio apontando pro Resend.' },
  { slug: 'livekit_api_key', nome: 'LiveKit — API Key', grupo: 'Salas / Meet',
    descricao: 'Chave pública do LiveKit para as salas de reunião e gravação de aula.' },
  { slug: 'livekit_api_secret', nome: 'LiveKit — API Secret', grupo: 'Salas / Meet',
    descricao: 'Segredo do LiveKit. Par com a API Key.' },
  { slug: 'livekit_url', nome: 'LiveKit — URL (wss)', grupo: 'Salas / Meet',
    descricao: 'Endereço do servidor LiveKit, ex.: wss://seuprojeto.livekit.cloud' },
  { slug: 'anthropic_api_key', nome: 'Anthropic (Claude) — API Key', grupo: 'Inteligência Artificial',
    descricao: 'Chave para os agentes de IA que usam Claude.' },
  { slug: 'gemini_api_key', nome: 'Google Gemini — API Key', grupo: 'Inteligência Artificial',
    descricao: 'Chave para as análises que usam Gemini.' },
  { slug: 'whatsapp_cloud_token', nome: 'WhatsApp Cloud — Token', grupo: 'WhatsApp',
    descricao: 'Token da API Cloud do WhatsApp (Meta) para envio e recebimento.' },
];

type Status = Record<string, { configurada: boolean; atualizado_em: string | null }>;

export default function AdminCredenciais() {
  const [status, setStatus] = useState<Status>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarStatus = async () => {
    const { data, error } = await supabase.rpc('credenciais_status');
    if (!error && data) {
      const s: Status = {};
      for (const row of data as { slug: string; configurada: boolean; atualizado_em: string }[]) {
        s[row.slug] = { configurada: row.configurada, atualizado_em: row.atualizado_em };
      }
      setStatus(s);
    }
    setCarregando(false);
  };

  useEffect(() => {
    carregarStatus();
  }, []);

  const salvar = async (slug: string) => {
    const valor = valores[slug] ?? '';
    if (!valor.trim()) {
      toast.error('Cole a chave antes de salvar.');
      return;
    }
    setSalvando(slug);
    const { error } = await supabase.rpc('salvar_credencial', { p_slug: slug, p_valor: valor.trim() });
    setSalvando(null);
    if (error) {
      toast.error('Não foi possível salvar: ' + error.message);
      return;
    }
    toast.success('Chave salva.');
    // Limpa o campo (o valor não deve ficar na memória da tela) e recarrega o status.
    setValores((v) => ({ ...v, [slug]: '' }));
    carregarStatus();
  };

  const grupos = Array.from(new Set(SLOTS.map((s) => s.grupo)));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-7 h-7 text-primary" />
          Credenciais e integrações
        </h1>
        <p className="text-muted-foreground mt-1">
          As chaves das integrações do ecossistema. São guardadas de forma segura — a chave que
          você digita não volta pra esta tela depois de salva.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <span>
          Só administradores veem e alteram esta página. O valor de cada chave nunca é exibido —
          para trocar, basta colar a nova por cima.
        </span>
      </div>

      {carregando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        grupos.map((grupo) => (
          <Card key={grupo}>
            <CardHeader>
              <CardTitle className="text-lg">{grupo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {SLOTS.filter((s) => s.grupo === grupo).map((slot) => {
                const st = status[slot.slug];
                return (
                  <div key={slot.slug} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor={slot.slug} className="text-sm font-medium text-foreground">
                        {slot.nome}
                      </label>
                      {st?.configurada ? (
                        <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1">
                          <Check className="w-3 h-3" /> Configurada
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Não configurada</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{slot.descricao}</p>
                    <div className="flex gap-2">
                      <Input
                        id={slot.slug}
                        type="password"
                        autoComplete="new-password"
                        placeholder={st?.configurada ? 'Cole uma nova chave para substituir' : 'Cole a chave aqui'}
                        value={valores[slot.slug] ?? ''}
                        onChange={(e) => setValores((v) => ({ ...v, [slot.slug]: e.target.value }))}
                      />
                      <Button onClick={() => salvar(slot.slug)} disabled={salvando === slot.slug}>
                        {salvando === slot.slug ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
