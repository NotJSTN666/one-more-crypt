// The Soul Forge's fusion, played full screen for about three seconds: the two relics are
// drawn into a spinning rune circle, orbit faster and faster while energy streams in, then
// collide in a white flash and shockwaves, and the new relic rises in a burst of light.

const DURATION = 3.1;
/** When the two relics collide, in seconds (matches fusionSound). */
export const IMPACT = 1.9;

interface Spark { x: number; y: number; vx: number; vy: number; life: number; t: number; size: number; color: string }

const ease = (t: number) => t * t * t;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export function playFusion(opts: { a: string; b: string; out: string; name: string; ascended: boolean; onDone: () => void }) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return opts.onDone();
  const color = opts.ascended ? '#f2c14e' : '#7fb4ff';
  const glowRGB = opts.ascended ? '242,193,78' : '127,180,255';
  const canvas = document.createElement('canvas');
  canvas.className = 'fusion-fx';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0;
  let h = 0;
  const size = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  };
  size();
  window.addEventListener('resize', size);

  const sparks: Spark[] = [];
  const trailA: { x: number; y: number }[] = [];
  const trailB: { x: number; y: number }[] = [];
  let burst = false;
  let done = false;
  const start = performance.now();
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
    if (t >= DURATION) return finish();
    const cx = w / 2;
    const cy = h * 0.46;
    const R = Math.min(w, h) * 0.34;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Rising shake through the charge, a hard jolt at impact.
    const charge = clamp(t / IMPACT);
    const after = t - IMPACT;
    const shake = t < IMPACT ? ease(charge) * 9 : Math.max(0, 16 - after * 40);
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // Darkness closes in.
    const fadeOut = clamp((DURATION - t) / 0.35);
    ctx.fillStyle = `rgba(4, 2, 8, ${0.9 * clamp(t / 0.3) * fadeOut})`;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    // A glow gathering at the centre.
    const core = t < IMPACT ? 30 + ease(charge) * R * 0.9 : R * 1.2 * Math.max(0, 1 - after * 0.6);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, core));
    g.addColorStop(0, `rgba(255,255,255,${0.55 * fadeOut})`);
    g.addColorStop(0.3, `rgba(${glowRGB},${0.45 * fadeOut})`);
    g.addColorStop(1, `rgba(${glowRGB},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - core, cy - core, core * 2, core * 2);

    if (t < IMPACT + 0.05) {
      // The rune circle: two rings of glyph marks, spinning faster as it tightens.
      const spin = t * (1.5 + ease(charge) * 14);
      const rr = R * (1.15 - 0.35 * ease(charge));
      ctx.save();
      ctx.globalAlpha = clamp(t / 0.4) * 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      for (const [r, dir, n] of [[rr, 1, 16], [rr * 0.78, -1.4, 10]] as const) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < n; k++) {
          const a = spin * dir + (k / n) * Math.PI * 2;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a);
          ctx.strokeRect(-4, -4, 8, 8);
          ctx.restore();
        }
      }
      ctx.restore();

      // Energy streaming in from everywhere.
      const rate = 3 + ease(charge) * 14;
      for (let k = 0; k < rate; k++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.max(w, h) * (0.6 + Math.random() * 0.3);
        sparks.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: -Math.cos(a), vy: -Math.sin(a), life: 0.7, t: 0, size: 2, color: Math.random() < 0.3 ? '#ffffff' : color });
      }

      // The two relics orbit inward, faster and faster, trailing light.
      const k = ease(charge);
      const ang = t * 2 + k * 14;
      const orbit = R * (1 - k);
      const em = 96 - 46 * k;
      const pa = { x: cx + Math.cos(ang) * orbit, y: cy + Math.sin(ang) * orbit * 0.8 };
      const pb = { x: cx - Math.cos(ang) * orbit, y: cy - Math.sin(ang) * orbit * 0.8 };
      trailA.push(pa);
      trailB.push(pb);
      if (trailA.length > 14) trailA.shift();
      if (trailB.length > 14) trailB.shift();
      ctx.save();
      for (const trail of [trailA, trailB]) {
        trail.forEach((p, i) => {
          const a = (i / trail.length) * 0.5;
          ctx.fillStyle = `rgba(${glowRGB},${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (em * 0.35 * i) / trail.length, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.font = emojiFont(em);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 30;
      ctx.globalAlpha = clamp(t / 0.25);
      ctx.fillText(opts.a, pa.x, pa.y);
      ctx.fillText(opts.b, pb.x, pb.y);
      ctx.restore();
    }

    // Impact: flash, shockwaves and a ring of sparks.
    if (t >= IMPACT && !burst) {
      burst = true;
      for (let k = 0; k < 160; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = 300 + Math.random() * 900;
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.8, t: 0, size: 2 + Math.random() * 3, color: Math.random() < 0.4 ? '#ffffff' : color });
      }
    }

    // Sparks: inbound streaks before the impact, an explosion after.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += 1 / 60;
      if (s.t > s.life) {
        sparks.splice(i, 1);
        continue;
      }
      if (!burst || (Math.abs(s.vx) <= 1 && Math.abs(s.vy) <= 1)) {
        // pulled toward the centre, accelerating
        const dx = cx - s.x;
        const dy = cy - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 12) {
          sparks.splice(i, 1);
          continue;
        }
        const step = (12 + s.t * 40) * (1 + ease(charge) * 2);
        const nx = s.x + (dx / d) * step;
        const ny = s.y + (dy / d) * step;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = s.size;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        s.x = nx;
        s.y = ny;
      } else {
        s.x += s.vx / 60;
        s.y += s.vy / 60;
        s.vx *= 0.93;
        s.vy *= 0.93;
        ctx.globalAlpha = 1 - s.t / s.life;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }
    ctx.restore();

    if (t >= IMPACT) {
      // Light rays turning behind the new relic.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rays = 14;
      const rayA = Math.max(0, 0.5 - after * 0.15) * fadeOut;
      ctx.translate(cx, cy);
      ctx.rotate(after * 0.6);
      for (let k = 0; k < rays; k++) {
        ctx.rotate((Math.PI * 2) / rays);
        const len = Math.max(w, h);
        const grad = ctx.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0, `rgba(${glowRGB},${rayA})`);
        grad.addColorStop(1, `rgba(${glowRGB},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(len, -len * 0.06);
        ctx.lineTo(len, len * 0.06);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Three shockwaves.
      for (let k = 0; k < 3; k++) {
        const p = (after - k * 0.09) / 0.7;
        if (p <= 0 || p >= 1) continue;
        ctx.strokeStyle = k === 1 ? '#ffffff' : color;
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 10 * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 20 + p * Math.max(w, h) * 0.75, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // The new relic springs out, then hangs there glowing.
      const p = clamp(after / 0.45);
      const pop = p < 1 ? 1.35 * Math.sin(p * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1 + 0.03 * Math.sin(after * 5);
      const em = Math.min(w, h) * 0.3 * Math.max(0, Math.min(1.35, pop));
      ctx.save();
      ctx.globalAlpha = fadeOut;
      ctx.font = emojiFont(Math.max(1, em));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 50;
      ctx.fillText(opts.out, cx, cy - Math.sin(after * 3) * 4);
      ctx.restore();

      // Its name slams in underneath.
      const q = clamp((after - 0.3) / 0.25);
      if (q > 0) {
        const scale = 1 + (1 - q) * 1.4;
        ctx.save();
        ctx.globalAlpha = q * fadeOut;
        ctx.translate(cx, cy + Math.min(w, h) * 0.3);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.font = `${Math.min(18, w * 0.04)}px Silkscreen, monospace`;
        ctx.fillText(opts.ascended ? 'ASCENDED' : 'FUSED', 0, -Math.min(52, w * 0.1));
        ctx.font = `${Math.min(64, w * 0.12)}px "Pirata One", Georgia, serif`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = color;
        ctx.shadowBlur = 24;
        ctx.fillText(opts.name, 0, 0);
        ctx.restore();
      }

      // The white flash on top of everything.
      const flash = Math.max(0, 1 - after / 0.35);
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash})`;
        ctx.fillRect(-20, -20, w + 40, h + 40);
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
