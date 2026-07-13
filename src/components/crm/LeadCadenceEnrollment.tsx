import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListOrdered, Play, Pause, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CadenceSequence {
  id: string;
  name: string;
  description: string;
  steps: any[];
  is_active: boolean;
}

interface Enrollment {
  id: string;
  cadence_id: string;
  current_step: number;
  status: string;
  next_send_at: string | null;
  created_at: string;
  cadence_name?: string;
  total_steps?: number;
}

interface Props {
  leadId: string;
  leadName: string;
}

export function LeadCadenceEnrollment({ leadId, leadName }: Props) {
  const { toast } = useToast();
  const [sequences, setSequences] = useState<CadenceSequence[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCadenceId, setSelectedCadenceId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load available sequences
      const { data: seqs } = await (supabase as any)
        .from('cadence_sequences')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setSequences(seqs || []);

      // Load enrollments for this lead
      const { data: enrs } = await (supabase as any)
        .from('cadence_enrollments')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      // Enrich with sequence name
      const seqMap = new Map((seqs || []).map((s: any) => [s.id, s]));
      const enriched = (enrs || []).map((e: any) => {
        const seq = seqMap.get(e.cadence_id) as CadenceSequence | undefined;
        return {
          ...e,
          cadence_name: seq?.name || 'Sequencia removida',
          total_steps: seq?.steps?.length || 0,
        };
      });
      setEnrollments(enriched);
    } catch (e: any) {
      console.error('Error loading cadence data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [leadId]);

  const handleEnroll = async () => {
    if (!selectedCadenceId) return;

    try {
      const seq = sequences.find(s => s.id === selectedCadenceId);
      const firstStep = seq?.steps?.[0];
      const delayHours = firstStep?.delay_hours || 0;
      const nextSendAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();

      const { error } = await (supabase as any)
        .from('cadence_enrollments')
        .insert({
          cadence_id: selectedCadenceId,
          lead_id: leadId,
          current_step: 1,
          status: 'active',
          next_send_at: nextSendAt,
        });
      if (error) throw error;
      toast({ title: 'Inscrito!', description: `${leadName} inscrito na sequencia "${seq?.name}".` });
      setSelectedCadenceId('');
      loadData();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handlePause = async (enrollmentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paused' ? 'active' : 'paused';
    try {
      const { error } = await (supabase as any)
        .from('cadence_enrollments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', enrollmentId);
      if (error) throw error;
      toast({ title: newStatus === 'paused' ? 'Pausado' : 'Retomado' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (enrollmentId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('cadence_enrollments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', enrollmentId);
      if (error) throw error;
      toast({ title: 'Cancelado' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  // Determine which cadences the lead is NOT enrolled in (active)
  const enrolledCadenceIds = new Set(
    enrollments.filter(e => e.status === 'active' || e.status === 'paused').map(e => e.cadence_id)
  );
  const availableSequences = sequences.filter(s => !enrolledCadenceIds.has(s.id));

  const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    completed: 'bg-blue-500',
    cancelled: 'bg-gray-400',
  };

  return (
    <div className="space-y-4">
      {/* Enroll in new cadence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Inscrever em Sequencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availableSequences.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {sequences.length === 0
                ? 'Nenhuma sequencia disponivel. Crie sequencias em Agentes > Cadencia.'
                : 'Lead ja esta inscrito em todas as sequencias ativas.'}
            </p>
          ) : (
            <div className="flex gap-2">
              <Select value={selectedCadenceId} onValueChange={setSelectedCadenceId}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Selecione uma sequencia..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSequences.map(seq => (
                    <SelectItem key={seq.id} value={seq.id}>
                      {seq.name} ({seq.steps?.length || 0} etapas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleEnroll} disabled={!selectedCadenceId}>
                <Plus className="w-3 h-3 mr-1" /> Inscrever
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active enrollments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListOrdered className="w-4 h-4" /> Inscricoes ({enrollments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nenhuma inscricao em sequencias de cadencia.
            </p>
          ) : (
            <div className="space-y-2">
              {enrollments.map(enr => (
                <div key={enr.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${statusColors[enr.status] || 'bg-gray-400'}`} />
                    <div>
                      <p className="text-sm font-medium">{enr.cadence_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Etapa {enr.current_step}/{enr.total_steps || '?'}
                        {enr.next_send_at && ` | Proximo: ${new Date(enr.next_send_at).toLocaleString('pt-BR')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">{enr.status}</Badge>
                    {(enr.status === 'active' || enr.status === 'paused') && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePause(enr.id, enr.status)}>
                          {enr.status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCancel(enr.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
