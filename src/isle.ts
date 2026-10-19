// Your Isle: a patch of land across the water from the graveyard, bought into with the
// Souls every run earns. Buy things, set them down anywhere, pick them back up. A few
// buildings help in Endless and the story (never the Daily). Other players can visit.
//
// Everything here is pure (it takes the isle to look at), so the same code draws your
// own isle and someone else's.

/** One placed thing: its id and the tile its top-left corner sits on. */
export type Placed = [string, number, number];

export interface IsleState {
  /** How much land is cleared: 0 the first clearing, up to LAND.length. */
  land: number;
  placed: Placed[];
  /** Things picked back up, waiting to be set down again for free. */
  stored: Record<string, number>;
  /** Last change, so the newest copy wins across devices. */
  at: number;
}

export const emptyIsle = (): IsleState => ({ land: 0, placed: [], stored: {}, at: 0 });

// ~ water  : the jetty path (never built on)  < the ferry back to the graveyard
// 0 1 2 land, cleared in that order (locked land is a thicket you can't walk through).
export const ISLE_MAP = [
  '~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~222222~~~~~~~',
  '~~~~~222111111222~~~~',
  '~~~~22111000011122~~~',
  '~~~2211000000001122~~',
  '~~~2110000000000112~~',
  '<:::::00000000001122~',
  '~~~2110000000000112~~',
  '~~~2211000000001122~~',
  '~~~~22111000011122~~~',
  '~~~~~222111111222~~~~',
  '~~~~~~~~222222~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~',
];
export const ISLE_W = ISLE_MAP[0].length;
export const ISLE_H = ISLE_MAP.length;
/** Where the ferry drops you. */
export const ISLE_DOCK = { x: 1, y: 6 };

/** Clearing more of the isle. */
export const LAND = [
  { name: 'Clear the Thicket', cost: 400, desc: 'Cut back the brambles: a ring of new land around your clearing.' },
  { name: 'Reclaim the Shore', cost: 1500, desc: 'Push the wilds back to the water. The whole isle is yours.' },
];

export type IsleCat = 'nature' | 'paths' | 'lights' | 'decor' | 'buildings' | 'perks';

export const ISLE_CATS: { id: IsleCat; name: string }[] = [
  { id: 'nature', name: '🌲 Nature' },
  { id: 'paths', name: '🪨 Paths' },
  { id: 'lights', name: '🕯️ Lights' },
  { id: 'decor', name: '🪦 Decor' },
  { id: 'buildings', name: '🏠 Buildings' },
  { id: 'perks', name: '✨ Perks' },
];

export interface IsleItem {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  cat: IsleCat;
  /** Footprint in tiles (1x1 unless said). */
  w?: number;
  h?: number;
  /** Can be walked over (paths, flowers). */
  walk?: boolean;
  /** At most this many on one isle. */
  max?: number;
  /** What a perk building does, shown in the shop. */
  perk?: string;
}

export const ISLE_ITEMS: IsleItem[] = [
  { id: 'pine', name: 'Dark Pine', emoji: '🌲', cost: 40, cat: 'nature' },
  { id: 'deadtree', name: 'Dead Tree', emoji: '🌳', cost: 30, cat: 'nature' },
  { id: 'bush', name: 'Thornbush', emoji: '🌿', cost: 20, cat: 'nature' },
  { id: 'rock', name: 'Mossy Rock', emoji: '🪨', cost: 15, cat: 'nature' },
  { id: 'lilies', name: 'Grave Lilies', emoji: '🌸', cost: 15, cat: 'nature', walk: true },
  { id: 'glowcaps', name: 'Glowcaps', emoji: '🍄', cost: 30, cat: 'nature', walk: true },
  { id: 'pumpkins', name: 'Pumpkin Patch', emoji: '🎃', cost: 35, cat: 'nature' },
  { id: 'pond', name: 'Still Pond', emoji: '💧', cost: 120, cat: 'nature', w: 2, h: 2 },

  { id: 'path', name: 'Stone Path', emoji: '🪨', cost: 5, cat: 'paths', walk: true },
  { id: 'boards', name: 'Boardwalk', emoji: '🪵', cost: 8, cat: 'paths', walk: true },
  { id: 'fence', name: 'Iron Fence', emoji: '🚧', cost: 10, cat: 'paths' },
  { id: 'hedge', name: 'Hedge', emoji: '🟩', cost: 12, cat: 'paths' },

  { id: 'lamp', name: 'Lamp Post', emoji: '🏮', cost: 60, cat: 'lights' },
  { id: 'candles', name: 'Candle Cluster', emoji: '🕯️', cost: 35, cat: 'lights' },
  { id: 'brazier', name: 'Brazier', emoji: '🔥', cost: 120, cat: 'lights' },
  { id: 'fireflies', name: 'Firefly Jar', emoji: '✨', cost: 80, cat: 'lights' },

  { id: 'grave', name: 'Headstone', emoji: '🪦', cost: 40, cat: 'decor' },
  { id: 'bench', name: 'Bench', emoji: '🪑', cost: 50, cat: 'decor' },
  { id: 'scarecrow', name: 'Scarecrow', emoji: '🧑‍🌾', cost: 90, cat: 'decor' },
  { id: 'cauldron', name: 'Cauldron', emoji: '🫕', cost: 150, cat: 'decor' },
  { id: 'banner', name: 'Banner', emoji: '🚩', cost: 100, cat: 'decor' },
  { id: 'statue', name: 'Angel Statue', emoji: '👼', cost: 250, cat: 'decor' },
  { id: 'fountain', name: 'Fountain', emoji: '⛲', cost: 600, cat: 'decor', w: 2, h: 2 },

  { id: 'shack', name: "Fisher's Shack", emoji: '🛖', cost: 400, cat: 'buildings', w: 3, h: 2 },
  { id: 'cottage', name: 'Cottage', emoji: '🏠', cost: 800, cat: 'buildings', w: 3, h: 2 },
  { id: 'windmill', name: 'Windmill', emoji: '🌬️', cost: 900, cat: 'buildings', w: 2, h: 2 },
  { id: 'mausoleum', name: 'Mausoleum', emoji: '🏛️', cost: 1000, cat: 'buildings', w: 3, h: 2 },
  { id: 'tower', name: "Wizard's Tower", emoji: '🗼', cost: 1200, cat: 'buildings', w: 2, h: 2 },

  { id: 'soulwell', name: 'Soul Well', emoji: '🌀', cost: 1200, cat: 'perks', w: 2, h: 2, max: 1, perk: '+10% Souls from Endless and story runs.' },
  { id: 'hut', name: "Healer's Hut", emoji: '🌿', cost: 1500, cat: 'perks', w: 3, h: 2, max: 1, perk: '+1 max HP in Endless and story runs.' },
  { id: 'shrine', name: 'Bone Shrine', emoji: '💀', cost: 4000, cat: 'perks', w: 2, h: 2, max: 1, perk: '+1 more max HP in Endless and story runs.' },
];

export const ISLE_ITEM = Object.fromEntries(ISLE_ITEMS.map((i) => [i.id, i])) as Record<string, IsleItem>;

const size = (it: IsleItem) => ({ w: it.w ?? 1, h: it.h ?? 1 });

/** Read an isle from saved data, dropping anything unknown or off the land. */
export function cleanIsle(raw: unknown): IsleState {
  const r = (raw ?? {}) as Partial<IsleState>;
  const land = Math.max(0, Math.min(LAND.length, Number(r.land) || 0));
  const stored: Record<string, number> = {};
  for (const [id, n] of Object.entries(r.stored ?? {})) if (ISLE_ITEM[id] && Number(n) > 0) stored[id] = Math.floor(Number(n));
  const isle: IsleState = { land, placed: [], stored, at: Number(r.at) || 0 };
  for (const p of Array.isArray(r.placed) ? r.placed : []) {
    if (!Array.isArray(p)) continue;
    const [id, x, y] = [String(p[0]), Number(p[1]), Number(p[2])];
    if (ISLE_ITEM[id] && fits(isle, id, x, y)) isle.placed.push([id, x, y]);
  }
  return isle;
}

/** The tile's ground: '~', ':', '<' or the land tier as a number. */
export function ground(x: number, y: number): string {
  return x < 0 || y < 0 || x >= ISLE_W || y >= ISLE_H ? '~' : ISLE_MAP[y][x];
}

/** Land that's been cleared and can be built on. */
export function buildable(isle: IsleState, x: number, y: number): boolean {
  const g = ground(x, y);
  return g >= '0' && g <= '2' && Number(g) <= isle.land;
}

/** Index into `placed` of whatever covers this tile, or -1. */
export function itemAt(isle: IsleState, x: number, y: number): number {
  for (let i = isle.placed.length - 1; i >= 0; i--) {
    const [id, px, py] = isle.placed[i];
    const { w, h } = size(ISLE_ITEM[id]);
    if (x >= px && y >= py && x < px + w && y < py + h) return i;
  }
  return -1;
}

/** Whether a thing fits with its corner here: all on cleared land, clear of everything else. */
export function fits(isle: IsleState, id: string, x: number, y: number): boolean {
  const it = ISLE_ITEM[id];
  if (!it) return false;
  const { w, h } = size(it);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (!buildable(isle, x + dx, y + dy) || itemAt(isle, x + dx, y + dy) >= 0) return false;
    }
  }
  return true;
}

/** Can't walk here: water, the thicket, or something solid. */
export function isleSolid(isle: IsleState, x: number, y: number): boolean {
  const g = ground(x, y);
  if (g === '~') return true;
  if (g === ':' || g === '<') return false;
  if (Number(g) > isle.land) return true;
  const i = itemAt(isle, x, y);
  return i >= 0 && !ISLE_ITEM[isle.placed[i][0]].walk;
}

/** How many of a thing the isle has, set down or stored. */
export function owned(isle: IsleState, id: string): number {
  return isle.placed.filter((p) => p[0] === id).length + (isle.stored[id] ?? 0);
}

export interface IslePerks {
  /** Extra max HP. */
  vigor: number;
  /** Extra share of Souls (0.1 = +10%). */
  souls: number;
}

/** What the isle's buildings do. Only buildings set down count. */
export function islePerks(isle: IsleState): IslePerks {
  const has = (id: string) => isle.placed.some((p) => p[0] === id);
  return { vigor: (has('hut') ? 1 : 0) + (has('shrine') ? 1 : 0), souls: has('soulwell') ? 0.1 : 0 };
}

// ---------- drawing ----------

export type Px = (x: number, y: number, w: number, h: number, c: string) => void;
const T = 16;

/** Water, sand, grass, the thicket and the jetty. */
export function drawIsleGround(ctx: CanvasRenderingContext2D, px: Px, isle: IsleState, t: number) {
  for (let y = 0; y < ISLE_H; y++) {
    for (let x = 0; x < ISLE_W; x++) {
      const g = ground(x, y);
      const X = x * T;
      const Y = y * T;
      const n = (x * 7 + y * 13) % 5;
      if (g === '~') {
        px(X, Y, T, T, '#0c1a24');
        const w = Math.sin(t * 2 + x * 0.9 + y) > 0 ? 1 : 0;
        px(X + 2 + w, Y + 5, 5, 1, '#1a3d52');
        px(X + 8 - w, Y + 11, 5, 1, '#1a3d52');
        // foam where water meets land
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const o = ground(x + dx, y + dy);
          if (o >= '0' && o <= '2') {
            ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2.5 + x + y);
            if (dy === -1) px(X, Y, T, 2, '#9fc8d8');
            if (dy === 1) px(X, Y + T - 2, T, 2, '#9fc8d8');
            if (dx === -1) px(X, Y, 2, T, '#9fc8d8');
            if (dx === 1) px(X + T - 2, Y, 2, T, '#9fc8d8');
            ctx.globalAlpha = 1;
          }
        }
      } else if (g === ':' || g === '<') {
        px(X, Y, T, T, '#0c1a24');
        px(X, Y + 3, T, 10, '#5a4030');
        for (const bx of [0, 5, 10, 15]) px(X + bx, Y + 3, 1, 10, '#3a2818');
        px(X, Y + 12, T, 1, '#2a1c12');
        if (x % 3 === 1) px(X + 2, Y + 13, 2, 3, '#3a2818');
      } else if (Number(g) > isle.land) {
        // the thicket: dark brambles, too thick to walk through
        px(X, Y, T, T, '#0f1411');
        px(X + 1 + n, Y + 2, 6, 5, '#18241b');
        px(X + 7, Y + 8 - (n % 3), 7, 6, '#18241b');
        px(X + 3, Y + 4 + n, 1, 3, '#3a2a2a');
        px(X + 11 - n, Y + 9, 1, 3, '#3a2a2a');
      } else {
        const shore = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => ground(x + dx, y + dy) === '~');
        px(X, Y, T, T, shore ? '#2a2a22' : n % 2 ? '#16211a' : '#18241c');
        if (shore) {
          px(X + 3 + n, Y + 4, 2, 1, '#3a3a2e');
          px(X + 10 - n, Y + 11, 2, 1, '#3a3a2e');
        } else {
          if (n === 0) px(X + 4, Y + 10, 1, 2, '#2c4a33');
          if (n === 3) px(X + 11, Y + 5, 1, 2, '#2c4a33');
        }
      }
    }
  }
}

/** Every placed thing, back to front so taller ones overlap what's behind them. */
export function drawIsleItems(ctx: CanvasRenderingContext2D, px: Px, isle: IsleState, t: number) {
  const order = isle.placed.map((p, i) => ({ p, i })).sort((a, b) => {
    const ha = size(ISLE_ITEM[a.p[0]]).h;
    const hb = size(ISLE_ITEM[b.p[0]]).h;
    const wa = ISLE_ITEM[a.p[0]].walk ? 0 : 1;
    const wb = ISLE_ITEM[b.p[0]].walk ? 0 : 1;
    return wa - wb || a.p[2] + ha - (b.p[2] + hb) || a.i - b.i;
  });
  for (const { p } of order) drawIsleItem(ctx, px, p[0], p[1] * T, p[2] * T, t);
}

/** Draw one thing with its top-left at (X, Y) in pixels. */
export function drawIsleItem(ctx: CanvasRenderingContext2D, px: Px, id: string, X: number, Y: number, t: number) {
  const glow = (cx: number, cy: number, r: number, c: string) => {
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  const flick = Math.sin(t * 9 + X) > 0 ? 1 : 0;
  switch (id) {
    case 'pine':
      px(X + 7, Y + 12, 2, 4, '#2a1c12');
      px(X + 6, Y + 1, 4, 3, '#1f3a2a');
      px(X + 4, Y + 4, 8, 3, '#1f3a2a');
      px(X + 3, Y + 7, 10, 3, '#183026');
      px(X + 2, Y + 10, 12, 2, '#183026');
      px(X + 7, Y + 2, 1, 8, '#2c4a36');
      break;
    case 'deadtree':
      px(X + 7, Y + 4, 2, 12, '#2a2018');
      px(X + 3, Y + 5, 4, 1, '#2a2018');
      px(X + 3, Y + 3, 1, 2, '#2a2018');
      px(X + 9, Y + 7, 4, 1, '#2a2018');
      px(X + 12, Y + 4, 1, 3, '#2a2018');
      px(X + 6, Y + 1, 1, 3, '#2a2018');
      break;
    case 'bush':
      px(X + 2, Y + 7, 12, 8, '#1f3a2a');
      px(X + 4, Y + 5, 8, 3, '#1f3a2a');
      px(X + 4, Y + 8, 2, 2, '#2c4a36');
      px(X + 10, Y + 10, 2, 2, '#2c4a36');
      px(X + 7, Y + 7, 1, 1, '#d23a46');
      px(X + 11, Y + 7, 1, 1, '#d23a46');
      break;
    case 'rock':
      px(X + 3, Y + 7, 10, 7, '#4b4259');
      px(X + 5, Y + 5, 6, 2, '#4b4259');
      px(X + 4, Y + 6, 5, 2, '#3f5a3a');
      px(X + 3, Y + 13, 10, 1, '#2f2838');
      break;
    case 'lilies':
      for (const [fx, fy] of [[3, 4], [10, 3], [6, 9], [12, 11], [2, 12]]) {
        px(X + fx, Y + fy + 2, 1, 2, '#2c4a36');
        px(X + fx - 1, Y + fy, 3, 2, '#e8dcc4');
        px(X + fx, Y + fy, 1, 1, '#f2c14e');
      }
      break;
    case 'glowcaps':
      for (const [fx, fy] of [[3, 8], [9, 5], [11, 11]]) {
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2 + fx);
        px(X + fx - 2, Y + fy - 2, 7, 6, '#5fe3ff');
        ctx.globalAlpha = 1;
        px(X + fx + 1, Y + fy + 2, 1, 3, '#c9c3b2');
        px(X + fx - 1, Y + fy, 5, 2, '#5fe3ff');
      }
      break;
    case 'pumpkins':
      for (const [fx, fy] of [[2, 8], [9, 6], [6, 11]]) {
        px(X + fx, Y + fy, 6, 4, '#c4501c');
        px(X + fx + 1, Y + fy - 1, 4, 1, '#c4501c');
        px(X + fx + 2, Y + fy, 1, 4, '#8a3412');
        px(X + fx + 2, Y + fy - 2, 1, 1, '#2c4a36');
      }
      break;
    case 'pond':
      px(X + 3, Y + 3, 26, 26, '#2a2a22');
      px(X + 5, Y + 5, 22, 22, '#10202c');
      px(X + 2, Y + 8, 28, 16, '#2a2a22');
      px(X + 4, Y + 9, 24, 14, '#10202c');
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 1.5);
      px(X + 9, Y + 12, 6, 1, '#1f4a63');
      px(X + 17, Y + 19, 6, 1, '#1f4a63');
      ctx.globalAlpha = 1;
      px(X + 18, Y + 10, 5, 3, '#2c4a36');
      px(X + 20, Y + 9, 1, 1, '#e8dcc4');
      break;
    case 'path':
      px(X, Y, T, T, '#2a2433');
      px(X + 1, Y + 1, 6, 6, '#3a3346');
      px(X + 9, Y + 2, 6, 5, '#3a3346');
      px(X + 2, Y + 9, 5, 6, '#3a3346');
      px(X + 9, Y + 9, 6, 6, '#3a3346');
      break;
    case 'boards':
      px(X, Y, T, T, '#5a4030');
      for (const by of [0, 5, 10, 15]) px(X, Y + by, T, 1, '#3a2818');
      break;
    case 'fence':
      px(X, Y + 5, T, 2, '#3a3346');
      px(X, Y + 11, T, 2, '#3a3346');
      for (const bx of [2, 7, 12]) {
        px(X + bx, Y + 2, 2, 13, '#4b4259');
        px(X + bx, Y + 1, 2, 1, '#6b6680');
      }
      break;
    case 'hedge':
      px(X, Y + 3, T, 12, '#183026');
      px(X + 1, Y + 2, 14, 2, '#1f3a2a');
      px(X + 3, Y + 6, 2, 2, '#2c4a36');
      px(X + 10, Y + 9, 2, 2, '#2c4a36');
      break;
    case 'lamp':
      glow(X + 8, Y + 3, 26, 'rgba(255,200,110,0.3)');
      px(X + 7, Y + 5, 2, 10, '#2a2433');
      px(X + 5, Y + 14, 6, 2, '#2a2433');
      px(X + 5, Y, 6, 5, '#2a2433');
      px(X + 6, Y + 1, 4, 3, flick ? '#f2c14e' : '#ffd77a');
      break;
    case 'candles':
      glow(X + 8, Y + 8, 18, 'rgba(255,190,90,0.25)');
      for (const [cx, h] of [[3, 6], [7, 9], [11, 5]]) {
        px(X + cx, Y + 15 - h, 2, h, '#e8dcc4');
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 8 + cx);
        px(X + cx, Y + 13 - h, 2, 2, '#f2c14e');
        ctx.globalAlpha = 1;
      }
      break;
    case 'brazier':
      glow(X + 8, Y + 5, 32, 'rgba(255,140,60,0.35)');
      px(X + 3, Y + 7, 10, 3, '#4b4259');
      px(X + 5, Y + 10, 6, 2, '#3a3346');
      px(X + 7, Y + 12, 2, 4, '#3a3346');
      px(X + 4, Y + 3 - flick, 8, 4 + flick, '#ff8a2a');
      px(X + 6, Y + 4, 4, 3, '#f2c14e');
      break;
    case 'fireflies':
      glow(X + 8, Y + 8, 20, 'rgba(181,224,122,0.25)');
      px(X + 4, Y + 4, 8, 11, 'rgba(159,232,255,0.25)');
      px(X + 4, Y + 3, 8, 1, '#8a857a');
      px(X + 5, Y + 2, 6, 1, '#6b4a2a');
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i * 2);
        px(X + 5 + ((i * 3 + Math.floor(t * 2)) % 6), Y + 6 + ((i * 5) % 7), 1, 1, '#b5e07a');
      }
      ctx.globalAlpha = 1;
      break;
    case 'grave':
      px(X + 4, Y + 4, 8, 10, '#4b4259');
      px(X + 5, Y + 3, 6, 1, '#4b4259');
      px(X + 6, Y + 6, 4, 1, '#2f2838');
      px(X + 7, Y + 5, 2, 5, '#2f2838');
      px(X + 3, Y + 14, 10, 1, '#0b0710');
      break;
    case 'bench':
      px(X + 1, Y + 6, 14, 2, '#6b4a2a');
      px(X + 1, Y + 9, 14, 2, '#6b4a2a');
      px(X + 2, Y + 11, 2, 4, '#2a2433');
      px(X + 12, Y + 11, 2, 4, '#2a2433');
      break;
    case 'scarecrow':
      px(X + 7, Y + 4, 2, 12, '#3a2818');
      px(X + 2, Y + 6, 12, 2, '#3a2818');
      px(X + 5, Y + 7, 6, 6, '#5a3a5a');
      px(X + 6, Y + 1, 4, 4, '#c4a46a');
      px(X + 4, Y, 8, 2, '#2a2018');
      px(X + 6, Y + 2, 1, 1, '#07040b');
      px(X + 9, Y + 2, 1, 1, '#07040b');
      break;
    case 'cauldron': {
      px(X + 2, Y + 7, 12, 7, '#2a2433');
      px(X + 1, Y + 6, 14, 2, '#3a3346');
      px(X + 3, Y + 14, 2, 2, '#2a2433');
      px(X + 11, Y + 14, 2, 2, '#2a2433');
      px(X + 3, Y + 6, 10, 1, '#5fd36a');
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.7 + i / 2) % 1;
        ctx.globalAlpha = 0.6 * (1 - p);
        px(X + 5 + i * 4, Y + 4 - p * 6, 2, 2, '#b5e07a');
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'banner': {
      px(X + 3, Y, 2, 16, '#2a2433');
      const wave = Math.sin(t * 3) > 0 ? 1 : 0;
      px(X + 5, Y + 1, 8, 8, '#d23a46');
      px(X + 5, Y + 9, 3 + wave, 2, '#d23a46');
      px(X + 10 - wave, Y + 9, 3, 2, '#d23a46');
      px(X + 7, Y + 3, 4, 3, '#f2c14e');
      break;
    }
    case 'statue':
      px(X + 4, Y + 12, 8, 4, '#3a3346');
      px(X + 6, Y + 5, 4, 7, '#c9c3b2');
      px(X + 6, Y + 2, 4, 3, '#c9c3b2');
      px(X + 2, Y + 4, 4, 6, '#8a857a');
      px(X + 10, Y + 4, 4, 6, '#8a857a');
      px(X + 7, Y + 1, 2, 1, '#f2c14e');
      break;
    case 'fountain':
      px(X + 2, Y + 14, 28, 14, '#4b4259');
      px(X + 4, Y + 16, 24, 10, '#10202c');
      px(X + 13, Y + 6, 6, 14, '#5d667a');
      px(X + 10, Y + 5, 12, 3, '#4b4259');
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 3; i++) {
        const p = (t * 1.2 + i / 3) % 1;
        px(X + 15 - 8 * p, Y + 4 + p * 12, 1, 2, '#9fe8ff');
        px(X + 16 + 8 * p, Y + 4 + p * 12, 1, 2, '#9fe8ff');
      }
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(t * 2);
      px(X + 6, Y + 19, 20, 1, '#1f4a63');
      ctx.globalAlpha = 1;
      break;
    case 'shack':
      house(px, X, Y, 48, 32, '#4a3a2a', '#3a2818', false);
      px(X + 36, Y + 26, 10, 3, '#6b4a2a');
      px(X + 38, Y + 23, 1, 3, '#8a857a');
      px(X + 2, Y + 22, 6, 8, '#2a2018');
      break;
    case 'cottage':
      house(px, X, Y, 48, 32, '#4b4259', '#5a1622', true);
      chimney(ctx, px, X + 36, Y, t);
      break;
    case 'windmill': {
      px(X + 8, Y + 10, 16, 22, '#6b5a4a');
      for (let i = 0; i < 6; i++) px(X + 8 + i, Y + 10 - i, 16 - i * 2, 1, '#3a2818');
      px(X + 13, Y + 24, 6, 8, '#07040b');
      const a = t * 1.2;
      for (let k = 0; k < 4; k++) {
        const ang = a + (k * Math.PI) / 2;
        for (let r = 2; r < 14; r++) px(X + 16 + Math.cos(ang) * r, Y + 8 + Math.sin(ang) * r, 2, 2, '#c9c3b2');
      }
      px(X + 15, Y + 7, 3, 3, '#3a2818');
      break;
    }
    case 'mausoleum':
      px(X + 4, Y + 12, 40, 20, '#4b4259');
      px(X + 2, Y + 9, 44, 3, '#5d667a');
      for (let i = 0; i < 6; i++) px(X + 6 + i * 3, Y + 9 - i, 36 - i * 6, 1, '#5d667a');
      for (const cx of [8, 16, 30, 38]) px(X + cx, Y + 13, 3, 18, '#6b6680');
      px(X + 20, Y + 18, 8, 14, '#07040b');
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 2);
      px(X + 20, Y + 18, 8, 14, '#b07cff');
      ctx.globalAlpha = 1;
      break;
    case 'tower':
      px(X + 8, Y + 4, 16, 28, '#3a3346');
      for (let y = Y + 8; y < Y + 32; y += 5) px(X + 8, y, 16, 1, 'rgba(0,0,0,0.3)');
      for (let i = 0; i < 9; i++) px(X + 6 + i, Y + 4 - i, 20 - i * 2, 1, '#311854');
      px(X + 15, Y - 6, 2, 2, '#f2c14e');
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2.2);
      px(X + 14, Y + 10, 4, 5, '#b07cff');
      ctx.globalAlpha = 1;
      px(X + 13, Y + 24, 6, 8, '#07040b');
      break;
    case 'soulwell': {
      glow(X + 16, Y + 16, 30, 'rgba(159,232,255,0.3)');
      px(X + 4, Y + 10, 24, 18, '#4b4259');
      px(X + 7, Y + 13, 18, 12, '#07040b');
      const p = (t * 0.8) % 1;
      ctx.globalAlpha = 0.7;
      px(X + 10 + Math.cos(t * 3) * 4, Y + 18 + Math.sin(t * 3) * 2, 3, 3, '#9fe8ff');
      px(X + 18 - Math.cos(t * 3) * 4, Y + 18 - Math.sin(t * 3) * 2, 3, 3, '#5fe3ff');
      ctx.globalAlpha = 0.8 * (1 - p);
      px(X + 15, Y + 10 - p * 12, 2, 2, '#9fe8ff');
      ctx.globalAlpha = 1;
      px(X + 4, Y + 3, 2, 8, '#3a2818');
      px(X + 26, Y + 3, 2, 8, '#3a2818');
      px(X + 3, Y + 2, 26, 2, '#3a2818');
      break;
    }
    case 'hut':
      house(px, X, Y, 48, 32, '#5a4a3a', '#2c4a36', true);
      px(X + 8, Y + 22, 3, 7, '#c9c3b2');
      px(X + 6, Y + 24, 7, 3, '#c9c3b2');
      px(X + 7, Y + 25, 5, 1, '#d23a46');
      px(X + 9, Y + 23, 1, 5, '#d23a46');
      chimney(ctx, px, X + 34, Y, t, '#b5e07a');
      break;
    case 'shrine': {
      glow(X + 16, Y + 12, 34, 'rgba(242,193,78,0.25)');
      px(X + 4, Y + 24, 24, 8, '#3a3346');
      px(X + 8, Y + 8, 16, 16, '#d8cfb8');
      px(X + 6, Y + 6, 20, 3, '#e8dcc4');
      px(X + 11, Y + 12, 3, 3, '#07040b');
      px(X + 18, Y + 12, 3, 3, '#07040b');
      px(X + 14, Y + 17, 4, 2, '#07040b');
      for (const cx of [3, 27]) {
        px(X + cx, Y + 18, 2, 6, '#e8dcc4');
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 8 + cx);
        px(X + cx, Y + 16, 2, 2, '#f2c14e');
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 2);
      px(X + 11, Y + 12, 3, 3, '#f2c14e');
      px(X + 18, Y + 12, 3, 3, '#f2c14e');
      ctx.globalAlpha = 1;
      break;
    }
  }
}

function house(px: Px, X: number, Y: number, w: number, h: number, wall: string, roof: string, windows: boolean) {
  px(X + 2, Y + 12, w - 4, h - 12, wall);
  for (let y = Y + 16; y < Y + h; y += 5) px(X + 2, y, w - 4, 1, 'rgba(0,0,0,0.25)');
  for (let i = 0; i < 10; i++) px(X + i * 2, Y + 12 - i, w - i * 4, 1, roof);
  px(X, Y + 12, w, 2, roof);
  px(X + w / 2 - 4, Y + h - 11, 8, 11, '#07040b');
  px(X + w / 2 - 4, Y + h - 11, 8, 1, '#6b4a2a');
  if (windows) {
    px(X + 6, Y + 17, 6, 5, '#f2c14e');
    px(X + w - 12, Y + 17, 6, 5, '#f2c14e');
  }
}

function chimney(ctx: CanvasRenderingContext2D, px: Px, X: number, Y: number, t: number, smoke = '#8a857a') {
  px(X, Y + 1, 4, 6, '#3a2818');
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.4 + i / 3) % 1;
    ctx.globalAlpha = 0.4 * (1 - p);
    px(X + Math.sin(p * 5 + i) * 2, Y - p * 12, 3, 3, smoke);
  }
  ctx.globalAlpha = 1;
}

/** A small picture of a thing for the shop, drawn into its own canvas. */
export function isleIcon(id: string): string {
  const it = ISLE_ITEM[id];
  const { w, h } = size(it);
  const c = document.createElement('canvas');
  const s = Math.max(w, h);
  c.width = c.height = s * T * 2;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(2, 2);
  const px: Px = (x, y, ww, hh, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };
  drawIsleItem(ctx, px, id, ((s - w) * T) / 2, ((s - h) * T) / 2, 0.5);
  return c.toDataURL();
}
