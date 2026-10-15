// Automatic daily posts for @OneMoreCrypt, run by .github/workflows/daily-post.yml at
// 7 AM Central:
//   1. a new endless record (or, on Mondays, the reigning endless champion);
//   2. crowns yesterday's daily champion, with a picture of their hero in its final form;
//   3. announces that today's crypt is open, with today's hero.
//
// DRY_RUN=true writes the images and text to out/ without posting. Locally:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... DRY_RUN=true node scripts/daily-post.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { TwitterApi } from 'twitter-api-v2';

const env = process.env;
const DRY_RUN = env.DRY_RUN === 'true';
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

  if (DRY_RUN) {
    console.log('\nDry run: nothing posted. The images and text are in the run\'s "post-preview" download.');
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
