// ---------------------------------------------------------------------------
// Game rules, physics and level generation.
//
// This file has no drawing or browser code, so the same rules run in the
// game and in the automated tests (`npm test`).
//
// Coordinates: x grows to the right along the track, y grows UP from the
// track surface (y = 0 is the ground). The dinosaur's x is its centre and its
// y is the height of its feet.
// ---------------------------------------------------------------------------

import {
  PHYSICS, DINO, SCORING, DIFFICULTIES, OBSTACLES, OBSTACLE_INSET,
  LEVELS, ENDLESS, DISCOVERIES,
} from './config.js';

// ---- Jump maths ------------------------------------------------------------
// With constant gravity g, a jump with launch speed v reaches height v²/2g and
// stays in the air for 2v/g. We pick the launch speed from the desired height
// so the jump is always exactly the same, whatever the frame rate.

export const JUMP_VELOCITY = Math.sqrt(2 * PHYSICS.gravity * PHYSICS.jumpHeight);
export const DOUBLE_JUMP_VELOCITY = Math.sqrt(2 * PHYSICS.gravity * PHYSICS.doubleJumpHeight);

/** Seconds a normal (single) jump spends in the air. */
export function airTime() {
  return (2 * JUMP_VELOCITY) / PHYSICS.gravity;
}

/** Height of the feet `t` seconds after a single jump. */
export function jumpHeightAt(t) {
  return Math.max(0, JUMP_VELOCITY * t - 0.5 * PHYSICS.gravity * t * t);
}

/** Seconds a single jump spends above height `h` (0 if it never gets there). */
export function timeAbove(h) {
  const disc = JUMP_VELOCITY * JUMP_VELOCITY - 2 * PHYSICS.gravity * h;
  return disc <= 0 ? 0 : (2 * Math.sqrt(disc)) / PHYSICS.gravity;
}

// ---- Fairness checks -------------------------------------------------------
// Used by the generator (and the tests) so that every hazard can be cleared
// with ONE ordinary jump. The double jump is a bonus, never a requirement.

const CLEAR_MARGIN = 12; // spare units we insist on when clearing an obstacle

/** Can a single jump at `speed` carry the hitbox fully over this obstacle? */
export function obstacleClearable(w, h, speed) {
  // Feet must be above the obstacle's collision top while the boxes overlap.
  const mustClearHeight = h - OBSTACLE_INSET.top - DINO.hitbox.bottom;
  const overlapSpan = 2 * DINO.hitbox.halfW + (w - 2 * OBSTACLE_INSET.side);
  return speed * timeAbove(mustClearHeight) >= overlapSpan + CLEAR_MARGIN;
}

export const GAP_EDGE_GRACE = 8; // the dinosaur only falls once its centre is this far into a gap

/** Spare take-off distance (units) when jumping a gap of width `w`. */
export function gapSlack(w, speed) {
  return speed * airTime() - (w - 2 * GAP_EDGE_GRACE);
}
export function gapClearable(w, speed) {
  return gapSlack(w, speed) >= Math.max(40, speed * 0.2);
}

/**
 * Minimum distance from the START of one hazard to the START of the next.
 * Worst case: the player jumps as late as possible (at the hazard), lands
 * one air-time later, then needs `reactionTime` plus a clear landing pad.
 */
export function minSpacing(width, speed, diff) {
  return width + speed * (airTime() + diff.reactionTime) + diff.landingPad;
}

// ---- Random numbers (seeded so a level can be rebuilt exactly) -------------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(weights, rng) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ---- Course (level layout) -------------------------------------------------

/** Running speed at track position x. Speed rises gently and is capped. */
export function speedAt(course, x) {
  if (course.mode === 'endless') {
    const maxBoost = ENDLESS.maxSpeedMult / ENDLESS.speedMult - 1;
    return course.baseSpeed * (1 + maxBoost * Math.min(1, Math.max(0, x) / ENDLESS.rampDistance));
  }
  const p = Math.min(1, Math.max(0, x / course.length));
  return course.baseSpeed * (1 + course.diff.rampPerLevel * p);
}

/**
 * Build a course. Levels are generated completely up front; Endless
 * Adventure is generated a little at a time with exactly the same rules.
 */
export function createCourse({ mode = 'level', levelIndex = 0, difficulty = 'explorer', seed = 1 }) {
  const level = mode === 'endless' ? ENDLESS : LEVELS[levelIndex];
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.explorer;
  const baseSpeed = diff.speed * level.speedMult;
  const course = {
    mode, levelIndex, level, diff, difficulty,
    baseSpeed,
    length: Infinity,
    hazards: [],     // obstacles and gaps, sorted by x
    items: [],       // stars and fossils
    rng: makeRng(seed),
    nextId: 1,
    cursor: baseSpeed * level.openingSeconds,   // first place a hazard may start
    generatedTo: 0,
    fossilTargets: [],
    endHazardsAt: Infinity,
  };

  if (mode !== 'endless') {
    // Length is chosen so the level takes about `duration` seconds.
    course.length = Math.round(baseSpeed * (1 + diff.rampPerLevel / 2) * level.duration);
    course.endHazardsAt = course.length - baseSpeed * 3; // calm run-in to the finish line
    for (let i = 0; i < level.fossils; i++) {
      const span = course.endHazardsAt - course.cursor;
      course.fossilTargets.push(course.cursor + span * ((i + 0.5) / level.fossils));
    }
    addOpeningStars(course);
    extendCourse(course, course.endHazardsAt);
    addRow(course, Math.min(course.cursor, course.length - 260), 6, 40, 30); // stars leading to the finish
  } else {
    addOpeningStars(course);
    course.nextFossilAt = course.cursor + ENDLESS.fossilEvery * 0.6;
    extendCourse(course, course.cursor + 3000);
  }
  return course;
}

function addItem(course, type, x, y) {
  const base = type === 'star' ? 22 : 26;
  course.items.push({ id: course.nextId++, type, x, y, r: base * course.diff.itemScale, taken: false });
}

function addRow(course, x, count, step, y) {
  for (let i = 0; i < count; i++) addItem(course, 'star', x + i * step, y);
}

/** Stars along the exact path of a well-timed jump centred on `centerX`. */
function addJumpTrail(course, centerX, speed, lift = 28) {
  const t = airTime();
  const takeoff = centerX - (speed * t) / 2;
  for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    addItem(course, 'star', takeoff + speed * t * f, jumpHeightAt(t * f) + lift);
  }
}

function addOpeningStars(course) {
  const start = 160;
  const end = course.cursor - 160;
  if (course.level.tutorial) {
    // A friendly row, then a floating arc that teaches "jump to grab stars".
    addRow(course, start, 4, 45, 30);
    addJumpTrail(course, start + (end - start) * 0.7, speedAt(course, end));
  } else {
    addRow(course, start, Math.max(2, Math.floor((end - start) / 90)), 45, 30);
  }
}

/** Generate hazards and items until the cursor reaches `untilX`. */
export function extendCourse(course, untilX) {
  while (course.cursor < untilX) addSegment(course);
  course.generatedTo = Math.max(course.generatedTo, untilX);
}

// ---- Obstacle spawning -----------------------------------------------------
// Hazards are NOT placed at random intervals. Each new hazard starts at
// `course.cursor`, and after placing it the cursor moves forward by at least
// `minSpacing()` (computed from the real jump air-time and the running speed
// at that point), plus a random extra amount that shrinks a little as the
// level goes on.
function addSegment(course) {
  const { level, diff, rng } = course;
  const x = course.cursor;
  const speed = speedAt(course, x);
  const progress = course.mode === 'endless' ? Math.min(1, x / ENDLESS.rampDistance) : x / course.length;
  const extra = () => 1 + rng() * diff.spacingVariance * (1 - 0.35 * progress);

  // Fossil break: a calm stretch with a floating fossil to jump for.
  const fossilDue = course.mode === 'endless'
    ? x >= course.nextFossilAt
    : course.fossilTargets.length && x >= course.fossilTargets[0];
  if (fossilDue) {
    if (course.mode === 'endless') course.nextFossilAt = x + ENDLESS.fossilEvery * (0.8 + rng() * 0.4);
    else course.fossilTargets.shift();
    const fx = x + speed * 0.6;
    addRow(course, fx - 150, 3, 40, 30);
    addItem(course, 'fossil', fx, level.tutorial ? 85 : 100 + rng() * 15);
    course.cursor = fx + speed * (1.2 + diff.reactionTime);
    return;
  }

  const r = rng();
  if (r < level.restChance) {
    // Rest: no hazard. Ground stars, or (harder modes) a high bonus arc that
    // needs a double jump — always optional.
    const restLen = speed * (1.0 + rng() * 0.6);
    if (course.difficulty !== 'explorer' && rng() < 0.4) {
      for (let i = 0; i < 4; i++) addItem(course, 'star', x + 60 + i * 45, 180 + Math.sin(i / 3 * Math.PI) * 20);
    } else {
      addRow(course, x + 40, 3 + Math.floor(rng() * 3), 40, 30);
    }
    course.cursor = x + restLen;
    return;
  }

  if (r < level.restChance + level.gapChance) {
    // Gap: width is a fraction of one jump's distance, so it's always crossable.
    let w = Math.round(speed * airTime() * diff.gapFraction * (0.8 + 0.2 * rng()));
    w = Math.max(50, Math.min(w, 140));
    while (!gapClearable(w, speed) && w > 40) w -= 5;
    course.hazards.push({ id: course.nextId++, kind: 'gap', x, w, passed: false, removed: false });
    if (rng() < level.starTrailChance) addJumpTrail(course, x + w / 2, speed);
    course.cursor = x + minSpacing(w, speed, diff) * extra();
    return;
  }

  let type = pickWeighted(level.obstacleWeights, rng);
  let { w, h } = OBSTACLES[type];
  if (!obstacleClearable(w, h, speed)) { type = 'rockSmall'; ({ w, h } = OBSTACLES.rockSmall); }
  course.hazards.push({ id: course.nextId++, kind: 'obstacle', type, x, w, h, hit: false, passed: false, removed: false, touched: false });
  if (rng() < level.starTrailChance) addJumpTrail(course, x + w / 2, speed);
  course.cursor = x + minSpacing(w, speed, diff) * extra();
}

/** The gap whose "fall zone" contains x, if any. */
export function gapAt(course, x) {
  for (const h of course.hazards) {
    if (h.kind !== 'gap' || h.removed) continue;
    if (x > h.x + GAP_EDGE_GRACE && x < h.x + h.w - GAP_EDGE_GRACE) return h;
    if (h.x > x) break;
  }
  return null;
}

/** For tests: list any hazard that breaks the fairness rules. */
export function validateCourse(course) {
  const problems = [];
  let prev = null;
  for (const h of course.hazards) {
    const speed = speedAt(course, h.x);
    if (h.kind === 'obstacle' && !obstacleClearable(h.w, h.h, speed)) problems.push(`obstacle ${h.id} not clearable`);
    if (h.kind === 'gap' && !gapClearable(h.w, speed)) problems.push(`gap ${h.id} not clearable`);
    if (h.x < course.level.openingSeconds * course.baseSpeed - 1) problems.push(`hazard ${h.id} in safe opening`);
    if (prev) {
      const need = minSpacing(prev.w, speedAt(course, prev.x), course.diff);
      if (h.x - prev.x < need - 0.5) problems.push(`hazard ${h.id} too close (${Math.round(h.x - prev.x)} < ${Math.round(need)})`);
    }
    if (course.mode === 'level' && course.levelIndex === 0 && h.kind === 'gap') problems.push('gap in level 1');
    prev = h;
  }
  return problems;
}

// ---- A single play-through (a "run") ----------------------------------------

export function createRun(opts) {
  const course = createCourse(opts);
  return {
    course,
    status: 'running',     // running → finishing → complete, or running → ending → over
    time: 0,
    score: opts.startScore || 0,
    levelStartScore: opts.startScore || 0,
    stars: 0,
    fossils: 0,
    hearts: 3,
    maxHearts: 3,
    jumpsMade: 0,
    endTimer: 0,
    speed: speedAt(course, 0),
    cameraLag: 0,          // smooths the camera after a respawn
    events: [],            // things that happened this step (sounds, particles)
    dino: {
      x: 0, y: 0, vy: 0,
      grounded: true,
      jumpsUsed: 0,        // 0 on ground, 1 after first jump, 2 after double jump
      coyote: 0,           // ledge grace timer
      buffer: 0,           // early-tap buffer timer
      queued: false,       // a tap waiting to be handled on the next step
      invuln: 0,
      hurt: 0,             // brief dizzy face after a bump
      landSquash: 0,       // landing squash animation
      runPhase: 0,
    },
  };
}

/** Called by input handlers. The jump itself happens on the next physics step. */
export function pressJump(run) {
  if (run.status === 'running') run.dino.queued = true;
}

function emit(run, type, extra) {
  run.events.push({ type, x: run.dino.x, y: run.dino.y, ...extra });
}

// ---- Jumping ---------------------------------------------------------------
// Ground jump: allowed when standing, or within `coyoteTime` of running off a
// ledge. Air jump: one extra jump, only for a *fresh* tap (a buffered tap
// never spends the double jump). If neither is possible the tap is kept in
// the buffer and fires the moment the dinosaur lands.
function tryJump(run, freshTap) {
  const d = run.dino;
  if (d.grounded || d.coyote > 0) {
    d.vy = JUMP_VELOCITY;
    d.grounded = false;
    d.coyote = 0;
    d.jumpsUsed = 1;
    d.buffer = 0;
    run.jumpsMade++;
    emit(run, 'jump');
    return true;
  }
  if (freshTap && d.jumpsUsed < 2) {
    d.vy = DOUBLE_JUMP_VELOCITY;
    d.jumpsUsed = 2;
    d.buffer = 0;
    run.jumpsMade++;
    emit(run, 'doubleJump');
    return true;
  }
  return false;
}

function loseHeart(run, cause) {
  run.hearts = Math.max(0, run.hearts - 1);
  run.dino.invuln = PHYSICS.invulnerableTime;
  run.dino.hurt = 0.7;
  emit(run, cause, { hearts: run.hearts });
  if (run.hearts <= 0) {
    run.status = 'ending';
    run.endTimer = 0;
    emit(run, 'gameover');
  }
}

/** Put the dinosaur safely back on the track after a fall. */
function respawn(run, gap) {
  const d = run.dino;
  const c = run.course;
  const newX = Math.max(d.x, gap ? gap.x + gap.w + 30 : d.x);
  run.cameraLag += newX - d.x;
  d.x = newX;
  d.y = 0; d.vy = 0; d.grounded = true; d.jumpsUsed = 0; d.coyote = 0; d.buffer = 0;
  if (gap) gap.passed = true;
  // Never put a hazard right in front of a respawned player: clear the next stretch.
  const clearTo = newX + run.speed * 2;
  for (const h of c.hazards) {
    if (h.x + h.w > newX - 40 && h.x < clearTo && !h.passed) {
      h.removed = true;     // obstacles fade away, gaps get a little log bridge
      h.passed = true;
    }
  }
}

// ---- One fixed physics step ------------------------------------------------
export function stepRun(run, dt) {
  const d = run.dino;
  const c = run.course;
  run.time += dt;

  // Speed: follows the level's gentle ramp, then slows to a stop at the end.
  if (run.status === 'running') run.speed = speedAt(c, d.x);
  else run.speed = Math.max(0, run.speed - run.speed * 2.2 * dt - 20 * dt);
  d.x += run.speed * dt;
  d.runPhase += run.speed * dt / 22;
  run.cameraLag *= Math.exp(-6 * dt);
  if (Math.abs(run.cameraLag) < 0.05) run.cameraLag = 0;

  d.invuln = Math.max(0, d.invuln - dt);
  d.hurt = Math.max(0, d.hurt - dt);
  d.landSquash = Math.max(0, d.landSquash - dt);
  d.buffer = Math.max(0, d.buffer - dt);

  // Input: a tap starts the buffer and tries to jump straight away.
  if (d.queued) {
    d.queued = false;
    if (run.status === 'running') {
      d.buffer = PHYSICS.jumpBuffer;
      tryJump(run, true);
    }
  }

  // Ran off a ledge into a gap?
  if (d.grounded && gapAt(c, d.x)) {
    d.grounded = false;
    d.vy = 0;
    d.coyote = PHYSICS.coyoteTime;
  }

  // Gravity
  if (!d.grounded) {
    // Exact constant-gravity integration, so jump height doesn't depend on step size.
    d.y += d.vy * dt - 0.5 * PHYSICS.gravity * dt * dt;
    d.vy = Math.max(-PHYSICS.maxFallSpeed, d.vy - PHYSICS.gravity * dt);
    if (d.coyote > 0) {
      d.coyote -= dt;
      if (d.coyote <= 0 && d.jumpsUsed === 0) d.jumpsUsed = 1; // only the air jump is left
    }
  }

  // Landing / falling
  if (!d.grounded && d.vy <= 0 && d.y <= 0) {
    const overGap = gapAt(c, d.x);
    if (!overGap && d.y > -14) {
      const impact = -d.vy;
      d.y = 0; d.vy = 0; d.grounded = true; d.jumpsUsed = 0; d.coyote = 0;
      d.landSquash = 0.18;
      emit(run, 'land', { impact });
      if (d.buffer > 0 && run.status === 'running') tryJump(run, false); // buffered tap
    } else if (!overGap || d.y < -PHYSICS.fallDepth) {
      const gap = overGap || lastGapBehind(c, d.x);
      if (run.status === 'running') loseHeart(run, 'fall');
      respawn(run, gap);
    }
  }

  if (run.status === 'running') {
    collide(run);
    if (c.mode === 'level' && d.x >= c.length) {
      run.status = 'finishing';
      run.endTimer = 0;
      emit(run, 'finish');
    }
  }
  collectItems(run);

  if (c.mode === 'endless') {
    if (c.generatedTo < d.x + 2500) extendCourse(c, d.x + 4000);
    if (c.hazards.length && c.hazards[0].x < d.x - 1500) c.hazards = c.hazards.filter(h => h.x > d.x - 1500);
    if (c.items.length > 200) c.items = c.items.filter(i => i.x > d.x - 1500);
  }

  // End-of-run timers (let the celebration / sit-down play before the screen appears)
  if (run.status === 'finishing' || run.status === 'ending') {
    run.endTimer += dt;
    if (run.status === 'finishing' && run.endTimer > 2.2) { run.status = 'complete'; emit(run, 'complete'); }
    if (run.status === 'ending' && run.endTimer > 1.4) { run.status = 'over'; emit(run, 'over'); }
  }
}

function lastGapBehind(c, x) {
  let found = null;
  for (const h of c.hazards) {
    if (h.kind === 'gap' && h.x <= x) found = h;
    if (h.x > x) break;
  }
  return found;
}

// ---- Collision detection ---------------------------------------------------
// Axis-aligned boxes. The dinosaur's box is smaller than its picture and
// obstacles are inset too, so near-misses count as misses.
function collide(run) {
  const d = run.dino;
  const left = d.x - DINO.hitbox.halfW;
  const right = d.x + DINO.hitbox.halfW;
  const bottom = d.y + DINO.hitbox.bottom;
  const top = d.y + DINO.hitbox.top;

  for (const h of run.course.hazards) {
    if (h.x > right + 10) break;            // sorted: nothing further can touch
    if (h.passed) continue;
    if (h.kind === 'gap') {
      if (left > h.x + h.w) { h.passed = true; addScore(run, SCORING.pass); emit(run, 'pass'); }
      continue;
    }
    if (h.removed || h.hit) {
      if (left > h.x + h.w) h.passed = true;
      continue;
    }
    const ox1 = h.x + OBSTACLE_INSET.side;
    const ox2 = h.x + h.w - OBSTACLE_INSET.side;
    const otop = h.h - OBSTACLE_INSET.top;
    if (right > ox1 && left < ox2 && bottom < otop && top > 0) {
      if (d.invuln > 0) h.touched = true;   // protected: no damage, no points
      else { h.hit = true; loseHeart(run, 'hit'); if (run.status !== 'running') return; }
    }
    if (left > ox2) {
      h.passed = true;
      if (!h.hit && !h.touched) { addScore(run, SCORING.pass); emit(run, 'pass'); }
    }
  }
}

function collectItems(run) {
  const d = run.dino;
  const l = d.x - DINO.pickup.halfW, r = d.x + DINO.pickup.halfW;
  const b = d.y + DINO.pickup.bottom, t = d.y + DINO.pickup.top;
  for (const it of run.course.items) {
    if (it.taken || it.x < l - 60 || it.x > r + 60) continue;
    // circle-vs-box: distance from the item centre to the nearest point on the box
    const nx = Math.max(l, Math.min(it.x, r));
    const ny = Math.max(b, Math.min(it.y, t));
    if ((it.x - nx) ** 2 + (it.y - ny) ** 2 <= it.r * it.r) {
      it.taken = true;
      if (it.type === 'star') { run.stars++; addScore(run, SCORING.star); }
      else { run.fossils++; addScore(run, SCORING.fossil); }
      run.events.push({ type: it.type, x: it.x, y: it.y });
    }
  }
}

function addScore(run, n) { run.score += n; }

/** 0..1 progress through a level (endless: always 0). */
export function progressOf(run) {
  const c = run.course;
  return c.mode === 'endless' ? 0 : Math.min(1, Math.max(0, run.dino.x / c.length));
}

// ---- Dino Discoveries --------------------------------------------------------
export function discoveriesUnlocked(lifetimeFossils) {
  return DISCOVERIES.filter(d => lifetimeFossils >= d.at).length;
}
export function nextDiscovery(lifetimeFossils) {
  return DISCOVERIES.find(d => lifetimeFossils < d.at) || null;
}
