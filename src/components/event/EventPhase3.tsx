import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FounderCard } from "./FounderCard";

interface Founder {
  name: string;
  archetype: string;
  expertise: string;
  bio: string;
}

interface EventPhase3Props {
  data: {
    belief: string;
    enemy: string[];
    customEnemy: string;
    language: string[];
    ritual: {
      selected: string[];
      custom: string;
    };
    founders: Founder[];
  };
  onChange: (data: EventPhase3Props['data']) => void;
}

const enemyOptions = [
  "Amadorismo empresarial",
  "Gestão rasa",
  "Achismo",
  "Empreendedor solitário",
  "Falso sucesso"
];

const ritualOptions = [
  "Abertura simbólica",
  "Compromisso público",
  "Documento estratégico entregue",
  "Decisão assinada"
];

const archetypes = [
  "O Visionário",
  "O Estrategista",
  "O Executor",
  "O Guardião do Crescimento"
];

export function EventPhase3({ data, onChange }: EventPhase3Props) {
  const toggleEnemy = (enemy: string) => {
    const newEnemies = data.enemy.includes(enemy)
      ? data.enemy.filter(e => e !== enemy)
      : [...data.enemy, enemy];
    onChange({ ...data, enemy: newEnemies });
  };

  const toggleRitual = (ritual: string) => {
    const newRituals = data.ritual.selected.includes(ritual)
      ? data.ritual.selected.filter(r => r !== ritual)
      : [...data.ritual.selected, ritual];
    onChange({ ...data, ritual: { ...data.ritual, selected: newRituals } });
  };

  const updateLanguage = (index: number, value: string) => {
    const newLanguage = [...data.language];
    newLanguage[index] = value;
    onChange({ ...data, language: newLanguage });
  };

  const updateFounder = (index: number, founder: Founder) => {
    const newFounders = [...data.founders];
    newFounders[index] = founder;
    onChange({ ...data, founders: newFounders });
  };

  return (
    <div className="space-y-8">
      {/* Seção 7: Criação de Crença */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🔥 CRIAÇÃO DE CRENÇA
        </h3>
        <p className="text-muted-foreground mb-4">
          No que esse evento acredita que o mercado ainda não entendeu?
        </p>

        <div className="space-y-3 mb-4 text-sm text-muted-foreground">
          <p>Exemplos:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>"Não é sobre trabalhar mais. É sobre jogar melhor."</li>
            <li>"Empresas travam por falta de clareza, não de esforço."</li>
          </ul>
        </div>

        <Textarea
          value={data.belief}
          onChange={(e) => onChange({ ...data, belief: e.target.value })}
          placeholder="Escreva a crença central do evento..."
          className="bg-background/50 border-border/50"
          rows={4}
        />
      </motion.div>

      {/* Seção 8: Inimigo Comum */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🚫 INIMIGO COMUM
        </h3>
        <p className="text-muted-foreground mb-6">Toda tribo tem um vilão:</p>

        <div className="space-y-3">
          {enemyOptions.map(enemy => (
            <div key={enemy} className="flex items-center gap-3">
              <Checkbox
                checked={data.enemy.includes(enemy)}
                onCheckedChange={() => toggleEnemy(enemy)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <span className="text-foreground">{enemy}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Label className="text-muted-foreground">Outro inimigo:</Label>
          <Input
            value={data.customEnemy}
            onChange={(e) => onChange({ ...data, customEnemy: e.target.value })}
            placeholder="Adicione outro inimigo..."
            className="mt-2 bg-background/50 border-border/50"
          />
        </div>
      </motion.div>

      {/* Seção 9: Linguagem Interna */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🌍 LINGUAGEM INTERNA
        </h3>
        <p className="text-muted-foreground mb-4">
          Criar termos que só quem participa entende:
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Ex: "Empresário de verdade", "Jogo grande", "Sala de decisão", "Visão limpa", "Mentalidade de conselho"
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3, 4].map(index => (
            <Input
              key={index}
              value={data.language[index] || ''}
              onChange={(e) => updateLanguage(index, e.target.value)}
              placeholder={`Termo ${index + 1}`}
              className="bg-background/50 border-border/50"
            />
          ))}
        </div>
      </motion.div>

      {/* Seção 10: Ritual */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🧠 RITUAL
        </h3>
        <p className="text-muted-foreground mb-6">Algo que marque o evento:</p>

        <div className="space-y-3">
          {ritualOptions.map(ritual => (
            <div key={ritual} className="flex items-center gap-3">
              <Checkbox
                checked={data.ritual.selected.includes(ritual)}
                onCheckedChange={() => toggleRitual(ritual)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <span className="text-foreground">{ritual}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Label className="text-muted-foreground">Descreva um ritual personalizado:</Label>
          <Textarea
            value={data.ritual.custom}
            onChange={(e) => onChange({
              ...data,
              ritual: { ...data.ritual, custom: e.target.value }
            })}
            placeholder="Descreva como será o ritual marcante do evento..."
            className="mt-2 bg-background/50 border-border/50"
            rows={3}
          />
        </div>
      </motion.div>

      {/* Seção 11: Papel dos 4 Fundadores */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🏛 PAPEL DOS 4 FUNDADORES
        </h3>
        <p className="text-muted-foreground mb-6">
          Cada um precisa representar algo. Qual arquétipo cada um de vocês carrega naturalmente?
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map(index => (
            <FounderCard
              key={index}
              index={index}
              founder={data.founders[index] || { name: '', archetype: '', expertise: '', bio: '' }}
              archetypes={archetypes}
              onChange={(founder) => updateFounder(index, founder)}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
