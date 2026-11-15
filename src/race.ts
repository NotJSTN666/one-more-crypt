// Crypt Race: two players in the same crypt at the same time, each watching the other play.
//
// A room is a live channel and nothing more. The host makes a crypt (a seed and a run header:
// hero, relic pool, rules) and tells it to whoever joins; both start on the same countdown.
// From then on each side sends its run's input log, and the other redraws that run on a small
// board from the log alone (the game is deterministic). Deepest floor when the five minutes
// are up wins, or the survivor once they've gone deeper than where the other fell.
//
// Nobody waiting? Race a ghost: a real player's recorded Endless run, played back beside you
// at the pace it was played.
//
// A race run is its own thing: never saved, never on a leaderboard, no feats. It pays a few
// Souls at the end.

import { Game } from './game';
import { ONLINE, raceGhosts, raceLink, type RaceLink } from './online';
import { Renderer } from './render';
import { copyText, siteUrl } from './share';
import { esc, hideOverlay, on, overlay, screen, showOverlay, toast } from './ui';

/** How long a race runs. */
export const RACE_MS = 5 * 60 * 1000;
const COUNTDOWN_MS = 4000;
/** Souls for finishing a race: against a player, and against a ghost. */
const PAY = { live: { win: 150, other: 50 }, ghost: { win: 75, other: 25 } };

/** What the game gives the race to work with (main registers this). */
export interface RaceHost {
  me(): { id: string; name: string };
  /** A fresh Endless crypt as this player would start one. */
  newCrypt(): { seed: number; head: string };
  /** Start the run on that crypt and return it. */
  start(seed: number, head: string): Game;
  /** The run on screen right now. */
  game(): Game;
  /** Stop the run (time is up, or the race was decided): no results screen of the game's own. */
  stop(): void;
  grantSouls(n: number): void;
  showTitle(): void;
  backToMenu(): void;
}

interface Result { floor: number; kills: number; dead: boolean }

interface Race {
  code: string;
  kind: 'live' | 'ghost';
  role: 'host' | 'guest' | 'ghost';
  link: RaceLink | null;
  seed: number;
  head: string;
  rivalId: string;
  rivalName: string;
  phase: 'lobby' | 'countdown' | 'run' | 'watch' | 'over';
  startAt: number;
  /** The rival's run, redrawn here from their inputs. */
  rival: Game | null;
  rivalRenderer: Renderer | null;
  /** Their inputs so far (without the header), how many are applied, and when the next one may be. */
  rivalLog: string;
  applied: number;
  nextAt: number;
  /** A ghost's inputs are let out at the pace of the recorded run. */
  ghostEvery: number;
  ghostFed: number;
  rivalDone: Result | null;
  mine: Result | null;
  lastSent: number;
  lastSentLen: number;
  helloTimer: number;
  goneAt: number;
}

let host: RaceHost | null = null;
let race: Race | null = null;

export function setRaceHost(h: RaceHost) {
  host = h;
}

/** Whether a race is being run (the game then leaves saving, feats and its own results alone). */
export const raceOn = () => Boolean(race && (race.phase === 'run' || race.phase === 'watch' || race.phase === 'countdown'));

const raceUrl = (code: string) => `${siteUrl()}?race=${code}&ref=race`;
const newCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// ---------- the room link: the live channel, or (with no server, as on a dev machine) this browser's own ----------

async function openLink(code: string, id: string, onMsg: (from: string, msg: Record<string, unknown>) => void, onPeers: (ids: string[]) => void): Promise<RaceLink> {
  let local = !ONLINE;
  try {
    local ||= localStorage.getItem('omc:race-local') === '1';
  } catch {
    // no storage: the live channel it is
  }
  if (!local) return raceLink(code, id, onMsg, onPeers);
  // Tabs of one browser talk straight to each other. Presence is a heartbeat.
  const ch = new BroadcastChannel(`omc-race-${code}`);
  const seen = new Map<string, number>();
  ch.onmessage = (e) => {
    const p = e.data as { from: string; msg: Record<string, unknown> };
    if (!p || p.from === id) return;
    seen.set(p.from, Date.now());
    if (p.msg.t !== 'beat') onMsg(p.from, p.msg);
  };
  const beat = window.setInterval(() => {
    ch.postMessage({ from: id, msg: { t: 'beat' } });
    for (const [k, at] of seen) if (Date.now() - at > 4000) seen.delete(k);
    onPeers([id, ...seen.keys()]);
  }, 1000);
  return {
    send: (msg) => ch.postMessage({ from: id, msg }),
    leave: () => {
      window.clearInterval(beat);
      ch.close();
    },
  };
}

// ---------- menus ----------

/** The race menu: open a room, join one, or race a ghost. */
export function showRaceMenu() {
  if (!host) return;
  leaveRace();
  showOverlay('race', `
    <button class="btn back-top" id="back">← Back</button>
    <h2>⚔️ Crypt Race</h2>
    <p class="sub">Two players, the same crypt, the same hero, at the same time. You see each other play. Deepest floor in five minutes wins.</p>
    <button class="btn primary" id="race-open">🚪 Open a race room<small>Get a link and send it to a friend</small></button>
    <button class="btn" id="race-ghost">👻 Race a ghost<small>A real player's run, played back beside you. Always ready.</small></button>
    <form class="race-join" id="race-join">
      <input id="race-code" type="text" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ROOM CODE" aria-label="Room code" />
      <button class="btn" type="submit">Join</button>
    </form>
    <p class="fine">A race is its own run: it isn't saved and doesn't touch the leaderboards. Winning pays ${PAY.live.win} Souls (${PAY.ghost.win} against a ghost).</p>`);
  on('#back', () => host!.backToMenu());
  on('#race-open', () => void openRoom());
  on('#race-ghost', () => void startGhostRace());
  overlay.querySelector<HTMLFormElement>('#race-join')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = (overlay.querySelector<HTMLInputElement>('#race-code')?.value ?? '').trim().toUpperCase();
    if (code.length >= 4) void joinRoom(code);
    else toast('Type the room code your friend sent you.');
  });
}

function blank(code: string, kind: Race['kind'], role: Race['role']): Race {
  return {
    code, kind, role, link: null, seed: 0, head: '', rivalId: '', rivalName: '', phase: 'lobby', startAt: 0,
    rival: null, rivalRenderer: null, rivalLog: '', applied: 0, nextAt: 0, ghostEvery: 0, ghostFed: 0,
    rivalDone: null, mine: null, lastSent: 0, lastSentLen: -1, helloTimer: 0, goneAt: 0,
  };
}

/** Open a room and wait in it for a rival. */
async function openRoom() {
  if (!host) return;
  const me = host.me();
  const r = (race = blank(newCode(), 'live', 'host'));
  Object.assign(r, host.newCrypt());
  const url = raceUrl(r.code);
  showOverlay('race', `
    <h2>⚔️ Race room ${esc(r.code)}</h2>
    <p class="sub">Send this link to a friend. The race starts the moment they open it.</p>
    <div class="invite-link"><input type="text" readonly value="${esc(url)}" aria-label="The link to this race" /></div>
    <button class="btn primary" id="race-share">📤 Share the link</button>
    <button class="btn" id="race-copy">📋 Copy link</button>
    <p class="race-wait" id="race-wait"><i></i>Opening the room…</p>
    <button class="btn" id="race-ghost">👻 Race a ghost instead</button>
    <button class="btn" id="back">Close the room</button>`);
  on('#back', showRaceMenu);
  on('#race-ghost', () => void startGhostRace());
  on('#race-copy', async () => toast((await copyText(url)) ? 'Link copied!' : 'Copy failed'));
  on('#race-share', async () => {
    const text = `Race me in One More Crypt: same crypt, same hero, five minutes. Room ${r.code}:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'One More Crypt', text, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    toast((await copyText(`${text} ${url}`)) ? 'Copied! Paste it to a friend.' : 'Copy failed');
  });
  try {
    r.link = await openLink(r.code, me.id, onMessage, onPeers);
  } catch (e) {
    if (race === r) {
      toast((e as Error).message);
      showRaceMenu();
    }
    return;
  }
  if (race !== r) return r.link.leave();
  const wait = document.getElementById('race-wait');
  if (wait) wait.innerHTML = '<i></i>Waiting for a rival…';
}

/** Join a friend's room from its code or link. */
export async function joinRoom(code: string) {
  if (!host) return;
  leaveRace();
  const me = host.me();
  const r = (race = blank(code, 'live', 'guest'));
  showOverlay('race', `
    <h2>⚔️ Race room ${esc(code)}</h2>
    <p class="race-wait"><i></i>Knocking on the door…</p>
    <button class="btn" id="back">Leave</button>`);
  on('#back', showRaceMenu);
  try {
    r.link = await openLink(code, me.id, onMessage, onPeers);
  } catch (e) {
    if (race === r) {
      toast((e as Error).message);
      showRaceMenu();
    }
    return;
  }
  if (race !== r) return r.link.leave();
  // Say hello until the host answers; give up after a while.
  let tries = 0;
  const hello = () => {
    if (race !== r || r.phase !== 'lobby') return;
    if (++tries > 8) {
      showOverlay('race', `
        <h2>⚔️ Race room ${esc(code)}</h2>
        <p class="sub">Nobody is waiting in that room. It closes when the player who opened it leaves.</p>
        <button class="btn primary" id="race-ghost">👻 Race a ghost instead</button>
        <button class="btn" id="back">Back</button>`);
      on('#back', showRaceMenu);
      on('#race-ghost', () => void startGhostRace());
      return;
    }
    r.link?.send({ t: 'hello', name: me.name });
    r.helloTimer = window.setTimeout(hello, 1200);
  };
  hello();
}

/** Race a recorded run by a real player. */
async function startGhostRace() {
  if (!host) return;
  leaveRace();
  const r = (race = blank('', 'ghost', 'ghost'));
  showOverlay('race', '<h2>👻 Race a ghost</h2><p class="race-wait"><i></i>Waking a ghost…</p><button class="btn" id="back">Back</button>');
  on('#back', showRaceMenu);
  const all = await raceGhosts();
  if (race !== r) return;
  // Only a run this version of the game replays to the floor it was recorded at will do.
  let pick: (typeof all)[number] | null = null;
  for (const g of all.sort(() => Math.random() - 0.5).slice(0, 12)) {
    try {
      if (Game.replay('endless', g.seed, 0, g.log).floor === g.floor) {
        pick = g;
        break;
      }
    } catch {
      // an old log this version can't play: try another
    }
  }
  if (!pick) {
    showOverlay('race', '<h2>👻 Race a ghost</h2><p class="sub">No ghost answered. Try again in a moment, or open a room for a friend.</p><button class="btn primary" id="back">Back</button>');
    on('#back', showRaceMenu);
    return;
  }
  const { inputs } = Game.parseLog(pick.log);
  r.seed = pick.seed;
  r.head = pick.log.slice(0, pick.log.length - inputs.length);
  r.rivalName = pick.name;
  r.rivalLog = inputs;
  // The pace it was played at, within reason: nobody wants to race a statue or a blur.
  r.ghostEvery = Math.max(260, Math.min(1100, (pick.seconds * 1000) / Math.max(1, inputs.length)));
  countdown(COUNTDOWN_MS);
}

// ---------- the room's messages ----------

function onPeers(ids: string[]) {
  const r = race;
  if (!r || r.kind !== 'live' || !r.rivalId || r.phase === 'lobby' || r.phase === 'over') return;
  // The rival has gone: give them a few seconds to come back, then their run stands as it is.
  if (ids.includes(r.rivalId)) r.goneAt = 0;
  else if (!r.goneAt) r.goneAt = Date.now();
}

function onMessage(from: string, msg: Record<string, unknown>) {
  const r = race;
  if (!r || !host || r.kind !== 'live') return;
  const me = host.me();
  switch (msg.t) {
    case 'hello':
      // The first to knock is the rival; anyone after is told the room is taken.
      if (r.role !== 'host') return;
      if (r.phase === 'lobby') {
        r.rivalId = from;
        r.rivalName = String(msg.name ?? '').slice(0, 24) || 'A rival';
        r.link?.send({ t: 'room', seed: r.seed, head: r.head, name: me.name, guest: from, goIn: COUNTDOWN_MS });
        countdown(COUNTDOWN_MS);
      } else r.link?.send({ t: 'room', guest: r.rivalId, full: from !== r.rivalId });
      break;
    case 'room':
      if (r.role !== 'guest' || r.phase !== 'lobby') return;
      window.clearTimeout(r.helloTimer);
      if (msg.guest !== me.id) {
        showOverlay('race', `<h2>⚔️ Race room ${esc(r.code)}</h2><p class="sub">That race is already under way with someone else.</p><button class="btn primary" id="back">Back</button>`);
        on('#back', showRaceMenu);
        return;
      }
      r.seed = Number(msg.seed);
      r.head = String(msg.head ?? '');
      r.rivalId = from;
      r.rivalName = String(msg.name ?? '').slice(0, 24) || 'A rival';
      countdown(Math.max(1500, Math.min(COUNTDOWN_MS, Number(msg.goIn) || COUNTDOWN_MS)));
      break;
    case 'log': {
      if (from !== r.rivalId) return;
      const s = String(msg.s ?? '');
      // Their log only ever grows. One that doesn't carry on from what's been played means
      // something was lost: start their board again from the top.
      if (!s.startsWith(r.rivalLog.slice(0, r.applied))) resetRival(r);
      if (s.length >= r.rivalLog.length || !s.startsWith(r.rivalLog)) r.rivalLog = s;
      break;
    }
    case 'done':
      if (from !== r.rivalId) return;
      r.rivalDone = { floor: Number(msg.floor) || 1, kills: Number(msg.kills) || 0, dead: Boolean(msg.dead) };
      if (typeof msg.s === 'string' && msg.s.length >= r.rivalLog.length) r.rivalLog = msg.s;
      break;
  }
}

// ---------- the race ----------

function countdown(ms: number) {
  const r = race;
  if (!r || !host) return;
  r.phase = 'countdown';
  r.startAt = Date.now() + ms;
  const tick = () => {
    if (race !== r || r.phase !== 'countdown') return;
    const left = r.startAt - Date.now();
    if (left <= 0) return begin();
    const n = Math.ceil(left / 1000);
    showOverlay('race', `
      <h2>⚔️ You <small>vs</small> ${esc(r.rivalName)}</h2>
      <p class="sub">${r.kind === 'ghost' ? 'A recorded run by a real player. ' : ''}Same crypt, same hero. Deepest floor in five minutes wins.</p>
      <p class="race-count">${n > 3 ? 'Ready' : n}</p>`);
    window.setTimeout(tick, 200);
  };
  tick();
}

function resetRival(r: Race) {
  const { config } = Game.parseLog(r.head);
  r.rival = new Game('endless', r.seed, 0, config);
  r.applied = 0;
  r.rivalRenderer?.setGame(r.rival);
  r.rivalRenderer?.consume(r.rival.events.splice(0));
}

function begin() {
  const r = race;
  if (!r || !host) return;
  r.phase = 'run';
  r.startAt = Date.now();
  hideOverlay();
  host.start(r.seed, r.head);
  // the rival's board
  const box = document.createElement('aside');
  box.id = 'race-rival';
  box.innerHTML = `<p class="race-name"><b>${esc(r.rivalName)}</b><span id="race-floor">floor 1</span></p><canvas></canvas><p class="race-clock" id="race-clock">5:00</p>`;
  document.body.appendChild(box);
  r.rivalRenderer = new Renderer(box.querySelector('canvas')!, true);
  sizeRival();
  resetRival(r);
  r.nextAt = Date.now() + 400;
}

function sizeRival() {
  const r = race;
  if (!r?.rivalRenderer) return;
  const box = document.getElementById('race-rival');
  const big = matchMedia('(min-width: 1000px) and (min-height: 560px)').matches || box?.classList.contains('big');
  r.rivalRenderer.resize(big ? 224 : 112);
}
window.addEventListener('resize', sizeRival);

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** Called every frame by the game: the rival's board is fed and drawn, and the race is judged. */
export function raceFrame(dt: number) {
  const r = race;
  if (!r || !host || (r.phase !== 'run' && r.phase !== 'watch') || !r.rival || !r.rivalRenderer) return;
  const now = Date.now();
  const left = RACE_MS - (now - r.startAt);
  // ---- the rival's inputs, one at a time so their board moves like a played game ----
  const have = r.kind === 'ghost' ? Math.min(r.rivalLog.length, Math.floor((now - r.startAt) / r.ghostEvery)) : r.rivalLog.length;
  if (r.applied < have && now >= r.nextAt && r.rival.phase !== 'dead') {
    // (far behind, as after a hiccup on the line: catch up quickly)
    const n = have - r.applied > 12 ? 4 : 1;
    for (let i = 0; i < n && r.applied < have && (r.rival.phase as string) !== 'dead'; i++) r.rival.applyInput(r.rivalLog[r.applied++]);
    r.rivalRenderer.consume(r.rival.events.splice(0));
    r.nextAt = now + 110;
  }
  r.rivalRenderer.frame(dt);
  // a ghost is done when its run is: it fell, or its recording ran out
  if (r.kind === 'ghost' && !r.rivalDone && (r.rival.phase === 'dead' || r.applied >= r.rivalLog.length)) r.rivalDone = { floor: r.rival.floor, kills: r.rival.kills, dead: r.rival.phase === 'dead' };
  // a rival who dropped off the line for good: their run stands where it stopped
  if (r.kind === 'live' && !r.rivalDone && r.goneAt && now - r.goneAt > 8000) r.rivalDone = { floor: r.rival.floor, kills: r.rival.kills, dead: true };
  // ---- the little panel ----
  const floor = document.getElementById('race-floor');
  if (floor) floor.textContent = r.rivalDone?.dead || r.rival.phase === 'dead' ? `fell on floor ${r.rivalDone?.floor ?? r.rival.floor}` : `floor ${r.rival.floor}`;
  const cl = document.getElementById('race-clock');
  if (cl) {
    cl.textContent = clock(Math.max(0, left));
    cl.classList.toggle('late', left < 30000);
  }
  // ---- my own run, sent as it grows (a few times a second at most) ----
  const g = host.game();
  if (r.phase === 'run' && r.link && g.log.length !== r.lastSentLen && now - r.lastSent > 250) {
    r.lastSent = now;
    r.lastSentLen = g.log.length;
    r.link.send({ t: 'log', s: g.log });
  }
  // ---- is it over? ----
  if (r.phase === 'run') {
    const rv = r.rivalDone;
    // Time's up; or the rival is down and I've gone deeper than they got.
    if (left <= 0 || (rv?.dead && g.floor > rv.floor)) {
      host.stop();
      raceRunEnded(false);
    }
  } else if (r.phase === 'watch') {
    // I'm down: it ends when they pass me, fall, or the clock runs out.
    const mine = r.mine!;
    if (left <= 0 || r.rivalDone || r.rival.floor > mine.floor) finish();
    else updateWatch();
  }
}

/** The game says my run has ended: I fell (or gave up), or the race stopped it. */
export function raceRunEnded(abandoned: boolean) {
  const r = race;
  if (!r || !host || r.phase !== 'run') return;
  const g = host.game();
  r.mine = { floor: g.floor, kills: g.kills, dead: g.phase === 'dead' || abandoned };
  r.link?.send({ t: 'done', floor: r.mine.floor, kills: r.mine.kills, dead: r.mine.dead, s: g.log });
  if (abandoned) {
    // Walking out forfeits: no result, no Souls.
    leaveRace();
    host.showTitle();
    toast('You left the race.');
    return;
  }
  const left = RACE_MS - (Date.now() - r.startAt);
  // Fell with time on the clock and a rival still going: watch them until it's settled.
  if (r.mine.dead && left > 0 && !r.rivalDone && r.rival && r.rival.floor <= r.mine.floor) {
    r.phase = 'watch';
    window.setTimeout(() => race === r && r.phase === 'watch' && showWatch(), 1500);
    return;
  }
  window.setTimeout(() => race === r && finish(), r.mine.dead ? 1500 : 300);
}

function showWatch() {
  const r = race;
  if (!r || !r.mine) return;
  showOverlay('race', `
    <h2 class="dead">You have fallen</h2>
    <p class="sub">On floor ${r.mine.floor}. ${esc(r.rivalName)} is still going: if they pass floor ${r.mine.floor}, they win.</p>
    <div id="race-watch"></div>
    <p class="race-watch-line" id="race-watch-line"></p>
    <button class="btn" id="race-leave">Leave the race</button>`);
  // Their board moves up into the middle of the screen, twice the size.
  const box = document.getElementById('race-rival');
  if (box) {
    box.classList.add('big');
    document.getElementById('race-watch')!.appendChild(box);
    sizeRival();
  }
  on('#race-leave', () => {
    leaveRace();
    host!.showTitle();
  });
  updateWatch();
}

function updateWatch() {
  const r = race;
  const line = document.getElementById('race-watch-line');
  if (r?.rival && line) line.textContent = `${r.rivalName}: floor ${r.rival.floor} · ${r.rival.kills} kills · ${r.rival.player.hp}/${r.rival.player.maxHp} HP`;
}

/** Deeper wins; level on floors, more kills; level on both, a draw. */
function verdict(mine: Result, theirs: Result): 'win' | 'loss' | 'draw' {
  if (mine.floor !== theirs.floor) return mine.floor > theirs.floor ? 'win' : 'loss';
  if (mine.kills !== theirs.kills) return mine.kills > theirs.kills ? 'win' : 'loss';
  return 'draw';
}

function finish() {
  const r = race;
  if (!r || !host || !r.mine || r.phase === 'over') return;
  r.phase = 'over';
  const theirs: Result = r.rivalDone ?? { floor: r.rival?.floor ?? 1, kills: r.rival?.kills ?? 0, dead: (r.rival?.phase as string | undefined) === 'dead' };
  const v = verdict(r.mine, theirs);
  const pay = PAY[r.kind][v === 'win' ? 'win' : 'other'];
  host.grantSouls(pay);
  const me = 'You';
  const col = (name: string, res: Result, won: boolean) => `<div class="race-col ${won ? 'won' : ''}">
      <b>${esc(name)}</b>
      <span class="race-big">${res.floor}</span><small>FLOOR</small>
      <span>${res.kills} kills</span>
      <span>${res.dead ? 'Fell' : 'Still standing'}</span>
    </div>`;
  showOverlay('race', `
    <h2 class="${v === 'loss' ? 'dead' : ''}">${v === 'win' ? '🏆 You won the race' : v === 'loss' ? 'You lost the race' : 'A dead heat'}</h2>
    <p class="sub">${r.kind === 'ghost' ? `Against the ghost of ${esc(r.rivalName)}.` : `Against ${esc(r.rivalName)}.`}</p>
    <div class="race-result">${col(me, r.mine, v === 'win')}<span class="race-vs">vs</span>${col(r.rivalName, theirs, v === 'loss')}</div>
    <p class="earned-line"><b>+${pay} Souls</b></p>
    <button class="btn primary" id="race-again">⚔️ Race again</button>
    <button class="btn" id="race-title">Title</button>`);
  const again = r.kind;
  const quit = () => {
    leaveRace();
  };
  on('#race-again', () => {
    quit();
    if (again === 'ghost') void startGhostRace();
    else showRaceMenu();
  });
  on('#race-title', () => {
    quit();
    host!.showTitle();
  });
  document.getElementById('race-rival')?.remove();
}

/** Drop out of whatever race or room is open. */
export function leaveRace() {
  const r = race;
  race = null;
  if (!r) return;
  window.clearTimeout(r.helloTimer);
  r.link?.leave();
  document.getElementById('race-rival')?.remove();
}

/** A race link (?race=CODE), tidied out of the address bar. */
export function raceFromLink(): string | null {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has('race')) return null;
    const code = (u.searchParams.get('race') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    u.searchParams.delete('race');
    u.searchParams.delete('ref');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    return code.length >= 4 ? code : null;
  } catch {
    return null;
  }
}

/** True while one of the race's own screens is up (so the game doesn't draw its menus over it). */
export const raceScreen = () => screen === 'race';
