import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, Bot } from 'lucide-react';

const db = supabase as any;

interface Cfg {
  rules: string;
  min_gap_seconds: number;
  reply_max_chars: number;
}

export default function CsAgentSettings() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [carol, setCarol] = useState<{ name: string; model: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: agent }] = await Promise.all([
        db.from('cs_agent_config').select('rules, min_gap_seconds, reply_max_chars').eq('id', 1).maybeSingle(),
        db.from('ai_sales_agents').select('name, model').eq('is_default', true).eq('is_active', true).maybeSingle(),
      ]);
      setCfg(c || null);
      setCarol(agent || null);
      setLoading(false);
    })();
  }, []);

  const set = (patch: Partial<Cfg>) => setCfg((c) => (c ? { ...c, ...patch } : c));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await db
      .from('cs_agent_config')
      .update({
        rules: cfg.rules,
        min_gap_seconds: Number(cfg.min_gap_seconds) || 6,
        reply_max_chars: Number(cfg.reply_max_chars) || 280,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success('CS IA atualizado');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!cfg) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Configuração do CS IA não encontrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#3B82F6]" />
            CS IA do chat ao vivo
          </CardTitle>
          <CardDescription>
            A {carol?.name?.split(' ')[0] || 'Carol'} respondendo no chat da reunião. A voz e o modelo são os mesmos do seu agente SDR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Voz herdada da Carol */}
          <div className="rounded-xl border border-[#3B82F6]/30 bg-[#3B82F6]/5 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#3B82F6]/15 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Voz e modelo herdados de: <span className="font-semibold">{carol?.name || 'Carol (agente padrão)'}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Pra mudar a personalidade ou o modelo, edite o agente em + que Vencedores AI v2. Aqui você ajusta só o comportamento no chat ao vivo.
              </p>
            </div>
            {carol?.model && (
              <Badge variant="outline" className="shrink-0 text-xs">{carol.model.replace('claude-', '').replace('-20251001', '')}</Badge>
            )}
          </div>

          {/* Regras do chat ao vivo (adendo que sobrescreve o comportamento de WhatsApp) */}
          <div className="space-y-2">
            <Label>Regras no chat ao vivo (sobrescreve o comportamento de SDR)</Label>
            <p className="text-xs text-muted-foreground">
              Aqui a Carol não vende nem agenda, só faz rapport. Ajuste o tom e os limites.
            </p>
            <Textarea
              value={cfg.rules}
              onChange={(e) => set({ rules: e.target.value })}
              rows={12}
              className="text-sm font-mono"
            />
          </div>

          {/* Ritmo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Intervalo mínimo entre falas (s)</Label>
              <Input
                type="number"
                value={cfg.min_gap_seconds}
                onChange={(e) => set({ min_gap_seconds: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tamanho máximo da resposta (caracteres)</Label>
              <Input
                type="number"
                value={cfg.reply_max_chars}
                onChange={(e) => set({ reply_max_chars: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
