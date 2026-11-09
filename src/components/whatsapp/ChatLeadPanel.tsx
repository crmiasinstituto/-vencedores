import React, { useState, useEffect, useCallback } from 'react';
import { User, Clock, Phone, Instagram, Tag, Star, MapPin, ShoppingBag, MessageSquare, Calendar, Layers, RefreshCw, Zap, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatContact } from './ChatContactList';
import { LeadDetailModal } from '@/components/crm/LeadDetailModal';
import { nomeValido } from '@/lib/whatsapp-display';
import { NaoContatarButton } from '@/components/crm/NaoContatarButton';

interface LeadInfo {
  id: string;
  name: string;
  whatsapp: string;
  instagram?: string | null;
  instagram_profile_pic_url?: string | null;
  email?: string | null;
  company_name?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  lead_score: number;
  priority: string;
  source?: string | null;
  created_at: string;
  updated_at?: string | null;
  column_name?: string | null;
  column_color?: string | null;
  board_name?: string | null;
  board_color?: string | null;
  potential_value?: number | null;
}

interface SaleInfo {
  product_name: string;
  amount: number;
  created_at: string;
}

interface LastContactInfo {
  direction: string;
  created_at: string;
  content: string | null;
}

interface ChatLeadPanelProps {
  contact: ChatContact;
}

function normalizeBRPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('55') && clean.length === 12) {
    return clean.slice(0, 4) + '9' + clean.slice(4);
  }
  return clean;
}

export const ChatLeadPanel: React.FC<ChatLeadPanelProps> = ({ contact }) => {
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [sales, setSales] = useState<SaleInfo[]>([]);
  const [lastContact, setLastContact] = useState<LastContactInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappPic, setWhatsappPic] = useState<string | null>(null);
  const [instagramPic, setInstagramPic] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string>(nomeValido(contact.name) || contact.phone);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadColumns, setLeadColumns] = useState<{ id: string; name: string }[]>([]);

  const fetchChatDetails = useCallback(async () => {
    setIsFetchingDetails(true);
    try {
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('status', 'connected')
        .limit(1);

      if (instances?.[0]) {
        const res = await supabase.functions.invoke('uazapi-proxy', {
          body: { action: 'chat_details', instance_id: instances[0].id, number: contact.phone },
        });
        const details = res.data?.data;
        if (details) {
          const pic = details.image || details.imagePreview || null;
          const waName = details.lead_name || details.wa_name || details.wa_contactName || details.name || null;
          if (pic) setWhatsappPic(pic);
          // Only use WhatsApp name if no CRM lead name exists
          if (nomeValido(waName) && waName.length > 1 && !nomeValido(lead?.name)) setContactName(waName);

          // Update CRM lead if found
          if (lead?.id) {
            const updateData: any = {};
            if (pic && !lead.whatsapp_profile_pic_url) updateData.whatsapp_profile_pic_url = pic;
            // Don't overwrite CRM lead name with WhatsApp profile name
            if (Object.keys(updateData).length > 0) {
              await supabase.from('crm_leads').update(updateData).eq('id', lead.id);
            }
          }
        }
      }
    } catch (e) { console.error(e); }
    setIsFetchingDetails(false);
  }, [contact.phone, lead]);

  useEffect(() => {
    // Reset all state on contact change
    setLead(null);
    setSales([]);
    setLastContact(null);
    setWhatsappPic(null);
    setInstagramPic(null);
    setContactName(nomeValido(contact.name) || contact.phone);

    const fetchData = async () => {
      setIsLoading(true);
      const cleanPhone = normalizeBRPhone(contact.phone);

      // Find lead
      let foundLead: any = null;

      if (contact.leadId) {
        const { data } = await supabase
          .from('crm_leads')
          .select('*, crm_columns(name, color), crm_boards(name, color)')
          .eq('id', contact.leadId)
          .single();
        if (data) foundLead = data;
      }

      if (!foundLead) {
        const phoneVariants = [cleanPhone];
        if (cleanPhone.startsWith('55')) {
          phoneVariants.push(cleanPhone.slice(2));
          if (cleanPhone.length === 13) phoneVariants.push(cleanPhone.slice(0, 4) + cleanPhone.slice(5));
        } else {
          phoneVariants.push('55' + cleanPhone);
        }

        for (const phone of phoneVariants) {
          const { data: leads } = await supabase
            .from('crm_leads')
            .select('*, crm_columns(name, color), crm_boards(name, color)')
            .or(`whatsapp.ilike.%${phone}%`)
            .limit(1);
          if (leads && leads.length > 0) { foundLead = leads[0]; break; }
        }
      }

      if (foundLead) {
        const col = foundLead.crm_columns as any;
        const board = foundLead.crm_boards as any;
        const leadInfo: LeadInfo = {
          ...foundLead,
          column_name: col?.name || null,
          column_color: col?.color || null,
          board_name: board?.name || null,
          board_color: board?.color || null,
        };
        setLead(leadInfo);
        if (leadInfo.instagram_profile_pic_url) setInstagramPic(leadInfo.instagram_profile_pic_url);
        if (nomeValido(leadInfo.name)) setContactName(leadInfo.name);

        const { data: salesData } = await supabase
          .from('sales_events')
          .select('product_name, amount, created_at')
          .eq('crm_lead_id', foundLead.id)
          .order('created_at', { ascending: false })
          .limit(5);
        if (salesData) setSales(salesData);
      }

      // Get pic/name from message metadata
      const { data: lastMsgWithMeta } = await supabase
        .from('whatsapp_messages')
        .select('metadata')
        .or(`remote_phone.ilike.%${cleanPhone.slice(-8)}%`)
        .not('metadata', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastMsgWithMeta?.[0]?.metadata) {
        const meta = lastMsgWithMeta[0].metadata as any;
        const metaPic = meta.chat_details_pic || meta.chat_imagePreview || meta.chat_image || null;
        if (metaPic) setWhatsappPic(metaPic);
        if (nomeValido(meta.chat_details_name) && !foundLead) setContactName(meta.chat_details_name);
        if (nomeValido(meta.senderName) && !foundLead && contactName === contact.name) setContactName(meta.senderName);
      }

      // Last message
      const leadId = foundLead?.id || contact.leadId || '00000000-0000-0000-0000-000000000000';
      const { data: lastMsg } = await supabase
        .from('whatsapp_messages')
        .select('direction, created_at, content')
        .or(`lead_id.eq.${leadId},remote_phone.ilike.%${cleanPhone.slice(-8)}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (lastMsg && lastMsg.length > 0) setLastContact(lastMsg[0]);

      setIsLoading(false);
    };

    fetchData();
  }, [contact.leadId, contact.phone, contact.id]);

  // Auto-fetch chat details on contact change
  useEffect(() => {
    if (!isLoading) {
      fetchChatDetails();
    }
  }, [contact.id, isLoading]);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto border-l border-border bg-card p-4">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-20 h-20 rounded-full bg-muted" />
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-3 bg-muted rounded w-24" />
          <div className="mt-6 space-y-4 w-full">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-2.5 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const timeInBase = lead?.created_at
    ? formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ptBR })
    : null;

  const hasDualPics = whatsappPic && instagramPic && whatsappPic !== instagramPic;
  const displayPic = instagramPic || whatsappPic || contact.profilePic;

  return (
    <div className="h-full overflow-y-auto border-l border-border bg-card">
      {/* Profile header */}
      <div className="p-4 border-b border-border text-center bg-gradient-to-b from-green-950/20 to-transparent">
        {/* Dual or single profile pic */}
        <div className="flex justify-center mb-3">
          {hasDualPics ? (
            <div className="relative w-24 h-20">
              <img
                src={instagramPic!}
                alt="Instagram"
                className="absolute left-0 top-0 w-16 h-16 rounded-full object-cover ring-2 ring-pink-500/40 z-10"
                title="Instagram"
              />
              <img
                src={whatsappPic!}
                alt="WhatsApp"
                className="absolute right-0 bottom-0 w-14 h-14 rounded-full object-cover ring-2 ring-green-500/40"
                title="WhatsApp"
              />
            </div>
          ) : displayPic ? (
            <img
              src={displayPic}
              alt=""
              className="w-20 h-20 rounded-full object-cover ring-2 ring-green-500/30"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600/30 to-emerald-700/30 flex items-center justify-center">
              <User className="w-10 h-10 text-green-400" />
            </div>
          )}
        </div>

        <h3 className="font-bold text-foreground text-lg">{contactName}</h3>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
          <Phone className="w-3 h-3" /> {formatPhone(contact.phone)}
        </p>
        {lead?.instagram && (
          <a
            href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-pink-400 hover:text-pink-300 flex items-center justify-center gap-1 mt-1 transition-colors"
          >
            <Instagram className="w-3 h-3" /> @{lead.instagram.replace('@', '')}
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs text-muted-foreground hover:text-green-400 transition-colors"
          onClick={fetchChatDetails}
          disabled={isFetchingDetails}
        >
          {isFetchingDetails ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
          {isFetchingDetails ? 'Sincronizando...' : 'Sincronizar dados'}
        </Button>
        {lead && (
          <div className="mt-2 flex justify-center">
            <NaoContatarButton leadId={lead.id} />
          </div>
        )}
        {lead && (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10 w-full"
            onClick={async () => {
              const { data: cols } = await supabase.from('crm_columns').select('id, name').order('sort_order');
              setLeadColumns(cols || []);
              setShowLeadModal(true);
            }}
          >
            <History className="w-3 h-3 mr-1" /> Ver Histórico Completo
          </Button>
        )}
      </div>

      {/* Info sections */}
      <div className="p-4 space-y-4">
        {!lead && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-xs text-yellow-400 font-medium">⚠️ Contato não encontrado no CRM</p>
            <p className="text-[10px] text-muted-foreground mt-1">Este contato ainda não é um lead cadastrado.</p>
          </div>
        )}

        {lead?.column_name && (
          <InfoBlock icon={Layers} label="Etapa do Kanban">
            <div className="flex items-center gap-2">
              {lead.board_name && (
                <Badge variant="outline" className="text-[10px]">{lead.board_name}</Badge>
              )}
              <Badge className="text-xs" style={{ backgroundColor: lead.column_color || undefined }}>
                {lead.column_name}
              </Badge>
            </div>
          </InfoBlock>
        )}

        {timeInBase && (
          <InfoBlock icon={Clock} label="Tempo na base">
            <span className="text-sm text-foreground">{timeInBase}</span>
          </InfoBlock>
        )}

        {lastContact && (
          <InfoBlock icon={MessageSquare} label="Último contato">
            <div>
              <span className="text-xs text-muted-foreground">
                {lastContact.direction === 'inbound' ? '📩 Recebido' : '📤 Enviado'}{' '}
                {formatDistanceToNow(new Date(lastContact.created_at), { addSuffix: true, locale: ptBR })}
              </span>
              {lastContact.content && (
                <p className="text-xs text-foreground/70 mt-0.5 line-clamp-2">{lastContact.content}</p>
              )}
            </div>
          </InfoBlock>
        )}

        {lead && (
          <InfoBlock icon={Star} label="Prioridade / Score">
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${getPriorityColor(lead.priority)}`}>
                {lead.priority === 'urgent' ? '🔥' : lead.priority === 'high' ? '⚡' : ''}
                {lead.priority}
              </Badge>
              {lead.lead_score > 0 && (
                <Badge variant="outline" className="text-xs text-primary border-primary/30">
                  ⭐ {lead.lead_score}
                </Badge>
              )}
            </div>
          </InfoBlock>
        )}

        {lead?.potential_value && lead.potential_value > 0 && (
          <InfoBlock icon={ShoppingBag} label="Valor potencial">
            <span className="text-sm font-semibold text-green-400">
              R$ {lead.potential_value.toLocaleString('pt-BR')}
            </span>
          </InfoBlock>
        )}

        {lead?.source && (
          <InfoBlock icon={MapPin} label="Origem">
            <span className="text-sm text-foreground">{lead.source}</span>
          </InfoBlock>
        )}

        {lead?.tags && lead.tags.length > 0 && (
          <InfoBlock icon={Tag} label="Tags">
            <div className="flex flex-wrap gap-1">
              {lead.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          </InfoBlock>
        )}

        {sales.length > 0 && (
          <InfoBlock icon={ShoppingBag} label="Compras">
            <div className="space-y-1.5">
              {sales.map((sale, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{sale.product_name}</span>
                  <span className="text-green-400 font-medium">
                    R$ {sale.amount.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </InfoBlock>
        )}

        {lead?.company_name && (
          <InfoBlock icon={User} label="Empresa">
            <span className="text-sm text-foreground">{lead.company_name}</span>
          </InfoBlock>
        )}

        {lead?.notes && (
          <InfoBlock icon={MessageSquare} label="Notas">
            <p className="text-xs text-foreground/70 whitespace-pre-wrap">{lead.notes}</p>
          </InfoBlock>
        )}

        {lead?.created_at && (
          <InfoBlock icon={Calendar} label="Cadastrado em">
            <span className="text-xs text-foreground">
              {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </InfoBlock>
        )}
      </div>

      {showLeadModal && lead && (
        <LeadDetailModal
          isOpen={showLeadModal}
          onClose={() => setShowLeadModal(false)}
          lead={{
            id: lead.id,
            name: lead.name,
            whatsapp: lead.whatsapp,
            email: lead.email || undefined,
            instagram: lead.instagram || undefined,
            instagram_profile_pic_url: lead.instagram_profile_pic_url || undefined,
            company_name: lead.company_name || undefined,
            notes: lead.notes || undefined,
            tags: lead.tags || undefined,
            lead_score: lead.lead_score,
            potential_value: lead.potential_value || undefined,
            priority: lead.priority,
            source: lead.source || undefined,
            created_at: lead.created_at,
            column_id: '',
          }}
          columns={leadColumns}
          onSave={async (data) => {
            await supabase.from('crm_leads').update(data as any).eq('id', lead.id);
          }}
          mode="edit"
        />
      )}
    </div>
  );
};

function InfoBlock({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5 group-hover:text-green-400 transition-colors" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="ml-5">{children}</div>
    </div>
  );
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
}
