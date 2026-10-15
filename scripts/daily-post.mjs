// Automatic daily posts for @OneMoreCrypt, run by .github/workflows/daily-post.yml at
// 7 AM Central:
//   1. a new endless record (or, on Mondays, the reigning endless champion);
//   2. crowns yesterday's daily champion, with a picture of their hero in its final form;
//   3. announces that today's crypt is open, with today's hero.
//
// MODE decides what happens with them:
//   email   - email a "post kit" (images, text and an Open-in-X link per post) to POST_EMAIL_TO
//             through Resend, for posting by hand. The default.
//   post    - post them to @OneMoreCrypt through the X API (needs X API credits).
//   preview - only write the images and text to out/.
// Locally: SUPABASE_URL=... SUPABASE_ANON_KEY=... MODE=preview node scripts/daily-post.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { TwitterApi } from 'twitter-api-v2';

const env = process.env;
const MODE = ['email', 'post', 'preview'].includes(env.MODE) ? env.MODE : 'email';
const SCHEDULED = env.SCHEDULED === 'true';
const SITE = 'https://onemorecrypt.com';
const HANDLE = '@OneMoreCrypt';
const OUT = 'out';
const PORT = 5199;

const supabaseUrl = (env.SUPABASE_URL ?? '').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseKey = (env.SUPABASE_ANON_KEY ?? '').trim();

async function rest(path) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Yesterday's winner (and anyone tied with them), plus the winning run's log. */
async function champion(dailyNo) {
  if (!supabaseUrl || !supabaseKey) return null;
  const top = await rest(`leaderboard_daily?daily_no=eq.${dailyNo}&rank=eq.1&select=user_id,name,floor,kills,turns,relics&order=name.asc`);
  if (!top.length) return null;
  const best = top[0];
  const [run] = await rest(`runs?mode=eq.daily&daily_no=eq.${dailyNo}&user_id=eq.${best.user_id}&select=seed,log&limit=1`);
  if (!run?.log) return null;
  const others = top.slice(1, 4).map((t) => t.name);
  return { ...best, seed: Number(run.seed), log: run.log, dailyNo, others: others.length ? others.join(', ') + (top.length > 4 ? ' and more' : '') : '' };
}

/**
 * The endless leaderboard's #1, posted when they set the record in the last day, and every
 * Monday as a reminder of who to beat.
 */
async function endlessLeader(isMonday) {
  if (!supabaseUrl || !supabaseKey) return null;
  const [top] = await rest('leaderboard_endless?rank=eq.1&select=user_id,name,floor,kills,turns,relics,created_at&order=created_at.asc&limit=1');
  if (!top) return null;
  const fresh = Date.now() - Date.parse(top.created_at) < 24 * 3600 * 1000;
  if (!fresh && !isMonday) return null;
  const [run] = await rest(`runs?mode=eq.endless&user_id=eq.${top.user_id}&floor=eq.${top.floor}&kills=eq.${top.kills}&turns=eq.${top.turns}&select=seed,log&limit=1`);
  return { ...top, fresh, seed: Number(run?.seed ?? 0), log: run?.log ?? '' };
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Email the day's posts, ready to copy, save and post by hand. */
async function emailKit(dailyNo, posts) {
  const missing = ['RESEND_API_KEY', 'POST_EMAIL_TO'].filter((k) => !env[k]);
  if (missing.length) {
    // Not set up yet: keep the pictures and text in the run's download instead of failing.
    console.log(`\nEmail not set up (missing ${missing.join(' and ')}); the posts are in the run's "post-preview" download.`);
    return;
  }
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const blocks = posts
    .map((p, i) => {
      const intent = `https://x.com/intent/post?${new URLSearchParams({ text: p.text })}`;
      return `
      <tr><td style="padding:26px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f2c14e;">Post ${i + 1} of ${posts.length} · ${escapeHtml(p.label)}</td></tr>
      <tr><td><img src="cid:${p.name}" width="560" alt="${escapeHtml(p.label)}" style="display:block;width:100%;max-width:560px;height:auto;border:1px solid #2d2139;border-radius:6px;"></td></tr>
      <tr><td style="padding:12px 0 0;"><div style="padding:14px 16px;background:#150e1d;border:1px solid #2d2139;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#e8dcc4;white-space:pre-wrap;">${escapeHtml(p.text)}</div></td></tr>
      <tr><td style="padding:12px 0 0;">
        <a href="${escapeHtml(intent)}" style="display:inline-block;padding:11px 18px;background:#d23a46;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-decoration:none;">OPEN IN X WITH THIS TEXT</a>
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a8fa8;">&nbsp; then attach <b>${p.name}.png</b></span>
      </td></tr>`;
    })
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#07040b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07040b"><tr><td align="center" style="padding:24px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:30px;color:#d23a46;">Today's posts</td></tr>
      <tr><td style="padding:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#9a8fa8;">${escapeHtml(date)} · Daily #${dailyNo}. Post them in this order, so the newest post on @OneMoreCrypt is today's crypt. The images are attached to this email too.</td></tr>
      ${blocks}
      <tr><td style="padding:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6f6580;">Sent by the Daily X post job in the one-more-crypt repo.</td></tr>
    </table>
  </td></tr></table></body></html>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'One More Crypt <crypt@onemorecrypt.com>',
      to: env.POST_EMAIL_TO.split(',').map((a) => a.trim()).filter(Boolean),
      subject: `Your X posts for Daily #${dailyNo}`,
      html,
      text: posts.map((p, i) => `POST ${i + 1}: ${p.label}\n\n${p.text}\n\n(attach ${p.name}.png)`).join('\n\n----\n\n'),
      attachments: posts.map((p) => ({ filename: `${p.name}.png`, content: p.image.toString('base64'), content_id: p.name })),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  console.log(`\nEmailed the post kit: ${(await res.json()).id}`);
}

function startVite() {
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  return vite;
}

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const vite = startVite();
let browser;
try {
  await waitFor(`http://localhost:${PORT}/scripts/post-cards.html`);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/scripts/post-cards.html`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });

  const today = await page.evaluate(() => window.today());
  const isMonday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).format(new Date()) === 'Mon';
  console.log(`Daily #${today.dailyNo}, hero ${today.hero.name}, ${today.chicagoHour}:00 in Chicago`);
  // Two schedules cover daylight saving; only the one that lands at 7 AM Central posts.
  if (SCHEDULED && today.chicagoHour !== 7) {
    console.log('Not 7 AM in Chicago on this schedule; nothing to do.');
    process.exit(0);
  }


  mkdirSync(OUT, { recursive: true });
  const posts = [];

  // A leaderboard hiccup must not stop the morning post.
  let leader = null;
  try {
    leader = await endlessLeader(isMonday);
  } catch (e) {
    console.error(`Could not load the endless leader: ${e.message}`);
  }
  if (leader) {
    const title = leader.fresh ? 'NEW ENDLESS RECORD' : 'ENDLESS CHAMPION';
    const { hero } = await page.evaluate((c) => window.renderChampion(c), { ...leader, mode: 'endless', title });
    const image = await page.locator('#card').screenshot({ path: `${OUT}/endless.png` });
    posts.push({
      name: 'endless',
      label: leader.fresh ? 'New endless record' : 'Reigning endless champion',
      image,
      text: (leader.fresh
        ? [`🏆 New endless record: ${leader.name} reached floor ${leader.floor} as the ${hero}, with ${leader.kills} kills.`, 'The deepest anyone has ever gone. For now.']
        : [`🏆 Reigning endless champion: ${leader.name}, floor ${leader.floor} as the ${hero}.`, 'Nobody has gone deeper. Will you?']
      ).concat(SITE).join('\n'),
    });
  } else {
    console.log('No endless post today (no new record, and not Monday).');
  }

  let champ = null;
  try {
    champ = today.dailyNo > 1 ? await champion(today.dailyNo - 1) : null;
  } catch (e) {
    console.error(`Could not load yesterday's champion: ${e.message}`);
  }
  if (champ) {
    const { hero } = await page.evaluate((c) => window.renderChampion(c), champ);
    const image = await page.locator('#card').screenshot({ path: `${OUT}/champion.png` });
    const crowned = champ.others ? `👑 Champions of Daily #${champ.dailyNo}: ${champ.name}, ${champ.others}` : `👑 Champion of Daily #${champ.dailyNo}: ${champ.name}`;
    posts.push({
      name: 'champion',
      label: `Champion of Daily #${champ.dailyNo}`,
      image,
      text: [
        crowned,
        `Reached floor ${champ.floor} with ${champ.kills} kills as the ${hero}.`,
        'Long may they reign. Think you can take the crown?',
        SITE,
      ].join('\n'),
    });
  } else {
    console.log('No champion to crown for yesterday.');
  }

  await page.evaluate((d) => window.renderDaily(d), { dailyNo: today.dailyNo, heroId: today.hero.id });
  const dailyImage = await page.locator('#card').screenshot({ path: `${OUT}/daily.png` });
  posts.push({
    name: 'daily',
    label: `Daily #${today.dailyNo} is open`,
    image: dailyImage,
    text: [
      `🕯️ Daily #${today.dailyNo} is open.`,
      `Today's hero: the ${today.hero.name}. ${today.hero.perkDesc}`,
      'One crypt. One try. How deep can you go?',
      SITE,
    ].join('\n'),
  });

  for (const p of posts) writeFileSync(`${OUT}/${p.name}.txt`, p.text);
  for (const p of posts) console.log(`\n--- ${p.name} (${[...p.text].length} chars) ---\n${p.text}`);

  if (MODE === 'preview') {
    console.log('\nPreview only: nothing posted or sent. The images and text are in the run\'s "post-preview" download.');
  } else if (MODE === 'email') {
    await emailKit(today.dailyNo, posts);
  } else {
    for (const k of ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET']) {
      if (!env[k]) throw new Error(`Missing the ${k} secret. See docs/daily-x-post.md.`);
    }
    const client = new TwitterApi({
      appKey: env.X_API_KEY,
      appSecret: env.X_API_SECRET,
      accessToken: env.X_ACCESS_TOKEN,
      accessSecret: env.X_ACCESS_SECRET,
    });
    for (const p of posts) {
      let mediaId;
      try {
        mediaId = await client.v2.uploadMedia(p.image, { media_type: 'image/png' });
      } catch (e) {
        console.log(`v2 media upload failed (${e.message}); trying v1.1.`);
        mediaId = await client.v1.uploadMedia(p.image, { mimeType: 'image/png' });
      }
      const { data } = await client.v2.tweet({ text: p.text, media: { media_ids: [mediaId] } });
      console.log(`Posted ${p.name}: https://x.com/${HANDLE.slice(1)}/status/${data.id}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
} finally {
  await browser?.close();
  vite.kill();
}
