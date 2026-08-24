import React, { useRef, useEffect, useState } from 'react';
import { Phone, PhoneOff, MicOff, Mic, User, FileText, BookOpen, PhoneIncoming } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCallContext } from '@/contexts/CallContext';
import { formatDuration, getCallStatusLabel } from '@/hooks/useWavoip';
import { CoachPanel } from '@/components/calls/CoachPanel';
import { PlaybookSelector } from '@/components/calls/PlaybookSelector';
import { useSalesCoach, type Playbook } from '@/hooks/useSalesCoach';

/**
 * Barra de nivel de audio de um sentido da chamada. Verde pulsando = som
 * passando. Vermelho = ninguem esta falando OU o audio nao esta passando —
 * `silentSec` diferencia pausa de conversa (2-3s) de problema real (10s+).
 */
const AudioMeter: React.FC<{ label: string; level: number; silentSec: number; muted?: boolean; warnAfter: number }> = ({ label, level, silentSec, muted, warnAfter }) => {
  // level < 0 = a SDK desta versao nao expoe como medir esse sentido.
  const indisponivel = level < 0;
  const pct = indisponivel ? 0 : Math.min(100, Math.round(Math.sqrt(Math.max(0, level)) * 140));
  const problema = !indisponivel && !muted && silentSec >= warnAfter;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`text-[10px] w-[74px] shrink-0 ${problema ? 'text-red-400' : 'text-white/50'}`}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-150 ${problema ? 'bg-red-500' : 'bg-green-400'}`}
          style={{ width: `${muted ? 0 : pct}%` }}
        />
      </div>
      <span className={`text-[10px] w-[86px] text-right shrink-0 ${problema ? 'text-red-400' : 'text-white/40'}`}>
        {indisponivel ? 'sem medição' : muted ? 'mudo' : problema ? `sem som ${silentSec}s` : pct > 3 ? 'ok' : '—'}
      </span>
    </div>
  );
};

export const ActiveCallModal: React.FC = () => {
  const { activeCall, showActiveCallModal, setShowActiveCallModal, endCall, toggleMute, isTranscribing, transcriptions, confirmPendingCall, audioDiag } = useCallContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const coach = useSalesCoach();
  const [coachEnabled, setCoachEnabled] = useState(true);
  const [isStartingCall, setIsStartingCall] = useState(false);
  // URLs do CDN do Instagram (fbcdn) expiram em ~12h e voltam 403 — quando o
  // <img> falha, cai pro avatar gradient generico ao inves de ficar com circulo
  // vazio.
  const [picBroken, setPicBroken] = useState(false);
  useEffect(() => { setPicBroken(false); }, [activeCall?.profilePicture]);

  // Se o user clicou "Sem coach" no PENDING, o CallContext seta
  // coachDisabled na call; sincroniza com o toggle local pro modal nao
  // mostrar painel de coach na fase ACTIVE.
  useEffect(() => {
    if (activeCall?.coachDisabled) setCoachEnabled(false);
  }, [activeCall?.coachDisabled]);

  // Auto-scroll transcriptions
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions]);

  // Feed transcriptions to coach
  useEffect(() => {
    if (coach.isActive && transcriptions.length > 0) {
      coach.feedTranscription(transcriptions);
    }
  }, [transcriptions, coach.isActive]);

  // Start coach when call connects (only if playbook is selected and coach enabled)
  useEffect(() => {
    if (activeCall?.status === 'ACTIVE' && !coach.isActive && coach.selectedPlaybook && coachEnabled) {
      coach.startCoach();
    }
  }, [activeCall?.status, coach.selectedPlaybook, coachEnabled]);

  // Stop coach & save when call ends
  useEffect(() => {
    if (!activeCall && coach.isActive) {
      coach.stopCoach();
    }
  }, [activeCall]);

  if (!activeCall) return null;

  const isPending = activeCall.status === 'PENDING';
  const isCalling = activeCall.status === 'CALLING';
  // Durante PENDING/CALLING ainda nao tem audio rolando — usa o mesmo layout
  // compacto do CALLING (sem painel de transcricao/coach lateral).
  const isPreActive = isPending || isCalling;
  const showCoach = !isPreActive && coachEnabled && coach.isActive && coach.selectedPlaybook;

  // Selecionar playbook = confirmar a chamada com coach. Iniciar wavoip e
  // setar selectedPlaybook no coach pra que o useEffect de ACTIVE startCoach.
  const handlePlaybookSelectAndStart = async (pb: Playbook) => {
    if (!isPending || isStartingCall) return;
    coach.setSelectedPlaybook(pb);
    setCoachEnabled(true);
    setIsStartingCall(true);
    await confirmPendingCall({ disableCoach: false });
    setIsStartingCall(false);
  };

  // "Sem coach" — dispara ligacao sem playbook (passa flag pro context).
  const handleStartWithoutCoach = async () => {
    if (!isPending || isStartingCall) return;
    setCoachEnabled(false);
    setIsStartingCall(true);
    await confirmPendingCall({ disableCoach: true });
    setIsStartingCall(false);
  };

  return (
    <Dialog open={showActiveCallModal} onOpenChange={setShowActiveCallModal}>
      <DialogContent className={`bg-gradient-to-b from-[#1a1a2e] to-[#16213e] border-green-500/20 text-white max-h-[90vh] flex ${showCoach ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className={`flex ${showCoach ? 'gap-4' : ''} w-full`}>
          {/* Left: Call Panel */}
          <div className={`flex flex-col ${showCoach ? 'w-1/2' : 'w-full'}`}>
            <div className="flex flex-col items-center py-4 gap-3">
              {/* Avatar */}
              <div className={`relative ${isPreActive ? 'animate-pulse' : ''}`}>
                {activeCall.profilePicture && !picBroken ? (
                  <img
                    src={activeCall.profilePicture}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setPicBroken(true)}
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-green-500/30"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600/40 to-emerald-700/40 flex items-center justify-center ring-4 ring-green-500/20">
                    {activeCall.peerName ? (
                      <span className="text-3xl font-semibold text-green-100">
                        {activeCall.peerName.trim().charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <User className="w-10 h-10 text-green-300" />
                    )}
                  </div>
                )}
                {activeCall.isPeerMuted && (
                  <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1">
                    <MicOff className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="text-center">
                <h3 className="text-lg font-bold">{activeCall.peerName || activeCall.peerPhone}</h3>
                {activeCall.peerName && (
                  <p className="text-xs text-white/60">{activeCall.peerPhone}</p>
                )}
                <p className="text-sm text-green-400 mt-0.5">
                  {isPending ? 'Escolha o playbook para iniciar' : isCalling ? getCallStatusLabel(activeCall.status) : (
                    <span className="font-mono text-base">{formatDuration(activeCall.duration)}</span>
                  )}
                </p>
                <p className="text-[10px] text-white/40">
                  {activeCall.direction === 'INCOMING' ? '📥 Recebida' : '📤 Enviada'}
                </p>
              </div>

              {/* Playbook Selector — aparece em PENDING (escolha dispara a
                  ligacao) e CALLING (ja chamando, ainda da pra trocar o
                  playbook antes do peer aceitar). */}
              {isPreActive && (
                <div className="w-full px-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Sales Coach</span>
                    {!isPending && (
                      <button
                        onClick={() => setCoachEnabled(!coachEnabled)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          coachEnabled
                            ? 'bg-green-500/15 border-green-500/30 text-green-300'
                            : 'bg-white/5 border-white/10 text-white/40'
                        }`}
                      >
                        {coachEnabled ? '✓ Ativo' : 'Desativado'}
                      </button>
                    )}
                    {isPending && (
                      <span className="text-[10px] text-amber-300/80">⏸ aguardando confirmação</span>
                    )}
                  </div>
                  {(coachEnabled || isPending) && (
                    isPending ? (
                      // No PENDING o onSelect ja dispara a chamada — UI
                      // explica "clique no playbook = inicia ligacao".
                      <PlaybookSelector
                        playbooks={coach.playbooks}
                        selected={coach.selectedPlaybook}
                        onSelect={(pb) => { handlePlaybookSelectAndStart(pb); }}
                      />
                    ) : (
                      <PlaybookSelector
                        playbooks={coach.playbooks}
                        selected={coach.selectedPlaybook}
                        onSelect={coach.setSelectedPlaybook}
                      />
                    )
                  )}
                  {!coachEnabled && !isPending && (
                    <p className="text-[10px] text-white/30 text-center py-1">
                      Apenas transcrição + insights pós-chamada
                    </p>
                  )}
                </div>
              )}

              {/* Pending-state controls: clique no playbook acima inicia a
                  chamada; aqui sao os dois "atalhos" complementares. */}
              {isPending && (
                <div className="flex flex-col gap-2 w-full px-2">
                  <Button
                    onClick={handleStartWithoutCoach}
                    disabled={isStartingCall}
                    className="w-full bg-white/10 hover:bg-white/20 text-white text-xs h-9 gap-2"
                  >
                    <PhoneIncoming className="w-3.5 h-3.5" />
                    Ligar sem coach (outro assunto)
                  </Button>
                  <button
                    onClick={endCall}
                    disabled={isStartingCall}
                    className="text-[11px] text-white/40 hover:text-white/70 transition-colors py-1"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Controls — so aparece quando a ligacao ja foi disparada */}
              {!isPending && (
                <div className="flex items-center gap-6">
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={toggleMute}
                    className={`rounded-full w-12 h-12 ${activeCall.isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                  <Button
                    size="lg"
                    onClick={endCall}
                    className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>
              )}
            </div>

            {/* Medidor de audio nos dois sentidos — responde na hora
                "o lead esta me ouvindo?" e "estou ouvindo o lead?" */}
            {!isPreActive && (
              <div className="border-t border-white/10 pt-3 mt-1 px-1">
                <AudioMeter
                  label="Você → lead"
                  level={audioDiag?.micLevel ?? 0}
                  silentSec={audioDiag?.micSilentSec ?? 0}
                  muted={activeCall.isMuted}
                  warnAfter={10}
                />
                <AudioMeter
                  label="Lead → você"
                  level={audioDiag?.peerLevel ?? 0}
                  silentSec={audioDiag?.peerSilentSec ?? 0}
                  muted={activeCall.isPeerMuted}
                  warnAfter={12}
                />
                {audioDiag && (
                  <p className="text-[10px] text-white/35 mt-1">
                    {audioDiag.transport === 'sem-fluxo'
                      ? 'sem tráfego de áudio — conexão caiu'
                      : `rtt ${audioDiag.rttMs}ms · perda ↑${audioDiag.lossTx} ↓${audioDiag.lossRx}`}
                  </p>
                )}
              </div>
            )}

            {/* Transcription Panel */}
            {!isPreActive && (
              <div className="border-t border-white/10 pt-3 flex-1 min-h-0">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <FileText className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-medium text-green-400">
                    Transcrição em tempo real
                  </span>
                  {isTranscribing && (
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  )}
                </div>
                <div
                  ref={scrollRef}
                  className="h-48 overflow-y-auto space-y-1.5 px-1 scrollbar-thin scrollbar-thumb-white/10"
                >
                  {transcriptions.length === 0 ? (
                    <p className="text-center text-white/30 text-xs py-6">
                      {isTranscribing ? 'Aguardando fala...' : 'Transcrição será iniciada automaticamente'}
                    </p>
                  ) : (
                    transcriptions.map((seg, i) => {
                      const isLocal = seg.speakerType === 'local';
                      return (
                        <div
                          key={seg.is_final ? seg.id : `partial-${seg.speaker}`}
                          className={`flex gap-2 p-1.5 rounded ${!seg.is_final ? 'opacity-50' : ''}`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isLocal ? 'bg-blue-500/20' : 'bg-emerald-500/20'}`}>
                            {isLocal ? <Mic className="w-2.5 h-2.5 text-blue-400" /> : <User className="w-2.5 h-2.5 text-emerald-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-semibold ${isLocal ? 'text-blue-400' : 'text-emerald-400'}`}>
                              {seg.speaker}
                            </p>
                            <p className="text-xs text-white/80 leading-relaxed">
                              {seg.text}
                              {!seg.is_final && (
                                <span className="inline-block w-1 h-3 bg-white/60 animate-pulse ml-0.5" />
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Coach Panel */}
          {showCoach && coach.selectedPlaybook && (
            <div className="w-1/2 border-l border-white/10 pl-4 py-2">
              <CoachPanel
                playbook={coach.selectedPlaybook}
                state={coach.coachState}
                isActive={coach.isActive}
                onAdvancePhase={coach.advancePhase}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
