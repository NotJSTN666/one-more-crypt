// The themes' dressing outside the board: pixel ornaments for buttons (handed to
// themes.css as CSS images), and a light fall of the theme's particles over the menus.

type Grid = string[];

/** A pixel picture as an SVG data URL; `flip` mirrors it across (x), down (y) or both. */
function art(rows: Grid, pal: Record<string, string>, flip = ''): string {
  const h = rows.length;
  const w = rows[0].length;
  let rects = '';
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = pal[ch];
      if (!c) return;
      const fx = flip.includes('x') ? w - 1 - x : x;
      const fy = flip.includes('y') ? h - 1 - y : y;
      rects += `<rect x='${fx}' y='${fy}' width='1' height='1' fill='${c}'/>`;
    }),
  );
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w * 2}' height='${h * 2}' viewBox='0 0 ${w} ${h}' shape-rendering='crispEdges'>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** A corner ornament drawn for the top left, and its mirror images for the other three. */
function corners(rows: Grid, pal: Record<string, string>): Record<string, string> {
  return {
    '--orn-tl': art(rows, pal),
    '--orn-tr': art(rows, pal, 'x'),
    '--orn-bl': art(rows, pal, 'y'),
    '--orn-br': art(rows, pal, 'xy'),
  };
}

const ORNAMENTS: Record<string, Record<string, string>> = {
  // chipped corners and hairline cracks
  ashen: corners(
    ['kkkkk...', 'kkkk....', 'kkk.c...', 'kk...c..', 'k....c..', '......c.', '........', '........'],
    { k: 'rgba(0,0,0,0.6)', c: 'rgba(0,0,0,0.45)' },
  ),
  // a sprig of ivy in two corners
  verdigris: {
    ...corners(
      ['.gg.....', 'gLLg.g..', 'gLLggLg.', '.gg.vLg.', '...v.g..', '..v.....', '.v......', 'v.......'],
      { g: '#2f6a2a', L: '#6dbf4c', v: '#3d7f35' },
    ),
    '--orn-tr': 'none',
    '--orn-bl': 'none',
  },
  // frost crystals in the corners, snow along the top and icicles hanging below
  frost: {
    ...corners(
      ['w.......', '.W.w....', '.wW.....', '..W.....', '.w.W....', '........', '........', '........'],
      { w: 'rgba(220,240,255,0.7)', W: '#ffffff' },
    ),
    '--orn-top': art(['.....ssss...............', 'ssssssssssssss....ssssss', '.ss..s.ss.s.....ssss.ss.'], { s: '#eaf6ff' }),
    '--orn-bottom': art(
      ['..wW.......wWw...........W.w..', '..wW........Ww............w...', '...W........W.................', '...w........w.................', '............w.................', '................................'.slice(0, 30)],
      { w: '#bfe4fb', W: '#ffffff' },
    ),
  },
  // gold filigree brackets
  crimson: corners(
    ['GGGGGGG.', 'GddddGG.', 'Gd......', 'Gd.GG...', 'Gd.G....', 'GG......', 'G.......', '........'],
    { G: '#e0b85a', d: '#8a6a2a' },
  ),
  // gold corners set with a turquoise stone
  gilded: corners(
    ['GGGGGGGG', 'GYYYYYY.', 'GY......', 'GY.tt...', 'GY.tT...', 'GY......', 'GY......', 'G.......'],
    { G: '#ffd36a', Y: '#b8862a', t: '#2fa8a0', T: '#9ff5ec' },
  ),
  // barnacles and a curl of kelp
  sunken: corners(
    ['.bb.....', 'bBBb.k..', 'bBBb.k..', '.bb..kk.', '..b...k.', '.bBb..k.', '.bb.....', '........'],
    { b: '#6aa8a0', B: '#c8f0e8', k: '#2a8a6a' },
  ),
  // riveted iron with a glowing seam
  infernal: corners(
    ['IIIIIIII', 'IrI.....', 'III.....', 'Io......', 'Io......', 'I.......', 'I.......', 'I.......'],
    { I: '#3a2a24', r: '#8a7a70', o: '#ff6a1a' },
  ),
  // a twist of root and a hanging leaf
  witchwood: corners(
    ['RRR.....', 'R.RR....', 'R..R.L..', 'RR.RLL..', '.R......', '.R......', 'R.......', '........'],
    { R: '#5a3a2a', L: '#8fbf4a' },
  ),
  // a brass corner and a star
  astral: corners(
    ['BBBBBBB.', 'B.......', 'B..s....', 'B.sSs...', 'B..s....', 'B.......', 'B.......', '........'],
    { B: '#e6c27a', s: '#9aa8ff', S: '#ffffff' },
  ),
  // neon tube corners, pink and cyan
  neon: corners(
    ['PPPPPP..', 'P.......', 'P.CCC...', 'P.C.....', 'P.C.....', 'P.......', '........', '........'],
    { P: '#ff3ad8', C: '#3af0ff' },
  ),
};

const ORN_VARS = ['--orn-tl', '--orn-tr', '--orn-bl', '--orn-br', '--orn-top', '--orn-bottom'];

/** The CSS images for a theme's ornaments (none for Classic). */
export function ornamentVars(id: string): Record<string, string> {
  const o = ORNAMENTS[id] ?? {};
  return Object.fromEntries(ORN_VARS.map((v) => [v, o[v] ?? 'none']));
}

// ---------- particles over the menus ----------

export type FxKind = 'ash' | 'spores' | 'snow' | 'petals' | 'dust' | 'bubbles' | 'embers' | 'fireflies' | 'starlight' | 'neonrain' | null;

interface Mote { x: number; y: number; vx: number; vy: number; s: number; t: number; c: string; spin: number }

const COLORS: Record<Exclude<FxKind, null>, string[]> = {
  ash: ['#bdb7ad', '#8f8a82', '#d8d2c6', '#ff8a3a'],
  spores: ['#9cf5a0', '#d8f5a0', '#6dbf4c'],
  snow: ['#ffffff', '#e6f4ff', '#cfe8ff'],
  petals: ['#a3182e', '#c8263f', '#7a1020', '#e04a5e'],
  dust: ['#ffd36a', '#ffe39a', '#d9a83a'],
  bubbles: ['#bff8f0', '#9ff5ea', '#e8fffb'],
  embers: ['#ff6a1a', '#ffb04a', '#ffd36a'],
  fireflies: ['#eaffb0', '#d8ff7a'],
  starlight: ['#dfe6ff', '#ffffff', '#e6c27a'],
  neonrain: ['#ff3ad8', '#3af0ff'],
};
/** Kinds that hang about and fade rather than cross the screen: how long each lives. */
const LIFE: Partial<Record<Exclude<FxKind, null>, number>> = { fireflies: 7, starlight: 3.5 };

let kind: FxKind = null;
let motes: Mote[] = [];
let canvas: HTMLCanvasElement | null = null;
let running = false;
let still = () => false;
let showing = () => true;

/** Change what falls over the menus (null for nothing). */
export function setFx(k: FxKind) {
  kind = k;
  motes = [];
  if (canvas) canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  start();
}

/** Set up the layer: `calm` turns it off, `visible` says whether a menu is open. */
export function installThemeFx(calm: () => boolean, visible: () => boolean) {
  still = calm;
  showing = visible;
  canvas = document.createElement('canvas');
  canvas.id = 'theme-fx';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  start();
}

function spawn(w: number, h: number, scatter: boolean): Mote {
  const r = Math.random;
  const k = kind!;
  const c = COLORS[k][Math.floor(r() * COLORS[k].length)];
  const y = scatter ? r() * h : -6;
  if (k === 'bubbles' || k === 'embers') return { x: r() * w, y: scatter ? r() * h : h + 6, vx: (r() - 0.5) * 4, vy: -(k === 'bubbles' ? 14 + r() * 18 : 18 + r() * 26), s: r() < 0.3 ? 4 : 2, t: r() * 2, c, spin: r() * 6 };
  if (k === 'fireflies' || k === 'starlight') return { x: r() * w, y: r() * h, vx: k === 'fireflies' ? (r() - 0.5) * 14 : 0, vy: k === 'fireflies' ? (r() - 0.5) * 10 : 0, s: r() < 0.25 ? 3 : 2, t: scatter ? r() * (LIFE[k] ?? 4) : 0, c, spin: r() * 6 };
  if (k === 'neonrain') return { x: r() * (w + 60), y: scatter ? r() * h : -14, vx: -16, vy: 260 + r() * 120, s: 2, t: 0, c, spin: 0 };
  if (k === 'dust') return { x: scatter ? r() * w : -6, y: r() * h, vx: 14 + r() * 22, vy: (r() - 0.5) * 4, s: r() < 0.3 ? 3 : 2, t: r() * 9, c, spin: 0 };
  if (k === 'spores') return { x: r() * w, y: scatter ? r() * h : h + 6, vx: (r() - 0.5) * 6, vy: -(6 + r() * 10), s: r() < 0.3 ? 3 : 2, t: r() * 9, c, spin: 0 };
  const fall = k === 'snow' ? 18 + r() * 26 : k === 'ash' ? 10 + r() * 14 : 16 + r() * 16;
  return { x: r() * w, y, vx: (k === 'petals' ? 8 : 3) + (r() - 0.5) * 8, vy: fall, s: k === 'snow' && r() < 0.3 ? 4 : r() < 0.4 ? 3 : 2, t: r() * 9, c, spin: r() * 6 };
}

function start() {
  if (running || !canvas || !kind) return;
  running = true;
  let last = performance.now();
  const tick = (now: number) => {
    if (!canvas || !kind) {
      running = false;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const ctx = canvas.getContext('2d')!;
    const on = !still() && showing();
    canvas.style.opacity = on ? '1' : '0';
    if (on) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const cap = Math.round((w * h) / (kind === 'petals' ? 26000 : 14000));
      // (the first fill is spread over the screen; after that they come in from the edge)
      const fresh = motes.length === 0;
      while (motes.length < cap) motes.push(spawn(w, h, fresh));
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.t += dt;
        m.x += (m.vx + Math.sin(m.t * 1.4 + m.spin) * (kind === 'petals' ? 14 : 6)) * dt;
        m.y += m.vy * dt;
        ctx.globalAlpha = kind === 'dust' || kind === 'spores' ? 0.35 + 0.35 * Math.sin(m.t * 3) : kind === 'ash' ? 0.5 : 0.65;
        ctx.fillStyle = m.c;
        const life = LIFE[kind];
        if (life) {
          // fade in and out over its life; fireflies blink as well
          const f = Math.sin(Math.min(1, m.t / life) * Math.PI);
          ctx.globalAlpha = kind === 'fireflies' ? f * (0.3 + 0.7 * Math.max(0, Math.sin(m.t * 2.6 + m.spin))) : f * 0.8;
        }
        if (kind === 'bubbles') {
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = m.c;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2);
          ctx.stroke();
        } else if (kind === 'neonrain') {
          ctx.globalAlpha = 0.4;
          ctx.fillRect(Math.round(m.x), Math.round(m.y), 2, 12);
        } else if (kind === 'fireflies') {
          ctx.fillRect(Math.round(m.x) - 2, Math.round(m.y) - 2, 6, 6);
          ctx.globalAlpha = Math.min(1, ctx.globalAlpha * 1.6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(m.x), Math.round(m.y), 2, 2);
        } else if (kind === 'petals') {
          const flip = Math.sin(m.t * 4 + m.spin) > 0;
          ctx.fillRect(Math.round(m.x), Math.round(m.y), flip ? m.s * 2 : m.s, flip ? m.s : m.s * 2);
        } else ctx.fillRect(Math.round(m.x), Math.round(m.y), m.s, m.s);
      }
      ctx.globalAlpha = 1;
      motes = motes.filter((m) => m.y < h + 10 && m.y > -20 && m.x < w + 10 && m.x > -20 && (!LIFE[kind!] || m.t < LIFE[kind!]!));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
