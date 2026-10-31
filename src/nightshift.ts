// The Night Shift: Grave Shift's survival mode. The dead come at you from every side, in real
// time; you keep moving while your relics fight for you, and every level you pick a relic to
// add or sharpen. Hold out until dawn (ten minutes), with a boss at three, six and nine.
//
// This is the simulation alone (no drawing): advance it with step(), feeding it the direction
// you're holding. Positions are in tiles. It takes its own random source, so tests can pin it.

export type FoeKind = 'ghoul' | 'bat' | 'wraith' | 'brute' | 'imp' | 'boss' | 'abbot' | 'lich';

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
  /** Knocked back: a push still to apply. */
  kx: number;
  ky: number;
  /** Just hit, for the flash. */
  hitAt: number;
  boss: boolean;
}

export type Pickup = { x: number; y: number; kind: 'soul' | 'bigsoul' | 'glowcap' | 'ecto'; v: number };

export interface Dart { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; life: number; hit: number[] }
export interface Flame { x: number; y: number; until: number; r: number; dps: number }
/** Things to draw for a moment: a spade swing, a lightning strike, a bell's ring. */
export interface Flash { kind: 'swing' | 'bolt' | 'ring'; x: number; y: number; at: number; ang?: number; r?: number }

/** Relics in the Night Shift: weapons that fight on their own, and charms that help. */
export type RelicKind = 'spade' | 'skulls' | 'quiver' | 'ember' | 'storm' | 'frost' | 'bell' | 'heart' | 'boots' | 'magnet' | 'fang' | 'whetstone' | 'hourglass';

export interface NightRelic {
  id: RelicKind;
  name: string;
  emoji: string;
  weapon: boolean;
  /** What each level does, for the level-up choice (index = level reached, 1-5). */
  text: (level: number) => string;
}

export const MAX_LEVEL = 5;

export const NIGHT_RELICS: NightRelic[] = [
  { id: 'spade', name: "Gravedigger's Spade", emoji: '⛏️', weapon: true, text: (l) => (l === 1 ? 'Swings at whatever is in front of you.' : 'A wider, harder, faster swing.') },
  { id: 'skulls', name: 'Whirling Skulls', emoji: '💀', weapon: true, text: (l) => (l === 1 ? 'Two skulls circle you, striking what they touch.' : 'One more skull, and they hit harder.') },
  { id: 'quiver', name: 'Bone Quiver', emoji: '🏹', weapon: true, text: (l) => (l === 1 ? 'Fires a bone dart at the nearest foe.' : 'More darts, and they pierce.') },
  { id: 'ember', name: 'Ember Brand', emoji: '🔥', weapon: true, text: (l) => (l === 1 ? 'You leave burning ground behind you.' : 'Hotter flames that burn for longer.') },
  { id: 'storm', name: 'Storm Rune', emoji: '⚡', weapon: true, text: (l) => (l === 1 ? 'Lightning strikes a foe near you now and then.' : 'Strikes one more foe, harder and sooner.') },
  { id: 'frost', name: 'Frost Sigil', emoji: '❄️', weapon: true, text: (l) => (l === 1 ? 'A cold that slows and bites everything close to you.' : 'A wider, colder ring.') },
  { id: 'bell', name: 'Grave Bell', emoji: '🔔', weapon: true, text: (l) => (l === 1 ? 'Tolls now and then, throwing back everything near you.' : 'A louder toll that hits harder and more often.') },
  { id: 'heart', name: 'Iron Heart', emoji: '🫀', weapon: false, text: () => '+5 max health, and heal 5.' },
  { id: 'boots', name: 'Swift Boots', emoji: '🥾', weapon: false, text: () => 'Move 8% faster.' },
  { id: 'magnet', name: 'Grave Magnet', emoji: '🧲', weapon: false, text: () => 'Pull in souls from further away.' },
  { id: 'fang', name: 'Vampire Fang', emoji: '🦷', weapon: false, text: () => 'A chance to heal 1 on each kill.' },
  { id: 'whetstone', name: 'Whetstone', emoji: '🗡️', weapon: false, text: () => 'Everything hits 12% harder.' },
  { id: 'hourglass', name: 'Stopped Hourglass', emoji: '⏳', weapon: false, text: () => 'Weapons come round 8% sooner.' },
];
export const NIGHT_RELIC = Object.fromEntries(NIGHT_RELICS.map((r) => [r.id, r])) as Record<RelicKind, NightRelic>;

/** How long until dawn, in seconds. */
export const DAWN = 600;
/** Bosses rise at these times. */
export const BOSS_AT: [number, FoeKind][] = [[180, 'boss'], [360, 'abbot'], [540, 'lich']];
/** The field: a square of this many tiles a side. */
export const FIELD = 48;
const MAX_FOES = 240;

const STATS: Record<FoeKind, { hp: number; speed: number; dmg: number; r: number; xp: number }> = {
  ghoul: { hp: 4, speed: 1.5, dmg: 1, r: 0.35, xp: 1 },
  bat: { hp: 2, speed: 2.5, dmg: 1, r: 0.3, xp: 1 },
  wraith: { hp: 8, speed: 1.4, dmg: 2, r: 0.35, xp: 2 },
  brute: { hp: 24, speed: 1.0, dmg: 3, r: 0.55, xp: 5 },
  imp: { hp: 7, speed: 2.3, dmg: 2, r: 0.35, xp: 2 },
  boss: { hp: 320, speed: 1.2, dmg: 5, r: 1.0, xp: 40 },
  abbot: { hp: 700, speed: 1.3, dmg: 6, r: 1.0, xp: 60 },
  lich: { hp: 1300, speed: 1.4, dmg: 7, r: 1.0, xp: 90 },
};

export interface Night {
  t: number;
  x: number;
  y: number;
  /** Which way you last moved, for the spade. */
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
  flashes: Flash[];
  kills: number;
  ecto: number;
  /** Next time each weapon fires. */
  next: Partial<Record<RelicKind, number>>;
  nextId: number;
  spawnDebt: number;
  bossesRisen: number;
  over: 'dawn' | 'dead' | null;
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
    flashes: [],
    kills: 0,
    ecto: 0,
    next: {},
    nextId: 1,
    spawnDebt: 0,
    bossesRisen: 0,
    over: null,
    rand,
  };
}

const lv = (n: Night, r: RelicKind) => n.relics[r] ?? 0;
/** Souls needed to go from this level to the next. */
export const xpToLevel = (level: number) => 2 + level * 3 + Math.floor((level * level) / 8);
const dmgMul = (n: Night) => 1 + 0.12 * lv(n, 'whetstone');
const cdMul = (n: Night) => 1 - 0.08 * lv(n, 'hourglass');
export const pickupRadius = (n: Night) => 1.3 + 1.2 * lv(n, 'magnet');
export const playerSpeed = (n: Night) => 4 * (1 + 0.08 * lv(n, 'boots'));
export const skullCount = (n: Night) => (lv(n, 'skulls') ? 1 + lv(n, 'skulls') : 0);
export const frostRadius = (n: Night) => (lv(n, 'frost') ? 1.6 + 0.3 * lv(n, 'frost') : 0);
export const PLAYER_R = 0.35;

/** Three choices for a level-up: relics you can still add or sharpen. */
export function levelChoices(n: Night): RelicKind[] {
  const weapons = NIGHT_RELICS.filter((r) => r.weapon && lv(n, r.id) > 0).length;
  const open = NIGHT_RELICS.filter((r) => lv(n, r.id) < MAX_LEVEL && (lv(n, r.id) > 0 || !r.weapon || weapons < 5));
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
  const spot = at ?? edgeSpot(n);
  const { x, y } = spot;
  // They grow tougher as the night wears on.
  const boss = kind === 'boss' || kind === 'abbot' || kind === 'lich';
  const hp = Math.round(s.hp * (boss ? 1 : 1 + n.t / 150 + (n.t / 400) ** 2));
  n.foes.push({ id: n.nextId++, kind, x, y, hp, maxHp: hp, speed: s.speed, dmg: s.dmg + (boss ? 0 : Math.floor(n.t / 200)), r: s.r, xp: s.xp, slowUntil: 0, skullAt: 0, kx: 0, ky: 0, hitAt: -1, boss });
}

/** Which of the dead come at this point in the night. */
function pickKind(n: Night): FoeKind {
  const t = n.t;
  const table: [FoeKind, number][] = [
    ['ghoul', 10],
    ['bat', t > 30 ? 6 : 0],
    ['wraith', t > 120 ? 4 : 0],
    ['brute', t > 240 ? 2 + t / 200 : 0],
    ['imp', t > 360 ? 4 : 0],
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
    if (f.kind === 'wraith' && n.rand() < 0.25) n.pickups.push({ x: f.x + 0.3, y: f.y, kind: 'ecto', v: 1 });
    if (f.boss) {
      n.pickups.push({ x: f.x + 0.6, y: f.y, kind: 'glowcap', v: 10 }, { x: f.x - 0.6, y: f.y, kind: 'ecto', v: 3 });
    } else if (n.rand() < 0.012) n.pickups.push({ x: f.x, y: f.y + 0.3, kind: 'glowcap', v: 5 });
    if (lv(n, 'fang') && n.rand() < 0.05 * lv(n, 'fang')) n.hp = Math.min(n.maxHp, n.hp + 1);
  }
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

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

  // ---- the dead arrive ----
  // More every minute, and the last before dawn is the worst.
  const rate = (1.5 + (n.t / 60) * 0.8) * (n.t > DAWN - 60 ? 1.6 : 1);
  n.spawnDebt += rate * dt;
  while (n.spawnDebt >= 1) {
    n.spawnDebt--;
    if (n.foes.length < MAX_FOES) spawn(n, pickKind(n));
  }
  for (const [at, kind] of BOSS_AT) {
    if (n.t >= at && n.bossesRisen < BOSS_AT.findIndex(([a]) => a === at) + 1) {
      n.bossesRisen++;
      spawn(n, kind);
    }
  }
  // Halfway through, a ring of bats closes in from all round.
  if (n.t >= 300 && n.t - dt < 300) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
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

  // The spade: an arc toward the nearest foe in reach (or the way you're going).
  if (ready('spade', Math.max(0.45, 1.05 - 0.12 * L('spade')))) {
    const reach = 1.5 + 0.2 * L('spade');
    const half = ((55 + 10 * L('spade')) * Math.PI) / 180;
    let target: Foe | null = null;
    for (const f of n.foes) if (near(n, f) < reach + f.r + 0.5 && (!target || near(n, f) < near(n, target))) target = f;
    const facing = target ? Math.atan2(target.y - n.y, target.x - n.x) : Math.atan2(n.fy, n.fx);
    n.flashes.push({ kind: 'swing', x: n.x, y: n.y, at: n.t, ang: facing, r: reach });
    for (const f of n.foes) {
      const d = near(n, f);
      if (d > reach + f.r) continue;
      let diff = Math.abs(Math.atan2(f.y - n.y, f.x - n.x) - facing);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff <= half || d < 0.6) {
        hurtFoe(n, f, 4 + 2 * L('spade'));
        f.kx += ((f.x - n.x) / (d || 1)) * 0.5;
        f.ky += ((f.y - n.y) / (d || 1)) * 0.5;
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
    const targets = [...n.foes].filter((f) => f.hp > 0).sort((a, b) => near(n, a) - near(n, b)).slice(0, Math.min(4, Math.ceil(L('quiver') / 1.5)));
    for (const f of targets) {
      const d = near(n, f) || 1;
      n.darts.push({ x: n.x, y: n.y, vx: ((f.x - n.x) / d) * 10, vy: ((f.y - n.y) / d) * 10, dmg: 4 + L('quiver'), pierce: Math.floor(L('quiver') / 2), life: 1.2, hit: [] });
    }
  }
  for (const d of n.darts) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.life -= dt;
    for (const f of n.foes) {
      if (f.hp <= 0 || d.hit.includes(f.id) || Math.hypot(f.x - d.x, f.y - d.y) > f.r + 0.15) continue;
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
  if (ready('ember', 0.35)) n.flames.push({ x: n.x, y: n.y, until: n.t + 1.6 + 0.4 * L('ember'), r: 0.6 + 0.05 * L('ember'), dps: 4 + 2 * L('ember') });
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

  // Frost: a ring of cold that slows and bites.
  const fr = frostRadius(n);
  if (fr) for (const f of n.foes) if (near(n, f) < fr + f.r) {
    f.slowUntil = n.t + 0.2;
    hurtFoe(n, f, (1 + L('frost')) * dt);
  }

  // The bell: a toll that throws everything back.
  if (ready('bell', Math.max(1.6, 4 - 0.45 * L('bell')))) {
    const r = 2.4 + 0.4 * L('bell');
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
    if (f.kx || f.ky) {
      f.x += f.kx * Math.min(1, dt * 10);
      f.y += f.ky * Math.min(1, dt * 10);
      f.kx *= 0.8;
      f.ky *= 0.8;
      if (Math.abs(f.kx) + Math.abs(f.ky) < 0.02) f.kx = f.ky = 0;
    }
    let d = near(n, f) || 1;
    // Left far behind: it comes round again from out of sight.
    if (d > 15 && !f.boss) {
      Object.assign(f, edgeSpot(n));
      d = near(n, f) || 1;
    }
    const slow = f.slowUntil > n.t ? 1 - (0.3 + 0.05 * L('frost')) : 1;
    // Bats weave as they come.
    const wob = f.kind === 'bat' ? Math.sin(n.t * 6 + f.id) * 0.6 : 0;
    const ux = (n.x - f.x) / d;
    const uy = (n.y - f.y) / d;
    f.x += (ux - uy * wob) * f.speed * slow * dt;
    f.y += (uy + ux * wob) * f.speed * slow * dt;
    if (d < f.r + PLAYER_R && n.t >= n.hurtUntil) {
      n.hp -= f.dmg;
      n.hurtUntil = n.t + 0.75;
    }
  }
  n.foes = n.foes.filter((f) => f.hp > 0);
  shoulder(n);
  if (n.hp <= 0) {
    n.hp = 0;
    n.over = 'dead';
    return;
  }

  // ---- pickups ----
  const pull = pickupRadius(n);
  for (const p of n.pickups) {
    const d = near(n, p);
    if (d < pull) {
      // drawn in, faster the closer it gets
      const k = Math.min(1, (dt * 9) / Math.max(0.3, d));
      p.x += (n.x - p.x) * k;
      p.y += (n.y - p.y) * k;
    }
    if (near(n, p) < 0.45) {
      if (p.kind === 'soul' || p.kind === 'bigsoul') n.xp += p.v;
      else if (p.kind === 'glowcap') n.hp = Math.min(n.maxHp, n.hp + p.v);
      else n.ecto += p.v;
      p.v = 0;
    }
  }
  n.pickups = n.pickups.filter((p) => p.v > 0);
  while (n.xp >= xpToLevel(n.level)) {
    n.xp -= xpToLevel(n.level);
    n.level++;
    n.pendingLevels++;
  }

  if (n.t >= DAWN) n.over = 'dawn';
}

/** What a night pays, in Obols: kills and time, with a bonus for seeing the dawn. */
export function nightPay(n: Night): number {
  return Math.min(600, Math.floor(n.kills / 4) + Math.floor(n.t / 6) + (n.over === 'dawn' ? 150 : 0));
}
