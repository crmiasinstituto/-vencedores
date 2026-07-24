import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/maisvencedores/components/shared/Logo';

/**
 * Casca das páginas legais do + que Vencedores (Privacidade e Termos). Fundo escuro fixo,
 * fora do tema do app — são páginas públicas, autossuficientes, linkadas no rodapé da landing
 * e usadas como URL de política nos apps da Meta/Eduzz.
 */
export function LegalLayout({
  titulo,
  atualizacao,
  children,
}: {
  titulo: string;
  atualizacao: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#06090f] text-[#c4cdde]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#06090f]/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/maisvencedores" aria-label="Ir para o início">
            <Logo tone="branca" className="h-7" />
          </Link>
          <Link
            to="/maisvencedores"
            className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">{titulo}</h1>
        <p className="mb-10 text-sm text-white/45">Última atualização: {atualizacao}</p>
        <div className="space-y-9 text-[15px] leading-relaxed">{children}</div>

        <footer className="mt-16 border-t border-white/10 pt-6 text-sm text-white/45">
          <p>IAS Institute LTDA — Comunidade + que Vencedores · Rua Patativas 308, Sala 406, Imbui, Salvador/BA.</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/maisvencedores/privacidade" className="underline hover:text-white">Política de Privacidade</Link>
            <Link to="/maisvencedores/termos" className="underline hover:text-white">Termos de Uso</Link>
            <a href="mailto:contato@iasinstituto.com.br" className="underline hover:text-white">contato@iasinstituto.com.br</a>
          </p>
        </footer>
      </main>
    </div>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-white">{titulo}</h2>
      <div className="space-y-3 text-white/70">{children}</div>
    </section>
  );
}
