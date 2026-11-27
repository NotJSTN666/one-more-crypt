// Records a vertical (1080x1920) clip of real gameplay for TikTok, frame by frame on a fake
// clock so it plays back smooth whatever the machine. A hook line sits at the top the whole
// time and an end card with the link closes it.
//
//   node scripts/tiktok/record.mjs <idea.json> <out dir>
//
// The idea (see ideas.mjs) says which scene to play: 'night' (the Night Shift, with a hero,
// companion and relics, optionally firing the ultimate or bringing in a boss), 'crypt' (deep in
// Endless), 'horde' or 'daily'. `fuse: { a, b, out, name, at }` plays a Soul Forge fusion of
// those relics `at` seconds in; `end: false` leaves off the end card. Needs the dev server: npx vite --port 5199
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
// On the cloud machines Chromium is preinstalled at a fixed path, whatever Playwright version the
// project pins; elsewhere Playwright finds its own.
const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};

const idea = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3];
const FPS = 30;
const SECONDS = idea.seconds ?? 11;
const END = 2.2; // the end card
const PAGE = 'http://localhost:5199/';
rmSync(`${OUT}/frames`, { recursive: true, force: true });
mkdirSync(`${OUT}/frames`, { recursive: true });

const b = await chromium.launch(BROWSER);
// SHAPE=wide records the desktop layout at 1920x1080 instead of the phone's 1080x1920.
const WIDE = process.env.SHAPE === 'wide';
const p = await b.newPage(WIDE ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 } : { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
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
const hero = idea.hero ?? 'knight';
await p.evaluate(async ({ hero, comp }) => {
  // every achievement already earned, so none pops up over the action
  const { ACHIEVEMENTS } = await import('/src/content.ts');
  const achievements = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 1]));
  localStorage.clear();
  localStorage.setItem('cryptfall:v1', JSON.stringify({ seenLogin: true, seenOnlineLogin: true, tutorialDone: true, name: 'Gravekeeper', totals: { runs: 40 } }));
  for (const [k, v] of [['omc:news-read-day', '2099-01-01'], ['omc:news', 'story-act1'], ['omc:news-bell', '1'], ['omc:ns-intro', '1'], ['omc:news-midwinter-2026', '1'], ['omc:delve-clip', '1']]) localStorage.setItem(k, v);
  localStorage.setItem('wardenfall:meta', JSON.stringify({ gifts: ['keepersfavour'],
    heroes: ['knight', 'rogue', 'necro', 'paladin', 'ranger', 'mage', 'barbarian', 'bellringer'], hero, souls: 4200, earned: 16000, achievements,
    nightShrine: { vigor: 0, reroll: 0, banish: 0, arsenal: false, start: '', hero, companion: comp, blade: 3, banner: 3, oath: 2, bond: 2, charm: 3 },
    grave: { nightTotal: 90000, nights: 60, nightKills: 6000, at: 1 },
    story: { done: [1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16] },
  }));
}, { hero, comp: idea.companion ?? '' });
await p.goto(PAGE);
await p.waitForTimeout(2500);
await p.evaluate(() => document.fonts.ready);
await p.evaluate(() => window.__freeze());
// No toasts, banners or event pop-ups over the action.
await p.addStyleTag({ content: '#toast, .ns-event, .back-top, .install-bar, .tester-ask, .invite-ask { display: none !important; }' });

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
let frame = 0;
const shot = () => p.screenshot({ path: `${OUT}/frames/${String(frame++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
const click = (sel) => p.evaluate((s) => document.querySelector(s)?.click(), sel);
const until = async (fn, max = 300) => {
  for (let i = 0; i < max; i++) {
    if (await p.evaluate(fn)) return true;
    await tick();
  }
  return false;
};

// ---- the overlay: the hook at the top, then the end card ----
await p.evaluate(({ hook, endLines, hookStyle }) => {
  const st = document.createElement('style');
  st.textContent = `
    #tt-hook { position: fixed; left: 16px; right: 16px; top: 64%; z-index: 9999; text-align: center; pointer-events: none;
      font: 600 22px/1.2 'Pixelify Sans', Silkscreen, monospace; color: #fff; letter-spacing: 0.3px;
      text-shadow: 0 0 2px #000, 2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0 3px 10px rgba(0,0,0,0.8); }
    #tt-hook b { color: #f2c14e; font-weight: 600; }
    #tt-end { position: fixed; inset: 0; z-index: 10000; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
      background: radial-gradient(circle at 50% 45%, rgba(40,10,20,0.92), rgba(5,2,8,0.97)); text-align: center; }
    #tt-end h1 { margin: 0; font: 64px/1 'Pirata One', Georgia, serif; color: #d23a46; text-shadow: 0 0 24px rgba(255,60,80,0.7); }
    #tt-end p { margin: 0; font: 13px Silkscreen, monospace; letter-spacing: 2px; color: #e8dcc4; }
    #tt-end .url { font-size: 17px; color: #f2c14e; border: 2px solid #f2c14e; padding: 10px 14px; margin-top: 8px; }
    #tt-end.fade { animation: tt-fade 0.9s ease-out both; }
    #tt-end.black { background: #000; }
    /* the game fades out to black first, then the title comes up out of it */
    #tt-end.black.fade { animation: tt-dark 0.9s ease-in both; }
    #tt-end.black.fade > * { animation: tt-fade 1s ease-out 1.05s both; }
    #tt-end.black.fade::before { animation: tt-fade 1.2s ease-out 0.9s both, tt-glow 2.4s ease-in-out 2.1s infinite alternate; }
    @keyframes tt-dark { from { background-color: rgba(0,0,0,0); } to { background-color: #000; } }
    #tt-end.black::before { content: ''; position: absolute; left: 50%; top: 42%; width: 70vmin; height: 50vmin; transform: translate(-50%, -50%);
      background: radial-gradient(ellipse at center, rgba(210,40,60,0.55) 0%, rgba(150,20,40,0.25) 40%, rgba(0,0,0,0) 70%); filter: blur(8px);
      animation: tt-glow 2.4s ease-in-out infinite alternate; z-index: -1; }
    #tt-end.black { isolation: isolate; }
    #tt-end.black h1 { text-shadow: 0 0 18px rgba(255,60,80,0.9), 0 0 50px rgba(210,40,60,0.7); }
    @media (min-aspect-ratio: 1/1) {
      #tt-end h1 { font-size: 120px; }
      #tt-end p { font-size: 20px; letter-spacing: 4px; }
      #tt-end .url { font-size: 26px; padding: 14px 22px; }
    }
    @keyframes tt-glow { from { opacity: 0.75; } to { opacity: 1; } }
    @keyframes tt-fade { from { opacity: 0; } to { opacity: 1; } }
    #tt-floor { position: fixed; left: 0; right: 0; top: 50%; z-index: 9998; text-align: center; pointer-events: none; display: none;
      font: 56px/1 'Pirata One', Georgia, serif; color: #f2c14e; text-shadow: 0 0 3px #000, 3px 3px 0 #000, 0 0 30px rgba(0,0,0,0.9); }
    #tt-floor small { display: block; font: 13px Silkscreen, monospace; letter-spacing: 3px; color: #e8dcc4; margin-top: 6px; }
    #tt-floor.on { display: block; animation: tt-stamp 1.1s ease-out both; }
    @keyframes tt-stamp { 0% { opacity: 0; transform: translateY(-50%) scale(1.6); } 15% { opacity: 1; transform: translateY(-50%) scale(1); } 75% { opacity: 1; transform: translateY(-50%) scale(1); } 100% { opacity: 0; transform: translateY(-50%) scale(0.96); } }`;
  document.head.appendChild(st);
  const h = document.createElement('div');
  h.id = 'tt-hook';
  h.innerHTML = hook;
  document.body.appendChild(h);
  const e = document.createElement('div');
  e.id = 'tt-end';
  // (`endLines` replaces the lines under the title)
  e.innerHTML = `<h1>One More<br>Crypt</h1>${(endLines ?? ['FREE · NO DOWNLOAD', 'PLAYS IN YOUR BROWSER']).map((l) => `<p>${l}</p>`).join('')}<p class="url">ONEMORECRYPT.COM</p>`;
  document.body.appendChild(e);
  const f = document.createElement('div');
  f.id = 'tt-floor';
  document.body.appendChild(f);
  // `hookStyle: 'caption'`: the hook in TikTok's own caption look (bold white sans, black edge,
  // lower case), for the plain "dev asking for help" kind of clip
  if (hookStyle === 'caption') {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@800&display=swap';
    document.head.appendChild(l);
    const c = document.createElement('style');
    c.textContent = `#tt-hook { font: 800 19px/1.3 Montserrat, 'DejaVu Sans', sans-serif !important; letter-spacing: 0 !important; text-transform: lowercase;
      text-shadow: -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 0 6px rgba(0,0,0,0.9) !important; }
      #tt-hook b { color: #fff !important; font-weight: 800 !important; }`;
    document.head.appendChild(c);
  }
}, { hook: idea.hook, endLines: idea.endLines, hookStyle: idea.hookStyle });
// (Finding the play area always skips canvases that fill the whole screen, like the falling snow
// during Midwinter, which would otherwise count as the biggest canvas.)
// The hook goes above the game, in the space left by centring it: clear of the action and of
// TikTok's own buttons and caption.
const placeHook = () => p.evaluate((wide) => {
  if (wide) {
    const c = [...document.querySelectorAll('canvas')].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 200 && !(r.width >= innerWidth - 2 && r.height >= innerHeight - 2)).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const h = document.getElementById('tt-hook');
    const w = Math.max(160, (c ? c.left : 300) - 40);
    // low in the empty column left of the board, under the floor's panels
    Object.assign(h.style, { left: '20px', right: 'auto', width: `${w}px`, top: 'auto', bottom: '9%', fontSize: '30px', lineHeight: '1.25' });
    return;
  }
  const big = [...document.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 200 && !(r.width >= innerWidth - 2 && r.height >= innerHeight - 2)).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const h = document.getElementById('tt-hook');
  // just above the game's top bar, in the space the centring made
  // (the top of the bars stacked right over the play area)
  let bar = big ? big.top : innerHeight * 0.2;
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect();
    if (e.closest("#tt-hook, #tt-end") || r.height < 4 || r.width < (big ? big.width * 0.9 : 100) || getComputedStyle(e).visibility === 'hidden') continue;
    if (big && r.bottom <= big.top + 2 && r.top >= big.top - 110) bar = Math.min(bar, r.top);
  }
  h.style.top = 'auto';
  h.style.bottom = `${innerHeight - bar + 10}px`;
}, WIDE);
if (!WIDE) await p.addStyleTag({ content: '.ns-pad, .touch-pad, .dpad, #pad { visibility: hidden !important; }' });
// The play area sits high on a phone with the controls below it. With the controls hidden, move
// everything down so the action is in the middle of the frame, clear of TikTok's buttons.
const centre = () => p.evaluate(() => {
  const big = [...document.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 200 && !(r.width >= innerWidth - 2 && r.height >= innerHeight - 2)).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!big) return;
  const shift = Math.max(0, Math.round(innerHeight * 0.5 - (big.top + big.bottom) / 2));
  for (const el of document.body.children) if (el.id !== 'tt-hook' && el.id !== 'tt-end' && el.tagName !== 'SCRIPT') el.style.transform = `translateY(${shift}px)`;
});
const hideHook = (on) => p.evaluate((on) => { document.getElementById('tt-hook').style.display = on ? 'none' : ''; }, on);
await hideHook(true);

// ---- the crypt modes: a bot that walks to the nearest foe (bumping attacks), else the stairs ----
const botDir = () => p.evaluate(() => {
  const g = window.cryptfall?.game;
  if (!g || g.phase !== 'play') return null;
  const W = 7, H = 7, P = g.player, key = (x, y) => y * W + x;
  const targets = g.enemies.length ? g.enemies.map((e) => key(e.x, e.y)) : g.stairsOpen ? [key(g.stairs.x, g.stairs.y)] : [];
  if (!targets.length) return null;
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
      if (prev.has(nk) || g.isWall(nx, ny) || g.isLava?.(nx, ny)) continue;
      prev.set(nk, k);
      q.push([nx, ny]);
    }
  }
  return null;
});
const KEY = { '0,-1': 'ArrowUp', '1,0': 'ArrowRight', '0,1': 'ArrowDown', '-1,0': 'ArrowLeft' };
// Nothing ends the clip early: health topped up, no blow allowed to take the last of it (a single
// hit deep down can be thousands), and Death left waiting in his corner. (Not by handing out
// shield charges: those now show as the Mirror Shield's shields over the hero, and every hit
// would read BLOCK.)
const keepAlive = () => p.evaluate(() => {
  const g = window.cryptfall?.game;
  if (!g) return;
  if (!g.__spared) {
    const hurt = g.hurtPlayer;
    g.hurtPlayer = function (amount, ...rest) {
      // (several foes can strike in one turn: never let a hit land on the last few points)
      if (this.player.hp <= amount + 2) this.player.hp = Math.max(this.player.hp, Math.min(this.player.maxHp, amount + 3), Math.ceil(this.player.maxHp * 0.5));
      return hurt.call(this, Math.min(amount, Math.max(1, this.player.hp - 2)), ...rest);
    };
    g.__spared = true;
  }
  g.player.hp = Math.max(g.player.hp, Math.ceil(g.player.maxHp * 0.6));
  // (Death's touch kills outright, whatever the health: he's kept away until the clip calls him)
  if (window.__mortal) return;
  if (g.reaperIn > 0 && g.reaperIn < 60) g.reaperIn = 99;
  if (g.reaper && !g.reaper.waiting) g.reaper = null;
});
const cryptStep = async (i, gap = 9) => {
  if (i % gap) return;
  // (nothing to press once the run is over: a key on the death screen would start another)
  if (await p.evaluate(() => window.cryptfall?.game?.phase === 'dead')) return;
  if (await p.evaluate(() => !!document.querySelector('.offer button'))) {
    await p.keyboard.press('1');
    return;
  }
  await keepAlive();
  // (once Death is called and the floor is clear, the hero walks straight into him)
  const d = (await p.evaluate(() => window.__mortal && !window.cryptfall.game.enemies.some((e) => !e.ally) && window.cryptfall.game.reaper))
    ? await p.evaluate(() => { const g = window.cryptfall.game, r = g.reaper, P = g.player; const dx = Math.sign(r.x - P.x), dy = Math.sign(r.y - P.y); return Math.abs(r.x - P.x) >= Math.abs(r.y - P.y) && dx && !g.isWall(P.x + dx, P.y) ? [dx, 0] : dy && !g.isWall(P.x, P.y + dy) ? [0, dy] : dx ? [dx, 0] : null; })
    : await botDir();
  await p.keyboard.press(d ? KEY[d.join(',')] : ' ');
};

let drive = async () => {};
if (idea.scene === 'night') {
  await click('#delve'); await tick(20);
  await click('#nightshift'); await tick(20);
  await click('#ns-go'); await tick(30);
  await p.evaluate((s) => {
    const n = window.night;
    n.t = s.t ?? 300; n.level = s.level ?? 30; n.kills = s.kills ?? 1500; n.relics = s.relics ?? {};
    n.fused = s.fused ?? {}; n.bossesRisen = 0; n.bossKills = 0;
    n.maxHp = 50; n.hp = 44; n.anchorT = n.t; n.x = 24; n.y = 24;
    if (n.ally) n.ally.level = 4;
    n.level -= 1; n.xp = 2 + n.level * 2 + Math.floor((n.level * n.level) / 10);
  }, idea);
  await until(() => !!document.querySelector('.ns-choice') && getComputedStyle(document.querySelector('#ns-modal')).display !== 'none');
  await tick(10); await p.keyboard.press('Enter'); await tick(10);
  await p.evaluate((relics) => { const n = window.night; n.relics = relics; n.event = null; n.nextEventAt = 1e9; n.spawnDebt = 70; if (!n.fused) n.fused = {}; }, idea.relics ?? {});
  const held = new Set();
  let f = 0;
  drive = async () => {
    f++;
    const d = await p.evaluate(([f, boss]) => {
      const n = window.night;
      n.hp = Math.max(n.hp, n.maxHp * 0.6);
      n.xp = Math.min(n.xp, 0); n.pendingLevels = 0; n.forgeOffers = 0; n.pactOffers = 0; n.ascendOffers = 0;
      n.pickups = n.pickups.filter((q) => q.kind !== 'forge' && q.kind !== 'shard' && q.kind !== 'chest');
      if (n.t - n.anchorT > 3) n.anchorT = n.t - 3;
      if (!boss) n.foes = n.foes.filter((x) => !x.boss);
      else { const b = n.foes.find((x) => x.boss); if (b && Math.hypot(b.x - n.x, b.y - n.y) > 5) { b.x = n.x + 3; b.y = n.y - 3; } }
      const modal = document.querySelector('#ns-modal');
      const choosing = modal && getComputedStyle(modal).display !== 'none';
      // a wide figure-eight through the graveyard, always on the move
      const a = (f / 30) * 0.9;
      const tx = 24 + Math.sin(a) * 9, ty = 24 + Math.sin(2 * a) * 6;
      return { dx: tx - n.x, dy: ty - n.y, choosing };
    }, [f, Boolean(idea.boss)]);
    if (d.choosing) {
      for (const k of held) await p.keyboard.up(k);
      held.clear();
      await p.keyboard.press('Enter');
      return;
    }
    const want = new Set();
    if (d.dx > 0.3) want.add('ArrowRight');
    if (d.dx < -0.3) want.add('ArrowLeft');
    if (d.dy > 0.3) want.add('ArrowDown');
    if (d.dy < -0.3) want.add('ArrowUp');
    for (const k of held) if (!want.has(k)) { await p.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
  };
  // gather a crowd first (not recorded)
  for (let i = 0; i < 90; i++) { await drive(); await tick(); }
  if (idea.boss) await p.evaluate(() => { const n = window.night; n.t = 90 + n.bossesRisen * 120 - 0.4; });
} else if (idea.scene === 'crypt' || idea.scene === 'horde' || idea.scene === 'daily') {
  if (idea.scene === 'daily') { await click('#daily'); await tick(60); }
  else if (idea.scene === 'horde') { await click('#delve'); await tick(20); await click('#horde'); await tick(30); await click('.hero-card.selected'); await tick(60); }
  else {
    await click('#delve'); await tick(20); await click('#endless'); await tick(30); await click('.hero-card.selected'); await tick(60);
    await p.evaluate((floor) => { const g = window.cryptfall.game; g.floor = floor; g.player.maxHp = 80; g.player.hp = 80; g.relics = { ember: 2, storm: 1, fang: 1 }; g.enemies = []; g.checkCleared?.(); }, idea.floor ?? 44);
    await tick(10);
    for (let i = 0; i < 12; i++) { const d = await botDir(); if (!d) break; await p.keyboard.press(KEY[d.join(',')]); await tick(8); if (await p.evaluate(() => !!document.querySelector('.offer button'))) break; }
    await until(() => !!document.querySelector('.offer button'), 120);
    await p.keyboard.press('1'); await tick(40);
  }
  // warm up a few steps (not recorded)
  for (let i = 0; i < 40; i++) { await cryptStep(i); await tick(); }
  let i = 0;
  drive = async () => cryptStep(i++);
}

// ---- record ----
if (!WIDE) await centre();
await placeHook();
await hideHook(false);
const total = Math.round(SECONDS * FPS);
const fuseAt = idea.fuse ? Math.round((idea.fuse.at ?? 1) * FPS) : -1;
let fusing = 0;
let dying = false;
let deadAt = 0;
const marks = {};
for (let i = 0; i < (idea.jumps?.some((j) => j.death) ? total + 30 * FPS : total); i++) {
  // The Soul Forge: two relics become one, played over the run (the run waits while it plays).
  if (i === fuseAt) {
    await p.evaluate(async (f) => {
      const fx = await import('/src/fusefx.ts');
      const ic = await import('/src/relic-icons.ts');
      fx.playFusion({ a: '', b: '', out: '', name: f.name, ascended: Boolean(f.ascended), aImg: ic.iconCanvas(`m:${f.a}`), bImg: ic.iconCanvas(`m:${f.b}`), outImg: ic.iconCanvas(`m:${f.out}`), onDone: () => {} });
    }, idea.fuse);
    fusing = Math.round(3.2 * FPS);
  }
  if (fusing > 0) fusing--;
  else await drive();
  // `jumps: [{ at, floor, label?, hook?, death? }]`: cut deeper into the same run at `at` seconds,
  // with the floor stamped over the cut. `death` lets Death come for the hero, and the clip
  // follows the game's own death screen before the end card fades in over it.
  for (const j of idea.jumps ?? []) {
    // (at the time given, or as soon after as the hero is back on the board, not mid relic pick)
    if (j.done || i < Math.round(j.at * FPS)) continue;
    if (!(await p.evaluate(() => window.cryptfall.game.phase === 'play' && !document.querySelector('.offer button')))) continue;
    j.done = true;
    (marks.jumps ??= []).push(i / FPS);
    await p.evaluate((j) => {
      const g = window.cryptfall.game;
      g.relics = { ...g.relics, ...(j.relics ?? { ember: 3, storm: 3, frost: 2, fang: 3, whetstone: 4, thorns: 2, whirl: 2, heart: 3 }) };
      g.relicLog = Object.keys(g.relics);
      // deep down a hit can be hundreds: a big pool of health, so the cut isn't over in a blink
      g.player.maxHp = j.hp ?? Math.max(g.player.maxHp, 400);
      g.player.hp = g.player.maxHp;
      g.enterFloor(j.floor);
      if (j.death) {
        // Death rises straight away and comes through the fight
        window.__mortal = true;
        g.reaperIn = 1;
      }
      const f = document.getElementById('tt-floor');
      f.innerHTML = `Floor ${j.floor}${j.label ? `<small>${j.label}</small>` : ''}`;
      f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
      if (j.hook !== undefined) document.getElementById('tt-hook').innerHTML = j.hook;
    }, j);
    if (j.death) dying = true;
  }
  // once the hero has fallen, play on through the death screen, then fade to the end card
  if (dying && !marks.rise && (await p.evaluate(() => { const r = window.cryptfall.game.reaper; return Boolean(r && !r.waiting); }))) marks.rise = i / FPS;
  if (dying && !deadAt && (await p.evaluate(() => window.cryptfall.game.phase === 'dead'))) { deadAt = i; marks.death = i / FPS; }
  // after "Death claims you" goes to black, straight to the title (`deathScreen: true` shows the
  // game's own results screen first)
  if (deadAt && (idea.deathScreen
    ? i - deadAt > Math.round((idea.deathHold ?? 4.2) * FPS)
    : i - deadAt > Math.round((idea.blackAfter ?? 1.6) * FPS) || await p.evaluate(() => { const o = document.getElementById('overlay'); return Boolean(o && !o.hidden && o.dataset.screen === 'death'); }))) break;
  if (idea.scene === 'night' && idea.ultAt !== undefined && i === Math.round(idea.ultAt * FPS)) {
    await p.evaluate(() => { window.night.ult = 1; });
    await p.keyboard.press('e');
  }
  await tick();
  // A cleared floor's relic offer is cut: taken off camera, and the clock runs on until the next
  // floor is back on the board (and the offer's fading copy has gone). `showOffers: true` keeps it.
  if (idea.scene !== 'night' && !idea.showOffers) {
    const offerUp = () => p.evaluate(() => {
      const o = document.getElementById('overlay');
      return Boolean((o && !o.hidden && o.dataset.screen === 'choose') || document.querySelector('.overlay-ghost.screen-choose'));
    });
    for (let k = 0; k < 400 && (await offerUp()); k++) {
      if (await p.evaluate(() => !!document.querySelector('.offer button'))) await p.keyboard.press('1');
      await tick(3);
    }
  }
  await shot();
}
marks.end = frame / FPS;
await p.evaluate(({ fade, black }) => {
  // (on the fade to black the hook goes down with the game, under the black)
  if (!black) document.getElementById('tt-hook').style.display = 'none';
  const e = document.getElementById('tt-end');
  e.style.display = 'flex';
  // (a screen that comes up under the end card, the results or a cleared floor's relic offer,
  // stays out of sight: the card is see-through as it fades in)
  const st = document.createElement('style');
  st.textContent = '#overlay, .overlay-ghost { visibility: hidden !important; }';
  document.head.appendChild(st);
  if (black) e.classList.add('black');
  if (fade) e.classList.add('fade');
}, { fade: Boolean(idea.jumps), black: Boolean(idea.jumps?.some((j) => j.death) && !idea.deathScreen) });
// (end: false leaves the end card off, for a clip that's one part of a longer video)
for (let i = 0; i < (idea.end === false ? 0 : Math.round((idea.jumps?.some((j) => j.death) ? END + 1.4 : END) * FPS)); i++) {
  await tick();
  await shot();
}
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
console.log(JSON.stringify({ frames: frame, fps: FPS }), errs.length ? `errors: ${errs.join(' | ')}` : '');
await b.close();
