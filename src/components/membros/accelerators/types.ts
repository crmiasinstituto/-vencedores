// Tipos compartilhados do módulo de Aceleradores (AI FIRST).
// O acelerador é uma linha de member_files enriquecida: além do arquivo
// simples (title/file_url), pode trazer stack, features, guia de instalação,
// métodos de import, troubleshooting e vínculo com uma trilha.

export interface Accelerator {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  long_description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string; // geral | template | ferramenta | guia
  difficulty: string | null; // Iniciante | Intermediário | Avançado
  setup_time: string | null;
  thumbnail: string | null;
  video_url: string | null;
  video_title: string | null;
  publish_at: string | null;
  stack: string[] | null;
  features: string[] | null;
  prerequisites: { label: string; url?: string }[] | null;
  installation_guide: string | null;
  documentation: string | null;
  troubleshooting: string | null;
  env_example: string | null;
  sql_migrations: string | null;
  lovable_remix_url: string | null;
  import_methods: string[] | null; // claude-code | lovable | gpt-agent
  related_module_id: string | null;
  tags: string[] | null;
  is_published: boolean;
  is_featured: boolean;
  download_count: number;
  order_index: number;
  created_at: string;
}

export const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  geral: { label: 'Geral', color: '#3B82F6' },
  template: { label: 'Template', color: '#3B82F6' },
  ferramenta: { label: 'Ferramenta', color: '#10B981' },
  guia: { label: 'Guia', color: '#8B5CF6' },
};

export const DIFFICULTY_COLOR: Record<string, string> = {
  Iniciante: '#10B981',
  'Intermediário': '#3B82F6',
  'Avançado': '#EF4444',
};

export const IMPORT_METHOD_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  lovable: 'Lovable',
  'gpt-agent': 'GPT / Agente',
};

// Decide se o acelerador merece uma página de detalhe ou é só um arquivo
// pra baixar direto.
export function hasDetailContent(a: Partial<Accelerator>): boolean {
  return Boolean(
    a.slug &&
      (a.long_description ||
        a.video_url ||
        (a.features && a.features.length) ||
        (a.stack && a.stack.length) ||
        a.installation_guide ||
        a.troubleshooting ||
        a.documentation ||
        a.env_example ||
        a.sql_migrations ||
        (a.import_methods && a.import_methods.length) ||
        a.lovable_remix_url ||
        a.related_module_id)
  );
}
