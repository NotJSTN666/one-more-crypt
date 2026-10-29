// The look of the world above the crypt: textured ground, trees, graves and fences, and
// the night-time light that sits over it all. Drawing only; hollow.ts decides what's where.

export type Px = (x: number, y: number, w: number, h: number, c: string) => void;

const TILE = 16;

/** A steady 0..1 number for a spot, so the ground looks the same every visit. */
export function hash(x: number, y: number, k = 0): number {
  let n = (x * 374761393 + y * 668265263 + k * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** How an outdoor area's ground is coloured. */
export interface Ground {
  grass: [string, string, string];
  blade: string;
  tip: string;
  flowers: string[];
  path: [string, string, string];
  /** Laid over everything at night, and the colour of the low fog. */
  tint: string;
  fog: string;
  /** Mostly dead trees, or mostly dark yews. */
  yews: number;
}

const BASE: Ground = {
  grass: ['#141a16', '#161d18', '#181f1a'],
  blade: '#24322a',
  tip: '#33473a',
  flowers: ['#c9c3b2', '#9a8bab'],
  path: ['#332c3e', '#2e2838', '#1c1823'],
  tint: 'rgba(14, 12, 40, 0.2)',
  fog: '170, 165, 210',
  yews: 0.35,
};

export const GROUNDS: Record<string, Ground> = {
  graveyard: BASE,
  village: { ...BASE, grass: ['#161b15', '#181e16', '#1a2118'], flowers: ['#f2c14e', '#c9c3b2', '#d23a46'], path: ['#383040', '#322b3a', '#1e1a24'], yews: 0.2 },
  kennels: { ...BASE, grass: ['#121a13', '#141d15', '#161f17'], blade: '#223424', tip: '#2f4a33', flowers: ['#c9c3b2'], yews: 0.75, path: ['#3a3026', '#332a22', '#1e1914'] },
  chapel: { ...BASE, grass: ['#13191b', '#151c1d', '#171e1f'], blade: '#22302f', tip: '#30443f', flowers: ['#9fe8ff', '#c9c3b2'], tint: 'rgba(10, 16, 40, 0.24)', fog: '160, 200, 230', yews: 0.4 },
  cloister: { ...BASE, grass: ['#131b14', '#151f15', '#172216'], blade: '#27402a', tip: '#3d6b3a', flowers: ['#9be36a'], path: ['#323a34', '#2c332e', '#181d19'], tint: 'rgba(10, 30, 14, 0.24)', fog: '140, 210, 110', yews: 0.1 },
};

export function groundFor(id: string): Ground {
  return GROUNDS[id] ?? BASE;
}

/** Paint the still part of an area: grass, cobbled paths, shores and the fence. */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  map: string[],
  isPath: (c: string) => boolean,
  g: Ground,
) {
  const px: Px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const R = map.length;
  const C = map[0].length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= C || y >= R ? '#' : map[y][x]);
  const pathAt = (x: number, y: number) => isPath(at(x, y));
  const water = (x: number, y: number) => at(x, y) === '~';
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const c = map[y][x];
      const X = x * TILE;
      const Y = y * TILE;
      if (isPath(c)) cobbles(px, X, Y, x, y, g, (dx, dy) => !pathAt(x + dx, y + dy) && !water(x + dx, y + dy) && at(x + dx, y + dy) !== '#');
      else if (c === '~') shore(px, X, Y, (dx, dy) => !water(x + dx, y + dy));
      else grass(px, X, Y, x, y, g, c === '#');
    }
  }
  // Paths soften into the grass: tufts lean over their edges.
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      if (!isPath(map[y][x])) continue;
      const X = x * TILE;
      const Y = y * TILE;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const n = at(x + dx, y + dy);
        if (isPath(n) || n === '~' || n === '#') continue;
        for (let i = 0; i < TILE; i++) {
          const r = hash(x * 3 + dx, y * 5 + dy, i);
          if (r > 0.55) continue;
          const d = r < 0.2 ? 2 : 1;
          const col = r < 0.1 ? g.blade : g.grass[2];
          if (dy === -1) px(X + i, Y, 1, d, col);
          if (dy === 1) px(X + i, Y + TILE - d, 1, d, col);
          if (dx === -1) px(X, Y + i, d, 1, col);
          if (dx === 1) px(X + TILE - d, Y + i, d, 1, col);
        }
      }
    }
  }
  // The fence runs across the top and bottom, and down the sides.
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (map[y][x] === '#') fence(px, x * TILE, y * TILE, y === 0 || y === R - 1);
}

function grass(px: Px, X: number, Y: number, x: number, y: number, g: Ground, under: boolean) {
  // Mottled: each 4x4 patch a shade of its own.
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const r = hash(x * 4 + i, y * 4 + j, 1);
      px(X + i * 4, Y + j * 4, 4, 4, g.grass[r < 0.3 ? 0 : r < 0.75 ? 1 : 2]);
    }
  }
  if (under) return;
  const n = 2 + Math.floor(hash(x, y, 2) * 3);
  for (let k = 0; k < n; k++) {
    const bx = X + 1 + Math.floor(hash(x, y, 10 + k) * 13);
    const by = Y + 2 + Math.floor(hash(x, y, 20 + k) * 11);
    px(bx, by, 1, 2, g.blade);
    px(bx + 1, by + 1, 1, 1, g.blade);
    if (hash(x, y, 30 + k) < 0.4) px(bx, by - 1, 1, 1, g.tip);
  }
  const f = hash(x, y, 3);
  if (f < 0.07 && g.flowers.length) {
    const fx = X + 3 + Math.floor(hash(x, y, 4) * 9);
    const fy = Y + 4 + Math.floor(hash(x, y, 5) * 8);
    px(fx, fy + 1, 1, 2, g.blade);
    px(fx, fy, 1, 1, g.flowers[Math.floor(hash(x, y, 6) * g.flowers.length)]);
  } else if (f < 0.12) {
    // a pebble
    const fx = X + 2 + Math.floor(hash(x, y, 7) * 11);
    const fy = Y + 3 + Math.floor(hash(x, y, 8) * 10);
    px(fx, fy, 2, 1, '#3a3346');
    px(fx, fy + 1, 2, 1, '#221d29');
  }
}

/** Cobbles in staggered rows, each lit along its top and shadowed below. */
function cobbles(px: Px, X: number, Y: number, x: number, y: number, g: Ground, edge: (dx: number, dy: number) => boolean) {
  px(X, Y, TILE, TILE, g.path[2]);
  for (let row = 0; row < 3; row++) {
    const sy = Y + row * 5 + 1;
    const h = row === 2 ? 4 : 4;
    const off = (y * 3 + row) % 2 ? 3 : 0;
    for (let sx = -off; sx < TILE; sx += 6) {
      const x0 = Math.max(X, X + sx);
      const x1 = Math.min(X + TILE, X + sx + 5);
      if (x1 - x0 < 2) continue;
      const r = hash(x * 7 + sx, y * 3 + row, 9);
      const col = r < 0.5 ? g.path[0] : g.path[1];
      px(x0, sy, x1 - x0, h, col);
      px(x0, sy, x1 - x0, 1, lighten(col, 10));
      px(x0, sy + h - 1, x1 - x0, 1, darken(col, 8));
      if (r > 0.92) px(x0 + 1, sy + 1, 1, 1, '#3d4a3a');
    }
  }
  // a darker rim where the path meets grass
  if (edge(0, -1)) px(X, Y, TILE, 1, darken(g.path[2], 4));
  if (edge(0, 1)) px(X, Y + TILE - 1, TILE, 1, darken(g.path[2], 4));
  if (edge(-1, 0)) px(X, Y, 1, TILE, darken(g.path[2], 4));
  if (edge(1, 0)) px(X + TILE - 1, Y, 1, TILE, darken(g.path[2], 4));
}

/** Still water, with a muddy bank and a pale line where it laps the shore. */
function shore(px: Px, X: number, Y: number, land: (dx: number, dy: number) => boolean) {
  px(X, Y, TILE, TILE, '#0c1922');
  px(X + 2, Y + 2, TILE - 4, TILE - 4, '#0a151d');
  if (land(0, -1)) {
    px(X, Y, TILE, 3, '#2a2620');
    px(X, Y + 3, TILE, 1, '#2f5466');
  }
  if (land(0, 1)) {
    px(X, Y + TILE - 2, TILE, 2, '#2a2620');
    px(X, Y + TILE - 3, TILE, 1, '#1f3a48');
  }
  if (land(-1, 0)) {
    px(X, Y, 2, TILE, '#2a2620');
    px(X + 2, Y, 1, TILE, '#244656');
  }
  if (land(1, 0)) {
    px(X + TILE - 2, Y, 2, TILE, '#2a2620');
    px(X + TILE - 3, Y, 1, TILE, '#244656');
  }
}

/** Iron railings with spear tips, and a stone post now and then. */
function fence(px: Px, X: number, Y: number, across: boolean) {
  if (across) {
    px(X, Y + 13, TILE, 3, '#0c0910');
    for (let bx = 1; bx < TILE; bx += 3) {
      px(X + bx, Y + 2, 1, 12, '#3a3346');
      px(X + bx, Y + 1, 1, 1, '#7a7090');
    }
    px(X, Y + 4, TILE, 1, '#4b4259');
    px(X, Y + 11, TILE, 1, '#4b4259');
    px(X, Y + 12, TILE, 1, '#1d1824');
  } else {
    px(X + 3, Y, 10, TILE, '#0c0910');
    for (let by = 1; by < TILE; by += 3) {
      px(X + 4, Y + by, 8, 1, '#3a3346');
      px(X + 3, Y + by, 1, 1, '#7a7090');
    }
    px(X + 5, Y, 1, TILE, '#4b4259');
    px(X + 10, Y, 1, TILE, '#4b4259');
  }
  if (hash(X, Y, 11) < 0.18) {
    px(X + 5, Y - 2, 6, 17, '#3a3346');
    px(X + 5, Y - 2, 6, 2, '#5a5070');
    px(X + 10, Y, 1, 15, '#2a2433');
    px(X + 4, Y - 3, 8, 1, '#6b6680');
  }
}

/** A tree: a gnarled dead one, or a dark yew. Both reach up over the tile above. */
export function tree(px: Px, X: number, Y: number, x: number, y: number, g: Ground, t: number) {
  const sway = Math.round(Math.sin(t * 0.8 + x * 1.3 + y) * 0.6);
  px(X + 1, Y + 13, 14, 3, 'rgba(0,0,0,0.38)');
  if (hash(x, y, 12) < g.yews) {
    // trunk, then three tiers of dark needles, moonlit on the left
    px(X + 7, Y + 11, 2, 4, '#2a2018');
    const tiers: [number, number, number, number][] = [[14, 6, 7, 0], [10, 6, 2, 0], [6, 5, -3, sway]];
    for (const [w, h, top, s] of tiers) {
      const tx = X + 8 - w / 2 + s;
      px(tx + 1, Y + top, w - 2, 1, '#14241a');
      px(tx, Y + top + 1, w, h - 1, '#14241a');
      px(tx + 1, Y + top + 1, Math.max(1, w / 2 - 2), h - 2, '#1c3224');
      px(tx + 1, Y + top, Math.max(1, w / 2 - 2), 1, '#2c4a34');
      px(tx, Y + top + h - 1, w, 1, '#0b140e');
    }
    px(X + 7 + sway, Y - 5, 2, 2, '#1c3224');
    return;
  }
  // a bare, crooked tree, mirrored at random so no two stand alike
  const m = hash(x, y, 13) < 0.5;
  const p = (dx: number, dy: number, w: number, h: number, c: string) => px(m ? X + 16 - dx - w : X + dx, Y + dy, w, h, c);
  const bark = '#2e2219';
  const lit = '#463427';
  p(4, 14, 8, 1, bark);
  p(5, 13, 6, 1, bark);
  p(6, 0, 4, 14, bark);
  p(6, 0, 1, 14, lit);
  p(9, 1, 1, 13, '#1e1610');
  for (let i = 0; i < 5; i++) p(5 - i, 4 - i, 2, 1, bark);
  p(1, -3, 1, 3, bark);
  p(0, -4, 1, 1, bark);
  for (let i = 0; i < 4; i++) p(10 + i, 2 - i, 2, 1, bark);
  p(13, -4, 1, 3, bark);
  p(7 + sway, -6, 2, 6, bark);
  p(7 + sway, -6, 1, 6, lit);
  p(8 + sway, -9, 1, 3, bark);
  p(6 + sway, -8, 1, 2, bark);
  // an owl, now and then, blinking
  if (hash(x, y, 14) < 0.15 && Math.sin(t * 0.7 + x) < 0.95) {
    p(3, 0, 1, 1, '#f2c14e');
    p(5, 0, 1, 1, '#f2c14e');
  }
}

/** A grave: a round headstone, a cross or a leaning slab, with a mound before it. */
export function grave(px: Px, X: number, Y: number, x: number, y: number, lit: boolean) {
  const stone = lit ? '#5d667a' : '#4b4259';
  const dark = lit ? '#3a4458' : '#2f2838';
  const hi = lit ? '#8a96aa' : '#5f5672';
  px(X + 3, Y + 13, 10, 2, '#1e1a16');
  px(X + 4, Y + 12, 8, 1, '#26201b');
  const v = Math.floor(hash(x, y, 15) * 3);
  if (v === 1) {
    // a cross
    px(X + 7, Y + 2, 3, 11, stone);
    px(X + 4, Y + 5, 9, 3, stone);
    px(X + 7, Y + 2, 1, 11, hi);
    px(X + 4, Y + 5, 9, 1, hi);
    px(X + 9, Y + 3, 1, 10, dark);
  } else if (v === 2) {
    // a slab leaning over with age
    for (let i = 0; i < 9; i++) px(X + 4 + Math.floor(i / 4), Y + 4 + i, 7, 1, stone);
    px(X + 4, Y + 4, 7, 1, hi);
    px(X + 6, Y + 7, 3, 1, dark);
    px(X + 4, Y + 12, 1, 1, '#4f6b3a');
  } else {
    // a round-topped headstone
    px(X + 4, Y + 5, 8, 8, stone);
    px(X + 5, Y + 4, 6, 1, stone);
    px(X + 6, Y + 3, 4, 1, stone);
    px(X + 4, Y + 5, 1, 8, hi);
    px(X + 5, Y + 4, 1, 1, hi);
    px(X + 11, Y + 5, 1, 8, dark);
    px(X + 7, Y + 6, 2, 5, dark);
    px(X + 6, Y + 7, 4, 1, dark);
    if (hash(x, y, 16) < 0.5) px(X + 4, Y + 11, 2, 2, '#3f5a3a');
  }
}

/** A light in the night: drawn bright over the dark. */
export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  a: number;
}

/** The night over an outdoor area: a cool tint, then every light added back on top, and low fog. */
export function night(ctx: CanvasRenderingContext2D, W: number, H: number, g: Ground, lights: Light[], t: number) {
  ctx.fillStyle = g.tint;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    gr.addColorStop(0, rgba(l.color, l.a));
    gr.addColorStop(0.5, rgba(l.color, l.a * 0.35));
    gr.addColorStop(1, rgba(l.color, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  // Low fog banks rolling slowly across.
  for (let i = 0; i < 4; i++) {
    const s = t * (0.02 + i * 0.008) + i * 1.9;
    const fx = ((s % 1.6) - 0.3) * W;
    const fy = H * (0.2 + i * 0.22) + Math.sin(s * 3) * 6;
    const r = 70 + i * 18;
    const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    gr.addColorStop(0, `rgba(${g.fog}, 0.06)`);
    gr.addColorStop(1, `rgba(${g.fog}, 0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
  }
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}

function shift(hex: string, by: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + by)).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

export const lighten = (hex: string, by: number) => shift(hex, by);
export const darken = (hex: string, by: number) => shift(hex, -by);
