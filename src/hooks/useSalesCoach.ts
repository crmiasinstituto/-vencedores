import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TranscriptionSegment } from '@/hooks/useCallTranscription';

// ===================== TYPES =====================
export interface PlaybookPhase {
  id: string;
  name: string;
  order: number;
  checklist: string[];
  rules: string[];
}

export interface Playbook {
  id: string;
  name: string;
  description: string | null;
  phases: PlaybookPhase[];
  is_default: boolean;
}

export interface CoachAlert {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  phase_id: string;
  timestamp: number;
}

export interface CoachState {
  currentPhase: string;
  checklistStatus: Record<string, Record<number, boolean>>;
  alerts: CoachAlert[];
  tips: string[];
  nextQuestion: string | null;
  isAnalyzing: boolean;
  streamingText: string;
}

const BUFFER_INTERVAL_MS = 1500;

export function useSalesCoach() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [coachState, setCoachState] = useState<CoachState>({
    currentPhase: 'abertura',
    checklistStatus: {},
    alerts: [],
    tips: [],
    nextQuestion: null,
    isAnalyzing: false,
    streamingText: '',
  });
  const [isActive, setIsActive] = useState(false);

  const bufferRef = useRef<TranscriptionSegment[]>([]);
  const allTranscriptionsRef = useRef<TranscriptionSegment[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastSentCountRef = useRef(0);
  const isActiveRef = useRef(false);
  const analyzeRef = useRef<() => void>(() => {});

  // Load playbooks
  const loadPlaybooks = useCallback(async () => {
    const { data } = await supabase
      .from('sales_playbooks')
      .select('*')
      .order('is_default', { ascending: false });
    if (data) {
      const mapped = data.map(p => ({
        ...p,
        phases: (p.phases as any as PlaybookPhase[]) || [],
      }));
      setPlaybooks(mapped);
      const defaultPb = mapped.find(p => p.is_default) || mapped[0];
      if (defaultPb && !selectedPlaybook) setSelectedPlaybook(defaultPb);
    }
  }, [selectedPlaybook]);

  useEffect(() => { loadPlaybooks(); }, [loadPlaybooks]);

  // Send buffer to AI
  const analyzeTranscription = useCallback(async () => {
    if (!selectedPlaybook || !isActiveRef.current) return;

    const finals = allTranscriptionsRef.current.filter(t => t.is_final);
    if (finals.length <= lastSentCountRef.current) return;
    lastSentCountRef.current = finals.length;

    const transcriptionText = finals
      .map(t => `${t.speaker}: ${t.text}`)
      .join('\n');

    if (!transcriptionText.trim()) return;

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCoachState(prev => ({ ...prev, isAnalyzing: true, streamingText: '' }));

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-coach-realtime`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            transcription: transcriptionText,
            playbook: selectedPlaybook,
            currentPhase: coachState.currentPhase,
            checklistStatus: coachState.checklistStatus,
            leadName: finals.find(t => t.speakerType === 'remote')?.speaker || null,
          }),
          signal: controller.signal,
        }
      );

      if (!resp.ok || !resp.body) {
        console.error('[Coach] Request failed:', resp.status);
        setCoachState(prev => ({ ...prev, isAnalyzing: false }));
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setCoachState(prev => ({ ...prev, streamingText: fullContent }));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Parse final JSON response
      try {
        // Extract JSON - try raw first, then from markdown code blocks
        let jsonToParse = fullContent.trim();
        // Remove markdown code blocks if present
        const jsonMatch = jsonToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonToParse = jsonMatch[1].trim();
        // Also try extracting first { ... } block
        if (!jsonToParse.startsWith('{')) {
          const braceMatch = jsonToParse.match(/\{[\s\S]*\}/);
          if (braceMatch) jsonToParse = braceMatch[0];
        }

        const result = JSON.parse(jsonToParse);

        setCoachState(prev => {
          const newChecklist = { ...prev.checklistStatus };
          if (result.checklist_updates) {
            for (const update of result.checklist_updates) {
              if (!newChecklist[update.phase_id]) newChecklist[update.phase_id] = {};
              newChecklist[update.phase_id][update.item_index] = update.completed;
            }
          }

          const newAlerts = result.alerts?.map((a: any) => ({
            ...a,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
          })) || [];

          return {
            ...prev,
            currentPhase: result.phase_update || prev.currentPhase,
            checklistStatus: newChecklist,
            alerts: [...newAlerts, ...prev.alerts.filter(a => Date.now() - a.timestamp < 15000)].slice(0, 5),
            tips: result.tips || prev.tips,
            nextQuestion: result.next_question || prev.nextQuestion,
            isAnalyzing: false,
            streamingText: '',
          };
        });
      } catch (e) {
        console.warn('[Coach] Could not parse AI response:', e);
        setCoachState(prev => ({ ...prev, isAnalyzing: false, streamingText: '' }));
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('[Coach] Analysis error:', e);
      }
      setCoachState(prev => ({ ...prev, isAnalyzing: false, streamingText: '' }));
    }
  }, [selectedPlaybook, coachState.currentPhase, coachState.checklistStatus]);

  // Keep analyzeRef always pointing to latest analyzeTranscription
  useEffect(() => {
    analyzeRef.current = analyzeTranscription;
  }, [analyzeTranscription]);

  // Feed new transcriptions
  const feedTranscription = useCallback((segments: TranscriptionSegment[]) => {
    allTranscriptionsRef.current = segments;
    const newFinals = segments.filter(s => s.is_final);
    bufferRef.current = newFinals;
  }, []);

  // Start coach
  const startCoach = useCallback(() => {
    if (!selectedPlaybook) return;
    isActiveRef.current = true;
    setIsActive(true);
    lastSentCountRef.current = 0;
    allTranscriptionsRef.current = [];
    setCoachState({
      currentPhase: selectedPlaybook.phases[0]?.id || 'abertura',
      checklistStatus: {},
      alerts: [],
      tips: [],
      nextQuestion: null,
      isAnalyzing: false,
      streamingText: '',
    });

    // Start buffer timer - use ref to always call latest analyzeTranscription
    timerRef.current = setInterval(() => {
      analyzeRef.current();
    }, BUFFER_INTERVAL_MS);
  }, [selectedPlaybook]);

  // Stop coach
  const stopCoach = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current?.abort();
  }, []);

  // Manual phase advance
  const advancePhase = useCallback(() => {
    if (!selectedPlaybook) return;
    setCoachState(prev => {
      const phases = selectedPlaybook.phases;
      const currentIdx = phases.findIndex(p => p.id === prev.currentPhase);
      const nextPhase = phases[currentIdx + 1];
      if (nextPhase) {
        return { ...prev, currentPhase: nextPhase.id, alerts: [], tips: [] };
      }
      return prev;
    });
  }, [selectedPlaybook]);

  // Save session
  const saveSession = useCallback(async (callHistoryId: string) => {
    if (!selectedPlaybook) return;
    await supabase.from('coach_sessions').insert({
      call_history_id: callHistoryId,
      playbook_id: selectedPlaybook.id,
      current_phase: coachState.currentPhase,
      checklist_status: coachState.checklistStatus as any,
      alerts: coachState.alerts as any,
      insights: coachState.tips as any,
    });
  }, [selectedPlaybook, coachState]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return {
    playbooks,
    selectedPlaybook,
    setSelectedPlaybook,
    coachState,
    isActive,
    startCoach,
    stopCoach,
    feedTranscription,
    advancePhase,
    saveSession,
    loadPlaybooks,
  };
}
