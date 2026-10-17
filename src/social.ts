// Sign-in, profile and leaderboard screens, plus keeping local progress in sync
// with the server.

import { playTime } from './share';
import { dailyNumber } from './daily';
import {
  ONLINE,
  OnlineError,
  X_LOGIN,
  currentAccount,
  dailyBelow,
  dailyBoard,
  endlessBoard,
  linkEmail,
  myRuns,
  myRunLogs,
  onAuthChange,
  playAsGuest,
  randomName,
  sendEmailLink,
  setName,
  signInWithX,
  signOut,
  submitRun,
  validName,
  verifyEmailCode,
  watchPlayerCount,
  loadRemoteMeta,
  saveRemoteMeta,
  type Account,
  type Board,
  type BoardRow,
  type RunSubmission,
} from './online';
import { showPublicHall, titleName } from './hall';
import { HEAD_BY_ID, LOOK_BY_ID, rankFor } from './progression';
import { HERO_BY_ID, dailyHero, type HeroId } from './content';
import { heroPortrait } from './hero';
import { BACKFILL_VERSION, backfillHeroes, meta, mergeMeta, onMetaChange, type Meta } from './meta';
import { currentStreak, writeSave, type Save } from './storage';
import { esc, field, formStatus, on, onSubmit, screen, showOverlay, toast } from './ui';

export const session: { account: Account | null; ready: boolean } = { account: null, ready: !ONLINE };

/** Players with the game open right now, or null until known (or offline). */
let playersOnline: number | null = null;

/** Markup for the live player count; empty until the first count arrives. */
export function onlineCountHtml(): string {
  return `<p class="online-count" data-online-count>${onlineCountText()}</p>`;
}

function onlineCountText(): string {
  if (playersOnline === null) return '';
  return playersOnline <= 1
    ? '<span class="live-dot"></span>Just you in the crypt right now'
    : `<span class="live-dot"></span>${playersOnline} souls in the crypt right now`;
}

function renderOnlineCount() {
  document.querySelectorAll('[data-online-count]').forEach((el) => (el.innerHTML = onlineCountText()));
}

let save: Save;
let onChange: () => void = () => undefined;

/** Name to show for the current player, online or off. */
export function playerName(): string {
  return session.account?.name ?? save.name ?? '';
}

export function signedIn(): boolean {
  return Boolean(session.account?.name);
}

/**
 * Restore any session and sync. `changed` is called whenever the account changes
 * so the title screen can redraw.
 */
export async function initSocial(s: Save, changed: () => void) {
  save = s;
  onChange = changed;
  if (!ONLINE) return;
  try {
    session.account = await currentAccount();
  } catch {
    session.account = null;
  }
  session.ready = true;
  void onAuthChange(refreshAccount);
  void watchPlayerCount((n) => {
    playersOnline = n;
    renderOnlineCount();
  }).catch(() => undefined);
  if (signedIn()) void afterSignIn();
  onChange();
}

async function refreshAccount() {
  try {
    session.account = await currentAccount();
  } catch {
    return;
  }
  if (signedIn()) void afterSignIn();
  onChange();
}

async function afterSignIn() {
  await flushPending();
  await syncFromServer();
  await syncMeta();
  await backfill();
}

/** Once per account: rebuild per-hero records and Hall statues from past runs. */
async function backfill() {
  const acc = session.account;
  if (!acc || meta.heroBackfill >= BACKFILL_VERSION) return;
  try {
    await backfillHeroes(await myRunLogs(acc.id));
    onChange();
  } catch {
    // Try again next visit.
  }
}

/** Merge progress saved on the account with this device's, then save the result back. */
async function syncMeta() {
  const acc = session.account;
  if (!acc) return;
  try {
    const remote = await loadRemoteMeta(acc.id);
    if (remote) mergeMeta(remote as Partial<Meta>);
    await saveRemoteMeta(acc.id, meta);
    onChange();
  } catch {
    // Offline or not set up yet: progress stays on this device.
  }
}

// Push progress to the account shortly after it changes.
let metaTimer = 0;
onMetaChange(() => {
  if (!signedIn()) return;
  window.clearTimeout(metaTimer);
  metaTimer = window.setTimeout(() => {
    const acc = session.account;
    if (acc) void saveRemoteMeta(acc.id, meta).catch(() => undefined);
  }, 2500);
});

/** Pull this account's daily results so "one attempt a day" holds across devices. */
async function syncFromServer() {
  const acc = session.account;
  if (!acc) return;
  try {
    const runs = await myRuns(acc.id);
    let changed = false;
    for (const r of runs) {
      if (r.mode === 'daily' && r.daily_no && !save.daily[r.daily_no]) {
        save.daily[r.daily_no] = { floor: r.floor, kills: r.kills, turns: r.turns, relics: r.relics, killedBy: r.killed_by };
        changed = true;
      }
      if (r.mode === 'endless' && r.floor > save.bestEndless) {
        save.bestEndless = r.floor;
        changed = true;
      }
    }
    if (changed) {
      writeSave(save);
      onChange();
    }
  } catch {
    // Offline: local data is still correct for this device.
  }
}

// ---------- run submission ----------

/** Queue a finished run and try to upload it. Resolves to true once it is on the server. */
export async function recordRun(run: RunSubmission): Promise<boolean> {
  if (!ONLINE) return false;
  save.pending.push(run);
  save.pending = save.pending.slice(-30);
  writeSave(save);
  if (!signedIn()) return false;
  await flushPending();
  return !save.pending.includes(run);
}

/** Upload any queued runs now. */
export function syncNow(): Promise<void> {
  return flushPending();
}

let flushing: Promise<void> | null = null;

/** Upload queued runs one at a time; concurrent callers share the same pass. */
function flushPending(): Promise<void> {
  flushing ??= doFlush().finally(() => (flushing = null));
  return flushing;
}

async function doFlush() {
  while (save.pending.length && signedIn()) {
    const run = save.pending[0];
    try {
      await submitRun(run);
    } catch (e) {
      // Keep it for later if we're offline; drop runs the server refuses (e.g. an expired daily).
      if (e instanceof OnlineError && e.message.startsWith('Could not reach')) return;
    }
    save.pending.shift();
    writeSave(save);
  }
}

let record: { at: number; value: Promise<{ name: string; floor: number } | null> } | null = null;

/** The deepest endless run anyone has made, cached for a few minutes. Null offline or on error. */
export function endlessRecord(): Promise<{ name: string; floor: number } | null> {
  if (!ONLINE) return Promise.resolve(null);
  if (!record || Date.now() - record.at > 5 * 60_000) {
    record = {
      at: Date.now(),
      value: endlessBoard(null, 1)
        .then((b) => (b.rows[0] ? { name: b.rows[0].name, floor: b.rows[0].floor } : null))
        .catch(() => null),
    };
  }
  return record.value;
}

/** One line for the results screen, e.g. "#3 of 41 today". */
export async function rankLine(mode: 'daily' | 'endless', dailyNo: number, floor: number): Promise<string> {
  const acc = session.account;
  if (!acc) return '';
  const board = mode === 'daily' ? await dailyBoard(dailyNo, acc.id, 1) : await endlessBoard(acc.id, 1);
  if (!board.me) return '';
  if (mode === 'daily') {
    if (board.total <= 1) return "Rank #1 of 1. You're the first to fall today";
    const below = await dailyBelow(dailyNo, board.me.rank);
    const beat = Math.round((below / (board.total - 1)) * 100);
    return `Rank #${board.me.rank} of ${board.total} · you beat ${beat}% of today's delvers`;
  }
  return board.me.floor > floor
    ? `Your best: floor ${board.me.floor} · #${board.me.rank} of ${board.total}`
    : `Rank #${board.me.rank} of ${board.total} all-time`;
}

// ---------- sign-in screens ----------

type Step = 'start' | 'email' | 'code' | 'name';

export function showLogin(back: () => void, step: Step = 'start', email = '') {
  if (ONLINE) save.seenOnlineLogin = true;
  else save.seenLogin = true;
  writeSave(save);
  const done = () => {
    onChange();
    back();
  };

  if (!ONLINE) {
    showOverlay('login', `
      <h2>Who descends?</h2>
      <p class="sub">Pick a name for your runs. Progress is saved on this device.</p>
      ${nameForm(save.name || randomName(), 'Enter the crypt')}
      <button class="link-btn" id="skip">Skip for now</button>`);
    wireDice();
    onSubmit('#name-form', (form) => {
      const name = field(form, 'name');
      const bad = validName(name);
      if (bad) return formStatus(form, bad);
      save.name = name;
      writeSave(save);
      done();
    });
    on('#skip', done);
    return;
  }

  if (step === 'start') {
    showOverlay('login', `
      <h2>Claim your name</h2>
      <p class="sub">Your name goes on the leaderboards. Progress is saved to your account.</p>
      ${nameForm(save.name || randomName(), 'Enter the crypt')}
      <p class="fine">Starts a guest account on this device. Add an email later to play on other devices too.</p>
      <div class="divider"><span>or sign in</span></div>
      ${X_LOGIN ? '<button class="btn x" id="x-login">Continue with 𝕏</button>' : ''}
      <button class="btn" id="email-login">Continue with email</button>
      <button class="link-btn" id="skip">Skip, play without a leaderboard</button>`);
    wireDice();
    onSubmit('#name-form', async (form) => {
      formStatus(form, 'Entering…', true);
      try {
        session.account = await playAsGuest(field(form, 'name'));
        toast(`Welcome, ${session.account.name}`);
        void afterSignIn();
        done();
      } catch (e) {
        formStatus(form, (e as Error).message);
      }
    });
    on('#x-login', () => void signInWithX().catch((e) => toast((e as Error).message)));
    on('#email-login', () => showLogin(back, 'email'));
    on('#skip', done);
    return;
  }

  if (step === 'email') {
    showOverlay('login', `
      <h2>Sign in</h2>
      <p class="sub">We'll email you a sign-in link and code. No password.</p>
      <form id="email-form" class="form">
        <input name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        <button class="btn primary" type="submit">Send sign-in email</button>
        <p class="form-status" role="status"></p>
      </form>
      <button class="link-btn" id="back">Back</button>`);
    onSubmit('#email-form', async (form) => {
      const addr = field(form, 'email');
      formStatus(form, 'Sending…', true);
      try {
        await sendEmailLink(addr);
        showLogin(back, 'code', addr);
      } catch (e) {
        formStatus(form, (e as Error).message);
      }
    });
    on('#back', () => showLogin(back, 'start'));
    return;
  }

  if (step === 'code') {
    showOverlay('login', `
      <h2>Check your email</h2>
      <p class="sub">Sent to ${esc(email)}. Tap the sign-in link in the email.</p>
      <p class="fine">If the email shows a 6-digit code, you can type it here instead. Handy when the link opens in a different browser.</p>
      <form id="code-form" class="form">
        <input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" maxlength="10" required />
        <button class="btn primary" type="submit">Sign in</button>
        <p class="form-status" role="status"></p>
      </form>
      <button class="link-btn" id="back">Use a different email</button>`);
    onSubmit('#code-form', async (form) => {
      formStatus(form, 'Checking…', true);
      try {
        session.account = await verifyEmailCode(email, field(form, 'code'));
        if (!session.account.name) return showLogin(back, 'name');
        toast(`Welcome back, ${session.account.name}`);
        void afterSignIn();
        done();
      } catch (e) {
        formStatus(form, (e as Error).message);
      }
    });
    on('#back', () => showLogin(back, 'email'));
    return;
  }

  // step === 'name': signed in but no profile yet
  showOverlay('login', `
    <h2>Choose your name</h2>
    <p class="sub">This is how you'll appear on the leaderboards.</p>
    ${nameForm(randomName(), 'Save name')}`);
  wireDice();
  onSubmit('#name-form', async (form) => {
    formStatus(form, 'Saving…', true);
    try {
      await setName(field(form, 'name'));
      session.account = await currentAccount();
      void afterSignIn();
      done();
    } catch (e) {
      formStatus(form, (e as Error).message);
    }
  });
}

function nameForm(value: string, label: string): string {
  return `
    <form id="name-form" class="form">
      <div class="name-row">
        <input name="name" value="${esc(value)}" maxlength="16" autocomplete="nickname" spellcheck="false" aria-label="Name" required />
        <button type="button" class="icon-btn dice" id="dice" aria-label="Random name">🎲</button>
      </div>
      <button class="btn primary" type="submit">${label}</button>
      <p class="form-status" role="status"></p>
    </form>`;
}

function wireDice() {
  on('#dice', () => {
    const input = document.querySelector<HTMLInputElement>('#name-form [name=name]');
    if (input) input.value = randomName();
  });
}

/** Called when a redirect sign-in lands without a profile, so we can ask for a name. */
export function needsName(): boolean {
  return Boolean(session.account && !session.account.name);
}

// ---------- profile ----------

export function showProfile(back: () => void) {
  const acc = session.account;
  if (ONLINE && !acc?.name) return showLogin(back, acc ? 'name' : 'start');
  const today = dailyNumber();
  const kindLabel = !ONLINE
    ? 'Saved on this device'
    : acc!.kind === 'guest'
      ? 'Guest account (this device only)'
      : acc!.kind === 'x'
        ? 'Signed in with 𝕏'
        : `Signed in as ${esc(acc!.email ?? '')}`;

  showOverlay('profile', `
    <h2>${esc(playerName() || 'Nameless')}</h2>
    <p class="sub">${kindLabel}</p>
    <div class="stat-grid" id="stats">${statGrid(localStats(today))}</div>
    <details class="card">
      <summary>Change name</summary>
      ${nameForm(playerName() || randomName(), 'Save name')}
    </details>
    ${
      acc?.kind === 'guest'
        ? `<div class="card">
            <div>Keep your progress</div>
            <p class="fine">Add an email so you can sign in on any device. Guest progress is lost if this browser's data is cleared.</p>
            <form id="link-form" class="form">
              <input name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
              <button class="btn" type="submit">Add email</button>
              <p class="form-status" role="status"></p>
            </form>
          </div>`
        : ''
    }
    <button class="btn primary" id="back">Back</button>
    ${acc ? '<button class="link-btn" id="signout">Sign out</button>' : ''}`);

  wireDice();
  onSubmit('#name-form', async (form) => {
    const name = field(form, 'name');
    if (!ONLINE) {
      const bad = validName(name);
      if (bad) return formStatus(form, bad);
      save.name = name;
      writeSave(save);
      return showProfile(back);
    }
    formStatus(form, 'Saving…', true);
    try {
      await setName(name);
      session.account = { ...acc!, name };
      onChange();
      showProfile(back);
    } catch (e) {
      formStatus(form, (e as Error).message);
    }
  });
  onSubmit('#link-form', async (form) => {
    formStatus(form, 'Sending…', true);
    try {
      await linkEmail(field(form, 'email'));
      formStatus(form, 'Check your inbox and tap the confirmation link.');
    } catch (e) {
      formStatus(form, (e as Error).message);
    }
  });
  on('#back', back);
  on('#signout', async () => {
    if (acc?.kind === 'guest' && !confirm('Sign out of a guest account? You will not be able to sign back in to it.')) return;
    await signOut();
    session.account = null;
    onChange();
    back();
  });

  if (acc) {
    void myRuns(acc.id)
      .then((runs) => {
        if (screen !== 'profile') return;
        const daily = runs.filter((r) => r.mode === 'daily');
        const endless = runs.filter((r) => r.mode === 'endless');
        $stats(
          statGrid({
            runs: runs.length,
            kills: runs.reduce((n, r) => n + r.kills, 0),
            bestDaily: Math.max(0, ...daily.map((r) => r.floor)),
            bestEndless: Math.max(0, ...endless.map((r) => r.floor)),
            dailies: daily.length,
            streak: currentStreak(save, today),
          }),
        );
      })
      .catch(() => undefined);
  }
}

function $stats(html: string) {
  const el = document.getElementById('stats');
  if (el) el.innerHTML = html;
}

interface Stats {
  runs: number;
  kills: number;
  bestDaily: number;
  bestEndless: number;
  dailies: number;
  streak: number;
}

function localStats(today: number): Stats {
  return {
    runs: save.totals.runs,
    kills: save.totals.kills,
    bestDaily: Math.max(save.totals.bestDaily, ...Object.values(save.daily).map((d) => d.floor)),
    bestEndless: save.bestEndless,
    dailies: Object.keys(save.daily).length,
    streak: currentStreak(save, today),
  };
}

function statGrid(s: Stats): string {
  const cell = (v: number, label: string) => `<div><b>${v}</b>${label}</div>`;
  return [
    cell(s.bestDaily, 'BEST DAILY'),
    cell(s.bestEndless, 'BEST ENDLESS'),
    cell(s.streak, 'DAY STREAK'),
    cell(s.dailies, 'DAILIES'),
    cell(s.runs, 'RUNS'),
    cell(s.kills, 'KILLS'),
  ].join('');
}

// ---------- leaderboards ----------

type Tab = 'today' | 'yesterday' | 'endless';

/** Rows shown at first, and after tapping Show more. */
const BOARD_FIRST = 25;
const BOARD_MORE = 100;

export function showLeaderboard(back: () => void, tab: Tab = 'today', limit = BOARD_FIRST) {
  const today = dailyNumber();
  const tabs: [Tab, string][] = [
    ['today', `Daily #${today}`],
    ['yesterday', `#${today - 1}`],
    ['endless', 'Endless'],
  ];
  showOverlay('board', `
    <button class="back-top" id="back-top" aria-label="Back">← Back</button>
    <h2>Leaderboard</h2>
    <div class="tabs" role="tablist">
      ${tabs
        .filter(([t]) => t !== 'yesterday' || today > 1)
        .map(([t, label]) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`)
        .join('')}
    </div>
    <p class="fine">Tap a name to visit their Crypt Hall.</p>
    <div id="board-body" class="board"><p class="sub">Summoning the dead…</p></div>
    ${signedIn() ? '' : '<button class="btn" id="join">Claim a name to join</button>'}
    <button class="btn primary" id="back">Back</button>`);
  document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) =>
    b.addEventListener('click', () => showLeaderboard(back, b.dataset.tab as Tab)),
  );
  on('#back', back);
  on('#back-top', back);
  on('#join', () => showLogin(() => showLeaderboard(back, tab)));

  const uid = session.account?.id ?? null;
  const fill = (n: number) => {
    const load: Promise<Board> =
      tab === 'endless' ? endlessBoard(uid, n) : dailyBoard(tab === 'today' ? today : today - 1, uid, n);
    return load
      .then((b) => {
        if (screen !== 'board') return;
        const body = document.getElementById('board-body');
        if (!body) return;
        body.innerHTML = boardHtml(b, uid, tab, n < BOARD_MORE);
        body.querySelectorAll<HTMLElement>('[data-hall]').forEach((li) =>
          li.addEventListener('click', () => showPublicHall(li.dataset.hall!, () => showLeaderboard(back, tab, n))),
        );
        const more = body.querySelector<HTMLButtonElement>('#board-more');
        more?.addEventListener('click', () => {
          more.disabled = true;
          more.textContent = 'Summoning more…';
          void fill(BOARD_MORE);
        });
      })
      .catch((e) => {
        const body = document.getElementById('board-body');
        if (body) body.innerHTML = `<p class="sub">${esc((e as Error).message)}</p>`;
      });
  };
  void fill(limit);
}

const portraits = new Map<string, string>();

/** A small portrait of the hero a player ran with, in their outfit. Unknown ids are dropped. */
function boardPortrait(r: BoardRow): string {
  const hero = (r.hero && HERO_BY_ID[r.hero as HeroId] ? r.hero : r.daily_no ? dailyHero(r.daily_no) : 'knight') as HeroId;
  const look = r.outfit_look && LOOK_BY_ID[r.outfit_look] ? r.outfit_look : '';
  const head = r.outfit_head && HEAD_BY_ID[r.outfit_head] ? r.outfit_head : '';
  const key = `${hero}:${look}:${head}`;
  let url = portraits.get(key);
  if (!url) {
    url = heroPortrait(hero, {}, [], 2, look, head);
    portraits.set(key, url);
  }
  return url;
}

function boardHtml(b: Board, uid: string | null, tab: Tab, canShowMore: boolean): string {
  if (!b.rows.length) {
    return `<p class="sub">${tab === 'endless' ? 'No endless runs yet.' : 'Nobody has fallen yet today. Be the first.'}</p>`;
  }
  const row = (r: BoardRow) => `
    <li class="${r.user_id === uid ? 'me' : ''}" data-hall="${esc(r.name)}" tabindex="0" title="Visit ${esc(r.name)}'s Hall">
      <span class="rank">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}</span>
      <img class="board-hero" src="${boardPortrait(r)}" alt="" width="24" height="24" />
      <span class="who"><span style="color:${rankFor(Number(r.earned) || 0).color}">${esc(r.name)}</span>${titleName(r.title) ? ` <em class="title-tag">${esc(titleName(r.title))}</em>` : ''}<small>${esc(r.relics)}</small></span>
      <span class="depth">F${r.floor}<small>${r.kills} kills${r.seconds ? ` · ⏱ ${playTime(r.seconds)}` : ''}</small></span>
    </li>`;
  const meOutside = b.me && !b.rows.some((r) => r.user_id === b.me!.user_id);
  return `
    <p class="sub">${b.total} ${b.total === 1 ? 'soul' : 'souls'} ${tab === 'endless' ? 'ranked' : 'descended'}</p>
    <ol>${b.rows.map(row).join('')}</ol>
    ${canShowMore && b.total > b.rows.length ? `<button class="btn" id="board-more">Show more<small>${b.total <= BOARD_MORE ? `See all ${b.total}` : `Top ${BOARD_MORE} of ${b.total}`}</small></button>` : ''}
    ${meOutside ? `<ol class="mine">${row(b.me!)}</ol>` : ''}`;
}
