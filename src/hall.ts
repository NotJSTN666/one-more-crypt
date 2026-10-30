// The Crypt Hall: a trophy room for everything a player has done. Boss trophies on
// the wall, a statue of each hero's deepest run, banners for achievements and combos, and
// tabs to wear titles and looks and to read the Bestiary. Anyone can visit another
// player's Hall from the leaderboard or a shared link.

import { drawAura } from './aura';
import { cleanIsle, type IsleState } from './isle';
import { sfx } from './audio';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, COMBOS, HEROES, HERO_BY_ID, type HeroId } from './content';
import { ENEMY_INFO, type EnemyKind } from './game';
import { dailyNumber } from './daily';
import { ACT1_QUESTS } from './story';
import { heroSprite } from './hero';
import { equipTitle, meta, titleUnlocked, type Meta } from './meta';
import { showWardrobe } from './wardrobe';
import { ONLINE, loadHall } from './online';
import {
  AURA_BY_ID, RAID_DECOR, BESTIARY_KINDS, BESTIARY_TITLES, DECOR_BY_ID, TITLE_FX, titleFxClass, HEAD_BY_ID, LOOK_BY_ID, TITLES, TITLE_BY_ID, TITLE_TIER, bestiaryTiers, rankFor, rankProgress,
  type BestRun, type BestRuns, type TitleFx,
} from './progression';
import { RELICS, RELIC_BY_ID, type RelicId } from './relics';
import { copyText, siteUrl } from './share';
import { sprites } from './sprites';
import { esc, on, overlay, screen, showOverlay, toast } from './ui';

/** What a Hall shows: your own progress, or a cleaned-up copy of someone else's. */
export interface HallData {
  name: string;
  /** The aura each hero radiates, from the Wardrobe. */
  auras: Partial<Record<HeroId, string>>;
  /** Their isle, to visit. */
  isle: IsleState;
  title: string;
  earned: number;
  feats: number;
  combos: number;
  relics: number;
  bestiary: Partial<Record<EnemyKind, number>>;
  /** Bosses slain before the Bestiary existed still count as trophies. */
  bossFeats: Partial<Record<EnemyKind, boolean>>;
  best: BestRuns;
  /** Daily podium finishes: how many 1st, 2nd and 3rd places. */
  podiums: [number, number, number];
  /** Decorations bought in the Ossuary. */
  decor: string[];
  /** Weekly Endless top 3 finishes: how many 1st, 2nd and 3rd places. */
  weekly: [number, number, number];
  /** Daily play streak: days in a row right now (0 once broken) and the longest ever. */
  streak: { current: number; best: number };
  /** World bosses felled in The Bell Tolls. */
  raids: number;
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
      head: typeof run.head === 'string' && HEAD_BY_ID[run.head] ? run.head : '',
      at: num(run.at, 1e13),
    };
  }
  const places = Object.values(obj(raw.podiums)).map((p) => num(p, 9));
  const podiums: [number, number, number] = [1, 2, 3].map((p) => places.filter((x) => x === p).length) as [number, number, number];
  const decor = (Array.isArray(raw.bought) ? raw.bought : []).filter((id): id is string => typeof id === 'string' && Boolean(DECOR_BY_ID[id]));
  // The Great Bell hangs in the Hall of anyone who finished every quest of Act I.
  const storyDone = Array.isArray(obj(raw.story).done) ? (obj(raw.story).done as unknown[]).map(Number) : [];
  if (ACT1_QUESTS.every((q) => storyDone.includes(q.n))) decor.push('greatbell');
  // The Bell Tolls: a piece for every so many world bosses felled.
  const raidWon = obj(raw.raid).won;
  const raids = Array.isArray(raidWon) ? new Set(raidWon.map(String)).size : 0;
  for (const d of RAID_DECOR) if (raw.vault === true || raids >= d.raid) decor.push(d.id);
  const weekPlaces = Object.values(obj(raw.weekly)).map((p) => num(p, 9));
  const weekly: [number, number, number] = [1, 2, 3].map((p) => weekPlaces.filter((x) => x === p).length) as [number, number, number];
  const st = obj(raw.streak);
  const today = dailyNumber();
  const count = num(st.count, 10000);
  const streak = { current: num(st.last, 1e6) >= today - 1 ? count : 0, best: Math.max(num(st.best, 10000), count) };
  return {
    name,
    isle: cleanIsle(raw.isle),
    auras: Object.fromEntries(
      Object.entries(obj(raw.outfits))
        .map(([h, o]) => [h, String(obj(o).aura ?? '')])
        .filter(([h, a]) => HERO_BY_ID[h as HeroId] && AURA_BY_ID[a]),
    ) as Partial<Record<HeroId, string>>,
    podiums,
    weekly,
    decor,
    raids,
    streak,
    title: typeof raw.title === 'string' && TITLE_BY_ID[raw.title] ? raw.title : '',
    earned: num(raw.earned),
    feats: Object.keys(achievements).filter((id) => ACHIEVEMENT_BY_ID[id]).length,
    combos: Object.keys(obj(raw.combos)).filter((id) => COMBOS.some((c) => c.id === id)).length,
    relics: Object.keys(obj(raw.codex)).filter((id) => RELICS.some((r) => r.id === id)).length,
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

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, font: string, color: string | CanvasGradient, glow = '') {
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
function fitText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, family: string, color: string | CanvasGradient, maxW: number, glow = '') {
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
  const w = 104;
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
  fitText(ctx, label, x, top + 140, 17, FONT_PIXEL, '#e8dcc4', w - 14);
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

function statue(ctx: CanvasRenderingContext2D, x: number, hero: HeroId, run: BestRun | undefined, deepest: boolean, t: number, aura = '', labelW = 122) {
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
  const sprite = run ? heroSprite(hero, run.relics, run.log as RelicId[], run.look, run.head ?? '') : heroSprite(hero, {}, []);
  const radiant = run ? aura : '';
  drawAura(ctx, radiant, x, base, 96, t, 'back');
  ctx.drawImage(run ? sprite.normal : silhouette(sprite.white, '#1a1424'), x - 48, base - 96, 96, 96);
  drawAura(ctx, radiant, x, base, 96, t, 'front');
  // drifting motes from the statue's look, unless an aura is on
  const motes = run && !radiant && LOOK_BY_ID[run.look]?.aura;
  if (motes) {
    ctx.fillStyle = motes;
    for (let i = 0; i < 5; i++) {
      const p = (t * 0.25 + i / 5) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
      ctx.fillRect(x - 40 + ((i * 37) % 80), base - 10 - p * 100, 6, 6);
    }
    ctx.globalAlpha = 1;
  }
  text(ctx, run ? `F${run.floor}` : '—', x, base + 36, `22px ${FONT_PIXEL}`, run ? (deepest ? '#f2c14e' : '#e8dcc4') : '#6b6680');
  fitText(ctx, HERO_BY_ID[hero].name.replace(/^The /, '').toUpperCase(), x, base + 82, 18, FONT_PIXEL, run ? '#9a8fa8' : '#4a4058', labelW);
}

// ---------- decorations (bought in the Ossuary) ----------

function skullPile(ctx: CanvasRenderingContext2D, x: number) {
  const skull = (sx: number, sy: number) => {
    ctx.fillStyle = '#d8cfb8';
    ctx.fillRect(sx, sy, 14, 10);
    ctx.fillRect(sx + 3, sy + 10, 8, 4);
    ctx.fillStyle = '#1a1520';
    ctx.fillRect(sx + 2, sy + 4, 4, 3);
    ctx.fillRect(sx + 8, sy + 4, 4, 3);
  };
  [[-23, 452], [-7, 452], [9, 452], [-15, 438], [1, 438], [-7, 424]].forEach(([dx, y]) => skull(x + dx, y));
}

function carpet(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#5a1622';
  ctx.fillRect(0, 478, W, 26);
  ctx.fillStyle = '#c99a2e';
  ctx.fillRect(0, 478, W, 3);
  ctx.fillRect(0, 501, W, 3);
  ctx.fillStyle = 'rgba(201,154,46,0.35)';
  for (let x = 12; x < W; x += 32) ctx.fillRect(x, 488, 8, 6);
}

function graveCat(ctx: CanvasRenderingContext2D, x: number, t: number) {
  const px = (dx: number, dy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + dx * 4, 466 - 48 + dy * 4, w * 4, h * 4);
  };
  const black = '#3a3048';
  px(1, 0, 1, 2, black); px(4, 0, 1, 2, black); // ears
  px(0, 2, 6, 4, black); // head
  px(0, 6, 7, 6, black); // body
  px(6, 9, 3, 2, black); // tail
  px(8, 7, 1, 3, black);
  const blink = Math.sin(t * 1.3) > 0.97;
  if (!blink) {
    px(1, 3, 1, 1, '#d4ff5a');
    px(4, 3, 1, 1, '#d4ff5a');
  }
}

/** The Great Bell, hung from a beam in the Hall of those who finished Act I. It tolls every few seconds. */
function greatBellHall(ctx: CanvasRenderingContext2D, x: number, t: number) {
  const PERIOD = 4;
  const p = (t % PERIOD) / PERIOD;
  const swing = Math.sin((t / PERIOD) * Math.PI * 2) * 0.12;
  // beam and rope
  ctx.fillStyle = '#4a3420';
  ctx.fillRect(x - 40, 354, 80, 8);
  ctx.fillStyle = '#2a1d12';
  ctx.fillRect(x - 40, 360, 80, 2);
  // a warm glow that swells on the stroke
  const glow = ctx.createRadialGradient(x, 410, 6, x, 410, 90 + Math.max(0, 0.25 - p) * 120);
  glow.addColorStop(0, `rgba(242,193,78,${0.18 + Math.max(0, 0.2 - p)})`);
  glow.addColorStop(1, 'rgba(242,193,78,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 130, 330, 260, 140);
  ctx.save();
  ctx.translate(x, 362);
  ctx.rotate(swing);
  ctx.fillStyle = '#5d4a2a';
  ctx.fillRect(-2, 0, 4, 12);
  const flash = p < 0.06;
  const body = flash ? '#fff2c0' : '#c9a24a';
  const shade = flash ? '#f2c14e' : '#8a6a2a';
  // bronze bell, built in pixel bands: crown, shoulders, waist, flared lip
  const bands: [number, number, number][] = [[12, 18, 6], [18, 26, 8], [26, 32, 10], [34, 36, 10], [44, 42, 6], [50, 50, 6]];
  for (const [y, wd, h] of bands) {
    ctx.fillStyle = shade;
    ctx.fillRect(-wd / 2, y, wd, h);
    ctx.fillStyle = body;
    ctx.fillRect(-wd / 2 + 4, y, wd - 8, h);
  }
  ctx.fillStyle = '#fff2c0';
  ctx.fillRect(-wd2(26) + 6, 20, 3, 18);
  // the clapper, a beat behind
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(-3 - swing * 30, 56, 6, 8);
  ctx.restore();
  // on the stroke, rings of sound spread out from its mouth
  if (p < 0.5) {
    const q = p / 0.5;
    ctx.strokeStyle = `rgba(242,193,78,${(1 - q) * 0.8})`;
    ctx.lineWidth = 3 * (1 - q) + 1;
    ctx.beginPath();
    ctx.ellipse(x, 418, 30 + q * 110, 10 + q * 36, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

const wd2 = (w: number) => w / 2;

function brazier(ctx: CanvasRenderingContext2D, x: number, t: number) {
  ctx.fillStyle = '#3a3346';
  ctx.fillRect(x - 4, 436, 8, 30);
  ctx.fillRect(x - 14, 462, 28, 4);
  ctx.fillStyle = '#5d667a';
  ctx.fillRect(x - 16, 426, 32, 12);
  const f = 1 + Math.sin(t * 11 + x) * 0.15;
  const glow = ctx.createRadialGradient(x, 410, 4, x, 410, 70 * f);
  glow.addColorStop(0, 'rgba(255,150,60,0.4)');
  glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 80, 340, 160, 130);
  ctx.fillStyle = '#ff8a2a';
  ctx.fillRect(x - 12, 426 - 18 * f, 24, 18 * f);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x - 6, 426 - 26 * f, 12, 26 * f);
}

function tomb(ctx: CanvasRenderingContext2D, x: number, name: string, floor: number) {
  ctx.fillStyle = '#4a4058';
  ctx.beginPath();
  ctx.moveTo(x - 34, 466);
  ctx.lineTo(x - 34, 396);
  ctx.quadraticCurveTo(x, 366, x + 34, 396);
  ctx.lineTo(x + 34, 466);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a3346';
  ctx.fillRect(x - 34, 458, 68, 8);
  text(ctx, 'HERE LIES', x, 404, `9px ${FONT_PIXEL}`, '#9a8fa8');
  fitText(ctx, (name || 'NAMELESS').toUpperCase(), x, 424, 12, FONT_PIXEL, '#e8dcc4', 60);
  if (floor) text(ctx, `FELL ON F${floor}`, x, 444, `9px ${FONT_PIXEL}`, '#c99a2e');
}

function throne(ctx: CanvasRenderingContext2D, x: number) {
  const bone = '#d8cfb8';
  const shade = '#a89f88';
  ctx.fillStyle = shade;
  ctx.fillRect(x - 30, 380, 60, 56); // back
  ctx.fillStyle = bone;
  ctx.fillRect(x - 26, 384, 52, 48);
  ctx.fillStyle = '#5a1622';
  ctx.fillRect(x - 18, 392, 36, 40); // cushion
  ctx.fillStyle = bone;
  ctx.fillRect(x - 40, 430, 80, 10); // seat
  ctx.fillRect(x - 40, 410, 10, 30); // arms
  ctx.fillRect(x + 30, 410, 10, 30);
  ctx.fillRect(x - 36, 440, 8, 26); // legs
  ctx.fillRect(x + 28, 440, 8, 26);
  // skull finials
  for (const sx of [x - 34, x + 26, x - 6]) {
    const sy = sx === x - 6 ? 366 : 372;
    ctx.fillStyle = bone;
    ctx.fillRect(sx, sy, 12, 10);
    ctx.fillStyle = '#1a1520';
    ctx.fillRect(sx + 2, sy + 4, 3, 3);
    ctx.fillRect(sx + 7, sy + 4, 3, 3);
  }
}

// ---------- the Hallowed Season ----------

function cobwebs(ctx: CanvasRenderingContext2D, t: number) {
  ctx.strokeStyle = 'rgba(220,220,235,0.45)';
  ctx.lineWidth = 2;
  for (const side of [1, -1]) {
    const cx = side > 0 ? 0 : W;
    const cy = 152;
    // spokes out from the corner, and rings strung between them
    const spokes = [0, 0.3, 0.6, 0.9, 1.2, 1.5708].map((a) => [Math.cos(a) * side, Math.sin(a)]);
    for (const [dx, dy] of spokes) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * 130, cy + dy * 130);
      ctx.stroke();
    }
    for (const r of [34, 64, 96, 124]) {
      ctx.beginPath();
      spokes.forEach(([dx, dy], i) => {
        const sag = i ? 4 : 0;
        if (i) ctx.quadraticCurveTo(cx + (dx + spokes[i - 1][0]) * r * 0.5 - side * sag, cy + (dy + spokes[i - 1][1]) * r * 0.5 - sag, cx + dx * r, cy + dy * r);
        else ctx.moveTo(cx + dx * r, cy + dy * r);
      });
      ctx.stroke();
    }
  }
  // a spider lets itself down on a thread, now and then
  const drop = 40 + Math.max(0, Math.sin(t * 0.6)) * 110;
  const sx = W - 70;
  ctx.fillStyle = 'rgba(220,220,235,0.5)';
  ctx.fillRect(sx, 152, 1, drop);
  ctx.fillStyle = '#141119';
  ctx.fillRect(sx - 6, 152 + drop, 12, 10);
  ctx.fillRect(sx - 4, 152 + drop - 4, 8, 4);
  ctx.fillStyle = '#3a3048';
  for (const ly of [2, 5, 8]) {
    ctx.fillRect(sx - 12, 152 + drop + ly, 6, 2);
    ctx.fillRect(sx + 6, 152 + drop + ly, 6, 2);
  }
  ctx.fillStyle = '#ff4d5a';
  ctx.fillRect(sx - 3, 152 + drop + 2, 2, 2);
  ctx.fillRect(sx + 1, 152 + drop + 2, 2, 2);
}

function garland(ctx: CanvasRenderingContext2D, t: number) {
  const colors = ['#e67e22', '#5a2f8a', '#141119', '#8aff6a'];
  for (const [x0, x1] of [[130, 470], [490, 830]]) {
    const n = 9;
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const y = (x: number) => 156 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 22;
    ctx.moveTo(x0, y(x0));
    for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, y(x));
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) / n) * (x1 - x0);
      const sway = Math.sin(t * 1.6 + i) * 2;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(x - 13, y(x));
      ctx.lineTo(x + 13, y(x));
      ctx.lineTo(x + sway, y(x) + 28);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function jackOLantern(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const flick = 0.75 + 0.25 * Math.sin(t * 9 + x) * Math.sin(t * 4.3 + x * 2);
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 60 * s);
  glow.addColorStop(0, `rgba(255,150,40,${0.35 * flick})`);
  glow.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 70 * s, y - 70 * s, 140 * s, 140 * s);
  const p = (dx: number, dy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + dx * s, y + dy * s, w * s, h * s);
  };
  p(-18, -14, 36, 28, '#e67e22');
  p(-22, -10, 44, 20, '#e67e22');
  p(-6, -14, 4, 28, '#c4601a');
  p(4, -14, 4, 28, '#c4601a');
  p(-3, -22, 6, 8, '#3d6b2a');
  ctx.globalAlpha = flick;
  p(-13, -6, 7, 6, '#ffd23f');
  p(6, -6, 7, 6, '#ffd23f');
  p(-14, 4, 28, 5, '#ffd23f');
  ctx.globalAlpha = 1;
  p(-8, 4, 4, 3, '#c4601a');
  p(4, 4, 4, 3, '#c4601a');
}

// ---------- the Harvest Feast ----------

const LEAVES = ['#e67e22', '#c0392b', '#ffd23f', '#a8581f'];

/** Leaves strung on twine along the top of the wall, stirring. */
function leafGarland(ctx: CanvasRenderingContext2D, t: number) {
  for (const [x0, x1] of [[130, 470], [490, 830]]) {
    const y = (x: number) => 158 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 20;
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y(x0));
    for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, y(x));
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const x = x0 + ((i + 0.5) / 14) * (x1 - x0);
      const tilt = Math.sin(t * 1.4 + i * 1.3) * 2;
      const c = LEAVES[i % LEAVES.length];
      // a pointed leaf hanging from the twine, with a darker vein
      ctx.fillStyle = c;
      ctx.fillRect(x - 6 + tilt, y(x) + 2, 12, 10);
      ctx.fillRect(x - 3 + tilt, y(x) + 12, 6, 6);
      ctx.fillRect(x - 9 + tilt, y(x) + 4, 3, 5);
      ctx.fillRect(x + 6 + tilt, y(x) + 4, 3, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 1 + tilt, y(x) + 2, 2, 14);
    }
  }
}

/** A hay bale by the wall with squash and gourds piled on and around it. */
function hayBale(ctx: CanvasRenderingContext2D, x: number) {
  ctx.fillStyle = '#c4a046';
  ctx.fillRect(x - 46, 424, 92, 42);
  ctx.fillStyle = '#d9b85a';
  ctx.fillRect(x - 46, 424, 92, 6);
  ctx.fillStyle = '#a8862e';
  for (let i = 0; i < 8; i++) ctx.fillRect(x - 42 + i * 11, 432 + (i % 3) * 9, 6, 2);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 24, 424, 3, 42);
  ctx.fillRect(x + 21, 424, 3, 42);
  const gourd = (gx: number, gy: number, w: number, h: number, c: string, stem = '#3d6b2a') => {
    ctx.fillStyle = c;
    ctx.fillRect(gx - w / 2, gy - h, w, h);
    ctx.fillRect(gx - w / 2 + 2, gy - h - 2, w - 4, h + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(gx - 1, gy - h, 2, h);
    ctx.fillStyle = stem;
    ctx.fillRect(gx - 2, gy - h - 6, 4, 5);
  };
  gourd(x - 22, 424, 26, 18, '#e67e22');
  gourd(x + 12, 424, 18, 14, '#e8c25a');
  gourd(x + 30, 424, 14, 22, '#5f8a3a');
  gourd(x + 58, 466, 24, 16, '#d35400');
  gourd(x - 60, 466, 16, 12, '#f2e2b0', '#6b4a2a');
}

/** The harvest table: a long cloth-covered board with a roast, a pie and two candles. */
function harvestTable(ctx: CanvasRenderingContext2D, x: number, t: number) {
  // legs and top
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(x - 70, 432, 8, 34);
  ctx.fillRect(x + 62, 432, 8, 34);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 78, 424, 156, 10);
  ctx.fillStyle = '#e8dcc4';
  ctx.fillRect(x - 74, 422, 148, 6);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(x - 30, 422, 60, 14);
  // the roast on its platter
  ctx.fillStyle = '#c9c3b2';
  ctx.fillRect(x - 26, 418, 52, 5);
  ctx.fillStyle = '#a8581f';
  ctx.fillRect(x - 18, 402, 36, 16);
  ctx.fillRect(x - 14, 398, 28, 4);
  ctx.fillStyle = '#c0702a';
  ctx.fillRect(x - 14, 402, 12, 6);
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(x - 24, 400, 6, 4);
  ctx.fillRect(x + 18, 400, 6, 4);
  // a pie, with lattice
  ctx.fillStyle = '#c4a046';
  ctx.fillRect(x + 32, 412, 28, 10);
  ctx.fillStyle = '#8a3b12';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 35 + i * 8, 412, 3, 10);
  // candles, flickering
  for (const cxp of [x - 56, x - 42]) {
    ctx.fillStyle = '#e8dcc4';
    ctx.fillRect(cxp - 3, 398, 6, 24);
    const f = Math.sin(t * 9 + cxp) > 0 ? 1 : 0;
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(cxp - 2, 390 - f, 4, 7 + f);
    const g = ctx.createRadialGradient(cxp, 392, 2, cxp, 392, 34);
    g.addColorStop(0, 'rgba(255,200,90,0.3)');
    g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cxp - 34, 358, 68, 68);
  }
}

/** A bundle of wheat tied at the waist with twine, leaning one way or the other. */
function wheatSheaf(ctx: CanvasRenderingContext2D, x: number, lean: number) {
  for (let i = 0; i < 9; i++) {
    const sx = x - 8 + i * 2;
    const top = 404 + Math.abs(i - 4) * 2;
    ctx.fillStyle = i % 2 ? '#c9a24a' : '#b08a34';
    ctx.fillRect(sx + lean * Math.round((466 - top) / 30), top, 2, 466 - top);
    ctx.fillStyle = '#e8c25a';
    ctx.fillRect(sx + lean * 2 - 1, top - 6, 3, 7);
  }
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 10 + lean, 436, 20, 3);
}

/** A barrel of apples, one rolled loose on the floor. */
function appleBarrel(ctx: CanvasRenderingContext2D, x: number) {
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 22, 430, 44, 36);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 24, 434, 48, 28);
  ctx.fillStyle = '#3a3346';
  ctx.fillRect(x - 24, 438, 48, 3);
  ctx.fillRect(x - 24, 455, 48, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (const dx of [-12, 0, 12]) ctx.fillRect(x + dx, 434, 1, 28);
  const apple = (ax: number, ay: number) => {
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(ax - 4, ay - 3, 8, 7);
    ctx.fillRect(ax - 3, ay - 4, 6, 9);
    ctx.fillStyle = '#e8605a';
    ctx.fillRect(ax - 2, ay - 2, 2, 2);
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(ax, ay - 6, 1, 2);
  };
  for (const [dx, dy] of [[-14, 428], [-4, 426], [6, 427], [15, 429], [-9, 422], [2, 421], [11, 423]]) apple(x + dx, dy);
  apple(x + 34, 462);
}

/** A horn of plenty spilling corn, grapes and gourds onto the floor. */
function cornucopia(ctx: CanvasRenderingContext2D, x: number) {
  // the woven horn, curling up to a point on the right
  const horn: [number, number, number][] = [[-30, 440, 22], [-12, 442, 18], [4, 446, 14], [16, 450, 9], [24, 452, 5]];
  horn.forEach(([dx, y, h], i) => {
    ctx.fillStyle = i % 2 ? '#a8743a' : '#c4a046';
    ctx.fillRect(x + dx, y, 18, h);
    ctx.fillStyle = '#8a5a28';
    ctx.fillRect(x + dx, y + Math.floor(h / 2), 18, 2);
  });
  ctx.fillStyle = '#c4a046';
  ctx.fillRect(x + 36, 446, 4, 6);
  ctx.fillRect(x + 38, 440, 3, 6);
  // what spills out of the mouth
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x - 48, 448, 16, 7);
  ctx.fillStyle = '#5f8a3a';
  ctx.fillRect(x - 34, 446, 6, 4);
  ctx.fillStyle = '#6a3a8a';
  for (const [dx, dy] of [[-44, 456], [-40, 460], [-36, 456], [-40, 452]]) ctx.fillRect(x + dx, dy, 4, 4);
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(x - 58, 452, 12, 13);
  ctx.fillRect(x - 56, 450, 8, 17);
  ctx.fillStyle = '#3d5a2a';
  ctx.fillRect(x - 53, 446, 2, 4);
}

// ---------- Midwinter ----------

/** Icicles hanging from the top of the wall, catching the light; one drips now and then. */
function icicles(ctx: CanvasRenderingContext2D, t: number) {
  for (let x = 128; x < 836; x += 13) {
    const len = 8 + ((x * 7) % 17);
    ctx.fillStyle = '#c9e6f6';
    ctx.fillRect(x, 152, 6, Math.round(len * 0.5));
    ctx.fillRect(x + 1, 152, 4, Math.round(len * 0.8));
    ctx.fillRect(x + 2, 152, 2, len);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 1, 153, 1, Math.round(len * 0.6));
    // a drop forming and falling, each icicle in its own time
    const p = (t * 0.35 + ((x * 13) % 29) / 29) % 1;
    if (p > 0.7) {
      const fall = (p - 0.7) / 0.3;
      ctx.globalAlpha = 1 - fall;
      ctx.fillStyle = '#e8fbff';
      ctx.fillRect(x + 2, 152 + len + fall * 70, 2, 3);
      ctx.globalAlpha = 1;
    }
  }
}

/** A gingerbread house: brown walls, a roof iced white, sweets on top and a lit window. */
function gingerbreadHouse(ctx: CanvasRenderingContext2D, x: number, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 32, 463, 64, 4);
  ctx.fillStyle = '#a8602a';
  ctx.fillRect(x - 26, 432, 52, 34);
  // the roof in stepped rows, iced along its edge
  for (let i = 0; i < 6; i++) {
    const w = 64 - i * 10;
    ctx.fillStyle = i % 2 ? '#8a4a1e' : '#9a5424';
    ctx.fillRect(x - w / 2, 428 - i * 5, w, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w / 2, 432 - i * 5, 4, 2);
    ctx.fillRect(x + w / 2 - 4, 432 - i * 5, 4, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 32, 430, 64, 3);
  for (let i = 0; i < 6; i++) ctx.fillRect(x - 30 + i * 11, 433, 4, 3 + (i % 2) * 2);
  // sweets on the roof
  const sweets = ['#d23a46', '#5fd36a', '#ffd23f', '#5fe3ff'];
  sweets.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x - 18 + i * 10, 414 - (i % 2) * 6, 4, 4);
  });
  // a door and a lit window
  ctx.fillStyle = '#5a2e12';
  ctx.fillRect(x - 6, 448, 12, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 6, 446, 12, 2);
  const glow = 0.8 + 0.2 * Math.sin(t * 2.3);
  ctx.fillStyle = `rgba(255, 210, 63, ${glow})`;
  ctx.fillRect(x + 12, 440, 8, 8);
  ctx.fillRect(x - 20, 440, 8, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 15, 440, 2, 8);
  ctx.fillRect(x - 17, 440, 2, 8);
  ctx.fillStyle = '#d23a46';
  for (let i = 0; i < 6; i++) ctx.fillRect(x - 24 + i * 9, 462, 4, 4);
}

const BULB_COLORS = ['#ff4d5a', '#ffd23f', '#5fd36a', '#5fe3ff', '#b07cff'];

/** Coloured lights along the top of the wall, lighting up in turn. */
function stringLights(ctx: CanvasRenderingContext2D, t: number) {
  for (const [x0, x1] of [[130, 470], [490, 830]]) {
    const y = (x: number) => 156 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 26;
    ctx.strokeStyle = '#1f3a24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y(x0));
    for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, y(x));
    ctx.stroke();
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) / n) * (x1 - x0);
      const c = BULB_COLORS[i % BULB_COLORS.length];
      const on = Math.sin(t * 2.2 - i * 0.9) > -0.2;
      if (on) {
        const g = ctx.createRadialGradient(x, y(x) + 8, 1, x, y(x) + 8, 16);
        g.addColorStop(0, c + '88');
        g.addColorStop(1, c + '00');
        ctx.fillStyle = g;
        ctx.fillRect(x - 16, y(x) - 8, 32, 32);
      }
      ctx.fillStyle = '#3a3346';
      ctx.fillRect(x - 2, y(x), 4, 3);
      ctx.fillStyle = on ? c : '#4a4458';
      ctx.fillRect(x - 3, y(x) + 3, 6, 9);
    }
  }
}

/** A holly wreath with a red bow, hung on a trophy frame. */
function wreath(ctx: CanvasRenderingContext2D, x: number, y: number) {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? '#1f6b3a' : '#2e8a4c';
    ctx.fillRect(x + Math.cos(a) * 18 - 5, y + Math.sin(a) * 18 - 5, 10, 10);
  }
  ctx.fillStyle = '#d23a46';
  for (const a of [0.6, 2.2, 3.6, 5.0]) ctx.fillRect(x + Math.cos(a) * 18 - 2, y + Math.sin(a) * 18 - 2, 4, 4);
  // the bow at the bottom, its tails hanging
  ctx.fillStyle = '#d23a46';
  ctx.fillRect(x - 12, y + 14, 9, 8);
  ctx.fillRect(x + 3, y + 14, 9, 8);
  ctx.fillStyle = '#a5293a';
  ctx.fillRect(x - 3, y + 15, 6, 6);
  ctx.fillRect(x - 6, y + 22, 4, 10);
  ctx.fillRect(x + 2, y + 22, 4, 10);
}

/** Stockings hung from a line on the wall, swaying a little; one is full to bursting. */
function stockings(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(612, 376, 196, 4);
  const colors: [string, string][] = [['#d23a46', '#ffffff'], ['#2e8a4c', '#ffffff'], ['#5a3a9a', '#f2c14e'], ['#d23a46', '#ffffff']];
  colors.forEach(([body, cuff], i) => {
    const x = 632 + i * 46;
    const sway = Math.round(Math.sin(t * 1.3 + i) * 1.5);
    ctx.fillStyle = cuff;
    ctx.fillRect(x - 10 + sway, 380, 20, 8);
    ctx.fillStyle = body;
    ctx.fillRect(x - 8 + sway, 388, 16, 26);
    ctx.fillRect(x - 8 + sway, 408, 24, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - 8 + sway, 398, 16, 2);
    // the full one: a candy cane and a present poking out
    if (i === 2) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 6 + sway, 368, 3, 14);
      ctx.fillRect(x - 6 + sway, 366, 8, 3);
      ctx.fillStyle = '#d23a46';
      ctx.fillRect(x - 6 + sway, 372, 3, 2);
      ctx.fillRect(x - 6 + sway, 377, 3, 2);
      ctx.fillStyle = '#5fe3ff';
      ctx.fillRect(x + 1 + sway, 370, 9, 10);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x + 4 + sway, 370, 2, 10);
    }
  });
}

/** A tall tree hung with lights that twinkle in turn, a gold star on top. */
function midwinterTree(ctx: CanvasRenderingContext2D, x: number, t: number) {
  const glow = ctx.createRadialGradient(x, 410, 10, x, 410, 110);
  glow.addColorStop(0, 'rgba(255,210,120,0.18)');
  glow.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 110, 300, 220, 170);
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 6, 450, 12, 16);
  // three tiers of branches, widest at the bottom
  const tiers: [number, number, number][] = [[352, 386, 26], [378, 418, 38], [408, 452, 50]];
  for (const [top, bottom, half] of tiers) {
    for (let y = top; y < bottom; y += 4) {
      const w = Math.round(((y - top) / (bottom - top)) * half) + 4;
      ctx.fillStyle = (y / 4) % 2 ? '#1f6b3a' : '#24784a';
      ctx.fillRect(x - w, y, w * 2, 4);
    }
    ctx.fillStyle = '#16502c';
    ctx.fillRect(x - half - 4, bottom - 4, (half + 4) * 2, 4);
  }
  // lights
  const lights: [number, number][] = [[-10, 372], [12, 380], [-24, 400], [6, 404], [26, 410], [-34, 430], [-10, 436], [16, 440], [38, 444], [-44, 448]];
  lights.forEach(([dx, y], i) => {
    const c = BULB_COLORS[i % BULB_COLORS.length];
    const on = Math.sin(t * 2.6 + i * 1.7) > -0.1;
    ctx.fillStyle = on ? c : '#3a3346';
    ctx.fillRect(x + dx - 2, y - 2, 5, 5);
    if (on) {
      ctx.fillStyle = c + '55';
      ctx.fillRect(x + dx - 5, y - 5, 11, 11);
    }
  });
  // the star, pulsing
  const p = 0.7 + 0.3 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255,242,192,${0.35 * p})`;
  ctx.fillRect(x - 12, 332, 24, 24);
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(x - 3, 336, 6, 16);
  ctx.fillRect(x - 8, 341, 16, 6);
  ctx.fillStyle = '#fff2c0';
  ctx.fillRect(x - 2, 341, 4, 6);
}

/** Wrapped presents stacked by the wall, either side of where the tree stands. */
function presents(ctx: CanvasRenderingContext2D) {
  const box = (x: number, w: number, h: number, c: string, ribbon: string, base = 466) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, base - h, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, base - h, w, 3);
    ctx.fillStyle = ribbon;
    ctx.fillRect(x + w / 2 - 2, base - h, 4, h);
    ctx.fillRect(x, base - h / 2 - 2, w, 4);
    ctx.fillRect(x + w / 2 - 8, base - h - 5, 6, 5);
    ctx.fillRect(x + w / 2 + 2, base - h - 5, 6, 5);
  };
  box(268, 30, 24, '#d23a46', '#f2c14e');
  box(296, 22, 30, '#2e8a4c', '#ffffff');
  box(274, 18, 16, '#5fe3ff', '#d23a46', 442);
  box(374, 26, 20, '#5a3a9a', '#f2c14e');
  box(398, 30, 28, '#f2c14e', '#d23a46');
}

/** A snowman by the wall: three balls of snow, coal eyes, a carrot nose and a scarf that flutters. */
function snowman(ctx: CanvasRenderingContext2D, x: number, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 30, 462, 60, 5);
  const ball = (cy: number, r: number) => {
    ctx.fillStyle = '#e8eef6';
    ctx.fillRect(x - r, cy - r + 4, r * 2, r * 2 - 8);
    ctx.fillRect(x - r + 4, cy - r, r * 2 - 8, r * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - r + 6, cy - r + 2, r - 4, 4);
    ctx.fillStyle = '#c9d4e2';
    ctx.fillRect(x - r + 4, cy + r - 6, r * 2 - 8, 4);
  };
  ball(446, 20);
  ball(414, 14);
  ball(390, 10);
  // coal buttons, eyes and smile; the carrot nose
  ctx.fillStyle = '#141119';
  for (const by of [408, 418, 440, 450]) ctx.fillRect(x - 2, by, 4, 4);
  ctx.fillRect(x - 5, 386, 3, 3);
  ctx.fillRect(x + 2, 386, 3, 3);
  for (const dx of [-5, -2, 1]) ctx.fillRect(x + dx, 395, 2, 2);
  ctx.fillStyle = '#ff8a2a';
  ctx.fillRect(x, 390, 9, 3);
  // a scarf, its tail fluttering, and a black hat
  ctx.fillStyle = '#d23a46';
  ctx.fillRect(x - 12, 399, 24, 5);
  ctx.fillRect(x + 5, 403, 6, 11 + Math.round(Math.sin(t * 2) * 2));
  ctx.fillStyle = '#141119';
  ctx.fillRect(x - 12, 378, 24, 4);
  ctx.fillRect(x - 7, 364, 14, 14);
  ctx.fillStyle = '#d23a46';
  ctx.fillRect(x - 7, 374, 14, 3);
  // twig arms
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 30, 410, 16, 3);
  ctx.fillRect(x - 32, 404, 3, 6);
  ctx.fillRect(x + 14, 408, 16, 3);
  ctx.fillRect(x + 28, 402, 3, 6);
}

/** Snow drifting down through the whole Hall. */
function hallSnow(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 46; i++) {
    const speed = 22 + (i % 5) * 7;
    const y = ((t * speed + i * 97) % (H + 20)) - 10;
    const x = ((i * 211) % W) + Math.sin(t * 0.9 + i) * 14;
    const s = i % 4 === 0 ? 4 : 3;
    ctx.globalAlpha = 0.45 + (i % 3) * 0.15;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }
  ctx.globalAlpha = 1;
}

function bats(ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 5; i++) {
    const speed = 60 + i * 17;
    const x = ((t * speed + i * 230) % (W + 120)) - 60;
    const y = 190 + i * 28 + Math.sin(t * 2 + i * 1.7) * 18;
    const flap = Math.sin(t * 16 + i) > 0;
    ctx.fillStyle = '#141119';
    ctx.fillRect(x - 4, y - 3, 8, 7);
    ctx.fillRect(x - 3, y - 6, 2, 3);
    ctx.fillRect(x + 1, y - 6, 2, 3);
    if (flap) {
      ctx.fillRect(x - 16, y - 8, 12, 4);
      ctx.fillRect(x + 4, y - 8, 12, 4);
      ctx.fillRect(x - 12, y - 4, 8, 3);
      ctx.fillRect(x + 4, y - 4, 8, 3);
    } else {
      ctx.fillRect(x - 16, y + 1, 12, 4);
      ctx.fillRect(x + 4, y + 1, 12, 4);
    }
    ctx.fillStyle = '#ff4d5a';
    ctx.fillRect(x - 2, y - 1, 1, 1);
    ctx.fillRect(x + 1, y - 1, 1, 1);
  }
}

function cauldron(ctx: CanvasRenderingContext2D, x: number, t: number) {
  const glow = ctx.createRadialGradient(x, 420, 4, x, 420, 80);
  glow.addColorStop(0, 'rgba(138,255,106,0.3)');
  glow.addColorStop(1, 'rgba(138,255,106,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 90, 340, 180, 140);
  // fire beneath
  const f = Math.sin(t * 10 + x) > 0 ? 3 : 0;
  ctx.fillStyle = '#ff8a2a';
  ctx.fillRect(x - 22, 452 - f, 44, 12 + f);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x - 12, 456, 24, 8);
  // the pot
  ctx.fillStyle = '#2a2433';
  ctx.fillRect(x - 36, 412, 72, 40);
  ctx.fillRect(x - 30, 452, 60, 6);
  ctx.fillStyle = '#3a3346';
  ctx.fillRect(x - 40, 406, 80, 8);
  ctx.fillRect(x - 32, 458, 6, 8);
  ctx.fillRect(x + 26, 458, 6, 8);
  // the brew, bubbling
  ctx.fillStyle = '#5fd36a';
  ctx.fillRect(x - 34, 404, 68, 4);
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.8 + i / 4) % 1;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = i % 2 ? '#b5e07a' : '#8aff6a';
    const r = 3 + p * 4;
    ctx.fillRect(x - 24 + i * 15 + Math.sin(p * 6 + i) * 3, 400 - p * 46, r, r);
  }
  ctx.globalAlpha = 1;
}

function ghosts(ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 2; i++) {
    const speed = 34 + i * 12;
    const dir = i ? -1 : 1;
    const span = W + 160;
    const along = (t * speed + i * 400) % span;
    const x = dir > 0 ? along - 80 : W + 80 - along;
    const y = 300 + i * 120 + Math.sin(t * 1.4 + i * 2) * 14;
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2 + i);
    ctx.fillStyle = '#e8f0ff';
    ctx.beginPath();
    ctx.arc(x, y, 22, Math.PI, 0);
    ctx.lineTo(x + 22, y + 34);
    for (let k = 0; k < 4; k++) {
      const wx = x + 22 - (k + 1) * 11;
      ctx.lineTo(wx + 5.5, y + 28 + Math.sin(t * 6 + k) * 3);
      ctx.lineTo(wx, y + 34);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#141119';
    ctx.fillRect(x - 10 + dir * 3, y - 6, 6, 8);
    ctx.fillRect(x + 4 + dir * 3, y - 6, 6, 8);
    ctx.fillRect(x - 3 + dir * 3, y + 8, 6, 6);
    ctx.globalAlpha = 1;
  }
}

// ---------- The Bell Tolls pieces (one per so many world bosses felled) ----------

/** A narrow, tattered war banner on an iron bracket, stirring in a draught. */
function warBanners(ctx: CanvasRenderingContext2D, t: number) {
  for (const [x, cloth] of [[34, '#7a1622'], [926, '#2a3d6b']] as [number, string][]) {
    ctx.fillStyle = '#3a3346';
    ctx.fillRect(x - 20, 370, 40, 5);
    for (let r = 0; r < 12; r++) {
      const sway = Math.round(Math.sin(t * 1.6 - r * 0.45 + x) * 2);
      ctx.fillStyle = r % 4 === 1 ? '#c99a2e' : cloth;
      ctx.fillRect(x - 14 + sway, 375 + r * 6, 28, 6);
    }
    // ragged tail
    ctx.fillStyle = cloth;
    ctx.fillRect(x - 14, 447, 8, 6);
    ctx.fillRect(x + 6, 447, 8, 9);
    // a bell sigil
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x - 4, 394, 8, 3);
    ctx.fillRect(x - 6, 397, 12, 8);
    ctx.fillRect(x - 1, 405, 2, 3);
  }
}

/** Bronze shards of a broken bell, heaped at the foot of the wall; one glints at a time. */
function bellShardPile(ctx: CanvasRenderingContext2D, x: number, t: number) {
  const bits: [number, number, number, number][] = [[-26, 456, 14, 10], [-10, 452, 18, 14], [8, 455, 16, 11], [-18, 444, 12, 9], [0, 440, 14, 12], [18, 448, 10, 8]];
  const lit = Math.floor(t * 1.5) % bits.length;
  bits.forEach(([dx, y, w, h], i) => {
    ctx.fillStyle = '#5c4418';
    ctx.fillRect(x + dx, y, w, h);
    ctx.fillStyle = i === lit ? '#fff2c0' : '#c9a24a';
    ctx.fillRect(x + dx + 2, y, w - 6, 3);
  });
  const glow = ctx.createRadialGradient(x, 456, 2, x, 456, 44);
  glow.addColorStop(0, `rgba(242,193,78,${0.18 + 0.06 * Math.sin(t * 3)})`);
  glow.addColorStop(1, 'rgba(242,193,78,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 46, 412, 92, 60);
}

/** A great horned skull on a wooden plaque, its eyes still smouldering. */
function bossSkull(ctx: CanvasRenderingContext2D, x: number, t: number) {
  const px = (dx: number, dy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + dx * 4, 368 + dy * 4, w * 4, h * 4);
  };
  px(-6, 1, 12, 13, '#4a3420'); // plaque
  px(-5, 2, 10, 11, '#5d4a2a');
  px(-9, 2, 3, 1, '#d8cfb8'); px(-10, 0, 2, 2, '#d8cfb8'); px(-11, -2, 1, 2, '#e8dcc4'); // left horn
  px(6, 2, 3, 1, '#d8cfb8'); px(8, 0, 2, 2, '#d8cfb8'); px(10, -2, 1, 2, '#e8dcc4'); // right horn
  px(-4, 3, 8, 6, '#e8dcc4'); // cranium
  px(-3, 9, 6, 3, '#d8cfb8'); // jaw
  px(-2, 12, 1, 1, '#d8cfb8'); px(0, 12, 1, 1, '#d8cfb8'); px(2, 12, 1, 1, '#d8cfb8');
  const eye = `rgba(255,${Math.round(90 + 60 * Math.sin(t * 2.2))},60,1)`;
  px(-3, 5, 2, 2, eye);
  px(1, 5, 2, 2, eye);
  px(-1, 8, 2, 1, '#1a1520');
}

/** An iron wheel of candles hanging on a chain. */
function chandelier(ctx: CanvasRenderingContext2D, x: number, t: number) {
  ctx.fillStyle = '#3a3346';
  for (let y = 152; y < 176; y += 6) ctx.fillRect(x - 1, y, 3, 4);
  ctx.fillStyle = '#5d667a';
  ctx.fillRect(x - 34, 178, 68, 5);
  ctx.fillStyle = '#3a3346';
  ctx.fillRect(x - 34, 183, 68, 2);
  for (let i = 0; i < 5; i++) {
    const cx = x - 28 + i * 14;
    ctx.fillStyle = '#e8dcc4';
    ctx.fillRect(cx - 2, 168, 5, 10);
    const f = Math.sin(t * 9 + i * 1.3) > 0 ? 1 : 0;
    ctx.fillStyle = '#ff8a2a';
    ctx.fillRect(cx - 1, 161 - f, 3, 6);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(cx, 163 - f, 1, 3);
  }
  const glow = ctx.createRadialGradient(x, 172, 4, x, 172, 70);
  glow.addColorStop(0, 'rgba(255,179,90,0.22)');
  glow.addColorStop(1, 'rgba(255,179,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 72, 110, 144, 130);
}

/** The war horn on its stand; now and then a breath of sound rings from its mouth. */
function warHorn(ctx: CanvasRenderingContext2D, x: number, t: number) {
  ctx.fillStyle = '#4a3420';
  ctx.fillRect(x - 3, 420, 6, 46);
  ctx.fillRect(x - 16, 462, 32, 4);
  ctx.fillRect(x - 14, 418, 28, 4);
  // the horn: a curve of bone banded in gold, flaring to the right
  const segs: [number, number, number][] = [[-24, 404, 6], [-18, 400, 8], [-10, 398, 10], [0, 396, 12], [12, 393, 16], [24, 389, 22]];
  segs.forEach(([dx, y, h], i) => {
    ctx.fillStyle = i % 2 ? '#e8dcc4' : '#d8cfb8';
    ctx.fillRect(x + dx, y, 12, h);
    if (i === 2 || i === 4) {
      ctx.fillStyle = '#c99a2e';
      ctx.fillRect(x + dx, y, 3, h);
    }
  });
  ctx.fillStyle = '#1a1520';
  ctx.fillRect(x + 32, 392, 4, 16);
  const p = (t % 5) / 5;
  if (p < 0.4) {
    ctx.strokeStyle = `rgba(232,220,196,${(0.4 - p) * 1.6})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(x + 38, 400, 8 + p * 60 + i * 10, -0.6, 0.6);
      ctx.stroke();
    }
  }
}

/** A stone tablet carved with the count of world bosses felled. */
function rollOfHonor(ctx: CanvasRenderingContext2D, x: number, raids: number) {
  ctx.fillStyle = '#3a3346';
  ctx.fillRect(x - 26, 384, 52, 82);
  ctx.fillStyle = '#4a4458';
  ctx.fillRect(x - 22, 388, 44, 74);
  ctx.fillStyle = '#5a5466';
  ctx.fillRect(x - 26, 380, 52, 6);
  text(ctx, 'BOSSES', x, 402, `11px ${FONT_PIXEL}`, '#c9a24a');
  text(ctx, String(raids), x, 432, `24px ${FONT_PIXEL}`, '#fff2c0');
  text(ctx, 'FALLEN', x, 452, `11px ${FONT_PIXEL}`, '#c9a24a');
}

function drawDecor(ctx: CanvasRenderingContext2D, d: HallData, t: number, layer: 'wall' | 'floor' | 'air') {
  const has = (id: string) => d.decor.includes(id);
  if (layer === 'floor') {
    if (has('carpet')) carpet(ctx);
    if (has('jacks')) for (const x of [160, 416, 544, 800]) jackOLantern(ctx, x, 634, 0.75, t);
    return;
  }
  // Things that drift in front of everything.
  if (layer === 'air') {
    if (has('bats')) bats(ctx, t);
    if (has('ghosts')) ghosts(ctx, t);
    if (has('hallsnow')) hallSnow(ctx, t);
    return;
  }
  // The Harvest Feast and Midwinter, behind the Hallowed pieces.
  if (has('leafgarland')) leafGarland(ctx, t);
  if (has('stringlights')) stringLights(ctx, t);
  if (has('wreaths')) for (const x of [232, 480, 728]) wreath(ctx, x, 190);
  if (has('hay')) hayBale(ctx, 72);
  if (has('feast')) harvestTable(ctx, 500, t);
  if (has('sheaves')) {
    wheatSheaf(ctx, 222, -1);
    wheatSheaf(ctx, 248, 1);
  }
  if (has('applebarrel')) appleBarrel(ctx, 730);
  if (has('cornucopia')) cornucopia(ctx, 800);
  if (has('icicles')) icicles(ctx, t);
  if (has('gingerhouse')) gingerbreadHouse(ctx, 625, t);
  if (has('stockings')) stockings(ctx, t);
  if (has('xmastree')) midwinterTree(ctx, 342, t);
  if (has('presents')) presents(ctx);
  if (has('snowman')) snowman(ctx, 180, t);
  if (has('cobwebs')) cobwebs(ctx, t);
  if (has('garland')) garland(ctx, t);
  if (has('cauldron')) cauldron(ctx, 896, t);
  if (has('greatbell')) greatBellHall(ctx, 480, t);
  if (has('skulls')) {
    skullPile(ctx, 150);
    skullPile(ctx, 810);
  }
  if (has('cat')) graveCat(ctx, 238, t);
  if (has('braziers')) {
    brazier(ctx, 356, t);
    brazier(ctx, 604, t);
  }
  if (has('tomb')) tomb(ctx, 716, d.name, Math.max(0, ...Object.values(d.best).map((r) => r?.floor ?? 0)));
  if (has('throne')) throne(ctx, 480);
  if (has('raidbanners')) warBanners(ctx, t);
  if (has('bellshardpile')) bellShardPile(ctx, 552, t);
  if (has('bossskull')) bossSkull(ctx, 412, t);
  if (has('chandelier')) {
    chandelier(ctx, 356, t);
    chandelier(ctx, 604, t);
  }
  if (has('warhorn')) warHorn(ctx, 290, t);
  if (has('rollofhonor')) rollOfHonor(ctx, 656, d.raids);
}

/** How a title is painted on the Hall's banner: the hardest ones shimmer, glow or flow. */
function titleFill(ctx: CanvasRenderingContext2D, fx: TitleFx | undefined, t: number): { fill: string | CanvasGradient; glow: string } {
  // A gradient band that slides across the title line.
  const sweep = (stops: string[], speed: number) => {
    const shift = ((t * speed) % 1) * 600;
    const g = ctx.createLinearGradient(180 + shift - 600, 0, 780 + shift - 600, 0);
    const all = [...stops, ...stops];
    all.forEach((c, i) => g.addColorStop(i / (all.length - 1), c));
    return g;
  };
  const pulse = 0.45 + 0.25 * Math.sin(t * 2.4);
  switch (fx) {
    case 'prism':
      return { fill: sweep(['#ff4d5a', '#ff8a2a', '#ffd23f', '#5fd36a', '#5fe3ff', '#b07cff'], 0.25), glow: `hsla(${(t * 90) % 360}, 95%, 64%, 0.8)` };
    case 'gold':
      return { fill: sweep(['#a8781f', '#f2c14e', '#fff2c0', '#f2c14e'], 0.35), glow: `rgba(242,193,78,${pulse})` };
    case 'eternal':
      return { fill: sweep(['#f2c14e', '#ffffff', '#fff2c0', '#ffffff'], 0.2), glow: `rgba(255,242,192,${pulse + 0.2})` };
    case 'sovereign':
      return { fill: sweep(['#d23a46', '#f2c14e', '#ff4d5a', '#fff2c0'], 0.3), glow: `rgba(255,77,90,${pulse})` };
    case 'soul':
      return { fill: sweep(['#5fe3ff', '#e8fbff', '#9fe8ff'], 0.4), glow: `rgba(95,227,255,${pulse})` };
    case 'abyss':
      return { fill: sweep(['#7b5cff', '#d3b0ff', '#b07cff'], 0.25), glow: `rgba(176,124,255,${pulse})` };
    case 'arcane':
      return { fill: sweep(['#5fe3ff', '#b07cff', '#f2c14e'], 0.3), glow: `rgba(127,180,255,${pulse})` };
    case 'ember':
      return { fill: sweep(['#d23a46', '#ff8a2a', '#ffd23f', '#ff8a2a'], 0.5), glow: `rgba(255,138,42,${pulse})` };
    case 'steel':
      return { fill: sweep(['#9aa3b5', '#eef3fb', '#9aa3b5'], 0.3), glow: '' };
    default:
      return { fill: '#f2c14e', glow: '' };
  }
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
  if (title) {
    const fx = titleFill(ctx, TITLE_FX[d.title], t);
    fitText(ctx, `« ${title.toUpperCase()} »`, W / 2, 110, 20, FONT_PIXEL, fx.fill, 880, fx.glow);
  }
  text(ctx, `${rank.name.toUpperCase()} · ${d.earned.toLocaleString()} SOULS`, W / 2, title ? 138 : 120, `17px ${FONT_PIXEL}`, rank.color);
  if (d.streak.best > 1) {
    const { current, best } = d.streak;
    const line = current > 1 ? `${current}-DAY STREAK${best > current ? ` · BEST ${best}` : ''}` : `BEST STREAK ${best} DAYS`;
    fitText(ctx, line, W / 2, title ? 162 : 144, 15, FONT_PIXEL, current > 1 ? '#ff8a2a' : '#9a8fa8', 600);
  }

  // trophies, torches and banners
  banner(ctx, 66, d.feats, ACHIEVEMENTS.length, 'ACHIEVEMENTS', '#5a1622', '#c99a2e');
  banner(ctx, W - 66, d.combos, COMBOS.length, 'COMBOS', '#311854', '#c99a2e');
  torch(ctx, 360, 236, t);
  torch(ctx, 600, 236, t);
  BOSSES.forEach((k, i) => {
    const kills = d.bestiary[k] ?? 0;
    trophy(ctx, [232, 480, 728][i], k, kills, kills > 0 || Boolean(d.bossFeats[k]));
  });
  drawDecor(ctx, d, t, 'wall');
  drawDecor(ctx, d, t, 'floor');

  // statues of each hero's deepest run
  const deepest = Math.max(0, ...Object.values(d.best).map((r) => r?.floor ?? 0));
  // Spaced to fit however many heroes there are (seven at first, eight with the Bell-Ringer).
  const gap = Math.min(128, (W - 192) / Math.max(1, HEROES.length - 1));
  HEROES.forEach((h, i) => {
    const run = d.best[h.id];
    statue(ctx, 96 + i * gap, h.id, run, Boolean(run && run.floor === deepest), t, d.auras[h.id], Math.min(122, gap - 8));
  });
  drawDecor(ctx, d, t, 'air');

  text(ctx, `${d.relics}/${RELICS.length} RELICS FOUND · ONEMORECRYPT.COM`, W / 2, H - 12, `16px ${FONT_PIXEL}`, '#6b6680');
}

// ---------- the screen ----------

type HallTab = 'trophies' | 'titles' | 'bestiary';

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
    <small>${next ? `${needed.toLocaleString()} more Souls to <b style="color:${next.color}">${esc(next.name)}</b>` : 'The highest Soul Rank. Eternity is yours.'}</small>
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
  const [gold, silver, bronze] = d.podiums;
  const podium =
    gold + silver + bronze
      ? `<div class="podium-row" title="Daily Descent podium finishes">${gold ? `<span>🥇×${gold}</span>` : ''}${silver ? `<span>🥈×${silver}</span>` : ''}${bronze ? `<span>🥉×${bronze}</span>` : ''}<small>DAILY PODIUMS</small></div>`
      : '';
  const [w1, w2, w3] = d.weekly;
  const weeks =
    w1 + w2 + w3
      ? `<div class="podium-row" title="Weekly Endless top 3 finishes">${w1 ? `<span>♾️×${w1}</span>` : ''}${w2 ? `<span>🥈×${w2}</span>` : ''}${w3 ? `<span>🥉×${w3}</span>` : ''}<small>WEEKLY ENDLESS</small></div>`
      : '';
  const { current, best } = d.streak;
  const streak = best
    ? `<div class="podium-row streak-row" title="Days in a row playing the Daily Descent"><span>🕯️ ${current}</span><small>DAY STREAK${best > current ? ` · BEST ${best}` : ''}</small></div>`
    : '';
  return `${podium}${weeks}${streak}<div class="stat-grid">
      ${cell(d.earned.toLocaleString(), 'SOULS EARNED')}
      ${cell(`${d.feats}/${ACHIEVEMENTS.length}`, 'ACHIEVEMENTS')}
      ${cell(`${d.combos}/${COMBOS.length}`, 'COMBOS')}
      ${cell(`${d.relics}/${RELICS.length}`, 'RELICS')}
      ${cell(bosses, 'BOSSES SLAIN')}
      ${cell(kills.toLocaleString(), 'FOES SLAIN')}
    </div>
    ${statues < HEROES.length ? `<p class="fine">Each hero's statue is carved from their deepest run. ${HEROES.length - statues} plinth${HEROES.length - statues === 1 ? '' : 's'} still empty.</p>` : ''}`;
}

function titlesBody(): string {
  const owned = TITLES.filter((t) => titleUnlocked(t.id));
  const locked = TITLES.filter((t) => !t.secret && !titleUnlocked(t.id));
  const item = (id: string, name: string, desc: string, has: boolean) => `
    <button class="codex-item pick ${meta.title === id ? 'equipped' : ''}" data-title="${esc(id)}" ${has ? '' : 'disabled'}>
      <span class="shop-emoji">${has ? (meta.title === id ? '✅' : '📜') : '🔒'}</span>
      <span class="shop-info"><span class="name ${has ? titleFxClass(id) : ''}">${esc(name)}</span><span class="desc">${esc(desc)}</span></span>
    </button>`;
  return `<p class="fine">Your title shows under your name on the leaderboards and in your Hall. ${owned.filter((t) => !t.secret).length}/${TITLES.filter((t) => !t.secret).length} earned.</p>
    <div class="codex">
      ${item('', 'No title', 'Just your name.', true)}
      ${owned.map((t) => item(t.id, t.name, t.how, true)).join('')}
      ${locked.map((t) => item(t.id, t.name, t.how, false)).join('')}
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
    ['bestiary', 'Bestiary'],
  ];
  const body = tab === 'titles' ? titlesBody() : tab === 'bestiary' ? bestiaryBody(d) : trophiesBody(d);
  showOverlay('hall', `
    <h2>The Crypt Hall</h2>
    <canvas id="hall-canvas" class="hall-canvas" width="${W}" height="${H}" aria-label="Your trophy room"></canvas>
    ${rankBar(d.earned)}
    <button class="btn" id="wardrobe">🎨 Wardrobe<small>Dress your heroes in cloaks and headwear</small></button>
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
  on('#wardrobe', () => showWardrobe(() => showHall(name, back, tab, changed), meta.hero, changed));
  on('#hall-image', () => void saveImage(d));
  on('#hall-link', async () => toast((await copyText(hallLink(name))) ? 'Link copied! Show off your Hall.' : 'Copy failed'));
  on('#back', back);
}

/** Someone else's Hall, from the leaderboard or a shared link. */
let isleVisitor: ((name: string, isle: IsleState, back: () => void) => void) | null = null;

/** How to show someone's isle (set up by the game, which owns the world). */
export function onVisitIsle(fn: (name: string, isle: IsleState, back: () => void) => void) {
  isleVisitor = fn;
}

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
    ${isleVisitor && (d.isle.placed.length || d.isle.land) ? `<button class="btn" id="hall-isle">🏝️ Visit ${esc(d.name)}'s Isle</button>` : ''}
    <button class="btn" id="hall-image">🖼️ Save image</button>
    <button class="btn primary" id="back">Back</button>`);
  startCanvas(d);
  on('#hall-isle', () => isleVisitor?.(d.name, d.isle, () => showPublicHall(d.name, back, tab, d)));
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
