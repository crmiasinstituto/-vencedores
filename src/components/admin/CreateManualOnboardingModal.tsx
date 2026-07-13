import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Instagram, Loader2, Target, Lightbulb, Zap, TrendingUp,
  User, Phone, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIInsights {
  nicho: string;
  sugestoes_ia: string[];
  automacoes_recomendadas: string[];
  experiencia_cliente: string[];
  gestao_empresarial: string[];
  customer_success: string[];
  pontos_dor: string[];
  potencial_captacao: string;
  potencial_vendas: string;
  potencial_gestao: string;
}

interface CreateManualOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (onboardingLink: string, token: string) => void;
}

export function CreateManualOnboardingModal({ open, onClose, onSuccess }: CreateManualOnboardingModalProps) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [instagramData, setInstagramData] = useState<any>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  async function analyzeInstagram() {
    if (!instagram.trim()) {
      toast.error('Digite o Instagram para analisar');
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-client-insights', {
        body: {
          instagram_username: instagram,
          client_name: name,
          company_name: companyName,
          whatsapp: whatsapp
        }
      });

      if (error) throw error;

      if (data.success) {
        setInsights(data.aiInsights);
        setInstagramData(data.instagramData);
        setProfilePicUrl(data.profilePicUrl);
        toast.success('Análise concluída!');
      } else {
        toast.error(data.error || 'Erro ao analisar perfil');
      }
    } catch (err) {
      console.error('Erro ao analisar Instagram:', err);
      toast.error('Erro ao analisar perfil do Instagram');
    } finally {
      setAnalyzing(false);
    }
  }

  async function createOnboarding() {
    if (!name.trim() || !whatsapp.trim() || !companyName.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setCreating(true);
    try {
      // Create lead first
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: name.trim(),
          whatsapp: whatsapp.replace(/\D/g, ''),
          instagram: instagram.trim() || null,
          instagram_data: instagramData,
          instagram_profile_pic_url: profilePicUrl,
          source: 'manual_admin'
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Generate token
      const token = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      // Create client with insights
      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          lead_id: leadData.id,
          company_name: companyName.trim(),
          responsible_name: name.trim(),
          onboarding_token: token,
          status: 'pending',
          onboarding_step: 1
        } as any);

      if (clientError) throw clientError;

      const link = `${window.location.origin}/onboarding/${token}`;
      toast.success('Onboarding criado com sucesso!');
      
      // Reset form
      setName('');
      setWhatsapp('');
      setInstagram('');
      setCompanyName('');
      setInsights(null);
      setInstagramData(null);
      setProfilePicUrl(null);
      
      onSuccess(link, token);
    } catch (err) {
      console.error('Erro ao criar onboarding:', err);
      toast.error('Erro ao criar onboarding');
    } finally {
      setCreating(false);
    }
  }

  const getPotentialBadge = (value: string) => {
    const level = value.split(' - ')[0].toLowerCase();
    const colors = {
      alto: 'bg-green-500/20 text-green-400',
      médio: 'bg-yellow-500/20 text-yellow-400',
      baixo: 'bg-red-500/20 text-red-400'
    };
    return colors[level as keyof typeof colors] || colors.médio;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Criar Onboarding Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Profile Picture Preview */}
          {profilePicUrl && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center"
            >
              <img
                src={profilePicUrl}
                alt={name}
                className="w-20 h-20 rounded-full border-2 border-primary/30 object-cover"
              />
            </motion.div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Nome do Responsável *
              </Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                WhatsApp *
              </Label>
              <Input
                id="whatsapp"
                placeholder="(XX) XXXXX-XXXX"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                maxLength={15}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram" className="flex items-center gap-1">
                <Instagram className="w-3 h-3" />
                Instagram (opcional)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="instagram"
                  placeholder="@usuario"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={analyzeInstagram}
                  disabled={analyzing || !instagram.trim()}
                  className="whitespace-nowrap"
                >
                  {analyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Analisar</>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Nome da Empresa *
              </Label>
              <Input
                id="company"
                placeholder="Ex: Clínica São Lucas"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>

          {/* Instagram Data Preview */}
          {instagramData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-muted/30 rounded-lg p-4 space-y-2"
            >
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                Dados do Instagram
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Seguidores:</span>
                  <span className="ml-2 font-medium">{instagramData.followers?.toLocaleString('pt-BR')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Seguindo:</span>
                  <span className="ml-2 font-medium">{instagramData.following?.toLocaleString('pt-BR')}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Categoria:</span>
                  <span className="ml-2">{instagramData.category}</span>
                </div>
                {instagramData.biography && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Bio:</span>
                    <p className="mt-1 text-foreground">{instagramData.biography}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* AI Insights */}
          <AnimatePresence>
            {insights && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="border-t border-border pt-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-primary" />
                    Insights do Perfil
                  </h3>

                  {/* Niche */}
                  <div className="bg-primary/10 rounded-lg p-4 mb-4">
                    <p className="text-xs text-muted-foreground mb-1">🎯 Nicho Identificado</p>
                    <p className="font-medium text-foreground">{insights.nicho}</p>
                  </div>

                  {/* Potential Badges */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className={`rounded-lg p-3 text-center ${getPotentialBadge(insights.potencial_captacao)}`}>
                      <p className="text-xs opacity-80">Captação</p>
                      <p className="font-bold text-sm">{insights.potencial_captacao.split(' - ')[0]}</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${getPotentialBadge(insights.potencial_vendas)}`}>
                      <p className="text-xs opacity-80">Vendas</p>
                      <p className="font-bold text-sm">{insights.potencial_vendas.split(' - ')[0]}</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${getPotentialBadge(insights.potencial_gestao)}`}>
                      <p className="text-xs opacity-80">Gestão</p>
                      <p className="font-bold text-sm">{insights.potencial_gestao.split(' - ')[0]}</p>
                    </div>
                  </div>

                  {/* AI Suggestions */}
                  {insights.sugestoes_ia.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        Sugestões de IA
                      </p>
                      <ul className="space-y-1">
                        {insights.sugestoes_ia.map((sugestao, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {sugestao}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Automations */}
                  {insights.automacoes_recomendadas.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Automações Recomendadas
                      </p>
                      <ul className="space-y-1">
                        {insights.automacoes_recomendadas.map((auto, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-yellow-500">⚡</span>
                            {auto}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pain Points */}
                  {insights.pontos_dor?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Pontos de Dor Detectados
                      </p>
                      <ul className="space-y-1">
                        {insights.pontos_dor.map((dor, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-red-500">!</span>
                            {dor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Customer Experience */}
                  {insights.experiencia_cliente?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        ✨ Experiência do Cliente
                      </p>
                      <ul className="space-y-1">
                        {insights.experiencia_cliente.map((exp, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-purple-500">★</span>
                            {exp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Business Management */}
                  {insights.gestao_empresarial?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        📊 Gestão Empresarial
                      </p>
                      <ul className="space-y-1">
                        {insights.gestao_empresarial.map((gestao, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-blue-500">📈</span>
                            {gestao}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Customer Success */}
                  {insights.customer_success?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        🎯 Customer Success
                      </p>
                      <ul className="space-y-1">
                        {insights.customer_success.map((cs, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-green-500">✓</span>
                            {cs}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={createOnboarding}
            disabled={creating || !name.trim() || !whatsapp.trim() || !companyName.trim()}
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Onboarding'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
