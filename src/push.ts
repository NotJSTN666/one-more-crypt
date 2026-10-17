// Daily reminders: a notification at 8 AM local time when a new crypt is open, and at 7 PM
// if the player hasn't descended yet. The browser signs up here; the hourly job in
// .github/workflows/reminders.yml sends them (scripts/reminders.mjs).
import { framed, installMode } from './install';
import { ONLINE, dropPush, pushPublicKey, savePush } from './online';

export interface ReminderPrefs {
  morning: boolean;
  evening: boolean;
}

const KEY = 'omc:reminders';

/** The server's notification key, once the reminder job has made one. */
let publicKey: string | null = null;

function supported(): boolean {
  return (
    ONLINE &&
    !framed &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    (location.protocol === 'https:' || location.hostname === 'localhost')
  );
}

/** Whether this browser can get reminders right now (iPhone needs the installed app). */
export function remindersAvailable(): boolean {
  return supported() && publicKey !== null;
}

/** iPhone and iPad in Safari: reminders only work once the game is on the home screen. */
export function remindersNeedInstall(): boolean {
  return ONLINE && publicKey !== null && !supported() && installMode() === 'ios';
}

/** The player's reminder choices on this device, or null when reminders are off. */
export function reminderPrefs(): ReminderPrefs | null {
  if (!remindersAvailable() || Notification.permission !== 'granted') return null;
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ReminderPrefs | null;
    return p && (p.morning || p.evening) ? { morning: Boolean(p.morning), evening: Boolean(p.evening) } : null;
  } catch {
    return null;
  }
}

function storePrefs(p: ReminderPrefs | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: reminders still work, the switches just forget their state.
  }
}

function keyBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The app is still loading. Try again in a moment.')), 8000));
  return Promise.race([ready, timeout]);
}

async function subscribe(prefs: ReminderPrefs): Promise<void> {
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    if (!publicKey) throw new Error('Reminders are not switched on yet. Check back soon.');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource });
  }
  const json = sub.toJSON();
  await savePush({
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    tz: timeZone(),
    ...prefs,
  });
}

/** Turn reminders on (or change which ones). Must be called from a tap. */
export async function enableReminders(prefs: ReminderPrefs = { morning: true, evening: true }): Promise<void> {
  if (!remindersAvailable()) throw new Error('This browser cannot show reminders.');
  if (!prefs.morning && !prefs.evening) return disableReminders();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in your browser settings.');
  await subscribe(prefs);
  storePrefs(prefs);
}

export async function disableReminders(): Promise<void> {
  storePrefs(null);
  if (!remindersAvailable()) return;
  const reg = await registration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await dropPush(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/** On start-up: find out whether reminders are set up on the server. */
export async function loadReminders(): Promise<void> {
  if (!ONLINE || publicKey) return;
  publicKey = await pushPublicKey().catch(() => null);
}

/** After sign-in: keep the sign-up current (time zone, account, a renewed subscription). */
export function refreshReminders() {
  void loadReminders().then(() => {
    const prefs = reminderPrefs();
    if (prefs) return subscribe(prefs);
  }).catch(() => undefined);
}
