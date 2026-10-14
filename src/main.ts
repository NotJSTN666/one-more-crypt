import './style.css';
import { isMusicEnabled, isMuted, setMusicDepth, setMusicEnabled, setMusicMood, setMuted, sfx, unlockAudio } from './audio';
import { dailyNumber, formatCountdown, msUntilNextDaily } from './daily';
import { ELITES, FEATURES, HERO_BY_ID, dailyHero, type ComboDef } from './content';
import { heroPortrait } from './hero';
import { ENEMY_INFO, Game, isBoss, type GameEvent, type Mode } from './game';
import { checkRun, finishRunMeta, meta, noteRelic, runConfig, type RunReward } from './meta';
import { drawGhosts, startGhosts } from './ghosts';
import { celebrate, showGrimoire, showHeroSelect, showOssuary } from './progress-ui';
import { RELIC_BY_ID, type RelicId } from './relics';
import { Renderer } from './render';
import { hashSeed } from './rng';
import { ONLINE } from './online';
import { copyText, descentStrip, followXHtml, shareText, siteUrl, xIntentUrl } from './share';
import { initSocial, needsName, playerName, rankLine, recordRun, session, showLeaderboard, onlineCountHtml, showLogin, showProfile, signedIn, syncNow } from './social';
import { currentStreak, loadSave, recordDaily, writeSave, type RunResult } from './storage';
import { $, esc, hideOverlay, on, overlay, screen, showOverlay, toast } from './ui';

const canvas = $<HTMLCanvasElement>('board');
const renderer = new Renderer(canvas);
const save = loadSave();
setMuted(save.muted);
setMusicEnabled(!save.musicOff);

let game: Game;
let lastResult: RunResult | null = null;
let lastReward: RunReward | null = null;
let lastLabel = '';
let overlayTimer = 0;
/** Combos completed during the current run, for the results screen and share text. */
let runCombos: ComboDef[] = [];

// ---------- layout ----------

function fitBoard() {
  const app = $('app');
  const width = app.clientWidth - 24;
  const touch = matchMedia('(pointer: coarse)').matches;
  const reserved = touch ? 330 : 190;
  const size = Math.max(200, Math.min(width, window.innerHeight - reserved));
  renderer.resize(size);
}
window.addEventListener('resize', fitBoard);

// ---------- run lifecycle ----------

function newGame(mode: Mode) {
  const today = dailyNumber();
  // The game was called Cryptfall at launch; the seed keeps that name so every daily stays the same crypt.
  const seed = mode === 'daily' ? hashSeed('cryptfall-daily', today) : (Math.random() * 2 ** 32) >>> 0;
  const dailyNo = mode === 'daily' ? today : 0;
  showGame(new Game(mode, seed, dailyNo, runConfig(mode, dailyNo)));
}

function showGame(g: Game) {
  game = g;
  runCombos = [];
  renderer.setGame(game);
  renderer.consume(game.events.splice(0));
  updateHud(true);
}

function startRun(mode: Mode) {
  unlockAudio();
  newGame(mode);
  saveRun();
  setMusicDepth(game.floor);
  setMusicMood(game.isBossFloor() ? 'boss' : 'crypt');
  hideOverlay();
  sfx.stairs();
}

// ---------- resuming an interrupted run ----------
// The game is deterministic, so a run is saved as its seed plus every input, and
// rebuilt by replaying them. Closing the tab (or the X in-app browser) loses nothing.

const RUN_KEY = 'wardenfall:run';

interface SavedRun {
  mode: Mode;
  seed: number;
  dailyNo: number;
  log: string;
}

function saveRun() {
  if (!game || game.phase === 'dead') return;
  try {
    const run: SavedRun = { mode: game.mode, seed: game.seed, dailyNo: game.dailyNo, log: game.header() + game.log };
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // Storage blocked: the run just can't be resumed.
  }
}

function clearRun() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    // ignore
  }
}

/** A saved run that can still be continued, rebuilt and ready to show. */
function savedRun(): Game | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as SavedRun;
    if (run.mode === 'daily' && (run.dailyNo !== dailyNumber() || save.daily[run.dailyNo])) {
      clearRun();
      return null;
    }
    const g = Game.replay(run.mode, run.seed, run.dailyNo, run.log);
    if (g.phase === 'dead') {
      clearRun();
      return null;
    }
    return g;
  } catch {
    clearRun();
    return null;
  }
}

function resumeRun(g: Game) {
  unlockAudio();
  showGame(g);
  setMusicDepth(g.floor);
  setMusicMood(g.isBossFloor() ? 'boss' : 'crypt');
  hideOverlay();
  sfx.stairs();
  if (g.phase === 'choose') showChoice();
  else if (g.phase === 'event') showEvent();
}

function killedByPhrase(name: string): string {
  return /^(the|their|a|an) /i.test(name) ? name : `a ${name}`;
}

function finishRun(abandoned = false) {
  const result: RunResult = {
    floor: game.floor,
    kills: game.kills,
    turns: game.turns,
    relics: game.relicEmojis(),
    killedBy: abandoned ? 'their own cowardice' : killedByPhrase(game.killedBy),
    hero: HERO_BY_ID[game.hero].name,
    combos: runCombos.map((c) => `${c.emoji} ${c.name}`).join(', ') || undefined,
  };
  clearRun();
  lastReward = finishRunMeta(game, currentStreak(save, dailyNumber()));
  let best = false;
  if (game.mode === 'daily') {
    recordDaily(save, game.dailyNo, result);
    lastLabel = `Daily #${game.dailyNo}`;
  } else {
    if (result.floor > save.bestEndless) {
      best = save.bestEndless > 0;
      save.bestEndless = result.floor;
    }
    lastLabel = 'Endless';
  }
  save.totals.runs += 1;
  save.totals.kills += result.kills;
  if (game.mode === 'daily') save.totals.bestDaily = Math.max(save.totals.bestDaily, result.floor);
  writeSave(save);
  lastResult = result;
  celebrate(lastReward.achievements);

  const mode = game.mode;
  const dailyNo = game.dailyNo;
  const uploaded = recordRun({
    mode,
    daily_no: mode === 'daily' ? dailyNo : null,
    seed: game.seed,
    floor: result.floor,
    kills: result.kills,
    turns: result.turns,
    relics: result.relics,
    killed_by: result.killedBy,
    log: game.header() + game.log,
  });
  window.clearTimeout(overlayTimer);
  overlayTimer = window.setTimeout(() => {
    showDeath(result, best);
    void uploaded
      .then((ok) => (ok ? rankLine(mode, dailyNo, result.floor) : ''))
      .then((line) => setRank(line))
      .catch(() => setRank('Saved. It will upload when you are back online.'));
  }, abandoned ? 0 : 1100);
}

function setRank(text: string) {
  const el = document.getElementById('rank');
  if (el && screen === 'death') el.textContent = text;
}

// ---------- input ----------

function act(dx: number, dy: number) {
  unlockAudio();
  if (!game || game.phase !== 'play' || !overlay.hidden) return;
  if (game.act(dx, dy)) processEvents();
  else sfx.bump();
}

function processEvents() {
  const events = game.events.splice(0);
  renderer.consume(events);
  playSounds(events);
  if (events.some((e) => e.t === 'floor')) {
    setMusicDepth(game.floor);
    setMusicMood(game.isBossFloor() ? 'boss' : 'crypt');
  }
  // Progress: codex entries, combos and achievements.
  for (const ev of events) {
    if (ev.t !== 'relic') continue;
    const { achievements, combos } = noteRelic(game, ev.id);
    for (const c of combos) {
      runCombos.push(c);
      renderer.banner(`${c.name.toUpperCase()}!`, '#f2c14e');
    }
    celebrate(achievements, combos);
  }
  if (game.phase !== 'dead') celebrate(checkRun(game));
  updateHud();
  if (game.phase === 'choose') {
    window.clearTimeout(overlayTimer);
    overlayTimer = window.setTimeout(showChoice, 280);
  } else if (game.phase === 'event') {
    window.clearTimeout(overlayTimer);
    overlayTimer = window.setTimeout(showEvent, 250);
  } else if (game.phase === 'dead') {
    setMusicMood('silent');
    finishRun();
    return;
  }
  saveRun();
}

function playSounds(events: GameEvent[]) {
  const has = (t: GameEvent['t']) => events.some((e) => e.t === t);
  if (has('death')) return sfx.death();
  if (events.some((e) => e.t === 'hit' && e.crit)) sfx.crit();
  else if (has('kill')) sfx.kill();
  else if (has('hit')) sfx.hit();
  if (has('bolt')) sfx.zap();
  if (has('shot')) sfx.shot();
  if (has('hurt')) sfx.hurt();
  if (has('block') || has('dodge')) sfx.block();
  if (has('heal')) sfx.heal();
  if (has('stairs')) sfx.stairs();
  if (has('raise') || has('teleport')) sfx.zap();
  if (has('warn')) sfx.block();
  if (has('spike') || has('eblock')) sfx.hit();
  if (!events.some((e) => e.t !== 'floor')) sfx.step();
}

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1], k: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1], j: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], h: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0], l: [1, 0],
  ' ': [0, 0], '.': [0, 0],
};
let lastRepeat = 0;

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!overlay.hidden) {
    if ((screen === 'choose' && game?.phase === 'choose' && game.offer) || (screen === 'event' && game?.phase === 'event')) choiceKey(e);
    return;
  }
  const dir = KEYS[e.key];
  if (!dir) {
    if (e.key === 'Escape') showPause();
    return;
  }
  e.preventDefault();
  if (e.repeat) {
    const now = performance.now();
    if (now - lastRepeat < 140) return;
    lastRepeat = now;
  }
  act(dir[0], dir[1]);
});

let touchStart: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  touchStart = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.hypot(dx, dy) > 24) {
    if (Math.abs(dx) > Math.abs(dy)) act(Math.sign(dx), 0);
    else act(0, Math.sign(dy));
    return;
  }
  // Tap: step one tile toward the tapped spot, or wait when tapping yourself.
  const tile = renderer.tileAt(e.clientX, e.clientY);
  if (!tile || !game) return;
  const tx = tile.x - game.player.x;
  const ty = tile.y - game.player.y;
  if (tx === 0 && ty === 0) act(0, 0);
  else if (Math.abs(tx) >= Math.abs(ty)) act(Math.sign(tx), 0);
  else act(0, Math.sign(ty));
});

document.querySelectorAll<HTMLButtonElement>('#dpad button').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const [dx, dy] = btn.dataset.dir!.split(',').map(Number);
    act(dx, dy);
  });
});

$('mute').addEventListener('click', () => {
  unlockAudio();
  setMuted(!isMuted());
  save.muted = isMuted();
  writeSave(save);
  updateMuteIcon();
});
$('menu-btn').addEventListener('click', () => showPause());

function updateMuteIcon() {
  $('mute').textContent = isMuted() ? '🔇' : '🔊';
}

// ---------- HUD ----------

let knownRelics = 0;
let selectedRelic: RelicId | null = null;

function updateHud(reset = false) {
  const p = game.player;
  const pct = Math.max(0, (p.hp / p.maxHp) * 100);
  const fill = $('hp-fill');
  fill.style.width = `${pct}%`;
  fill.classList.toggle('low', p.hp <= 3);
  $('hp-text').textContent = `${p.hp}/${p.maxHp}`;
  $('floor').textContent = String(game.floor);
  $('atk').textContent = String(game.atk);
  $('kills').textContent = String(game.kills);

  const boss = game.enemies.find((e) => isBoss(e) && !e.dead);
  $('boss-bar').hidden = !boss;
  if (boss) {
    $('boss-name').textContent = ENEMY_INFO[boss.kind].name;
    $('boss-fill').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
  }

  const unique = [...new Set(game.relicLog)];
  if (reset || unique.length !== knownRelics) {
    const bar = $('relic-bar');
    bar.innerHTML = '';
    unique.forEach((id, i) => {
      const def = RELIC_BY_ID[id];
      const chip = document.createElement('button');
      chip.className = 'relic-chip';
      if (!reset && i >= knownRelics) chip.classList.add('new');
      chip.textContent = def.emoji;
      chip.setAttribute('aria-label', def.name);
      chip.addEventListener('click', () => {
        selectedRelic = selectedRelic === id ? null : id;
        updateTip();
      });
      const n = game.r(id);
      if (n > 1) {
        const c = document.createElement('span');
        c.className = 'count';
        c.textContent = `×${n}`;
        chip.appendChild(c);
      }
      bar.appendChild(chip);
    });
    knownRelics = unique.length;
  } else {
    // counts may change without new relic types
    unique.forEach((id, i) => {
      const chip = $('relic-bar').children[i];
      const n = game.r(id);
      let c = chip?.querySelector('.count');
      if (n > 1 && chip) {
        if (!c) {
          c = document.createElement('span');
          c.className = 'count';
          chip.appendChild(c);
        }
        c.textContent = `×${n}`;
      }
    });
  }
  if (reset) selectedRelic = null;
  updateTip();
}

function updateTip() {
  const tip = $('tip');
  if (selectedRelic) {
    const def = RELIC_BY_ID[selectedRelic];
    const n = game.r(selectedRelic);
    tip.innerHTML = `<b>${def.name}${n > 1 ? ` ×${n}` : ''}</b>: ${def.desc(n)}`;
    return;
  }
  const elite = game.alive.find((e) => e.elite);
  const boss = game.alive.find((e) => isBoss(e));
  const feature = game.feature && !game.feature.used ? game.feature : null;
  if (game.stairsOpen) tip.innerHTML = 'The seal is broken. <b>Take the stairs</b> to descend.';
  else if (game.warnings.length)
    tip.innerHTML = '<b>Glowing tiles</b> will be struck next turn. Get clear!';
  else if (game.enemies.some((e) => e.aim && !e.dead))
    tip.innerHTML = '<b>Red tiles:</b> an arrow flies next turn. Step aside!';
  else if (boss?.kind === 'boss') tip.innerHTML = 'The <b>Bone Warden</b> raises ghouls every few turns. Strike fast.';
  else if (boss?.kind === 'abbot') tip.innerHTML = 'The <b>Plague Abbot</b> rains plague around you. Watch for green tiles.';
  else if (boss?.kind === 'lich') tip.innerHTML = 'The <b>Lich King</b> blinks away and fires along its row and column.';
  else if (game.shadowReady) tip.innerHTML = '<b>Shadowstep:</b> your next step goes unseen. Foes won\'t act.';
  else if (elite) tip.innerHTML = `Glowing foes are elites. <b>${ELITES[elite.elite!].name}:</b> ${ELITES[elite.elite!].desc}`;
  else if (feature) tip.innerHTML = `Step onto the <b>${FEATURES[feature.kind].name}</b> to use it.`;
  else if (game.spikes.some(Boolean) && game.turns < 4) tip.innerHTML = '<b>Spikes</b> hurt anything that walks on them. Lure foes across.';
  else if (game.floor === 1 && game.turns < 6)
    tip.innerHTML = 'Move with arrows, WASD, swipe or tap. <b>Bump foes to strike.</b> They move when you do.';
  else if (game.relicLog.length && game.floor === 2 && game.turns < 40)
    tip.textContent = 'Tap a relic below to read it. Relics stack.';
  else tip.textContent = 'Slay every foe to unseal the stairs.';
}

// ---------- overlays ----------

function showTitle() {
  setMusicDepth(0);
  setMusicMood('crypt');
  const today = dailyNumber();
  const done = save.daily[today];
  const streak = currentStreak(save, today);
  const resumable = savedRun();
  const heroToday = HERO_BY_ID[dailyHero(today)].name;
  const dailyBlock = done
    ? `<div class="card">
        <div>Daily #${today} conquered</div>
        <div class="strip">${descentStrip(done.floor)}</div>
        <div class="sub" style="margin:0">Floor ${done.floor} · ${done.kills} kills</div>
        <button class="btn x" id="share-today">Share on 𝕏</button>
        <div class="sub" style="margin:6px 0 0">Next crypt opens in <span class="countdown">--:--:--</span></div>
      </div>`
    : resumable?.mode === 'daily'
      ? ''
      : `<button class="btn primary" id="daily">Daily Descent #${today}<small>Today's hero: the ${heroToday}. One attempt.</small></button>`;
  const continueBlock = resumable
    ? `<button class="btn primary" id="continue">▶ Continue ${resumable.mode === 'daily' ? `Daily #${resumable.dailyNo}` : 'Endless'}<small>${HERO_BY_ID[resumable.hero].name} · floor ${resumable.floor} · ${resumable.player.hp}/${resumable.player.maxHp} HP</small></button>`
    : '';
  showOverlay('title', `
    ${accountChip()}
    <h1 class="logo">One More Crypt</h1>
    <p class="tagline">One crypt. One try a day. How deep can you go?</p>
    ${onlineCountHtml()}
    ${continueBlock}
    ${dailyBlock}
    <button class="btn" id="endless">Endless Descent<small>${save.bestEndless ? `Deepest: floor ${save.bestEndless}` : 'Choose your hero, random crypts'}</small></button>
    <div class="row">
      <button class="btn" id="ossuary">🏛️ Ossuary<small>💀 ${meta.souls} Souls</small></button>
      <button class="btn" id="grimoire">📖 Grimoire<small>Relics, combos, feats</small></button>
    </div>
    ${ONLINE ? '<button class="btn" id="leaderboard">🏆 Leaderboards</button>' : ''}
    <button class="btn" id="help">How to play</button>
    ${streak > 1 ? `<div class="streak">🕯️ ${streak}-day streak</div>` : ''}
    ${followXHtml}
  `);
  on('#account', () => showProfile(showTitle));
  on('#leaderboard', () => showLeaderboard(showTitle));
  on('#daily', () => startRun('daily'));
  on('#continue', () => resumable && resumeRun(resumable));
  on('#endless', () => showHeroSelect(() => startRun('endless'), showTitle));
  on('#ossuary', () => showOssuary(showTitle));
  on('#grimoire', () => showGrimoire(showTitle));
  on('#help', () => showHelp(showTitle));
  on('#share-today', () => done && share(done, `Daily #${today}`));
  tickCountdowns();
}

function accountChip(): string {
  if (ONLINE && !session.ready) return '<div class="account-row"></div>';
  const name = playerName();
  return `<div class="account-row"><button class="account-chip" id="account">👤 ${name ? esc(name) : 'Sign in'}</button></div>`;
}

function showHelp(back: () => void) {
  showOverlay('help', `
    <h2>How to play</h2>
    <ul class="help">
      <li>Move with <b>arrows / WASD</b>, or <b>swipe / tap</b> on mobile.</li>
      <li><b>Bump</b> a foe to strike it. Every move you make, the dead make one too.</li>
      <li>Slay every foe to <b>unseal the stairs</b>, then descend.</li>
      <li>Each floor, claim a <b>relic</b>. They stack and combo, so build something broken.</li>
      <li>Every 5th floor a boss awaits: the <b>Bone Warden</b>, the <b>Plague Abbot</b>, then the <b>Lich King</b>.</li>
      <li><b>Glowing foes</b> are elites with a special trick. <b>Spikes</b> hurt anything that steps on them.</li>
      <li>Shrines, chests and fountains offer <b>deals</b>. Step on them to choose.</li>
      <li>Every run earns <b>Souls</b>. Spend them in the <b>Ossuary</b> on new heroes and relics.</li>
      <li>The <b>Daily Descent</b> is the same crypt and hero for everyone, once a day. Share your depth.</li>
    </ul>
    <div class="foes card">
      <div><b>Knight</b>10 HP. Heals 1 on every new floor.</div>
      <div><b>Rogue</b>7 HP. Every 3rd step is free. 15% dodge.</div>
      <div><b>Necromancer</b>8 HP. Slain foes may rise as thralls.</div>
      <div><b>Thralls</b>Fight for you. Walk into one to swap places.</div>
    </div>
    <div class="foes card">
      <div><b>Ghoul</b>Shambles toward you.</div>
      <div><b>Blood Bat</b>Erratic flier.</div>
      <div><b>Skeleton Archer</b>Aims, then fires down a line. Red tiles = danger.</div>
      <div><b>Grave Brute</b>Slow, hits for 3. Strike while it rests.</div>
      <div><b>Wraith</b>Drifts through walls.</div>
      <div><b>Bone Warden</b>Floor 5. Summons ghouls.</div>
      <div><b>Plague Abbot</b>Floor 10. Rains plague, calls bats.</div>
      <div><b>Lich King</b>Floor 15. Teleports, fires bolts.</div>
    </div>
    <button class="btn primary" id="back">Back</button>
  `);
  save.seenHelp = true;
  writeSave(save);
  on('#back', back);
}

function showChoice() {
  if (game.phase !== 'choose' || !game.offer) return;
  sfx.relic();
  const offer = game.offer;
  const cards = offer.relics
    .map((r, i) => {
      const have = game.r(r.id);
      return `<button class="${r.rarity}" data-i="${i}">
        <span class="emoji">${r.emoji}</span>
        <span><span class="name">${r.name}</span><span class="tag">${r.rarity.toUpperCase()}${have ? ` · OWNED ×${have}` : ''}</span>
        <span class="desc">${r.desc(have + 1)}</span></span>
      </button>`;
    })
    .join('');
  showOverlay('choose', `
    <h2>Floor ${game.floor} cleared</h2>
    <p class="sub">Claim a relic from the dead<span class="keys-hint"> · ↑↓ or W/S to choose, Enter or Space to take</span></p>
    <div class="offer">${cards}</div>
    <button class="btn" id="rest">🔥 Rest instead<small>Heal ${offer.restHeal} HP (${game.player.hp}/${game.player.maxHp})</small></button>
  `);
  overlay.querySelectorAll<HTMLButtonElement>('.offer button').forEach((b) => {
    b.addEventListener('click', () => pickRelic(Number(b.dataset.i)));
  });
  on('#rest', () => pickRelic(-1));
  choiceButtons().forEach((b, k) => b.addEventListener('mousemove', () => k !== choiceIndex && selectChoice(k)));
  // A button focused earlier (e.g. mute) would otherwise also react to Enter/Space.
  (document.activeElement as HTMLElement | null)?.blur();
  choiceShownAt = performance.now();
  selectChoice(0);
}

// Keyboard selection on the relic screen: arrows/WASD move, Enter/Space confirm.
const CHOICE_NAV: Record<string, number> = {
  ArrowUp: -1, ArrowLeft: -1, w: -1, W: -1, a: -1, A: -1, k: -1, h: -1,
  ArrowDown: 1, ArrowRight: 1, s: 1, S: 1, d: 1, D: 1, j: 1, l: 1,
};
let choiceIndex = 0;
let choiceShownAt = 0;

function choiceButtons(): HTMLButtonElement[] {
  return [...overlay.querySelectorAll<HTMLButtonElement>('.offer button:not(:disabled), #rest')];
}

function selectChoice(i: number) {
  const buttons = choiceButtons();
  if (!buttons.length) return;
  choiceIndex = (i + buttons.length) % buttons.length;
  buttons.forEach((b, k) => b.classList.toggle('selected', k === choiceIndex));
  buttons[choiceIndex].scrollIntoView({ block: 'nearest' });
}

function choiceKey(e: KeyboardEvent) {
  const nav = CHOICE_NAV[e.key];
  const confirm = e.key === 'Enter' || e.key === ' ';
  if (nav || confirm) e.preventDefault();
  // Ignore keys held over from walking onto the stairs, so a held key can't skip the choice.
  if (e.repeat || performance.now() - choiceShownAt < 250) return;
  if (nav) {
    selectChoice(choiceIndex + nav);
    sfx.step();
  } else if (confirm) {
    choiceButtons()[choiceIndex]?.click();
  } else {
    if (!game.offer) return;
    const n = Number(e.key);
    if (n >= 1 && n <= game.offer.relics.length) pickRelic(n - 1);
    else if (e.key === 'r' || e.key === 'R') pickRelic(-1);
  }
}

function showEvent() {
  if (game.phase !== 'event' || !game.feature) return;
  const f = FEATURES[game.feature.kind];
  const can = game.canAcceptEvent();
  const note =
    game.feature.kind === 'chest' && game.r('key')
      ? 'Your Skeleton Key opens it cleanly, and it holds two relics.'
      : game.feature.kind === 'shrine' && !can
        ? 'You have too little life left to offer.'
        : '';
  showOverlay('event', `
    <h2>${f.name}</h2>
    <p class="sub">${f.text}</p>
    ${note ? `<p class="fine">${note}</p>` : ''}
    <div class="offer event-offer">
      <button class="common" id="accept" ${can ? '' : 'disabled'}><span class="emoji">${game.feature.kind === 'shrine' ? '🩸' : game.feature.kind === 'chest' ? '🧰' : '⛲'}</span><span><span class="name">${game.feature.kind === 'chest' && game.r('key') ? 'Unlock it' : f.accept}</span></span></button>
      <button class="rare" id="leave"><span class="emoji">🚶</span><span><span class="name">${f.leave}</span></span></button>
    </div>`);
  on('#accept', () => resolveEvent(true));
  on('#leave', () => resolveEvent(false));
  (document.activeElement as HTMLElement | null)?.blur();
  choiceShownAt = performance.now();
  selectChoice(can ? 0 : 1);
}

function resolveEvent(accept: boolean) {
  if (game.phase !== 'event') return;
  game.resolveEvent(accept);
  hideOverlay();
  processEvents();
}

function pickRelic(i: number) {
  if (game.phase !== 'choose') return;
  game.choose(i);
  hideOverlay();
  sfx.stairs();
  processEvents();
}

function showPause() {
  if (!game || game.phase !== 'play' || !overlay.hidden) return;
  const daily = game.mode === 'daily';
  showOverlay('pause', `
    <h2>Paused</h2>
    <p class="sub">${daily ? `Daily #${game.dailyNo}` : 'Endless'} · Floor ${game.floor}</p>
    ${onlineCountHtml()}
    <button class="btn primary" id="resume">Resume</button>
    <button class="btn" id="help">How to play</button>
    <button class="btn" id="music">🎵 Music: ${isMusicEnabled() ? 'On' : 'Off'}</button>
    <button class="btn" id="abandon">Abandon run<small>${daily ? "Counts as today's attempt" : 'Back to the title'}</small></button>
  `);
  on('#resume', hideOverlay);
  on('#music', () => {
    setMusicEnabled(!isMusicEnabled());
    save.musicOff = !isMusicEnabled();
    writeSave(save);
    const btn = overlay.querySelector('#music');
    if (btn) btn.textContent = `🎵 Music: ${isMusicEnabled() ? 'On' : 'Off'}`;
  });
  on('#help', () => {
    hideOverlay();
    showHelp(() => {
      hideOverlay();
      showPause();
    });
  });
  on('#abandon', () => {
    clearRun();
    if (daily) {
      game.phase = 'dead';
      finishRun(true);
    } else {
      hideOverlay();
      newGame('endless');
      showTitle();
    }
  });
}

function showDeath(r: RunResult, best: boolean) {
  const daily = game.mode === 'daily';
  showOverlay('death', `
    <img class="hero-portrait" src="${heroPortrait(game.hero, game.relics, game.relicLog)}" alt="Your hero's final form" width="96" height="96" />
    <h2 class="dead">You have fallen</h2>
    <p class="sub">${lastLabel} · slain by ${r.killedBy}</p>
    <div class="strip">${descentStrip(r.floor)}</div>
    <div class="big-stats">
      <div><b>${r.floor}</b>FLOOR</div>
      <div><b>${r.kills}</b>KILLS</div>
      <div><b>${r.turns}</b>TURNS</div>
    </div>
    ${r.relics ? `<div class="strip" style="font-size:18px">${r.relics}</div>` : ''}
    ${r.combos ? `<p class="combo-line">${esc(r.combos)}</p>` : ''}
    ${best ? '<p class="streak">New deepest descent!</p>' : ''}
    ${
      lastReward
        ? `<div class="souls-earned"><b>+${lastReward.souls} Souls</b><span>${lastReward.lines.map(([k, v]) => `${esc(k)} +${v}`).join(' · ')}</span><span>💀 ${meta.souls} to spend in the Ossuary</span></div>`
        : ''
    }
    ${ONLINE ? `<p class="rank-line" id="rank">${signedIn() ? 'Carving your name into the crypt…' : ''}</p>` : ''}
    ${ONLINE && !signedIn() ? '<button class="btn" id="join">Claim a name for the leaderboard</button>' : ''}
    <button class="btn x" id="share">Share on 𝕏</button>
    <div class="row">
      <button class="btn" id="copy">Copy result</button>
      <button class="btn" id="again">${daily ? 'Endless run' : 'Descend again'}</button>
    </div>
    <div class="row">
      ${ONLINE ? '<button class="btn" id="leaderboard">🏆 Leaderboard</button>' : ''}
      <button class="btn" id="ossuary">🏛️ Ossuary</button>
      <button class="btn" id="title">Title</button>
    </div>
    ${daily ? '<p class="sub">Next crypt opens in <span class="countdown">--:--:--</span></p>' : ''}
    ${onlineCountHtml()}
    ${followXHtml}
  `);
  const backHere = () => showDeath(r, best);
  on('#leaderboard', () => showLeaderboard(backHere, game.mode === 'daily' ? 'today' : 'endless'));
  on('#join', () =>
    showLogin(() => {
      backHere();
      // Joining uploads the queued run; show where it landed.
      if (signedIn()) {
        setRank('Carving your name into the crypt…');
        void syncNow()
          .then(() => rankLine(game.mode, game.dailyNo, r.floor))
          .then(setRank)
          .catch(() => setRank(''));
      }
    }),
  );
  on('#share', () => share(r, lastLabel));
  on('#copy', async () => toast((await copyText(shareText(r, lastLabel) + '\n' + siteUrl())) ? 'Copied!' : 'Copy failed'));
  on('#again', () => showHeroSelect(() => startRun('endless'), backHere));
  on('#ossuary', () => showOssuary(backHere));
  on('#title', () => {
    newGame('endless');
    showTitle();
  });
  tickCountdowns();
}

function share(r: RunResult, label: string) {
  window.open(xIntentUrl(shareText(r, label)), '_blank', 'noopener');
}

function tickCountdowns() {
  const text = formatCountdown(msUntilNextDaily());
  overlay.querySelectorAll('.countdown').forEach((el) => (el.textContent = text));
}
setInterval(tickCountdowns, 1000);

// ---------- main loop ----------

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  renderer.frame(dt);
  drawGhosts(dt);
  requestAnimationFrame(loop);
}

// Expose for automated play-testing.
(window as unknown as { cryptfall: unknown }).cryptfall = {
  get game() {
    return game;
  },
  act,
  pickRelic,
  resolveEvent,
  enemies: ENEMY_INFO,
  get lastResult() {
    return lastResult;
  },
};

updateMuteIcon();
fitBoard();
newGame('endless');
// Starts restoring any session in the background; must run before the first screen draws.
void initSocial(save, () => {
  if (screen !== 'title') return;
  // First visit, or back from an email link / X sign-in that still needs a name.
  if (needsName()) showLogin(showTitle, 'name');
  else if (!session.account && !save.seenOnlineLogin) showLogin(showTitle);
  else showTitle();
});
showTitle();
if (!ONLINE && !save.seenLogin) showLogin(showTitle);
startGhosts();
requestAnimationFrame(loop);
document.fonts?.load('8px Silkscreen').catch(() => undefined);
