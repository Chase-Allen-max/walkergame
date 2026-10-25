// ---------------------------------------------------------------------------
// All of the game's pictures, drawn with Canvas paths (no image files).
// Screen coordinates here: x to the right, y DOWN, in "view units".
// ---------------------------------------------------------------------------

import { OBSTACLES } from './config.js';

export const THEMES = {
  fern: {
    skyTop: '#6ec8ff', skyBottom: '#d9f4ff', sun: '#fff1a1', sunGlow: 'rgba(255,241,161,0.35)',
    cloud: '#ffffff', mountain: '#a6c8e6', mountain2: '#8fbad9',
    hill: '#8fd47a', hill2: '#74c463', farDino: '#7fb3a0',
    tree: '#3f9d4a', trunk: '#8a5a3b', fern: '#3c9a45', fern2: '#57b35a',
    grass: '#79cf4f', grassDark: '#5bb33d', dirt: '#b07a45', dirtDark: '#94653a', pit: '#4a3322',
    rock: '#a3a8b5', rockDark: '#6c7180', rockLight: '#d3d7df',
  },
  canyon: {
    skyTop: '#ffb978', skyBottom: '#ffeacb', sun: '#fff6d8', sunGlow: 'rgba(255,246,216,0.4)',
    cloud: '#fff4e6', mountain: '#e6a777', mountain2: '#d88f5c',
    hill: '#e7b27a', hill2: '#d89a5d', farDino: '#c98a62',
    tree: '#6b9a3a', trunk: '#8a5a3b', fern: '#7aa346', fern2: '#93b957',
    grass: '#f0c47c', grassDark: '#d9a75c', dirt: '#c98a4b', dirtDark: '#ad733b', pit: '#5a3a24',
    rock: '#9e8f86', rockDark: '#5f524c', rockLight: '#cdbfb6',
  },
  volcano: {
    skyTop: '#6b5aa6', skyBottom: '#ffc58a', skyMid: '#ff9474', sun: '#ffd27a', sunGlow: 'rgba(255,200,120,0.45)',
    cloud: '#ffd0c0', mountain: '#7a5470', mountain2: '#5f4560',
    hill: '#8a5d63', hill2: '#734b55', farDino: '#7a5568',
    tree: '#4f6b3c', trunk: '#5b3b2c', fern: '#5f8a3e', fern2: '#729c48',
    grass: '#b9845a', grassDark: '#9c6c48', dirt: '#7d5240', dirtDark: '#653f31', pit: '#2e1c18',
    rock: '#b3b0bb', rockDark: '#55505e', rockLight: '#e3e0e8',
  },
};

const DINO_COLORS = {
  body: '#6ad35a', outline: '#1d5a2a', belly: '#f4f8cc', spikes: '#ff9f43',
  spots: '#4cb545', cheek: 'rgba(255,140,170,0.7)', leg: '#58c04b',
};

// Deterministic pseudo-random number for scenery placement.
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x) {
  return Math.sin(x * 0.0021) * 0.5 + Math.sin(x * 0.0053 + 1.3) * 0.3 + Math.sin(x * 0.011 + 2.1) * 0.2;
}

// ---------------------------------------------------------------- dinosaur
/**
 * Draw Walker's dinosaur. (x, y) = point between the feet.
 * opts: scale, runPhase, air, vy, squash (0..1), hurt, happy, blink, glow, time
 */
export function drawDino(ctx, x, y, o = {}) {
  const s = o.scale || 1;
  const t = o.time || 0;
  const phase = o.runPhase || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  if (o.glow) {
    // gentle golden glow while protected (slow pulse, never flashing)
    const a = 0.28 + 0.12 * Math.sin(t * 3.5);
    const g = ctx.createRadialGradient(4, -32, 8, 4, -32, 58);
    g.addColorStop(0, `rgba(255,236,140,${a + 0.2})`);
    g.addColorStop(1, 'rgba(255,236,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(4, -32, 58, 0, Math.PI * 2); ctx.fill();
  }

  const k = o.squash || 0;
  ctx.scale(1 + 0.12 * k, 1 - 0.15 * k);
  const bob = o.air ? 0 : -Math.abs(Math.sin(phase)) * 2.2;
  ctx.translate(0, bob);
  const tilt = o.air ? Math.max(-0.25, Math.min(0.25, -(o.vy || 0) * 0.00035)) : 0;
  ctx.translate(0, -26); ctx.rotate(tilt); ctx.translate(0, 26);

  // legs
  const legA = o.air ? 0.55 : Math.sin(phase) * 0.65;
  const legB = o.air ? -0.35 : -Math.sin(phase) * 0.65;
  drawLeg(ctx, -6, -15, legA, true);
  drawLeg(ctx, 9, -15, legB, false);

  // silhouette: thick outline first, then fills, so the outline wraps the whole body
  const wag = Math.sin(t * 6) * 2;
  const shapes = (c) => {
    c.beginPath();
    c.moveTo(-12, -36); c.quadraticCurveTo(-34, -36, -46, -22 + wag); c.quadraticCurveTo(-30, -16, -10, -16); c.closePath();
    c.moveTo(22, -27); c.ellipse(0, -27, 22, 16, 0, 0, Math.PI * 2);
    c.moveTo(35, -46); c.ellipse(20, -46, 15, 13, 0, 0, Math.PI * 2);
    c.moveTo(41, -42); c.ellipse(30, -42, 11, 8.5, 0, 0, Math.PI * 2);
    c.moveTo(18, -32); c.ellipse(13, -36, 8, 10, -0.5, 0, Math.PI * 2); // neck
  };
  // back spikes
  ctx.fillStyle = DINO_COLORS.spikes;
  ctx.strokeStyle = DINO_COLORS.outline; ctx.lineWidth = 2;
  for (const [sx, sy, r] of [[-14, -39, 5], [-4, -42, 6], [7, -41, 5.5], [15, -55, 4.5]]) {
    ctx.beginPath(); ctx.moveTo(sx - r, sy + 2); ctx.lineTo(sx, sy - r - 1); ctx.lineTo(sx + r, sy + 2); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.lineJoin = 'round';
  shapes(ctx); ctx.lineWidth = 5; ctx.strokeStyle = DINO_COLORS.outline; ctx.stroke();
  shapes(ctx); ctx.fillStyle = DINO_COLORS.body; ctx.fill();

  // belly + spots
  ctx.fillStyle = DINO_COLORS.belly;
  ctx.beginPath(); ctx.ellipse(6, -21, 13, 8, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DINO_COLORS.spots;
  for (const [px, py, r] of [[-8, -32, 3.2], [-1, -37, 2.4], [-15, -26, 2.2], [14, -51, 2]]) {
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }

  // arm
  ctx.save();
  ctx.translate(16, -25); ctx.rotate(o.air ? -0.8 : Math.sin(phase + 1) * 0.4);
  ctx.fillStyle = DINO_COLORS.leg; ctx.strokeStyle = DINO_COLORS.outline; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(3, 2, 6, 3, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  // face
  ctx.fillStyle = DINO_COLORS.cheek;
  ctx.beginPath(); ctx.arc(28, -39, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = DINO_COLORS.outline; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(29, -36.5); ctx.quadraticCurveTo(34, -34, 38.5, -38); ctx.stroke(); // smile
  ctx.fillStyle = DINO_COLORS.outline;
  ctx.beginPath(); ctx.arc(37.5, -45, 1.2, 0, Math.PI * 2); ctx.fill(); // nostril

  if (o.hurt) {
    // dizzy swirl eyes + little circling stars (friendly, not scary)
    ctx.strokeStyle = DINO_COLORS.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(23, -50, 4.5, 0, Math.PI * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(23, -50, 2, Math.PI, Math.PI * 2.6); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + i * 2.1;
      drawStarShape(ctx, 20 + Math.cos(a) * 16, -66 + Math.sin(a) * 4, 4, '#ffd23f', '#e08a00');
    }
  } else if (o.happy || o.blink) {
    ctx.strokeStyle = DINO_COLORS.outline; ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (o.happy) { ctx.moveTo(18.5, -49); ctx.quadraticCurveTo(23, -55, 27.5, -49); }
    else { ctx.moveTo(18, -50); ctx.lineTo(28, -50); }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = DINO_COLORS.outline; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(23, -50, 6.5, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const look = o.air ? -1 : 0;
    ctx.fillStyle = '#1b2a1e';
    ctx.beginPath(); ctx.arc(25, -49.5 + look, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(26.4, -51.2 + look, 1.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawLeg(ctx, hx, hy, angle, back) {
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(angle);
  ctx.fillStyle = back ? '#4aa83f' : DINO_COLORS.leg;
  ctx.strokeStyle = DINO_COLORS.outline; ctx.lineWidth = 2.5;
  roundRect(ctx, -5, -2, 10, 16, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(3, 14, 7, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawDinoShadow(ctx, x, groundY, height, scale = 1) {
  const k = Math.max(0.35, 1 - height / 220);
  ctx.fillStyle = `rgba(0,0,0,${0.18 * k})`;
  ctx.beginPath(); ctx.ellipse(x, groundY + 2, 30 * k * scale, 6 * k * scale, 0, 0, Math.PI * 2); ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawStarShape(ctx, x, y, r, fill, stroke, rot = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.48 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, r * 0.16); ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
}

function drawBone(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35); ctx.scale(s, s);
  const shape = () => {
    ctx.beginPath();
    roundRectPath(ctx, -12, -3.5, 24, 7, 3);
    for (const [cx, cy] of [[-13, -4], [-13, 4], [13, -4], [13, 4]]) { ctx.moveTo(cx + 5, cy); ctx.arc(cx, cy, 5, 0, Math.PI * 2); }
  };
  shape(); ctx.lineWidth = 4; ctx.strokeStyle = '#7a4b22'; ctx.stroke();
  shape(); ctx.fillStyle = '#fff3d6'; ctx.fill();
  ctx.restore();
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------------------------------------------------------------- scenery
function drawSky(ctx, th, w, h, groundY) {
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, th.skyTop);
  if (th.skyMid) g.addColorStop(0.6, th.skyMid);
  g.addColorStop(1, th.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, groundY + 2);
}

function drawSun(ctx, th, w, groundY, key) {
  const x = key === 'volcano' ? w * 0.7 : w * 0.82;
  const y = key === 'volcano' ? groundY - 150 : groundY - 260;
  const r = key === 'volcano' ? 46 : 30;
  ctx.fillStyle = th.sunGlow;
  ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = th.sun;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function ridge(ctx, w, h, camX, p, baseY, amp, color, offset, step = 14) {
  const off = camX * p + offset;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + step; x += step) ctx.lineTo(x, baseY - amp * (0.5 + 0.5 * noise(x + off)));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawMesas(ctx, th, w, camX, groundY) {
  const p = 0.08, spacing = 380;
  const off = camX * p;
  const first = Math.floor((off - 400) / spacing);
  for (let i = first; i < first + Math.ceil(w / spacing) + 3; i++) {
    const x = i * spacing - off + hash(i) * 120;
    const mw = 180 + hash(i + 5) * 160, mh = 80 + hash(i + 9) * 80;
    const base = groundY - 40;
    ctx.fillStyle = i % 2 ? th.mountain : th.mountain2;
    ctx.beginPath();
    ctx.moveTo(x, base); ctx.lineTo(x + 26, base - mh); ctx.lineTo(x + mw - 26, base - mh); ctx.lineTo(x + mw, base);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 22, base - mh + 14, mw - 44, 6);
  }
}

function drawVolcanoes(ctx, th, w, camX, groundY, t, still) {
  const p = 0.06, spacing = 620;
  const off = camX * p;
  const first = Math.floor((off - 500) / spacing);
  for (let i = first; i < first + Math.ceil(w / spacing) + 3; i++) {
    const cx = i * spacing - off + hash(i + 3) * 160;
    const vh = 150 + hash(i + 1) * 70, vw = 190 + hash(i + 2) * 80;
    const base = groundY - 30;
    ctx.fillStyle = th.mountain2;
    ctx.beginPath();
    ctx.moveTo(cx - vw, base); ctx.lineTo(cx - 22, base - vh); ctx.lineTo(cx + 22, base - vh); ctx.lineTo(cx + vw, base);
    ctx.closePath(); ctx.fill();
    // warm glow at the crater (steady, no eruption)
    const g = ctx.createRadialGradient(cx, base - vh, 2, cx, base - vh, 40);
    g.addColorStop(0, 'rgba(255,170,90,0.75)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, base - vh, 40, 0, Math.PI * 2); ctx.fill();
    // slow soft smoke puffs
    ctx.fillStyle = 'rgba(230,215,225,0.45)';
    for (let k = 0; k < 4; k++) {
      const life = still ? k / 4 : ((t * 0.08 + k / 4 + hash(i)) % 1);
      ctx.beginPath();
      ctx.arc(cx + life * 30 + Math.sin(life * 6) * 6, base - vh - 12 - life * 90, 10 + life * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawClouds(ctx, th, w, camX, groundY, t, still) {
  const p = 0.15, spacing = 330;
  const off = camX * p + (still ? 0 : t * 6);
  const first = Math.floor(off / spacing) - 1;
  ctx.fillStyle = th.cloud;
  for (let i = first; i < first + Math.ceil(w / spacing) + 3; i++) {
    if (hash(i + 40) < 0.25) continue;
    const x = i * spacing - off + hash(i) * 140;
    const y = groundY - 230 - hash(i + 7) * 110;
    const s = 0.7 + hash(i + 11) * 0.6;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(x, y, 34 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 22 * s, y + 4 * s, 20 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 24 * s, y + 3 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 2 * s, y - 9 * s, 20 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Gentle long-necked dinosaurs strolling far away
function drawFarDinos(ctx, th, w, camX, groundY, t, still) {
  const p = 0.22, spacing = 1500;
  const walk = still ? 0 : t * 5;
  const off = camX * p - walk;
  const first = Math.floor((off - 300) / spacing);
  ctx.fillStyle = th.farDino;
  for (let i = first; i < first + Math.ceil(w / spacing) + 2; i++) {
    if (hash(i + 77) < 0.35) continue;
    const x = i * spacing - off + hash(i + 70) * 500;
    const y = groundY - 52;
    const s = 0.55 + hash(i + 71) * 0.25;
    const step = still ? 0 : Math.sin(t * 1.6 + i) * 3;
    ctx.save(); ctx.translate(x, y); ctx.scale(-s, s); // walking left->right slower than camera
    ctx.beginPath();
    ctx.ellipse(0, 0, 40, 18, 0, 0, Math.PI * 2);
    ctx.moveTo(30, -6); ctx.quadraticCurveTo(52, -30, 54, -66); ctx.lineTo(64, -66); ctx.quadraticCurveTo(62, -30, 40, 4); // neck
    ctx.moveTo(54, -66); ctx.ellipse(62, -68, 10, 6, 0, 0, Math.PI * 2);
    ctx.moveTo(-36, -4); ctx.quadraticCurveTo(-70, 2, -86, 14); ctx.quadraticCurveTo(-64, 10, -34, 10); // tail
    ctx.fill();
    for (const [lx, d] of [[-24, step], [-12, -step], [16, -step], [28, step]]) ctx.fillRect(lx + d * 0.3, 8, 8, 24);
    ctx.restore();
  }
}

function drawHillsAndTrees(ctx, th, key, w, h, camX, groundY) {
  ridge(ctx, w, h, camX, 0.3, groundY - 16, 60, th.hill, 900);
  const p = 0.42, spacing = 120;
  const off = camX * p;
  const first = Math.floor(off / spacing) - 1;
  for (let i = first; i < first + Math.ceil(w / spacing) + 3; i++) {
    const r = hash(i + 200);
    if (r < (key === 'canyon' ? 0.65 : 0.35)) continue;
    const x = i * spacing - off + hash(i + 201) * 60;
    const base = groundY - 12 - 20 * hash(i + 202);
    const s = 0.7 + hash(i + 203) * 0.5;
    if (key === 'canyon' || r > 0.8) drawTreeFern(ctx, x, base, s, th);
    else drawConifer(ctx, x, base, s, th);
  }
  ridge(ctx, w, h, camX, 0.5, groundY + 2, 26, th.hill2, 300);
}

function drawConifer(ctx, x, base, s, th) {
  ctx.fillStyle = th.trunk;
  ctx.fillRect(x - 3 * s, base - 18 * s, 6 * s, 18 * s);
  ctx.fillStyle = th.tree;
  for (let k = 0; k < 3; k++) {
    const y = base - 16 * s - k * 18 * s;
    const ww = (28 - k * 6) * s;
    ctx.beginPath(); ctx.moveTo(x - ww, y); ctx.lineTo(x, y - 30 * s); ctx.lineTo(x + ww, y); ctx.closePath(); ctx.fill();
  }
}

function drawTreeFern(ctx, x, base, s, th) {
  ctx.strokeStyle = th.trunk; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + 4 * s, base - 30 * s, x, base - 56 * s); ctx.stroke();
  ctx.strokeStyle = th.tree; ctx.lineWidth = 4 * s;
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.55;
    ctx.beginPath(); ctx.moveTo(x, base - 56 * s);
    ctx.quadraticCurveTo(x + Math.cos(a) * 24 * s, base - 56 * s + Math.sin(a) * 24 * s - 6 * s,
      x + Math.cos(a) * 40 * s, base - 50 * s + Math.sin(a) * 18 * s + 14 * s);
    ctx.stroke();
  }
}

function drawFerns(ctx, th, key, w, camX, groundY) {
  const p = 0.75, spacing = 70;
  const off = camX * p;
  const first = Math.floor(off / spacing) - 1;
  for (let i = first; i < first + Math.ceil(w / spacing) + 3; i++) {
    if (hash(i + 400) < 0.45) continue;
    const x = i * spacing - off + hash(i + 401) * 40;
    const s = 0.6 + hash(i + 402) * 0.6;
    drawFern(ctx, x, groundY + 1, s, hash(i + 403) > 0.5 ? th.fern : th.fern2);
  }
}

function drawFern(ctx, x, y, s, color) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
  for (const dir of [-1, -0.45, 0.45, 1]) {
    ctx.lineWidth = 2.5 * s;
    const ex = x + dir * 26 * s, ey = y - (30 - Math.abs(dir) * 12) * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dir * 6 * s, ey - 6 * s, ex, ey); ctx.stroke();
    for (let k = 1; k <= 4; k++) {
      const f = k / 5;
      const px = x + (ex - x) * f, py = y + (ey - y) * f - Math.sin(f * Math.PI) * 4 * s;
      ctx.beginPath(); ctx.ellipse(px, py, 5 * s * (1 - f * 0.5), 2 * s, dir * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** Every background layer for one theme, back to front. */
function drawBackground(ctx, key, w, h, camX, groundY, t, still) {
  const th = THEMES[key];
  drawSky(ctx, th, w, h, groundY);
  drawSun(ctx, th, w, groundY, key);
  if (key === 'canyon') drawMesas(ctx, th, w, camX, groundY);
  else if (key === 'volcano') drawVolcanoes(ctx, th, w, camX, groundY, t, still);
  else {
    ridge(ctx, w, h, camX, 0.05, groundY - 70, 140, th.mountain, 0, 18);
    // snowy caps feel: a lighter second range
    ridge(ctx, w, h, camX, 0.09, groundY - 40, 90, th.mountain2, 4000, 18);
  }
  drawClouds(ctx, th, w, camX, groundY, t, still);
  drawFarDinos(ctx, th, w, camX, groundY, t, still);
  drawHillsAndTrees(ctx, th, key, w, h, camX, groundY);
  drawFerns(ctx, th, key, w, camX, groundY);
}

// ---------------------------------------------------------------- ground & gaps
function drawGround(ctx, th, w, h, camX, groundY, hazards) {
  // Solid ground segments between gaps
  const gaps = (hazards || []).filter(g => g.kind === 'gap' && g.x + g.w > camX - 20 && g.x < camX + w + 20);
  ctx.fillStyle = th.dirt;
  ctx.fillRect(0, groundY, w, h - groundY);

  // pebbles / stripes fixed to the world so they scroll with the track
  const step = 46;
  const first = Math.floor(camX / step) - 1;
  for (let i = first; i < first + Math.ceil(w / step) + 2; i++) {
    const x = i * step - camX;
    ctx.fillStyle = th.dirtDark;
    ctx.beginPath(); ctx.ellipse(x + hash(i) * 30, groundY + 26 + hash(i + 1) * 40, 6 + hash(i + 2) * 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = th.dirtDark;
  ctx.fillRect(0, groundY + 80, w, 4);

  // grass strip
  ctx.fillStyle = th.grass;
  ctx.fillRect(0, groundY - 2, w, 12);
  ctx.fillStyle = th.grassDark;
  ctx.fillRect(0, groundY + 9, w, 3);
  for (let i = first; i < first + Math.ceil(w / step) + 2; i++) {
    const x = i * step - camX;
    ctx.fillStyle = th.grass;
    ctx.beginPath(); ctx.arc(x + 10, groundY - 1, 6, Math.PI, 0); ctx.arc(x + 30, groundY - 1, 8, Math.PI, 0); ctx.fill();
  }

  for (const g of gaps) {
    const x = g.x - camX;
    if (g.removed) { drawBridge(ctx, x, g.w, groundY); continue; }
    const grad = ctx.createLinearGradient(0, groundY - 4, 0, h);
    grad.addColorStop(0, th.pit);
    grad.addColorStop(1, '#120a06');
    ctx.fillStyle = th.skyBottom;
    ctx.fillStyle = grad;
    ctx.fillRect(x, groundY - 8, g.w, h - groundY + 8);
    // rounded lips so the edge is easy to see
    ctx.fillStyle = th.grassDark;
    ctx.beginPath(); ctx.arc(x, groundY + 3, 7, -Math.PI / 2, Math.PI / 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + g.w, groundY + 3, 7, Math.PI / 2, Math.PI * 1.5); ctx.fill();
    // warning stripes on each side (pattern, not only colour)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const ex of [x - 16, x + g.w + 6]) {
      ctx.beginPath(); ctx.moveTo(ex, groundY - 2); ctx.lineTo(ex + 10, groundY - 2); ctx.lineTo(ex + 5, groundY - 10); ctx.closePath(); ctx.fill();
    }
  }
}

function drawBridge(ctx, x, w, groundY) {
  ctx.fillStyle = '#9b6a3e'; ctx.strokeStyle = '#5e3c20'; ctx.lineWidth = 2;
  for (let px = x - 6; px < x + w + 6; px += 14) {
    roundRect(ctx, px, groundY - 4, 12, 12, 3); ctx.fill(); ctx.stroke();
  }
}

// ---------------------------------------------------------------- obstacles & items
function drawObstacle(ctx, th, h, x, groundY, t, still) {
  const fade = h.fade == null ? 1 : h.fade;
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  if (h.hit || h.removed) { ctx.translate(x + h.w / 2, groundY); ctx.rotate((1 - fade) * 0.6); ctx.translate(-(x + h.w / 2), -groundY + (1 - fade) * 10); }
  const { w } = h;
  const y = groundY;
  if (h.type === 'rockSmall' || h.type === 'rockBig') {
    const hh = h.h;
    ctx.fillStyle = th.rock; ctx.strokeStyle = th.rockDark; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 2, y - hh * 0.7, x + w * 0.3, y - hh);
    ctx.quadraticCurveTo(x + w * 0.6, y - hh * 1.08, x + w * 0.85, y - hh * 0.75);
    ctx.quadraticCurveTo(x + w + 3, y - hh * 0.4, x + w, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = th.rockLight;
    ctx.beginPath(); ctx.ellipse(x + w * 0.35, y - hh * 0.72, w * 0.14, hh * 0.1, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = th.rockDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w * 0.62, y - hh * 0.55); ctx.lineTo(x + w * 0.7, y - hh * 0.3); ctx.stroke();
  } else if (h.type === 'log') {
    const r = h.h / 2;
    ctx.fillStyle = '#a0683a'; ctx.strokeStyle = '#5b3517'; ctx.lineWidth = 3;
    roundRect(ctx, x, y - h.h, w - r, h.h, 8); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 8, y - h.h * 0.62); ctx.lineTo(x + w * 0.55, y - h.h * 0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14, y - h.h * 0.32); ctx.lineTo(x + w * 0.6, y - h.h * 0.32); ctx.stroke();
    ctx.fillStyle = '#e8c08a'; ctx.strokeStyle = '#5b3517'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x + w - r, y - r, r * 0.75, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#b07d48'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x + w - r, y - r, r * 0.4, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (h.type === 'vent') {
    // stone cone + a steady column of soft steam exactly as tall as its hitbox
    ctx.fillStyle = '#6d6470'; ctx.strokeStyle = '#3a333d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 6, y - 16); ctx.lineTo(x + w - 6, y - 16); ctx.lineTo(x + w + 4, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb26b';
    ctx.fillRect(x + 8, y - 17, w - 16, 3);
    // steam column: dashed outline marks the edge so it reads without colour
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, x + 1, y - h.h, w - 2, h.h - 16, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 4; k++) {
      const life = still ? k / 4 : ((t * 0.9 + k / 4) % 1);
      const py = y - 18 - life * (h.h - 26);
      ctx.beginPath(); ctx.arc(x + w / 2 + Math.sin(life * 7 + k) * 3, py, 8 + life * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    roundRect(ctx, x + 1, y - h.h, w - 2, h.h - 16, 10); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawItem(ctx, it, x, y, t, still) {
  const bob = still ? 0 : Math.sin(t * 3 + it.id) * 3;
  if (it.type === 'star') {
    const r = Math.max(10, it.r * 0.62);
    drawStarShape(ctx, x, y + bob, r, '#ffd23f', '#d97a00', still ? 0 : Math.sin(t * 2 + it.id) * 0.2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(x, y + bob, it.r * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,80,0.9)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y + bob, it.r * 0.9, 0, Math.PI * 2); ctx.stroke();
    drawBone(ctx, x, y + bob, it.r / 26);
  }
}

function drawFinish(ctx, x, groundY) {
  // checkered strip + arch with flags
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#222' : '#fff';
      ctx.fillRect(x - 6 + j * 6, groundY - 2 + i * 6, 6, 6);
    }
  }
  ctx.fillStyle = '#8a5a3b';
  ctx.fillRect(x - 70, groundY - 150, 8, 150);
  ctx.fillRect(x + 62, groundY - 150, 8, 150);
  ctx.fillStyle = '#ff6b6b'; ctx.strokeStyle = '#7a2b2b'; ctx.lineWidth = 3;
  roundRect(ctx, x - 80, groundY - 176, 160, 36, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('FINISH', x, groundY - 157);
  for (const [fx, c] of [[x - 66, '#4dabf7'], [x + 66, '#ffd43b']]) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(fx, groundY - 200); ctx.lineTo(fx + 26, groundY - 192); ctx.lineTo(fx, groundY - 184); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5a3b'; ctx.fillRect(fx - 2, groundY - 202, 4, 30);
  }
}

// ---------------------------------------------------------------- particles
export function drawParticles(ctx, particles, camX, groundY) {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.max);
    const x = p.screen ? p.x : p.x - camX;
    const y = p.screen ? p.y : groundY - p.y;
    ctx.globalAlpha = Math.min(1, a * 1.5);
    if (p.kind === 'dust') {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(x, y, p.size * (1.4 - a * 0.4), 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'confetti') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else {
      drawStarShape(ctx, x, y, p.size, p.color || '#ffd23f', null, p.rot);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- whole scene
/**
 * scene: { w, h, groundY, camX, time, dt, theme, themeFrom, blend, run, particles,
 *          still (reduced motion), dino: {x, y, ...drawDino opts} }
 */
export function drawScene(ctx, s) {
  const { w, h, groundY, camX, time: t, still } = s;
  drawBackground(ctx, s.theme, w, h, camX, groundY, t, still);
  if (s.themeFrom && s.blend < 1) {
    ctx.globalAlpha = 1 - s.blend;
    drawBackground(ctx, s.themeFrom, w, h, camX, groundY, t, still);
    ctx.globalAlpha = 1;
  }
  const th = THEMES[s.theme];
  const run = s.run;
  const hazards = run ? run.course.hazards : null;
  drawGround(ctx, th, w, h, camX, groundY, hazards);

  if (run) {
    const c = run.course;
    if (c.mode === 'level' && c.length - camX < w + 120 && c.length - camX > -120) drawFinish(ctx, c.length - camX, groundY);
    for (const hz of hazards) {
      if (hz.kind !== 'obstacle') continue;
      const x = hz.x - camX;
      if (x > w + 20) break;
      if (x + hz.w < -40) continue;
      if (hz.hit || hz.removed) hz.fade = Math.max(0, (hz.fade == null ? 1 : hz.fade) - (s.dt || 0) * 2.2);
      drawObstacle(ctx, th, hz, x, groundY, t, still);
    }
    for (const it of c.items) {
      if (it.taken) continue;
      const x = it.x - camX;
      if (x < -30 || x > w + 30) continue;
      drawItem(ctx, it, x, groundY - it.y, t, still);
    }
  }

  if (s.dino) {
    const d = s.dino;
    if (d.shadow !== false) drawDinoShadow(ctx, d.x, groundY, d.height || 0, 0.92);
    drawDino(ctx, d.x, d.y, d);
  }
  if (s.particles) drawParticles(ctx, s.particles, camX, groundY);
}

// ---------------------------------------------------------------- discoveries
const SIL = '#3d3550';

function quadruped(ctx, { bodyW = 46, bodyH = 22, color, neck = 0, tail = 40 }) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-bodyW + 6, -6); ctx.quadraticCurveTo(-bodyW - tail * 0.6, 0, -bodyW - tail, 14); ctx.quadraticCurveTo(-bodyW - tail * 0.4, 12, -bodyW + 6, 10); ctx.fill();
  for (const lx of [-bodyW * 0.6, -bodyW * 0.25, bodyW * 0.25, bodyW * 0.6]) { roundRect(ctx, lx - 6, bodyH * 0.4, 12, 22, 4); ctx.fill(); }
}

function eye(ctx, x, y) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 1, y, 2, 0, Math.PI * 2); ctx.fill();
}

const DISCOVERY_ART = {
  triceratops(ctx) {
    quadruped(ctx, { color: '#7fb3e6' });
    ctx.fillStyle = '#5d93c9';
    ctx.beginPath(); ctx.ellipse(46, -16, 18, 26, 0.3, 0, Math.PI * 2); ctx.fill(); // frill
    ctx.fillStyle = '#7fb3e6';
    ctx.beginPath(); ctx.ellipse(58, -2, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4d6'; ctx.strokeStyle = '#a58a5a'; ctx.lineWidth = 1.5;
    for (const [hx, hy, ex, ey] of [[56, -12, 74, -30], [64, -10, 84, -24], [74, -2, 84, -6]]) {
      ctx.beginPath(); ctx.moveTo(hx - 4, hy); ctx.lineTo(ex, ey); ctx.lineTo(hx + 4, hy + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    eye(ctx, 60, -6);
  },
  stegosaurus(ctx) {
    ctx.fillStyle = '#ff9f6b';
    for (let i = 0; i < 6; i++) {
      const px = -34 + i * 13, ph = 18 + Math.sin((i / 5) * Math.PI) * 12;
      ctx.beginPath(); ctx.moveTo(px - 7, -16); ctx.lineTo(px, -16 - ph); ctx.lineTo(px + 7, -16); ctx.closePath(); ctx.fill();
    }
    quadruped(ctx, { color: '#9bd17a' });
    ctx.fillStyle = '#9bd17a'; ctx.beginPath(); ctx.ellipse(52, 6, 14, 9, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4d6';
    for (const sx of [-80, -72]) { ctx.beginPath(); ctx.moveTo(sx, 10); ctx.lineTo(sx - 6, -4); ctx.lineTo(sx + 4, 8); ctx.fill(); }
    eye(ctx, 56, 3);
  },
  trex(ctx) {
    ctx.fillStyle = '#c89bff';
    ctx.beginPath(); ctx.ellipse(-4, -6, 30, 22, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, 4); ctx.quadraticCurveTo(-60, 16, -80, 30); ctx.quadraticCurveTo(-50, 22, -18, 18); ctx.fill();
    ctx.beginPath(); ctx.ellipse(28, -36, 22, 15, 0.1, 0, Math.PI * 2); ctx.fill();
    roundRect(ctx, -12, 8, 12, 34, 5); ctx.fill(); roundRect(ctx, 6, 8, 12, 34, 5); ctx.fill();
    roundRect(ctx, -16, 38, 22, 8, 4); ctx.fill(); roundRect(ctx, 2, 38, 22, 8, 4); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#c89bff'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(18, -10); ctx.lineTo(26, -4); ctx.stroke();
    ctx.strokeStyle = '#6d4aa8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, -28); ctx.quadraticCurveTo(40, -24, 48, -30); ctx.stroke();
    eye(ctx, 30, -42);
  },
  feathers(ctx) {
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 18, -0.2, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#ff7f50' : '#ffd166';
      ctx.beginPath(); ctx.ellipse(-30 - i * 9, 4 + i * 3, 14, 5, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff7f50';
    ctx.beginPath(); ctx.ellipse(6, 4, 16, 8, 0.5, 0, Math.PI * 2); ctx.fill(); // wing feathers
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.ellipse(32, -22, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(22, -14); ctx.lineTo(28, -24); ctx.lineTo(18, -4); ctx.fill();
    ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.moveTo(30, -32); ctx.lineTo(24, -44); ctx.lineTo(36, -33); ctx.fill();
    ctx.fillStyle = '#ffb347';
    roundRect(ctx, -6, 12, 6, 26, 3); ctx.fill(); roundRect(ctx, 8, 12, 6, 26, 3); ctx.fill();
    eye(ctx, 35, -24);
  },
  birds(ctx) {
    ctx.fillStyle = '#4dabf7';
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(26, -18, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c7ed6';
    ctx.beginPath(); ctx.ellipse(-6, -2, 20, 11, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, -2); ctx.lineTo(-48, -12); ctx.lineTo(-44, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffa94d'; ctx.beginPath(); ctx.moveTo(39, -20); ctx.lineTo(52, -15); ctx.lineTo(39, -12); ctx.fill();
    ctx.strokeStyle = '#ffa94d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, 18); ctx.lineTo(-6, 34); ctx.moveTo(8, 18); ctx.lineTo(10, 34); ctx.stroke();
    eye(ctx, 30, -21);
    // little egg-shaped branch
    ctx.strokeStyle = '#8a5a3b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-50, 36); ctx.lineTo(50, 36); ctx.stroke();
  },
  pangaea(ctx) {
    ctx.fillStyle = '#74c0fc';
    ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#69db7c';
    ctx.beginPath();
    ctx.moveTo(-30, -30); ctx.quadraticCurveTo(0, -46, 26, -30); ctx.quadraticCurveTo(40, -14, 22, -4);
    ctx.quadraticCurveTo(34, 12, 18, 30); ctx.quadraticCurveTo(0, 40, -10, 22); ctx.quadraticCurveTo(-30, 18, -24, 2);
    ctx.quadraticCurveTo(-44, -10, -30, -30); ctx.fill();
    ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(-8, -38); ctx.quadraticCurveTo(0, -10, 8, 28); ctx.stroke();
    ctx.setLineDash([]);
  },
};

/** Draw a discovery card picture; locked ones become a silhouette. */
export function drawDiscovery(ctx, id, w, h, locked) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2 + 4);
  const s = Math.min(w / 190, h / 120);
  ctx.scale(s, s);
  (DISCOVERY_ART[id] || (() => {}))(ctx);
  ctx.restore();
  if (locked) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = SIL;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- app icon
export function drawAppIcon(ctx, size, maskable = false) {
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#6ec8ff'); g.addColorStop(0.68, '#d9f4ff'); g.addColorStop(0.68, '#79cf4f'); g.addColorStop(1, '#5bb33d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff1a1';
  ctx.beginPath(); ctx.arc(size * 0.78, size * 0.22, size * 0.09, 0, Math.PI * 2); ctx.fill();
  const scale = (maskable ? 0.0064 : 0.0082) * size;
  drawDino(ctx, size * 0.47, size * 0.74, { scale, runPhase: 1.2, happy: false });
  drawStarShape(ctx, size * 0.2, size * 0.28, size * 0.07, '#ffd23f', '#d97a00', 0.2);
}

export { OBSTACLES };
