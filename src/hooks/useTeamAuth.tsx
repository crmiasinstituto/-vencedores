// Auth do TIME (acervo /time). Independente do Supabase Auth (admin) e do
// member-token (alunos). Login via RPC public.team_login (pgcrypto), sessao
// guardada em localStorage.squaad_team_session. O token vai no header
// x-team-token (injetado em client.ts) pra RLS dos drive_*.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const STORAGE_KEY = 'squaad_team_session';

interface StoredSession {
  token: string;
  user: TeamUser;
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.token === 'string' && parsed.token.length >= 16 && parsed?.user?.id) {
      return parsed as StoredSession;
    }
  } catch { /* ignore */ }
  return null;
}

export function useTeamAuth() {
  const [user, setUser] = useState<TeamUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = readSession();
    setUser(s?.user ?? null);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const { data, error } = await (supabase as any).rpc('team_login', {
      p_email: email.trim().toLowerCase(),
      p_password: password,
    });
    if (error) return { ok: false, error: 'Erro de conexao. Tente de novo.' };
    const res = data as any;
    if (!res || res.error) return { ok: false, error: res?.error || 'Falha no login' };
    const session: StoredSession = { token: res.token, user: res.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setUser(res.user);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    const s = readSession();
    if (s?.token) {
      try { await (supabase as any).rpc('team_logout', { p_token: s.token }); } catch { /* ignore */ }
    }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}

// Helper sincrono pro nome de quem esta logado no time (pra denormalizar
// uploaded_by / created_by). Retorna null se nao houver sessao de time.
export function currentTeamName(): string | null {
  return readSession()?.user?.name ?? null;
}
