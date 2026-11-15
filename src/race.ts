// Crypt Race: up to four players in the same crypt at the same time, each watching the others.
//
// The open race: anyone who taps "Join a race" stands in one shared lobby. As soon as two are
// there a short timer starts so others can pile in, then everyone waiting is dealt the same
// crypt (a seed and a run header: hero, relic pool, rules) and starts on the same countdown.
// Whoever has waited longest runs the lobby; if they leave, the next longest takes over.
//
// From then on each racer sends their run's input log, and the others redraw that run on a
// small board from the log alone (the game is deterministic). Deepest floor when the five
// minutes are up wins.
//
// There is also a private room (a code and a link, for a friend), and a ghost race: a real
// player's recorded Endless run played back beside you, for when nobody is about.
//
// A race run is its own thing: never saved, never on a leaderboard, no feats. It pays a few
// Souls at the end. Nothing here needs a table: it's all one live channel per room.

import { Game } from './game';
import { ONLINE, raceGhosts, raceLink, type RaceLink } from './online';
import { Renderer } from './render';
import { copyText, siteUrl } from './share';
import { esc, hideOverlay, on, overlay, showOverlay, toast } from './ui';

/** How long a race runs. */
export const RACE_MS = 5 * 60 * 1000;
const COUNTDOWN_MS = 4000;
/** The open lobby: how long it gathers racers once two are there, and how many race together. */
const GATHER_MS = 7000;
const MAX_RACERS = 4;
const LOBBY = 'LOBBY';
/** Souls for finishing a race: against players, and against a ghost. */
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

/** Another racer: their run redrawn here from their inputs. */
interface Rival {
  id: string;
  name: string;
  game: Game | null;
  renderer: Renderer | null;
  el: HTMLElement | null;
  /** Their inputs so far (without the header), how many are applied, and when the next one may be. */
  log: string;
  applied: number;
  nextAt: number;
  /** A ghost's inputs are let out at the pace of the recorded run (0 for a live racer). */
  ghostEvery: number;
  done: Result | null;
  goneAt: number;
}

interface Race {
  code: string;
  kind: 'live' | 'ghost';
  role: 'lobby' | 'host' | 'guest' | 'ghost';
  link: RaceLink | null;
  seed: number;
  head: string;
  rivals: Rival[];
  phase: 'lobby' | 'countdown' | 'run' | 'watch' | 'over';
  startAt: number;
  mine: Result | null;
  lastSent: number;
  lastSentLen: number;
  timer: number;
  /** The open lobby: who is waiting (by id), and when the race is called. */
  since: number;
  waiting: Map<string, { name: string; since: number; seen: number; gatherAt: number }>;
  gatherAt: number;
}

let host: RaceHost | null = null;
let race: Race | null = null;

export function setRaceHost(h: RaceHost) {
  host = h;
}

/** Whether a race is being run (the game then leaves saving, feats and its own results alone). */
export const raceOn = () => Boolean(race && (race.phase === 'run' || race.phase === 'watch' || race.phase === 'countdown'));

const raceUrl = (code: string) => `${siteUrl()}?race=${code}&ref=race`;
const newCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
const newRival = (id: string, name: string): Rival => ({ id, name: name.slice(0, 24) || 'A rival', game: null, renderer: null, el: null, log: '', applied: 0, nextAt: 0, ghostEvery: 0, done: null, goneAt: 0 });
const fell = (g: Game | null) => (g?.phase as string | undefined) === 'dead';

function blank(code: string, kind: Race['kind'], role: Race['role']): Race {
  return {
    code, kind, role, link: null, seed: 0, head: '', rivals: [], phase: 'lobby', startAt: 0, mine: null,
    lastSent: 0, lastSentLen: -1, timer: 0, since: Date.now(), waiting: new Map(), gatherAt: 0,
  };
}

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

// ---------- the menu ----------

/** The race menu: join the open race, race a ghost, or make a private room. */
export function showRaceMenu() {
  if (!host) return;
  leaveRace();
  showOverlay('race', `
    <button class="btn back-top" id="back">← Back</button>
    <h2>⚔️ Crypt Race</h2>
    <p class="sub">Up to four players, the same crypt, the same hero, at the same time. You see each other play. Deepest floor in five minutes wins.</p>
    <button class="btn primary" id="race-join-open">⚔️ Join a race<small>Jump in with whoever is waiting. It starts when two of you are there.</small></button>
    <button class="btn" id="race-ghost">👻 Race a ghost<small>A real player's run, played back beside you. Always ready.</small></button>
    <details class="race-private">
      <summary>Race a friend privately</summary>
      <button class="btn" id="race-open">🚪 Open a private room<small>Get a link and send it to a friend</small></button>
      <form class="race-join" id="race-join">
        <input id="race-code" type="text" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ROOM CODE" aria-label="Room code" />
        <button class="btn" type="submit">Join</button>
      </form>
    </details>
    <p class="fine">A race is its own run: it isn't saved and doesn't touch the leaderboards. Winning pays ${PAY.live.win} Souls (${PAY.ghost.win} against a ghost).</p>`);
  on('#back', () => host!.backToMenu());
  on('#race-join-open', () => void joinLobby());
  on('#race-open', () => void openRoom());
  on('#race-ghost', () => void startGhostRace());
  overlay.querySelector<HTMLFormElement>('#race-join')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = (overlay.querySelector<HTMLInputElement>('#race-code')?.value ?? '').trim().toUpperCase();
    if (code.length >= 4 && code !== LOBBY) void joinRoom(code);
    else toast('Type the room code your friend sent you.');
  });
}

// ---------- the open race: one lobby, everyone welcome ----------

/** Stand in the open lobby until a race is called. */
async function joinLobby() {
  if (!host) return;
  leaveRace();
  const me = host.me();
  const r = (race = blank(LOBBY, 'live', 'lobby'));
  drawLobby();
  try {
    r.link = await openLink(LOBBY, me.id, onMessage, () => undefined);
  } catch (e) {
    if (race === r) {
      toast((e as Error).message);
      showRaceMenu();
    }
    return;
  }
  if (race !== r) return r.link.leave();
  // A heartbeat says who is here (and, from whoever runs the lobby, when the race is called).
  const beat = () => {
    if (race !== r || r.phase !== 'lobby') return;
    const now = Date.now();
    for (const [id, w] of r.waiting) if (now - w.seen > 3500) r.waiting.delete(id);
    const order = lobbyOrder(r, me.id);
    const lead = order[0].id === me.id;
    if (lead) {
      // Two or more: call the race a few seconds out, so others can still get in.
      if (order.length < 2) r.gatherAt = 0;
      else if (!r.gatherAt) r.gatherAt = now + GATHER_MS;
      if (r.gatherAt && now >= r.gatherAt) return callRace(order.slice(0, MAX_RACERS));
    } else r.gatherAt = r.waiting.get(order[0].id)?.gatherAt ?? 0;
    r.link?.send({ t: 'here', name: me.name, since: r.since, gatherAt: lead ? r.gatherAt : 0 });
    drawLobby();
    r.timer = window.setTimeout(beat, 1000);
  };
  beat();
}

/** Everyone in the lobby, longest-waiting first (that one runs it). */
function lobbyOrder(r: Race, myId: string): { id: string; name: string; since: number }[] {
  const all = [{ id: myId, name: host!.me().name, since: r.since }, ...[...r.waiting].map(([id, w]) => ({ id, name: w.name, since: w.since }))];
  return all.sort((a, b) => a.since - b.since || (a.id < b.id ? -1 : 1));
}

function drawLobby() {
  const r = race;
  if (!r || !host || r.role !== 'lobby' || r.phase !== 'lobby') return;
  const me = host.me();
  const order = lobbyOrder(r, me.id);
  const left = r.gatherAt ? Math.max(0, Math.ceil((r.gatherAt - Date.now()) / 1000)) : 0;
  const waited = Math.floor((Date.now() - r.since) / 1000);
  showOverlay('race', `
    <h2>⚔️ The open race</h2>
    <p class="race-wait"><i></i>${order.length < 2 ? 'Waiting for another racer…' : `The race starts in <b>${left}</b>`}</p>
    <ul class="race-list">${order.slice(0, MAX_RACERS).map((p) => `<li class="${p.id === me.id ? 'me' : ''}">${esc(p.id === me.id ? `${p.name} (you)` : p.name)}</li>`).join('')}${order.length > MAX_RACERS ? `<li class="more">+${order.length - MAX_RACERS} waiting for the next one</li>` : ''}</ul>
    <p class="fine">${order.length < 2 ? (waited >= 20 ? 'Quiet down here right now. A ghost is always ready to race.' : 'Anyone who taps Join a race lands here with you.') : `Up to ${MAX_RACERS} race together.`}</p>
    ${order.length < 2 ? '<button class="btn primary" id="race-ghost">👻 Race a ghost instead</button>' : ''}
    <button class="btn" id="back">Leave</button>`);
  on('#back', showRaceMenu);
  on('#race-ghost', () => void startGhostRace());
}

/** Whoever runs the lobby deals the crypt to everyone waiting (up to four) and sends them off. */
function callRace(players: { id: string; name: string }[]) {
  const r = race;
  if (!r || !host) return;
  const crypt = host.newCrypt();
  const code = newCode();
  r.link?.send({ t: 'match', code, seed: crypt.seed, head: crypt.head, players, goIn: COUNTDOWN_MS });
  enterMatch(code, crypt.seed, crypt.head, players, COUNTDOWN_MS);
}

/** Leave the lobby for the race's own room and start the countdown. */
function enterMatch(code: string, seed: number, head: string, players: { id: string; name: string }[], goIn: number) {
  const old = race;
  if (!old || !host) return;
  const me = host.me();
  window.clearTimeout(old.timer);
  const lobby = old.link;
  const r = (race = blank(code, 'live', 'guest'));
  r.seed = seed;
  r.head = head;
  r.rivals = players.filter((p) => p.id !== me.id).map((p) => newRival(p.id, p.name));
  countdown(goIn);
  // (the match message has to get out before the lobby's line is dropped)
  window.setTimeout(() => lobby?.leave(), 600);
  void openLink(code, me.id, onMessage, onPeers)
    .then((link) => {
      if (race === r) r.link = link;
      else link.leave();
    })
    .catch(() => undefined);
}

// ---------- a private room, for a friend ----------

async function openRoom() {
  if (!host) return;
  leaveRace();
  const me = host.me();
  const r = (race = blank(newCode(), 'live', 'host'));
  Object.assign(r, host.newCrypt());
  const url = raceUrl(r.code);
  showOverlay('race', `
    <h2>⚔️ Private room ${esc(r.code)}</h2>
    <p class="sub">Send this link to a friend. The race starts the moment they open it.</p>
    <div class="invite-link"><input type="text" readonly value="${esc(url)}" aria-label="The link to this race" /></div>
    <button class="btn primary" id="race-share">📤 Share the link</button>
    <button class="btn" id="race-copy">📋 Copy link</button>
    <p class="race-wait" id="race-wait"><i></i>Opening the room…</p>
    <button class="btn" id="back">Close the room</button>`);
  on('#back', showRaceMenu);
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
  if (wait) wait.innerHTML = '<i></i>Waiting for your friend…';
}

/** Join a friend's private room from its code or link. */
export async function joinRoom(code: string) {
  if (!host) return;
  leaveRace();
  const me = host.me();
  const r = (race = blank(code, 'live', 'guest'));
  showOverlay('race', `
    <h2>⚔️ Private room ${esc(code)}</h2>
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
        <h2>⚔️ Private room ${esc(code)}</h2>
        <p class="sub">Nobody is waiting in that room. It closes when the player who opened it leaves.</p>
        <button class="btn primary" id="race-join-open">⚔️ Join the open race</button>
        <button class="btn" id="back">Back</button>`);
      on('#back', showRaceMenu);
      on('#race-join-open', () => void joinLobby());
      return;
    }
    r.link?.send({ t: 'hello', name: me.name });
    r.timer = window.setTimeout(hello, 1200);
  };
  hello();
}

// ---------- a ghost ----------

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
    showOverlay('race', '<h2>👻 Race a ghost</h2><p class="sub">No ghost answered. Try again in a moment, or join the open race.</p><button class="btn primary" id="back">Back</button>');
    on('#back', showRaceMenu);
    return;
  }
  const { inputs } = Game.parseLog(pick.log);
  r.seed = pick.seed;
  r.head = pick.log.slice(0, pick.log.length - inputs.length);
  const ghost = newRival('ghost', pick.name);
  ghost.log = inputs;
  // The pace it was played at, within reason: nobody wants to race a statue or a blur.
  ghost.ghostEvery = Math.max(260, Math.min(1100, (pick.seconds * 1000) / Math.max(1, inputs.length)));
  r.rivals = [ghost];
  countdown(COUNTDOWN_MS);
}

// ---------- the room's messages ----------

function onPeers(ids: string[]) {
  const r = race;
  if (!r || r.kind !== 'live' || r.phase === 'lobby' || r.phase === 'over') return;
  // A racer who has gone gets a few seconds to come back, then their run stands as it is.
  for (const v of r.rivals) {
    if (ids.includes(v.id)) v.goneAt = 0;
    else if (!v.goneAt) v.goneAt = Date.now();
  }
}

function onMessage(from: string, msg: Record<string, unknown>) {
  const r = race;
  if (!r || !host || r.kind !== 'live') return;
  const me = host.me();
  const rival = r.rivals.find((v) => v.id === from);
  switch (msg.t) {
    // ---- the open lobby ----
    case 'here':
      if (r.role !== 'lobby' || r.phase !== 'lobby') return;
      r.waiting.set(from, { name: String(msg.name ?? '').slice(0, 24) || 'A racer', since: Number(msg.since) || Date.now(), seen: Date.now(), gatherAt: Number(msg.gatherAt) || 0 });
      break;
    case 'match': {
      if (r.role !== 'lobby' || r.phase !== 'lobby') return;
      const players = (Array.isArray(msg.players) ? msg.players : []) as { id: string; name: string }[];
      // Dealt in: off to the race. Not dealt in (it was full): those racers are gone from here.
      if (players.some((p) => p?.id === me.id)) enterMatch(String(msg.code), Number(msg.seed), String(msg.head ?? ''), players.slice(0, MAX_RACERS), Math.max(1500, Math.min(COUNTDOWN_MS, Number(msg.goIn) || COUNTDOWN_MS)));
      else for (const p of players) r.waiting.delete(p.id);
      break;
    }
    // ---- a private room ----
    case 'hello':
      // The first to knock is the rival; anyone after is told the room is taken.
      if (r.role !== 'host') return;
      if (r.phase === 'lobby') {
        r.rivals = [newRival(from, String(msg.name ?? ''))];
        r.link?.send({ t: 'room', seed: r.seed, head: r.head, name: me.name, guest: from, goIn: COUNTDOWN_MS });
        countdown(COUNTDOWN_MS);
      } else r.link?.send({ t: 'room', guest: r.rivals[0]?.id });
      break;
    case 'room':
      if (r.role !== 'guest' || r.phase !== 'lobby') return;
      window.clearTimeout(r.timer);
      if (msg.guest !== me.id) {
        showOverlay('race', `<h2>⚔️ Private room ${esc(r.code)}</h2><p class="sub">That race is already under way with someone else.</p><button class="btn primary" id="back">Back</button>`);
        on('#back', showRaceMenu);
        return;
      }
      r.seed = Number(msg.seed);
      r.head = String(msg.head ?? '');
      r.rivals = [newRival(from, String(msg.name ?? ''))];
      countdown(Math.max(1500, Math.min(COUNTDOWN_MS, Number(msg.goIn) || COUNTDOWN_MS)));
      break;
    // ---- the race ----
    case 'log': {
      if (!rival) return;
      const s = String(msg.s ?? '');
      // Their log only ever grows. One that doesn't carry on from what's been played means
      // something was lost: start their board again from the top.
      if (!s.startsWith(rival.log.slice(0, rival.applied))) resetRival(r, rival);
      if (s.length >= rival.log.length || !s.startsWith(rival.log)) rival.log = s;
      break;
    }
    case 'done':
      if (!rival) return;
      rival.done = { floor: Number(msg.floor) || 1, kills: Number(msg.kills) || 0, dead: Boolean(msg.dead) };
      if (typeof msg.s === 'string' && msg.s.length >= rival.log.length) rival.log = msg.s;
      break;
  }
}

// ---------- the race ----------

const names = (r: Race) => r.rivals.map((v) => v.name).join(', ').replace(/, ([^,]*)$/, ' and $1');

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
      <h2>⚔️ You <small>vs</small> ${esc(names(r))}</h2>
      <p class="sub">${r.kind === 'ghost' ? 'A recorded run by a real player. ' : ''}Same crypt, same hero. Deepest floor in five minutes wins.</p>
      <p class="race-count">${n > 3 ? 'Ready' : n}</p>`);
    window.setTimeout(tick, 200);
  };
  tick();
}

function resetRival(r: Race, v: Rival) {
  v.game = new Game('endless', r.seed, 0, Game.parseLog(r.head).config);
  v.applied = 0;
  v.renderer?.setGame(v.game);
  v.renderer?.consume(v.game.events.splice(0));
}

function begin() {
  const r = race;
  if (!r || !host) return;
  r.phase = 'run';
  r.startAt = Date.now();
  hideOverlay();
  host.start(r.seed, r.head);
  // the rivals' boards, side by side
  const rack = document.createElement('aside');
  rack.id = 'race-rivals';
  rack.dataset.n = String(r.rivals.length);
  rack.innerHTML = `<div class="race-boards"></div><p class="race-clock" id="race-clock">5:00</p>`;
  document.body.appendChild(rack);
  for (const v of r.rivals) {
    v.el = document.createElement('div');
    v.el.className = 'race-rival';
    v.el.innerHTML = `<p class="race-name"><b>${esc(v.name)}</b><span>floor 1</span></p><canvas></canvas>`;
    rack.querySelector('.race-boards')!.appendChild(v.el);
    v.renderer = new Renderer(v.el.querySelector('canvas')!, true);
    resetRival(r, v);
    v.nextAt = Date.now() + 400;
  }
  sizeRivals();
}

/** One rival gets a big board; more share the space (smaller still on a phone). */
function sizeRivals() {
  const r = race;
  const rack = document.getElementById('race-rivals');
  if (!r || !rack) return;
  const desk = matchMedia('(min-width: 1000px) and (min-height: 560px)').matches;
  const big = rack.classList.contains('big');
  const n = r.rivals.length;
  const size = n === 1 ? (desk || big ? 224 : 112) : n === 2 || desk || big ? 112 : 80;
  for (const v of r.rivals) {
    v.renderer?.resize(size);
    // (the board fits to whole pixels, so the name above it takes the board's real width)
    const c = v.el?.querySelector('canvas');
    const name = v.el?.querySelector<HTMLElement>('.race-name');
    if (c && name) name.style.maxWidth = c.style.width;
  }
}
window.addEventListener('resize', sizeRivals);

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
const standing = (v: Rival): Result => v.done ?? { floor: v.game?.floor ?? 1, kills: v.game?.kills ?? 0, dead: fell(v.game) };

/** Called every frame by the game: the rivals' boards are fed and drawn, and the race is judged. */
export function raceFrame(dt: number) {
  const r = race;
  if (!r || !host || (r.phase !== 'run' && r.phase !== 'watch')) return;
  const now = Date.now();
  const left = RACE_MS - (now - r.startAt);
  for (const v of r.rivals) {
    if (!v.game || !v.renderer) continue;
    // ---- their inputs, one at a time so the board moves like a played game ----
    const have = v.ghostEvery ? Math.min(v.log.length, Math.floor((now - r.startAt) / v.ghostEvery)) : v.log.length;
    if (v.applied < have && now >= v.nextAt && !fell(v.game)) {
      // (far behind, as after a hiccup on the line: catch up quickly)
      const n = have - v.applied > 12 ? 4 : 1;
      for (let i = 0; i < n && v.applied < have && !fell(v.game); i++) v.game.applyInput(v.log[v.applied++]);
      v.renderer.consume(v.game.events.splice(0));
      v.nextAt = now + 110;
    }
    v.renderer.frame(dt);
    // a ghost is done when its run is: it fell, or its recording ran out
    if (v.ghostEvery && !v.done && (fell(v.game) || v.applied >= v.log.length)) v.done = { floor: v.game.floor, kills: v.game.kills, dead: fell(v.game) };
    // a racer who dropped off the line for good: their run stands where it stopped
    if (!v.ghostEvery && !v.done && v.goneAt && now - v.goneAt > 8000) v.done = { floor: v.game.floor, kills: v.game.kills, dead: true };
    const st = standing(v);
    const label = v.el?.querySelector('.race-name span');
    if (label) label.textContent = st.dead ? `fell on ${st.floor}` : `floor ${st.floor}`;
    v.el?.classList.toggle('down', st.dead);
  }
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
  const all = r.rivals.map(standing);
  if (r.phase === 'run') {
    // Time's up; or every rival is down and I've gone deeper than any of them got.
    if (left <= 0 || (all.length > 0 && all.every((s) => s.dead && g.floor > s.floor))) {
      host.stop();
      raceRunEnded(false);
    }
  } else {
    // I'm down: it ends when everyone has passed me or fallen, or the clock runs out.
    const mine = r.mine!;
    if (left <= 0 || all.every((s) => s.dead || s.floor > mine.floor)) finish();
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
  const mine = r.mine;
  // Fell with time on the clock and someone still going who hasn't passed me: watch until it's settled.
  if (mine.dead && left > 0 && r.rivals.map(standing).some((s) => !s.dead && s.floor <= mine.floor)) {
    r.phase = 'watch';
    window.setTimeout(() => race === r && r.phase === 'watch' && showWatch(), 1500);
    return;
  }
  window.setTimeout(() => race === r && finish(), mine.dead ? 1500 : 300);
}

function showWatch() {
  const r = race;
  if (!r || !r.mine) return;
  showOverlay('race', `
    <h2 class="dead">You have fallen</h2>
    <p class="sub">On floor ${r.mine.floor}. ${r.rivals.length === 1 ? `${esc(r.rivals[0].name)} is still going: if they pass floor ${r.mine.floor}, they win.` : 'The others are still going.'}</p>
    <div id="race-watch"></div>
    <p class="race-watch-line" id="race-watch-line"></p>
    <button class="btn primary" id="race-now">See the result now</button>
    <button class="btn" id="race-leave">Leave the race</button>`);
  // Their boards move up into the middle of the screen.
  const rack = document.getElementById('race-rivals');
  if (rack) {
    rack.classList.add('big');
    document.getElementById('race-watch')!.appendChild(rack);
    sizeRivals();
  }
  on('#race-now', finish);
  on('#race-leave', () => {
    leaveRace();
    host!.showTitle();
  });
  updateWatch();
}

function updateWatch() {
  const r = race;
  const line = document.getElementById('race-watch-line');
  if (!r || !line) return;
  const going = r.rivals.filter((v) => !standing(v).dead && v.game);
  line.textContent = going.map((v) => `${v.name}: floor ${v.game!.floor} · ${v.game!.player.hp}/${v.game!.player.maxHp} HP`).join('   ');
}

/** Deeper is better; level on floors, more kills. */
const better = (a: Result, b: Result) => (a.floor !== b.floor ? a.floor > b.floor : a.kills > b.kills);
const level = (a: Result, b: Result) => a.floor === b.floor && a.kills === b.kills;

function finish() {
  const r = race;
  if (!r || !host || !r.mine || r.phase === 'over') return;
  r.phase = 'over';
  const mine = r.mine;
  const rows = [{ name: 'You', res: mine, me: true }, ...r.rivals.map((v) => ({ name: v.name, res: standing(v), me: false }))].sort((a, b) => (better(a.res, b.res) ? -1 : better(b.res, a.res) ? 1 : 0));
  // My place: one more than the number who did better. Sharing first place is a draw.
  const place = 1 + r.rivals.filter((v) => better(standing(v), mine)).length;
  const tied = r.rivals.some((v) => level(standing(v), mine));
  const won = place === 1 && !tied;
  const pay = PAY[r.kind][won ? 'win' : 'other'];
  host.grantSouls(pay);
  const ordinal = ['1st', '2nd', '3rd', '4th'][place - 1];
  const title = won ? '🏆 You won the race' : place === 1 ? 'A dead heat' : r.rivals.length === 1 ? 'You lost the race' : `You came ${ordinal}`;
  let rank = 0;
  showOverlay('race', `
    <h2 class="${place > 1 ? 'dead' : ''}">${title}</h2>
    <p class="sub">${r.kind === 'ghost' ? `Against the ghost of ${esc(r.rivals[0].name)}.` : `Against ${esc(names(r))}.`}</p>
    <ol class="race-result">${rows.map((row, i) => {
      if (i === 0 || better(rows[i - 1].res, row.res)) rank = i + 1;
      return `<li class="${row.me ? 'me' : ''} ${rank === 1 ? 'won' : ''}"><i>${rank}</i><b>${esc(row.name)}</b><span class="race-big">Floor ${row.res.floor}</span><small>${row.res.kills} kills · ${row.res.dead ? 'fell' : 'still standing'}</small></li>`;
    }).join('')}</ol>
    <p class="earned-line"><b>+${pay} Souls</b></p>
    <button class="btn primary" id="race-again">⚔️ Race again</button>
    <button class="btn" id="race-title">Title</button>`);
  const again = r.kind;
  on('#race-again', () => {
    leaveRace();
    if (again === 'ghost') void startGhostRace();
    else void joinLobby();
  });
  on('#race-title', () => {
    leaveRace();
    host!.showTitle();
  });
  document.getElementById('race-rivals')?.remove();
}

/** Drop out of whatever race, room or lobby is open. */
export function leaveRace() {
  const r = race;
  race = null;
  if (!r) return;
  window.clearTimeout(r.timer);
  r.link?.leave();
  document.getElementById('race-rivals')?.remove();
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
    return code.length >= 4 && code !== LOBBY ? code : null;
  } catch {
    return null;
  }
}
