// Marketing module — helper compartilhado para ler email_config singleton.
// Single-tenant: 1 ÚNICA row em `email_config` com id='singleton'.

export interface EmailConfig {
  id: string;
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
}

export async function getEmailConfig(supabase: any): Promise<EmailConfig | null> {
  const { data, error } = await supabase
    .from("email_config")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();
  if (error) {
    console.error("Erro ao ler email_config:", error);
    return null;
  }
  return data || null;
}

export function requireActiveConfig(config: EmailConfig | null): EmailConfig {
  if (!config) {
    throw new Error("email_config (singleton) não encontrado. Configure em Marketing → Email Config.");
  }
  if (!config.is_active) {
    throw new Error("Email marketing inativo. Ative em Marketing → Email Config após verificar domínio no Resend.");
  }
  if (!config.resend_api_key) {
    throw new Error("RESEND_API_KEY não configurada em email_config.");
  }
  if (!config.from_email) {
    throw new Error("from_email não configurado em email_config.");
  }
  return config;
}
