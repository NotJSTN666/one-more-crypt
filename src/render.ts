// Canvas renderer. Reads game state every frame and turns game events into
// short-lived effects (damage numbers, particles, screen shake).

import { drawAura as drawAuraFx } from './aura';
import { ELITES, type HeroId } from './content';
import { ENEMY_INFO, Game, H, HORDE_SPARK, W, isBoss, type EnemyKind, type GameEvent, type MagnetPull, type Pos } from './game';
import { hashSeed, mulberry32 } from './rng';
import { heroSprite, relicColor } from './hero';
import { LOOK_BY_ID, type Outfit } from './progression';
import { RELIC_BY_ID, type RelicId } from './relics';
import { SPRITE_SIZE, enemyFrames, sprites } from './sprites';
import { deepLook, zoneAt, zoneLook, zoneTitle, type Weather } from './zones';

export const TILE = 16;
const BOARD_W = W * TILE;
const BOARD_H = H * TILE;
const PAD = (TILE - SPRITE_SIZE) / 2;

interface Floater { x: number; y: number; text: string; color: string; t: number; life: number }
interface Particle { x: number; y: number; vx: number; vy: number; color: string; t: number; life: number; size: number; grav?: number }
interface Candle { x: number; y: number; phase: number }
interface Mote { x: number; y: number; vx: number; vy: number; t: number; life: number }
interface Line { from: Pos; to: Pos; t: number; life: number; color: string }
interface Corpse { kind: EnemyKind; x: number; y: number; t: number }
interface Lunge { dx: number; dy: number; t: number }

const PLAYER_ID = 0;
/** The cosmetic companion that trails the hero outside the story. */
const PET_ID = -1;
const REAPER_ID = -2;

const pixelCache = new Map<string, { x: number; y: number; c: string }[]>();

/** The coloured pixels of a foe's sprite, for shattering it on death. */
function spritePixels(kind: EnemyKind | HTMLCanvasElement): { x: number; y: number; c: string }[] {
  const key = typeof kind === 'string' ? kind : '';
  let px = key ? pixelCache.get(key) : undefined;
  if (px) return px;
  px = [];
  const img = typeof kind === 'string' ? sprites()[kind].normal : kind;
  const data = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (data[i + 3] < 128) continue;
      px.push({ x, y, c: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})` });
    }
  }
  if (key) pixelCache.set(key, px);
  return px;
}

/** How long a Grave Magnet pull takes to fly in (seconds). */
const FLIGHT_S = 0.5;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private game: Game | null = null;
  private bg: HTMLCanvasElement | null = null;
  /** Bumped when the phone may have wiped the cached floor, so it's drawn again. */
  private bgEpoch = 0;

  /** Redraw everything cached: the app was in the background. */
  invalidate() {
    this.bgEpoch++;
  }
  private bgKey = '';
  private disp = new Map<number, Pos>();
  private flashes = new Map<number, number>();
  private lunges = new Map<number, Lunge>();
  /** How long each foe holds its attack pose. */
  private strikes = new Map<number, number>();
  private floaters: Floater[] = [];
  private particles: Particle[] = [];
  /** Pickups the Grave Magnet is pulling in, flying from where they lay to the hero. */
  private flying: { kind: MagnetPull['kind']; x0: number; y0: number; x1: number; y1: number; t: number }[] = [];

  /** Milliseconds until every pickup the magnet is pulling has landed. */
  pullingMs(): number {
    return Math.max(0, ...this.flying.map((f) => (1 - f.t) * FLIGHT_S * 1000));
  }
  private lines: Line[] = [];
  /** The Bell-Ringer's tolls: rings spreading out from the hero. */
  private rings: { x: number; y: number; t: number }[] = [];
  private corpses: Corpse[] = [];
  private bannerText: { text: string; color: string; t: number } | null = null;
  private shake = 0;
  private hurtFlash = 0;
  private healFlash = 0;
  private time = 0;
  /** Which way each unit faces (-1 left, 1 right), how far it still has to travel, and landing squash. */
  private facing = new Map<number, number>();
  private remain = new Map<number, number>();
  private landing = new Map<number, number>();
  /** Brief freeze on big hits, so they land with weight. */
  private hitStop = 0;
  /** 0..1 while the darkness opens onto a new floor. */
  private enter = 1;
  private candles: Candle[] = [];
  private motes: Mote[] = [];
  /** The player's costume for this run: cloak look and headwear ('' for none). */
  outfit: Outfit = { look: '', head: '', aura: '' };
  /** A companion that follows the hero in the daily and Endless: looks only, it never fights. */
  pet = '';
  private petAt: Pos | null = null;
  private heroAt: Pos | null = null;

  /** Quiet renderers (background ghosts) skip text and screen shake. */
  constructor(private canvas: HTMLCanvasElement, private quiet = false) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Fit the board into a CSS box, keeping pixels crisp with an integer scale. */
  resize(cssSize: number) {
    const dpr = window.devicePixelRatio || 1;
    this.scale = Math.max(1, Math.floor((cssSize * dpr) / BOARD_W));
    this.canvas.width = BOARD_W * this.scale;
    this.canvas.height = BOARD_H * this.scale;
    this.canvas.style.width = `${(BOARD_W * this.scale) / dpr}px`;
    this.canvas.style.height = `${(BOARD_H * this.scale) / dpr}px`;
  }

  setGame(game: Game) {
    this.game = game;
    this.petAt = null;
    this.heroAt = null;
    this.disp.clear();
    this.facing.clear();
    this.remain.clear();
    this.landing.clear();
    this.enter = 0;
    this.floaters = [];
    this.particles = [];
    this.lines = [];
    this.corpses = [];
    this.bgKey = '';
  }

  /** Map a client point to a board tile. */
  tileAt(clientX: number, clientY: number): Pos | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * W);
    const y = Math.floor(((clientY - rect.top) / rect.height) * H);
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return { x, y };
  }

  consume(events: GameEvent[]) {
    const g = this.game;
    if (!g) return;
    let stack = 0;
    const claimed: RelicId[] = [];
    // Pickups the Grave Magnet pulled this turn pop when they land, not where they lay.
    let pulled = false;
    for (const ev of events) {
      switch (ev.t) {
        case 'floor':
          this.enter = 0;
          this.disp.clear();
          this.remain.clear();
          this.corpses = [];
          this.flying = [];
          this.lines = [];
          this.floaters = [];
          {
            const boss = g.enemies.find((e) => isBoss(e));
            const title = boss ? ENEMY_INFO[boss.kind].name.replace(/^The /, '').toUpperCase() : `FLOOR ${ev.floor}`;
            // The Horde has its own title card and wave banners.
            if (g.mode !== 'horde') this.floaters.push(this.floater(3, 3, title, '#f2c14e', 1.6));
            // Crossing into a new depth zone gets its name across the board.
            const zone = zoneAt(ev.floor);
            if (zone.start === ev.floor && ev.floor > 1) {
              this.bannerText = { text: zoneTitle(zone).toUpperCase(), color: zoneLook(zone).color, t: -0.35 };
            }
          }
          break;
        case 'pattack':
          this.lunges.set(PLAYER_ID, { dx: ev.dir.x, dy: ev.dir.y, t: 0 });
          break;
        case 'crumble':
          this.shake = Math.max(this.shake, ev.open ? 6 : 3);
          this.burstParticles(ev.x, ev.y, ev.what === 'bones' ? '#e8dcc4' : '#8a7f9a', ev.open ? 22 : 10, 1.2);
          if (ev.what === 'crack' && !ev.open) this.floaters.push(this.floater(ev.x, ev.y, 'CRACK', '#c9b99a', 0.8));
          if (ev.open) {
            this.banner('SECRET VAULT!', '#f2c14e');
            this.burstParticles(ev.x, ev.y, '#f2c14e', 16, 1.4);
          }
          break;
        case 'vault':
          this.burstParticles(ev.x, ev.y, '#f2c14e', 24, 1.6);
          this.burstParticles(ev.x, ev.y, '#fff2c0', 10, 1);
          break;
        case 'lava':
          this.burstParticles(ev.x, ev.y, '#ff8a2a', 10, 1);
          this.burstParticles(ev.x, ev.y, '#ffd27a', 4, 0.6);
          break;
        case 'eattack':
          this.lunges.set(ev.id, { dx: ev.dir.x, dy: ev.dir.y, t: 0 });
          this.strikes.set(ev.id, 0.3);
          break;
        case 'hit': {
          this.flashes.set(ev.id, 0.12);
          const colors: Record<string, string> = {
            melee: '#ffffff', burn: '#ff8a2a', thorns: '#7f9a52', bolt: '#9fe8ff',
            burst: '#d23a46', pierce: '#ffffff', whirl: '#c9d1e0', hellfire: '#ff5a2a',
            spike: '#c9d1e0', mask: '#7f9a52', ally: '#7ee081', claw: '#ff4d5a',
          };
          const f = this.floater(ev.x, ev.y, `${ev.amount}${ev.crit ? '!' : ''}`, ev.crit ? '#f2c14e' : colors[ev.kind], 0.8);
          f.y -= (stack++ % 3) * 4;
          this.floaters.push(f);
          if (ev.crit) {
            this.shake = Math.max(this.shake, 3);
            this.hitStop = Math.max(this.hitStop, 0.07);
          }
          this.burstParticles(ev.x, ev.y, ev.kind === 'burn' ? '#ff8a2a' : '#d23a46', 4);
          break;
        }
        case 'kill': {
          const d = this.disp.get(ev.id) ?? { x: ev.x, y: ev.y };
          this.corpses.push({ kind: ev.kind, x: d.x, y: d.y, t: 0 });
          this.shatter(ev.kind, d, this.facing.get(ev.id) ?? 1, isBoss(ev) ? 1.6 : 1);
          this.burstParticles(ev.x, ev.y, ev.ally ? '#7ee081' : ev.kind === 'wraith' ? '#9fe8ff' : '#e8dcc4', 6);
          if (isBoss(ev)) this.hitStop = Math.max(this.hitStop, 0.18);
          if (ev.elite) this.burstParticles(ev.x, ev.y, ELITES[ev.elite].color, 14, 1.5);
          this.shake = Math.max(this.shake, isBoss(ev) ? 6 : 1.5);
          break;
        }
        case 'eblock':
          this.floaters.push(this.floater(ev.x, ev.y, 'BLOCK', '#9fe8ff', 0.8));
          this.burstParticles(ev.x, ev.y, '#9fe8ff', 8);
          break;
        case 'raise':
          this.burstParticles(ev.x, ev.y, '#7ee081', 16, 1.2);
          this.floaters.push(this.floater(ev.x, ev.y, 'RISE', '#7ee081', 1));
          break;
        case 'teleport':
          this.burstParticles(ev.from.x, ev.from.y, '#9b6bd6', 14);
          this.burstParticles(ev.to.x, ev.to.y, '#9b6bd6', 14);
          this.disp.set(ev.id, { x: ev.to.x, y: ev.to.y });
          break;
        case 'spike':
          this.burstParticles(ev.x, ev.y, '#c9d1e0', 6);
          break;
        case 'shadow':
          this.floaters.push(this.floater(g.player.x, g.player.y, 'UNSEEN', '#9aa3b5', 0.7));
          break;
        case 'hurt':
          this.flashes.set(PLAYER_ID, 0.15);
          this.hurtFlash = 1;
          this.shake = Math.max(this.shake, 2 + ev.amount);
          this.floaters.push(this.floater(g.player.x, g.player.y, `-${ev.amount}`, '#ff4d5a', 0.9));
          break;
        case 'heal':
          this.healFlash = 0.6;
          this.floaters.push(this.floater(g.player.x, g.player.y, `+${ev.amount}`, '#7ee081', 0.9));
          break;
        case 'maxhp':
          this.floaters.push(this.floater(g.player.x, g.player.y - 0.4, `+${ev.amount} MAX`, '#7ee081', 1.1));
          break;
        case 'dodge':
          this.floaters.push(this.floater(g.player.x, g.player.y, 'DODGE', '#c9d1e0', 0.8));
          break;
        case 'block':
          this.floaters.push(this.floater(g.player.x, g.player.y, 'BLOCK', '#9fe8ff', 0.8));
          this.burstParticles(g.player.x, g.player.y, '#9fe8ff', 8);
          break;
        case 'revive':
          this.floaters.push(this.floater(g.player.x, g.player.y, 'DEATH DENIED', '#f2c14e', 1.4));
          this.burstParticles(g.player.x, g.player.y, '#f2c14e', 20);
          break;
        case 'bolt':
          this.lines.push({ from: ev.from, to: ev.to, t: 0, life: 0.25, color: '#9fe8ff' });
          break;
        case 'shot':
          this.lines.push({ from: ev.from, to: ev.to, t: 0, life: 0.18, color: '#e8dcc4' });
          break;
        case 'burst':
          this.burstParticles(ev.x, ev.y, '#d23a46', 16, 1.8);
          break;
        case 'summon':
          this.burstParticles(ev.x, ev.y, '#7f9a52', 12);
          break;
        case 'stairs':
          this.burstParticles(g.stairs.x, g.stairs.y, '#f2c14e', 18);
          this.floaters.push(this.floater(g.stairs.x, g.stairs.y, 'DESCEND', '#f2c14e', 1.2));
          break;
        case 'potion':
          if (pulled) break;
          this.burstParticles(g.player.x, g.player.y, '#ff4d5a', 14);
          break;
        case 'magnet':
          // Each pickup lifts off and flies to the hero; its pop plays when it lands.
          pulled = true;
          for (const f of ev.from) {
            this.flying.push({ kind: f.kind, x0: f.x, y0: f.y, x1: ev.x, y1: ev.y, t: 0 });
            this.burstParticles(f.x, f.y, '#c9a8ff', 6, 0.7);
          }
          break;
        case 'spark':
          if (pulled) break;
          this.burstParticles(ev.x, ev.y, '#5fe3ff', 14);
          this.floaters.push(this.floater(ev.x, ev.y, `+${HORDE_SPARK} SURGE`, '#5fe3ff', 0.9));
          break;
        case 'timestop':
          // It comes round every few turns: a word over the hero, not a banner across the board.
          this.floaters.push(this.floater(g.player.x, g.player.y - 0.6, 'TIME STOPS', '#9fe8ff', 1));
          break;
        case 'reaperrise':
          this.banner('DEATH HAS COME FOR YOU', '#d3b0ff');
          if (!this.quiet) this.shake = 6;
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            this.particles.push({ x: ev.x * TILE + TILE / 2, y: ev.y * TILE + TILE / 2, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, color: i % 2 ? '#2a1640' : '#d3b0ff', t: 0, life: 0.8, size: 2 });
          }
          break;
        case 'ring':
          this.rings.push({ x: ev.x * TILE + TILE / 2, y: ev.y * TILE + TILE / 2, t: 0 });
          if (!this.quiet) this.shake = Math.max(this.shake, 2);
          break;
        case 'toll':
          this.floaters.push(this.floater(g.player.x, g.player.y - 0.6, 'THE BELL TOLLS', '#f2c14e', 1));
          if (!this.quiet) this.shake = Math.max(this.shake, 3);
          break;
        case 'death': {
          this.shake = 8;
          this.hitStop = 0.25;
          const d = this.disp.get(PLAYER_ID) ?? g.player;
          this.shatter(heroSprite(g.hero, g.relics, g.relicLog, this.outfit.look, this.outfit.head).normal, d, this.facing.get(PLAYER_ID) ?? 1, 1.3);
          this.burstParticles(g.player.x, g.player.y, '#d23a46', 30, 2);
          break;
        }
        case 'relic':
          claimed.push(ev.id);
          break;
      }
    }
    // Handled last: claiming a relic also starts a new floor, which clears effects.
    for (const id of claimed) this.transform(id);
  }

  /** Big centred title, used for completed combos. */
  banner(text: string, color: string) {
    this.bannerText = { text, color, t: 0 };
    this.shake = Math.max(this.shake, 4);
    for (let i = 0; i < 4; i++) this.burstParticles(1 + i * 1.6, 3, color, 10, 1.6);
  }

  private drawBanner(dt: number) {
    const b = this.bannerText;
    if (!b || this.quiet) return;
    b.t += dt;
    const life = 1.3;
    if (b.t > life) {
      this.bannerText = null;
      return;
    }
    // A banner can wait a beat before it shows (zone names follow the floor's opening).
    if (b.t < 0) return;
    const ctx = this.ctx;
    const grow = Math.min(1, b.t / 0.18);
    const fade = b.t > life - 0.4 ? (life - b.t) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    // Small and along the top edge, so it never sits over the fight.
    ctx.translate(BOARD_W / 2, 11);
    ctx.font = '13px "Pirata One", serif';
    // Long names shrink to fit the board.
    const fit = Math.min(1, (BOARD_W - 6) / ctx.measureText(b.text).width);
    ctx.scale((0.6 + 0.4 * grow) * fit, (0.6 + 0.4 * grow) * fit);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-BOARD_W / 2 / fit, -10, BOARD_W / fit, 15);
    ctx.fillStyle = '#000';
    ctx.fillText(b.text, 1, 3);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, 0, 2);
    ctx.restore();
  }

  /** The moment a relic changes the hero: a flash, a burst in the relic's colour, and its name. */
  private transform(id: RelicId) {
    const g = this.game!;
    this.flashes.set(PLAYER_ID, 0.35);
    this.burstParticles(g.player.x, g.player.y, relicColor(id), 24, 1.4);
    this.floaters.push(this.floater(g.player.x, g.player.y - 0.6, RELIC_BY_ID[id].name.toUpperCase(), relicColor(id), 1.6));
  }

  /** Ambient effects from the hero's relics, drawn around the player each frame. */
  private drawAura(g: Game, d: Pos) {
    const r = (id: RelicId) => g.r(id);
    const x = d.x * TILE + PAD;
    const y = d.y * TILE + PAD;
    const tipX = (this.facing.get(PLAYER_ID) ?? 1) < 0 ? x : x + 11;
    const tipY = y + 3 - Math.min(2, r('whetstone'));
    const emit = (chance: number, px: number, py: number, vy: number, color: string) => {
      if (Math.random() < chance) {
        this.particles.push({ x: px, y: py, vx: (Math.random() - 0.5) * 6, vy, color, t: 0, life: 0.5, size: 1 });
      }
    };
    // A cloak's faint motes, unless a proper aura is on.
    const aura = this.outfit.aura ? null : LOOK_BY_ID[this.outfit.look]?.aura;
    if (aura) emit(0.22, x + Math.random() * 12, y + 4 + Math.random() * 8, -8, aura);
    // Legendary looks from the Ossuary: a mantle trailing embers, and skulls circling your head.
    if (this.outfit.look === 'inferno') emit(0.5, x + Math.random() * 12, y + 4 + Math.random() * 8, -18, Math.random() < 0.45 ? '#ff8a2a' : Math.random() < 0.6 ? '#ffd23f' : '#d23a46');
    if (this.outfit.head === 'skullhalo') {
      const ctx = this.ctx;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 2.2 + (i * Math.PI * 2) / 3;
        const sx = Math.round(x + 5 + Math.cos(a) * 8);
        const sy = Math.round(y + 1 + Math.sin(a) * 2.5);
        ctx.globalAlpha = Math.sin(a) < 0 ? 0.55 : 1;
        ctx.fillStyle = '#e8dcc4';
        ctx.fillRect(sx, sy, 3, 2);
        ctx.fillRect(sx + 1, sy + 2, 1, 1);
        ctx.fillStyle = '#d23a46';
        ctx.fillRect(sx, sy + 1, 1, 1);
        ctx.fillRect(sx + 2, sy + 1, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // The Champion's Crown glints now and then.
    if (this.outfit.head === 'champcrown' && Math.sin(this.time * 2.2) > 0.9) emit(0.5, x + 3 + Math.random() * 6, y + Math.random() * 2, -5, Math.random() < 0.5 ? '#fff2c0' : '#f2c14e');
    if (r('ember') || r('wildfire')) emit(0.35, tipX, tipY + Math.random() * 3, -16, Math.random() < 0.5 ? '#ff8a2a' : '#f2c14e');
    if (r('frost')) emit(0.2, x + Math.random() * 12, y + Math.random() * 6, 6, '#9fe8ff');
    if (r('storm') && Math.random() < 0.06) {
      const sx = tipX + (Math.random() - 0.5) * 6;
      const sy = tipY + Math.random() * 4;
      this.lines.push({ from: { x: (sx - TILE / 2) / TILE, y: (sy - TILE / 2) / TILE }, to: { x: (tipX - TILE / 2) / TILE, y: (tipY - TILE / 2) / TILE }, t: 0, life: 0.08, color: '#9fe8ff' });
    }
    if (r('hellfire')) emit(0.15, x + 2 + Math.random() * 8, y + 11, -10, Math.random() < 0.5 ? '#d23a46' : '#701826');
    if (r('dust')) emit(0.12, x + Math.random() * 12, y + 8 + Math.random() * 4, -4, 'rgba(200,195,215,0.6)');
    if (r('phylactery') && Math.sin(this.time * 4) > 0.9) emit(0.5, x + 6, y + 6, -8, '#9fe8ff');
    if (r('pact') && g.player.hp <= 4) {
      const ctx = this.ctx;
      ctx.strokeStyle = `rgba(210, 58, 70, ${0.4 + 0.3 * Math.sin(this.time * 8)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x) - 1.5, Math.round(y) - 1.5, SPRITE_SIZE + 3, SPRITE_SIZE + 3);
    }
  }

  /** Break a slain foe into its own pixels, which scatter and fall. */
  private shatter(kind: EnemyKind | HTMLCanvasElement, d: Pos, face: number, power: number) {
    const px = spritePixels(kind);
    const x0 = d.x * TILE + PAD;
    const y0 = d.y * TILE + PAD;
    const cx = x0 + SPRITE_SIZE / 2;
    const cy = y0 + SPRITE_SIZE / 2;
    for (const p of px) {
      const x = x0 + (face < 0 ? SPRITE_SIZE - 1 - p.x : p.x);
      const y = y0 + p.y;
      const dx = x - cx + (Math.random() - 0.5) * 2;
      const dy = y - cy - 2 + (Math.random() - 0.5) * 2;
      const v = (5 + Math.random() * 7) * power;
      this.particles.push({ x, y, vx: dx * v, vy: dy * v - 25 * power, color: p.c, t: 0, life: 0.5 + Math.random() * 0.45, size: 1, grav: 2.2 });
    }
  }

  private floater(x: number, y: number, text: string, color: string, life: number): Floater {
    return { x: x * TILE + TILE / 2, y: Math.max(14, y * TILE + 2), text, color, t: 0, life };
  }

  private burstParticles(tx: number, ty: number, color: string, n: number, speed = 1) {
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (20 + Math.random() * 40) * speed;
      this.particles.push({
        x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
        color, t: 0, life: 0.35 + Math.random() * 0.35, size: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  // ---------- frame ----------

  frame(realDt: number) {
    const g = this.game;
    if (!g) return;
    // The first frame can report a slightly negative time; never run the clock backwards.
    realDt = Math.max(0, realDt);
    // Hit-stop: the world holds still for a beat on big hits.
    const dt = this.hitStop > 0 ? 0 : realDt;
    this.hitStop = Math.max(0, this.hitStop - realDt);
    this.time += dt;
    const bgKey = `${g.seed}:${g.lookFloor}:${g.terrain}:${this.bgEpoch}`;
    if (this.bgKey !== bgKey) {
      this.bg = this.buildBackground(g);
      this.bgKey = bgKey;
    }

    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07040b';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.shake > 0 && !this.quiet) {
      ctx.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
    }

    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    this.drawCandles();
    this.drawStairs(g);
    this.drawSpikes(g);
    this.drawZoneGround(g);
    this.drawFeature(g);
    if (g.potion) {
      // A pulsing red glow and rising motes so potions read as magic, not fruit.
      const cx = g.potion.x * TILE + TILE / 2;
      const cy = g.potion.y * TILE + TILE / 2;
      const pulse = 0.45 + 0.22 * Math.sin(this.time * 3.2);
      const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, TILE * 0.95);
      glow.addColorStop(0, `rgba(235, 60, 80, ${pulse})`);
      glow.addColorStop(1, 'rgba(235, 60, 80, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - TILE, cy - TILE, TILE * 2, TILE * 2);
      const bob = Math.round(Math.sin(this.time * 4) * 1);
      ctx.drawImage(sprites().potion.normal, g.potion.x * TILE + PAD, g.potion.y * TILE + PAD + bob);
      // bubbles inside the vial
      const b = (this.time * 1.6) % 1;
      ctx.fillStyle = 'rgba(255, 210, 215, 0.85)';
      ctx.fillRect(g.potion.x * TILE + PAD + 5, Math.round(g.potion.y * TILE + PAD + 9 - b * 3) + bob, 1, 1);
      if (Math.random() < dt * 5) {
        this.particles.push({
          x: cx - 4 + Math.random() * 8, y: cy - 1, vx: (Math.random() - 0.5) * 4, vy: -10 - Math.random() * 6,
          color: Math.random() < 0.5 ? '#ff6b78' : '#ffb3ba', t: 0, life: 0.7, size: 1,
        });
      }
    }
    this.drawSparks(g, dt);
    this.drawTelegraphs(g);
    this.updateCorpses(dt);

    const k = 1 - Math.exp(-dt * 22);
    const seen = new Set<number>([PLAYER_ID]);
    const ents = [...g.enemies.filter((e) => !e.dead)].sort((a, b) => a.y - b.y);
    for (const e of ents) {
      seen.add(e.id);
      const d = this.smooth(e.id, e, k);
      this.drawEnemy(g, e, d, dt);
    }
    if (g.phase !== 'dead') this.drawPet(g, k, dt);
    if (g.phase !== 'dead') {
      const pd = this.smooth(PLAYER_ID, g.player, k);
      // The rogue fades when the next step will go unseen.
      const ax = pd.x * TILE + PAD + SPRITE_SIZE / 2;
      const ay = pd.y * TILE + PAD + SPRITE_SIZE;
      drawAuraFx(this.ctx, this.outfit.aura, ax, ay, SPRITE_SIZE, this.time, 'back');
      this.drawSprite(PLAYER_ID, heroSprite(g.hero, g.relics, g.relicLog, this.outfit.look, this.outfit.head), pd, dt, g.shadowReady ? 0.55 : 1);
      drawAuraFx(this.ctx, this.outfit.aura, ax, ay, SPRITE_SIZE, this.time, 'front');
      this.drawAura(g, pd);
    }
    if (g.reaper) {
      seen.add(REAPER_ID);
      this.drawReaper(g.reaper, this.smooth(REAPER_ID, g.reaper, k * 0.5), dt, g.reaperIn);
    }
    for (const id of [...this.disp.keys()]) if (!seen.has(id)) this.disp.delete(id);

    this.drawLines(dt);
    this.drawRings(dt);
    this.drawFlying(dt);
    this.drawParticles(dt);
    this.drawMotes(dt);
    this.drawLighting(g);
    this.drawWeather(g, dt);
    this.drawFloaters(dt);
    this.drawBanner(dt);
    this.drawEnter(g, realDt);

    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.healFlash = Math.max(0, this.healFlash - dt * 2);
    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(200, 20, 40, ${this.hurtFlash * 0.28})`;
      ctx.fillRect(-10, -10, BOARD_W + 20, BOARD_H + 20);
    }
    for (const [id, t] of this.flashes) {
      if (t - dt <= 0) this.flashes.delete(id);
      else this.flashes.set(id, t - dt);
    }
  }

  private smooth(id: number, target: Pos, k: number): Pos {
    let d = this.disp.get(id);
    if (!d) {
      d = { x: target.x, y: target.y };
      this.disp.set(id, d);
    }
    if (target.x !== d.x && Math.abs(target.x - d.x) > 0.05) this.facing.set(id, target.x > d.x ? 1 : -1);
    d.x += (target.x - d.x) * k;
    d.y += (target.y - d.y) * k;
    if (Math.abs(target.x - d.x) < 0.01) d.x = target.x;
    if (Math.abs(target.y - d.y) < 0.01) d.y = target.y;
    const left = Math.max(Math.abs(target.x - d.x), Math.abs(target.y - d.y));
    const before = this.remain.get(id) ?? 0;
    if (before > 0.02 && left <= 0.02) this.landing.set(id, 0.12);
    this.remain.set(id, left);
    return d;
  }

  private drawSprite(id: number, sprite: { normal: HTMLCanvasElement; white: HTMLCanvasElement }, d: Pos, dt: number, alpha: number, bob = 0) {
    const ctx = this.ctx;
    let ox = 0;
    let oy = 0;
    const lunge = this.lunges.get(id);
    if (lunge) {
      lunge.t += dt;
      const p = lunge.t / 0.14;
      if (p >= 1) this.lunges.delete(id);
      else {
        const amt = Math.sin(p * Math.PI) * 5;
        ox = lunge.dx * amt;
        oy = lunge.dy * amt;
      }
    }
    // A little hop while stepping between tiles, a squash on landing, and slow breathing at rest.
    const left = Math.min(1, this.remain.get(id) ?? 0);
    const hop = left > 0.02 ? Math.sin(left * Math.PI) * 3 : 0;
    let land = this.landing.get(id) ?? 0;
    if (land > 0) {
      land -= dt;
      if (land <= 0) this.landing.delete(id);
      else this.landing.set(id, land);
    }
    const squash = land > 0 ? 1 : !hop && !bob && Math.sin(this.time * 2.6 + id * 1.7) > 0.55 ? 1 : 0;
    // Recoil: a hit shudders the sprite for a moment.
    if (this.flashes.has(id) && id !== PLAYER_ID) ox += Math.round((Math.random() - 0.5) * 2);
    const x = Math.round(d.x * TILE + PAD + ox);
    const y = Math.round(d.y * TILE + PAD + oy + bob - hop);
    // soft shadow, smaller while airborne
    const sw = SPRITE_SIZE - 3 - Math.round(hop) - (bob ? 2 : 0);
    ctx.globalAlpha = 0.4 * alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(Math.round(d.x * TILE + PAD + ox) + SPRITE_SIZE / 2, Math.round(d.y * TILE + PAD + oy) + SPRITE_SIZE - 0.5, sw / 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    const img = this.flashes.has(id) ? sprite.white : sprite.normal;
    const face = this.facing.get(id) ?? 1;
    const w = SPRITE_SIZE + (land > 0 ? 2 : 0);
    const h = SPRITE_SIZE - squash;
    const dx = x - (w - SPRITE_SIZE) / 2;
    const dy = y + squash;
    if (face < 0) {
      ctx.save();
      ctx.translate(dx + w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else ctx.drawImage(img, dx, dy, w, h);
    ctx.globalAlpha = 1;
    return { x, y };
  }

  /** Outside the story, an earned companion trots one step behind the hero. Looks only. */
  /** Death: drifting, dark-haloed, scythe in hand; pale while held still by a toll or stopped time. */
  private drawReaper(r: { frozen: number; waiting?: boolean }, d: Pos, dt: number, turnsLeft: number) {
    const ctx = this.ctx;
    const cx = d.x * TILE + TILE / 2;
    const cy = d.y * TILE + TILE / 2;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, TILE * 0.95);
    halo.addColorStop(0, `rgba(10, 4, 20, ${0.75 + 0.15 * pulse})`);
    halo.addColorStop(0.6, `rgba(120, 70, 190, ${0.22 + 0.12 * pulse})`);
    halo.addColorStop(1, 'rgba(120, 70, 190, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - TILE, cy - TILE, TILE * 2, TILE * 2);
    if (Math.random() < dt * 8) {
      this.particles.push({ x: cx - 5 + Math.random() * 10, y: cy + 4, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 8, color: Math.random() < 0.5 ? '#3a1d55' : '#d3b0ff', t: 0, life: 0.9, size: 1 });
    }
    const bob = r.waiting ? 0 : Math.sin(this.time * 2) * 1.5;
    this.drawSprite(REAPER_ID, sprites().reaper, d, dt, r.waiting ? 0.5 + 0.1 * pulse : r.frozen > 0 ? 0.55 : 0.95, bob);
    // Waiting: how many turns until he walks, over his head.
    if (r.waiting && turnsLeft > 0) {
      ctx.font = '7px Silkscreen, monospace';
      ctx.textAlign = 'center';
      // Over his head, or under his feet when he waits on the top row.
      const ty = cy < TILE ? cy + 14 : cy - 8;
      ctx.fillStyle = '#000';
      ctx.fillText(String(turnsLeft), cx + 0.5, ty + 0.5);
      ctx.fillStyle = turnsLeft <= 3 ? '#ff4d5a' : '#d3b0ff';
      ctx.fillText(String(turnsLeft), cx, ty);
      ctx.textAlign = 'left';
    }
  }

  private drawPet(g: Game, k: number, dt: number) {
    if (!this.pet || g.mode === 'story') return;
    const here = { x: g.player.x, y: g.player.y };
    if (!this.heroAt || this.heroAt.x !== here.x || this.heroAt.y !== here.y) {
      // Follow into the tile the hero just left; a new floor starts it at their side.
      const stepped = this.heroAt && Math.abs(this.heroAt.x - here.x) + Math.abs(this.heroAt.y - here.y) === 1;
      this.petAt = stepped ? this.heroAt : { x: here.x + (here.x > 0 ? -1 : 1), y: here.y };
      if (!stepped) this.disp.delete(PET_ID);
      this.heroAt = here;
    }
    const at = this.petAt!;
    // Never stand on a foe, a wall or the hero: just stay out of sight that turn.
    if (!g.inBounds(at.x, at.y) || g.isWall(at.x, at.y) || g.unitAt(at.x, at.y) || (at.x === here.x && at.y === here.y)) return;
    if (at.x !== here.x) this.facing.set(PET_ID, here.x > at.x ? 1 : -1);
    const frames = enemyFrames('hound');
    this.drawSprite(PET_ID, frames.idle[Math.floor(this.time * 2) % 2], this.smooth(PET_ID, at, k), dt, 0.95);
  }

  private drawEnemy(g: Game, e: Game['enemies'][number], d: Pos, dt: number) {
    const ctx = this.ctx;
    // Foes turn to face the hero (thralls face whichever way they last walked).
    if (!e.ally && g.player.x !== e.x) this.facing.set(e.id, g.player.x < e.x ? -1 : 1);
    // Animation: an idle loop (bats beat their wings fast), and the attack pose while striking.
    const frames = enemyFrames(e.kind);
    const rate = e.kind === 'bat' || e.kind === 'imp' ? 7 : e.kind === 'wraith' || e.kind === 'voideye' ? 2.2 : isBoss(e) ? 1.6 : 2;
    const left = (this.strikes.get(e.id) ?? 0) - dt;
    if (left > 0) this.strikes.set(e.id, left);
    else this.strikes.delete(e.id);
    const striking = left > 0;
    // A summoned ghost is another player's hero, see-through and named.
    const spr = e.ghost
      ? heroSprite(e.ghost.hero as HeroId, {}, [], e.ghost.look, e.ghost.head)
      : striking ? frames.attack : frames.idle[Math.floor(this.time * rate + e.id * 0.37) % 2];
    const flying = e.kind === 'bat' || e.kind === 'wraith' || e.kind === 'imp' || e.kind === 'voideye' || Boolean(e.ghost);
    const bob = flying ? Math.round(Math.sin(this.time * (e.ghost ? 2 : 6) + e.id) * 1.5) : 0;
    const onWall = g.isWall(e.x, e.y);
    const alpha = e.ghost ? 0.62 : e.kind === 'wraith' ? (onWall ? 0.45 : 0.8) : 1;
    const { x, y } = this.drawSprite(e.id, spr, d, dt, alpha, bob);
    if (e.ghost) {
      ctx.fillStyle = '#9fe8ff';
      ctx.font = '5px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(e.ghost.name.slice(0, 10), x + SPRITE_SIZE / 2, y - 2);
      ctx.textAlign = 'left';
      if (Math.random() < 0.15) this.particles.push({ x: x + 2 + Math.random() * 8, y: y + 10, vx: 0, vy: -8, color: '#9fe8ff', t: 0, life: 0.5, size: 1 });
    }
    if (e.elite) {
      ctx.strokeStyle = ELITES[e.elite].color;
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.time * 6 + e.id);
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, SPRITE_SIZE + 3, SPRITE_SIZE + 3);
      ctx.globalAlpha = 1;
      if (e.shield > 0) {
        ctx.fillStyle = '#9fe8ff';
        ctx.fillRect(x - 2, y - 2, 3, 3);
      }
    }
    if (e.ally && Math.random() < 0.08) {
      this.particles.push({ x: x + 4 + Math.random() * 4, y: y + 3, vx: 0, vy: -10, color: '#7ee081', t: 0, life: 0.4, size: 1 });
    }

    if (e.frozen > 0) {
      ctx.fillStyle = 'rgba(159, 232, 255, 0.45)';
      ctx.fillRect(x, y, SPRITE_SIZE, SPRITE_SIZE);
      ctx.strokeStyle = '#9fe8ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, SPRITE_SIZE + 1, SPRITE_SIZE + 1);
    }
    if (e.burn > 0 && Math.random() < 0.5) {
      this.particles.push({
        x: x + 2 + Math.random() * 8, y: y + 4 + Math.random() * 6, vx: 0, vy: -18,
        color: Math.random() < 0.5 ? '#ff8a2a' : '#f2c14e', t: 0, life: 0.35, size: 1,
      });
    }
    if (e.rest > 0 && (e.kind === 'brute' || isBoss(e))) {
      ctx.fillStyle = '#9aa3b5';
      ctx.font = '6px Silkscreen, monospace';
      ctx.fillText('z', x + SPRITE_SIZE - 1, y + 2 - Math.sin(this.time * 3));
    }
    // health pips
    const pips = Math.min(e.maxHp, 6);
    const per = e.maxHp / pips;
    const total = pips * 2 + (pips - 1);
    const px = Math.round(d.x * TILE + (TILE - total) / 2);
    const py = Math.round(d.y * TILE + TILE - 1);
    for (let i = 0; i < pips; i++) {
      ctx.fillStyle = e.hp > i * per ? (e.ally ? '#7ee081' : '#d23a46') : '#2a1820';
      ctx.fillRect(px + i * 3, py, 2, 1);
    }
  }

  private drawTelegraphs(g: Game) {
    const ctx = this.ctx;
    const pulse = 0.25 + 0.2 * Math.sin(this.time * 10);
    // Boss attacks landing next turn: plague (green) and bolts (violet).
    for (const w of g.warnings) {
      const px = w.x * TILE;
      const py = w.y * TILE;
      ctx.fillStyle = w.kind === 'plague' ? `rgba(127, 154, 82, ${pulse + 0.1})` : `rgba(155, 107, 214, ${pulse + 0.1})`;
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = w.kind === 'plague' ? '#b5e07a' : '#d3b0ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
      if (Math.random() < 0.05) {
        this.particles.push({ x: px + 3 + Math.random() * 10, y: py + 12, vx: 0, vy: -14, color: w.kind === 'plague' ? '#b5e07a' : '#d3b0ff', t: 0, life: 0.4, size: 1 });
      }
    }
    for (const e of g.enemies) {
      if (e.dead || !e.aim) continue;
      for (const p of g.shotPath(e)) {
        ctx.fillStyle = `rgba(210, 58, 70, ${pulse})`;
        ctx.fillRect(p.x * TILE + 1, p.y * TILE + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = 'rgba(255, 90, 100, 0.8)';
        const cx = p.x * TILE + TILE / 2;
        const cy = p.y * TILE + TILE / 2;
        if (e.aim.x) ctx.fillRect(cx - 3, cy, 6, 1);
        else ctx.fillRect(cx, cy - 3, 1, 6);
      }
    }
  }

  private drawSpikes(g: Game) {
    const ctx = this.ctx;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!g.isSpike(x, y)) continue;
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = '#120c18';
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const sx = px + 3 + i * 4;
            const sy = py + 4 + j * 4;
            ctx.fillStyle = '#5d667a';
            ctx.fillRect(sx, sy, 2, 2);
            ctx.fillStyle = '#c9d1e0';
            ctx.fillRect(sx, sy - 1, 1, 1);
          }
        }
      }
    }
  }

  /** Horde sparks: a spinning cyan shard that tops up the surge bar. */
  private drawSparks(g: Game, dt: number) {
    // Sparks still being pulled in are drawn in flight, not on the hero's tile.
    const landing = this.flying.filter((f) => f.kind === 'spark').length;
    let skip = landing;
    for (const p of g.sparks) {
      if (skip > 0 && p.x === g.player.x && p.y === g.player.y) {
        skip--;
        continue;
      }
      const cx = p.x * TILE + TILE / 2;
      const cy = p.y * TILE + TILE / 2 + Math.round(Math.sin(this.time * 4 + p.x) * 1);
      this.drawSparkAt(cx, cy, p.x + p.y, 1);
      if (Math.random() < dt * 4) {
        this.particles.push({ x: cx - 3 + Math.random() * 6, y: cy, vx: (Math.random() - 0.5) * 4, vy: -12 - Math.random() * 6, color: '#9fefff', t: 0, life: 0.6, size: 1 });
      }
    }
  }

  /** A spark: a glowing cyan diamond that narrows and widens as it turns. */
  private drawSparkAt(cx: number, cy: number, seed: number, size: number) {
    const ctx = this.ctx;
    const pulse = 0.4 + 0.2 * Math.sin(this.time * 5 + seed);
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, TILE * 0.85 * size);
    glow.addColorStop(0, `rgba(95, 227, 255, ${pulse})`);
    glow.addColorStop(1, 'rgba(95, 227, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - TILE, cy - TILE, TILE * 2, TILE * 2);
    const w = Math.max(1, Math.round(3 * size * Math.abs(Math.cos(this.time * 3 + seed))));
    const tall = Math.max(2, Math.round(4 * size));
    ctx.fillStyle = '#5fe3ff';
    for (let i = -tall; i <= tall; i++) {
      const half = Math.round(w * (1 - Math.abs(i) / (tall + 1)));
      ctx.fillRect(Math.round(cx) - half, Math.round(cy) + i, half * 2 || 1, 1);
    }
    ctx.fillStyle = '#e8fbff';
    ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 2, 1, 2);
  }

  /** Grave Magnet pulls: each pickup speeds up as it nears the hero, trailing light, then pops. */
  private drawFlying(dt: number) {
    const ctx = this.ctx;
    for (const f of this.flying) {
      f.t = Math.min(1, f.t + dt / FLIGHT_S);
      // Slow to leave, fast to arrive: the pull of the magnet.
      const e = f.t * f.t * f.t;
      // A little arc so it reads as flying, not sliding.
      const lift = Math.sin(Math.PI * f.t) * 0.6;
      const tx = f.x0 + (f.x1 - f.x0) * e;
      const ty = f.y0 + (f.y1 - f.y0) * e - lift;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const color = f.kind === 'potion' ? '#ff6b78' : f.kind === 'spark' ? '#9fefff' : f.kind === 'shrine' ? '#d23a46' : f.kind === 'fountain' ? '#9fe8ff' : '#f2c14e';
      // The trail.
      if (Math.random() < 0.9) this.particles.push({ x: cx + (Math.random() - 0.5) * 4, y: cy + (Math.random() - 0.5) * 4, vx: 0, vy: 0, color, t: 0, life: 0.35, size: 1 });
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35 * (1 - f.t * 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x0 * TILE + TILE / 2, f.y0 * TILE + TILE / 2);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
      if (f.kind === 'spark') this.drawSparkAt(cx, cy, f.x0, 1);
      else if (f.kind === 'potion') ctx.drawImage(sprites().potion.normal, Math.round(cx - TILE / 2 + PAD), Math.round(cy - TILE / 2 + PAD));
      else {
        // A chest, shrine or fountain: a glowing block shrinking into the hero.
        const size = Math.round(TILE * (0.7 - 0.3 * e));
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
        ctx.restore();
      }
      if (f.t >= 1) {
        this.burstParticles(f.x1, f.y1, color, 14, 1.2);
        if (f.kind === 'spark') this.floaters.push(this.floater(f.x1, f.y1, `+${HORDE_SPARK} SURGE`, '#5fe3ff', 0.9));
        if (f.kind === 'potion') this.healFlash = Math.max(this.healFlash, 0.5);
      }
    }
    this.flying = this.flying.filter((f) => f.t < 1);
  }

  private drawFeature(g: Game) {
    const f = g.feature;
    if (!f) return;
    // A chest or shrine the magnet is still pulling in shows in flight instead.
    if (this.flying.some((p) => p.kind === f.kind)) return;
    const ctx = this.ctx;
    const px = f.x * TILE;
    const py = f.y * TILE;
    const glow = f.used ? 0 : 0.4 + 0.3 * Math.sin(this.time * 3);
    const color = f.kind === 'shrine' ? '#d23a46' : f.kind === 'chest' ? '#f2c14e' : f.kind === 'forge' ? '#7fb4ff' : '#9fe8ff';
    if (!f.used) {
      ctx.fillStyle = color;
      ctx.globalAlpha = glow * 0.35;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = f.used ? 0.45 : 1;
    if (f.kind === 'shrine') {
      ctx.fillStyle = '#3a3346';
      ctx.fillRect(px + 4, py + 6, 8, 8);
      ctx.fillStyle = '#4b4259';
      ctx.fillRect(px + 3, py + 5, 10, 2);
      ctx.fillStyle = '#701826';
      ctx.fillRect(px + 6, py + 8, 4, 4);
      ctx.fillStyle = '#d23a46';
      ctx.fillRect(px + 7, py + 3, 2, 3);
    } else if (f.kind === 'chest') {
      ctx.fillStyle = '#5a3d22';
      ctx.fillRect(px + 3, py + 6, 10, 7);
      ctx.fillStyle = '#7a5532';
      ctx.fillRect(px + 3, py + 5, 10, 3);
      ctx.fillStyle = '#5d667a';
      ctx.fillRect(px + 3, py + 8, 10, 1);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(px + 7, py + 8, 2, 2);
    } else if (f.kind === 'forge') {
      // an anvil over blue soulfire
      const flick = f.used ? 0 : Math.round(Math.sin(this.time * 9) * 1);
      ctx.fillStyle = '#1f4a63';
      ctx.fillRect(px + 4, py + 12, 8, 2);
      ctx.fillStyle = '#5fe3ff';
      ctx.fillRect(px + 5, py + 9 - flick, 2, 3 + flick);
      ctx.fillRect(px + 9, py + 10 + flick, 2, 2 - flick);
      ctx.fillStyle = '#5d667a';
      ctx.fillRect(px + 3, py + 4, 10, 3);
      ctx.fillRect(px + 6, py + 7, 4, 3);
      ctx.fillStyle = '#c9d1e0';
      ctx.fillRect(px + 3, py + 4, 10, 1);
      ctx.fillRect(px + 1, py + 5, 2, 1);
    } else {
      ctx.fillStyle = '#4b4259';
      ctx.fillRect(px + 2, py + 8, 12, 5);
      ctx.fillStyle = '#3e8db5';
      ctx.fillRect(px + 3, py + 9, 10, 2);
      ctx.fillStyle = '#9fe8ff';
      ctx.fillRect(px + 7, py + 3 + Math.round(Math.sin(this.time * 5)), 2, 5);
    }
    ctx.globalAlpha = 1;
  }

  private drawStairs(g: Game) {
    const ctx = this.ctx;
    const x = g.stairs.x * TILE;
    const y = g.stairs.y * TILE;
    if (g.stairsOpen) {
      const glow = 0.5 + 0.3 * Math.sin(this.time * 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      const steps = ['#5a4a3a', '#43372b', '#2e251d', '#1a140f'];
      steps.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(x + 2 + i, y + 2 + i * 3, TILE - 4 - i * 2, 3);
      });
      ctx.strokeStyle = `rgba(242, 193, 78, ${glow})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(x + TILE / 2, y + TILE / 2, 2, x + TILE / 2, y + TILE / 2, TILE * 1.3);
      halo.addColorStop(0, `rgba(242, 193, 78, ${0.25 * glow})`);
      halo.addColorStop(1, 'rgba(242, 193, 78, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - TILE, y - TILE, TILE * 3, TILE * 3);
      ctx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.15) {
        this.particles.push({ x: x + 2 + Math.random() * (TILE - 4), y: y + TILE - 3, vx: 0, vy: -14 - Math.random() * 8, color: Math.random() < 0.5 ? '#f2c14e' : '#fff2c0', t: 0, life: 0.7, size: 1, grav: -0.05 });
      }
    } else {
      ctx.fillStyle = '#1b1422';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#2c2236';
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      const glow = 0.35 + 0.25 * Math.sin(this.time * 2);
      ctx.fillStyle = `rgba(210, 58, 70, ${glow})`;
      // sealing rune
      ctx.fillRect(x + 7, y + 4, 2, 8);
      ctx.fillRect(x + 5, y + 6, 6, 1);
      ctx.fillRect(x + 5, y + 10, 6, 1);
    }
  }

  private updateCorpses(dt: number) {
    const ctx = this.ctx;
    this.corpses = this.corpses.filter((c) => (c.t += dt) < 0.09);
    for (const c of this.corpses) {
      const p = c.t / 0.09;
      ctx.globalAlpha = 1 - p;
      const spr = sprites()[c.kind];
      const x = Math.round(c.x * TILE + PAD);
      const y = Math.round(c.y * TILE + PAD + p * 4);
      ctx.drawImage(spr.white, x, y);
      ctx.globalAlpha = 1;
    }
  }

  /** Bronze shockwaves from the Bell-Ringer's toll, out past the tiles next door. */
  private drawRings(dt: number) {
    if (!this.rings.length) return;
    const ctx = this.ctx;
    this.rings = this.rings.filter((r) => (r.t += dt) < 0.6);
    for (const r of this.rings) {
      const p = r.t / 0.6;
      for (const [lag, color] of [[0, '#f2c14e'], [0.12, '#c9a24a']] as const) {
        const q = Math.max(0, p - lag);
        if (!q) continue;
        ctx.globalAlpha = (1 - q) * 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 - q;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 4 + q * TILE * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawLines(dt: number) {
    const ctx = this.ctx;
    this.lines = this.lines.filter((l) => (l.t += dt) < l.life);
    for (const l of this.lines) {
      const a = 1 - l.t / l.life;
      const x1 = l.from.x * TILE + TILE / 2;
      const y1 = l.from.y * TILE + TILE / 2;
      const x2 = l.to.x * TILE + TILE / 2;
      const y2 = l.to.y * TILE + TILE / 2;
      ctx.strokeStyle = l.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      // jagged path for lightning
      const segs = 5;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const j = l.color === '#9fe8ff' ? (Math.random() - 0.5) * 6 : 0;
        ctx.lineTo(x1 + (x2 - x1) * t + j, y1 + (y2 - y1) * t + j);
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx;
    this.particles = this.particles.filter((p) => (p.t += dt) < p.life);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * (p.grav ?? 1) * dt;
      p.vx *= 0.96;
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloaters(dt: number) {
    if (this.quiet) {
      this.floaters = [];
      return;
    }
    const ctx = this.ctx;
    this.floaters = this.floaters.filter((f) => (f.t += dt) < f.life);
    ctx.font = '8px Silkscreen, monospace';
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      const p = f.t / f.life;
      const y = Math.round(f.y - p * 8);
      const half = ctx.measureText(f.text).width / 2;
      const x = Math.round(Math.min(BOARD_W - half - 1, Math.max(half + 1, f.x)));
      ctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      ctx.fillStyle = '#000';
      ctx.fillText(f.text, x + 1, y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /** Wall candles: flickering flames that throw a warm glow on the floor around them. */
  private drawCandles() {
    const ctx = this.ctx;
    for (const c of this.candles) {
      const f = Math.sin(this.time * 11 + c.phase) * 0.5 + Math.sin(this.time * 23 + c.phase * 2) * 0.3;
      const r = 26 + f * 4;
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(c.x + 1, c.y, 1, c.x + 1, c.y + 6, r);
      glow.addColorStop(0, 'rgba(255, 160, 70, 0.32)');
      glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2 + 6);
      ctx.globalCompositeOperation = 'source-over';
      const tall = f > 0.2 ? 1 : 0;
      ctx.fillStyle = '#ff8a2a';
      ctx.fillRect(c.x, c.y - 1 - tall, 2, 2 + tall);
      ctx.fillStyle = '#fff2c0';
      ctx.fillRect(c.x + (f > 0 ? 1 : 0), c.y, 1, 1);
      if (Math.random() < 0.02) {
        this.particles.push({ x: c.x + 1, y: c.y - 2, vx: (Math.random() - 0.5) * 3, vy: -8, color: '#f2c14e', t: 0, life: 0.6, size: 1, grav: -0.1 });
      }
    }
  }

  /** Dust drifting through the light. */
  private drawMotes(dt: number) {
    if (this.quiet) return;
    const ctx = this.ctx;
    if (this.motes.length < 14 && Math.random() < dt * 4) {
      this.motes.push({ x: Math.random() * BOARD_W, y: Math.random() * BOARD_H, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2, t: 0, life: 4 + Math.random() * 4 });
    }
    this.motes = this.motes.filter((m) => (m.t += dt) < m.life);
    ctx.fillStyle = this.game ? zoneLook(this.game.zone).mote : '#e8dcc4';
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(this.time + m.life) * 1.5) * dt;
      m.y += m.vy * dt;
      ctx.globalAlpha = Math.sin((m.t / m.life) * Math.PI) * 0.35;
      ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** A new floor opens out of the dark, from the hero outward. */
  private drawEnter(g: Game, dt: number) {
    if (this.enter >= 1) return;
    this.enter = Math.min(1, this.enter + dt / 0.55);
    const ctx = this.ctx;
    const p = 1 - Math.pow(1 - this.enter, 3);
    const cx = g.player.x * TILE + TILE / 2;
    const cy = g.player.y * TILE + TILE / 2;
    const r = Math.max(1, 6 + p * Math.hypot(BOARD_W, BOARD_H));
    ctx.save();
    ctx.fillStyle = '#07040b';
    ctx.beginPath();
    ctx.rect(-10, -10, BOARD_W + 20, BOARD_H + 20);
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = `rgba(242, 193, 78, ${0.5 * (1 - p)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawLighting(g: Game) {
    const ctx = this.ctx;
    const d = this.disp.get(PLAYER_ID) ?? g.player;
    const cx = d.x * TILE + TILE / 2;
    const cy = d.y * TILE + TILE / 2;
    const flicker = Math.sin(this.time * 9) * 1.5 + Math.sin(this.time * 23) * 0.8;
    // Candles and lanterns push the darkness back.
    const light = Math.min(5, g.r('candle') + g.r('lantern'));
    const zone = zoneLook(g.zone);
    // In the Abyss the dark closes right in; candles and lanterns push it back.
    const dark = zone.id === 'abyss';
    const inner = dark ? 8 + light * 6 + flicker : 18 + light * 4 + flicker;
    const outer = dark ? 40 + light * 12 + flicker * 2 : 95 + light * 14 + flicker * 2;
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    grad.addColorStop(0, zone.light[0]);
    grad.addColorStop(dark ? 0.2 : 0.35, 'rgba(10, 4, 16, 0)');
    grad.addColorStop(1, dark ? 'rgba(3, 1, 8, 0.9)' : zone.light[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(-10, -10, BOARD_W + 20, BOARD_H + 20);
    if (this.healFlash > 0) {
      ctx.fillStyle = `rgba(126, 224, 129, ${this.healFlash * 0.15})`;
      ctx.fillRect(-10, -10, BOARD_W + 20, BOARD_H + 20);
    }
  }

  // ---------- background ----------

  private buildBackground(g: Game): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = BOARD_W;
    c.height = BOARD_H;
    const ctx = c.getContext('2d')!;
    const rng = mulberry32(hashSeed(g.seed, 'decor', g.lookFloor));
    this.candles = [];
    const boss = g.isBossFloor();
    const zone = zoneLook(g.zone);
    const floorTones = boss ? zone.bossFloor : zone.floor;
    const wall = zone.wall;
    // Real walls only: bone piles block like walls but are drawn as heaps.
    const wallAt = (x: number, y: number) => g.walls[y * W + x];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        if (wallAt(x, y)) continue;
        ctx.fillStyle = floorTones[Math.floor(rng() * floorTones.length)];
        ctx.fillRect(px, py, TILE, TILE);
        if (zone.floorStyle === 'dirt') {
          // packed earth: no flagstones, just grit
          for (let k = 0; k < 5; k++) {
            ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,240,210,0.05)';
            ctx.fillRect(px + Math.floor(rng() * 15), py + Math.floor(rng() * 15), 1, 1);
          }
        } else if (zone.floorStyle === 'boards') {
          // floorboards, with staggered joints
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          for (let b = 3; b < TILE; b += 4) ctx.fillRect(px, py + b, TILE, 1);
          for (let b = 0; b < 4; b++) ctx.fillRect(px + ((x * 5 + y * 3 + b * 7) % 13) + 1, py + b * 4, 1, 3);
          ctx.fillStyle = 'rgba(255,220,170,0.04)';
          ctx.fillRect(px, py, TILE, 1);
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(px, py + TILE - 1, TILE, 1);
          ctx.fillRect(px + TILE - 1, py, 1, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(px, py, TILE, 1);
        }
        const r = rng();
        if (r < 0.12) {
          // crack
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          let cx = px + 3 + Math.floor(rng() * 8);
          let cy = py + 3 + Math.floor(rng() * 8);
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(cx, cy, 1, 1);
            cx += rng() < 0.5 ? 1 : -1;
            cy += 1;
          }
        } else if (r < 0.18 && zone.id !== 'crypt') {
          this.zoneDecor(ctx, zone.id, px, py, rng);
        } else if (r < 0.18) {
          // scattered bones
          ctx.fillStyle = '#6d6455';
          const bx = px + 3 + Math.floor(rng() * 7);
          const by = py + 4 + Math.floor(rng() * 7);
          ctx.fillRect(bx, by, 4, 1);
          ctx.fillRect(bx - 1, by - 1, 1, 1);
          ctx.fillRect(bx + 4, by + 1, 1, 1);
        } else if (r < 0.21) {
          // blood stain
          ctx.fillStyle = 'rgba(112, 24, 38, 0.6)';
          const bx = px + 4 + Math.floor(rng() * 5);
          const by = py + 4 + Math.floor(rng() * 5);
          ctx.fillRect(bx, by, 3, 2);
          ctx.fillRect(bx + 1, by - 1, 2, 4);
        }
      }
    }
    // walls drawn after floor so their drop shadows fall onto it
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!wallAt(x, y)) continue;
        const px = x * TILE;
        const py = y * TILE;
        const open = y + 1 < H && !wallAt(x, y + 1);
        // drop shadow onto the floor below, fading out
        if (open) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(px, py + TILE, TILE, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(px, py + TILE + 2, TILE, 2);
        }
        ctx.fillStyle = wall.base;
        ctx.fillRect(px, py, TILE, TILE);
        // lit top edge, and a darker front face where the wall meets open floor
        ctx.fillStyle = wall.top;
        ctx.fillRect(px, py, TILE, 1);
        ctx.fillStyle = wall.face;
        ctx.fillRect(px, py + 1, TILE, 2);
        if (open) {
          ctx.fillStyle = wall.front;
          ctx.fillRect(px, py + TILE - 4, TILE, 4);
          ctx.fillStyle = wall.edge;
          ctx.fillRect(px, py + TILE - 1, TILE, 1);
        }
        ctx.fillStyle = wall.brick;
        if (zone.wallStyle === 'plank') {
          // upright boards with a nail or two
          for (let bx = px + 3; bx < px + TILE; bx += 4) ctx.fillRect(bx, py + 3, 1, open ? 9 : 13);
          ctx.fillStyle = '#a89a80';
          ctx.fillRect(px + 1 + (x % 2) * 4, py + 5, 1, 1);
          ctx.fillRect(px + 9 + (y % 2) * 4, py + 10, 1, 1);
        } else if (zone.wallStyle === 'rock') {
          // rough-hewn rock, no courses
          for (let k = 0; k < 4; k++) ctx.fillRect(px + Math.floor(rng() * 12), py + 4 + Math.floor(rng() * 8), 2 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 2));
          ctx.fillStyle = wall.top;
          ctx.fillRect(px + 2 + Math.floor(rng() * 10), py + 4 + Math.floor(rng() * 6), 2, 1);
        } else {
          // bricks
          for (let row = 0; row < 3; row++) {
            const by = py + 4 + row * 4;
            ctx.fillRect(px, by + 3, TILE, 1);
            const off = row % 2 ? 4 : 0;
            for (let bx = px + off; bx < px + TILE; bx += 8) ctx.fillRect(bx, by, 1, 3);
          }
        }
        if (rng() < 0.25) {
          ctx.fillStyle = wall.moss;
          ctx.fillRect(px + 2 + Math.floor(rng() * 10), py + 3, 3, 2);
        }
        if (rng() < 0.15) {
          // wall candle; its flame and glow are drawn live
          const cx = px + 6 + Math.floor(rng() * 4);
          ctx.fillStyle = '#e8dcc4';
          ctx.fillRect(cx, py + 6, 2, 4);
          ctx.fillStyle = '#c9b99a';
          ctx.fillRect(cx, py + 9, 2, 1);
          this.candles.push({ x: cx, y: py + 5, phase: rng() * 10 });
        }
      }
    }
    this.drawStaticGround(ctx, g);
    this.deepDetail(ctx, g, wallAt);
    return c;
  }

  /** The deeper passes' own floor detail: roots, frost, blood, stars or gold. */
  private deepDetail(ctx: CanvasRenderingContext2D, g: Game, wallAt: (x: number, y: number) => boolean) {
    const look = deepLook(g.zone);
    if (!look) return;
    // Its own random stream, so the first pass's decoration stays exactly as it was.
    const rng = mulberry32(hashSeed(g.seed, 'deeplook', g.lookFloor));
    const px1 = (x: number, y: number, c: string, a = 1) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        const wall = wallAt(x, y);
        const under = wall && y + 1 < H && !wallAt(x, y + 1);
        switch (look.weather) {
          case 'spores':
            if (!wall && rng() < 0.35) {
              // a root wandering across the stone, and now and then a pale mushroom
              let rx = px + Math.floor(rng() * TILE);
              let ry = py + Math.floor(rng() * 4);
              for (let i = 0; i < 9; i++) {
                px1(rx, ry, '#2f4a1c', 0.9);
                rx += rng() < 0.5 ? 1 : -1;
                ry += 1;
              }
            }
            if (!wall && rng() < 0.18) {
              const mx = px + 3 + Math.floor(rng() * 9);
              const my = py + 5 + Math.floor(rng() * 8);
              px1(mx, my + 1, '#c9c3b2');
              px1(mx - 1, my, '#b5e07a');
              px1(mx, my, '#d8f5a0');
              px1(mx + 1, my, '#b5e07a');
            }
            if (under) for (let i = 0; i < 3; i++) px1(px + 2 + Math.floor(rng() * 12), py + TILE - 1 + Math.floor(rng() * 3), '#4f7a2a', 0.8);
            break;
          case 'snow':
            if (!wall) {
              for (let i = 0; i < 4; i++) px1(px + Math.floor(rng() * TILE), py + Math.floor(rng() * TILE), '#e8f6ff', 0.25 + rng() * 0.3);
              if (rng() < 0.2) {
                // a frosted crack
                let fx = px + 3 + Math.floor(rng() * 8);
                let fy = py + 3 + Math.floor(rng() * 6);
                for (let i = 0; i < 5; i++) {
                  px1(fx, fy, '#c9f2ff', 0.7);
                  fx += rng() < 0.5 ? 1 : 0;
                  fy += rng() < 0.5 ? 1 : 0;
                }
              }
            }
            if (under) {
              // icicles hanging from the wall's front
              for (let ix = px + 1; ix < px + TILE; ix += 3) {
                const len = 1 + Math.floor(rng() * 3);
                for (let k = 0; k < len; k++) px1(ix, py + TILE + k, '#dff4ff', 0.85 - k * 0.2);
              }
            }
            if (wall) px1(px + Math.floor(rng() * TILE), py, '#ffffff', 0.9);
            break;
          case 'rain':
            if (!wall && rng() < 0.16) {
              // a dark pool with a bright rim
              const bx = px + 3 + Math.floor(rng() * 6);
              const by = py + 5 + Math.floor(rng() * 6);
              ctx.globalAlpha = 0.75;
              ctx.fillStyle = '#4a0d16';
              ctx.fillRect(bx, by, 5, 2);
              ctx.fillRect(bx + 1, by - 1, 3, 4);
              px1(bx + 1, by - 1, '#ff4d5a', 0.6);
            }
            if (under) for (let i = 0; i < 2; i++) {
              const dx = px + 2 + Math.floor(rng() * 12);
              const len = 1 + Math.floor(rng() * 3);
              for (let k = 0; k < len; k++) px1(dx, py + TILE - 2 + k, '#8a1f2c', 0.9);
            }
            break;
          case 'stars':
            if (!wall) {
              const n = 1 + Math.floor(rng() * 4);
              for (let i = 0; i < n; i++) px1(px + Math.floor(rng() * TILE), py + Math.floor(rng() * TILE), rng() < 0.3 ? '#b07cff' : '#ffffff', 0.35 + rng() * 0.5);
            }
            break;
          case 'sparks':
            if (!wall && rng() < 0.14) {
              // a little cluster of gold crystal
              const cx = px + 3 + Math.floor(rng() * 9);
              const cy = py + 6 + Math.floor(rng() * 7);
              px1(cx, cy - 2, '#fff2c0');
              px1(cx, cy - 1, '#ffd76a');
              px1(cx - 1, cy, '#b8860b');
              px1(cx, cy, '#ffd76a');
              px1(cx + 1, cy, '#b8860b');
              px1(cx + 2, cy - 1, '#ffd76a');
            }
            if (!wall && rng() < 0.2) px1(px + Math.floor(rng() * TILE), py + Math.floor(rng() * TILE), '#ffe9a8', 0.8);
            if (wall && rng() < 0.3) px1(px + 2 + Math.floor(rng() * 12), py + 4 + Math.floor(rng() * 8), '#ffd76a', 0.9);
            break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- the deeper passes' weather ----------

  private weather: { x: number; y: number; vx: number; vy: number; t: number; life: number; size: number }[] = [];
  private weatherKind: Weather | null = null;

  /** Spores, snow, red rain, twinkling stars or rising gold, over everything. */
  private drawWeather(g: Game, dt: number) {
    if (this.quiet) return;
    const look = deepLook(g.zone);
    if (!look) {
      this.weather = [];
      this.weatherKind = null;
      return;
    }
    if (this.weatherKind !== look.weather) {
      this.weather = [];
      this.weatherKind = look.weather;
    }
    const ctx = this.ctx;
    const kind = look.weather;
    const cap = { spores: 18, snow: 34, rain: 26, stars: 22, sparks: 16 }[kind];
    const rate = { spores: 4, snow: 12, rain: 30, stars: 6, sparks: 5 }[kind];
    if (this.weather.length < cap && Math.random() < dt * rate) {
      const r = Math.random;
      const p =
        kind === 'snow'
          ? { x: r() * (BOARD_W + 20) - 10, y: -2, vx: -2 + r() * 4, vy: 6 + r() * 6, life: 30, size: r() < 0.25 ? 2 : 1 }
          : kind === 'rain'
            ? { x: r() * (BOARD_W + 30), y: -4, vx: -8, vy: 70 + r() * 30, life: 3, size: 3 }
            : kind === 'stars'
              ? { x: r() * BOARD_W, y: r() * BOARD_H, vx: 0, vy: 0, life: 1.5 + r() * 2.5, size: r() < 0.2 ? 2 : 1 }
              : { x: r() * BOARD_W, y: BOARD_H * (0.4 + r() * 0.6), vx: (r() - 0.5) * 3, vy: -(3 + r() * 4), life: 4 + r() * 3, size: 1 };
      this.weather.push({ ...p, t: 0 });
    }
    this.weather = this.weather.filter((p) => (p.t += dt) < p.life && p.y < BOARD_H + 6);
    for (const p of this.weather) {
      p.x += (p.vx + (kind === 'snow' || kind === 'spores' ? Math.sin(this.time * 1.3 + p.life * 7) * 2 : 0)) * dt;
      p.y += p.vy * dt;
      const fade = Math.sin(Math.min(1, p.t / p.life) * Math.PI);
      if (kind === 'rain') {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#ff4d5a';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, p.size);
      } else if (kind === 'stars') {
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = p.life > 3 ? '#d0b8ff' : '#ffffff';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      } else {
        ctx.globalAlpha = (kind === 'snow' ? 0.8 : fade * 0.7);
        ctx.fillStyle = kind === 'spores' ? (p.life > 5.5 ? '#d8f5a0' : '#8fc95a') : kind === 'sparks' ? (Math.sin(this.time * 12 + p.life) > 0 ? '#fff2c0' : '#ffd76a') : '#ffffff';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }
    // The Starless dark flickers violet now and then.
    if (kind === 'stars') {
      const f = Math.max(0, Math.sin(this.time * 0.9) * Math.sin(this.time * 2.3) - 0.85) * 4;
      if (f > 0) {
        ctx.globalAlpha = f * 0.12;
        ctx.fillStyle = '#7b5cff';
        ctx.fillRect(-10, -10, BOARD_W + 20, BOARD_H + 20);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** A little zone flavour on the odd floor tile. */
  private zoneDecor(ctx: CanvasRenderingContext2D, zone: string, px: number, py: number, rng: () => number) {
    const ox = px + 3 + Math.floor(rng() * 7);
    const oy = py + 4 + Math.floor(rng() * 7);
    if (zone === 'flooded') {
      // a shallow puddle catching the light
      ctx.fillStyle = 'rgba(95, 227, 255, 0.12)';
      ctx.fillRect(ox - 1, oy, 6, 2);
      ctx.fillStyle = 'rgba(160, 235, 255, 0.25)';
      ctx.fillRect(ox, oy, 2, 1);
    } else if (zone === 'ossuary') {
      // a skull
      ctx.fillStyle = '#c9b99a';
      ctx.fillRect(ox, oy, 4, 3);
      ctx.fillRect(ox + 1, oy + 3, 2, 1);
      ctx.fillStyle = '#201c18';
      ctx.fillRect(ox + 1, oy + 1, 1, 1);
      ctx.fillRect(ox + 3, oy + 1, 1, 1);
    } else if (zone === 'kennel') {
      // straw, and a paw print
      ctx.fillStyle = '#b8964a';
      ctx.fillRect(ox - 1, oy + 1, 4, 1);
      ctx.fillRect(ox + 2, oy, 3, 1);
      ctx.fillRect(ox, oy + 2, 2, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(ox + 5, oy + 3, 2, 2);
      ctx.fillRect(ox + 4, oy + 2, 1, 1);
      ctx.fillRect(ox + 7, oy + 2, 1, 1);
    } else if (zone === 'well') {
      // moss, and a drip pooling
      ctx.fillStyle = '#3f7a4a';
      ctx.fillRect(ox, oy, 3, 2);
      ctx.fillRect(ox + 1, oy - 1, 2, 1);
      ctx.fillStyle = 'rgba(150, 240, 210, 0.2)';
      ctx.fillRect(ox + 4, oy + 3, 3, 1);
    } else if (zone === 'mine') {
      // loose rubble, and now and then a lump of blue coal
      ctx.fillStyle = '#4a423b';
      ctx.fillRect(ox, oy + 2, 2, 2);
      ctx.fillRect(ox + 3, oy + 3, 1, 1);
      if (rng() < 0.4) {
        ctx.fillStyle = '#1f4a63';
        ctx.fillRect(ox + 4, oy, 3, 2);
        ctx.fillStyle = '#5fe3ff';
        ctx.fillRect(ox + 5, oy, 1, 1);
      }
    } else if (zone === 'cellar') {
      // a spilt-ale stain, or a lost cork
      if (rng() < 0.5) {
        ctx.fillStyle = 'rgba(168, 120, 31, 0.35)';
        ctx.fillRect(ox - 1, oy, 5, 2);
        ctx.fillRect(ox, oy - 1, 3, 4);
      } else {
        ctx.fillStyle = '#7a5532';
        ctx.fillRect(ox, oy, 2, 2);
      }
    } else if (zone === 'burning') {
      // a seam of embers
      ctx.fillStyle = 'rgba(255, 110, 40, 0.55)';
      let cx = ox;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(cx, oy + i, 1, 1);
        cx += rng() < 0.5 ? 1 : -1;
      }
    } else {
      // pinpricks of violet, like stars in a well
      ctx.fillStyle = 'rgba(176, 124, 255, 0.5)';
      ctx.fillRect(ox, oy, 1, 1);
      ctx.fillRect(ox + 3, oy + 2, 1, 1);
    }
  }

  /** Water, lava beds, bone piles and the cracked wall, baked into the background. */
  private drawStaticGround(ctx: CanvasRenderingContext2D, g: Game) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        const n = (dx: number, dy: number, test: (x: number, y: number) => boolean) => g.inBounds(x + dx, y + dy) && test(x + dx, y + dy);
        if (g.isWater(x, y)) {
          const wet = (a: number, b: number) => g.isWater(a, b);
          ctx.fillStyle = '#12384a';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#185068';
          ctx.fillRect(px + 1, py + 2, TILE - 2, TILE - 4);
          // a lip of wet stone where the pool ends
          ctx.fillStyle = 'rgba(160, 235, 255, 0.35)';
          if (!n(0, -1, wet)) ctx.fillRect(px, py, TILE, 1);
          if (!n(-1, 0, wet)) ctx.fillRect(px, py, 1, TILE);
          if (!n(1, 0, wet)) ctx.fillRect(px + TILE - 1, py, 1, TILE);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          if (!n(0, 1, wet)) ctx.fillRect(px, py + TILE - 1, TILE, 1);
        }
        if (g.isLava(x, y)) {
          ctx.fillStyle = '#3a0d06';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#7a1e08';
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = '#c2410c';
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          // a cooled crust
          ctx.fillStyle = '#2a0a05';
          ctx.fillRect(px + 2, py + 6, 4, 1);
          ctx.fillRect(px + 9, py + 10, 4, 1);
          ctx.fillRect(px + 10, py + 3, 2, 1);
        }
        if (g.bones[y * W + x]) {
          // a heap of bones and skulls
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(px + 1, py + 12, TILE - 2, 3);
          ctx.fillStyle = '#8a7d63';
          ctx.fillRect(px + 2, py + 8, 12, 5);
          ctx.fillRect(px + 4, py + 5, 8, 3);
          ctx.fillStyle = '#c9b99a';
          ctx.fillRect(px + 3, py + 9, 4, 1);
          ctx.fillRect(px + 9, py + 7, 4, 1);
          ctx.fillRect(px + 5, py + 11, 6, 1);
          ctx.fillStyle = '#e8dcc4';
          ctx.fillRect(px + 6, py + 4, 4, 3);
          ctx.fillRect(px + 2, py + 7, 3, 2);
          ctx.fillStyle = '#201c18';
          ctx.fillRect(px + 7, py + 5, 1, 1);
          ctx.fillRect(px + 9, py + 5, 1, 1);
          ctx.fillRect(px + 3, py + 8, 1, 1);
        }
        const sec = g.secret;
        if (sec && sec.x === x && sec.y === y) {
          // the crack that gives the vault away
          // pale chipped edges, then the dark split
          const cx = px + 7;
          ctx.fillStyle = 'rgba(255, 240, 210, 0.25)';
          ctx.fillRect(cx - 1, py + 2, 1, 7);
          ctx.fillRect(cx + 2, py + 5, 1, 4);
          ctx.fillStyle = '#0d0812';
          ctx.fillRect(cx, py + 2, 1, 3);
          ctx.fillRect(cx + 1, py + 5, 1, 2);
          ctx.fillRect(cx, py + 7, 1, 2);
          ctx.fillRect(cx - 1, py + 9, 1, 3);
          ctx.fillRect(cx + 2, py + 6, 2, 1);
          ctx.fillRect(cx - 3, py + 10, 2, 1);
          if (sec.hp < 2) {
            ctx.fillRect(cx + 3, py + 3, 1, 3);
            ctx.fillRect(cx - 4, py + 6, 2, 1);
            ctx.fillRect(cx + 1, py + 11, 3, 1);
          }
        }
      }
    }
  }

  /** The live layer of zone ground: shimmering water, seething lava, a draught at the crack, and the vault's prize. */
  private drawZoneGround(g: Game) {
    const ctx = this.ctx;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        if (g.isWater(x, y)) {
          const t = this.time * 1.6 + x * 0.9 + y * 1.3;
          ctx.fillStyle = 'rgba(160, 235, 255, 0.35)';
          ctx.fillRect(px + 2 + Math.round((Math.sin(t) + 1) * 3), py + 5, 4, 1);
          ctx.fillRect(px + 7 + Math.round((Math.cos(t * 0.8) + 1) * 2), py + 10, 3, 1);
        }
        if (g.isLava(x, y)) {
          const pulse = 0.35 + 0.25 * Math.sin(this.time * 3 + x + y * 2);
          ctx.globalCompositeOperation = 'lighter';
          const glow = ctx.createRadialGradient(px + 8, py + 8, 1, px + 8, py + 8, TILE);
          glow.addColorStop(0, `rgba(255, 140, 40, ${pulse})`);
          glow.addColorStop(1, 'rgba(255, 80, 20, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(px - 8, py - 8, TILE * 2, TILE * 2);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#ffb35a';
          ctx.fillRect(px + 5 + Math.round(Math.sin(this.time * 2 + x) * 2), py + 8, 2, 1);
          if (!this.quiet && Math.random() < 0.03) {
            this.particles.push({ x: px + 4 + Math.random() * 8, y: py + 6 + Math.random() * 6, vx: (Math.random() - 0.5) * 4, vy: -12 - Math.random() * 8, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffd27a', t: 0, life: 0.6, size: 1, grav: -0.2 });
          }
        }
      }
    }
    const sec = g.secret;
    if (sec) {
      // Light from the vault seeps through the crack.
      const px = sec.x * TILE + 7;
      const py = sec.y * TILE;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(this.time * 2.4);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(px, py + 2, 1, 3);
      ctx.fillRect(px + 1, py + 5, 1, 2);
      ctx.fillRect(px, py + 7, 1, 2);
      ctx.fillRect(px - 1, py + 9, 1, 3);
      ctx.globalAlpha = 1;
    }
    if (sec && !this.quiet && Math.random() < 0.04) {
      // dust sighing out of the crack
      this.particles.push({ x: sec.x * TILE + 8, y: sec.y * TILE + 4 + Math.random() * 8, vx: (Math.random() - 0.5) * 6, vy: 4 + Math.random() * 4, color: '#8a7f9a', t: 0, life: 0.8, size: 1, grav: -0.3 });
    }
    const v = g.vault;
    if (v) {
      const px = v.x * TILE;
      const py = v.y * TILE;
      const pulse = 0.4 + 0.25 * Math.sin(this.time * 4);
      const glow = ctx.createRadialGradient(px + 8, py + 8, 1, px + 8, py + 8, TILE);
      glow.addColorStop(0, `rgba(242, 193, 78, ${pulse})`);
      glow.addColorStop(1, 'rgba(242, 193, 78, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(px - 8, py - 8, TILE * 2, TILE * 2);
      // a gilded reliquary
      const bob = Math.round(Math.sin(this.time * 3));
      ctx.fillStyle = '#7a5532';
      ctx.fillRect(px + 3, py + 7 + bob, 10, 6);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(px + 3, py + 6 + bob, 10, 2);
      ctx.fillRect(px + 7, py + 8 + bob, 2, 3);
      ctx.fillStyle = '#fff2c0';
      ctx.fillRect(px + 4, py + 6 + bob, 2, 1);
      if (!this.quiet && Math.random() < 0.08) {
        this.particles.push({ x: px + 3 + Math.random() * 10, y: py + 6, vx: (Math.random() - 0.5) * 3, vy: -10, color: '#f2c14e', t: 0, life: 0.7, size: 1, grav: -0.1 });
      }
    }
  }
}
