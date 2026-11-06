// The Night Shift on screen: the graveyard at night seen from above, the dead closing in, your
// relics fighting on their own, a level-up choice whenever you fill the soul bar, the bosses'
// bolts and lanes to dodge, and how many you put down. On phones a joystick sits at the bottom.

import { setMusicDepth, setMusicMood, setNightHeat, sfx } from './audio';
import { drawAura } from './aura';
import { centralDate } from './daily';
import { NIGHT_GIFT, NIGHT_GIFT_KILLS } from './graveshift';
import { heroSprite } from './hero';
import { grave, groundFor, hash, paintGround, seasonWeather, setDress, tree, type Dress, type Px } from './hollow-art';
import { SHRINE, buyShrine, grantFeats, graveState, meta, noteMonth, noteTrial, outfitFor, receiveGift, saveMeta, setShrineStart, shrineLevel, type ShrineGift } from './meta';
import { HERO_BY_ID } from './content';
import type { EnemyKind } from './game';
import { celebrate, celebrateNotes } from './progress-ui';
import type { AchievementDef } from './content';
import {
  dashCooldown, FIELD, MAX_LEVEL, type Night, area, dash, spadeReach, NIGHT_RELIC, NIGHT_RELICS, chooseRelic, frostRadius, levelChoices, newNight, nextBossAt, nightSouls, skullCount, skullOrbit, step, xpToLevel, NIGHT_FUSION, fusionOf, isFusion, nightFeats, isBlessing, NIGHT_BLESSING, NIGHT_BLESSINGS, bl, type NightPick, ASCENDED, ASCEND_TEXT, DAWN, ELITES, NEW_FOES, isBoss as isBossKind, NIGHT_PERKS, chooseDawn, reroll, banish, skipLevel, plainLevel, type RelicKind, NIGHT_EVENTS, NIGHT_PACTS, NO_PACT, ascendedWeapon, isAscend, isPact, type FusionId, type PactId } from './nightshift';
import { ONLINE, nightBoard, submitNight } from './online';
import { featCosmetics, seasonDress, soulSurge } from './progression';
import { claimInlineHtml, keepNameHtml, wireKeepName, ensureGuest, playerName, showLeaderboard, signedIn, unclaimed, wireClaimInline } from './social';
import { enemyFrames, type Sprite } from './sprites';
import { calmMotion, esc, on, overlay, showOverlay, toast } from './ui';

const TILE = 16;
const STEP = 1 / 60;

const BOSS_NAME: Record<string, string> = { boss: 'The Gravelord', abbot: 'The Drowned Abbot', lich: 'The Lich', voideye: 'The Void Eye', mother: 'The Night Mother' };

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

// The field is painted once: grass and paths, with old graves and trees scattered about,
// dressed for the season like the Hollow (leaves and pumpkins for the Harvest Feast, snow
// for Midwinter).
let field: HTMLCanvasElement | null = null;
let fieldDress: Dress | undefined;
function fieldCanvas(): HTMLCanvasElement {
  const dress = seasonDress(centralDate());
  setDress(dress);
  if (field && fieldDress === dress) return field;
  fieldDress = dress;
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

/** The night under way, if any, so the Census can say how it's going. */
let current: Night | null = null;
export function nightPresence(): string | null {
  return current && !current.over ? `${current.kills} put down · ${fmt(current.t)}` : null;
}

/** Stand a night in the graveyard. `back` leaves. */
/** Damage numbers over the dead in the Night Shift (off unless chosen in Settings). */
const DMG_KEY = 'omc:ns-dmg';
export function dmgNumbers(): boolean {
  try {
    return localStorage.getItem(DMG_KEY) === '1';
  } catch {
    return false;
  }
}
export function setDmgNumbers(on: boolean) {
  try {
    localStorage.setItem(DMG_KEY, on ? '1' : '0');
  } catch {
    // this visit only
  }
}

/**
 * The late-night rules (events, elites, pacts and ascension) start with the week of Monday 9
 * November, so the week's board under way keeps one set of rules. ?preview=night2 tries them early.
 */
export const NIGHT_V2_FROM = '2026-11-09';
export function nightV2Live(): boolean {
  return centralDate() >= NIGHT_V2_FROM || /[?&]preview=night2\b/.test(location.search);
}

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
          <span class="ns-time"><span id="ns-moon">🌆</span> <span id="ns-clock">0:00</span> · ☠️ <span id="ns-next">1:30</span></span>
        </div>
      </div>
      <div class="ns-stage" id="ns-stage">
        <canvas id="ns-canvas" aria-label="The graveyard at night, with the dead closing in"></canvas>
        <div class="ns-boss" id="ns-boss" hidden><span id="ns-boss-name"></span><i><b id="ns-boss-bar"></b></i></div>
        <div class="ns-event" id="ns-event" hidden></div>
        <div class="ns-bosscard" id="ns-bosscard" hidden></div>
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

  const v2 = nightV2Live();
  const sh = meta.nightShrine;
  const n = newNight(Math.random, v2, { hero: meta.hero, shrine: { vigor: sh.vigor, reroll: sh.reroll, banish: sh.banish, start: sh.arsenal && sh.start ? (sh.start as RelicKind) : undefined } });
  current = n;
  // Local development only: the night, for poking at from the console.
  if (import.meta.env.DEV) (window as unknown as { night?: unknown }).night = n;
  const fit = outfitFor(meta.hero);
  const hero = heroSprite(meta.hero, {}, [], fit.look, fit.head);
  const ground = fieldCanvas();
  let paused = false;
  let ended = false;
  let choosing: NightPick[] | null = null;
  // The level-up choice the keyboard has lit, and when the choices appeared.
  let choiceAt = 0;
  let choiceShown = 0;

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
    const up = e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W';
    const down = e.key === 'ArrowDown' || e.key === 's' || e.key === 'S';
    const press = e.key === 'Enter' || e.key === ' ';
    if (choosing) {
      // 1, 2 or 3 to take one straight away; or up and down to look, and Enter or Space to take it.
      e.preventDefault();
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0 && choosing[i]) return pick(choosing[i]);
      if (up || down) return highlight(choiceAt + (down ? 1 : -1));
      // Not a key still held from dashing, and not in the first moment the choice appears.
      if (press && !e.repeat && performance.now() - choiceShown > 350) pick(choosing[choiceAt]);
      return;
    }
    if (paused && (up || down || press)) {
      // The pause menu, from the keyboard too.
      e.preventDefault();
      const list = [...modal.querySelectorAll<HTMLElement>('button')];
      const at = list.indexOf(document.activeElement as HTMLElement);
      if (press) (list[at] ?? list[0])?.click();
      else list[(Math.max(0, at) + (down ? 1 : -1) + list.length) % list.length]?.focus();
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

  let banishing = false;
  function offerLevel(given?: NightPick[]) {
    const opts = given ?? levelChoices(n);
    if (!opts.length) {
      // Everything is as sharp as it gets: the level heals instead.
      n.pendingLevels = 0;
      n.hp = Math.min(n.maxHp, n.hp + 5);
      return;
    }
    choosing = opts;
    choiceShown = performance.now();
    held.clear();
    letGo();
    sfx.relic();
    modal.hidden = false;
    const pact = n.pactOffers > 0;
    const asc = !pact && n.ascendOffers > 0;
    const forge = !pact && !asc && n.forgeOffers > 0;
    const head = pact ? '<h3>🕯️ A Night Pact</h3>' : asc ? '<h3>✦ Ascension</h3>' : forge ? '<h3>🔥 The Soul Forge</h3>' : `<h3>Level ${n.level - n.pendingLevels + 1}</h3>`;
    const sub = pact ? 'The boss falls, and something in the dark offers a bargain: a curse on the night, for a boon' : asc ? 'The boss left a shard: choose a fused relic to ascend' : forge ? 'A boss left an ember: forge two relics into one, or sharpen a weapon for free' : 'Choose a relic';
    modal.innerHTML = `${head}
      <p class="fine">${sub}${touch ? '' : ' · ↑ ↓ and Enter, or 1, 2, 3'}</p>
      <div class="ns-choices">${opts.map((id, i) => {
        if (isPact(id)) {
          if (id === NO_PACT) {
            return `<button type="button" class="ns-choice nopact" data-pick="${id}">
              <span class="ns-choice-emoji">🚫</span>
              <span class="ns-choice-info"><b>Refuse</b> <small>No bargain this time</small><span>The night goes on as it is.</span></span>
              ${touch ? '' : `<kbd>${i + 1}</kbd>`}
            </button>`;
          }
          const pc = NIGHT_PACTS[id];
          return `<button type="button" class="ns-choice pact" data-pick="${id}">
            <span class="ns-choice-emoji">${pc.emoji}</span>
            <span class="ns-choice-info"><b>${esc(pc.name)}</b> <small>🕯️ Pact · Souls cap +150</small><span class="curse">☠️ ${esc(pc.curse)}</span><span>✨ ${esc(pc.boon)}</span></span>
            ${touch ? '' : `<kbd>${i + 1}</kbd>`}
          </button>`;
        }
        if (isAscend(id)) {
          const fid = id.slice(4) as FusionId;
          const f = NIGHT_FUSION[fid];
          return `<button type="button" class="ns-choice ascend" data-pick="${id}">
            <span class="ns-choice-emoji">${f.emoji}</span>
            <span class="ns-choice-info"><b>${esc(ASCENDED[fid])}</b> <small>✦ Ascend ${esc(f.name)}</small><span>${esc(ASCEND_TEXT)}</span></span>
            ${touch ? '' : `<kbd>${i + 1}</kbd>`}
          </button>`;
        }
        if (isFusion(id)) {
          // a fusion at the Soul Forge: the weapon and its charm become one
          const f = NIGHT_FUSION[id];
          return `<button type="button" class="ns-choice forge" data-pick="${id}">
            <span class="ns-choice-emoji">${f.emoji}</span>
            <span class="ns-choice-info"><b>${esc(f.name)}</b> <small>🔥 Soul Forge · ${NIGHT_RELIC[f.weapon].emoji} + ${NIGHT_RELIC[f.charm].emoji}</small><span>${esc(f.text)}</span></span>
            ${touch ? '' : `<kbd>${i + 1}</kbd>`}
          </button>`;
        }
        if (isBlessing(id)) {
          // a blessing: no top level, take it as often as you like
          const b = NIGHT_BLESSING[id];
          const had = bl(n, id);
          return `<button type="button" class="ns-choice blessing" data-pick="${id}">
            <span class="ns-choice-emoji">${b.emoji}</span>
            <span class="ns-choice-info"><b>${esc(b.name)}</b> <small>✨ Blessing${had ? ` · ×${had + 1}` : ''}</small><span>${esc(b.text)}</span></span>
            ${touch ? '' : `<kbd>${i + 1}</kbd>`}
          </button>`;
        }
        const r = NIGHT_RELIC[id];
        const at = n.relics[id] ?? 0;
        return `<button type="button" class="ns-choice" data-pick="${id}">
          <span class="ns-choice-emoji">${r.emoji}</span>
          <span class="ns-choice-info"><b>${esc(r.name)}</b> <small>${at ? `Lv ${at + 1}${at + 1 === MAX_LEVEL ? ' · max' : ''}` : r.weapon ? 'New weapon' : 'New charm'}</small><span>${esc(r.text(at + 1))}</span></span>
          ${touch ? '' : `<kbd>${i + 1}</kbd>`}
        </button>`;
      }).join('')}</div>
      ${plainLevel(n) && n.v2 ? `<div class="ns-level-tools">
        ${n.rerolls > 0 ? `<button type="button" class="btn" id="ns-reroll">🎲 Reroll <small>${n.rerolls} left</small></button>` : ''}
        ${n.banishes > 0 ? `<button type="button" class="btn ${banishing ? 'on' : ''}" id="ns-banish">🚫 ${banishing ? 'Tap a relic to banish it' : 'Banish'} <small>${n.banishes} left</small></button>` : ''}
        <button type="button" class="btn" id="ns-skip">⏭️ Skip <small>heal 3</small></button>
      </div>` : ''}`;
    modal.querySelector('#ns-reroll')?.addEventListener('click', () => {
      const next = reroll(n);
      if (next) {
        banishing = false;
        sfx.step();
        offerLevel(next);
      }
    });
    modal.querySelector('#ns-banish')?.addEventListener('click', () => {
      banishing = !banishing;
      offerLevel(opts);
    });
    modal.querySelector('#ns-skip')?.addEventListener('click', () => {
      banishing = false;
      skipLevel(n);
      choosing = null;
      modal.hidden = true;
      sfx.heal();
      last = performance.now();
    });
    // A finger or key still down from walking mustn't pick straight away.
    const shown = performance.now();
    modal.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        if (performance.now() - shown <= 300) return;
        if (banishing) {
          const next = banish(n, b.dataset.pick as NightPick);
          if (next) {
            banishing = false;
            toast(`🚫 Banished for the night: ${NIGHT_RELIC[b.dataset.pick as RelicKind].name}`);
            offerLevel(next);
          } else toast('Only a relic you don\'t carry can be banished.');
          return;
        }
        pick(b.dataset.pick as NightPick);
      }),
    );
    if (!touch) highlight(0);
  }
  /** Light up one of the level-up choices (wrapping round), for the keyboard. */
  function highlight(i: number) {
    if (!choosing) return;
    choiceAt = (i + choosing.length) % choosing.length;
    modal.querySelectorAll<HTMLElement>('[data-pick]').forEach((b, k) => b.classList.toggle('on', k === choiceAt));
  }
  function pick(id: NightPick) {
    if (!choosing) return;
    if ((id as string).startsWith('dawn:')) {
      const nightmare = id === ('dawn:on' as NightPick);
      choosing = null;
      chooseDawn(n, nightmare);
      modal.hidden = true;
      last = performance.now();
      if (nightmare) {
        sfx.toll();
        toast('🌑 The Nightmare begins');
      } else finish();
      return;
    }
    chooseRelic(n, id);
    choosing = null;
    modal.hidden = true;
    if (isFusion(id)) {
      sfx.relic();
      toast(`🔥 Forged: ${NIGHT_FUSION[id].name}`);
    } else if (isAscend(id)) {
      sfx.fuse();
      ascendedAt = n.t;
      toast(`✦ Ascended: ${ASCENDED[id.slice(4) as FusionId]}`);
    } else if (isPact(id)) {
      if (id === NO_PACT) sfx.step();
      else {
        sfx.toll();
        toast(`🕯️ ${NIGHT_PACTS[id as PactId].name} sealed`);
      }
    } else sfx.heal();
    relicRow();
    last = performance.now();
  }

  function finish() {
    if (ended) return;
    ended = true;
    cleanup();
    for (const a of grantFeats(nightFeats(n))) featsWon.push(a);
    const trial = noteTrial({ kind: 'night', seconds: n.t }, true);
    featsWon.push(...trial.feats);
    const s = graveState();
    noteMonth();
    const souls = nightSouls(n) * (soulSurge(centralDate()) ? 2 : 1);
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
    const build = NIGHT_RELICS.filter((r) => n.relics[r.id]).map((r) => `${fusionOf(n, r.id)?.emoji ?? r.emoji}<small>${fusionOf(n, r.id) ? '★' : n.relics[r.id]}</small>`).join(' ');
    window.setTimeout(() => {
      if (!overlay.querySelector('#ns-canvas')) return;
      showOverlay('nightshift-end', `
        <h2>${n.dawn && !n.nightmare ? '🌅 You saw the dawn' : n.nightmare ? 'The Nightmare takes you' : 'The night takes you'}</h2>
        <div class="ns-score"><b>${n.kills}</b><span>put down${best ? ' · new best' : ''}</span></div>
        <div class="ns-results">
          <div><b>${fmt(n.t)}</b><span>survived</span></div>
          <div><b>${n.level}</b><span>level</span></div>
          <div><b>${n.bossKills}</b><span>bosses taken down</span></div>
        </div>
        <button class="btn primary retry-btn" id="ns-again">↻ Retry<small>Another night, straight away</small></button>
        <p class="ns-build">${build}</p>
        <div class="souls-chip">💀 <b>+${souls}</b> Souls</div>
        ${title ? '<p class="fine">🏅 New title: <b>The Unsleeping</b></p>' : ''}
        ${featsWon.length ? `<p class="fine">🏅 Achievements: ${featsWon.map((a) => `<b>${esc(a.name)}</b>`).join(' · ')}</p>` : ''}
        <p class="fine">Best: ${s.nightKills} put down · longest night ${fmt(s.nightBest)} · ${s.nights} night${s.nights === 1 ? '' : 's'} stood</p>
        ${ONLINE ? `<h3 class="shop-head">This week's Night Shift</h3><p class="fine" id="ns-rank">Posting your night…</p><ol class="raid-top" id="ns-board"><li class="fine">Loading…</li></ol><button class="btn" id="ns-boards">🏆 All Night Shift boards</button>` : ''}
        ${ONLINE && (!signedIn() || unclaimed()) ? claimInlineHtml(`You're on the Night Shift board as ${unclaimed() ? esc(playerName()) : 'a guest'}. Type a name and your nights show under it.`) : ''}
        ${keepNameHtml()}
        ${n.v2 ? '<button class="btn" id="ns-shrine">🕯️ Night Shrine<small>Spend Souls on gifts for every night</small></button>' : ''}
        <button class="btn" id="back">← Back</button>`);
      on('#ns-again', () => showNightShift(back));
      on('#ns-shrine', () => showNightShrine(back));
      on('#back', back);
      on('#ns-boards', () => showLeaderboard(back, 'night', 25, 'week'));
      wireClaimInline(() => {
        const claim = document.getElementById('claim-form');
        claim?.insertAdjacentHTML('afterend', keepNameHtml());
        claim?.remove();
        wireKeepName();
        if (ONLINE) void loadBoard(false);
      }, () => showLeaderboard(back, 'night', 25, 'week'));
      wireKeepName();
      if (ONLINE) void loadBoard(n.kills > 0);
      if (title) toast('🏅 Title unlocked: The Unsleeping');
      if (trial.completed) toast('⚔️ Weekly Trial complete! +300 Souls');
      if (featsWon.length) {
        celebrate(featsWon);
        celebrateNotes(featCosmetics(featsWon.map((a) => a.id)));
      }
    }, 1200);
  }

  /** Post the night (players without a name go on as a guest they can claim later), then show this week's top ten. */
  async function loadBoard(post: boolean) {
    const rank = document.getElementById('ns-rank');
    if (post && (signedIn() || (await ensureGuest()))) {
      const posted = await submitNight({ kills: n.kills, seconds: Math.floor(n.t), level: n.level, hero: meta.hero }).catch(() => null);
      if (rank?.isConnected) rank.textContent = posted ? `Your best night is #${posted.rank} of all time.` : 'Could not post your night. Your best is saved here.';
    } else if (rank) rank.textContent = 'Your best night counts.';
    const rows = await nightBoard('week').catch(() => null);
    const list = document.getElementById('ns-board');
    if (!list) return;
    list.innerHTML = rows?.length
      ? rows.slice(0, 10).map((r, i) => `<li><span>${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} ${esc(r.name)} <small>${r.seconds >= 1800 ? '🌅 ' : ''}${fmt(r.seconds)} · lv ${r.level}</small></span><b>💀 ${r.kills.toLocaleString()}</b></li>`).join('')
      : '<li class="fine">No one on the board yet this week. Be the first.</li>';
  }

  // ---- the HUD ----
  let hudKey = '';
  function relicRow() {
    $id('ns-relics').innerHTML = NIGHT_RELICS.filter((r) => n.relics[r.id])
      .map((r) => {
        const f = fusionOf(n, r.id);
        if (f && n.ascended[f.id]) return `<span class="ns-relic fused ascended" title="${esc(ASCENDED[f.id])}">${f.emoji}<small>✦</small></span>`;
        return f
          ? `<span class="ns-relic fused" title="${esc(f.name)}">${f.emoji}<small>★</small></span>`
          : `<span class="ns-relic ${r.weapon ? '' : 'charm'}" title="${esc(r.name)}">${r.emoji}<small>${n.relics[r.id]}</small></span>`;
      })
      .join('') + NIGHT_BLESSINGS.filter((b) => bl(n, b.id))
      .map((b) => `<span class="ns-relic blessing" title="${esc(b.name)} ×${bl(n, b.id)}">${b.emoji}<small>×${bl(n, b.id)}</small></span>`)
      .join('') + (Object.keys(NIGHT_PACTS) as PactId[]).filter((id) => n.pacts[id])
      .map((id) => `<span class="ns-relic pact" title="${esc(NIGHT_PACTS[id].name)}: ${esc(NIGHT_PACTS[id].curse)} ${esc(NIGHT_PACTS[id].boon)}">${NIGHT_PACTS[id].emoji}<small>🕯️</small></span>`)
      .join('');
  }
  relicRow();
  let dashShown = -1;
  function hud() {
    const ready = Math.max(0, Math.min(1, 1 - (n.dashReady - n.t) / dashCooldown(n)));
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
    // the night passes: dusk, night, the deep of it, the hour before dawn
    $id('ns-moon').textContent = n.nightmare ? '🌑' : n.dawn ? '🌅' : n.t < 300 ? '🌆' : n.t < 900 ? '🌙' : n.t < 1500 ? '🌘' : '🌄';
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
  let seen = { kills: 0, hp: n.hp, bosses: 0, felled: 0, potions: 0, events: 0, chests: 0 };
  // A boss's entrance: its name slams in, the ground shakes and a shockwave rolls out.
  const BOSS_SUB: Record<string, string> = { boss: 'He charges down the lines he marks', abbot: 'Bolts in fans and rings', lich: 'Lanes that burst, and spirals', voideye: 'A turning cross of light', mother: 'Survive her, and dawn will come' };
  let quake = { at: -10, x: 0, y: 0 };
  function bossEntrance(kind: string, x: number, y: number) {
    const card = $id('ns-bosscard');
    card.innerHTML = `<b>${esc(BOSS_NAME[kind] ?? 'A boss')}</b><small>${esc(BOSS_SUB[kind] ?? 'rises')}</small>`;
    card.hidden = false;
    card.classList.remove('go');
    void card.offsetWidth;
    card.classList.add('go');
    window.setTimeout(() => (card.hidden = true), 2600);
    quake = { at: n.t, x, y };
  }
  let ascendedAt = -10;
  let eliteWarned = false;
  const foesMet = new Set<string>();
  let motherSeen = false;
  let dawnShown = false;
  // Dawn: end the night in triumph, or walk on into the Nightmare.
  function offerDawn() {
    dawnShown = true;
    held.clear();
    letGo();
    sfx.relic();
    modal.hidden = false;
    modal.innerHTML = `<h3>🌅 Dawn breaks</h3>
      <p class="fine">You held the graveyard through the night. The sun is coming up.</p>
      <div class="ns-choices">
        <button type="button" class="ns-choice dawn" data-pick="dawn:end"><span class="ns-choice-emoji">🌅</span><span class="ns-choice-info"><b>Greet the dawn</b> <small>End the night in triumph</small><span>Your Souls are paid half again, and the night counts as survived.</span></span></button>
        <button type="button" class="ns-choice pact" data-pick="dawn:on"><span class="ns-choice-emoji">🌑</span><span class="ns-choice-info"><b>Walk into the Nightmare</b> <small>No sunrise for you</small><span class="curse">☠️ The dead come faster, tougher and harder-biting.</span><span>✨ Dawn's Souls are kept, and every kill still counts.</span></span></button>
      </div>`;
    choosing = ['dawn:end', 'dawn:on'] as unknown as NightPick[];
    choiceShown = performance.now();
    const shown = performance.now();
    modal.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        if (performance.now() - shown >= 400) pick(b.dataset.pick as NightPick);
      }),
    );
    if (!touch) highlight(0);
  }
  if (n.v2 && NIGHT_PERKS[n.hero]) window.setTimeout(() => toast(`${HERO_BY_ID[n.hero as keyof typeof HERO_BY_ID]?.name ?? 'Hero'}: ${NIGHT_PERKS[n.hero]}`), 1500);
  // The bosses up last frame, so one that falls can be named; and when the last fell, for the flash.
  let bossesUp: { id: number; kind: string }[] = [];
  let felledAt = -10;
  let warnedGrasp = false;
  // Achievements earned this night, and when they were last checked.
  const featsWon: AchievementDef[] = [];
  let featCheckAt = 0;
  const frame = (now: number) => {
    if (!canvas.isConnected) return cleanup();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && !choosing && !ended && !(n.dawnOffer && dawnShown)) {
      acc += dt;
      const [dx, dy] = dir();
      while (acc >= STEP && !n.over && !n.pendingLevels && !n.dawnOffer) {
        step(n, STEP, dx, dy);
        acc -= STEP;
      }
      if (n.pendingLevels && !n.over) {
        acc = 0;
        offerLevel();
      }
      if (n.dawnOffer && !dawnShown) {
        acc = 0;
        offerDawn();
      }
      if (n.over) finish();
    }
    // what happened, for the ears
    if (n.kills > seen.kills) play('kill', 70);
    if (n.hp < seen.hp) play('hurt', 150);
    if (n.potions > seen.potions) {
      sfx.heal();
      toast('🧪 Potion: health restored');
    }
    if (n.bossesRisen > seen.bosses) {
      sfx.toll();
      const boss = [...n.foes].reverse().find((f) => f.boss && f.kind !== 'mother');
      if (boss) bossEntrance(boss.kind, boss.x, boss.y);
    }
    // Night Shift achievements, granted the moment they're earned so quitting keeps them.
    if (n.t - featCheckAt >= 1) {
      featCheckAt = n.t;
      for (const a of grantFeats(nightFeats(n))) {
        featsWon.push(a);
        toast(`🏅 ${a.name}`);
      }
    }
    if (n.grasps && !warnedGrasp) {
      warnedGrasp = true;
      toast('🖐️ Keep moving: the dead claw up under anyone who stands still');
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
    // Night events: a banner while one is under way.
    if (n.events > seen.events && n.event) {
      sfx.toll();
      const e = NIGHT_EVENTS[n.event.kind];
      toast(`${e.emoji} ${e.name}: ${e.text}`);
    }
    const evEl = $id('ns-event');
    if (n.event && n.t < n.event.until) {
      const e = NIGHT_EVENTS[n.event.kind];
      evEl.hidden = false;
      evEl.className = `ns-event ${n.event.kind}`;
      evEl.textContent = `${e.emoji} ${e.name} · ${Math.ceil(n.event.until - n.t)}`;
    } else evEl.hidden = true;
    if (n.chests > seen.chests) {
      sfx.relic();
      toast('💰 Treasure! Two levels at once');
    }
    for (const nf of NEW_FOES) {
      if (foesMet.has(nf.kind) || !n.foes.some((f) => f.kind === nf.kind)) continue;
      foesMet.add(nf.kind);
      toast(`⚠️ ${nf.name} ${nf.text}`);
    }
    if (n.motherRisen && !motherSeen) {
      motherSeen = true;
      sfx.toll();
      const m = n.foes.find((f) => f.kind === 'mother');
      bossEntrance('mother', m?.x ?? n.x, m?.y ?? n.y);
    }
    if (!eliteWarned && n.foes.some((f) => f.elite)) {
      eliteWarned = true;
      toast('✴️ Elites walk the night: glowing dead with gifts of their own');
    }
    seen = { kills: n.kills, hp: n.hp, bosses: n.bossesRisen, felled: n.bossKills, potions: n.potions, events: n.events, chests: n.chests };
    if (!ended) music();
    if (n.t > 6) $id('ns-hint').classList.add('gone');
    draw(now / 1000);
    hud();
    requestAnimationFrame(frame);
  };

  // ---- drawing ----
  // Soft glows are drawn from small cached gradients, added onto what's under them.
  const glowCache = new Map<string, HTMLCanvasElement>();
  function glowAt(x: number, y: number, rgb: string, r: number, alpha: number) {
    if (alpha <= 0.01 || r < 1) return;
    const R = Math.max(2, Math.round(r));
    const key = `${rgb}|${R}`;
    let c = glowCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = R * 2;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(R, R, 0, R, R, R);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(0.4, `rgba(${rgb},0.45)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, R * 2, R * 2);
      glowCache.set(key, c);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(c, x - R, y - R);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  /** A lick of flame: an outer colour and a hot core, pointed at the top. */
  function flameTongue(x: number, y: number, w: number, h: number, outer: string, core: string) {
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.6, x, y - h);
    ctx.quadraticCurveTo(x + w * 0.6, y - h * 0.6, x + w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.45, y);
    ctx.quadraticCurveTo(x, y - h * 0.55, x + w * 0.45, y);
    ctx.closePath();
    ctx.fill();
  }
  /** A scythe blade's crescent, centred on the origin. */
  function crescent(r: number, edge: string, back: string) {
    ctx.fillStyle = back;
    ctx.beginPath();
    ctx.arc(0, 0, r, -0.2, Math.PI * 1.15);
    ctx.arc(r * 0.35, -r * 0.15, r * 0.75, Math.PI * 1.15, -0.2, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, -0.2, Math.PI * 1.15);
    ctx.stroke();
  }
  let sparks: { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }[] = [];
  // What the dead leave on the ground for a while: bones, ichor, feathers, scorch.
  let decals: { x: number; y: number; kind: string; at: number; seed: number }[] = [];
  let deathsSeen = 0;
  let lastHx = n.x;
  let lastHy = n.y;
  let walk = 0;
  const showDmg = dmgNumbers();
  const lightCanvas = document.createElement('canvas');
  let lastDraw = performance.now() / 1000;

  /** The night's colour at this hour: blue dusk, deep night, a red small hours, gold before dawn. */
  function nightTone(): [number, number, number, number] {
    if (n.nightmare) return [16, 0, 12, 0.68];
    const t = n.t;
    const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, k)));
    const dusk = [14, 18, 44, 0.38];
    const deep = [6, 4, 14, 0.55];
    const red = [22, 4, 10, 0.6];
    const gold = [40, 22, 12, 0.32];
    const c = t < 300 ? mix(dusk, deep, t / 300) : t < 900 ? deep : t < 1500 ? mix(deep, red, (t - 900) / 300) : mix(red, gold, (t - 1500) / 300);
    return c as [number, number, number, number];
  }
  function nightLight(sx: (x: number) => number, sy: (y: number) => number) {
    const LS = 2;
    if (lightCanvas.width !== Math.round(W * LS) || lightCanvas.height !== Math.round(H * LS)) {
      lightCanvas.width = Math.round(W * LS);
      lightCanvas.height = Math.round(H * LS);
    }
    const lc = lightCanvas.getContext('2d')!;
    lc.setTransform(LS, 0, 0, LS, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    const [r, g, b, a] = nightTone();
    lc.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
    lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    const cut = (x: number, y: number, rad: number, lift: number) => {
      if (rad < 2 || x < -rad || y < -rad || x > W + rad || y > H + rad) return;
      const gr = lc.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(0,0,0,${lift})`);
      gr.addColorStop(0.45, `rgba(0,0,0,${lift * 0.8})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = gr;
      lc.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };
    // your lantern, wider with the Seer's Lens
    cut(sx(n.x), sy(n.y), 78 * Math.min(1.5, area(n)), 1);
    for (const fl of n.flames) cut(sx(fl.x), sy(fl.y), fl.r * TILE * 2.2, 0.7);
    for (const f of n.flashes) {
      const k = Math.max(0, 1 - (n.t - f.at) / 0.4);
      if (k <= 0) continue;
      const rad = f.kind === 'beam' ? 40 : f.kind === 'ring' ? (f.r ?? 2) * TILE * 1.2 : f.kind === 'blast' ? 50 : 30;
      cut(sx(f.x), sy(f.y), rad, 0.8 * k);
    }
    for (const p of n.pickups) if (p.kind !== 'soul' && p.kind !== 'bigsoul') cut(sx(p.x), sy(p.y), 22, 0.7);
    for (const f of n.foes) {
      if (f.boss) cut(sx(f.x), sy(f.y), 48, 0.6);
      else if (f.elite || f.treasure) cut(sx(f.x), sy(f.y), 20, 0.5);
    }
    for (const d of n.darts) if (d.kind !== 'dart') cut(sx(d.x), sy(d.y), 14, 0.5);
    ctx.drawImage(lightCanvas, 0, 0, W, H);
    // the last half hour: a glow rising from the east before the sun comes up
    if (!n.nightmare && n.t > 1650 && n.t < DAWN + 5) {
      const k = Math.min(1, (n.t - 1650) / 150);
      const east = ctx.createLinearGradient(W, 0, W * 0.4, H);
      east.addColorStop(0, `rgba(255, 170, 110, ${0.22 * k})`);
      east.addColorStop(1, 'rgba(255, 170, 110, 0)');
      ctx.fillStyle = east;
      ctx.fillRect(0, 0, W, H);
    }
  }

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
    // the ground shakes as a boss climbs out (not with calm motion)
    const qk = n.t - quake.at;
    if (qk < 0.5 && !calmMotion()) {
      const amp = 3 * (1 - qk / 0.5);
      ctx.setTransform(S, 0, 0, S, Math.round((Math.random() - 0.5) * amp * 2) * S, Math.round((Math.random() - 0.5) * amp * 2) * S);
    }
    ctx.fillStyle = '#0b0910';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(ground, -Math.round(camX), -Math.round(camY));

    // the fallen, each in its own way: bones clatter, wraiths fade, bats burst, imps flare
    const fresh = n.deaths.filter((d) => d.at > deathsSeen);
    for (const d of fresh.slice(-30)) {
      const kind = d.kind;
      const burst = (count: number, colors: string[], speed: number, life: number, grav = 0) => {
        for (let k = 0; k < count; k++) {
          const a = Math.random() * Math.PI * 2;
          const v = speed * (0.4 + Math.random() * 0.8);
          sparks.push({ x: d.x, y: d.y - 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - grav, life, max: life, color: colors[k % colors.length], size: Math.random() < 0.3 ? 2 : 1 });
        }
      };
      if (kind === 'bat') burst(6, ['#5a3a7a', '#2a1a3a', '#b07cff'], 2.2, 0.5);
      else if (kind === 'wraith') burst(8, ['#9fe8ff', '#5a8ab0', '#dff4ff'], 0.9, 0.9, 0.6);
      else if (kind === 'imp') burst(8, ['#ff8a2a', '#ffcf5a', '#701826'], 2.4, 0.5);
      else if (kind === 'monk' || kind === 'drowned') burst(7, ['#7f9a52', '#3d4a2a', '#b9c99a'], 1.6, 0.6);
      else if (isBossKind(kind)) burst(40, ['#f2c14e', '#d23a46', '#ffffff'], 4, 0.9);
      else burst(5, ['#e8dcc4', '#9a8f7a', '#6b6450'], 1.6, 0.6);
      decals.push({ x: d.x, y: d.y, kind, at: n.t, seed: Math.random() * 1000 });
    }
    if (n.deaths.length) deathsSeen = n.deaths[n.deaths.length - 1].at;
    if (decals.length > 220) decals = decals.slice(-220);
    decals = decals.filter((d) => n.t - d.at < 25);
    for (const d of decals) {
      const x = Math.round(sx(d.x));
      const y = Math.round(sy(d.y));
      if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
      ctx.globalAlpha = Math.min(0.75, 1 - (n.t - d.at) / 25);
      const r1 = (d.seed % 7) - 3;
      const r2 = ((d.seed / 7) % 5) - 2;
      if (d.kind === 'wraith') {
        px(x - 3, y, 6, 2, 'rgba(120, 190, 230, 0.35)');
      } else if (d.kind === 'bat') {
        px(x + r1, y + r2, 2, 1, '#2a1a3a');
        px(x - r2, y + 1, 1, 1, '#5a3a7a');
      } else if (d.kind === 'imp') {
        px(x - 3, y - 1, 6, 3, 'rgba(30, 10, 5, 0.6)');
      } else if (d.kind === 'monk' || d.kind === 'drowned') {
        px(x - 3, y, 6, 2, 'rgba(70, 90, 40, 0.5)');
      } else {
        // a little heap of bones
        px(x - 2 + r2, y, 3, 1, '#c9bfa6');
        px(x + r1, y + 1, 2, 1, '#9a8f7a');
        px(x - 1, y - 1, 1, 1, '#e8dcc4');
      }
    }
    ctx.globalAlpha = 1;

    // burning ground: a scorched glow, tongues of flame that lick upward, and rising sparks
    const hot = n.fused.hellwalk;
    for (const fl of n.flames) {
      const left = Math.min(1, fl.until - n.t);
      const x = sx(fl.x);
      const y = sy(fl.y);
      if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
      const r = fl.r * TILE;
      ctx.globalAlpha = left * 0.5;
      ctx.fillStyle = hot ? '#3a0a2a' : '#2a0a04';
      ctx.beginPath();
      ctx.ellipse(x, y + 1, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      glowAt(x, y, hot ? '255,90,200' : '255,120,40', r * 1.1, left * (hot ? 0.22 : 0.3));
      for (let k = 0; k < 4; k++) {
        const fx = x + (k - 1.5) * r * 0.45;
        const h = (4 + 3 * Math.sin(t * 14 + k * 2.1 + fl.x * 5)) * (0.6 + 0.4 * left) * (hot ? 1.4 : 1);
        ctx.globalAlpha = left;
        flameTongue(fx, y + 1, 3, h, hot ? '#ff5ad2' : '#ff7a1a', hot ? '#ffd6f4' : '#ffd24a');
      }
      ctx.globalAlpha = 1;
      if (Math.random() < 0.15) sparks.push({ x: fl.x + (Math.random() - 0.5) * fl.r, y: fl.y, vx: (Math.random() - 0.5) * 0.6, vy: -1.5 - Math.random(), life: 0.6, max: 0.6, color: hot ? '#ffb0ec' : '#ffcf5a', size: 1 });
    }
    // the frost ring: a band of cold light at the edge, with shards of ice turning round it
    const fr = frostRadius(n);
    if (fr) {
      const cx = sx(n.x);
      const cy = sy(n.y);
      const r = fr * TILE;
      const deep = n.fused.glacier;
      const band = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
      band.addColorStop(0, 'rgba(120, 200, 255, 0)');
      band.addColorStop(0.85, deep ? 'rgba(150, 220, 255, 0.22)' : 'rgba(140, 210, 255, 0.14)');
      band.addColorStop(1, 'rgba(220, 245, 255, 0.35)');
      ctx.fillStyle = band;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2, true);
      ctx.fill();
      const shards = deep ? 14 : 8;
      for (let k = 0; k < shards; k++) {
        const a = t * 0.5 + (k / shards) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * r);
        const y = Math.round(cy + Math.sin(a) * r);
        glowAt(x, y, '170,225,255', 5, 0.5);
        px(x, y - 2, 1, 5, '#e6f6ff');
        px(x - 2, y, 5, 1, '#e6f6ff');
        px(x, y, 1, 1, '#ffffff');
      }
      if (Math.random() < (deep ? 0.6 : 0.3)) {
        const a = Math.random() * Math.PI * 2;
        sparks.push({ x: n.x + Math.cos(a) * fr, y: n.y + Math.sin(a) * fr, vx: -Math.cos(a) * 0.8, vy: -Math.sin(a) * 0.8, life: 0.9, max: 0.9, color: '#dff4ff', size: 1 });
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
      if (l.blast) {
        // a volatile elite about to burst: an orange ring that fills as it nears
        const r = l.w * TILE;
        const fill = 1 - left / 0.9;
        ctx.fillStyle = `rgba(255, 110, 30, ${blink * 0.8})`;
        ctx.beginPath();
        ctx.arc(sx(l.x), sy(l.y), r * Math.max(0.15, fill), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 170, 80, 0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx(l.x), sy(l.y), r, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      if (l.grasp) {
        // the earth splitting where you stand, with fingers working up through it
        const r = l.w * TILE;
        ctx.fillStyle = `rgba(120, 40, 140, ${blink + 0.1})`;
        ctx.beginPath();
        ctx.arc(sx(l.x), sy(l.y), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(210, 140, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        const up = 1 - left / 0.9;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + l.x;
          const fx = Math.round(sx(l.x) + Math.cos(a) * r * 0.55);
          const fy = Math.round(sy(l.y) + Math.sin(a) * r * 0.45);
          px(fx, fy - Math.round(3 * up), 2, Math.round(3 * up) + 1, '#b9c99a');
        }
        continue;
      }
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
      } else if (p.kind === 'potion') {
        // a red healing potion: glass flask, cork, a glint
        glowAt(x, y, '255,80,90', 9, 0.35 + 0.15 * Math.sin(t * 5));
        px(x - 1, y - 6, 2, 2, '#b08050');
        px(x - 1, y - 4, 2, 1, '#d8e4f0');
        px(x - 3, y - 3, 6, 5, '#d8e4f0');
        px(x - 2, y - 2, 4, 4, '#e0283c');
        px(x - 2, y - 2, 4, 1, '#ff6070');
        px(x - 2, y - 2, 1, 1, '#ffffff');
      } else if (p.kind === 'chest') {
        // the Treasure Ghoul's chest: gold-banded, glowing
        glowAt(x, y, '255,210,90', 16, 0.55 + 0.2 * Math.sin(t * 6));
        px(x - 5, y - 4, 10, 8, '#5a3a14');
        px(x - 5, y - 4, 10, 3, '#8a5a1e');
        px(x - 5, y - 2, 10, 1, '#f2c14e');
        px(x - 1, y - 3, 2, 3, '#ffe9a0');
        px(x - 5, y - 4, 1, 8, '#f2c14e');
        px(x + 4, y - 4, 1, 8, '#f2c14e');
      } else if (p.kind === 'shard') {
        // an ascension shard: a white-gold crystal that turns
        glowAt(x, y, '255,240,190', 15, 0.6 + 0.25 * Math.sin(t * 7));
        const tw = Math.round(Math.sin(t * 3) * 1.5);
        px(x - 1 + tw, y - 6, 2, 12, '#fff7d6');
        px(x - 3, y - 2, 6, 4, '#f2d27a');
        px(x - 1, y - 4, 2, 8, '#ffffff');
      } else if (p.kind === 'forge') {
        // an ember from the Soul Forge: a coal that burns and throws sparks
        glowAt(x, y, '255,140,40', 13, 0.5 + 0.2 * Math.sin(t * 6));
        px(x - 3, y - 2, 7, 4, '#5a1e0a');
        px(x - 2, y - 3, 5, 6, '#c2410c');
        px(x - 1, y - 2, 3, 4, '#ff9a2a');
        px(x, y - 1, 1, 2, '#fff2c0');
        if (Math.random() < 0.2) sparks.push({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y, vx: (Math.random() - 0.5) * 0.6, vy: -1.4 - Math.random(), life: 0.5, max: 0.5, color: '#ffcf5a', size: 1 });
      } else {
        px(x - 3, y - 3, 6, 2, '#7cf5c4');
        px(x - 2, y - 4, 4, 1, '#b4ffe0');
        px(x - 1, y - 1, 2, 3, '#d8d0bd');
      }
    }

    // the dead
    const ordered = [...n.foes].sort((a, b) => a.y - b.y);
    for (const f of ordered) {
      const size = f.kind === 'mother' ? 40 : f.boss ? 28 : f.kind === 'brute' || f.kind === 'boneknight' ? 16 : 12;
      const x = sx(f.x) - size / 2;
      const y = sy(f.y) - size * 0.75;
      if (x < -size || y < -size || x > W + size || y > H + size) continue;
      const frames = enemyFrames((f.kind === 'mother' ? 'lich' : f.kind) as EnemyKind);
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
      if (f.elite || f.treasure) {
        // elites burn with their gift's colour; the Treasure Ghoul glows gold
        const col = f.treasure ? '#f2c14e' : ELITES[f.elite!].color;
        const rgb = col.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16)).join(',');
        glowAt(sx(f.x), sy(f.y) - 3, rgb, f.r * TILE * 2.2, 0.45 + 0.15 * Math.sin(t * 6 + f.id));
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(sx(f.x), sy(f.y) + 1, f.r * TILE * 1.1, f.r * TILE * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (f.elite === 'armored' && !f.cracked) {
          // a steel shell round it
          ctx.strokeStyle = 'rgba(210, 220, 235, 0.8)';
          ctx.beginPath();
          ctx.arc(sx(f.x), sy(f.y) - 3, f.r * TILE * 1.2, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        }
      }
      if (f.slowUntil > n.t) ctx.globalAlpha = 0.75;
      ctx.save();
      // the Treasure Ghoul shines gold
      if (f.treasure) ctx.filter = 'sepia(1) saturate(4) brightness(1.25) hue-rotate(-10deg)';
      // the Night Mother: the Lich's shape, in the colours of the deep night
      if (f.kind === 'mother') ctx.filter = 'hue-rotate(210deg) saturate(1.8) brightness(0.9)';
      if (f.x > n.x) {
        ctx.translate(Math.round(x) + size, Math.round(y));
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, size, size);
      } else ctx.drawImage(img, Math.round(x), Math.round(y), size, size);
      ctx.restore();
      if (f.treasure) {
        // a sack of gold on its back
        px(Math.round(sx(f.x)) - 2, Math.round(y) - 3, 5, 4, '#a8742a');
        px(Math.round(sx(f.x)) - 1, Math.round(y) - 4, 3, 1, '#f2c14e');
      }
      if (f.slowUntil > n.t) {
        ctx.globalAlpha = 0.35;
        px(Math.round(x + 2), Math.round(y + 2), size - 4, size - 4, '#9fd8ff');
      }
      ctx.globalAlpha = 1;
    }

    // darts, scythes and wisps
    const ascDart = { dart: ascendedWeapon(n, 'quiver'), scythe: ascendedWeapon(n, 'scythe'), wisp: ascendedWeapon(n, 'wisps') };
    for (const d of n.darts) {
      const x = sx(d.x);
      const y = sy(d.y);
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      if (ascDart[d.kind]) glowAt(x, y, '255,215,120', 9, 0.5);
      const sp = Math.hypot(d.vx, d.vy) || 1;
      const ux = d.vx / sp;
      const uy = d.vy / sp;
      if (d.kind === 'scythe') {
        // a spinning crescent with a smear of light behind it
        const dark = n.fused.eclipse;
        for (let k = 3; k >= 0; k--) {
          ctx.save();
          ctx.translate(x - ux * k * 3, y - uy * k * 3);
          ctx.rotate(t * 18 - k * 0.5);
          ctx.globalAlpha = k ? 0.18 * (4 - k) : 1;
          crescent(6, dark ? '#b48cff' : '#e8eefc', dark ? '#4a2a7a' : '#8a96b8');
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        glowAt(x, y, dark ? '160,110,255' : '200,215,255', 9, 0.45);
      } else if (d.kind === 'wisp') {
        // ghost-fire: a flickering head with a fading tail
        const fl = 0.8 + 0.2 * Math.sin(t * 30 + d.x * 7);
        for (let k = 1; k <= 4; k++) {
          ctx.globalAlpha = 0.5 - k * 0.1;
          px(Math.round(x - ux * k * 2.5) - 1, Math.round(y - uy * k * 2.5) - 1, 2, 2, '#9ff5d8');
        }
        ctx.globalAlpha = 1;
        glowAt(x, y, '120,255,210', 8 * fl, 0.6);
        px(Math.round(x) - 2, Math.round(y) - 2, 4, 4, '#c8fff0');
        px(Math.round(x) - 1, Math.round(y) - 1, 2, 2, '#ffffff');
      } else {
        // a bone dart: shaft and knuckles, pointing the way it flies
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(uy, ux));
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#efe6cf';
        ctx.fillRect(-12, -0.5, 8, 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#efe6cf';
        ctx.fillRect(-4, -0.5, 7, 1.5);
        ctx.fillRect(-5, -1.5, 2, 3.5);
        ctx.fillRect(2, -1.5, 2, 3.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(3, -0.5, 1, 1);
        ctx.restore();
        if (n.fused.barrage) glowAt(x, y, '255,230,170', 5, 0.35);
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

    // you: a warm pool of lantern light and a gold ring at your feet, so you're easy to find
    // a step's bob while you walk
    const moved = Math.hypot(n.x - lastHx, n.y - lastHy);
    lastHx = n.x;
    lastHy = n.y;
    if (moved > 0.001) walk += moved * 4;
    const bobY = moved > 0.001 && !calmMotion() ? Math.round(Math.abs(Math.sin(walk)) * -1.5) : 0;
    const hx = Math.round(sx(n.x) - 6);
    const hy = Math.round(sy(n.y) - 9) + bobY;
    const glow = ctx.createRadialGradient(sx(n.x), sy(n.y), 2, sx(n.x), sy(n.y), 26);
    glow.addColorStop(0, 'rgba(255, 200, 120, 0.32)');
    glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx(n.x) - 26, sy(n.y) - 26, 52, 52);
    ctx.strokeStyle = `rgba(242, 193, 78, ${0.65 + 0.25 * Math.sin(t * 4)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(sx(n.x), hy + 13, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
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

    // whirling skulls: glowing, with a fading trail behind each
    const skulls = skullCount(n);
    const halo = n.fused.halo;
    for (let k = 0; k < skulls; k++) {
      const a = n.t * 3 + (k / skulls) * Math.PI * 2;
      for (let j = 3; j >= 1; j--) {
        const b = a - j * 0.13;
        ctx.globalAlpha = 0.12 * (4 - j);
        px(Math.round(sx(n.x + Math.cos(b) * skullOrbit(n))) - 2, Math.round(sy(n.y + Math.sin(b) * skullOrbit(n))) - 2, 4, 3, halo ? '#d9b8ff' : '#ffe6a8');
      }
      ctx.globalAlpha = 1;
      const x = Math.round(sx(n.x + Math.cos(a) * skullOrbit(n)));
      const y = Math.round(sy(n.y + Math.sin(a) * skullOrbit(n)));
      glowAt(x, y, halo ? '190,150,255' : '255,220,140', 7, 0.5);
      px(x - 2, y - 3, 5, 4, '#f4ecd8');
      px(x - 3, y - 2, 7, 2, '#f4ecd8');
      px(x - 1, y + 1, 3, 2, '#d8ceb4');
      px(x - 2, y - 1, 2, 1, halo ? '#7a3cff' : '#ff4a2a');
      px(x + 1, y - 1, 2, 1, halo ? '#7a3cff' : '#ff4a2a');
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
      const fade = Math.max(0, 1 - age);
      const x0 = sx(fl.x);
      const y0 = sy(fl.y);
      // an ascended relic strikes in gold
      if (fl.asc) glowAt(x0, y0, '255,215,120', Math.min(44, (fl.r ?? 1) * TILE * 0.7 + 8), fade * 0.5);
      if (fl.kind === 'blast') {
        ctx.globalAlpha = fade;
        glowAt(x0, y0, '255,140,40', (fl.r ?? 1.7) * TILE * 1.4, 0.8);
        ctx.fillStyle = 'rgba(255, 200, 120, 0.5)';
        ctx.beginPath();
        ctx.arc(x0, y0, (fl.r ?? 1.7) * TILE * (0.6 + 0.6 * age), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      if (fl.kind === 'blink') {
        glowAt(x0, y0, '176,124,255', 14, fade * 0.8);
        continue;
      }
      if (fl.kind === 'swing') {
        // a crescent that sweeps out and thins, with a glint at its leading edge
        const r = (fl.r ?? 1.5) * TILE * (0.75 + 0.25 * age);
        const ang = fl.ang ?? 0;
        const span = n.fused.cleaver ? Math.PI : 1.05;
        const sweep = ang - span + span * 2 * Math.min(1, age * 3);
        const col = n.fused.cleaver ? '255,150,90' : lensed ? '220,190,255' : '255,240,200';
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${col},${0.35 * fade})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(x0, y0, r, ang - span, sweep);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x0, y0, r, ang - span, sweep);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        glowAt(x0 + Math.cos(sweep) * r, y0 + Math.sin(sweep) * r, col, 6, fade);
      } else if (fl.kind === 'bolt') {
        // forked lightning from the sky, a flash on the ground and sparks
        const seed = Math.round(fl.at * 1000 + fl.x * 7);
        const path: [number, number][] = [];
        let x = x0 + (hash(seed, 9) - 0.5) * 16;
        let y = y0 - 70;
        for (let k = 0; k < 7; k++) {
          path.push([x, y]);
          x += (hash(seed, k) - 0.5) * 12 + (x0 - x) * 0.25;
          y += 10;
        }
        path.push([x0, y0]);
        const col = n.fused.tempest ? '200,160,255' : '150,210,255';
        ctx.globalCompositeOperation = 'lighter';
        for (const [w, a] of [[6, 0.25], [2.5, 0.6], [1, 1]] as const) {
          ctx.strokeStyle = w === 1 ? `rgba(255,255,255,${a * fade})` : `rgba(${col},${a * fade})`;
          ctx.lineWidth = w;
          ctx.beginPath();
          path.forEach(([px2, py2], i) => (i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2)));
          ctx.stroke();
        }
        const [fx, fy] = path[3];
        ctx.strokeStyle = `rgba(${col},${0.6 * fade})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + (hash(seed, 20) > 0.5 ? 12 : -12), fy + 14);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        glowAt(x0, y0, col, 14, fade * 0.9);
        if (age < 0.1) for (let k = 0; k < 4; k++) sparks.push({ x: fl.x, y: fl.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.35, max: 0.35, color: '#e8f6ff', size: 1 });
      } else if (fl.kind === 'ring') {
        // the bell's toll: a gold shockwave, a softer echo behind it
        const R = (fl.r ?? 2) * TILE;
        const col = n.fused.requiem ? '255,120,120' : lensed ? '220,190,255' : '242,193,78';
        ctx.globalCompositeOperation = 'lighter';
        for (const [lag, w, a] of [[0, 3, 0.9], [0.18, 6, 0.3], [0.32, 2, 0.4]] as const) {
          const e = Math.max(0, Math.min(1, age - lag)) ;
          if (age < lag) continue;
          ctx.strokeStyle = `rgba(${col},${a * (1 - e)})`;
          ctx.lineWidth = w * (1 - e * 0.6);
          ctx.beginPath();
          ctx.arc(x0, y0, R * (0.25 + 0.75 * Math.min(1, (age - lag) * 1.6)), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        if (age < 0.25) glowAt(x0, y0, col, R * 0.5, (0.25 - age) * 2);
      } else if (fl.kind === 'spike') {
        // pointed bone spikes thrust up, with a puff of grave-dust round them
        const r = (fl.r ?? 1) * TILE;
        const up = Math.min(1, age * 5) * (age > 0.7 ? Math.max(0, (1 - age) / 0.3) : 1);
        ctx.globalAlpha = 0.4 * fade;
        ctx.fillStyle = '#5a4a3a';
        ctx.beginPath();
        ctx.ellipse(x0, y0, r * 0.8, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        const count = n.fused.ossuary ? 9 : 6;
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + fl.at * 3;
          const bx = x0 + Math.cos(a) * r * 0.55;
          const by = y0 + Math.sin(a) * r * 0.35;
          const h = (7 + (k % 3) * 2) * up;
          ctx.fillStyle = '#e9e1cc';
          ctx.beginPath();
          ctx.moveTo(bx - 2, by);
          ctx.lineTo(bx + 2, by);
          ctx.lineTo(bx, by - h);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(bx), Math.round(by - h), 1, 2);
        }
        if (age < 0.08) for (let k = 0; k < 3; k++) sparks.push({ x: fl.x + (Math.random() - 0.5) * 0.8, y: fl.y, vx: (Math.random() - 0.5) * 1.5, vy: -0.5 - Math.random(), life: 0.5, max: 0.5, color: '#b8a888', size: 2 });
      } else if (fl.kind === 'beam') {
        // the soul lance: a tapered beam, white at the core, with motes along it
        const len = (fl.r ?? 6) * TILE;
        const col = n.fused.judgement ? '255,230,140' : '140,230,255';
        ctx.save();
        ctx.translate(x0, y0);
        ctx.rotate(fl.ang ?? 0);
        ctx.globalCompositeOperation = 'lighter';
        const g2 = ctx.createLinearGradient(0, 0, len, 0);
        g2.addColorStop(0, `rgba(${col},${0.55 * fade})`);
        g2.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(0, -7 * fade);
        ctx.lineTo(len, -2 * fade);
        ctx.lineTo(len, 2 * fade);
        ctx.lineTo(0, 7 * fade);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.95 * fade})`;
        ctx.fillRect(0, -1.2 * fade, len * (1 - age * 0.3), 2.4 * fade);
        for (let k = 0; k < 6; k++) {
          const mx = ((k * 0.17 + age * 1.5) % 1) * len;
          ctx.fillRect(mx, (hash(k, Math.round(fl.at * 10)) - 0.5) * 8, 1.5, 1.5);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        glowAt(x0, y0, col, 9, fade);
      } else if (fl.kind === 'grasp') {
        // hands burst up from the grave-dirt
        ctx.globalAlpha = fade;
        const r = (fl.r ?? 1) * TILE;
        ctx.fillStyle = 'rgba(60, 30, 50, 0.7)';
        ctx.beginPath();
        ctx.arc(x0, y0, r * (0.8 + 0.2 * age), 0, Math.PI * 2);
        ctx.fill();
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + fl.x;
          const hx2 = Math.round(x0 + Math.cos(a) * r * 0.6);
          const hy2 = Math.round(y0 + Math.sin(a) * r * 0.5);
          px(hx2, hy2 - 7, 2, 7, '#b9c99a');
          px(hx2 - 1, hy2 - 9, 1, 2, '#d4e0b4');
          px(hx2 + 2, hy2 - 9, 1, 2, '#d4e0b4');
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = fade;
        ctx.save();
        ctx.translate(x0, y0);
        ctx.rotate(fl.ang ?? 0);
        ctx.fillStyle = 'rgba(255, 120, 90, 0.6)';
        ctx.fillRect(0, -8, (fl.r ?? 8) * TILE, 16);
        ctx.fillStyle = '#ffe2c8';
        ctx.fillRect(0, -2, (fl.r ?? 8) * TILE, 4);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;

    // sparks: embers, ice, grave-dust and lightning, drifting and fading
    const dtDraw = Math.min(0.1, Math.max(0, t - lastDraw));
    lastDraw = t;
    for (const p of sparks) {
      p.life -= dtDraw;
      p.x += p.vx * dtDraw;
      p.y += p.vy * dtDraw;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      px(Math.round(sx(p.x)), Math.round(sy(p.y)), p.size, p.size, p.color);
    }
    ctx.globalAlpha = 1;
    if (sparks.length) sparks = sparks.filter((p) => p.life > 0).slice(-300);
    // damage numbers, if chosen in Settings: small, rising and fading
    if (showDmg) {
      ctx.font = '6px Silkscreen, monospace';
      ctx.textAlign = 'center';
      for (const h of n.hits) {
        const age = n.t - h.at;
        if (age > 0.7) continue;
        ctx.globalAlpha = 1 - age / 0.7;
        const x = Math.round(sx(h.x));
        const y = Math.round(sy(h.y) - 10 - age * 14);
        ctx.fillStyle = '#000';
        ctx.fillText(String(h.amt), x + 1, y + 1);
        ctx.fillStyle = h.amt >= 100 ? '#f2c14e' : '#fff';
        ctx.fillText(String(h.amt), x, y);
      }
      ctx.globalAlpha = 1;
    }

    // the season's leaves or snow, falling over the whole field
    seasonWeather(ctx, px, W, H, t);

    // a gold marker over your head, on top of everything, so you never lose yourself in a crowd
    {
      const mx = Math.round(sx(n.x));
      const my = Math.round(sy(n.y) - 15 + Math.sin(t * 5) * 1.5);
      px(mx - 3, my, 7, 1, '#2a1a08');
      px(mx - 3, my - 1, 7, 1, '#f2c14e');
      px(mx - 2, my, 5, 1, '#f2c14e');
      px(mx - 1, my + 1, 3, 1, '#f2c14e');
      px(mx, my + 2, 1, 1, '#f2c14e');
    }

    // the night: dark that deepens and turns as the hours pass, with every light cutting its own pool
    nightLight(sx, sy);
    // the boss's shockwave rolling out as it rises
    if (qk < 0.8) {
      const r = 8 + qk * 120;
      ctx.strokeStyle = `rgba(255, 210, 160, ${0.7 * (1 - qk / 0.8)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(quake.x), sy(quake.y), r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // white-gold light when a relic ascends
    if (n.t - ascendedAt < 0.8) {
      ctx.fillStyle = `rgba(255, 245, 210, ${0.45 * (1 - (n.t - ascendedAt) / 0.8)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Grave Fog: only a small circle round you can be seen
    if (n.event?.kind === 'fog' && n.t < n.event.until) {
      const k = Math.min(1, (n.t - n.event.at) / 1.5, (n.event.until - n.t) / 1.5);
      const fg = ctx.createRadialGradient(sx(n.x), sy(n.y), 26, sx(n.x), sy(n.y), 26 + 70 * (1 - k) + 40);
      fg.addColorStop(0, 'rgba(150, 160, 175, 0)');
      fg.addColorStop(1, `rgba(120, 128, 140, ${0.97 * k})`);
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }
    // Blood Moon: everything tinged red
    if (n.event?.kind === 'bloodmoon' && n.t < n.event.until) {
      const k = Math.min(1, (n.t - n.event.at) / 1.5, (n.event.until - n.t) / 1.5);
      ctx.fillStyle = `rgba(150, 10, 30, ${0.2 * k})`;
      ctx.fillRect(0, 0, W, H);
    }
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
/** The Night Shrine: Souls spent on gifts that last for every night. */
export function showNightShrine(back: () => void) {
  const gifts = Object.keys(SHRINE) as ShrineGift[];
  const weapons = NIGHT_RELICS.filter((r) => r.weapon && r.id !== 'spade');
  showOverlay('night-shrine', `
    <h2>🕯️ The Night Shrine</h2>
    <p class="fine">Gifts for every night to come, paid in Souls. 💀 <b>${meta.souls.toLocaleString()}</b> to spend.</p>
    <div class="shrine-list">${gifts.map((g) => {
      const d = SHRINE[g];
      const at = shrineLevel(g);
      const cost = d.costs[at];
      const pips = d.costs.map((_, i) => `<i class="${i < at ? 'on' : ''}"></i>`).join('');
      return `<div class="shrine-gift">
        <span class="shrine-emoji">${d.emoji}</span>
        <span class="shrine-info"><b>${esc(d.name)}</b><small>${esc(d.text)}</small><span class="pips">${pips}</span></span>
        ${cost === undefined ? '<span class="shrine-done">✔ Complete</span>' : `<button class="btn ${meta.souls >= cost ? 'primary' : ''}" data-buy="${g}" ${meta.souls >= cost ? '' : 'disabled'}>💀 ${cost.toLocaleString()}</button>`}
      </div>`;
    }).join('')}</div>
    ${meta.nightShrine.arsenal ? `<h3 class="shop-head">⚔️ Start each night with</h3><div class="shrine-weapons">
      <button class="btn ${meta.nightShrine.start ? '' : 'primary'}" data-start="">⛏️ Just the spade</button>
      ${weapons.map((w) => `<button class="btn ${meta.nightShrine.start === w.id ? 'primary' : ''}" data-start="${w.id}">${w.emoji} ${esc(w.name)}</button>`).join('')}
    </div>` : ''}
    <p class="fine">Heroes bring a perk to the night too: ${esc(HERO_BY_ID[meta.hero as keyof typeof HERO_BY_ID]?.name ?? '')}, ${esc(NIGHT_PERKS[meta.hero] ?? '')}</p>
    <button class="btn" id="back">← Back</button>`);
  overlay.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
    b.addEventListener('click', () => {
      if (buyShrine(b.dataset.buy as ShrineGift)) {
        sfx.relic();
        toast(`🕯️ The Shrine grants ${SHRINE[b.dataset.buy as ShrineGift].name}`);
      }
      showNightShrine(back);
    }),
  );
  overlay.querySelectorAll<HTMLElement>('[data-start]').forEach((b) =>
    b.addEventListener('click', () => {
      setShrineStart(b.dataset.start ?? '');
      showNightShrine(back);
    }),
  );
  on('#back', back);
}

const dashSide = (stick: StickSide): 'left' | 'right' => (stick === 'right' ? 'left' : 'right');

function dashButton(side: 'left' | 'right' | 'desk'): string {
  return `<button type="button" class="ns-dash ${side} ready" id="ns-dash" aria-label="Dash">💨<small>${side === 'desk' ? 'Space' : 'Dash'}</small></button>`;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
