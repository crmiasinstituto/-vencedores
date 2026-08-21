// Identificacao humana das instancias de WhatsApp.
//
// Todas as instancias tem channel = "comercial", entao o channel NAO identifica
// nada. O que identifica e: NOME + NUMERO + tipo de conexao. Os tres tipos, com
// a nomenclatura usada pelo time:
//
//   OFICIAL      -> Cloud API da Meta (numero que so existe dentro do CRM)
//   COEX         -> Cloud API em coexistencia (mesmo numero segue no celular)
//   NAO OFICIAL  -> UAZAPI (nao homologado pela Meta, pode cair/banir)
//
// COEX e detectado pelo texto da instancia (nome/purpose/notes) porque nao ha
// coluna no banco marcando coexistencia — a Meta nao expoe isso na API.

export interface InstanceIdentity {
  instance_name?: string | null;
  phone_number?: string | null;
  provider?: string | null;
  purpose?: string | null;
  notes?: string | null;
}

export type InstanceTagKind = 'coex' | 'oficial' | 'nao_oficial';

/** +5511951988433 -> "+55 11 95198-8433" */
export const formatInstancePhone = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length === 9) return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `+55 ${ddd} ${rest}`;
  }
  return raw.startsWith('+') ? raw : `+${d}`;
};

/** "Atendimento | IAS INSTITUTO" -> "Atendimento" */
export const shortInstanceName = (name: string | null | undefined): string =>
  (name || '').split('|')[0].trim().slice(0, 18) || 'Instância';

export interface InstanceTag {
  kind: InstanceTagKind;
  /** Texto curto do selo: COEX / OFICIAL / NÃO OFICIAL */
  label: string;
  /** classes do chip (bg + texto + borda) */
  className: string;
  /** classes so de texto, pra usar fora de chip */
  textClass: string;
}

export const getInstanceTag = (inst: InstanceIdentity | null | undefined): InstanceTag => {
  const isCloud = inst?.provider === 'cloud_api';
  const haystack = [inst?.instance_name, inst?.purpose, inst?.notes]
    .filter(Boolean).join(' ').toLowerCase();
  const isCoex = isCloud && haystack.includes('coex');

  if (isCoex) {
    return {
      kind: 'coex',
      label: 'COEX',
      className: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      textClass: 'text-emerald-300',
    };
  }
  if (isCloud) {
    return {
      kind: 'oficial',
      label: 'OFICIAL',
      className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      textClass: 'text-blue-300',
    };
  }
  return {
    kind: 'nao_oficial',
    label: 'NÃO OFICIAL',
    className: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    textClass: 'text-amber-300',
  };
};

/** "Isaac Santos · +55 71 9952-4921 · COEX" — pra tooltip */
export const describeInstance = (inst: InstanceIdentity | null | undefined): string => {
  if (!inst) return '';
  const phone = formatInstancePhone(inst.phone_number);
  return [inst.instance_name || 'Instância', phone, getInstanceTag(inst).label]
    .filter(Boolean).join(' · ');
};
