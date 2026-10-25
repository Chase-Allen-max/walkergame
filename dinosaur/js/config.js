// ---------------------------------------------------------------------------
// Walker's Dinosaur Adventure — tunable settings
//
// Everything a grown-up might want to tweak lives in this file:
// running speed, jump height, how forgiving each difficulty is, level length
// and scoring. All distances are in "world units" (the play area is about
// 400 units tall) and all times are in seconds.
// ---------------------------------------------------------------------------

export const VERSION = '1.0.0';

export const PHYSICS = {
  gravity: 2200,          // downward pull (units / s²). Higher = snappier, shorter jumps
  jumpHeight: 120,        // how high a normal jump lifts the dinosaur's feet
  doubleJumpHeight: 100,  // extra rise from the second jump in the air
  maxFallSpeed: 1500,     // terminal velocity, keeps falls readable
  coyoteTime: 0.10,       // grace period to still jump after running off a ledge
  jumpBuffer: 0.15,       // a tap this long before landing still counts
  fixedStep: 1 / 120,     // physics runs at a fixed 120 steps per second
  maxFrameTime: 0.1,      // never simulate more than this per frame (no big jumps after a stall)
  invulnerableTime: 2.0,  // seconds of protection after losing a heart
  fallDepth: 60,          // how far below the track counts as "fell"
};

// The dinosaur's collision box is deliberately a bit smaller than its drawing.
export const DINO = {
  screenX: 120,                  // where the dinosaur sits from the left edge of the view
  hitbox: { halfW: 16, bottom: 5, top: 42 },   // forgiving box for obstacles
  pickup: { halfW: 26, bottom: 0, top: 58 },   // generous box for stars & fossils
};

// Visible play area. The view always shows at least `minViewWidth` units of
// track ahead, so tall portrait phones zoom out instead of hiding obstacles.
export const VIEW = {
  minViewWidth: 560,
  minViewHeight: 400,
  groundDepth: 100,       // dirt below the track (space for the Jump button)
};

export const SCORING = {
  star: 10,
  fossil: 50,
  pass: 5,                // clearing an obstacle or gap
};

// reactionTime / landingPad feed the spacing formula in logic.js:
//   next hazard start >= this hazard start + width + speed × (airTime + reactionTime) + landingPad
export const DIFFICULTIES = {
  explorer: {
    label: 'Explorer',
    speed: 230,           // units per second
    reactionTime: 0.8,    // calm time after landing before the next hazard
    landingPad: 140,      // extra clear ground after each landing
    spacingVariance: 0.6, // random extra spacing (0.6 = up to 60% more)
    itemScale: 1.0,       // size of stars & fossils' pickup radius
    gapFraction: 0.36,    // gap width as a fraction of one full jump's distance
    rampPerLevel: 0.06,   // speed increase from the start to the end of a level
  },
  adventurer: {
    label: 'Adventurer',
    speed: 285,
    reactionTime: 0.55,
    landingPad: 85,
    spacingVariance: 1.2,
    itemScale: 0.85,
    gapFraction: 0.45,
    rampPerLevel: 0.08,
  },
  expert: {
    label: 'Expert',
    speed: 340,
    reactionTime: 0.4,
    landingPad: 50,
    spacingVariance: 1.0,
    itemScale: 0.75,
    gapFraction: 0.52,
    rampPerLevel: 0.10,
  },
};

// Obstacle shapes. w/h are the visible size; the collision box is inset a little.
export const OBSTACLES = {
  rockSmall: { w: 34, h: 28 },
  rockBig:   { w: 46, h: 40 },
  log:       { w: 64, h: 30 },
  vent:      { w: 28, h: 56 },   // steam vent: base + steady steam column
};
export const OBSTACLE_INSET = { side: 5, top: 4 };

export const LEVELS = [
  {
    id: 'fern',
    name: 'Fern Valley',
    theme: 'fern',
    duration: 70,          // approximate seconds to finish
    speedMult: 1.0,
    openingSeconds: 5,     // obstacle-free start
    tutorial: true,
    obstacleWeights: { rockSmall: 6, log: 3, rockBig: 1 },
    gapChance: 0,
    restChance: 0.25,
    starTrailChance: 0.8,
    fossils: 3,
  },
  {
    id: 'canyon',
    name: 'Fossil Canyon',
    theme: 'canyon',
    duration: 75,
    speedMult: 1.06,
    openingSeconds: 3,
    obstacleWeights: { rockSmall: 3, rockBig: 3, log: 3 },
    gapChance: 0.18,
    restChance: 0.2,
    starTrailChance: 0.55,
    fossils: 7,
  },
  {
    id: 'volcano',
    name: 'Volcano Trail',
    theme: 'volcano',
    duration: 80,
    speedMult: 1.12,
    openingSeconds: 3,
    obstacleWeights: { rockSmall: 2, rockBig: 3, log: 2, vent: 3 },
    gapChance: 0.2,
    restChance: 0.18,
    starTrailChance: 0.5,
    fossils: 6,
  },
];

export const ENDLESS = {
  id: 'endless',
  name: 'Endless Adventure',
  theme: 'cycle',          // scenery cycles through all three places
  speedMult: 1.05,
  maxSpeedMult: 1.3,       // speed stops increasing here
  rampDistance: 30000,     // distance over which speed reaches its maximum
  openingSeconds: 3,
  obstacleWeights: { rockSmall: 3, rockBig: 3, log: 2, vent: 2 },
  gapChance: 0.18,
  restChance: 0.18,
  starTrailChance: 0.5,
  fossilEvery: 2600,       // roughly one fossil per this many units
  themeLength: 9000,       // distance before the scenery changes
};

// Lifetime fossils needed for each discovery, in order.
export const DISCOVERIES = [
  { id: 'triceratops', at: 1,  name: 'Triceratops', fact: 'Triceratops had three horns.' },
  { id: 'stegosaurus', at: 3,  name: 'Stegosaurus', fact: 'Stegosaurus had bony plates along its back.' },
  { id: 'trex',        at: 6,  name: 'T. rex',      fact: 'T. rex walked on two legs.' },
  { id: 'feathers',    at: 10, name: 'Feathered dinosaurs', fact: 'Some dinosaurs had feathers.' },
  { id: 'birds',       at: 15, name: 'Birds',       fact: 'Birds are living dinosaurs.' },
  { id: 'pangaea',     at: 21, name: 'Pangaea',     fact: 'Pangaea was a supercontinent that began breaking apart about 200 million years ago.' },
];

// Short facts shown on the level-complete screen.
export const LEVEL_FACTS = [
  'Baby dinosaurs hatched from eggs.',
  'Fossils help scientists learn about dinosaurs.',
  'Some dinosaurs were as small as a chicken.',
  'Many dinosaurs ate only plants.',
  'Dinosaurs lived on every continent.',
  'Long-necked dinosaurs could reach the tops of trees.',
];
