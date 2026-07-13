import React, { useState, useEffect } from 'react';
import { User, Instagram, Phone, Mail, Building, MapPin, Tag, Star, ShoppingBag, ExternalLink, RefreshCw, Sparkles, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CallButton } from '@/components/calls/CallButton';
import { WhatsAppChat } from './WhatsAppChat';
import { toast } from 'sonner';

interface LeadProfileTabProps {
  lead: {
    id: string;
    name: string;
    whatsapp: string;
    email?: string;
    instagram?: string;
    instagram_profile_pic_url?: string;
    company_name?: string;
    notes?: string;
    tags?: string[];
    lead_score: number;
    potential_value?: number;
    priority: string;
    source?: string;
    created_at?: string;
  };
}

interface InstagramData {
  biography?: string;
  followers?: number;
  following?: number;
  category?: string;
  profilePicUrl?: string;
  posts?: string[];
  stories?: string[];
  highlights?: string[];
  name?: string;
  fullName?: string;
  personalizedMessage?: string;
}

export const LeadProfileTab: React.FC<LeadProfileTabProps> = ({ lead }) => {
  const [igData, setIgData] = useState<InstagramData | null>(null);
  const [isLoadingIg, setIsLoadingIg] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const fetchIgData = async () => {
      if (!lead.instagram) return;
      
      const { data: sourceLead } = await supabase
        .from('leads')
        .select('instagram_data')
        .or(`instagram.eq.${lead.instagram},instagram.eq.${lead.instagram.replace('@', '')}`)
        .not('instagram_data', 'is', null)
        .limit(1)
        .maybeSingle();
      
      if (sourceLead?.instagram_data) {
        setIgData(sourceLead.instagram_data as unknown as InstagramData);
      } else if (!lead.instagram_profile_pic_url) {
        handleAnalyzeInstagram();
      }
    };
    fetchIgData();
  }, [lead.instagram]);

  const handleAnalyzeInstagram = async () => {
    if (!lead.instagram) return;
    setIsAnalyzing(true);
    try {
      const cleanHandle = lead.instagram.replace('@', '');
      const { data, error } = await supabase.functions.invoke('analyze-instagram-profile', {
        body: { username: cleanHandle, leadName: lead.name, context: 'vhs' }
      });
      if (error) throw error;
      if (data?.instagramData) {
        setIgData({
          ...data.instagramData,
          personalizedMessage: data.personalizedMessage
        });
        // Update lead with profile pic
        if (data.profilePicPath) {
          await supabase.from('crm_leads').update({
            instagram_profile_pic_url: data.profilePicPath
          }).eq('id', lead.id);
        }
        toast.success('Perfil do Instagram analisado!');
      }
    } catch (e: any) {
      toast.error('Erro ao analisar perfil: ' + (e.message || 'tente novamente'));
    }
    setIsAnalyzing(false);
  };

  const cleanHandle = lead.instagram?.replace('@', '') || '';

  return (
    <div className="space-y-5 overflow-auto max-h-[60vh] pr-1">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/10">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {lead.instagram_profile_pic_url ? (
              <img 
                src={lead.instagram_profile_pic_url} 
                alt={lead.name}
                className="w-20 h-20 rounded-full object-cover ring-3 ring-primary/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground">{lead.name}</h3>
            {lead.company_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building className="w-3.5 h-3.5" /> {lead.company_name}
              </p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <CallButton phoneNumber={lead.whatsapp} leadId={lead.id} size="sm" />
              <Button 
                size="sm" variant="outline"
                className="h-8 text-xs border-green-500/30 text-green-500 hover:bg-green-500/10"
                onClick={() => setShowChat(true)}
              >
                <Phone className="w-3.5 h-3.5 mr-1" /> WhatsApp
              </Button>
              {lead.instagram && (
                <a href={`https://instagram.com/${cleanHandle}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-8 text-xs border-pink-500/30 text-pink-400 hover:bg-pink-500/10">
                    <Instagram className="w-3.5 h-3.5 mr-1" /> Instagram
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCard icon={Phone} label="WhatsApp" value={lead.whatsapp} />
        {lead.email && <InfoCard icon={Mail} label="Email" value={lead.email} />}
        {lead.source && <InfoCard icon={MapPin} label="Origem" value={lead.source} />}
        <InfoCard icon={Star} label="Score" value={`${lead.lead_score}/100`} />
        {lead.potential_value && lead.potential_value > 0 && (
          <InfoCard icon={ShoppingBag} label="Valor Potencial" value={`R$ ${lead.potential_value.toLocaleString('pt-BR')}`} />
        )}
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Tags
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {lead.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Instagram Data */}
      {lead.instagram && (
        <div className="border border-pink-500/20 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 px-4 py-2.5 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-pink-400 flex items-center gap-1.5">
              <Instagram className="w-4 h-4" /> @{cleanHandle}
            </h4>
            <Button 
              size="sm" variant="ghost" 
              className="h-7 text-xs text-pink-400 hover:bg-pink-500/10"
              onClick={handleAnalyzeInstagram}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              {isAnalyzing ? 'Analisando...' : igData ? 'Reanalisar' : 'Analisar Perfil'}
            </Button>
          </div>

          {igData ? (
            <div className="p-4 space-y-3">
              {/* Stats */}
              <div className="flex items-center gap-4">
                {igData.followers != null && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{igData.followers.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Seguidores</p>
                  </div>
                )}
                {igData.following != null && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{igData.following.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Seguindo</p>
                  </div>
                )}
                {igData.category && (
                  <Badge variant="outline" className="text-xs text-pink-400 border-pink-500/30">
                    {igData.category}
                  </Badge>
                )}
              </div>

              {/* Bio */}
              {igData.biography && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Bio</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{igData.biography}</p>
                </div>
              )}

              {/* Highlights */}
              {igData.highlights && igData.highlights.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">Destaques</p>
                  <div className="flex flex-wrap gap-1.5">
                    {igData.highlights.map((h, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">⭐ {h}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Personalized Message */}
              {igData.personalizedMessage && (
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-3 border border-primary/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">Mensagem IA Personalizada</span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{igData.personalizedMessage}</p>
                  <Button 
                    size="sm" variant="outline" className="mt-2 h-6 text-[10px]"
                    onClick={() => {
                      navigator.clipboard.writeText(igData.personalizedMessage!);
                      toast.success('Mensagem copiada!');
                    }}
                  >
                    📋 Copiar Mensagem
                  </Button>
                </div>
              )}

              {/* Recent posts */}
              {igData.posts && igData.posts.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2">Posts Recentes</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {igData.posts.slice(0, 5).map((post, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-2.5 text-xs text-foreground/80 line-clamp-3">
                        {post}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Clique em "Analisar Perfil" para carregar dados do Instagram
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {lead.notes && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notas</h4>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap bg-muted/20 rounded-lg p-3">{lead.notes}</p>
        </div>
      )}

      {/* WhatsApp Chat inline */}
      {showChat && (
        <WhatsAppChat
          leadId={lead.id}
          leadName={lead.name}
          leadPhone={lead.whatsapp}
          leadProfilePic={lead.instagram_profile_pic_url}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  );
}
