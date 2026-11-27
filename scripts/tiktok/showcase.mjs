// The showcase trailer: every part of the game in one fast cut. Short clips, each starting on a
// white flash (cut on the beat), with a line of words for each:
//   the title with live play behind it, the Daily, relics, the Soul Forge, Crypt Race, the ways to
//   die, Death on floor 150+, Horde, the Night Shift and its ultimate, the story's world, the
//   heroes, then the end card.
//
//   node scripts/tiktok/showcase.mjs wide|tall <out dir>
//
// Writes <out>/frames/*.jpg at 30 a second and <out>/marks.json (the cuts, the end, and every
// sound effect with its time) for showcase-sound.mjs. Needs the dev server: npx vite --port 5199
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};

const shape = process.argv[2] === 'tall' ? 'tall' : 'wide';
const OUT = process.argv[3];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; // (to try out some clips alone)
const FPS = 30;
const STEP = 1000 / FPS;
const PAGE = 'http://localhost:5199/';
rmSync(`${OUT}/frames`, { recursive: true, force: true });
mkdirSync(`${OUT}/frames`, { recursive: true });

const b = await chromium.launch(BROWSER);
const p = await b.newPage(shape === 'tall'
  ? { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.addInitScript({ path: new URL('./shim.js', import.meta.url).pathname });

// ---- the rival for the race: a real run of one crypt, served in place of the server's ----
let ghostRow = null;
await p.route('**/rest/v1/runs*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ghostRow ? [ghostRow] : []) }));
await p.route('**/rest/v1/profiles*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'rival', name: 'Bonepicker' }]) }));
await p.route('**/rest/v1/leaderboard_daily*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ user_id: 'u9', name: 'Gravewalker', floor: 17, kills: 60, turns: 400, relics: '', killed_by: 'a Ghoul', rank: 1 }]) }));

const seed = async (extra = {}) => {
  for (let i = 0; i < 40; i++) {
    try { await p.goto(PAGE); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  await p.evaluate(async (extra) => {
    const { ACHIEVEMENTS } = await import('/src/content.ts');
    localStorage.clear();
    localStorage.setItem('cryptfall:v1', JSON.stringify({ seenLogin: true, seenOnlineLogin: true, tutorialDone: true, name: 'Gravekeeper', bestEndless: 31, totals: { runs: 40, bestDaily: 12 } }));
    for (const [k, v] of [['omc:news-read-day', '2099-01-01'], ['omc:news', 'story-act1'], ['omc:news-bell', '1'], ['omc:ns-intro', '1'], ['omc:news-midwinter-2026', '1'], ['omc:delve-clip', '1'], ['omc:android-test', 'no'], ['omc:invite-ask', '{"no":9}']]) localStorage.setItem(k, v);
    localStorage.setItem('wardenfall:meta', JSON.stringify({ gifts: ['keepersfavour'],
      heroes: ['knight', 'rogue', 'necro', 'paladin', 'ranger', 'mage', 'barbarian', 'bellringer'], hero: 'knight', souls: 4200, earned: 16000,
      achievements: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 1])), codex: { plasma: 1 }, fusions: { plasma: 1 },
      story: { done: [1, 2, 3, 4, 11, 12, 13] }, race: { laurels: 60, races: 20, wins: 12, trail: 'ember', finisher: 'coins' }, pets: ['bat'], pet: 'bat',
      ...extra,
    }));
  }, extra);
};

// ---- the clock: game time and CSS animations both move one frame at a time ----
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

/** Load the game afresh (with this save), take hold of its clock, and put the words and the flash on the page. */
const stage = async (extra) => {
  await seed(extra);
  await p.goto(PAGE);
  await p.waitForTimeout(2600);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => window.__freeze());
  await p.addStyleTag({ content: `#toast, #feat, .back-top, .install-bar, .tester-ask, .invite-ask { display: none !important; }
    ${shape === 'tall' ? '.ns-pad, .touch-pad, .dpad, #pad, #dpad { visibility: hidden !important; }' : ''}` });
  await p.evaluate((shape) => {
    const st = document.createElement('style');
    st.textContent = `
      #sc-cap { position: fixed; z-index: 9999; pointer-events: none; left: 0; right: 0; text-align: center; opacity: 0;
        ${shape === 'tall' ? 'top: 64%; padding: 0 14px; font: 600 24px/1.25' : 'bottom: 30px; font: 600 34px/1.2'} 'Pixelify Sans', Silkscreen, monospace; color: #fff;
        text-shadow: 0 0 2px #000, 2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0 4px 14px rgba(0,0,0,0.9); }
      #sc-cap span { display: inline-block; padding: ${shape === 'tall' ? '8px 14px' : '10px 28px'}; background: rgba(7,4,11,0.8); border: 2px solid rgba(242,193,78,0.6); }
      #sc-cap b { color: #f2c14e; font-weight: 600; }
      #sc-flash { position: fixed; inset: 0; z-index: 10002; background: #fff; pointer-events: none; opacity: 0; }
      #sc-end { position: fixed; inset: 0; z-index: 10001; display: flex; opacity: 0; flex-direction: column; align-items: center; justify-content: center; gap: 14px; pointer-events: none;
        background: radial-gradient(circle at 50% 45%, rgba(40,10,20,0.95), rgba(5,2,8,0.99)); text-align: center; }
      #sc-end h1 { margin: 0; font: ${shape === 'tall' ? 66 : 120}px/1 'Pirata One', Georgia, serif; color: #d23a46; text-shadow: 0 0 28px rgba(255,60,80,0.75); }
      #sc-end p { margin: 0; padding: 0 22px; font: ${shape === 'tall' ? 12 : 22}px/1.5 Silkscreen, monospace; letter-spacing: 2px; color: #e8dcc4; }
      #sc-end .url { font-size: ${shape === 'tall' ? 18 : 30}px; color: #f2c14e; border: 2px solid #f2c14e; padding: 10px 18px; margin-top: 8px; }`;
    document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend', `<div id="sc-cap"></div><div id="sc-flash"></div><div id="sc-end"><h1>One More${shape === 'tall' ? '<br>' : ' '}Crypt</h1><p>FREE · NO DOWNLOAD · PLAYS IN YOUR BROWSER</p><p>DESKTOP AND PHONE</p><p class="url">ONEMORECRYPT.COM</p></div>`);
  }, shape);
  await hookSfx();
};

// ---- sound effects: noted with their time, laid under the video afterwards ----
const sounds = [];
const hookSfx = () => p.evaluate(() => {
  const sfx = window.omcSfx;
  window.__sfx = [];
  if (!sfx) return;
  for (const name of Object.keys(sfx)) {
    const real = sfx[name];
    if (typeof real !== 'function' || name === 'fuse') continue;
    sfx[name] = (...args) => { window.__sfx.push({ name, args, t: window.__rec ?? 0 }); return real(...args); };
  }
});
const keepSfx = async () => sounds.push(...(await p.evaluate(() => (window.__sfx ?? []).splice(0))));

// ---- recording: a clip starts on a flash and its words fade in ----
let frame = 0;
const marks = { cuts: [], fuses: [], ults: [] };
let clipStart = 0;
let words = '';
const clip = async (html) => {
  words = html;
  clipStart = frame;
  marks.cuts.push(frame / FPS);
  await p.evaluate((html) => { const c = document.getElementById('sc-cap'); c.innerHTML = html ? `<span>${html}</span>` : ''; c.style.opacity = 0; }, html);
};
const shot = async () => {
  const k = frame - clipStart;
  await p.evaluate(([k, rec, words]) => {
    window.__rec = rec;
    document.getElementById('sc-flash').style.opacity = Math.max(0, 0.85 - k * 0.12);
    const c = document.getElementById('sc-cap');
    c.style.opacity = words ? Math.min(1, Math.max(0, (k - 2) / 6)) : 0;
    c.style.transform = `translateY(${Math.max(0, 8 - k)}px)`;
  }, [k, frame / FPS, words]);
  await tick();
  await p.screenshot({ path: `${OUT}/frames/${String(frame++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
};
const hold = async (s) => { for (let i = 0; i < Math.round(s * FPS); i++) await shot(); };

// ---- the bot for the crypt: walk to a tile, else the nearest foe, else the stairs ----
const KEY = { '0,-1': 'ArrowUp', '1,0': 'ArrowRight', '0,1': 'ArrowDown', '-1,0': 'ArrowLeft' };
const botDir = (goal) => p.evaluate((goal) => {
  const g = window.cryptfall?.game;
  if (!g || g.phase !== 'play') return null;
  const W = 7, P = g.player, key = (x, y) => y * W + x;
  const foes = g.enemies.filter((e) => !e.dead && !e.ally);
  const targets = goal ? [key(goal.x, goal.y)] : foes.length ? foes.map((e) => key(e.x, e.y)) : g.stairsOpen ? [key(g.stairs.x, g.stairs.y)] : [];
  if (!targets.length) return null;
  const tset = new Set(targets), occ = new Set(g.enemies.map((e) => key(e.x, e.y)));
  const start = key(P.x, P.y), prev = new Map([[start, -1]]), q = [[P.x, P.y]];
  while (q.length) {
    const [x, y] = q.shift();
    const k = key(x, y);
    if (tset.has(k) && k !== start) { let c = k; while (prev.get(c) !== start) c = prev.get(c); return [(c % W) - P.x, Math.floor(c / W) - P.y]; }
    if (occ.has(k) && k !== start) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
      const nk = key(nx, ny);
      if (prev.has(nk) || g.isWall(nx, ny) || g.isLava?.(nx, ny) || (g.reaper && g.reaper.x === nx && g.reaper.y === ny)) continue;
      prev.set(nk, k); q.push([nx, ny]);
    }
  }
  return null;
}, goal ?? null);
const GAP = Math.round(0.3 * FPS);
const move = async (goal) => {
  await p.evaluate(() => { const g = window.cryptfall?.game; if (g) { g.player.hp = Math.max(g.player.hp, Math.ceil(g.player.maxHp * 0.6)); } });
  if (await has('.offer button')) return p.keyboard.press('1');
  const d = await botDir(goal);
  await p.keyboard.press(d ? KEY[d.join(',')] : ' ');
};
/** Play on for a while, a step every 0.3s. */
const play = async (s, goal) => { for (let i = 0; i < Math.round(s * FPS); i++) { if (i % GAP === 0) await move(goal && (await goal())); await shot(); } };
const startEndless = async (hero = 'knight') => {
  await click('#delve'); await tick(20);
  await press('#endless'); await tick(30);
  await p.evaluate(() => { window.__was = window.cryptfall.game; });
  await p.evaluate((hero) => document.querySelector(`.hero-card[data-hero="${hero}"]`)?.click(), hero); await tick(90);
  await sure(() => { const g = window.cryptfall.game; return g !== window.__was && g.phase === 'play' && document.querySelector('#overlay')?.hidden; }, 'an Endless run');
};
const want = (name) => !ONLY || ONLY.includes(name);

// =============================== the clips ===============================

// 1. the title: the game playing behind it
if (want('title')) {
  await stage();
  await tick(60);
  await clip('A new crypt <b>every day</b>. The same for everyone.');
  await hold(3.2);
  await keepSfx();
}

// 2-4. the Daily: a fight, a relic, the Soul Forge
if (want('daily')) {
  await stage({ hero: 'knight' });
  await p.evaluate(() => { window.__was = window.cryptfall.game; });
  await press('#daily');
  await tick(90);
  await sure(() => { const g = window.cryptfall.game; return g !== window.__was && g.phase === 'play' && document.querySelector('#overlay')?.hidden; }, 'the daily run');
  await p.evaluate(() => { const g = window.cryptfall.game; g.floor = 6; g.player.maxHp = 24; g.player.hp = 24; g.relics = { ember: 1, storm: 1, whetstone: 2 }; g.relicLog = ['ember', 'storm', 'whetstone']; for (const e of g.enemies) { e.hp *= 3; e.maxHp *= 3; } });
  await tick(10);
  await clip('One try. <b>Bump into foes</b> to strike.');
  for (let i = 0; i < Math.round(3.6 * FPS); i++) { if (i % GAP === 0 && !(await has('.offer button'))) await move(); await shot(); }
  // clear what's left, off the clock's mind, and go for the stairs
  await p.evaluate(() => { const g = window.cryptfall.game; g.enemies = []; g.checkCleared?.(); });
  for (let i = 0; i < 30 && !(await has('.offer button')); i++) { await move(); await tick(10); }
  await sure(() => !!document.querySelector('.offer button'), 'the relic offer');
  await tick(20);
  await clip('Every floor, <b>claim a relic</b>. They stack and combo.');
  await hold(2.4);
  await p.keyboard.press('1');
  await tick(60);
  // the Soul Forge, a step or two off
  await p.evaluate(() => {
    const g = window.cryptfall.game;
    g.relics.ember = Math.max(1, g.relics.ember ?? 0); g.relics.storm = Math.max(1, g.relics.storm ?? 0);
    for (const id of ['ember', 'storm']) if (!g.relicLog.includes(id)) g.relicLog.push(id);
    g.enemies = [];
    const P = g.player;
    for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
      const x = P.x + dx, y = P.y + dy;
      if (x < 0 || y < 0 || x > 6 || y > 6 || g.isWall(x, y) || (x === g.stairs.x && y === g.stairs.y)) continue;
      g.feature = { x, y, kind: 'forge', used: false }; window.__forge = { x, y }; return;
    }
  });
  await move(await p.evaluate(() => window.__forge));
  await sure(() => !!document.querySelector('button[data-i="0"]'), 'the Soul Forge');
  await tick(10);
  await clip('Fuse two relics at the <b>Soul Forge</b>.');
  await hold(0.6);
  marks.fuses.push(frame / FPS);
  await click('button[data-i="0"]');
  await hold(3.6);
  await keepSfx();
}

// 5. Crypt Race
if (want('race')) {
  await stage({ hero: 'knight' });
  ghostRow = await p.evaluate(async () => {
    const { Game, fullPool } = await import('/src/game.ts');
    const s = 424242, W = 7;
    const g = new Game('endless', s, 0, { hero: 'knight', pool: fullPool(), forge: true, mercy: true, depths: true, boons: true });
    for (let i = 0; i < 400 && g.phase !== 'dead' && g.floor < 7; i++) {
      if (g.phase === 'choose') { g.choose(0); continue; }
      if (g.phase === 'event') { g.resolveEvent(false); continue; }
      const P = g.player, key = (x, y) => y * W + x;
      const foes = g.enemies.filter((e) => !e.dead && !e.ally);
      const targets = new Set(foes.length ? foes.map((e) => key(e.x, e.y)) : g.stairsOpen ? [key(g.stairs.x, g.stairs.y)] : []);
      let step = [0, 0];
      const prev = new Map([[key(P.x, P.y), null]]), q = [[P.x, P.y]];
      search: while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (nx < 0 || ny < 0 || nx >= W || ny >= W || prev.has(k)) continue;
          if (targets.has(k)) { let c = [x, y], f = [dx, dy]; while (prev.get(key(c[0], c[1]))) { const pr = prev.get(key(c[0], c[1])); f = [c[0] - pr[0], c[1] - pr[1]]; c = pr; } step = f; break search; }
          if (g.isWall(nx, ny)) continue;
          prev.set(k, [x, y]); q.push([nx, ny]);
        }
      }
      g.player.hp = Math.max(g.player.hp, 4);
      if (!g.act(step[0], step[1])) g.act(0, 0);
    }
    const full = g.header() + g.log;
    const again = Game.replay('endless', s, 0, full);
    return { user_id: 'rival', seed: s, floor: again.floor, kills: again.kills, turns: again.turns, log: full, seconds: Math.round(g.log.length * 0.32) };
  });
  if (shape === 'wide') await p.addStyleTag({ content: '#race-rivals:not(.big) { transform: scale(1.3); transform-origin: bottom right; }' });
  await press('#race'); await tick(30);
  await press('#race-ghost');
  await sure(() => !!document.getElementById('race-rivals') && document.querySelector('#overlay')?.hidden, 'the race to start');
  await tick(30);
  await clip('<b>Crypt Race:</b> race other players through the same crypt, live.');
  await play(4.4);
  await keepSfx();
}

// 6. the ways to die: four quick ones, each with its own colour
if (want('deaths')) {
  const deaths = ['slain', 'lava', 'plague', 'boss'];
  for (let d = 0; d < deaths.length; d++) {
    await stage({ hero: ['barbarian', 'mage', 'rogue', 'paladin'][d] });
    await startEndless(['barbarian', 'mage', 'rogue', 'paladin'][d]);
    await tick(20);
    if (d === 0) await clip('Every death <b>hits different</b>.');
    else { clipStart = frame; marks.cuts.push(frame / FPS); await p.evaluate(() => { const c = document.getElementById('sc-cap'); c.innerHTML = '<span>Every death <b>hits different</b>.</span>'; }); }
    // (the words stay up across the four)
    if (d > 0) clipStart = frame - 8;
    await p.evaluate((kind) => {
      const g = window.cryptfall.game; g.shieldCharges = 0; g.dodgeChance = () => 0; g.player.hp = 1;
      const P = g.player; const foe = (k) => ({ id: 999, kind: k, x: P.x + 1, y: P.y, hp: 5, maxHp: 5, dmg: 1, elite: null, dead: false, ally: false });
      g.endTurn = function () {
        if (kind === 'slain') { this.events.push({ t: 'eattack', id: 999, dir: { x: -1, y: 0 } }); this.hurtPlayer(9, foe('brute')); }
        if (kind === 'boss') { this.events.push({ t: 'eattack', id: 999, dir: { x: -1, y: 0 } }); this.hurtPlayer(9, foe('boss')); }
        if (kind === 'lava') this.hurtPlayer(9, null, 'the lava');
        if (kind === 'plague') this.hurtPlayer(9, null, 'the plague mist');
      };
    }, deaths[d]);
    await shot(); await shot();
    await p.evaluate(() => window.cryptfall.act(0, 0));
    await hold(1.15);
    // (the flash on the next cut makes it as if the flash were the sound of each)
    await p.evaluate(() => { const o = document.getElementById('flash-x'); if (o) o.remove(); });
    await keepSfx();
  }
}

// 7. floor 150+: Death walks
if (want('death')) {
  await stage({ hero: 'paladin' });
  await startEndless('paladin');
  await p.evaluate(() => { const g = window.cryptfall.game; g.floor = 150; g.player.maxHp = 600; g.player.hp = 600; g.relics = { ember: 3, storm: 3, frost: 2, fang: 3, whetstone: 4, heart: 3, crown: 1 }; g.relicLog = Object.keys(g.relics); g.enemies = []; g.descend(); window.cryptfall.pickRelic(0); });
  await tick(90);
  await sure(() => window.cryptfall.game.floor === 151, 'floor 151');
  // he rises at once and comes for the hero; the hero stays on the far side of the floor
  await p.evaluate(() => { const g = window.cryptfall.game; g.enemies = []; g.abyssDamage = () => 0; g.reaperIn = 1; });
  await p.keyboard.press(' '); await tick(10); await p.keyboard.press(' '); await tick(10);
  await clip('Past floor 150, <b>Death himself</b> hunts you.');
  for (let i = 0; i < Math.round(4 * FPS); i++) {
    if (i % GAP === 0) {
      await p.evaluate(() => { const g = window.cryptfall.game; g.player.hp = g.player.maxHp; g.shieldCharges = 0; if (g.reaper && !g.reaper.waiting && Math.abs(g.reaper.x - g.player.x) + Math.abs(g.reaper.y - g.player.y) <= 2) g.reaper.frozen = 1; });
      await p.keyboard.press(' ');
    }
    await shot();
  }
  await keepSfx();
}

// 8. Horde
if (want('horde')) {
  await stage({ hero: 'barbarian' });
  await click('#delve'); await tick(20);
  await press('#horde'); await tick(120);
  await sure(() => window.cryptfall.game?.mode === 'horde' && document.querySelector('#overlay')?.hidden, 'the Horde');
  for (let i = 0; i < 20; i++) { await move(); await tick(9); }
  await clip('<b>Horde:</b> hold one crypt against wave after wave.');
  await play(3.6);
  await keepSfx();
}

// 9. the Night Shift: a graveyard full of the dead, relics doing the fighting, then the ultimate
if (want('night')) {
  await stage({ hero: 'mage' });
  await click('#delve'); await tick(20);
  await press('#nightshift'); await tick(20);
  await press('#ns-go'); await tick(30);
  const s = { t: 900, level: 44, kills: 4200, relics: { spade: 3, orb: 5, storm: 5, ember: 4, frost: 3, lens: 3, skulls: 5, scythe: 5, wisps: 5 }, fused: { halo: true, tempest: true } };
  await p.evaluate((s) => {
    const n = window.night;
    n.t = s.t; n.level = s.level; n.kills = s.kills; n.relics = s.relics; n.fused = s.fused; n.bossesRisen = 0; n.bossKills = 0;
    n.maxHp = 50; n.hp = 44; n.anchorT = n.t; n.x = 24; n.y = 24;
    if (n.ally) n.ally.level = 4;
    n.level -= 1; n.xp = 2 + n.level * 2 + Math.floor((n.level * n.level) / 10);
  }, s);
  for (let i = 0; i < 200 && !(await p.evaluate(() => !!document.querySelector('.ns-choice') && getComputedStyle(document.querySelector('#ns-modal')).display !== 'none')); i++) await tick();
  await tick(10); await p.keyboard.press('Enter'); await tick(10);
  await p.evaluate((relics) => { const n = window.night; n.relics = relics; n.event = null; n.nextEventAt = 1e9; n.spawnDebt = 90; }, s.relics);
  const held = new Set();
  let f = 0;
  const drive = async () => {
    f++;
    const d = await p.evaluate((f) => {
      const n = window.night;
      n.hp = Math.max(n.hp, n.maxHp * 0.6);
      n.xp = Math.min(n.xp, 0); n.pendingLevels = 0; n.forgeOffers = 0; n.pactOffers = 0; n.ascendOffers = 0;
      n.pickups = n.pickups.filter((q) => q.kind !== 'forge' && q.kind !== 'shard' && q.kind !== 'chest');
      if (n.t - n.anchorT > 3) n.anchorT = n.t - 3;
      n.foes = n.foes.filter((x) => !x.boss);
      const modal = document.querySelector('#ns-modal');
      const choosing = modal && getComputedStyle(modal).display !== 'none';
      const a = (f / 30) * 0.9;
      const tx = 24 + Math.sin(a) * 9, ty = 24 + Math.sin(2 * a) * 6;
      return { dx: tx - n.x, dy: ty - n.y, choosing };
    }, f);
    if (d.choosing) { for (const k of held) await p.keyboard.up(k); held.clear(); await p.keyboard.press('Enter'); return; }
    const w = new Set();
    if (d.dx > 0.3) w.add('ArrowRight'); if (d.dx < -0.3) w.add('ArrowLeft'); if (d.dy > 0.3) w.add('ArrowDown'); if (d.dy < -0.3) w.add('ArrowUp');
    for (const k of held) if (!w.has(k)) { await p.keyboard.up(k); held.delete(k); }
    for (const k of w) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
  };
  for (let i = 0; i < 100; i++) { await drive(); await tick(); }
  await clip('<b>The Night Shift:</b> survive till dawn. Your relics do the fighting.');
  for (let i = 0; i < Math.round(3.4 * FPS); i++) { await drive(); await shot(); }
  await clip('Then <b>unleash your ultimate</b>.');
  await p.evaluate(() => { window.night.ult = 1; });
  marks.ults.push(frame / FPS);
  await p.keyboard.press('e');
  for (let i = 0; i < Math.round(3.4 * FPS); i++) { await drive(); await shot(); }
  for (const k of held) await p.keyboard.up(k);
  await keepSfx();
}

// 10. the story's world
if (want('story')) {
  await stage({ hero: 'knight', pet: 'hound', story: { done: [1, 2, 3, 4, 11, 12, 13], choices: { hound: 'Bones' } } });
  await p.evaluate(() => window.cryptfall.hollow('village', 3, 5));
  await tick(60);
  await clip('A <b>story</b> to explore, with a hound at your side.');
  const keys = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight'];
  for (let i = 0; i < Math.round(3.2 * FPS); i++) {
    if (i % 10 === 0) await p.keyboard.press(keys[(i / 10) % keys.length]);
    await shot();
  }
  await keepSfx();
}

// 11. the heroes
if (want('heroes')) {
  await stage({ hero: 'knight' });
  await click('#delve'); await tick(20);
  await press('#endless'); await tick(40);
  await clip('<b>8 heroes</b>, and hundreds of ways to dress them.');
  const heroes = ['knight', 'rogue', 'necro', 'paladin', 'ranger', 'mage', 'barbarian', 'bellringer'];
  for (let i = 0; i < Math.round(3 * FPS); i++) {
    if (i % 11 === 0) await p.evaluate((h) => { for (const c of document.querySelectorAll('.hero-card')) c.classList.toggle('selected', c.dataset.hero === h); document.querySelector(`.hero-card[data-hero="${h}"]`)?.scrollIntoView({ block: 'nearest' }); }, heroes[(i / 11) % heroes.length]);
    await shot();
  }
  await keepSfx();
}

// 12. the end card
if (want('end')) {
  if (!ONLY || ONLY[ONLY.length - 1] !== 'end') {
    // (over whatever is on screen: the heroes, or a fresh title)
  }
  await clip('');
  marks.end = frame / FPS;
  for (let i = 0; i < Math.round(3.6 * FPS); i++) {
    await p.evaluate((a) => { document.getElementById('sc-end').style.opacity = a; }, Math.min(1, i / 8));
    await shot();
  }
}

marks.total = frame / FPS;
marks.sfx = sounds;
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
console.log(JSON.stringify({ shape, frames: frame, total: marks.total, cuts: marks.cuts.map((c) => +c.toFixed(2)), sounds: sounds.length }), errs.length ? `errors: ${errs.slice(0, 3).join(' | ')}` : '');
await b.close();
