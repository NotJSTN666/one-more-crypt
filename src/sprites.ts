// Hand-drawn 12x12 pixel sprites, baked once into offscreen canvases.

import type { EnemyKind } from './game';
import { ENEMY_ART } from './enemy-art';

const PALETTE: Record<string, string> = {
  k: '#0d0812', // outline
  b: '#e8dcc4', // bone
  B: '#a89a80', // bone shade
  r: '#d23a46', // blood
  R: '#701826', // dark blood
  g: '#7f9a52', // rotten green
  G: '#43572f',
  p: '#3b4f7d', // player cloak
  P: '#22304f',
  s: '#c9d1e0', // steel
  S: '#5d667a',
  y: '#f2c14e', // gold / eye glow
  w: '#ffffff',
  c: '#9fe8ff', // spectral
  C: '#3e8db5',
  n: '#7b6a8c', // brute hide
  v: '#6b3a96', // lich robes
  V: '#3a1d55',
  o: '#7a5532', // cork
  l: '#ff9aa5', // tonic shine
  L: '#d8323f', // tonic
  D: '#7a1220', // tonic depth
  // richer enemy shading
  h: '#fff6e0', // bone highlight
  e: '#ff4d5a', // glowing eyes
  m: '#a3bf6a', // rotten green highlight
  q: '#2a3a1e', // rotten green, deepest
  x: '#4a0f1c', // wing membrane
  u: '#9a8bab', // hide highlight
  N: '#4f4560', // hide shade
  a: '#1f4a63', // spectral depths
  f: '#8f5cc0', // robe highlight
  j: '#c9c36a', // plague smoke
  Y: '#a8781f', // gold shade
  // depth-zone residents
  O: '#ff8a2a', // ember
  z: '#ffd27a', // flame core
  t: '#2f6b5a', // pond weed
  i: '#5fe3ff', // water glint
  E: '#e0b8ff', // void glow
  A: '#2a1640', // void dark
};

type SpriteName = 'player' | EnemyKind | 'potion';

const ART: Record<SpriteName, string[]> = {
  player: [
    '....kkkk....',
    '...kPPPPk...',
    '..kPPPPPPk..',
    '..kPkkkkPk..',
    '..kPkykyPk.s',
    '...kPPPPk.ks',
    '..kpPppPpkks',
    '.kppPpppPpky',
    '.kpkpppppkk.',
    '..kkpPpPpk..',
    '...kSk.kSk..',
    '...kk...kk..',
  ],
  ...(Object.fromEntries(Object.entries(ENEMY_ART).map(([k, a]) => [k, a.idle[0]])) as Record<EnemyKind, string[]>),
  // A corked glass vial of glowing red tonic (it used to read as an apple).
  potion: [
    '.....kk.....',
    '....kook....',
    '....kook....',
    '....kwsk....',
    '....kwck....',
    '...kLlLLk...',
    '..kLwLLLLk..',
    '..kLlLLLLk..',
    '..kLLLLLDk..',
    '..kDLLLDDk..',
    '...kDDDDk...',
    '....kkkk....',
  ],
};

export const SPRITE_SIZE = 12;

export interface Sprite {
  normal: HTMLCanvasElement;
  white: HTMLCanvasElement;
}

function bake(rows: string[], solid?: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = solid ?? PALETTE[ch] ?? '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

/** Shift a #rrggbb colour lighter (amt > 0) or darker (amt < 0). */
function tint(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/**
 * Bake with light from above: each body pixel with the outline (or air) above it gets a
 * highlight, and one with the outline below it gets a shadow, so forms read as rounded.
 */
function bakeLit(rows: string[], solid?: string): HTMLCanvasElement {
  if (solid) return bake(rows, solid);
  const c = bake(rows);
  const ctx = c.getContext('2d')!;
  const at = (x: number, y: number) => rows[y]?.[x] ?? '.';
  const edge = (ch: string) => ch === '.' || ch === 'k';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (edge(ch) || !PALETTE[ch] || ch === 'w' || ch === 'e') continue;
      const lit = edge(at(x, y - 1));
      const dark = edge(at(x, y + 1)) || edge(at(x + 1, y));
      if (lit === dark) continue;
      ctx.fillStyle = tint(PALETTE[ch], lit ? 0.22 : -0.22);
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

let cache: Record<SpriteName, Sprite> | null = null;

export function sprites(): Record<SpriteName, Sprite> {
  if (!cache) {
    cache = {} as Record<SpriteName, Sprite>;
    for (const name of Object.keys(ART) as SpriteName[]) {
      const lit = name in ENEMY_ART;
      cache[name] = { normal: lit ? bakeLit(ART[name]) : bake(ART[name]), white: bake(ART[name], '#ffffff') };
    }
  }
  return cache;
}

export interface EnemyFrames {
  idle: [Sprite, Sprite];
  attack: Sprite;
}

let frameCache: Record<EnemyKind, EnemyFrames> | null = null;

/** Every enemy's animation frames: an idle loop and an attack pose. */
export function enemyFrames(kind: EnemyKind): EnemyFrames {
  if (!frameCache) {
    frameCache = {} as Record<EnemyKind, EnemyFrames>;
    const sprite = (rows: string[]): Sprite => ({ normal: bakeLit(rows), white: bake(rows, '#ffffff') });
    for (const [k, art] of Object.entries(ENEMY_ART) as [EnemyKind, (typeof ENEMY_ART)[EnemyKind]][]) {
      frameCache[k] = { idle: [sprite(art.idle[0]), sprite(art.idle[1])], attack: sprite(art.attack) };
    }
  }
  return frameCache[kind];
}
