// Grave Shift: keep the old plot behind Gravesend. Crops grow in real time while you're
// away, graves turn restless and the risen climb out to be put back down, and everything
// trades in Obols, the ferryman's coin (kept apart from the crypt's Souls).
//
// The rules here are pure: they take the state and the time, so they're easy to test.

export interface Plot {
  /** '' wild ground, 'tilled' ready for seed, or a crop id. */
  crop: string;
  /** When a planted crop is ready (ms). */
  ready: number;
  /** Total growing time, for drawing its stage. */
  grow: number;
  watered: boolean;
}

export interface GraveState {
  obols: number;
  plots: Plot[];
  /** Seeds ('seed:glowcap'), harvest ('glowcap') and drops ('ecto'). */
  inv: Record<string, number>;
  /** Each grave: when it next turns restless (ms). */
  graves: number[];
  /** Upgrade levels: the watering can, the spade (your weapon), and fields cleared. */
  can: number;
  spade: number;
  fields: number;
  /** Today's requests: which day, and which are done. */
  reqDay: string;
  reqDone: boolean[];
  /** Graves put to rest, for the record. */
  settled: number;
  /** Mortimer has shown you round. */
  met: boolean;
  /** Mortimer's first jobs, done. */
  jobsDone: JobId[];
  /** The Night Shift: nights stood, dawns seen, the longest night (seconds) and most kills. */
  nights: number;
  dawns: number;
  nightBest: number;
  nightKills: number;
  at: number;
}

// ---------- the map ----------
// # fence  T tree  : path  ^ road back to the graveyard  S Mortimer's shed (s its counter)
// p q r field plots (cleared in that order)  + graves
export const FARM_MAP = [
  '##########^##########',
  '#T..SSS...:.....T..T#',
  '#...SSS...:.........#',
  '#....s....:..+.+.+..#',
  '#:::::::::::........#',
  '#..........:........#',
  '#.ppppp.rr.:.+.+.+..#',
  '#.ppppp.rr.:........#',
  '#.ppppp.rr.:.+.+....#',
  '#.qqqqq.rr.:........#',
  '#.qqqqq.rr.:...T..T.#',
  '#T........:.....T...#',
  '#####################',
];
export const FARM_SPAWN = { x: 10, y: 1 };

/** Every plot tile, in reading order, with the field it belongs to (0, 1 or 2). */
export const PLOT_TILES: { x: number; y: number; field: number }[] = [];
/** Every grave tile, in reading order. */
export const GRAVE_TILES: { x: number; y: number }[] = [];
FARM_MAP.forEach((row, y) =>
  [...row].forEach((c, x) => {
    if (c === 'p' || c === 'q' || c === 'r') PLOT_TILES.push({ x, y, field: 'pqr'.indexOf(c) });
    if (c === '+') GRAVE_TILES.push({ x, y });
  }),
);

export const plotAt = (x: number, y: number) => PLOT_TILES.findIndex((p) => p.x === x && p.y === y);
export const graveAt = (x: number, y: number) => GRAVE_TILES.findIndex((g) => g.x === x && g.y === y);

// ---------- crops ----------

export interface CropDef {
  id: string;
  name: string;
  emoji: string;
  /** Seed price and sale price, in Obols. */
  seed: number;
  sell: number;
  /** Real minutes to grow, before watering. */
  mins: number;
  color: string;
  /** Fields that must be cleared before Mortimer stocks the seed. */
  needs: number;
}

export const CROPS: CropDef[] = [
  { id: 'glowcap', name: 'Glowcap', emoji: '🍄', seed: 4, sell: 9, mins: 30, color: '#5fe3ff', needs: 0 },
  { id: 'nightshade', name: 'Nightshade', emoji: '🫐', seed: 8, sell: 19, mins: 60, color: '#7b5cff', needs: 0 },
  { id: 'bloodroot', name: 'Bloodroot', emoji: '🥕', seed: 14, sell: 35, mins: 120, color: '#d23a46', needs: 0 },
  { id: 'candlewheat', name: 'Candle-wheat', emoji: '🌾', seed: 18, sell: 48, mins: 180, color: '#f2c14e', needs: 1 },
  { id: 'pumpkin', name: 'Grave Pumpkin', emoji: '🎃', seed: 25, sell: 75, mins: 240, color: '#e67e22', needs: 1 },
  { id: 'moonflower', name: 'Moonflower', emoji: '🌸', seed: 40, sell: 130, mins: 480, color: '#e8dcc4', needs: 2 },
];
export const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c])) as Record<string, CropDef>;

/** What a harvest or drop sells for. */
export const SELL: Record<string, number> = { ...Object.fromEntries(CROPS.map((c) => [c.id, c.sell])), ecto: 10 };
export const ITEM_NAME: Record<string, string> = { ...Object.fromEntries(CROPS.map((c) => [c.id, c.name])), ecto: 'Ectoplasm' };
export const ITEM_EMOJI: Record<string, string> = { ...Object.fromEntries(CROPS.map((c) => [c.id, c.emoji])), ecto: '👻' };

// ---------- upgrades ----------

/** Watering takes this share off the time left (by watering-can level). */
export const CAN_CUT = [0.3, 0.45, 0.6];
export const CAN_COST = [0, 300, 900];
/** Spade damage per swing, and its price, by level. */
export const SPADE_DMG = [1, 2, 3];
export const SPADE_COST = [0, 250, 800];
export const FIELD_COST = [0, 400, 1200];
export const FIELD_NAME = ['', 'Clear the south rows', 'Clear the east strip'];

const HOUR = 3_600_000;
const MIN = 60_000;

export function newGraveState(now: number): GraveState {
  return {
    obols: 30,
    plots: PLOT_TILES.map(() => ({ crop: '', ready: 0, grow: 0, watered: false })),
    inv: { 'seed:glowcap': 6, 'seed:nightshade': 2 },
    // Two graves are restless from the start, so there's something to settle straight away.
    graves: GRAVE_TILES.map((_, i) => (i < 2 ? now : now + (2 + i) * HOUR)),
    can: 0,
    spade: 0,
    fields: 0,
    reqDay: '',
    reqDone: [],
    settled: 0,
    met: false,
    jobsDone: [],
    nights: 0,
    dawns: 0,
    nightBest: 0,
    nightKills: 0,
    at: now,
  };
}

/** Read a saved state, filling anything missing. */
export function cleanGraveState(raw: unknown, now: number): GraveState {
  const fresh = newGraveState(now);
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<GraveState>;
  const plots = PLOT_TILES.map((_, i) => {
    const p = (Array.isArray(r.plots) ? r.plots[i] : null) as Partial<Plot> | null;
    if (!p || typeof p !== 'object') return fresh.plots[i];
    const crop = typeof p.crop === 'string' && (p.crop === '' || p.crop === 'tilled' || CROP_BY_ID[p.crop]) ? p.crop : '';
    return { crop, ready: Number(p.ready) || 0, grow: Number(p.grow) || 0, watered: p.watered === true };
  });
  const inv: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.inv ?? {})) if (Number(v) > 0) inv[k] = Math.floor(Number(v));
  const count = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  const level = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  return {
    obols: Math.max(0, Math.floor(Number(r.obols) || 0)),
    plots,
    inv,
    graves: GRAVE_TILES.map((_, i) => (Array.isArray(r.graves) ? Number(r.graves[i]) || now : fresh.graves[i])),
    can: level(r.can, CAN_CUT.length - 1),
    spade: level(r.spade, SPADE_DMG.length - 1),
    fields: level(r.fields, FIELD_COST.length - 1),
    reqDay: typeof r.reqDay === 'string' ? r.reqDay : '',
    reqDone: Array.isArray(r.reqDone) ? r.reqDone.map(Boolean) : [],
    settled: Math.max(0, Math.floor(Number(r.settled) || 0)),
    met: r.met === true,
    jobsDone: Array.isArray(r.jobsDone) ? JOBS.map((j) => j.id).filter((id) => r.jobsDone!.includes(id)) : [],
    nights: count(r.nights),
    dawns: count(r.dawns),
    nightBest: count(r.nightBest),
    nightKills: count(r.nightKills),
    at: Number(r.at) || 0,
  };
}

/** The night shift: 8pm to 6am on the player's own clock. More rise at night. */
export function isNight(now: number): boolean {
  const h = new Date(now).getHours();
  return h >= 20 || h < 6;
}

export const plotOpen = (s: GraveState, i: number) => PLOT_TILES[i].field <= s.fields;

/** How far a planted crop has come: 0 to 1. */
export function growth(p: Plot, now: number): number {
  if (!CROP_BY_ID[p.crop] || !p.grow) return 0;
  return Math.max(0, Math.min(1, 1 - (p.ready - now) / p.grow));
}

export const isRipe = (p: Plot, now: number) => Boolean(CROP_BY_ID[p.crop]) && now >= p.ready;

export type TapResult =
  | { did: 'till' | 'water' | 'locked' | 'growing' | 'noseed' }
  | { did: 'plant'; crop: string }
  | { did: 'harvest'; crop: string; n: number };

/**
 * One tap on a plot does the obvious thing: clear wild ground, plant the chosen seed,
 * water a thirsty crop, or harvest a ripe one.
 */
export function tapPlot(s: GraveState, i: number, seed: string, now: number): TapResult {
  const p = s.plots[i];
  if (!p || !plotOpen(s, i)) return { did: 'locked' };
  if (p.crop === '') {
    p.crop = 'tilled';
    s.at = now;
    return { did: 'till' };
  }
  if (p.crop === 'tilled') {
    const def = CROP_BY_ID[seed];
    if (!def || !(s.inv[`seed:${seed}`] > 0)) return { did: 'noseed' };
    take(s, `seed:${seed}`, 1);
    p.crop = seed;
    p.grow = def.mins * MIN;
    p.ready = now + p.grow;
    p.watered = false;
    s.at = now;
    return { did: 'plant', crop: seed };
  }
  if (isRipe(p, now)) {
    const crop = p.crop;
    // Watered crops sometimes give two.
    const n = p.watered && (i + Math.floor(p.ready / MIN)) % 3 === 0 ? 2 : 1;
    give(s, crop, n);
    p.crop = 'tilled';
    p.ready = 0;
    p.grow = 0;
    p.watered = false;
    s.at = now;
    return { did: 'harvest', crop, n };
  }
  if (!p.watered) {
    p.ready = now + (p.ready - now) * (1 - CAN_CUT[s.can]);
    p.watered = true;
    s.at = now;
    return { did: 'water' };
  }
  return { did: 'growing' };
}

export function give(s: GraveState, item: string, n: number) {
  s.inv[item] = (s.inv[item] ?? 0) + n;
}

export function take(s: GraveState, item: string, n: number): boolean {
  if ((s.inv[item] ?? 0) < n) return false;
  s.inv[item] -= n;
  if (!s.inv[item]) delete s.inv[item];
  return true;
}

export function buySeed(s: GraveState, crop: string, n: number, now: number): boolean {
  const def = CROP_BY_ID[crop];
  if (!def || def.needs > s.fields || s.obols < def.seed * n) return false;
  s.obols -= def.seed * n;
  give(s, `seed:${crop}`, n);
  s.at = now;
  return true;
}

/** Sell every crop and drop in the satchel. Returns the Obols made. */
export function sellAll(s: GraveState, now: number): number {
  let made = 0;
  for (const [item, n] of Object.entries(s.inv)) {
    if (SELL[item] === undefined) continue;
    made += SELL[item] * n;
    delete s.inv[item];
  }
  s.obols += made;
  if (made) s.at = now;
  return made;
}

export type Upgrade = 'can' | 'spade' | 'field';

export function upgradeCost(s: GraveState, u: Upgrade): number | null {
  const [level, costs] = u === 'can' ? [s.can, CAN_COST] : u === 'spade' ? [s.spade, SPADE_COST] : [s.fields, FIELD_COST];
  return level + 1 < costs.length ? costs[level + 1] : null;
}

export function buyUpgrade(s: GraveState, u: Upgrade, now: number): boolean {
  const cost = upgradeCost(s, u);
  if (cost === null || s.obols < cost) return false;
  s.obols -= cost;
  if (u === 'can') s.can++;
  else if (u === 'spade') s.spade++;
  else s.fields++;
  s.at = now;
  return true;
}

// ---------- graves and the risen ----------

export const isRestless = (s: GraveState, i: number, now: number) => now >= (s.graves[i] ?? Infinity);

/** A grave put back to rest: quiet for a few hours (fewer at night), and a little thanks. */
export function settleGrave(s: GraveState, i: number, now: number, roll: number): number {
  const hours = (isNight(now) ? 1.5 : 3) + roll * 3;
  s.graves[i] = now + hours * HOUR;
  s.settled++;
  const reward = 10 + Math.floor(roll * 10);
  s.obols += reward;
  s.at = now;
  return reward;
}

export interface Risen {
  kind: 'ghoul' | 'wraith';
  x: number;
  y: number;
  hp: number;
  /** Which grave they climbed out of. */
  grave: number;
}

/** How many climb out of a grave: two or three, one more at night. */
export function risenCount(now: number, roll: number): number {
  return 2 + (roll < 0.5 ? 0 : 1) + (isNight(now) ? 1 : 0);
}

// ---------- the request board ----------

export interface Request {
  item: string;
  n: number;
  reward: number;
}

/** Three requests a day, the same for everyone on that date. */
export function requestsFor(day: string, fields: number): Request[] {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h >>> 0) / 4294967296);
  const pool = [...CROPS.filter((c) => c.needs <= fields).map((c) => c.id), 'ecto'];
  const out: Request[] = [];
  for (let k = 0; k < 3; k++) {
    const item = pool[Math.floor(rand() * pool.length)];
    const n = item === 'ecto' ? 3 + Math.floor(rand() * 4) : 2 + Math.floor(rand() * 5);
    out.push({ item, n, reward: Math.round(SELL[item] * n * 1.6) });
  }
  return out;
}

/** Hand in a request: the goods for its reward. */
export function fillRequest(s: GraveState, day: string, k: number, now: number): boolean {
  const reqs = requestsFor(day, s.fields);
  if (s.reqDay !== day) {
    s.reqDay = day;
    s.reqDone = [];
  }
  const r = reqs[k];
  if (!r || s.reqDone[k] || !take(s, r.item, r.n)) return false;
  s.reqDone[k] = true;
  s.obols += r.reward;
  s.at = now;
  return true;
}

// ---------- Mortimer's first jobs ----------
// A short list that walks a new keeper through the plot, each paid in Obols. Done in any
// order; the panel shows the first one still to do. Finishing them all earns Mortimer's Cap.

export type JobId = 'till' | 'plant' | 'water' | 'settle' | 'harvest' | 'sell' | 'request';

export const JOBS: { id: JobId; text: string; pay: number }[] = [
  { id: 'till', text: 'Tap a plot of wild ground to clear it', pay: 5 },
  { id: 'plant', text: 'Tap it again to plant the seed in hand', pay: 5 },
  { id: 'water', text: 'Tap the seedling to water it: it grows faster', pay: 5 },
  { id: 'settle', text: 'Walk into a glowing grave and put the risen back down', pay: 15 },
  { id: 'harvest', text: 'Harvest a ripe crop (tap it when it glints)', pay: 10 },
  { id: 'sell', text: "Sell your satchel at Mortimer's shed", pay: 10 },
  { id: 'request', text: 'Fill a request on the board', pay: 20 },
];

/** The reward for finishing every job: a gift id, so it joins the Wardrobe like any other. */
export const JOBS_REWARD = 'grave:mortimercap';

/** Graves to settle for the title Keeper of the Old Plot (owned as the gift 'plotkeeper'). */
export const KEEPER_GRAVES = 25;
export const KEEPER_GIFT = 'plotkeeper';
/** The title The Unsleeping, for putting down this many in one Night Shift (owned as the gift 'sawdawn'). */
export const NIGHT_GIFT = 'sawdawn';
export const NIGHT_GIFT_KILLS = 1000;

/** Note something done. Pays the job's Obols the first time; true when it finishes the list. */
export function noteJob(s: GraveState, id: JobId): { pay: number; finished: boolean } | null {
  if (s.jobsDone.includes(id)) return null;
  const job = JOBS.find((j) => j.id === id);
  if (!job) return null;
  s.jobsDone.push(id);
  s.obols += job.pay;
  return { pay: job.pay, finished: s.jobsDone.length === JOBS.length };
}

/** The first job still to do, if any. */
export const nextJob = (s: GraveState) => JOBS.find((j) => !s.jobsDone.includes(j.id)) ?? null;

// ---------- Mortimer's wares ----------
// Cosmetics sold for Obols, the farm's own coin, so the plot pays into the crypt.
// Each is owned as a gift id ('grave:<id>'); the pieces themselves live in progression.ts.

export const WARES: { id: string; kind: 'look' | 'head' | 'aura'; price: number }[] = [
  { id: 'plotcoat', kind: 'look', price: 600 },
  { id: 'gourdhelm', kind: 'head', price: 700 },
  { id: 'scarecrowrags', kind: 'look', price: 900 },
  { id: 'fireflyswarm', kind: 'aura', price: 1500 },
];

// ---------- drawing ----------

type Px = (x: number, y: number, w: number, h: number, c: string) => void;
const T = 16;

/** A plot of earth and whatever grows in it. */
export function drawPlot(ctx: CanvasRenderingContext2D, px: Px, s: GraveState, i: number, now: number, t: number) {
  const { x, y } = PLOT_TILES[i];
  const X = x * T;
  const Y = y * T;
  const p = s.plots[i];
  if (!plotOpen(s, i)) {
    // overgrown with brambles: ground Mortimer has yet to clear
    px(X, Y, T, T, '#121813');
    for (const [bx, by] of [[2, 3], [9, 2], [5, 8], [11, 9], [3, 12]]) {
      px(X + bx, Y + by, 4, 3, '#24331f');
      px(X + bx + 1, Y + by - 1, 2, 1, '#2f4528');
      px(X + bx + 3, Y + by + 1, 1, 1, '#6b2a3a');
    }
    return;
  }
  if (p.crop === '') {
    // wild ground inside the field: rough earth, tufts and stones, edged so it reads as a plot
    px(X + 1, Y + 1, T - 2, T - 2, '#2a2016');
    px(X + 1, Y + 1, T - 2, 1, '#3a2c1e');
    px(X + 1, Y + T - 2, T - 2, 1, '#1a130c');
    for (const [bx, by] of [[3, 4], [10, 3], [6, 10], [11, 11]]) {
      px(X + bx, Y + by, 2, 3, '#3f5a32');
      px(X + bx + 1, Y + by - 1, 1, 1, '#5f8a4a');
    }
    px(X + 8, Y + 7, 2, 1, '#4b4259');
    return;
  }
  // tilled earth in furrows, darker once it's been watered
  px(X + 1, Y + 1, T - 2, T - 2, p.watered ? '#2e1e12' : '#4a3220');
  px(X + 1, Y + 1, T - 2, 1, p.watered ? '#3a2818' : '#5d4028');
  for (const fy of [4, 8, 12]) px(X + 2, Y + fy, T - 4, 1, p.watered ? '#1a120c' : '#2e1e12');
  if (p.watered) px(X + 12, Y + 12, 2, 1, '#5fa8ff');
  const def = CROP_BY_ID[p.crop];
  if (!def) return;
  const g = growth(p, now);
  const ripe = isRipe(p, now);
  if (!ripe && g < 0.34) {
    px(X + 7, Y + 8, 2, 4, '#3f6a4a');
    px(X + 5, Y + 7, 2, 2, '#5fa86a');
    return;
  }
  if (!ripe) {
    px(X + 7, Y + 5, 2, 8, '#3f6a4a');
    px(X + 4, Y + 6, 3, 3, '#5fa86a');
    px(X + 9, Y + 4, 3, 3, '#5fa86a');
    px(X + 7, Y + 3, 2, 2, def.color);
    return;
  }
  // ripe: the crop itself, with a glint to say it's ready
  drawCrop(px, def.id, X, Y);
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i);
  px(X + 12, Y + 1, 2, 2, '#fff2c0');
  ctx.globalAlpha = 1;
}

function drawCrop(px: Px, id: string, X: number, Y: number) {
  switch (id) {
    case 'glowcap':
      px(X + 6, Y + 8, 2, 5, '#c9c3b2');
      px(X + 3, Y + 5, 8, 3, '#5fe3ff');
      px(X + 5, Y + 4, 4, 1, '#9fe8ff');
      break;
    case 'nightshade':
      px(X + 7, Y + 4, 1, 8, '#3f6a4a');
      for (const [bx, by] of [[4, 6], [9, 5], [6, 9], [10, 9]]) px(X + bx, Y + by, 3, 3, '#7b5cff');
      break;
    case 'bloodroot':
      px(X + 5, Y + 2, 2, 4, '#3f6a4a');
      px(X + 8, Y + 2, 2, 4, '#3f6a4a');
      px(X + 5, Y + 6, 5, 7, '#d23a46');
      px(X + 6, Y + 13, 3, 2, '#8a1f2c');
      break;
    case 'candlewheat':
      for (const sx of [3, 7, 11]) {
        px(X + sx, Y + 5, 1, 9, '#a8894a');
        px(X + sx - 1, Y + 2, 3, 4, '#f2c14e');
      }
      px(X + 7, Y + 1, 1, 1, '#ff8a2a');
      break;
    case 'pumpkin':
      px(X + 2, Y + 6, 12, 8, '#e67e22');
      px(X + 4, Y + 5, 8, 1, '#e67e22');
      px(X + 6, Y + 6, 1, 8, '#c4601a');
      px(X + 9, Y + 6, 1, 8, '#c4601a');
      px(X + 7, Y + 3, 2, 3, '#3d6b2a');
      break;
    case 'moonflower':
      px(X + 7, Y + 7, 1, 7, '#3f6a4a');
      px(X + 4, Y + 3, 8, 5, '#e8dcc4');
      px(X + 6, Y + 2, 4, 7, '#e8dcc4');
      px(X + 7, Y + 5, 2, 2, '#f2c14e');
      break;
  }
}

/** A headstone: quiet with flowers, or restless and glowing. */
export function drawGrave(ctx: CanvasRenderingContext2D, px: Px, s: GraveState, i: number, now: number, t: number) {
  const { x, y } = GRAVE_TILES[i];
  const X = x * T;
  const Y = y * T;
  const restless = isRestless(s, i, now);
  if (restless) {
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3 + i);
    px(X + 1, Y + 1, 14, 15, '#5fd36a');
    ctx.globalAlpha = 1;
  }
  px(X + 4, Y + 3, 8, 11, restless ? '#5d667a' : '#4b4259');
  px(X + 5, Y + 2, 6, 1, restless ? '#5d667a' : '#4b4259');
  px(X + 7, Y + 4, 2, 6, '#2f2838');
  px(X + 5, Y + 6, 6, 2, '#2f2838');
  px(X + 2, Y + 14, 12, 2, restless ? '#3a2818' : '#2a1c12');
  if (restless) {
    // the earth heaves and green wisps rise
    for (let k = 0; k < 2; k++) {
      const p = (t * 0.7 + k / 2 + i * 0.3) % 1;
      ctx.globalAlpha = 1 - p;
      px(X + 4 + k * 7, Y + 12 - p * 14, 2, 2, '#b5e07a');
    }
    ctx.globalAlpha = 1;
  } else {
    px(X + 3, Y + 13, 2, 2, '#e8dcc4');
    px(X + 11, Y + 13, 2, 2, '#d23a46');
  }
}

/** The night sky's weight over the plot. */
export function drawNight(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
  if (!isNight(now)) return;
  ctx.fillStyle = 'rgba(10, 14, 40, 0.35)';
  ctx.fillRect(0, 0, w, h);
}
