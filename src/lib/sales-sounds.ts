// Sino de vendas sintético via Web Audio API.
// Não depende de arquivo MP3 (que pode 404'ar em deploy).
// Ressonância de bell: 2 osciladores (fundamental + harmônico),
// envelope com decay longo pra dar aquele tilintar.

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

interface PlayOptions {
  volume?: number; // 0..1
}

/**
 * Toca um sino curto (~1.2s) tipo "cha-ching" de caixa registradora.
 * Volume default 0.7. Pode ser chamado várias vezes em sequência.
 */
export function playSalesBell(opts: PlayOptions = {}) {
  try {
    const ctx = getCtx();
    const volume = Math.max(0, Math.min(1, opts.volume ?? 0.7));
    const now = ctx.currentTime;

    // Dois "ding" em sequência (cha-ching)
    const dings = [
      { time: 0, freq: 1318.5, dur: 0.6 },   // E6
      { time: 0.12, freq: 1760, dur: 0.9 },  // A6
    ];

    for (const ding of dings) {
      const t = now + ding.time;

      // Fundamental (sine pra suavidade)
      const oscFund = ctx.createOscillator();
      oscFund.type = "sine";
      oscFund.frequency.setValueAtTime(ding.freq, t);

      // Harmônico (triangle pra brilho)
      const oscHarm = ctx.createOscillator();
      oscHarm.type = "triangle";
      oscHarm.frequency.setValueAtTime(ding.freq * 2.01, t);

      // Envelope (attack rápido, decay longo)
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume * 0.5, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + ding.dur);

      // Filtro pra deixar mais "sino" e menos "beep"
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(4000, t);
      filter.Q.setValueAtTime(2, t);

      oscFund.connect(filter);
      oscHarm.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      oscFund.start(t);
      oscHarm.start(t);
      oscFund.stop(t + ding.dur);
      oscHarm.stop(t + ding.dur);
    }
  } catch (e) {
    console.warn("[sales-sounds] bell failed", e);
  }
}

// Duração do jingle (mantém curto pra não embolar o fluxo).
const F1_DURATION_MS = 2500;
const F1_FADE_MS = 400;

/**
 * Toca o jingle de comemoração F1 (mp3), capado em ~2.5s com fade-out.
 * Roda em paralelo com o sino.
 */
export function playSalesF1(opts: PlayOptions = {}) {
  try {
    const audio = new Audio("/sounds/f1-celebration.mp3");
    const targetVolume = Math.max(0, Math.min(1, opts.volume ?? 0.7));
    audio.volume = targetVolume;
    audio.play().catch((e) => console.warn("[sales-sounds] f1 mp3 failed", e));

    // Fade-out a partir de (duração - fade) e stop no fim
    const fadeStart = Math.max(0, F1_DURATION_MS - F1_FADE_MS);
    const fadeSteps = 10;
    const stepMs = F1_FADE_MS / fadeSteps;

    setTimeout(() => {
      let step = 0;
      const fadeTimer = setInterval(() => {
        step++;
        const ratio = 1 - step / fadeSteps;
        audio.volume = Math.max(0, targetVolume * ratio);
        if (step >= fadeSteps) {
          clearInterval(fadeTimer);
          audio.pause();
          audio.currentTime = 0;
        }
      }, stepMs);
    }, fadeStart);
  } catch (e) {
    console.warn("[sales-sounds] f1 instantiation failed", e);
  }
}

/** Toca ambos (uso normal pra venda). */
export function playSalesCelebration(opts: PlayOptions = {}) {
  playSalesBell(opts);
  playSalesF1(opts);
}
