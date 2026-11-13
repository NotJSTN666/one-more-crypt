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
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const idea = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3];
const FPS = 30;
const SECONDS = idea.seconds ?? 11;
const END = 2.2; // the end card
const PAGE = 'http://localhost:5199/';
rmSync(`${OUT}/frames`, { recursive: true, force: true });
mkdirSync(`${OUT}/frames`, { recursive: true });

const b = await chromium.launch();
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
  for (const [k, v] of [['omc:news-read-day', '2099-01-01'], ['omc:news', 'story-act1'], ['omc:news-bell', '1'], ['omc:ns-intro', '1'], ['omc:delve-clip', '1']]) localStorage.setItem(k, v);
  localStorage.setItem('wardenfall:meta', JSON.stringify({
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
await p.addStyleTag({ content: '#toast, .ns-event, .back-top, .install-bar { display: none !important; }' });

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
await p.evaluate(({ hook }) => {
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
    #tt-end .url { font-size: 17px; color: #f2c14e; border: 2px solid #f2c14e; padding: 10px 14px; margin-top: 8px; }`;
  document.head.appendChild(st);
  const h = document.createElement('div');
  h.id = 'tt-hook';
  h.innerHTML = hook;
  document.body.appendChild(h);
  const e = document.createElement('div');
  e.id = 'tt-end';
  e.innerHTML = '<h1>One More<br>Crypt</h1><p>FREE · NO DOWNLOAD</p><p>PLAYS IN YOUR BROWSER</p><p class="url">ONEMORECRYPT.COM</p>';
  document.body.appendChild(e);
}, { hook: idea.hook });
// The hook goes above the game, in the space left by centring it: clear of the action and of
// TikTok's own buttons and caption.
const placeHook = () => p.evaluate(() => {
  const big = [...document.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0];
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
});
if (!WIDE) await p.addStyleTag({ content: '.ns-pad, .touch-pad, .dpad, #pad { visibility: hidden !important; }' });
// The play area sits high on a phone with the controls below it. With the controls hidden, move
// everything down so the action is in the middle of the frame, clear of TikTok's buttons.
const centre = () => p.evaluate(() => {
  const big = [...document.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0];
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
// Nothing ends the clip early: health topped up, every blow turned aside (a single hit deep down
// can be thousands), and Death left waiting in his corner.
const keepAlive = () => p.evaluate(() => {
  const g = window.cryptfall?.game;
  if (!g) return;
  g.player.hp = Math.max(g.player.hp, Math.ceil(g.player.maxHp * 0.6));
  g.shieldCharges = 40;
  if (g.reaperIn < 60) g.reaperIn = 99;
  if (g.reaper && !g.reaper.waiting) g.reaper = null;
});
const cryptStep = async (i, gap = 9) => {
  if (i % gap) return;
  if (await p.evaluate(() => !!document.querySelector('.offer button'))) {
    await p.keyboard.press('1');
    return;
  }
  await keepAlive();
  const d = await botDir();
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
for (let i = 0; i < total; i++) {
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
  if (idea.scene === 'night' && idea.ultAt !== undefined && i === Math.round(idea.ultAt * FPS)) {
    await p.evaluate(() => { window.night.ult = 1; });
    await p.keyboard.press('e');
  }
  await tick();
  await shot();
}
await p.evaluate(() => { document.getElementById('tt-hook').style.display = 'none'; document.getElementById('tt-end').style.display = 'flex'; });
// (end: false leaves the end card off, for a clip that's one part of a longer video)
for (let i = 0; i < (idea.end === false ? 0 : Math.round(END * FPS)); i++) {
  await tick();
  await shot();
}
console.log(JSON.stringify({ frames: frame, fps: FPS }), errs.length ? `errors: ${errs.join(' | ')}` : '');
await b.close();
