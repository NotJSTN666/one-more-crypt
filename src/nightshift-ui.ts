// The Night Shift on screen: the graveyard at night seen from above, the dead closing in, your
// relics fighting on their own, a level-up choice whenever you fill the soul bar, the bosses'
// bolts and lanes to dodge, and how many you put down. On phones a joystick sits at the bottom.

import { setMusicDepth, setMusicMood, setNightHeat, sfx } from './audio';
import { drawAura } from './aura';
import { NIGHT_GIFT, NIGHT_GIFT_KILLS } from './graveshift';
import { heroSprite } from './hero';
import { grave, groundFor, hash, paintGround, tree, type Px } from './hollow-art';
import { graveState, meta, outfitFor, receiveGift, saveMeta } from './meta';
import {
  DASH_COOLDOWN, FIELD, MAX_LEVEL, area, dash, spadeReach, NIGHT_RELIC, NIGHT_RELICS, chooseRelic, frostRadius, levelChoices, newNight, nextBossAt, nightSouls, skullCount, step, xpToLevel, type RelicKind,
} from './nightshift';
import { enemyFrames, type Sprite } from './sprites';
import { esc, on, overlay, showOverlay, toast } from './ui';

const TILE = 16;
const STEP = 1 / 60;

const BOSS_NAME: Record<string, string> = { boss: 'The Gravelord', abbot: 'The Drowned Abbot', lich: 'The Lich' };

type StickSide = 'left' | 'middle' | 'right';
const STICK_KEY = 'omc:ns-stick';
function stickSide(): StickSide {
  try {
    const v = localStorage.getItem(STICK_KEY);
    return v === 'left' || v === 'middle' ? v : 'right';
  } catch {
    return 'right';
  }
}

// The field is painted once: grass and paths, with old graves and trees scattered about.
let field: HTMLCanvasElement | null = null;
function fieldCanvas(): HTMLCanvasElement {
  if (field) return field;
  const map: string[] = [];
  const mid = FIELD / 2;
  for (let y = 0; y < FIELD; y++) {
    let row = '';
    for (let x = 0; x < FIELD; x++) {
      if (x === 0 || y === 0 || x === FIELD - 1 || y === FIELD - 1) row += '#';
      // two worn paths crossing at the middle, with a ring round it
      else if (Math.abs(x - mid) < 1 || Math.abs(y - mid) < 1 || Math.abs(Math.hypot(x - mid + 0.5, y - mid + 0.5) - 7) < 0.6) row += ':';
      else row += '.';
    }
    map.push(row);
  }
  const c = document.createElement('canvas');
  c.width = FIELD * TILE;
  c.height = FIELD * TILE;
  const ctx = c.getContext('2d')!;
  const g = groundFor('graveyard');
  paintGround(ctx, map, (ch) => ch === ':', g);
  const px: Px = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  for (let y = 2; y < FIELD - 2; y++) {
    for (let x = 2; x < FIELD - 2; x++) {
      if (map[y][x] !== '.' || Math.hypot(x - mid, y - mid) < 4) continue;
      const r = hash(x, y, 31);
      if (r < 0.035) tree(px, x * TILE, y * TILE, x, y, g, 0);
      else if (r < 0.085) grave(px, x * TILE, y * TILE, x, y, false);
    }
  }
  field = c;
  return c;
}

/** Stand a night in the graveyard. `back` leaves. */
export function showNightShift(back: () => void) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const side = stickSide();
  showOverlay('nightshift', `
    <div class="ns-wrap ${touch ? 'touch' : ''}">
      <div class="ns-hud">
        <div class="ns-row">
          <span class="ns-hp"><i id="ns-hp-bar"></i><b id="ns-hp">20</b></span>
          <span class="ns-kills">💀 <b id="ns-kills">0</b></span>
          <button type="button" class="ns-pause" id="ns-pause" aria-label="Pause">⏸</button>
        </div>
        <div class="ns-xp"><i id="ns-xp-bar"></i><span id="ns-level">Lv 1</span></div>
        <div class="ns-row ns-sub">
          <span class="ns-relics" id="ns-relics"></span>
          <span class="ns-time"><span id="ns-clock">0:00</span> · ☠️ <span id="ns-next">1:30</span></span>
        </div>
      </div>
      <div class="ns-stage" id="ns-stage">
        <canvas id="ns-canvas" aria-label="The graveyard at night, with the dead closing in"></canvas>
        <div class="ns-boss" id="ns-boss" hidden><span id="ns-boss-name"></span><i><b id="ns-boss-bar"></b></i></div>
        <div class="ns-hint" id="ns-hint">${touch ? 'Use the stick to move, and 💨 to dash.' : 'WASD or arrows to move, Space to dash.'} Your relics fight on their own. Put down as many as you can.</div>
        ${touch ? '' : dashButton('desk')}
        <div class="ns-modal" id="ns-modal" hidden></div>
      </div>
      ${touch ? `<div class="ns-pad" id="ns-pad"><div class="ns-joy ${side}" id="ns-joy"><i id="ns-knob"></i></div>${dashButton(dashSide(side))}</div>` : ''}
    </div>`);
  const canvas = overlay.querySelector<HTMLCanvasElement>('#ns-canvas')!;
  const stage = overlay.querySelector<HTMLElement>('#ns-stage')!;
  const modal = overlay.querySelector<HTMLElement>('#ns-modal')!;
  const pad = overlay.querySelector<HTMLElement>('#ns-pad');
  const joy = overlay.querySelector<HTMLElement>('#ns-joy');
  const knob = overlay.querySelector<HTMLElement>('#ns-knob');
  const ctx = canvas.getContext('2d')!;
  const $id = (id: string) => overlay.querySelector<HTMLElement>(`#${id}`)!;

  const n = newNight();
  // Local development only: the night, for poking at from the console.
  if (import.meta.env.DEV) (window as unknown as { night?: unknown }).night = n;
  const fit = outfitFor(meta.hero);
  const hero = heroSprite(meta.hero, {}, [], fit.look, fit.head);
  const ground = fieldCanvas();
  let paused = false;
  let ended = false;
  let choosing: RelicKind[] | null = null;

  // ---- the canvas fills the stage, with a set number of tiles across ----
  let W = 0;
  let H = 0;
  let S = 1;
  const fitCanvas = () => {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const across = r.width < 600 ? 12 : r.width < 1000 ? 18 : 22;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    S = canvas.width / (across * TILE);
    W = across * TILE;
    H = canvas.height / S;
  };
  fitCanvas();
  const onResize = () => fitCanvas();
  window.addEventListener('resize', onResize);

  // ---- input: keys held, the stick, or a drag on the stage ----
  const held = new Set<string>();
  const KEY_DIR: Record<string, [number, number]> = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };
  let stick: { ox: number; oy: number; x: number; y: number; id: number; fixed: boolean } | null = null;
  const dir = (): [number, number] => {
    if (stick) {
      const dx = stick.x - stick.ox;
      const dy = stick.y - stick.oy;
      return Math.hypot(dx, dy) < 8 ? [0, 0] : [dx, dy];
    }
    let dx = 0;
    let dy = 0;
    for (const k of held) {
      const d = KEY_DIR[k];
      if (d) {
        dx += d[0];
        dy += d[1];
      }
    }
    return [dx, dy];
  };
  const onKey = (e: KeyboardEvent) => {
    if (!canvas.isConnected) return cleanup();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (choosing) {
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0 && choosing[i]) {
        e.preventDefault();
        pick(choosing[i]);
      }
      return;
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      return paused ? resume() : pause();
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat && !paused) doDash();
      return;
    }
    if (KEY_DIR[e.key]) {
      e.preventDefault();
      held.add(e.key);
    }
  };
  const doDash = () => {
    const [dx, dy] = dir();
    if (dash(n, dx, dy)) sfx.dash();
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.key);
  const onBlur = () => {
    held.clear();
    letGo();
  };
  const onHide = () => {
    if (document.hidden && !ended) pause();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onHide);
  function cleanup() {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onHide);
  }
  const STICK_R = 46;
  const showKnob = () => {
    if (!knob) return;
    const dx = stick?.fixed ? stick.x - stick.ox : 0;
    const dy = stick?.fixed ? stick.y - stick.oy : 0;
    const d = Math.hypot(dx, dy);
    const k = d > STICK_R ? STICK_R / d : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  function letGo() {
    stick = null;
    showKnob();
  }
  const grab = (el: HTMLElement, fixed: boolean) => {
    el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.ns-modal') || paused || choosing) return;
      e.preventDefault();
      let ox = e.clientX;
      let oy = e.clientY;
      if (fixed && joy) {
        // The stick pivots round its own centre, wherever in the pad you touch.
        const r = joy.getBoundingClientRect();
        ox = r.left + r.width / 2;
        oy = r.top + r.height / 2;
      }
      stick = { ox, oy, x: e.clientX, y: e.clientY, id: e.pointerId, fixed };
      el.setPointerCapture(e.pointerId);
      showKnob();
    });
    el.addEventListener('pointermove', (e) => {
      if (!stick || e.pointerId !== stick.id) return;
      if (!stick.fixed) {
        // A drag's centre follows a finger dragged far, so turning back is quick.
        const dx = e.clientX - stick.ox;
        const dy = e.clientY - stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > 50) {
          stick.ox = e.clientX - (dx / d) * 50;
          stick.oy = e.clientY - (dy / d) * 50;
        }
      }
      stick.x = e.clientX;
      stick.y = e.clientY;
      showKnob();
    });
    const lift = (e: PointerEvent) => {
      if (stick && e.pointerId === stick.id) letGo();
    };
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
  };
  const dashBtn = overlay.querySelector<HTMLElement>('#ns-dash')!;
  // The dash button takes its own touch, so pressing it never moves the stick.
  dashBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!paused && !choosing) doDash();
  });
  grab(stage, false);
  if (pad) grab(pad, true);

  // ---- pause, level-up and the end ----
  function pause() {
    if (ended || choosing || paused) return;
    paused = true;
    held.clear();
    letGo();
    modal.hidden = false;
    const at = stickSide();
    modal.innerHTML = `<h3>Paused</h3>
      <p class="fine">${fmt(n.t)} · level ${n.level} · ${n.kills} put down</p>
      <button type="button" class="btn primary" id="ns-resume">Keep going</button>
      ${touch ? `<p class="fine ns-side-label">Joystick</p><div class="ns-side">${(['left', 'middle', 'right'] as StickSide[])
        .map((s) => `<button type="button" class="btn ${s === at ? 'on' : ''}" data-side="${s}">${s === 'left' ? 'Left' : s === 'middle' ? 'Middle' : 'Right'}</button>`)
        .join('')}</div>` : ''}
      <button type="button" class="btn" id="ns-quit">Give up the night</button>`;
    modal.querySelector('#ns-resume')!.addEventListener('click', resume);
    modal.querySelector('#ns-quit')!.addEventListener('click', () => {
      n.over = true;
      finish();
    });
    modal.querySelectorAll<HTMLElement>('[data-side]').forEach((b) =>
      b.addEventListener('click', () => {
        const s = b.dataset.side as StickSide;
        try {
          localStorage.setItem(STICK_KEY, s);
        } catch {
          /* kept for this night only */
        }
        joy?.classList.remove('left', 'middle', 'right');
        joy?.classList.add(s);
        dashBtn.classList.remove('left', 'right');
        dashBtn.classList.add(dashSide(s));
        modal.querySelectorAll('[data-side]').forEach((o) => o.classList.toggle('on', o === b));
      }),
    );
    (modal.querySelector('#ns-resume') as HTMLElement).focus();
  }
  function resume() {
    if (!paused) return;
    paused = false;
    modal.hidden = true;
    last = performance.now();
  }
  $id('ns-pause').addEventListener('click', () => (paused ? resume() : pause()));

  function offerLevel() {
    const opts = levelChoices(n);
    if (!opts.length) {
      // Everything is as sharp as it gets: the level heals instead.
      n.pendingLevels = 0;
      n.hp = Math.min(n.maxHp, n.hp + 5);
      return;
    }
    choosing = opts;
    held.clear();
    letGo();
    sfx.relic();
    modal.hidden = false;
    modal.innerHTML = `<h3>Level ${n.level - n.pendingLevels + 1}</h3>
      <p class="fine">Choose a relic${touch ? '' : ' (1, 2 or 3)'}</p>
      <div class="ns-choices">${opts.map((id, i) => {
        const r = NIGHT_RELIC[id];
        const at = n.relics[id] ?? 0;
        return `<button type="button" class="ns-choice" data-pick="${id}">
          <span class="ns-choice-emoji">${r.emoji}</span>
          <span class="ns-choice-info"><b>${esc(r.name)}</b> <small>${at ? `Lv ${at + 1}${at + 1 === MAX_LEVEL ? ' · max' : ''}` : r.weapon ? 'New weapon' : 'New charm'}</small><span>${esc(r.text(at + 1))}</span></span>
          ${touch ? '' : `<kbd>${i + 1}</kbd>`}
        </button>`;
      }).join('')}</div>`;
    // A finger or key still down from walking mustn't pick straight away.
    const shown = performance.now();
    modal.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        if (performance.now() - shown > 300) pick(b.dataset.pick as RelicKind);
      }),
    );
  }
  function pick(id: RelicKind) {
    if (!choosing) return;
    chooseRelic(n, id);
    choosing = null;
    modal.hidden = true;
    sfx.heal();
    relicRow();
    last = performance.now();
  }

  function finish() {
    if (ended) return;
    ended = true;
    cleanup();
    const s = graveState();
    const souls = nightSouls(n);
    const best = n.kills > s.nightKills;
    meta.souls += souls;
    meta.earned += souls;
    s.nights++;
    s.nightBest = Math.max(s.nightBest, Math.floor(n.t));
    s.nightKills = Math.max(s.nightKills, n.kills);
    const title = n.kills >= NIGHT_GIFT_KILLS && !meta.gifts.includes(NIGHT_GIFT);
    if (title) receiveGift(NIGHT_GIFT);
    saveMeta();
    sfx.death();
    setMusicMood('fallen');
    const build = NIGHT_RELICS.filter((r) => n.relics[r.id]).map((r) => `${r.emoji}<small>${n.relics[r.id]}</small>`).join(' ');
    window.setTimeout(() => {
      if (!overlay.querySelector('#ns-canvas')) return;
      showOverlay('nightshift-end', `
        <h2>The night takes you</h2>
        <div class="ns-score"><b>${n.kills}</b><span>put down${best ? ' · new best' : ''}</span></div>
        <div class="ns-results">
          <div><b>${fmt(n.t)}</b><span>survived</span></div>
          <div><b>${n.level}</b><span>level</span></div>
          <div><b>${n.bossKills}</b><span>bosses felled</span></div>
        </div>
        <p class="ns-build">${build}</p>
        <div class="souls-chip">💀 <b>+${souls}</b> Souls</div>
        ${title ? '<p class="fine">🏅 New title: <b>The Unsleeping</b></p>' : ''}
        <p class="fine">Best: ${s.nightKills} put down · longest night ${fmt(s.nightBest)} · ${s.nights} night${s.nights === 1 ? '' : 's'} stood</p>
        <button class="btn primary" id="ns-again">🌙 Stand another night</button>
        <button class="btn" id="back">← Back</button>`);
      on('#ns-again', () => showNightShift(back));
      on('#back', back);
      if (title) toast('🏅 Title unlocked: The Unsleeping');
    }, 1200);
  }

  // ---- the HUD ----
  let hudKey = '';
  function relicRow() {
    $id('ns-relics').innerHTML = NIGHT_RELICS.filter((r) => n.relics[r.id])
      .map((r) => `<span class="ns-relic ${r.weapon ? '' : 'charm'}" title="${esc(r.name)}">${r.emoji}<small>${n.relics[r.id]}</small></span>`)
      .join('');
  }
  relicRow();
  let dashShown = -1;
  function hud() {
    const ready = Math.max(0, Math.min(1, 1 - (n.dashReady - n.t) / DASH_COOLDOWN));
    const step10 = Math.round(ready * 40);
    if (step10 !== dashShown) {
      dashShown = step10;
      dashBtn.style.setProperty('--cd', `${ready * 360}deg`);
      dashBtn.classList.toggle('ready', ready >= 1);
    }
    const key = `${Math.ceil(n.hp)}/${n.maxHp}|${Math.floor(n.t)}|${n.kills}|${n.level}|${n.xp}`;
    if (key === hudKey) return;
    hudKey = key;
    $id('ns-hp').textContent = `${Math.max(0, Math.ceil(n.hp))}`;
    $id('ns-hp-bar').style.width = `${Math.max(0, (n.hp / n.maxHp) * 100)}%`;
    $id('ns-clock').textContent = fmt(n.t);
    $id('ns-next').textContent = fmt(nextBossAt(n) - n.t);
    $id('ns-kills').textContent = String(n.kills);
    $id('ns-level').textContent = `Lv ${n.level}`;
    $id('ns-xp-bar').style.width = `${Math.min(100, (n.xp / xpToLevel(n.level)) * 100)}%`;
  }

  // ---- sounds, a few a second at most ----
  const lastSound: Record<string, number> = {};
  const play = (name: keyof typeof sfx, gap: number) => {
    const now = performance.now();
    if ((lastSound[name] ?? 0) + gap > now) return;
    lastSound[name] = now;
    sfx[name]();
  };

  // ---- the loop ----
  // The score builds with the night, and darkens while a boss is up.
  setMusicDepth(0);
  setNightHeat(0);
  setMusicMood('night');
  const music = () => {
    setNightHeat(n.t < 40 ? 0 : n.t < 120 ? 1 : n.t < 240 ? 2 : n.t < 420 ? 3 : 4);
    setMusicMood(n.foes.some((f) => f.boss) ? 'nightboss' : 'night');
  };
  let last = performance.now();
  let acc = 0;
  let seen = { kills: 0, hp: n.hp, bosses: 0, felled: 0 };
  // The bosses up last frame, so one that falls can be named; and when the last fell, for the flash.
  let bossesUp: { id: number; kind: string }[] = [];
  let felledAt = -10;
  const frame = (now: number) => {
    if (!canvas.isConnected) return cleanup();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && !choosing && !ended) {
      acc += dt;
      const [dx, dy] = dir();
      while (acc >= STEP && !n.over && !n.pendingLevels) {
        step(n, STEP, dx, dy);
        acc -= STEP;
      }
      if (n.pendingLevels && !n.over) {
        acc = 0;
        offerLevel();
      }
      if (n.over) finish();
    }
    // what happened, for the ears
    if (n.kills > seen.kills) play('kill', 70);
    if (n.hp < seen.hp) play('hurt', 150);
    if (n.bossesRisen > seen.bosses) {
      sfx.toll();
      const boss = [...n.foes].reverse().find((f) => f.boss);
      if (boss) toast(`☠️ ${BOSS_NAME[boss.kind]} rises`);
    }
    if (n.bossKills > seen.felled) {
      sfx.bossDown();
      felledAt = n.t;
      const fell = bossesUp.find((b) => !n.foes.some((f) => f.id === b.id));
      toast(`🏆 ${fell ? BOSS_NAME[fell.kind] : 'The boss'} falls`);
    }
    bossesUp = n.foes.filter((f) => f.boss).map((f) => ({ id: f.id, kind: f.kind }));
    if (n.flashes.some((f) => f.kind === 'bolt' && n.t - f.at < dt)) play('zap', 200);
    if (n.flashes.some((f) => f.kind === 'ring' && n.t - f.at < dt)) play('block', 300);
    if (n.flashes.some((f) => f.kind === 'lane' && n.t - f.at < dt)) play('crit', 250);
    seen = { kills: n.kills, hp: n.hp, bosses: n.bossesRisen, felled: n.bossKills };
    if (!ended) music();
    if (n.t > 6) $id('ns-hint').classList.add('gone');
    draw(now / 1000);
    hud();
    requestAnimationFrame(frame);
  };

  // ---- drawing ----
  function draw(t: number) {
    if (!W) fitCanvas();
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const px: Px = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    const camX = Math.max(0, Math.min(FIELD * TILE - W, n.x * TILE - W / 2));
    const camY = H >= FIELD * TILE ? (FIELD * TILE - H) / 2 : Math.max(0, Math.min(FIELD * TILE - H, n.y * TILE - H / 2));
    const sx = (x: number) => x * TILE - camX;
    const sy = (y: number) => y * TILE - camY;
    ctx.fillStyle = '#0b0910';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(ground, -Math.round(camX), -Math.round(camY));

    // burning ground and the frost ring, under everything
    for (const fl of n.flames) {
      const left = fl.until - n.t;
      const r = fl.r * TILE * (0.8 + 0.2 * Math.sin(t * 20 + fl.x));
      ctx.globalAlpha = Math.min(1, left) * 0.55;
      ctx.fillStyle = '#ff7a2a';
      ctx.beginPath();
      ctx.arc(sx(fl.x), sy(fl.y), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, left) * 0.8;
      for (let k = 0; k < 3; k++) px(sx(fl.x) - 3 + k * 3, sy(fl.y) - 2 - ((t * 30 + k * 7 + fl.x * 9) % 6), 1, 2, k % 2 ? '#ffd24a' : '#ff9a3a');
    }
    ctx.globalAlpha = 1;
    const fr = frostRadius(n);
    if (fr) {
      ctx.strokeStyle = 'rgba(160, 220, 255, 0.45)';
      ctx.fillStyle = 'rgba(120, 190, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx(n.x), sy(n.y), fr * TILE, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const a = t * 0.6 + (k / 6) * Math.PI * 2;
        px(sx(n.x) + Math.cos(a) * fr * TILE, sy(n.y) + Math.sin(a) * fr * TILE, 1, 1, '#e6f6ff');
      }
    }

    // the Seer's Lens: a violet ring of runes at the spade's reach, growing with each level
    if (n.relics.lens) {
      const r = spadeReach(n) * TILE;
      const cx = sx(n.x);
      const cy = sy(n.y);
      ctx.strokeStyle = `rgba(190, 140, 255, ${0.25 + 0.1 * Math.sin(t * 2)})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, t * 0.4, t * 0.4 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const runes = 4 + 2 * (n.relics.lens ?? 0);
      for (let k = 0; k < runes; k++) {
        const a = -t * 0.7 + (k / runes) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * r);
        const y = Math.round(cy + Math.sin(a) * r);
        px(x - 1, y - 1, 3, 3, 'rgba(200, 160, 255, 0.35)');
        px(x, y, 1, 1, '#e6d4ff');
      }
    }

    // the bosses' lanes, marked on the ground before they strike
    for (const l of n.lanes) {
      const left = Math.max(0, l.at - n.t);
      const blink = left < 0.3 ? (Math.floor(t * 20) % 2 ? 0.55 : 0.3) : 0.22;
      ctx.save();
      ctx.translate(sx(l.x), sy(l.y));
      ctx.rotate(l.ang);
      ctx.fillStyle = `rgba(210, 40, 60, ${blink})`;
      ctx.fillRect(0, -l.w * TILE, l.len * TILE, l.w * 2 * TILE);
      ctx.strokeStyle = 'rgba(255, 90, 100, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, -l.w * TILE, l.len * TILE, l.w * 2 * TILE);
      ctx.restore();
    }

    // pickups
    for (const p of n.pickups) {
      const x = Math.round(sx(p.x));
      const y = Math.round(sy(p.y) + Math.sin(t * 4 + p.x) * 1);
      if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
      if (p.kind === 'soul') {
        px(x - 2, y - 2, 4, 4, 'rgba(120, 220, 255, 0.25)');
        px(x - 1, y - 1, 2, 2, '#8fe3ff');
      } else if (p.kind === 'bigsoul') {
        px(x - 3, y - 3, 6, 6, 'rgba(190, 130, 255, 0.28)');
        px(x - 2, y - 2, 4, 4, '#c79bff');
        px(x - 1, y - 1, 1, 1, '#f2e6ff');
      } else {
        px(x - 3, y - 3, 6, 2, '#7cf5c4');
        px(x - 2, y - 4, 4, 1, '#b4ffe0');
        px(x - 1, y - 1, 2, 3, '#d8d0bd');
      }
    }

    // the dead
    const ordered = [...n.foes].sort((a, b) => a.y - b.y);
    for (const f of ordered) {
      const size = f.boss ? 28 : f.kind === 'brute' ? 16 : 12;
      const x = sx(f.x) - size / 2;
      const y = sy(f.y) - size * 0.75;
      if (x < -size || y < -size || x > W + size || y > H + size) continue;
      const frames = enemyFrames(f.kind);
      const sp: Sprite = Math.hypot(f.x - n.x, f.y - n.y) < f.r + 0.8 || (f.boss && f.atkAt - n.t < 0.4) ? frames.attack : frames.idle[Math.floor(t * 3 + f.id) % 2];
      const img = n.t - f.hitAt < 0.08 ? sp.white : sp.normal;
      px(Math.round(x + size * 0.2), Math.round(y + size * 0.92), Math.round(size * 0.6), 2, 'rgba(0,0,0,0.4)');
      if (f.boss) {
        // a red glow under the bosses, so they stand out in the crowd
        ctx.fillStyle = 'rgba(210, 40, 60, 0.18)';
        ctx.beginPath();
        ctx.arc(sx(f.x), sy(f.y), f.r * TILE * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (f.slowUntil > n.t) ctx.globalAlpha = 0.75;
      ctx.save();
      if (f.x > n.x) {
        ctx.translate(Math.round(x) + size, Math.round(y));
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, size, size);
      } else ctx.drawImage(img, Math.round(x), Math.round(y), size, size);
      ctx.restore();
      if (f.slowUntil > n.t) {
        ctx.globalAlpha = 0.35;
        px(Math.round(x + 2), Math.round(y + 2), size - 4, size - 4, '#9fd8ff');
      }
      ctx.globalAlpha = 1;
    }

    // darts, scythes and wisps
    for (const d of n.darts) {
      const x = sx(d.x);
      const y = sy(d.y);
      if (d.kind === 'scythe') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 18);
        ctx.strokeStyle = '#e6eefc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 1.2);
        ctx.stroke();
        ctx.restore();
      } else if (d.kind === 'wisp') {
        px(x - 3, y - 3, 6, 6, 'rgba(170, 255, 230, 0.25)');
        px(x - 2, y - 2, 4, 4, '#bff7e6');
        px(x - 1, y + 2, 2, 2, 'rgba(190, 255, 235, 0.5)');
      } else {
        const sp = Math.hypot(d.vx, d.vy) || 1;
        ctx.strokeStyle = '#efe6cf';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(sx(d.x - (d.vx / sp) * 0.4), sy(d.y - (d.vy / sp) * 0.4));
        ctx.stroke();
      }
    }

    // a dash leaves a trail of fading afterimages
    if (n.t < n.dashUntil) {
      for (let k = 3; k >= 1; k--) {
        ctx.globalAlpha = 0.18 * (4 - k);
        const gx = Math.round(sx(n.x - n.fx * 0.45 * k) - 6);
        const gy = Math.round(sy(n.y - n.fy * 0.45 * k) - 9);
        ctx.drawImage(hero.white, gx, gy, 12, 12);
      }
      ctx.globalAlpha = 1;
    }

    // you
    const hx = Math.round(sx(n.x) - 6);
    const hy = Math.round(sy(n.y) - 9);
    px(hx + 2, hy + 12, 8, 2, 'rgba(0,0,0,0.4)');
    drawAura(ctx, fit.aura, hx + 6, hy + 12, 12, t, 'back');
    const hurt = n.t < n.hurtUntil && Math.floor(t * 20) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = hurt ? 0.4 : 1;
    if (n.fx < 0) {
      ctx.translate(hx + 12, hy);
      ctx.scale(-1, 1);
      ctx.drawImage(hurt ? hero.white : hero.normal, 0, 0, 12, 12);
    } else ctx.drawImage(hurt ? hero.white : hero.normal, hx, hy, 12, 12);
    ctx.restore();
    drawAura(ctx, fit.aura, hx + 6, hy + 12, 12, t, 'front');

    // whirling skulls
    const skulls = skullCount(n);
    for (let k = 0; k < skulls; k++) {
      const a = n.t * 3 + (k / skulls) * Math.PI * 2;
      const x = Math.round(sx(n.x + Math.cos(a) * 1.6));
      const y = Math.round(sy(n.y + Math.sin(a) * 1.6));
      px(x - 3, y - 3, 6, 6, 'rgba(255, 240, 200, 0.18)');
      px(x - 2, y - 2, 4, 3, '#efe6cf');
      px(x - 1, y + 1, 2, 1, '#cfc4a8');
      px(x - 1, y - 1, 1, 1, '#1a1420');
      px(x + 1, y - 1, 1, 1, '#1a1420');
    }

    // the bosses' bolts
    for (const s of n.shots) {
      const x = Math.round(sx(s.x));
      const y = Math.round(sy(s.y));
      if (x < -6 || y < -6 || x > W + 6 || y > H + 6) continue;
      px(x - 3, y - 3, 6, 6, 'rgba(200, 70, 255, 0.3)');
      px(x - 2, y - 2, 4, 4, '#c86bff');
      px(x - 1, y - 1, 2, 2, '#f4dcff');
    }

    // swings, strikes, tolls, spikes, beams and bursting lanes
    const lensed = area(n) > 1;
    for (const fl of n.flashes) {
      const age = (n.t - fl.at) / 0.4;
      ctx.globalAlpha = Math.max(0, 1 - age);
      if (fl.kind === 'swing') {
        ctx.strokeStyle = lensed ? '#e2ccff' : '#f4e9c8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx(fl.x), sy(fl.y), (fl.r ?? 1.5) * TILE * (0.7 + 0.3 * age), (fl.ang ?? 0) - 1, (fl.ang ?? 0) + 1);
        ctx.stroke();
      } else if (fl.kind === 'bolt') {
        ctx.strokeStyle = '#bfe3ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let x = sx(fl.x);
        let y = sy(fl.y) - 60;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (hash(Math.round(fl.at * 100), k) - 0.5) * 10;
          y += 12;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(sx(fl.x), sy(fl.y));
        ctx.stroke();
        px(sx(fl.x) - 3, sy(fl.y) - 3, 6, 6, 'rgba(220, 240, 255, 0.6)');
      } else if (fl.kind === 'ring') {
        ctx.strokeStyle = lensed ? '#d9b8ff' : '#f2c14e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx(fl.x), sy(fl.y), (fl.r ?? 2) * TILE * (0.3 + 0.7 * age), 0, Math.PI * 2);
        ctx.stroke();
      } else if (fl.kind === 'spike') {
        const r = (fl.r ?? 1) * TILE;
        const up = Math.min(1, age * 4);
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + fl.at;
          const bx = sx(fl.x) + Math.cos(a) * r * 0.6;
          const by = sy(fl.y) + Math.sin(a) * r * 0.5;
          px(Math.round(bx), Math.round(by - 6 * up), 2, Math.round(6 * up) + 1, '#e9e1cc');
          px(Math.round(bx), Math.round(by - 6 * up), 2, 1, '#ffffff');
        }
      } else if (fl.kind === 'beam') {
        ctx.save();
        ctx.translate(sx(fl.x), sy(fl.y));
        ctx.rotate(fl.ang ?? 0);
        ctx.fillStyle = 'rgba(140, 230, 255, 0.35)';
        ctx.fillRect(0, -6, (fl.r ?? 6) * TILE, 12);
        ctx.fillStyle = '#dff8ff';
        ctx.fillRect(0, -2, (fl.r ?? 6) * TILE, 4);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(sx(fl.x), sy(fl.y));
        ctx.rotate(fl.ang ?? 0);
        ctx.fillStyle = 'rgba(255, 120, 90, 0.6)';
        ctx.fillRect(0, -8, (fl.r ?? 8) * TILE, 16);
        ctx.fillStyle = '#ffe2c8';
        ctx.fillRect(0, -2, (fl.r ?? 8) * TILE, 4);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // the night closes in round your lantern
    const g = ctx.createRadialGradient(sx(n.x), sy(n.y), 30, sx(n.x), sy(n.y), Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(7, 4, 11, 0)');
    g.addColorStop(1, 'rgba(7, 4, 11, 0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // a flash of gold when a boss falls
    if (n.t - felledAt < 0.5) {
      ctx.fillStyle = `rgba(255, 220, 140, ${0.35 * (1 - (n.t - felledAt) / 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // red at the edges when you're hurt
    if (n.t < n.hurtUntil) {
      ctx.fillStyle = 'rgba(200, 30, 40, 0.12)';
      ctx.fillRect(0, 0, W, H);
    }

    // a drag on the stage shows its stick under your finger
    if (stick && !stick.fixed) {
      const r = canvas.getBoundingClientRect();
      const k = W / r.width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc((stick.ox - r.left) * k, (stick.oy - r.top) * k, 50 * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc((stick.x - r.left) * k, (stick.y - r.top) * k, 18 * k, 0, Math.PI * 2);
      ctx.fill();
    }

    // a boss's health
    const boss = n.foes.find((f) => f.boss);
    const bar = $id('ns-boss');
    bar.hidden = !boss;
    if (boss) {
      $id('ns-boss-name').textContent = BOSS_NAME[boss.kind] ?? 'Boss';
      $id('ns-boss-bar').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    }
  }

  requestAnimationFrame(frame);
}

/** The dash goes on the other side from the joystick (on the right when the stick's in the middle). */
const dashSide = (stick: StickSide): 'left' | 'right' => (stick === 'right' ? 'left' : 'right');

function dashButton(side: 'left' | 'right' | 'desk'): string {
  return `<button type="button" class="ns-dash ${side} ready" id="ns-dash" aria-label="Dash">💨<small>${side === 'desk' ? 'Space' : 'Dash'}</small></button>`;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
