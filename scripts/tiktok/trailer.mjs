// The daily trailer, with no hard cuts: a run of the Daily Descent in which the hero clears a
// floor, picks a relic, walks onto the Soul Forge, fuses two relics and fights on; the picture
// dips to black and comes up far down an Endless run; then the end card. A line of text for
// each beat fades in and out.
//
//   node scripts/tiktok/trailer.mjs wide|tall <out dir>
//
// wide is 1920x1080 (the desktop layout), tall is 1080x1920 (the phone layout). Writes
// <out>/frames/*.jpg at 60 a second and <out>/marks.json (when the fusion starts, how long
// it all is, and every sound effect with its time) for trailer-sound.mjs. Needs the dev server: npx vite --port 5199
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
// On the cloud machines Chromium is preinstalled at a fixed path, whatever Playwright version the
// project pins; elsewhere Playwright finds its own.
const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};

const shape = process.argv[2] === 'tall' ? 'tall' : 'wide';
const OUT = process.argv[3];
const FPS = 60;
const PAGE = 'http://localhost:5199/';
/** The floor the Endless part of the trailer plays on. */
const DEEP = 152;
rmSync(`${OUT}/frames`, { recursive: true, force: true });
mkdirSync(`${OUT}/frames`, { recursive: true });

const b = await chromium.launch(BROWSER);
const p = await b.newPage(shape === 'tall'
  ? { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
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
  // every achievement already earned, so none pops up over the action
  const { ACHIEVEMENTS } = await import('/src/content.ts');
  localStorage.clear();
  localStorage.setItem('cryptfall:v1', JSON.stringify({ seenLogin: true, seenOnlineLogin: true, tutorialDone: true, name: 'Gravekeeper', totals: { runs: 40 } }));
  for (const [k, v] of [['omc:news-read-day', '2099-01-01'], ['omc:news', 'story-act1'], ['omc:news-bell', '1'], ['omc:ns-intro', '1'], ['omc:delve-clip', '1']]) localStorage.setItem(k, v);
  localStorage.setItem('wardenfall:meta', JSON.stringify({
    heroes: ['knight', 'rogue', 'necro', 'paladin', 'ranger', 'mage', 'barbarian', 'bellringer'], hero: 'knight', souls: 4200, earned: 16000,
    achievements: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 1])), codex: { plasma: 1 }, fusions: { plasma: 1 },
  }));
});
/** Load the game afresh and take hold of its clock. */
const stage = async () => {
  await p.goto(PAGE);
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => window.__freeze());
  await p.addStyleTag({ content: '#toast, .back-top, .install-bar { display: none !important; }' });
};
await stage();

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
/** Click something once it's there (menus arrive in their own time, whatever the fake clock says). */
const press = async (sel) => {
  for (let i = 0; i < 300; i++) {
    if (await has(sel)) return click(sel);
    await tick(2);
    await p.waitForTimeout(20);
  }
  throw new Error(`never found ${sel}`);
};
/** Wait for the game to be where the take needs it, or stop rather than film the wrong thing. */
const sure = async (fn, what, arg) => {
  for (let i = 0; i < 300; i++) {
    if (await p.evaluate(fn, arg)) return;
    await tick(2);
    await p.waitForTimeout(20);
  }
  const state = await p.evaluate(() => { const g = window.cryptfall.game; const o = document.querySelector('#overlay'); return { floor: g.floor, phase: g.phase, mode: g.config?.mode, hp: g.player.hp, overlay: o?.hidden ? 'hidden' : `${o?.className}: ${(o?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 200)}` }; });
  throw new Error(`the game never reached ${what}: ${JSON.stringify(state)}`);
};
/** Note the game behind the title, to tell when a real run has taken its place. */
const mark = () => p.evaluate(() => { window.__was = window.cryptfall.game; });
let frame = 0;
const until = async (fn, max = 600) => {
  for (let i = 0; i < max; i++) {
    if (await p.evaluate(fn)) return true;
    await tick();
  }
  return false;
};

// ---- the words: one line at a time, fading out and in; then the end card ----
/** Put the caption, the end card and the black curtain on the page (again after each load). */
const dress = () => p.evaluate((shape) => {
  const st = document.createElement('style');
  st.textContent = `
    #tt-cap { position: fixed; z-index: 9999; pointer-events: none; opacity: 0; color: #fff;
      font: 600 22px/1.25 'Pixelify Sans', Silkscreen, monospace; letter-spacing: 0.3px;
      text-shadow: 0 0 2px #000, 2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0 3px 10px rgba(0,0,0,0.8); }
    #tt-cap b { color: #f2c14e; font-weight: 600; }
    #tt-cap.tall { left: 16px; right: 16px; text-align: center; }
    #tt-cap.wide { left: 0; right: 0; bottom: 34px; text-align: center; font-size: 30px; }
    #tt-cap.wide span { display: inline-block; padding: 10px 26px; background: rgba(7,4,11,0.78); border: 2px solid rgba(242,193,78,0.55); }
    #tt-black { position: fixed; inset: 0; z-index: 10001; background: #07040b; pointer-events: none; }
    #tt-end { position: fixed; inset: 0; z-index: 10000; display: flex; opacity: 0; flex-direction: column; align-items: center; justify-content: center; gap: 14px; pointer-events: none;
      background: radial-gradient(circle at 50% 45%, rgba(40,10,20,0.94), rgba(5,2,8,0.98)); text-align: center; }
    #tt-end h1 { margin: 0; font: ${shape === 'tall' ? 64 : 110}px/1 'Pirata One', Georgia, serif; color: #d23a46; text-shadow: 0 0 24px rgba(255,60,80,0.7); }
    #tt-end p { margin: 0; padding: 0 22px; font: ${shape === 'tall' ? 11 : 20}px/1.5 Silkscreen, monospace; letter-spacing: ${shape === 'tall' ? 1.5 : 2}px; color: #e8dcc4; }
    #tt-end .url { font-size: ${shape === 'tall' ? 17 : 28}px; color: #f2c14e; border: 2px solid #f2c14e; padding: 10px 18px; margin-top: 8px; }`;
  document.head.appendChild(st);
  const c = document.createElement('div');
  c.id = 'tt-cap';
  c.className = shape;
  document.body.appendChild(c);
  const e = document.createElement('div');
  e.id = 'tt-end';
  e.innerHTML = `<h1>One More${shape === 'tall' ? '<br>' : ' '}Crypt</h1><p>A NEW CRYPT EVERY DAY · ONE TRY</p><p>FREE · NO DOWNLOAD${shape === 'tall' ? '<br>' : ' · '}PLAYS IN YOUR BROWSER</p><p class="url">ONEMORECRYPT.COM</p>`;
  document.body.appendChild(e);
  const k = document.createElement('div');
  k.id = 'tt-black';
  document.body.appendChild(k);
}, shape);
await dress();
let capNow = '';
let capWant = '';
let capA = 0;
const caption = (html) => { capWant = html; };
/** One frame of the caption's fade: out, swap the words, in. */
const capStep = async () => {
  const stepA = 1 / (0.28 * FPS);
  if (capNow !== capWant) {
    capA = Math.max(0, capA - stepA);
    if (capA === 0) capNow = capWant;
  } else if (capNow) capA = Math.min(1, capA + stepA);
  await p.evaluate(([html, a, shape, rec]) => {
    window.__rec = rec;
    const c = document.getElementById('tt-cap');
    const inner = shape === 'wide' ? `<span>${html}</span>` : html;
    if (c.dataset.html !== html) { c.innerHTML = html ? inner : ''; c.dataset.html = html; }
    c.style.opacity = a;
    c.style.transform = `translateY(${(1 - a) * 6}px)`;
  }, [capNow, capA, shape, frame / FPS]);
};

// ---- the bot: walks to a given tile, else the nearest foe (bumping attacks), else the stairs ----
const botDir = (goal) => p.evaluate((goal) => {
  const g = window.cryptfall?.game;
  if (!g || g.phase !== 'play') return null;
  const W = 7, H = 7, P = g.player, key = (x, y) => y * W + x;
  const targets = goal ? [key(goal.x, goal.y)] : g.enemies.length ? g.enemies.map((e) => key(e.x, e.y)) : g.stairsOpen ? [key(g.stairs.x, g.stairs.y)] : [];
  if (!targets.length) return null;
  // (round the lava if there's a way, through it if there isn't)
  for (const lava of [false, true]) {
    const tset = new Set(targets), occ = new Set(g.enemies.map((e) => key(e.x, e.y)));
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
        if (prev.has(nk) || g.isWall(nx, ny) || (!lava && g.isLava?.(nx, ny)) || (g.reaper && g.reaper.x === nx && g.reaper.y === ny)) continue;
        prev.set(nk, k);
        q.push([nx, ny]);
      }
    }
  }
  return null;
}, goal ?? null);
const KEY = { '0,-1': 'ArrowUp', '1,0': 'ArrowRight', '0,1': 'ArrowDown', '-1,0': 'ArrowLeft' };
const keepAlive = () => p.evaluate(() => { const g = window.cryptfall?.game; if (g) g.player.hp = Math.max(g.player.hp, Math.ceil(g.player.maxHp * 0.6)); });
const move = async (goal) => {
  await keepAlive();
  const d = await botDir(goal);
  await p.keyboard.press(d ? KEY[d.join(',')] : ' ');
};

// ---- off camera: into today's crypt, a few floors down, holding the two relics to fuse ----
const DAILY = !process.env.DEEP_ONLY; // (DEEP_ONLY=1 tries out just the Endless part)
if (DAILY) {
await mark();
await press('#daily');
await tick(120);
await sure(() => { const g = window.cryptfall.game; return g !== window.__was && g.phase === 'play' && document.querySelector('#overlay')?.hidden; }, 'the daily run to start');
await p.evaluate(() => { const g = window.cryptfall.game; g.floor = 6; g.player.maxHp = 24; g.player.hp = 24; g.relics = { ember: 1, storm: 1 }; g.relicLog = ['ember', 'storm']; g.enemies = []; g.checkCleared?.(); });
await tick(20);
for (let i = 0; i < 14 && !(await has('.offer button')); i++) { await move(); await tick(16); }
await until(() => !!document.querySelector('.offer button'), 240);
await p.keyboard.press('1');
await tick(90);
// keep the pair whatever that pick was
await p.evaluate(() => { const g = window.cryptfall.game; g.relics.ember = Math.max(1, g.relics.ember ?? 0); g.relics.storm = Math.max(1, g.relics.storm ?? 0); });
await move();
await tick(20);
}

// The play area sits high on a phone with the controls below it: hide those and centre the board.
const centre = async () => {
  if (shape !== 'tall') return;
  await p.addStyleTag({ content: '.ns-pad, .touch-pad, .dpad, #pad { visibility: hidden !important; }' });
  await p.evaluate(() => {
    const big = [...document.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!big) return;
    const shift = Math.max(0, Math.round(innerHeight * 0.5 - (big.top + big.bottom) / 2));
    for (const el of document.body.children) if (!el.id.startsWith('tt-') && el.tagName !== 'SCRIPT' && el.tagName !== 'CANVAS') el.style.transform = `translateY(${shift}px)`;
    let bar = big.top + shift;
    for (const e of document.querySelectorAll('body *')) {
      const r = e.getBoundingClientRect();
      if (e.closest('#tt-cap, #tt-end, #tt-black') || r.height < 4 || r.width < big.width * 0.9 || getComputedStyle(e).visibility === 'hidden') continue;
      if (r.bottom <= big.top + shift + 2 && r.top >= big.top + shift - 110) bar = Math.min(bar, r.top);
    }
    document.getElementById('tt-cap').style.bottom = `${innerHeight - bar + 10}px`;
  });
};
await centre();

// ---- record: one take ----
// Every sound effect the game asks for is noted with its time, so the sound can be laid
// under the video afterwards (the page itself is silent while it's recorded).
const sounds = [];
const hookSfx = () => p.evaluate(() => {
  // (the game's own copy of them, which the dev build leaves on window.omcSfx)
  const sfx = window.omcSfx;
  window.__sfx = [];
  for (const name of Object.keys(sfx)) {
    const real = sfx[name];
    if (typeof real !== 'function' || name === 'fuse') continue;
    sfx[name] = (...args) => {
      window.__sfx.push({ name, args, t: window.__rec ?? 0 });
      return real(...args);
    };
  }
});
/** Bring over what's been noted so far (before the page goes away, and at the end). */
const keepSfx = async () => sounds.push(...(await p.evaluate(() => window.__sfx.splice(0))));
await hookSfx();
const marks = {};
const GAP = Math.round(0.36 * FPS);
let blackA = 1;
let blackWant = 0;
const shot = async () => {
  await capStep();
  await tick();
  // the black curtain: up at the start, and down and up again between the two runs
  if (blackA !== blackWant) {
    blackA = blackWant > blackA ? Math.min(blackWant, blackA + 1 / (0.5 * FPS)) : Math.max(blackWant, blackA - 1 / (0.5 * FPS));
    await p.evaluate((a) => { document.getElementById('tt-black').style.opacity = a; }, blackA);
  }
  await p.screenshot({ path: `${OUT}/frames/${String(frame++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
};
const hold = async (seconds) => { for (let i = 0; i < Math.round(seconds * FPS); i++) await shot(); };
/** Play on, a step every 0.36s, until `done()` or the time runs out. */
const play = async (seconds, done, goal) => {
  for (let i = 0; i < Math.round(seconds * FPS); i++) {
    if (i % GAP === 0) {
      if (done && (await done())) return true;
      await move(goal && (await goal()));
    }
    await shot();
  }
  return false;
};

if (DAILY) {
// 1. the floor: fight until it's cleared and the relic offer comes up
caption('Everyone in the world gets <b>the same crypt</b> today. You get <b>one try</b>.');
if (!(await play(8, () => has('.offer button')))) {
  await p.evaluate(() => { const g = window.cryptfall.game; g.enemies = []; g.checkCleared?.(); });
  await play(8, () => has('.offer button'));
}
// 2. the relic
caption('Clear a floor, <b>pick a relic</b>.');
await hold(2.2);
await p.keyboard.press('1');
await hold(1.0);
// 3. the Soul Forge: it stands a few steps off; walk onto it and fuse
await p.evaluate(() => {
  const g = window.cryptfall.game;
  g.relics.ember = Math.max(1, g.relics.ember ?? 0);
  g.relics.storm = Math.max(1, g.relics.storm ?? 0);
  if (!g.relicLog.includes('ember')) g.relicLog.push('ember');
  if (!g.relicLog.includes('storm')) g.relicLog.push('storm');
  const P = g.player;
  const free = [];
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const d = Math.abs(x - P.x) + Math.abs(y - P.y);
    if (d < 3 || d > 5 || g.isWall(x, y) || g.isLava?.(x, y) || (x === g.stairs.x && y === g.stairs.y) || g.enemies.some((e) => e.x === x && e.y === y)) continue;
    free.push({ x, y, d });
  }
  free.sort((a, b) => a.d - b.d);
  const spot = free[0] ?? { x: P.x, y: P.y };
  g.feature = { x: spot.x, y: spot.y, kind: 'forge', used: false };
  window.__forge = spot;
});
caption('Find the <b>Soul Forge</b> and fuse two relics into one.');
await play(7, () => has('button[data-i="0"]'), () => p.evaluate(() => window.__forge));
await hold(1.8);
marks.fuse = frame / FPS;
await click('button[data-i="0"]');
await hold(3.2);
await until(() => !!document.querySelector('#fused-ok'), 120);
await hold(2.4);
await click('#fused-ok');
// 4. on with the run for a moment, then the curtain comes down
caption('Then see how you rank on today\'s board.');
await play(3.6);
caption('');
blackWant = 1;
await play(0.6);
await keepSfx();
}

// ---- off camera: an Endless run, far down, with a build to match ----
await stage();
await dress();
await p.evaluate(() => { document.getElementById('tt-black').style.opacity = 1; });
await hookSfx();
await press('#delve'); await tick(40);
await press('#endless'); await tick(60);
await mark();
await press('.hero-card.selected'); await tick(120);
await sure(() => { const g = window.cryptfall.game; return g !== window.__was && g.phase === 'play' && document.querySelector('#overlay')?.hidden; }, 'the Endless run to start');
await p.evaluate((floor) => {
  const g = window.cryptfall.game;
  g.floor = floor;
  g.player.maxHp = 900; g.player.hp = 900;
  g.relics = { plasma: 1, ember: 3, storm: 3, frost: 2, fang: 3, whetstone: 4, thorns: 2, whirl: 2, heart: 3, mirror: 1, crown: 1 };
  g.relicLog = Object.keys(g.relics);
  g.enemies = []; g.checkCleared?.();
  g.reaper = null; g.reaperIn = 99;
}, DEEP - 1);
await tick(20);
const peek = (tag) => process.env.PEEK && p.evaluate((tag) => { const g = window.cryptfall.game; if (!window.__set) window.__set = g; return `${tag}: floor ${g.floor} phase ${g.phase} same ${g === window.__set} hp ${g.player.hp} pos ${g.player.x},${g.player.y} stairs ${g.stairs.x},${g.stairs.y} open ${g.stairsOpen} offer ${!!document.querySelector('.offer button')}`; }, tag).then(console.log);
await peek('set');
for (let i = 0; i < 30 && !(await has('.offer button')); i++) { await p.evaluate(() => { const g = window.cryptfall.game; g.reaper = null; g.reaperIn = 99; }); await move(); await tick(16); await peek(`move ${i}`); }
await sure(() => !!document.querySelector('.offer button'), 'the stairs out of the floor before');
await peek('offer');
await p.keyboard.press('1');
await tick(90);
await peek('picked');
await sure((floor) => window.cryptfall.game.floor === floor && window.cryptfall.game.phase === 'play', `floor ${DEEP}`, DEEP);
await centre();
// the dead down here are tough; the build makes short work of them, as it would
const soften = () => p.evaluate(() => { for (const e of window.cryptfall.game.enemies) if (!e.softened) { e.softened = true; e.hp = Math.min(e.hp, 45); } });
// and nothing down here gets to end the take: topped up before every step
// (Death himself stalks these floors and ends a run at a touch: he's left waiting in his corner)
const guard = () => p.evaluate(() => {
  const g = window.cryptfall.game;
  g.player.maxHp = Math.max(g.player.maxHp, 900);
  g.player.hp = g.player.maxHp;
  // a blow down here can take thousands: the Mirror's charges turn every one aside
  g.shieldCharges = 40;
  if (g.reaperIn < 60) g.reaperIn = 99;
  if (g.reaper && !g.reaper.waiting) g.reaper = null;
});

// 5. far down in Endless
blackWant = 0;
caption(`Or keep going in Endless. This is <b>floor ${DEEP}</b>.`);
for (let i = 0; i < Math.round(4.6 * FPS); i++) {
  if (i % GAP === 0) { await soften(); await guard(); if (await has('.offer button')) await p.keyboard.press('1'); else await move(); }
  await shot();
}
caption('How deep can <b>you</b> go?');
for (let i = 0; i < Math.round(3.6 * FPS); i++) {
  if (i % GAP === 0) { await soften(); await guard(); if (await has('.offer button')) await p.keyboard.press('1'); else await move(); }
  await shot();
}
// the end card comes up over the game
caption('');
marks.end = frame / FPS;
for (let i = 0; i < Math.round(3 * FPS); i++) {
  await p.evaluate((a) => { document.getElementById('tt-end').style.opacity = a; }, Math.min(1, i / (0.6 * FPS)));
  await shot();
}
marks.total = frame / FPS;
await keepSfx();
marks.sfx = sounds;
if (sounds.some((e) => e.name === 'death')) throw new Error('the hero died during the take: record it again');
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
console.log(JSON.stringify({ shape, frames: frame, fuse: marks.fuse, end: marks.end, total: marks.total, sounds: marks.sfx.length }), errs.length ? `errors: ${errs.join(' | ')}` : '');
await b.close();
