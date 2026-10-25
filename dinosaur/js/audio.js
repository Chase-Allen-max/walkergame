// Small, gentle sound effects generated with the Web Audio API — no files.
// The AudioContext is only created after the player turns sound on (a user
// gesture), and every call is wrapped so the game works without audio.

let ctx = null;
let master = null;
let enabled = false;

function ensureContext() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;          // keep everything quiet
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function setSoundEnabled(on) {
  enabled = !!on;
  if (enabled) unlockAudio();
}

/** Call from a tap/click handler so iOS lets audio start. */
export function unlockAudio() {
  if (!enabled) return;
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function suspendAudio() {
  if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
}

function tone(freq, start, dur, { type = 'sine', vol = 1, slideTo = null } = {}) {
  const c = ctx;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  jump:       () => tone(380, 0, 0.16, { type: 'triangle', slideTo: 620, vol: 0.7 }),
  doubleJump: () => tone(520, 0, 0.16, { type: 'triangle', slideTo: 860, vol: 0.6 }),
  star:       () => { tone(880, 0, 0.09, { vol: 0.5 }); tone(1320, 0.06, 0.12, { vol: 0.4 }); },
  fossil:     () => [660, 830, 990].forEach((f, i) => tone(f, i * 0.07, 0.16, { type: 'triangle', vol: 0.5 })),
  hit:        () => tone(300, 0, 0.25, { type: 'sine', slideTo: 180, vol: 0.6 }),
  fall:       () => tone(420, 0, 0.35, { type: 'sine', slideTo: 200, vol: 0.5 }),
  complete:   () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.3, { type: 'triangle', vol: 0.5 })),
  click:      () => tone(600, 0, 0.05, { vol: 0.3 }),
};

export function play(name) {
  if (!enabled || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
  try { SOUNDS[name](); } catch { /* ignore audio errors */ }
}
