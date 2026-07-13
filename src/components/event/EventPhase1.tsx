import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EventPhase1Props {
  data: {
    eventConfig: {
      name: string;
      type: string;
      customType: string;
    };
    identity: {
      professionalStatus: string[];
      customProfessionalStatus: string;
      incomeRange: string[];
      extraIncomeExperience: string[];
      mainGoal: string[];
      customMainGoal: string;
      timeAvailability: string[];
      age: string[];
      profile: string[];
      customProfile: string;
      keyQuestion: string;
    };
    pains: {
      selected: string[];
      customPain: string;
      frustration: string;
    };
    desires: {
      selected: string[];
      customDesire: string;
      singleChange: string;
    };
    objections: {
      selected: string[];
      customObjection: string;
      whyNotBuy: string;
    };
  };
  onChange: (data: EventPhase1Props['data']) => void;
}

const eventTypes = [
  { value: "renda-extra", label: "Renda Extra / Segunda Fonte" },
  { value: "empreendedorismo", label: "Empreendedorismo" },
  { value: "investimentos", label: "Investimentos" },
  { value: "marketing-digital", label: "Marketing Digital" },
  { value: "mentoria-empresarial", label: "Mentoria Empresarial" },
  { value: "desenvolvimento-pessoal", label: "Desenvolvimento Pessoal" },
  { value: "tecnologia-ia", label: "Tecnologia / IA" },
  { value: "outro", label: "Outro (customizado)" }
];

const professionalStatusOptions = [
  "Trabalhador CLT",
  "Funcionário Público",
  "Autônomo / Freelancer",
  "Dono de negócio",
  "Executivo / Gestor",
  "Desempregado / Em transição",
  "Aposentado",
  "Universitário / Estudante",
  "Profissional Liberal (médico, advogado, etc)",
  "Pai/Mãe investindo no futuro dos filhos"
];

const incomeRangeOptions = [
  "Até R$ 2.000/mês",
  "R$ 2.000 - R$ 5.000/mês",
  "R$ 5.000 - R$ 10.000/mês",
  "R$ 10.000 - R$ 20.000/mês",
  "R$ 20.000 - R$ 50.000/mês",
  "Acima de R$ 50.000/mês",
  "Prefiro não informar"
];

const extraIncomeExperienceOptions = [
  "Nunca tentou criar renda extra",
  "Já tentou, não deu certo",
  "Tem renda extra pequena",
  "Já tem segunda renda consolidada",
  "Vive 100% de renda extra/própria"
];

const mainGoalOptions = [
  "Criar primeira fonte de renda extra",
  "Transformar renda extra em principal",
  "Escalar negócio existente",
  "Liberdade financeira / aposentadoria",
  "Investir no futuro dos filhos",
  "Sair do emprego atual",
  "Complementar aposentadoria",
  "Ter mais tempo livre",
  "Reconhecimento e status"
];

const timeAvailabilityOptions = [
  "Menos de 1h/dia",
  "1-2h/dia",
  "2-4h/dia",
  "Tempo integral disponível",
  "Finais de semana apenas"
];

const ageRanges = ["18-24", "25-34", "35-45", "46-55", "56-65", "65+"];

const profiles = [
  "Visionário / Sonhador",
  "Executor / Mão na massa",
  "Técnico que quer empreender",
  "Conservador / Cauteloso",
  "Líder natural",
  "Analítico / Planejador"
];

const painOptions = [
  "Salário não acompanha a inflação",
  "Medo de demissão / instabilidade",
  "Trabalha muito e ganha pouco",
  "Não vê futuro no emprego atual",
  "Quer mais tempo com a família",
  "Preocupado com aposentadoria",
  "Depende de um único salário",
  "Já tentou empreender e fracassou",
  "Não sabe por onde começar",
  "Falta de capital inicial",
  "Medo de arriscar",
  "Chefe / ambiente tóxico",
  "Sem reconhecimento no trabalho",
  "Filhos crescendo, custos aumentando",
  "Dívidas acumuladas",
  "Empresa depende 100% dele (donos)",
  "Fatura bem, mas trabalha demais",
  "Time fraco ou desalinhado"
];

const desireOptions = [
  "Liberdade de horário",
  "Trabalhar de casa / remoto",
  "Ser o próprio chefe",
  "Renda passiva / recorrente",
  "Segurança financeira para família",
  "Deixar herança / legado",
  "Reconhecimento e status",
  "Viajar sem preocupação",
  "Comprar casa própria",
  "Pagar estudos dos filhos",
  "Aposentadoria tranquila",
  "Qualidade de vida",
  "Independência do emprego",
  "Escalar sem limite de ganho",
  "Clareza estratégica",
  "Pertencer a um grupo seleto"
];

const objectionOptions = [
  "Não tenho dinheiro para investir",
  "Não tenho tempo",
  "Já caí em golpe antes",
  "Isso é pirâmide?",
  "Meu cônjuge não vai apoiar",
  "Sou velho demais pra isso",
  "Não entendo de tecnologia",
  "Tenho medo de me expor",
  "E se não der certo?",
  "Preciso ver resultados de outros",
  "Parece bom demais pra ser verdade",
  "Minha cidade é pequena",
  "Não tenho perfil de vendedor",
  "Já vi isso antes...",
  "Mais um evento?",
  "Meu problema é mais complexo"
];

export function EventPhase1({ data, onChange }: EventPhase1Props) {
  const toggleArrayValue = (
    section: 'identity' | 'pains' | 'desires' | 'objections',
    field: string,
    value: string
  ) => {
    if (section === 'identity') {
      const currentArray = data.identity[field as keyof typeof data.identity] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      onChange({
        ...data,
        identity: { ...data.identity, [field]: newArray }
      });
    } else if (section === 'pains') {
      const newArray = data.pains.selected.includes(value)
        ? data.pains.selected.filter(v => v !== value)
        : [...data.pains.selected, value];
      onChange({
        ...data,
        pains: { ...data.pains, selected: newArray }
      });
    } else if (section === 'desires') {
      const newArray = data.desires.selected.includes(value)
        ? data.desires.selected.filter(v => v !== value)
        : [...data.desires.selected, value];
      onChange({
        ...data,
        desires: { ...data.desires, selected: newArray }
      });
    } else {
      const newArray = data.objections.selected.includes(value)
        ? data.objections.selected.filter(v => v !== value)
        : [...data.objections.selected, value];
      onChange({
        ...data,
        objections: { ...data.objections, selected: newArray }
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Seção 0: Configuração do Evento */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm border border-primary/30 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          ⚙️ CONFIGURAÇÃO DO EVENTO
        </h3>
        <p className="text-muted-foreground mb-6">Defina as informações básicas do seu evento:</p>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Label className="text-foreground font-medium">Nome do Evento</Label>
            <Input
              value={data.eventConfig.name}
              onChange={(e) => onChange({
                ...data,
                eventConfig: { ...data.eventConfig, name: e.target.value }
              })}
              placeholder="Ex: Imersão Liberdade Financeira"
              className="mt-2 bg-background/50 border-border/50"
            />
          </div>

          <div>
            <Label className="text-foreground font-medium">Tipo de Lançamento</Label>
            <Select
              value={data.eventConfig.type}
              onValueChange={(value) => onChange({
                ...data,
                eventConfig: { ...data.eventConfig, type: value }
              })}
            >
              <SelectTrigger className="mt-2 bg-background/50 border-border/50">
                <SelectValue placeholder="Selecione o tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data.eventConfig.type === 'outro' && (
            <div className="md:col-span-2">
              <Label className="text-foreground font-medium">Tipo Customizado</Label>
              <Input
                value={data.eventConfig.customType}
                onChange={(e) => onChange({
                  ...data,
                  eventConfig: { ...data.eventConfig, customType: e.target.value }
                })}
                placeholder="Descreva o tipo do seu evento..."
                className="mt-2 bg-background/50 border-border/50"
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Seção 1: Identidade do ICP */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🎯 QUEM é o ICP (Identidade)
        </h3>
        <p className="text-muted-foreground mb-6">Defina o perfil ideal do seu público-alvo:</p>

        <div className="space-y-6">
          {/* Situação Profissional */}
          <div>
            <Label className="text-foreground font-medium">Situação Profissional</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {professionalStatusOptions.map(status => (
                <div key={status} className="flex items-center gap-2">
                  <Checkbox
                    checked={data.identity.professionalStatus.includes(status)}
                    onCheckedChange={() => toggleArrayValue('identity', 'professionalStatus', status)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-foreground">{status}</span>
                </div>
              ))}
            </div>
            <Input
              value={data.identity.customProfessionalStatus}
              onChange={(e) => onChange({
                ...data,
                identity: { ...data.identity, customProfessionalStatus: e.target.value }
              })}
              placeholder="Outro (especifique)..."
              className="mt-3 bg-background/50 border-border/50"
            />
          </div>

          {/* Faixa de Renda */}
          <div>
            <Label className="text-foreground font-medium">Faixa de Renda Atual</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {incomeRangeOptions.map(range => (
                <div key={range} className="flex items-center gap-2">
                  <Checkbox
                    checked={data.identity.incomeRange.includes(range)}
                    onCheckedChange={() => toggleArrayValue('identity', 'incomeRange', range)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-foreground">{range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Experiência com Renda Extra */}
          <div>
            <Label className="text-foreground font-medium">Nível de Experiência com Renda Extra</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {extraIncomeExperienceOptions.map(exp => (
                <div key={exp} className="flex items-center gap-2">
                  <Checkbox
                    checked={data.identity.extraIncomeExperience.includes(exp)}
                    onCheckedChange={() => toggleArrayValue('identity', 'extraIncomeExperience', exp)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-foreground">{exp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Objetivo Principal */}
          <div>
            <Label className="text-foreground font-medium">Objetivo Principal</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {mainGoalOptions.map(goal => (
                <div key={goal} className="flex items-center gap-2">
                  <Checkbox
                    checked={data.identity.mainGoal.includes(goal)}
                    onCheckedChange={() => toggleArrayValue('identity', 'mainGoal', goal)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-foreground">{goal}</span>
                </div>
              ))}
            </div>
            <Input
              value={data.identity.customMainGoal}
              onChange={(e) => onChange({
                ...data,
                identity: { ...data.identity, customMainGoal: e.target.value }
              })}
              placeholder="Outro objetivo (especifique)..."
              className="mt-3 bg-background/50 border-border/50"
            />
          </div>

          {/* Disponibilidade de Tempo */}
          <div>
            <Label className="text-foreground font-medium">Disponibilidade de Tempo</Label>
            <div className="flex flex-wrap gap-3 mt-2">
              {timeAvailabilityOptions.map(time => (
                <div key={time} className="flex items-center gap-2">
                  <Checkbox
                    checked={data.identity.timeAvailability.includes(time)}
                    onCheckedChange={() => toggleArrayValue('identity', 'timeAvailability', time)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-foreground">{time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Idade */}
          <div>
            <Label className="text-foreground font-medium">Faixa Etária</Label>
            <div className="flex flex-wrap gap-3 mt-2">
              {ageRanges.map(age => (
                <div key={age} className="flex items-center gap-2">
                  <Checkbox
                    checked={data.identity.age.includes(age)}
                    onCheckedChange={() => toggleArrayValue('identity', 'age', age)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-foreground">{age}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Perfil Comportamental */}
          <div>
            <Label className="text-foreground font-medium">Perfil Comportamental</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {profiles.map(profile => (
                <div key={profile} className="flex items-center gap-2">
                  <Checkbox
                    checked={data.identity.profile.includes(profile)}
                    onCheckedChange={() => toggleArrayValue('identity', 'profile', profile)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-foreground">{profile}</span>
                </div>
              ))}
            </div>
            <Input
              value={data.identity.customProfile}
              onChange={(e) => onChange({
                ...data,
                identity: { ...data.identity, customProfile: e.target.value }
              })}
              placeholder="Outro perfil (especifique)..."
              className="mt-3 bg-background/50 border-border/50"
            />
          </div>

          {/* Pergunta-chave */}
          <div>
            <Label className="text-foreground font-medium">
              📌 Pergunta-chave: Descreva em uma frase quem é o participante ideal deste evento
            </Label>
            <Textarea
              value={data.identity.keyQuestion}
              onChange={(e) => onChange({
                ...data,
                identity: { ...data.identity, keyQuestion: e.target.value }
              })}
              placeholder="Ex: CLT frustrado que busca uma saída do 9-18, com garra para começar mas sem saber por onde..."
              className="mt-2 bg-background/50 border-border/50"
            />
          </div>
        </div>
      </motion.div>

      {/* Seção 2: Dores Reais */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🧠 DORES REAIS (o que ele não posta no Instagram)
        </h3>
        <p className="text-muted-foreground mb-6">Selecione as dores que mais ressoam com seu público:</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {painOptions.map(pain => (
            <div key={pain} className="flex items-center gap-3">
              <Checkbox
                checked={data.pains.selected.includes(pain)}
                onCheckedChange={() => toggleArrayValue('pains', 'selected', pain)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <span className="text-foreground text-sm">{pain}</span>
            </div>
          ))}
        </div>

        <Input
          value={data.pains.customPain}
          onChange={(e) => onChange({
            ...data,
            pains: { ...data.pains, customPain: e.target.value }
          })}
          placeholder="Outra dor específica do seu público..."
          className="mt-4 bg-background/50 border-border/50"
        />

        <div className="mt-6">
          <Label className="text-foreground font-medium">
            📌 Pergunta-chave: O que faz essa pessoa deitar a cabeça no travesseiro com sensação de frustração?
          </Label>
          <Textarea
            value={data.pains.frustration}
            onChange={(e) => onChange({
              ...data,
              pains: { ...data.pains, frustration: e.target.value }
            })}
            placeholder="Descreva a frustração principal do seu ICP..."
            className="mt-2 bg-background/50 border-border/50"
          />
        </div>
      </motion.div>

      {/* Seção 3: Desejos Profundos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          💰 DESEJOS PROFUNDOS (não os óbvios)
        </h3>
        <p className="text-muted-foreground mb-6">Não é só "ganhar mais dinheiro". O que ele realmente quer?</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {desireOptions.map(desire => (
            <div key={desire} className="flex items-center gap-3">
              <Checkbox
                checked={data.desires.selected.includes(desire)}
                onCheckedChange={() => toggleArrayValue('desires', 'selected', desire)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <span className="text-foreground text-sm">{desire}</span>
            </div>
          ))}
        </div>

        <Input
          value={data.desires.customDesire}
          onChange={(e) => onChange({
            ...data,
            desires: { ...data.desires, customDesire: e.target.value }
          })}
          placeholder="Outro desejo específico do seu público..."
          className="mt-4 bg-background/50 border-border/50"
        />

        <div className="mt-6">
          <Label className="text-foreground font-medium">
            📌 Pergunta-chave: Se esse evento desse UMA coisa só, qual mudança real ele deveria sentir no dia seguinte?
          </Label>
          <Textarea
            value={data.desires.singleChange}
            onChange={(e) => onChange({
              ...data,
              desires: { ...data.desires, singleChange: e.target.value }
            })}
            placeholder="Descreva a transformação principal..."
            className="mt-2 bg-background/50 border-border/50"
          />
        </div>
      </motion.div>

      {/* Seção 4: Objeções */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          🚧 OBJEÇÕES (o que ele pensa mas não fala)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {objectionOptions.map(objection => (
            <div key={objection} className="flex items-center gap-3">
              <Checkbox
                checked={data.objections.selected.includes(objection)}
                onCheckedChange={() => toggleArrayValue('objections', 'selected', objection)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <span className="text-foreground text-sm">"{objection}"</span>
            </div>
          ))}
        </div>

        <Input
          value={data.objections.customObjection}
          onChange={(e) => onChange({
            ...data,
            objections: { ...data.objections, customObjection: e.target.value }
          })}
          placeholder="Outra objeção específica..."
          className="mt-4 bg-background/50 border-border/50"
        />

        <div className="mt-6">
          <Label className="text-foreground font-medium">
            📌 Pergunta-chave: Por que alguém NÃO compraria esse ingresso?
          </Label>
          <Textarea
            value={data.objections.whyNotBuy}
            onChange={(e) => onChange({
              ...data,
              objections: { ...data.objections, whyNotBuy: e.target.value }
            })}
            placeholder="Descreva os motivos de resistência..."
            className="mt-2 bg-background/50 border-border/50"
          />
        </div>
      </motion.div>
    </div>
  );
}
