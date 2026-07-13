// Filtro de ruido RNNoise (IA, WASM) aplicado ao microfone via LiveKit TrackProcessor.
//
// Por que: o noiseSuppression nativo do navegador (audioCaptureDefaults) e' bom pra
// ruido continuo, mas deixa passar transientes tipo CLIQUE DE TECLADO, batida de mesa,
// clima de fundo. O RNNoise (rede neural leve, roda 100% no cliente) remove isso muito
// melhor. Krisp seria o ideal, mas so' funciona no LiveKit Cloud e nossa instancia e'
// self-hosted, entao usamos RNNoise (MIT, gratis) via @sapphi-red/web-noise-suppressor.
//
// Aplica pra TODO mundo (host, membro, lead) porque a sala e' um componente unico.
// Falha graciosa: se o browser nao suportar AudioWorklet/WASM, o processor nao seta
// processedTrack e o LiveKit publica a track original (com o NS nativo do navegador).

import { Track } from 'livekit-client';
import type { AudioProcessorOptions, TrackProcessor } from 'livekit-client';
import { loadRnnoise, RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';

// AudioContexts que ja' carregaram o modulo do worklet (addModule so' precisa 1x por ctx).
const workletLoaded = new WeakSet<AudioContext>();
// wasmBinary e' caro de baixar: cacheia por processo.
let rnnoiseWasmBinary: ArrayBuffer | null = null;

export function rnnoiseSupported(): boolean {
  return (
    typeof AudioWorkletNode !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof MediaStreamAudioDestinationNode !== 'undefined'
  );
}

class RnnoiseProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = 'rnnoise-noise-filter';
  processedTrack?: MediaStreamTrack;

  private audioContext?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private rnnoise?: RnnoiseWorkletNode;
  private destination?: MediaStreamAudioDestinationNode;
  private sourceStream?: MediaStream;

  async init(opts: AudioProcessorOptions): Promise<void> {
    // Se o ambiente nao suporta, sai sem setar processedTrack (LiveKit usa a original).
    if (!rnnoiseSupported()) {
      console.warn('[rnnoise] ambiente sem AudioWorklet/WASM, usando NS nativo');
      return;
    }
    try {
      const ctx = opts.audioContext;
      this.audioContext = ctx;

      if (!workletLoaded.has(ctx)) {
        await ctx.audioWorklet.addModule(rnnoiseWorkletUrl);
        workletLoaded.add(ctx);
      }
      if (!rnnoiseWasmBinary) {
        rnnoiseWasmBinary = await loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl });
      }

      this.sourceStream = new MediaStream([opts.track]);
      this.source = ctx.createMediaStreamSource(this.sourceStream);
      this.rnnoise = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: rnnoiseWasmBinary });
      this.destination = ctx.createMediaStreamDestination();

      this.source.connect(this.rnnoise);
      this.rnnoise.connect(this.destination);

      this.processedTrack = this.destination.stream.getAudioTracks()[0];
    } catch (e) {
      // Qualquer falha -> volta pra track original (nao deixa o mic mudo).
      console.warn('[rnnoise] init falhou, caindo pro NS nativo:', e);
      await this.teardown();
      this.processedTrack = undefined;
    }
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.teardown();
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    await this.teardown();
  }

  private async teardown(): Promise<void> {
    try { this.source?.disconnect(); } catch { /* noop */ }
    try { this.rnnoise?.disconnect(); } catch { /* noop */ }
    try { this.destination?.disconnect(); } catch { /* noop */ }
    // NAO fecha o audioContext: e' do LiveKit, compartilhado com outras tracks.
    this.processedTrack?.stop();
    this.processedTrack = undefined;
    this.source = undefined;
    this.rnnoise = undefined;
    this.destination = undefined;
    this.sourceStream = undefined;
  }
}

export function createRnnoiseProcessor(): RnnoiseProcessor {
  return new RnnoiseProcessor();
}
