import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Brain, Loader2, AlertTriangle, Flame, Snowflake, Zap, X, Eye, EyeOff, Sparkles } from 'lucide-react';

interface Props {
  meetingId: string | null;
  leadId: string | null;
  transcriptions: { text: string; speaker: string; is_final: boolean; created_at?: string }[];
  enabled: boolean;
  onToggle: () => void;
  isTranscribing?: boolean;
  onStartTranscription?: () => void;
  micCaptured?: boolean;
  leadAudioCaptured?: boolean;
  hasRemoteParticipant?: boolean;
}

const TEMP_META: Record<string, { label: string; color: string; icon: any }> = {
  frio:          { label: 'Frio',         color: '#60A5FA', icon: Snowflake },
  morno:         { label: 'Morno',        color: '#FCD34D', icon: Zap },
  quente:        { label: 'Quente',       color: '#FB923C', icon: Flame },
  muito_quente:  { label: 'Muito quente', color: '#EF4444', icon: Flame },
};

const STAGE_LABEL: Record<string, string> = {
  rapport: 'Rapport',
  discovery: 'Descoberta',
  diagnosis: 'Diagnóstico',
  pitch: 'Apresentação',
  objection: 'Objeção',
  closing: 'Fechamento',
  followup: 'Follow-up',
};

export default function LiveCoachPanel({
  meetingId, leadId, transcriptions, enabled, onToggle,
  isTranscribing, onStartTranscription, micCaptured, leadAudioCaptured, hasRemoteParticipant,
}: Props) {
  const [suggestion, setSuggestion] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number>(0);
  // Comeca recolhido pra nao tampar o video do lead. Expande no clique.
  const [collapsed, setCollapsed] = useState(true);
  const intervalRef = useRef<any>(null);

  const run = async () => {
    const finals = transcriptions.filter(t => t.is_final && t.text?.trim());
    if (finals.length < 2) return; // need at least 2 final segments
    const text = finals.slice(-20).map(t => `${t.speaker}: ${t.text}`).join('\n');
    if (text.length < 60) return;

    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('meeting-coach-realtime', {
        body: { meeting_id: meetingId, lead_id: leadId, transcription: text },
      });
      if (data?.ok && data.suggestion) {
        setSuggestion(data.suggestion);
        setLastRunAt(Date.now());
      }
    } catch (e) { console.error('[coach]', e); }
    setLoading(false);
  };

  // Run every 45s while enabled. Antes da primeira sugestao roda a cada 15s
  // pra reagir mais rapido quando o vendedor finalmente passa do limite minimo.
  useEffect(() => {
    if (!enabled) return;
    run(); // immediate
    const period = suggestion ? 45_000 : 15_000;
    intervalRef.current = setInterval(run, period);
    return () => clearInterval(intervalRef.current);
  }, [enabled, transcriptions.length, suggestion]);

  if (!enabled) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-4 right-4 z-30 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-primary/30 text-primary rounded-full px-3 py-2 flex items-center gap-2 text-xs font-medium shadow-lg"
      >
        <Brain className="w-4 h-4" />
        Ativar Coach IA
      </button>
    );
  }

  const tempMeta = suggestion?.lead_temperature ? TEMP_META[suggestion.lead_temperature] : null;
  const TempIcon = tempMeta?.icon;
  const stageLabel = suggestion?.stage ? STAGE_LABEL[suggestion.stage] || suggestion.stage : '...';

  // Diagnostico claro do que ta faltando pro coach acordar
  const finalCount = transcriptions.filter(t => t.is_final && t.text?.trim()).length;
  const totalChars = transcriptions
    .filter(t => t.is_final && t.text?.trim())
    .map(t => t.text)
    .join(' ').length;
  const headerSubtitle = loading
    ? 'pensando...'
    : lastRunAt
      ? `atualizou ${Math.round((Date.now() - lastRunAt) / 1000)}s atras`
      : isTranscribing === false
        ? 'transcricao desligada'
        : finalCount === 0
          ? 'aguardando voce falar'
          : totalChars < 60
            ? `captando (${totalChars}/60 chars)`
            : 'pronto pra coachear';

  return (
    <div className={`absolute top-4 right-4 z-30 bg-black/85 backdrop-blur-md border border-primary/30 rounded-2xl shadow-2xl text-white transition-all max-w-[calc(100vw-2rem)] ${collapsed ? 'w-[240px]' : 'w-[320px]'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">Coach IA ao vivo</p>
          <p className="text-[9px] text-white/50 truncate">{headerSubtitle}</p>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-white/60 hover:text-white"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onToggle}
          className="p-1 text-white/60 hover:text-red-400"
          title="Desligar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status de captura — sempre visivel pra o vendedor saber se o
          Coach esta ouvindo realmente os DOIS lados ou so o proprio mic. */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 text-[10px]">
        <span className={`flex items-center gap-1 ${micCaptured ? 'text-green-400' : 'text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${micCaptured ? 'bg-green-400' : 'bg-gray-600'}`} />
          Mic {micCaptured ? 'ON' : 'OFF'}
        </span>
        <span className={`flex items-center gap-1 ${
          leadAudioCaptured ? 'text-green-400' : hasRemoteParticipant ? 'text-yellow-400' : 'text-gray-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            leadAudioCaptured ? 'bg-green-400' : hasRemoteParticipant ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'
          }`} />
          Lead {leadAudioCaptured ? 'ON' : hasRemoteParticipant ? 'aguardando' : 'sem lead'}
        </span>
      </div>

      {collapsed ? (
        suggestion ? (
          <div className="p-2 flex items-center gap-2">
            {TempIcon && <TempIcon className="w-3.5 h-3.5" style={{ color: tempMeta.color }} />}
            <span className="text-[10px] font-medium">{stageLabel}</span>
            <span className="text-[10px] text-white/60 truncate">— {suggestion.next_question?.substring(0, 40)}...</span>
          </div>
        ) : (
          <div className="p-2 text-[10px] text-white/50">Aguardando dados da call...</div>
        )
      ) : (
        <div className="p-3 space-y-3">
          {loading && !suggestion && (
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Loader2 className="w-3 h-3 animate-spin" /> Analisando primeira transcricao...
            </div>
          )}
          {!loading && !suggestion && (
            <div className="text-xs text-white/70 space-y-2">
              {isTranscribing === false ? (
                <>
                  <p className="text-yellow-300">⚠️ Transcricao esta desligada.</p>
                  <p className="text-white/60">Sem transcricao eu nao consigo ouvir a call. Liga ela pra eu comecar a coachear.</p>
                  {onStartTranscription && (
                    <button
                      onClick={onStartTranscription}
                      className="w-full mt-1 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-xs font-medium transition-colors"
                    >
                      Ligar transcricao agora
                    </button>
                  )}
                </>
              ) : finalCount === 0 ? (
                <>
                  <p>Microfone aberto, mas ainda nao captei fala.</p>
                  <p className="text-white/50 text-[11px]">Comeca a conversar — eu atualizo a cada 45s.</p>
                </>
              ) : totalChars < 60 ? (
                <>
                  <p>Captando audio: <span className="text-primary">{totalChars}</span> / 60 caracteres.</p>
                  <p className="text-white/50 text-[11px]">Quando passar de 60 chars eu solto a primeira sugestao.</p>
                </>
              ) : (
                <p>
                  {finalCount} segmento{finalCount > 1 ? 's' : ''} captado{finalCount > 1 ? 's' : ''} ·
                  proxima analise em ate 45s.
                </p>
              )}
            </div>
          )}
          {suggestion && (
            <>
              {/* Stage + temperatura */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold uppercase">
                  {stageLabel}
                </span>
                {tempMeta && (
                  <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: tempMeta.color }}>
                    {TempIcon && <TempIcon className="w-3 h-3" />}
                    {tempMeta.label}
                  </span>
                )}
              </div>

              {/* Próxima pergunta (destaque) */}
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-3">
                <p className="text-[9px] text-primary font-bold uppercase tracking-wider mb-1">Proxima pergunta</p>
                <p className="text-sm font-medium leading-snug">{suggestion.next_question}</p>
              </div>

              {/* Alertas */}
              {suggestion.alerts?.length > 0 && (
                <div className="space-y-1">
                  {suggestion.alerts.map((a: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2 rounded-lg text-[11px] ${
                        a.severity === 'critical' ? 'bg-red-500/20 text-red-200 border border-red-500/30' :
                        a.severity === 'warn' ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30' :
                        'bg-blue-500/15 text-blue-200 border border-blue-500/20'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{a.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Insights */}
              {suggestion.insights?.length > 0 && (
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-wider mb-1">Observacoes</p>
                  <ul className="text-[11px] text-white/80 space-y-0.5">
                    {suggestion.insights.map((ins: string, i: number) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-primary">·</span>
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
