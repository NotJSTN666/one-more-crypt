// Accounts and leaderboards, backed by Supabase. The Supabase client is loaded on
// demand so the game itself still opens instantly; with no config the game runs
// fully offline and these features stay hidden.

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Mode } from './game';
import { siteUrl } from './share';

// Accept the project URL however it was pasted, e.g. with the /rest/v1/ suffix the
// Supabase dashboard shows on its Data API page.
const URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const ONLINE = Boolean(URL && KEY);
export const X_LOGIN = ONLINE && import.meta.env.VITE_AUTH_X === 'true';

export interface Account {
  id: string;
  /** Null until the player has picked a name. */
  name: string | null;
  kind: 'guest' | 'email' | 'x';
  email: string | null;
}

export interface RunSubmission {
  mode: Mode;
  daily_no: number | null;
  seed: number;
  floor: number;
  kills: number;
  turns: number;
  relics: string;
  killed_by: string;
  log: string;
}

export interface BoardRow {
  user_id: string;
  name: string;
  floor: number;
  kills: number;
  turns: number;
  relics: string;
  killed_by: string;
  rank: number;
  /** Equipped title id and lifetime Souls, from the player's saved progress (may be missing). */
  title?: string | null;
  earned?: number | null;
  /** Daily boards only. */
  daily_no?: number;
  /** The hero played and the outfit the player dresses them in (may be missing). */
  hero?: string | null;
  outfit_look?: string | null;
  outfit_head?: string | null;
}

export interface Board {
  rows: BoardRow[];
  me: BoardRow | null;
  total: number;
}

export interface MyRun {
  mode: Mode;
  daily_no: number | null;
  floor: number;
  kills: number;
  turns: number;
  relics: string;
  killed_by: string;
}

/** Thrown with a message that is safe to show the player. */
export class OnlineError extends Error {}

let clientPromise: Promise<SupabaseClient> | null = null;

function client(): Promise<SupabaseClient> {
  if (!ONLINE) return Promise.reject(new OnlineError('Online features are not set up.'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }),
  );
  return clientPromise;
}

function friendly(err: { code?: string; message?: string } | null | undefined, fallback: string): OnlineError {
  if (!err) return new OnlineError(fallback);
  if (err.code === '23505') return new OnlineError('That name is already taken.');
  if (err.code === '23514') return new OnlineError('Names are 3–16 letters, numbers or _.');
  if (/anonymous/i.test(err.message ?? '')) return new OnlineError('Guest sign-in is disabled on the server.');
  if (/rate limit/i.test(err.message ?? '')) return new OnlineError('Too many attempts. Wait a minute and try again.');
  if (/fetch|network/i.test(err.message ?? '')) return new OnlineError('Could not reach the server. Check your connection.');
  return new OnlineError(err.message || fallback);
}

function kindOf(user: User): Account['kind'] {
  if (user.is_anonymous) return 'guest';
  const provider = user.app_metadata?.provider;
  return provider === 'twitter' || provider === 'x' ? 'x' : 'email';
}

async function toAccount(sb: SupabaseClient, user: User): Promise<Account> {
  const { data } = await sb.from('profiles').select('name').eq('id', user.id).maybeSingle();
  return { id: user.id, name: data?.name ?? null, kind: kindOf(user), email: user.email ?? null };
}

/** Restore the current session (including one returning from an email link or X login). */
export async function currentAccount(): Promise<Account | null> {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  // Tidy auth tokens out of the address bar after a redirect sign-in.
  if (location.hash.includes('access_token') || location.search.includes('code=')) {
    history.replaceState(null, '', siteUrl());
  }
  const user = data.session?.user;
  return user ? toAccount(sb, user) : null;
}

/** Fires when the player signs in or out in another tab or via a redirect. */
export async function onAuthChange(cb: () => void) {
  const sb = await client();
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') cb();
  });
}

export function validName(name: string): string | null {
  return /^[A-Za-z0-9_]{3,16}$/.test(name) ? null : 'Names are 3–16 letters, numbers or _.';
}

/** One-tap account: an anonymous Supabase user plus a chosen name. */
export async function playAsGuest(name: string): Promise<Account> {
  const bad = validName(name);
  if (bad) throw new OnlineError(bad);
  const sb = await client();
  let { data } = await sb.auth.getSession();
  if (!data.session) {
    const res = await sb.auth.signInAnonymously();
    if (res.error) throw friendly(res.error, 'Could not create a guest account.');
    ({ data } = await sb.auth.getSession());
  }
  await setName(name);
  return toAccount(sb, data.session!.user);
}

export async function setName(name: string): Promise<void> {
  const bad = validName(name);
  if (bad) throw new OnlineError(bad);
  const sb = await client();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new OnlineError('Not signed in.');
  const { error } = await sb.from('profiles').upsert({ id: data.user.id, name });
  if (error) throw friendly(error, 'Could not save your name.');
}

export async function sendEmailLink(email: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: siteUrl(), shouldCreateUser: true } });
  if (error) throw friendly(error, 'Could not send the email.');
}

export async function verifyEmailCode(email: string, code: string): Promise<Account> {
  const sb = await client();
  const { data, error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  if (error || !data.user) throw friendly(error, 'That code did not work.');
  return toAccount(sb, data.user);
}

export async function signInWithX(): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.signInWithOAuth({ provider: 'twitter', options: { redirectTo: siteUrl() } });
  if (error) throw friendly(error, 'Could not start X sign-in.');
}

/** Turn a guest account into a permanent one. Supabase emails a confirmation link. */
export async function linkEmail(email: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: siteUrl() });
  if (error) throw friendly(error, 'Could not link that email.');
}

export async function signOut(): Promise<void> {
  const sb = await client();
  await sb.auth.signOut();
}

export async function submitRun(run: RunSubmission): Promise<void> {
  const sb = await client();
  const { error } = await sb.from('runs').insert(run);
  // A duplicate daily means it was already submitted (e.g. from a retry): treat as done.
  if (error && error.code !== '23505') throw friendly(error, 'Could not submit your run.');
}

async function board(view: string, filter: (q: any) => any, userId: string | null, limit: number): Promise<Board> {
  const sb = await client();
  const top = filter(sb.from(view).select('*', { count: 'exact' })).order('rank').limit(limit);
  const mine = userId ? filter(sb.from(view).select('*')).eq('user_id', userId).maybeSingle() : null;
  const [a, b] = await Promise.all([top, mine]);
  if (a.error) throw friendly(a.error, 'Could not load the leaderboard.');
  return { rows: (a.data ?? []) as BoardRow[], me: (b?.data as BoardRow) ?? null, total: a.count ?? 0 };
}

export function dailyBoard(dailyNo: number, userId: string | null, limit = 50): Promise<Board> {
  return board('leaderboard_daily', (q) => q.eq('daily_no', dailyNo), userId, limit);
}

/** How many players finished strictly below this rank in a daily crypt (ties don't count). */
export async function dailyBelow(dailyNo: number, rank: number): Promise<number> {
  const sb = await client();
  const { count } = await sb.from('leaderboard_daily').select('*', { count: 'exact', head: true }).eq('daily_no', dailyNo).gt('rank', rank);
  return count ?? 0;
}

export function endlessBoard(userId: string | null, limit = 50): Promise<Board> {
  return board('leaderboard_endless', (q) => q, userId, limit);
}

/** Progress saved on the account, or null if there is none (or the column isn't set up yet). */
export async function loadRemoteMeta(userId: string): Promise<Record<string, unknown> | null> {
  const sb = await client();
  const { data, error } = await sb.from('profiles').select('meta').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return (data.meta as Record<string, unknown>) ?? null;
}

/** Another player's name and saved progress, for visiting their Crypt Hall. */
export async function loadHall(name: string): Promise<{ name: string; meta: Record<string, unknown> } | null> {
  const sb = await client();
  const { data, error } = await sb.from('profiles').select('name, meta').eq('name', name).maybeSingle();
  if (error) throw friendly(error, 'Could not open that Hall.');
  return data ? { name: data.name as string, meta: (data.meta as Record<string, unknown>) ?? {} } : null;
}

export async function saveRemoteMeta(userId: string, value: unknown): Promise<void> {
  const sb = await client();
  await sb.from('profiles').update({ meta: value }).eq('id', userId);
}

export async function myRuns(userId: string): Promise<MyRun[]> {
  const sb = await client();
  const { data, error } = await sb
    .from('runs')
    .select('mode, daily_no, floor, kills, turns, relics, killed_by')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw friendly(error, 'Could not load your runs.');
  return (data ?? []) as MyRun[];
}

export interface RunLog {
  mode: Mode;
  daily_no: number | null;
  seed: number;
  floor: number;
  kills: number;
  log: string;
}

/** Every run this player has uploaded, with its input log, for rebuilding per-hero records. */
export async function myRunLogs(userId: string): Promise<RunLog[]> {
  const sb = await client();
  const { data, error } = await sb.from('runs').select('mode, daily_no, seed, floor, kills, log').eq('user_id', userId).limit(2000);
  if (error) throw friendly(error, 'Could not load your runs.');
  return (data ?? []) as RunLog[];
}

const ADJ = ['Grim', 'Pale', 'Hollow', 'Ashen', 'Cursed', 'Silent', 'Rotten', 'Bleak', 'Bone', 'Dread', 'Gloom', 'Wretched'];
const NOUN = ['Wraith', 'Ghoul', 'Knight', 'Monk', 'Reaper', 'Warden', 'Crow', 'Lich', 'Shade', 'Hound', 'Delver', 'Thief'];

export function randomName(): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJ)}${pick(NOUN)}${Math.floor(Math.random() * 90) + 10}`;
}

// ---------- live player count ----------

/** Stable per-device id, so several tabs on one device count once. */
function deviceId(): string {
  try {
    let id = localStorage.getItem('wardenfall:device');
    if (!id) {
      id = crypto.randomUUID?.() ?? String(Math.random()).slice(2);
      localStorage.setItem('wardenfall:device', id);
    }
    return id;
  } catch {
    return String(Math.random()).slice(2);
  }
}

/**
 * Join the shared presence channel and report how many players have the game open
 * and visible. Uses Supabase Realtime Presence, so it needs no tables.
 */
export async function watchPlayerCount(onCount: (n: number) => void): Promise<void> {
  const sb = await client();
  const channel = sb.channel('wardenfall:online', { config: { presence: { key: deviceId() } } });
  const update = () => onCount(Object.keys(channel.presenceState()).length);
  channel.on('presence', { event: 'sync' }, update);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED' && !document.hidden) void channel.track({ since: Date.now() });
  });
  // Only count people actually looking at the game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void channel.untrack();
    else void channel.track({ since: Date.now() });
  });
}

// ---------- anonymous activity, for the stats dashboard ----------

let lastPing = 0;

/**
 * Check in: one row per device per day, with no personal data. `played` marks that a
 * run was started today. Errors are ignored; stats are best effort.
 */
export async function pingActivity(played = false): Promise<void> {
  if (!ONLINE) return;
  if (!played && Date.now() - lastPing < 50_000) return;
  lastPing = Date.now();
  try {
    const sb = await client();
    await sb.rpc('ping', { p_device: deviceId(), p_played: played });
  } catch {
    // Offline or not set up yet: the game doesn't care.
  }
}

/** Check in now and then about once a minute while the game is visible. */
export function startActivityPings() {
  if (!ONLINE) return;
  void pingActivity();
  window.setInterval(() => {
    if (!document.hidden) void pingActivity();
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void pingActivity();
  });
}
