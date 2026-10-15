// The pictures for the daily X posts, drawn with the game's own sprites. Used by
// scripts/post-cards.html (the 7 AM job) and bundled for the Crypt Census dashboard
// (npm run build:cards).

import { HERO_BY_ID, dailyHero, type HeroId } from '../src/content';
import { dailyNumber } from '../src/daily';
import { Game, type Mode } from '../src/game';
import { heroSprite } from '../src/hero';
import { FUSED_RELICS, RELICS, type RelicId } from '../src/relics';
import { sprites } from '../src/sprites';

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

function backdrop(glow: string) {
  const bg = ctx.createRadialGradient(W * 0.3, H * 0.45, 30, W * 0.5, H * 0.5, 820);
  bg.addColorStop(0, glow);
  bg.addColorStop(1, '#07040b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 60) {
    for (let y = 540; y < H; y += 60) {
      ctx.fillStyle = (x / 60 + y / 60) % 2 ? '#1d1824' : '#211b29';
      ctx.fillRect(x, y, 60, 60);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x, y + 56, 60, 4);
      ctx.fillRect(x + 56, y, 4, 60);
    }
  }
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

/** Announce the new crypt and today's hero. */
export function drawDaily(canvas: HTMLCanvasElement, { dailyNo, heroId }: { dailyNo: number; heroId: HeroId }) {
  use(canvas);
  const hero = HERO_BY_ID[heroId];
  backdrop('#2a1328');
  motes('#ff8a2a', 40, 3);
  const s = sprites();
  const foe = (name: keyof ReturnType<typeof sprites>, x: number, y: number, k: number) => ctx.drawImage(s[name].normal, x, y, 12 * k, 12 * k);
  foe('ghoul', 640, 446, 8);
  foe('archer', 760, 440, 8);
  foe('wraith', 880, 446, 8);
  foe('brute', 990, 420, 10);
  foe('bat', 1090, 380, 6);
  ctx.shadowColor = 'rgba(210,58,70,0.8)';
  ctx.shadowBlur = 36;
  ctx.drawImage(heroSprite(hero.id, {}, []).normal, 300, 300, 240, 240);
  ctx.shadowBlur = 0;
  vignette();
  text(`DAILY #${dailyNo}`, W / 2, 170, '140px "Pirata One"', '#d23a46', 'center', 'rgba(210,58,70,0.7)');
  text('THE CRYPT IS OPEN', W / 2, 228, '30px Silkscreen', '#e8dcc4', 'center');
  text(`TODAY'S HERO: THE ${hero.name.toUpperCase()}`, 600, 330, '28px Silkscreen', '#f2c14e');
  text(`${hero.hp} HP · ${hero.perk}`, 600, 375, '22px Silkscreen', '#9a8fa8');
  footer();
}

// ---------- Instagram story ----------

export const STORY_W = 1080;
export const STORY_H = 1920;

export interface StoryLeader {
  name: string;
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
  { dailyNo, heroId, champion, endless }: { dailyNo: number; heroId: HeroId; champion?: StoryLeader & { dailyNo: number }; endless?: StoryLeader },
) {
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const SW = STORY_W;
  const hero = HERO_BY_ID[heroId];

  const bg = ctx.createRadialGradient(SW / 2, 620, 40, SW / 2, 900, 1300);
  bg.addColorStop(0, '#3a1530');
  bg.addColorStop(0.55, '#14091a');
  bg.addColorStop(1, '#07040b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SW, STORY_H);
  let r = 7;
  const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.45;
    ctx.fillStyle = rand() < 0.6 ? '#ff8a2a' : '#f2c14e';
    const sz = rand() < 0.3 ? 8 : 5;
    ctx.fillRect(Math.floor(rand() * SW), Math.floor(rand() * STORY_H), sz, sz);
  }
  ctx.globalAlpha = 1;

  // today's crypt
  text(`DAILY #${dailyNo}`, SW / 2, 380, '150px "Pirata One"', '#d23a46', 'center', 'rgba(210,58,70,0.75)');
  text('THE CRYPT IS OPEN', SW / 2, 445, '36px Silkscreen', '#e8dcc4', 'center');
  ctx.shadowColor = 'rgba(210,58,70,0.8)';
  ctx.shadowBlur = 36;
  ctx.drawImage(heroSprite(hero.id, {}, []).normal, SW / 2 - 110, 480, 220, 220);
  ctx.shadowBlur = 0;
  text(`TODAY'S HERO: THE ${hero.name.toUpperCase()}`, SW / 2, 750, fit(`TODAY'S HERO: THE ${hero.name.toUpperCase()}`, SW - 120, 34, 'Silkscreen'), '#f2c14e', 'center');
  text(`${hero.hp} HP · ${hero.perk}`, SW / 2, 795, '26px Silkscreen', '#9a8fa8', 'center');

  // the two leaders, side by side
  const panel = (x: number, label: string, color: string, glow: string, who: StoryLeader | undefined, look: Look | null, crown: boolean) => {
    const w = 460;
    const top = 860;
    const h = 560;
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
  panel(60, champion ? `CHAMPION OF DAILY #${champion.dailyNo}` : 'YESTERDAY\'S CHAMPION', '#f2c14e', 'rgba(242,193,78,0.45)', champion, champLook, true);
  panel(SW - 520, 'ENDLESS LEADER', '#c9a6ff', 'rgba(176,124,255,0.45)', endless, endlessLook, false);

  // call to action, above the reply bar; the gap below the title is for a link sticker
  text('CAN YOU TAKE THE CROWN?', SW / 2, 1500, '38px Silkscreen', '#e8dcc4', 'center');
  text('ONEMORECRYPT.COM', SW / 2, 1580, '58px Silkscreen', '#f2c14e', 'center', 'rgba(242,193,78,0.5)');
  text('PLAY FREE IN YOUR BROWSER', SW / 2, 1630, '24px Silkscreen', '#9a8fa8', 'center');
}
