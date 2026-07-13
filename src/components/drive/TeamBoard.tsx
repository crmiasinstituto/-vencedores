// Quadro estilo Trello pro time se organizar (listas + cards arrastaveis).
// Cards podem anexar arquivos (sobem pro B2 e ficam ligados ao acervo via
// drive_card_files). Reusado pelo /time e pelo /admin/acervo. RLS: time via
// x-team-token, admin via JWT.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDraggable, useDroppable, closestCorners,
} from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { uploadToB2, fileTypeFromName, humanFileSize } from '@/lib/b2Upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Loader2, Trash2, Paperclip, X, GripVertical, Calendar, User, Download, Upload,
} from 'lucide-react';

const db = supabase as any;

interface BoardList { id: string; board_id: string; name: string; position: number; }
interface Card {
  id: string; list_id: string; title: string; description: string | null;
  position: number; assignee_name: string | null; due_date: string | null;
  label_color: string | null; created_by: string | null;
}
interface CardFile { id: string; card_id: string; file_id: string; name: string; file_url: string; file_type: string | null; file_size: number | null; }

const LABELS = ['#3B82F6', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#64748b'];

interface Props { actorName: string; }

export default function TeamBoard({ actorName }: Props) {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [lists, setLists] = useState<BoardList[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardFiles, setCardFiles] = useState<CardFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [editing, setEditing] = useState<Card | null>(null);
  const [newListName, setNewListName] = useState('');
  const [addingList, setAddingList] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ─── Carregar / bootstrap do quadro ───────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    let { data: boards } = await db.from('drive_boards').select('*').order('position').limit(1);
    let bId = boards?.[0]?.id;
    if (!bId) {
      const { data: nb } = await db.from('drive_boards').insert({ name: 'Quadro do Time' }).select('id').single();
      bId = nb?.id;
      if (bId) {
        await db.from('drive_lists').insert([
          { board_id: bId, name: 'A Fazer', position: 0 },
          { board_id: bId, name: 'Em Producao', position: 1 },
          { board_id: bId, name: 'Pronto', position: 2 },
        ]);
      }
    }
    setBoardId(bId || null);
    if (!bId) { setLoading(false); return; }

    const { data: ls } = await db.from('drive_lists').select('*').eq('board_id', bId).order('position');
    const listIds = (ls || []).map((l: BoardList) => l.id);
    const { data: cs } = listIds.length
      ? await db.from('drive_cards').select('*').in('list_id', listIds).order('position')
      : { data: [] };
    const cardIds = (cs || []).map((c: Card) => c.id);
    let cfRows: CardFile[] = [];
    if (cardIds.length) {
      const { data: links } = await db.from('drive_card_files').select('id, card_id, file_id').in('card_id', cardIds);
      const fileIds = (links || []).map((l: any) => l.file_id);
      if (fileIds.length) {
        const { data: fs } = await db.from('drive_files').select('id, name, file_url, file_type, file_size').in('id', fileIds);
        const fileMap = new Map((fs || []).map((f: any) => [f.id, f]));
        cfRows = (links || []).map((l: any) => {
          const f = fileMap.get(l.file_id) || {};
          return { id: l.id, card_id: l.card_id, file_id: l.file_id, name: f.name, file_url: f.file_url, file_type: f.file_type, file_size: f.file_size };
        });
      }
    }
    setLists(ls || []);
    setCards(cs || []);
    setCardFiles(cfRows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Drag entre listas ────────────────────────────────────
  const onDragStart = (e: DragStartEvent) => {
    setActiveCard(cards.find((c) => c.id === e.active.id) || null);
  };
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;
    const card = cards.find((c) => c.id === active.id);
    if (!card) return;
    // over.id pode ser uma lista (droppable) ou outro card; resolvemos a lista alvo
    const overList = lists.find((l) => l.id === over.id);
    const overCard = cards.find((c) => c.id === over.id);
    const targetListId = overList?.id || overCard?.list_id;
    if (!targetListId || targetListId === card.list_id) return;

    const maxPos = Math.max(-1, ...cards.filter((c) => c.list_id === targetListId).map((c) => c.position));
    setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, list_id: targetListId, position: maxPos + 1 } : c));
    const { error } = await db.from('drive_cards').update({ list_id: targetListId, position: maxPos + 1, updated_at: new Date().toISOString() }).eq('id', card.id);
    if (error) { toast.error('Nao consegui mover o card.'); load(); }
  };

  // ─── CRUD listas / cards ──────────────────────────────────
  const addList = async () => {
    const name = newListName.trim();
    if (!name || !boardId) return;
    const pos = Math.max(-1, ...lists.map((l) => l.position)) + 1;
    const { error } = await db.from('drive_lists').insert({ board_id: boardId, name, position: pos });
    if (error) { toast.error('Nao consegui criar a lista.'); return; }
    setNewListName(''); setAddingList(false); load();
  };
  const deleteList = async (id: string) => {
    if (!confirm('Excluir esta lista e todos os cards dela?')) return;
    const { error } = await db.from('drive_lists').delete().eq('id', id);
    if (error) { toast.error('Falha ao excluir a lista.'); return; }
    load();
  };
  const addCard = async (listId: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    const pos = Math.max(-1, ...cards.filter((c) => c.list_id === listId).map((c) => c.position)) + 1;
    const { error } = await db.from('drive_cards').insert({ list_id: listId, title: t, position: pos, created_by: actorName });
    if (error) { toast.error('Nao consegui criar o card.'); return; }
    load();
  };

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {lists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                cards={cards.filter((c) => c.list_id === list.id)}
                cardFiles={cardFiles}
                onAddCard={addCard}
                onDeleteList={deleteList}
                onOpenCard={setEditing}
              />
            ))}
            {/* Adicionar lista */}
            <div className="shrink-0 w-72">
              {addingList ? (
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <Input
                    autoFocus value={newListName} onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addList(); if (e.key === 'Escape') setAddingList(false); }}
                    placeholder="Nome da lista"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addList} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">Adicionar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingList(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingList(true)} className="w-full rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#3B82F6]/50 p-3 text-sm flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Adicionar lista
                </button>
              )}
            </div>
          </div>
          <DragOverlay>
            {activeCard ? <div className="rounded-lg border border-[#3B82F6] bg-card p-3 text-sm shadow-lg w-64">{activeCard.title}</div> : null}
          </DragOverlay>
        </DndContext>
      )}

      {editing && (
        <CardModal
          card={editing}
          files={cardFiles.filter((f) => f.card_id === editing.id)}
          actorName={actorName}
          onClose={() => setEditing(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

// ─── Coluna (lista droppable) ───────────────────────────────
function ListColumn({ list, cards, cardFiles, onAddCard, onDeleteList, onOpenCard }: {
  list: BoardList; cards: Card[]; cardFiles: CardFile[];
  onAddCard: (listId: string, title: string) => void;
  onDeleteList: (id: string) => void;
  onOpenCard: (c: Card) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  return (
    <div className="shrink-0 w-72">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-semibold">{list.name} <span className="text-muted-foreground font-normal">{cards.length}</span></h3>
        <button onClick={() => onDeleteList(list.id)} className="text-muted-foreground hover:text-red-500" title="Excluir lista">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div ref={setNodeRef} className={`space-y-2 rounded-xl p-2 min-h-[60px] transition-colors ${isOver ? 'bg-[#3B82F6]/10' : 'bg-muted/30'}`}>
        {cards.map((card) => (
          <CardItem key={card.id} card={card} fileCount={cardFiles.filter((f) => f.card_id === card.id).length} onOpen={() => onOpenCard(card)} />
        ))}
        {adding ? (
          <div className="space-y-2">
            <Textarea
              autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddCard(list.id, title); setTitle(''); setAdding(false); } if (e.key === 'Escape') setAdding(false); }}
              placeholder="Titulo do card" rows={2} className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onAddCard(list.id, title); setTitle(''); setAdding(false); }} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">Adicionar</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full text-left text-sm text-muted-foreground hover:text-foreground px-2 py-1.5 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Adicionar card
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Card (draggable) ───────────────────────────────────────
function CardItem({ card, fileCount, onOpen }: { card: Card; fileCount: number; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-border bg-card p-3 text-sm hover:border-[#3B82F6]/50 transition-colors ${isDragging ? 'opacity-30' : ''}`}
    >
      {card.label_color && <div className="h-1.5 w-10 rounded-full mb-2" style={{ background: card.label_color }} />}
      <div className="flex items-start gap-1">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground mt-0.5" title="Arrastar">
          <GripVertical className="w-4 h-4" />
        </button>
        <button onClick={onOpen} className="text-left flex-1 min-w-0">
          <p className="font-medium break-words">{card.title}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {card.assignee_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{card.assignee_name}</span>}
            {card.due_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{card.due_date}</span>}
            {fileCount > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{fileCount}</span>}
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Modal de edicao do card ────────────────────────────────
function CardModal({ card, files, actorName, onClose, onChanged }: {
  card: Card; files: CardFile[]; actorName: string;
  onClose: () => void; onChanged: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [assignee, setAssignee] = useState(card.assignee_name || '');
  const [due, setDue] = useState(card.due_date || '');
  const [color, setColor] = useState(card.label_color || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    const { error } = await db.from('drive_cards').update({
      title: title.trim() || card.title,
      description: description.trim() || null,
      assignee_name: assignee.trim() || null,
      due_date: due || null,
      label_color: color || null,
      updated_at: new Date().toISOString(),
    }).eq('id', card.id);
    setSaving(false);
    if (error) { toast.error('Falha ao salvar.'); return; }
    onChanged(); onClose();
  };

  const remove = async () => {
    if (!confirm('Excluir este card?')) return;
    const { error } = await db.from('drive_cards').delete().eq('id', card.id);
    if (error) { toast.error('Falha ao excluir.'); return; }
    onChanged(); onClose();
  };

  const attach = async (fl: FileList | null) => {
    const file = fl?.[0];
    if (!file) return;
    setUploading(true); setProgress(0);
    try {
      const res = await uploadToB2(file, `drive/cards/${card.id}`, setProgress);
      if (!res) throw new Error('upload vazio');
      const { data: df, error: e1 } = await db.from('drive_files').insert({
        name: file.name, file_url: res.public_url, file_key: res.key,
        file_type: fileTypeFromName(file.name), file_size: file.size, mime: file.type || null,
        uploaded_by: actorName,
      }).select('id').single();
      if (e1) throw e1;
      const { error: e2 } = await db.from('drive_card_files').insert({ card_id: card.id, file_id: df.id });
      if (e2) throw e2;
      toast.success('Anexo adicionado');
      onChanged();
    } catch (e: any) {
      toast.error(`Erro no anexo: ${e.message || e}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const detach = async (linkId: string) => {
    const { error } = await db.from('drive_card_files').delete().eq('id', linkId);
    if (error) { toast.error('Falha ao remover anexo.'); return; }
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar card</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Titulo</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descricao</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Responsavel</label>
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prazo</label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Etiqueta</label>
            <div className="flex gap-2 mt-1">
              {LABELS.map((c) => (
                <button key={c} onClick={() => setColor(color === c ? '' : c)}
                  className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Anexos */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Anexos ({files.length})</label>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{progress}%</> : <><Upload className="w-3.5 h-3.5 mr-1" />Anexar</>}
              </Button>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => attach(e.target.files)} />
            </div>
            <div className="space-y-1.5 mt-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-sm rounded-lg border border-border p-2">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{humanFileSize(f.file_size)}</span>
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" download className="text-muted-foreground hover:text-[#3B82F6]"><Download className="w-4 h-4" /></a>
                  <button onClick={() => detach(f.id)} className="text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <Button variant="ghost" onClick={remove} className="text-red-500 hover:text-red-600">
            <Trash2 className="w-4 h-4 mr-1" /> Excluir card
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
