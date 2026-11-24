// Story cutscenes: short animated pixel scenes that play inside a conversation, for the moments
// the story would otherwise only tell. Each is a few seconds long, drawn on a 320x180 canvas,
// with a caption under it. Skippable, and with Calm motion on it shows its last frame, still.

import { sfx } from './audio';
import { sprites } from './sprites';
import { npcFigure } from './story';
import { calmMotion, overlay, showOverlay } from './ui';

export type SceneId = 'knock' | 'beacon' | 'chair' | 'sink';

const W = 320;
const H = 180;

interface Scene {
  /** Seconds it plays for before Continue shows. */
  dur: number;
  /** Who sees what: a line describing it, for screen readers. */
  label: string;
  draw: (ctx: CanvasRenderingContext2D, t: number) => void;
  /** The caption under the picture at time t. */
  caption: (t: number) => string;
  /** Sounds, each at its moment. */
  sounds?: [number, () => void][];
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mix = (c1: [number, number, number], c2: [number, number, number], k: number) =>
  `rgb(${Math.round(lerp(c1[0], c2[0], k))}, ${Math.round(lerp(c1[1], c2[1], k))}, ${Math.round(lerp(c1[2], c2[2], k))})`;

/** Snow falling across the whole scene, the same flakes every time. */
function snow(ctx: CanvasRenderingContext2D, t: number, n = 60, alpha = 0.85) {
  ctx.fillStyle = `rgba(235, 245, 255, ${alpha})`;
  for (let i = 0; i < n; i++) {
    const speed = 8 + (i % 5) * 4;
    const x = ((i * 53.7 + Math.sin(t * 0.7 + i) * 6) % W + W) % W;
    const y = ((i * 31.3) + t * speed) % H;
    const big = i % 7 === 0;
    ctx.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1);
  }
}

/** A sprite or figure, scaled up crisply. */
function blit(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, s: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x), Math.round(y), img.width * s, img.height * s);
  ctx.restore();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, ${a})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function flames(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, k = 1) {
  if (k <= 0) return;
  for (let i = 0; i < w; i += 2) {
    const fh = Math.max(1, Math.round(h * k * (0.55 + 0.45 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 5.3 + i))));
    ctx.fillStyle = '#c0391c';
    ctx.fillRect(x + i, y - fh, 2, fh);
    ctx.fillStyle = '#ff8a2a';
    ctx.fillRect(x + i, y - Math.round(fh * 0.7), 2, Math.round(fh * 0.7));
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(x + i, y - Math.round(fh * 0.35), 2, Math.round(fh * 0.35));
  }
}

// ---------- Three Knocks: the door in the ice ----------
const KNOCKS = [2.0, 2.9, 3.8];
const knock: Scene = {
  dur: 8.2,
  label: 'A black door set in the ice. The knocker lifts by itself and knocks three times, and words write themselves in the frost: May I come in?',
  sounds: KNOCKS.map((k) => [k + 0.3, () => sfx.bump()] as [number, () => void]),
  caption: (t) => (t < KNOCKS[2] + 0.4 ? '' : t < 4.6 ? 'Knock. Knock. Knock.' : ''),
  draw(ctx, t) {
    const hit = KNOCKS.find((k) => t - (k + 0.3) >= 0 && t - (k + 0.3) < 0.15);
    const sx = hit !== undefined ? Math.round(Math.sin(t * 90) * 2) : 0;
    ctx.save();
    ctx.translate(sx, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04060c');
    sky.addColorStop(1, '#101a2c');
    ctx.fillStyle = sky;
    ctx.fillRect(-4, 0, W + 8, H);
    // walls of ice either side, and the floor
    for (const [x0, x1] of [[-4, 70], [250, W + 4]]) {
      ctx.fillStyle = '#26344a';
      ctx.fillRect(x0, 0, x1 - x0, 150);
      ctx.fillStyle = 'rgba(168, 200, 224, 0.25)';
      for (let y = 8; y < 150; y += 14) ctx.fillRect(x0, y, x1 - x0, 1);
      ctx.fillStyle = 'rgba(230, 246, 255, 0.5)';
      for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 6 + ((k * 23) % (x1 - x0 - 10)), 150, 2, 4 + (k % 3) * 3);
    }
    ctx.fillStyle = '#a8c8e0';
    ctx.fillRect(-4, 150, W + 8, 30);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let x = 0; x < W; x += 19) ctx.fillRect(x, 153 + ((x * 7) % 6), 9, 1);
    // the door, very old, with the knocker on the wrong side
    glow(ctx, 160, 95, 90, '150, 205, 245', 0.12);
    ctx.fillStyle = '#3a4c62';
    ctx.fillRect(104, 28, 112, 124);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(112, 36, 96, 116);
    ctx.fillStyle = '#0d1220';
    for (let y = 44; y < 150; y += 18) ctx.fillRect(116, y, 88, 1);
    let lift = 0;
    for (const k of KNOCKS) {
      const d = t - k;
      if (d >= 0 && d < 0.3) lift = Math.sin((d / 0.3) * Math.PI * 0.5) * 9;
    }
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(157, 116, 6, 4);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(154, 120 - lift, 12, 3);
    ctx.fillRect(152, 112 - lift, 3, 10);
    ctx.fillRect(165, 112 - lift, 3, 10);
    // frost bursting off the door with each knock
    for (const k of KNOCKS) {
      const d = t - (k + 0.3);
      if (d < 0 || d > 0.9) continue;
      ctx.fillStyle = `rgba(230, 246, 255, ${1 - d / 0.9})`;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        ctx.fillRect(Math.round(160 + Math.cos(a) * d * 40), Math.round(118 + Math.sin(a) * d * 26), 2, 2);
      }
    }
    // the words, written slowly in the frost as if by a fingertip
    const words = ['MAY I', 'COME IN?'];
    let n = Math.max(0, Math.floor((t - 4.6) / 0.13));
    ctx.font = '12px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    words.forEach((w, row) => {
      const shown = w.slice(0, Math.max(0, n));
      n -= w.length;
      if (!shown) return;
      ctx.shadowColor = 'rgba(159, 232, 255, 0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#dff4ff';
      const full = ctx.measureText(w).width;
      ctx.textAlign = 'left';
      ctx.fillText(shown, 160 - full / 2, 62 + row * 18);
      ctx.shadowBlur = 0;
    });
    ctx.restore();
    snow(ctx, t, 40, 0.6);
  },
};

// ---------- Mortimer's Errand: the Beacon catches ----------
const WINDOWS: [number, number][] = [[168, 118], [184, 118], [206, 112], [222, 112], [244, 120], [262, 120], [280, 110], [296, 110], [190, 130], [270, 132]];
const beacon: Scene = {
  dur: 8.8,
  label: 'The Midwinter Beacon catches on the shore of the frozen mere, and one by one every window in Gravesend lights up warm.',
  sounds: [[1.3, () => sfx.relic()], [3.4, () => sfx.heal()]],
  caption: (t) => (t < 3.4 ? '' : 'Every hearth in Gravesend flares warm at once.'),
  draw(ctx, t) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#05070f');
    sky.addColorStop(1, '#16213a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e6f6ff';
    for (let i = 0; i < 40; i++) if ((i * 7 + Math.floor(t * 2)) % 9) ctx.fillRect((i * 79) % W, (i * 37) % 90, 1, 1);
    // the frozen mere, and the snowy shore
    ctx.fillStyle = '#1c2a40';
    ctx.fillRect(0, 140, W, 14);
    ctx.fillStyle = '#dbe9f7';
    ctx.fillRect(0, 150, W, 30);
    ctx.fillStyle = '#b8cde0';
    for (let x = 0; x < W; x += 13) ctx.fillRect(x, 151 + ((x * 3) % 4), 7, 1);
    // Gravesend across the ice: roofs heavy with snow, windows dark until the fire reaches them
    const houses: [number, number, number][] = [[160, 108, 36], [200, 102, 30], [238, 112, 34], [274, 100, 34], [186, 124, 22], [262, 126, 24]];
    for (const [x, y, w] of houses) {
      ctx.fillStyle = '#121826';
      ctx.fillRect(x, y, w, 142 - y);
      ctx.fillStyle = '#0c111c';
      ctx.beginPath();
      ctx.moveTo(x - 3, y);
      ctx.lineTo(x + w / 2, y - 12);
      ctx.lineTo(x + w + 3, y);
      ctx.fill();
      ctx.fillStyle = '#e6f2ff';
      ctx.fillRect(x - 2, y - 1, w + 4, 2);
    }
    WINDOWS.forEach(([x, y], i) => {
      const on = clamp((t - (3.4 + i * 0.26)) / 0.25);
      ctx.fillStyle = on > 0 ? mix([24, 30, 44], [255, 200, 110], on) : '#181e2c';
      ctx.fillRect(x, y, 5, 6);
      if (on > 0) glow(ctx, x + 2, y + 3, 12, '255, 190, 100', 0.25 * on);
      if (on >= 1) {
        // a curl of chimney smoke
        ctx.fillStyle = 'rgba(200, 210, 225, 0.35)';
        for (let k = 0; k < 4; k++) ctx.fillRect(x + 2 + Math.round(Math.sin(t * 2 + k + i) * 2), y - 18 - k * 5 - ((t * 6) % 5), 2, 2);
      }
    });
    // the Beacon: a stone tower on the shore, its brazier waiting
    ctx.fillStyle = '#3a3540';
    ctx.fillRect(40, 72, 26, 78);
    ctx.fillStyle = '#4a4550';
    for (let y = 78; y < 150; y += 8) ctx.fillRect(40, y, 26, 1);
    ctx.fillStyle = '#e6f2ff';
    ctx.fillRect(38, 70, 30, 3);
    ctx.fillStyle = '#2a2433';
    ctx.fillRect(36, 60, 34, 10);
    const fire = clamp((t - 1.2) / 1.6);
    if (t > 1.0 && t < 1.3) {
      ctx.fillStyle = '#fff2c0';
      ctx.fillRect(52, 56, 2, 2);
    }
    glow(ctx, 53, 54, 20 + 90 * fire, '255, 160, 70', 0.35 * fire);
    flames(ctx, 38, 60, 30, 26, t, fire);
    if (fire > 0.5) {
      ctx.fillStyle = `rgba(255, 210, 122, ${fire})`;
      for (let k = 0; k < 6; k++) ctx.fillRect(40 + ((k * 11 + Math.floor(t * 20)) % 26), 30 - ((t * 30 + k * 13) % 30), 1, 1);
    }
    // the firelight spilling across the snow, fading with distance
    if (fire > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 150, W, 30);
      ctx.clip();
      glow(ctx, 53, 152, 30 + 120 * fire, '255, 170, 90', 0.3 * fire);
      ctx.restore();
    }
    snow(ctx, t, 50, 0.7);
  },
};

// ---------- The Longest Night (the chair): by the fire at the Last Orders ----------
const chair: Scene = {
  dur: 10,
  label: 'At the Last Orders, the Guest sits the longest night in the chair by the fire with a bowl of soup, Mortimer beside it. At dawn the Guest is gone, and Mortimer sleeps on, smiling.',
  sounds: [[6.6, () => sfx.toll()]],
  caption: (t) => (t < 5.6 ? 'The Guest sat the longest night by the fire.' : 'At dawn it went home across the mere, warm at last. Mortimer slept on.'),
  draw(ctx, t) {
    const dawn = clamp((t - 4.5) / 4.5);
    // the inn: plank walls, the floor, a window onto the night going to dawn
    ctx.fillStyle = '#3a2618';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#4a3020';
    for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 15, 140);
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, 140, W, 40);
    ctx.fillStyle = '#3a2618';
    for (let x = 0; x < W; x += 24) ctx.fillRect(x, 140, 1, 40);
    const winSky = ctx.createLinearGradient(0, 22, 0, 72);
    winSky.addColorStop(0, mix([10, 16, 32], [150, 190, 232], dawn));
    winSky.addColorStop(1, mix([20, 30, 56], [240, 170, 120], dawn));
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(26, 18, 58, 58);
    ctx.fillStyle = winSky;
    ctx.fillRect(30, 22, 50, 50);
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(54, 22, 2, 50);
    ctx.fillRect(30, 46, 50, 2);
    ctx.fillStyle = 'rgba(240, 248, 255, 0.8)';
    for (let i = 0; i < 12; i++) ctx.fillRect(30 + ((i * 17 + Math.floor(t * 8)) % 50), 22 + ((i * 11 + t * 10) % 50), 1, 1);
    // the hearth, burning warm
    ctx.fillStyle = '#5a5050';
    ctx.fillRect(232, 70, 70, 72);
    ctx.fillStyle = '#100a08';
    ctx.fillRect(244, 98, 46, 44);
    glow(ctx, 266, 128, 110, '255, 150, 60', 0.35);
    flames(ctx, 248, 140, 38, 26, t, 1);
    ctx.fillStyle = '#6b6060';
    ctx.fillRect(228, 66, 78, 6);
    // the two chairs, side by side, and the table with the bowl
    const chairAt = (x: number) => {
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(x, 104, 30, 6);
      ctx.fillRect(x + 24, 80, 6, 30);
      ctx.fillRect(x + 2, 110, 3, 30);
      ctx.fillRect(x + 25, 110, 3, 30);
    };
    chairAt(186);
    chairAt(120);
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(158, 114, 22, 4);
    ctx.fillRect(167, 118, 4, 22);
    ctx.fillStyle = '#8a857a';
    ctx.fillRect(162, 109, 12, 5);
    ctx.fillStyle = '#c9d1e0';
    ctx.fillRect(163, 108, 10, 1);
    if (dawn < 0.8) {
      ctx.fillStyle = 'rgba(232, 220, 196, 0.5)';
      for (let k = 0; k < 3; k++) ctx.fillRect(165 + k * 3 + Math.round(Math.sin(t * 2 + k) * 1.5), 100 - ((t * 8 + k * 4) % 12), 1, 2);
    }
    // the Guest in the chair by the fire, fading with the dawn
    const gone = clamp((t - 6.2) / 2);
    if (gone < 1) {
      blit(ctx, sprites().guest.normal, 186, 64, 4, 1 - gone);
      if (gone > 0) {
        ctx.fillStyle = `rgba(230, 246, 255, ${0.8 * (1 - gone)})`;
        for (let i = 0; i < 10; i++) ctx.fillRect(190 + ((i * 13) % 40), 70 + ((i * 17 + t * 20) % 40), 1, 1);
      }
    }
    // Mortimer beside it, nodding off
    blit(ctx, npcFigure('gravedigger'), 124, 74, 3);
    if (t > 7.4) {
      ctx.font = '8px Silkscreen, monospace';
      ctx.fillStyle = 'rgba(232, 220, 196, 0.85)';
      const z = (t * 0.8) % 1;
      ctx.fillText('z', 150 + z * 8, 70 - z * 14);
      ctx.fillText('z', 158 + ((z + 0.5) % 1) * 8, 64 - ((z + 0.5) % 1) * 14);
    }
    // dawn light coming in through the window
    if (dawn > 0) {
      ctx.fillStyle = `rgba(255, 200, 150, ${0.12 * dawn})`;
      ctx.beginPath();
      ctx.moveTo(30, 72);
      ctx.lineTo(84, 72);
      ctx.lineTo(170, 150);
      ctx.lineTo(60, 150);
      ctx.fill();
    }
  },
};

// ---------- The Longest Night (the bell): back under the ice ----------
const sink: Scene = {
  dur: 9.6,
  label: "Pip's bell rings over the frozen mere. The Guest listens, then sinks slowly back under the ice, which closes over it, while Mortimer watches from the shore with the bowl.",
  sounds: [[1.4, () => sfx.toll()], [4.4, () => sfx.toll()]],
  caption: (t) => (t < 1.4 ? '' : t < 5 ? 'Not tonight.' : 'It sank back under the ice, to wait for next Midwinter.'),
  draw(ctx, t) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#05070f');
    sky.addColorStop(1, '#1a2640');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // the ice, wide and flat, the shore on the left
    ctx.fillStyle = '#7f9fbc';
    ctx.fillRect(0, 126, W, 54);
    ctx.fillStyle = 'rgba(230, 246, 255, 0.35)';
    for (let x = 0; x < W; x += 17) ctx.fillRect(x, 130 + ((x * 5) % 30), 10, 1);
    ctx.fillStyle = '#dbe9f7';
    ctx.beginPath();
    ctx.moveTo(0, 120);
    ctx.lineTo(70, 124);
    ctx.lineTo(90, 180);
    ctx.lineTo(0, 180);
    ctx.fill();
    // the bell's note going out over the mere, ring after ring
    for (const k of [1.4, 4.4]) {
      const d = t - k;
      if (d < 0 || d > 2.4) continue;
      ctx.strokeStyle = `rgba(242, 193, 78, ${0.6 * (1 - d / 2.4)})`;
      ctx.lineWidth = 1;
      for (let r = 0; r < 3; r++) {
        const rad = d * 70 - r * 16;
        if (rad <= 0) continue;
        ctx.beginPath();
        ctx.ellipse(160, 30, rad, rad * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // the hole in the ice, opening and then closing over it
    const open = clamp((t - 2.6) / 0.8) * (1 - clamp((t - 7.2) / 1.2));
    if (open > 0) {
      ctx.fillStyle = '#05070c';
      ctx.beginPath();
      ctx.ellipse(186, 140, 26 * open, 7 * open, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230, 246, 255, 0.6)';
      ctx.stroke();
    }
    // the Guest, sinking slowly and politely out of sight
    const down = clamp((t - 3.2) / 3.6) * 52;
    if (down < 52) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, 141);
      ctx.clip();
      blit(ctx, sprites().guest.normal, 162, 90 + down, 4);
      ctx.restore();
    }
    // Mortimer on the shore, holding the bowl
    blit(ctx, npcFigure('gravedigger'), 32, 88, 3);
    ctx.fillStyle = '#8a857a';
    ctx.fillRect(58, 110, 8, 3);
    snow(ctx, t, 60, 0.75);
  },
};

const SCENES: Record<SceneId, Scene> = { knock, beacon, chair, sink };

/** Play a cutscene, then carry on. */
export function playScene(id: SceneId, done: () => void) {
  const sc = SCENES[id];
  if (!sc) return done();
  showOverlay('cutscene', `
    <div class="cut-stage">
      <canvas class="cut-cv" id="cut-cv" width="${W}" height="${H}" role="img" aria-label="${sc.label}"></canvas>
      <p class="cut-cap" id="cut-cap" aria-live="polite"></p>
      <button class="btn primary" id="cut-next" style="visibility:hidden">Continue ▸</button>
      <button class="link-btn" id="cut-skip">Skip</button>
    </div>`);
  const cv = overlay.querySelector<HTMLCanvasElement>('#cut-cv')!;
  const cap = overlay.querySelector<HTMLElement>('#cut-cap')!;
  const next = overlay.querySelector<HTMLButtonElement>('#cut-next')!;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  let finished = false;
  let left = false;
  const leave = () => {
    if (left) return;
    left = true;
    done();
  };
  const end = () => {
    if (finished) return;
    finished = true;
    next.style.visibility = 'visible';
    next.focus();
  };
  next.addEventListener('click', leave);
  overlay.querySelector('#cut-skip')!.addEventListener('click', leave);
  cv.addEventListener('click', () => (finished ? leave() : end()));
  const show = (t: number) => {
    ctx.clearRect(0, 0, W, H);
    sc.draw(ctx, t);
    const c = sc.caption(t);
    if (cap.textContent !== c) cap.textContent = c;
  };
  // Calm motion: the last frame, still, with its caption.
  if (calmMotion()) {
    show(sc.dur);
    end();
    return;
  }
  const t0 = performance.now();
  const played = new Set<number>();
  const frame = (now: number) => {
    if (left || !cv.isConnected) return;
    const t = (now - t0) / 1000;
    (sc.sounds ?? []).forEach(([at, play], i) => {
      if (t >= at && !played.has(i)) {
        played.add(i);
        play();
      }
    });
    show(Math.min(t, sc.dur));
    if (t >= sc.dur) end();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
