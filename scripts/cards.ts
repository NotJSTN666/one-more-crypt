// The pictures for the daily X posts, drawn with the game's own sprites. Used by
// scripts/post-cards.html (the 7 AM job) and bundled for the Crypt Census dashboard
// (npm run build:cards).

import { HERO_BY_ID, dailyHero, type HeroId } from '../src/content';
import { dailyNumber } from '../src/daily';
import { Game, type Mode } from '../src/game';
import { heroSprite } from '../src/hero';
import { RELICS, type RelicId } from '../src/relics';
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

/** Crown yesterday's winner. Their hero is rebuilt from the run log, so it wears their real relics. */
export function drawChampion(canvas: HTMLCanvasElement, { name, mode = 'daily', title, dailyNo = 0, floor, kills, relics, seed, log, others }: ChampionCard) {
  use(canvas);
  // Replay the run for the hero's exact final form. Runs logged under older rules may not
  // replay to the same floor; then rebuild the look from the relic emojis saved with the run.
  let look: { hero: HeroId; relics: Partial<Record<RelicId, number>>; log: RelicId[] } | undefined;
  try {
    const g = Game.replay(mode, seed, dailyNo, log);
    if (g.floor === floor) look = { hero: g.hero, relics: g.relics, log: g.relicLog };
  } catch (e) {}
  if (!look) {
    const byEmoji = new Map(RELICS.map((r) => [r.emoji, r.id]));
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
  const g = look!;
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
