// Auras: a glow and a moving pattern around the hero. Everything is worked out from the
// time alone (no particle state), so the same drawing serves runs, the Hollow, the isle
// and the Hall's statues at any size.

import { AURA_BY_ID, type AuraDef } from './progression';

type Ctx = CanvasRenderingContext2D;

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** The Patron's rainbow: a colour that flows around the hue wheel. */
export const prism = (t: number, offset = 0, alpha = 1) => `hsla(${Math.round((t * 90 + offset) % 360)}, 95%, 64%, ${alpha})`;

/** A soft ellipse of light on the ground under the hero. */
function groundGlow(ctx: Ctx, cx: number, feet: number, w: number, color: string, strength: number) {
  ctx.save();
  ctx.translate(cx, feet);
  ctx.scale(1, 0.38);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.95);
  g.addColorStop(0, color.startsWith('#') ? rgba(color, strength) : color);
  g.addColorStop(1, color.startsWith('#') ? rgba(color, 0) : 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w, -w, w * 2, w * 2);
  ctx.restore();
}

/** A soft glow around the whole body. */
function bodyGlow(ctx: Ctx, cx: number, cy: number, r: number, color: string, strength: number) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(color, strength));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/**
 * Draw an aura around a hero whose sprite is `w` wide, centred on `cx` with its feet at
 * `feet`. Call once with 'back' before drawing the hero and once with 'front' after.
 */
export function drawAura(ctx: Ctx, id: string | undefined, cx: number, feet: number, w: number, t: number, layer: 'back' | 'front') {
  const a = id ? AURA_BY_ID[id] : undefined;
  if (!a) return;
  const k = Math.max(1, Math.round(w / 12));
  const mid = feet - w * 0.5;
  const px = (x: number, y: number, s: number, c: string, alpha = 1) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  };
  const pulse = 0.8 + 0.2 * Math.sin(t * 2.4);
  ctx.save();
  if (layer === 'back') {
    groundGlow(ctx, cx, feet, w, a.style === 'rainbow' ? prism(t, 0, 0.55) : a.color, 0.5 * pulse);
    drawBack(ctx, a, cx, feet, mid, w, k, t, px, pulse);
  } else {
    drawFront(ctx, a, cx, feet, mid, w, k, t, px);
  }
  ctx.restore();
}

type Px = (x: number, y: number, s: number, c: string, alpha?: number) => void;

// ---------- the Great Bell (finish Act I of the story) ----------

const BELL_PERIOD = 2.6;

/** How far into its toll the bell is: 0 at the stroke, rising to 1 before the next. */
function tollPhase(t: number): number {
  return (t % BELL_PERIOD) / BELL_PERIOD;
}

/** A shockwave of bronze dots spreading across the ground from the hero's feet. */
function shockwave(px: Px, cx: number, feet: number, w: number, k: number, p: number, color: string) {
  if (p > 0.55) return;
  const q = p / 0.55;
  const r = w * (0.35 + q * 1.25);
  const dots = 28;
  for (let i = 0; i < dots; i++) {
    const ang = (i / dots) * Math.PI * 2;
    px(cx + Math.cos(ang) * r - k / 2, feet + Math.sin(ang) * r * 0.32 - k / 2, k, i % 3 ? color : '#fff2c0', (1 - q) * 0.9);
  }
}

/** The bell itself, swinging above the hero; it flashes white on the stroke. */
function greatBell(px: Px, cx: number, top: number, k: number, t: number) {
  const p = tollPhase(t);
  const swing = Math.sin((t / BELL_PERIOD) * Math.PI * 2) * 1.6;
  const x0 = cx + swing * k - 3 * k;
  const flash = p < 0.08;
  const body = flash ? '#fff2c0' : '#c9a24a';
  const shade = flash ? '#f2c14e' : '#8a6a2a';
  // crown loop, shoulders, flared mouth: rows of pixels, widest at the bottom
  const rows: [number, number][] = [[2, 2], [1, 4], [1, 4], [0, 6], [0, 6]];
  px(x0 + 2.5 * k, top - k, k, '#5d4a2a');
  rows.forEach(([off, wd], r) => {
    for (let i = 0; i < wd; i++) px(x0 + (off + i) * k, top + r * k, k, i === 0 ? shade : i === wd - 1 ? shade : body);
  });
  px(x0 + 1 * k, top + k, k, '#fff2c0', 0.8);
  // the clapper swings a beat behind
  px(x0 + (2.5 - swing * 0.6) * k, top + 5 * k, k, '#5d4a2a');
}


/** Particles rising from the hero's feet: n of them, taking `secs` to rise `height`. */
function rising(t: number, n: number, secs: number, each: (i: number, p: number) => void) {
  for (let i = 0; i < n; i++) each(i, (t / secs + i / n) % 1);
}

function drawBack(ctx: Ctx, a: AuraDef, cx: number, feet: number, mid: number, w: number, k: number, t: number, px: Px, pulse: number) {
  switch (a.style) {
    case 'candle':
      rising(t, 4, 2.6, (i, p) => px(cx + Math.sin(i * 2.1 + t * 0.8) * w * 0.45, feet - p * w * 1.3, k, i % 2 ? '#ffd23f' : a.color, (1 - p) * (0.6 + 0.4 * Math.sin(t * 9 + i))));
      break;
    case 'bell': {
      // On each stroke the light swells and a shockwave crosses the ground.
      const p = tollPhase(t);
      bodyGlow(ctx, cx, mid, w * (0.9 + Math.max(0, 0.3 - p) * 1.5), a.color, 0.22 + Math.max(0, 0.25 - p));
      shockwave(px, cx, feet, w, k, p, a.color);
      shockwave(px, cx, feet, w, k, Math.max(0, p - 0.1), '#8a6a2a');
      orbit(t, 4, 1.2, (i, x, y, front) => !front && px(cx + x * w * 0.62 - k / 2, mid + y * w * 0.22 - k / 2, k, i % 2 ? '#ffffff' : '#9fe8ff', 0.7));
      break;
    }
    case 'ember':
      bodyGlow(ctx, cx, mid, w * 0.9, a.color, 0.18 * pulse);
      rising(t, 7, 1.5, (i, p) => px(cx + Math.sin(i * 1.7 + p * 4) * w * 0.5, feet - p * w * 1.5, i % 3 === 0 ? k * 2 : k, ['#ff8a2a', '#ffd23f', '#d23a46'][i % 3], 1 - p));
      break;
    case 'tide':
      for (let i = 0; i < 2; i++) {
        const p = (t / 1.8 + i / 2) % 1;
        ctx.globalAlpha = (1 - p) * 0.8;
        ctx.strokeStyle = a.color;
        ctx.lineWidth = k;
        ctx.beginPath();
        ctx.ellipse(cx, feet, w * (0.3 + p * 0.7), w * (0.1 + p * 0.25), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      rising(t, 3, 1.2, (i, p) => px(cx + (i - 1) * w * 0.35, feet - Math.sin(p * Math.PI) * w * 0.4, k, '#a0ebff', 1 - p));
      break;
    case 'bone':
      orbit(t, 4, 1.6, (_i, x, y, front) => !front && bone(px, cx + x * w * 0.7, mid + y * w * 0.2, k));
      break;
    case 'abyss':
      bodyGlow(ctx, cx, mid, w * 1.2, '#2a1640', 0.6);
      bodyGlow(ctx, cx, mid, w * (0.8 + 0.2 * Math.sin(t * 1.8)), a.color, 0.3);
      rising(t, 4, 3, (i, p) => px(cx + Math.sin(i * 2.4) * w * 0.55, feet - w * 1.2 + p * w * 1.2, k, '#d3b0ff', Math.sin(p * Math.PI) * 0.8));
      break;
    case 'void':
      bodyGlow(ctx, cx, mid, w * 1.3, '#0a0716', 0.75);
      bodyGlow(ctx, cx, mid, w * 0.9, a.color, 0.35 * pulse);
      orbit(t, 3, 1.1, (i, x, y, front) => !front && star(px, cx + x * w * 0.75, feet - w * 0.95 + y * w * 0.18, k, i));
      break;
    case 'rays':
    case 'sunburst':
    case 'eternity': {
      const n = a.style === 'rays' ? 8 : 12;
      const spin = a.style === 'sunburst' ? 0.6 : 0.25;
      bodyGlow(ctx, cx, mid, w * (a.style === 'rays' ? 0.9 : 1.2), a.color, (a.style === 'rays' ? 0.22 : 0.32) * pulse);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = k;
      for (let i = 0; i < n; i++) {
        const ang = t * spin + (i * Math.PI * 2) / n;
        const len = w * (a.style === 'sunburst' ? (i % 2 ? 0.75 : 1.05) : 0.85);
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + i);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * w * 0.35, mid + Math.sin(ang) * w * 0.35);
        ctx.lineTo(cx + Math.cos(ang) * len, mid + Math.sin(ang) * len);
        ctx.stroke();
      }
      if (a.style === 'eternity') orbit(t, 6, 2.2, (i, x, y, front) => !front && px(cx + x * w * 0.8, mid + y * w * 0.5, k, i % 2 ? '#ffffff' : '#f2c14e', 0.9));
      break;
    }
    case 'flame':
      bodyGlow(ctx, cx, feet - w * 1.05, w * 0.5, a.color, 0.35 * pulse);
      break;
    case 'wisps':
      orbit(t, 2, 1.4, (i, x, y, front) => !front && pumpkin(px, cx + x * w * 0.75, mid + y * w * 0.3, k, t, i));
      break;
    case 'snow':
      bodyGlow(ctx, cx, mid, w * 0.8, a.color, 0.15);
      rising(t, 7, 2.4, (i, p) => px(cx + Math.sin(i * 2.7 + p * 3) * w * 0.6, feet - w * 1.3 + p * w * 1.35, i % 3 ? k : k * 2, '#ffffff', Math.sin(p * Math.PI)));
      break;
    case 'storm': {
      bodyGlow(ctx, cx, mid, w * 1.0, a.color, 0.3 * pulse);
      const beat = Math.floor(t * 6);
      if (beat % 3 !== 2) {
        // a jagged spark somewhere around the body, a new one six times a second
        const r = (n: number) => ((Math.sin(beat * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        let x = cx + (r(1) - 0.5) * w * 1.2;
        let y = mid + (r(2) - 0.5) * w * 1.1;
        ctx.strokeStyle = '#e8fbff';
        ctx.lineWidth = k;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 3; s++) {
          x += (r(3 + s) - 0.5) * w * 0.5;
          y += w * 0.22;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'mist':
      for (let i = 0; i < 5; i++) {
        const p = (t / 4 + i / 5) % 1;
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.35;
        ctx.fillStyle = i % 2 ? a.color : '#8a1f2c';
        const s = k * (3 + (i % 2));
        ctx.fillRect(Math.round(cx - w * 0.7 + p * w * 1.4 - s / 2), Math.round(feet - w * 0.2 - Math.sin(i * 1.9) * w * 0.25 - s), s, s);
      }
      break;
    case 'souls':
      bodyGlow(ctx, cx, mid, w * 1.0, a.color, 0.32 * pulse);
      rising(t, 5, 2.2, (i, p) => {
        const ang = t * 2.5 + i * 1.3;
        const r = w * (0.65 - p * 0.4);
        if (Math.sin(ang) < 0) {
          px(cx + Math.cos(ang) * r, feet - p * w * 1.4, k * 2, '#ffffff', 1 - p * 0.8);
          px(cx + Math.cos(ang - 0.4) * r, feet - p * w * 1.4 + k * 2, k, a.color, 1 - p * 0.7);
        }
      });
      break;
    case 'crown':
      bodyGlow(ctx, cx, mid, w * 1, a.color, 0.25 * pulse);
      orbit(t, 8, 1.4, (i, x, y, front) => !front && px(cx + x * w * 0.42 - k / 2, feet - w * 1.06 + y * w * 0.09, k, i % 2 ? '#fff2c0' : '#f2c14e'));
      break;
    case 'shards':
      bodyGlow(ctx, cx, mid, w * 0.95, a.color, 0.22 * pulse);
      orbit(t, 5, 1.3, (i, x, y, front) => !front && shard(px, cx + x * w * 0.72, mid + y * w * 0.24 + Math.sin(t * 3 + i) * k, k, i, t));
      break;
    case 'blades':
      bodyGlow(ctx, cx, mid, w * 0.9, a.color, 0.16 * pulse);
      orbit(t, 3, 1.9, (i, x, y, front) => !front && blade(px, cx + x * w * 0.7, mid + y * w * 0.26, k, i));
      break;
    case 'banner':
      bodyGlow(ctx, cx, mid, w * 0.9, a.color, 0.2 * pulse);
      warBanner(px, cx + w * 0.42, feet - w * 1.1, k, t, a.color);
      rising(t, 4, 2, (i, p) => px(cx + Math.sin(i * 2.3 + p * 3) * w * 0.5, feet - p * w * 1.2, k, i % 2 ? '#ffd23f' : a.color, (1 - p) * 0.8));
      break;
    case 'eclipse': {
      // A black sun behind the hero, its gold corona turning, shards circling and the bell's shockwave.
      bodyGlow(ctx, cx, mid, w * 1.35, '#0a0716', 0.7);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = k;
      for (let i = 0; i < 16; i++) {
        const ang = t * 0.35 + (i * Math.PI * 2) / 16;
        const len = w * (i % 2 ? 0.8 : 1.1) * (0.92 + 0.08 * Math.sin(t * 3 + i));
        ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 2 + i);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * w * 0.5, mid + Math.sin(ang) * w * 0.5);
        ctx.lineTo(cx + Math.cos(ang) * len, mid + Math.sin(ang) * len);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(cx, mid, w * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      shockwave(px, cx, feet, w, k, tollPhase(t), a.color);
      orbit(t, 4, 1.1, (i, x, y, front) => !front && shard(px, cx + x * w * 0.85, mid + y * w * 0.3, k, i, t));
      break;
    }
    case 'reaper': {
      // Death's own shadow: a dark pall, black smoke curling up, and his scythe looming behind.
      bodyGlow(ctx, cx, mid, w * 1.2, '#0a0612', 0.75);
      bodyGlow(ctx, cx, mid, w * 0.95, a.color, 0.16 * pulse);
      rising(t, 8, 2.4, (i, p) => {
        const x = cx + Math.sin(i * 2.7 + p * 5 + t) * w * (0.35 + p * 0.25);
        px(x, feet - p * w * 1.5, i % 3 === 0 ? k * 2 : k, i % 2 ? '#1d1428' : '#2a1640', (1 - p) * 0.9);
      });
      scythe(px, cx + w * 0.5, feet, w, k, Math.sin(t * 0.9) * 0.12, a.color);
      break;
    }
    case 'rainbow': {
      // the rainbow flows round the hero: a ring of colour under the feet and colours rising
      const segs = 28;
      for (let i = 0; i < segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = prism(t * 1.5, (i / segs) * 360);
        ctx.fillRect(Math.round(cx + Math.cos(ang) * w * 0.62 - k / 2), Math.round(feet + Math.sin(ang) * w * 0.2 - k / 2), k, k);
      }
      const g = ctx.createRadialGradient(cx, mid, 0, cx, mid, w * 1.05);
      g.addColorStop(0, prism(t, 0, 0.42));
      g.addColorStop(0.6, prism(t, 90, 0.18));
      g.addColorStop(1, prism(t, 180, 0));
      ctx.fillStyle = g;
      ctx.globalAlpha = 1;
      ctx.fillRect(cx - w, mid - w, w * 2, w * 2);
      rising(t, 10, 1.8, (i, p) => px(cx + Math.sin(i * 1.9 + p * 5) * w * 0.55, feet - p * w * 1.45, k, prism(t * 1.5, i * 36 + p * 120), 1 - p));
      break;
    }
  }
}

function drawFront(_ctx: Ctx, a: AuraDef, cx: number, feet: number, mid: number, w: number, k: number, t: number, px: Px) {
  switch (a.style) {
    case 'bell':
      orbit(t, 4, 1.2, (i, x, y, front) => front && px(cx + x * w * 0.62 - k / 2, mid + y * w * 0.22 - k / 2, k, i % 2 ? '#ffffff' : '#9fe8ff', 0.85));
      greatBell(px, cx, feet - w * 1.32, k, t);
      break;
    case 'bone':
      orbit(t, 4, 1.6, (_i, x, y, front) => front && bone(px, cx + x * w * 0.7, mid + y * w * 0.2, k));
      break;
    case 'void':
      orbit(t, 3, 1.1, (i, x, y, front) => front && star(px, cx + x * w * 0.75, feet - w * 0.95 + y * w * 0.18, k, i));
      break;
    case 'eternity':
      orbit(t, 6, 2.2, (i, x, y, front) => front && px(cx + x * w * 0.8, mid + y * w * 0.5, k, i % 2 ? '#ffffff' : '#f2c14e'));
      break;
    case 'flame': {
      // a blue flame floating over the head
      const fx = cx;
      const fy = feet - w * 1.05 + Math.sin(t * 2) * k;
      const f = Math.sin(t * 11) > 0 ? k : 0;
      px(fx - k * 1.5, fy - k * 2 - f, k * 3, '#2f6fd0', 0.9);
      px(fx - k, fy - k * 3 - f, k * 2, a.color, 1);
      px(fx - k / 2, fy - k * 4 - f, k, '#9fe8ff', 1);
      px(fx - k / 2, fy - k * 2, k, '#ffffff', 1);
      break;
    }
    case 'shards':
      orbit(t, 5, 1.3, (i, x, y, front) => front && shard(px, cx + x * w * 0.72, mid + y * w * 0.24 + Math.sin(t * 3 + i) * k, k, i, t));
      break;
    case 'blades':
      orbit(t, 3, 1.9, (i, x, y, front) => front && blade(px, cx + x * w * 0.7, mid + y * w * 0.26, k, i));
      break;
    case 'eclipse':
      orbit(t, 4, 1.1, (i, x, y, front) => front && shard(px, cx + x * w * 0.85, mid + y * w * 0.3, k, i, t));
      break;
    case 'wisps':
      orbit(t, 2, 1.4, (i, x, y, front) => front && pumpkin(px, cx + x * w * 0.75, mid + y * w * 0.3, k, t, i));
      break;
    case 'crown':
      orbit(t, 8, 1.4, (i, x, y, front) => front && px(cx + x * w * 0.42 - k / 2, feet - w * 1.06 + y * w * 0.09, k, i % 2 ? '#fff2c0' : '#ff4d5a'));
      break;
    case 'reaper':
      // Pale souls drawn in toward the hero, fading as they arrive.
      orbit(t, 3, 0.9, (i, x, y, front) => {
        if (!front) return;
        const pull = 0.75 + 0.25 * Math.sin(t * 1.5 + i * 2);
        px(cx + x * w * 0.8 * pull, mid + y * w * 0.3, k, '#e8fbff', 0.55 + 0.35 * Math.sin(t * 4 + i));
        px(cx + x * w * 0.8 * pull - k, mid + y * w * 0.3 + k, k, a.color, 0.5);
      });
      break;
    case 'souls':
      rising(t, 5, 2.2, (i, p) => {
        const ang = t * 2.5 + i * 1.3;
        const r = w * (0.65 - p * 0.4);
        if (Math.sin(ang) >= 0) {
          px(cx + Math.cos(ang) * r, feet - p * w * 1.4, k * 2, '#ffffff', 1 - p * 0.8);
          px(cx + Math.cos(ang - 0.4) * r, feet - p * w * 1.4 + k * 2, k, a.color, 1 - p * 0.7);
        }
      });
      break;
  }
}

/**
 * Death's scythe standing behind the hero: a long haft from the ground, a curved pale
 * blade at the top, leaning by `sway` radians about its foot.
 */
function scythe(px: Px, footX: number, feet: number, w: number, k: number, sway: number, color: string) {
  const len = w * 1.5;
  const at = (along: number, side: number) => ({
    x: footX + Math.sin(sway) * along + Math.cos(sway) * side,
    y: feet - Math.cos(sway) * along + Math.sin(sway) * side,
  });
  for (let d = 0; d <= len; d += k) {
    const p = at(d, 0);
    px(p.x, p.y, k, d > len - k * 2 ? '#3a3346' : '#4a3a2a', 0.85);
  }
  // The blade sweeps out to the left from the top of the haft, curving down to a point.
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const q = i / steps;
    const ang = Math.PI * (0.5 + q * 0.75);
    const r = w * 0.55;
    const p = at(len - r * 0.35 + Math.sin(ang) * r * 0.35, Math.cos(ang) * r);
    px(p.x, p.y, k, q > 0.8 ? '#ffffff' : '#c9d1e0', 0.9);
    if (q < 0.85) {
      const e = at(len - r * 0.35 + Math.sin(ang) * r * 0.35 - k, Math.cos(ang) * r * 0.86);
      px(e.x, e.y, k, color, 0.55);
    }
  }
}

/** n things circling the hero; x and y are -1..1, and `front` says whether they pass in front. */
function orbit(t: number, n: number, speed: number, each: (i: number, x: number, y: number, front: boolean) => void) {
  for (let i = 0; i < n; i++) {
    const ang = t * speed + (i * Math.PI * 2) / n;
    each(i, Math.cos(ang), Math.sin(ang), Math.sin(ang) >= 0);
  }
}

function bone(px: Px, x: number, y: number, k: number) {
  px(x - k, y, k, '#e8dcc4');
  px(x, y, k, '#d8cfb8');
  px(x + k, y, k, '#e8dcc4');
}

function star(px: Px, x: number, y: number, k: number, i: number) {
  const c = i % 2 ? '#ffffff' : '#d3b0ff';
  px(x, y - k, k, c);
  px(x - k, y, k, c);
  px(x, y, k, '#ffffff');
  px(x + k, y, k, c);
  px(x, y + k, k, c);
}

function pumpkin(px: Px, x: number, y: number, k: number, t: number, i: number) {
  const bob = Math.sin(t * 3 + i * 2) * k;
  px(x - k, y + bob, k * 2, '#e67e22');
  px(x, y + bob - k, k, '#3d6b2a');
  px(x - k + Math.round(k / 2), y + bob + Math.round(k / 2), Math.max(1, Math.round(k / 2)), '#ffd23f', 0.7 + 0.3 * Math.sin(t * 8 + i));
}

/** A jagged bronze piece of a broken bell, glinting now and then. */
function shard(px: Px, x: number, y: number, k: number, i: number, t: number) {
  const glint = Math.sin(t * 4 + i * 1.7) > 0.85;
  px(x - k, y, k, '#8a6a2a');
  px(x, y - k, k, glint ? '#fff2c0' : '#c9a24a');
  px(x, y, k, '#c9a24a');
  if (i % 2) px(x + k, y + k, k, '#8a6a2a');
}

/** A small sword, point down. */
function blade(px: Px, x: number, y: number, k: number, i: number) {
  px(x, y - 2 * k, k, i % 2 ? '#f2c14e' : '#8a6a2a');
  px(x - k, y - k, k, '#5d667a');
  px(x, y - k, k, '#5d667a');
  px(x + k, y - k, k, '#5d667a');
  px(x, y, k, '#e8fbff');
  px(x, y + k, k, '#c9d1e0');
  px(x, y + 2 * k, k, '#ffffff');
}

/** A war banner on a pole behind the hero's shoulder, rippling. */
function warBanner(px: Px, x: number, top: number, k: number, t: number, color: string) {
  for (let r = 0; r < 9; r++) px(x, top + r * k, k, '#5d4a2a');
  px(x, top - k, k, '#f2c14e');
  for (let c = 1; c <= 4; c++) {
    const wave = Math.round(Math.sin(t * 5 - c * 0.9) * 0.6) * k;
    for (let r = 0; r < 4 - (c === 4 ? 1 : 0); r++) px(x + c * k, top + r * k + wave, k, r === 1 && c === 2 ? '#f2c14e' : color);
  }
}

/** CSS for an aura on a still portrait (leaderboards, results): a glow in its colour, or the flowing rainbow. */
export function auraClass(id: string | null | undefined): { cls: string; style: string } {
  const a = id ? AURA_BY_ID[id] : undefined;
  if (!a) return { cls: '', style: '' };
  if (a.style === 'rainbow') return { cls: 'aura-glow aura-prism', style: '' };
  return { cls: 'aura-glow', style: `--aura:${a.color}` };
}
