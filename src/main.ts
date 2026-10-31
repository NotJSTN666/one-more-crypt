import './style.css';
import { audioRunning, fusionSound, isMusicEnabled, isMuted, onAudioState, setMusicDepth, setMusicEnabled, setMusicMood, setMuted, sfx, unlockAudio } from './audio';
import { centralDate, dailyNumber, formatCountdown, msUntilNextDaily } from './daily';
import { liveNews, unreadNews, type NewsGo } from './news';
import { ELITES, FEATURES, HERO_BY_ID, dailyHero, hordeHero, type ComboDef, type HeroId } from './content';
import { heroPortrait, heroSprite } from './hero';
import { BOON_BY_ID, ENEMY_INFO, MIST_BITE, REAPER_FLOOR, Game, fullPool, isBoss, type GameEvent, type GhostInfo, type Mode } from './game';
import { acceptQuest, checkRun, chooseStory, clearQuest, completeQuest, equipOutfit, finishRunMeta, heroUnlocked, noteBond, noteChallengeSeen, noteDeepest, noteDuelWin, noteStreak, meta, readLore, saveMeta, noteFusion, noteRelic, outfitFor, readEpitaph, runConfig, runsPlayed, claimWelcome, storyDone, welcomeNext, welcomeWaiting, noteRaidJoin, raidWins, settleRaid, unsettledRaids, noteInvitedBy, settleInvite, noteFriends, finishHordeMeta, receiveGift, equipTitle, FAIR_DAILY, type RunReward } from './meta';
import { drawGhosts, startGhosts } from './ghosts';
import { celebrate, celebrateNotes, setHallOpener, showGrimoire, showHeroSelect, showOssuary } from './progress-ui';
import { ASCEND_FLOOR, FUSION_BY_ID, RELIC_BY_ID, type FusedId, type RelicId } from './relics';
import { hallFromLink, onVisitIsle, showHall, showPublicHall, soulRankHtml, titleName } from './hall';
import { AURAS, AURA_BY_ID, GIFT_BY_ID, HEADS, TITLE_BY_ID, HEAD_BY_ID, LOOKS, LOOK_BY_ID, PODIUM, RAID_DECOR_BY_ID, RAID_KIND_LABEL, RAID_REWARDS, STORY_ALL, STREAK_HELMS, WEEKLY, WELCOME, rankFor, titleFxClass, welcomeLabel, type WelcomeReward } from './progression';
import { Renderer } from './render';
import { resetCanvases, sprites } from './sprites';
import { RAID_JOIN_MIN, RAID_SUBMIT_MIN, RAID_TURNS, currentRaid, nextRaid, raidBossName, raidConfig, raidJoinable, raidTimeLabel, type RaidSlot } from './raid';
import { hashSeed } from './rng';
import { ONLINE, submitHorde, hordeBoard, claimInvite, myInvites, raidHit, raidPlayer, raidState, type RaidState, challengeBoard, emailReminderOff, sendFeedback, setEmailReminder, type FeedbackKind, challengeNews, createChallenge, dailyBoard, endlessBoard, getChallenge, mySummons, noteRun, noteSummon, pingActivity, setPresenceSource, startActivityPings, waitingGifts, claimGift, submitChallengeRun, type Challenge, type ChallengeRow } from './online';
import {
  ACT2_MAIN, ACT2_QUESTS, ACT2_TITLE, act2Open, ACT_TITLE, ACT1_QUESTS, LORE, LORE_COUNT, MAIN_QUESTS, QUESTS, QUEST_BY_N, SPEAKERS, conversation, facePortrait, houndStats, npcMarker, npcPresent, petName, questStatus,
  type Line, type NpcId, type Quest, type StoryState,
} from './story';
import { EPITAPHS, hollowKey, setHollowSpot, showHollow, showIsleVisit, type HollowHooks, type HollowPlace } from './hollow';
import { auraClass, drawAura } from './aura';
import { islePerks, type IsleState } from './isle';
import { CROP_BY_ID, FARM_SPAWN, isRipe } from './graveshift';
import { showGraveRequests, showGraveShop } from './graveshift-ui';
import { showNightShift } from './nightshift-ui';
import { showWardrobe } from './wardrobe';
import { IMPACT, animateReveal, playFusion } from './fusefx';
import { howToHtml, startHowTo } from './howto';
import { RELIC_COACH, TUTORIAL } from './tutorial';
import { DISCORD_URL, KOFI_URL, copyText, descentStrip, discordHtml, followXHtml, kofiHtml, playTime, shareText, siteUrl } from './share';
import { installMode, onInstallChange, promptInstall, setupInstall } from './install';
import { bountiesHtml, progressBounties } from './bounties';
import { enableReminders, loadReminders, reminderPrefs, remindersAvailable, remindersNeedInstall, timeZone } from './push';
import { claimPodiums, claimWeekly, clearBeat, lastBeat, type PodiumFinish, type WeeklyFinish } from './social';
import { claimInlineHtml, wireClaimInline, endlessRecord, ensureGuest, initSocial, needsName, unclaimed, playerName, rankLine, recordRun, session, showLeaderboard, onlineCountHtml, showLogin, showProfile, signedIn, syncNow } from './social';
import { currentStreak, loadSave, recordDaily, streakStats, writeSave, type RunResult } from './storage';
import { $, esc, formStatus, hideOverlay, on, onSubmit, overlay, overlayShownAt, screen, showOverlay, toast } from './ui';

const canvas = $<HTMLCanvasElement>('board');
const renderer = new Renderer(canvas);
const save = loadSave();
// Fill in the Hall's streak from the dailies already played (saves from before streaks were tracked).
noteStreak(streakStats(save, dailyNumber()));
noteDeepest(save.bestEndless);
setMuted(save.muted);

/** Under the share button after a run, and on the title once the daily is done: the community server. */
const discordBtn = `<a class="btn discord" href="${DISCORD_URL}" target="_blank" rel="noopener">💬 Join the Discord<small>Post your result, compare builds, report bugs</small></a>`;

setMusicEnabled(!save.musicOff);

/** The player's display settings, applied to the board. */
function applyDisplay() {
  renderer.shakeOn = !save.shakeOff;
  renderer.contrast = save.highContrast;
}
applyDisplay();

let game: Game;
let lastResult: RunResult | null = null;
let lastReward: RunReward | null = null;
/** The Seven Nights gift claimed by the run that just ended, if any. */
let lastWelcome: { day: number; reward: WelcomeReward } | null = null;
let lastLabel = '';
let overlayTimer = 0;
/** A newer version of the game is out (see checkForUpdate); it loads at the title screen. */
let updateReady = false;
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
  turnLog = [];
  renderer.outfit = outfitFor(game.hero);
  renderer.pet = meta.pet;
  renderer.setGame(game);
  renderer.consume(game.events.splice(0));
  updateHud(true);
}

function startRun(mode: Mode) {
  challenge = null;
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
    <img class="hero-portrait ${auraClass(outfitFor(game.hero).aura).cls}" style="${auraClass(outfitFor(game.hero).aura).style}" src="${heroPortrait(game.hero, game.relics, game.relicLog, 8, outfitFor(game.hero).look, outfitFor(game.hero).head)}" alt="" width="96" height="96" />
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

/** Never played, never signed in, never seen the crypt: a first visit. */
function firstVisit(): boolean {
  return !save.tutorialDone && save.totals.runs === 0 && !save.seenOnlineLogin && !save.seenLogin && !savedRun() && !session.account;
}

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
  /** A challenge being played, so it carries on after a reload. */
  challenge?: Challenge;
}

/** The challenge the current run is playing (null for an ordinary run). */
let challenge: Challenge | null = null;
/** The challenge the last finished run played, for its results screen. */
let lastChallenge: Challenge | null = null;

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
  // A Horde run keeps its own slot, so it never overwrites a saved Endless or Daily run.
  if (game.mode === 'horde') {
    try {
      localStorage.setItem(HORDE_RUN_KEY, JSON.stringify({ dailyNo: game.dailyNo, seed: game.seed, log: game.header() + game.log, seconds: Math.round(runSeconds) }));
    } catch {
      // Storage blocked: the run just can't be resumed.
    }
    return;
  }
  try {
    const run: SavedRun = { mode: game.mode, seed: game.seed, dailyNo: game.dailyNo, log: game.header() + game.log, seconds: Math.round(runSeconds), ...(challenge ? { challenge } : {}) };
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // Storage blocked: the run just can't be resumed.
  }
}

const HORDE_RUN_KEY = 'omc:horde-run';

function clearHordeRun() {
  try {
    localStorage.removeItem(HORDE_RUN_KEY);
  } catch {
    // ignore
  }
}

/** Today's unfinished Horde run, rebuilt from its log, and the time spent on it so far. */
function savedHorde(): { game: Game; seconds: number } | null {
  try {
    const raw = localStorage.getItem(HORDE_RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as { dailyNo: number; seed: number; log: string; seconds: number };
    if (run.dailyNo !== dailyNumber()) {
      clearHordeRun();
      return null;
    }
    const g = Game.replay('horde', run.seed, run.dailyNo, run.log);
    if (g.phase === 'dead') {
      clearHordeRun();
      return null;
    }
    return { game: g, seconds: Math.max(0, Number(run.seconds) || 0) };
  } catch {
    clearHordeRun();
    return null;
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

/** The challenge a saved run was playing, if any. */
function savedChallenge(): Challenge | null {
  try {
    return (JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as SavedRun | null)?.challenge ?? null;
  } catch {
    return null;
  }
}

function resumeRun(g: Game) {
  challenge = savedChallenge();
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
  return /^(the|their|a|an) /i.test(name) || name === 'Death' ? name : `a ${name}`;
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
  // Seven Nights: one gift a day, for finishing any run.
  lastWelcome = claimWelcome(dailyNumber());
  if (lastWelcome) {
    const r = lastWelcome.reward;
    if ('souls' in r) {
      lastReward.souls += r.souls;
      lastReward.lines.push([`Seven Nights, day ${lastWelcome.day}`, r.souls]);
    } else {
      const label = welcomeLabel(r);
      lastReward.unlocks.push({ icon: label.icon, title: `Seven Nights, day ${lastWelcome.day}: ${label.name}`, detail: 'A gift for coming back. Wear it from the Wardrobe' });
    }
  }
  // A challenge run: its own board, not the Endless leaderboard or your Endless best.
  const ch = challenge;
  challenge = null;
  lastChallenge = ch;
  if (ch && beats(result, ch) && ch.user_id !== session.account?.id) {
    const won = noteDuelWin(ch.code);
    if (won.souls) {
      lastReward.souls += won.souls;
      lastReward.lines.push(['Beat the challenge', won.souls]);
    }
    if (won.feat) lastReward.achievements.push(won.feat);
  }
  let best = false;
  if (game.mode === 'daily') {
    lastLabel = `Daily #${game.dailyNo}`;
  } else if (ch) {
    lastLabel = `Challenge vs ${ch.name}`;
  } else {
    if (result.floor > save.bestEndless) {
      best = save.bestEndless > 0;
      save.bestEndless = result.floor;
    }
    lastLabel = 'Endless';
  }
  save.totals.runs += 1;
  void claimInviteIfDue();
  save.totals.kills += result.kills;
  if (game.mode === 'daily') save.totals.bestDaily = Math.max(save.totals.bestDaily, result.floor);
  writeSave(save);
  lastResult = result;
  celebrate(lastReward.achievements);
  celebrateNotes(lastReward.unlocks);

  // Story chapters end in finishStory, so only daily and Endless runs get here.
  const mode = game.mode === 'daily' ? 'daily' : 'endless';
  const dailyNo = game.dailyNo;
  const uploaded = ch ? postChallengeRun(ch) : recordRun({
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
    if (ch) {
      void uploaded.then(() => fillChallengeBoard(ch));
      return;
    }
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
  noteTurn(events);
  playSounds(events);
  if (tutorial) return tutorialEvents(events);
  if (events.some((e) => e.t === 'floor')) {
    setMusicDepth(game.floor, game.zone.def.key);
    setMusicMood(game.isBossFloor() ? 'boss' : 'crypt');
    if (game.mode === 'story') storyFloor();
  }
  // Progress: codex entries, combos, fusions and achievements.
  for (const ev of events) {
    if (ev.t === 'reaperrise') sfx.toll();
    if (ev.t === 'wave') {
      renderer.banner(ev.of ? `VESPERS · WAVE ${ev.wave} OF ${ev.of}` : ev.boss ? `BOSS WAVE ${ev.wave}` : `WAVE ${ev.wave}`, ev.boss ? '#ff4d5a' : ev.of ? '#9be36a' : '#f2c14e');
      if (ev.boss) sfx.toll();
      setMusicMood(ev.boss ? 'boss' : 'crypt');
    }
    if (ev.t === 'surge') renderer.banner('POWER SURGE!', '#5fe3ff');
    if (ev.t === 'drop') renderer.banner(ev.kind === 'chest' ? 'A CHEST APPEARS' : ev.kind === 'shrine' ? 'A SHRINE RISES' : 'A FOUNTAIN SPRINGS UP', '#f2c14e');
    if (ev.t === 'wavecleared') renderer.banner(`WAVE ${ev.wave} HELD +${ev.bonus}`, '#7ee081');
    if (ev.t === 'reaper' && game.floor === REAPER_FLOOR) renderer.banner('DEATH WALKS THESE FLOORS', '#d3b0ff');
    if (ev.t === 'boon') renderer.banner(`${BOON_BY_ID[ev.id].name.toUpperCase()}`, '#b07cff');
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
  // (The Horde's depth isn't a floor reached, so floor feats don't count there.)
  if (game.phase !== 'dead' && game.mode !== 'horde') celebrate(checkRun(game));
  updateHud();
  if (raidRun && (game.phase === 'dead' || game.phase === 'won' || game.turns >= RAID_TURNS)) {
    if (game.phase === 'dead') setMusicMood('silent');
    return finishRaid(game.phase === 'dead');
  }
  // Let anything the Grave Magnet is pulling land before an offer covers the board.
  if (game.phase === 'choose') {
    window.clearTimeout(overlayTimer);
    overlayTimer = window.setTimeout(showChoice, 280 + renderer.pullingMs());
  } else if (game.phase === 'event') {
    window.clearTimeout(overlayTimer);
    overlayTimer = window.setTimeout(showEvent, 250 + renderer.pullingMs());
  } else if (game.phase === 'dead') {
    setMusicMood('silent');
    if (game.mode === 'horde') finishHorde();
    else if (game.mode === 'story') finishStory(false);
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
  if (has('toll') || has('ring')) sfx.toll();
  if (has('timestop')) sfx.timestop();
  if (has('shot')) sfx.shot();
  if (has('dart')) sfx.shot();
  if (has('hurt')) sfx.hurt();
  if (has('block') || has('dodge')) sfx.block();
  if (has('heal')) sfx.heal();
  if (has('stairs')) sfx.stairs();
  if (has('raise') || has('teleport')) sfx.zap();
  if (has('warn') || has('wake')) sfx.block();
  if (has('spike') || has('eblock') || has('lava')) sfx.hit();
  const crumble = events.find((e) => e.t === 'crumble');
  if (crumble) {
    sfx.crit();
    if (crumble.t === 'crumble' && crumble.open) sfx.relic();
  }
  if (has('vault')) sfx.relic();
  if (has('spark')) sfx.relic();
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
    // The Night Shift reads the keys itself.
    if (screen === 'nightshift') return;
    if (screen === 'hollow' && hollowKey(e)) return;
    if ((screen === 'choose' && game?.phase === 'choose' && game.offer) || (screen === 'event' && game?.phase === 'event')) choiceKey(e);
    else menuKey(e);
    return;
  }
  if (e.key === 'b' || e.key === 'B') return toggleBow();
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
$('bow-btn').addEventListener('click', () => toggleBow());
$('bow-pad').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  toggleBow();
});

document.querySelectorAll<HTMLButtonElement>('#dpad button[data-dir]').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const [dx, dy] = btn.dataset.dir!.split(',').map(Number);
    act(dx, dy);
  });
});

function toggleMute() {
  unlockAudio();
  setMuted(!isMuted());
  save.muted = isMuted();
  writeSave(save);
  updateMuteIcon();
}

$('mute').addEventListener('click', toggleMute);
// The title screen's mute button, beside your name (the screen redraws, so listen on the page).
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest?.('#title-mute')) return;
  toggleMute();
});
// The title screen's 📰 button: what's new.
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest?.('#title-news')) showWhatsNew(showTitle);
});

// ---------- what's new ----------

// The date of the newest day of notes this player has opened.
const NEWS_READ_KEY = 'omc:news-read-day';

function newsRead(): string | null {
  try {
    return localStorage.getItem(NEWS_READ_KEY);
  } catch {
    return null;
  }
}

/** Live updates this player hasn't opened What's new to see yet. */
function newsUnread(): number {
  return unreadNews(centralDate(), newsRead());
}

/** The day's heading: Today, Yesterday, or the date. */
function newsDay(date: string): string {
  const today = centralDate();
  if (date === today) return 'Today';
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (date === y.toISOString().slice(0, 10)) return 'Yesterday';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const NEWS_GO: Record<NewsGo, string> = {
  horde: '🛡️ Play the Horde', story: '📖 Go to the story', howto: '❔ How to play', settings: '⚙️ Settings',
  wardrobe: '👘 Wardrobe', endless: '♾️ Play Endless', daily: "📅 Today's crypt",
};

/** What's new: patch notes for every day of updates, newest first. Opening it marks them read. */
function showWhatsNew(back: () => void) {
  const live = liveNews(centralDate());
  const unread = newsUnread();
  // Each line leads with its emoji; set it apart so the words line up beneath one another.
  const line = (l: string) => {
    const [, emoji = '', rest = l] = /^(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*)\s*(.*)$/u.exec(l) ?? [];
    return `<li><span class="nl-emoji" aria-hidden="true">${emoji}</span><span>${esc(rest)}</span></li>`;
  };
  const days = live.map((d, i) => `
      <article class="news-update${i < unread ? ' unread' : ''}">
        <h3>${esc(d.title)}${i < unread ? ' <span class="news-new">NEW</span>' : ''}</h3>
        <p class="news-date">${esc(newsDay(d.date))}</p>
        <ul class="news-notes">${d.notes.map(line).join('')}</ul>
        ${d.fixes?.length ? `<p class="news-fixed"><b>Also fixed:</b> ${d.fixes.map((f) => esc(f.replace(/^\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*\s*/u, ''))).join(' ')}</p>` : ''}
        ${d.go?.length ? `<p class="news-gos">${d.go.map((g) => `<button type="button" class="link-btn news-go" data-go="${g}">${NEWS_GO[g]} →</button>`).join('')}</p>` : ''}
      </article>`).join('<div class="news-sep" aria-hidden="true">✦</div>');
  showOverlay('whats-new', `
    <h2>📰 What's new</h2>
    <div class="news-feed">${days || '<p class="fine">Nothing yet.</p>'}</div>
    <p class="fine">Talk about it, report bugs and suggest ideas in the <a href="${DISCORD_URL}" target="_blank" rel="noopener">Discord</a> 💬</p>
    <button class="btn primary" id="back">Back</button>`);
  if (live[0]) {
    try {
      localStorage.setItem(NEWS_READ_KEY, live[0].date);
    } catch {
      // Private mode: the dot may show again, which is harmless.
    }
  }
  on('#back', back);
  overlay.querySelectorAll<HTMLButtonElement>('.news-go').forEach((b) =>
    b.addEventListener('click', () => {
      const go = b.dataset.go as NewsGo;
      if (go === 'horde') startHorde();
      else if (go === 'story') playStory();
      else if (go === 'howto') showHelp(() => showWhatsNew(back));
      else if (go === 'settings') showSettings(() => showWhatsNew(back));
      else if (go === 'wardrobe') showWardrobe(() => showWhatsNew(back));
      else if (go === 'endless') showHeroSelect(() => startRun('endless'), () => showWhatsNew(back));
      else startRun('daily');
    }),
  );
}

// The title screen's ⚙️ button: sound, music and display settings.
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest?.('#title-settings')) showSettings(showTitle);
});

/** Sound, music and display settings, saved on this device. */
function showSettings(back: () => void) {
  const row = (id: string, icon: string, name: string, on: boolean, note: string) =>
    `<button class="btn setting-row ${on ? 'on' : ''}" id="${id}" aria-pressed="${on}"><span>${icon} ${name}</span><b>${on ? 'On' : 'Off'}</b><small>${note}</small></button>`;
  showOverlay('settings', `
    <h2>⚙️ Settings</h2>
    <p class="sub">Saved on this device.</p>
    <h3 class="shop-head">Sound</h3>
    ${row('set-sound', '🔊', 'Sound effects', !isMuted(), 'Hits, steps, the bell and the rest')}
    ${row('set-music', '🎵', 'Music', isMusicEnabled(), 'The crypt\'s music, which changes with depth')}
    <h3 class="shop-head">Display</h3>
    ${row('set-shake', '📳', 'Screen shake', !save.shakeOff, 'A short shake on big hits')}
    ${row('set-contrast', '🔲', 'High contrast', save.highContrast, 'Light walls with bright edges, a plain floor, outlined foes, no fog')}
    <button class="btn" id="set-help">❔ How to play</button>
    <button class="btn primary" id="back">Back</button>`);
  const again = () => showSettings(back);
  on('#set-sound', () => {
    toggleMute();
    again();
  });
  on('#set-music', () => {
    unlockAudio();
    setMusicEnabled(!isMusicEnabled());
    save.musicOff = !isMusicEnabled();
    writeSave(save);
    again();
  });
  on('#set-shake', () => {
    save.shakeOff = !save.shakeOff;
    writeSave(save);
    applyDisplay();
    again();
  });
  on('#set-contrast', () => {
    save.highContrast = !save.highContrast;
    writeSave(save);
    applyDisplay();
    again();
  });
  on('#set-help', () => showHelp(again));
  on('#back', back);
}

// The title screen's ☕ button: a word about donations, then on to Ko-fi if they like.
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest?.('#title-kofi')) showSupport(showTitle);
});

function showSupport(back: () => void) {
  showOverlay('support', `
    <h2>☕ Keep the crypt open</h2>
    <p class="sub">One More Crypt is free to play, with no ads.</p>
    <p class="fine">Donations are welcome and help keep the crypt open: the servers, the leaderboards and a new crypt every day. Supporters get the Patron of the Crypt title and the rainbow Patron's Prism aura as thanks.</p>
    ${meta.patron ? '<p class="fine">You already support the crypt. Thank you!</p>' : ''}
    <button class="btn primary" id="kofi-go">☕ Donate on Ko-fi</button>
    <button class="btn" id="back">Back</button>`);
  on('#kofi-go', () => window.open(KOFI_URL, '_blank', 'noopener'));
  on('#back', back);
}
$('menu-btn').addEventListener('click', () => showPause());

function updateMuteIcon() {
  $('mute').textContent = isMuted() ? '🔇' : '🔊';
  const chip = document.getElementById('title-mute');
  if (chip) {
    chip.textContent = isMuted() ? '🔇' : '🔊';
    chip.setAttribute('aria-label', isMuted() ? 'Sound off. Turn it on' : 'Sound on. Mute');
  }
}

// ---------- HUD ----------

let knownRelics = 0;
/** The relics the bar was last drawn with, so a fusion (same count, new set) redraws it. */
let knownSet = '';
let selectedRelic: RelicId | null = null;

/** The Ranger's bow button: shown only when the bow can be lowered, and saying which way it is. */
function updateBow() {
  const show = Boolean(game?.canLowerBow);
  const down = Boolean(game?.bowDown);
  for (const id of ['bow-btn', 'bow-pad']) {
    const el = $(id);
    el.hidden = !show;
    el.classList.toggle('down', down);
  }
  $('bow-btn').innerHTML = `🏹 Bow: ${down ? 'lowered' : 'ready'} <kbd>B</kbd>`;
  $('bow-pad').innerHTML = `🏹<small>${down ? 'LOWERED' : 'READY'}</small>`;
}

/** Lower or raise the Ranger's bow (no turn passes). */
function toggleBow() {
  if (!game || !overlay.hidden || tutorial || !game.toggleBow()) return;
  sfx.step();
  // A word over the hero, not a toast: a toast would cover the d-pad on phones.
  renderer.heroNote(game.bowDown ? 'BOW LOWERED' : 'BOW READY', game.bowDown ? '#9aa3b5' : '#7ee081');
  updateBow();
  saveRun();
}

function updateHud(reset = false) {
  updateBow();
  const p = game.player;
  const pct = Math.max(0, (p.hp / p.maxHp) * 100);
  const fill = $('hp-fill');
  fill.style.width = `${pct}%`;
  fill.classList.toggle('low', p.hp <= 3);
  $('hp-text').textContent = `${p.hp}/${p.maxHp}`;
  // Horde: kills fill the surge bar toward the next relic.
  const surge = game.mode === 'horde' && Boolean(game.config.surge);
  $('surge-bar').hidden = !surge;
  if (surge) {
    const h = game.horde;
    const pct = Math.min(100, (h.charge / h.need) * 100);
    $('surge-fill').style.width = `${pct}%`;
    $('surge-bar').classList.toggle('near', pct >= 70);
    $('surge-label').textContent = `⚡ ${Math.min(h.charge, h.need)}/${h.need}`;
  }
  // In the Horde the floor counter shows the wave.
  const horde = game.mode === 'horde';
  $('floor').textContent = String(horde ? game.horde.wave : game.floor);
  $('floor-icon').textContent = horde ? 'Wave' : '⛧';
  $('floor-stat').title = horde ? 'Wave' : 'Floor';
  $('atk').textContent = String(game.atk);
  $('kills').textContent = String(game.kills);

  const boss = game.enemies.find((e) => isBoss(e) && !e.dead);
  $('boss-bar').hidden = !boss;
  if (boss && raidRun) {
    // A world boss: the shared bar, less what this fight has dealt so far.
    const st = raidStateFor(raidRun.slot.id);
    const mine = raidDamage(game, raidRun.slot.kind);
    const left = st ? (st.felled ? 0 : Math.max(0, st.hp - st.damage - mine)) : null;
    $('boss-name').textContent = `${ENEMY_INFO[boss.kind].name} · you ${mine} · ${Math.max(0, RAID_TURNS - game.turns)} turns left`;
    $('boss-fill').style.width = `${st ? (left! / st.hp) * 100 : 100}%`;
  } else if (boss) {
    $('boss-name').textContent = ENEMY_INFO[boss.kind].name;
    $('boss-fill').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
  }

  const unique = [...new Set(game.relicLog)];
  if (reset || unique.join() !== knownSet) {
    const bar = $('relic-bar');
    bar.innerHTML = '';
    // First in the row: your build at a glance, and what happened in the last few turns.
    const build = document.createElement('button');
    build.className = 'relic-chip build-chip';
    build.textContent = '📜';
    build.setAttribute('aria-label', 'Your build and the last few turns');
    build.addEventListener('click', () => showBuild('build'));
    bar.appendChild(build);
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
    // A new relic scrolls into view at the end of the row.
    if (!reset && unique.length > knownRelics) bar.scrollLeft = bar.scrollWidth;
    knownRelics = unique.length;
    knownSet = unique.join();
    bar.classList.toggle('overflowing', bar.scrollWidth > bar.clientWidth + 1);
  } else {
    // counts may change without new relic types
    unique.forEach((id, i) => {
      const chip = $('relic-bar').children[i + 1];
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
    tip.innerHTML = `<b>${def.name}${n > 1 ? ` ×${n}` : ''}</b>: ${relicText(def.desc(n))}`;
    return;
  }
  const elite = game.alive.find((e) => e.elite);
  const boss = game.alive.find((e) => isBoss(e));
  const feature = game.feature && !game.feature.used ? game.feature : null;
  if (game.mode === 'horde') {
    const h = game.horde;
    const mult = game.hordeMult();
    tip.innerHTML = `🛡️ Wave <b>${h.wave}</b>${game.alive.length ? '' : ` · next in <b>${h.next}</b>`} · <b style="color:${mult > 1 ? '#f2c14e' : 'inherit'}">×${mult}</b> · <b>${h.score.toLocaleString()}</b> pts${game.reaper ? ' · ☠️ Death walks' : ''}`;
  } else if (game.reaper?.waiting) tip.innerHTML = `☠️ Death waits in the corner. He walks in <b>${game.reaperIn} turn${game.reaperIn === 1 ? '' : 's'}</b>. Don't touch him.`;
  else if (game.reaper) tip.innerHTML = game.stairsOpen ? '☠️ <b>Death is coming.</b> Run for the stairs!' : '☠️ <b>Death is coming.</b> His touch is the end. Clear the floor and reach the stairs.';
  else if (game.config.reaper && game.floor >= REAPER_FLOOR && game.reaperIn > 0)
    tip.innerHTML = `☠️ Death rises in <b>${game.reaperIn} turn${game.reaperIn === 1 ? '' : 's'}</b>. Be gone before he does.`;
  else if (game.config.reaper && game.floor >= REAPER_FLOOR - 5 && game.floor < REAPER_FLOOR) tip.innerHTML = `You hear footsteps behind you… <b>Death walks from floor ${REAPER_FLOOR}.</b>`;
  else if (game.holdout) tip.innerHTML = `<b>Vespers, wave ${game.holdout.wave} of ${game.holdout.of}.</b> Hold out: the stairs open after the last wave.`;
  else if (game.enemies.some((e) => e.asleep && !e.dead)) tip.innerHTML = 'The monks <b>sleep</b> and the stairs are open. Don\'t end a turn beside one.';
  else if (game.stairsOpen) tip.innerHTML = 'The seal is broken. <b>Take the stairs</b> to descend.';
  else if (game.warnings.length)
    tip.innerHTML = '<b>Glowing tiles</b> will be struck next turn. Get clear!';
  else if (game.enemies.some((e) => e.aim && !e.dead))
    tip.innerHTML = '<b>Red tiles:</b> an arrow flies next turn. Step aside!';
  else if (boss?.kind === 'boss') tip.innerHTML = 'The <b>Bone Warden</b> raises ghouls every few turns. Strike fast.';
  else if (boss?.kind === 'abbot') tip.innerHTML = 'The <b>Plague Abbot</b> rains plague around you. Watch for green tiles.';
  else if (boss?.kind === 'lich') tip.innerHTML = 'The <b>Lich King</b> blinks away and fires along its row and column.';
  else if (game.shadowReady) tip.innerHTML = '<b>Shadowstep:</b> your next step goes unseen. Foes won\'t act.';
  else if (game.inMist(game.player.x, game.player.y)) tip.innerHTML = `You're in the <b>plague mist</b>. Every ${MIST_BITE}rd turn in it costs 1 health.`;
  else if (elite) tip.innerHTML = `Glowing foes are elites. <b>${ELITES[elite.elite!].name}:</b> ${ELITES[elite.elite!].desc}`;
  else if (feature) tip.innerHTML = `Step onto the <b>${FEATURES[feature.kind].name}</b> to use it.`;
  else if (game.vault) tip.innerHTML = 'A <b>secret vault</b> lies open. Step in to claim its treasure.';
  else if (game.secret) tip.innerHTML = 'That <b>cracked wall</b> sounds hollow. Bump it twice to break through.';
  else if ((game.config.depths || game.config.story?.look) && zoneTip(game)) tip.innerHTML = zoneTip(game);
  else if (game.spikes.some(Boolean) && game.turns < 4) tip.innerHTML = '<b>Spikes</b> hurt anything that walks on them. Lure foes across.';
  else if (game.hero === 'ranger' && game.floor <= 2 && game.turns < 8)
    tip.innerHTML = `<b>Longbow:</b> move toward a foe 2-3 tiles away in a straight line to shoot it.${game.canLowerBow ? ' Lower the bow (🏹) to step instead.' : ''}`;
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
  // A newer version came out while the app sat open: load it now, between runs.
  if (updateReady && reloadForUpdate()) return;
  checkChallengeNews();
  setMusicDepth(0);
  setMusicMood('crypt');
  const today = dailyNumber();
  const done = save.daily[today];
  const streak = currentStreak(save, today);
  const resumable = savedRun();
  const raid = raidPhase();
  const heroToday = HERO_BY_ID[dailyHero(today)].name;
  const dailyBlock = done
    ? `<div class="card">
        <div>Daily #${today} conquered</div>
        <div class="strip">${descentStrip(done.floor)}</div>
        <div class="sub" style="margin:0">Floor ${done.floor} · ${done.kills} kills</div>
        <a class="btn discord" href="${DISCORD_URL}" target="_blank" rel="noopener">💬 Discord</a>
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
  const ns = (n: number) => n.toLocaleString();
  showOverlay('title', `
    ${accountChip()}
    <h1 class="logo">One More Crypt</h1>
    <p class="tagline">One crypt. One try a day. How deep can you go?</p>
    ${onlineCountHtml()}
    ${continueBlock}
    ${dailyBlock}
    ${raid.phase !== 'soon' ? raidCardHtml(raid) : ''}
    ${endlessBtn}
    ${hordeButtonHtml()}
    ${streak > 1 ? `<div class="streak">🕯️ ${streak}-day streak</div>` : ''}
    ${raid.phase === 'soon' ? raidCardHtml(raid) : ''}
    ${welcomeTitleHtml()}
    ${bountiesHtml(today)}
    <h2 class="title-section">Adventure</h2>
    <div class="tiles">
      ${storyTileHtml()}
      ${titleTile('hollow', '🌙', 'The Hollow', 'Graveyard & your isle')}
      ${titleTile('act2', '🔔', 'Act II', act2Open() ? 'Part 1 open' : 'Opens Friday', 'act2-tile')}
      ${graveTileHtml()}
    </div>
    <h2 class="title-section">Your crypt</h2>
    <div class="tiles">
      ${titleTile('hall', '🏰', 'Crypt Hall', `<span style="color:${rankFor(meta.earned).color}">${esc(rankFor(meta.earned).name)}</span>`)}
      ${titleTile('wardrobe', '🎨', 'Wardrobe', 'Dress your heroes')}
      ${titleTile('ossuary', '🏛️', 'Ossuary', `💀 ${ns(meta.souls)} Souls`)}
      ${titleTile('grimoire', '📖', 'Grimoire', 'Relics & combos')}
      ${ONLINE ? titleTile('leaderboard', '🏆', 'Leaderboards', 'Daily & Endless') : ''}
      ${ONLINE ? titleTile('invite', '👥', 'Bring a friend', meta.invite.friends ? `${meta.invite.friends} brought` : 'You both get a cloak') : ''}
      ${titleTile('feedback', '💬', 'Feedback', 'Bugs & ideas')}
      ${titleTile('help', '❔', 'How to play', 'The basics')}
    </div>
    <div class="foot-links">${followXHtml}${discordHtml}${kofiHtml}</div>
  `);
  on('#account', () => (unclaimed() ? showLogin(showTitle, 'claim') : showProfile(showTitle)));
  on('#leaderboard', () => showLeaderboard(showTitle));
  on('#daily', () => withTutorialOffer(() => startRun('daily')));
  on('#continue', () => resumable && resumeRun(resumable));
  on('#endless', () => withTutorialOffer(() => showHeroSelect(() => startRun('endless'), showTitle)));
  if (endlessNext) showEndlessRecord();
  on('#ossuary', () => showOssuary(showTitle));
  on('#grimoire', () => showGrimoire(showTitle));
  on('#hall', () => openHall(showTitle));
  on('#hollow', () => enterHollow());
  on('#graveshift', () => {
    if (!graveShiftOpen()) return toast('🌾 Grave Shift is coming soon: keep the old plot behind Gravesend.');
    setHollowSpot('farm', FARM_SPAWN.x, FARM_SPAWN.y + 1);
    enterHollow();
  });
  on('#story', () => playStory());
  on('#act2', () => showActTwo(showTitle));
  on('#raid', () => showRaid(showTitle));
  wireHordeButton();
  on('#invite', () => showInvite(showTitle));
  on('#help', () => showHelp(showTitle));
  on('#wardrobe', () => showWardrobe(showTitle));
  on('#feedback', () => showFeedback(showTitle));
  on('#install', () => {
    if (installMode() === 'ios') return showInstallHelp(showTitle);
    void promptInstall().then((ok) => {
      if (ok) toast('Installed! Find One More Crypt on your home screen.');
      if (screen === 'title') showTitle();
    });
  });
  tickCountdowns();
  void checkGifts();
  // Finished on yesterday's podium? Celebrate once the result is in.
  // A world boss you fought in fell (or got away) while you were gone.
  if (unsettledRaids().length) void checkRaidRewards();
  if (signedIn()) void checkFriends();
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
    <button class="btn" id="back">Continue</button>`);
  on('#wear', () => {
    equipOutfit(meta.hero, 'head', prize.head);
    toast(`Your ${HERO_BY_ID[meta.hero].name} wears the ${head.name}`);
    back();
  });
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
    <button class="btn ${head ? '' : 'primary'}" id="back">Continue</button>`);
  on('#wear', () => {
    if (!head) return;
    equipOutfit(meta.hero, 'head', prize.head);
    toast(`Your ${HERO_BY_ID[meta.hero].name} wears the ${head.name}`);
    back();
  });
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

/** The sound button from the title screen, for screens where people stay a while. */
function muteChipHtml(): string {
  return `<button class="account-chip mute-chip" id="title-mute" aria-label="${isMuted() ? 'Sound off. Turn it on' : 'Sound on. Mute'}">${isMuted() ? '🔇' : '🔊'}</button>`;
}

function accountChip(): string {
  const mute = muteChipHtml()
    + `<button class="account-chip mute-chip news-chip" id="title-news" aria-label="What's new${newsUnread() ? `, ${newsUnread()} unread` : ''}">📰${newsUnread() ? '<i class="news-dot"></i>' : ''}</button>`
    + `<button class="account-chip mute-chip" id="title-settings" aria-label="Settings">⚙️</button>`
    + `<button class="account-chip mute-chip kofi-chip" id="title-kofi" aria-label="Support One More Crypt"><span class="kofi-cup" aria-hidden="true">☕️<i></i><i></i><i></i></span></button>`
    // Install, up top beside the sound, wherever the browser can add the game to the home screen.
    + (installMode() ? `<button class="account-chip install-chip" id="install" aria-label="Install the app">📲 Install</button>` : '');
  if (ONLINE && !session.ready) return `<div class="account-row">${mute}</div>`;
  const name = playerName();
  const title = titleName(meta.title);
  // A guest on the boards under a placeholder is nudged to pick a real name.
  if (unclaimed()) return `<div class="account-row">${mute}<button class="account-chip claim-chip" id="account">✍️ Claim your name</button></div>`;
  return `<div class="account-row">${mute}<button class="account-chip" id="account">👤 ${name ? esc(name) : 'Sign in'}${name && title ? ` <small class="${titleFxClass(meta.title)}">${esc(title)}</small>` : ''}</button></div>`;
}

// ---------- the Hollow ----------

function enterHollow() {
  setMusicDepth(0);
  setMusicMood('crypt');
  showHollow(hollowHooks());
}

/** Someone else's isle, from their Hall. */
function visitIsle(name: string, isle: IsleState, back: () => void) {
  setMusicDepth(0);
  setMusicMood('crypt');
  showIsleVisit(hollowHooks(), name, isle, back);
}
onVisitIsle(visitIsle);

function hollowHooks(): HollowHooks {
  return {
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
    questDoor: (n) => Boolean(QUEST_BY_N[n]) && questStatus(QUEST_BY_N[n], storyState()) === 'active',
    talk: talkTo,
    dungeon: dungeonDoor,
    enterDungeon: (n) => QUEST_BY_N[n] && beginDungeon(QUEST_BY_N[n]),
    gate: (n) => ['active', 'cleared', 'done'].includes(questStatus(QUEST_BY_N[n], storyState())),
    areaOpen: (id) => id !== 'cloister' || meta.story.done.includes(21),
    lore: (id) => LORE[id] ?? null,
    readLore: (id) => {
      if (readLore(id)) sfx.relic();
    },
    loreRead: (id) => meta.story.journal.includes(id),
    pet: () => storyOpen() && meta.pet === 'hound' && houndJoined(),
    quests: () => showQuests(),
    graveOpen: graveShiftOpen,
    graveShop: () => showGraveShop(enterHollow),
    graveRequests: () => showGraveRequests(enterHollow),
    nightOpen: nightShiftOpen,
    nightShift: () => showNightShift(enterHollow),
    graveFx: (what) => {
      if (what === 'harvest' || what === 'settle') sfx.relic();
      else if (what === 'hit') sfx.hit();
      else if (what === 'hurt') sfx.hurt();
      else if (what === 'kill') sfx.kill();
      else if (what === 'faint') sfx.death();
      else if (what === 'fail') sfx.bump();
      else sfx.step();
    },
    built: (what) => {
      if (what === 'place') sfx.relic();
      else if (what === 'pickup') sfx.step();
      else if (what === 'land') sfx.fuse();
      else sfx.bump();
    },
  };
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

// ---------- feedback ----------

const FEEDBACK_KINDS: [FeedbackKind, string][] = [
  ['bug', '🐞 Bug'],
  ['idea', '💡 Idea'],
  ['balance', '⚖️ Balance'],
  ['love', '❤️ Love it'],
  ['other', '💬 Other'],
];

/** Tell us what to fix or make: goes straight to the maker's inbox. */
function showFeedback(back: () => void, preset?: FeedbackKind, prompt?: string) {
  if (!ONLINE) {
    showOverlay('feedback', `
      <h2>💬 Feedback</h2>
      <p class="sub">We'd love to hear it. Tell us on Discord.</p>
      ${discordBtn}
      <button class="btn" id="back">Back</button>`);
    on('#back', back);
    return;
  }
  let kind: FeedbackKind | null = null;
  showOverlay('feedback', `
    <div class="account-row">${muteChipHtml()}</div>
    <h2>💬 Feedback</h2>
    <p class="sub">Found a bug, have an idea, or something feels off? Every message is read.</p>
    <div class="fb-kinds" role="radiogroup" aria-label="What kind of feedback">
      ${FEEDBACK_KINDS.map(([k, label]) => `<button class="fb-kind" data-kind="${k}" role="radio" aria-checked="false">${label}</button>`).join('')}
    </div>
    <form id="fb-form" class="form">
      <textarea name="message" id="fb-text" maxlength="1000" rows="6" placeholder="${esc(prompt ?? 'What happened, or what would make the game better?')}"></textarea>
      <p class="fine fb-count"><span id="fb-count">0</span>/1000${session.account?.name ? ` · sent as ${esc(session.account.name)}` : ''}</p>
      <button class="btn primary" type="submit" id="fb-send" disabled>Send feedback</button>
      <p class="form-status" role="status"></p>
    </form>
    <p class="fine">Rather chat? ${discordHtml}</p>
    <button class="btn" id="back">Back</button>`);
  const text = $('fb-text') as HTMLTextAreaElement;
  const send = $('fb-send') as HTMLButtonElement;
  const ready = () => (send.disabled = !kind || text.value.trim().length < 3);
  overlay.querySelectorAll<HTMLButtonElement>('.fb-kind').forEach((b) =>
    b.addEventListener('click', () => {
      kind = b.dataset.kind as FeedbackKind;
      overlay.querySelectorAll<HTMLButtonElement>('.fb-kind').forEach((o) => {
        o.classList.toggle('on', o === b);
        o.setAttribute('aria-checked', String(o === b));
      });
      ready();
      if (!text.value) text.focus();
    }),
  );
  if (preset) overlay.querySelector<HTMLButtonElement>(`.fb-kind[data-kind="${preset}"]`)?.click();
  text.addEventListener('input', () => {
    $('fb-count').textContent = String(text.value.length);
    ready();
  });
  onSubmit('#fb-form', async (form) => {
    if (!kind) return;
    send.disabled = true;
    formStatus(form, 'Sending…', true);
    try {
      await sendFeedback(kind, text.value.trim(), {
        screen: `${innerWidth}x${innerHeight}`,
        ua: navigator.userAgent.slice(0, 160),
        runs: save.totals.runs,
        bestEndless: save.bestEndless,
        story: meta.story.done.length,
      });
      showOverlay('feedback', `
        <h2>Thank you! 🕯️</h2>
        <p class="sub">Your feedback is on its way. It really does shape what gets fixed and built next.</p>
        <p class="fine">Want to see what happens with it, or talk it over? ${discordHtml}</p>
        <button class="btn primary" id="back">Back</button>`);
      on('#back', back);
    } catch (e) {
      formStatus(form, (e as Error).message);
      ready();
    }
  });
  on('#back', back);
}

function showHelp(back: () => void) {
  const fromTitle = back === showTitle;
  showOverlay('help', `
    <h2>How to play</h2>
    ${fromTitle ? '<button class="btn primary" id="tutorial">▶ Play the tutorial<small>Learn by doing, about a minute</small></button>' : ''}
    ${howToHtml({ discord: DISCORD_URL, kofi: KOFI_URL })}
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
  // Shown in alphabetical order, so the same picks are always in the same place. Each card
  // keeps its index in the offer, which is what the run log records.
  const cards = [
    ...offer.relics.map((r, i) => {
      const have = game.own(r.id);
      return { name: r.name, html: `<button class="${r.rarity}" data-i="${i}">
        <span class="emoji">${r.emoji}</span>
        <span><span class="name">${r.name}</span><span class="tag">${r.rarity.toUpperCase()}${have ? ` · OWNED ×${have}` : ''}</span>
        <span class="desc">${relicText(r.desc(have + 1))}</span></span>
      </button>` };
    }),
    ...offer.boons.map((id, k) => {
      const b = BOON_BY_ID[id];
      const have = game.boons[id];
      return { name: b.name, html: `<button class="boon" data-i="${offer.relics.length + k}">
        <span class="emoji">${b.emoji}</span>
        <span><span class="name">${b.name}</span><span class="tag">ABYSS BOON${have ? ` · TAKEN ×${have}` : ''}${b.max ? ` · MAX ${b.max}` : ''}</span>
        <span class="desc">${b.desc}</span></span>
      </button>` };
    }),
  ]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.html)
    .join('');
  const surge = game.mode === 'horde' && game.config.surge;
  const canForge = surge && game.forgeOptions().length > 0;
  showOverlay('choose', `
    <h2>${surge ? '⚡ Power surge!' : game.mode === 'horde' ? `Wave ${game.horde.wave} held` : `Floor ${game.floor} cleared`}</h2>
    <p class="sub">${surge ? 'The souls of the slain gather. Claim a relic' : 'Claim a relic from the dead'}<span class="keys-hint"> · ↑↓ to choose, Enter to take, 1-${offer.relics.length + offer.boons.length} to pick, R to rest${canForge ? ', F for the forge' : ''}, Y for your relics</span></p>
    <p class="choice-hp ${low ? 'low' : ''}">❤ ${game.player.hp}/${game.player.maxHp} HP${low ? ' · Low on health. Resting may be the smart pick.' : ''}</p>
    ${tutorial ? `<div class="coach-inline"><span>5 / 5 · Relics</span>${RELIC_COACH}</div>` : ''}
    <div class="offer">${cards}</div>
    ${canForge ? '<button class="btn forge-pick" id="to-forge">🔥 Soul Forge instead<small>Fuse two relics you hold into something greater</small></button>' : ''}
    <button class="btn ${low ? 'rest-urge' : ''}" id="rest">🔥 Rest instead<small>Heal ${offer.restHeal} HP (${game.player.hp}/${game.player.maxHp})</small></button>
    ${yourRelicsBtn()}
  `);
  on('#see-build', () => showBuild('build', showChoice));
  overlay.querySelectorAll<HTMLButtonElement>('.offer button').forEach((b) => {
    b.addEventListener('click', () => pickRelic(Number(b.dataset.i)));
  });
  on('#rest', () => pickRelic(-1));
  on('#to-forge', () => {
    game.hordeForge();
    hideOverlay();
    processEvents();
  });
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

/** Everything on a relic or forge screen the arrow keys step through, top to bottom. */
function choiceButtons(): HTMLButtonElement[] {
  return [...overlay.querySelectorAll<HTMLButtonElement>('#leave-top, .offer button:not(:disabled), #to-forge, #rest, #see-build')];
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
  } else if (e.key === 'f' || e.key === 'F') {
    overlay.querySelector<HTMLButtonElement>('#to-forge')?.click();
  } else if (e.key === 'y' || e.key === 'Y') {
    overlay.querySelector<HTMLButtonElement>('#see-build')?.click();
  } else if (e.key === 'Escape') {
    // Back out of the Horde's forge to the relics.
    if (game.feature?.kind === 'forge' && game.config.surge) resolveEvent(false);
  } else {
    if (!game.offer) return;
    // 1-4 take the cards as they're shown (A to Z), not in offer order.
    const n = Number(e.key);
    const cards = [...overlay.querySelectorAll<HTMLButtonElement>('.offer button[data-i]')];
    if (n >= 1 && n <= cards.length) cards[n - 1].click();
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
        <span class="desc">${known ? relicText(out.desc(1)) : 'Fuse them to discover what they become.'}</span></span>
      </button>`;
    })
    .join('');
  showOverlay('event', `
    <h2>Soul Forge</h2>
    <p class="sub">${FEATURES.forge.text}</p>
    ${deep ? '<p class="fine ascend-note">✨ This deep, the forge burns white-hot: two fused relics can <b>ascend</b> into one.</p>' : ''}
    ${options.length
      ? '<p class="fine">Fusing uses up one of each relic. You can fuse once here.</p>'
      : game.config.deep
        ? '<p class="fine">Nothing you hold will fuse. Stoke the fire instead, and the forge gives you an Abyss boon.</p>'
        : '<p class="fine">None of your relics answer the forge. Fusions need two particular relics held together, like 🔥 Ember Brand and ⚡ Storm Rune.</p>'}
    ${game.config.surge ? '<button class="btn" id="leave-top">↩️ Back to the relics<small>Pick a relic instead</small></button>' : ''}
    <div class="offer event-offer">
      ${cards}
      ${!options.length && game.config.deep ? '<button class="fused" id="stoke"><span class="emoji">🔥</span><span><span class="name">Stoke the forge</span><span class="desc">Gain a random Abyss boon.</span></span></button>' : ''}
      <button class="rare" id="leave"><span class="emoji">${game.config.surge ? '↩️' : '🚶'}</span><span><span class="name">${game.config.surge ? 'Back to the relics' : FEATURES.forge.leave}</span></span></button>
    </div>
    ${yourRelicsBtn()}`);
  on('#leave-top', () => resolveEvent(false));
  on('#see-build', () => showBuild('build', showForge));
  overlay.querySelectorAll<HTMLButtonElement>('.offer button[data-i]').forEach((b) => b.addEventListener('click', () => forgePick(Number(b.dataset.i))));
  on('#stoke', () => resolveEvent(true));
  on('#leave', () => resolveEvent(false));
  (document.activeElement as HTMLElement | null)?.blur();
  choiceShownAt = performance.now();
  // Start on the first fusion, not the Back button above it.
  selectChoice(game.config.surge && options.length ? 1 : 0);
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
  // The name lands letter by letter.
  const letters = [...def.name].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  showOverlay('fused', `
    <div class="fused-reveal ${ascended ? 'ascended' : ''}">
      <div class="fused-stage">
        <canvas class="fused-glow" width="240" height="160" aria-hidden="true"></canvas>
        <div class="fused-emoji">${def.emoji}</div>
      </div>
      ${first ? '<p class="fused-new">✨ New discovery</p>' : ''}
      <p class="fused-kind">${ascended ? 'Ascended relic' : 'Fused relic'}</p>
      <h2 class="fused-name" aria-label="${esc(def.name)}">${letters}</h2>
      <div class="fused-recipe" aria-label="Forged from ${esc(a.name)} and ${esc(b.name)}">
        <span class="fr-a" title="${esc(a.name)}">${a.emoji}</span><span class="fr-op">+</span><span class="fr-b" title="${esc(b.name)}">${b.emoji}</span><span class="fr-op">=</span><span class="fr-out">${def.emoji}</span>
      </div>
      <p class="fused-desc">${esc(relicText(def.desc(1)))}</p>
      <p class="fine fused-from">Forged from ${esc(a.name)} + ${esc(b.name)}</p>
      <p class="fine fused-grants">Counts as: ${grants}</p>
      <button class="btn primary" id="fused-ok">Continue</button>
    </div>`);
  const glow = overlay.querySelector<HTMLCanvasElement>('.fused-glow');
  if (glow) animateReveal(glow, ascended);
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
  const kind = game.feature.kind;
  const note =
    kind === 'shrine' && !can
      ? 'You have too little life left to offer.'
      : game.outOfRelics() && kind === 'shrine'
        ? 'No relics are left to find down here. The shrine gives two Abyss boons instead.'
        : game.outOfRelics() && kind === 'chest'
          ? `No relics are left to find down here. It holds ${game.r('key') ? 'two Abyss boons, and your Skeleton Key opens it cleanly' : 'an Abyss boon'} instead.`
          : kind === 'chest' && game.r('key')
            ? 'Your Skeleton Key opens it cleanly, and it holds two relics.'
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
  // Mark the pick, so it can fly up as the screen leaves.
  overlay.querySelector(i < 0 ? '#rest' : `.offer [data-i="${i}"]`)?.classList.add('picked');
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
  const raidFight = game.mode === 'story' && raidRun;
  const hordeFight = game.mode === 'horde';
  showOverlay('pause', `
    <h2>Paused</h2>
    <p class="sub">${daily ? `Daily #${game.dailyNo}` : story ? esc(story.quest.dungeon.name) : raidFight ? 'The Bell Tolls' : hordeFight ? `Horde #${game.dailyNo}` : 'Endless'} · ${hordeFight ? `Wave ${game.horde.wave}` : `Floor ${game.floor}`}</p>
    ${onlineCountHtml()}
    <button class="btn primary" id="resume">Resume</button>
    <button class="btn" id="help">How to play</button>
    <button class="btn" id="music">🎵 Music: ${isMusicEnabled() ? 'On' : 'Off'}</button>
    <div class="row grid2">
      <button class="btn" id="shake">📳 Screen shake: ${save.shakeOff ? 'Off' : 'On'}</button>
      <button class="btn" id="contrast">🔲 High contrast: ${save.highContrast ? 'On' : 'Off'}</button>
    </div>
    <button class="btn" id="abandon">${hordeFight ? 'End the run<small>Your score so far still counts</small>' : raidFight ? 'End the fight<small>Your damage so far still counts</small>' : `Abandon run<small>${daily ? "Counts as today's attempt" : story ? 'Back to Gravesend' : 'Back to the title'}</small>`}</button>
  `);
  on('#resume', hideOverlay);
  on('#music', () => {
    setMusicEnabled(!isMusicEnabled());
    save.musicOff = !isMusicEnabled();
    writeSave(save);
    const btn = overlay.querySelector('#music');
    if (btn) btn.textContent = `🎵 Music: ${isMusicEnabled() ? 'On' : 'Off'}`;
  });
  on('#shake', () => {
    save.shakeOff = !save.shakeOff;
    writeSave(save);
    applyDisplay();
    const btn = overlay.querySelector('#shake');
    if (btn) btn.textContent = `📳 Screen shake: ${save.shakeOff ? 'Off' : 'On'}`;
  });
  on('#contrast', () => {
    save.highContrast = !save.highContrast;
    writeSave(save);
    applyDisplay();
    const btn = overlay.querySelector('#contrast');
    if (btn) btn.textContent = `🔲 High contrast: ${save.highContrast ? 'On' : 'Off'}`;
  });
  on('#help', () => {
    hideOverlay();
    showHelp(() => {
      hideOverlay();
      showPause();
    });
  });
  on('#abandon', () => {
    if (raidFight) return finishRaid(false);
    if (hordeFight) {
      game.phase = 'dead';
      return finishHorde();
    }
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
      challenge = null;
      hideOverlay();
      newGame('endless');
      showTitle();
    }
  });
}

function showDeath(r: RunResult, best: boolean) {
  const daily = game.mode === 'daily';
  const ch = daily ? null : lastChallenge;
  setMusicDepth(0);
  setMusicMood('fallen');
  showOverlay('death', `
    <img class="hero-portrait ${auraClass(outfitFor(game.hero).aura).cls}" style="${auraClass(outfitFor(game.hero).aura).style}" src="${heroPortrait(game.hero, game.relics, game.relicLog, 8, outfitFor(game.hero).look, outfitFor(game.hero).head)}" alt="Your hero's final form" width="96" height="96" />
    <h2 class="dead">You have fallen</h2>
    <p class="sub">${lastLabel} · slain by ${r.killedBy}</p>
    <div class="strip">${descentStrip(r.floor)}</div>
    <div class="big-stats">
      <div><b>${r.floor}</b>FLOOR</div>
      <div><b>${r.kills}</b>KILLS</div>
      <div><b>${r.turns}</b>TURNS</div>
      ${r.seconds ? `<div><b>${playTime(r.seconds)}</b>TIME</div>` : ''}
    </div>
    ${ONLINE && !ch ? `<p class="rank-line ${daily ? 'daily-rank' : ''}" id="rank">${signedIn() ? 'Carving your name into the crypt…' : daily ? 'Counting the fallen…' : ''}</p>` : ''}
    ${ONLINE && (!signedIn() || unclaimed()) ? claimInlineHtml(ch ? 'Pick a name to post your run to the challenge board. No email needed.' : `You're on ${daily ? "today's" : 'the'} board as ${unclaimed() ? esc(playerName()) : 'a guest'}. Type a name and your runs show under it. No email needed.`) : ''}
    ${r.relics ? `<div class="strip" style="font-size:18px">${r.relics}</div>` : ''}
    ${r.combos ? `<p class="combo-line">${esc(r.combos)}</p>` : ''}
    ${boonLine()}
    ${best ? '<p class="streak">New deepest descent!</p>' : ''}
    ${
      lastReward
        ? `<div class="souls-earned"><b>+${lastReward.souls} Souls</b><span>${lastReward.lines.map(([k, v]) => `${esc(k)} +${v}`).join(' · ')}</span><span>💀 ${meta.souls} to spend in the Ossuary</span></div>`
        : ''
    }
    ${welcomeTrackHtml()}
    ${ch ? challengeResultHtml(r, ch) : ''}
    ${soulRankHtml()}
    ${
      daily
        ? `${streakTeaseHtml()}${tomorrowHtml()}${reminderPromptHtml()}${installNudgeHtml()}${ONLINE ? '<p class="podium-tease">🥇 Finish in the top 3 when the day ends to win exclusive headwear and Souls.</p>' : ''}
    <p class="endless-tease">${
            save.bestEndless
              ? `Daily done. Beat your Endless best of <b>floor ${save.bestEndless}</b>, or hold the crypt in today's Horde.`
              : "Daily done. Endless has no limit, and today's Horde has unlimited tries."
          }<span class="endless-record"></span></p>
    <button class="btn primary" id="again">Endless Descent<small>The crypt never ends. Keep descending.<span class="keys-hint"> · Enter or R</span></small></button>
    ${hordeButtonHtml()}
    ${ONLINE ? `<button class="btn challenge-btn" id="challenge">⚔️ Challenge a friend<small>Today's crypt, your hero. Can they beat floor ${r.floor}?</small></button>` : ''}
    ${discordBtn}
    <div class="row">
      <button class="btn" id="copy">Copy result</button>
    </div>`
        : ch
          ? `<button class="btn primary" id="retry-challenge">⚔️ Try again<small>Same crypt, same hero</small></button>
    <button class="btn" id="pass-challenge">📨 Pass the challenge on<small>Send ${esc(ch.name)}'s crypt to a friend</small></button>
    ${discordBtn}
    <div class="row">
      <button class="btn" id="copy">Copy result</button>
      <button class="btn" id="again">Endless<small class="keys-hint">Enter or R</small></button>
    </div>`
          : `${reminderPromptHtml()}${installNudgeHtml()}
    ${ONLINE ? `<button class="btn challenge-btn" id="challenge">⚔️ Challenge a friend<small>Same crypt, same hero. Can they beat floor ${r.floor}?</small></button>` : ''}
    ${discordBtn}
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
    ${ONLINE ? inviteButtonHtml() : ''}
    ${onlineCountHtml()}
    ${tipNoteHtml()}
    ${followXHtml}
  `);
  const backHere = () => showDeath(r, best);
  on('#leaderboard', () => showLeaderboard(backHere, daily ? 'today' : 'endless'));
  const afterJoin = () => {
    backHere();
    // Joining uploads the queued run; show where it landed.
    if (signedIn() && lastChallenge) {
      const c = lastChallenge;
      void postChallengeRun(c).then(() => fillChallengeBoard(c));
    } else if (signedIn()) {
      setRank('Carving your name into the crypt…');
      void syncNow()
        .then(() => rankLine(daily ? 'daily' : 'endless', game.dailyNo, r.floor))
        .then(setRank)
        .catch(() => setRank(''));
    }
  };
  wireClaimInline(afterJoin, () => showLogin(afterJoin, 'email'));
  const beat = () => (daily ? lastBeat : null);
  on('#challenge', () => makeChallenge(r, backHere));
  on('#retry-challenge', () => ch && startChallenge(ch));
  on('#pass-challenge', () => ch && showChallengeShare(ch.code, `${ch.name} reached floor ${ch.floor}`, backHere, true));
  if (ch) void fillChallengeBoard(ch);
  on('#copy', async () => toast((await copyText(shareText(r, lastLabel, beat()) + '\n' + siteUrl())) ? 'Copied!' : 'Copy failed'));
  on('#again', () => showHeroSelect(() => startRun('endless'), backHere));
  if (daily) wireHordeButton();
  if (daily) showEndlessRecord();
  on('#ossuary', () => showOssuary(backHere));
  on('#hall', () => openHall(backHere));
  on('#invite', () => showInvite(backHere));
  on('#title', () => {
    newGame('endless');
    showTitle();
  });
  on('#remind', async () => {
    const btn = $('remind') as HTMLButtonElement;
    btn.disabled = true;
    const on = '<p class="fine reminder-on">🔔 Reminders on: 8 AM when a new crypt opens, 7 PM if you haven\'t played, and when a rival passes you. Change them in your profile.</p>';
    try {
      if (!signedIn()) {
        // Ask while we still have the tap, then make the account the reminders belong to.
        if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in your browser settings.');
        return showLogin(() => {
          backHere();
          if (!signedIn()) return;
          void syncNow().catch(() => undefined);
          void enableReminders()
            .then(() => {
              const b = document.getElementById('remind');
              if (b) b.outerHTML = on;
              toast('🔔 Reminders on');
            })
            .catch((e) => toast((e as Error).message));
        }, 'claim');
      }
      await enableReminders();
      btn.outerHTML = on;
    } catch (e) {
      btn.disabled = false;
      toast((e as Error).message);
    }
  });
  on('#remind-install', () => showInstallHelp(backHere));
  on('#remind-email', async () => {
    const btn = $('remind-email') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await setEmailReminder(true, timeZone());
      noteEmailReminder(true);
      btn.outerHTML = `<p class="fine reminder-on">📧 We'll email ${esc(session.account?.email ?? 'you')} at 8 AM when a new crypt opens. Turn it off in your profile or from any email.</p>`;
    } catch (e) {
      btn.disabled = false;
      toast((e as Error).message);
    }
  });
  on('#install-nudge', () => {
    if (installMode() === 'ios') return showInstallHelp(backHere);
    void promptInstall().then((ok) => {
      if (ok) toast('Installed! Find One More Crypt on your home screen.');
      backHere();
    });
  });
  tickCountdowns();
}

/** Now and then after a run (the 5th, then every 10th), a quiet thank-you with the tip jar. Never for patrons. */
function tipNoteHtml(): string {
  const runs = runsPlayed();
  if (meta.patron || runs < 5 || runs % 10 !== 5) return '';
  return `<p class="fine tip-note">Thanks for playing. One More Crypt is free with no ads; if you're enjoying it, a <a href="${KOFI_URL}" target="_blank" rel="noopener">☕ tip on Ko-fi</a> keeps the crypt open.</p>`;
}

// ---------- challenge links ----------
// Any Endless run becomes a link; friends play the exact same crypt and hero (the run's
// seed and header) and race its board. Challenge runs never touch the Endless leaderboard.

/** Did this result beat the challenge: deeper, or as deep with more kills, or fewer turns. */
function beats(r: { floor: number; kills: number; turns: number }, c: Challenge): boolean {
  return r.floor !== c.floor ? r.floor > c.floor : r.kills !== c.kills ? r.kills > c.kills : r.turns < c.turns;
}

const challengeUrl = (code: string) => `${siteUrl()}?c=${code}&ref=challenge`;

/** A challenge code from the page's link (?c=CODE), tidied out of the address bar. */
function challengeFromLink(): string | null {
  try {
    const u = new URL(location.href);
    const code = (u.searchParams.get('c') ?? '').toUpperCase();
    if (!u.searchParams.has('c')) return null;
    u.searchParams.delete('c');
    history.replaceState(history.state, '', u.toString());
    return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

function challengeHero(c: Challenge): HeroId {
  return Game.parseLog(c.head).config.hero;
}

/** Someone's challenge, opened from a link: who, how deep, and the board so far. */
function openChallenge(code: string, back: () => void) {
  showOverlay('challenge', '<h2>⚔️ A challenge</h2><p class="sub">Opening the crypt…</p>');
  void getChallenge(code)
    .then((c) => {
      if (screen !== 'challenge') return;
      if (!c) {
        showOverlay('challenge', '<h2>⚔️ A challenge</h2><p class="sub">That challenge doesn\'t exist. The link may be mistyped.</p><button class="btn primary" id="back">Back</button>');
        on('#back', back);
        return;
      }
      // A challenge on today's Daily crypt would let you scout it first, so the Daily comes first.
      const today = dailyNumber();
      if (Number(c.seed) === hashSeed('cryptfall-daily', today) && !save.daily[today]) {
        showOverlay('challenge', `
          <h2>⚔️ ${esc(c.name)} challenges you</h2>
          <p class="sub"><b>${esc(c.name)}</b> reached <b>floor ${c.floor}</b> in today's Daily crypt.</p>
          <p class="fine">Play your own Daily #${today} first, then open this link again to take them on.</p>
          <button class="btn primary" id="play-daily">Play Daily #${today}</button>
          <button class="btn" id="back">Not now</button>`);
        on('#play-daily', () => {
          const resumable = savedRun();
          if (resumable?.mode === 'daily') resumeRun(resumable);
          else withTutorialOffer(() => startRun('daily'));
        });
        on('#back', back);
        return;
      }
      const hero = challengeHero(c);
      const unfinished = savedRun();
      showOverlay('challenge', `
        <h2>⚔️ ${esc(c.name)} challenges you</h2>
        <img class="hero-portrait" src="${heroPortrait(hero, {}, [], 8)}" alt="" width="96" height="96" />
        <p class="sub"><b>${esc(c.name)}</b> reached <b>floor ${c.floor}</b> (${c.kills} kills) as the ${esc(HERO_BY_ID[hero].name)}.</p>
        <p class="fine">Same crypt, same hero, same relics on offer. Can you go deeper?${heroUnlocked(hero) ? '' : ` You'll borrow the ${esc(HERO_BY_ID[hero].name)} for this run.`}</p>
        <ol class="challenge-board" id="challenge-board"><li class="fine">Loading the board…</li></ol>
        <button class="btn primary" id="accept">⚔️ Accept the challenge<small>${c.players ? `${c.players} ${c.players === 1 ? 'player has' : 'players have'} tried` : 'Be the first to try'}</small></button>
        ${unfinished ? `<p class="fine">This replaces your unfinished run on floor ${unfinished.floor}.</p>` : ''}
        <button class="btn" id="back">Not now</button>`);
      on('#accept', () => startChallenge(c));
      on('#back', back);
      void fillChallengeBoard(c);
    })
    .catch((e) => {
      showOverlay('challenge', `<h2>⚔️ A challenge</h2><p class="sub">${esc((e as Error).message)}</p><button class="btn primary" id="back">Back</button>`);
      on('#back', back);
    });
}

function startChallenge(c: Challenge) {
  unlockAudio();
  void pingActivity(true);
  const { config } = Game.parseLog(c.head);
  challenge = c;
  showGame(new Game('endless', Number(c.seed), 0, config));
  noteRun('endless', 'start');
  startClock();
  saveRun();
  setMusicDepth(game.floor, game.zone.def.key);
  setMusicMood(game.isBossFloor() ? 'boss' : 'crypt');
  hideOverlay();
  sfx.stairs();
  renderer.banner(`BEAT FLOOR ${c.floor}`, '#f2c14e');
}

/** Post a finished challenge run to its board (signed-in players). True once it's there. */
async function postChallengeRun(c: Challenge): Promise<boolean> {
  if (!ONLINE || !signedIn() || !lastResult) return false;
  try {
    await submitChallengeRun(c.code, { floor: lastResult.floor, kills: lastResult.kills, turns: lastResult.turns, log: game.header() + game.log });
    return true;
  } catch (e) {
    toast((e as Error).message);
    return false;
  }
}

function challengeResultHtml(r: RunResult, c: Challenge): string {
  const won = beats(r, c);
  const gap = Math.abs(r.floor - c.floor);
  const line = won
    ? gap
      ? `You beat <b>${esc(c.name)}</b> by ${gap} floor${gap === 1 ? '' : 's'}!`
      : `You beat <b>${esc(c.name)}</b> on the same floor!`
    : gap
      ? `<b>${esc(c.name)}</b> still leads by ${gap} floor${gap === 1 ? '' : 's'}.`
      : `<b>${esc(c.name)}</b> edges it on the same floor.`;
  return `<div class="challenge-box ${won ? 'won' : ''}">⚔️ ${line}<small>Floor ${r.floor} vs ${c.floor}</small></div>
    <ol class="challenge-board" id="challenge-board"><li class="fine">Loading the board…</li></ol>`;
}

/** Fill the challenge board on whatever screen shows one. */
async function fillChallengeBoard(c: Challenge) {
  let rows: ChallengeRow[] = [];
  try {
    rows = await challengeBoard(c.code);
  } catch {
    rows = [];
  }
  const el = document.getElementById('challenge-board');
  if (!el) return;
  const me = session.account?.id;
  el.innerHTML = rows.length
    ? rows
        .slice(0, 10)
        .map(
          (row) => `<li class="${row.user_id === me ? 'me' : ''}"><span>${row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}</span>
            <span class="who">${esc(row.name)}${row.creator ? ' <em class="title-tag">challenger</em>' : ''}</span>
            <span class="fl">F${row.floor}<small>${row.kills} kills</small></span></li>`,
        )
        .join('')
    : '<li class="fine">No board yet.</li>';
}

/** Make a challenge from the run just finished, then share it. */
function makeChallenge(r: RunResult, back: () => void) {
  if (!signedIn() || unclaimed()) {
    toast('Claim a name first, so your friends know who challenged them.');
    showLogin(back);
    return;
  }
  const btn = document.getElementById('challenge') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  void createChallenge({ seed: game.seed, head: game.header(), floor: r.floor, kills: r.kills, turns: r.turns, log: game.log })
    .then((code) => showChallengeShare(code, `floor ${r.floor} as the ${HERO_BY_ID[game.hero].name}`, back))
    .catch((e) => {
      if (btn) btn.disabled = false;
      toast((e as Error).message);
    });
}

/** Share a challenge link: the phone's share sheet, copy, or X. */
function showChallengeShare(code: string, line: string, back: () => void, passing = false) {
  const url = challengeUrl(code);
  const text = passing
    ? `⚔️ ${line} in One More Crypt. Same crypt, same hero: can you beat it?`
    : `⚔️ I reached ${line} in One More Crypt. Same crypt, same hero: can you beat me?`;
  const native = typeof navigator.share === 'function';
  showOverlay('challenge-share', `
    <h2>⚔️ ${passing ? 'Pass it on' : 'Your challenge'}</h2>
    <p class="sub">Send this link. Whoever opens it plays the exact same crypt.</p>
    <input class="challenge-link" readonly value="${esc(url)}" aria-label="Challenge link" />
    ${native ? '<button class="btn primary" id="native-share">📤 Share</button>' : ''}
    <button class="btn ${native ? '' : 'primary'}" id="copy-link">🔗 Copy link</button>
    <p class="fine">You'll hear about it here when someone beats you.</p>
    <button class="btn" id="back">Back</button>`);
  on('#native-share', () => void navigator.share({ title: 'One More Crypt challenge', text, url }).catch(() => undefined));
  on('#copy-link', async () => toast((await copyText(`${text}\n${url}`)) ? 'Link copied!' : 'Copy failed'));
  on('#back', back);
}

let challengeNewsChecked = false;

/** Once a visit: who beat your challenges since you last looked. */
function checkChallengeNews() {
  if (challengeNewsChecked || !ONLINE || !signedIn()) return;
  challengeNewsChecked = true;
  const since = meta.challengeSeen || new Date(Date.now() - 7 * 86_400_000).toISOString();
  void challengeNews(since).then((rows) => {
    if (!rows.length) return;
    const first = rows[0];
    toast(
      rows.length === 1
        ? `⚔️ ${first.name} beat your challenge: floor ${first.floor} vs your ${first.my_floor}.`
        : `⚔️ ${rows.length} players beat your challenges, led by ${first.name} on floor ${first.floor}.`,
    );
    noteChallengeSeen(rows[0].at);
  });
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
/** The Abyss boons a deep run gathered, if any. */
function boonLine(): string {
  const taken = (Object.entries(game.boons) as [keyof typeof game.boons, number][]).filter(([, n]) => n > 0);
  return taken.length ? `<p class="combo-line">Abyss boons: ${taken.map(([id, n]) => `${BOON_BY_ID[id].emoji}×${n}`).join(' ')}</p>` : '';
}

/** Seven Nights on the results screen: the seven gifts, today's marked, and what tomorrow brings. */
function welcomeTrackHtml(): string {
  const w = meta.welcome;
  if (!lastWelcome && w.claimed >= WELCOME.length) return '';
  const slots = WELCOME.map((r, i) => {
    const day = i + 1;
    const state = day <= w.claimed ? (lastWelcome?.day === day ? 'today' : 'got') : day === w.claimed + 1 ? 'next' : '';
    return `<span class="wn-slot ${state}" title="Day ${day}: ${esc(welcomeLabel(r).name)}"><i>${day <= w.claimed ? '✓' : welcomeLabel(r).icon}</i><small>${day}</small></span>`;
  }).join('');
  const next = welcomeNext();
  const waiting = welcomeWaiting(dailyNumber());
  const line = waiting
    ? `Finish a run today to claim day ${waiting.day}: <b>${esc(welcomeLabel(waiting.reward).name)}</b>.`
    : next
      ? `Come back tomorrow for day ${next.day}: <b>${esc(welcomeLabel(next.reward).name)}</b>.`
      : 'All seven nights claimed. The crown and title are yours.';
  const head = lastWelcome ? `🎁 Seven Nights · day ${lastWelcome.day} claimed: ${esc(welcomeLabel(lastWelcome.reward).name)}` : '🎁 Seven Nights';
  return `<div class="welcome-track"><b>${head}</b><div class="wn-slots">${slots}</div><p>${line}</p></div>`;
}

/** Seven Nights on the title screen: a gift waiting today, or tomorrow's. */
function welcomeTitleHtml(): string {
  const waiting = welcomeWaiting(dailyNumber());
  if (waiting) return `<div class="welcome-title">🎁 <b>Day ${waiting.day} gift waiting:</b> ${esc(welcomeLabel(waiting.reward).name)}. Finish any run to claim it.</div>`;
  const next = welcomeNext();
  if (next && meta.welcome.claimed > 0) return `<div class="welcome-title quiet">🎁 Tomorrow: day ${next.day} of Seven Nights, ${esc(welcomeLabel(next.reward).name)}</div>`;
  return '';
}

function streakTeaseHtml(): string {
  const { current } = streakStats(save, dailyNumber());
  const next = STREAK_HELMS.find(([n]) => n > meta.streak.best);
  const days = current === 1 ? 'Day 1 of your streak.' : `🕯️ ${current}-day streak.`;
  if (!next) return `<p class="streak">${days} Every streak helm is yours.</p>`;
  const [n, , name] = next;
  const left = n - current;
  return `<p class="streak">${days} ${left} more day${left === 1 ? '' : 's'} in a row for the <b>${esc(name)}</b>.</p>`;
}

/** After a run: offer a reminder for tomorrow's crypt (anyone; reminders need an account, made on the way). */
function reminderPromptHtml(): string {
  if (!ONLINE || reminderPrefs()) return '';
  if (remindersAvailable()) return '<button class="btn remind-cta" id="remind">🔔 Remind me when tomorrow\'s crypt opens<small>8 AM your time. Skipped on days you\'ve played.</small></button>';
  // No notifications here (iPhone Safari, in-app browsers): email, for accounts that have one.
  if (session.account?.email && !emailReminderOn()) return '<button class="btn remind-cta" id="remind-email">📧 Email me when tomorrow\'s crypt opens<small>8 AM your time. Skipped on days you\'ve played.</small></button>';
  if (remindersNeedInstall()) return '<button class="link-btn" id="remind-install">📲 Install the app to get a reminder when the next crypt opens</button>';
  return '';
}

/** App players come back far more often: after a run, suggest installing it. */
function installNudgeHtml(): string {
  const mode = installMode();
  if (!mode) return '';
  return '<button class="btn" id="install-nudge">📲 Install One More Crypt<small>Play from your home screen, full screen, one tap a day</small></button>';
}

const EMAIL_REM_KEY = 'omc:email-reminders';
function emailReminderOn(): boolean {
  try {
    return localStorage.getItem(EMAIL_REM_KEY) === session.account?.id;
  } catch {
    return false;
  }
}
function noteEmailReminder(on: boolean) {
  try {
    if (on && session.account) localStorage.setItem(EMAIL_REM_KEY, session.account.id);
    else localStorage.removeItem(EMAIL_REM_KEY);
  } catch {
    // Private mode: the button may show again; turning it on twice is harmless.
  }
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

function tickCountdowns() {
  const text = formatCountdown(msUntilNextDaily());
  overlay.querySelectorAll('.countdown').forEach((el) => (el.textContent = text));
}
setInterval(tickCountdowns, 1000);

// ---------- The Bell Tolls (world boss) ----------
// A few times a day a boss rises for everyone at once. Each fight is a short arena (a story-mode
// game, so it's never saved or uploaded as a run); the damage dealt lands on one shared bar.

let raidRun: { slot: RaidSlot } | null = null;
/** The shared bar for the toll under way, as last fetched. */
let raidLive: { id: string; state: RaidState } | null = null;
let raidPhaseSeen = '';
let raidPolledAt = 0;

type RaidPhase = { slot: RaidSlot; phase: 'open' | 'closing' | 'soon' };

function raidPhase(now = Date.now()): RaidPhase {
  const slot = currentRaid(now);
  if (slot) return { slot, phase: raidJoinable(slot, now) ? 'open' : 'closing' };
  return { slot: nextRaid(now), phase: 'soon' };
}

function raidStateFor(id: string): RaidState | null {
  return raidLive?.id === id ? raidLive.state : null;
}

/** The arena boss in your own fight. */
function raidDamage(g: Game, kind: RaidSlot['kind']): number {
  const boss = g.enemies.find((e) => e.kind === kind && !e.ally);
  return boss ? Math.max(0, boss.maxHp - Math.max(0, boss.hp)) : 0;
}

const raidLeft = (st: RaidState | null) => (st ? (st.felled ? 0 : Math.max(0, st.hp - st.damage)) : null);
const raidPct = (st: RaidState | null) => (st ? Math.round(((raidLeft(st) ?? 0) / st.hp) * 100) : 100);

function raidClockText(p: RaidPhase, now = Date.now()): string {
  if (p.phase === 'soon') return formatCountdown(p.slot.start - now);
  const end = p.slot.start + (p.phase === 'open' ? RAID_JOIN_MIN : RAID_SUBMIT_MIN) * 60_000;
  return formatCountdown(end - now).replace(/^00:/, '');
}

function raidPlayersText(st: RaidState | null): string {
  if (!st) return 'Gathering';
  return st.players === 1 ? '1 fighting' : `${st.players} fighting`;
}

/** The title screen's card: live and loud while a boss is up, a countdown otherwise. */
function raidCardHtml(p: RaidPhase): string {
  if (!ONLINE) return '';
  const name = esc(raidBossName(p.slot.kind));
  const st = raidStateFor(p.slot.id);
  if (p.phase === 'soon') {
    return `<button class="btn raid-btn" id="raid">🔔 The Bell Tolls: World Boss<small>Everyone fights at ${esc(raidTimeLabel(p.slot.start))} · in <span data-raid-clock>${raidClockText(p)}</span> · ${raidWins()}/${RAID_REWARDS.length} rewards</small></button>`;
  }
  const felled = st?.felled;
  return `<button class="btn raid-btn live" id="raid">🔔 ${felled ? `${name} has fallen!` : p.phase === 'open' ? `LIVE: ${name} has risen` : `${name}: last blows landing`}<small>${
    felled ? 'Everyone who fought earns a reward' : `<span data-raid-players>${raidPlayersText(st)}</span> · ${p.phase === 'open' ? 'open for' : 'ends in'} <span data-raid-clock>${raidClockText(p)}</span>`
  }</small><span class="raid-mini"><span data-raid-fill style="width:${raidPct(st)}%"></span></span></button>`;
}

function raidFeedHtml(st: RaidState | null): string {
  if (!st?.feed.length) return '<li class="fine">No blows yet. Be the first.</li>';
  return st.feed.map((f) => `<li>${HERO_BY_ID[f.hero as HeroId] ? `<img src="${heroPortrait(f.hero as HeroId, {}, [], 2)}" alt="" width="24" height="24" />` : ''}<b>${esc(f.name)}</b> hit for <b>${f.damage}</b></li>`).join('');
}

function raidTopHtml(st: RaidState | null): string {
  if (!st?.top.length) return '';
  return st.top.map((t, i) => `<li><span>${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${esc(t.name)}</span><b>${t.damage}</b></li>`).join('');
}

function raidBarHtml(st: RaidState | null): string {
  const left = raidLeft(st);
  return `<div class="raid-bar"><div data-raid-fill style="width:${raidPct(st)}%"></div><span data-raid-text>${st ? (st.felled ? 'FALLEN' : `${left} / ${st.hp}`) : '…'}</span></div>`;
}

/** Fill in the live numbers wherever they're shown. */
function paintRaid() {
  const p = raidPhase();
  const st = raidStateFor(p.slot.id);
  overlay.querySelectorAll<HTMLElement>('[data-raid-clock]').forEach((el) => (el.textContent = raidClockText(p)));
  if (!st) return;
  overlay.querySelectorAll<HTMLElement>('[data-raid-fill]').forEach((el) => (el.style.width = `${raidPct(st)}%`));
  overlay.querySelectorAll<HTMLElement>('[data-raid-text]').forEach((el) => (el.textContent = st.felled ? 'FALLEN' : `${raidLeft(st)} / ${st.hp}`));
  overlay.querySelectorAll<HTMLElement>('[data-raid-players]').forEach((el) => (el.textContent = raidPlayersText(st)));
  overlay.querySelectorAll<HTMLElement>('[data-raid-feed]').forEach((el) => (el.innerHTML = raidFeedHtml(st)));
  overlay.querySelectorAll<HTMLElement>('[data-raid-top]').forEach((el) => (el.innerHTML = raidTopHtml(st)));
  if (raidRun && game) updateHud();
}

async function refreshRaid() {
  const slot = currentRaid();
  if (!ONLINE || !slot) return;
  raidPolledAt = Date.now();
  const st = await raidState(slot.id).catch(() => null);
  if (!st) return;
  const wasFelled = raidStateFor(slot.id)?.felled;
  raidLive = { id: slot.id, state: st };
  paintRaid();
  if (st.felled && !wasFelled) {
    if (screen === 'title') showTitle();
    else if (screen === 'raid') showRaid(showTitle);
  }
}

/** Every second: clocks, a fresh look at the bar while a boss is up, and redraws when a toll starts or ends. */
function raidTick() {
  if (!ONLINE) return;
  const p = raidPhase();
  const key = `${p.slot.id}:${p.phase}`;
  if (raidPhaseSeen && key !== raidPhaseSeen) {
    if (screen === 'title') showTitle();
    else if (screen === 'raid') showRaid(showTitle);
    if (p.phase === 'soon') void checkRaidRewards();
  }
  raidPhaseSeen = key;
  paintRaid();
  const watching = screen === 'title' || screen === 'raid' || raidRun;
  if (p.phase !== 'soon' && watching && Date.now() - raidPolledAt > 5000) void refreshRaid();
}
setInterval(raidTick, 1000);

/** The world boss panel: the live fight, or when the next one is and what it gives. */
function showRaid(back: () => void) {
  const p = raidPhase();
  const name = esc(raidBossName(p.slot.kind));
  const st = raidStateFor(p.slot.id);
  const wins = raidWins();
  const next = RAID_REWARDS[wins];
  const after = nextRaid(p.phase === 'soon' ? p.slot.start : Date.now());
  const upcoming = [after.start, nextRaid(after.start).start];
  const live = p.phase !== 'soon';
  const rewards = RAID_REWARDS.map((r) => `<li class="${r.n <= wins ? 'got' : r.n === wins + 1 ? 'next' : ''}" title="${esc(RAID_KIND_LABEL[r.kind])}"><span>${r.n <= wins ? '✓' : r.n === wins + 1 ? '▶' : '🔒'}</span>${esc(r.name)}<small>${esc(RAID_KIND_LABEL[r.kind])}</small></li>`).join('');
  showOverlay('raid', `
    <canvas class="raid-art" id="raid-art" width="320" height="150" aria-label="${name}"></canvas>
    <p class="act2-kicker">${live ? (st?.felled ? 'Fallen' : 'Live now') : 'World boss'}</p>
    <h2 class="act2-title">The Bell Tolls</h2>
    ${live
      ? `<p class="sub"><b>${name}</b> has risen. Everyone fights it at once, and every hit lands on one shared health bar. Bring it down before the bell falls silent, and everyone who fought earns a reward.</p>
        ${raidBarHtml(st)}
        <p class="fine raid-meta"><span data-raid-players>${raidPlayersText(st)}</span> · ${p.phase === 'open' ? 'join for' : 'ends in'} <span data-raid-clock>${raidClockText(p)}</span></p>
        ${st?.felled ? `<p class="act2-ready">☠️ ${name} has fallen! Everyone who fought earns a reward.</p>` : ''}
        ${p.phase === 'open' && !st?.felled ? `<button class="btn primary" id="raid-join">⚔️ Join the fight<small>${RAID_TURNS} turns against ${name}. Your hero, 4 relics to start. Fight as often as you like.</small></button>` : ''}
        <h3 class="shop-head">Latest blows</h3>
        <ul class="raid-feed" data-raid-feed>${raidFeedHtml(st)}</ul>
        <h3 class="shop-head">Top damage</h3>
        <ol class="raid-top" data-raid-top>${raidTopHtml(st)}</ol>`
      : `<p class="sub">Three times a day a world boss rises for everyone at once. Join in and fight it together for a reward you can't get anywhere else.</p>
        <p class="act2-ready">Next: <b>${esc(raidBossName(p.slot.kind))}</b> at ${esc(raidTimeLabel(p.slot.start))} · in <span data-raid-clock>${raidClockText(p)}</span></p>
        <p class="fine">Then ${upcoming.map((t) => esc(raidTimeLabel(t))).join(' and ')}. Times are in your time zone. You can join for the first ${RAID_JOIN_MIN} minutes.</p>`}
    <h3 class="shop-head">Bell-Breaker rewards <small>${wins}/${RAID_REWARDS.length}</small></h3>
    <p class="fine">${next ? `Each boss that falls earns you the next one. Next up: <b>${esc(next.name)}</b> (${esc(RAID_KIND_LABEL[next.kind])}).` : 'You have every Bell-Breaker reward. The crypt bows.'}</p>
    <ul class="raid-rewards">${rewards}</ul>
    <button class="btn" id="back">Back</button>`);
  on('#raid-join', () => showHeroSelect(() => startRaid(p.slot), () => showRaid(back), `The Bell Tolls · ${raidBossName(p.slot.kind)}`));
  on('#back', back);
  drawRaidArt($('raid-art') as HTMLCanvasElement, p.slot.kind);
  if (live) void refreshRaid();
}

/** The boss, big, under a swinging bell, with a red glow that pulses on the toll. */
function drawRaidArt(cv: HTMLCanvasElement, kind: RaidSlot['kind']) {
  const ctx = cv.getContext('2d')!;
  const spr = sprites()[kind].normal;
  const W = cv.width, H = cv.height;
  const t0 = performance.now();
  const frame = (now: number) => {
    if (screen !== 'raid' || !cv.isConnected) return;
    const t = (now - t0) / 1000;
    const toll = (t % 3) / 3;
    const bg = ctx.createRadialGradient(W / 2, H * 0.7, 10, W / 2, H * 0.7, W * 0.7);
    bg.addColorStop(0, `rgba(160,40,50,${0.55 + Math.max(0, 0.3 - toll)})`);
    bg.addColorStop(1, '#0b0710');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, 0);
    ctx.rotate(Math.sin(t * 2.1) * 0.1);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(-2, 0, 4, 10);
    ctx.fillRect(-12, 10, 24, 6);
    ctx.fillRect(-16, 16, 32, 8);
    ctx.fillRect(-20, 24, 40, 6);
    ctx.restore();
    if (toll < 0.4) {
      ctx.strokeStyle = `rgba(242,193,78,${0.4 - toll})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(W / 2, 30, 20 + toll * 300, 6 + toll * 80, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.imageSmoothingEnabled = false;
    const s = 8;
    const bob = Math.round(Math.sin(t * 2) * 2);
    ctx.drawImage(spr, W / 2 - (spr.width * s) / 2, 44 + bob, spr.width * s, spr.height * s);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function startRaid(slot: RaidSlot) {
  if (!raidJoinable(slot)) {
    toast('The bell has gone quiet. Catch the next toll.');
    return showRaid(showTitle);
  }
  unlockAudio();
  const { seed, config } = raidConfig(slot, meta.hero);
  raidRun = { slot };
  storyRun = null;
  challenge = null;
  noteRaidJoin(slot.id);
  showGame(new Game('story', seed, 0, config));
  startClock();
  setMusicDepth(game.floor);
  setMusicMood('boss');
  hideOverlay();
  sfx.stairs();
  renderer.banner(`${raidBossName(slot.kind).toUpperCase()} RISES`, '#f2c14e');
  void refreshRaid();
}

/** The fight is over (fallen, out of turns, or walked away): land the damage on the shared bar. */
function finishRaid(fell: boolean) {
  const run = raidRun;
  if (!run) return showTitle();
  raidRun = null;
  const dmg = raidDamage(game, run.slot.kind);
  const streak = streakStats(save, dailyNumber());
  const reward = finishRunMeta(game, streak.current);
  celebrate(reward.achievements);
  celebrateNotes(reward.unlocks);
  setMusicMood(fell ? 'fallen' : 'crypt');
  window.clearTimeout(overlayTimer);
  const name = raidBossName(run.slot.kind);
  const show = (st: RaidState | null, err = '') => {
    const p = raidPhase();
    const again = p.phase === 'open' && p.slot.id === run.slot.id && !st?.felled;
    showOverlay('raid-result', `
      <div class="podium-medal">${fell ? '💀' : '🔔'}</div>
      <h2 class="podium-title">${fell ? 'You fell' : 'The bell rings you out'}</h2>
      <p class="sub">You dealt <b>${dmg}</b> damage to ${esc(name)}.</p>
      <div class="souls-earned"><b>+${reward.souls} Souls</b><span>💀 ${meta.souls} to spend in the Ossuary</span></div>
      ${err ? `<p class="form-status">${esc(err)}</p>` : st ? raidBarHtml(st) : '<p class="fine">Landing your blows…</p>'}
      ${st?.felled ? `<p class="act2-ready">☠️ ${esc(name)} has fallen! Everyone who fought earns a reward.</p>` : st ? `<p class="fine raid-meta"><span data-raid-players>${raidPlayersText(st)}</span> · keep it up, the bar is shared</p>` : ''}
      ${again ? '<button class="btn primary" id="raid-again">⚔️ Fight again<small>Same boss, same crypt. Every hit counts.</small></button>' : ''}
      <button class="btn" id="raid-watch">🔔 Watch the bar</button>
      <button class="btn" id="back">Back to the title</button>`);
    on('#raid-again', () => showHeroSelect(() => startRaid(run.slot), () => showRaid(showTitle), `The Bell Tolls · ${name}`));
    on('#raid-watch', () => showRaid(showTitle));
    on('#back', showTitle);
    if (st?.felled) void checkRaidRewards();
  };
  overlayTimer = window.setTimeout(() => show(null), fell ? 900 : 300);
  void raidHit(run.slot.id, raidPlayer(session.account?.id), playerName() || 'A wanderer', game.hero, dmg)
    .then((st) => {
      raidLive = { id: run.slot.id, state: st };
      window.clearTimeout(overlayTimer);
      show(st);
    })
    .catch((e: Error) => {
      window.clearTimeout(overlayTimer);
      show(null, e.message);
    });
}

let raidChecking = false;
/** Tolls you fought in that are now decided: a felled boss pays the next reward. */
async function checkRaidRewards() {
  if (!ONLINE || raidChecking) return;
  raidChecking = true;
  try {
    const live = currentRaid();
    for (const id of unsettledRaids()) {
      const st = raidStateFor(id) ?? (await raidState(id).catch(() => null));
      if (!st) continue;
      if (st.felled) {
        const n = settleRaid(id, true);
        if (n) await new Promise<void>((done) => showRaidReward(n, done));
      } else if (live?.id !== id) settleRaid(id, false);
    }
  } finally {
    raidChecking = false;
  }
}

/** A world boss felled together: here's your piece. */
function showRaidReward(n: number, then: () => void) {
  const r = RAID_REWARDS[n - 1];
  const back = () => {
    then();
    if (screen === 'raid-reward') showTitle();
  };
  if (!r) {
    toast('☠️ The world boss has fallen! You hold every Bell-Breaker reward.');
    return then();
  }
  const fit = outfitFor(meta.hero);
  const aura = r.kind === 'aura' ? auraClass(r.id) : auraClass(fit.aura);
  const preview =
    r.kind === 'decor'
      ? `<div class="podium-medal">${RAID_DECOR_BY_ID[r.id]?.emoji ?? '🏰'}</div>`
      : `<img class="hero-portrait ${aura.cls}" style="${aura.style}" src="${heroPortrait(meta.hero, {}, [], 8, r.kind === 'look' ? r.id : fit.look, r.kind === 'head' ? r.id : fit.head)}" alt="" width="96" height="96" />`;
  sfx.relic();
  showOverlay('raid-reward', `
    <div class="podium-medal">☠️</div>
    <h2 class="podium-title">The world boss has fallen!</h2>
    <p class="sub">You brought it down together. Bell-Breaker reward ${n} of ${RAID_REWARDS.length}:</p>
    ${preview}
    <p class="act2-ready"><b>${esc(RAID_KIND_LABEL[r.kind])}: ${esc(r.name)}</b></p>
    ${r.kind === 'decor' ? `<p class="fine">${esc(RAID_DECOR_BY_ID[r.id]?.desc ?? '')} It now stands in your Crypt Hall.</p>` : ''}
    ${r.kind === 'decor' ? '<button class="btn primary" id="raid-use">🏰 See your Hall</button>' : `<button class="btn primary" id="raid-use">Wear it now<small>On your ${esc(HERO_BY_ID[meta.hero].name)}</small></button>`}
    <button class="btn" id="back">Continue</button>`);
  on('#raid-use', () => {
    if (r.kind === 'decor') {
      then();
      return openHall(showTitle);
    }
    equipOutfit(meta.hero, r.kind, r.id);
    toast(`Your ${HERO_BY_ID[meta.hero].name} wears ${r.name}`);
    back();
  });
  on('#back', back);
}

// ---------- Horde ----------
// One arena a day, the same for everyone, with the day's hero. Waves pour in; kills on turn
// after turn build a multiplier. Unlimited tries: your best score of the day goes on the board.

// ---------- gifts from the Crypt Keeper ----------

let giftChecking = false;
let lastGiftCheck = 0;

/** On the title screen, now and then: has the Crypt Keeper sent this player something? */
async function checkGifts() {
  if (!ONLINE || giftChecking || screen !== 'title' || Date.now() - lastGiftCheck < 20_000) return;
  lastGiftCheck = Date.now();
  giftChecking = true;
  try {
    const gifts = (await waitingGifts()).filter((g) => GIFT_BY_ID[g.item]);
    if (!gifts.length || screen !== 'title') return;
    const item = gifts[0].item;
    receiveGift(item);
    // The same item sent twice is still one gift.
    for (const g of gifts.filter((x) => x.item === item)) void claimGift(g.id);
    showGift(item);
  } finally {
    giftChecking = false;
  }
}

/** The surprise: your hero, wearing the gift, turning in its light. */
function showGift(item: string) {
  const gift = GIFT_BY_ID[item];
  const aura = gift.aura ? AURA_BY_ID[gift.aura] : null;
  const head = gift.head ? HEAD_BY_ID[gift.head] : null;
  const title = gift.title ? TITLE_BY_ID[gift.title] : null;
  const parts = [
    head ? `<li>🎩 <b>${esc(head.name)}</b>: headwear</li>` : '',
    aura ? `<li>✨ <b>${esc(aura.name)}</b>: an aura</li>` : '',
    title ? `<li>📜 <b>${esc(title.name)}</b>: a title for your name</li>` : '',
  ].join('');
  sfx.relic();
  showOverlay('gift', `
    <div class="gift-burst" aria-hidden="true"></div>
    <h2 class="gift-title">🎁 A gift from the Crypt Keeper</h2>
    <canvas id="gift-hero" class="gift-hero" width="160" height="176" aria-label="Your hero wearing ${esc(gift.name)}"></canvas>
    <p class="sub">You've been chosen. <b class="gift-name">${esc(gift.name)}</b> is yours.</p>
    <p class="fine">${esc(gift.why)}</p>
    ${head || title ? `<ul class="podium-rewards">${parts}</ul>` : ''}
    <p class="fine">Find it in the Wardrobe any time. Cosmetic only.</p>
    <button class="btn primary" id="wear">✨ Wear it now</button>
    <button class="btn" id="back">Later</button>`);
  const canvas = overlay.querySelector<HTMLCanvasElement>('#gift-hero');
  if (canvas) {
    const ctx = canvas.getContext('2d')!;
    const outfit = outfitFor(meta.hero);
    const sprite = heroSprite(meta.hero, {}, [], outfit.look, gift.head ?? outfit.head).normal;
    const auraId = gift.aura ?? outfit.aura;
    const start = performance.now();
    const frame = () => {
      if (!canvas.isConnected) return;
      const t = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      drawAura(ctx, auraId, 80, 150, 96, t, 'back');
      ctx.globalAlpha = 1;
      ctx.drawImage(sprite, 32, 54, 96, 96);
      drawAura(ctx, auraId, 80, 150, 96, t, 'front');
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  on('#wear', () => {
    if (gift.aura) equipOutfit(meta.hero, 'aura', gift.aura);
    if (gift.head) equipOutfit(meta.hero, 'head', gift.head);
    if (gift.title) equipTitle(gift.title);
    toast(`Your ${HERO_BY_ID[meta.hero].name} wears ${gift.name}`);
    showTitle();
  });
  on('#back', () => showTitle());
}

setInterval(() => {
  if (!document.hidden) void checkGifts();
}, 30_000);

// ---------- your build, and the last few turns ----------

/** What happened, turn by turn, for the report: the newest last. */
let turnLog: { turn: number; lines: string[] }[] = [];
const LOG_TURNS = 4;

const HIT_BY: Record<string, string> = {
  melee: 'You hit', pierce: 'Your shot hit', burn: 'Burning hurt', thorns: 'Thorns hit', bolt: 'Your wisp hit',
  burst: 'A bursting corpse hit', whirl: 'Your Whirling Blade hit', hellfire: 'Hellfire hit', spike: 'Spikes hit',
  mask: 'Your Plague Mask hit', ally: 'Your thrall hit', claw: 'A foe clawed', orbit: 'Your Whirling Skulls hit', dart: 'A bone dart hit',
};

function foeName(id: number, fallen: Map<number, string>): string {
  const e = game.enemies.find((x) => x.id === id);
  // Foes slain this turn are already cleared away: name them from their death.
  if (!e) return fallen.get(id) ?? 'a foe';
  const name = ENEMY_INFO[e.kind].name;
  if (e.ally) return `your thrall ${name}`;
  return e.elite ? `the ${ELITES[e.elite].name} ${name}` : name;
}

/** Turn this turn's events into plain lines for the report. */
function noteTurn(events: GameEvent[]) {
  const lines: string[] = [];
  const fallen = new Map<number, string>();
  for (const ev of events) if (ev.t === 'kill') fallen.set(ev.id, ENEMY_INFO[ev.kind].name);
  for (const ev of events) {
    if (ev.t === 'hit') lines.push(`⚔️ ${HIT_BY[ev.kind] ?? 'Hit'} ${foeName(ev.id, fallen)} for ${ev.amount}${ev.crit ? ' (critical, ×3)' : ''}`);
    else if (ev.t === 'kill') lines.push(`☠️ ${ev.ally ? 'Your thrall' : ENEMY_INFO[ev.kind].name} ${ev.ally ? 'fell' : 'was slain'}`);
    else if (ev.t === 'hurt') lines.push(`💔 ${ev.src ? `${ev.src[0].toUpperCase()}${ev.src.slice(1)}` : 'Something'} hit you for ${ev.amount}`);
    else if (ev.t === 'dodge') lines.push(`💨 You dodged ${ev.src ?? 'a blow'}`);
    else if (ev.t === 'block') lines.push(`🛡️ Your shield blocked ${ev.src ?? 'a blow'}`);
    else if (ev.t === 'heal' && ev.amount > 0) lines.push(`💚 You healed ${ev.amount}`);
    else if (ev.t === 'revive') lines.push('✨ Death denied: you rose again');
    else if (ev.t === 'potion') lines.push('🧪 You drank a potion');
    else if (ev.t === 'timestop') lines.push('⏳ Time stopped: every foe frozen');
    else if (ev.t === 'summon') lines.push('🦴 A boss raised a minion');
    else if (ev.t === 'relic') lines.push(`🎁 Took ${RELIC_BY_ID[ev.id].name}`);
  }
  if (!lines.length) return;
  const last = turnLog[turnLog.length - 1];
  if (last && last.turn === game.turns) last.lines.push(...lines);
  else turnLog.push({ turn: game.turns, lines });
  if (turnLog.length > LOG_TURNS) turnLog = turnLog.slice(-LOG_TURNS);
}

/** Your build at a glance, or the last few turns blow by blow. */
/** A button to look over the relics and boons you hold, from a choice screen. */
function yourRelicsBtn(): string {
  const n = new Set(game.relicLog).size;
  return n ? `<button class="link-btn" id="see-build">📜 Your relics (${n})</button>` : '';
}

/** Your build and the last turns. From a relic or forge screen, `back` returns to it. */
function showBuild(tab: 'build' | 'log', back?: () => void) {
  if (game.phase !== 'play' && !back) return;
  const g = game;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const crit = Math.min(1, 0.15 * g.r('dice'));
  const healKill = g.r('fang') + g.boons.mend;
  const stat = (label: string, value: string, note = '') => `<div class="build-stat"><b>${value}</b><span>${label}</span>${note ? `<small>${note}</small>` : ''}</div>`;
  const stats = [
    stat('Attack', String(g.atk)),
    stat('Health', `${g.player.hp}/${g.player.maxHp}`),
    stat('Critical', crit ? pct(crit) : '–', crit ? '×3 damage' : ''),
    stat('Dodge', g.dodgeChance() ? pct(g.dodgeChance()) : '–'),
    stat('Hits on you', g.r('scale') || g.r('moon') ? `${g.r('scale') ? `−${g.r('scale')}` : ''}${g.r('moon') ? ' +1' : ''}` : '–', g.r('scale') ? 'never below 1' : ''),
    stat('Shields', `${g.shield}`, `${g.r('mirror') + g.boons.ward} a floor`),
    stat('Heal per kill', healKill ? `+${healKill}` : '–'),
  ].join('');
  const hero = HERO_BY_ID[g.hero];
  const owned = [...new Set(g.relicLog)].map((id) => {
    const def = RELIC_BY_ID[id];
    const n = g.r(id);
    return `<li><span class="build-emoji">${def.emoji}</span><span><b>${esc(def.name)}${n > 1 ? ` ×${n}` : ''}</b><small>${esc(relicText(def.desc(n)))}</small></span></li>`;
  }).join('');
  const boons = (Object.keys(g.boons) as (keyof typeof g.boons)[]).filter((id) => g.boons[id] > 0).map((id) => {
    const b = BOON_BY_ID[id];
    return `<li><span class="build-emoji">${b.emoji}</span><span><b>${esc(b.name)}${g.boons[id] > 1 ? ` ×${g.boons[id]}` : ''}</b><small>${esc(b.desc)}</small></span></li>`;
  }).join('');
  const log = turnLog.length
    ? [...turnLog].reverse().map((t) => `<div class="log-turn"><h4>Turn ${t.turn}${t.turn === g.turns ? ' · just now' : ''}</h4><ul>${t.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')
    : '<p class="fine">Nothing has happened yet. Make a move.</p>';
  showOverlay('build', `
    <h2>📜 ${tab === 'build' ? 'Your build' : 'Last turns'}</h2>
    ${tab === 'log' ? '<p class="fine">The last few turns where something happened, newest first. Quiet steps are left out.</p>' : ''}
    <div class="tabs" role="tablist">
      <button role="tab" id="tab-build" aria-selected="${tab === 'build'}">Build</button>
      <button role="tab" id="tab-log" aria-selected="${tab === 'log'}">Last turns</button>
    </div>
    ${tab === 'build'
      ? `<div class="build-stats">${stats}</div>
    <p class="fine build-perk"><b>${esc(hero.name)}</b>: ${esc(hero.perkDesc)}</p>
    ${owned ? `<h3 class="shop-head">Relics</h3><ul class="build-list">${owned}</ul>` : '<p class="fine">No relics yet.</p>'}
    ${boons ? `<h3 class="shop-head">Abyss boons</h3><ul class="build-list">${boons}</ul>` : ''}`
      : `<div class="build-log">${log}</div>`}
    <button class="btn primary" id="back">${back ? 'Back to the choice' : 'Back to the crypt'}</button>`);
  on('#tab-build', () => showBuild('build', back));
  on('#tab-log', () => showBuild('log', back));
  on('#back', () => (back ? back() : hideOverlay()));
}

/** Cloaks, headwear and auras that come with these achievements, to announce. */
function featCosmetics(ids: string[]): { icon: string; title: string; detail: string }[] {
  const won = (u: object | undefined) => Boolean(u && 'feat' in u && ids.includes((u as { feat: string }).feat));
  return [
    ...LOOKS.filter((l) => won(l.unlock)).map((l) => ({ icon: '🧥', title: l.name, detail: 'New cloak in the Wardrobe' })),
    ...HEADS.filter((x) => won(x.unlock)).map((x) => ({ icon: '🪖', title: x.name, detail: 'New headwear in the Wardrobe' })),
    ...AURAS.filter((a) => won(a.unlock)).map((a) => ({ icon: '✨', title: a.name, detail: 'New aura in the Wardrobe' })),
  ];
}

/** Relic text for the run under way: in the Horde, what works floor by floor works wave by wave. */
function relicText(text: string): string {
  if (game?.mode !== 'horde') return text;
  return text
    .replace(/when you enter a floor/g, 'when each wave starts')
    .replace(/Entering a floor deals (\d+) damage to all foes/g, 'Each new wave takes $1 damage as it arrives')
    .replace(/until the floor ends/g, 'until the next wave')
    .replace(/Every 3rd floor you enter/g, 'Every 3rd wave')
    .replace(/\bfloors\b/g, 'waves')
    .replace(/\bfloor\b/g, 'wave');
}

/** The Horde button wears a NEW badge until this date. */
const HORDE_NEW_UNTIL = Date.UTC(2026, 10, 17);

function hordeButtonHtml(): string {
  const n = dailyNumber();
  const h = meta.horde.day === n ? meta.horde : null;
  const saved = savedHorde();
  if (saved) {
    const g = saved.game;
    return `<button class="btn horde-btn" id="horde">🛡️ Continue Horde #${n}<small>Wave ${g.horde.wave} · ${g.horde.score.toLocaleString()} pts · ${g.player.hp}/${g.player.maxHp} HP</small></button>
      <button class="link-btn horde-new" id="horde-new">Start a new Horde run</button>`;
  }
  // A "NEW" badge for the first weeks of the mode.
  const fresh = Date.now() < HORDE_NEW_UNTIL;
  return `<button class="btn horde-btn" id="horde">${fresh ? '<span class="new-badge">NEW</span>' : ''}🛡️ Horde #${n}<small>${
    h ? `Your best today: wave ${h.wave} · ${h.best.toLocaleString()} pts` : `Hold the crypt as the ${HERO_BY_ID[hordeHero(n)].name} · unlimited tries`
  }</small></button>`;
}

/** The Horde button (on the title and after the Daily): continue today's run, or start one. */
function wireHordeButton() {
  on('#horde', () => {
    const saved = savedHorde();
    if (saved) resumeHorde(saved.game, saved.seconds);
    else withTutorialOffer(() => startHorde());
  });
  on('#horde-new', () => {
    if (!window.confirm('Start over? Your unfinished Horde run will be lost.')) return;
    startHorde();
  });
}

function startHorde() {
  unlockAudio();
  clearHordeRun();
  const n = dailyNumber();
  challenge = null;
  storyRun = null;
  raidRun = null;
  showGame(new Game('horde', hashSeed('horde', n), n, { hero: hordeHero(n), pool: fullPool(), mercy: true, boons: true, surge: true, waves: true, magnet: true, armory: true, arsenal: true, volley: true, ...(n >= FAIR_DAILY ? { fair: true } : {}) }));
  startClock();
  setMusicDepth(1);
  setMusicMood('crypt');
  hideOverlay();
  sfx.stairs();
  renderer.banner('HOLD THE CRYPT', '#f2c14e');
}

/** Back into today's Horde run, where it was left. */
function resumeHorde(g: Game, seconds: number) {
  unlockAudio();
  challenge = null;
  storyRun = null;
  raidRun = null;
  startClock(seconds);
  showGame(g);
  setMusicDepth(1);
  setMusicMood('crypt');
  hideOverlay();
  sfx.stairs();
  renderer.banner(`WAVE ${g.horde.wave}`, '#f2c14e');
  if (g.phase === 'choose') showChoice();
  else if (g.phase === 'event') showEvent();
}

/** The run is over: score, Souls, today's best, and the day's board. */
function finishHorde() {
  clearHordeRun();
  const g = game;
  const h = g.horde;
  const reward = finishHordeMeta(g.dailyNo, h.score, h.wave, g.kills, g.hordeFeats());
  celebrate(reward.feats);
  celebrateNotes(featCosmetics(reward.feats.map((f) => f.id)));
  setMusicMood('fallen');
  window.clearTimeout(overlayTimer);
  const share = `🛡️ One More Crypt · Horde #${g.dailyNo}\nWave ${h.wave} · ${h.score.toLocaleString()} pts · ×${h.bestMult} combo\nCan you hold the crypt longer?\n${siteUrl()}?ref=horde`;
  overlayTimer = window.setTimeout(() => {
    showOverlay('horde-results', `
      <div class="podium-medal">🛡️</div>
      <h2 class="podium-title">${reward.best ? 'New best!' : 'The crypt is overrun'}</h2>
      <p class="sub">Horde #${g.dailyNo} · the ${esc(HERO_BY_ID[g.hero].name)}${g.killedBy ? ` · slain by ${esc(killedByPhrase(g.killedBy))}` : ''}</p>
      <div class="horde-score"><b>${h.score.toLocaleString()}</b><span>points</span></div>
      <div class="run-stats">
        <div><b>${h.wave}</b><span>Wave</span></div>
        <div><b>${g.kills}</b><span>Kills</span></div>
        <div><b>×${h.bestMult}</b><span>Best combo</span></div>
      </div>
      <p class="fine">Today's best: wave ${meta.horde.wave} · ${meta.horde.best.toLocaleString()} pts</p>
      <div class="souls-earned"><b>+${reward.souls} Souls</b><span>💀 ${meta.souls} to spend in the Ossuary</span></div>
      <button class="btn primary" id="horde-again">🛡️ Go again<small>Same arena, same hero</small></button>
      ${ONLINE ? `<h3 class="shop-head">Today's Horde board</h3><p class="fine" id="horde-rank">Posting your run…</p><ol class="raid-top" id="horde-board"><li class="fine">Loading…</li></ol>` : ''}
      <button class="btn" id="horde-copy">Copy result</button>
      ${ONLINE && (!signedIn() || unclaimed()) ? claimInlineHtml(`You're on today's Horde board as ${unclaimed() ? esc(playerName()) : 'a guest'}. Type a name and your runs show under it.`) : ''}
      <button class="btn" id="title">Title</button>`);
    on('#horde-again', () => startHorde());
    on('#horde-copy', async () => toast((await copyText(share)) ? 'Copied!' : 'Copy failed'));
    // Once named, the board reloads with the new name on it, and the box goes.
    wireClaimInline(() => {
      document.getElementById('claim-form')?.remove();
      if (ONLINE) void loadHordeBoard(g, false);
    }, () => showLogin(() => showTitle(), 'email'));
    on('#title', () => {
      newGame('endless');
      showTitle();
    });
    if (ONLINE) void loadHordeBoard(g, reward.best);
  }, 900);
}

async function loadHordeBoard(g: Game, best: boolean) {
  const rank = document.getElementById('horde-rank');
  // Players without a name go on the board as a guest they can claim later.
  if (best && (signedIn() || (await ensureGuest()))) {
    const posted = await submitHorde({ daily_no: g.dailyNo, score: g.horde.score, wave: g.horde.wave, kills: g.kills, hero: g.hero, log: g.header() + g.log }).catch(() => null);
    if (rank?.isConnected) rank.textContent = posted ? `You're #${posted.rank} today.` : 'Could not post your run. Your best is saved here.';
  } else if (signedIn() && rank) rank.textContent = 'Only your best run of the day goes on the board.';
  const rows = await hordeBoard(g.dailyNo).catch(() => null);
  const list = document.getElementById('horde-board');
  if (!list) return;
  list.innerHTML = rows?.length
    ? rows.slice(0, 10).map((r, i) => {
        const hero = (HERO_BY_ID[r.hero as HeroId] ? r.hero : 'knight') as HeroId;
        const look = r.outfit_look && LOOK_BY_ID[r.outfit_look] ? r.outfit_look : '';
        const head = r.outfit_head && HEAD_BY_ID[r.outfit_head] ? r.outfit_head : '';
        const aura = auraClass(r.outfit_aura);
        return `<li><span>${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} <img class="board-hero ${aura.cls}" style="${aura.style}" src="${heroPortrait(hero, {}, [], 2, look, head)}" alt="" width="20" height="20" /> ${esc(r.name)} <small>wave ${r.wave}</small></span><b>${r.score.toLocaleString()}</b></li>`;
      }).join('')
    : '<li class="fine">No one on the board yet. Be the first.</li>';
}

// ---------- Bring a friend ----------
// Each named player has a link (?invite=NAME). A new player who arrives through it and finishes a
// run counts for them: both get the Kindred Cloak, and more friends bring more.

const INVITE_LADDER: { n: number; what: string }[] = [
  { n: 1, what: '🎨 Kindred Cloak (your friend gets one too)' },
  { n: 3, what: '✨ Kindred Flame, an aura' },
  { n: 5, what: '🎩 Lantern Hood, headwear' },
  { n: 10, what: '📜 The Crypt Crier, a golden title' },
];

const inviteUrl = (name: string) => `${siteUrl()}?invite=${encodeURIComponent(name)}&ref=invite`;

function inviteButtonHtml(): string {
  const n = meta.invite.friends;
  return `<button class="btn invite-btn" id="invite">👥 Bring a friend<small>${n ? `${n} friend${n === 1 ? '' : 's'} brought · ` : ''}You both get the Kindred Cloak</small></button>`;
}

/** ?invite=NAME: a friend sent you. Counted once you finish a run (new players only). */
function inviteFromLink() {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has('invite')) return;
    const name = (u.searchParams.get('invite') ?? '').trim().slice(0, 24);
    u.searchParams.delete('invite');
    history.replaceState(history.state, '', u.toString());
    if (!name || name.toLowerCase() === playerName().toLowerCase()) return;
    if (save.totals.runs > 2 || meta.invite.claimed || meta.invite.from) return;
    noteInvitedBy(name);
    window.setTimeout(() => toast(`👥 ${name} invited you! Finish a run: you both get a cloak.`), 1500);
  } catch {
    // A broken link: nothing to remember.
  }
}

/** After a run: if a friend invited you, this run counts for them (once). */
async function claimInviteIfDue() {
  const from = meta.invite.from;
  if (!ONLINE || !from || meta.invite.claimed) return;
  try {
    const name = await claimInvite(from);
    settleInvite(Boolean(name));
    if (name) {
      sfx.relic();
      toast(`👥 You and ${name} both earned the Kindred Cloak! Wear it from the Wardrobe.`);
    }
  } catch {
    // Offline: try again after the next run.
  }
}

/** Friends who've played since last time: say so, and what it unlocked. */
async function checkFriends() {
  const n = await myInvites().catch(() => null);
  if (n === null) return;
  const before = meta.invite.friends;
  const fresh = noteFriends(n);
  if (!fresh) return;
  const reward = INVITE_LADDER.filter((r) => r.n > before && r.n <= n).map((r) => r.what.replace(/ \(.*\)$/, ''));
  toast(`👥 ${fresh === 1 ? 'A friend you invited' : `${fresh} friends you invited`} just played!${reward.length ? ` Unlocked: ${reward.join(', ')}.` : ''}`);
  if (screen === 'title') showTitle();
}

/** Your link, what it earns, and how many friends it has brought. */
function showInvite(back: () => void) {
  // An invite link carries your name, so a guest picks one first.
  const name = signedIn() && !unclaimed() ? playerName() : '';
  const n = meta.invite.friends;
  const url = name ? inviteUrl(name) : '';
  const text = `I've been playing One More Crypt: a free daily roguelike in your browser. One crypt, one try a day. Come down with me:`;
  showOverlay('invite', `
    <h2>👥 Bring a friend</h2>
    <p class="sub">Send a friend your link. When they finish their first run, you <b>both</b> get the Kindred Cloak, and every friend you bring counts toward more.</p>
    <img class="hero-portrait aura-glow" style="--aura:#ffb35a" src="${heroPortrait(meta.hero, {}, [], 8, 'kindred', outfitFor(meta.hero).head)}" alt="Your hero in the Kindred Cloak" width="96" height="96" />
    <ul class="invite-ladder">
      ${INVITE_LADDER.map((r) => `<li class="${n >= r.n ? 'got' : ''}"><span>${n >= r.n ? '✓' : `${Math.min(n, r.n)}/${r.n}`}</span>${esc(r.what)}</li>`).join('')}
    </ul>
    ${name
      ? `<div class="invite-link"><input id="invite-url" type="text" readonly value="${esc(url)}" aria-label="Your invite link" /></div>
        <button class="btn primary" id="invite-share">📤 Share your link</button>
        <button class="btn" id="invite-copy">📋 Copy link</button>
        <p class="fine">Friends brought so far: <b>${n}</b>. A friend counts once they finish a run; it can take a moment to show up here. Only new players count.</p>`
      : `<p class="fine">Pick a name and sign in to get your own link, so friends know who sent them.</p>
        <button class="btn primary" id="invite-join">Get my link</button>`}
    <button class="btn" id="back">Back</button>`);
  on('#invite-join', () => showLogin(() => showInvite(back), 'claim'));
  on('#invite-copy', async () => toast((await copyText(url)) ? 'Link copied!' : 'Copy failed'));
  on('#invite-share', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'One More Crypt', text, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    toast((await copyText(`${text} ${url}`)) ? 'Invite copied! Paste it to a friend.' : 'Copy failed');
  });
  on('#back', back);
  if (name) void checkFriends();
}

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

/** Story mode: Act I, The Bell Beneath, open to everyone. */
function storyOpen(): boolean {
  return true;
}

/** Grave Shift is open to everyone. */
function graveShiftOpen(): boolean {
  return true;
}

// The Night Shift is still being tested: only its tester (JSTN) sees it.
const NIGHT_TESTERS = ['ad5d6ad6-bd7b-4952-a0cb-9917d15909fd'];

function nightShiftOpen(): boolean {
  // Local development only (never in a real build): a switch for testing it.
  if (import.meta.env.DEV && localStorage.getItem('omc:night-test')) return true;
  return Boolean(session.account && NIGHT_TESTERS.includes(session.account.id));
}

// ---------- news for returning players ----------

const NEWS_KEY = 'omc:news';
const NEWS_ID = 'story-act1';

/** Has this player played before (so the news is news), and not yet seen it? */
function newsWaiting(): boolean {
  if (save.totals.runs === 0 && !save.tutorialDone) return false;
  try {
    return localStorage.getItem(NEWS_KEY) !== NEWS_ID;
  } catch {
    return false;
  }
}

function markNewsSeen() {
  try {
    localStorage.setItem(NEWS_KEY, NEWS_ID);
  } catch {
    // Private mode: it may show again next time, which is harmless.
  }
}

/** Finished Act I before the Bell-Ringer existed: tell them it's theirs. */
function bellNewsWaiting(): boolean {
  if (!storyDone(STORY_ALL)) return false;
  try {
    return localStorage.getItem('omc:news-bell') !== '1';
  } catch {
    return false;
  }
}

function showBellNews() {
  try {
    localStorage.setItem('omc:news-bell', '1');
    localStorage.setItem(NEWS_KEY, NEWS_ID);
  } catch {
    // Private mode: it may show again, which is harmless.
  }
  showOverlay('news', `
    <p class="news-tag">🔔 For finishing Act I</p>
    <h2>The Bell-Ringer is yours</h2>
    <img class="hero-portrait aura-glow" style="--aura:#c9a24a" src="${heroPortrait('bellringer', {}, [], 8, 'bellvestment', 'bellhelm')}" alt="The Bell-Ringer" width="96" height="96" />
    <p class="fine">A new hero, only for those who finished every quest of The Bell Beneath. Every 6th turn their bell rings, striking and stunning every foe beside them.</p>
    <ul class="news-list">
      <li>✨ The Great Bell: an aura, a tolling bell above your head</li>
      <li>🎨 Bell-Ringer's Vestment and 🎩 The Bell Helm</li>
      <li>📜 New titles: The Bell-Ringer and Hero of Gravesend</li>
      <li>🏰 The Great Bell now hangs in your Hall</li>
    </ul>
    <button class="btn primary" id="news-play">🔔 Play the Bell-Ringer<small>Endless Descent</small></button>
    <button class="btn" id="news-later">Later</button>`);
  on('#news-play', () => {
    meta.hero = 'bellringer';
    saveMeta();
    startRun('endless');
  });
  on('#news-later', showTitle);
}

/** Finished Act I's story: Act II Part 1 is open, and Mortimer has found the lid. */
function actTwoNewsWaiting(): boolean {
  if (!act2Open() || !meta.story.done.includes(4) || meta.story.done.includes(21)) return false;
  try {
    return localStorage.getItem('omc:news-act2') !== '1';
  } catch {
    return false;
  }
}

function showActTwoNews() {
  try {
    localStorage.setItem('omc:news-act2', '1');
    localStorage.setItem(NEWS_KEY, NEWS_ID);
  } catch {
    // Private mode: it may show again, which is harmless.
  }
  showOverlay('news', `
    <p class="news-tag">🔔 For finishing Act I</p>
    <h2>Act II · Part 1 is open</h2>
    <img class="hero-portrait story-face" src="${facePortrait('ambrose')}" alt="Brother Ambrose" width="96" height="96" />
    <p class="fine">The ground by the Warden's tower has sunk, and a great stone lid shows through the grass. Aldric is somewhere below it. Mortimer is waiting for you.</p>
    <ul class="news-list">
      <li>⛪ The Sunken Cloister, and Brother Ambrose</li>
      <li>📜 2 quests and 3 side quests</li>
      <li>🌫️ Plague mist, plague monks, a hold-out and a sleeping dormitory</li>
      <li>🎁 Story-only rewards: 3 cloaks, a mask, an aura and 4 titles</li>
      <li>🏅 Open the lid before 12 November: <b>First Down the Lid</b></li>
    </ul>
    <button class="btn primary story-btn" id="news-play">📖 Go to Mortimer<small>Knock on his door</small></button>
    <button class="btn" id="news-later">Later</button>`);
  on('#news-play', () => {
    placeAtCottage();
    playStory();
  });
  on('#news-later', showTitle);
}

/** On opening the game: Act I of the story is out. */
function showStoryNews() {
  markNewsSeen();
  showOverlay('news', `
    <p class="news-tag">✨ New in One More Crypt</p>
    <h2>📖 Story mode is open</h2>
    <p class="sub">Act I · The Bell Beneath</p>
    <img class="hero-portrait" src="${heroPortrait(meta.hero, {}, [], 8, outfitFor(meta.hero).look, outfitFor(meta.hero).head)}" alt="" width="96" height="96" />
    <p class="fine">Every midnight a bell tolls under the graveyard, and the whole crypt shuffles its furniture. Someone is ringing it. Help Mortimer the gravedigger find out who.</p>
    <ul class="news-list">
      <li>🗺️ Walk Gravesend and the Hollow, and meet its people</li>
      <li>⚔️ Four story quests and three side quests, each with its own crypt and boss</li>
      <li>🐕 Take in a crypt hound that fights beside you</li>
      <li>🎁 Story-only rewards: 5 cloaks, 4 headpieces, 5 auras and 9 titles, never sold</li>
      <li>🔔 Finish all of Act I to unlock a new hero: the Bell-Ringer</li>
    </ul>
    <button class="btn primary story-btn" id="news-play">📖 Begin the story<small>Knock on Mortimer's door</small></button>
    <button class="btn" id="news-later">Later<small>It's on the title screen whenever you're ready</small></button>`);
  on('#news-play', () => playStory());
  on('#news-later', showTitle);
}

/** A compact square on the title screen: an icon, a name and one short line. */
function titleTile(id: string, icon: string, name: string, sub: string, cls = ''): string {
  return `<button class="tile ${cls}" id="${id}"><span class="tile-icon">${icon}</span><span class="tile-name">${name}</span><small>${sub}</small></button>`;
}

function graveTileHtml(): string {
  if (!graveShiftOpen()) return titleTile('graveshift', '🌾', 'Grave Shift', 'Coming soon', 'soon');
  const s = meta.grave;
  if (!s) return titleTile('graveshift', '🌾', 'Grave Shift', 'New: tend the old plot', 'graveshift-new');
  const now = Date.now();
  const ripe = s.plots.filter((p) => CROP_BY_ID[p.crop] && isRipe(p, now)).length;
  const restless = s.graves.filter((g) => now >= g).length;
  // What's waiting out there, so there's a reason to look in.
  const waiting = [ripe ? `🌱 ${ripe} ready` : '', restless ? `👻 ${restless} restless` : ''].filter(Boolean).join(' · ');
  return titleTile('graveshift', '🌾', 'Grave Shift', waiting || `🪙 ${s.obols} Obols`, waiting ? 'graveshift-ready' : '');
}

function storyTileHtml(): string {
  const main = MAIN_QUESTS.filter((q) => meta.story.done.includes(q.n)).length;
  const next = MAIN_QUESTS.find((q) => !meta.story.done.includes(q.n));
  const two = ACT2_MAIN.filter((q) => meta.story.done.includes(q.n)).length;
  const sub = next
    ? main ? `Act I · ${main}/${MAIN_QUESTS.length}` : 'Start Act I'
    : !act2Open() ? 'Act II opens Friday'
    : two === ACT2_MAIN.length ? 'Act II · Part 2 soon' : two ? `Act II · ${two}/${ACT2_MAIN.length}` : 'Act II is open';
  return titleTile('story', '📖', 'Story', sub, 'story-tile');
}

/** The Act II teaser: what's under the lid, and a way to tell us what you want down there. */
function showActTwo(back: () => void) {
  const open = act2Open();
  const ready = open && meta.story.done.includes(4);
  showOverlay('act2', `
    <canvas class="act2-art" id="act2-art" width="320" height="200" aria-label="The Plague Abbot in green fog, a great bell behind him"></canvas>
    <p class="act2-kicker">${open ? 'Part 1 open' : 'Part 1 opens this Friday'}</p>
    <h2 class="act2-title">Act II: The Plague Abbot</h2>
    <p class="act2-quote">"It was never a door. It was a lid."</p>
    <p class="sub">Beneath the Warden's lid lies the Sunken Cloister, where the Abbot's monks still keep their vigil. Someone rings the bell every night now. The graves of Gravesend grow restless, a green sickness creeps up the wells, and Aldric is somewhere below.</p>
    <ul class="act2-list">
      <li>⛪ <b>${open ? 'Open now' : 'Friday'}:</b> the Sunken Cloister and Brother Ambrose</li>
      <li>📜 2 quests and 3 side quests</li>
      <li>🌫️ Plague mist: it hides the monks and bites if you linger</li>
      <li>🕯️ Vespers: hold out against four waves of the choir</li>
      <li>💤 The Dormitory: sneak past the sleeping monks</li>
      <li>✨ New story-only cloaks, a mask, an aura and titles</li>
      <li>🔔 <b>Part 2:</b> the bell shaft, the Plague Abbot and Aldric's fate</li>
    </ul>
    ${!open
      ? `<p class="act2-ready">🔔 The lid opens this Friday, 30 October. ${meta.story.done.includes(4) ? 'You finished Act I: you will be among the first down.' : "Finish Act I's main story before then to be among the first down."}</p>${meta.story.done.includes(4) ? '' : '<button class="btn story-btn" id="act2-story">📖 Continue Act I</button>'}`
      : ready
      ? `<p class="act2-ready">🔔 Mortimer has found a lid. Open it before 12 November for <b>First Down the Lid</b>.</p><button class="btn primary story-btn" id="act2-story">📖 Go to Mortimer</button>`
      : `<p class="act2-ready">Finish Act I's main story first: the Bone Warden waits.</p><button class="btn story-btn" id="act2-story">📖 Continue Act I</button>`}
    <button class="btn" id="act2-idea">💡 Tell us what you want in Part 2</button>
    ${discordBtn}
    <button class="btn" id="back">Back</button>`);
  on('#act2-story', () => {
    if (ready && !meta.story.done.includes(21) && !meta.story.active.includes(21)) placeAtCottage();
    playStory();
  });
  on('#act2-idea', () => showFeedback(() => showActTwo(back), 'idea', 'What would you love to see in Act II Part 2? A quest, a monster, a reward, anything.'));
  on('#back', back);
  animateActTwo($('act2-art') as HTMLCanvasElement);
}

/** Fog, a swaying bell and the Abbot, until the panel closes. */
function animateActTwo(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!;
  const abbot = sprites().abbot.normal;
  const W = cv.width, H = cv.height;
  const motes = Array.from({ length: 26 }, (_, i) => ({ x: (i * 53) % W, y: 120 + ((i * 37) % 80), r: 18 + ((i * 13) % 26), v: 0.15 + (i % 5) * 0.06 }));
  const t0 = performance.now();
  const frame = (now: number) => {
    if (screen !== 'act2' || !cv.isConnected) return;
    const t = (now - t0) / 1000;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0a0f0b');
    sky.addColorStop(1, '#14261a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // The bell, swinging slowly behind everything.
    const swing = Math.sin(t * 0.9) * 0.12;
    ctx.save();
    ctx.translate(W / 2, 8);
    ctx.rotate(swing);
    ctx.fillStyle = '#1f2a22';
    ctx.fillRect(-2, 0, 4, 22);
    ctx.beginPath();
    ctx.moveTo(-26, 30);
    ctx.quadraticCurveTo(-30, 82, -54, 96);
    ctx.lineTo(54, 96);
    ctx.quadraticCurveTo(30, 82, 26, 30);
    ctx.quadraticCurveTo(0, 16, -26, 30);
    ctx.fill();
    ctx.fillStyle = '#2c3b30';
    ctx.fillRect(-54, 92, 108, 5);
    ctx.restore();
    // A toll every few seconds: a ring of green light.
    const toll = (t % 4) / 4;
    if (toll < 0.5) {
      ctx.strokeStyle = `rgba(140,220,120,${0.5 - toll})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(W / 2, 100, 30 + toll * 260, 10 + toll * 70, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The Abbot, bobbing in the mist.
    ctx.imageSmoothingEnabled = false;
    const s = 9;
    const bob = Math.round(Math.sin(t * 2) * 2);
    ctx.fillStyle = 'rgba(120,220,110,0.18)';
    ctx.beginPath();
    ctx.ellipse(W / 2, 182, 46, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(abbot, W / 2 - (abbot.width * s) / 2, 76 + bob, abbot.width * s, abbot.height * s);
    // Glowing eyes on the toll.
    if (toll < 0.25) {
      ctx.fillStyle = `rgba(170,255,140,${0.8 - toll * 3})`;
      ctx.fillRect(W / 2 - 18, 76 + bob + 4 * s, 6, 6);
      ctx.fillRect(W / 2 + 9, 76 + bob + 4 * s, 6, 6);
    }
    // Plague mist drifting across the floor.
    for (const m of motes) {
      const x = ((m.x + t * m.v * 40) % (W + 80)) - 40;
      const g = ctx.createRadialGradient(x, m.y, 0, x, m.y, m.r);
      g.addColorStop(0, 'rgba(110,190,100,0.22)');
      g.addColorStop(1, 'rgba(110,190,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
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
    q.n === 1 ? "🎨 Gravedigger's Coat: a new cloak. 📜 New title: Gravedigger's Apprentice."
    : q.n === 2 ? `🐕 ${esc(petName(meta.story.choices.hound))} the Crypt Hound joins you. It trots behind you everywhere (it only fights in the story). 🎨 Houndhide: a new cloak. 📜 New title: Friend of Hounds.`
    : q.n === 3 ? "🎨 Aldric's Mantle: a new cloak. ✨ Spectral Vigil: a new aura. 📜 New title: Aldric's Squire."
    : q.n === 4 ? "🎩 The Warden's Keys: new headwear. ✨ Toll of the Bell: a new aura. 📜 New title: Bell-Seeker."
    : q.n === 11 ? "🎨 The Widow's Shawl: a new cloak. ✨ Wishing Well: a new aura. 📜 New title: Ring Finder."
    : q.n === 12 ? "🎩 Smith's Goggles: new headwear. 📜 New title: Coal Runner."
    : q.n === 13 ? "🎩 Bess's Kerchief: new headwear. 📜 New title: Tavern Regular."
    : q.n === 21 ? "⛪ The Sunken Cloister is open: take the old stair at the bottom of the chapel grounds. 🎨 Monk's Habit: a new cloak. 📜 New title: Down the Lid."
    : q.n === 22 ? '✨ Vespers Candles: a new aura. 📜 New title: Brother of the Cloister.'
    : q.n === 31 ? '🎨 The Plague Coat: a new cloak.'
    : q.n === 32 ? "🎩 The Physician's Mask: new headwear. 📜 New title: Physician."
    : q.n === 33 ? '🎨 The Choir Robe: a new cloak. 📜 New title: Keeper of the Hymn.'
    : '';
  // The last quest of the act: the Bell-Ringer and everything that comes with them.
  const actDone = !q.act && storyDone(STORY_ALL);
  const act = actDone
    ? `<div class="act-done">
        <b>🔔 Act I complete</b>
        <img class="hero-portrait aura-glow" style="--aura:#c9a24a" src="${heroPortrait('bellringer', {}, [], 8, 'bellvestment', 'bellhelm')}" alt="The Bell-Ringer" width="96" height="96" />
        <p><b>The Bell-Ringer</b> joins your heroes. Every 6th turn their bell rings, striking and stunning every foe beside them. Choose them for Endless.</p>
        <ul>
          <li>✨ The Great Bell: an aura, a tolling bell above your head</li>
          <li>🎨 Bell-Ringer's Vestment and 🎩 The Bell Helm</li>
          <li>📜 Titles: The Bell-Ringer and Hero of Gravesend</li>
          <li>✨ Light of Gravesend: an aura</li>
          <li>🏰 The Great Bell now hangs in your Hall</li>
        </ul>
      </div>`
    : '';
  sfx.relic();
  showOverlay('story-won', `
    <div class="podium-medal">${q.side ? '📜' : '🔔'}</div>
    <h2 class="podium-title">${esc(q.title)}</h2>
    <p class="sub">${q.side ? 'Side quest complete' : 'Quest complete'}</p>
    <div class="souls-earned"><b>+${result.souls} Souls</b><span>💀 ${meta.souls} to spend in the Ossuary</span></div>
    ${unlocked ? `<p class="talk-quip">${unlocked}</p>` : ''}
    ${act}
    ${q.n === 4 || actDone ? `<p class="talk-quip">${act2Open() ? 'Act II: The Plague Abbot is open. Mortimer has found a lid.' : 'Act II: The Plague Abbot opens this Friday.'}</p><button class="btn act2-btn" id="act2">🔔 About Act II</button>` : ''}
    ${q.act && ACT2_QUESTS.every((x) => meta.story.done.includes(x.n)) ? '<p class="talk-quip">That is all of Act II, Part 1. The bell shaft opens in Part 2.</p>' : ''}
    <button class="btn primary" id="back">Continue</button>`);
  on('#act2', () => showActTwo(then));
  on('#back', then);
}

/** A dungeon's door in the world: open once its quest is taken, barred until then. */
function dungeonDoor(n: number): { open: boolean; title: string; text: string } {
  const q = QUEST_BY_N[n];
  if (n === 23) return { open: false, title: 'The Bell Shaft', text: "Sealed with the Abbot's mark. Far below, a bell is waiting, and Aldric with it. (Act II, Part 2.)" };
  if (!q) return { open: false, title: 'Sealed', text: 'Nothing but stone.' };
  const status = questStatus(q, storyState());
  if (q.act === 2 && status === 'locked' && !act2Open()) return { open: false, title: q.dungeon.name, text: 'Something heavy shifts beneath the stone. Act II opens this Friday.' };
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

/** "Act I: main 4/4 · side 3/3", for the quest log. */
function actCount(name: string, quests: Quest[]): string {
  const has = (q: Quest) => meta.story.done.includes(q.n);
  const main = quests.filter((q) => !q.side);
  const side = quests.filter((q) => q.side);
  return `${name}: main ${main.filter(has).length}/${main.length} · side ${side.filter(has).length}/${side.length}`;
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
    <h2>${esc(s.done.includes(4) && act2Open() ? ACT2_TITLE : ACT_TITLE)}</h2>
    <p class="sub">${actCount('Act I', ACT1_QUESTS)}${s.done.includes(4) ? (act2Open() ? `<br>${actCount('Act II, Part 1', ACT2_QUESTS)}` : '<br>Act II opens this Friday.') : ''}</p>
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
    volley: true,
    fair: true,
    story: {
      start: d.floors[0],
      end: d.floors[1],
      gifts: d.gifts,
      pet: hound ? houndStats(meta.story.bond) : undefined,
      ghost: ghost ?? undefined,
      boss: d.boss,
      look: d.look,
      mist: d.mist,
      monks: d.monks,
      holdout: d.holdout,
      sleepers: d.sleepers,
    },
    // The isle's buildings help in the story too.
    ...(islePerks(meta.isle).vigor ? { vigor: islePerks(meta.isle).vigor } : {}),
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
        <img class="hero-portrait ${auraClass(outfitFor(game.hero).aura).cls}" style="${auraClass(outfitFor(game.hero).aura).style}" src="${heroPortrait(game.hero, game.relics, game.relicLog, 8, outfitFor(game.hero).look, outfitFor(game.hero).head)}" alt="" width="96" height="96" />
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
// ---------- updates ----------
// The installed app can sit open in the background for days, running the version it
// started with. Coming back to it, check whether a newer one is out; if so it loads the
// next time the title screen shows (never mid-run).

const builtScript = (document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src ?? '').split('/').pop() ?? '';
let updateCheckedAt = 0;

async function checkForUpdate() {
  if (!builtScript || updateReady || Date.now() - updateCheckedAt < 10 * 60_000) return;
  updateCheckedAt = Date.now();
  try {
    const html = await (await fetch('./', { cache: 'no-store' })).text();
    const live = /assets\/(index-[\w-]+\.js)/.exec(html)?.[1];
    if (live && live !== builtScript) {
      updateReady = true;
      if (screen === 'title') reloadForUpdate();
    }
  } catch {
    // Offline: try again next time.
  }
}

/** Reload into the new version, at most once every few minutes (in case the page keeps coming back stale). */
function reloadForUpdate(): boolean {
  try {
    const last = Number(sessionStorage.getItem('omc:update-reload')) || 0;
    if (Date.now() - last < 5 * 60_000) return false;
    sessionStorage.setItem('omc:update-reload', String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

document.addEventListener('visibilitychange', () => !document.hidden && void checkForUpdate());

// Back from the background: the phone may have wiped cached sprites, so bake them again.
const refreshCanvases = () => {
  resetCanvases();
  renderer.invalidate();
};
document.addEventListener('visibilitychange', () => !document.hidden && refreshCanvases());
window.addEventListener('pageshow', refreshCanvases);
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
  story: (n: number) => QUEST_BY_N[n] && startStory(QUEST_BY_N[n], null),
  hollow: (to: string, x: number, y: number) => {
    setHollowSpot(to, x, y);
    enterHollow();
  },
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
setPresenceSource(() => {
  const inRun = Boolean(game) && !document.body.classList.contains('menu') && game.phase !== 'dead';
  if (!inRun) return { doing: screen || 'title', detail: '', hero: '' };
  const doing = game.mode === 'story' ? (raidRun ? 'raid' : 'story') : game.mode;
  const detail = game.mode === 'horde' ? `Wave ${game.horde.wave}` : raidRun ? `Turn ${game.turns}` : `Floor ${game.floor}`;
  return { doing, detail, hero: game.hero };
});
startActivityPings();
// The notification key, so anyone (account or not) can be offered tomorrow's reminder.
void loadReminders().catch(() => undefined);
void initSocial(save, () => {
  if (screen !== 'title') return;
  // First visit, or back from an email link / X sign-in that still needs a name.
  if (needsName()) showLogin(showTitle, 'name');
  else showTitle();
});
showTitle();
const visiting = hallFromLink();
if (visiting && ONLINE) showPublicHall(visiting, showTitle);
const challengeCode = challengeFromLink();
inviteFromLink();
if (challengeCode && ONLINE) openChallenge(challengeCode, showTitle);
// The unsubscribe link in a reminder email: ?unsub=<token>.
const unsub = new URLSearchParams(location.search).get('unsub');
if (unsub && ONLINE) {
  const url = new URL(location.href);
  url.searchParams.delete('unsub');
  history.replaceState(null, '', url.toString());
  void emailReminderOff(unsub).then((ok) => {
    noteEmailReminder(false);
    toast(ok ? '📧 Email reminders are off. You can turn them back on from your profile.' : '📧 Those email reminders were already off.');
  });
}
// Back again: tell them what's new (only on a plain visit, not a shared link).
if (!visiting && !challengeCode && !unsub && !savedRun()) {
  if (actTwoNewsWaiting()) showActTwoNews();
  else if (bellNewsWaiting()) showBellNews();
  else if (newsWaiting()) showStoryNews();
}
// Someone brand new: straight into the crypt (a one-minute tutorial, then today's daily).
// They're asked for a name after their first run, once they've seen where they'd place.
if (firstVisit() && !visiting && !challengeCode) {
  save.seenOnlineLogin = true;
  save.seenLogin = true;
  writeSave(save);
  startTutorial(() => startRun('daily'), "Enter today's crypt");
}
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
