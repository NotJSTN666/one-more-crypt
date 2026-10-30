// The Soul Forge's fusion, played full screen for about three seconds. A magic circle of
// runes draws itself and turns; the two relics orbit inward on ribbons of light while motes
// spiral in and lightning starts to leap; they meet in a bloom of light, the circle bursts
// outward with the shockwaves, and the new relic hangs in turning rays among twinkling stars.

const DURATION = 3.1;
/** When the two relics collide, in seconds (matches fusionSound). */
export const IMPACT = 1.9;

interface Spark { x: number; y: number; vx: number; vy: number; life: number; t: number; size: number; color: string }
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
function emojiColor(emoji: string, fallback: string): string {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return fallback;
  g.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 16, 17);
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

export function playFusion(opts: { a: string; b: string; out: string; name: string; ascended: boolean; onDone: () => void }) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return opts.onDone();
  // The forge's own colour (blue, or gold when ascended) lights the new relic; the two relics
  // going in each bring their own colour to the circle, their trails, the sparks and the waves.
  const color = opts.ascended ? '#f2c14e' : '#7fb4ff';
  const glowRGB = opts.ascended ? '242,193,78' : '127,180,255';
  const colA = emojiColor(opts.a, color);
  let colB = emojiColor(opts.b, opts.ascended ? '#ffb35a' : '#c9a8ff');
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
  let layers: { outer: HTMLCanvasElement; inner: HTMLCanvasElement } | null = null;
  const size = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    R = Math.min(w, h) * 0.36;
    layers = circleLayers(R, colA, colB, dpr);
  };
  size();
  window.addEventListener('resize', size);

  const sparks: Spark[] = [];
  const motes: Mote[] = [];
  const trailA: { x: number; y: number }[] = [];
  const trailB: { x: number; y: number }[] = [];
  // Stars that twinkle round the new relic once it's made.
  const stars = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + i, d: 0.45 + ((i * 37) % 10) / 22, s: 4 + (i % 4) * 2, ph: i * 0.7 }));
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
    // A tremble that builds through the charge, and a hard jolt at the moment of impact.
    const shake = t < IMPACT ? k * 6 : Math.max(0, 14 - after * 40);
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

    // The core, gathering light through the charge and blooming after.
    const core = t < IMPACT ? 24 + k * R * 0.75 : R * (1.1 - Math.min(0.6, after * 0.4));
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, core));
    cg.addColorStop(0, `rgba(255,255,255,${0.5 * fadeOut})`);
    // The core takes on both relics' colours as they draw in, and the forge's once they're one.
    const coreRGB = t < IMPACT ? (Math.sin(t * 6) > 0 ? rgbA : accentRGB) : glowRGB;
    cg.addColorStop(0.25, `rgba(${coreRGB},${0.4 * fadeOut})`);
    cg.addColorStop(0.6, `rgba(${t < IMPACT ? accentRGB : rgbA},${0.14 * fadeOut})`);
    cg.addColorStop(1, `rgba(${glowRGB},0)`);
    ctx.fillStyle = cg;
    ctx.fillRect(cx - core, cy - core, core * 2, core * 2);

    // The magic circle: it grows into being, turns faster as the charge builds, then bursts
    // outward and fades with the impact.
    if (layers && t < IMPACT + 0.6) {
      const grow = easeOut(clamp(t / 0.45));
      const out = Math.max(0, after);
      const scale = t < IMPACT ? 0.75 + 0.25 * grow - 0.1 * k : 0.9 + out * 1.6;
      const alpha = (t < IMPACT ? grow : Math.max(0, 1 - out / 0.6)) * (0.75 + 0.25 * Math.sin(t * 20 * k));
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

    if (t < IMPACT + 0.03) {
      // The two relics orbit inward on ribbons of light.
      const ang = t * 2.2 + k * 13;
      const orbit = R * 0.9 * (1 - k);
      const em = 92 - 44 * k;
      const pa = { x: cx + Math.cos(ang) * orbit, y: cy + Math.sin(ang) * orbit * 0.8 };
      const pb = { x: cx - Math.cos(ang) * orbit, y: cy - Math.sin(ang) * orbit * 0.8 };
      trailA.push(pa);
      trailB.push(pb);
      if (trailA.length > 22) trailA.shift();
      if (trailB.length > 22) trailB.shift();
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
      // Lightning leaps between them and the core as they close in.
      if (charge > 0.55) {
        const strength = (charge - 0.55) / 0.45;
        for (const [p, c] of [[pa, colA], [pb, colB]] as const) {
          if (Math.random() > 0.35 + strength * 0.6) continue;
          ctx.strokeStyle = Math.random() < 0.4 ? '#ffffff' : c;
          ctx.globalAlpha = 0.5 + strength * 0.5;
          ctx.lineWidth = 1 + strength * 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          const steps = 6;
          for (let s = 1; s <= steps; s++) {
            const q = s / steps;
            const jag = s < steps ? (Math.random() - 0.5) * 30 * (1 - q * 0.5) : 0;
            ctx.lineTo(p.x + (cx - p.x) * q + jag, p.y + (cy - p.y) * q + jag);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // a halo behind each relic, then the relic itself
      for (const [p, rgb] of [[pa, rgbA], [pb, accentRGB]] as const) {
        const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, em * 0.9);
        hg.addColorStop(0, `rgba(${rgb},0.55)`);
        hg.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = hg;
        ctx.fillRect(p.x - em, p.y - em, em * 2, em * 2);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = emojiFont(em);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = clamp(t / 0.25);
      ctx.fillText(opts.a, pa.x, pa.y);
      ctx.fillText(opts.b, pb.x, pb.y);
      ctx.restore();
    }

    // The moment they meet: sparks thrown out in every direction.
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
      s.vy = s.vy * Math.pow(0.04, dt) + 40 * dt;
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

    if (t >= IMPACT) {
      // The new relic springs out, then hangs there, bobbing.
      const p = clamp(after / 0.45);
      const pop = p < 1 ? (1.3 * Math.sin(p * Math.PI * 0.75)) / Math.sin(Math.PI * 0.75) : 1 + 0.03 * Math.sin(after * 5);
      const em = Math.min(w, h) * 0.28 * Math.max(0, Math.min(1.3, pop));
      ctx.save();
      ctx.globalAlpha = fadeOut;
      ctx.font = emojiFont(Math.max(1, em));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 40;
      ctx.fillText(opts.out, cx, cy - Math.sin(after * 3) * 4);
      ctx.restore();

      // Its name slams in underneath, in light that runs from white to the forge's colour.
      const q = clamp((after - 0.3) / 0.25);
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
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
