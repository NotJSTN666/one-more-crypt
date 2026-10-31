// The Night Shift: a survival mode. The dead come at you from every side, in real time, and
// never stop; you keep moving while your relics fight for you, and every level you pick a relic
// to add or sharpen. Bosses rise every two minutes, each tougher than the last, with attacks to
// dodge. The score is how many you put down before the night takes you.
//
// This is the simulation alone (no drawing): advance it with step(), feeding it the direction
// you're holding. Positions are in tiles. It takes its own random source, so tests can pin it.

export type FoeKind = 'ghoul' | 'bat' | 'wraith' | 'brute' | 'imp' | 'boss' | 'abbot' | 'lich';
export type BossKind = 'boss' | 'abbot' | 'lich';

export interface Foe {
  id: number;
  kind: FoeKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  /** Collision radius, in tiles. */
  r: number;
  xp: number;
  /** Slowed (by frost) until this time. */
  slowUntil: number;
  /** When each orbiting skull may hit this foe again. */
  skullAt: number;
  /** Knocked back (or charging): a push still to apply. */
  kx: number;
  ky: number;
  /** Just hit, for the flash. */
  hitAt: number;
  boss: boolean;
  /** A boss's next attack, and how many it has made. */
  atkAt: number;
  atkN: number;
}

export type Pickup = { x: number; y: number; kind: 'soul' | 'bigsoul' | 'glowcap'; v: number };

/** Your thrown things: bone darts, the scythe (which comes back) and wisps (which seek). */
export interface Dart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  pierce: number;
  life: number;
  hit: number[];
  kind: 'dart' | 'scythe' | 'wisp';
}
export interface Flame { x: number; y: number; until: number; r: number; dps: number }
/** A boss's bolt, flying at you. */
export interface Shot { x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number }
/**
 * A boss's lane: marked on the ground first, then it strikes everything along it. A Gravelord's
 * lane is the path of his charge.
 */
export interface Lane { x: number; y: number; ang: number; len: number; w: number; at: number; dmg: number; charge?: number }
/** Things to draw for a moment: a spade swing, a lightning strike, a bell's ring, spikes, a lance, a lane bursting. */
export interface Flash { kind: 'swing' | 'bolt' | 'ring' | 'spike' | 'beam' | 'lane'; x: number; y: number; at: number; ang?: number; r?: number }

/** Relics in the Night Shift: weapons that fight on their own, and charms that help. */
export type RelicKind =
  | 'spade' | 'skulls' | 'quiver' | 'ember' | 'storm' | 'frost' | 'bell' | 'scythe' | 'wisps' | 'spikes' | 'lance'
  | 'heart' | 'boots' | 'magnet' | 'fang' | 'whetstone' | 'hourglass' | 'moss' | 'thorns' | 'lens' | 'coin';

export interface NightRelic {
  id: RelicKind;
  name: string;
  emoji: string;
  weapon: boolean;
  /** What each level does, for the level-up choice (index = level reached, 1-5). */
  text: (level: number) => string;
}

export const MAX_LEVEL = 5;
/** Weapons you can carry at once. */
export const MAX_WEAPONS = 6;

export const NIGHT_RELICS: NightRelic[] = [
  { id: 'spade', name: "Gravedigger's Spade", emoji: '⛏️', weapon: true, text: (l) => (l === 1 ? 'Swings at whatever is closest.' : 'A wider, harder, faster swing.') },
  { id: 'skulls', name: 'Whirling Skulls', emoji: '💀', weapon: true, text: (l) => (l === 1 ? 'Two skulls circle you, striking what they touch.' : 'One more skull, and they hit harder.') },
  { id: 'quiver', name: 'Bone Quiver', emoji: '🏹', weapon: true, text: (l) => (l === 1 ? 'Fires a bone dart at the nearest foe.' : 'More darts, and they pierce.') },
  { id: 'ember', name: 'Ember Brand', emoji: '🔥', weapon: true, text: (l) => (l === 1 ? 'You leave burning ground behind you.' : 'Hotter flames that burn for longer.') },
  { id: 'storm', name: 'Storm Rune', emoji: '⚡', weapon: true, text: (l) => (l === 1 ? 'Lightning strikes a foe near you now and then.' : 'Strikes one more foe, harder and sooner.') },
  { id: 'frost', name: 'Frost Sigil', emoji: '❄️', weapon: true, text: (l) => (l === 1 ? 'A cold that slows and bites everything close to you.' : 'A wider, colder ring.') },
  { id: 'bell', name: 'Grave Bell', emoji: '🔔', weapon: true, text: (l) => (l === 1 ? 'Tolls now and then, throwing back everything near you.' : 'A louder toll that hits harder and more often.') },
  { id: 'scythe', name: 'Crescent Scythe', emoji: '🌙', weapon: true, text: (l) => (l === 1 ? 'A spinning blade that flies out and comes back, cutting through all in its way.' : 'More blades, and they cut deeper.') },
  { id: 'wisps', name: 'Wandering Wisps', emoji: '👻', weapon: true, text: (l) => (l === 1 ? 'Little ghosts that hunt down the dead for you.' : 'More wisps, and they bite harder.') },
  { id: 'spikes', name: 'Bone Spikes', emoji: '🦴', weapon: true, text: (l) => (l === 1 ? 'Spikes burst up under foes near you.' : 'More spikes, wider and harder.') },
  { id: 'lance', name: 'Soul Lance', emoji: '🔱', weapon: true, text: (l) => (l === 1 ? 'A beam that runs through every foe in a line.' : 'A longer beam that hits harder and more often.') },
  { id: 'heart', name: 'Iron Heart', emoji: '🫀', weapon: false, text: () => '+5 max health, and heal 5.' },
  { id: 'boots', name: 'Swift Boots', emoji: '🥾', weapon: false, text: () => 'Move 8% faster.' },
  { id: 'magnet', name: 'Grave Magnet', emoji: '🧲', weapon: false, text: () => 'Pull in souls from further away.' },
  { id: 'fang', name: 'Vampire Fang', emoji: '🦷', weapon: false, text: () => 'A chance to heal 1 on each kill.' },
  { id: 'whetstone', name: 'Whetstone', emoji: '🗡️', weapon: false, text: () => 'Everything hits 12% harder.' },
  { id: 'hourglass', name: 'Stopped Hourglass', emoji: '⏳', weapon: false, text: () => 'Weapons come round 8% sooner.' },
  { id: 'moss', name: 'Grave Moss', emoji: '🍄', weapon: false, text: () => 'Slowly heal over time.' },
  { id: 'thorns', name: 'Thorn Mail', emoji: '🌵', weapon: false, text: () => 'Whatever bites you gets hurt back.' },
  { id: 'lens', name: "Seer's Lens", emoji: '🔮', weapon: false, text: () => 'Swings, rings, flames and spikes reach 12% further.' },
  { id: 'coin', name: "Reaper's Coin", emoji: '🪙', weapon: false, text: () => 'Souls count 15% more.' },
];
export const NIGHT_RELIC = Object.fromEntries(NIGHT_RELICS.map((r) => [r.id, r])) as Record<RelicKind, NightRelic>;

/** The first boss rises at this time, then one more every BOSS_EVERY seconds. */
export const FIRST_BOSS = 90;
export const BOSS_EVERY = 120;
const BOSS_ORDER: BossKind[] = ['boss', 'abbot', 'lich'];
export const isBoss = (k: FoeKind): k is BossKind => k === 'boss' || k === 'abbot' || k === 'lich';
/** The field: a square of this many tiles a side. */
export const FIELD = 48;
const MAX_FOES = 260;

const STATS: Record<FoeKind, { hp: number; speed: number; dmg: number; r: number; xp: number }> = {
  ghoul: { hp: 4, speed: 1.5, dmg: 1, r: 0.35, xp: 1 },
  bat: { hp: 2, speed: 2.5, dmg: 1, r: 0.3, xp: 1 },
  wraith: { hp: 8, speed: 1.4, dmg: 2, r: 0.35, xp: 2 },
  brute: { hp: 24, speed: 1.0, dmg: 3, r: 0.55, xp: 5 },
  imp: { hp: 7, speed: 2.3, dmg: 2, r: 0.35, xp: 2 },
  boss: { hp: 450, speed: 1.3, dmg: 5, r: 1.0, xp: 50 },
  abbot: { hp: 1000, speed: 1.3, dmg: 6, r: 1.0, xp: 70 },
  lich: { hp: 1500, speed: 1.4, dmg: 7, r: 1.0, xp: 100 },
};

export interface Night {
  t: number;
  x: number;
  y: number;
  /** Which way you last moved. */
  fx: number;
  fy: number;
  hp: number;
  maxHp: number;
  hurtUntil: number;
  level: number;
  xp: number;
  /** Levels waiting to be chosen. */
  pendingLevels: number;
  relics: Partial<Record<RelicKind, number>>;
  foes: Foe[];
  pickups: Pickup[];
  darts: Dart[];
  flames: Flame[];
  shots: Shot[];
  lanes: Lane[];
  flashes: Flash[];
  kills: number;
  bossKills: number;
  /** Next time each weapon fires. */
  next: Partial<Record<RelicKind, number>>;
  nextId: number;
  spawnDebt: number;
  bossesRisen: number;
  over: boolean;
  rand: () => number;
}

export function newNight(rand: () => number = Math.random): Night {
  return {
    t: 0,
    x: FIELD / 2,
    y: FIELD / 2,
    fx: 1,
    fy: 0,
    hp: 20,
    maxHp: 20,
    hurtUntil: 0,
    level: 1,
    xp: 0,
    pendingLevels: 0,
    relics: { spade: 1 },
    foes: [],
    pickups: [],
    darts: [],
    flames: [],
    shots: [],
    lanes: [],
    flashes: [],
    kills: 0,
    bossKills: 0,
    next: {},
    nextId: 1,
    spawnDebt: 0,
    bossesRisen: 0,
    over: false,
    rand,
  };
}

const lv = (n: Night, r: RelicKind) => n.relics[r] ?? 0;
/** Souls needed to go from this level to the next. */
export const xpToLevel = (level: number) => 2 + level * 2 + Math.floor((level * level) / 10);
const dmgMul = (n: Night) => 1 + 0.12 * lv(n, 'whetstone');
const cdMul = (n: Night) => 1 - 0.08 * lv(n, 'hourglass');
const area = (n: Night) => 1 + 0.12 * lv(n, 'lens');
export const pickupRadius = (n: Night) => 1.3 + 1.2 * lv(n, 'magnet');
export const playerSpeed = (n: Night) => 4 * (1 + 0.08 * lv(n, 'boots'));
export const skullCount = (n: Night) => (lv(n, 'skulls') ? 1 + lv(n, 'skulls') : 0);
export const frostRadius = (n: Night) => (lv(n, 'frost') ? (1.6 + 0.3 * lv(n, 'frost')) * area(n) : 0);
export const PLAYER_R = 0.35;
/** When the next boss rises. */
export const nextBossAt = (n: Night) => FIRST_BOSS + n.bossesRisen * BOSS_EVERY;

/** Three choices for a level-up: relics you can still add or sharpen. */
export function levelChoices(n: Night): RelicKind[] {
  const weapons = NIGHT_RELICS.filter((r) => r.weapon && lv(n, r.id) > 0).length;
  const open = NIGHT_RELICS.filter((r) => lv(n, r.id) < MAX_LEVEL && (lv(n, r.id) > 0 || !r.weapon || weapons < MAX_WEAPONS));
  const out: RelicKind[] = [];
  const pool = [...open];
  // With only the spade in hand, one choice is always a new weapon.
  if (weapons < 2) {
    const arms = pool.filter((r) => r.weapon && !lv(n, r.id));
    if (arms.length) {
      const r = arms[Math.floor(n.rand() * arms.length)];
      out.push(r.id);
      pool.splice(pool.indexOf(r), 1);
    }
  }
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(n.rand() * pool.length), 1)[0].id);
  return out;
}

/** Take a relic (or its next level) for a waiting level. */
export function chooseRelic(n: Night, id: RelicKind) {
  if (n.pendingLevels <= 0 || lv(n, id) >= MAX_LEVEL) return;
  n.relics[id] = lv(n, id) + 1;
  n.pendingLevels--;
  if (id === 'heart') {
    n.maxHp += 5;
    n.hp = Math.min(n.maxHp, n.hp + 5);
  }
}

/**
 * Somewhere just beyond what you can see, inside the field: on any side, but more often the
 * way you're heading, so running away only runs into more of them.
 */
function edgeSpot(n: Night): { x: number; y: number } {
  const ahead = n.rand() < 0.5;
  const ang = ahead ? Math.atan2(n.fy, n.fx) + (n.rand() - 0.5) * Math.PI * 1.2 : n.rand() * Math.PI * 2;
  const d = 9 + n.rand() * 3;
  return { x: Math.max(1, Math.min(FIELD - 1, n.x + Math.cos(ang) * d)), y: Math.max(1, Math.min(FIELD - 1, n.y + Math.sin(ang) * d)) };
}

function spawn(n: Night, kind: FoeKind, at?: { x: number; y: number }) {
  const s = STATS[kind];
  const { x, y } = at ?? edgeSpot(n);
  const boss = isBoss(kind);
  // They grow tougher as the night wears on; each boss is tougher than the one before.
  const hp = Math.round(s.hp * (boss ? 1 + 0.7 * n.bossesRisen : 1 + n.t / 120 + (n.t / 300) ** 2));
  const dmg = s.dmg + Math.floor(n.t / (boss ? 240 : 180));
  n.foes.push({
    id: n.nextId++, kind, x, y, hp, maxHp: hp, speed: s.speed * (boss ? 1 + 0.05 * n.bossesRisen : 1), dmg, r: s.r, xp: s.xp,
    slowUntil: 0, skullAt: 0, kx: 0, ky: 0, hitAt: -1, boss, atkAt: n.t + 2.5, atkN: 0,
  });
}

/** Which of the dead come at this point in the night. */
function pickKind(n: Night): FoeKind {
  const t = n.t;
  const table: [FoeKind, number][] = [
    ['ghoul', 10],
    ['bat', t > 20 ? 6 : 0],
    ['wraith', t > 75 ? 4 : 0],
    ['brute', t > 150 ? 2 + t / 200 : 0],
    ['imp', t > 240 ? 4 : 0],
  ];
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = n.rand() * total;
  for (const [k, w] of table) if ((r -= w) < 0) return k;
  return 'ghoul';
}

function hurtFoe(n: Night, f: Foe, amount: number) {
  if (f.hp <= 0) return;
  f.hp -= amount * dmgMul(n);
  f.hitAt = n.t;
  if (f.hp <= 0) {
    n.kills++;
    n.pickups.push({ x: f.x, y: f.y, kind: f.xp >= 5 ? 'bigsoul' : 'soul', v: f.xp });
    if (f.boss) n.bossKills++;
    if (f.boss) n.pickups.push({ x: f.x + 0.6, y: f.y, kind: 'glowcap', v: 10 });
    else if (n.rand() < 0.012) n.pickups.push({ x: f.x, y: f.y + 0.3, kind: 'glowcap', v: 5 });
    if (lv(n, 'fang') && n.rand() < 0.05 * lv(n, 'fang')) n.hp = Math.min(n.maxHp, n.hp + 1);
  }
}

/** You take a hit, unless you've just been hit. */
function hurtYou(n: Night, dmg: number, from?: Foe) {
  if (n.t < n.hurtUntil) return;
  n.hp -= dmg;
  n.hurtUntil = n.t + 0.75;
  if (from && lv(n, 'thorns')) hurtFoe(n, from, 5 * lv(n, 'thorns'));
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** How far a point lies from a lane's line. */
export function laneDist(l: Lane, x: number, y: number): number {
  const ux = Math.cos(l.ang);
  const uy = Math.sin(l.ang);
  const along = Math.max(0, Math.min(l.len, (x - l.x) * ux + (y - l.y) * uy));
  return Math.hypot(x - (l.x + ux * along), y - (l.y + uy * along));
}

/** The dead shoulder each other aside rather than piling into one heap. */
function shoulder(n: Night) {
  const grid = new Map<number, Foe[]>();
  const cell = (x: number, y: number) => Math.floor(x) * 64 + Math.floor(y);
  for (const f of n.foes) {
    const k = cell(f.x, f.y);
    const list = grid.get(k);
    if (list) list.push(f);
    else grid.set(k, [f]);
  }
  for (const f of n.foes) {
    const cx = Math.floor(f.x);
    const cy = Math.floor(f.y);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const o of grid.get(gx * 64 + gy) ?? []) {
          if (o.id <= f.id) continue;
          const dx = o.x - f.x;
          const dy = o.y - f.y;
          const d = Math.hypot(dx, dy);
          const min = (o.r + f.r) * 0.85;
          if (d >= min || d === 0) continue;
          // the bigger one gives less ground
          const push = (min - d) / 2 / d;
          const wf = f.boss ? 0.1 : o.boss ? 1.9 : 1;
          const wo = 2 - wf;
          f.x -= dx * push * wf;
          f.y -= dy * push * wf;
          o.x += dx * push * wo;
          o.y += dy * push * wo;
        }
      }
    }
  }
}

/** A ring (or fan) of bolts from a point. */
function volley(n: Night, from: { x: number; y: number }, dmg: number, count: number, speed: number, aim: number | null, spread = Math.PI * 2) {
  for (let k = 0; k < count; k++) {
    const a = aim === null ? (k / count) * Math.PI * 2 : aim + (count > 1 ? (k / (count - 1) - 0.5) * spread : 0);
    n.shots.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 0.28, dmg, life: 6 });
  }
}

/**
 * The bosses' attacks. The Gravelord marks a lane and charges down it, throwing bolts where he
 * stops; the Drowned Abbot fires fans and rings of bolts; the Lich marks three lanes that burst
 * a moment later, and sometimes spins out a spiral. Each boss to rise attacks a little faster.
 */
function bossAttack(n: Night, f: Foe) {
  if (n.t < f.atkAt) return;
  const aim = Math.atan2(n.y - f.y, n.x - f.x);
  const bolt = Math.max(2, f.dmg - 1);
  const k = n.bossesRisen;
  if (f.kind === 'boss') {
    const len = Math.min(10, Math.hypot(n.x - f.x, n.y - f.y) + 3);
    n.lanes.push({ x: f.x, y: f.y, ang: aim, len, w: f.r, at: n.t + 0.9, dmg: f.dmg + 1, charge: f.id });
    f.atkAt = n.t + Math.max(2.6, 4 - 0.15 * k);
  } else if (f.kind === 'abbot') {
    if (f.atkN % 3 === 2) volley(n, f, bolt, 16 + 2 * k, 3.6, null);
    else volley(n, f, bolt, 5, 4.5, aim, 0.7);
    f.atkAt = n.t + Math.max(1.3, 2.2 - 0.1 * k);
  } else {
    if (f.atkN % 4 === 3) {
      // a spiral, poured out over two seconds
      for (let s = 0; s < 24; s++) {
        const a = aim + s * 0.55;
        const back = s * 0.09;
        n.shots.push({ x: f.x - Math.cos(a) * back * 3.4, y: f.y - Math.sin(a) * back * 3.4, vx: Math.cos(a) * 3.4, vy: Math.sin(a) * 3.4, r: 0.28, dmg: bolt, life: 6 + back });
      }
    } else {
      const later = Math.max(0.65, 1 - 0.05 * k);
      for (const off of [-0.45, 0, 0.45]) n.lanes.push({ x: f.x, y: f.y, ang: aim + off, len: 14, w: 0.55, at: n.t + later, dmg: f.dmg });
    }
    f.atkAt = n.t + Math.max(1.8, 2.8 - 0.1 * k);
  }
  f.atkN++;
}

/** Advance the night by dt seconds, with (dx, dy) the direction held (any length; 0 to stand). */
export function step(n: Night, dt: number, dx: number, dy: number) {
  if (n.over || n.pendingLevels > 0) return;
  n.t += dt;

  // ---- you ----
  const len = Math.hypot(dx, dy);
  if (len > 0.1) {
    const sp = playerSpeed(n) * dt;
    n.x = Math.max(0.5, Math.min(FIELD - 0.5, n.x + (dx / len) * sp));
    n.y = Math.max(0.5, Math.min(FIELD - 0.5, n.y + (dy / len) * sp));
    n.fx = dx / len;
    n.fy = dy / len;
  }
  const mossEvery = 6 - lv(n, 'moss');
  if (lv(n, 'moss') && Math.floor(n.t / mossEvery) !== Math.floor((n.t - dt) / mossEvery)) n.hp = Math.min(n.maxHp, n.hp + 1);

  // ---- the dead arrive ----
  const rate = 1.6 + (n.t / 60) * 1.0;
  n.spawnDebt += rate * dt;
  while (n.spawnDebt >= 1) {
    n.spawnDebt--;
    if (n.foes.length < MAX_FOES) spawn(n, pickKind(n));
  }
  if (n.t >= nextBossAt(n)) {
    spawn(n, BOSS_ORDER[n.bossesRisen % BOSS_ORDER.length]);
    n.bossesRisen++;
  }
  // Every so often, a ring of bats closes in from all round.
  if (Math.floor(n.t / 150) > Math.floor((n.t - dt) / 150)) {
    const count = 16 + Math.floor(n.t / 60) * 2;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      spawn(n, 'bat', { x: Math.max(1, Math.min(FIELD - 1, n.x + Math.cos(a) * 8)), y: Math.max(1, Math.min(FIELD - 1, n.y + Math.sin(a) * 8)) });
    }
  }

  // ---- your weapons ----
  const ready = (r: RelicKind, every: number) => {
    if (!lv(n, r)) return false;
    if ((n.next[r] ?? 0) > n.t) return false;
    n.next[r] = n.t + every * cdMul(n);
    return true;
  };
  const L = (r: RelicKind) => lv(n, r);
  const nearest = (from: { x: number; y: number }, within = Infinity) => {
    let best: Foe | null = null;
    let bd = within;
    for (const f of n.foes) {
      if (f.hp <= 0) continue;
      const d = near(from, f);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  };

  // The spade: an arc toward the nearest foe in reach (or the way you're going).
  if (ready('spade', Math.max(0.4, 1.0 - 0.12 * L('spade')))) {
    const reach = (1.5 + 0.2 * L('spade')) * area(n);
    const half = ((55 + 10 * L('spade')) * Math.PI) / 180;
    const target = nearest(n, reach + 1.5);
    const facing = target ? Math.atan2(target.y - n.y, target.x - n.x) : Math.atan2(n.fy, n.fx);
    n.flashes.push({ kind: 'swing', x: n.x, y: n.y, at: n.t, ang: facing, r: reach });
    for (const f of n.foes) {
      const d = near(n, f);
      if (d > reach + f.r) continue;
      let diff = Math.abs(Math.atan2(f.y - n.y, f.x - n.x) - facing);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff <= half || d < 0.6) {
        hurtFoe(n, f, 4 + 2 * L('spade'));
        if (!f.boss) {
          f.kx += ((f.x - n.x) / (d || 1)) * 0.5;
          f.ky += ((f.y - n.y) / (d || 1)) * 0.5;
        }
      }
    }
  }

  // Whirling skulls: orbit and strike what they touch.
  const skulls = skullCount(n);
  for (let k = 0; k < skulls; k++) {
    const a = n.t * 3 + (k / skulls) * Math.PI * 2;
    const sx = n.x + Math.cos(a) * 1.6;
    const sy = n.y + Math.sin(a) * 1.6;
    for (const f of n.foes) {
      if (f.skullAt > n.t || Math.hypot(f.x - sx, f.y - sy) > f.r + 0.35) continue;
      f.skullAt = n.t + 0.4;
      hurtFoe(n, f, 3 + L('skulls'));
    }
  }

  // Bone darts at the nearest foes.
  if (ready('quiver', Math.max(0.35, 0.9 - 0.08 * L('quiver')))) {
    const targets = n.foes.filter((f) => f.hp > 0).sort((a, b) => near(n, a) - near(n, b)).slice(0, Math.min(4, Math.ceil(L('quiver') / 1.5)));
    for (const f of targets) {
      const d = near(n, f) || 1;
      n.darts.push({ x: n.x, y: n.y, vx: ((f.x - n.x) / d) * 10, vy: ((f.y - n.y) / d) * 10, dmg: 4 + L('quiver'), pierce: Math.floor(L('quiver') / 2), life: 1.2, hit: [], kind: 'dart' });
    }
  }
  // The scythe: out toward a foe, then home again, cutting through everything both ways.
  if (ready('scythe', Math.max(1.2, 2.4 - 0.2 * L('scythe')))) {
    const count = 1 + Math.floor(L('scythe') / 2);
    const f = nearest(n);
    const base = f ? Math.atan2(f.y - n.y, f.x - n.x) : Math.atan2(n.fy, n.fx);
    for (let k = 0; k < count; k++) {
      const a = base + (k - (count - 1) / 2) * 0.5;
      n.darts.push({ x: n.x, y: n.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, dmg: 6 + 2 * L('scythe'), pierce: 999, life: 1.6, hit: [], kind: 'scythe' });
    }
  }
  // Wisps: slow little ghosts that turn toward the nearest foe.
  if (ready('wisps', Math.max(0.7, 1.6 - 0.15 * L('wisps')))) {
    for (let k = 0; k < 1 + Math.floor(L('wisps') / 2); k++) {
      const a = n.rand() * Math.PI * 2;
      n.darts.push({ x: n.x, y: n.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, dmg: 5 + 2 * L('wisps'), pierce: 0, life: 3, hit: [], kind: 'wisp' });
    }
  }
  for (const d of n.darts) {
    if (d.kind === 'scythe' && d.life < 0.8) {
      // coming home, and free to cut the same foes again
      if (d.life + dt >= 0.8) d.hit = [];
      const back = Math.atan2(n.y - d.y, n.x - d.x);
      d.vx = Math.cos(back) * 10;
      d.vy = Math.sin(back) * 10;
      if (Math.hypot(n.x - d.x, n.y - d.y) < 0.5) d.life = 0;
    } else if (d.kind === 'wisp') {
      const f = nearest(d, 8);
      if (f) {
        const a = Math.atan2(f.y - d.y, f.x - d.x);
        d.vx += (Math.cos(a) * 7 - d.vx) * Math.min(1, dt * 4);
        d.vy += (Math.sin(a) * 7 - d.vy) * Math.min(1, dt * 4);
      }
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.life -= dt;
    for (const f of n.foes) {
      if (f.hp <= 0 || d.hit.includes(f.id) || Math.hypot(f.x - d.x, f.y - d.y) > f.r + (d.kind === 'scythe' ? 0.45 : 0.15)) continue;
      d.hit.push(f.id);
      hurtFoe(n, f, d.dmg);
      if (d.hit.length > d.pierce) {
        d.life = 0;
        break;
      }
    }
  }
  n.darts = n.darts.filter((d) => d.life > 0);

  // Ember: burning ground left behind you.
  if (ready('ember', 0.35)) n.flames.push({ x: n.x, y: n.y, until: n.t + 1.6 + 0.4 * L('ember'), r: (0.6 + 0.05 * L('ember')) * area(n), dps: 4 + 2 * L('ember') });
  if (n.flames.length) {
    for (const fl of n.flames) for (const f of n.foes) if (Math.hypot(f.x - fl.x, f.y - fl.y) < fl.r + f.r) hurtFoe(n, f, fl.dps * dt);
    n.flames = n.flames.filter((fl) => fl.until > n.t);
  }

  // Storm: lightning on foes near you.
  if (ready('storm', Math.max(0.9, 2.3 - 0.25 * L('storm')))) {
    const close = n.foes.filter((f) => f.hp > 0 && near(n, f) < 7);
    for (let k = 0; k < 1 + L('storm') && close.length; k++) {
      const f = close.splice(Math.floor(n.rand() * close.length), 1)[0];
      n.flashes.push({ kind: 'bolt', x: f.x, y: f.y, at: n.t });
      hurtFoe(n, f, 8 + 4 * L('storm'));
    }
  }

  // Bone spikes: burst up under foes near you, hurting all round each.
  if (ready('spikes', Math.max(1, 2.2 - 0.2 * L('spikes')))) {
    const close = n.foes.filter((f) => f.hp > 0 && near(n, f) < 6);
    const r = (0.8 + 0.1 * L('spikes')) * area(n);
    for (let k = 0; k < 1 + L('spikes') && close.length; k++) {
      const c = close.splice(Math.floor(n.rand() * close.length), 1)[0];
      const at = { x: c.x, y: c.y };
      n.flashes.push({ kind: 'spike', x: at.x, y: at.y, at: n.t, r });
      for (const f of n.foes) if (near(at, f) < r + f.r) hurtFoe(n, f, 7 + 3 * L('spikes'));
    }
  }

  // The soul lance: a beam through every foe in a line.
  if (ready('lance', Math.max(1.1, 2.6 - 0.25 * L('lance')))) {
    const f = nearest(n);
    const ang = f ? Math.atan2(f.y - n.y, f.x - n.x) : Math.atan2(n.fy, n.fx);
    const beam: Lane = { x: n.x, y: n.y, ang, len: 6 + L('lance'), w: 0.45, at: n.t, dmg: 0 };
    n.flashes.push({ kind: 'beam', x: n.x, y: n.y, at: n.t, ang, r: beam.len });
    for (const o of n.foes) if (laneDist(beam, o.x, o.y) < beam.w + o.r) hurtFoe(n, o, 10 + 5 * L('lance'));
  }

  // Frost: a ring of cold that slows and bites.
  const fr = frostRadius(n);
  if (fr) for (const f of n.foes) if (near(n, f) < fr + f.r) {
    f.slowUntil = n.t + 0.2;
    hurtFoe(n, f, (1 + L('frost')) * dt);
  }

  // The bell: a toll that throws everything back.
  if (ready('bell', Math.max(1.6, 4 - 0.45 * L('bell')))) {
    const r = (2.4 + 0.4 * L('bell')) * area(n);
    n.flashes.push({ kind: 'ring', x: n.x, y: n.y, at: n.t, r });
    for (const f of n.foes) {
      const d = near(n, f);
      if (d > r + f.r) continue;
      hurtFoe(n, f, 5 + 3 * L('bell'));
      if (!f.boss) {
        f.kx += ((f.x - n.x) / (d || 1)) * 1.6;
        f.ky += ((f.y - n.y) / (d || 1)) * 1.6;
      }
    }
  }
  n.flashes = n.flashes.filter((fl) => n.t - fl.at < 0.4);

  // ---- the dead move, and bite ----
  for (const f of n.foes) {
    if (f.hp <= 0) continue;
    // A charging Gravelord doesn't stop to walk.
    const charging = Math.abs(f.kx) + Math.abs(f.ky) > 0.05 && f.boss;
    if (f.kx || f.ky) {
      f.x += f.kx * Math.min(1, dt * 10);
      f.y += f.ky * Math.min(1, dt * 10);
      f.kx *= 0.8;
      f.ky *= 0.8;
      if (Math.abs(f.kx) + Math.abs(f.ky) < 0.02) f.kx = f.ky = 0;
      f.x = Math.max(0.5, Math.min(FIELD - 0.5, f.x));
      f.y = Math.max(0.5, Math.min(FIELD - 0.5, f.y));
    }
    let d = near(n, f) || 1;
    // Left far behind: it comes round again from out of sight.
    if (d > 15 && !f.boss) {
      Object.assign(f, edgeSpot(n));
      d = near(n, f) || 1;
    }
    if (f.boss) bossAttack(n, f);
    const slow = f.slowUntil > n.t ? 1 - (0.3 + 0.05 * L('frost')) * (f.boss ? 0.5 : 1) : 1;
    // Bats weave as they come.
    const wob = f.kind === 'bat' ? Math.sin(n.t * 6 + f.id) * 0.6 : 0;
    const ux = (n.x - f.x) / d;
    const uy = (n.y - f.y) / d;
    if (!charging) {
      f.x += (ux - uy * wob) * f.speed * slow * dt;
      f.y += (uy + ux * wob) * f.speed * slow * dt;
    }
    if (d < f.r + PLAYER_R) hurtYou(n, f.dmg, f);
  }
  n.foes = n.foes.filter((f) => f.hp > 0);
  shoulder(n);

  // ---- the bosses' bolts and lanes ----
  for (const s of n.shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (Math.hypot(s.x - n.x, s.y - n.y) < s.r + PLAYER_R) {
      hurtYou(n, s.dmg);
      s.life = 0;
    }
  }
  n.shots = n.shots.filter((s) => s.life > 0 && s.x > -1 && s.y > -1 && s.x < FIELD + 1 && s.y < FIELD + 1);
  for (const l of n.lanes) {
    if (n.t < l.at) continue;
    n.flashes.push({ kind: 'lane', x: l.x, y: l.y, at: n.t, ang: l.ang, r: l.len });
    if (laneDist(l, n.x, n.y) < l.w + PLAYER_R) hurtYou(n, l.dmg);
    const charger = l.charge ? n.foes.find((f) => f.id === l.charge) : undefined;
    if (charger) {
      // down the lane at a run, then bolts all round where he stops
      const ux = Math.cos(l.ang);
      const uy = Math.sin(l.ang);
      const end = { x: Math.max(1, Math.min(FIELD - 1, l.x + ux * l.len)), y: Math.max(1, Math.min(FIELD - 1, l.y + uy * l.len)) };
      charger.kx = (end.x - charger.x) / 0.83;
      charger.ky = (end.y - charger.y) / 0.83;
      volley(n, end, Math.max(2, charger.dmg - 1), 8 + n.bossesRisen, 3.4, null);
    }
  }
  n.lanes = n.lanes.filter((l) => n.t < l.at);

  if (n.hp <= 0) {
    n.hp = 0;
    n.over = true;
    return;
  }

  // ---- pickups ----
  const pull = pickupRadius(n);
  const soulMul = 1 + 0.15 * lv(n, 'coin');
  for (const p of n.pickups) {
    const d = near(n, p);
    if (d < pull) {
      // drawn in, faster the closer it gets
      const k = Math.min(1, (dt * 9) / Math.max(0.3, d));
      p.x += (n.x - p.x) * k;
      p.y += (n.y - p.y) * k;
    }
    if (near(n, p) < 0.45) {
      if (p.kind === 'glowcap') n.hp = Math.min(n.maxHp, n.hp + p.v);
      else n.xp += p.v * soulMul;
      p.v = 0;
    }
  }
  n.pickups = n.pickups.filter((p) => p.v > 0);
  // Too many souls lying about: the oldest are gathered into one big one.
  if (n.pickups.length > 400) {
    const old = n.pickups.splice(0, n.pickups.length - 300).filter((p) => p.kind !== 'glowcap');
    if (old.length) n.pickups.push({ x: old[0].x, y: old[0].y, kind: 'bigsoul', v: old.reduce((a, p) => a + p.v, 0) });
  }
  while (n.xp >= xpToLevel(n.level)) {
    n.xp -= xpToLevel(n.level);
    n.level++;
    n.pendingLevels++;
  }
}

/** What a night pays, in Souls: one for every six put down, up to 500. */
export function nightSouls(n: Night): number {
  return Math.min(500, Math.floor(n.kills / 6));
}
