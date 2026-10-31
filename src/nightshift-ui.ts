// The Night Shift on screen: the plot at night seen from above, the dead closing in, your relics
// fighting on their own, a level-up choice whenever you fill the soul bar, and what the night paid.

import { sfx } from './audio';
import { drawAura } from './aura';
import { DAWN_GIFT } from './graveshift';
import { heroSprite } from './hero';
import { grave, groundFor, hash, paintGround, tree, type Px } from './hollow-art';
import { graveState, meta, outfitFor, receiveGift, saveMeta } from './meta';
import {
  BOSS_AT, DAWN, FIELD, MAX_LEVEL, NIGHT_RELIC, NIGHT_RELICS, chooseRelic, frostRadius, levelChoices, newNight, nightPay, skullCount, step, xpToLevel, type RelicKind,
} from './nightshift';
import { enemyFrames, type Sprite } from './sprites';
import { esc, on, overlay, showOverlay, toast } from './ui';

const TILE = 16;
const STEP = 1 / 60;

const BOSS_NAME: Record<string, string> = { boss: 'The Gravelord', abbot: 'The Drowned Abbot', lich: 'The Lich' };

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

/** Stand a night on the plot. `back` returns to Grave Shift. */
export function showNightShift(back: () => void) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const wide = window.innerWidth >= 700;
  const VW = wide ? 18 : 12;
  const VH = wide ? 12 : 15;
  const S = 3;
  showOverlay('nightshift', `
    <div class="ns-wrap">
      <div class="ns-hud">
        <div class="ns-row">
          <span class="ns-hp"><i id="ns-hp-bar"></i><b id="ns-hp">20</b></span>
          <span class="ns-clock" id="ns-clock">10:00</span>
          <span class="ns-kills">💀 <b id="ns-kills">0</b></span>
          <button type="button" class="ns-pause" id="ns-pause" aria-label="Pause">⏸</button>
        </div>
        <div class="ns-xp"><i id="ns-xp-bar"></i><span id="ns-level">Lv 1</span></div>
        <div class="ns-relics" id="ns-relics"></div>
      </div>
      <div class="ns-stage" id="ns-stage">
        <canvas id="ns-canvas" width="${VW * TILE * S}" height="${VH * TILE * S}" aria-label="The plot at night, with the dead closing in"></canvas>
        <div class="ns-boss" id="ns-boss" hidden><span id="ns-boss-name"></span><i><b id="ns-boss-bar"></b></i></div>
        <div class="ns-hint" id="ns-hint">${touch ? 'Drag anywhere to move.' : 'WASD or arrows to move.'} Your relics fight on their own. Hold out until dawn.</div>
        <div class="ns-modal" id="ns-modal" hidden></div>
      </div>
    </div>`);
  const canvas = overlay.querySelector<HTMLCanvasElement>('#ns-canvas')!;
  const stage = overlay.querySelector<HTMLElement>('#ns-stage')!;
  const modal = overlay.querySelector<HTMLElement>('#ns-modal')!;
  const ctx = canvas.getContext('2d')!;
  const $id = (id: string) => overlay.querySelector<HTMLElement>(`#${id}`)!;

  const n = newNight();
  const fit = outfitFor(meta.hero);
  const hero = heroSprite(meta.hero, {}, [], fit.look, fit.head);
  const ground = fieldCanvas();
  let paused = false;
  let ended = false;
  let choosing: RelicKind[] | null = null;

  // ---- input: keys held, or a drag anywhere on the stage ----
  const held = new Set<string>();
  const KEY_DIR: Record<string, [number, number]> = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };
  let stick: { ox: number; oy: number; x: number; y: number; id: number } | null = null;
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
    if (KEY_DIR[e.key]) {
      e.preventDefault();
      held.add(e.key);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.key);
  const onBlur = () => held.clear();
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
    document.removeEventListener('visibilitychange', onHide);
  }
  stage.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.ns-modal')) return;
    stick = { ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!stick || e.pointerId !== stick.id) return;
    // The stick's centre follows a finger dragged far, so turning back is quick.
    const dx = e.clientX - stick.ox;
    const dy = e.clientY - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > 50) {
      stick.ox = e.clientX - (dx / d) * 50;
      stick.oy = e.clientY - (dy / d) * 50;
    }
    stick.x = e.clientX;
    stick.y = e.clientY;
  });
  const lift = (e: PointerEvent) => {
    if (stick && e.pointerId === stick.id) stick = null;
  };
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);

  // ---- pause, level-up and the end ----
  function pause() {
    if (ended || choosing || paused) return;
    paused = true;
    held.clear();
    stick = null;
    modal.hidden = false;
    modal.innerHTML = `<h3>Paused</h3>
      <p class="fine">${fmt(DAWN - n.t)} until dawn · level ${n.level} · ${n.kills} put down</p>
      <button type="button" class="btn primary" id="ns-resume">Keep going</button>
      <button type="button" class="btn" id="ns-quit">Give up the night</button>`;
    modal.querySelector('#ns-resume')!.addEventListener('click', resume);
    modal.querySelector('#ns-quit')!.addEventListener('click', () => {
      n.over = 'dead';
      finish();
    });
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
    stick = null;
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
    const pay = nightPay(n);
    const best = Math.floor(n.t) > s.nightBest;
    s.obols += pay;
    if (n.ecto) s.inv.ecto = (s.inv.ecto ?? 0) + n.ecto;
    s.nights++;
    if (n.over === 'dawn') s.dawns++;
    s.nightBest = Math.max(s.nightBest, Math.floor(n.t));
    s.nightKills = Math.max(s.nightKills, n.kills);
    const title = n.over === 'dawn' && !meta.gifts.includes(DAWN_GIFT);
    if (title) receiveGift(DAWN_GIFT);
    saveMeta();
    if (n.over === 'dawn') sfx.toll();
    else sfx.death();
    const build = NIGHT_RELICS.filter((r) => n.relics[r.id]).map((r) => `${r.emoji}<small>${n.relics[r.id]}</small>`).join(' ');
    window.setTimeout(() => {
      if (!overlay.querySelector('#ns-canvas')) return;
      showOverlay('nightshift-end', `
        <h2>${n.over === 'dawn' ? 'Dawn breaks' : 'The night takes you'}</h2>
        <p class="sub">${n.over === 'dawn' ? '"You held the plot all night. Not bad for a digger." Mortimer' : '"Back on your feet. The dead don\'t sleep, and neither do we." Mortimer'}</p>
        <div class="ns-results">
          <div><b>${fmt(Math.floor(n.t))}</b><span>survived${best ? ' · best' : ''}</span></div>
          <div><b>${n.kills}</b><span>put down</span></div>
          <div><b>${n.level}</b><span>level</span></div>
        </div>
        <p class="ns-build">${build}</p>
        <div class="souls-chip">🪙 <b>+${pay}</b> Obols${n.ecto ? ` · 👻 +${n.ecto} ectoplasm` : ''}</div>
        ${title ? '<p class="fine">🏅 New title: <b>Who Saw the Dawn</b></p>' : ''}
        <p class="fine">Best night ${fmt(s.nightBest)} · most put down ${s.nightKills} · dawns seen ${s.dawns}</p>
        <button class="btn primary" id="ns-again">🌙 Stand another night</button>
        <button class="btn" id="back">← Back to the plot</button>`);
      on('#ns-again', () => showNightShift(back));
      on('#back', back);
      if (title) toast('🏅 Title unlocked: Who Saw the Dawn');
    }, n.over === 'dawn' ? 900 : 1200);
  }

  // ---- the HUD ----
  let hudKey = '';
  function relicRow() {
    $id('ns-relics').innerHTML = NIGHT_RELICS.filter((r) => n.relics[r.id])
      .map((r) => `<span class="ns-relic ${r.weapon ? '' : 'charm'}" title="${esc(r.name)}">${r.emoji}<small>${n.relics[r.id]}</small></span>`)
      .join('');
  }
  relicRow();
  function hud() {
    const key = `${Math.ceil(n.hp)}/${n.maxHp}|${Math.ceil(DAWN - n.t)}|${n.kills}|${n.level}|${n.xp}`;
    if (key === hudKey) return;
    hudKey = key;
    $id('ns-hp').textContent = `${Math.max(0, Math.ceil(n.hp))}`;
    $id('ns-hp-bar').style.width = `${Math.max(0, (n.hp / n.maxHp) * 100)}%`;
    $id('ns-clock').textContent = fmt(DAWN - n.t);
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
  let last = performance.now();
  let acc = 0;
  let seen = { kills: 0, hp: n.hp, bosses: 0 };
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
      if (n.pendingLevels) {
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
      const name = BOSS_NAME[BOSS_AT[n.bossesRisen - 1][1]];
      toast(`☠️ ${name} rises`);
    }
    if (n.flashes.some((f) => f.kind === 'bolt' && n.t - f.at < dt)) play('zap', 200);
    if (n.flashes.some((f) => f.kind === 'ring' && n.t - f.at < dt)) play('block', 300);
    seen = { kills: n.kills, hp: n.hp, bosses: n.bossesRisen };
    if (n.t > 5) $id('ns-hint').classList.add('gone');
    draw(now / 1000);
    hud();
    requestAnimationFrame(frame);
  };

  // ---- drawing ----
  const W = VW * TILE;
  const H = VH * TILE;
  function draw(t: number) {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const px: Px = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    const camX = Math.max(0, Math.min(FIELD * TILE - W, n.x * TILE - W / 2));
    const camY = Math.max(0, Math.min(FIELD * TILE - H, n.y * TILE - H / 2));
    const sx = (x: number) => x * TILE - camX;
    const sy = (y: number) => y * TILE - camY;
    ctx.fillStyle = '#0b0910';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(ground, Math.round(camX), Math.round(camY), W, H, 0, 0, W, H);

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
      } else if (p.kind === 'glowcap') {
        px(x - 3, y - 3, 6, 2, '#7cf5c4');
        px(x - 2, y - 4, 4, 1, '#b4ffe0');
        px(x - 1, y - 1, 2, 3, '#d8d0bd');
      } else {
        px(x - 2, y - 2, 4, 4, 'rgba(140, 255, 140, 0.3)');
        px(x - 1, y - 2, 3, 3, '#9bff8a');
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
      const sp: Sprite = Math.hypot(f.x - n.x, f.y - n.y) < f.r + 0.8 ? frames.attack : frames.idle[Math.floor(t * 3 + f.id) % 2];
      const img = n.t - f.hitAt < 0.08 ? sp.white : sp.normal;
      px(Math.round(x + size * 0.2), Math.round(y + size * 0.92), Math.round(size * 0.6), 2, 'rgba(0,0,0,0.4)');
      if (f.slowUntil > n.t) ctx.filter = 'hue-rotate(160deg) saturate(0.6) brightness(1.2)';
      ctx.save();
      if (f.x > n.x) {
        ctx.translate(Math.round(x) + size, Math.round(y));
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, size, size);
      } else ctx.drawImage(img, Math.round(x), Math.round(y), size, size);
      ctx.restore();
      ctx.filter = 'none';
    }

    // darts
    ctx.strokeStyle = '#efe6cf';
    ctx.lineWidth = 1.5;
    for (const d of n.darts) {
      const sp = Math.hypot(d.vx, d.vy) || 1;
      ctx.beginPath();
      ctx.moveTo(sx(d.x), sy(d.y));
      ctx.lineTo(sx(d.x - (d.vx / sp) * 0.4), sy(d.y - (d.vy / sp) * 0.4));
      ctx.stroke();
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

    // swings, strikes and tolls
    for (const fl of n.flashes) {
      const age = (n.t - fl.at) / 0.4;
      ctx.globalAlpha = Math.max(0, 1 - age);
      if (fl.kind === 'swing') {
        ctx.strokeStyle = '#f4e9c8';
        ctx.lineWidth = 2.5;
        const half = 1;
        ctx.beginPath();
        ctx.arc(sx(fl.x), sy(fl.y), (fl.r ?? 1.5) * TILE * (0.7 + 0.3 * age), (fl.ang ?? 0) - half, (fl.ang ?? 0) + half);
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
      } else {
        ctx.strokeStyle = '#f2c14e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx(fl.x), sy(fl.y), (fl.r ?? 2) * TILE * (0.3 + 0.7 * age), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // the night closes in round your lantern, lifting as dawn comes
    const dawn = Math.max(0, (n.t - (DAWN - 60)) / 60);
    const g = ctx.createRadialGradient(sx(n.x), sy(n.y), 30, sx(n.x), sy(n.y), Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(7, 4, 11, 0)');
    g.addColorStop(1, `rgba(7, 4, 11, ${0.6 * (1 - dawn)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (dawn) {
      ctx.fillStyle = `rgba(255, 170, 120, ${0.12 * dawn})`;
      ctx.fillRect(0, 0, W, H);
    }
    // red at the edges when you're hurt
    if (n.t < n.hurtUntil) {
      ctx.fillStyle = 'rgba(200, 30, 40, 0.12)';
      ctx.fillRect(0, 0, W, H);
    }

    // the stick under your finger
    if (stick) {
      const r = canvas.getBoundingClientRect();
      const k = W / r.width;
      const ox = (stick.ox - r.left) * k;
      const oy = (stick.oy - r.top) * k;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ox, oy, 50 * k, 0, Math.PI * 2);
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

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
