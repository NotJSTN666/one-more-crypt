// The Crypt Hall: a trophy room for everything a player has done. Boss trophies on
// the wall, a statue of each hero's deepest run, banners for feats and combos, and
// tabs to wear titles and looks and to read the Bestiary. Anyone can visit another
// player's Hall from the leaderboard or a shared link.

import { sfx } from './audio';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, COMBOS, HEROES, HERO_BY_ID, type HeroId } from './content';
import { ENEMY_INFO, type EnemyKind } from './game';
import { heroPortrait, heroSprite } from './hero';
import { equipLook, equipTitle, lookUnlocked, meta, titleUnlocked, type Meta } from './meta';
import { ONLINE, loadHall } from './online';
import {
  BESTIARY_KINDS, BESTIARY_TITLES, LOOKS, LOOK_BY_ID, TITLES, TITLE_BY_ID, TITLE_TIER, bestiaryTiers, rankFor, rankProgress,
  type BestRun, type BestRuns,
} from './progression';
import { RELICS, RELIC_BY_ID, type RelicId } from './relics';
import { copyText, siteUrl } from './share';
import { sprites } from './sprites';
import { esc, on, overlay, screen, showOverlay, toast } from './ui';

/** What a Hall shows: your own progress, or a cleaned-up copy of someone else's. */
export interface HallData {
  name: string;
  title: string;
  earned: number;
  feats: number;
  combos: number;
  relics: number;
  bestiary: Partial<Record<EnemyKind, number>>;
  /** Bosses slain before the Bestiary existed still count as trophies. */
  bossFeats: Partial<Record<EnemyKind, boolean>>;
  best: BestRuns;
}

const BOSS_FEAT: Partial<Record<EnemyKind, string>> = { boss: 'warden', abbot: 'abbot', lich: 'lich' };
const BOSSES: EnemyKind[] = ['boss', 'abbot', 'lich'];

const num = (v: unknown, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Build Hall data from saved progress. Remote progress is untrusted, so every field is checked. */
export function hallData(name: string, m: Partial<Meta> | Record<string, unknown>): HallData {
  const raw = m as Record<string, unknown>;
  const achievements = obj(raw.achievements);
  const bestiary: Partial<Record<EnemyKind, number>> = {};
  const beasts = obj(raw.bestiary);
  for (const k of BESTIARY_KINDS) bestiary[k] = num(beasts[k]);
  const bossFeats: Partial<Record<EnemyKind, boolean>> = {};
  for (const k of BOSSES) bossFeats[k] = Boolean(achievements[BOSS_FEAT[k]!]);
  const best: BestRuns = {};
  const bestRaw = obj(raw.best);
  for (const h of HEROES) {
    const run = obj(bestRaw[h.id]);
    if (!num(run.floor)) continue;
    const relics: Record<string, number> = {};
    for (const [id, n] of Object.entries(obj(run.relics))) if (RELIC_BY_ID[id as RelicId]) relics[id] = num(n, 99);
    const log = (Array.isArray(run.log) ? run.log : []).filter((id): id is string => typeof id === 'string' && Boolean(RELIC_BY_ID[id as RelicId])).slice(0, 200);
    best[h.id] = {
      floor: num(run.floor, 9999),
      kills: num(run.kills),
      mode: run.mode === 'daily' ? 'daily' : 'endless',
      relics,
      log,
      look: typeof run.look === 'string' && LOOK_BY_ID[run.look] ? run.look : '',
      at: num(run.at, 1e13),
    };
  }
  return {
    name,
    title: typeof raw.title === 'string' && TITLE_BY_ID[raw.title] ? raw.title : '',
    earned: num(raw.earned),
    feats: Object.keys(achievements).filter((id) => ACHIEVEMENT_BY_ID[id]).length,
    combos: Object.keys(obj(raw.combos)).filter((id) => COMBOS.some((c) => c.id === id)).length,
    relics: Object.keys(obj(raw.codex)).filter((id) => RELIC_BY_ID[id as RelicId]).length,
    bestiary,
    bossFeats,
    best,
  };
}

/** The title to show under a name, looked up by id so stored text is never shown as-is. */
export function titleName(id: string | null | undefined): string {
  return (id && TITLE_BY_ID[id]?.name) || '';
}

// ---------- the trophy room ----------

const W = 960;
const H = 720;
const FONT_NAME = '"Pirata One", Georgia, serif';
const FONT_PIXEL = 'Silkscreen, ui-monospace, monospace';

/** A sprite in one flat colour, for silhouettes of what isn't earned yet. */
function silhouette(img: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, font: string, color: string, glow = '') {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 24;
  }
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

/** Text shrunk until it fits the width. */
function fitText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, family: string, color: string, maxW: number, glow = '') {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (s > 10 && ctx.measureText(str).width > maxW) ctx.font = `${--s}px ${family}`;
  text(ctx, str, x, y, `${s}px ${family}`, color, glow);
}

function torch(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const flick = 1 + Math.sin(t * 9 + x) * 0.08 + Math.sin(t * 23 + x * 3) * 0.05;
  const glow = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, 120 * flick);
  glow.addColorStop(0, 'rgba(255,150,60,0.35)');
  glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 130, y - 140, 260, 260);
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x - 6, y, 12, 36);
  ctx.fillStyle = '#2a2018';
  ctx.fillRect(x - 12, y + 30, 24, 8);
  const h = 22 * flick;
  ctx.fillStyle = '#ff8a2a';
  ctx.fillRect(x - 8, y - h, 16, h);
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(x - 4, y - h * 0.7, 8, h * 0.7);
  ctx.fillStyle = '#fff2c0';
  ctx.fillRect(x - 2, y - h * 0.35, 4, h * 0.35);
}

function banner(ctx: CanvasRenderingContext2D, x: number, n: number, of: number, label: string, cloth: string, trim: string) {
  const top = 168;
  const w = 84;
  const h = 200;
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(x - w / 2 - 8, top - 8, w + 16, 8);
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top);
  ctx.lineTo(x + w / 2, top);
  ctx.lineTo(x + w / 2, top + h);
  ctx.lineTo(x, top + h - 26);
  ctx.lineTo(x - w / 2, top + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(x - w / 2, top, 6, h - 4);
  ctx.fillRect(x + w / 2 - 6, top, 6, h - 4);
  text(ctx, String(n), x, top + 82, `46px ${FONT_PIXEL}`, '#f2c14e');
  text(ctx, `/${of}`, x, top + 108, `16px ${FONT_PIXEL}`, 'rgba(232,220,196,0.7)');
  text(ctx, label, x, top + 140, `17px ${FONT_PIXEL}`, '#e8dcc4');
}

function trophy(ctx: CanvasRenderingContext2D, x: number, kind: EnemyKind, kills: number, slain: boolean) {
  const top = 176;
  // a stone plaque with a gilded rim for bosses you've beaten
  ctx.fillStyle = slain ? '#7a5a12' : '#2a2433';
  ctx.fillRect(x - 74, top - 4, 148, 156);
  ctx.fillStyle = slain ? '#2f2238' : '#1a1520';
  ctx.fillRect(x - 68, top + 2, 136, 144);
  if (slain) {
    const glow = ctx.createRadialGradient(x, top + 70, 10, x, top + 70, 80);
    glow.addColorStop(0, 'rgba(242,193,78,0.25)');
    glow.addColorStop(1, 'rgba(242,193,78,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 68, top + 2, 136, 144);
  }
  const s = sprites()[kind];
  ctx.drawImage(slain ? s.normal : silhouette(s.white, '#07040b'), x - 54, top + 12, 108, 108);
  ctx.fillStyle = slain ? '#c99a2e' : '#3a2a4a';
  ctx.fillRect(x - 40, top + 126, 80, 14);
  text(ctx, slain ? (kills ? `×${kills}` : 'SLAIN') : 'UNSLAIN', x, top + 138, `13px ${FONT_PIXEL}`, slain ? '#140d1c' : '#9a8fa8');
  fitText(ctx, ENEMY_INFO[kind].name.replace(/^The /, '').toUpperCase(), x, top + 178, 18, FONT_PIXEL, slain ? '#e8dcc4' : '#6b6680', 150);
}

function statue(ctx: CanvasRenderingContext2D, x: number, hero: HeroId, run: BestRun | undefined, deepest: boolean, t: number) {
  const base = 604;
  if (deepest) {
    const glow = ctx.createRadialGradient(x, base - 40, 10, x, base - 40, 100);
    glow.addColorStop(0, 'rgba(242,193,78,0.35)');
    glow.addColorStop(1, 'rgba(242,193,78,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 100, base - 150, 200, 200);
  }
  // plinth
  ctx.fillStyle = '#4a4058';
  ctx.fillRect(x - 52, base, 104, 10);
  ctx.fillStyle = '#2f2838';
  ctx.fillRect(x - 46, base + 10, 92, 36);
  ctx.fillStyle = '#4a4058';
  ctx.fillRect(x - 52, base + 46, 104, 8);
  const sprite = run ? heroSprite(hero, run.relics, run.log as RelicId[], run.look) : heroSprite(hero, {}, []);
  ctx.drawImage(run ? sprite.normal : silhouette(sprite.white, '#1a1424'), x - 48, base - 96, 96, 96);
  // drifting motes from the statue's look
  const aura = run && LOOK_BY_ID[run.look]?.aura;
  if (aura) {
    ctx.fillStyle = aura;
    for (let i = 0; i < 5; i++) {
      const p = (t * 0.25 + i / 5) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
      ctx.fillRect(x - 40 + ((i * 37) % 80), base - 10 - p * 100, 6, 6);
    }
    ctx.globalAlpha = 1;
  }
  text(ctx, run ? `F${run.floor}` : '—', x, base + 36, `22px ${FONT_PIXEL}`, run ? (deepest ? '#f2c14e' : '#e8dcc4') : '#6b6680');
  fitText(ctx, HERO_BY_ID[hero].name.replace(/^The /, '').toUpperCase(), x, base + 82, 18, FONT_PIXEL, run ? '#9a8fa8' : '#4a4058', 122);
}

/** Draw the Hall at time t (seconds), for the screen and the saved image. */
export function drawHall(ctx: CanvasRenderingContext2D, d: HallData, t = 0) {
  ctx.imageSmoothingEnabled = false;
  // backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0f22');
  bg.addColorStop(1, '#07040b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // the wall
  for (let y = 152; y < 470; y += 24) {
    const shift = (y / 24) % 2 ? 24 : 0;
    for (let x = -48 + shift; x < W; x += 48) {
      ctx.fillStyle = (x + y) % 96 ? '#1d1824' : '#211b29';
      ctx.fillRect(x, y, 46, 22);
    }
  }
  const shade = ctx.createLinearGradient(0, 152, 0, 470);
  shade.addColorStop(0, 'rgba(7,4,11,0.7)');
  shade.addColorStop(0.3, 'rgba(7,4,11,0.1)');
  shade.addColorStop(1, 'rgba(7,4,11,0.4)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 152, W, 318);

  // the floor
  for (let y = 470; y < H; y += 48) {
    for (let x = 0; x < W; x += 48) {
      ctx.fillStyle = (x / 48 + y / 48) % 2 ? '#17121e' : '#1b1523';
      ctx.fillRect(x, y, 48, 48);
    }
  }
  ctx.fillStyle = '#3a2a4a';
  ctx.fillRect(0, 466, W, 8);
  const floorFade = ctx.createLinearGradient(0, 470, 0, H);
  floorFade.addColorStop(0, 'rgba(7,4,11,0.2)');
  floorFade.addColorStop(1, 'rgba(7,4,11,0.85)');
  ctx.fillStyle = floorFade;
  ctx.fillRect(0, 474, W, H - 474);

  // name, title and Soul Rank
  const rank = rankFor(d.earned);
  fitText(ctx, d.name || 'Nameless', W / 2, 74, 76, FONT_NAME, '#d23a46', 880, 'rgba(210,58,70,0.6)');
  const title = titleName(d.title);
  if (title) fitText(ctx, `« ${title.toUpperCase()} »`, W / 2, 110, 20, FONT_PIXEL, '#f2c14e', 880);
  text(ctx, `${rank.name.toUpperCase()} · ${d.earned.toLocaleString()} SOULS`, W / 2, title ? 138 : 120, `17px ${FONT_PIXEL}`, rank.color);

  // trophies, torches and banners
  banner(ctx, 62, d.feats, ACHIEVEMENTS.length, 'FEATS', '#5a1622', '#c99a2e');
  banner(ctx, W - 62, d.combos, COMBOS.length, 'COMBOS', '#311854', '#c99a2e');
  torch(ctx, 360, 236, t);
  torch(ctx, 600, 236, t);
  BOSSES.forEach((k, i) => {
    const kills = d.bestiary[k] ?? 0;
    trophy(ctx, [232, 480, 728][i], k, kills, kills > 0 || Boolean(d.bossFeats[k]));
  });

  // statues of each hero's deepest run
  const deepest = Math.max(0, ...Object.values(d.best).map((r) => r?.floor ?? 0));
  HEROES.forEach((h, i) => {
    const run = d.best[h.id];
    statue(ctx, 96 + i * 128, h.id, run, Boolean(run && run.floor === deepest), t);
  });

  text(ctx, `${d.relics}/${RELICS.length} RELICS FOUND · ONEMORECRYPT.COM`, W / 2, H - 12, `16px ${FONT_PIXEL}`, '#6b6680');
}

// ---------- the screen ----------

type HallTab = 'trophies' | 'titles' | 'looks' | 'bestiary';

let anim = 0;

function startCanvas(d: HallData) {
  const canvas = document.getElementById('hall-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const start = performance.now();
  const name = screen;
  cancelAnimationFrame(anim);
  const tick = (now: number) => {
    if (screen !== name || !canvas.isConnected) return;
    drawHall(ctx, d, (now - start) / 1000);
    anim = requestAnimationFrame(tick);
  };
  anim = requestAnimationFrame(tick);
  // Redraw once the fonts arrive, in case they were still loading.
  void document.fonts?.load(`20px ${FONT_NAME}`).then(() => document.fonts.load(`20px ${FONT_PIXEL}`)).catch(() => undefined);
}

function rankBar(earned: number): string {
  const rank = rankFor(earned);
  const { next, fraction, needed } = rankProgress(earned);
  return `<div class="soul-rank">
    <div class="soul-rank-head"><span style="color:${rank.color}">👑 ${esc(rank.name)}</span><span>${earned.toLocaleString()} Souls</span></div>
    <div class="rank-track"><div style="width:${Math.round(fraction * 100)}%;background:${rank.color}"></div></div>
    <small>${next ? `${needed.toLocaleString()} more Souls to <b style="color:${next.color}">${esc(next.name)}</b>` : 'The highest Soul Rank. The Abyss bows to you.'}</small>
  </div>`;
}

/** A compact Soul Rank bar for the results screen. */
export function soulRankHtml(): string {
  return rankBar(meta.earned);
}

function trophiesBody(d: HallData): string {
  const kills = Object.values(d.bestiary).reduce((a, b) => a + (b ?? 0), 0);
  const bosses = BOSSES.reduce((a, k) => a + (d.bestiary[k] ?? 0), 0);
  const cell = (v: number | string, label: string) => `<div><b>${v}</b>${label}</div>`;
  const statues = Object.keys(d.best).length;
  return `<div class="stat-grid">
      ${cell(d.earned.toLocaleString(), 'SOULS EARNED')}
      ${cell(`${d.feats}/${ACHIEVEMENTS.length}`, 'FEATS')}
      ${cell(`${d.combos}/${COMBOS.length}`, 'COMBOS')}
      ${cell(`${d.relics}/${RELICS.length}`, 'RELICS')}
      ${cell(bosses, 'BOSSES SLAIN')}
      ${cell(kills.toLocaleString(), 'FOES SLAIN')}
    </div>
    ${statues < HEROES.length ? `<p class="fine">Each hero's statue is carved from their deepest run. ${HEROES.length - statues} plinth${HEROES.length - statues === 1 ? '' : 's'} still empty.</p>` : ''}`;
}

function titlesBody(): string {
  const owned = TITLES.filter((t) => titleUnlocked(t.id));
  const locked = TITLES.filter((t) => !titleUnlocked(t.id));
  const item = (id: string, name: string, desc: string, has: boolean) => `
    <button class="codex-item pick ${meta.title === id ? 'equipped' : ''}" data-title="${esc(id)}" ${has ? '' : 'disabled'}>
      <span class="shop-emoji">${has ? (meta.title === id ? '✅' : '📜') : '🔒'}</span>
      <span class="shop-info"><span class="name">${esc(name)}</span><span class="desc">${esc(desc)}</span></span>
    </button>`;
  return `<p class="fine">Your title shows under your name on the leaderboards and in your Hall. ${owned.length}/${TITLES.length} earned.</p>
    <div class="codex">
      ${item('', 'No title', 'Just your name.', true)}
      ${owned.map((t) => item(t.id, t.name, t.how, true)).join('')}
      ${locked.map((t) => item(t.id, t.name, t.how, false)).join('')}
    </div>`;
}

function looksBody(): string {
  const hero = meta.hero;
  const item = (id: string, name: string, how: string, has: boolean) => `
    <button class="look-card ${meta.look === id ? 'equipped' : ''}" data-look="${esc(id)}" ${has ? '' : 'disabled'}>
      <img src="${heroPortrait(hero, {}, [], 5, has ? id : '')}" alt="" width="60" height="60" class="${has ? '' : 'locked-look'}" />
      <span class="name">${has ? '' : '🔒 '}${esc(name)}</span>
      <span class="desc">${meta.look === id ? 'Wearing' : has ? 'Tap to wear' : esc(how)}</span>
    </button>`;
  const owned = LOOKS.filter((l) => lookUnlocked(l)).length;
  return `<p class="fine">Looks recolour your hero's cloak and add an aura, in every run. ${owned}/${LOOKS.length} unlocked.</p>
    <div class="looks">
      ${item('', 'Hero colours', 'The classic look', true)}
      ${LOOKS.map((l) => item(l.id, l.name, l.how, lookUnlocked(l))).join('')}
    </div>`;
}

function bestiaryBody(d: HallData): string {
  return `<p class="fine">Every foe you slay is counted. Milestones pay Souls, and the third earns a title.</p>
    <div class="codex">${BESTIARY_KINDS.map((k) => {
      const kills = d.bestiary[k] ?? 0;
      const tiers = bestiaryTiers(k);
      const done = tiers.filter((n) => kills >= n).length;
      const next = tiers[done];
      const from = done ? tiers[done - 1] : 0;
      const pct = next ? Math.round(((kills - from) / (next - from)) * 100) : 100;
      const seen = kills > 0;
      const img = beastIcon(k, seen);
      return `<div class="codex-item beast ${seen ? '' : 'unknown'}">
        <img src="${img}" alt="" width="48" height="48" />
        <span class="shop-info">
          <span class="name">${seen ? esc(ENEMY_INFO[k].name) : '???'} <span class="stars">${'★'.repeat(done)}${'☆'.repeat(tiers.length - done)}</span></span>
          <span class="desc">${kills.toLocaleString()} slain${next ? ` · next milestone ${next.toLocaleString()}` : ' · mastered'}${done > TITLE_TIER ? ` · title: ${esc(BESTIARY_TITLES[k]!)}` : ` · title at ${tiers[TITLE_TIER]}: ${esc(BESTIARY_TITLES[k]!)}`}</span>
          <span class="rank-track small"><span style="width:${pct}%"></span></span>
        </span>
      </div>`;
    }).join('')}</div>`;
}

const beastCache = new Map<string, string>();
function beastIcon(kind: EnemyKind, seen: boolean): string {
  const key = `${kind}:${seen}`;
  let url = beastCache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const s = sprites()[kind];
    ctx.drawImage(seen ? s.normal : silhouette(s.white, '#3a2a4a'), 0, 0, 48, 48);
    url = c.toDataURL();
    beastCache.set(key, url);
  }
  return url;
}

function hallLink(name: string): string {
  return `${siteUrl()}#hall=${encodeURIComponent(name)}`;
}

async function saveImage(d: HallData) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawHall(c.getContext('2d')!, d, 0.4);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) return toast('Could not save the image');
  const file = new File([blob], 'one-more-crypt-hall.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `My Crypt Hall in One More Crypt ${hallLink(d.name)}` });
      return;
    } catch {
      // cancelled, or sharing failed: fall back to a download
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Your own Hall, with tabs to wear titles and looks. */
export function showHall(name: string, back: () => void, tab: HallTab = 'trophies', changed?: () => void) {
  const d = hallData(name, meta);
  const tabs: [HallTab, string][] = [
    ['trophies', 'Trophies'],
    ['titles', 'Titles'],
    ['looks', 'Looks'],
    ['bestiary', 'Bestiary'],
  ];
  const body = tab === 'titles' ? titlesBody() : tab === 'looks' ? looksBody() : tab === 'bestiary' ? bestiaryBody(d) : trophiesBody(d);
  showOverlay('hall', `
    <h2>The Crypt Hall</h2>
    <canvas id="hall-canvas" class="hall-canvas" width="${W}" height="${H}" aria-label="Your trophy room"></canvas>
    ${rankBar(d.earned)}
    <div class="tabs" role="tablist">${tabs.map(([t, label]) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div>
    ${body}
    <div class="row">
      <button class="btn" id="hall-image">🖼️ Save image</button>
      ${ONLINE && name ? '<button class="btn" id="hall-link">🔗 Copy Hall link</button>' : ''}
    </div>
    <button class="btn primary" id="back">Back</button>`);
  startCanvas(d);
  const again = (t: HallTab) => {
    const top = overlay.scrollTop;
    showHall(name, back, t, changed);
    overlay.scrollTop = top;
  };
  overlay.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.addEventListener('click', () => showHall(name, back, b.dataset.tab as HallTab, changed)));
  overlay.querySelectorAll<HTMLButtonElement>('[data-title]').forEach((b) =>
    b.addEventListener('click', () => {
      equipTitle(b.dataset.title ?? '');
      sfx.relic();
      changed?.();
      again('titles');
    }),
  );
  overlay.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((b) =>
    b.addEventListener('click', () => {
      equipLook(b.dataset.look ?? '');
      sfx.relic();
      changed?.();
      again('looks');
    }),
  );
  on('#hall-image', () => void saveImage(d));
  on('#hall-link', async () => toast((await copyText(hallLink(name))) ? 'Link copied! Show off your Hall.' : 'Copy failed'));
  on('#back', back);
}

/** Someone else's Hall, from the leaderboard or a shared link. */
export function showPublicHall(name: string, back: () => void, tab: 'trophies' | 'bestiary' = 'trophies', loaded?: HallData) {
  if (!loaded) {
    showOverlay('hall-public', `<h2>The Crypt Hall</h2><p class="sub">Opening ${esc(name)}'s Hall…</p><button class="btn primary" id="back">Back</button>`);
    on('#back', back);
    if (!ONLINE) return;
    void loadHall(name)
      .then((row) => {
        if (screen !== 'hall-public') return;
        if (!row) {
          showOverlay('hall-public', `<h2>The Crypt Hall</h2><p class="sub">No Hall stands under the name ${esc(name)}.</p><button class="btn primary" id="back">Back</button>`);
          on('#back', back);
          return;
        }
        showPublicHall(row.name, back, tab, hallData(row.name, row.meta));
      })
      .catch((e) => {
        const sub = overlay.querySelector('.sub');
        if (sub) sub.textContent = (e as Error).message;
      });
    return;
  }
  const d = loaded;
  const tabs: [typeof tab, string][] = [
    ['trophies', 'Trophies'],
    ['bestiary', 'Bestiary'],
  ];
  showOverlay('hall-public', `
    <h2>${esc(d.name)}'s Hall</h2>
    <canvas id="hall-canvas" class="hall-canvas" width="${W}" height="${H}" aria-label="${esc(d.name)}'s trophy room"></canvas>
    ${rankBar(d.earned)}
    <div class="tabs" role="tablist">${tabs.map(([t, label]) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div>
    ${tab === 'bestiary' ? bestiaryBody(d) : trophiesBody(d)}
    <button class="btn" id="hall-image">🖼️ Save image</button>
    <button class="btn primary" id="back">Back</button>`);
  startCanvas(d);
  overlay.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) =>
    b.addEventListener('click', () => showPublicHall(d.name, back, b.dataset.tab as typeof tab, d)),
  );
  on('#hall-image', () => void saveImage(d));
  on('#back', back);
}

/** A Hall named in the page's link (#hall=NAME), if any. Clears it so a reload starts normally. */
export function hallFromLink(): string | null {
  const m = /^#hall=([^&]+)/.exec(location.hash);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    return decodeURIComponent(m[1]).slice(0, 32);
  } catch {
    return null;
  }
}
