import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, X, Layers, Columns, Tag, UserCircle, Sparkles, Calendar, GraduationCap, ShieldAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAudienceOptions } from '@/hooks/useAudienceOptions';
import type { EmailAudienceFilters } from '@/types/email.types';

interface Props {
  filters: EmailAudienceFilters;
  onChange: (filters: EmailAudienceFilters) => void;
}

interface MultiSelectProps {
  label: string;
  icon?: React.ReactNode;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}

function MultiSelect({ label, icon, options, selected, onChange, placeholder = 'Selecionar...', emptyText = 'Nada encontrado' }: MultiSelectProps) {
  const selectedLabels = useMemo(
    () => options.filter(o => selected.includes(o.value)).map(o => o.label),
    [options, selected]
  );

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
        {selected.length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{selected.length}</Badge>
        )}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              'w-full justify-between h-9 text-sm font-normal',
              selected.length === 0 && 'text-muted-foreground'
            )}
          >
            <span className="truncate">
              {selected.length === 0
                ? placeholder
                : selected.length === 1
                  ? selectedLabels[0]
                  : `${selected.length} selecionados`}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar..." className="h-9" />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.length === 0 && (
                  <CommandItem disabled className="text-xs text-muted-foreground">
                    Sem opções disponíveis
                  </CommandItem>
                )}
                {options.map(opt => {
                  const isSel = selected.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => toggle(opt.value)}
                      className="cursor-pointer"
                    >
                      <Check className={cn('mr-2 h-4 w-4', isSel ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {options.filter(o => selected.includes(o.value)).map(o => (
            <Badge key={o.value} variant="secondary" className="text-[10px] gap-1 pr-1">
              {o.label}
              <button onClick={() => toggle(o.value)} className="hover:bg-muted rounded-sm p-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmailAudienceBuilder({ filters, onChange }: Props) {
  const { data: opts, isLoading } = useAudienceOptions();

  const update = <K extends keyof EmailAudienceFilters>(key: K, value: EmailAudienceFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  // Colunas disponíveis: se boards selecionados, filtra; senão mostra todas
  const visibleColumns = useMemo(() => {
    if (!opts) return [];
    if (filters.board_ids && filters.board_ids.length > 0) {
      return opts.allColumns.filter(c => filters.board_ids!.includes(c.board_id));
    }
    return opts.allColumns;
  }, [opts, filters.board_ids]);

  // Quando troca de board, filtra column_ids que não pertencem mais ao board selecionado
  const updateBoards = (next: string[]) => {
    const validColumnIds = (filters.column_ids || []).filter(colId => {
      const col = opts?.allColumns.find(c => c.id === colId);
      return !col || next.length === 0 || next.includes(col.board_id);
    });
    onChange({ ...filters, board_ids: next, column_ids: validColumnIds });
  };

  const boardLabel = (id: string) => opts?.boards.find(b => b.id === id)?.name || id;
  const columnLabel = (id: string) => {
    const c = opts?.allColumns.find(c => c.id === id);
    if (!c) return id;
    const b = opts?.boards.find(b => b.id === c.board_id);
    return b ? `${b.name} → ${c.name}` : c.name;
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#BAA05E]/20 bg-[#BAA05E]/[0.04] p-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <Sparkles className="h-3 w-3 inline mr-1 text-[#BAA05E]" />
          Audiência é montada filtrando <strong>crm_leads</strong>. Apenas leads com email preenchido e que não pediram descadastro entram. <strong>Sem filtros = todos os leads elegíveis</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MultiSelect
          label="Board (Funil)"
          icon={<Layers className="h-3 w-3" />}
          options={(opts?.boards || []).map(b => ({ value: b.id, label: b.name }))}
          selected={filters.board_ids || []}
          onChange={updateBoards}
          placeholder={isLoading ? 'Carregando…' : 'Todos os boards'}
        />

        <MultiSelect
          label="Etapa (Coluna)"
          icon={<Columns className="h-3 w-3" />}
          options={visibleColumns.map(c => ({ value: c.id, label: columnLabel(c.id) }))}
          selected={filters.column_ids || []}
          onChange={(v) => update('column_ids', v)}
          placeholder="Todas as etapas"
        />

        <MultiSelect
          label="Origem"
          icon={<Sparkles className="h-3 w-3" />}
          options={(opts?.sources || []).map(s => ({ value: s, label: s }))}
          selected={filters.sources || []}
          onChange={(v) => update('sources', v)}
          placeholder="Todas as origens"
        />

        <MultiSelect
          label="Tags — incluir"
          icon={<Tag className="h-3 w-3" />}
          options={(opts?.tags || []).map(t => ({ value: t, label: t }))}
          selected={filters.tags_any || []}
          onChange={(v) => update('tags_any', v)}
          placeholder="Quaisquer tags"
        />

        {/* Recorte do tipo "manda pra tag A, menos quem tambem tem a tag B". Vale sobre o
            resultado das inclusoes: quem tiver QUALQUER uma destas tags sai da lista. */}
        <div className="space-y-1.5">
          <MultiSelect
            label="Tags — excluir"
            icon={<Tag className="h-3 w-3" />}
            options={(opts?.tags || []).map(t => ({ value: t, label: t }))}
            selected={filters.exclude_tags || []}
            onChange={(v) => update('exclude_tags', v)}
            placeholder="Não excluir ninguém"
          />
          {(filters.exclude_tags?.length || 0) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Quem tiver {filters.exclude_tags!.length === 1 ? 'essa tag' : 'qualquer uma dessas tags'} fica
              de fora, mesmo que se encaixe nos filtros acima.
            </p>
          )}
        </div>

        <MultiSelect
          label="Responsável (assigned_to)"
          icon={<UserCircle className="h-3 w-3" />}
          options={(opts?.assignedTo || []).map(a => ({ value: a, label: a }))}
          selected={filters.assigned_to_any || []}
          onChange={(v) => update('assigned_to_any', v)}
          placeholder="Qualquer responsável"
        />

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Lead Score mínimo / máximo
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              className="h-9"
              placeholder="Mín"
              value={filters.lead_score_min ?? ''}
              onChange={e => update('lead_score_min', e.target.value ? Number(e.target.value) : undefined)}
            />
            <Input
              type="number"
              className="h-9"
              placeholder="Máx"
              value={filters.lead_score_max ?? ''}
              onChange={e => update('lead_score_max', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <GraduationCap className="h-3 w-3" />
            Onboarding Masterclass
          </Label>
          <Select
            value={filters.onboarding_status || 'any'}
            onValueChange={(v) => update('onboarding_status', v as 'any' | 'completed' | 'pending')}
          >
            <SelectTrigger className="h-9 text-sm font-normal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer status</SelectItem>
              <SelectItem value="pending">Só quem NAO completou (pendente)</SelectItem>
              <SelectItem value="completed">Só quem JA completou</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Baseado em <code>crm_leads.onboarding_completed_at</code> (wizard pos-compra Masterclass).
          </p>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Excluir quem recebeu email nos últimos N dias
          </Label>
          <Input
            type="number"
            className="h-9 max-w-[150px]"
            placeholder="Ex: 7"
            value={filters.exclude_campaign_days ?? ''}
            onChange={e => update('exclude_campaign_days', e.target.value ? Number(e.target.value) : undefined)}
          />
          <p className="text-[10px] text-muted-foreground">
            Anti-fadiga: evita disparar pro mesmo lead muito seguido.
          </p>
        </div>
      </div>

      {/* Exclusao */}
      <div className="border-t border-red-500/20 pt-4 mt-4">
        <Label className="text-xs font-semibold text-red-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
          <ShieldAlert className="h-3.5 w-3.5" />
          Excluir da audiencia (nao recebem)
        </Label>
        <p className="text-[10px] text-muted-foreground mb-3">
          Leads que estiverem nos boards, colunas ou tags abaixo serao EXCLUIDOS do disparo, mesmo que passem nos filtros acima.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MultiSelect
            label="Excluir Board(s)"
            icon={<Layers className="h-3 w-3 text-red-400" />}
            options={(opts?.boards || []).map(b => ({ value: b.id, label: b.name }))}
            selected={filters.exclude_board_ids || []}
            onChange={v => update('exclude_board_ids', v.length ? v : undefined)}
            placeholder="Boards pra excluir..."
            emptyText="Nenhum board"
          />
          <MultiSelect
            label="Excluir Etapa(s)"
            icon={<Columns className="h-3 w-3 text-red-400" />}
            options={(opts?.allColumns || []).map(c => {
              const b = opts?.boards.find(bb => bb.id === c.board_id);
              return { value: c.id, label: b ? `${b.name} → ${c.name}` : c.name };
            })}
            selected={filters.exclude_column_ids || []}
            onChange={v => update('exclude_column_ids', v.length ? v : undefined)}
            placeholder="Colunas pra excluir..."
            emptyText="Nenhuma coluna"
          />
          <MultiSelect
            label="Excluir Tag(s)"
            icon={<Tag className="h-3 w-3 text-red-400" />}
            options={(opts?.tags || []).map(t => ({ value: t, label: t }))}
            selected={filters.exclude_tags || []}
            onChange={v => update('exclude_tags', v.length ? v : undefined)}
            placeholder="Tags pra excluir..."
            emptyText="Nenhuma tag"
          />
        </div>
      </div>
    </div>
  );
}
