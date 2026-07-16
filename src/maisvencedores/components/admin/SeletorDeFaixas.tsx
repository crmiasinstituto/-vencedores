import { Faixa, FAIXAS, FAIXA_INFO } from '@/maisvencedores/types/member';
import { cn } from '@/lib/utils';

interface Props {
  selecionadas: Faixa[];
  onChange: (faixas: Faixa[]) => void;
}

/**
 * Escolhe QUAIS faixas entram — múltipla escolha.
 *
 * Isto é pra evento, e é de propósito diferente de treinamento. Evento é INCLUSÃO: dá pra
 * abrir só pra verde e roxo sem abrir pra todo mundo (foi o que o Carlos pediu). Treinamento é
 * NÍVEL: da faixa X pra cima. Por isso lá é um Select simples de faixa mínima e aqui é isto.
 *
 * Não é <Select multiple> porque o nativo é horrível de usar no toque e esconde as cores — e a
 * cor é como a faixa se lê. Aqui cada faixa é um botão que mostra a própria cor.
 */
export function SeletorDeFaixas({ selecionadas, onChange }: Props) {
  const alternar = (f: Faixa) => {
    onChange(selecionadas.includes(f) ? selecionadas.filter((x) => x !== f) : [...selecionadas, f]);
  };

  const todas = selecionadas.length === FAIXAS.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {FAIXAS.map((f) => {
          const info = FAIXA_INFO[f];
          const ativa = selecionadas.includes(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => alternar(f)}
              aria-pressed={ativa}
              title={info.descricao}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                ativa
                  ? cn(info.fundo, info.borda, info.texto)
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <span className={cn('h-2.5 w-2.5 rounded-full', ativa ? info.pastilha : 'bg-muted-foreground/40')} />
              {info.nome}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => onChange(todas ? [] : [...FAIXAS])}
          className="text-primary hover:underline"
        >
          {todas ? 'Limpar todas' : 'Selecionar todas'}
        </button>
        {selecionadas.length === 0 && (
          // Array vazio no banco significa ninguém entra. Melhor dizer isso agora do que a
          // pessoa criar o evento e não entender por que ele não aparece pra ninguém.
          <span className="text-amber-500">Nenhuma faixa marcada — ninguém verá este evento.</span>
        )}
      </div>
    </div>
  );
}
