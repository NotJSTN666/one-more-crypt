// The pictures for the daily X posts, drawn with the game's own sprites. Used by
// scripts/post-cards.html (the 7 AM job) and bundled for the Crypt Census dashboard
// (npm run build:cards).

import { HERO_BY_ID, dailyHero, type HeroId } from '../src/content';
import { dailyNumber } from '../src/daily';
import { Game, type EnemyKind, type Mode } from '../src/game';
import { heroSprite } from '../src/hero';
import { FUSED_RELICS, RELICS, type RelicId } from '../src/relics';
import { hashSeed, mulberry32 } from '../src/rng';
import { sprites } from '../src/sprites';
import { ZONES, type ZoneDef, type ZoneId } from '../src/zones';

export const W = 1200;
export const H = 675;

export interface ChampionCard {
  name: string;
  mode?: Mode;
  title?: string;
  dailyNo?: number;
  floor: number;
  kills: number;
  relics?: string;
  seed: number;
  log: string;
  others?: string;
}

let ctx: CanvasRenderingContext2D;

function use(canvas: HTMLCanvasElement) {
  canvas.width = W;
  canvas.height = H;
  ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
}

/** Wait for the card fonts (the page must load Pirata One and Silkscreen from Google Fonts). */
export async function fontsReady() {
  await document.fonts.load('120px "Pirata One"');
  await document.fonts.load('28px Silkscreen');
}

const CROWN = [
  '.y...y...y.',
  '.yy.yyy.yy.',
  '.yyyyyyyyy.',
  '.yryyByyry.',
  '.yyyyyyyyy.',
  '.ddddddddd.',
];
const CROWN_COL: Record<string, string> = { y: '#f2c14e', d: '#a8781f', r: '#d23a46', B: '#9fe8ff' };

function pixels(rows: string[], cols: Record<string, string>, x: number, y: number, scale: number) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = cols[row[i]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }
  });
}

// ---------- the day's look ----------

/** Every place the crypt can look like, in the game and in the story. */
const LOOKS: ZoneId[] = ['crypt', 'flooded', 'ossuary', 'burning', 'abyss', 'kennel', 'well', 'mine', 'cellar'];

/** Who lurks in each look, front to back. */
const FOES: Record<ZoneId, EnemyKind[]> = {
  crypt: ['ghoul', 'archer', 'wraith', 'brute', 'bat'],
  flooded: ['drowned', 'ghoul', 'wraith', 'drowned', 'bat'],
  ossuary: ['boneknight', 'archer', 'ghoul', 'boneknight', 'bat'],
  burning: ['ghoul', 'imp', 'brute', 'archer', 'imp'],
  abyss: ['wraith', 'voideye', 'ghoul', 'brute', 'voideye'],
  kennel: ['hound', 'ghoul', 'hound', 'brute', 'bat'],
  well: ['drowned', 'ghoul', 'drowned', 'wraith', 'bat'],
  mine: ['ghoul', 'archer', 'brute', 'ghoul', 'bat'],
  cellar: ['ghoul', 'bat', 'brute', 'archer', 'bat'],
};

/**
 * Each day's cards wear one of the crypt's looks: the same all day, a new one tomorrow.
 * The looks are shuffled in runs of nine days, so every one comes round and none repeats
 * within a run.
 */
export function cardLook(dailyNo: number): ZoneDef {
  const run = Math.floor((dailyNo - 1) / LOOKS.length);
  const rng = mulberry32(hashSeed('card-look', run));
  const order = [...LOOKS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return ZONES[order[(dailyNo - 1) % LOOKS.length]];
}

let look: ZoneDef = ZONES.crypt;

/** The look's headline colour: the brand's blood red in the plain crypt, the place's own colour elsewhere. */
const accent = () => (look.id === 'crypt' ? '#d23a46' : look.color);

/** The look's colour as a background glow: paler colours glow fainter, so the card stays dark enough to read. */
function glow(a: number) {
  const n = parseInt(accent().slice(1), 16);
  const lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return rgba(accent(), a * Math.min(1, 0.45 / Math.max(lum, 0.01)));
}

/** A colour at some opacity, for glows. */
function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** The look's ground: flagstones, packed earth or floorboards, with a touch of what's on it. */
function floorBand(top: number, bottom: number, width: number, tile: number) {
  for (let x = 0; x < width; x += tile) {
    for (let y = top; y < bottom; y += tile) {
      const i = x / tile + (y - top) / tile;
      ctx.fillStyle = look.floor[i % look.floor.length];
      ctx.fillRect(x, y, tile, tile);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      if (look.floorStyle === 'boards') {
        for (let b = tile / 4 - 3; b < tile; b += tile / 4) ctx.fillRect(x, y + b, tile, 3);
      } else if (look.floorStyle !== 'dirt') {
        ctx.fillRect(x, y + tile - 4, tile, 4);
        ctx.fillRect(x + tile - 4, y, 4, tile);
      }
    }
  }
  // something underfoot
  let r = 17;
  const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let k = 0; k < width / 160; k++) {
    const x = Math.floor(rand() * width);
    const y = top + 10 + Math.floor(rand() * (bottom - top - 30));
    if (look.id === 'flooded' || look.id === 'well') {
      ctx.fillStyle = rgba('#5fe3ff', 0.18);
      ctx.fillRect(x, y, 70, 10);
      ctx.fillStyle = rgba('#a0ebff', 0.3);
      ctx.fillRect(x + 10, y, 24, 3);
    } else if (look.id === 'burning') {
      ctx.fillStyle = rgba('#ff6a28', 0.55);
      for (let i = 0; i < 6; i++) ctx.fillRect(x + i * 5 + (i % 2) * 3, y + i * 4, 5, 4);
    } else if (look.id === 'ossuary') {
      ctx.fillStyle = '#c9b99a';
      ctx.fillRect(x, y, 16, 12);
      ctx.fillRect(x + 4, y + 12, 8, 4);
      ctx.fillStyle = '#201c18';
      ctx.fillRect(x + 4, y + 4, 3, 3);
      ctx.fillRect(x + 10, y + 4, 3, 3);
    } else if (look.id === 'kennel') {
      ctx.fillStyle = '#b8964a';
      ctx.fillRect(x, y, 26, 3);
      ctx.fillRect(x + 8, y - 4, 20, 3);
    } else if (look.id === 'mine') {
      ctx.fillStyle = '#1f4a63';
      ctx.fillRect(x, y, 14, 9);
      ctx.fillStyle = '#5fe3ff';
      ctx.fillRect(x + 3, y, 4, 3);
    } else if (look.id === 'cellar') {
      ctx.fillStyle = rgba('#a8781f', 0.35);
      ctx.fillRect(x, y, 34, 10);
    } else if (look.id === 'abyss') {
      ctx.fillStyle = rgba('#b07cff', 0.6);
      ctx.fillRect(x, y, 4, 4);
    }
  }
}

/** A band of the look's wall: brick courses, upright planks or rough rock. */
function wallBand(top: number, bottom: number, width: number) {
  ctx.fillStyle = look.wall.base;
  ctx.fillRect(0, top, width, bottom - top);
  ctx.fillStyle = look.wall.brick;
  if (look.wallStyle === 'plank') {
    for (let x = 22; x < width; x += 26) ctx.fillRect(x, top, 4, bottom - top);
  } else if (look.wallStyle === 'rock') {
    let r = 23;
    const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let k = 0; k < (width * (bottom - top)) / 2400; k++) ctx.fillRect(Math.floor(rand() * width), top + Math.floor(rand() * (bottom - top)), 12 + Math.floor(rand() * 18), 6 + Math.floor(rand() * 8));
  } else {
    for (let y = top + 22, row = 0; y < bottom; y += 26, row++) {
      ctx.fillRect(0, y, width, 4);
      for (let x = row % 2 ? 26 : 0; x < width; x += 52) ctx.fillRect(x, y - 22, 4, 22);
    }
  }
  ctx.fillStyle = look.wall.top;
  ctx.fillRect(0, bottom - 6, width, 6);
}

function backdrop(color: string) {
  const glow = color.startsWith('#') ? rgba(color, 1) : color;
  // A solid dark base first: the glow is see-through, and a light page behind would wash it out.
  ctx.fillStyle = '#07040b';
  ctx.fillRect(0, 0, W, H);
  // Fade the glow out to nothing over the base. (Fading it into the dark colour instead
  // drags the glow's colour across the whole card and washes it out.)
  const bg = ctx.createRadialGradient(W * 0.3, H * 0.45, 30, W * 0.5, H * 0.5, 820);
  bg.addColorStop(0, glow);
  bg.addColorStop(1, glow.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  floorBand(540, H, W, 60);
}

function motes(color: string, n: number, seed: number) {
  let r = seed;
  const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35 + rand() * 0.5;
    const s = rand() < 0.3 ? 6 : 4;
    ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * 520), s, s);
  }
  ctx.globalAlpha = 1;
}

function vignette() {
  const v = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 820);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function text(str: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', glow: string | null = null) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 30; }
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

/** Shrink a line until it fits the width. */
function fit(str: string, max: number, size: number, family: string) {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (ctx.measureText(str).width > max && s > 24) {
    s -= 4;
    ctx.font = `${s}px ${family}`;
  }
  return `${s}px ${family}`;
}

function footer() {
  text('ONEMORECRYPT.COM', W - 48, H - 32, '24px Silkscreen', '#f2c14e', 'right');
  text('ONE CRYPT. ONE TRY A DAY.', 48, H - 32, '20px Silkscreen', '#e8dcc4', 'left');
}

/** Today's number and hero, worked out exactly as the game does. */
export function today() {
  const n = dailyNumber();
  const hero = HERO_BY_ID[dailyHero(n)];
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return { dailyNo: n, hero: { id: hero.id, name: hero.name, perk: hero.perk, perkDesc: hero.perkDesc, hp: hero.hp }, chicagoHour: hour };
}

interface Look {
  hero: HeroId;
  relics: Partial<Record<RelicId, number>>;
  log: RelicId[];
}

/**
 * A leader's hero in their final form. Replays the run for the exact build; runs logged
 * under older rules may not replay to the same floor, so then the look is rebuilt from
 * the relic emojis saved with the run.
 */
function heroLook({ mode = 'daily', dailyNo = 0, floor, relics, seed, log }: { mode?: Mode; dailyNo?: number; floor: number; relics?: string; seed: number; log: string }): Look {
  let look: Look | undefined;
  try {
    const g = Game.replay(mode, seed, dailyNo, log);
    if (g.floor === floor) look = { hero: g.hero, relics: g.relics, log: g.relicLog };
  } catch (e) {}
  if (!look) {
    const byEmoji = new Map([...RELICS, ...FUSED_RELICS].map((r) => [r.emoji, r.id]));
    const ids: RelicId[] = [];
    let rest = relics || '';
    while (rest.length) {
      const hit = [...byEmoji.keys()].filter((e) => rest.startsWith(e)).sort((a, b) => b.length - a.length)[0];
      if (hit) { ids.push(byEmoji.get(hit)!); rest = rest.slice(hit.length); }
      else rest = rest.slice([...rest][0].length);
    }
    const counts: Partial<Record<RelicId, number>> = {};
    ids.forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
    const m = /^#\d+\|([a-z]+)\|/.exec(log || '');
    look = { hero: (m ? m[1] : mode === 'daily' ? dailyHero(dailyNo) : 'knight') as HeroId, relics: counts, log: ids };
  }
  return look!;
}

/** Crown yesterday's winner. Their hero is rebuilt from the run log, so it wears their real relics. */
export function drawChampion(canvas: HTMLCanvasElement, { name, mode = 'daily', title, dailyNo = 0, floor, kills, relics, seed, log, others }: ChampionCard) {
  use(canvas);
  const g = heroLook({ mode, dailyNo, floor, relics, seed, log });
  const hero = HERO_BY_ID[g.hero];
  const endless = mode === 'endless';
  look = cardLook(dailyNumber());
  backdrop(endless ? '#2a1640' : '#3a2a10');
  motes(endless ? '#b07cff' : '#f2c14e', 70, 11);
  // spotlight
  const spot = ctx.createRadialGradient(310, 330, 20, 310, 330, 300);
  spot.addColorStop(0, 'rgba(242,193,78,0.35)');
  spot.addColorStop(1, 'rgba(242,193,78,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, 640, 600);
  // the hero in their final form, crowned
  const size = 264;
  ctx.shadowColor = 'rgba(242,193,78,0.7)';
  ctx.shadowBlur = 40;
  ctx.drawImage(heroSprite(g.hero, g.relics, g.log).normal, 310 - size / 2, 548 - size, size, size);
  ctx.shadowBlur = 0;
  pixels(CROWN, CROWN_COL, 310 - (11 * 16) / 2, 548 - size - 120, 16);
  vignette();
  // words
  const x = 600;
  text(title || `CHAMPION OF DAILY #${dailyNo}`, x, 150, '30px Silkscreen', endless ? '#c9a6ff' : '#f2c14e');
  text(name, x, 290, fit(name, 560, 140, '"Pirata One"'), '#f2c14e', 'left', 'rgba(242,193,78,0.6)');
  text(`Floor ${floor} · ${kills} kills`, x, 370, '34px Silkscreen', '#e8dcc4');
  text(`as the ${hero.name}`, x, 420, '28px Silkscreen', '#9a8fa8');
  if (relics) {
    ctx.font = '40px "Noto Color Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'left';
    // Emojis can be several code points; fit as many whole ones as the row allows.
    const seg = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter().segment(relics)].map((p) => p.segment) : [...relics];
    let line = '';
    for (const e of seg) {
      if (ctx.measureText(line + e + '…').width > W - x - 40) { line += '…'; break; }
      line += e;
    }
    ctx.fillText(line, x, 490);
  }
  if (others) text(`Tied with ${others}`, x, 530, '20px Silkscreen', '#9a8fa8');
  footer();
  return { hero: hero.name };
}

/** How today's crypt is going when the picture is made: runs finished so far and the deepest one. */
export interface DailyTally {
  players: number;
  top: number;
  leader?: string;
}

function tallyLine(t: DailyTally): [string, string] {
  if (!t.players) return ['NOBODY HAS DESCENDED YET', 'BE THE FIRST'];
  const who = t.players === 1 ? '1 SOUL HAS DESCENDED' : `${t.players} SOULS HAVE DESCENDED`;
  return [who, `DEEPEST: FLOOR ${t.top}${t.leader ? ` · ${t.leader.toUpperCase()}` : ''}`];
}

/** Announce the new crypt and today's hero, with today's tally when there is one. */
export function drawDaily(canvas: HTMLCanvasElement, { dailyNo, heroId, tally }: { dailyNo: number; heroId: HeroId; tally?: DailyTally }) {
  use(canvas);
  look = cardLook(dailyNo);
  const hero = HERO_BY_ID[heroId];
  backdrop(glow(0.22));
  motes(look.mote, 40, 3);
  const s = sprites();
  const foe = (name: keyof ReturnType<typeof sprites>, x: number, y: number, k: number) => ctx.drawImage(s[name].normal, x, y, 12 * k, 12 * k);
  const [a, b, c, d, e] = FOES[look.id];
  foe(a, 640, 446, 8);
  foe(b, 760, 440, 8);
  foe(c, 880, 446, 8);
  foe(d, 990, 420, 10);
  foe(e, 1090, 380, 6);
  ctx.shadowColor = rgba(accent(), 0.8);
  ctx.shadowBlur = 36;
  ctx.drawImage(heroSprite(hero.id, {}, []).normal, 300, 300, 240, 240);
  ctx.shadowBlur = 0;
  vignette();
  text(`DAILY #${dailyNo}`, W / 2, 170, '140px "Pirata One"', accent(), 'center', rgba(accent(), 0.7));
  text('THE CRYPT IS OPEN', W / 2, 228, '30px Silkscreen', '#e8dcc4', 'center');
  text(`TODAY'S HERO: THE ${hero.name.toUpperCase()}`, 600, 330, '28px Silkscreen', '#f2c14e');
  text(`${hero.hp} HP · ${hero.perk}`, 600, 375, '22px Silkscreen', '#9a8fa8');
  if (tally) {
    const [a, b] = tallyLine(tally);
    ctx.fillStyle = 'rgba(7,4,11,0.72)';
    ctx.fillRect(0, 560, W, 52);
    ctx.fillStyle = accent();
    ctx.fillRect(0, 560, W, 3);
    const line = `${a}  ·  ${b}`;
    text(line, W / 2, 596, fit(line, W - 96, 26, 'Silkscreen'), '#f2c14e', 'center');
  }
  footer();
}

// ---------- Instagram story ----------

export const STORY_W = 1080;
export const STORY_H = 1920;

export interface StoryLeader {
  name: string;
  /** For a daily champion: how many finished that daily. */
  players?: number;
  floor: number;
  kills: number;
  relics?: string;
  seed: number;
  log: string;
}

/**
 * One 1080x1920 story with the day's news: today's crypt and hero, yesterday's champion
 * and the endless leader. Instagram covers roughly the top 250px with the account bar
 * and the bottom 250px with the reply bar, so everything important sits between them,
 * leaving room above the call to action for a link sticker.
 */
export function drawStory(
  canvas: HTMLCanvasElement,
  { dailyNo, heroId, champion, endless, tally }: { dailyNo: number; heroId: HeroId; champion?: StoryLeader & { dailyNo: number }; endless?: StoryLeader; tally?: DailyTally },
) {
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const SW = STORY_W;
  const hero = HERO_BY_ID[heroId];
  look = cardLook(dailyNo);

  ctx.fillStyle = '#07040b';
  ctx.fillRect(0, 0, SW, STORY_H);
  const bg = ctx.createRadialGradient(SW / 2, 620, 40, SW / 2, 900, 1300);
  bg.addColorStop(0, glow(0.24));
  bg.addColorStop(1, glow(0));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SW, STORY_H);
  // the place: its wall along the top and its floor along the bottom, under Instagram's bars
  wallBand(0, 230, SW);
  floorBand(1700, STORY_H, SW, 72);
  const shade = ctx.createLinearGradient(0, 0, 0, STORY_H);
  shade.addColorStop(0, 'rgba(7,4,11,0.35)');
  shade.addColorStop(0.13, 'rgba(7,4,11,0.9)');
  shade.addColorStop(0.86, 'rgba(7,4,11,0.9)');
  shade.addColorStop(1, 'rgba(7,4,11,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, SW, STORY_H);
  const halo = ctx.createRadialGradient(SW / 2, 620, 40, SW / 2, 800, 1000);
  halo.addColorStop(0, glow(0.22));
  halo.addColorStop(1, glow(0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, SW, STORY_H);
  let r = 7;
  const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.45;
    ctx.fillStyle = rand() < 0.6 ? look.mote : '#f2c14e';
    const sz = rand() < 0.3 ? 8 : 5;
    ctx.fillRect(Math.floor(rand() * SW), Math.floor(rand() * STORY_H), sz, sz);
  }
  ctx.globalAlpha = 1;

  // today's crypt
  text(`DAILY #${dailyNo}`, SW / 2, 380, '150px "Pirata One"', accent(), 'center', rgba(accent(), 0.75));
  text('THE CRYPT IS OPEN', SW / 2, 445, '36px Silkscreen', '#e8dcc4', 'center');
  // two of the place's residents flank the hero
  const s = sprites();
  const [left, , , right] = FOES[look.id];
  ctx.globalAlpha = 0.9;
  ctx.drawImage(s[left].normal, 120, 520, 156, 156);
  ctx.save();
  ctx.translate(SW - 120, 520);
  ctx.scale(-1, 1);
  ctx.drawImage(s[right].normal, 0, 0, 156, 156);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowColor = rgba(accent(), 0.8);
  ctx.shadowBlur = 36;
  ctx.drawImage(heroSprite(hero.id, {}, []).normal, SW / 2 - 110, 480, 220, 220);
  ctx.shadowBlur = 0;
  text(`TODAY'S HERO: THE ${hero.name.toUpperCase()}`, SW / 2, 750, fit(`TODAY'S HERO: THE ${hero.name.toUpperCase()}`, SW - 120, 34, 'Silkscreen'), '#f2c14e', 'center');
  text(`${hero.hp} HP · ${hero.perk}`, SW / 2, 795, '26px Silkscreen', '#9a8fa8', 'center');
  if (tally) {
    const [a, b] = tallyLine(tally);
    text(a, SW / 2, 848, fit(a, SW - 120, 30, 'Silkscreen'), '#e8dcc4', 'center');
    text(b, SW / 2, 890, fit(b, SW - 120, 30, 'Silkscreen'), '#f2c14e', 'center', 'rgba(242,193,78,0.45)');
  }
  const panelTop = tally ? 925 : 860;

  // the two leaders, side by side
  const panel = (x: number, label: string, color: string, glow: string, who: StoryLeader | undefined, look: Look | null, crown: boolean) => {
    const w = 460;
    const top = panelTop;
    const h = 545;
    ctx.fillStyle = 'rgba(20,13,28,0.85)';
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, 6);
    const cx = x + w / 2;
    text(label, cx, top + 56, fit(label, w - 40, 26, 'Silkscreen'), color, 'center');
    if (!who || !look) {
      text('UNCLAIMED', cx, top + 300, '34px Silkscreen', '#6b6680', 'center');
      text('Be the first', cx, top + 350, '24px Silkscreen', '#9a8fa8', 'center');
      return;
    }
    const spot = ctx.createRadialGradient(cx, top + 240, 10, cx, top + 240, 180);
    spot.addColorStop(0, glow);
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(x, top + 60, w, 360);
    const size = 216;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 30;
    ctx.drawImage(heroSprite(look.hero, look.relics, look.log).normal, cx - size / 2, top + 150, size, size);
    ctx.shadowBlur = 0;
    if (crown) pixels(CROWN, CROWN_COL, cx - (11 * 9) / 2, top + 92, 9);
    text(who.name, cx, top + 440, fit(who.name, w - 40, 76, '"Pirata One"'), '#f2c14e', 'center', 'rgba(242,193,78,0.5)');
    text(`FLOOR ${who.floor} · ${who.kills} KILLS`, cx, top + 490, fit(`FLOOR ${who.floor} · ${who.kills} KILLS`, w - 40, 26, 'Silkscreen'), '#e8dcc4', 'center');
    text(`as the ${HERO_BY_ID[look.hero].name}`, cx, top + 530, '22px Silkscreen', '#9a8fa8', 'center');
  };
  const champLook = champion ? heroLook({ ...champion, mode: 'daily' }) : null;
  const endlessLook = endless ? heroLook({ ...endless, mode: 'endless' }) : null;
  panel(60, champion ? championLabel(champion) : 'YESTERDAY\'S CHAMPION', '#f2c14e', 'rgba(242,193,78,0.45)', champion, champLook, true);
  panel(SW - 520, "YESTERDAY'S ENDLESS BEST", '#c9a6ff', 'rgba(176,124,255,0.45)', endless, endlessLook, false);

  // call to action, above the reply bar; the gap below the title is for a link sticker
  const cta = tally ? 18 : 0;
  text('CAN YOU TAKE THE CROWN?', SW / 2, 1500 + cta, '38px Silkscreen', '#e8dcc4', 'center');
  text('ONEMORECRYPT.COM', SW / 2, 1580 + cta, '58px Silkscreen', '#f2c14e', 'center', 'rgba(242,193,78,0.5)');
  text('PLAY FREE IN YOUR BROWSER', SW / 2, 1630 + cta, '24px Silkscreen', '#9a8fa8', 'center');
}

/** "CHAMPION OF DAILY #3 · 38 DESCENDED", leaving the count off when it isn't known. */
function championLabel(c: StoryLeader & { dailyNo: number }): string {
  return `CHAMPION OF DAILY #${c.dailyNo}${c.players ? ` · ${c.players} DESCENDED` : ''}`;
}

// ---------- one daily post ----------

/**
 * Everything for the day's single X post on one 1200x675 card: today's crypt and hero on
 * the left, yesterday's champion and the endless leader on the right, and today's tally
 * along the bottom.
 */
export function drawDigest(
  canvas: HTMLCanvasElement,
  { dailyNo, heroId, champion, endless, tally }: { dailyNo: number; heroId: HeroId; champion?: StoryLeader & { dailyNo: number }; endless?: StoryLeader; tally?: DailyTally },
) {
  use(canvas);
  look = cardLook(dailyNo);
  const hero = HERO_BY_ID[heroId];
  backdrop(glow(0.22));
  motes(look.mote, 34, 5);
  // two of the place's residents either side of the hero
  const s = sprites();
  const [left, , , right] = FOES[look.id];
  ctx.drawImage(s[left].normal, 60, 300, 120, 120);
  ctx.save();
  ctx.translate(540, 300);
  ctx.scale(-1, 1);
  ctx.drawImage(s[right].normal, 0, 0, 120, 120);
  ctx.restore();
  vignette();

  // today's crypt
  text(`DAILY #${dailyNo}`, 300, 128, '108px "Pirata One"', accent(), 'center', rgba(accent(), 0.7));
  text('THE CRYPT IS OPEN', 300, 176, '24px Silkscreen', '#e8dcc4', 'center');
  ctx.shadowColor = rgba(accent(), 0.8);
  ctx.shadowBlur = 32;
  ctx.drawImage(heroSprite(hero.id, {}, []).normal, 200, 205, 200, 200);
  ctx.shadowBlur = 0;
  const heroLine = `TODAY'S HERO: THE ${hero.name.toUpperCase()}`;
  text(heroLine, 300, 452, fit(heroLine, 540, 24, 'Silkscreen'), '#f2c14e', 'center');
  text(`${hero.hp} HP · ${hero.perk}`, 300, 488, '18px Silkscreen', '#9a8fa8', 'center');

  // the two leaders, stacked
  const panel = (y: number, label: string, color: string, glow: string, who: StoryLeader | undefined, look: Look | null, crown: boolean) => {
    const x = 630;
    const w = 530;
    const h = 210;
    ctx.fillStyle = 'rgba(20,13,28,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 5);
    text(label, x + 24, y + 38, fit(label, w - 48, 20, 'Silkscreen'), color);
    if (!who || !look) {
      text('UNCLAIMED · BE THE FIRST', x + w / 2, y + 130, '22px Silkscreen', '#6b6680', 'center');
      return;
    }
    const size = 128;
    const sx = x + 28;
    const sy = y + 62;
    const spot = ctx.createRadialGradient(sx + size / 2, sy + size / 2, 6, sx + size / 2, sy + size / 2, 110);
    spot.addColorStop(0, glow);
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(x, y + 6, 220, h - 6);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 20;
    ctx.drawImage(heroSprite(look.hero, look.relics, look.log).normal, sx, sy, size, size);
    ctx.shadowBlur = 0;
    if (crown) pixels(CROWN, CROWN_COL, sx + size / 2 - (11 * 5) / 2, sy - 22, 5);
    const tx = x + 190;
    text(who.name, tx, y + 112, fit(who.name, w - 210, 54, '"Pirata One"'), '#f2c14e', 'left', 'rgba(242,193,78,0.45)');
    const stats = `FLOOR ${who.floor} · ${who.kills} KILLS`;
    text(stats, tx, y + 152, fit(stats, w - 210, 22, 'Silkscreen'), '#e8dcc4');
    text(`as the ${HERO_BY_ID[look.hero].name}`, tx, y + 184, '18px Silkscreen', '#9a8fa8');
  };
  const champLook = champion ? heroLook({ ...champion, mode: 'daily' }) : null;
  const endlessLook = endless ? heroLook({ ...endless, mode: 'endless' }) : null;
  panel(48, champion ? championLabel(champion) : "YESTERDAY'S CHAMPION", '#f2c14e', 'rgba(242,193,78,0.45)', champion, champLook, true);
  panel(282, "YESTERDAY'S ENDLESS BEST", '#c9a6ff', 'rgba(176,124,255,0.45)', endless, endlessLook, false);

  // today's tally, when there is one
  if (tally) {
    const [a, b] = tallyLine(tally);
    ctx.fillStyle = 'rgba(7,4,11,0.72)';
    ctx.fillRect(0, 546, W, 50);
    ctx.fillStyle = accent();
    ctx.fillRect(0, 546, W, 3);
    const line = `${a}  ·  ${b}`;
    text(line, W / 2, 580, fit(line, W - 96, 24, 'Silkscreen'), '#f2c14e', 'center');
  }
  footer();
}
