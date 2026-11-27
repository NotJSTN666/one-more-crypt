// A TikTok of every theme with its own music: one run of today's Daily Crypt, filmed tall,
// changing to the next theme every few steps. Each theme's name comes up in its own lettering,
// and its music plays under its part of the run. Ends on the end card.
//
//   node scripts/tiktok/themes-tiktok.mjs <out dir>
//
// Writes <out>/frames/*.jpg (30 a second), <out>/music.wav and <out>/one-more-crypt-themes.mp4.
// Needs the dev server, pointed at a stand-in server so nothing real is touched:
//   VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test npx vite --port 5199
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const OUT = process.argv[2] ?? 'out/tiktok/themes';
const FPS = 30;
/** Steps on each theme, and how long a step takes. */
const STEPS = Number(process.env.STEPS ?? 3);
const STEP_S = 0.42;
const PAGE = 'http://localhost:5199/';
const THEMES = ['classic', 'ashen', 'verdigris', 'frost', 'crimson', 'gilded', 'sunken', 'infernal', 'witchwood', 'astral', 'neon'];
rmSync(`${OUT}/frames`, { recursive: true, force: true });
mkdirSync(`${OUT}/frames`, { recursive: true });

const b = await chromium.launch(BROWSER);
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.route('**/test.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
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
  const { ACHIEVEMENTS } = await import('/src/content.ts');
  localStorage.clear();
  localStorage.setItem('cryptfall:v1', JSON.stringify({ seenLogin: true, seenOnlineLogin: true, tutorialDone: true, name: 'Gravekeeper', totals: { runs: 40 } }));
  for (const [k, v] of [['omc:news-read-day', '2099-01-01'], ['omc:news', 'story-act1'], ['omc:news-bell', '1'], ['omc:ns-intro', '1'], ['omc:news-midwinter-2026', '1'], ['omc:delve-clip', '1'], ['omc:themes-seen', '2']]) localStorage.setItem(k, v);
  localStorage.setItem('wardenfall:meta', JSON.stringify({ gifts: ['keepersfavour'], heroes: ['knight', 'rogue', 'necro', 'paladin', 'ranger', 'mage', 'barbarian', 'bellringer'], hero: 'knight', achievements: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 1])), heroStats: { knight: { runs: 5 } } }));
});
await p.goto(PAGE);
await p.waitForTimeout(2500);
await p.evaluate(() => document.fonts.ready);
await p.evaluate(() => window.__freeze());
await p.addStyleTag({ content: '#toast, .back-top, .install-bar, .tester-ask, .invite-ask, #sound-hint, .ns-pad, .touch-pad, .dpad, #pad { display: none !important; } #tip, #relic-bar, #controls, #dpad, .floor-tip { visibility: hidden !important; }' });

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
const has = (sel) => p.evaluate((s) => !!document.querySelector(s), sel);
const press = async (sel) => {
  for (let i = 0; i < 300; i++) {
    if (await has(sel)) return p.evaluate((s) => document.querySelector(s).click(), sel);
    await tick(2);
    await p.waitForTimeout(20);
  }
  throw new Error(`never found ${sel}`);
};

// ---- the words: a hook at the top, the theme's name in its own lettering, then the end card ----
await p.evaluate(() => {
  const st = document.createElement('style');
  st.textContent = `
    #tt-hook { position: fixed; z-index: 9999; left: 14px; right: 14px; top: 34px; text-align: center; pointer-events: none;
      font: 700 21px/1.25 'Pixelify Sans', sans-serif; color: #fff; text-transform: lowercase;
      text-shadow: 0 0 2px #000, 2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000; }
    #tt-hook b { color: #f2c14e; }
    #tt-name { position: fixed; z-index: 9999; left: 0; right: 0; bottom: 70px; text-align: center; pointer-events: none;
      font: 40px/1 var(--gothic); color: var(--gold); text-shadow: 0 3px 0 #000, 0 0 16px rgba(0,0,0,0.9), 0 0 24px var(--gold); }
    #tt-name small { display: block; margin-top: 8px; font: 11px Silkscreen, monospace; letter-spacing: 3px; color: #fff; text-shadow: 0 2px 0 #000; }
    #tt-black { position: fixed; inset: 0; z-index: 10001; background: #07040b; pointer-events: none; opacity: 0; }
    #tt-end { position: fixed; inset: 0; z-index: 10000; display: flex; opacity: 0; flex-direction: column; align-items: center; justify-content: center; gap: 14px; pointer-events: none;
      background: radial-gradient(circle at 50% 45%, rgba(40,10,20,0.95), rgba(5,2,8,0.99)); text-align: center; }
    #tt-end h1 { margin: 0; font: 64px/1 'Pirata One', Georgia, serif; color: #d23a46; text-shadow: 0 0 24px rgba(255,60,80,0.7); }
    #tt-end p { margin: 0; padding: 0 22px; font: 11px/1.5 Silkscreen, monospace; letter-spacing: 1.5px; color: #e8dcc4; }
    #tt-end .url { font-size: 17px; color: #f2c14e; border: 2px solid #f2c14e; padding: 10px 18px; margin-top: 8px; }`;
  document.head.appendChild(st);
  for (const [id, html] of [['tt-hook', '11 themes for my game.<br><b>every one has its own music</b>'], ['tt-name', ''], ['tt-end', '<h1>One More<br>Crypt</h1><p>11 THEMES · PICK YOURS IN SETTINGS</p><p>FREE · NO DOWNLOAD<br>PLAYS IN YOUR BROWSER</p><p class="url">ONEMORECRYPT.COM</p>'], ['tt-black', '']]) {
    const el = document.createElement('div');
    el.id = id;
    el.innerHTML = html;
    document.body.appendChild(el);
  }
});

// ---- off camera: into today's crypt ----
await p.evaluate(() => { window.__was = window.cryptfall.game; });
await press('#daily');
await tick(120);
for (let i = 0; i < 300; i++) {
  if (await p.evaluate(() => { const g = window.cryptfall.game; return g !== window.__was && g.phase === 'play' && document.querySelector('#overlay')?.hidden; })) break;
  await tick(2);
}
// centre the board in the frame, clear of the hook and the name
await p.evaluate(() => {
  const big = [...document.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 200 && !(r.width >= innerWidth - 2 && r.height >= innerHeight - 2)).sort((a, b) => b.width - a.width)[0];
  if (!big) return;
  const shift = Math.round(innerHeight * 0.5 - (big.top + big.bottom) / 2);
  for (const el of document.body.children) if (!el.id.startsWith('tt-') && el.tagName !== 'SCRIPT' && el.tagName !== 'CANVAS') el.style.transform = `translateY(${shift}px)`;
});

// ---- the bot: the nearest foe, else the stairs ----
const botDir = () => p.evaluate(() => {
  const g = window.cryptfall?.game;
  if (!g || g.phase !== 'play') return null;
  const W = 7, P = g.player, key = (x, y) => y * W + x;
  const foes = g.enemies.filter((e) => !e.dead && !e.ally);
  const targets = new Set(foes.length ? foes.map((e) => key(e.x, e.y)) : g.stairsOpen ? [key(g.stairs.x, g.stairs.y)] : []);
  if (!targets.size) return null;
  const occ = new Set(foes.map((e) => key(e.x, e.y)));
  const start = key(P.x, P.y), prev = new Map([[start, -1]]), q = [[P.x, P.y]];
  while (q.length) {
    const [x, y] = q.shift();
    const k = key(x, y);
    if (targets.has(k) && k !== start) {
      let c = k;
      while (prev.get(c) !== start) c = prev.get(c);
      return [(c % W) - P.x, Math.floor(c / W) - P.y];
    }
    if (occ.has(k) && k !== start) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= W || prev.has(nk) || g.isWall(nx, ny) || g.isLava?.(nx, ny)) continue;
      prev.set(nk, k);
      q.push([nx, ny]);
    }
  }
  return null;
});
const KEY = { '0,-1': 'ArrowUp', '1,0': 'ArrowRight', '0,1': 'ArrowDown', '-1,0': 'ArrowLeft' };
const keepAlive = () => p.evaluate(() => { const g = window.cryptfall.game; g.player.hp = Math.max(g.player.hp, Math.ceil(g.player.maxHp * 0.6)); });

let frame = 0;
const shot = async () => {
  await tick();
  // (the relic screen can open on this very tick: take it off camera before the frame is shot)
  if (await overlayUp()) await offCamera();
  await p.screenshot({ path: `${OUT}/frames/${String(frame).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  // (and it can open while the shot is taken: then that frame is dropped and shot again)
  if (await overlayUp()) {
    await offCamera();
    return shot();
  }
  frame++;
};
/**
 * The relic screen between floors is cut: while it's up (or its copy is still fading out), nothing is filmed; a relic is taken
 * and the clock runs on until the next floor is back on the board.
 */
const overlayUp = () => p.evaluate(() => !document.querySelector('#overlay')?.hidden || !!document.querySelector('.overlay-ghost'));
const offCamera = async () => {
  for (let i = 0; i < 400 && (await overlayUp()); i++) {
    if (await has('.offer button')) await p.keyboard.press('1');
    else if (await has('#fused-ok')) await p.evaluate(() => document.getElementById('fused-ok').click());
    await tick(3);
  }
};
const NAMES = { classic: 'Classic', ashen: 'Ashen', verdigris: 'Verdigris', frost: 'Frostbound', crimson: 'Crimson Court', gilded: 'Gilded Tomb', sunken: 'Sunken Ruins', infernal: 'Infernal Forge', witchwood: 'Witchwood', astral: 'Astral Observatory', neon: 'Neon Tomb' };

// ---- record: a few steps in each theme ----
const cuts = [];
for (const [n, id] of THEMES.entries()) {
  cuts.push({ id, at: frame / FPS });
  await p.evaluate(async ([id, name, n, of]) => {
    (await import('/src/themes.ts')).applyTheme(id, false);
    document.getElementById('tt-name').innerHTML = `${name}<small>${n} / ${of}</small>`;
  }, [id, NAMES[id], n + 1, THEMES.length]);
  for (let s = 0; s < STEPS; s++) {
    await keepAlive();
    await offCamera();
    {
      const d = await botDir();
      await p.keyboard.press(d ? KEY[d.join(',')] : ' ');
    }
    for (let f = 0; f < Math.round(STEP_S * FPS); f++) {
      await offCamera();
      await shot();
    }
  }
}
// the end card
const endAt = frame / FPS;
await p.evaluate(() => { document.getElementById('tt-name').innerHTML = ''; document.getElementById('tt-hook').style.opacity = 0; });
for (let i = 0; i < Math.round(2.6 * FPS); i++) {
  await p.evaluate((a) => { document.getElementById('tt-end').style.opacity = a; }, Math.min(1, i / (0.5 * FPS)));
  await shot();
}
const total = frame / FPS;

// ---- the music: each theme's own score under its part, the last one carrying the end card ----
await p.goto(`${PAGE}privacy.html`);
const wav = await p.evaluate(async ({ cuts, total }) => {
  const a = await import('/src/audio.ts');
  const RATE = 44100;
  const n = Math.ceil(total * RATE);
  const mix = [new Float32Array(n), new Float32Array(n)];
  const FADE = Math.round(0.08 * RATE);
  for (let i = 0; i < cuts.length; i++) {
    const from = cuts[i].at;
    const to = i + 1 < cuts.length ? cuts[i + 1].at : total;
    a.setMusicStyle(cuts[i].id);
    // (a bar in, so each part starts mid-song with the drums going, not on its first beat)
    const buf = await a.renderCrypt(to - from + 2.2, 2);
    const skip = Math.round(2 * RATE);
    const s0 = Math.round(from * RATE);
    const len = Math.min(n - s0, Math.round((to - from) * RATE) + FADE);
    for (let c = 0; c < 2; c++) {
      const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
      for (let k = 0; k < len; k++) {
        const fadeIn = i === 0 ? 1 : Math.min(1, k / FADE);
        const fadeOut = Math.min(1, (len - k) / FADE);
        mix[c][s0 + k] += (src[skip + k] ?? 0) * fadeIn * (i + 1 < cuts.length ? fadeOut : 1) * 2.4;
      }
    }
  }
  // fade the last bars out under the end card
  const endFade = Math.round(1.2 * RATE);
  for (let c = 0; c < 2; c++) for (let k = 0; k < endFade; k++) mix[c][n - endFade + k] *= 1 - k / endFade;
  const d = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => [...s].forEach((ch, i) => d.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); d.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 2, true); d.setUint32(24, RATE, true); d.setUint32(28, RATE * 4, true);
  d.setUint16(32, 4, true); d.setUint16(34, 16, true); str(36, 'data'); d.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < 2; c++, o += 2) d.setInt16(o, Math.max(-1, Math.min(1, mix[c][i])) * 32767, true);
  let s = '';
  const bytes = new Uint8Array(d.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}, { cuts, total });
writeFileSync(`${OUT}/music.wav`, Buffer.from(wav, 'base64'));
await b.close();

execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', `${OUT}/frames/%05d.jpg`, '-i', `${OUT}/music.wav`,
  '-vf', 'scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow',
  '-af', 'alimiter=limit=0.95', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', `${OUT}/one-more-crypt-themes.mp4`]);
console.log(JSON.stringify({ frames: frame, seconds: total, end: endAt, cuts: cuts.length }), errs.length ? `errors: ${errs.slice(0, 3).join(' | ')}` : '');
