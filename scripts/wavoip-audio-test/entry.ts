// Entry temporario do teste de audio de ligacao (scripts/_livetest-entry.ts).
import { Wavoip } from '@wavoip/wavoip-api';
import { patchAudioWorkletForWavoip, wavoipRemoteCapture } from '@/lib/wavoip-init';
(window as any).Wavoip = Wavoip;
(window as any).patchWavoip = patchAudioWorkletForWavoip;
(window as any).wavoipRemoteCapture = wavoipRemoteCapture;
