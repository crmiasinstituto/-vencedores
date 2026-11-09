import { ExternalLink, Phone, Reply, Copy, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Balão de modelo (template) da API oficial no visual do WhatsApp (tema escuro), com cores
 * fixas: antes cada tela pintava o balão de branco e o texto herdava a cor clara do CRM,
 * ficando ilegível. Usado na lista de modelos, na escolha do modelo da campanha e na revisão.
 *
 * `params` troca {{1}}, {{2}}… por valores de exemplo; o que não tiver valor aparece destacado.
 */
export function TemplateBubble({
  components,
  params = [],
  className,
  hora = true,
  headerImageUrl,
}: {
  components: any[] | null | undefined;
  params?: string[];
  className?: string;
  hora?: boolean;
  /** Imagem real do cabeçalho (ex.: a de exemplo cadastrada na Meta), quando houver. */
  headerImageUrl?: string | null;
}) {
  const comps = components || [];
  const pega = (t: string) => comps.find((c: any) => String(c?.type).toUpperCase() === t);
  const header = pega('HEADER');
  const body = pega('BODY');
  const footer = pega('FOOTER');
  const botoes: any[] = pega('BUTTONS')?.buttons || [];

  const comVariaveis = (texto: string) =>
    texto.split(/(\{\{\s*\d+\s*\}\})/g).map((parte, i) => {
      const m = parte.match(/\{\{\s*(\d+)\s*\}\}/);
      if (!m) return <span key={i}>{parte}</span>;
      const valor = params[Number(m[1]) - 1];
      return (
        <span key={i} className="rounded bg-[#BAA05E]/25 px-0.5 font-medium text-[#f5d98b]">
          {valor || parte}
        </span>
      );
    });

  const formato = String(header?.format || '').toUpperCase();

  return (
    <div
      className={cn(
        'rounded-xl bg-[#0b141a] p-4 [background-size:18px_18px] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)]',
        className,
      )}
    >
      <div className="max-w-[320px] rounded-lg rounded-tl-none bg-[#202c33] text-[#e9edef] shadow-md">
        {header && (
          <div className="px-3 pt-2.5">
            {formato === 'TEXT' || (!formato && header.text) ? (
              <p className="text-[14px] font-bold leading-snug">{comVariaveis(header.text || '')}</p>
            ) : formato === 'IMAGE' && headerImageUrl ? (
              <img src={headerImageUrl} alt="Imagem do cabeçalho" loading="lazy" className="max-h-56 w-full rounded-md object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center gap-1.5 rounded-md bg-[#111b21] text-[11px] text-[#8696a0]">
                {formato === 'VIDEO' ? <Video className="h-4 w-4" /> : formato === 'DOCUMENT' ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                {formato === 'VIDEO' ? 'Vídeo' : formato === 'DOCUMENT' ? 'Documento' : 'Imagem'}
              </div>
            )}
          </div>
        )}
        <div className="px-3 pb-1 pt-2">
          {body?.text ? (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.45]">{comVariaveis(body.text)}</p>
          ) : (
            <p className="text-[13px] italic text-[#8696a0]">Sem texto</p>
          )}
          {footer?.text && <p className="mt-1.5 text-[12px] text-[#8696a0]">{footer.text}</p>}
          {hora && (
            <p className="mt-0.5 text-right text-[10px] text-[#8696a0]">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {botoes.length > 0 && (
          <div className="divide-y divide-[#2a3942] border-t border-[#2a3942]">
            {botoes.map((b, i) => {
              const tipo = String(b.type).toUpperCase();
              const Icone = tipo === 'URL' ? ExternalLink : tipo === 'PHONE_NUMBER' ? Phone : tipo === 'COPY_CODE' ? Copy : Reply;
              return (
                <div
                  key={i}
                  title={b.url || b.phone_number || undefined}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-[#53bdeb]"
                >
                  <Icone className="h-3.5 w-3.5" />
                  <span className="truncate">{b.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplateBubble;
