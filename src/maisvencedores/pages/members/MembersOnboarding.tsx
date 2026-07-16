import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMembership } from '@/maisvencedores/contexts/MembershipContext';
import { PROFISSOES_SUGERIDAS } from '@/maisvencedores/types/member';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, ArrowLeft, Check, User, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Onboarding do membro.
 *
 * Antes eram 4 passos girando em torno da empresa: Nome da Empresa, Segmento de Atuação, Anos
 * de Mercado, "Seu Título (ex: CEO & Founder)", Serviços separados por vírgula. Cara de
 * cadastro B2B.
 *
 * O ecossistema não é isso. Nas palavras do Carlos: "nada de profissional demais, quero falar
 * com Pessoas, esse ecossistema é transformador de vidas". Alguém que chega pra melhorar a vida
 * espiritual e os relacionamentos não tem "anos de mercado" — e perguntar isso na porta diz
 * pra pessoa errada que ela está no lugar errado.
 *
 * Ficaram dois passos e cinco campos: nome completo, telefone, email, instagram e profissão.
 */

const passos = [
  { icon: Sparkles, titulo: 'Boas-vindas', descricao: 'Que bom ter você aqui' },
  { icon: User, titulo: 'Sobre você', descricao: 'Cinco campos, um minuto' },
];

export default function MembersOnboarding() {
  const [passoAtual, setPassoAtual] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const { updateMember, currentMember } = useMembership();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState({
    nome_completo: currentMember?.nome_completo || currentMember?.owner_name || '',
    telefone: currentMember?.telefone || currentMember?.whatsapp || '',
    email: currentMember?.email || '',
    instagram: currentMember?.instagram || '',
    profissao: currentMember?.profissao || '',
    description: currentMember?.description || '',
  });

  const nomeOk = form.nome_completo.trim().length >= 3;

  const concluir = async () => {
    setSalvando(true);
    try {
      await updateMember({
        nome_completo: form.nome_completo.trim(),
        // owner_name continua preenchido: o portfólio e o ranking ainda leem dele.
        owner_name: form.nome_completo.trim(),
        telefone: form.telefone.trim(),
        whatsapp: form.telefone.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim().replace(/^@/, ''),
        profissao: form.profissao.trim(),
        description: form.description.trim(),
        onboarding_completed: true,
        is_new_member: false,
      });

      toast({
        title: 'Perfil salvo',
        description: 'Bem-vindo à comunidade.',
      });

      navigate('/maisvencedores/membros/dashboard');
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar seu perfil. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-80 bg-card/50 border-r border-border/50 p-8 flex-col">
        <span className="font-display text-xl font-bold text-foreground mb-12">
          <span className="text-primary">+</span> que Vencedores
        </span>

        <div className="space-y-6">
          {passos.map((passo, idx) => (
            <div key={passo.titulo} className="flex items-center gap-4">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  idx < passoAtual
                    ? 'bg-primary border-primary text-primary-foreground'
                    : idx === passoAtual
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground',
                )}
              >
                {idx < passoAtual ? <Check className="w-5 h-5" /> : <passo.icon className="w-5 h-5" />}
              </div>
              <div>
                <p className={cn('font-medium', idx <= passoAtual ? 'text-foreground' : 'text-muted-foreground')}>
                  {passo.titulo}
                </p>
                <p className="text-xs text-muted-foreground">{passo.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 p-8 flex items-center justify-center">
        <div className="w-full max-w-xl space-y-8">
          {passoAtual === 0 && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h1 className="text-3xl font-display font-bold">Que bom ter você aqui.</h1>
              <p className="text-muted-foreground">
                Antes de começar, queremos saber quem você é. São cinco campos — leva menos de um
                minuto.
              </p>
            </div>
          )}

          {passoAtual === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold">Sobre você</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  É assim que a comunidade vai te conhecer.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="nome" className="text-sm font-medium text-foreground">
                  Nome completo
                </label>
                <Input
                  id="nome"
                  placeholder="Como você se chama"
                  value={form.nome_completo}
                  onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="telefone" className="text-sm font-medium text-foreground">
                    Telefone
                  </label>
                  <Input
                    id="telefone"
                    type="tel"
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    E-mail
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="instagram" className="text-sm font-medium text-foreground">
                    Instagram
                  </label>
                  <Input
                    id="instagram"
                    placeholder="@seuperfil"
                    value={form.instagram}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="profissao" className="text-sm font-medium text-foreground">
                    Profissão
                  </label>
                  {/* Campo livre com sugestão, não Select: profissão não cabe numa lista
                      fechada, e barrar quem não se encaixa é o oposto do que o ecossistema é. */}
                  <Input
                    id="profissao"
                    list="profissoes"
                    placeholder="O que você faz"
                    value={form.profissao}
                    onChange={(e) => setForm({ ...form, profissao: e.target.value })}
                  />
                  <datalist id="profissoes">
                    {PROFISSOES_SUGERIDAS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="sobre" className="text-sm font-medium text-foreground">
                  Uma linha sobre você <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Textarea
                  id="sobre"
                  placeholder="O que te trouxe até aqui"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={140}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6">
            <Button variant="outline" onClick={() => setPassoAtual((s) => s - 1)} disabled={passoAtual === 0}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            {passoAtual < passos.length - 1 ? (
              <Button onClick={() => setPassoAtual((s) => s + 1)}>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={concluir} disabled={salvando || !nomeOk}>
                {salvando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Concluir
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
