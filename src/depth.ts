// How deep a run went, at a glance: five named depths, and a cross-section of the ground from
// the graveyard down, with the hero where they fell. Shown on the results screen, and drawn
// again into a picture players can share.
//
// The depths sit over the twenty-floor zones (zones.ts): the Crypt, the first pass of the
// four deep zones, the second pass, where Death hunts (REAPER_FLOOR), and the top one percent.

import { mulberry32 } from './rng';
import { ZONES } from './zones';
import { gradeGround } from './themes';
import type { Sprite } from './sprites';

export interface Depth {
  id: 'shallows' | 'deep' | 'underdeep' | 'reach' | 'bottomless';
  name: string;
  from: number;
  to: number;
  /** Rock colours, a band at a time, top to bottom: [stone, flecks]. */
  bands: [string, string][];
}

const z = (id: keyof typeof ZONES): [string, string] => [ZONES[id].wall.base, ZONES[id].wall.front];

export const DEPTHS: Depth[] = [
  { id: 'shallows', name: 'The Shallows', from: 1, to: 20, bands: [z('crypt')] },
  { id: 'deep', name: 'The Deep', from: 21, to: 100, bands: [z('flooded'), z('ossuary'), z('burning'), z('abyss')] },
  { id: 'underdeep', name: 'The Underdeep', from: 101, to: 150, bands: [['#2f4a26', '#1f3218'], ['#24384a', '#162534']] },
  { id: 'reach', name: "Death's Reach", from: 151, to: 300, bands: [['#3a1420', '#240a12'], ['#1f1030', '#12081e']] },
  { id: 'bottomless', name: 'The Bottomless', from: 301, to: Infinity, bands: [['#0a0712', '#050309']] },
];

/** The depth a floor lies in. */
export function depthAt(floor: number): Depth {
  return DEPTHS.find((d) => floor <= d.to) ?? DEPTHS[DEPTHS.length - 1];
}

/** "Floors 21-100", "Floors 301+". */
export function depthRange(d: Depth): string {
  return d.to === Infinity ? `Floors ${d.from}+` : `Floors ${d.from}-${d.to}`;
}

// ---------- the cross-section ----------

/** The column is drawn small (pixel art) and scaled up; text is drawn at the full size. */
export const COL_W = 180;
export const COL_H = 170;
const SURF = 22;
const BAND = (COL_H - SURF) / DEPTHS.length;
/** Where the shaft runs down from the crypt door. */
export const SHAFT = 88;

/**
 * A floor's height in the column. Each depth gets the same height whatever its floors, so a
 * floor-8 run and a floor-300 run both read clearly; The Bottomless never quite reaches the bottom.
 */
export function depthY(floor: number): number {
  const f = Math.max(1, floor);
  const i = DEPTHS.findIndex((d) => f <= d.to);
  const d = DEPTHS[i];
  const t = d.to === Infinity ? 1 - Math.exp(-(f - d.from) / 120) : (f - d.from + 0.5) / (d.to - d.from + 1);
  return SURF + i * BAND + t * BAND;
}

let ground: HTMLCanvasElement | null = null;
let groundTheme = '';

/** The rock itself: the graveyard on the surface, then the five depths, built once per theme. */
function rock(theme: string): HTMLCanvasElement {
  if (ground && groundTheme === theme) return ground;
  const c = document.createElement('canvas');
  c.width = COL_W;
  c.height = COL_H;
  const x = c.getContext('2d')!;
  const r = mulberry32(38);
  const px = (cx: number, cy: number, w: number, h: number, col: string) => {
    x.fillStyle = col;
    x.fillRect(cx, cy, w, h);
  };
  // night sky, a moon and stars
  const sky = x.createLinearGradient(0, 0, 0, SURF);
  sky.addColorStop(0, '#120b1c');
  sky.addColorStop(1, '#2a1a36');
  x.fillStyle = sky;
  x.fillRect(0, 0, COL_W, SURF);
  px(152, 4, 4, 4, '#e8e0c8');
  px(154, 4, 2, 3, '#120b1c');
  for (let k = 0; k < 14; k++) {
    x.globalAlpha = 0.3 + r() * 0.5;
    px(Math.floor(r() * COL_W), Math.floor(r() * 12), 1, 1, '#ffffff');
  }
  x.globalAlpha = 1;
  // the graveyard
  px(0, SURF - 4, COL_W, 4, '#1b2414');
  px(0, SURF - 4, COL_W, 1, '#2b3a1e');
  for (const [sx, h] of [[16, 4], [30, 5], [46, 4], [130, 5], [144, 4], [164, 6]]) {
    px(sx, SURF - 4 - h, 4, h, '#5a5070');
    px(sx + 1, SURF - 5 - h, 2, 1, '#5a5070');
    px(sx + 3, SURF - 4 - h, 1, h, '#3a3346');
  }
  px(62, SURF - 10, 1, 6, '#5a5070');
  px(60, SURF - 8, 5, 1, '#5a5070');
  // the crypt door everyone goes down
  px(SHAFT - 7, SURF - 13, 15, 13, '#3a3346');
  px(SHAFT - 5, SURF - 15, 11, 2, '#3a3346');
  px(SHAFT - 3, SURF - 9, 7, 9, '#07040b');
  px(SHAFT, SURF - 12, 2, 2, '#f2c14e');
  // the depths, each in bands of its zones' stone
  DEPTHS.forEach((d, i) => {
    const y0 = Math.round(SURF + i * BAND);
    const y1 = Math.round(SURF + (i + 1) * BAND);
    d.bands.forEach(([stone, fleck], j) => {
      const b0 = Math.round(y0 + (j * (y1 - y0)) / d.bands.length);
      const b1 = Math.round(y0 + ((j + 1) * (y1 - y0)) / d.bands.length);
      px(0, b0, COL_W, b1 - b0, stone);
      for (let k = 0; k < COL_W * (b1 - b0) * 0.12; k++) px(Math.floor(r() * COL_W), b0 + Math.floor(r() * (b1 - b0)), 1, 1, fleck);
      for (let k = 0; k < 16; k++) px(Math.floor(r() * COL_W), b0 + Math.floor(r() * (b1 - b0)), 2 + Math.floor(r() * 4), 1 + Math.floor(r() * 2), r() < 0.5 ? 'rgba(255,240,220,0.06)' : 'rgba(0,0,0,0.3)');
    });
    // a jagged seam between depths
    if (i) for (let xx = 0; xx < COL_W; xx++) px(xx, y0 - 1 + (Math.sin(xx * 0.7 + i) > 0.6 ? 1 : 0), 1, 1, '#07040b');
    const band = (j: number) => [y0 + (j * (y1 - y0)) / d.bands.length, (y1 - y0) / d.bands.length];
    if (d.id === 'deep') {
      // water, bones, embers and the dark of the four zones
      const [wy, wh] = band(0);
      for (let k = 0; k < 6; k++) px(8 + Math.floor(r() * 160), Math.floor(wy + 2 + r() * (wh - 3)), 6, 1, 'rgba(95,227,255,0.35)');
      const [by, bh] = band(1);
      for (let k = 0; k < 6; k++) px(8 + Math.floor(r() * 160), Math.floor(by + 1 + r() * (bh - 2)), 3, 1, '#c9bfa6');
      const [ly, lh] = band(2);
      for (let k = 0; k < 6; k++) px(8 + Math.floor(r() * 160), Math.floor(ly + 1 + r() * (lh - 2)), 2, 1, '#ff7a1a');
    }
    if (d.id === 'reach') for (let k = 0; k < 9; k++) px(Math.floor(r() * COL_W), y0 + 3 + Math.floor(r() * (y1 - y0 - 6)), 1, 2, 'rgba(255,77,90,0.4)');
    if (d.id === 'bottomless')
      for (let k = 0; k < 28; k++) {
        x.globalAlpha = 0.25 + r() * 0.5;
        px(Math.floor(r() * COL_W), y0 + 2 + Math.floor(r() * (y1 - y0 - 3)), 1, 1, r() < 0.3 ? '#d0b8ff' : '#ffffff');
        x.globalAlpha = 1;
      }
  });
  // the deeper, the darker
  const fade = x.createLinearGradient(0, SURF, 0, COL_H);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,0.45)');
  x.fillStyle = fade;
  x.fillRect(0, SURF, COL_W, COL_H - SURF);
  // in the player's theme
  gradeGround(c);
  ground = c;
  groundTheme = theme;
  return c;
}

export interface ColumnRun {
  floor: number;
  /** The player's best (drawn only when deeper than this run), and today's deepest run. */
  best?: number;
  deepest?: number;
  hero: Sprite;
  /** Death, faintly, in his reach. */
  reaper?: HTMLCanvasElement;
  theme: string;
}

/**
 * Draw the column into a 2d context at (ox, oy), `s` screen pixels to a column pixel.
 * `drop` (0-1) is how far the hero has fallen down the shaft so far.
 */
export function paintColumn(ctx: CanvasRenderingContext2D, ox: number, oy: number, s: number, run: ColumnRun, drop = 1) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rock(run.theme), ox, oy, COL_W * s, COL_H * s);
  const yEnd = depthY(run.floor);
  const ease = 1 - Math.pow(1 - drop, 3);
  const yHero = SURF + (yEnd - SURF) * ease;
  // the shaft you fell down
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(ox + SHAFT * s, oy + SURF * s, 3 * s, (yHero - SURF) * s);
  ctx.fillStyle = 'rgba(242,193,78,0.4)';
  for (let y = SURF; y < yHero; y += 3) ctx.fillRect(ox + (SHAFT + 1) * s, oy + y * s, s, s);
  if (run.reaper) {
    const ry = SURF + 3 * BAND;
    ctx.globalAlpha = 0.32;
    ctx.drawImage(run.reaper, ox + 6 * s, oy + (ry + 14) * s, 14 * s, 14 * s);
    ctx.globalAlpha = 1;
  }
  const font = (px: number, face = 'Silkscreen') => `${Math.round(px * s)}px '${face}', monospace`;
  const text = (t: string, x: number, y: number, col: string, size: number, align: CanvasTextAlign = 'left') => {
    ctx.font = font(size);
    ctx.textAlign = align;
    ctx.fillStyle = '#000';
    ctx.fillText(t, ox + x * s, oy + y * s + s * 0.5);
    ctx.fillStyle = col;
    ctx.fillText(t, ox + x * s, oy + y * s);
  };
  // the depths' names
  DEPTHS.forEach((d, i) => {
    const y = SURF + i * BAND;
    text(d.name.toUpperCase(), 4, y + 7, '#e8dcc4', 5);
    text(depthRange(d).toUpperCase(), 4, y + 12.5, '#bdb0c8', 3.6);
  });
  // your best and today's deepest
  const mark = (floor: number, col: string, label: string) => {
    const y = depthY(floor);
    ctx.fillStyle = col;
    for (let x = 64; x < COL_W - 4; x += 4) ctx.fillRect(ox + x * s, oy + y * s, 2 * s, Math.max(1, s * 0.6));
    text(label, COL_W - 4, y + 5, col, 3.6, 'right');
  };
  if (run.best && run.best > run.floor) mark(run.best, '#9fe8ff', `YOUR BEST · ${run.best}`);
  if (run.deepest && run.deepest > run.floor) mark(run.deepest, '#f2c14e', `TODAY'S DEEPEST · ${run.deepest}`);
  // the hero, outlined so it stands out from the rock, where they fell (or falling)
  const hs = 14;
  const hx = SHAFT + 1.5 - hs / 2;
  const hy = yHero - hs / 2;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(run.hero.white, ox + (hx + dx * 0.8) * s, oy + (hy + dy * 0.8) * s, hs * s, hs * s);
  ctx.drawImage(run.hero.normal, ox + hx * s, oy + hy * s, hs * s, hs * s);
  if (drop >= 1) {
    // and where: a tag beside them
    const d = depthAt(run.floor);
    const l1 = `FLOOR ${run.floor}`;
    const l2 = d.name.toUpperCase();
    ctx.font = font(4.4);
    const w1 = ctx.measureText(l1).width / s;
    ctx.font = font(3.6);
    const w2 = ctx.measureText(l2).width / s;
    const w = Math.max(w1, w2) + 6;
    const tx = Math.min(COL_W - w - 2, hx + hs + 4);
    const ty = Math.max(SURF + 1, Math.min(COL_H - 13, yEnd - 6));
    ctx.fillStyle = '#0b0710';
    ctx.fillRect(ox + tx * s, oy + ty * s, w * s, 12 * s);
    ctx.strokeStyle = '#d23a46';
    ctx.lineWidth = Math.max(1, s * 0.7);
    ctx.strokeRect(ox + tx * s, oy + ty * s, w * s, 12 * s);
    text(l1, tx + 3, ty + 5.4, '#e8dcc4', 4.4);
    text(l2, tx + 3, ty + 10.2, '#ff8a8a', 3.6);
  }
  ctx.restore();
}

/** The results screen's column: sized to its canvas, with the hero dropping down the shaft. */
export function showColumn(cv: HTMLCanvasElement, run: ColumnRun, animate: boolean): (update: Partial<ColumnRun>) => void {
  const s = Math.max(2, Math.round((cv.clientWidth || 360) * (window.devicePixelRatio || 1) / COL_W));
  cv.width = COL_W * s;
  cv.height = COL_H * s;
  const ctx = cv.getContext('2d')!;
  let current = run;
  let drop = animate ? 0 : 1;
  const draw = () => paintColumn(ctx, 0, 0, s, current, drop);
  // (the pixel fonts may still be loading: draw again once they're in)
  void document.fonts?.ready.then(() => cv.isConnected && draw());
  if (animate) {
    const t0 = performance.now() + 250;
    const step = (now: number) => {
      if (!cv.isConnected) return;
      drop = Math.max(0, Math.min(1, (now - t0) / 1300));
      draw();
      if (drop < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } else draw();
  return (update) => {
    current = { ...current, ...update };
    if (cv.isConnected) draw();
  };
}

export interface ShareCard extends ColumnRun {
  /** e.g. "DAILY #38 · THE KNIGHT" */
  kicker: string;
  /** e.g. "318 KILLS · 24:10 · SLAIN BY DEATH" */
  stats: string;
  /** Deeper than this share of today's players, when known. */
  beat?: number | null;
  site: string;
}

/** The picture to share: the column on the left, the run on the right. */
export function shareCard(card: ShareCard): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 675;
  const x = c.getContext('2d')!;
  const bg = x.createRadialGradient(840, 200, 40, 840, 200, 900);
  bg.addColorStop(0, '#1f1028');
  bg.addColorStop(1, '#07040b');
  x.fillStyle = bg;
  x.fillRect(0, 0, 1200, 675);
  const s = 3.5;
  const ox = 60;
  const oy = (675 - COL_H * s) / 2;
  x.fillStyle = '#000';
  x.fillRect(ox - 4, oy - 4, COL_W * s + 8, COL_H * s + 8);
  x.strokeStyle = '#6b5426';
  x.lineWidth = 2;
  x.strokeRect(ox - 5, oy - 5, COL_W * s + 10, COL_H * s + 10);
  paintColumn(x, ox, oy, s, card);
  const tx = ox + COL_W * s + 60;
  const line = (t: string, y: number, font: string, col: string, shadow = 4) => {
    x.font = font;
    x.textAlign = 'left';
    x.fillStyle = '#000';
    x.fillText(t, tx, y + shadow);
    x.fillStyle = col;
    x.fillText(t, tx, y);
  };
  line(card.kicker, 150, "20px 'Silkscreen', monospace", '#9a8fa8', 2);
  line(`Floor ${card.floor}`, 265, "116px 'Pirata One', serif", '#e8dcc4', 5);
  line(depthAt(card.floor).name, 335, "56px 'Pirata One', serif", '#d23a46', 3);
  let y = 400;
  if (card.beat != null) {
    line(`Deeper than ${card.beat}% of today's players`, y, "28px 'Pixelify Sans', sans-serif", '#f2c14e', 2);
    y += 44;
  }
  line(card.stats, y, "17px 'Silkscreen', monospace", '#9a8fa8', 2);
  line('One More Crypt', 545, "34px 'Pirata One', serif", '#d23a46', 2);
  line(card.site, 585, "22px 'Silkscreen', monospace", '#f2c14e', 2);
  return c;
}
