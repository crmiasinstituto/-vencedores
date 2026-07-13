import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Terminal, Wand2, Bot, Download, ExternalLink } from 'lucide-react';
import { IMPORT_METHOD_LABELS, type Accelerator } from './types';

const METHOD_ICON: Record<string, any> = {
  'claude-code': Terminal,
  lovable: Wand2,
  'gpt-agent': Bot,
};

// Gera os 3 passos por método a partir dos dados do acelerador.
function stepsFor(method: string, a: Accelerator): string[] {
  switch (method) {
    case 'claude-code':
      return [
        'Baixe o ZIP do acelerador e descompacte numa pasta.',
        'Abra a pasta no Claude Code pelo terminal.',
        'Peça: "configure este acelerador no meu projeto" e siga as instruções.',
      ];
    case 'lovable':
      return [
        a.lovable_remix_url
          ? 'Clique em "Abrir no Lovable" para remixar o projeto.'
          : 'Baixe o ZIP e importe o projeto no Lovable.',
        'Conecte seu Supabase nas configurações do projeto.',
        'Rode as migrations SQL e ajuste as variáveis de ambiente.',
      ];
    case 'gpt-agent':
      return [
        'Baixe o material e abra no seu agente/GPT preferido.',
        'Cole o prompt ou contexto fornecido no acelerador.',
        'Adapte os nomes de tabelas e campos pro seu projeto.',
      ];
    default:
      return [];
  }
}

export function ImportMethodTabs({
  accelerator,
  onDownload,
}: {
  accelerator: Accelerator;
  onDownload: () => void;
}) {
  const methods =
    accelerator.import_methods && accelerator.import_methods.length
      ? accelerator.import_methods
      : ['claude-code'];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white">Como usar</h2>
      <Tabs defaultValue={methods[0]} className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          {methods.map((m) => {
            const Icon = METHOD_ICON[m] || Terminal;
            return (
              <TabsTrigger
                key={m}
                value={m}
                className="data-[state=active]:bg-[#3B82F6]/15 data-[state=active]:text-[#3B82F6] text-white/50"
              >
                <Icon className="w-4 h-4 mr-1.5" />
                {IMPORT_METHOD_LABELS[m] || m}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {methods.map((m) => (
          <TabsContent key={m} value={m} className="mt-4">
            <ol className="space-y-3">
              {stepsFor(m, accelerator).map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white/70 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2 mt-5">
              <Button
                onClick={onDownload}
                className="bg-[#3B82F6] text-black hover:bg-[#FFE066] font-semibold rounded-xl"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Baixar arquivo
              </Button>
              {m === 'lovable' && accelerator.lovable_remix_url && (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/5 rounded-xl"
                >
                  <a
                    href={accelerator.lovable_remix_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    Abrir no Lovable
                  </a>
                </Button>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
