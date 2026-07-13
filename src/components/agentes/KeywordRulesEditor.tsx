import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Zap, EyeOff, Pause, HandMetal } from 'lucide-react';
import { useState } from 'react';

export interface KeywordRules {
  activation_mode?: 'always' | 'first_message_only' | 'any_inbound';
  activation_keywords?: string[];
  ignore_keywords?: string[];
  pause_keywords?: string[];
  handoff_keywords?: string[];
}

interface Props {
  value: KeywordRules;
  onChange: (next: KeywordRules) => void;
}

function KeywordChips({
  label, hint, icon, color, value, onChange, placeholder,
}: {
  label: string; hint: string; icon: any; color: string;
  value: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [input, setInput] = useState('');
  const Icon = icon;
  const add = () => {
    const v = input.trim().toLowerCase();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setInput('');
  };
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <Label className="text-sm font-semibold">{label}</Label>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="h-8 px-3 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhuma palavra-chave cadastrada</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {value.map(kw => (
            <Badge
              key={kw}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-destructive/20"
              onClick={() => onChange(value.filter(k => k !== kw))}
            >
              {kw}
              <X className="w-3 h-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KeywordRulesEditor({ value, onChange }: Props) {
  const rules: KeywordRules = {
    activation_mode: value?.activation_mode || 'always',
    activation_keywords: value?.activation_keywords || [],
    ignore_keywords: value?.ignore_keywords || [],
    pause_keywords: value?.pause_keywords || [],
    handoff_keywords: value?.handoff_keywords || [],
  };
  const update = (patch: Partial<KeywordRules>) => onChange({ ...rules, ...patch });

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div>
          <p className="text-sm font-semibold">Regras de palavra-chave</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controla quando o agente responde, ignora, pausa ou passa o atendimento pro humano.
            Comparacao e case-insensitive e funciona com a palavra inteira ou a frase.
          </p>
        </div>

        {/* Ativacao */}
        <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <KeywordChips
            label="Palavras que ativam o agente"
            hint="Se preenchido, o agente so responde quando essas palavras aparecem (conforme o modo abaixo). Vazio = responde sempre."
            icon={Zap}
            color="bg-primary/20 text-primary"
            value={rules.activation_keywords || []}
            onChange={(v) => update({ activation_keywords: v })}
            placeholder="Ex: metodo squaad, ai first, quero saber"
          />
          <div>
            <Label className="text-xs">Modo de ativacao</Label>
            <Select value={rules.activation_mode} onValueChange={(v: any) => update({ activation_mode: v })}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Sempre responde (ignora keywords de ativacao)</SelectItem>
                <SelectItem value="first_message_only">So se a PRIMEIRA msg tiver keyword</SelectItem>
                <SelectItem value="any_inbound">TODA mensagem precisa ter keyword</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ignorar */}
        <div className="p-3 bg-muted/30 rounded-lg border border-border">
          <KeywordChips
            label="Ignorar (nao responder)"
            hint="Quando a mensagem for so um 'ok', 'obrigado', 'valeu' — o agente pula e nao gasta LLM. Deixa a conversa respirar."
            icon={EyeOff}
            color="bg-muted text-muted-foreground"
            value={rules.ignore_keywords || []}
            onChange={(v) => update({ ignore_keywords: v })}
            placeholder="Ex: ok, valeu, blz, entendi"
          />
        </div>

        {/* Pausar */}
        <div className="p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
          <KeywordChips
            label="Pausar agente (24h)"
            hint="Lead digita alguma dessas, o agente pausa por 24h. Util pra 'stop', 'para', 'cancela'."
            icon={Pause}
            color="bg-yellow-500/20 text-yellow-500"
            value={rules.pause_keywords || []}
            onChange={(v) => update({ pause_keywords: v })}
            placeholder="Ex: stop, parar, cancelar"
          />
        </div>

        {/* Handoff */}
        <div className="p-3 bg-orange-500/5 rounded-lg border border-orange-500/20">
          <KeywordChips
            label="Passar pra humano (handoff)"
            hint="Lead pede um humano, o agente pausa 24h e te avisa no WhatsApp via notification_rules. Ex: 'quero falar com vendedor'."
            icon={HandMetal}
            color="bg-orange-500/20 text-orange-500"
            value={rules.handoff_keywords || []}
            onChange={(v) => update({ handoff_keywords: v })}
            placeholder="Ex: humano, atendente, falar com alguem"
          />
        </div>
      </CardContent>
    </Card>
  );
}
