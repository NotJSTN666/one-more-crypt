// An update email: one message about a big update, to accounts with a confirmed email address.
// Run by .github/workflows/update-email.yml (on its schedule, or by hand).
//
// Rules it keeps (the privacy policy promises them):
//   - only confirmed email addresses, and never anyone who has unsubscribed from update emails;
//   - a one-click unsubscribe link in every email, and the sender's postal address (CAN-SPAM);
//   - no addresses that look UK or EU (by their domain, or a European time zone the game knows),
//     since those players never opted in to update emails;
//   - each campaign goes to each account at most once, even if the job runs again.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MAIL_POSTAL_ADDRESS (required to
// send), CAMPAIGN (default midwinter-2026), SEND_ON (Central date the scheduled run may send on),
// SEND_NOW=true (a manual run that sends whatever the date), TEST_TO=<email> (send one test copy
// there and nothing else), DRY_RUN=true (only say who would get it).

const env = process.env;
const SITE = 'https://onemorecrypt.com/';
const supabaseUrl = (env.SUPABASE_URL ?? '').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const RESEND_KEY = (env.RESEND_API_KEY ?? '').trim();
const POSTAL = (env.MAIL_POSTAL_ADDRESS ?? '').trim();
const CAMPAIGN = (env.CAMPAIGN ?? 'midwinter-2026').trim();
const SEND_ON = (env.SEND_ON ?? '2026-11-27').trim();
const SEND_NOW = env.SEND_NOW === 'true';
const TEST_TO = (env.TEST_TO ?? '').trim();
const DRY_RUN = env.DRY_RUN === 'true';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

if (!supabaseUrl || !serviceKey) {
  console.log('Not set up: needs the SUPABASE_URL variable and the SUPABASE_SERVICE_ROLE_KEY secret.');
  process.exit(1);
}

async function rest(path, init = {}) {
  const headers = { apikey: serviceKey, 'Content-Type': 'application/json', ...init.headers };
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- who it goes to ----------

/** UK and EU (and EEA, Switzerland) country domains, and big mail providers that are clearly European. */
const EUROPE_TLDS = ['uk', 'eu', 'de', 'fr', 'nl', 'be', 'lu', 'it', 'es', 'pt', 'ie', 'at', 'se', 'dk', 'fi', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'gr', 'hr', 'si', 'ee', 'lv', 'lt', 'mt', 'cy', 'is', 'no', 'li', 'ch'];
const EUROPE_PROVIDERS = ['poczta.fm', 'googlemail.com', 'gmx.net', 'gmx.com', 'web.de', 'mail.ru', 'laposte.net', 'libero.it', 'seznam.cz'];

function looksEuropean(email, tz) {
  if (tz && tz.startsWith('Europe/')) return true;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (EUROPE_PROVIDERS.includes(domain)) return true;
  return EUROPE_TLDS.includes(domain.split('.').pop());
}

// ---------- the email ----------

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const SUBJECT = 'Midwinter has come to the crypt ❄️';
const PREHEADER = "Act III of the story, the Twelve Gifts, and snow in every crypt. Until January 6.";
const ITEMS = [
  ['📖', 'Act III: The Long Night', 'Something under everything is knocking, very politely. The Frozen Mere, four quests and two side quests, the Midwinter Guest, and a choice to make at the end of the longest night. (Finish Act II first.)'],
  ['🎁', 'The Twelve Gifts', 'Finish a run on any day of Midwinter to open the next of twelve gifts: Souls, two cloaks, a gift bow, an aura, and on the twelfth day a crown and a title.'],
  ['🎄', 'Midwinter everywhere', 'Snow on the walls, icicles and holly in every crypt, snow on the title and sleigh bells in the music.'],
  ['🕯️', "Today's Daily Crypt", 'Same crypt for everyone in the world, one try. How deep can you go?'],
];

function message(unsub) {
  const play = `${SITE}?ref=email-${encodeURIComponent(CAMPAIGN)}`;
  const items = ITEMS.map(([icon, title, body]) => `
      <tr><td style="padding:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#e8dcc4;">
        <b style="color:#bfe8ff;">${icon} ${esc(title)}</b><br>${esc(body)}
      </td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#07040b;">
  <div style="display:none;max-height:0;overflow:hidden;">${esc(PREHEADER)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07040b"><tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:34px;color:#d23a46;">One More Crypt</td></tr>
      <tr><td style="padding:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;color:#bfe8ff;">❄️ Midwinter has come to the crypt</td></tr>
      <tr><td style="padding:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#e8dcc4;">It's snowing in Gravesend for the first time in four hundred years. Here's what came with it:</td></tr>
      ${items}
      <tr><td style="padding:24px 0 0;"><a href="${play}" style="display:inline-block;padding:13px 22px;background:#d23a46;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-decoration:none;">PLAY NOW</a></td></tr>
      <tr><td style="padding:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9a8fa8;">Free in your browser, no download. Midwinter lasts until January 6.</td></tr>
      <tr><td style="padding:30px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6f6580;">
        You're getting this because you made a One More Crypt account with this email address. We only email about big updates, a few times a year.
        <a href="${unsub}" style="color:#9a8fa8;">Unsubscribe from update emails</a> with one click.<br><br>
        One More Crypt · ${esc(POSTAL)}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [
    'Midwinter has come to the crypt',
    '',
    "It's snowing in Gravesend for the first time in four hundred years. Here's what came with it:",
    '',
    ...ITEMS.map(([icon, title, body]) => `${icon} ${title}: ${body}`),
    '',
    `Play now (free in your browser): ${play}`,
    'Midwinter lasts until January 6.',
    '',
    "You're getting this because you made a One More Crypt account with this email address. We only email about big updates, a few times a year.",
    `Unsubscribe from update emails: ${unsub}`,
    '',
    `One More Crypt · ${POSTAL}`,
  ].join('\n');
  return { html, text };
}

async function send(to, token) {
  const unsub = `${SITE}?unsubupdates=${encodeURIComponent(token)}`;
  const { html, text } = message(unsub);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'One More Crypt <crypt@onemorecrypt.com>',
      reply_to: 'onemorecrypt@gmail.com',
      to: [to],
      subject: SUBJECT,
      html,
      text,
      headers: { 'List-Unsubscribe': `<${unsub}>, <mailto:onemorecrypt@gmail.com?subject=unsubscribe>` },
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

const hide = (email) => email.replace(/^(.).*@/, '$1…@');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- main ----------

const sending = !DRY_RUN;
if (sending && (!RESEND_KEY || !POSTAL)) {
  console.log('Not sending: needs the RESEND_API_KEY secret and the MAIL_POSTAL_ADDRESS variable (a postal address, required in every update email).');
  process.exit(1);
}

if (TEST_TO) {
  console.log(`Test: one copy of "${SUBJECT}" to ${hide(TEST_TO)}${DRY_RUN ? ' (dry run, not sent)' : ''}.`);
  if (sending) await send(TEST_TO, 'test-link-does-nothing');
  process.exit(0);
}

if (sending && !SEND_NOW && today !== SEND_ON) {
  console.log(`Not sending: today is ${today} (Central) and this campaign is for ${SEND_ON}. Run by hand with send_now to send anyway.`);
  process.exit(0);
}

const all = (await rest('rpc/update_email_recipients', { method: 'POST', body: '{}' })) ?? [];
const fresh = all.filter((r) => r.last_campaign !== CAMPAIGN);
const europe = fresh.filter((r) => looksEuropean(r.email, r.tz));
const to = fresh.filter((r) => !looksEuropean(r.email, r.tz));
console.log(`${all.length} confirmed and subscribed · ${all.length - fresh.length} already sent ${CAMPAIGN} · ${europe.length} skipped as UK/EU · ${to.length} to send.`);

let sent = 0;
let failed = 0;
for (const r of to) {
  if (!sending) {
    console.log(`  would email ${hide(r.email)}`);
    continue;
  }
  try {
    await send(r.email, r.token);
    await rest(`update_emails?user_id=eq.${encodeURIComponent(r.user_id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ last_campaign: CAMPAIGN, last_sent: new Date().toISOString() }),
    });
    sent++;
  } catch (e) {
    failed++;
    console.log(`  ${hide(r.email)} failed: ${e.message}`);
  }
  // (Resend's default limit is two a second)
  await sleep(600);
}
if (sending) console.log(`Sent ${sent}, failed ${failed}.`);
if (failed) process.exit(1);
