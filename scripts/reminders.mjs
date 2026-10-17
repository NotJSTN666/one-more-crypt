// Daily reminders, run every hour by .github/workflows/reminders.yml. Each player gets them
// in their own time zone:
//   8 AM - a new crypt is open (with yesterday's champion);
//   7 PM - the crypt closes soon, only if they haven't descended into it yet.
// Nobody is reminded about a crypt they've already played, and each reminder goes out at
// most once per local day (GitHub can run the job late, so each has a few hours' window).
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The notification keys live in the
// private push_config table; the first run makes them.
// TEST_NAME=<player>: send that player a test notification now instead.
// DRY_RUN=true: only print what would be sent.
import webpush from 'web-push';

const env = process.env;
const SITE = 'https://onemorecrypt.com/';
const supabaseUrl = (env.SUPABASE_URL ?? '').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const DRY_RUN = env.DRY_RUN === 'true';
const TEST_NAME = (env.TEST_NAME ?? '').trim();

const MORNING = [8, 12]; // local hours [from, to)
const EVENING = [19, 23];

// Only the browsers' own push services: the endpoints come from players' browsers.
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', '.push.apple.com', '.notify.windows.com'];

if (!supabaseUrl || !serviceKey) {
  console.log('Reminders are not set up: add the SUPABASE_URL variable and SUPABASE_SERVICE_ROLE_KEY secret.');
  process.exit(0);
}

async function rest(path, init = {}) {
  const headers = { apikey: serviceKey, 'Content-Type': 'application/json', ...init.headers };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys don't.
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- the daily clock (matches src/daily.ts) ----------

const ZONE = 'America/Chicago';
const EPOCH = Date.UTC(2026, 9, 14);
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function localParts(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function dailyNumber(now) {
  const [y, m, d] = localParts(now, ZONE).date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS) + 1;
}

function hoursUntilNextDaily(now) {
  const today = dailyNumber(now);
  let t = now;
  while (dailyNumber(t) === today) t += HOUR_MS / 4;
  return (t - now) / HOUR_MS;
}

function validZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return ZONE;
  }
}

// ---------- keys and sending ----------

async function vapidKeys() {
  let [cfg] = await rest('push_config?id=eq.1&select=public_key,private_key');
  if (!cfg) {
    const keys = webpush.generateVAPIDKeys();
    console.log('First run: made the notification keys.');
    await rest('push_config', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ id: 1, public_key: keys.publicKey, private_key: keys.privateKey }),
    });
    [cfg] = await rest('push_config?id=eq.1&select=public_key,private_key');
  }
  return cfg;
}

function allowedEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((h) => (h.startsWith('.') ? u.hostname.endsWith(h) : u.hostname === h));
  } catch {
    return false;
  }
}

const enc = encodeURIComponent;

/** Send one notification. Returns false when the subscription is gone (and removes it). */
async function send(sub, payload, ttlHours) {
  if (!allowedEndpoint(sub.endpoint)) {
    console.log(`  skipping unknown push service ${sub.endpoint.slice(0, 40)}…`);
    return false;
  }
  if (DRY_RUN) {
    console.log(`  would send to ${sub.endpoint.slice(0, 40)}…: ${payload.title} / ${payload.body}`);
    return true;
  }
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      TTL: Math.round(ttlHours * 3600),
      urgency: 'normal',
      topic: 'daily',
    });
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      await rest(`push_subs?endpoint=eq.${enc(sub.endpoint)}`, { method: 'DELETE' });
      console.log('  removed an expired sign-up');
    } else {
      console.log(`  send failed (${e.statusCode ?? e.message})`);
    }
    return false;
  }
}

// ---------- main ----------

const cfg = await vapidKeys();
webpush.setVapidDetails(SITE, cfg.public_key, cfg.private_key);

if (TEST_NAME) {
  const [profile] = await rest(`profiles?name=eq.${enc(TEST_NAME)}&select=id`);
  if (!profile) throw new Error(`No player named ${TEST_NAME}.`);
  const subs = await rest(`push_subs?user_id=eq.${profile.id}&select=endpoint,p256dh,auth`);
  console.log(`${TEST_NAME} has ${subs.length} device(s) signed up.`);
  for (const sub of subs) {
    await send(sub, { title: 'One More Crypt 🕯️', body: 'Test reminder: notifications are working.', url: SITE, test: true }, 1);
  }
  process.exit(0);
}

const now = Date.now();
const today = dailyNumber(now);
const subs = await rest('push_subs?select=endpoint,user_id,p256dh,auth,tz,morning,evening,last_morning,last_evening');
if (!subs.length) {
  console.log('Nobody has signed up for reminders yet.');
  process.exit(0);
}

const played = new Set((await rest(`runs?mode=eq.daily&daily_no=eq.${today}&select=user_id`)).map((r) => r.user_id));
const [champ] = await rest(`leaderboard_daily?daily_no=eq.${today - 1}&rank=eq.1&select=name,floor&order=name.asc&limit=1`);
const hoursLeft = hoursUntilNextDaily(now);

let sent = 0;
for (const sub of subs) {
  if (played.has(sub.user_id)) continue;
  const local = localParts(now, validZone(sub.tz));
  let kind = null;
  if (sub.morning && local.hour >= MORNING[0] && local.hour < MORNING[1] && sub.last_morning !== local.date) kind = 'morning';
  else if (sub.evening && local.hour >= EVENING[0] && local.hour < EVENING[1] && sub.last_evening !== local.date && hoursLeft >= 1) kind = 'evening';
  if (!kind) continue;

  const others = played.size;
  const payload =
    kind === 'morning'
      ? {
          title: `Daily #${today} is open 🕯️`,
          body: `${champ ? `${champ.name} won yesterday on floor ${champ.floor}. ` : ''}One try. How deep can you go?`,
          url: SITE,
        }
      : {
          title: hoursLeft <= 8 ? `Daily #${today} closes in ${Math.floor(hoursLeft)}h` : `Daily #${today} is still waiting`,
          body: `You haven't descended yet${others ? `, and ${others} ${others === 1 ? 'player has' : 'players have'} already` : ''}. One try before it's gone.`,
          url: SITE,
        };
  console.log(`${kind} reminder (${sub.tz}, ${local.date} ${local.hour}:00)`);
  if (await send(sub, payload, kind === 'morning' ? 4 : 3)) {
    sent++;
    if (!DRY_RUN) {
      await rest(`push_subs?endpoint=eq.${enc(sub.endpoint)}`, {
        method: 'PATCH',
        body: JSON.stringify(kind === 'morning' ? { last_morning: local.date } : { last_evening: local.date }),
      });
    }
  }
}
console.log(`Sent ${sent} reminder(s) to ${subs.length} signed-up device(s).`);
