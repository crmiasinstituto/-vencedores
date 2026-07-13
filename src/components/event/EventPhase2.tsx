import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EventPhase2Props {
  data: {
    transformation: {
      target: string;
      goal: string;
      without: string;
    };
    differential: {
      whatWontHave: string;
      uniqueDelivery: string;
      uniqueExperience: string;
    };
  };
  onChange: (data: EventPhase2Props['data']) => void;
}

export function EventPhase2({ data, onChange }: EventPhase2Props) {
  return (
    <div className="space-y-8">
      {/* Seção 5: Transformação Prometida */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🧠 TRANSFORMAÇÃO PROMETIDA
        </h3>
        <p className="text-muted-foreground mb-6">Complete a frase em grupo:</p>

        <div className="bg-background/30 rounded-xl p-6 border border-primary/20">
          <p className="text-lg text-foreground mb-4 font-medium">
            "Esse evento é para pessoas que..."
          </p>

          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">
                ... que <span className="text-primary">(situação atual)</span>
              </Label>
              <Input
                value={data.transformation.target}
                onChange={(e) => onChange({
                  ...data,
                  transformation: { ...data.transformation, target: e.target.value }
                })}
                placeholder="Ex: trabalham em emprego CLT mas sentem que merecem mais"
                className="mt-2 bg-background/50 border-border/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Outros exemplos: "já faturam bem mas se sentem presos" | "querem sair do zero" | "buscam uma segunda fonte de renda"
              </p>
            </div>

            <div>
              <Label className="text-muted-foreground">
                e querem <span className="text-primary">(resultado desejado)</span>
              </Label>
              <Input
                value={data.transformation.goal}
                onChange={(e) => onChange({
                  ...data,
                  transformation: { ...data.transformation, goal: e.target.value }
                })}
                placeholder="Ex: liberdade financeira e de tempo"
                className="mt-2 bg-background/50 border-border/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Outros exemplos: "escalar com inteligência" | "renda passiva" | "sair do emprego em 12 meses"
              </p>
            </div>

            <div>
              <Label className="text-muted-foreground">
                sem <span className="text-primary">(o que quer evitar)</span>
              </Label>
              <Input
                value={data.transformation.without}
                onChange={(e) => onChange({
                  ...data,
                  transformation: { ...data.transformation, without: e.target.value }
                })}
                placeholder="Ex: arriscar tudo ou abandonar a segurança atual"
                className="mt-2 bg-background/50 border-border/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Outros exemplos: "achismo" | "ficar refém de fórmulas prontas" | "perder tempo com o que não funciona"
              </p>
            </div>
          </div>

          {/* Preview da frase */}
          {(data.transformation.target || data.transformation.goal || data.transformation.without) && (
            <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm text-muted-foreground mb-1">Preview:</p>
              <p className="text-foreground font-medium italic">
                "Esse evento é para pessoas que {data.transformation.target || '___'} 
                {' '}e querem {data.transformation.goal || '___'} 
                {' '}sem {data.transformation.without || '___'}."
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Seção 6: Por que esse evento é diferente */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🏆 POR QUE ESSE EVENTO É DIFERENTE?
        </h3>
        <p className="text-muted-foreground mb-6">Respondam com brutal honestidade:</p>

        <div className="space-y-6">
          <div>
            <Label className="text-foreground font-medium">
              O que NÃO vai ter?
            </Label>
            <Textarea
              value={data.differential.whatWontHave}
              onChange={(e) => onChange({
                ...data,
                differential: { ...data.differential, whatWontHave: e.target.value }
              })}
              placeholder="Ex: Promessas de enriquecimento fácil, teoria sem prática, fórmulas mágicas, curso gravado requentado..."
              className="mt-2 bg-background/50 border-border/50"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-foreground font-medium">
              O que só vocês podem entregar?
            </Label>
            <Textarea
              value={data.differential.uniqueDelivery}
              onChange={(e) => onChange({
                ...data,
                differential: { ...data.differential, uniqueDelivery: e.target.value }
              })}
              placeholder="Ex: Método testado por X pessoas, acesso direto aos mentores, comunidade ativa, suporte contínuo..."
              className="mt-2 bg-background/50 border-border/50"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-foreground font-medium">
              Qual experiência ninguém mais está oferecendo?
            </Label>
            <Textarea
              value={data.differential.uniqueExperience}
              onChange={(e) => onChange({
                ...data,
                differential: { ...data.differential, uniqueExperience: e.target.value }
              })}
              placeholder="Ex: Imersão prática com resultados no mesmo dia, networking qualificado, mentoria personalizada..."
              className="mt-2 bg-background/50 border-border/50"
              rows={3}
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
          <p className="text-sm text-destructive font-medium">
            📌 Regra: Se isso servir para QUALQUER evento, está fraco. Seja específico!
          </p>
        </div>
      </motion.div>
    </div>
  );
}
