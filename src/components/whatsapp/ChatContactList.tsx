import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MessageSquare, User, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatInstancePhone, shortInstanceName, getInstanceTag, describeInstance, InstanceIdentity } from '@/lib/whatsappInstance';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { nomeValido, previewMensagem } from '@/lib/whatsapp-display';

export interface ChatContact {
  id: string;
  leadId: string | null;
  name: string;
  phone: string;
  profilePic: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  boardId: string | null;
  isGroup?: boolean;
  lastSenderName?: string | null;
  /** instancia (numero) por onde a ultima mensagem dessa conversa passou */
  lastInstanceId?: string | null;
}

interface InstanceInfo extends InstanceIdentity {
  id: string;
}

interface ChatContactListProps {
  selectedContact: ChatContact | null;
  onSelectContact: (contact: ChatContact) => void;
}

function normalizeBRPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('55') && clean.length === 12) {
    return clean.slice(0, 4) + '9' + clean.slice(4);
  }
  return clean;
}

function formatPhoneDisplay(phone: string) {
  if (phone.length === 13 && phone.startsWith('55')) {
    return `+55 (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  if (phone.length === 11) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
  }
  return phone;
}

type ChatFilter = 'all' | 'unread' | 'read' | 'groups';

export const ChatContactList: React.FC<ChatContactListProps> = ({ selectedContact, onSelectContact }) => {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [crmResults, setCrmResults] = useState<ChatContact[]>([]);
  const [msgMatchPhones, setMsgMatchPhones] = useState<Set<string>>(new Set());
  // id -> instancia, pra mostrar por qual numero cada conversa entrou
  const [instanceMap, setInstanceMap] = useState<Record<string, InstanceInfo>>({});
  const contactsRef = useRef<ChatContact[]>([]);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadContacts = useCallback(async () => {
    // O banco devolve no máximo 1.000 linhas por consulta. Durante um disparo isso são só as
    // últimas mensagens da campanha, e as conversas anteriores sumiam da lista. Busca 3 lotes
    // ao mesmo tempo (3.000 mensagens mais recentes). Conversa mais antiga: use a busca.
    const lotes = await Promise.all([0, 1, 2].map((pagina) =>
      supabase
        .from('whatsapp_messages')
        .select('remote_phone, lead_id, board_id, content, created_at, direction, is_read, message_type, metadata, instance_id')
        .order('created_at', { ascending: false })
        .range(pagina * 1000, pagina * 1000 + 999),
    ));
    const messages: any[] = lotes.flatMap((l) => (l.data as any[]) || []);

    if (messages.length === 0) { setIsLoading(false); return; }

    // Group by NORMALIZED phone
    const phoneMap = new Map<string, any>();
    for (const msg of messages) {
      const rawPhone = msg.remote_phone?.replace(/\D/g, '');
      if (!rawPhone) continue;
      const phone = normalizeBRPhone(rawPhone);
      const meta = msg.metadata as any;
      const isGroup = meta?.isGroup === true;

      if (!phoneMap.has(phone)) {
        const contactName = meta?.contact_name || null;
        const senderName = msg.direction === 'inbound' ? (meta?.senderName || null) : null;
        const groupName = meta?.groupName || null;
        const chatPic = meta?.chat_details_pic || meta?.chat_imagePreview || meta?.chat_image || null;
        const lastSender = isGroup ? (meta?.senderName || null) : null;
        let preview = previewMensagem(msg.message_type, msg.content);
        
        phoneMap.set(phone, {
          phone, leadId: msg.lead_id, boardId: msg.board_id,
          lastMessage: preview, lastMessageAt: msg.created_at, unreadCount: 0,
          contactName, senderName, groupName, chatPic, isGroup, lastSenderName: lastSender,
          lastInstanceId: msg.instance_id || null,
        });
      }

      const existing = phoneMap.get(phone)!;
      if (!existing.contactName && meta?.contact_name) existing.contactName = meta.contact_name;
      if (!existing.senderName && msg.direction === 'inbound' && meta?.senderName) existing.senderName = meta.senderName;
      if (!existing.chatPic) existing.chatPic = meta?.chat_details_pic || meta?.chat_imagePreview || meta?.chat_image || null;
      // msg mais recente pode ser antiga sem instance_id — cai pra proxima que tiver
      if (!existing.lastInstanceId && msg.instance_id) existing.lastInstanceId = msg.instance_id;
      if (!msg.is_read && msg.direction === 'inbound') existing.unreadCount++;
    }

    // Enrich with CRM leads - now also fetch whatsapp_profile_pic_url
    // Busca só os leads das conversas da lista (por id e por telefone). Antes buscava "todos",
    // mas o banco corta em 1.000 de mais de 40 mil, e a maioria das conversas aparecia só com
    // o número em vez do nome.
    const colunasLead = 'id, name, whatsapp, instagram_profile_pic_url, whatsapp_profile_pic_url, board_id';
    const emLotes = <T,>(lista: T[], tam: number) => Array.from({ length: Math.ceil(lista.length / tam) }, (_, i) => lista.slice(i * tam, i * tam + tam));
    // 1) pelos lead_id das mensagens
    const leadIds = [...new Set([...phoneMap.values()].map((d: any) => d.leadId).filter(Boolean))] as string[];
    const porId = await Promise.all(emLotes(leadIds, 200).map((lote) => supabase.from('crm_leads').select(colunasLead).in('id', lote)));
    const achadosPorId = new Set<string>();
    for (const r of porId) for (const l of (r.data || []) as any[]) achadosPorId.add(l.id);
    // 2) pelo telefone, só nas conversas sem lead achado (com e sem o 9)
    const telefones = new Set<string>();
    for (const [phone, data] of phoneMap) {
      if (data.leadId && achadosPorId.has(data.leadId)) continue;
      telefones.add(phone);
      if (phone.startsWith('55') && phone.length === 13) telefones.add(phone.slice(0, 4) + phone.slice(5));
    }
    const porTelefone = await Promise.all(emLotes([...telefones], 300).map((lote) => supabase.from('crm_leads').select(colunasLead).in('whatsapp', lote)));
    const respostas = [...porId, ...porTelefone];
    const vistos = new Set<string>();
    const leads: any[] = [];
    for (const r of respostas) for (const l of (r.data || []) as any[]) if (!vistos.has(l.id)) { vistos.add(l.id); leads.push(l); }

    // Defesa em profundidade: se a mesma URL aparece em > 1 lead, é foto vazada
    // (UAZAPI as vezes retorna foto cacheada do contato errado). Conta ocorrencias
    // e zera a foto desses leads pra evitar exibir contato A com cara do contato B.
    // Ver [[wa-profile-pic-anti-leak]] e incidente Olavo/Gabriel 24/05/2026.
    const sharedWhatsappPics = new Set<string>();
    const sharedInstagramPics = new Set<string>();
    if (leads) {
      const waCounts = new Map<string, number>();
      const igCounts = new Map<string, number>();
      for (const lead of leads) {
        if (lead.whatsapp_profile_pic_url) {
          waCounts.set(lead.whatsapp_profile_pic_url, (waCounts.get(lead.whatsapp_profile_pic_url) || 0) + 1);
        }
        if (lead.instagram_profile_pic_url) {
          igCounts.set(lead.instagram_profile_pic_url, (igCounts.get(lead.instagram_profile_pic_url) || 0) + 1);
        }
      }
      for (const [url, count] of waCounts) if (count > 1) sharedWhatsappPics.add(url);
      for (const [url, count] of igCounts) if (count > 1) sharedInstagramPics.add(url);
    }

    const leadMap = new Map<string, any>();
    const phoneCollisions = new Map<string, string[]>(); // phone → [leadId, leadId, ...]
    if (leads) {
      for (const lead of leads) {
        const cleanPhone = normalizeBRPhone(lead.whatsapp?.replace(/\D/g, '') || '');
        if (!cleanPhone) continue;
        const existing = phoneCollisions.get(cleanPhone) || [];
        existing.push(lead.id);
        phoneCollisions.set(cleanPhone, existing);
        // Sanitiza fotos compartilhadas: nao deixa entrar no leadMap como se fossem dele
        const safeLead = {
          ...lead,
          whatsapp_profile_pic_url: lead.whatsapp_profile_pic_url && sharedWhatsappPics.has(lead.whatsapp_profile_pic_url)
            ? null
            : lead.whatsapp_profile_pic_url,
          instagram_profile_pic_url: lead.instagram_profile_pic_url && sharedInstagramPics.has(lead.instagram_profile_pic_url)
            ? null
            : lead.instagram_profile_pic_url,
        };
        // Em colisao, prioriza a lead com foto setada (geralmente a com mais
        // engajamento) — mas se nenhuma tem foto, mantem a primeira (sort do BD).
        const current = leadMap.get(cleanPhone);
        if (!current) {
          leadMap.set(cleanPhone, safeLead);
        } else if (!current.instagram_profile_pic_url && !current.whatsapp_profile_pic_url
                   && (safeLead.instagram_profile_pic_url || safeLead.whatsapp_profile_pic_url)) {
          leadMap.set(cleanPhone, safeLead);
        }
      }
    }

    const leadsPorId = new Map(leads.map((l) => [l.id, l]));
    const contactList: ChatContact[] = [];
    for (const [phone, data] of phoneMap) {
      const lead = (data.leadId ? leadsPorId.get(data.leadId) : undefined) || leadMap.get(phone);
      const name = nomeValido(lead?.name) || nomeValido(data.contactName) || nomeValido(data.senderName) || data.groupName || formatPhoneDisplay(phone);
      // Photo priority: chatPic da MENSAGEM (vem do numero correto via webhook)
      // > Instagram da lead > WhatsApp da lead. Antes a lead vinha primeiro,
      // o que misturava fotos quando dois leads tinham telefones que normalizavam
      // pro mesmo valor (ex: Victoria com 12 digitos vs Ana com 13).
      const pic = data.chatPic || lead?.instagram_profile_pic_url || lead?.whatsapp_profile_pic_url || null;

      contactList.push({
        id: phone, leadId: lead?.id || data.leadId, name, phone,
        profilePic: pic, lastMessage: data.lastMessage, lastMessageAt: data.lastMessageAt,
        unreadCount: data.unreadCount, boardId: lead?.board_id || data.boardId,
        isGroup: data.isGroup, lastSenderName: data.lastSenderName,
        lastInstanceId: data.lastInstanceId || null,
      });
    }

    contactList.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setContacts(contactList);
    contactsRef.current = contactList;
    setIsLoading(false);
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // Instancias: nome + numero + tipo (OFICIAL / COEX / NAO OFICIAL) de cada
  // conexao, pra etiquetar a conversa na lista.
  useEffect(() => {
    supabase
      .from('whatsapp_instances')
      .select('id, instance_name, phone_number, provider, purpose, notes')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, InstanceInfo> = {};
        (data as InstanceInfo[]).forEach(i => { map[i.id] = i; });
        setInstanceMap(map);
      });
  }, []);

  // Incremental realtime
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-contacts-list-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const newMsg = payload.new as any;
        const rawPhone = newMsg.remote_phone?.replace(/\D/g, '') || '';
        const phone = normalizeBRPhone(rawPhone);
        const meta = newMsg.metadata as any;
        const isGroup = meta?.isGroup === true;

        setContacts(prev => {
          const existing = prev.find(c => c.id === phone);
          const preview = previewMensagem(newMsg.message_type, newMsg.content);

          if (existing) {
            const updated: ChatContact = {
              ...existing, lastMessage: preview, lastMessageAt: newMsg.created_at,
              unreadCount: newMsg.direction === 'inbound' && !newMsg.is_read ? existing.unreadCount + 1 : existing.unreadCount,
              lastSenderName: isGroup ? (meta?.senderName || existing.lastSenderName) : null,
              lastInstanceId: newMsg.instance_id || existing.lastInstanceId || null,
            };
            if (!existing.leadId && meta?.contact_name && existing.name === formatPhoneDisplay(phone)) {
              updated.name = meta.contact_name;
            }
            if (meta?.chat_details_pic && !existing.profilePic) {
              updated.profilePic = meta.chat_details_pic;
            }
            return [updated, ...prev.filter(c => c.id !== phone)];
          } else {
            const contactName = nomeValido(meta?.contact_name) || (newMsg.direction === 'inbound' ? nomeValido(meta?.senderName) : null) || meta?.groupName || formatPhoneDisplay(phone);
            const newContact: ChatContact = {
              id: phone, leadId: newMsg.lead_id, name: contactName, phone,
              profilePic: meta?.chat_details_pic || null, lastMessage: preview,
              lastMessageAt: newMsg.created_at, unreadCount: newMsg.direction === 'inbound' ? 1 : 0,
              boardId: newMsg.board_id, isGroup, lastSenderName: isGroup ? meta?.senderName : null,
              lastInstanceId: newMsg.instance_id || null,
            };
            return [newContact, ...prev];
          }
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, () => {
        // Debounce: abrir um chat marca VARIAS msgs como lidas (N updates), e
        // antes cada update disparava um reload completo (fetch 1000 linhas +
        // todos os leads + reprocessamento em JS). Isso travava a lista. Agora
        // coalescemos a rajada de updates num unico reload.
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(() => { loadContacts(); }, 1000);
      })
      .subscribe();
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadContacts]);

  // CRM search
  useEffect(() => {
    if (search.length < 2) { setCrmResults([]); return; }

    const timer = setTimeout(async () => {
      const cleanSearch = search.replace(/\D/g, '');
      const { data: leads } = await supabase
        .from('crm_leads')
        .select('id, name, whatsapp, instagram, instagram_profile_pic_url, whatsapp_profile_pic_url, board_id')
        .or(`name.ilike.%${search}%,whatsapp.ilike.%${cleanSearch || search}%,instagram.ilike.%${search}%`)
        .limit(10);

      if (!leads) return;

      const existingPhones = new Set(contacts.map(c => c.phone));
      // Dedup dos resultados do CRM. crm_leads tem leads duplicados (mesmo
      // contato salvo com telefone em formatos diferentes, ex: Dr. Luiz 4x).
      // Sem isto, cada duplicata virava uma linha "Iniciar conversa" repetida
      // e ainda colidia o key={contact.id} do React quando o phone batia/era vazio.
      const seen = new Set<string>();
      const dedupLeads: typeof leads = [];
      for (const l of leads) {
        const p = normalizeBRPhone(l.whatsapp?.replace(/\D/g, '') || '');
        // Ja tem conversa real com esse telefone: nao repete no bloco CRM
        if (p && existingPhones.has(p)) continue;
        // Chave de dedup: telefone quando existe, senao nome normalizado
        const key = p || `name:${(l.name || '').trim().toLowerCase()}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        dedupLeads.push(l);
      }

      setCrmResults(dedupLeads.map(l => {
        const p = normalizeBRPhone(l.whatsapp?.replace(/\D/g, '') || '');
        return {
          // id unico: usa o telefone quando existe, senao o proprio leadId,
          // pra nunca colidir o key do React entre leads sem telefone
          id: p || `lead:${l.id}`,
          leadId: l.id, name: nomeValido(l.name) || formatPhoneDisplay(p) || 'Sem nome',
          phone: p,
          profilePic: l.instagram_profile_pic_url || l.whatsapp_profile_pic_url || null,
          lastMessage: null, lastMessageAt: null, unreadCount: 0, boardId: l.board_id,
        };
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [search, contacts]);

  // Busca por CONTEUDO de mensagem (palavra-chave) — filtra conversas que tem
  // a palavra no texto trocado, igual ao WhatsApp original.
  useEffect(() => {
    if (search.trim().length < 2) { setMsgMatchPhones(new Set()); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('remote_phone')
        .ilike('content', `%${search.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(400);
      const set = new Set<string>();
      for (const m of data || []) {
        const p = (m as any).remote_phone?.replace(/\D/g, '');
        if (p) set.add(normalizeBRPhone(p));
      }
      setMsgMatchPhones(set);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const cleanSearchPhone = search.replace(/\D/g, '');
  const lowerSearch = search.toLowerCase().trim();
  // Filtro por categoria (todas/nao lidas/lidas/grupos). Aplicado ANTES da
  // busca textual pra contadores baterem com o que a pessoa esta vendo.
  const byFilter = contacts.filter(c => {
    if (filter === 'unread') return c.unreadCount > 0;
    if (filter === 'read') return c.unreadCount === 0;
    if (filter === 'groups') return c.isGroup === true;
    return true;
  });
  const filtered = lowerSearch
    ? byFilter.filter(c =>
        c.name.toLowerCase().includes(lowerSearch) ||
        // So filtra por phone se a busca tem digito — antes string.includes('')
        // retornava true pra qualquer phone e o filtro passava todos os contatos
        (cleanSearchPhone.length > 0 && c.phone.includes(cleanSearchPhone)) ||
        // ou conversas cuja MENSAGEM contem a palavra buscada
        msgMatchPhones.has(c.phone)
      )
    : byFilter;

  // Contadores pros chips dos filtros
  const counts = {
    all: contacts.length,
    unread: contacts.filter(c => c.unreadCount > 0).length,
    read: contacts.filter(c => c.unreadCount === 0).length,
    groups: contacts.filter(c => c.isGroup).length,
  };

  const allResults = [...filtered, ...crmResults];

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Search */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato, lead, mensagem..."
            className="pl-9 pr-8 h-9 bg-muted/50 border-none text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        {/* Filtros: Todas / Nao lidas / Lidas / Grupos */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          {([
            { key: 'all', label: 'Todas', count: counts.all },
            { key: 'unread', label: 'Não lidas', count: counts.unread },
            { key: 'read', label: 'Lidas', count: counts.read },
            { key: 'groups', label: 'Grupos', count: counts.groups },
          ] as { key: ChatFilter; label: string; count: number }[]).map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 border border-transparent'
                }`}
              >
                <span>{f.label}</span>
                {f.count > 0 && (
                  <span className={`text-[10px] tabular-nums ${active ? 'text-green-200' : 'text-muted-foreground/70'}`}>
                    {f.count > 99 ? '99+' : f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-2.5 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : allResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma conversa</p>
          </div>
        ) : (
          <>
            {crmResults.length > 0 && search.length >= 2 && (
              <div className="px-3 py-1.5 bg-primary/5 border-b border-border">
                <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Leads do CRM</span>
              </div>
            )}
            {allResults.map((contact) => {
              const isCrmOnly = crmResults.some(c => c.id === contact.id);
              return (
                <button
                  key={contact.id} onClick={() => onSelectContact(contact)}
                  className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-all duration-200 border-b border-border/30 text-left ${
                    selectedContact?.id === contact.id ? 'bg-muted/70 border-l-2 border-l-green-500' : ''
                  } ${isCrmOnly ? 'bg-primary/5' : ''}`}
                >
                  <div className={`relative flex-shrink-0 ${contact.unreadCount > 0 ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-background rounded-full' : ''}`}>
                    {contact.profilePic ? (
                      <img src={contact.profilePic} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : contact.isGroup ? (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600/40 to-indigo-700/40 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-300" />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-600/40 to-emerald-700/40 flex items-center justify-center">
                        <User className="w-5 h-5 text-green-300" />
                      </div>
                    )}
                    {contact.isGroup && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center border border-background">
                        <Users className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium text-sm truncate ${contact.unreadCount > 0 ? 'text-foreground font-semibold' : 'text-foreground'}`}>
                        {contact.name}
                      </span>
                      {/* Por qual dos nossos numeros essa conversa corre. Sem isso
                          nao da pra saber de onde ligar/responder pro lead. */}
                      {(() => {
                        const inst = contact.lastInstanceId ? instanceMap[contact.lastInstanceId] : null;
                        if (!inst) return null;
                        const tag = getInstanceTag(inst);
                        return (
                          <span
                            className={`text-[8px] px-1 py-px rounded font-semibold uppercase tracking-wide flex-shrink-0 ml-auto ${tag.className}`}
                            title={describeInstance(inst)}
                          >
                            {tag.label}
                          </span>
                        );
                      })()}
                      {contact.lastMessageAt && (
                        <span className={`text-[10px] flex-shrink-0 ml-2 ${contact.unreadCount > 0 ? 'text-green-400 font-medium' : 'text-muted-foreground'}`}>
                          {formatDistanceToNow(new Date(contact.lastMessageAt), { addSuffix: false, locale: ptBR })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.isGroup && contact.lastSenderName
                          ? <><span className="text-foreground/70">{contact.lastSenderName.split(' ')[0]}:</span> {contact.lastMessage}</>
                          : isCrmOnly
                            ? '💬 Iniciar conversa'
                            : (contact.lastMessage || 'Sem mensagens')
                        }
                      </p>
                      {(() => {
                        const inst = contact.lastInstanceId ? instanceMap[contact.lastInstanceId] : null;
                        const phone = formatInstancePhone(inst?.phone_number);
                        if (!inst || !phone) return null;
                        return (
                          <span className="text-[9px] text-muted-foreground/70 flex-shrink-0 ml-2 font-mono" title={describeInstance(inst)}>
                            {phone}
                          </span>
                        );
                      })()}
                      {contact.unreadCount > 0 && (
                        <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] text-center flex-shrink-0 ml-2 animate-pulse">
                          {contact.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
