"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rarityTier } from "./gacha-engine";

type AudioRig = {
  context: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
  noise: AudioBuffer;
};

const SOUND_KEY = "goddess-gacha-sound-v3";
const MUSIC_KEY = "goddess-gacha-music-v1";
// Keep the final bus comfortably below full scale, but make the mix audible on
// small laptop speakers. Individual music voices are peak-budgeted below 0.55
// before these bus gains, leaving room for an SFX transient without clipping.
const MASTER_LEVEL = 0.52;
const SFX_LEVEL = 0.86;
const MUSIC_LEVEL = 0.92;
const MUSIC_BPM = 132;
const MUSIC_STEP_SECONDS = 60 / MUSIC_BPM / 4;
const MUSIC_LOOKAHEAD_SECONDS = 0.14;
const MUSIC_SCHEDULER_MS = 48;

function makeRig(): AudioRig | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;
  if (!AudioContextClass) return null;
  let context: AudioContext;
  try {
    context = new AudioContextClass({ latencyHint: "interactive" });
  } catch {
    try {
      context = new AudioContextClass();
    } catch {
      return null;
    }
  }

  const master = context.createGain();
  const sfx = context.createGain();
  const music = context.createGain();
  master.gain.value = MASTER_LEVEL;
  sfx.gain.value = SFX_LEVEL;
  music.gain.value = MUSIC_LEVEL;
  sfx.connect(master);
  music.connect(master);
  // DynamicsCompressorNode adds look-ahead latency. Effects are already gain-
  // staged, so the direct graph gives controls an audibly tighter response.
  master.connect(context.destination);

  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate * 1.5);
  const data = noise.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return { context, master, sfx, music, noise };
}

function note(number: number) {
  return 440 * 2 ** ((number - 69) / 12);
}

function resumeContext(context: AudioContext): Promise<void> {
  // Safari also exposes a non-standard `interrupted` state. Treat every
  // non-running, non-closed state as resumable so a fresh pointer gesture can
  // recover audio after an output-device change or tab suspension.
  if (context.state === "running" || context.state === "closed") return Promise.resolve();
  return context.resume().catch(() => undefined);
}

function tone(
  rig: AudioRig,
  frequency: number,
  delay: number,
  duration: number,
  peak: number,
  type: OscillatorType = "triangle",
  endFrequency?: number,
) {
  const start = rig.context.currentTime + delay;
  const oscillator = rig.context.createOscillator();
  const filter = rig.context.createBiquadFilter();
  const gain = rig.context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), start + duration);
  filter.type = "lowpass";
  filter.frequency.value = type === "square" ? 1800 : 5200;
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + Math.min(0.0015, duration * 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(rig.sfx);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function noiseBurst(
  rig: AudioRig,
  delay: number,
  duration: number,
  from: number,
  to: number,
  peak: number,
  type: BiquadFilterType = "bandpass",
) {
  const start = rig.context.currentTime + delay;
  const source = rig.context.createBufferSource();
  const filter = rig.context.createBiquadFilter();
  const gain = rig.context.createGain();
  source.buffer = rig.noise;
  filter.type = type;
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(Math.max(50, from), start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(50, to), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + Math.min(0.0015, duration * 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(rig.sfx);
  source.start(start, Math.random() * 0.7, duration);
  source.stop(start + duration + 0.03);
}

function cardSlap(rig: AudioRig, delay = 0, strength = 0.28) {
  noiseBurst(rig, delay, 0.075, 1700, 520, strength, "bandpass");
  noiseBurst(rig, delay + 0.012, 0.035, 5200, 2400, strength * 0.32, "highpass");
  tone(rig, 132, delay, 0.055, strength * 0.34, "sine", 82);
}

function musicTone(
  rig: AudioRig,
  midi: number,
  delay: number,
  duration: number,
  peak: number,
  type: OscillatorType = "sine",
  cutoff?: number,
  attack = 0.008,
) {
  const start = rig.context.currentTime + delay;
  const oscillator = rig.context.createOscillator();
  const filter = rig.context.createBiquadFilter();
  const gain = rig.context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = note(midi);
  filter.type = "lowpass";
  filter.frequency.value = cutoff ?? (type === "square" ? 1650 : type === "sawtooth" ? 920 : 2400);
  filter.Q.value = 1.2;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(attack, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(rig.music);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
}

function musicNoise(
  rig: AudioRig,
  delay: number,
  duration: number,
  frequency: number,
  peak: number,
  type: BiquadFilterType,
  q = 0.8,
) {
  const start = rig.context.currentTime + delay;
  const source = rig.context.createBufferSource();
  const filter = rig.context.createBiquadFilter();
  const gain = rig.context.createGain();
  source.buffer = rig.noise;
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.value = q;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.004, duration * 0.15));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(rig.music);
  source.start(start, Math.random() * 0.65, duration);
  source.stop(start + duration + 0.02);
}

function musicKick(rig: AudioRig, delay: number, accent = 1) {
  const start = rig.context.currentTime + delay;
  const oscillator = rig.context.createOscillator();
  const gain = rig.context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(148, start);
  oscillator.frequency.exponentialRampToValueAtTime(52, start + 0.15);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.22 * accent, start + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  oscillator.connect(gain);
  gain.connect(rig.music);
  oscillator.start(start);
  oscillator.stop(start + 0.2);
  // The short click keeps the kick present on MacBook and phone speakers.
  musicNoise(rig, delay, 0.018, 2100, 0.025 * accent, "bandpass", 1.4);
}

function musicSnare(rig: AudioRig, delay: number, accent = 1) {
  musicNoise(rig, delay, 0.14, 1750, 0.1 * accent, "bandpass", 0.75);
  musicNoise(rig, delay, 0.055, 6200, 0.035 * accent, "highpass", 0.5);
  musicTone(rig, 54, delay, 0.09, 0.032 * accent, "triangle", 750, 0.003);
}

function musicHat(rig: AudioRig, delay: number, open = false, accent = 1) {
  musicNoise(rig, delay, open ? 0.12 : 0.035, open ? 6900 : 8200, (open ? 0.033 : 0.025) * accent, "highpass", 0.55);
}

export function useGachaAudio() {
  const rig = useRef<AudioRig | null>(null);
  const mutedRef = useRef(false);
  const musicEnabledRef = useRef(true);
  const musicTimer = useRef<number | null>(null);
  const musicStep = useRef(0);
  const musicNextStepAt = useRef(0);
  const [muted, setMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);

  useEffect(() => {
    const initialMuted = window.localStorage.getItem(SOUND_KEY) === "muted";
    const initialMusic = window.localStorage.getItem(MUSIC_KEY) !== "off";
    mutedRef.current = initialMuted;
    musicEnabledRef.current = initialMusic;
    const syncPreferences = window.setTimeout(() => {
      setMuted(initialMuted);
      setMusicEnabled(initialMusic);
    }, 0);
    const prime = () => {
      if (mutedRef.current) return;
      let current = rig.current;
      if (!current || current.context.state === "closed") {
        // Constructing the context inside the input gesture is substantially
        // more reliable than creating it during hydration on desktop Safari.
        current = makeRig();
        rig.current = current;
      }
      if (current) void resumeContext(current.context);
    };
    document.addEventListener("pointerdown", prime, true);
    document.addEventListener("keydown", prime, true);
    return () => {
      window.clearTimeout(syncPreferences);
      document.removeEventListener("pointerdown", prime, true);
      document.removeEventListener("keydown", prime, true);
      if (musicTimer.current !== null) window.clearInterval(musicTimer.current);
      const current = rig.current;
      rig.current = null;
      void current?.context.close();
    };
  }, []);

  const ensure = useCallback(async () => {
    if (!rig.current || rig.current.context.state === "closed") rig.current = makeRig();
    const current = rig.current;
    if (current) await resumeContext(current.context);
    return current;
  }, []);

  const trigger = useCallback((emit: (current: AudioRig) => void): Promise<void> => {
    if (mutedRef.current) return Promise.resolve();
    let current = rig.current;
    if (!current || current.context.state === "closed") {
      current = makeRig();
      rig.current = current;
    }
    if (current) {
      // Web Audio nodes can be scheduled while suspended. Queue them in the
      // input event itself, then resume; promise-gating here costs a frame.
      emit(current);
      void resumeContext(current.context);
      return Promise.resolve();
    }
    return Promise.resolve();
  }, []);

  const stopMusic = useCallback(() => {
    if (musicTimer.current !== null) window.clearInterval(musicTimer.current);
    musicTimer.current = null;
    musicNextStepAt.current = 0;
    const current = rig.current;
    if (current) current.music.gain.setTargetAtTime(0, current.context.currentTime, 0.08);
  }, []);

  const beginMusic = useCallback((): Promise<void> => {
    if (mutedRef.current || !musicEnabledRef.current) return Promise.resolve();
    let current = rig.current;
    if (!current || current.context.state === "closed") {
      current = makeRig();
      rig.current = current;
    }
    if (!current) return Promise.resolve();
    const activeRig = current;
    void resumeContext(activeRig.context);
    activeRig.music.gain.setTargetAtTime(MUSIC_LEVEL, activeRig.context.currentTime, 0.035);
    if (musicTimer.current !== null) return Promise.resolve();

    // Four bars of A-minor arcade pop. The drums land on a club groove while
    // the upper arpeggio changes shape each bar, avoiding the old one-line
    // metronome feel without requiring any downloaded audio assets.
    const roots = [45, 48, 41, 43];
    const chordKinds = [0, 1, 1, 1]; // A minor, C major, F major, G major
    const bassPattern: Array<number | null> = [0, null, null, 0, null, null, 7, null, 12, null, null, 7, null, null, 0, null];
    const arpShapes = [
      [12, 19, 24, 19, 15, 19, 24, 27],
      [12, 16, 19, 24, 19, 16, 24, 28],
      [12, 16, 19, 24, 28, 24, 19, 16],
      [12, 19, 24, 26, 19, 14, 17, 23],
    ];
    const kickSteps = new Set([0, 3, 7, 8, 11, 14]);

    const scheduleStep = (absoluteStep: number, delay: number) => {
      const bar = Math.floor(absoluteStep / 16) % roots.length;
      const step = absoluteStep % 16;
      const root = roots[bar];

      if (kickSteps.has(step)) musicKick(activeRig, delay, step === 0 || step === 8 ? 1 : 0.78);
      if (step === 4 || step === 12) musicSnare(activeRig, delay, step === 12 ? 1.06 : 0.94);
      if (step % 2 === 0) musicHat(activeRig, delay, step === 14, step % 4 === 0 ? 1 : 0.72);
      else if (step === 7 || step === 15) musicHat(activeRig, delay, false, 0.42);

      const bassOffset = bassPattern[step];
      if (bassOffset !== null) {
        musicTone(activeRig, root + bassOffset, delay, step === 14 ? 0.19 : 0.25, 0.075, "sawtooth", 720, 0.006);
      }

      if (step % 2 === 0) {
        const arpIndex = Math.floor(step / 2);
        const octaveLift = absoluteStep % 64 >= 48 && (arpIndex === 3 || arpIndex === 7) ? 12 : 0;
        musicTone(activeRig, root + arpShapes[bar][arpIndex] + octaveLift, delay, 0.12, 0.044, "square", 2100, 0.004);
      }

      if (step === 0) {
        const third = chordKinds[bar] === 0 ? 3 : 4;
        [root + 12, root + 12 + third, root + 19].forEach((midi, index) => {
          musicTone(activeRig, midi, delay + index * 0.008, 0.82, 0.014, "triangle", 1550, 0.045);
        });
      }

      // A tiny end-of-bar sparkle advertises the loop without overpowering
      // game reveals, which remain on their independent SFX bus.
      if (step === 15 && bar % 2 === 1) {
        musicTone(activeRig, root + 31, delay, 0.18, 0.032, "sine", 3600, 0.003);
      }
    };

    musicNextStepAt.current = activeRig.context.currentTime + 0.012;
    const pump = () => {
      const now = activeRig.context.currentTime;
      if (musicNextStepAt.current < now - MUSIC_STEP_SECONDS * 2) {
        // Recover cleanly after a background-tab throttle without scheduling a
        // burst of every missed beat.
        musicNextStepAt.current = now + 0.012;
      }
      while (musicNextStepAt.current < now + MUSIC_LOOKAHEAD_SECONDS) {
        scheduleStep(musicStep.current, Math.max(0.002, musicNextStepAt.current - now));
        musicStep.current += 1;
        musicNextStepAt.current += MUSIC_STEP_SECONDS;
      }
    };
    pump();
    musicTimer.current = window.setInterval(pump, MUSIC_SCHEDULER_MS);
    return Promise.resolve();
  }, []);

  const toggleMuted = useCallback(async () => {
    const next = !mutedRef.current;
    if (!next) await ensure();
    mutedRef.current = next;
    setMuted(next);
    window.localStorage.setItem(SOUND_KEY, next ? "muted" : "on");
    const current = rig.current;
    if (current) current.master.gain.setTargetAtTime(next ? 0 : MASTER_LEVEL, current.context.currentTime, 0.025);
    if (!next && musicEnabledRef.current) void beginMusic();
  }, [beginMusic, ensure]);

  const startMusic = useCallback(() => beginMusic(), [beginMusic]);

  const toggleMusic = useCallback(async () => {
    const next = !musicEnabledRef.current;
    musicEnabledRef.current = next;
    setMusicEnabled(next);
    window.localStorage.setItem(MUSIC_KEY, next ? "on" : "off");
    if (next) await beginMusic();
    else stopMusic();
  }, [beginMusic, stopMusic]);

  const playFoil = useCallback((progress = 0.25) => {
    void beginMusic();
    return trigger((current) => {
      noiseBurst(current, 0, 0.1, 900 + progress * 1600, 5600, 0.22, "highpass");
      tone(current, 320 + progress * 80, 0.01, 0.045, 0.045, "square");
    });
  }, [beginMusic, trigger]);

  const playTear = useCallback(() => trigger((current) => {
      noiseBurst(current, 0, 0.42, 650, 7600, 0.65, "bandpass");
      noiseBurst(current, 0.13, 0.24, 7200, 1100, 0.23, "highpass");
      tone(current, 118, 0.2, 0.18, 0.34, "sine", 48);
      cardSlap(current, 0.39, 0.34);
    }), [trigger]);

  const playCardTravel = useCallback(() => trigger((current) => {
      noiseBurst(current, 0, 0.13, 850, 4300, 0.18, "highpass");
      cardSlap(current, 0, 0.25);
    }), [trigger]);

  const playReveal = useCallback((rarity: string) => trigger((current) => {
    const tier = rarityTier(rarity);
    cardSlap(current, 0, tier >= 3 ? 0.45 : 0.29);
    if (tier === 0) return;
    if (tier === 1) {
      tone(current, note(72), 0, 0.22, 0.12, "sine");
      tone(current, note(79), 0.07, 0.18, 0.07, "triangle");
      return;
    }
    if (tier === 2) {
      [74, 81, 86].forEach((value, index) => tone(current, note(value), index * 0.075, 0.35, 0.14 - index * 0.025, "sine"));
      noiseBurst(current, 0.13, 0.32, 7600, 2500, 0.1, "highpass");
      return;
    }

    tone(current, tier >= 4 ? 74 : 86, 0, 0.3, 0.42, "sine", 43);
    noiseBurst(current, 0.04, tier >= 4 ? 0.85 : 0.58, 380, 8200, tier >= 4 ? 0.44 : 0.32, "bandpass");
    const chord = tier >= 4 ? [60, 64, 67, 72, 79] : [62, 67, 71, 74];
    chord.forEach((value, index) => tone(current, note(value), index * 0.075, 0.58 + index * 0.08, tier >= 4 ? 0.2 : 0.15, index % 2 ? "triangle" : "sine"));
    if (tier >= 4) {
      noiseBurst(current, 0.46, 0.7, 9200, 1800, 0.2, "highpass");
      tone(current, note(84), 0.57, 0.62, 0.16, "sine");
    }
  }), [trigger]);

  const playShrineDrop = useCallback((beat = 0) => {
    void beginMusic();
    return trigger((current) => cardSlap(current, 0, 0.3 + Math.min(beat, 3) * 0.02));
  }, [beginMusic, trigger]);

  const playShrineBounce = useCallback((index: number) => trigger((current) => {
    tone(current, 310 + (index % 4) * 65, 0, 0.055, 0.08, "square");
    noiseBurst(current, 0, 0.035, 2600, 900, 0.1, "bandpass");
  }), [trigger]);

  const playShrineWin = useCallback((cost: number) => trigger((current) => {
    tone(current, 86, 0, 0.24, 0.38, "sine", 45);
    cardSlap(current, 0.1, 0.42);
    [60, 64, 67, cost >= 10 ? 76 : 72].forEach((value, index) => {
      tone(current, note(value), 0.16 + index * 0.09, 0.55 + index * 0.06, cost >= 10 ? 0.18 : 0.13, "triangle");
    });
    noiseBurst(current, 0.32, 0.55, 7200, 1500, cost >= 10 ? 0.2 : 0.12, "highpass");
  }), [trigger]);

  const playDuelLock = useCallback((quality: "perfect" | "hit" | "miss", streak: number) => trigger((current) => {
    if (quality === "miss") {
      noiseBurst(current, 0, 0.09, 980, 240, 0.22, "bandpass");
      tone(current, 118, 0, 0.16, 0.22, "square", 72);
      return;
    }
    const lift = Math.min(streak, 4) * 2;
    cardSlap(current, 0, quality === "perfect" ? 0.42 : 0.3);
    const notes = quality === "perfect" ? [76, 83, 88] : [72, 79];
    notes.forEach((value, index) => tone(current, note(value + lift), index * 0.055, 0.24 + index * 0.05, quality === "perfect" ? 0.16 : 0.11, index % 2 ? "triangle" : "sine"));
    if (quality === "perfect") noiseBurst(current, 0, 0.28, 7600, 2800, 0.13, "highpass");
  }), [trigger]);

  const playUiTap = useCallback(() => trigger((current) => {
    noiseBurst(current, 0, 0.045, 3200, 1050, 0.14, "bandpass");
    tone(current, 190, 0, 0.065, 0.13, "square", 128);
  }), [trigger]);

  const playDuelStart = useCallback(() => trigger((current) => {
    cardSlap(current, 0, 0.38);
    [60, 67, 72].forEach((value, index) => {
      tone(current, note(value), index * 0.045, 0.28 + index * 0.04, 0.16 - index * 0.02, index === 1 ? "triangle" : "sine");
    });
  }), [trigger]);

  const playDuelLoss = useCallback(() => trigger((current) => {
    noiseBurst(current, 0, 0.2, 1500, 210, 0.24, "bandpass");
    tone(current, note(48), 0, 0.3, 0.2, "square", note(36));
  }), [trigger]);

  const playSummary = useCallback((highestTier: number) => trigger((current) => {
    [60, 64 + Math.min(highestTier, 2), 67 + Math.min(highestTier, 3)].forEach((value, index) => {
      tone(current, note(value), index * 0.075, 0.38, 0.1 + highestTier * 0.016, "sine");
    });
  }), [trigger]);

  return {
    muted,
    musicEnabled,
    toggleMuted,
    toggleMusic,
    startMusic,
    playFoil,
    playTear,
    playCardTravel,
    playReveal,
    playShrineDrop,
    playShrineBounce,
    playShrineWin,
    playDuelLock,
    playUiTap,
    playDuelStart,
    playDuelLoss,
    playSummary,
  };
}
