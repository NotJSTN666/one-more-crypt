import './style.css';
import { audioRunning, fusionSound, isMusicEnabled, isMuted, onAudioState, setMusicDepth, setMusicEnabled, setMusicMood, setMuted, sfx, unlockAudio } from './audio';
import { dailyNumber, formatCountdown, msUntilNextDaily } from './daily';
import { ELITES, FEATURES, HERO_BY_ID, dailyHero, type ComboDef, type HeroId } from './content';
import { heroPortrait } from './hero';
import { ENEMY_INFO, Game, fullPool, isBoss, type GameEvent, type GhostInfo, type Mode } from './game';
import { acceptQuest, checkRun, chooseStory, clearQuest, completeQuest, equipOutfit, finishRunMeta, noteBond, noteStreak, meta, readLore, saveMeta, noteFusion, noteRelic, outfitFor, readEpitaph, runConfig, runsPlayed, type RunReward } from './meta';
import { drawGhosts, startGhosts } from './ghosts';
import { celebrate, celebrateNotes, setHallOpener, showGrimoire, showHeroSelect, showOssuary } from './progress-ui';
import { ASCEND_FLOOR, FUSION_BY_ID, RELIC_BY_ID, type FusedId, type RelicId } from './relics';
import { hallFromLink, showHall, showPublicHall, soulRankHtml, titleName } from './hall';
import { HEAD_BY_ID, LOOK_BY_ID, PODIUM, STREAK_HELMS, WEEKLY, rankFor } from './progression';
import { Renderer } from './render';
import { hashSeed } from './rng';
import { ONLINE, dailyBoard, endlessBoard, mySummons, noteRun, noteSummon, pingActivity, startActivityPings } from './online';
import {
  ACT_TITLE, LORE, LORE_COUNT, MAIN_QUESTS, QUESTS, QUEST_BY_N, SPEAKERS, conversation, facePortrait, houndStats, npcMarker, npcPresent, petName, questStatus,
  type Line, type NpcId, type Quest, type StoryState,
} from './story';
import { EPITAPHS, hollowKey, setHollowSpot, showHollow, type HollowPlace } from './hollow';
import { showWardrobe } from './wardrobe';
import { IMPACT, playFusion } from './fusefx';
import { howToHtml, startHowTo } from './howto';
import { RELIC_COACH, TUTORIAL } from './tutorial';
import { KOFI_URL, copyText, descentStrip, followXHtml, kofiHtml, playTime, shareText, siteUrl, xIntentUrl } from './share';
import { installMode, onInstallChange, promptInstall, setupInstall } from './install';
import { bountiesHtml, progressBounties } from './bounties';
import { enableReminders, reminderPrefs, remindersAvailable, remindersNeedInstall } from './push';
import { claimPodiums, claimWeekly, clearBeat, lastBeat, type PodiumFinish, type WeeklyFinish } from './social';
import { endlessRecord, initSocial, needsName, playerName, rankLine, recordRun, session, showLeaderboard, onlineCountHtml, showLogin, showProfile, signedIn, syncNow } from './social';
import { currentStreak, loadSave, recordDaily, streakStats, writeSave, type RunResult } from './storage';
import { $, esc, hideOverlay, on, overlay, overlayShownAt, screen, showOverlay, toast } from './ui';

const canvas = $<HTMLCanvasElement>('board');
const renderer = new Renderer(canvas);
const save = loadSave();
// Fill in the Hall's streak from the dailies already played (saves from before streaks were tracked).
noteStreak(streakStats(save, dailyNumber()));
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

/** The guided first run. While it's on, nothing is saved or counted. */
let tutorial: { step: number; busy: boolean; then: () => void; label: string } | null = null;

function fitBoard() {
  const app = $('app');
  const width = app.clientWidth - 24;
  const touch = matchMedia('(pointer: coarse)').matches;
  const reserved = (touch ? 330 : 190) + (tutorial ? 40 : 0);
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
  renderer.outfit = outfitFor(game.hero);
  renderer.pet = meta.pet;
  renderer.setGame(game);
  renderer.consume(game.events.splice(0));
  updateHud(true);
}

function startRun(mode: Mode) {
  unlockAudio();
  void pingActivity(true);
  newGame(mode);
  if (mode === 'daily' || mode === 'endless') noteRun(mode, 'start');
  startClock();
  saveRun();
  setMusicDepth(game.floor, game.zone.def.key);
  setMusicMood(game.isBossFloor() ? 'boss' : 'crypt');
  hideOverlay();
  sfx.stairs();
}

// ---------- tutorial ----------

function startTutorial(then: () => void, label = 'Enter the crypt') {
  unlockAudio();
  noteRun('title', 'tutorial');
  tutorial = { step: 0, busy: false, then, label };
  game = new Game('endless', 7, 0, { hero: 'knight', pool: fullPool() });
  runCombos = [];
  document.body.classList.add('tutorial');
  $('coach').hidden = false;
  hideOverlay();
  fitBoard();
  stageTutorial();
  setMusicDepth(1);
  setMusicMood('crypt');
  sfx.stairs();
}

function stageTutorial() {
  if (!tutorial) return;
  const step = TUTORIAL[tutorial.step];
  game.stage(step.scene);
  renderer.setGame(game);
  updateHud(true);
  coach(`${tutorial.step + 1} / ${TUTORIAL.length + 1} · ${step.title}`, step.coach);
  tutorial.busy = false;
}

function coach(head: string, text: string) {
  $('coach-step').textContent = head;
  $('coach-text').innerHTML = text;
  const box = $('coach');
  box.classList.remove('pop');
  void box.offsetWidth;
  box.classList.add('pop');
}

function tutorialEvents(events: GameEvent[]) {
  if (!tutorial) return;
  updateHud();
  if (game.phase === 'dead') {
    tutorial.busy = true;
    toast('Fallen! Try that again.');
    window.setTimeout(stageTutorial, 1100);
    return;
  }
  if (!TUTORIAL[tutorial.step].done(game, events)) return;
  if (game.phase === 'choose') {
    coach(`${TUTORIAL.length + 1} / ${TUTORIAL.length + 1} · Relics`, RELIC_COACH);
    window.clearTimeout(overlayTimer);
    overlayTimer = window.setTimeout(showChoice, 280);
    return;
  }
  tutorial.busy = true;
  tutorial.step++;
  renderer.banner('NICELY DONE!', '#7ee081');
  window.setTimeout(() => sfx.relic(), 150);
  window.setTimeout(stageTutorial, 1100);
}

function endTutorial() {
  tutorial = null;
  document.body.classList.remove('tutorial');
  $('coach').hidden = true;
  save.tutorialDone = true;
  writeSave(save);
  fitBoard();
}

function finishTutorial() {
  if (!tutorial) return;
  const { then, label } = tutorial;
  endTutorial();
  showOverlay('tutorial-done', `
    <img class="hero-portrait" src="${heroPortrait(game.hero, game.relics, game.relicLog, 8, outfitFor(game.hero).look, outfitFor(game.hero).head)}" alt="" width="96" height="96" />
    <h2>You're ready</h2>
    <p class="sub">That's all you need to know. Each floor gets meaner, so build well. Bosses wait on every 5th floor.</p>
    <button class="btn primary" id="go">${label}</button>
    <button class="link-btn" id="back">Back to the title</button>`);
  on('#go', then);
  on('#back', showTitle);
}

function skipTutorial() {
  if (!tutorial) return;
  const { then } = tutorial;
  endTutorial();
  then();
}
$('coach-skip').addEventListener('click', skipTutorial);

/** First run ever: offer the tutorial before the real thing. */
function withTutorialOffer(go: () => void, back?: () => void) {
  if (save.tutorialDone || save.totals.runs > 0) return go();
  showOverlay('tutorial-offer', `
    <h2>First time in the crypt?</h2>
    <p class="sub">Learn the basics in a minute: move, strike, dodge, descend.</p>
    <button class="btn primary" id="learn">Play the tutorial<small>About a minute</small></button>
    <button class="btn" id="skip">Skip, I know how to play</button>
    ${back ? '<button class="btn" id="back">Back</button>' : ''}`);
  if (back) on('#back', back);
  on('#learn', () => startTutorial(go));
  on('#skip', () => {
    save.tutorialDone = true;
    writeSave(save);
    go();
  });
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
  seconds?: number;
}

// Time played this run. Each input adds the time since the last one, capped, so a
// run left open in a background tab doesn't count as play.
const IDLE_CAP_MS = 30_000;
let runSeconds = 0;
let lastInputAt = 0;

function startClock(seconds = 0) {
  runSeconds = seconds;
  lastInputAt = performance.now();
}

function clockInput() {
  if (!game || tutorial) return;
  const now = performance.now();
  if (lastInputAt) runSeconds += Math.min(now - lastInputAt, IDLE_CAP_MS) / 1000;
  lastInputAt = now;
}

function savedSeconds(): number {
  try {
    const run = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as SavedRun | null;
    return Math.max(0, Number(run?.seconds) || 0);
  } catch {
    return 0;
  }
}

function saveRun() {
  // Story chapters are short, and start over rather than resume.
  if (!game || game.phase === 'dead' || game.mode === 'story') return;
  try {
    const run: SavedRun = { mode: game.mode, seed: game.seed, dailyNo: game.dailyNo, log: game.header() + game.log, seconds: Math.round(runSeconds) };
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
  startClock(savedSeconds());
  showGame(g);
  if (g.mode === 'daily' || g.mode === 'endless') noteRun(g.mode, 'start');
  setMusicDepth(g.floor, g.zone.def.key);
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
    seconds: Math.round(runSeconds),
  };
  clearRun();
  clearBeat();
  if (game.mode === 'daily' || game.mode === 'endless') noteRun(game.mode, 'end', game.floor, signedIn());
  // Record the daily first, so today counts toward the streak and its rewards.
  if (game.mode === 'daily') recordDaily(save, game.dailyNo, result);
  const streak = streakStats(save, dailyNumber());
  noteStreak(streak);
  lastReward = finishRunMeta(game, streak.current);
  const bounty = progressBounties(game, dailyNumber());
  lastReward.souls += bounty.souls;
  lastReward.lines.push(...bounty.lines);
  lastReward.unlocks.push(...bounty.notes);
  let best = false;
  if (game.mode === 'daily') {
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
  celebrateNotes(lastReward.unlocks);

  // Story chapters end in finishStory, so only daily and Endless runs get here.
  const mode = game.mode === 'daily' ? 'daily' : 'endless';
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
    seconds: result.seconds,
  });
  window.clearTimeout(overlayTimer);
  overlayTimer = window.setTimeout(() => {
    showDeath(result, best);
    void uploaded
      .then((ok) => (ok || (mode === 'daily' && !signedIn()) ? rankLine(mode, dailyNo, result.floor) : ''))
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
  if (!game || game.phase !== 'play' || !overlay.hidden || tutorial?.busy || fusionPlaying) return;
  clockInput();
  if (game.act(dx, dy)) processEvents();
  else {
    sfx.bump();
    const x = game.player.x + dx;
    const y = game.player.y + dy;
    if (dx || dy) if (!game.inBounds(x, y) || game.isWall(x, y)) waitHint();
  }
}

/** Walking into a wall doesn't pass the turn. The first few times, say how to wait. */
function waitHint() {
  let shown = 0;
  try {
    shown = Number(localStorage.getItem('omc:waitHint')) || 0;
    if (shown >= 3) return;
    localStorage.setItem('omc:waitHint', String(shown + 1));
  } catch {
    // Storage blocked: still show the hint.
  }
  toast(matchMedia('(pointer: coarse)').matches ? 'To wait a turn, tap WAIT or your hero' : 'To wait a turn, press Space');
}

function processEvents() {
  const events = game.events.splice(0);
  renderer.consume(events);
  playSounds(events);
  if (tutorial) return tutorialEvents(events);
  if (events.some((e) => e.t === 'floor')) {
    setMusicDepth(game.floor, game.zone.def.key);
    setMusicMood(game.isBossFloor() ? 'boss' : 'crypt');
    if (game.mode === 'story') storyFloor();
  }
  // Progress: codex entries, combos, fusions and achievements.
  for (const ev of events) {
    if (ev.t === 'fuse') {
      const def = RELIC_BY_ID[ev.id];
      renderer.banner(`${def.name.toUpperCase()}!`, def.rarity === 'ascended' ? '#fff2c0' : '#7fb4ff');
      fusedReveal = { id: ev.id, first: noteFusion(ev.id) };
    }
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
    if (game.mode === 'story') finishStory(false);
    else finishRun();
    return;
  } else if (game.phase === 'won') {
    finishStory(true);
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
  if (has('toll')) sfx.toll();
  if (has('timestop')) sfx.timestop();
  if (has('shot')) sfx.shot();
  if (has('hurt')) sfx.hurt();
  if (has('block') || has('dodge')) sfx.block();
  if (has('heal')) sfx.heal();
  if (has('stairs')) sfx.stairs();
  if (has('raise') || has('teleport')) sfx.zap();
  if (has('warn')) sfx.block();
  if (has('spike') || has('eblock') || has('lava')) sfx.hit();
  const crumble = events.find((e) => e.t === 'crumble');
  if (crumble) {
    sfx.crit();
    if (crumble.t === 'crumble' && crumble.open) sfx.relic();
  }
  if (has('vault')) sfx.relic();
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
    if (screen === 'hollow' && hollowKey(e)) return;
    if ((screen === 'choose' && game?.phase === 'choose' && game.offer) || (screen === 'event' && game?.phase === 'event')) choiceKey(e);
    else menuKey(e);
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

// ---------- menus from the keyboard ----------
// Arrows or WASD move between buttons, Enter or Space presses the highlighted one,
// Escape goes back, and R on the death screen starts a new run straight away.

const MENU_NAV: Record<string, number> = {
  ArrowUp: -1, ArrowLeft: -1, w: -1, W: -1, a: -1, A: -1,
  ArrowDown: 1, ArrowRight: 1, s: 1, S: 1, d: 1, D: 1,
};

function menuButtons(): HTMLElement[] {
  return [...overlay.querySelectorAll<HTMLElement>('button:not([disabled]), a.follow-x')].filter((el) => el.offsetParent !== null);
}

/** The button Enter presses before anything is highlighted. */
function defaultButton(list: HTMLElement[]): HTMLElement | undefined {
  const pick = screen === 'death' ? '#again' : screen === 'heroes' ? '.hero-card.selected' : screen === 'pause' ? '#resume' : '.btn.primary';
  return overlay.querySelector<HTMLElement>(pick) ?? list[0];
}

function menuKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
  const nav = MENU_NAV[e.key];
  const confirm = e.key === 'Enter' || e.key === ' ';
  if (nav || confirm) e.preventDefault();
  // Ignore keys still held from the run that just ended.
  if (e.repeat || performance.now() - overlayShownAt < 350) return;
  if (screen === 'death' && (e.key === 'r' || e.key === 'R')) return quickRestart();
  if (e.key === 'Escape') {
    if (screen === 'pause') hideOverlay();
    else overlay.querySelector<HTMLElement>('#back')?.click();
    return;
  }
  const list = menuButtons();
  if (!list.length || !(nav || confirm)) return;
  const at = list.indexOf(document.activeElement as HTMLElement);
  if (nav) {
    const from = at >= 0 ? at : Math.max(0, list.indexOf(defaultButton(list)!)) - nav;
    const next = list[(from + nav + list.length) % list.length];
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
    sfx.step();
  } else if (at >= 0) {
    list[at].click();
  } else if (screen === 'death') {
    quickRestart();
  } else {
    // Nothing highlighted yet: highlight the default first, so a stray Enter can't, say,
    // spend today's daily attempt.
    defaultButton(list)?.focus();
  }
}

/** R on the death screen: straight back into Endless with the same hero. */
function quickRestart() {
  startRun('endless');
}

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

$('wait-btn').addEventListener('click', () => act(0, 0));

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
/** The relics the bar was last drawn with, so a fusion (same count, new set) redraws it. */
let knownSet = '';
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
  if (reset || unique.join() !== knownSet) {
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
    knownSet = unique.join();
  } else {
    // counts may change without new relic types
    unique.forEach((id, i) => {
      const chip = $('relic-bar').children[i];
      const n = game.own(id);
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
  else if (game.vault) tip.innerHTML = 'A <b>secret vault</b> lies open. Step in to claim its treasure.';
  else if (game.secret) tip.innerHTML = 'That <b>cracked wall</b> sounds hollow. Bump it twice to break through.';
  else if ((game.config.depths || game.config.story?.look) && zoneTip(game)) tip.innerHTML = zoneTip(game);
  else if (game.spikes.some(Boolean) && game.turns < 4) tip.innerHTML = '<b>Spikes</b> hurt anything that walks on them. Lure foes across.';
  else if (game.hero === 'ranger' && game.floor <= 2 && game.turns < 8)
    tip.innerHTML = '<b>Longbow:</b> move toward a foe 2-3 tiles away in a straight line to shoot it.';
  else if (game.floor === 1 && game.turns < 6)
    tip.innerHTML = 'Move with arrows, WASD, swipe or tap. <b>Bump foes to strike.</b> They move when you do.';
  else if (game.floor <= 2 && game.turns < 14)
    tip.innerHTML = matchMedia('(pointer: coarse)').matches
      ? '<b>Tap WAIT</b> (or your hero) to pass a turn and let foes come to you.'
      : '<b>Press Space</b> to wait a turn and let foes come to you.';
  else if (game.relicLog.length && game.floor === 2 && game.turns < 40)
    tip.textContent = 'Tap a relic below to read it. Relics stack.';
  else tip.textContent = 'Slay every foe to unseal the stairs.';
}

/** The current zone's rule, on its first two floors (or while its ground is underfoot). */
function zoneTip(g: Game): string {
  const zone = g.zone;
  if (!zone.def.hint) return '';
  return g.floor - zone.start < 2 || g.turns % 40 < 6 ? zone.def.hint : '';
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
  // Once today's daily is done (and nothing is waiting to be continued), Endless is the next step.
  const endlessNext = Boolean(done) && !resumable;
  const endlessBtn = `<button class="btn ${endlessNext ? 'primary' : ''}" id="endless">Endless Descent<small>${
    endlessNext
      ? `${save.bestEndless ? `Your best: floor ${save.bestEndless}` : 'No limit. No daily reset. How deep can you go?'}<span class="endless-record"></span>`
      : save.bestEndless ? `Deepest: floor ${save.bestEndless}` : 'Choose your hero, random crypts'
  }</small></button>`;
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
    ${endlessNext ? endlessBtn : ''}
    ${bountiesHtml(today)}
    ${storyButtonHtml()}
    <button class="btn hollow-btn" id="hollow">🌙 Enter the Hollow<small>Walk the graveyard. Every door leads somewhere.</small></button>
    ${endlessNext ? '' : endlessBtn}
    <div class="row">
      <button class="btn" id="ossuary">🏛️ Ossuary<small>💀 ${meta.souls} Souls</small></button>
      <button class="btn" id="grimoire">📖 Grimoire<small>Relics, combos, achievements</small></button>
    </div>
    <button class="btn" id="hall">🏰 The Crypt Hall<small style="color:${rankFor(meta.earned).color}">${esc(rankFor(meta.earned).name)} · trophies, titles, wardrobe</small></button>
    ${ONLINE ? '<button class="btn" id="leaderboard">🏆 Leaderboards</button>' : ''}
    <button class="btn" id="help">How to play</button>
    ${installMode() ? '<button class="btn install-btn" id="install">📲 Install the app<small>Play from your home screen, full screen</small></button>' : ''}
    ${streak > 1 ? `<div class="streak">🕯️ ${streak}-day streak</div>` : ''}
    <div class="foot-links">${followXHtml}${kofiHtml}</div>
  `);
  on('#account', () => showProfile(showTitle));
  on('#leaderboard', () => showLeaderboard(showTitle));
  on('#daily', () => withTutorialOffer(() => startRun('daily')));
  on('#continue', () => resumable && resumeRun(resumable));
  on('#endless', () => withTutorialOffer(() => showHeroSelect(() => startRun('endless'), showTitle)));
  if (endlessNext) showEndlessRecord();
  on('#ossuary', () => showOssuary(showTitle));
  on('#grimoire', () => showGrimoire(showTitle));
  on('#hall', () => openHall(showTitle));
  on('#hollow', () => enterHollow());
  on('#story', () => (storyOpen() ? playStory() : toast('🔔 Act I: The Bell Beneath is coming soon.')));
  on('#help', () => showHelp(showTitle));
  on('#install', () => {
    if (installMode() === 'ios') return showInstallHelp(showTitle);
    void promptInstall().then((ok) => {
      if (ok) toast('Installed! Find One More Crypt on your home screen.');
      if (screen === 'title') showTitle();
    });
  });
  on('#share-today', () => done && share(done, `Daily #${today}`));
  tickCountdowns();
  // Finished on yesterday's podium? Celebrate once the result is in.
  if (signedIn()) {
    // Then a top 3 on last week's Endless board, then thanks for answered summons.
    void claimPodiums().then(async (won) => {
      if (won.length && screen === 'title') return showPodium(won, showTitle);
      const weekly = await claimWeekly();
      if (weekly.length && screen === 'title') return showWeekly(weekly, showTitle);
      await claimSummons();
    });
  }
}

const ORDINAL = ['', '1st', '2nd', '3rd'];

/** The reward screen for finishing in the top 3 of a Daily Descent. */
function showPodium(won: PodiumFinish[], back: () => void) {
  const best = [...won].sort((a, b) => a.place - b.place || b.dailyNo - a.dailyNo)[0];
  const prize = PODIUM.find((p) => p.place === best.place)!;
  const head = HEAD_BY_ID[prize.head];
  const souls = won.reduce((n, w) => n + (PODIUM.find((p) => p.place === w.place)?.souls ?? 0), 0);
  const others = won.filter((w) => w !== best);
  sfx.relic();
  showOverlay('podium', `
    <div class="podium-medal">${prize.medal}</div>
    <h2 class="podium-title">${esc(prize.name)}</h2>
    <p class="sub">Daily #${best.dailyNo} is over. You placed <b>${ORDINAL[best.place]}</b> of ${best.total}.</p>
    <img class="hero-portrait" src="${heroPortrait(meta.hero, {}, [], 8, outfitFor(meta.hero).look, prize.head)}" alt="Your hero wearing the ${esc(head.name)}" width="96" height="96" />
    <ul class="podium-rewards">
      <li>🎩 <b>${esc(head.name)}</b>: exclusive headwear for any hero, in the Wardrobe</li>
      ${best.place === 1 ? '<li>📜 <b>Crypt Champion</b>: a new title for your name</li><li>👑 A crown by your name on the boards today</li>' : ''}
      <li>💀 <b>+${souls} Souls</b></li>
      ${others.map((w) => `<li>${PODIUM.find((p) => p.place === w.place)!.medal} Also ${ORDINAL[w.place]} in Daily #${w.dailyNo}</li>`).join('')}
    </ul>
    <button class="btn primary" id="wear">Wear it now</button>
    <button class="btn x" id="share-podium">Share on 𝕏</button>
    <button class="btn" id="back">Continue</button>`);
  on('#wear', () => {
    equipOutfit(meta.hero, 'head', prize.head);
    toast(`Your ${HERO_BY_ID[meta.hero].name} wears the ${head.name}`);
    back();
  });
  on('#share-podium', () =>
    window.open(xIntentUrl(`${prize.medal} I placed ${ORDINAL[best.place]} of ${best.total} in One More Crypt Daily #${best.dailyNo}.\nOne crypt. One try a day. Can you take the crown?\n${siteUrl()}`), '_blank', 'noopener'),
  );
  on('#back', back);
}

/** The reward screen for a top 3 finish on a week's Endless board. */
function showWeekly(won: WeeklyFinish[], back: () => void) {
  const best = [...won].sort((a, b) => a.place - b.place)[0];
  const prize = WEEKLY.find((p) => p.place === best.place)!;
  const head = prize.head ? HEAD_BY_ID[prize.head] : null;
  const souls = won.reduce((n, w) => n + (WEEKLY.find((p) => p.place === w.place)?.souls ?? 0), 0);
  const when = new Date(`${best.week}T12:00:00Z`).toLocaleDateString([], { month: 'long', day: 'numeric', timeZone: 'UTC' });
  sfx.relic();
  showOverlay('podium', `
    <div class="podium-medal">${prize.medal}</div>
    <h2 class="podium-title">${esc(prize.name)}</h2>
    <p class="sub">The Endless week of ${esc(when)} is over. You placed <b>${ORDINAL[best.place]}</b> of ${best.total}.</p>
    ${head ? `<img class="hero-portrait" src="${heroPortrait(meta.hero, {}, [], 8, outfitFor(meta.hero).look, prize.head)}" alt="Your hero wearing the ${esc(head.name)}" width="96" height="96" />` : ''}
    <ul class="podium-rewards">
      ${head ? `<li>🎩 <b>${esc(head.name)}</b>: exclusive headwear for any hero, in the Wardrobe</li>` : ''}
      <li>💀 <b>+${souls} Souls</b></li>
      <li>♾️ A new week has begun. Defend your place.</li>
    </ul>
    ${head ? '<button class="btn primary" id="wear">Wear it now</button>' : ''}
    <button class="btn x" id="share-weekly">Share on 𝕏</button>
    <button class="btn ${head ? '' : 'primary'}" id="back">Continue</button>`);
  on('#wear', () => {
    if (!head) return;
    equipOutfit(meta.hero, 'head', prize.head);
    toast(`Your ${HERO_BY_ID[meta.hero].name} wears the ${head.name}`);
    back();
  });
  on('#share-weekly', () =>
    window.open(xIntentUrl(`${prize.medal} I placed ${ORDINAL[best.place]} of ${best.total} on the One More Crypt Endless board this week.\nHow deep can you go?\n${siteUrl()}`), '_blank', 'noopener'),
  );
  on('#back', back);
}

/** Safari can't prompt, so show how to add the game to the home screen by hand. */
function showInstallHelp(back: () => void) {
  showOverlay('install', `
    <h2>Install the app</h2>
    <p class="sub">Play One More Crypt from your home screen, full screen, like any other app.</p>
    <ol class="install-steps">
      <li>Tap the <b>Share</b> button <span aria-hidden="true">⬆️</span> in Safari's toolbar.</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
      <li>Tap <b>Add</b>. The crypt is now on your home screen.</li>
    </ol>
    <button class="btn primary" id="back">Got it</button>`);
  on('#back', back);
}

function accountChip(): string {
  if (ONLINE && !session.ready) return '<div class="account-row"></div>';
  const name = playerName();
  const title = titleName(meta.title);
  return `<div class="account-row"><button class="account-chip" id="account">👤 ${name ? esc(name) : 'Sign in'}${name && title ? ` <small>${esc(title)}</small>` : ''}</button></div>`;
}

// ---------- the Hollow ----------

function enterHollow() {
  setMusicDepth(0);
  setMusicMood('crypt');
  showHollow({
    enter: enterPlace,
    describe: describePlace,
    visit: (name) => showPublicHall(name, enterHollow),
    epitaph: (id) => {
      sfx.relic();
      const got = readEpitaph(id, Object.keys(EPITAPHS).length);
      if (got) celebrate([got]);
    },
    menu: showTitle,
    ghosts: async () => {
      if (!ONLINE) return [];
      const board = await dailyBoard(dailyNumber(), null, 5);
      return board.rows.map((r) => r.name).filter((n) => n !== playerName());
    },
    storyOpen,
    npcPresent: (id) => npcPresent(id, storyState()),
    npcMarker: (id) => npcMarker(id, storyState()),
    talk: talkTo,
    dungeon: dungeonDoor,
    enterDungeon: (n) => QUEST_BY_N[n] && beginDungeon(QUEST_BY_N[n]),
    gate: (n) => ['active', 'cleared', 'done'].includes(questStatus(QUEST_BY_N[n], storyState())),
    lore: (id) => LORE[id] ?? null,
    readLore: (id) => {
      if (readLore(id)) sfx.relic();
    },
    loreRead: (id) => meta.story.journal.includes(id),
    pet: () => storyOpen() && meta.pet === 'hound' && houndJoined(),
    quests: () => showQuests(),
  });
}

function describePlace(place: HollowPlace): string {
  const today = dailyNumber();
  const resumable = savedRun();
  switch (place) {
    case 'daily':
      if (resumable?.mode === 'daily') return `Your Daily #${today} run waits on floor ${resumable.floor}. Continue it?`;
      if (save.daily[today]) return `You've faced Daily #${today}: floor ${save.daily[today].floor}. The next crypt opens in ${formatCountdown(msUntilNextDaily())}.`;
      return `Daily #${today}. Today's hero: the ${HERO_BY_ID[dailyHero(today)].name}. One attempt, the same crypt for everyone.`;
    case 'endless':
      return resumable?.mode === 'endless'
        ? `Your Endless run waits on floor ${resumable.floor}. Continue it?`
        : 'Choose a hero and descend as deep as you can.';
    case 'forge':
      return 'Read the fusions you have discovered, and the ones still hidden.';
    case 'ossuary':
      return `Trade Souls for heroes and forbidden relics. You have ${meta.souls}.`;
    case 'hall':
      return 'Your trophies, statues, titles and looks.';
    case 'grimoire':
      return 'Relics, combos, fusions and achievements.';
    case 'wardrobe':
      return 'Dress your heroes in cloaks and headwear. Outfits show in runs and on the leaderboards.';
    case 'ranks':
      return 'Names carved in stone: the daily and endless leaderboards.';
  }
}

function enterPlace(place: HollowPlace) {
  sfx.stairs();
  const today = dailyNumber();
  const resumable = savedRun();
  if (place === 'daily') {
    if (resumable?.mode === 'daily') return resumeRun(resumable);
    if (save.daily[today]) {
      toast(`You've faced Daily #${today}. The next crypt opens in ${formatCountdown(msUntilNextDaily())}.`);
      return enterHollow();
    }
    return withTutorialOffer(() => startRun('daily'), enterHollow);
  }
  if (place === 'endless') {
    if (resumable?.mode === 'endless') return resumeRun(resumable);
    return withTutorialOffer(() => showHeroSelect(() => startRun('endless'), enterHollow), enterHollow);
  }
  if (place === 'forge') return showGrimoire(enterHollow, 'fusions');
  if (place === 'ossuary') return showOssuary(enterHollow);
  if (place === 'hall') return openHall(enterHollow);
  if (place === 'grimoire') return showGrimoire(enterHollow);
  if (place === 'wardrobe') return showWardrobe(enterHollow, meta.hero);
  if (ONLINE) return showLeaderboard(enterHollow);
  toast('The obelisk is silent. Leaderboards need an online connection.');
  enterHollow();
}

function openHall(back: () => void) {
  showHall(playerName(), back, 'trophies', () => {
    if (game) renderer.outfit = outfitFor(game.hero);
  });
}

function showHelp(back: () => void) {
  const fromTitle = back === showTitle;
  showOverlay('help', `
    <h2>How to play</h2>
    ${fromTitle ? '<button class="btn primary" id="tutorial">▶ Play the tutorial<small>Learn by doing, about a minute</small></button>' : ''}
    ${howToHtml()}
    <ul class="help">
      <li>Shrines, chests and fountains offer <b>deals</b>. Step on them to choose.</li>
      <li>After each boss, a <b>Soul Forge</b> waits on the next floor. Fuse two of your relics into a stronger one.</li>
      <li>Every 20 floors the crypt becomes somewhere new: the <b>Flooded Catacombs</b>, the <b>Charnel Halls</b>, the <b>Burning Depths</b> and the <b>Abyss</b>, each with its own ground and foes.</li>
      <li>Some walls are <b>cracked</b>. Bump one twice to find a secret vault.</li>
      <li><b>Spikes</b> hurt anything that steps on them, foes included.</li>
      <li>Every run earns <b>Souls</b>. Spend them in the <b>Ossuary</b> on new heroes and relics.</li>
      <li>The <b>Daily Descent</b> is the same crypt and hero for everyone, once a day. Share your depth.</li>
      <li>One More Crypt is free, with no ads. If you'd like to help keep it running, you can <a href="${KOFI_URL}" target="_blank" rel="noopener">leave a tip on Ko-fi</a> ☕</li>
    </ul>
    <div class="foes card">
      <div><b>Knight</b>10 HP. Heals 1 on every new floor.</div>
      <div><b>Rogue</b>7 HP. Every 3rd step is free. 15% dodge.</div>
      <div><b>Necromancer</b>8 HP. Slain foes may rise as thralls.</div>
      <div><b>Paladin</b>9 HP. +1 damage to the undead. Slaying a boss heals fully.</div>
      <div><b>Ranger</b>7 HP. Shoots foes 2-3 tiles away in a straight line.</div>
      <div><b>Mage</b>5 HP. +2 attack. A glass cannon.</div>
      <div><b>Barbarian</b>11 HP. +1 attack for every 3 HP missing.</div>
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
  on('#tutorial', () => startTutorial(showTitle, 'Back to the title'));
  startHowTo(overlay);
}

function showChoice() {
  if (game.phase !== 'choose' || !game.offer) return;
  sfx.relic();
  const offer = game.offer;
  const low = game.player.hp * 10 <= game.player.maxHp * 4;
  const cards = offer.relics
    .map((r, i) => {
      const have = game.own(r.id);
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
    <p class="choice-hp ${low ? 'low' : ''}">❤ ${game.player.hp}/${game.player.maxHp} HP${low ? ' · Low on health. Resting may be the smart pick.' : ''}</p>
    ${tutorial ? `<div class="coach-inline"><span>5 / 5 · Relics</span>${RELIC_COACH}</div>` : ''}
    <div class="offer">${cards}</div>
    <button class="btn ${low ? 'rest-urge' : ''}" id="rest">🔥 Rest instead<small>Heal ${offer.restHeal} HP (${game.player.hp}/${game.player.maxHp})</small></button>
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

function showForge() {
  const options = game.forgeOptions();
  const deep = game.floor >= ASCEND_FLOOR;
  const cards = options
    .map((f, i) => {
      const out = RELIC_BY_ID[f.id];
      const known = Boolean(meta.fusions[f.id]);
      const [a, b] = f.from.map((id) => RELIC_BY_ID[id]);
      const ascend = f.tier === 2;
      return `<button class="${ascend ? 'ascended' : 'fused'}" data-i="${i}">
        <span class="emoji">${known ? out.emoji : ascend ? '✨' : '❔'}</span>
        <span><span class="name">${known ? out.name : ascend ? 'Unknown ascension' : 'Unknown fusion'}</span><span class="tag">${a.emoji} ${esc(a.name)} + ${b.emoji} ${esc(b.name)}</span>
        <span class="desc">${known ? out.desc(1) : 'Fuse them to discover what they become.'}</span></span>
      </button>`;
    })
    .join('');
  showOverlay('event', `
    <h2>Soul Forge</h2>
    <p class="sub">${FEATURES.forge.text}</p>
    ${deep ? '<p class="fine ascend-note">✨ This deep, the forge burns white-hot: two fused relics can <b>ascend</b> into one.</p>' : ''}
    ${options.length ? '<p class="fine">Fusing uses up one of each relic. You can fuse once here.</p>' : '<p class="fine">None of your relics answer the forge. Fusions need two particular relics held together, like 🔥 Ember Brand and ⚡ Storm Rune.</p>'}
    <div class="offer event-offer">
      ${cards}
      <button class="rare" id="leave"><span class="emoji">🚶</span><span><span class="name">${FEATURES.forge.leave}</span></span></button>
    </div>`);
  overlay.querySelectorAll<HTMLButtonElement>('.offer button[data-i]').forEach((b) => b.addEventListener('click', () => forgePick(Number(b.dataset.i))));
  on('#leave', () => resolveEvent(false));
  (document.activeElement as HTMLElement | null)?.blur();
  choiceShownAt = performance.now();
  selectChoice(0);
}

function forgePick(i: number) {
  if (game.phase !== 'event') return;
  clockInput();
  game.forge(i);
  hideOverlay();
  fusedReveal = null;
  processEvents();
  // (Set by processEvents; TypeScript can't see that through the call.)
  const reveal = fusedReveal as { id: FusedId; first: boolean } | null;
  if (reveal) showFused(reveal.id, reveal.first);
}

/** True while the full-screen fusion plays; the hero can't move under it. */
let fusionPlaying = false;

/** Set while processing a fusion, so the reveal can follow. */
let fusedReveal: { id: FusedId; first: boolean } | null = null;

/** What the forge just made: its effect, what it was made from and what it counts as. */
function showFused(id: FusedId, first: boolean) {
  const def = RELIC_BY_ID[id];
  const f = FUSION_BY_ID[id];
  const [a, b] = f.from.map((r) => RELIC_BY_ID[r]);
  const grants = Object.entries(f.grants)
    .map(([gid, n]) => `${RELIC_BY_ID[gid as RelicId].emoji} ${esc(RELIC_BY_ID[gid as RelicId].name)}${(n ?? 0) > 1 ? ` ×${n}` : ''}`)
    .join(' · ');
  const ascended = def.rarity === 'ascended';
  // Hide the forge screen while the fusion plays over the whole page, then reveal the details.
  hideOverlay();
  fusionSound(ascended, IMPACT);
  fusionPlaying = true;
  playFusion({
    a: a.emoji, b: b.emoji, out: def.emoji, name: def.name, ascended,
    onDone: () => {
      fusionPlaying = false;
      fusedCard(id, first, grants);
    },
  });
}

function fusedCard(id: FusedId, first: boolean, grants: string) {
  const def = RELIC_BY_ID[id];
  const [a, b] = FUSION_BY_ID[id].from.map((r) => RELIC_BY_ID[r]);
  const ascended = def.rarity === 'ascended';
  showOverlay('fused', `
    <div class="fused-reveal ${ascended ? 'ascended' : ''}">
      <div class="fused-emoji">${def.emoji}</div>
      <p class="fused-kind">${first ? '✨ New discovery · ' : ''}${ascended ? 'Ascended relic' : 'Fused relic'}</p>
      <h2>${esc(def.name)}</h2>
      <p class="fused-desc">${esc(def.desc(1))}</p>
      <p class="fine">Forged from ${a.emoji} ${esc(a.name)} + ${b.emoji} ${esc(b.name)}</p>
      <p class="fine fused-grants">Counts as: ${grants}</p>
      <button class="btn primary" id="fused-ok">Continue</button>
    </div>`);
  on('#fused-ok', () => {
    hideOverlay();
    updateHud();
  });
  overlay.querySelector<HTMLElement>('#fused-ok')?.focus();
}

function showEvent() {
  if (game.phase !== 'event' || !game.feature) return;
  if (game.feature.kind === 'forge') return showForge();
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
  clockInput();
  game.resolveEvent(accept);
  hideOverlay();
  processEvents();
}

function pickRelic(i: number) {
  if (game.phase !== 'choose') return;
  clockInput();
  game.choose(i);
  hideOverlay();
  sfx.stairs();
  if (tutorial) return finishTutorial();
  processEvents();
}

function showPause() {
  if (!game || game.phase !== 'play' || !overlay.hidden || tutorial || fusionPlaying) return;
  const daily = game.mode === 'daily';
  const story = game.mode === 'story' && storyRun;
  showOverlay('pause', `
    <h2>Paused</h2>
    <p class="sub">${daily ? `Daily #${game.dailyNo}` : story ? esc(story.quest.dungeon.name) : 'Endless'} · Floor ${game.floor}</p>
    ${onlineCountHtml()}
    <button class="btn primary" id="resume">Resume</button>
    <button class="btn" id="help">How to play</button>
    <button class="btn" id="music">🎵 Music: ${isMusicEnabled() ? 'On' : 'Off'}</button>
    <button class="btn" id="abandon">Abandon run<small>${daily ? "Counts as today's attempt" : story ? 'Back to Gravesend' : 'Back to the title'}</small></button>
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
    } else if (story) {
      storyRun = null;
      hideOverlay();
      newGame('endless');
      enterHollow();
    } else {
      noteRun('endless', 'quit', game.floor);
      hideOverlay();
      newGame('endless');
      showTitle();
    }
  });
}

function showDeath(r: RunResult, best: boolean) {
  const daily = game.mode === 'daily';
  setMusicDepth(0);
  setMusicMood('fallen');
  showOverlay('death', `
    <img class="hero-portrait" src="${heroPortrait(game.hero, game.relics, game.relicLog, 8, outfitFor(game.hero).look, outfitFor(game.hero).head)}" alt="Your hero's final form" width="96" height="96" />
    <h2 class="dead">You have fallen</h2>
    <p class="sub">${lastLabel} · slain by ${r.killedBy}</p>
    <div class="strip">${descentStrip(r.floor)}</div>
    <div class="big-stats">
      <div><b>${r.floor}</b>FLOOR</div>
      <div><b>${r.kills}</b>KILLS</div>
      <div><b>${r.turns}</b>TURNS</div>
      ${r.seconds ? `<div><b>${playTime(r.seconds)}</b>TIME</div>` : ''}
    </div>
    ${r.relics ? `<div class="strip" style="font-size:18px">${r.relics}</div>` : ''}
    ${r.combos ? `<p class="combo-line">${esc(r.combos)}</p>` : ''}
    ${best ? '<p class="streak">New deepest descent!</p>' : ''}
    ${
      lastReward
        ? `<div class="souls-earned"><b>+${lastReward.souls} Souls</b><span>${lastReward.lines.map(([k, v]) => `${esc(k)} +${v}`).join(' · ')}</span><span>💀 ${meta.souls} to spend in the Ossuary</span></div>`
        : ''
    }
    ${soulRankHtml()}
    ${ONLINE ? `<p class="rank-line ${daily ? 'daily-rank' : ''}" id="rank">${signedIn() ? 'Carving your name into the crypt…' : daily ? 'Counting the fallen…' : ''}</p>` : ''}
    ${ONLINE && !signedIn() ? '<button class="btn" id="join">Claim a name for the leaderboard</button>' : ''}
    ${
      daily
        ? `${streakTeaseHtml()}${tomorrowHtml()}${reminderPromptHtml()}${ONLINE ? '<p class="podium-tease">🥇 Finish in the top 3 when the day ends to win exclusive headwear and Souls.</p>' : ''}
    <p class="endless-tease">${
            save.bestEndless
              ? `Daily done. Endless is open: beat your best of <b>floor ${save.bestEndless}</b>.`
              : 'Daily done. Endless has no limit and no daily reset.'
          }<span class="endless-record"></span></p>
    <button class="btn primary" id="again">Endless Descent<small>The crypt never ends. Keep descending.<span class="keys-hint"> · Enter or R</span></small></button>
    <button class="btn x" id="share">Share on 𝕏</button>
    <div class="row">
      <button class="btn" id="copy">Copy result</button>
    </div>`
        : `<button class="btn x" id="share">Share on 𝕏</button>
    <div class="row">
      <button class="btn" id="copy">Copy result</button>
      <button class="btn" id="again">Descend again<small class="keys-hint">Enter or R</small></button>
    </div>`
    }
    <div class="row grid2">
      ${ONLINE ? '<button class="btn" id="leaderboard">🏆 Leaderboard</button>' : ''}
      <button class="btn" id="hall">🏰 Hall</button>
      <button class="btn" id="ossuary">🏛️ Ossuary</button>
      <button class="btn" id="title">Title</button>
    </div>
    ${onlineCountHtml()}
    ${tipNoteHtml()}
    ${followXHtml}
  `);
  const backHere = () => showDeath(r, best);
  on('#leaderboard', () => showLeaderboard(backHere, daily ? 'today' : 'endless'));
  on('#join', () =>
    showLogin(() => {
      backHere();
      // Joining uploads the queued run; show where it landed.
      if (signedIn()) {
        setRank('Carving your name into the crypt…');
        void syncNow()
          .then(() => rankLine(daily ? 'daily' : 'endless', game.dailyNo, r.floor))
          .then(setRank)
          .catch(() => setRank(''));
      }
    }),
  );
  const beat = () => (daily ? lastBeat : null);
  on('#share', () => share(r, lastLabel, beat()));
  on('#copy', async () => toast((await copyText(shareText(r, lastLabel, beat()) + '\n' + siteUrl())) ? 'Copied!' : 'Copy failed'));
  on('#again', () => showHeroSelect(() => startRun('endless'), backHere));
  if (daily) showEndlessRecord();
  on('#ossuary', () => showOssuary(backHere));
  on('#hall', () => openHall(backHere));
  on('#title', () => {
    newGame('endless');
    showTitle();
  });
  on('#remind', async () => {
    const btn = $('#remind') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await enableReminders();
      btn.outerHTML = '<p class="fine reminder-on">🔔 Reminders on: 8 AM when a new crypt opens, 7 PM if you haven\'t played, and when a rival passes you. Change them in your profile.</p>';
    } catch (e) {
      btn.disabled = false;
      toast((e as Error).message);
    }
  });
  on('#remind-install', () => showInstallHelp(backHere));
  tickCountdowns();
}

/** Now and then after a run (the 5th, then every 10th), a quiet thank-you with the tip jar. Never for patrons. */
function tipNoteHtml(): string {
  const runs = runsPlayed();
  if (meta.patron || runs < 5 || runs % 10 !== 5) return '';
  return `<p class="fine tip-note">Thanks for playing. One More Crypt is free with no ads; if you're enjoying it, a <a href="${KOFI_URL}" target="_blank" rel="noopener">☕ tip on Ko-fi</a> keeps the crypt open.</p>`;
}

/** After the daily: a look at tomorrow's crypt, to come back for. */
function tomorrowHtml(): string {
  const next = dailyNumber() + 1;
  const hero = dailyHero(next);
  const o = outfitFor(hero);
  return `<div class="tomorrow">
      <img src="${heroPortrait(hero, {}, [], 4, o.look, o.head)}" alt="" width="48" height="48" />
      <div><b>Tomorrow: Daily #${next}</b><span>The ${esc(HERO_BY_ID[hero].name)} descends. A new crypt for everyone.</span><span>Opens in <span class="countdown">--:--:--</span></span></div>
    </div>`;
}

/** After the daily: the streak, and how far off the next streak helm is. */
function streakTeaseHtml(): string {
  const { current } = streakStats(save, dailyNumber());
  const next = STREAK_HELMS.find(([n]) => n > meta.streak.best);
  const days = current === 1 ? 'Day 1 of your streak.' : `🕯️ ${current}-day streak.`;
  if (!next) return `<p class="streak">${days} Every streak helm is yours.</p>`;
  const [n, , name] = next;
  const left = n - current;
  return `<p class="streak">${days} ${left} more day${left === 1 ? '' : 's'} in a row for the <b>${esc(name)}</b>.</p>`;
}

/** After the daily: offer a reminder for tomorrow's crypt (signed-in players only). */
function reminderPromptHtml(): string {
  if (!signedIn() || reminderPrefs()) return '';
  if (remindersAvailable()) return '<button class="btn" id="remind">🔔 Remind me when tomorrow\'s crypt opens</button>';
  if (remindersNeedInstall()) return '<button class="link-btn" id="remind-install">📲 Install the app to get a reminder when the next crypt opens</button>';
  return '';
}

/** Fill in the endless record wherever a screen invites the player to try Endless. */
function showEndlessRecord() {
  void endlessRecord().then((rec) => {
    if (!rec) return;
    const text = rec.floor > save.bestEndless ? ` The record is floor ${rec.floor} (${rec.name}).` : '';
    overlay.querySelectorAll('.endless-tease .endless-record').forEach((el) => (el.textContent = text));
    overlay.querySelectorAll('#endless .endless-record').forEach((el) => (el.textContent = ` · Record: floor ${rec.floor}`));
  });
}

function share(r: RunResult, label: string, beat: number | null = null) {
  window.open(xIntentUrl(shareText(r, label, beat)), '_blank', 'noopener');
}

function tickCountdowns() {
  const text = formatCountdown(msUntilNextDaily());
  overlay.querySelectorAll('.countdown').forEach((el) => (el.textContent = text));
}
setInterval(tickCountdowns, 1000);

// ---------- story mode ----------
// Act I is played out in the world: walk Gravesend, talk to people in their homes, take
// their quests, and descend into the dungeons under it. Story runs are never saved
// mid-run or uploaded, and nothing in them touches the daily or the leaderboards.

interface StoryRun {
  quest: Quest;
  /** The floor the dungeon started on, for counting floors cleared with the hound. */
  start: number;
  hound: boolean;
}
let storyRun: StoryRun | null = null;

function houndJoined(): boolean {
  return meta.story.done.includes(2);
}

/** Fill in names in story text. Story text is ours, so only the substitutions need escaping. */
function storyText(text: string): string {
  return esc(text)
    .replace(/\{pet\}/g, esc(petName(meta.story.choices.hound)))
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Story mode is still being tested: it shows as coming soon to everyone but its tester (JSTN).
const STORY_TESTERS = ['ad5d6ad6-bd7b-4952-a0cb-9917d15909fd'];

function storyOpen(): boolean {
  // Local development only (never in a real build): a switch for testing the story.
  if (import.meta.env.DEV && localStorage.getItem('omc:story-test')) return true;
  return Boolean(session.account && STORY_TESTERS.includes(session.account.id));
}

function storyButtonHtml(): string {
  if (!storyOpen()) {
    return `<button class="btn story-btn soon" id="story">📖 Story: The Bell Beneath<small>Coming soon · Who rings the bell beneath the crypt?</small></button>`;
  }
  const main = MAIN_QUESTS.filter((q) => meta.story.done.includes(q.n)).length;
  const next = MAIN_QUESTS.find((q) => !meta.story.done.includes(q.n));
  return `<button class="btn story-btn" id="story">📖 Story: The Bell Beneath<small>${
    !next ? 'Act I complete · Act II is coming' : main ? `${main}/${MAIN_QUESTS.length} · ${esc(next.title)}` : "Act I · Knock on Mortimer's door in the Hollow"
  }</small></button>`;
}

/** Into the world for the story: straight to Mortimer's door the first time. */
function playStory() {
  if (!meta.story.active.length && !meta.story.done.length) placeAtCottage();
  enterHollow();
}

function storyState(): StoryState {
  return meta.story;
}

/** Talking to someone in the world: hand in, take on, be reminded, or just chat. */
function talkTo(npc: NpcId) {
  const c = conversation(npc, storyState());
  talk(c.lines, () => {
    if (c.accept) {
      acceptQuest(c.accept);
      sfx.relic();
      toast(`📜 New quest: ${QUEST_BY_N[c.accept].title}`);
    }
    if (c.turnIn) return finishQuest(QUEST_BY_N[c.turnIn], enterHollow);
    enterHollow();
  });
}

/** A quest is over: pay out, and say what was unlocked. */
function finishQuest(q: Quest, then: () => void) {
  const result = completeQuest(q.n, q.souls);
  if (result.feat) celebrate([result.feat]);
  if (!result.first) return then();
  const unlocked =
    q.n === 2 ? `🐕 ${esc(petName(meta.story.choices.hound))} the Crypt Hound joins you. It trots behind you everywhere (it only fights in the story).`
    : q.n === 3 ? "🎨 Aldric's Mantle: a new cloak in the Wardrobe."
    : q.n === 4 ? "🎩 The Warden's Keys: new headwear. 📜 New title: Bell-Seeker."
    : q.n === 11 ? "🎨 The Widow's Shawl: a new cloak in the Wardrobe."
    : q.n === 12 ? "🎩 Smith's Goggles: new headwear."
    : q.n === 13 ? '📜 New title: Tavern Regular.'
    : '';
  sfx.relic();
  showOverlay('story-won', `
    <div class="podium-medal">${q.side ? '📜' : '🔔'}</div>
    <h2 class="podium-title">${esc(q.title)}</h2>
    <p class="sub">${q.side ? 'Side quest complete' : 'Quest complete'}</p>
    <div class="souls-earned"><b>+${result.souls} Souls</b><span>💀 ${meta.souls} to spend in the Ossuary</span></div>
    ${unlocked ? `<p class="talk-quip">${unlocked}</p>` : ''}
    ${q.n === 4 ? '<p class="talk-quip">Act II: The Plague Abbot is coming. The bell is waiting.</p>' : ''}
    <button class="btn primary" id="back">Continue</button>`);
  on('#back', then);
}

/** A dungeon's door in the world: open once its quest is taken, barred until then. */
function dungeonDoor(n: number): { open: boolean; title: string; text: string } {
  const q = QUEST_BY_N[n];
  if (!q) return { open: false, title: 'Sealed', text: 'Nothing but stone.' };
  const status = questStatus(q, storyState());
  if (status === 'locked' || status === 'available') return { open: false, title: q.dungeon.name, text: q.barred };
  const [a, b] = q.dungeon.floors;
  const done = status === 'done' || status === 'cleared';
  return {
    open: true,
    title: q.dungeon.name,
    text: `${done ? 'You have been down here before. The way is still open, if you want the Souls.' : `Quest: ${q.title}.`} Floors ${a}-${b}${q.dungeon.boss ? ', and something waiting at the bottom' : ''}.`,
  };
}

/** Pick a hero, maybe summon a ghost, then descend. */
function beginDungeon(q: Quest) {
  showHeroSelect(
    () => (q.dungeon.summon && ONLINE ? showSummon(q, enterHollow) : startStory(q, null)),
    enterHollow,
    `${esc(q.dungeon.name)} · any hero you own`,
  );
}

/** The quest log: what you're on, where to go, and the journal of things you've found. */
function showQuests(back: () => void = enterHollow) {
  const s = storyState();
  const row = (q: Quest) => {
    const st = questStatus(q, s);
    const where = st === 'cleared' && q.turnIn ? `Report back to ${SPEAKERS[q.giver]}.` : st === 'done' ? `Done · ${q.reward}` : q.hint;
    return `<div class="quest ${st}"><b>${st === 'done' ? '✅' : st === 'cleared' ? '❔' : '📜'} ${esc(q.title)}</b><span>${esc(where)}</span></div>`;
  };
  const current = QUESTS.filter((q) => ['active', 'cleared'].includes(questStatus(q, s)));
  const open = QUESTS.filter((q) => questStatus(q, s) === 'available');
  const done = QUESTS.filter((q) => questStatus(q, s) === 'done');
  const lore = meta.story.journal.filter((id) => LORE[id]);
  showOverlay('quests', `
    <h2>${esc(ACT_TITLE)}</h2>
    <p class="sub">Main story ${MAIN_QUESTS.filter((q) => s.done.includes(q.n)).length}/${MAIN_QUESTS.length} · side quests ${QUESTS.filter((q) => q.side && s.done.includes(q.n)).length}/${QUESTS.filter((q) => q.side).length}</p>
    ${houndJoined() ? `<p class="fine">🐕 ${esc(petName(meta.story.choices.hound))} fights beside you in the story · bond ${meta.story.bond}</p>` : ''}
    <h3 class="shop-head">On the go</h3>
    <div class="quests">${current.length ? current.map(row).join('') : '<p class="fine">Nothing yet. Look for a ! over someone\'s head.</p>'}</div>
    ${open.length ? `<h3 class="shop-head">Someone needs help</h3><div class="quests">${open.map((q) => `<div class="quest available"><b>❗ ${esc(q.title)}</b><span>Talk to ${esc(SPEAKERS[q.giver])}.</span></div>`).join('')}</div>` : ''}
    ${done.length ? `<h3 class="shop-head">Done</h3><div class="quests">${done.map(row).join('')}</div>` : ''}
    <h3 class="shop-head">Journal <small>${lore.length}/${LORE_COUNT}</small></h3>
    <div class="quests">${lore.length ? lore.map((id) => `<div class="quest lore"><b>${esc(LORE[id].title)}</b><span>${esc(LORE[id].text)}</span></div>`).join('') : '<p class="fine">Look closer at things that glow in people\'s homes.</p>'}</div>
    <button class="btn primary" id="back">Back</button>`);
  on('#back', back);
}

function talk(lines: Line[], done: () => void, heading = '') {
  let i = 0;
  const next = () => {
    const line = lines[i++];
    if (!line) return done();
    if ('key' in line) {
      const picked = meta.story.choices[line.key];
      // Replays skip a choice already made, but still play out its result.
      const chosen = picked ? line.options.find((o) => o.value === picked) : undefined;
      if (chosen) {
        lines = [...lines.slice(0, i), ...chosen.then, ...lines.slice(i)];
        return next();
      }
      showOverlay('talk', `
        ${heading ? `<p class="talk-head">${esc(heading)}</p>` : ''}
        <p class="talk-prompt">${storyText(line.prompt)}</p>
        ${line.options.map((o, k) => `<button class="btn ${k === 0 ? 'primary' : ''}" data-opt="${k}">${esc(o.label)}</button>`).join('')}`);
      overlay.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) =>
        b.addEventListener('click', () => {
          const o = line.options[Number(b.dataset.opt)];
          chooseStory(line.key, o.value);
          lines = [...lines.slice(0, i), ...o.then, ...lines.slice(i)];
          sfx.relic();
          next();
        }),
      );
      return;
    }
    const face =
      line.who === 'hero'
        ? heroPortrait(meta.hero, {}, [], 6, outfitFor(meta.hero).look, outfitFor(meta.hero).head)
        : facePortrait(line.who);
    const name = line.who === 'hero' ? HERO_BY_ID[meta.hero].name : storyText(SPEAKERS[line.who]);
    showOverlay('talk', `
      ${heading ? `<p class="talk-head">${esc(heading)}</p>` : ''}
      <div class="talk ${line.who === 'narrator' ? 'narrator' : ''}">
        ${face ? `<img src="${face}" alt="" width="72" height="72" />` : ''}
        <div>
          ${name ? `<b>${name}</b>` : ''}
          <p>${storyText(line.text)}</p>
        </div>
      </div>
      <button class="btn primary" id="next">${i < lines.length ? 'Next ▸' : 'Continue ▸'}</button>
      <button class="link-btn" id="skip">Skip</button>`);
    on('#next', () => {
      sfx.step();
      next();
    });
    on('#skip', () => {
      // Skipping still makes any choice ahead: jump to it, or to the end.
      const k = lines.findIndex((l, j) => j >= i && 'key' in l && !meta.story.choices[l.key]);
      i = k >= 0 ? k : lines.length;
      next();
    });
  };
  next();
}

/** Before a dungeon: call on another player's ghost from the Endless board, or go alone. */
function showSummon(q: Quest, back: () => void) {
  showOverlay('summon', `
    <img class="hero-portrait story-face" src="${facePortrait('aldric')}" alt="" width="80" height="80" />
    <h2>Summon a shade</h2>
    <p class="sub">A fallen delver will fight beside you down there. They hear about it, and are thanked in Souls.</p>
    <div id="shades" class="shades"><p class="sub">Listening to the stones…</p></div>
    <button class="btn" id="alone">Go alone</button>
    <button class="link-btn" id="back">Back</button>`);
  on('#alone', () => startStory(q, null));
  on('#back', back);
  const uid = session.account?.id ?? null;
  void endlessBoard(uid, 25)
    .then((b) => {
      if (screen !== 'summon') return;
      const shades = b.rows.filter((r) => r.user_id !== uid && r.hero && HERO_BY_ID[r.hero as HeroId]).slice(0, 8);
      const box = document.getElementById('shades');
      if (!box) return;
      box.innerHTML = shades.length
        ? shades
            .map((r, k) => {
              const look = r.outfit_look && LOOK_BY_ID[r.outfit_look] ? r.outfit_look : '';
              const head = r.outfit_head && HEAD_BY_ID[r.outfit_head] ? r.outfit_head : '';
              return `<button class="shade" data-k="${k}">
                <img src="${heroPortrait(r.hero as HeroId, {}, [], 4, look, head)}" alt="" width="48" height="48" />
                <span><b>${esc(r.name)}</b><small>${esc(HERO_BY_ID[r.hero as HeroId].name)} · Endless floor ${r.floor}</small></span>
              </button>`;
            })
            .join('')
        : '<p class="sub">No shades answer today. You go alone.</p>';
      box.querySelectorAll<HTMLButtonElement>('.shade').forEach((el) =>
        el.addEventListener('click', () => {
          const r = shades[Number(el.dataset.k)];
          const ghost: GhostInfo = {
            name: r.name,
            hero: r.hero as HeroId,
            look: r.outfit_look && LOOK_BY_ID[r.outfit_look] ? r.outfit_look : '',
            head: r.outfit_head && HEAD_BY_ID[r.outfit_head] ? r.outfit_head : '',
          };
          if (signedIn()) void noteSummon(r.name, q.n);
          toast(`${r.name}'s ${HERO_BY_ID[ghost.hero].name} answers the summons`);
          startStory(q, ghost);
        }),
      );
    })
    .catch(() => {
      const box = document.getElementById('shades');
      if (box) box.innerHTML = '<p class="sub">The shades are quiet (no connection). You go alone.</p>';
    });
}

function startStory(q: Quest, ghost: GhostInfo | null) {
  unlockAudio();
  const hound = houndJoined();
  const d = q.dungeon;
  const g = new Game('story', hashSeed('story-act1', q.n), 0, {
    hero: meta.hero,
    pool: fullPool(),
    forge: true,
    mercy: true,
    story: {
      start: d.floors[0],
      end: d.floors[1],
      gifts: d.gifts,
      pet: hound ? houndStats(meta.story.bond) : undefined,
      ghost: ghost ?? undefined,
      boss: d.boss,
      look: d.look,
    },
  });
  storyRun = { quest: q, start: d.floors[0], hound };
  clearRun();
  showGame(g);
  startClock();
  setMusicDepth(g.floor, g.zone.def.key);
  setMusicMood(g.isBossFloor() ? 'boss' : 'crypt');
  hideOverlay();
  sfx.stairs();
  renderer.banner(d.name.toUpperCase(), '#9fe8ff');
}

/** Story dungeons can have words waiting on the boss floor. */
function storyFloor() {
  const run = storyRun;
  const d = run?.quest.dungeon;
  if (!run || !d?.boss || !d.bossLines || game.floor !== d.boss.floor) return;
  window.clearTimeout(overlayTimer);
  overlayTimer = window.setTimeout(() => talk(d.bossLines!, () => hideOverlay(), d.name), 700);
}

/** A dungeon ends: cleared (its last floor) or lost. */
function finishStory(won: boolean) {
  const run = storyRun;
  if (!run) return showTitle();
  storyRun = null;
  const q = run.quest;
  const cleared = Math.max(0, game.floor - run.start + (won ? 1 : 0));
  if (run.hound) noteBond(cleared);
  const streak = streakStats(save, dailyNumber());
  const reward = finishRunMeta(game, streak.current);
  const bounty = progressBounties(game, dailyNumber());
  reward.souls += bounty.souls;
  reward.lines.push(...bounty.lines);
  reward.unlocks.push(...bounty.notes);
  celebrate(reward.achievements);
  celebrateNotes(reward.unlocks);
  window.clearTimeout(overlayTimer);
  if (!won) {
    overlayTimer = window.setTimeout(() => {
      setMusicMood('fallen');
      showOverlay('story-fallen', `
        <img class="hero-portrait" src="${heroPortrait(game.hero, game.relics, game.relicLog, 8, outfitFor(game.hero).look, outfitFor(game.hero).head)}" alt="" width="96" height="96" />
        <h2 class="dead">The crypt claims you</h2>
        <p class="sub">${esc(q.dungeon.name)} · floor ${game.floor} · slain by ${esc(game.killedBy)}</p>
        <div class="souls-earned"><b>+${reward.souls} Souls</b><span>💀 ${meta.souls} to spend in the Ossuary</span></div>
        <p class="talk-quip">${storyText(DEATH_QUIPS[(game.turns + q.n) % DEATH_QUIPS.length])}</p>
        <button class="btn primary" id="retry">Try again<small>Same dungeon, same crypt</small></button>
        <button class="btn" id="world">Back to Gravesend</button>`);
      on('#retry', () => beginDungeon(q));
      on('#world', () => enterHollow());
    }, 1100);
    return;
  }
  const status = questStatus(q, storyState());
  const first = status === 'active';
  setMusicMood('crypt');
  overlayTimer = window.setTimeout(() => {
    // A replay just pays the run; the first clear plays out the story.
    if (!first) {
      toast(`${q.dungeon.name} cleared again. +${reward.souls} Souls`);
      return enterHollow();
    }
    talk(q.cleared, () => {
      if (q.turnIn) {
        clearQuest(q.n);
        toast(`📜 ${q.title}: report back to ${SPEAKERS[q.giver]}`);
        return enterHollow();
      }
      finishQuest(q, enterHollow);
    }, q.dungeon.name);
  }, 900);
}

/** The first visit: start the story at Mortimer's door. */
function placeAtCottage() {
  setHollowSpot('graveyard', 17, 4);
}

const DEATH_QUIPS = [
  'Mortimer, from far above: "I\'ll fetch a bigger shovel. Kidding! Mostly."',
  '{pet} licks your face until you get up. It is very persistent.',
  'Sir Aldric: "I fell in that exact spot. It is a popular spot."',
  'Mortimer: "Dying builds character. Or so I tell the characters I bury."',
];

/** On the title screen: your ghost answered summons while you were away. Thank you, in Souls. */
const SOULS_PER_SUMMONS = 15;
async function claimSummons() {
  if (!ONLINE || !signedIn()) return;
  const since = meta.summonsSeen;
  const now = new Date().toISOString();
  try {
    const n = await mySummons(since);
    meta.summonsSeen = now;
    if (n > 0) {
      const souls = n * SOULS_PER_SUMMONS;
      meta.souls += souls;
      meta.earned += souls;
      saveMeta();
      toast(`👻 Your ghost answered ${n} summons while you were away. +${souls} Souls`);
      if (screen === 'title') showTitle();
    } else {
      saveMeta();
    }
  } catch {
    // Not set up yet, or offline.
  }
}

// ---------- main loop ----------

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  renderer.frame(dt);
  drawGhosts(dt);
  requestAnimationFrame(loop);
}

// The run funnel: whether a visitor touches anything at all (the first screen may be the
// title or the sign-in), and the floor a run was left on when the page goes away (a run
// picked up and finished later is counted as finished).
let touched = false;
const firstTouch = () => {
  if (touched) return;
  touched = true;
  noteRun('title', 'tap');
};
window.addEventListener('pointerdown', firstTouch, true);
window.addEventListener('keydown', firstTouch, true);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || !game || tutorial) return;
  if ((game.mode === 'daily' || game.mode === 'endless') && game.phase !== 'dead') noteRun(game.mode, 'quit', game.floor);
});

// Expose for automated play-testing.
(window as unknown as { cryptfall: unknown }).cryptfall = {
  get game() {
    return game;
  },
  act,
  pickRelic,
  forgePick,
  resolveEvent,
  enemies: ENEMY_INFO,
  get lastResult() {
    return lastResult;
  },
};

setupInstall();
setHallOpener((back) => openHall(back));
onInstallChange(() => {
  if (screen === 'title') showTitle();
});
updateMuteIcon();
fitBoard();
newGame('endless');
// Starts restoring any session in the background; must run before the first screen draws.
startActivityPings();
void initSocial(save, () => {
  if (screen !== 'title') return;
  // First visit, or back from an email link / X sign-in that still needs a name.
  if (needsName()) showLogin(showTitle, 'name');
  else if (!session.account && !save.seenOnlineLogin) showLogin(showTitle);
  else showTitle();
});
showTitle();
if (!ONLINE && !save.seenLogin) showLogin(showTitle);
const visiting = hallFromLink();
if (visiting && ONLINE) showPublicHall(visiting, showTitle);
startGhosts();
requestAnimationFrame(loop);

// Music from the first moment the browser allows it: straight away where autoplay is
// permitted, otherwise on the first click, tap or key press anywhere on the page.
// (Cheap to repeat, so it simply listens for good.)
unlockAudio();
for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlockAudio, true);

// Until then, a small hint that the music is waiting on a tap.
const soundHint = document.createElement('div');
soundHint.id = 'sound-hint';
soundHint.textContent = matchMedia('(pointer: coarse)').matches ? '🔊 Tap anywhere for music' : '🔊 Click anywhere or press a key for music';
document.body.appendChild(soundHint);
function updateSoundHint() {
  soundHint.hidden = audioRunning() || isMuted() || !isMusicEnabled();
}
onAudioState(updateSoundHint);
updateSoundHint();
document.fonts?.load('8px Silkscreen').catch(() => undefined);
