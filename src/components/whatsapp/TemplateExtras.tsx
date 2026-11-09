import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Phone, Reply, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Rodapé e botões de um modelo (template) da API oficial, desenhados embaixo da mensagem como
 * o lead vê no WhatsApp. A mensagem gravada só guarda o texto do corpo; o resto vem do
 * cadastro do modelo (whatsapp_cloud_templates.components).
 */
type Botao = { type: string; text: string; url?: string; phone_number?: string };

function useTemplateComponents(nome: string | undefined) {
  return useQuery({
    queryKey: ['wa-template-components', nome],
    enabled: !!nome,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_cloud_templates' as any)
        .select('components')
        .eq('name', nome!)
        .limit(1)
        .maybeSingle();
      return ((data as any)?.components || []) as any[];
    },
  });
}

export function TemplateExtras({ templateName, isOutbound }: { templateName?: string; isOutbound: boolean }) {
  const { data: components } = useTemplateComponents(templateName);
  if (!components || components.length === 0) return null;

  const footer = components.find((c) => String(c?.type).toUpperCase() === 'FOOTER')?.text as string | undefined;
  const botoes: Botao[] = components.find((c) => String(c?.type).toUpperCase() === 'BUTTONS')?.buttons || [];
  if (!footer && botoes.length === 0) return null;

  return (
    <div className="mt-1">
      {footer && <p className="text-[11px] opacity-60 mt-1">{footer}</p>}
      {botoes.length > 0 && (
        <div className={`mt-2 -mx-3 -mb-1.5 border-t ${isOutbound ? 'border-white/15' : 'border-white/10'}`}>
          {botoes.map((b, i) => {
            const tipo = String(b.type).toUpperCase();
            const Icone = tipo === 'URL' ? ExternalLink : tipo === 'PHONE_NUMBER' ? Phone : tipo === 'COPY_CODE' ? Copy : Reply;
            const href = tipo === 'URL' ? b.url?.replace(/\{\{\d+\}\}/g, '') : tipo === 'PHONE_NUMBER' ? `tel:${b.phone_number}` : undefined;
            const conteudo = (
              <>
                <Icone className="h-3.5 w-3.5" />
                <span className="truncate">{b.text}</span>
              </>
            );
            const classe = `flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[#53bdeb] ${
              i > 0 ? `border-t ${isOutbound ? 'border-white/15' : 'border-white/10'}` : ''
            }`;
            return href ? (
              <a key={i} href={href} target="_blank" rel="noreferrer" className={`${classe} hover:bg-white/5 transition-colors`} title={b.url || b.phone_number}>
                {conteudo}
              </a>
            ) : (
              <div key={i} className={classe}>{conteudo}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TemplateExtras;
