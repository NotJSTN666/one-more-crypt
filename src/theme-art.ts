// The themes' own crypts: each theme rebuilds the board's floors and walls in its own
// materials (rubble and ash, mossy cobbles and vines, ice and snow, marble and velvet,
// sandstone and gold), with its own litter on the floor and its own candle holders.
// Water, lava, bone piles, the stairs and everything alive are drawn over this as usual.

import type { Rng } from './rng';
import type { ThemeId } from './themes';

export interface BoardArt {
  ctx: CanvasRenderingContext2D;
  /** Board size in tiles, and the tile size in pixels. */
  w: number;
  h: number;
  tile: number;
  wallAt: (x: number, y: number) => boolean;
  rng: Rng;
  boss: boolean;
  /** Wall candles (their flames are drawn live): the holder is drawn here. */
  candles: { x: number; y: number }[];
}

type Painter = {
  floor: (a: BoardArt, px: number, py: number, x: number, y: number) => void;
  wall: (a: BoardArt, px: number, py: number, s: Sides) => void;
  /** What a wall lets fall onto the floor below it: icicles, vines, rubble. */
  under?: (a: BoardArt, px: number, py: number) => void;
  /** A floor tile that sits against a wall above it: drifts and moss. */
  against?: (a: BoardArt, px: number, py: number) => void;
  litter: (a: BoardArt, px: number, py: number) => void;
  candle: (a: BoardArt, x: number, y: number) => void;
};

interface Sides {
  open: boolean;
  topOpen: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
}

const pick = <T>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length)];
const n = (rng: Rng, k: number) => Math.floor(rng() * k);

function fill(a: BoardArt, x: number, y: number, w: number, h: number, c: string) {
  a.ctx.fillStyle = c;
  a.ctx.fillRect(x, y, w, h);
}

/** Shared wall shading: open sides in shadow, a drop shadow onto the floor below. */
function wallShade(a: BoardArt, px: number, py: number, s: Sides) {
  const T = a.tile;
  if (s.leftOpen) fill(a, px, py + 1, 1, T - 1, 'rgba(0,0,0,0.3)');
  if (s.rightOpen) fill(a, px + T - 1, py + 1, 1, T - 1, 'rgba(0,0,0,0.4)');
  if (s.open) {
    fill(a, px, py + T, T, 2, 'rgba(0,0,0,0.5)');
    fill(a, px, py + T + 2, T, 2, 'rgba(0,0,0,0.22)');
  }
}

// ---------- Ashen: a burnt-out ruin ----------

const ashen: Painter = {
  floor(a, px, py) {
    const T = a.tile;
    fill(a, px, py, T, T, pick(a.rng, ['#1f1e1c', '#232120', '#1c1b1a']));
    // broken slabs: two or three uneven pieces with dark seams
    const cut = 4 + n(a.rng, 8);
    fill(a, px, py + cut, T, 1, '#1b1a19');
    fill(a, px + 3 + n(a.rng, 10), py, 1, cut, '#1b1a19');
    fill(a, px + 2 + n(a.rng, 11), py + cut + 1, 1, T - cut - 1, '#1b1a19');
    fill(a, px, py, T, 1, 'rgba(230,225,215,0.05)');
    // soot and grey ash ground in
    for (let k = 0; k < 6; k++) fill(a, px + n(a.rng, 15), py + n(a.rng, 15), 1, 1, a.rng() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(150,145,138,0.22)');
    if (a.rng() < 0.18) {
      // a scorch mark
      const sx = px + 3 + n(a.rng, 7);
      const sy = py + 3 + n(a.rng, 7);
      fill(a, sx, sy, 5, 3, 'rgba(0,0,0,0.3)');
      fill(a, sx + 1, sy - 1, 3, 5, 'rgba(0,0,0,0.22)');
    }
  },
  wall(a, px, py, s) {
    const T = a.tile;
    fill(a, px, py, T, T, '#3d3a36');
    // a heap of rough stones, packed with dark gaps
    for (let k = 0; k < 7; k++) {
      const w = 3 + n(a.rng, 4);
      const h = 2 + n(a.rng, 3);
      const x = px + n(a.rng, T - w + 1);
      const y = py + 1 + n(a.rng, T - h - (s.open ? 4 : 1));
      fill(a, x, y, w, h, pick(a.rng, ['#5d5a54', '#68645d', '#55524c', '#726e66']));
      fill(a, x, y, w - 1, 1, 'rgba(235,230,220,0.16)');
      fill(a, x + w - 1, y + 1, 1, h - 1, 'rgba(0,0,0,0.35)');
    }
    if (s.topOpen) {
      // a broken, charred top with the odd glowing ember
      fill(a, px, py, T, 1, '#6b6760');
      for (let k = 0; k < 3; k++) fill(a, px + n(a.rng, 14), py, 2 + n(a.rng, 2), 1, '#1a1817');
      if (a.rng() < 0.3) fill(a, px + 2 + n(a.rng, 12), py + 1, 1, 1, '#c25a26');
    }
    if (s.open) {
      fill(a, px, py + T - 4, T, 4, '#2c2a27');
      fill(a, px, py + T - 4, T, 1, '#4a4743');
      for (let k = 0; k < 4; k++) fill(a, px + n(a.rng, 14), py + T - 3 + n(a.rng, 2), 2, 1, '#45423d');
      fill(a, px, py + T - 1, T, 1, '#121110');
    }
    wallShade(a, px, py, s);
  },
  under(a, px, py) {
    // rubble spilled from the wall
    for (let k = 0; k < 2 + n(a.rng, 3); k++) {
      const x = px + n(a.rng, 14);
      const y = py + 2 + n(a.rng, 3);
      fill(a, x, y, 2, 1, '#55524d');
      fill(a, x, y + 1, 2, 1, 'rgba(0,0,0,0.4)');
    }
  },
  against(a, px, py) {
    // ash banked against the wall
    const w = 6 + n(a.rng, 8);
    const x = px + n(a.rng, a.tile - w + 1);
    fill(a, x, py + 4, w, 1, 'rgba(120,116,110,0.35)');
    fill(a, x + 1, py + 3, w - 2, 1, 'rgba(150,145,138,0.4)');
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.35) {
      // a skull, fallen in the ash
      fill(a, x, y, 4, 3, '#b9b2a4');
      fill(a, x + 1, y + 3, 2, 1, '#8f897d');
      fill(a, x + 1, y + 1, 1, 1, '#141312');
      fill(a, x + 3, y + 1, 1, 1, '#141312');
    } else if (r < 0.7) {
      // a pile of ash
      fill(a, x - 1, y + 1, 6, 2, 'rgba(110,106,100,0.5)');
      fill(a, x, y, 4, 1, 'rgba(160,155,148,0.45)');
    } else {
      // a burnt beam
      fill(a, x - 2, y, 7, 2, '#1d1a18');
      fill(a, x - 2, y, 7, 1, '#3a2c24');
      fill(a, x + 1, y, 1, 1, '#b4502a');
    }
  },
  candle(a, x, y) {
    // a melted, blackened stub
    fill(a, x - 1, y + 4, 4, 1, '#4a4743');
    fill(a, x, y + 1, 2, 3, '#a8a194');
    fill(a, x - 1, y + 3, 1, 1, '#8f897d');
  },
};

// ---------- Verdigris: an overgrown, drowned tomb ----------

const verdigris: Painter = {
  floor(a, px, py) {
    const T = a.tile;
    fill(a, px, py, T, T, '#0f1611');
    // cobbles with moss in the cracks
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const x = px + cx * 4 + (cy % 2 ? 2 : 0) - 1;
        const y = py + cy * 4;
        const x0 = Math.max(px, x);
        const x1 = Math.min(px + T, x + 3);
        if (x1 <= x0) continue;
        fill(a, x0, y, x1 - x0, 3, pick(a.rng, ['#242e26', '#28332a', '#212a23', '#2c372c']));
        fill(a, x0, y, x1 - x0, 1, 'rgba(210,240,200,0.05)');
        if (a.rng() < 0.12) fill(a, x0, y + 3, x1 - x0, 1, pick(a.rng, ['#24501f', '#2d5f27']));
      }
    }
    if (a.rng() < 0.12) {
      // a tuft of grass
      const x = px + 2 + n(a.rng, 11);
      const y = py + 5 + n(a.rng, 8);
      fill(a, x, y, 1, 3, '#4f9a3c');
      fill(a, x + 1, y - 1, 1, 4, '#6dbf4c');
      fill(a, x + 2, y + 1, 1, 2, '#4f9a3c');
    }
  },
  wall(a, px, py, s) {
    const T = a.tile;
    fill(a, px, py, T, T, '#3f4d42');
    // big old blocks, green with age
    for (let row = 0; row < 2; row++) {
      const by = py + 2 + row * 6;
      const off = row ? 5 : 0;
      for (let bx = px - 5 + off; bx < px + T; bx += 10) {
        const x0 = Math.max(px, bx + 1);
        const x1 = Math.min(px + T, bx + 10);
        if (x1 <= x0) continue;
        fill(a, x0, by, x1 - x0, 5, pick(a.rng, ['#62766a', '#6b8070', '#5a6d60']));
        fill(a, x0, by, x1 - x0, 1, 'rgba(220,255,210,0.1)');
      }
    }
    // copper-green weeping down the stone
    if (a.rng() < 0.5) {
      const x = px + 2 + n(a.rng, 12);
      fill(a, x, py + 2, 1, 6 + n(a.rng, 6), 'rgba(90,200,165,0.45)');
    }
    if (s.topOpen) {
      // moss over the top
      fill(a, px, py, T, 2, '#3f7a36');
      for (let k = 0; k < 5; k++) fill(a, px + n(a.rng, 15), py + 2, 1 + n(a.rng, 2), 1 + n(a.rng, 2), '#3f7a36');
      fill(a, px, py, T, 1, '#6dbf4c');
    }
    if (s.open) {
      fill(a, px, py + T - 3, T, 3, '#1f2a22');
      fill(a, px, py + T - 1, T, 1, '#0f1712');
    }
    wallShade(a, px, py, s);
  },
  under(a, px, py) {
    // vines hanging down off the wall, leaves along them
    const count = 1 + n(a.rng, 3);
    for (let k = 0; k < count; k++) {
      const x = px + 1 + n(a.rng, 14);
      const len = 3 + n(a.rng, 7);
      fill(a, x, py - 3, 1, len + 3, '#2c6a2a');
      for (let l = 0; l < len; l += 3) fill(a, x + (l % 2 ? 1 : -1), py - 2 + l, 1, 1, '#5fae4a');
      fill(a, x, py + len - 1, 1, 1, '#7fd05a');
    }
  },
  against(a, px, py) {
    fill(a, px, py, a.tile, 1, 'rgba(70,140,60,0.35)');
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.4) {
      // glowing toadstools
      fill(a, x + 1, y + 2, 1, 2, '#c9d6b0');
      fill(a, x, y + 1, 3, 1, '#4fd6a8');
      fill(a, x + 1, y, 1, 1, '#9cf5d6');
      fill(a, x + 4, y + 3, 1, 1, '#c9d6b0');
      fill(a, x + 3, y + 2, 3, 1, '#4fd6a8');
    } else if (r < 0.7) {
      // a still green puddle
      fill(a, x - 1, y + 1, 6, 2, '#0f2a24');
      fill(a, x, y, 4, 4, '#0f2a24');
      fill(a, x + 1, y + 1, 2, 1, 'rgba(160,240,210,0.3)');
    } else {
      // fallen leaves
      for (let k = 0; k < 3; k++) fill(a, x + n(a.rng, 5), y + n(a.rng, 4), 2, 1, pick(a.rng, ['#5fae4a', '#3f7a36', '#8fbf4a']));
    }
  },
  candle(a, x, y) {
    // a candle in a mossy niche
    fill(a, x - 1, y + 4, 4, 1, '#3f7a36');
    fill(a, x, y + 1, 2, 3, '#cfd9b0');
  },
};

// ---------- Frostbound: an ice cavern ----------

const frost: Painter = {
  floor(a, px, py) {
    const T = a.tile;
    fill(a, px, py, T, T, pick(a.rng, ['#1b2d42', '#1f3349', '#192a3d']));
    // ice slabs with a cold glint
    fill(a, px, py, T, 1, 'rgba(200,235,255,0.12)');
    fill(a, px, py, 1, T, 'rgba(200,235,255,0.08)');
    fill(a, px, py + T - 1, T, 1, 'rgba(0,10,30,0.4)');
    if (a.rng() < 0.4) {
      const gx = px + 3 + n(a.rng, 8);
      const gy = py + 3 + n(a.rng, 8);
      for (let k = 0; k < 4; k++) fill(a, gx + k, gy - k, 1, 1, 'rgba(220,245,255,0.28)');
    }
    if (a.rng() < 0.25) {
      // a frost crack
      let x = px + 2 + n(a.rng, 10);
      let y = py + 2 + n(a.rng, 6);
      for (let k = 0; k < 6; k++) {
        fill(a, x, y, 1, 1, '#4f86b4');
        x += a.rng() < 0.5 ? 1 : 0;
        y += 1;
      }
    }
    // snow dust
    for (let k = 0; k < 5; k++) fill(a, px + n(a.rng, 16), py + n(a.rng, 16), 1, 1, 'rgba(230,245,255,0.45)');
  },
  wall(a, px, py, s) {
    const T = a.tile;
    fill(a, px, py, T, T, '#4f80ab');
    // ice blocks with bright facets and dark seams
    for (let row = 0; row < 2; row++) {
      const by = py + 1 + row * 7;
      for (let bx = px + (row ? -4 : 0); bx < px + T; bx += 8) {
        const x0 = Math.max(px, bx);
        const x1 = Math.min(px + T, bx + 8);
        if (x1 <= x0) continue;
        fill(a, x0, by, x1 - x0, 7, pick(a.rng, ['#5f93c0', '#6aa0cb', '#5889b6']));
        fill(a, x0, by, x1 - x0, 1, '#a8d8f5');
        fill(a, x0, by, 1, 7, 'rgba(200,240,255,0.45)');
        fill(a, x1 - 1, by + 1, 1, 6, '#3d6c96');
        // a shine across the face
        if (a.rng() < 0.6) for (let k = 0; k < 3; k++) fill(a, x0 + 2 + k, by + 4 - k, 1, 1, 'rgba(255,255,255,0.6)');
      }
    }
    if (s.topOpen) {
      // a cap of snow
      fill(a, px, py, T, 2, '#eaf6ff');
      for (let k = 0; k < 4; k++) fill(a, px + n(a.rng, 14), py + 2, 2 + n(a.rng, 2), 1, '#d3e9fa');
      fill(a, px, py + 3, T, 1, 'rgba(120,170,210,0.4)');
    }
    if (s.open) {
      fill(a, px, py + T - 3, T, 3, '#3b6890');
      fill(a, px, py + T - 1, T, 1, '#1d3a57');
    }
    wallShade(a, px, py, s);
  },
  under(a, px, py) {
    // icicles hanging down over the floor
    let x = px + n(a.rng, 3);
    while (x < px + 15) {
      const len = 2 + n(a.rng, 5);
      fill(a, x, py, 2, Math.ceil(len / 2), '#bfe4fb');
      fill(a, x, py, 1, len, '#dff3ff');
      fill(a, x, py + len, 1, 1, 'rgba(255,255,255,0.8)');
      x += 3 + n(a.rng, 4);
    }
  },
  against(a, px, py) {
    // a snow drift banked against the wall
    const w = 6 + n(a.rng, 10);
    const x = px + n(a.rng, a.tile - w + 1);
    fill(a, x, py + 4, w, 2, '#c6e0f4');
    fill(a, x + 1, py + 3, w - 2, 1, '#e6f4ff');
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.4) {
      // a shard of ice sticking up
      fill(a, x, y + 1, 2, 4, '#9fd8ff');
      fill(a, x + 1, y, 1, 1, '#e6f6ff');
      fill(a, x + 2, y + 3, 1, 2, '#6aa8d8');
      fill(a, x - 1, y + 5, 4, 1, 'rgba(0,10,30,0.4)');
    } else if (r < 0.75) {
      // a little drift
      fill(a, x - 1, y + 2, 6, 2, '#b9d6ef');
      fill(a, x, y + 1, 4, 1, '#e6f4ff');
    } else {
      // a frozen skull
      fill(a, x, y, 4, 3, '#cfe3f2');
      fill(a, x + 1, y + 1, 1, 1, '#2a4a6a');
      fill(a, x + 3, y + 1, 1, 1, '#2a4a6a');
      fill(a, x - 1, y + 3, 6, 1, 'rgba(160,220,255,0.35)');
    }
  },
  candle(a, x, y) {
    // a candle frozen into the ice
    fill(a, x - 1, y + 3, 4, 2, '#a8d8f5');
    fill(a, x, y + 1, 2, 3, '#e8f4ff');
  },
};

// ---------- Crimson Court: a vampire lord's halls ----------

const crimson: Painter = {
  floor(a, px, py, x, y) {
    const T = a.tile;
    // black and blood-red marble, two squares a tile
    for (let q = 0; q < 4; q++) {
      const qx = q % 2;
      const qy = q >> 1;
      const dark = (x * 2 + qx + y * 2 + qy) % 2 === 0;
      fill(a, px + qx * 8, py + qy * 8, 8, 8, dark ? '#13060a' : '#2c0a12');
    }
    // marble veins and a polished sheen
    if (a.rng() < 0.6) {
      let vx = px + n(a.rng, 12);
      let vy = py + n(a.rng, 6);
      for (let k = 0; k < 7; k++) {
        fill(a, vx, vy, 1, 1, 'rgba(255,190,200,0.07)');
        vx += 1;
        vy += a.rng() < 0.6 ? 1 : 0;
      }
    }
    fill(a, px, py, T, 1, 'rgba(255,200,200,0.06)');
    fill(a, px + 1, py + 1, 2, 1, 'rgba(255,230,230,0.12)');
  },
  wall(a, px, py, s) {
    const T = a.tile;
    // red velvet with a damask pattern
    fill(a, px, py, T, T, '#5e1424');
    for (let dy = 2; dy < T - 3; dy += 5) {
      for (let dx = (dy % 2) * 2 + 1; dx < T; dx += 5) {
        fill(a, px + dx + 1, py + dy, 1, 1, '#8a2a3c');
        fill(a, px + dx, py + dy + 1, 3, 1, '#7a2234');
        fill(a, px + dx + 1, py + dy + 2, 1, 1, '#8a2a3c');
      }
    }
    if (s.topOpen) {
      // gilded moulding along the top
      fill(a, px, py, T, 2, '#8a6a2a');
      fill(a, px, py, T, 1, '#e0b85a');
    }
    if (s.open) {
      // dark wood wainscot with a gold rail
      fill(a, px, py + T - 5, T, 5, '#24100c');
      fill(a, px, py + T - 5, T, 1, '#c9a14a');
      fill(a, px + 2, py + T - 3, 5, 1, '#3a1c14');
      fill(a, px + 9, py + T - 3, 5, 1, '#3a1c14');
      fill(a, px, py + T - 1, T, 1, '#0c0504');
    }
    wallShade(a, px, py, s);
  },
  under(a, px, py) {
    // a heavy curtain swag, now and then
    if (a.rng() < 0.3) {
      fill(a, px + 1, py, 14, 2, '#7a1426');
      fill(a, px + 3, py + 2, 10, 1, '#5e0f1d');
      fill(a, px + 1, py, 2, 5, '#7a1426');
      fill(a, px + 13, py, 2, 5, '#7a1426');
      fill(a, px + 1, py + 5, 2, 1, '#c9a14a');
      fill(a, px + 13, py + 5, 2, 1, '#c9a14a');
    }
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.45) {
      // rose petals
      for (let k = 0; k < 4; k++) fill(a, x + n(a.rng, 6), y + n(a.rng, 4), 2, 1, pick(a.rng, ['#a3182e', '#c8263f', '#7a1020']));
    } else if (r < 0.75) {
      // a spilt goblet
      fill(a, x, y, 3, 2, '#c9a14a');
      fill(a, x + 1, y + 2, 1, 2, '#c9a14a');
      fill(a, x + 3, y + 1, 4, 2, 'rgba(140,10,30,0.7)');
    } else {
      // a pool of something dark
      fill(a, x - 1, y + 1, 7, 3, 'rgba(110,8,24,0.65)');
      fill(a, x + 1, y, 3, 5, 'rgba(110,8,24,0.65)');
      fill(a, x + 1, y + 1, 1, 1, 'rgba(255,120,140,0.35)');
    }
  },
  candle(a, x, y) {
    // a gold candelabrum
    fill(a, x - 2, y + 4, 6, 1, '#c9a14a');
    fill(a, x, y + 5, 2, 2, '#8a6a2a');
    fill(a, x - 2, y + 2, 1, 2, '#c9a14a');
    fill(a, x + 3, y + 2, 1, 2, '#c9a14a');
    fill(a, x, y + 1, 2, 3, '#f2e6d0');
  },
};

// ---------- Gilded Tomb: a buried king's tomb ----------

// Carved signs for the frieze: little 4x4 pictures, row by row.
const GLYPHS = [
  ['.##.', '#..#', '.##.', '....'],
  ['#..#', '.##.', '.##.', '#..#'],
  ['.#..', '###.', '.#..', '.#..'],
  ['#.#.', '.#.#', '#.#.', '.#.#'],
  ['.##.', '####', '.#..', '.##.'],
  ['#...', '##..', '###.', '####'],
];

const gilded: Painter = {
  floor(a, px, py) {
    const T = a.tile;
    fill(a, px, py, T, T, pick(a.rng, ['#4a3a22', '#4f3e25', '#45361f']));
    // big sandstone slabs
    fill(a, px, py, T, 1, '#5e4b2e');
    fill(a, px, py, 1, T, '#584629');
    fill(a, px, py + T - 1, T, 1, '#2a1f10');
    fill(a, px + T - 1, py, 1, T, '#2f2312');
    if (a.rng() < 0.05) {
      // a slab with gold inlay
      fill(a, px + 3, py + 3, 10, 1, '#8a6a2a');
      fill(a, px + 3, py + 12, 10, 1, '#6b5426');
      fill(a, px + 3, py + 3, 1, 10, '#8a6a2a');
      fill(a, px + 12, py + 3, 1, 10, '#6b5426');
      fill(a, px + 7, py + 7, 2, 2, '#a8781f');
    }
    // sand blown in
    for (let k = 0; k < 6; k++) fill(a, px + n(a.rng, 15), py + n(a.rng, 15), 1, 1, a.rng() < 0.6 ? 'rgba(200,165,100,0.35)' : 'rgba(0,0,0,0.2)');
  },
  wall(a, px, py, s) {
    const T = a.tile;
    fill(a, px, py, T, T, '#a88a58');
    fill(a, px, py + 8, T, 1, '#6a5430');
    fill(a, px + (py % 32 ? 4 : 11), py, 1, 8, '#6a5430');
    fill(a, px + (py % 32 ? 11 : 4), py + 9, 1, 7, '#6a5430');
    // a frieze of carved signs
    const glyph = pick(a.rng, GLYPHS);
    glyph.forEach((row, gy) => [...row].forEach((ch, gx) => ch === '#' && fill(a, px + 6 + gx, py + 2 + gy, 1, 1, '#6e5530')));
    if (s.topOpen) {
      // a band of gold leaf along the top
      fill(a, px, py, T, 2, '#d9a83a');
      fill(a, px, py, T, 1, '#ffe39a');
      if (a.rng() < 0.4) fill(a, px + n(a.rng, 14), py, 1, 1, '#ffffff');
    }
    if (s.open) {
      fill(a, px, py + T - 4, T, 4, '#6e5832');
      fill(a, px, py + T - 4, T, 1, '#c2a263');
      fill(a, px + 7, py + T - 3, 2, 2, '#d9a83a');
      fill(a, px, py + T - 1, T, 1, '#2a1f10');
    }
    wallShade(a, px, py, s);
  },
  against(a, px, py) {
    // sand piled against the wall
    const w = 7 + n(a.rng, 9);
    const x = px + n(a.rng, a.tile - w + 1);
    fill(a, x, py + 3, w, 2, '#a8894f');
    fill(a, x + 1, py + 2, w - 2, 1, '#c2a263');
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.4) {
      // spilt coins
      for (let k = 0; k < 4; k++) {
        const cx = x + n(a.rng, 6);
        const cy = y + n(a.rng, 4);
        fill(a, cx, cy, 2, 1, '#ffd36a');
        fill(a, cx, cy + 1, 2, 1, '#b8862a');
      }
    } else if (r < 0.75) {
      // a cracked urn on its side
      fill(a, x, y, 5, 3, '#8a5a32');
      fill(a, x + 5, y + 1, 1, 1, '#8a5a32');
      fill(a, x + 1, y, 3, 1, '#b07a44');
      fill(a, x + 2, y + 1, 1, 2, '#3d2614');
    } else {
      // a drift of sand
      fill(a, x - 1, y + 2, 7, 2, '#a8894f');
      fill(a, x, y + 1, 5, 1, '#c2a263');
    }
  },
  candle(a, x, y) {
    // an oil lamp in a gold sconce
    fill(a, x - 1, y + 3, 4, 2, '#d9a83a');
    fill(a, x - 2, y + 3, 1, 1, '#b8862a');
    fill(a, x, y + 2, 2, 1, '#8a5a32');
  },
};

// ---------- Sunken Ruins: a drowned temple ----------

const sunken: Painter = {
  floor(a, px, py) {
    const T = a.tile;
    fill(a, px, py, T, T, pick(a.rng, ['#0e2a2e', '#10302f', '#0c2629']));
    // worn stone slabs under shallow water, light rippling over them
    fill(a, px, py, T, 1, 'rgba(160,240,230,0.08)');
    fill(a, px, py + T - 1, T, 1, 'rgba(0,10,12,0.45)');
    fill(a, px + T - 1, py, 1, T, 'rgba(0,10,12,0.35)');
    for (let k = 0; k < 2; k++) {
      const y = py + 3 + n(a.rng, 10);
      const x = px + n(a.rng, 8);
      fill(a, x, y, 3 + n(a.rng, 4), 1, 'rgba(140,240,225,0.16)');
    }
    for (let k = 0; k < 4; k++) fill(a, px + n(a.rng, 15), py + n(a.rng, 15), 1, 1, a.rng() < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(120,200,190,0.18)');
  },
  wall(a, px, py, s) {
    const T = a.tile;
    fill(a, px, py, T, T, '#2a5050');
    // big blocks slick with water, crusted with barnacles
    for (let row = 0; row < 2; row++) {
      const by = py + 1 + row * 7;
      for (let bx = px + (row ? -5 : 0); bx < px + T; bx += 10) {
        const x0 = Math.max(px, bx + 1);
        const x1 = Math.min(px + T, bx + 10);
        if (x1 <= x0) continue;
        fill(a, x0, by, x1 - x0, 6, pick(a.rng, ['#3a6a68', '#356260', '#40726e']));
        fill(a, x0, by, x1 - x0, 1, 'rgba(200,255,245,0.14)');
      }
    }
    for (let k = 0; k < 3; k++) {
      const x = px + n(a.rng, 14);
      const y = py + 2 + n(a.rng, 10);
      fill(a, x, y, 2, 2, '#a8c8c0');
      fill(a, x, y, 1, 1, '#e8fffb');
    }
    // water running down the face
    if (a.rng() < 0.5) fill(a, px + 2 + n(a.rng, 12), py + 2, 1, 8 + n(a.rng, 5), 'rgba(160,240,230,0.35)');
    if (s.topOpen) {
      fill(a, px, py, T, 1, '#6aa8a0');
      for (let k = 0; k < 3; k++) fill(a, px + n(a.rng, 14), py, 2, 1, '#9ff5ea');
    }
    if (s.open) {
      fill(a, px, py + T - 3, T, 3, '#1c3c3c');
      fill(a, px, py + T - 1, T, 1, '#081a1a');
    }
    wallShade(a, px, py, s);
  },
  under(a, px, py) {
    // kelp swaying up from the foot of the wall
    if (a.rng() < 0.5) {
      const x = px + 2 + n(a.rng, 12);
      for (let k = 0; k < 6; k++) fill(a, x + (k % 2), py + 1 + k, 1, 1, k < 3 ? '#2a8a6a' : '#1f6a52');
    }
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.35) {
      // a starfish
      fill(a, x + 1, y, 1, 3, '#e0703a');
      fill(a, x, y + 1, 3, 1, '#e0703a');
      fill(a, x + 1, y + 1, 1, 1, '#ffb07a');
    } else if (r < 0.7) {
      // a shell
      fill(a, x, y + 1, 4, 2, '#d8c8b0');
      fill(a, x + 1, y, 2, 1, '#f0e4d0');
      fill(a, x + 1, y + 1, 1, 2, '#a8987a');
    } else {
      // a sunken urn, broken
      fill(a, x, y, 3, 4, '#4a7a70');
      fill(a, x + 3, y + 2, 2, 1, '#4a7a70');
      fill(a, x + 1, y, 1, 1, '#8ac8b8');
    }
  },
  candle(a, x, y) {
    // a lamp shell holding a sea-glow
    fill(a, x - 1, y + 3, 4, 2, '#d8c8b0');
    fill(a, x - 1, y + 3, 4, 1, '#f0e4d0');
  },
};

// ---------- Infernal Forge: black iron and obsidian ----------

const infernal: Painter = {
  floor(a, px, py) {
    const T = a.tile;
    fill(a, px, py, T, T, pick(a.rng, ['#1a0d0a', '#1e100c', '#170b08']));
    // iron plates with rivets, and the odd crack showing the heat beneath
    fill(a, px, py, T, 1, 'rgba(255,140,80,0.06)');
    fill(a, px, py + T - 1, T, 1, '#080302');
    fill(a, px + T - 1, py, 1, T, '#080302');
    fill(a, px + 2, py + 2, 1, 1, '#4a3a34');
    fill(a, px + T - 3, py + T - 3, 1, 1, '#4a3a34');
    if (a.rng() < 0.3) {
      let x = px + 3 + n(a.rng, 8);
      let y = py + 2 + n(a.rng, 6);
      for (let k = 0; k < 6; k++) {
        fill(a, x, y, 1, 1, k % 2 ? '#ff6a1a' : '#d2401a');
        x += a.rng() < 0.5 ? 1 : 0;
        y += 1;
      }
    }
  },
  wall(a, px, py, s) {
    const T = a.tile;
    fill(a, px, py, T, T, '#1e1412');
    // obsidian blocks with glowing seams of lava between them
    for (let row = 0; row < 2; row++) {
      const by = py + 1 + row * 7;
      for (let bx = px + (row ? -4 : 0); bx < px + T; bx += 8) {
        const x0 = Math.max(px, bx);
        const x1 = Math.min(px + T, bx + 7);
        if (x1 <= x0) continue;
        fill(a, x0, by, x1 - x0, 6, pick(a.rng, ['#2a1c1a', '#241816', '#30201c']));
        fill(a, x0, by, x1 - x0, 1, 'rgba(255,200,170,0.12)');
        // a glassy glint
        if (a.rng() < 0.4) fill(a, x0 + 1 + n(a.rng, Math.max(1, x1 - x0 - 2)), by + 2, 1, 2, 'rgba(255,220,200,0.35)');
      }
      fill(a, px, by + 6, T, 1, a.rng() < 0.6 ? '#ff6a1a' : '#b8401a');
    }
    if (s.topOpen) {
      fill(a, px, py, T, 1, '#ffb04a');
      fill(a, px, py + 1, T, 1, '#b8401a');
    }
    if (s.open) {
      fill(a, px, py + T - 3, T, 3, '#140a08');
      fill(a, px, py + T - 3, T, 1, '#5a2a1a');
      fill(a, px, py + T - 1, T, 1, '#060202');
    }
    wallShade(a, px, py, s);
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.4) {
      // a cooling slag puddle
      fill(a, x - 1, y + 1, 6, 2, '#5a1a0a');
      fill(a, x, y, 4, 1, '#d2401a');
      fill(a, x + 1, y + 1, 2, 1, '#ffb04a');
    } else if (r < 0.7) {
      // chains on the floor
      for (let k = 0; k < 4; k++) fill(a, x + k * 2, y + (k % 2), 2, 1, '#6a5a54');
    } else {
      // a half-forged blade
      fill(a, x - 1, y + 1, 7, 1, '#8a7a70');
      fill(a, x + 4, y + 1, 2, 1, '#ff8a3a');
      fill(a, x - 2, y, 1, 3, '#4a3a34');
    }
  },
  candle(a, x, y) {
    // an iron brazier
    fill(a, x - 2, y + 3, 6, 2, '#3a2a24');
    fill(a, x - 2, y + 3, 6, 1, '#6a5a54');
    fill(a, x, y + 5, 2, 2, '#2a1c1a');
  },
};

// ---------- Witchwood: a crypt grown through by a haunted wood ----------

const witchwood: Painter = {
  floor(a, px, py) {
    const T = a.tile;
    fill(a, px, py, T, T, pick(a.rng, ['#14101e', '#17121f', '#120e1b']));
    // dark earth, dead leaves and roots running through
    for (let k = 0; k < 6; k++) fill(a, px + n(a.rng, 15), py + n(a.rng, 15), 1, 1, a.rng() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(150,120,200,0.12)');
    if (a.rng() < 0.35) {
      let x = px + n(a.rng, 4);
      let y = py + 3 + n(a.rng, 10);
      for (let k = 0; k < 12; k++) {
        fill(a, x, y, 1, 1, '#3a2820');
        x += 1;
        if (a.rng() < 0.35) y += a.rng() < 0.5 ? 1 : -1;
      }
    }
    if (a.rng() < 0.25) fill(a, px + 2 + n(a.rng, 11), py + 2 + n(a.rng, 11), 2, 1, pick(a.rng, ['#6a4a2a', '#8a5a2a', '#5a3a5a']));
  },
  wall(a, px, py, s) {
    const T = a.tile;
    // gnarled trunks and roots grown into the old stone
    fill(a, px, py, T, T, '#2a2236');
    for (let k = 0; k < 3; k++) {
      const x = px + 1 + k * 5 + n(a.rng, 2);
      fill(a, x, py, 3, T, pick(a.rng, ['#3a2a22', '#45322a', '#33241e']));
      fill(a, x, py, 1, T, 'rgba(255,220,200,0.08)');
      for (let y = py + 2; y < py + T; y += 4) fill(a, x + 1, y, 1, 1, '#1e140f');
    }
    if (a.rng() < 0.45) {
      // a knot with a pale eye in it
      const x = px + 3 + n(a.rng, 9);
      const y = py + 4 + n(a.rng, 6);
      fill(a, x, y, 3, 2, '#1e140f');
      fill(a, x + 1, y, 1, 1, '#c79bff');
    }
    if (s.topOpen) {
      fill(a, px, py, T, 2, '#2e3a1e');
      for (let k = 0; k < 4; k++) fill(a, px + n(a.rng, 15), py, 1, 1, '#8fbf4a');
    }
    if (s.open) {
      fill(a, px, py + T - 3, T, 3, '#1a1220');
      fill(a, px, py + T - 1, T, 1, '#0a0610');
    }
    wallShade(a, px, py, s);
  },
  under(a, px, py) {
    // roots reaching out across the floor
    if (a.rng() < 0.6) {
      let x = px + 2 + n(a.rng, 11);
      for (let k = 0; k < 6; k++) {
        fill(a, x, py + k, 1, 1, '#3a2820');
        if (a.rng() < 0.4) x += a.rng() < 0.5 ? 1 : -1;
      }
    }
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.45) {
      // toadstools, red caps with white spots
      fill(a, x + 1, y + 2, 1, 2, '#e6dcf2');
      fill(a, x, y + 1, 3, 1, '#c8263f');
      fill(a, x + 1, y, 1, 1, '#c8263f');
      fill(a, x, y + 1, 1, 1, '#ffffff');
    } else if (r < 0.75) {
      // a ring of pale stones
      for (const [dx, dy] of [[0, 1], [1, 0], [3, 0], [4, 1], [1, 3], [3, 3]]) fill(a, x + dx, y + dy, 1, 1, '#9a8cb0');
    } else {
      // a fallen raven's feather
      fill(a, x, y + 2, 5, 1, '#1e1828');
      fill(a, x + 1, y + 1, 3, 1, '#2e2640');
    }
  },
  candle(a, x, y) {
    // a candle in a hollowed gourd
    fill(a, x - 1, y + 3, 4, 3, '#8a5a2a');
    fill(a, x, y + 4, 2, 1, '#d8ff7a');
  },
};

// ---------- Astral Observatory: navy marble and brass ----------

const astral: Painter = {
  floor(a, px, py, x, y) {
    const T = a.tile;
    fill(a, px, py, T, T, (x + y) % 2 ? '#10163a' : '#0c1230');
    // marble veins, and every so often a brass star inlaid
    if (a.rng() < 0.5) {
      let vx = px + n(a.rng, 12);
      let vy = py + n(a.rng, 6);
      for (let k = 0; k < 7; k++) {
        fill(a, vx, vy, 1, 1, 'rgba(200,210,255,0.1)');
        vx += 1;
        vy += a.rng() < 0.6 ? 1 : 0;
      }
    }
    if (a.rng() < 0.12) {
      const cx = px + 7;
      const cy = py + 7;
      fill(a, cx, cy - 3, 1, 7, '#a8884a');
      fill(a, cx - 3, cy, 7, 1, '#a8884a');
      fill(a, cx, cy, 1, 1, '#e6c27a');
    }
    for (let k = 0; k < 2; k++) fill(a, px + n(a.rng, 15), py + n(a.rng, 15), 1, 1, 'rgba(220,230,255,0.35)');
    fill(a, px, py + T - 1, T, 1, 'rgba(0,0,10,0.4)');
  },
  wall(a, px, py, s) {
    const T = a.tile;
    fill(a, px, py, T, T, '#1c2450');
    // panels edged in brass, with star charts traced on them
    fill(a, px + 1, py + 1, T - 2, T - 2, '#232c60');
    fill(a, px + 1, py + 1, T - 2, 1, '#e6c27a');
    fill(a, px + 1, py + T - 2, T - 2, 1, '#8a6a2a');
    const stars: [number, number][] = [];
    for (let k = 0; k < 3; k++) stars.push([px + 3 + n(a.rng, 10), py + 4 + n(a.rng, 8)]);
    for (let k = 0; k < stars.length - 1; k++) {
      const [x0, y0] = stars[k];
      const [x1, y1] = stars[k + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) fill(a, Math.round(x0 + ((x1 - x0) * i) / Math.max(1, steps)), Math.round(y0 + ((y1 - y0) * i) / Math.max(1, steps)), 1, 1, 'rgba(160,180,255,0.35)');
    }
    for (const [x, y] of stars) fill(a, x, y, 1, 1, '#ffffff');
    if (s.topOpen) fill(a, px, py, T, 1, '#ffe39a');
    if (s.open) {
      fill(a, px, py + T - 3, T, 3, '#141a40');
      fill(a, px, py + T - 3, T, 1, '#a8884a');
      fill(a, px, py + T - 1, T, 1, '#05071a');
    }
    wallShade(a, px, py, s);
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.4) {
      // a fallen brass ring of an orrery
      fill(a, x, y, 5, 1, '#e6c27a');
      fill(a, x, y + 3, 5, 1, '#a8884a');
      fill(a, x, y, 1, 4, '#c8a25a');
      fill(a, x + 4, y, 1, 4, '#c8a25a');
    } else if (r < 0.7) {
      // a rolled star chart
      fill(a, x, y + 1, 6, 2, '#e6dcc4');
      fill(a, x, y + 1, 1, 2, '#a89a80');
      fill(a, x + 2, y + 1, 1, 1, '#3a4aa8');
    } else {
      // a lens catching the light
      fill(a, x + 1, y, 2, 3, '#9aa8ff');
      fill(a, x + 1, y, 1, 1, '#ffffff');
    }
  },
  candle(a, x, y) {
    // a brass lamp
    fill(a, x - 1, y + 3, 4, 1, '#e6c27a');
    fill(a, x, y + 4, 2, 2, '#a8884a');
  },
};

// ---------- Neon Tomb: glowing grid and tube-lit walls ----------

const neon: Painter = {
  floor(a, px, py) {
    const T = a.tile;
    fill(a, px, py, T, T, '#0a0418');
    // a glowing grid, brighter where the lines cross
    fill(a, px, py, T, 1, 'rgba(255,58,216,0.35)');
    fill(a, px, py, 1, T, 'rgba(58,240,255,0.3)');
    fill(a, px, py, 1, 1, '#ff9ae8');
    if (a.rng() < 0.2) fill(a, px + 2 + n(a.rng, 12), py + 2 + n(a.rng, 12), 2, 1, pick(a.rng, ['rgba(255,58,216,0.25)', 'rgba(58,240,255,0.25)']));
  },
  wall(a, px, py, s) {
    const T = a.tile;
    fill(a, px, py, T, T, '#140a2c');
    fill(a, px + 1, py + 1, T - 2, T - 2, '#1a0c38');
    // tube lights along the edges that face the room
    if (s.topOpen) {
      fill(a, px, py, T, 2, 'rgba(255,58,216,0.35)');
      fill(a, px, py, T, 1, '#ff6ae8');
    }
    if (s.open) {
      fill(a, px, py + T - 3, T, 3, '#0e0620');
      fill(a, px, py + T - 3, T, 1, '#3af0ff');
      fill(a, px, py + T - 2, T, 1, 'rgba(58,240,255,0.3)');
    }
    if (s.leftOpen) fill(a, px, py + 1, 1, T - 2, 'rgba(255,58,216,0.6)');
    if (s.rightOpen) fill(a, px + T - 1, py + 1, 1, T - 2, 'rgba(58,240,255,0.6)');
    // a sign glyph now and then
    if (a.rng() < 0.25) {
      const x = px + 5 + n(a.rng, 4);
      const y = py + 5 + n(a.rng, 3);
      fill(a, x, y, 4, 1, '#ff3ad8');
      fill(a, x, y, 1, 4, '#ff3ad8');
      fill(a, x, y + 3, 4, 1, '#ff3ad8');
    }
    wallShade(a, px, py, s);
  },
  litter(a, px, py) {
    const r = a.rng();
    const x = px + 3 + n(a.rng, 8);
    const y = py + 4 + n(a.rng, 7);
    if (r < 0.45) {
      // a puddle reflecting the lights
      fill(a, x - 1, y + 1, 6, 2, '#120628');
      fill(a, x, y + 1, 2, 1, 'rgba(255,58,216,0.6)');
      fill(a, x + 3, y + 2, 2, 1, 'rgba(58,240,255,0.6)');
    } else if (r < 0.75) {
      // a broken tube, still flickering
      fill(a, x, y + 2, 5, 1, '#3af0ff');
      fill(a, x + 5, y + 1, 1, 1, '#9af8ff');
    } else {
      // cables
      for (let k = 0; k < 6; k++) fill(a, x + k, y + (k % 3 === 0 ? 0 : 1), 1, 1, '#2a1a4a');
    }
  },
  candle(a, x, y) {
    // a neon holder
    fill(a, x - 1, y + 3, 4, 1, '#ff3ad8');
    fill(a, x, y + 4, 2, 1, '#3af0ff');
  },
};

const PAINTERS: Partial<Record<ThemeId, Painter>> = { ashen, verdigris, frost, crimson, gilded, sunken, infernal, witchwood, astral, neon };

/** Whether a theme rebuilds the board in its own materials. */
export function hasBoardArt(id: ThemeId): boolean {
  return Boolean(PAINTERS[id]);
}

/** Rebuild the board's floors and walls in the theme's materials (over what's there). */
export function paintBoard(id: ThemeId, a: BoardArt) {
  const p = PAINTERS[id];
  if (!p) return;
  const { w, h, tile: T, wallAt } = a;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!wallAt(x, y)) p.floor(a, x * T, y * T, x, y);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (wallAt(x, y)) continue;
      const px = x * T;
      const py = y * T;
      // floor darkens into the walls beside it
      if (x > 0 && wallAt(x - 1, y)) fill(a, px, py, 2, T, 'rgba(0,0,0,0.25)');
      if (x + 1 < w && wallAt(x + 1, y)) fill(a, px + T - 2, py, 2, T, 'rgba(0,0,0,0.3)');
      if (y > 0 && wallAt(x, y - 1) && p.against && a.rng() < 0.5) p.against(a, px, py);
      if (a.rng() < 0.09) p.litter(a, px, py);
    }
  }
  if (a.boss) {
    // a boss's floor runs darker and redder
    a.ctx.fillStyle = 'rgba(90,10,20,0.22)';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!wallAt(x, y)) a.ctx.fillRect(x * T, y * T, T, T);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!wallAt(x, y)) continue;
      const sides: Sides = {
        open: y + 1 < h && !wallAt(x, y + 1),
        topOpen: y === 0 || !wallAt(x, y - 1),
        leftOpen: x > 0 && !wallAt(x - 1, y),
        rightOpen: x + 1 < w && !wallAt(x + 1, y),
      };
      p.wall(a, x * T, y * T, sides);
    }
  }
  // what hangs from the walls goes over the floor below them
  if (p.under) for (let y = 0; y + 1 < h; y++) for (let x = 0; x < w; x++) if (wallAt(x, y) && !wallAt(x, y + 1)) p.under(a, x * T, (y + 1) * T);
  for (const c of a.candles) p.candle(a, c.x, c.y);
}
