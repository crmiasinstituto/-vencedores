import React, { useEffect, useRef, useState } from 'react';
import { Mic, Video, Volume2, X, Check } from 'lucide-react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

interface Props {
  open: boolean;
  onClose: () => void;
  anchorClassName?: string;
}

type Devices = {
  mics: MediaDeviceInfo[];
  cams: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
};

const STORAGE_OUTPUT = 'squaad.meet.audioOutput';

function applySinkIdToAllAudios(deviceId: string) {
  const audios = Array.from(document.querySelectorAll('audio')) as HTMLAudioElement[];
  for (const a of audios) {
    if (typeof (a as any).setSinkId === 'function') {
      (a as any).setSinkId(deviceId).catch(() => { /* ignora navegadores nao suportados */ });
    }
  }
}

export default function DeviceSelectorPopover({ open, onClose, anchorClassName = '' }: Props) {
  const { localParticipant } = useLocalParticipant();
  const [devices, setDevices] = useState<Devices>({ mics: [], cams: [], outputs: [] });
  const [selected, setSelected] = useState<{ mic?: string; cam?: string; output?: string }>({});
  const ref = useRef<HTMLDivElement>(null);

  // Carrega lista de dispositivos. enumerateDevices precisa de permissao previa
  // (ja temos: o usuario entrou na sala com mic+cam). Se algum nome vier vazio,
  // forcamos uma chamada a getUserMedia bem rapidinha so pra liberar os labels.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        let list = await navigator.mediaDevices.enumerateDevices();
        const allLabeled = list.every((d) => d.label);
        if (!allLabeled) {
          try {
            const tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            tmp.getTracks().forEach((t) => t.stop());
            list = await navigator.mediaDevices.enumerateDevices();
          } catch { /* ignore */ }
        }
        if (cancelled) return;
        const mics = list.filter((d) => d.kind === 'audioinput');
        const cams = list.filter((d) => d.kind === 'videoinput');
        const outputs = list.filter((d) => d.kind === 'audiooutput');
        setDevices({ mics, cams, outputs });

        // detect selected mic/cam from active LiveKit tracks
        const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
        const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
        const micSettings = (micPub?.track?.mediaStreamTrack?.getSettings?.() || {}) as MediaTrackSettings;
        const camSettings = (camPub?.track?.mediaStreamTrack?.getSettings?.() || {}) as MediaTrackSettings;
        const savedOutput = localStorage.getItem(STORAGE_OUTPUT) || undefined;
        setSelected({
          mic: micSettings.deviceId,
          cam: camSettings.deviceId,
          output: savedOutput || outputs.find((d) => d.deviceId === 'default')?.deviceId,
        });
        if (savedOutput) applySinkIdToAllAudios(savedOutput);
      } catch { /* ignore */ }
    })();

    const onChange = () => {
      navigator.mediaDevices.enumerateDevices().then((list) => {
        if (cancelled) return;
        setDevices({
          mics: list.filter((d) => d.kind === 'audioinput'),
          cams: list.filter((d) => d.kind === 'videoinput'),
          outputs: list.filter((d) => d.kind === 'audiooutput'),
        });
      }).catch(() => {});
    };
    navigator.mediaDevices.addEventListener('devicechange', onChange);

    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', onClick), 0);

    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener('devicechange', onChange);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, localParticipant, onClose]);

  const switchMic = async (deviceId: string) => {
    setSelected((s) => ({ ...s, mic: deviceId }));
    try {
      // LiveKit v2: switchActiveDevice cuida de re-publicar o track corretamente.
      const room = (localParticipant as any).room;
      if (room?.switchActiveDevice) {
        await room.switchActiveDevice('audioinput', deviceId);
      } else {
        await (localParticipant as any).setMicrophoneTrack?.({ deviceId });
      }
    } catch (e) { console.warn('switch mic failed', e); }
  };

  const switchCam = async (deviceId: string) => {
    setSelected((s) => ({ ...s, cam: deviceId }));
    try {
      const room = (localParticipant as any).room;
      if (room?.switchActiveDevice) {
        await room.switchActiveDevice('videoinput', deviceId);
      } else {
        await (localParticipant as any).setCameraTrack?.({ deviceId });
      }
    } catch (e) { console.warn('switch cam failed', e); }
  };

  const switchOutput = (deviceId: string) => {
    setSelected((s) => ({ ...s, output: deviceId }));
    localStorage.setItem(STORAGE_OUTPUT, deviceId);
    applySinkIdToAllAudios(deviceId);
  };

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`absolute z-50 w-[340px] bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md p-2 ${anchorClassName}`}
    >
      <div className="flex items-center justify-between px-3 py-2 mb-1">
        <span className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-semibold">Audio / Video</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Section icon={<Mic className="w-3 h-3" />} label="Microfone">
        {devices.mics.length === 0 && <Empty>Sem microfones disponiveis</Empty>}
        {devices.mics.map((d) => (
          <DeviceRow
            key={d.deviceId}
            label={d.label || 'Microfone'}
            selected={selected.mic === d.deviceId}
            onClick={() => switchMic(d.deviceId)}
          />
        ))}
      </Section>

      <Section icon={<Video className="w-3 h-3" />} label="Camera">
        {devices.cams.length === 0 && <Empty>Sem cameras disponiveis</Empty>}
        {devices.cams.map((d) => (
          <DeviceRow
            key={d.deviceId}
            label={d.label || 'Camera'}
            selected={selected.cam === d.deviceId}
            onClick={() => switchCam(d.deviceId)}
          />
        ))}
      </Section>

      <Section icon={<Volume2 className="w-3 h-3" />} label="Saida de audio">
        {devices.outputs.length === 0 && <Empty>Saida nao selecionavel neste navegador</Empty>}
        {devices.outputs.map((d) => (
          <DeviceRow
            key={d.deviceId}
            label={d.label || 'Saida de audio'}
            selected={selected.output === d.deviceId}
            onClick={() => switchOutput(d.deviceId)}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="px-1 py-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DeviceRow({ label, selected, onClick }: { label: string; selected?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
        selected ? 'bg-primary/10 text-primary' : 'text-gray-300 hover:bg-white/5'
      }`}
    >
      <span className="truncate pr-2">{label}</span>
      {selected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-2 text-xs text-gray-600 italic">{children}</div>;
}
