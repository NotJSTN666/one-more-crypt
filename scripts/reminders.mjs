// Daily reminders, run every hour by .github/workflows/reminders.yml. Each player gets them
// in their own time zone:
//   8 AM - a new crypt is open (with yesterday's champion);
//   7 PM - the crypt closes soon, only if they haven't descended into it yet;
//   rival alerts - someone passed them on today's daily or this week's Endless board.
// Nobody is reminded about a crypt they've already played, and each reminder goes out at
// most once per local day (GitHub can run the job late, so each has a few hours' window).
//
// Email reminders (8 AM, for accounts that turned them on) go out through Resend when
// RESEND_API_KEY is set; players who haven't played in 14 days stop getting them.
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
      // An unread notification is replaced by a newer one of the same kind.
      topic: payload.tag === 'rival' ? 'rival' : 'daily',
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

// ---------- email ----------

const RESEND_KEY = (env.RESEND_API_KEY ?? '').trim();
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** One reminder email through Resend, with an unsubscribe link. */
async function sendEmail(row, { subject, lead, today, champ }) {
  if (!RESEND_KEY) {
    console.log('  email not set up (no RESEND_API_KEY)');
    return false;
  }
  const play = `${SITE}?ref=email`;
  const unsub = `${SITE}?unsub=${enc(row.token)}`;
  if (DRY_RUN) {
    console.log(`  would email ${row.email.replace(/^(.).*@/, '$1…@')}: ${subject}`);
    return true;
  }
  const champLine = champ ? `${escapeHtml(champ.name)} won yesterday on floor ${champ.floor}.` : '';
  const html = `<!doctype html><html><body style="margin:0;background:#07040b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07040b"><tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
      <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:34px;color:#d23a46;">One More Crypt</td></tr>
      <tr><td style="padding:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#f2c14e;">${escapeHtml(lead)}</td></tr>
      <tr><td style="padding:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#e8dcc4;">${champLine} Same crypt for everyone, one try. How deep can you go?</td></tr>
      <tr><td style="padding:22px 0 0;"><a href="${play}" style="display:inline-block;padding:13px 22px;background:#d23a46;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-decoration:none;">PLAY DAILY #${today}</a></td></tr>
      <tr><td style="padding:30px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6f6580;">You asked for a reminder when a new crypt opens. It's skipped on days you've already played. <a href="${unsub}" style="color:#9a8fa8;">Turn off email reminders</a>.</td></tr>
    </table>
  </td></tr></table></body></html>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'One More Crypt <crypt@onemorecrypt.com>',
      to: [row.email],
      subject,
      html,
      text: `${lead}\n\n${champLine ? `${champLine} ` : ''}Same crypt for everyone, one try.\n\nPlay: ${play}\n\nTurn off email reminders: ${unsub}`,
      headers: { 'List-Unsubscribe': `<${unsub}>` },
    }),
  });
  if (!res.ok) {
    console.log(`  email failed (${res.status})`);
    return false;
  }
  return true;
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
  const [mail] = await rest(`email_reminders?user_id=eq.${profile.id}&select=email,token`).catch(() => []);
  if (mail) await sendEmail(mail, { subject: 'Test reminder from One More Crypt 🕯️', lead: 'Email reminders are working.', today: dailyNumber(Date.now()), champ: null });
  else console.log(`${TEST_NAME} has no email reminders on.`);
  process.exit(0);
}

const now = Date.now();
const today = dailyNumber(now);
// Rival alerts need two newer columns; without them, send the reminders alone.
let subs;
let rivalsReady = true;
try {
  subs = await rest('push_subs?select=endpoint,user_id,p256dh,auth,tz,morning,evening,last_morning,last_evening,rivals,rival');
} catch {
  rivalsReady = false;
  subs = await rest('push_subs?select=endpoint,user_id,p256dh,auth,tz,morning,evening,last_morning,last_evening');
}
if (!subs.length) console.log('Nobody has signed up for notifications yet.');

const played = new Set((await rest(`runs?mode=eq.daily&daily_no=eq.${today}&select=user_id`)).map((r) => r.user_id));
const [champ] = await rest(`leaderboard_daily?daily_no=eq.${today - 1}&rank=eq.1&select=name,floor&order=name.asc&limit=1`);
const hoursLeft = hoursUntilNextDaily(now);

// ---------- rival alerts ----------
// Someone passed you on today's daily or this week's Endless board, while you were in the
// top 10. At most RIVAL_MAX a day per device, and only in waking hours: an alert held back
// at night goes out in the morning, since the rank it compares against isn't updated.
const RIVAL_TOP = 10;
const RIVAL_MAX = 2;
const RIVAL_HOURS = [9, 22];

function weekStart(at) {
  const day = new Date(`${localParts(at, ZONE).date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

const boards = rivalsReady
  ? [
      { key: 'd', id: String(today), rows: await rest(`leaderboard_daily?daily_no=eq.${today}&select=user_id,name,floor,rank&order=rank.asc,name.asc`) },
      { key: 'w', id: weekStart(now), rows: await rest('rpc/endless_board?p_period=week&select=user_id,name,floor,rank&order=rank.asc,name.asc').catch(() => []) },
    ]
  : [];

function rivalAlert(board, me, prev) {
  const above = board.rows.filter((r) => r.rank < me.rank).at(-1);
  const who = above?.name ?? 'Someone';
  const floor = above ? `floor ${above.floor}` : 'deeper';
  if (board.key === 'd') {
    const total = board.rows.length;
    return prev <= 3 && me.rank > 3
      ? { title: 'Knocked off the podium 🥀', body: `${who} reached ${floor} in Daily #${today}. You're now #${me.rank} of ${total}. Tomorrow's crypt is your rematch.` }
      : { title: `${who} passed you in Daily #${today}`, body: `They reached ${floor}. You're now #${me.rank} of ${total}.` };
  }
  return { title: `${who} passed you on the Endless board`, body: `They reached ${floor} this week. You're now #${me.rank}. Take your place back.` };
}

let sent = 0;
let rivalsSent = 0;
for (const sub of subs) {
  const local = localParts(now, validZone(sub.tz));

  if (rivalsReady && sub.rivals !== false) {
    const state = { ...(sub.rival && typeof sub.rival === 'object' ? sub.rival : {}) };
    const before = JSON.stringify(state);
    let sentToday = state.sentDay === local.date ? Number(state.sent) || 0 : 0;
    let alerted = false;
    for (const board of boards) {
      const me = board.rows.find((r) => r.user_id === sub.user_id);
      if (!me) continue;
      const prev = state[`${board.key}id`] === board.id ? Number(state[board.key]) : NaN;
      if (Number.isNaN(prev) || me.rank <= prev) {
        state[`${board.key}id`] = board.id;
        state[board.key] = me.rank;
        continue;
      }
      // Dropped. Alert if they were near the top; otherwise just note the new rank.
      if (prev > RIVAL_TOP) {
        state[board.key] = me.rank;
        continue;
      }
      const awake = local.hour >= RIVAL_HOURS[0] && local.hour < RIVAL_HOURS[1];
      if (alerted || !awake || sentToday >= RIVAL_MAX) continue;
      console.log(`rival alert (${board.key === 'd' ? 'daily' : 'endless week'}: #${prev} -> #${me.rank})`);
      if (await send(sub, { ...rivalAlert(board, me, prev), url: SITE, tag: 'rival' }, 6)) {
        alerted = true;
        sentToday++;
        rivalsSent++;
      }
      state[board.key] = me.rank;
    }
    state.sentDay = local.date;
    state.sent = sentToday;
    if (!DRY_RUN && JSON.stringify(state) !== before) {
      await rest(`push_subs?endpoint=eq.${enc(sub.endpoint)}`, { method: 'PATCH', body: JSON.stringify({ rival: state }) });
    }
  }

  // ---------- 8 AM and 7 PM reminders ----------
  if (played.has(sub.user_id)) continue;
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
console.log(`Sent ${sent} reminder(s) and ${rivalsSent} rival alert(s) to ${subs.length} signed-up device(s).`);

// ---------- 8 AM email reminders ----------
let mails = [];
try {
  mails = await rest('email_reminders?select=user_id,email,tz,token,last_sent');
} catch {
  console.log('Email reminders are not set up yet (the email_reminders table is missing).');
}
let emailed = 0;
const ACTIVE_DAYS = 14;
const since = new Date(now - ACTIVE_DAYS * DAY_MS).toISOString();
for (const row of mails) {
  const local = localParts(now, validZone(row.tz));
  if (local.hour < MORNING[0] || local.hour >= MORNING[1] || row.last_sent === local.date || played.has(row.user_id)) continue;
  // Gone quiet for two weeks: stop, rather than keep writing to someone who left.
  const [recent] = await rest(`runs?user_id=eq.${row.user_id}&created_at=gte.${enc(since)}&select=id&limit=1`);
  if (!recent) continue;
  console.log(`morning email (${row.tz}, ${local.date} ${local.hour}:00)`);
  if (await sendEmail(row, { subject: `Daily #${today} is open 🕯️`, lead: `Daily #${today} is open.`, today, champ })) {
    emailed++;
    if (!DRY_RUN) await rest(`email_reminders?user_id=eq.${row.user_id}`, { method: 'PATCH', body: JSON.stringify({ last_sent: local.date }) });
  }
}
console.log(`Emailed ${emailed} reminder(s) to ${mails.length} signed-up player(s).`);

// ---------- new feedback, to the maker's inbox ----------
const FEEDBACK_TO = (env.FEEDBACK_EMAIL_TO ?? env.POST_EMAIL_TO ?? '').split(',').map((a) => a.trim()).filter(Boolean);
let fresh = [];
try {
  fresh = await rest('feedback?emailed=eq.false&select=id,kind,message,name,context,created_at&order=id.asc&limit=50');
} catch {
  console.log('Feedback is not set up yet (the feedback table is missing).');
}
if (fresh.length && RESEND_KEY && FEEDBACK_TO.length) {
  const icon = { bug: '🐞', idea: '💡', balance: '⚖️', love: '❤️', other: '💬' };
  const rows = fresh
    .map((f) => {
      const c = f.context ?? {};
      const meta = [f.name ?? 'Guest', `${c.runs ?? 0} runs`, c.bestEndless ? `Endless best ${c.bestEndless}` : '', c.story ? `${c.story} quests` : '', c.app ? 'app' : '', c.screen ?? ''].filter(Boolean).join(' · ');
      return `<tr><td style="padding:14px 0;border-top:1px solid #2d2139;font-family:Arial,Helvetica,sans-serif;">
        <div style="font-size:13px;color:#f2c14e;">${icon[f.kind] ?? '💬'} ${escapeHtml(f.kind.toUpperCase())}</div>
        <div style="padding:6px 0;font-size:15px;line-height:1.5;color:#e8dcc4;white-space:pre-wrap;">${escapeHtml(f.message)}</div>
        <div style="font-size:12px;color:#6f6580;">${escapeHtml(meta)} · ${escapeHtml(new Date(f.created_at).toUTCString())}</div>
        <div style="font-size:11px;color:#4f4560;">${escapeHtml(String(c.ua ?? ''))}</div></td></tr>`;
    })
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#07040b;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07040b"><tr><td align="center" style="padding:24px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#d23a46;">New feedback</td></tr>
      <tr><td style="padding:4px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9a8fa8;">${fresh.length} new message${fresh.length === 1 ? '' : 's'} from players of One More Crypt.</td></tr>
      ${rows}
    </table></td></tr></table></body></html>`;
  if (DRY_RUN) console.log(`would email ${fresh.length} feedback message(s)`);
  else {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'One More Crypt <crypt@onemorecrypt.com>',
        to: FEEDBACK_TO,
        subject: `${fresh.length} new feedback message${fresh.length === 1 ? '' : 's'} 💬`,
        html,
        text: fresh.map((f) => `[${f.kind}] ${f.name ?? 'Guest'}\n${f.message}`).join('\n\n----\n\n'),
      }),
    });
    if (res.ok) {
      await rest(`feedback?id=in.(${fresh.map((f) => f.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ emailed: true }) });
      console.log(`Emailed ${fresh.length} feedback message(s).`);
    } else console.log(`Feedback email failed (${res.status}).`);
  }
} else if (fresh.length) console.log(`${fresh.length} feedback message(s) waiting (email not set up).`);
