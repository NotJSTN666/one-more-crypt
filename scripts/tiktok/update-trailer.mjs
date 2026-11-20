// The "what's new" trailer: one take through the latest updates, a caption for each beat.
//   1. the title screen, with yesterday's champion on show
//   2. a run that changes theme as it goes (Crimson Court, Frostbound, Gilded Tomb, Verdigris)
//   3. foes dying their own ways
//   4. down in the Burning Depths: lava glow, candlelight and shadows
//   5. crossing into a new zone: the cut down the depth map
//   6. the daily world boss
//   7. the results: how deep you went, and the share buttons
//   8. styled names on the leaderboard
//   9. the end card
//
//   node scripts/tiktok/update-trailer.mjs wide|tall <out dir>
//
// Writes <out>/frames/*.jpg at 30 a second and <out>/marks.json for trailer-sound.mjs.
// Needs the dev server, pointed at a stand-in server so nothing real is touched:
//   VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test npx vite --port 5199
// The champion, the boss's bar and the leaderboard are made-up stand-ins served by this script.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const shape = process.argv[2] === 'tall' ? 'tall' : 'wide';
const OUT = process.argv[3];
const FPS = 30;
const PAGE = 'http://localhost:5199/';
rmSync(`${OUT}/frames`, { recursive: true, force: true });
mkdirSync(`${OUT}/frames`, { recursive: true });

const b = await chromium.launch(BROWSER);
const ctx = await b.newContext(shape === 'tall'
  ? { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });

// ---- the stand-in server: made-up players, a boss half down, everything else empty ----
const NAMES = ['Nightgrave', 'Hollowmoth', 'PyreQueen', 'Rimewalker', 'Ashfern', 'Mossbell', 'Tallowtom', 'Sablecat', 'Emberwick', 'Gravedust'];
const STYLES = [['starless', 'starfall'], ['reaper', 'shadow'], ['pyre', 'flame'], ['wisp', 'frost'], ['blood', 'drip'], ['moss', ''], ['gold', 'gilded'], ['hex', 'haunted'], ['ember', 'embers'], ['deep', 'glow']];
const HEROES = ['rogue', 'knight', 'mage', 'paladin', 'ranger', 'necro', 'barbarian', 'knight', 'rogue', 'mage'];
const FLOORS = [341, 288, 219, 164, 157, 96, 48, 31, 22, 9];
const row = (i) => ({
  user_id: `00000000-0000-0000-0000-00000000000${i}`, name: NAMES[i], floor: FLOORS[i], kills: FLOORS[i] * 2, turns: FLOORS[i] * 9, relics: '', killed_by: 'Death',
  rank: i + 1, title: i === 0 ? 'podium:1' : null, earned: 5000 * (10 - i), hero: HEROES[i], seconds: 600 + i * 40,
  outfit_look: i === 0 ? 'lich' : '', outfit_head: i === 0 ? 'champcrown' : '', outfit_aura: i === 0 ? 'voidcrown' : '',
});
await ctx.route('**/test.supabase.co/**', async (r) => {
  const url = decodeURIComponent(r.request().url());
  const json = (body, headers = {}) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-expose-headers': 'content-range', ...headers } });
  if (url.includes('/rest/v1/leaderboard_daily')) {
    const lim = Number((/limit=(\d+)/.exec(url) || [])[1] || 25);
    const rows = NAMES.map((_, i) => row(i)).slice(0, lim);
    return json(rows, { 'content-range': `0-${rows.length - 1}/41` });
  }
  if (url.includes('/rest/v1/profiles') && url.includes('style')) {
    const m = /name=in\.\(([^)]*)\)/.exec(url);
    const names = m ? m[1].split(',').map((n) => n.replace(/^"|"$/g, '')) : [];
    return json(names.map((name) => ({ name, style: NAMES.includes(name) ? { ink: STYLES[NAMES.indexOf(name)][0], fx: STYLES[NAMES.indexOf(name)][1] } : null })));
  }
  if (url.includes('/rpc/raid_state')) {
    return json({ damage: 610, players: 9, hp: 1350, felled: false,
      feed: [{ name: 'Rimewalker', hero: 'paladin', damage: 142 }, { name: 'Ashfern', hero: 'ranger', damage: 96 }, { name: 'Mossbell', hero: 'necro', damage: 121 }, { name: 'Sablecat', hero: 'mage', damage: 88 }],
      top: [{ name: 'Rimewalker', damage: 284 }, { name: 'Mossbell', damage: 201 }, { name: 'Ashfern', damage: 125 }] });
  }
  if (url.includes('/auth/v1/')) return r.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
  return json([]);
});

const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.addInitScript({ path: new URL('./shim.js', import.meta.url).pathname });
for (let i = 0; i < 40; i++) {
  try {
    await p.goto(PAGE);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
await p.evaluate(async () => {
  // every achievement already earned, so none pops up over the action; a few name styles earned
  const { ACHIEVEMENTS } = await import('/src/content.ts');
  localStorage.clear();
  localStorage.setItem('cryptfall:v1', JSON.stringify({ seenLogin: true, seenOnlineLogin: true, tutorialDone: true, name: 'Gravekeeper', totals: { runs: 40, kills: 900, bestDaily: 212 }, bestEndless: 212 }));
  for (const [k, v] of [['omc:news-read-day', '2099-01-01'], ['omc:news', 'story-act1'], ['omc:news-bell', '1'], ['omc:ns-intro', '1'], ['omc:delve-clip', '1']]) localStorage.setItem(k, v);
  localStorage.setItem('wardenfall:meta', JSON.stringify({
    heroes: ['knight', 'rogue', 'necro', 'paladin', 'ranger', 'mage', 'barbarian', 'bellringer'], hero: 'knight', souls: 4200, earned: 16000,
    achievements: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 1])), dailyTotal: 18, deepest: 212, streak: { best: 9, count: 3, last: 0 },
    welcome: { claimed: 7, last: 0 },
  }));
});

/** Load the game afresh and take hold of its clock. */
const stage = async (url = PAGE) => {
  await p.goto(url);
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => window.__freeze());
  await p.addStyleTag({ content: '#toast, .back-top, .install-bar, .tester-ask, .invite-ask, #theme-fx, #sound-hint { display: none !important; }' });
};

// ---- the clock: game time and CSS animations both move one frame at a time ----
const STEP = 1000 / FPS;
const tick = async (n = 1) => {
  for (let i = 0; i < n; i++) {
    await p.evaluate((dt) => {
      window.__advance(dt);
      for (const a of document.getAnimations()) {
        if (!a.__v) { a.pause(); a.__v = 1; }
        const end = a.effect?.getComputedTiming?.().endTime;
        const ct = (a.currentTime || 0) + dt;
        if (Number.isFinite(end) && ct >= end) a.finish(); else a.currentTime = ct;
      }
    }, STEP);
  }
};
const click = (sel) => p.evaluate((s) => document.querySelector(s)?.click(), sel);
const has = (sel) => p.evaluate((s) => !!document.querySelector(s), sel);
const press = async (sel) => {
  for (let i = 0; i < 300; i++) {
    if (await has(sel)) return click(sel);
    await tick(2);
    await p.waitForTimeout(20);
  }
  throw new Error(`never found ${sel}`);
};
const sure = async (fn, what, arg) => {
  for (let i = 0; i < 300; i++) {
    if (await p.evaluate(fn, arg)) return;
    await tick(2);
    await p.waitForTimeout(20);
  }
  throw new Error(`the game never reached ${what}`);
};

// ---- the words, and the end card ----
const dress = () => p.evaluate((shape) => {
  const st = document.createElement('style');
  st.textContent = `
    #tt-cap { position: fixed; z-index: 9999; pointer-events: none; opacity: 0; color: #fff;
      font: 600 22px/1.25 'Pixelify Sans', Silkscreen, monospace; letter-spacing: 0.3px;
      text-shadow: 0 0 2px #000, 2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0 3px 10px rgba(0,0,0,0.8); }
    #tt-cap b { color: #f2c14e; font-weight: 600; }
    #tt-cap.tall { left: 16px; right: 16px; bottom: 26px; text-align: center; }
    #tt-cap.wide { left: 0; right: 0; bottom: 34px; text-align: center; font-size: 30px; }
    #tt-cap span { display: inline-block; padding: 10px 26px; background: rgba(7,4,11,0.82); border: 2px solid rgba(242,193,78,0.55); }
    #tt-kick { position: fixed; z-index: 9999; left: 0; right: 0; top: ${shape === 'tall' ? 70 : 92}px; text-align: center; pointer-events: none; opacity: 0;
      font: ${shape === 'tall' ? 12 : 18}px Silkscreen, monospace; letter-spacing: 4px; color: #f2c14e; text-shadow: 0 2px 0 #000, 0 0 10px #000; }
    #tt-black { position: fixed; inset: 0; z-index: 10001; background: #07040b; pointer-events: none; }
    #tt-end { position: fixed; inset: 0; z-index: 10000; display: flex; opacity: 0; flex-direction: column; align-items: center; justify-content: center; gap: 14px; pointer-events: none;
      background: radial-gradient(circle at 50% 45%, rgba(40,10,20,0.95), rgba(5,2,8,0.99)); text-align: center; }
    #tt-end h1 { margin: 0; font: ${shape === 'tall' ? 64 : 110}px/1 'Pirata One', Georgia, serif; color: #d23a46; text-shadow: 0 0 24px rgba(255,60,80,0.7); }
    #tt-end p { margin: 0; padding: 0 22px; font: ${shape === 'tall' ? 11 : 20}px/1.5 Silkscreen, monospace; letter-spacing: ${shape === 'tall' ? 1.5 : 2}px; color: #e8dcc4; }
    #tt-end .url { font-size: ${shape === 'tall' ? 17 : 28}px; color: #f2c14e; border: 2px solid #f2c14e; padding: 10px 18px; margin-top: 8px; }`;
  document.head.appendChild(st);
  for (const [id, html] of [['tt-cap', ''], ['tt-kick', 'NEW IN ONE MORE CRYPT'], ['tt-end', `<h1>One More${shape === 'tall' ? '<br>' : ' '}Crypt</h1><p>A NEW CRYPT EVERY DAY · ONE TRY</p><p>FREE · NO DOWNLOAD${shape === 'tall' ? '<br>' : ' · '}PLAYS IN YOUR BROWSER</p><p class="url">ONEMORECRYPT.COM</p>`], ['tt-black', '']]) {
    const el = document.createElement('div');
    el.id = id;
    if (id === 'tt-cap') el.className = shape;
    el.innerHTML = html;
    document.body.appendChild(el);
  }
}, shape);

let frame = 0;
let capNow = '';
let capWant = '';
let capA = 0;
let kickA = 0;
let kickWant = 0;
let blackA = 1;
let blackWant = 0;
const caption = (html) => { capWant = html; };
const shot = async () => {
  const stepA = 1 / (0.28 * FPS);
  if (capNow !== capWant) {
    capA = Math.max(0, capA - stepA);
    if (capA === 0) capNow = capWant;
  } else if (capNow) capA = Math.min(1, capA + stepA);
  kickA = kickWant > kickA ? Math.min(1, kickA + stepA) : Math.max(0, kickA - stepA);
  if (blackA !== blackWant) blackA = blackWant > blackA ? Math.min(blackWant, blackA + 1 / (0.4 * FPS)) : Math.max(blackWant, blackA - 1 / (0.4 * FPS));
  await p.evaluate(([html, a, k, black, rec]) => {
    window.__rec = rec;
    const c = document.getElementById('tt-cap');
    if (c.dataset.html !== html) { c.innerHTML = html ? `<span>${html}</span>` : ''; c.dataset.html = html; }
    c.style.opacity = a;
    c.style.transform = `translateY(${(1 - a) * 6}px)`;
    document.getElementById('tt-kick').style.opacity = k;
    document.getElementById('tt-black').style.opacity = black;
  }, [capNow, capA, kickA, blackA, frame / FPS]);
  await tick();
  await p.screenshot({ path: `${OUT}/frames/${String(frame++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
};
const hold = async (seconds) => { for (let i = 0; i < Math.round(seconds * FPS); i++) await shot(); };

// ---- the sound: every effect the game asks for, noted with its time ----
const sounds = [];
const hookSfx = () => p.evaluate(() => {
  const sfx = window.omcSfx;
  window.__sfx = [];
  for (const name of Object.keys(sfx)) {
    const real = sfx[name];
    if (typeof real !== 'function') continue;
    sfx[name] = (...args) => { window.__sfx.push({ name, args, t: window.__rec ?? 0 }); return real(...args); };
  }
});
const keepSfx = async () => sounds.push(...(await p.evaluate(() => window.__sfx?.splice(0) ?? [])));

// ---- the bot: to a tile, else the nearest foe, else the stairs ----
const botDir = (goal) => p.evaluate((goal) => {
  const g = window.cryptfall?.game;
  if (!g || g.phase !== 'play') return null;
  const W = 7, H = 7, P = g.player, key = (x, y) => y * W + x;
  const foes = g.enemies.filter((e) => !e.dead && !e.ally);
  const targets = goal ? [key(goal.x, goal.y)] : foes.length ? foes.map((e) => key(e.x, e.y)) : g.stairsOpen ? [key(g.stairs.x, g.stairs.y)] : [];
  if (!targets.length) return null;
  const tset = new Set(targets), occ = new Set(foes.map((e) => key(e.x, e.y)));
  const start = key(P.x, P.y), prev = new Map([[start, -1]]), q = [[P.x, P.y]];
  while (q.length) {
    const [x, y] = q.shift();
    const k = key(x, y);
    if (tset.has(k) && k !== start) {
      let c = k;
      while (prev.get(c) !== start) c = prev.get(c);
      return [(c % W) - P.x, Math.floor(c / W) - P.y];
    }
    if (occ.has(k) && k !== start) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = key(nx, ny);
      if (prev.has(nk) || g.isWall(nx, ny) || g.isLava?.(nx, ny)) continue;
      prev.set(nk, k);
      q.push([nx, ny]);
    }
  }
  return null;
}, goal ?? null);
const KEY = { '0,-1': 'ArrowUp', '1,0': 'ArrowRight', '0,1': 'ArrowDown', '-1,0': 'ArrowLeft' };
const guard = () => p.evaluate(() => {
  const g = window.cryptfall?.game;
  if (!g) return;
  g.player.maxHp = Math.max(g.player.maxHp, 300);
  g.player.hp = g.player.maxHp;
  g.abyssDamage = () => 0;
  if (g.reaperIn < 60) g.reaperIn = 99;
  if (g.reaper && !g.reaper.waiting) g.reaper = null;
  for (const e of g.enemies) if (!e.softened) { e.softened = true; e.hp = Math.min(e.hp, 30); e.dmg = Math.min(e.dmg, 3); }
});
const GAP = Math.round(0.4 * FPS);
/** Play on, a step every 0.4s. */
const play = async (seconds, goal) => {
  for (let i = 0; i < Math.round(seconds * FPS); i++) {
    if (i % GAP === 0) {
      await guard();
      if (await has('.offer button')) await p.keyboard.press('1');
      else {
        const d = await botDir(goal && (await goal()));
        await p.keyboard.press(d ? KEY[d.join(',')] : ' ');
      }
    }
    await shot();
  }
};
const theme = (id) => p.evaluate(async (id) => (await import('/src/themes.ts')).applyTheme(id, false), id);
/** Start an Endless run (from the title), off camera. */
const startEndless = async () => {
  await press('#delve'); await tick(40);
  await press('#endless'); await tick(60);
  await p.evaluate(() => { window.__was = window.cryptfall.game; });
  await press('.hero-card.selected'); await tick(120);
  await sure(() => { const g = window.cryptfall.game; return g !== window.__was && g.phase === 'play' && document.querySelector('#overlay')?.hidden; }, 'the Endless run to start');
};
/** Jump the run to a floor (its events played, so the board shows what it should). */
const toFloor = (f) => p.evaluate((f) => { const g = window.cryptfall.game; g.enterFloor(f); window.cryptfall.act(0, 0); }, f);

const marks = {};

// ============ 1. the title, with yesterday's champion ============
await stage();
await dress();
await hookSfx();
blackWant = 0;
await tick(30);
caption('<b>New</b>: yesterday\'s Daily champion now stands on the title screen');
await hold(3.4);
kickWant = 0;

// ============ 2. themes ============
caption('');
blackWant = 1;
await hold(0.4);
await keepSfx();
await startEndless();
await hookSfx();
await theme('crimson');
await toFloor(3);
await tick(20);
blackWant = 0;
caption('<b>Five new themes</b> rebuild the whole crypt');
await play(2.0);
for (const t of ['frost', 'gilded', 'verdigris']) {
  await theme(t);
  await play(1.3);
}
await theme('classic');

// ============ 3. deaths ============
caption('Every foe now <b>dies its own way</b>');
await p.evaluate(() => {
  // a ring of the different dead around the hero, one blow from death each
  const g = window.cryptfall.game;
  const P = g.player;
  const kinds = ['archer', 'bat', 'ghoul', 'brute', 'wraith', 'imp'];
  const spots = [[1, 0], [-1, 0], [0, -1], [1, -1], [-1, -1], [0, 1]];
  const free = (x, y) => x >= 0 && y >= 0 && x < 7 && y < 7 && !g.isWall(x, y) && !g.isLava?.(x, y);
  const keep = g.enemies.filter((e) => !e.dead).slice(0, kinds.length);
  let n = 0;
  for (const [dx, dy] of spots) {
    const e = keep[n];
    if (!e || !free(P.x + dx, P.y + dy)) continue;
    e.kind = kinds[n]; e.x = P.x + dx; e.y = P.y + dy; e.hp = 1; e.softened = true; e.dmg = 1; e.elite = null;
    n++;
  }
  for (const e of g.enemies.slice(n)) e.dead = true;
});
await play(5.0);

// ============ 4. the Burning Depths ============
caption('Candlelight, shadows, and <b>walls lit by lava</b>');
blackWant = 1;
await hold(0.4);
await toFloor(66);
await tick(30);
blackWant = 0;
await play(3.2);

// ============ 5. a new zone ============
caption('Cross into a new zone and <b>watch how far you\'ve fallen</b>');
blackWant = 1;
await hold(0.4);
await toFloor(80);
await tick(10);
await toFloor(81);
blackWant = 0;
await hold(2.6);
await play(0.8);
await keepSfx();

// ============ 6. the daily world boss ============
caption('');
blackWant = 1;
await hold(0.4);
await stage();
await dress();
await hookSfx();
await p.evaluate(() => { document.getElementById('tt-black').style.opacity = 1; });
await press('#raid');
await tick(60);
blackWant = 0;
caption('A <b>world boss</b> every day. Everyone hits one shared health bar');
await hold(3.6);

// ============ 7. how deep you went ============
caption('');
blackWant = 1;
await hold(0.4);
await keepSfx();
await press('#back');
await tick(30);
await startEndless();
await hookSfx();
await toFloor(157);
await p.evaluate(() => { const g = window.cryptfall.game; g.player.hp = 1; g.player.maxHp = 40; g.abyssDamage = undefined; });
for (let i = 0; i < 200; i++) {
  const dead = await p.evaluate(() => { const g = window.cryptfall.game; if (g.phase !== 'dead') { g.player.hp = 1; window.cryptfall.act(0, 0); } return g.phase === 'dead'; });
  if (dead) break;
  await tick(3);
}
await sure(() => !!document.getElementById('depth-col'), 'the results');
blackWant = 0;
caption('See <b>how deep you went</b> after every run, and share it');
await hold(4.2);
await keepSfx();

// ============ 8. name styles on the leaderboard ============
caption('');
blackWant = 1;
await hold(0.4);
await stage();
await dress();
await hookSfx();
await p.evaluate(() => { document.getElementById('tt-black').style.opacity = 1; });
await press('#leaderboard');
await tick(60);
blackWant = 0;
caption('Earn <b>name styles</b> for the leaderboards');
await hold(3.6);

// ============ 9. the end card ============
caption('');
marks.end = frame / FPS;
for (let i = 0; i < Math.round(3.4 * FPS); i++) {
  await p.evaluate((a) => { document.getElementById('tt-end').style.opacity = a; }, Math.min(1, i / (0.6 * FPS)));
  await shot();
}
marks.total = frame / FPS;
marks.fps = FPS;
await keepSfx();
marks.sfx = sounds;
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
console.log(JSON.stringify({ shape, frames: frame, total: marks.total, sounds: sounds.length }), errs.length ? `errors: ${errs.slice(0, 3).join(' | ')}` : '');
await b.close();
