import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

// Parser de troubleshooting em markdown: cada `### Pergunta` vira um item de FAQ.
function parse(troubleshooting: string) {
  return troubleshooting
    .split(/###\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((section) => {
      const lines = section.split('\n');
      return {
        question: lines[0]?.trim() || '',
        answer: lines.slice(1).join('\n').trim(),
      };
    })
    .filter((item) => item.question);
}

export function TroubleshootingFAQ({
  troubleshooting,
  title = 'Problemas comuns',
}: {
  troubleshooting: string;
  title?: string;
}) {
  const items = parse(troubleshooting);
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-[#3B82F6]" />
        {title}
      </h2>
      <Accordion type="single" collapsible className="space-y-2">
        {items.map((item, i) => (
          <AccordionItem
            key={i}
            value={`item-${i}`}
            className="border border-white/10 rounded-xl bg-white/5 px-4"
          >
            <AccordionTrigger className="text-sm text-white hover:no-underline text-left">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-white/60 whitespace-pre-wrap">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
