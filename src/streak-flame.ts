// The streak flame on the title screen: a small pixel flame over a candle that grows with the
// Daily streak, and a line saying where the streak stands today (lit, burning low, kept by a
// Grave Ward, or gone out).

import type { StreakStats } from './storage';
import { WARD_EVERY } from './storage';

export type FlameState = 'lit' | 'low' | 'warded' | 'out';

export interface FlameView {
  state: FlameState;
  /** 0 (a few days) to 4 (a month or more): how big and how bright the flame burns. */
  tier: number;
  days: number;
  /** What the streak needs today, in one sentence. */
  line: string;
  wards: number;
  /** Days of streak left before the next Grave Ward. */
  wardIn: number;
}

/** Days in a row where each flame tier starts. */
export const FLAME_TIERS = [1, 3, 7, 14, 30];

export function flameTier(days: number): number {
  let t = 0;
  for (let i = 0; i < FLAME_TIERS.length; i++) if (days >= FLAME_TIERS[i]) t = i;
  return t;
}

/** Where the streak stands today, or null for someone who has never played a Daily. */
export function flameView(s: StreakStats, today: number): FlameView | null {
  if (!s.total) return null;
  const wardIn = WARD_EVERY - (s.count % WARD_EVERY);
  if (s.current === 0) {
    return {
      state: 'out', tier: 0, days: 0, wards: 0, wardIn: WARD_EVERY,
      line: `Your flame went out${s.best > 1 ? ` (best: ${s.best} days)` : ''}. Play today's Daily to light a new one.`,
    };
  }
  const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
  if (s.last === today) {
    return { state: 'lit', tier: flameTier(s.current), days: s.current, wards: s.wards, wardIn, line: `Lit for today. Come back tomorrow for ${plural(s.current + 1)}.` };
  }
  if (s.last === today - 1) {
    return { state: 'low', tier: flameTier(s.current), days: s.current, wards: s.wards, wardIn, line: `Burning low. Play today's Daily to keep it lit.` };
  }
  return {
    state: 'warded', tier: flameTier(s.current), days: s.current, wards: s.wards, wardIn,
    line: `You missed yesterday. Play today and a Grave Ward keeps your flame burning.`,
  };
}

// ---- drawing ----

/** Outer, middle and core colours for each tier: orange, then gold, then the deep blue and violet of a long streak. */
const COLORS: [string, string, string][] = [
  ['#c8501e', '#f08a2c', '#ffd27a'],
  ['#d0581c', '#f5a03a', '#ffe9a8'],
  ['#d8781c', '#f8c04a', '#fff6d0'],
  ['#2a6fd6', '#5fb2ff', '#e6f6ff'],
  ['#7a3ce0', '#c07cff', '#fff0ff'],
];

/** The canvas is this many pixels; CSS scales it up crisply. */
export const FLAME_W = 20;
export const FLAME_H = 30;

/**
 * Draw the flame, animating until `keep()` says the title has gone. With `calm`, one still frame.
 */
export function runStreakFlame(c: HTMLCanvasElement, v: FlameView, calm: boolean, keep: () => boolean) {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  c.width = FLAME_W;
  c.height = FLAME_H;
  const cx = FLAME_W / 2;
  // the candle: a wax stub with a drip, standing on the bottom of the canvas
  const waxTop = FLAME_H - 7;
  const sparks: { x: number; y: number; vy: number; life: number }[] = [];
  const smoke: { x: number; y: number; life: number }[] = [];
  let last = performance.now();
  const start = last;
  const draw = (now: number) => {
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, FLAME_W, FLAME_H);
    // wax
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(cx - 3, waxTop, 6, 7);
    ctx.fillStyle = '#b9a98a';
    ctx.fillRect(cx + 2, waxTop, 1, 7);
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(cx - 3, waxTop, 1, 2);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(cx - 4, waxTop + 1, 1, 2);
    // wick
    ctx.fillStyle = '#2a1e18';
    ctx.fillRect(cx, waxTop - 2, 1, 2);
    if (v.state === 'out') {
      // a cold wick: one ember, and a thread of smoke
      ctx.fillStyle = calm || Math.sin(t * 3) > -0.3 ? '#a8381c' : '#6a2814';
      ctx.fillRect(cx, waxTop - 2, 1, 1);
      if (!calm && Math.random() < dt * 6) smoke.push({ x: cx, y: waxTop - 3, life: 1 });
      for (const s of smoke) {
        s.y -= dt * 9;
        s.x += Math.sin(s.y * 0.6 + t) * dt * 4;
        s.life -= dt * 0.5;
        ctx.fillStyle = `rgba(160,150,170,${Math.max(0, s.life) * 0.7})`;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].life <= 0) smoke.splice(i, 1);
      if (calm) {
        ctx.fillStyle = 'rgba(160,150,170,0.5)';
        for (let y = 0; y < 6; y++) ctx.fillRect(cx + Math.round(Math.sin(y * 0.9)), waxTop - 4 - y * 2, 1, 1);
      }
    } else {
      const [outer, mid, core] = COLORS[v.tier];
      // A flame burning low is smaller and gutters; a long streak burns tall.
      const low = v.state === 'low' || v.state === 'warded';
      const height = (7 + v.tier * 3.6) * (low ? 0.72 : 1);
      const width = 2.2 + v.tier * 0.75;
      const base = waxTop - 2;
      const flick = (s: number) => (calm ? 0 : Math.sin(t * s) * 0.5 + Math.sin(t * s * 1.7 + 1.3) * 0.35);
      const h = height * (1 + flick(low ? 11 : 7) * (low ? 0.12 : 0.07));
      const sway = calm ? 0 : flick(3.1) * 0.9;
      // glow
      const g = ctx.createRadialGradient(cx + 0.5, base - h * 0.45, 0, cx + 0.5, base - h * 0.45, h * 0.95);
      g.addColorStop(0, `${mid}55`);
      g.addColorStop(1, `${mid}00`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FLAME_W, FLAME_H);
      // the flame, row by row: a teardrop leaning with the sway, coloured from the core outward
      for (let y = 0; y <= Math.ceil(h); y++) {
        const f = y / h; // 0 at the wick, 1 at the tip
        if (f > 1) break;
        const half = width * Math.sin(Math.PI * Math.min(1, 0.18 + f * 0.95)) * (1 - f * 0.55);
        const off = sway * f * f;
        const py = Math.round(base - y);
        for (let x = Math.floor(cx - half + off - 0.5); x <= Math.ceil(cx + half + off + 0.5); x++) {
          const d = Math.abs(x + 0.5 - (cx + 0.5 + off)) / Math.max(0.6, half);
          if (d > 1.05) continue;
          const r = d * 0.75 + f * 0.55;
          ctx.fillStyle = r < 0.45 ? core : r < 0.85 ? mid : outer;
          ctx.fillRect(x, py, 1, 1);
        }
      }
      // a blue root at the wick
      ctx.fillStyle = v.tier >= 3 ? core : '#4f7ad8';
      ctx.fillRect(cx, base, 1, 1);
      // sparks rise off a strong flame
      if (!calm && v.tier >= 2 && !low && Math.random() < dt * (1.5 + v.tier)) {
        sparks.push({ x: cx + (Math.random() - 0.5) * width * 1.5, y: base - h * 0.7, vy: 10 + Math.random() * 8, life: 1 });
      }
      for (const s of sparks) {
        s.y -= s.vy * dt;
        s.x += Math.sin(s.y + t * 5) * dt * 3;
        s.life -= dt * 0.9;
        ctx.fillStyle = s.life > 0.5 ? core : mid;
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        ctx.globalAlpha = 1;
      }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0 || sparks[i].y < 0) sparks.splice(i, 1);
    }
    if (!calm && keep() && c.isConnected) requestAnimationFrame(draw);
  };
  draw(performance.now());
}
