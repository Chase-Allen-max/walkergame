// Saved progress. Uses localStorage when it works; otherwise keeps progress
// in memory for this visit so the game still runs (e.g. private browsing,
// blocked storage). Nothing here leaves the device.

const KEY = 'walkers-dino-adventure-v1';

export const DEFAULT_SAVE = Object.freeze({
  best: 0,
  lifetimeFossils: 0,
  discoveries: 0,        // how many Dino Discoveries are unlocked
  unlockedLevel: 0,      // highest level index that can be played
  endless: false,        // Endless Adventure unlocked
  difficulty: 'explorer',
  sound: false,          // sound starts OFF
});

function getStore() {
  try {
    const ls = window.localStorage;
    const probe = '__wda_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function createStorage() {
  const store = getStore();
  let data = { ...DEFAULT_SAVE };
  if (store) {
    try {
      const raw = store.getItem(KEY);
      if (raw) data = sanitize({ ...DEFAULT_SAVE, ...JSON.parse(raw) });
    } catch { /* corrupted save: start fresh */ }
  }
  return {
    available: !!store,
    get data() { return data; },
    update(patch) {
      data = sanitize({ ...data, ...patch });
      if (store) {
        try { store.setItem(KEY, JSON.stringify(data)); } catch { /* full or blocked: keep in memory */ }
      }
      return data;
    },
    reset() {
      const keep = { difficulty: data.difficulty, sound: data.sound };
      data = { ...DEFAULT_SAVE, ...keep };
      if (store) { try { store.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ } }
      return data;
    },
  };
}

function sanitize(d) {
  const num = (v, max) => (Number.isFinite(+v) ? Math.max(0, Math.min(max, Math.floor(+v))) : 0);
  return {
    best: num(d.best, 1e9),
    lifetimeFossils: num(d.lifetimeFossils, 1e6),
    discoveries: num(d.discoveries, 6),
    unlockedLevel: num(d.unlockedLevel, 2),
    endless: !!d.endless,
    difficulty: ['explorer', 'adventurer', 'expert'].includes(d.difficulty) ? d.difficulty : 'explorer',
    sound: !!d.sound,
  };
}
