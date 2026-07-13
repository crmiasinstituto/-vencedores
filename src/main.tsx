import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { patchAudioWorkletForWavoip } from './lib/wavoip-init'

// Patches no AudioWorklet + AudioWorkletNode + RTCPeerConnection ANTES de qualquer
// import do SDK WaVoIP rodar. Resolve 3 bugs:
//   1) libsamplerate.min.js UMD nao carrega em AudioWorkletGlobalScope
//   2) Vite optimizeDeps corrompe data URLs do SDK
//   3) SDK nao expoe stream de audio remoto pra transcricao
// Sem isso o startCall do WaVoIP pode dar TIMEOUT_15S silencioso.
patchAudioWorkletForWavoip();

createRoot(document.getElementById("root")!).render(<App />);
// build: 1776091819
