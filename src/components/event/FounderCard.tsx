import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";

interface Founder {
  name: string;
  archetype: string;
  expertise: string;
  bio: string;
}

interface FounderCardProps {
  index: number;
  founder: Founder;
  archetypes: string[];
  onChange: (founder: Founder) => void;
}

export function FounderCard({ index, founder, archetypes, onChange }: FounderCardProps) {
  const archetypeColors: Record<string, string> = {
    "O Visionário": "from-purple-500/20 to-blue-500/20 border-purple-500/30",
    "O Estrategista": "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
    "O Executor": "from-orange-500/20 to-red-500/20 border-orange-500/30",
    "O Guardião do Crescimento": "from-green-500/20 to-emerald-500/20 border-green-500/30"
  };

  const archetypeIcons: Record<string, string> = {
    "O Visionário": "🔮",
    "O Estrategista": "🎯",
    "O Executor": "⚡",
    "O Guardião do Crescimento": "🌱"
  };

  const colorClass = archetypeColors[founder.archetype] || "from-primary/10 to-primary/5 border-primary/20";
  const icon = archetypeIcons[founder.archetype] || "👤";

  return (
    <div className={`bg-gradient-to-br ${colorClass} border rounded-xl p-5 transition-all duration-300`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-background/50 flex items-center justify-center text-2xl">
          {founder.archetype ? icon : <User className="w-6 h-6 text-muted-foreground" />}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Fundador {index + 1}</p>
          <p className="font-semibold text-foreground">
            {founder.name || "Nome não definido"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <Input
            value={founder.name}
            onChange={(e) => onChange({ ...founder, name: e.target.value })}
            placeholder="Nome do fundador"
            className="mt-1 bg-background/50 border-border/50"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Arquétipo</Label>
          <Select
            value={founder.archetype}
            onValueChange={(value) => onChange({ ...founder, archetype: value })}
          >
            <SelectTrigger className="mt-1 bg-background/50 border-border/50">
              <SelectValue placeholder="Selecione o arquétipo" />
            </SelectTrigger>
            <SelectContent>
              {archetypes.map(archetype => (
                <SelectItem key={archetype} value={archetype}>
                  {archetypeIcons[archetype]} {archetype}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Tema/Expertise de abordagem</Label>
          <Input
            value={founder.expertise}
            onChange={(e) => onChange({ ...founder, expertise: e.target.value })}
            placeholder="Ex: Estratégia de crescimento, Marketing digital..."
            className="mt-1 bg-background/50 border-border/50"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Bio curta (50 palavras)</Label>
          <Textarea
            value={founder.bio}
            onChange={(e) => onChange({ ...founder, bio: e.target.value })}
            placeholder="Breve descrição do fundador..."
            className="mt-1 bg-background/50 border-border/50"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
