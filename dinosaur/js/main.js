// ---------------------------------------------------------------------------
// Walker's Dinosaur Adventure — app shell: game loop, input, screens, saving.
// Rules and physics live in logic.js, pictures in art.js, settings in config.js.
// ---------------------------------------------------------------------------

import { PHYSICS, DINO, LEVELS, ENDLESS, DISCOVERIES, LEVEL_FACTS, VIEW } from './config.js';
import { createRun, stepRun, pressJump, progressOf, discoveriesUnlocked, nextDiscovery } from './logic.js';
import { drawScene, drawDino, drawDiscovery } from './art.js';
import { createStorage } from './storage.js';
import { setSoundEnabled, unlockAudio, suspendAudio, play } from './audio.js';

const $ = (id) => document.getElementById(id);
const storage = createStorage();
const canvas = $('game');
const ctx = canvas.getContext('2d');
const homeCanvas = $('homeDino');
const homeCtx = homeCanvas.getContext('2d');
const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

const STEP = PHYSICS.fixedStep;
const THEME_ORDER = ['fern', 'canyon', 'volcano'];
const SKY_UNITS = 260;      // gameplay height kept visible above the track (units)

const app = {
  state: 'home',            // home | playing | paused | complete | over | discoveries | install | reset
  run: null,
  mode: 'level',
  levelIndex: 0,
  selected: Math.min(storage.data.unlockedLevel, LEVELS.length - 1),   // level index or 'endless'
  difficulty: storage.data.difficulty,
  particles: [],
  view: { w: 800, h: 400, scale: 1, groundY: 300, dpr: 1 },
  sceneTime: 0,
  accumulator: 0,
  lastFrame: null,
  loopStarts: 0,
  steps: 0,
  newDiscoveries: [],
  tutorialActive: false,
  waitingWorker: null,
  updateRequested: false,
  lastJumpInput: -1e9,
  hudCache: {},
  attractCam: 0,
};

setSoundEnabled(storage.data.sound);

// ---------------------------------------------------------------- sizing
// The canvas matches the screen in CSS pixels × devicePixelRatio (capped),
// and the world is scaled so a fixed amount of track is always visible.
function safeBottomPx() {
  const probe = $('safeProbe');
  return probe ? probe.offsetHeight : 0;
}

function resize() {
  const cssW = Math.max(1, window.innerWidth);
  const cssH = Math.max(1, window.innerHeight);
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const maxPixels = 3.2e6;   // keep big desktop screens from making huge canvases
  if (cssW * cssH * dpr * dpr > maxPixels) dpr = Math.sqrt(maxPixels / (cssW * cssH));
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const short = cssH <= 500;
  const jumpPx = short ? 92 : 104;
  const hudPx = cssW <= 560 ? 124 : 72;           // HUD wraps to two rows on narrow screens
  const reservedPx = jumpPx + 30 + safeBottomPx();       // room under the track for the Jump button
  const scale = Math.max(0.3, Math.min(cssW / VIEW.minViewWidth, (cssH - reservedPx - hudPx) / SKY_UNITS));
  const bandPx = SKY_UNITS * scale + hudPx;
  const freePx = Math.max(0, cssH - reservedPx - bandPx);
  const groundPx = cssH - reservedPx - freePx * 0.45;    // tall portrait screens: keep the track near the middle

  Object.assign(app.view, { w: cssW / scale, h: cssH / scale, scale, groundY: groundPx / scale, dpr });
}
let resizePending = false;
function scheduleResize() {
  if (resizePending) return;
  resizePending = true;
  requestAnimationFrame(() => { resizePending = false; resize(); });
}

// ---------------------------------------------------------------- screens
const screens = {
  home: $('screenHome'), paused: $('screenPause'), complete: $('screenComplete'), over: $('screenOver'),
  discoveries: $('screenDiscoveries'), install: $('screenInstall'), reset: $('screenReset'),
};
const hud = $('hud');

function setState(state) {
  app.state = state;
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== state;
  hud.hidden = !(state === 'playing' || state === 'paused');
  const screen = screens[state];
  if (screen) {
    const target = screen.querySelector('.btn-primary') || screen.querySelector('button');
    if (target) target.focus({ preventScroll: true });
  } else if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
  if (state === 'home') refreshHome();
  refreshUpdateBanner();
}

// ---------------------------------------------------------------- home screen
function refreshHome() {
  const d = storage.data;
  const chips = $('levelChips');
  chips.textContent = '';
  const options = LEVELS.map((lv, i) => ({ key: i, name: lv.name, locked: i > d.unlockedLevel }));
  options.push({ key: 'endless', name: ENDLESS.name, locked: !d.endless });
  if (options.find(o => o.key === app.selected)?.locked) app.selected = 0;
  for (const o of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(o.key === app.selected));
    b.disabled = o.locked;
    b.textContent = o.locked ? `🔒 ${o.name}` : o.name;
    if (o.locked) b.setAttribute('aria-label', `${o.name}, locked`);
    b.addEventListener('click', () => { app.selected = o.key; play('click'); refreshHome(); b.focus(); });
    chips.appendChild(b);
  }
  for (const b of document.querySelectorAll('#diffChips .chip')) {
    b.setAttribute('aria-checked', String(b.dataset.diff === app.difficulty));
  }
  $('bestHome').textContent = d.best;
  refreshSoundButtons();
}

function refreshSoundButtons() {
  const on = storage.data.sound;
  for (const id of ['btnSoundHome', 'btnSoundPause']) {
    const b = $(id);
    b.textContent = on ? 'Sound: On' : 'Sound: Off';
    b.setAttribute('aria-pressed', String(on));
  }
}

function toggleSound() {
  const on = !storage.data.sound;
  storage.update({ sound: on });
  setSoundEnabled(on);     // creates/resumes audio inside this tap (required on iPhone)
  play('click');
  refreshSoundButtons();
}

// ---------------------------------------------------------------- discoveries screen
function openDiscoveries() {
  const lifetime = storage.data.lifetimeFossils;
  $('lifetimeFossils').textContent = lifetime;
  const list = $('discList');
  list.textContent = '';
  let prevAt = 0;
  for (const disc of DISCOVERIES) {
    const locked = lifetime < disc.at;
    const li = document.createElement('li');
    li.className = 'disc' + (locked ? ' locked' : '');
    const cv = document.createElement('canvas');
    cv.width = 300; cv.height = 190;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', locked ? 'Locked discovery silhouette' : `Picture: ${disc.name}`);
    drawDiscovery(cv.getContext('2d'), disc.id, 300, 190, locked);
    li.appendChild(cv);
    const h = document.createElement('h3');
    h.textContent = locked ? 'Mystery discovery' : disc.name;
    li.appendChild(h);
    const p = document.createElement('p');
    if (locked) {
      const need = disc.at - lifetime;
      p.textContent = `Find ${need} more fossil${need === 1 ? '' : 's'} (${lifetime} of ${disc.at})`;
      const bar = document.createElement('div');
      bar.className = 'lock-progress';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', `${lifetime} of ${disc.at} fossils`);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(disc.at));
      bar.setAttribute('aria-valuenow', String(lifetime));
      const fill = document.createElement('div');
      fill.style.width = `${Math.min(100, (Math.max(0, lifetime - prevAt) / (disc.at - prevAt)) * 100)}%`;
      bar.appendChild(fill);
      li.appendChild(p);
      li.appendChild(bar);
    } else {
      p.textContent = disc.fact;
      li.appendChild(p);
    }
    prevAt = disc.at;
    list.appendChild(li);
  }
  setState('discoveries');
}

// ---------------------------------------------------------------- starting & ending runs
function startRun(mode, levelIndex, startScore = 0) {
  app.mode = mode;
  app.levelIndex = levelIndex;
  app.run = createRun({
    mode, levelIndex, difficulty: app.difficulty,
    seed: (Math.random() * 2 ** 31) >>> 0, startScore,
  });
  app.particles.length = 0;
  app.accumulator = 0;
  app.lastFrame = null;
  app.newDiscoveries = [];
  app.tutorialActive = mode === 'level' && !!LEVELS[levelIndex].tutorial;
  $('tutorial').hidden = !app.tutorialActive;
  app.hudCache = {};
  const name = mode === 'endless' ? ENDLESS.name : LEVELS[levelIndex].name;
  $('levelName').textContent = name;
  $('progress').hidden = mode === 'endless';
  $('distance').hidden = mode !== 'endless';
  $('distance').textContent = '0 m';
  setState('playing');
  showBanner(name, 1600);
}

function startSelected() {
  unlockAudio();
  if (app.selected === 'endless') startRun('endless', 0);
  else startRun('level', app.selected);
}

function pause() {
  if (app.state !== 'playing') return;
  setState('paused');
  suspendAudio();
}

function resume() {
  if (app.state !== 'paused') return;
  unlockAudio();
  app.lastFrame = null;      // no catch-up: the next frame starts fresh
  app.accumulator = 0;
  setState('playing');
}

function restartLevel() {
  recordBest();
  const r = app.run;
  startRun(app.mode, app.levelIndex, r ? r.levelStartScore : 0);
}

function recordBest() {
  if (app.run && app.run.score > storage.data.best) storage.update({ best: app.run.score });
}

function goHome() {
  recordBest();
  app.run = null;
  app.selected = app.mode === 'endless' ? 'endless' : app.levelIndex;
  setState('home');
}

function finishLevel() {
  const r = app.run;
  const d = storage.data;
  const patch = { best: Math.max(d.best, r.score) };
  const last = app.levelIndex === LEVELS.length - 1;
  patch.unlockedLevel = Math.max(d.unlockedLevel, Math.min(LEVELS.length - 1, app.levelIndex + 1));
  const endlessNew = last && !d.endless;
  if (last) patch.endless = true;
  storage.update(patch);

  $('cStars').textContent = r.stars;
  $('cFossils').textContent = r.fossils;
  $('cScore').textContent = r.score;
  $('cFact').textContent = LEVEL_FACTS[(app.levelIndex * 2 + Math.floor(Math.random() * 2)) % LEVEL_FACTS.length];
  $('explorerMsg').hidden = !last;
  const notes = [];
  if (app.newDiscoveries.length) notes.push(`New Dino Discovery: ${app.newDiscoveries.join(', ')}!`);
  if (endlessNew) notes.push('Endless Adventure unlocked!');
  $('cNew').hidden = !notes.length;
  $('cNew').textContent = notes.join(' ');
  $('btnNext').textContent = last ? 'Play Endless Adventure' : 'Next Level';
  play('complete');
  setState('complete');
}

function nextLevel() {
  const score = app.run ? app.run.score : 0;
  if (app.levelIndex >= LEVELS.length - 1) startRun('endless', 0);
  else startRun('level', app.levelIndex + 1, score);
}

function gameOver() {
  const r = app.run;
  const prevBest = storage.data.best;
  storage.update({ best: Math.max(prevBest, r.score) });
  $('oScore').textContent = r.score;
  $('oBest').textContent = storage.data.best;
  $('oNewBest').hidden = !(r.score > prevBest && r.score > 0);
  $('oNew').hidden = !app.newDiscoveries.length;
  $('oNew').textContent = app.newDiscoveries.length ? `New Dino Discovery: ${app.newDiscoveries.join(', ')}!` : '';
  setState('over');
}

function tryAgain() {
  const r = app.run;
  startRun(app.mode, app.levelIndex, r ? r.levelStartScore : 0);
}

// ---------------------------------------------------------------- game events → effects
function handleEvents() {
  const r = app.run;
  const still = motionQuery.matches;
  for (const e of r.events) {
    switch (e.type) {
      case 'jump':
        play('jump');
        if (app.tutorialActive) { app.tutorialActive = false; $('tutorial').hidden = true; }
        puff(e.x, 0, still ? 1 : 3);
        break;
      case 'doubleJump':
        play('doubleJump');
        burst(e.x - 10, e.y + 10, still ? 2 : 5, '#ffffff', 5);
        break;
      case 'land':
        if (e.impact > 300) puff(e.x, 0, still ? 1 : 4);
        break;
      case 'star':
        play('star');
        burst(e.x, e.y, still ? 3 : 8, '#ffd23f', 6);
        break;
      case 'fossil': {
        play('fossil');
        burst(e.x, e.y, still ? 4 : 14, '#ffe8a3', 7);
        const lifetime = storage.data.lifetimeFossils + 1;
        const before = storage.data.discoveries;
        const now = discoveriesUnlocked(lifetime);
        storage.update({ lifetimeFossils: lifetime, discoveries: Math.max(before, now) });
        if (now > before) {
          const names = DISCOVERIES.slice(before, now).map(d => d.name);
          app.newDiscoveries.push(...names);
          showBanner('New Dino Discovery!', 1800);
        } else {
          showBanner('Fossil found!', 1100);
        }
        break;
      }
      case 'hit':
        play('hit');
        popHeart(e.hearts);
        break;
      case 'fall':
        play('fall');
        popHeart(e.hearts);
        if (e.hearts > 0) showBanner('Oops! Back on the trail!', 1300);
        break;
      case 'finish':
        confetti(still ? 16 : 70);
        showBanner(app.levelIndex === LEVELS.length - 1 ? 'You’re a Dino Explorer, Walker!' : 'Finish!', 2000);
        play('complete');
        break;
      case 'complete':
        finishLevel();
        break;
      case 'over':
        gameOver();
        break;
      default:
        break;
    }
  }
  r.events.length = 0;
}

// Particles use world coordinates (y up) unless `screen` is set.
function burst(x, y, n, color, size) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const sp = 120 + Math.random() * 120;
    app.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 60, life: 0.6, max: 0.6, kind: 'star', color, size: size * (0.6 + Math.random() * 0.6), rot: Math.random() * 3, g: 300 });
  }
}
function puff(x, y, n) {
  for (let i = 0; i < n; i++) {
    app.particles.push({ x: x - 10 + Math.random() * 20, y: y + 2, vx: -60 - Math.random() * 80, vy: 30 + Math.random() * 40, life: 0.45, max: 0.45, kind: 'dust', size: 4 + Math.random() * 4, g: 0 });
  }
}
function confetti(n) {
  const colors = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#cc5de8', '#ff922b'];
  const v = app.view;
  for (let i = 0; i < n; i++) {
    app.particles.push({
      screen: true, x: Math.random() * v.w, y: -20 - Math.random() * v.h * 0.4,
      vx: (Math.random() - 0.5) * 40, vy: -(60 + Math.random() * 60), life: 3.2, max: 3.2,
      kind: Math.random() < 0.5 ? 'confetti' : 'star', color: colors[i % colors.length], size: 7 + Math.random() * 5,
      rot: Math.random() * 6, spin: motionQuery.matches ? 0 : (Math.random() - 0.5) * 4, g: 0,
    });
  }
}
function updateParticles(dt) {
  const ps = app.particles;
  for (const p of ps) {
    p.life -= dt;
    p.x += p.vx * dt;
    if (p.screen) p.y -= p.vy * dt;       // screen space: y down, falls gently
    else { p.y += p.vy * dt; p.vy -= (p.g || 0) * dt; }
    if (p.spin) p.rot += p.spin * dt;
  }
  if (ps.length && ps.some(p => p.life <= 0)) app.particles = ps.filter(p => p.life > 0);
  if (app.particles.length > 300) app.particles.splice(0, app.particles.length - 300);
}

// ---------------------------------------------------------------- HUD
const HEART_PATH = 'M12 21s-7.5-4.6-9.5-9.2C1 8.4 3.2 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.8 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z';
function buildHearts() {
  const el = $('hearts');
  el.textContent = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'heart');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', HEART_PATH);
    s.appendChild(p);
    el.appendChild(s);
  }
}
function setHearts(n) {
  const hearts = $('hearts').children;
  for (let i = 0; i < hearts.length; i++) {
    const full = i < n;
    const p = hearts[i].firstChild;
    // full = solid red; lost = empty outline (shape changes, not just colour)
    p.setAttribute('fill', full ? '#ff4d6d' : 'none');
    p.setAttribute('stroke', full ? '#a61e4d' : '#868e96');
    p.setAttribute('stroke-width', full ? '1.5' : '2');
    p.setAttribute('stroke-dasharray', full ? '' : '3 2');
    hearts[i].classList.toggle('lost', !full);
  }
  $('hearts').setAttribute('aria-label', `${n} of 3 hearts left`);
}
function popHeart(n) {
  const el = $('hearts').children[n];
  if (!el || motionQuery.matches) return;
  el.classList.remove('pop');
  void el.getBoundingClientRect();
  el.classList.add('pop');
}

function updateHud() {
  const r = app.run;
  if (!r) return;
  const c = app.hudCache;
  if (c.score !== r.score) { c.score = r.score; $('score').textContent = r.score; }
  if (c.hearts !== r.hearts) { c.hearts = r.hearts; setHearts(r.hearts); }
  if (r.course.mode === 'endless') {
    const m = Math.floor(r.dino.x / 40);
    if (c.m !== m) { c.m = m; $('distance').textContent = `${m} m`; }
  } else {
    const pct = Math.round(progressOf(r) * 100);
    if (c.pct !== pct) {
      c.pct = pct;
      $('progressFill').style.width = `${pct}%`;
      $('progressDino').style.left = `${pct}%`;
      $('progress').setAttribute('aria-valuenow', String(pct));
    }
  }
}

let bannerTimer = 0;
function showBanner(text, ms) {
  const b = $('banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
}

// ---------------------------------------------------------------- rendering
function themeFor(run) {
  if (!run) {
    const key = app.selected === 'endless' ? 'fern' : LEVELS[app.selected]?.theme || 'fern';
    return { theme: key };
  }
  if (run.course.mode !== 'endless') return { theme: run.course.level.theme };
  const L = ENDLESS.themeLength;
  const x = Math.max(0, run.dino.x);
  const i = Math.floor(x / L);
  const blend = Math.min(1, (x - i * L) / 700);
  return { theme: THEME_ORDER[i % 3], themeFrom: i > 0 ? THEME_ORDER[(i - 1) % 3] : null, blend };
}

function render(dt) {
  const v = app.view;
  ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, 0, 0);
  const still = motionQuery.matches;
  const t = app.sceneTime;
  const r = app.run;
  const blink = (t % 3.7) < 0.12;
  let scene;

  if (r && ['playing', 'paused', 'complete', 'over'].includes(app.state)) {
    const d = r.dino;
    const camX = d.x - DINO.screenX - r.cameraLag;
    const celebrating = r.status === 'finishing' || r.status === 'complete';
    const hop = celebrating && !still ? Math.abs(Math.sin(r.endTimer * 6)) * 18 : 0;
    scene = {
      ...themeFor(r), w: v.w, h: v.h, groundY: v.groundY, camX, time: t, dt, still, run: r,
      particles: app.particles,
      dino: {
        x: d.x - camX, y: v.groundY - d.y - hop, height: d.y + hop, shadow: d.y > -5,
        scale: 0.92, runPhase: d.runPhase, air: !d.grounded || hop > 2, vy: d.vy,
        squash: d.landSquash / 0.18, hurt: d.hurt > 0 && r.status === 'running', glow: d.invuln > 0 && r.status === 'running',
        happy: celebrating, blink, time: t,
      },
    };
  } else {
    // Menus: scenery scrolls gently behind the panel
    app.attractCam += dt * (still ? 0 : 90);
    scene = {
      ...themeFor(null), w: v.w, h: v.h, groundY: v.groundY, camX: app.attractCam, time: t, dt, still,
      particles: null, dino: null,
    };
  }
  drawScene(ctx, scene);
  if (app.state === 'home') renderHomeDino(t, still);
}

function renderHomeDino(t, still) {
  const w = homeCanvas.width, h = homeCanvas.height;
  homeCtx.setTransform(1, 0, 0, 1, 0, 0);
  homeCtx.clearRect(0, 0, w, h);
  const hop = still ? 0 : Math.max(0, Math.sin(t * 2.2)) ** 3 * 60;
  homeCtx.fillStyle = 'rgba(0,0,0,0.15)';
  homeCtx.beginPath(); homeCtx.ellipse(w / 2, h - 24, 90 - hop * 0.6, 14, 0, 0, Math.PI * 2); homeCtx.fill();
  drawDino(homeCtx, w / 2 - 6, h - 26 - hop, {
    scale: 3.3, runPhase: still ? 0 : t * 9, air: hop > 6, time: t, blink: (t % 3.3) < 0.13, happy: hop > 45,
  });
}

// ---------------------------------------------------------------- the game loop
// requestAnimationFrame drives drawing; physics advances in fixed STEP-sized
// slices from an accumulator so the game plays the same at 30, 60 or 120 Hz.
// Long gaps (tab switch, slow frame) are capped at PHYSICS.maxFrameTime.
function frame(now) {
  requestAnimationFrame(frame);
  if (app.lastFrame === null) app.lastFrame = now;
  let dt = (now - app.lastFrame) / 1000;
  app.lastFrame = now;
  if (!(dt > 0)) dt = 0;
  if (dt > PHYSICS.maxFrameTime) dt = PHYSICS.maxFrameTime;

  if (app.state === 'playing' && app.run) {
    app.accumulator += dt;
    while (app.accumulator >= STEP && app.state === 'playing') {
      stepRun(app.run, STEP);
      app.steps++;
      app.accumulator -= STEP;
      if (app.run.events.length) handleEvents();
    }
    app.sceneTime += dt;
    updateParticles(dt);
    updateHud();
  } else if (app.state !== 'paused') {
    app.sceneTime += dt;
    updateParticles(dt);
  }
  render(app.state === 'paused' ? 0 : dt);
}

function startLoop() {
  app.loopStarts++;        // checked by tests: must stay at 1
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- input
// One physical tap = one jump: we only listen to pointerdown (which covers
// touch, mouse and pen) — never touchstart/click as well — and ignore any
// second jump request arriving within a few milliseconds of the first.
function requestJump() {
  if (app.state !== 'playing' || !app.run) return;
  const now = performance.now();
  if (now - app.lastJumpInput < 60) return;
  app.lastJumpInput = now;
  pressJump(app.run);
}

function bindInput() {
  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (app.state !== 'playing') return;
    e.preventDefault();
    requestJump();
  });

  const jumpBtn = $('btnJump');
  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    unlockAudio();
    jumpBtn.classList.add('pressed');
    requestJump();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) jumpBtn.addEventListener(ev, () => jumpBtn.classList.remove('pressed'));
  // Keyboard activation (Enter on a focused button) arrives as a click with detail 0.
  jumpBtn.addEventListener('click', (e) => { if (e.detail === 0) requestJump(); });

  // Stop HUD taps from reaching the canvas (pause button etc.)
  hud.addEventListener('pointerdown', (e) => { if (e.target !== canvas) e.stopPropagation(); });

  window.addEventListener('keydown', (e) => {
    const isJump = e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp';
    const isPause = e.code === 'Escape' || e.key === 'p' || e.key === 'P';
    if (app.state === 'playing') {
      if (isJump) { e.preventDefault(); if (!e.repeat) requestJump(); return; }
      if (isPause) { e.preventDefault(); pause(); }
      return;
    }
    if (app.state === 'paused' && isPause && !e.repeat) { e.preventDefault(); resume(); return; }
    if ((app.state === 'discoveries' || app.state === 'install' || app.state === 'reset') && e.code === 'Escape') {
      e.preventDefault(); setState('home');
    }
  });
  window.addEventListener('keyup', (e) => {
    if (app.state === 'playing' && (e.code === 'Space' || e.key === ' ')) e.preventDefault();
  });

  // Block pinch-zoom / double-tap zoom gestures during play on iOS
  document.addEventListener('gesturestart', (e) => { if (app.state === 'playing') e.preventDefault(); });
  document.addEventListener('touchmove', (e) => { if (app.state === 'playing' && e.cancelable) e.preventDefault(); }, { passive: false });

  // Pause automatically when the tab is hidden or the phone locks
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); suspendAudio(); }
    else app.lastFrame = null;
  });
  window.addEventListener('pagehide', () => pause());
  window.addEventListener('blur', () => pause());

  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleResize);
}

function bindButtons() {
  const on = (id, fn) => $(id).addEventListener('click', () => { unlockAudio(); fn(); });
  on('btnPlay', startSelected);
  on('btnPause', pause);
  on('btnResume', resume);
  on('btnRestart', restartLevel);
  on('btnHomeFromPause', goHome);
  on('btnNext', nextLevel);
  on('btnHomeFromComplete', goHome);
  on('btnTryAgain', tryAgain);
  on('btnHomeFromOver', goHome);
  on('btnSoundHome', toggleSound);
  on('btnSoundPause', toggleSound);
  on('btnDiscoveries', openDiscoveries);
  on('btnBackFromDisc', () => setState('home'));
  on('btnInstall', () => setState('install'));
  on('btnBackFromInstall', () => setState('home'));
  on('btnReset', () => setState('reset'));
  on('btnResetNo', () => setState('home'));
  on('btnResetYes', () => {
    storage.reset();
    app.selected = 0;
    setState('home');
  });
  on('btnUpdate', applyUpdate);
  for (const b of document.querySelectorAll('#diffChips .chip')) {
    b.addEventListener('click', () => {
      app.difficulty = b.dataset.diff;
      storage.update({ difficulty: app.difficulty });
      play('click');
      refreshHome();
    });
  }
}

// ---------------------------------------------------------------- offline + updates
// A new service worker waits until the player taps "Update now", and that
// button only appears on menu screens — never in the middle of a run.
function refreshUpdateBanner() {
  const between = app.state === 'home' || app.state === 'complete' || app.state === 'over';
  $('updateBanner').hidden = !(app.waitingWorker && between);
}
function applyUpdate() {
  if (!app.waitingWorker) return;
  app.updateRequested = true;
  app.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (app.updateRequested) window.location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    const markWaiting = (w) => { app.waitingWorker = w; refreshUpdateBanner(); };
    if (reg.waiting && navigator.serviceWorker.controller) markWaiting(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) markWaiting(w);
      });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => { /* offline support is optional */ });
}

// ---------------------------------------------------------------- boot
function boot() {
  const probe = document.createElement('div');
  probe.id = 'safeProbe';
  probe.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const hc = homeCanvas;
  hc.width = 240 * 2; hc.height = 150 * 2;
  buildHearts();
  setHearts(3);
  resize();
  bindInput();
  bindButtons();
  setState('home');
  startLoop();
  registerServiceWorker();
}

boot();

// Exposed for automated browser tests and curious grown-ups (read-only use).
window.__WDA = { app, storage, setState, startRun, pause, resume, restartLevel, goHome, refreshUpdateBanner };
