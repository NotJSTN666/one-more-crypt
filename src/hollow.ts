// The Hollow: a small graveyard to walk around between runs. Every building is a door
// into part of the game (the daily crypt, Endless, the Ossuary, the Forge, the Hall),
// old graves hold epitaphs to find, and the ghosts of today's best players wander it.

import { dailyHero } from './content';
import { dailyNumber } from './daily';
import { heroSprite } from './hero';
import { meta } from './meta';
import { LOOK_BY_ID } from './progression';
import { esc, overlay, screen, showOverlay } from './ui';

// ---------- the map ----------
// # fence  . grass  : path  T dead tree  + grave  W bonfire  1-5 graves with epitaphs
// Building bodies (solid): D daily  E endless  F forge  O ossuary  H hall  G grimoire  L obelisk
// Doors (walk in): d n f o h g   s the sealed gate (bump it)
const MAP = [
  '#################',
  '#.EEE.DDDDD.FFF.#',
  '#.EEE.DDDDD.FFF.#',
  '#..n...:d:...f..#',
  '#:::::::::::::::#',
  '#OOO.+..:..1.HHH#',
  '#OOO.+..:..+.HHH#',
  '#.o.:::::::::.h.#',
  '#T..:.2.W.:.+..T#',
  '#GGG.:..:..3..L.#',
  '#GGG.+.::..+..L.#',
  '#.g..:..:.4..:.5#',
  '########s########',
];
const COLS = MAP[0].length;
const ROWS = MAP.length;
const TILE = 16;
const SCALE = 4;
const SPAWN = { x: 8, y: 9 };

export type HollowPlace = 'daily' | 'endless' | 'forge' | 'ossuary' | 'hall' | 'grimoire' | 'ranks';

const DOORS: Record<string, HollowPlace> = { d: 'daily', n: 'endless', f: 'forge', o: 'ossuary', h: 'hall', g: 'grimoire' };

export const EPITAPHS: Record<string, string> = {
  '1': 'Here lies Aldric, first Warden of the crypt. He sealed the dead below, and became one of them.',
  '2': 'Brother Ansel sought a cure inside the plague, and found a congregation instead.',
  '3': 'For the nameless delver who reached the hundredth floor. Nobody believes it. Nobody came back to ask.',
  '4': 'Marta the smith taught the forge to burn blue. Two relics in, one relic out. She never said what fuels it.',
  '5': 'The ice below remembers. When the seal breaks, the Frozen Catacombs will wake.',
};

const SOLID = new Set(['#', 'T', '+', 'W', 'D', 'E', 'F', 'O', 'H', 'G', 'L', 's', ...Object.keys(EPITAPHS)]);

const at = (x: number, y: number) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? '#' : MAP[y][x]);
const walkable = (x: number, y: number) => !SOLID.has(at(x, y));

interface Ghost {
  name: string;
  x: number;
  y: number;
  px: number;
  py: number;
  next: number;
}

export interface HollowHooks {
  enter: (place: HollowPlace) => void;
  visit: (name: string) => void;
  epitaph: (id: string) => void;
  menu: () => void;
  /** Names of today's leading players, to wander the Hollow as ghosts. */
  ghosts: () => Promise<string[]>;
}

// Where the player stands persists between visits.
const pos = { x: SPAWN.x, y: SPAWN.y };
const draw = { x: SPAWN.x, y: SPAWN.y };
let path: { x: number; y: number }[] = [];
let lastStep = 0;
let ghosts: Ghost[] = [];
let ghostsLoaded = 0;
let hooks: HollowHooks;
let dialog: string | null = null;
let raf = 0;
let facing = 1;
/** Narrow screens see part of the map, following the hero; `camX` is in map pixels. */
let viewCols = COLS;
let camX = 0;

export function showHollow(h: HollowHooks) {
  hooks = h;
  // Coming back out of a door: step out in front of it.
  if (DOORS[at(pos.x, pos.y)]) {
    pos.y += 1;
    draw.x = pos.x;
    draw.y = pos.y;
  }
  path = [];
  dialog = null;
  const touch = matchMedia('(pointer: coarse)').matches;
  viewCols = window.innerWidth < 600 ? 11 : COLS;
  camX = cameraTarget();
  showOverlay('hollow', `
    <div class="hollow-wrap">
      <div class="hollow-top">
        <button class="btn" id="hollow-menu">☰ Menu</button>
        <span class="hollow-title">The Hollow</span>
        <span class="souls-chip">💀 <b>${meta.souls}</b></span>
      </div>
      <canvas id="hollow-canvas" width="${viewCols * TILE * SCALE}" height="${ROWS * TILE * SCALE}" aria-label="The Hollow, a graveyard to explore"></canvas>
      <div class="hollow-dialog" id="hollow-dialog" hidden></div>
      <p class="fine hollow-hint">${touch ? 'Tap to walk.' : 'Arrows or WASD to walk, or click a spot.'} Step through a door to enter. Read the old graves.</p>
    </div>`);
  overlay.querySelector('#hollow-menu')?.addEventListener('click', () => hooks.menu());
  const canvas = overlay.querySelector<HTMLCanvasElement>('#hollow-canvas')!;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - r.left) / r.width) * viewCols + camX / TILE);
    const ty = Math.floor(((e.clientY - r.top) / r.height) * ROWS);
    if (dialog) return closeDialog();
    walkTo(tx, ty);
  });
  overlay.querySelector('#hollow-dialog')?.addEventListener('click', closeDialog);
  if (Date.now() - ghostsLoaded > 60_000) {
    ghostsLoaded = Date.now();
    void hooks
      .ghosts()
      .then((names) => {
        ghosts = names.slice(0, 4).map((name, i) => {
          const spot = randomFloor(i * 7 + 3);
          return { name, x: spot.x, y: spot.y, px: spot.x, py: spot.y, next: performance.now() + 800 * i };
        });
      })
      .catch(() => undefined);
  }
  cancelAnimationFrame(raf);
  const ctx = canvas.getContext('2d')!;
  let last = performance.now();
  const loop = (now: number) => {
    if (screen !== 'hollow' || !canvas.isConnected) return;
    update(now, Math.min(0.05, (now - last) / 1000));
    last = now;
    render(ctx, now / 1000);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function cameraTarget(): number {
  const max = (COLS - viewCols) * TILE;
  return Math.max(0, Math.min(max, (draw.x + 0.5 - viewCols / 2) * TILE));
}

function randomFloor(seed: number) {
  let r = seed * 9301 + 49297;
  for (let i = 0; i < 200; i++) {
    r = (r * 9301 + 49297) % 233280;
    const x = 1 + (r % (COLS - 2));
    const y = 4 + (Math.floor(r / 7) % (ROWS - 5));
    if (walkable(x, y) && !DOORS[at(x, y)]) return { x, y };
  }
  return { x: SPAWN.x, y: SPAWN.y };
}

// ---------- moving ----------

/** Arrow keys and WASD walk; Escape opens the menu. Returns true if the key was used. */
export function hollowKey(e: KeyboardEvent): boolean {
  const dirs: Record<string, [number, number]> = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };
  if (dialog && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || dirs[e.key])) {
    e.preventDefault();
    closeDialog();
    return true;
  }
  if (e.key === 'Escape') {
    hooks.menu();
    return true;
  }
  const d = dirs[e.key];
  if (!d) return false;
  e.preventDefault();
  if (e.repeat && performance.now() - lastStep < 140) return true;
  path = [];
  step(d[0], d[1]);
  return true;
}

function step(dx: number, dy: number) {
  if (dx) facing = dx;
  lastStep = performance.now();
  const x = pos.x + dx;
  const y = pos.y + dy;
  const tile = at(x, y);
  const ghost = ghosts.find((g) => g.x === x && g.y === y);
  if (ghost) {
    path = [];
    return hooks.visit(ghost.name);
  }
  if (EPITAPHS[tile]) {
    path = [];
    openDialog(tile);
    return;
  }
  if (tile === 'L') return hooks.enter('ranks');
  if (tile === 's') {
    path = [];
    dialog = 'sealed';
    showDialog('<b>A sealed gate</b>Frost creeps from under the iron. Something below is waiting for the seal to break.');
    return;
  }
  if (!walkable(x, y)) return;
  pos.x = x;
  pos.y = y;
  const door = DOORS[tile];
  if (door) {
    path = [];
    // Let the walk-in finish before the screen changes.
    window.setTimeout(() => screen === 'hollow' && hooks.enter(door), 160);
  }
}

/** Shortest path to a tapped tile (or next to it, when it's a building, grave or ghost). */
function walkTo(tx: number, ty: number) {
  const key = (x: number, y: number) => y * COLS + x;
  const prev = new Map<number, number>();
  const start = key(pos.x, pos.y);
  prev.set(start, -1);
  const queue = [start];
  let goal = -1;
  const target = (x: number, y: number) => (x === tx && y === ty) || (!walkable(tx, ty) && Math.abs(x - tx) + Math.abs(y - ty) === 1);
  while (queue.length) {
    const k = queue.shift()!;
    const x = k % COLS;
    const y = Math.floor(k / COLS);
    if (target(x, y)) {
      goal = k;
      break;
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const nk = key(nx, ny);
      if (prev.has(nk) || !walkable(nx, ny)) continue;
      // Don't route through doors on the way somewhere else.
      if (DOORS[at(nx, ny)] && !(nx === tx && ny === ty)) continue;
      prev.set(nk, k);
      queue.push(nk);
    }
  }
  if (goal < 0) return;
  const steps: { x: number; y: number }[] = [];
  for (let k = goal; k !== start; k = prev.get(k)!) steps.unshift({ x: k % COLS, y: Math.floor(k / COLS) });
  // Ending beside something solid (a grave, the obelisk, a ghost): bump into it.
  if (!walkable(tx, ty) || ghosts.some((g) => g.x === tx && g.y === ty)) steps.push({ x: tx, y: ty });
  path = steps;
}

function update(now: number, dt: number) {
  if (path.length && now - lastStep > 150 && !dialog) {
    const n = path.shift()!;
    step(n.x - pos.x, n.y - pos.y);
  }
  const k = Math.min(1, dt * 14);
  draw.x += (pos.x - draw.x) * k;
  draw.y += (pos.y - draw.y) * k;
  camX += (cameraTarget() - camX) * Math.min(1, dt * 6);
  for (const g of ghosts) {
    if (now > g.next) {
      g.next = now + 1400 + Math.random() * 1600;
      const options = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => {
        const x = g.x + dx;
        const y = g.y + dy;
        return walkable(x, y) && !DOORS[at(x, y)] && !(x === pos.x && y === pos.y);
      });
      if (options.length) {
        const [dx, dy] = options[Math.floor(Math.random() * options.length)];
        g.x += dx;
        g.y += dy;
      }
    }
    g.px += (g.x - g.px) * Math.min(1, dt * 4);
    g.py += (g.y - g.py) * Math.min(1, dt * 4);
  }
}

// ---------- epitaphs ----------

function openDialog(id: string) {
  dialog = id;
  const first = !meta.epitaphs.includes(id);
  showDialog(`<b>${first ? 'An old grave' : 'A grave you know'}</b>${esc(EPITAPHS[id])}`);
  hooks.epitaph(id);
}

function showDialog(html: string) {
  const el = document.getElementById('hollow-dialog');
  if (!el) return;
  el.innerHTML = `${html}<small>Tap or press any key</small>`;
  el.hidden = false;
}

function closeDialog() {
  dialog = null;
  const el = document.getElementById('hollow-dialog');
  if (el) el.hidden = true;
}

// ---------- drawing ----------

function render(ctx: CanvasRenderingContext2D, t: number) {
  ctx.setTransform(SCALE, 0, 0, SCALE, -Math.round(camX * SCALE), 0);
  ctx.imageSmoothingEnabled = false;
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // ground
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = MAP[y][x];
      const X = x * TILE;
      const Y = y * TILE;
      const n = (x * 7 + y * 13) % 5;
      if (c === ':' || DOORS[c]) {
        px(X, Y, TILE, TILE, '#2a2433');
        px(X + 1 + n, Y + 2, 5, 4, '#332c3e');
        px(X + 8, Y + 9 - (n % 3), 6, 4, '#332c3e');
      } else {
        px(X, Y, TILE, TILE, n % 2 ? '#141a17' : '#161d19');
        if (n === 0) px(X + 4, Y + 10, 1, 2, '#2c3a2f');
        if (n === 3) px(X + 11, Y + 5, 1, 2, '#2c3a2f');
      }
    }
  }

  // fence, trees, graves, bonfire
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = MAP[y][x];
      const X = x * TILE;
      const Y = y * TILE;
      if (c === '#') {
        px(X, Y + 4, TILE, 2, '#3a3346');
        px(X, Y + 11, TILE, 2, '#3a3346');
        for (const bx of [2, 7, 12]) {
          px(X + bx, Y + 1, 2, 14, '#4b4259');
          px(X + bx, Y, 2, 1, '#6b6680');
        }
      } else if (c === 'T') {
        px(X + 7, Y + 4, 2, 12, '#2a2018');
        px(X + 3, Y + 5, 4, 1, '#2a2018');
        px(X + 3, Y + 3, 1, 2, '#2a2018');
        px(X + 9, Y + 7, 4, 1, '#2a2018');
        px(X + 12, Y + 4, 1, 3, '#2a2018');
      } else if (c === '+' || EPITAPHS[c]) {
        const read = EPITAPHS[c] && meta.epitaphs.includes(c);
        px(X + 4, Y + 4, 8, 10, '#4b4259');
        px(X + 5, Y + 3, 6, 1, '#4b4259');
        px(X + 6, Y + 6, 4, 1, '#2f2838');
        px(X + 7, Y + 5, 2, 5, '#2f2838');
        px(X + 3, Y + 14, 10, 1, '#0b0710');
        if (EPITAPHS[c] && !read) {
          // unread epitaphs glow faintly
          ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2 + x);
          px(X + 2, Y + 2, 12, 13, '#9fe8ff');
          ctx.globalAlpha = 1;
          px(X + 4, Y + 4, 8, 10, '#5d667a');
          px(X + 7, Y + 5, 2, 5, '#2f2838');
          px(X + 6, Y + 6, 4, 1, '#2f2838');
        }
      } else if (c === 'W') {
        const f = Math.sin(t * 9) > 0 ? 1 : 0;
        const glow = ctx.createRadialGradient(X + 8, Y + 8, 2, X + 8, Y + 8, 40);
        glow.addColorStop(0, 'rgba(255,140,60,0.35)');
        glow.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(X - 32, Y - 32, 80, 80);
        px(X + 3, Y + 12, 10, 2, '#4a3a2a');
        px(X + 5, Y + 6 - f, 6, 6 + f, '#ff8a2a');
        px(X + 6, Y + 8, 4, 4, '#f2c14e');
        px(X + 7, Y + 4 - f, 2, 3, '#ff8a2a');
      } else if (c === 's') {
        px(X, Y + 1, TILE, 15, '#1f4a63');
        for (const bx of [2, 6, 10, 14]) px(X + bx - 1, Y, 2, 16, '#9fe8ff');
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 1.5);
        px(X - 4, Y - 6, TILE + 8, 6, '#9fe8ff');
        ctx.globalAlpha = 1;
      }
    }
  }

  // buildings
  const box = (letter: string) => {
    let x0 = COLS, y0 = ROWS, x1 = 0, y1 = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (MAP[y][x] === letter) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { X: x0 * TILE, Y: y0 * TILE, W: (x1 - x0 + 1) * TILE, H: (y1 - y0 + 1) * TILE };
  };
  const building = (letter: string, wall: string, roof: string, glow: string, label: string) => {
    const b = box(letter);
    px(b.X + 2, b.Y + 8, b.W - 4, b.H - 8, wall);
    for (let y = b.Y + 12; y < b.Y + b.H; y += 6) px(b.X + 2, y, b.W - 4, 1, 'rgba(0,0,0,0.25)');
    // pointed roof
    for (let i = 0; i < 8; i++) px(b.X + i * 2, b.Y + 8 - i, b.W - i * 4, 1, roof);
    px(b.X, b.Y + 8, b.W, 2, roof);
    // doorway, glowing
    const dx = b.X + b.W / 2 - 4;
    const pulse = 0.6 + 0.4 * Math.sin(t * 2.4 + b.X);
    ctx.globalAlpha = pulse;
    px(dx - 2, b.Y + b.H - 13, 12, 13, glow);
    ctx.globalAlpha = 1;
    px(dx, b.Y + b.H - 11, 8, 11, '#07040b');
    label && sign(ctx, label, b.X + b.W / 2, b.Y - 1, glow);
  };
  building('D', '#3a3346', '#5a1622', '#d23a46', `DAILY #${dailyNumber()}`);
  building('E', '#2a2433', '#311854', '#b07cff', 'ENDLESS');
  building('F', '#2f3440', '#1f2a3a', '#5fe3ff', 'FORGE');
  building('O', '#4a4038', '#2e2620', '#e8dcc4', 'OSSUARY');
  building('H', '#3a3346', '#7a5a12', '#f2c14e', 'HALL');
  building('G', '#2f2838', '#3a2a10', '#ff8a2a', 'GRIMOIRE');
  // forge smoke, Ossuary skull, Hall crown
  const f = box('F');
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 0.5 * (1 - p);
    px(f.X + f.W - 8 + Math.sin(p * 6 + i) * 2, f.Y + 4 - p * 14, 3, 3, '#7fb4ff');
  }
  ctx.globalAlpha = 1;
  const o = box('O');
  px(o.X + 8, o.Y + 12, 6, 5, '#e8dcc4');
  px(o.X + 9, o.Y + 14, 1, 1, '#07040b');
  px(o.X + 12, o.Y + 14, 1, 1, '#07040b');
  const hb = box('H');
  px(hb.X + 8, hb.Y + 12, 7, 2, '#f2c14e');
  px(hb.X + 8, hb.Y + 10, 1, 2, '#f2c14e');
  px(hb.X + 11, hb.Y + 10, 1, 2, '#f2c14e');
  px(hb.X + 14, hb.Y + 10, 1, 2, '#f2c14e');
  // the obelisk of ranks
  const L = box('L');
  px(L.X + 4, L.Y + 4, 8, L.H - 6, '#4b4259');
  px(L.X + 6, L.Y, 4, 4, '#4b4259');
  px(L.X + 2, L.Y + L.H - 3, 12, 3, '#3a3346');
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
  px(L.X + 7, L.Y + 8, 2, 10, '#f2c14e');
  ctx.globalAlpha = 1;
  sign(ctx, 'RANKS', L.X + L.W / 2, L.Y - 1, '#f2c14e');

  // ghosts of today's best
  const daily = heroSprite(dailyHero(dailyNumber()), {}, []).white;
  for (const g of ghosts) {
    const bob = Math.sin(t * 2 + g.name.length) * 1;
    ctx.globalAlpha = 0.45;
    ctx.drawImage(daily, g.px * TILE + 2, g.py * TILE + 1 + bob, 12, 12);
    ctx.globalAlpha = 1;
    nameTag(ctx, g.name, g.px * TILE + 8, g.py * TILE + bob);
  }

  // the player
  const hero = heroSprite(meta.hero, {}, [], meta.look).normal;
  const hx = draw.x * TILE + 2;
  const hy = draw.y * TILE + 1;
  px(hx + 2, hy + 12, 8, 2, 'rgba(0,0,0,0.4)');
  ctx.save();
  if (facing < 0) {
    ctx.translate(hx + 12, hy);
    ctx.scale(-1, 1);
    ctx.drawImage(hero, 0, 0, 12, 12);
  } else ctx.drawImage(hero, hx, hy, 12, 12);
  ctx.restore();
  const aura = LOOK_BY_ID[meta.look]?.aura;
  if (aura) {
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3) % 1;
      ctx.globalAlpha = 0.8 * (1 - p);
      px(hx + 2 + ((i * 4) % 9), hy + 10 - p * 12, 1, 1, aura);
    }
    ctx.globalAlpha = 1;
  }

  // night: moonlight vignette and fireflies
  const vx = camX + (viewCols * TILE) / 2;
  const v = ctx.createRadialGradient(vx, ROWS * TILE / 2, 40, vx, ROWS * TILE / 2, 190);
  v.addColorStop(0, 'rgba(7,4,11,0)');
  v.addColorStop(1, 'rgba(7,4,11,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
  for (let i = 0; i < 10; i++) {
    const fx = (Math.sin(t * 0.3 + i * 1.7) * 0.5 + 0.5) * COLS * TILE;
    const fy = (Math.cos(t * 0.23 + i * 2.3) * 0.5 + 0.5) * ROWS * TILE;
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 3 + i);
    px(fx, fy, 1, 1, i % 3 ? '#b5e07a' : '#f2c14e');
  }
  ctx.globalAlpha = 1;
}

function sign(ctx: CanvasRenderingContext2D, label: string, cx: number, y: number, color: string) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${5 * SCALE}px Silkscreen, monospace`;
  ctx.textAlign = 'center';
  const w = ctx.measureText(label).width + 6 * SCALE;
  const x = (cx - camX) * SCALE;
  const top = (y - 6) * SCALE;
  ctx.fillStyle = 'rgba(7,4,11,0.85)';
  ctx.fillRect(x - w / 2, top, w, 7 * SCALE);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, top + 7 * SCALE - SCALE, w, SCALE / 2);
  ctx.fillText(label, x, top + 5.4 * SCALE);
  ctx.restore();
}

function nameTag(ctx: CanvasRenderingContext2D, name: string, cx: number, y: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${4 * SCALE}px Silkscreen, monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(7,4,11,0.7)';
  const w = ctx.measureText(name).width + 4 * SCALE;
  const x = (cx - camX) * SCALE;
  ctx.fillRect(x - w / 2, (y - 6) * SCALE, w, 6 * SCALE);
  ctx.fillStyle = '#c9a6ff';
  ctx.fillText(name, x, (y - 1.4) * SCALE);
  ctx.restore();
}
