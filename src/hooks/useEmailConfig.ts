import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailConfig {
  id: 'singleton';
  resend_api_key: string | null;
  resend_webhook_secret: string | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  company_address: string | null;
  company_name: string | null;
  app_url: string | null;
  is_active: boolean;
  domain_verified: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailConfig() {
  return useQuery({
    queryKey: ['email-config'],
    queryFn: async (): Promise<EmailConfig | null> => {
      const { data, error } = await supabase
        .from('email_config' as any)
        // Colunas explícitas: `resend_api_key` não é mais concedida ao browser, então
        // `select('*')` volta 42501 e a tela de e-mail carregaria vazia. Para saber se a
        // chave existe há `tem_api_key`, que é coluna gerada.
        .select('id, resend_webhook_secret, from_email, from_name, reply_to, company_address, company_name, app_url, is_active, domain_verified, created_at, updated_at, tem_api_key')
        .eq('id', 'singleton')
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EmailConfig) || null;
    },
  });
}

export function useSaveEmailConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Omit<EmailConfig, 'id' | 'created_at' | 'updated_at'>>) => {
      const { data, error } = await supabase
        .from('email_config' as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', 'singleton')
        .select('id, resend_webhook_secret, from_email, from_name, reply_to, company_address, company_name, app_url, is_active, domain_verified, created_at, updated_at, tem_api_key')
        .single();
      if (error) throw error;
      return data as unknown as EmailConfig;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-config'] });
    },
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: async ({ to, subject, html }: { to: string; subject?: string; html: string }) => {
      const { data, error } = await supabase.functions.invoke('send-email-campaign', {
        body: { test_email: to, subject: subject || 'Teste de configuração + que Vencedores', html },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
  });
}
