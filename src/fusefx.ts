// The Soul Forge's fusion, played full screen for about three and a half seconds. A magic
// circle of runes draws itself and turns; the two relics spiral in on ribbons of light and
// come to rest on an anvil; a spectral hammer strikes three times, each blow throwing sparks
// and heating them further; on the third they become one in a bloom of light, and the new
// relic hangs there white-hot, cooling to its colours among turning rays and twinkling stars.

import { calmChosen } from './ui';

const DURATION = 3.7;
/** When the last hammer blow lands and the relics become one, in seconds (matches fusionSound). */
export const IMPACT = 1.9;
/** The hammer's three blows (fusionSound rings on the same beats). */
const STRIKES = [IMPACT - 0.9, IMPACT - 0.45, IMPACT];
/** When the two relics come to rest on the anvil. */
const LAND = 0.85;
/** How long the last blow hangs as a single white frame. */
const HOLD = 0.07;

const STEEL: Record<string, string> = { k: '#0b0a12', a: '#d5dcef', s: '#8b95b3', S: '#5d6685', D: '#3a4160', g: '#f2c14e', G: '#a8782a', n: '#8a5a34', N: '#5e3a22' };
// The anvil: horn to the left, flat face on top. The face's middle is column 22.
const ANVIL = [
  '..........kkkkkkkkkkkkkkkkkkkkkkkkk.',
  '.kkkkkkkkkaaaaaaaaaaaaaaaaaaaaaaaaak',
  'kaassssssssssssssssssssssssssssssSSk',
  '.kkSSsssssssssssssssssssssssssssSSDk',
  '...kkkSSSSSSSSSSSSSSSSSSSSSSSSSSSDDk',
  '......kkkkkDDDDDDDDDDDDDDDDDDDDDDkk.',
  '...........kkkkSSSSSSSSSSSSDkkkk....',
  '..............kSssSSSSSSSSDk........',
  '..............kSssSSSSSSSSDk........',
  '..............kSssSSSSSSSSDk........',
  '.............kSSssSSSSSSSSDDk.......',
  '...........kkSSSSSSSSSSSSSSDDkk.....',
  '.........kkaaaaaaaaaaaaaaaaaaaakk...',
  '........kSSSSSSSSSSSSSSSSSSSSSSDDk..',
  '........kSDDDDDDDDDDDDDDDDDDDDDDDk..',
  '........kkkkkkkkkkkkkkkkkkkkkkkkkk..',
];
// The hammer, lying flat: head to the left with its face down, the grip's end at (28, 6).
const HAMMER = [
  '.kkkkkkkk.....................',
  'kaaaaaaaSk....................',
  'kasssssSSk....................',
  'kasssssSDk....................',
  'kgggggggGkkkkkkkkkkkkkkkkkkkk.',
  'kasssssSDknnnnnnnnnnnnnnnnnngk',
  'kasssssSDknNNNNNNNNNNNNNNNNNGk',
  'kgggggggGkkkkkkkkkkkkkkkkkkkk.',
  'kasssssSDk....................',
  'kasssssSDk....................',
  'kSSSSSSDDk....................',
  '.kkkkkkkk.....................',
];

/** Pixel rows drawn to a small canvas, one pixel a character. */
function sprite(rows: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(...rows.map((r) => r.length));
  c.height = rows.length;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!STEEL[ch]) return;
    g.fillStyle = STEEL[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

/** A picture's shape filled with one colour: for heating a relic toward white, and for silhouettes. */
function tinted(img: CanvasImageSource, colour: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = (img as HTMLCanvasElement).width || 24;
  c.height = (img as HTMLCanvasElement).height || 24;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = colour;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

interface Spark { x: number; y: number; vx: number; vy: number; life: number; t: number; size: number; color: string; g?: number }
interface Mote { ang: number; dist: number; speed: number; size: number; color: string; px: number; py: number }

const ease = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** A small seeded random, so the circle's runes come out the same each time. */
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

/** One made-up rune: three or four strokes on a little grid. */
function rune(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: () => number) {
  const pts: [number, number][] = [[0, -1], [0, 1], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6], [0, 0], [-0.6, 0], [0.6, 0]];
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
    const a = pts[Math.floor(r() * pts.length)];
    const b = pts[Math.floor(r() * pts.length)];
    ctx.moveTo(x + a[0] * s, y + a[1] * s);
    ctx.lineTo(x + b[0] * s, y + b[1] * s);
  }
  ctx.stroke();
}

/** The two layers of the magic circle, drawn once: the rune ring, and the star within. */
function circleLayers(R: number, color: string, accent: string, dpr: number) {
  const make = (draw: (c: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(R * 2.4 * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.translate(R * 1.2, R * 1.2);
    g.lineCap = 'round';
    // Drawn twice: once wide and blurred for the glow, once sharp on top.
    for (const pass of [0, 1]) {
      g.save();
      g.shadowColor = color;
      g.shadowBlur = pass ? 6 : 18;
      g.globalAlpha = pass ? 1 : 0.6;
      draw(g);
      g.restore();
    }
    return c;
  };
  const outer = make((g) => {
    g.strokeStyle = color;
    g.lineWidth = 2;
    for (const r of [R, R * 0.86]) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, R * 1.05, 0, Math.PI * 2);
    g.stroke();
    // runes all the way round, between the two rings
    const rnd = seeded(7);
    const n = 24;
    g.lineWidth = 1.6;
    g.strokeStyle = accent;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      g.save();
      g.rotate(a);
      rune(g, R * 0.93, 0, R * 0.035, rnd);
      g.restore();
    }
    // little studs on the outermost ring
    g.fillStyle = color;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      g.beginPath();
      g.arc(Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05, 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  const inner = make((g) => {
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    const r = R * 0.72;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    // ticks round the inner ring
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const l = k % 4 === 0 ? 10 : 5;
      g.beginPath();
      g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      g.lineTo(Math.cos(a) * (r - l), Math.sin(a) * (r - l));
      g.stroke();
    }
    // a six-pointed star of two triangles, with a small circle at each point
    g.strokeStyle = accent;
    g.lineWidth = 1.8;
    for (const off of [0, Math.PI / 3]) {
      g.beginPath();
      for (let k = 0; k <= 3; k++) {
        const a = off + (k / 3) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * r * 0.86;
        const y = Math.sin(a) * r * 0.86;
        if (k) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.arc(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, 5, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    g.stroke();
  });
  return { outer, inner };
}

/** "#rrggbb" to "r,g,b", for colours that need an alpha. */
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/**
 * The colour of a relic's icon: drawn small, its vivid pixels averaged, then brightened, so
 * a flame reads orange and a storm yellow. Falls back to the given colour for a grey icon.
 */
function emojiColor(emoji: string, fallback: string, img?: CanvasImageSource | null): string {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return fallback;
  if (img) g.drawImage(img, 4, 4, 24, 24);
  else {
    g.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 16, 17);
  }
  const d = g.getImageData(0, 0, 32, 32).data;
  let r = 0, gr = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 160) continue;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]);
    const mn = Math.min(d[i], d[i + 1], d[i + 2]);
    // Only the vivid pixels: skip outlines, whites and greys.
    if (mx < 70 || mx - mn < 60) continue;
    r += d[i];
    gr += d[i + 1];
    b += d[i + 2];
    n++;
  }
  if (n < 6) return fallback;
  const avg = [r / n, gr / n, b / n];
  // Push it bright: the strongest channel up to full, the rest in proportion.
  const top = Math.max(...avg, 1);
  const out = avg.map((v) => Math.round(Math.min(255, (v / top) * 255 * 0.95 + 12)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A four-pointed twinkle. */
function twinkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

export function playFusion(opts: { a: string; b: string; out: string; name: string; ascended: boolean; onDone: () => void; aImg?: CanvasImageSource | null; bImg?: CanvasImageSource | null; outImg?: CanvasImageSource | null }) {
  if (calmChosen()) return opts.onDone();
  // The forge's own colour (blue, or gold when ascended) lights the new relic; the two relics
  // going in each bring their own colour to the circle, their trails, the sparks and the waves.
  const color = opts.ascended ? '#f2c14e' : '#7fb4ff';
  const glowRGB = opts.ascended ? '242,193,78' : '127,180,255';
  const colA = emojiColor(opts.a, color, opts.aImg);
  let colB = emojiColor(opts.b, opts.ascended ? '#ffb35a' : '#c9a8ff', opts.bImg);
  // Two relics of the same colour still get two colours: the second leans toward the forge's.
  if (colB === colA) colB = opts.ascended ? '#ffb35a' : '#c9a8ff';
  const rgbA = rgbOf(colA);
  const accentRGB = rgbOf(colB);
  const canvas = document.createElement('canvas');
  canvas.className = 'fusion-fx';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0;
  let h = 0;
  let R = 0;
  /** The size of one pixel of the anvil and hammer. */
  let u = 4;
  let layers: { outer: HTMLCanvasElement; inner: HTMLCanvasElement } | null = null;
  const size = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    R = Math.min(w, h) * 0.36;
    u = Math.max(3, Math.round(R / 30));
    layers = circleLayers(R, colA, colB, dpr);
  };
  size();
  window.addEventListener('resize', size);

  const INK = '#0b0a12';
  const anvil = sprite(ANVIL);
  const hammer = sprite(HAMMER);
  const anvilInk = tinted(anvil, INK);
  const hammerInk = tinted(hammer, INK);
  // Each relic's shape in the colours of hot metal, laid over it as it heats.
  const hot = (img?: CanvasImageSource | null) => (img ? { orange: tinted(img, '#ff8a2a'), white: tinted(img, '#ffffff'), ink: tinted(img, INK) } : null);
  const hotA = hot(opts.aImg);
  const hotB = hot(opts.bImg);
  const hotOut = hot(opts.outImg);
  const shineC = document.createElement('canvas');
  shineC.width = shineC.height = 24;

  const sparks: Spark[] = [];
  const motes: Mote[] = [];
  const trailA: { x: number; y: number }[] = [];
  const trailB: { x: number; y: number }[] = [];
  // Stars that twinkle round the new relic once it's made.
  const stars = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + i, d: 0.45 + ((i * 37) % 10) / 22, s: 4 + (i % 4) * 2, ph: i * 0.7 }));
  let fired = 0;
  let burst = false;
  let done = false;
  const start = performance.now();
  let last = start;
  const emojiFont = (px: number) => `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener('resize', size);
    canvas.remove();
    opts.onDone();
  };
  // Tap to skip.
  canvas.addEventListener('pointerdown', finish);

  const frame = (now: number) => {
    if (done) return;
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (t >= DURATION) return finish();
    const cx = w / 2;
    const cy = h * 0.46;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const charge = clamp(t / IMPACT);
    const k = ease(charge);
    const after = t - IMPACT;
    // The hammer's blows so far, and how long since the last one.
    let struck = 0;
    let since = 99;
    for (const s of STRIKES) {
      if (t >= s) {
        struck++;
        since = t - s;
      }
    }
    const punch = Math.max(0, 1 - since / 0.14);
    // How hot the relics on the anvil are: each blow leaves them hotter.
    const heat = clamp([0.12 * clamp((t - LAND) / 0.15), 0.4, 0.7, 1][struck] + 0.3 * punch);
    // A jolt with every blow, the last the hardest.
    const shake = t < IMPACT ? punch * 8 + struck * 0.8 : Math.max(0, 16 - after * 40);
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // Darkness closes in, tinted with the forge's colour toward the middle.
    const fadeOut = clamp((DURATION - t) / 0.35);
    const dark = clamp(t / 0.3) * fadeOut;
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
    bg.addColorStop(0, `rgba(18, 10, 34, ${0.86 * dark})`);
    bg.addColorStop(1, `rgba(3, 1, 7, ${0.95 * dark})`);
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    ctx.globalCompositeOperation = 'lighter';

    // The core: the glow of the work on the anvil, blooming once the relic is made.
    const core = t < IMPACT ? 24 + (0.25 * k + 0.5 * heat) * R : R * (1.1 - Math.min(0.6, after * 0.4));
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, core));
    cg.addColorStop(0, `rgba(255,255,255,${(t < IMPACT ? 0.15 + 0.35 * heat : 0.5) * fadeOut})`);
    // The core takes on both relics' colours as they draw in, and the forge's once they're one.
    const coreRGB = t < IMPACT ? (Math.sin(t * 6) > 0 ? rgbA : accentRGB) : glowRGB;
    cg.addColorStop(0.25, `rgba(${coreRGB},${0.4 * fadeOut})`);
    cg.addColorStop(0.6, `rgba(${t < IMPACT ? accentRGB : rgbA},${0.14 * fadeOut})`);
    cg.addColorStop(1, `rgba(${glowRGB},0)`);
    ctx.fillStyle = cg;
    ctx.fillRect(cx - core, cy - core, core * 2, core * 2);

    // The magic circle: it grows into being, turns faster as the work goes on, flares with
    // each blow, then bursts outward and fades with the last.
    if (layers && t < IMPACT + 0.6) {
      const grow = easeOut(clamp(t / 0.45));
      const out = Math.max(0, after);
      const scale = t < IMPACT ? 0.75 + 0.25 * grow - 0.06 * k + 0.05 * punch : 0.9 + out * 1.6;
      const alpha = (t < IMPACT ? grow : Math.max(0, 1 - out / 0.6)) * clamp(0.7 + 0.2 * Math.sin(t * 20 * k) + 0.3 * punch);
      const spin = t * 0.6 + k * 5;
      const L = layers.outer.width / dpr;
      for (const [layer, dir] of [[layers.outer, 1], [layers.inner, -1.6]] as const) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx, cy);
        ctx.rotate(spin * dir);
        ctx.scale(scale, scale * 0.92);
        ctx.drawImage(layer, -L / 2, -L / 2, L, L);
        ctx.restore();
      }
    }

    if (t < IMPACT) {
      // Motes spiralling in from the edges, faster and thicker as the charge builds.
      const want = 2 + k * 10;
      for (let n = 0; n < want * dt * 30; n++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.max(w, h) * (0.5 + Math.random() * 0.3);
        motes.push({ ang, dist, speed: 120 + Math.random() * 160, size: 1.5 + Math.random() * 2, color: Math.random() < 0.2 ? '#ffffff' : Math.random() < 0.5 ? colA : colB, px: cx + Math.cos(ang) * dist, py: cy + Math.sin(ang) * dist });
      }
    }
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.dist -= m.speed * dt * (1 + k * 3);
      m.ang += dt * (1.2 + 90 / Math.max(20, m.dist));
      if (m.dist < 14 || t > IMPACT + 0.1) {
        motes.splice(i, 1);
        continue;
      }
      const x = cx + Math.cos(m.ang) * m.dist;
      const y = cy + Math.sin(m.ang) * m.dist * 0.92;
      ctx.strokeStyle = m.color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = m.size;
      ctx.beginPath();
      ctx.moveTo(m.px, m.py);
      ctx.lineTo(x, y);
      ctx.stroke();
      m.px = x;
      m.py = y;
    }
    ctx.globalAlpha = 1;

    // ---- the anvil, the two relics on it, and the hammer ----
    const emLand = u * 11;
    const landed = clamp(t / LAND);
    const kl = 1 - (1 - landed) ** 3;
    const em = emLand * (1.6 - 0.6 * kl);
    // The anvil gives a little under each blow.
    const dip = punch * u * 0.7;
    const faceY = cy + emLand / 2 - u + dip;
    const drawAnvil = (img: HTMLCanvasElement, alpha: number, rise = 0) => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, cx - 22 * u, faceY - u + rise, img.width * u, img.height * u);
      ctx.restore();
    };
    // The hammer turns about the end of its grip: 0 is flat on the work, more is raised.
    const drawHammer = (img: HTMLCanvasElement, angle: number, alpha: number, glow = true) => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = alpha;
      ctx.translate(cx + 23 * u, cy - emLand / 2 - 6 * u + u);
      ctx.rotate(angle);
      if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
      }
      ctx.drawImage(img, -28 * u, -6 * u, img.width * u, img.height * u);
      ctx.restore();
    };
    // Where the two relics are: spiralling in until they land, then side by side on the
    // anvil's face, driven closer together by each blow.
    const SEP = [0.56, 0.36, 0.16, 0];
    const sep = em * (SEP[struck] + (struck ? (SEP[struck - 1] - SEP[struck]) * (1 - easeOut(clamp(since / 0.1))) : 0));
    const ang = (1 - kl) * 9;
    const orbit = R * 0.9 * (1 - kl);
    const pa = { x: cx + Math.cos(ang) * (orbit + sep), y: cy + Math.sin(ang) * orbit * 0.8 + dip };
    const pb = { x: cx - Math.cos(ang) * (orbit + sep), y: cy - Math.sin(ang) * orbit * 0.8 + dip };
    const drawRelics = (silhouette: boolean) => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = emojiFont(em);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.imageSmoothingEnabled = false;
      for (const [p, img, emoji, hotImg] of [[pa, opts.aImg, opts.a, hotA], [pb, opts.bImg, opts.b, hotB]] as const) {
        ctx.save();
        // Squashed flat for a moment under the hammer, from the bottom up.
        ctx.translate(p.x, p.y + em / 2);
        ctx.scale(1 + 0.24 * punch, 1 - 0.32 * punch);
        if (silhouette) {
          if (hotImg) ctx.drawImage(hotImg.ink, -em / 2, -em, em, em);
        } else {
          ctx.globalAlpha = clamp(t / 0.25);
          if (img) ctx.drawImage(img, -em / 2, -em, em, em);
          else ctx.fillText(emoji, 0, -em / 2);
          if (hotImg && heat > 0) {
            ctx.globalAlpha = clamp(heat * 1.1) * 0.75;
            ctx.drawImage(hotImg.orange, -em / 2, -em, em, em);
            ctx.globalAlpha = clamp((heat - 0.45) * 1.7);
            ctx.drawImage(hotImg.white, -em / 2, -em, em, em);
          }
        }
        ctx.restore();
      }
      ctx.restore();
    };
    let hammerAngle = 0;
    let hammerAlpha = 0;
    {
      const UP = 1.15;
      const next = STRIKES.find((s) => s >= t);
      if (next === undefined) {
        // Thrown back by the last blow, and gone.
        const q = clamp((after - HOLD) / 0.3);
        hammerAngle = easeOut(q) * 1.5;
        hammerAlpha = 1 - q;
      } else {
        const dn = next - t;
        // Drawn back a little further, then down fast, fastest as it lands.
        if (dn <= 0.13) hammerAngle = (UP + 0.3) * (1 - (1 - dn / 0.13) ** 2);
        else hammerAngle = UP * (struck ? easeOut(clamp(since / 0.2)) : 1) + 0.3 * clamp(1 - (dn - 0.13) / 0.12);
        hammerAlpha = clamp((t - 0.45) / 0.3);
      }
    }
    const anvilAlpha = easeOut(clamp(t / 0.4)) * (t < IMPACT ? 1 : clamp(1 - (after - 0.12) / 0.4));
    if (anvilAlpha > 0) drawAnvil(anvil, anvilAlpha, (1 - easeOut(clamp(t / 0.4))) * u * 5);

    if (t < IMPACT) {
      // Ribbons of light behind the relics while they fly; they fade once the relics land.
      if (landed < 1) {
        trailA.push({ x: pa.x, y: pa.y });
        trailB.push({ x: pb.x, y: pb.y });
      }
      if (trailA.length > 22 || landed >= 1) trailA.shift();
      if (trailB.length > 22 || landed >= 1) trailB.shift();
      for (const [trail, rgb] of [[trailA, rgbA], [trailB, accentRGB]] as const) {
        for (let i = 1; i < trail.length; i++) {
          const f = i / trail.length;
          ctx.strokeStyle = `rgba(${rgb},${0.55 * f})`;
          ctx.lineWidth = em * 0.42 * f;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
      }
      // a halo behind each relic: its own colour, turning to the orange of hot metal
      for (const [p, rgb] of [[pa, rgbA], [pb, accentRGB]] as const) {
        const hr = em * (0.9 + 0.5 * heat);
        const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr);
        hg.addColorStop(0, `rgba(${heat > 0.5 ? '255,190,110' : rgb},${0.55 + 0.25 * heat})`);
        hg.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = hg;
        ctx.fillRect(p.x - hr, p.y - hr, hr * 2, hr * 2);
      }
      drawRelics(false);
      // The anvil's face glows under the hot relics.
      if (heat > 0) {
        ctx.save();
        ctx.translate(cx, faceY);
        ctx.scale(1, 0.22);
        const ag = ctx.createRadialGradient(0, 0, 0, 0, 0, u * 14);
        ag.addColorStop(0, `rgba(255,200,120,${0.75 * heat})`);
        ag.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = ag;
        ctx.fillRect(-u * 14, -u * 14, u * 28, u * 28);
        ctx.restore();
      }
    }

    if (hammerAlpha > 0) {
      // On the way down the hammer leaves two faint copies of itself behind.
      const next = STRIKES.find((s) => s >= t);
      if (next !== undefined && next - t <= 0.13 && next - t > 0) {
        drawHammer(hammer, hammerAngle + 0.22, hammerAlpha * 0.28, false);
        drawHammer(hammer, hammerAngle + 0.44, hammerAlpha * 0.12, false);
      }
      drawHammer(hammer, hammerAngle, hammerAlpha);
    }

    // Each blow: sparks thrown up and out from the anvil's face.
    if (struck > fired) {
      fired = struck;
      if (struck < STRIKES.length) {
        for (let n = 0; n < 34; n++) {
          // mostly low and to the sides, a few straight up
          const side = Math.random() < 0.5 ? -1 : 1;
          const a = Math.random() ** 1.6 * 1.3;
          const v = 260 + Math.random() * 620;
          sparks.push({ x: cx + side * Math.random() * emLand * 0.6, y: cy + emLand * 0.25, vx: side * Math.cos(a) * v, vy: -Math.sin(a) * v - 60, life: 0.35 + Math.random() * 0.5, t: 0, size: 1.5 + Math.random() * 2.5, color: Math.random() < 0.35 ? '#ffffff' : Math.random() < 0.5 ? '#ffb04a' : Math.random() < 0.5 ? colA : colB, g: 900 });
        }
      }
    }
    if (t < IMPACT && struck && since < 0.3) {
      // a flash where the hammer lands
      if (punch > 0) {
        const fr = emLand * (1.2 + 2.2 * (1 - punch));
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, fr);
        fg.addColorStop(0, `rgba(255,255,255,${punch})`);
        fg.addColorStop(0.4, `rgba(255,200,130,${punch * 0.5})`);
        fg.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(cx - fr, cy - fr, fr * 2, fr * 2);
        // lightning leaping in from the circle
        for (let n = 0; n < 3; n++) {
          const a = Math.random() * Math.PI * 2;
          const from = { x: cx + Math.cos(a) * R * 0.86, y: cy + Math.sin(a) * R * 0.8 };
          ctx.strokeStyle = n === 0 ? '#ffffff' : n === 1 ? colA : colB;
          ctx.globalAlpha = 0.5 + punch * 0.5;
          ctx.lineWidth = 1 + punch * 2;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          const steps = 6;
          for (let s = 1; s <= steps; s++) {
            const q = s / steps;
            const jag = s < steps ? (Math.random() - 0.5) * 30 * (1 - q * 0.5) : 0;
            ctx.lineTo(from.x + (cx - from.x) * q + jag, from.y + (cy - from.y) * q + jag);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // and a ring racing out along the anvil's face
      const p = since / 0.3;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.lineWidth = 3 * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(cx, faceY, emLand * (0.6 + easeOut(p) * 2.6), emLand * (0.6 + easeOut(p) * 2.6) * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // The last blow: sparks thrown out in every direction.
    if (t >= IMPACT && !burst) {
      burst = true;
      for (let n = 0; n < 180; n++) {
        const a = Math.random() * Math.PI * 2;
        const v = 250 + Math.random() * 850;
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7 + Math.random() * 0.9, t: 0, size: 1.5 + Math.random() * 2.5, color: Math.random() < 0.3 ? '#ffffff' : Math.random() < 0.5 ? colA : colB });
      }
      // and embers that drift up for the rest of it
      for (let n = 0; n < 40; n++) {
        sparks.push({ x: cx + (Math.random() - 0.5) * R, y: cy + (Math.random() - 0.2) * R * 0.6, vx: (Math.random() - 0.5) * 30, vy: -(30 + Math.random() * 70), life: 1 + Math.random() * 0.9, t: 0, size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? color : '#ffffff' });
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += dt;
      if (s.t > s.life) {
        sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.pow(0.04, dt);
      s.vy = s.vy * Math.pow(0.04, dt) + (s.g ?? 40) * dt;
      const a = (1 - s.t / s.life) * fadeOut;
      // a soft glow round each spark, and a bright point at its heart
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    if (t >= IMPACT) {
      // Soft rays turning slowly behind the new relic: many and thin, alternating long and short.
      ctx.save();
      const rays = 24;
      const rayA = Math.max(0, 0.32 - after * 0.08) * fadeOut;
      ctx.translate(cx, cy);
      ctx.rotate(after * 0.25);
      for (let n = 0; n < rays; n++) {
        ctx.rotate((Math.PI * 2) / rays);
        const len = Math.max(w, h) * (n % 2 ? 0.45 : 0.75) * easeOut(clamp(after / 0.4));
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, `rgba(${n % 3 === 0 ? rgbA : n % 3 === 1 ? accentRGB : glowRGB},${rayA})`);
        g.addColorStop(1, `rgba(${glowRGB},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(len, -len * 0.035);
        ctx.lineTo(len, len * 0.035);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Shockwaves: white, then the forge's two colours just behind it.
      for (let n = 0; n < 3; n++) {
        const p = (after - n * 0.07) / 0.75;
        if (p <= 0 || p >= 1) continue;
        ctx.strokeStyle = n === 0 ? '#ffffff' : n === 1 ? colA : colB;
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.lineWidth = 8 * (1 - p) + 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 20 + easeOut(p) * Math.max(w, h) * 0.7, (20 + easeOut(p) * Math.max(w, h) * 0.7) * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // A halo ring that settles round the new relic.
      const settle = easeOut(clamp(after / 0.5));
      const halo = Math.min(w, h) * 0.2 * (1.5 - 0.5 * settle);
      ctx.strokeStyle = `rgba(${glowRGB},${0.6 * settle * fadeOut})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, halo, 0, Math.PI * 2);
      ctx.stroke();

      // Stars twinkling around it.
      for (const st of stars) {
        const tw = Math.max(0, Math.sin(after * 4 + st.ph));
        if (tw <= 0 || after < 0.2) continue;
        ctx.globalAlpha = tw * fadeOut;
        ctx.fillStyle = st.s > 7 ? '#ffffff' : color;
        const d = Math.min(w, h) * 0.32 * st.d * (0.8 + settle * 0.2);
        twinkle(ctx, cx + Math.cos(st.a + after * 0.2) * d, cy + Math.sin(st.a + after * 0.2) * d * 0.9, st.s * tw);
      }
      ctx.globalAlpha = 1;

      // The bloom of light at the moment of impact, brightest at the centre.
      const flash = Math.max(0, 1 - after / 0.45);
      if (flash > 0) {
        const fr = Math.max(w, h) * (0.3 + 0.7 * (1 - flash));
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, fr);
        fg.addColorStop(0, `rgba(255,255,255,${flash})`);
        fg.addColorStop(0.35, `rgba(255,255,255,${flash * 0.6})`);
        fg.addColorStop(1, `rgba(${glowRGB},0)`);
        ctx.fillStyle = fg;
        ctx.fillRect(cx - fr, cy - fr, fr * 2, fr * 2);
      }
    }

    ctx.globalCompositeOperation = 'source-over';

    if (t >= IMPACT + HOLD) {
      // The new relic springs up off the anvil white-hot, then hangs there, bobbing, as it
      // cools to its own colours.
      const born = after - HOLD;
      const p = clamp(born / 0.45);
      const pop = p < 1 ? (1.3 * Math.sin(p * Math.PI * 0.75)) / Math.sin(Math.PI * 0.75) : 1 + 0.03 * Math.sin(born * 5);
      const em2 = Math.min(w, h) * 0.28 * Math.max(0, Math.min(1.3, pop));
      const y = cy - Math.sin(born * 3) * 4;
      ctx.save();
      ctx.globalAlpha = fadeOut;
      ctx.font = emojiFont(Math.max(1, em2));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = born < 0.8 ? '#ffd9a0' : color;
      ctx.shadowBlur = 40 + 30 * clamp(1 - born / 0.8);
      ctx.imageSmoothingEnabled = false;
      if (opts.outImg) ctx.drawImage(opts.outImg, cx - em2 / 2, y - em2 / 2, em2, em2);
      else ctx.fillText(opts.out, cx, y);
      ctx.shadowBlur = 0;
      if (hotOut && opts.outImg) {
        const orange = clamp(1.25 - born / 0.9) * 0.7;
        const white = clamp(1 - born / 0.6);
        if (orange > 0) {
          ctx.globalAlpha = orange * fadeOut;
          ctx.drawImage(hotOut.orange, cx - em2 / 2, y - em2 / 2, em2, em2);
        }
        if (white > 0) {
          ctx.globalAlpha = white * fadeOut;
          ctx.drawImage(hotOut.white, cx - em2 / 2, y - em2 / 2, em2, em2);
        }
        // Once it has cooled, a gleam runs across it corner to corner.
        const sh = (born - 1.0) / 0.4;
        if (sh > 0 && sh < 1) {
          const g = shineC.getContext('2d')!;
          g.globalCompositeOperation = 'source-over';
          g.clearRect(0, 0, 24, 24);
          g.drawImage(opts.outImg, 0, 0, 24, 24);
          g.globalCompositeOperation = 'source-in';
          const at = -12 + sh * 72;
          const band = g.createLinearGradient(at - 9, 0, at, 9);
          band.addColorStop(0, 'rgba(255,255,255,0)');
          band.addColorStop(0.5, 'rgba(255,255,255,0.95)');
          band.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = band;
          g.fillRect(0, 0, 24, 24);
          ctx.globalAlpha = fadeOut;
          ctx.drawImage(shineC, cx - em2 / 2, y - em2 / 2, em2, em2);
        }
      }
      ctx.restore();

      // Its name slams in underneath, in light that runs from white to the forge's colour.
      const q = clamp((born - 0.3) / 0.25);
      if (q > 0) {
        const scale = 1 + (1 - easeOut(q)) * 1.2;
        const nameSize = Math.min(64, w * 0.12);
        ctx.save();
        ctx.globalAlpha = q * fadeOut;
        ctx.translate(cx, cy + Math.min(w, h) * 0.3);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.font = `${Math.min(16, w * 0.036)}px Silkscreen, monospace`;
        ctx.fillText(opts.ascended ? '· ASCENDED ·' : '· FUSED ·', 0, -Math.min(52, w * 0.1));
        ctx.font = `${nameSize}px "Pirata One", Georgia, serif`;
        const ng = ctx.createLinearGradient(0, -nameSize * 0.8, 0, nameSize * 0.1);
        ng.addColorStop(0, '#ffffff');
        ng.addColorStop(1, color);
        ctx.fillStyle = ng;
        ctx.shadowColor = color;
        ctx.shadowBlur = 24;
        ctx.fillText(opts.name, 0, 0);
        ctx.restore();
      }
    } else if (t >= IMPACT) {
      // The last blow hangs for a moment as one white frame: anvil, hammer and relics in black.
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fillRect(-20, -20, w + 40, h + 40);
      drawAnvil(anvilInk, 1);
      drawRelics(true);
      drawHammer(hammerInk, 0, 1, false);
      // black streaks flying out from the blow
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      for (let n = 0; n < 14; n++) {
        const a = (n / 14) * Math.PI * 2 + 0.3;
        const r0 = emLand * 2.2 + (n % 3) * emLand * 0.5;
        const r1 = r0 + emLand * (1 + (n % 4) * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * Behind the new relic on its reveal card: slow light rays turning, a ring that pulses out
 * now and then, and embers rising, in the forge's colour. Stops when the card closes.
 */
export function animateReveal(canvas: HTMLCanvasElement, ascended: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rgb = ascended ? '242,193,78' : '127,180,255';
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const still = calmChosen();
  const embers = Array.from({ length: 22 }, (_, i) => ({ x: (i * 47) % W, p: (i * 0.137) % 1, v: 0.18 + (i % 5) * 0.05, s: i % 4 === 0 ? 3 : 2 }));
  const start = performance.now();
  const frame = (now: number) => {
    if (!canvas.isConnected) return;
    const t = still ? 1.2 : (now - start) / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // a soft core, swelling in as the card arrives
    const inn = Math.min(1, t / 0.5);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70 * inn + 1);
    core.addColorStop(0, `rgba(255,255,255,${0.35 * inn})`);
    core.addColorStop(0.4, `rgba(${rgb},${0.35 * inn})`);
    core.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, W, H);
    // light rays turning slowly, longer for an ascended relic
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.35);
    const rays = ascended ? 16 : 12;
    for (let k = 0; k < rays; k++) {
      ctx.rotate((Math.PI * 2) / rays);
      const len = (ascended ? 130 : 105) * inn * (k % 2 ? 0.75 : 1);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `rgba(${rgb},${0.28 + 0.08 * Math.sin(t * 2 + k)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, -len * 0.08);
      ctx.lineTo(len, len * 0.08);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // a ring pulsing outward every two seconds
    const ring = (t % 2) / 2;
    ctx.strokeStyle = `rgba(${rgb},${0.6 * (1 - ring)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 20 + ring * 90, 0, Math.PI * 2);
    ctx.stroke();
    // two motes orbiting the relic
    for (let k = 0; k < 2; k++) {
      const a = t * 1.6 + k * Math.PI;
      const x = cx + Math.cos(a) * 46;
      const y = cy + Math.sin(a) * 18;
      ctx.fillStyle = k ? '#ffffff' : `rgb(${rgb})`;
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    }
    // embers rising from below
    for (const e of embers) {
      const p = (e.p + t * e.v) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
      ctx.fillStyle = p > 0.5 ? '#ffffff' : `rgb(${rgb})`;
      ctx.fillRect(Math.round(e.x + Math.sin(t * 2 + e.x) * 6), Math.round(H - p * H), e.s, e.s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (!still) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
