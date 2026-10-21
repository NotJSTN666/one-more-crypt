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

/** Particles rising from the hero's feet: n of them, taking `secs` to rise `height`. */
function rising(t: number, n: number, secs: number, each: (i: number, p: number) => void) {
  for (let i = 0; i < n; i++) each(i, (t / secs + i / n) % 1);
}

function drawBack(ctx: Ctx, a: AuraDef, cx: number, feet: number, mid: number, w: number, k: number, t: number, px: Px, pulse: number) {
  switch (a.style) {
    case 'candle':
      rising(t, 4, 2.6, (i, p) => px(cx + Math.sin(i * 2.1 + t * 0.8) * w * 0.45, feet - p * w * 1.3, k, i % 2 ? '#ffd23f' : a.color, (1 - p) * (0.6 + 0.4 * Math.sin(t * 9 + i))));
      break;
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
    case 'wisps':
      orbit(t, 2, 1.4, (i, x, y, front) => front && pumpkin(px, cx + x * w * 0.75, mid + y * w * 0.3, k, t, i));
      break;
    case 'crown':
      orbit(t, 8, 1.4, (i, x, y, front) => front && px(cx + x * w * 0.42 - k / 2, feet - w * 1.06 + y * w * 0.09, k, i % 2 ? '#fff2c0' : '#ff4d5a'));
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

/** CSS for an aura on a still portrait (leaderboards, results): a glow in its colour, or the flowing rainbow. */
export function auraClass(id: string | null | undefined): { cls: string; style: string } {
  const a = id ? AURA_BY_ID[id] : undefined;
  if (!a) return { cls: '', style: '' };
  if (a.style === 'rainbow') return { cls: 'aura-glow aura-prism', style: '' };
  return { cls: 'aura-glow', style: `--aura:${a.color}` };
}
