// Minimalist notification sounds via Web Audio API
// All sounds: quiet (gain 0.15-0.25), short (80-300ms), smooth fade-outs

import { getNotificationSettings } from "@/hooks/useNotificationSettings";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  g.gain.setValueAtTime(gain, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function canPlay(): boolean {
  const { sound } = getNotificationSettings();
  return sound;
}

/** Soft swoosh — message sent */
export function playMessageSent() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  // Quick descending sweep
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.12);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Two soft knocks — message received */
export function playMessageReceived() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 520, t, 0.1, 0.2, "triangle");
  tone(ctx, 660, t + 0.12, 0.12, 0.15, "triangle");
}

/** Melodic ascending trio — new job */
export function playNewJob() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 440, t, 0.15, 0.2, "triangle");
  tone(ctx, 550, t + 0.16, 0.15, 0.18, "triangle");
  tone(ctx, 660, t + 0.32, 0.2, 0.22, "triangle");
}

/** Soft ding — status update */
export function playStatusUpdate() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 700, t, 0.25, 0.15, "sine");
}

/** Two ascending tones — success / accepted */
export function playSuccess() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, 500, t, 0.15, 0.2, "sine");
  tone(ctx, 750, t + 0.18, 0.25, 0.22, "sine");
}
