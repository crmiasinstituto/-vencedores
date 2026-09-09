import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppTemplate {
  id: string;
  meta_template_id: string | null;
  meta_waba_id: string | null;
  name: string;
  category: string;
  language: string;
  status: string;
  rejection_reason: string | null;
  components: any[];
  example_values: Record<string, any>;
  variables_count: number;
  internal_tags: string[];
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  /** De qual número o template é (vem da view). */
  linha_nome?: string | null;
  linha_numero?: string | null;
  instance_id?: string | null;
}

/** Preenchidos pela view: de qual número (WABA) o template é. */
export interface WhatsAppTemplateLinha {
  linha_nome: string | null;
  linha_numero: string | null;
  instance_id: string | null;
}

export interface WhatsAppTemplateTag {
  id: string;
  slug: string;
  label: string;
  color: string;
  icon: string | null;
  position: number;
}

// ===================== TEMPLATES =====================

export const useWhatsAppTemplates = () => {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async (): Promise<WhatsAppTemplate[]> => {
      // Vem da view (e não da tabela) porque template da Cloud API pertence a um NÚMERO:
      // cada linha tem seu WABA. Sem saber de quem é cada template, os 44 viram uma lista
      // só e ninguém distingue o que é do IAS do que é do Coexistente.
      const { data, error } = await (supabase as any)
        .from("whatsapp_cloud_templates_com_linha")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WhatsAppTemplate[];
    },
  });
};

export const useSyncWhatsAppTemplates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("wa-sync-templates", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        success: boolean;
        total: number;
        upserted: number;
        linhas?: { linha: string; waba_id: string; encontrados: number; salvos: number; erro: string | null }[];
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
};

export const useUpdateTemplateTags = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, internal_tags }: { id: string; internal_tags: string[] }) => {
      const { error } = await supabase
        .from("whatsapp_cloud_templates")
        .update({ internal_tags })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_cloud_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });
};

// ===================== TAGS =====================

export const useWhatsAppTemplateTags = () => {
  return useQuery({
    queryKey: ["whatsapp-template-tags"],
    queryFn: async (): Promise<WhatsAppTemplateTag[]> => {
      const { data, error } = await supabase
        .from("whatsapp_template_tags")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as WhatsAppTemplateTag[];
    },
  });
};

export const useUpsertTemplateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tag: Partial<WhatsAppTemplateTag> & { slug: string; label: string }) => {
      if (tag.id) {
        const { error } = await supabase
          .from("whatsapp_template_tags")
          .update(tag)
          .eq("id", tag.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_template_tags")
          .insert(tag);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-template-tags"] });
    },
  });
};

export const useDeleteTemplateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_template_tags")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-template-tags"] });
    },
  });
};

// ────────────────────────────────────────────
// CRIAR TEMPLATE META (envia pra aprovação)
// ────────────────────────────────────────────

export type CloudTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export interface CloudTemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface CloudTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
  buttons?: CloudTemplateButton[];
}

export interface CreateCloudTemplateInput {
  name: string;
  category: CloudTemplateCategory;
  language: string;
  components: CloudTemplateComponent[];
}

export const useCreateCloudTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCloudTemplateInput) => {
      const { data, error } = await supabase.functions.invoke('wa-create-template', {
        body: input,
      });
      // Quando edge retorna non-2xx, supabase joga em `error` mas a resposta JSON
      // ainda está acessivel via error.context. Sem isso o user só vê "non-2xx status code".
      if (error) {
        let metaMsg = '';
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            metaMsg = body?.error || body?.meta_error?.message || body?.meta_error?.error_user_msg || '';
            if (body?.meta_error?.error_user_title) {
              metaMsg = `${body.meta_error.error_user_title}: ${metaMsg || body.meta_error.message}`;
            }
          }
        } catch {/* ignore parse errors */}
        throw new Error(metaMsg || error.message || 'Erro desconhecido ao criar template');
      }
      if ((data as any)?.error) {
        const md = (data as any).meta_error;
        const detailed = md?.error_user_msg || md?.message || (data as any).error;
        throw new Error(detailed);
      }
      return data as { success: boolean; template?: any; status?: string; message?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
    },
  });
};
