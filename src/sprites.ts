// Hand-drawn 12x12 pixel sprites, baked once into offscreen canvases.

import type { EnemyKind } from './game';

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
  l: '#8fd0ff', // tonic shine
  L: '#2f86e0', // tonic
  D: '#1a4a94', // tonic depth
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
  ghoul: [
    '............',
    '....kkkk....',
    '...kggggk...',
    '..kgrgrggk..',
    '..kggggggk..',
    '..kgkkkkgk..',
    '...kgbbgk...',
    '.kkgGggGgkk.',
    'kgk.kGGk.kgk',
    'kgk.kggk.kgk',
    '....kgkgk...',
    '...kk..kk...',
  ],
  bat: [
    '............',
    '............',
    'k....kk....k',
    'kk..kRRk..kk',
    'kRk.kRRk.kRk',
    'kRRkRrrRkRRk',
    'kRRRyrryRRRk',
    'kRkRRrrRRkRk',
    'kk..kRRk..kk',
    'k....kk....k',
    '............',
    '............',
  ],
  archer: [
    '...kkkk...k.',
    '..kbbbbk..kn',
    '..kkbbkk.k.n',
    '..kbbbbk.k.n',
    '...kBkBk.k.n',
    '..kkbbbkkkbn',
    '.kb.kbBk.k.n',
    '..k.kbBk.k.n',
    '....kbbk..kn',
    '...kb..bk.k.',
    '...kb..bk...',
    '..kk....kk..',
  ],
  brute: [
    '..kkkkkkkk..',
    '.knnnnnnnnk.',
    '.knrnnnnrnk.',
    '.knnnnnnnnk.',
    '.knkbkbkbnk.',
    'kkknnnnnnkkk',
    'knnnnSSnnnnk',
    'knnknSSnknnk',
    'knnknnnnknnk',
    'kkkknnnnkkkk',
    '...knnknnk..',
    '...kkk.kkk..',
  ],
  wraith: [
    '....kkkk....',
    '...kcccck...',
    '..kckcckck..',
    '..kcwccwck..',
    '..kcccccck..',
    '..kccckccck.',
    '..kCccccCk..',
    '.kCcCccCcCk.',
    '.kCcCCcCCk..',
    '..kCkCCkCk..',
    '..k.kCk.kk..',
    '.....k......',
  ],
  boss: [
    '..y.y..y.y..',
    '..yyyyyyyy..',
    '..kbbbbbbk..',
    '.kbkkbbkkbk.',
    '.kbkrbbkrbk.',
    '.kbbbbbbbbk.',
    '..kbkbkbkk..',
    '.kRRkbbkRRk.',
    'kRRRRbbRRRRk',
    'kRkRRbbRRkRk',
    'kk.kRRRRk.kk',
    '...kk..kk...',
  ],
  abbot: [
    '...kkkkk....',
    '..kGGGGGk...',
    '.kGGGGGGGk..',
    '.kGkbbbkGk..',
    '.kGbrkbbkk..',
    '..kbbbbbbbk.',
    '..kGbbbk.kk.',
    '.kGGGGGGk.n.',
    'kGGgGGgGGknk',
    'kGgGGGGgGkyk',
    '.kGGGGGGk.k.',
    '..kk..kk....',
  ],
  lich: [
    '.c..c..c..c.',
    '.cccccccccc.',
    '..kbbbbbbk..',
    '.kbkckkckbk.',
    '.kbbbbbbbbk.',
    '..kbkbkbkk..',
    '.kVVkbbkVVk.',
    'kVVVvbbvVVVk',
    'kVvVVvvVVvVk',
    'kVkVVVVVVkVk',
    '.kVVvVVvVVk.',
    '..kkVVVVkk..',
  ],
  thrall: [
    '....kkkk....',
    '...kbbbbk...',
    '...kgbbgk...',
    '...kbkkbk...',
    '....kbbk....',
    '..kkbbbbkk.s',
    '.kb.kbBk.kks',
    '.kb.kbBk..ks',
    '....kbbk..ky',
    '...kb..bk...',
    '...kb..bk...',
    '..kk....kk..',
  ],
  // A corked glass vial of glowing blue tonic (it used to read as an apple).
  potion: [
    '.....kk.....',
    '....kook....',
    '....kook....',
    '....kwsk....',
    '....kwck....',
    '...kLlLLk...',
    '..kLcLLLLk..',
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

let cache: Record<SpriteName, Sprite> | null = null;

export function sprites(): Record<SpriteName, Sprite> {
  if (!cache) {
    cache = {} as Record<SpriteName, Sprite>;
    for (const name of Object.keys(ART) as SpriteName[]) {
      cache[name] = { normal: bake(ART[name]), white: bake(ART[name], '#ffffff') };
    }
  }
  return cache;
}
