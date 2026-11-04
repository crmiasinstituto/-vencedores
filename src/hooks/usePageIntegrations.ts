import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Captura de Páginas: integrações de landing pages externas com o CRM (tabelas page_integrations
// e page_integration_submissions). As tabelas ainda não estão nos tipos gerados, daí os `as any`.

export interface PageIntegration {
  id: string;
  name: string;
  slug: string;
  public_key: string;
  board_id: string;
  column_id: string | null;
  tags: string[];
  redirect_url: string | null;
  success_message: string | null;
  is_active: boolean;
  total_received: number;
  last_received_at: string | null;
  created_at: string;
  updated_at: string;
  board?: { id: string; name: string } | null;
  column?: { id: string; name: string } | null;
}

export interface PageIntegrationSubmission {
  id: string;
  integration_id: string;
  lead_id: string | null;
  status: 'novo' | 'atualizado' | 'teste' | 'erro';
  payload: Record<string, any>;
  error: string | null;
  origin: string | null;
  created_at: string;
}

export const CAPTURA_BASE_URL = 'https://iasinstituto.com.br';

export const capturaEndpoint = (i: Pick<PageIntegration, 'slug' | 'public_key'>) =>
  `${CAPTURA_BASE_URL}/.netlify/functions/captura-pagina?f=${encodeURIComponent(i.slug)}&chave=${i.public_key}`;

export const slugify = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const usePageIntegrations = () =>
  useQuery({
    queryKey: ['page-integrations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('page_integrations')
        .select('*, board:crm_boards(id, name), column:crm_columns(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PageIntegration[];
    },
  });

export const usePageIntegrationSubmissions = (integrationId: string | undefined) =>
  useQuery({
    queryKey: ['page-integration-submissions', integrationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('page_integration_submissions')
        .select('*')
        .eq('integration_id', integrationId!)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as PageIntegrationSubmission[];
    },
    enabled: !!integrationId,
    refetchInterval: 15000,
  });

export type PageIntegrationInput = Pick<
  PageIntegration,
  'name' | 'slug' | 'board_id' | 'column_id' | 'tags' | 'redirect_url' | 'success_message' | 'is_active'
> & { id?: string };

export const useSavePageIntegration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PageIntegrationInput) => {
      const query = id
        ? (supabase as any).from('page_integrations').update(payload).eq('id', id)
        : (supabase as any).from('page_integrations').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma integração com esse identificador');
        throw error;
      }
      return data as PageIntegration;
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['page-integrations'] });
      toast.success(input.id ? 'Integração atualizada' : 'Integração criada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar integração'),
  });
};

export const useTogglePageIntegration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from('page_integrations').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['page-integrations'] });
      toast.success(v.is_active ? 'Integração ativada' : 'Integração pausada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao alterar integração'),
  });
};

export const useDeletePageIntegration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('page_integrations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['page-integrations'] });
      toast.success('Integração excluída');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir integração'),
  });
};

/** Envio de teste: valida chave, quadro e campos sem criar card (?teste=1). */
export const useTestPageIntegration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: PageIntegration) => {
      const res = await fetch(`${capturaEndpoint(i)}&teste=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Lead de Teste', email: 'teste@exemplo.com', telefone: '11999999999', utm_source: 'teste' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || `Erro ${res.status}`);
      return body;
    },
    onSuccess: (_, i) => {
      qc.invalidateQueries({ queryKey: ['page-integration-submissions', i.id] });
      toast.success('Teste OK: a página consegue enviar leads pra essa integração');
    },
    onError: (e: any) => toast.error(`Teste falhou: ${e.message}`),
  });
};
