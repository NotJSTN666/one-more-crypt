// Canvas renderer. Reads game state every frame and turns game events into
// short-lived effects (damage numbers, particles, screen shake).

import { Game, H, W, type EnemyKind, type GameEvent, type Pos } from './game';
import { hashSeed, mulberry32 } from './rng';
import { heroSprite, relicColor } from './hero';
import { RELIC_BY_ID, type RelicId } from './relics';
import { SPRITE_SIZE, sprites } from './sprites';

export const TILE = 16;
const BOARD_W = W * TILE;
const BOARD_H = H * TILE;
const PAD = (TILE - SPRITE_SIZE) / 2;

interface Floater { x: number; y: number; text: string; color: string; t: number; life: number }
interface Particle { x: number; y: number; vx: number; vy: number; color: string; t: number; life: number; size: number }
interface Line { from: Pos; to: Pos; t: number; life: number; color: string }
interface Corpse { kind: EnemyKind; x: number; y: number; t: number }
interface Lunge { dx: number; dy: number; t: number }

const PLAYER_ID = 0;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private game: Game | null = null;
  private bg: HTMLCanvasElement | null = null;
  private bgFloor = -1;
  private disp = new Map<number, Pos>();
  private flashes = new Map<number, number>();
  private lunges = new Map<number, Lunge>();
  private floaters: Floater[] = [];
  private particles: Particle[] = [];
  private lines: Line[] = [];
  private corpses: Corpse[] = [];
  private shake = 0;
  private hurtFlash = 0;
  private healFlash = 0;
  private time = 0;

  constructor(private canvas: HTMLCanvasElement) {
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
    this.disp.clear();
    this.floaters = [];
    this.particles = [];
    this.lines = [];
    this.corpses = [];
    this.bgFloor = -1;
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
    for (const ev of events) {
      switch (ev.t) {
        case 'floor':
          this.disp.clear();
          this.corpses = [];
          this.lines = [];
          this.floaters = [];
          this.floaters.push(this.floater(3, 3, ev.floor % 5 === 0 ? 'THE WARDEN' : `FLOOR ${ev.floor}`, '#f2c14e', 1.6));
          break;
        case 'pattack':
          this.lunges.set(PLAYER_ID, { dx: ev.dir.x, dy: ev.dir.y, t: 0 });
          break;
        case 'eattack':
          this.lunges.set(ev.id, { dx: ev.dir.x, dy: ev.dir.y, t: 0 });
          break;
        case 'hit': {
          this.flashes.set(ev.id, 0.12);
          const colors: Record<string, string> = {
            melee: '#ffffff', burn: '#ff8a2a', thorns: '#7f9a52', bolt: '#9fe8ff',
            burst: '#d23a46', pierce: '#ffffff', whirl: '#c9d1e0', hellfire: '#ff5a2a',
          };
          const f = this.floater(ev.x, ev.y, `${ev.amount}${ev.crit ? '!' : ''}`, ev.crit ? '#f2c14e' : colors[ev.kind], 0.8);
          f.y -= (stack++ % 3) * 4;
          this.floaters.push(f);
          if (ev.crit) this.shake = Math.max(this.shake, 3);
          this.burstParticles(ev.x, ev.y, ev.kind === 'burn' ? '#ff8a2a' : '#d23a46', 4);
          break;
        }
        case 'kill': {
          const d = this.disp.get(ev.id) ?? { x: ev.x, y: ev.y };
          this.corpses.push({ kind: ev.kind, x: d.x, y: d.y, t: 0 });
          this.burstParticles(ev.x, ev.y, ev.kind === 'wraith' ? '#9fe8ff' : '#e8dcc4', 10);
          this.shake = Math.max(this.shake, ev.kind === 'boss' ? 6 : 1.5);
          break;
        }
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
          this.burstParticles(g.player.x, g.player.y, '#d23a46', 10);
          break;
        case 'death':
          this.shake = 8;
          this.burstParticles(g.player.x, g.player.y, '#d23a46', 30, 2);
          break;
        case 'relic':
          claimed.push(ev.id);
          break;
      }
    }
    // Handled last: claiming a relic also starts a new floor, which clears effects.
    for (const id of claimed) this.transform(id);
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
    const tipX = x + 11;
    const tipY = y + 3 - Math.min(2, r('whetstone'));
    const emit = (chance: number, px: number, py: number, vy: number, color: string) => {
      if (Math.random() < chance) {
        this.particles.push({ x: px, y: py, vx: (Math.random() - 0.5) * 6, vy, color, t: 0, life: 0.5, size: 1 });
      }
    };
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

  frame(dt: number) {
    const g = this.game;
    if (!g) return;
    this.time += dt;
    if (this.bgFloor !== g.floor) {
      this.bg = this.buildBackground(g);
      this.bgFloor = g.floor;
    }

    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07040b';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.shake > 0) {
      ctx.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
    }

    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    this.drawStairs(g);
    if (g.potion) {
      const bob = Math.round(Math.sin(this.time * 4) * 1);
      ctx.drawImage(sprites().potion.normal, g.potion.x * TILE + PAD, g.potion.y * TILE + PAD + bob);
    }
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
    if (g.phase !== 'dead') {
      const pd = this.smooth(PLAYER_ID, g.player, k);
      this.drawSprite(PLAYER_ID, heroSprite(g.relics, g.relicLog), pd, dt, 1);
      this.drawAura(g, pd);
    }
    for (const id of [...this.disp.keys()]) if (!seen.has(id)) this.disp.delete(id);

    this.drawLines(dt);
    this.drawParticles(dt);
    this.drawLighting(g);
    this.drawFloaters(dt);

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
    d.x += (target.x - d.x) * k;
    d.y += (target.y - d.y) * k;
    if (Math.abs(target.x - d.x) < 0.01) d.x = target.x;
    if (Math.abs(target.y - d.y) < 0.01) d.y = target.y;
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
    const x = Math.round(d.x * TILE + PAD + ox);
    const y = Math.round(d.y * TILE + PAD + oy + bob);
    // shadow
    ctx.globalAlpha = 0.35 * alpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 2, y + SPRITE_SIZE - 1, SPRITE_SIZE - 4, 2);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.flashes.has(id) ? sprite.white : sprite.normal, x, y);
    ctx.globalAlpha = 1;
    return { x, y };
  }

  private drawEnemy(g: Game, e: Game['enemies'][number], d: Pos, dt: number) {
    const ctx = this.ctx;
    const spr = sprites()[e.kind];
    const flying = e.kind === 'bat' || e.kind === 'wraith';
    const bob = flying ? Math.round(Math.sin(this.time * 6 + e.id) * 1.5) : 0;
    const onWall = g.isWall(e.x, e.y);
    const alpha = e.kind === 'wraith' ? (onWall ? 0.45 : 0.8) : 1;
    const { x, y } = this.drawSprite(e.id, spr, d, dt, alpha, bob);

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
    if (e.rest > 0 && (e.kind === 'brute' || e.kind === 'boss')) {
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
      ctx.fillStyle = e.hp > i * per ? '#d23a46' : '#2a1820';
      ctx.fillRect(px + i * 3, py, 2, 1);
    }
  }

  private drawTelegraphs(g: Game) {
    const ctx = this.ctx;
    const pulse = 0.25 + 0.2 * Math.sin(this.time * 10);
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
    this.corpses = this.corpses.filter((c) => (c.t += dt) < 0.35);
    for (const c of this.corpses) {
      const p = c.t / 0.35;
      ctx.globalAlpha = 1 - p;
      const spr = sprites()[c.kind];
      const x = Math.round(c.x * TILE + PAD);
      const y = Math.round(c.y * TILE + PAD + p * 4);
      ctx.drawImage(p < 0.3 ? spr.white : spr.normal, x, y);
      ctx.globalAlpha = 1;
    }
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
      p.vy += 90 * dt;
      p.vx *= 0.96;
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloaters(dt: number) {
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

  private drawLighting(g: Game) {
    const ctx = this.ctx;
    const d = this.disp.get(PLAYER_ID) ?? g.player;
    const cx = d.x * TILE + TILE / 2;
    const cy = d.y * TILE + TILE / 2;
    const flicker = Math.sin(this.time * 9) * 1.5 + Math.sin(this.time * 23) * 0.8;
    // Candles and lanterns push the darkness back.
    const light = Math.min(5, g.r('candle') + g.r('lantern'));
    const grad = ctx.createRadialGradient(cx, cy, 18 + light * 4 + flicker, cx, cy, 95 + light * 14 + flicker * 2);
    grad.addColorStop(0, 'rgba(255, 170, 80, 0.06)');
    grad.addColorStop(0.35, 'rgba(10, 4, 16, 0)');
    grad.addColorStop(1, 'rgba(6, 2, 10, 0.62)');
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
    const rng = mulberry32(hashSeed(g.seed, 'decor', g.floor));
    const boss = g.isBossFloor();
    const floorTones = boss ? ['#2a1418', '#2f171c', '#261216'] : ['#1d1824', '#211b29', '#1a1520'];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        if (g.isWall(x, y)) continue;
        ctx.fillStyle = floorTones[Math.floor(rng() * floorTones.length)];
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(px, py + TILE - 1, TILE, 1);
        ctx.fillRect(px + TILE - 1, py, 1, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(px, py, TILE, 1);
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
        if (!g.isWall(x, y)) continue;
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(px, py + TILE, TILE, 3);
        ctx.fillStyle = '#3a3346';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#4b4259';
        ctx.fillRect(px, py, TILE, 3);
        // bricks
        ctx.fillStyle = '#28222f';
        for (let row = 0; row < 3; row++) {
          const by = py + 4 + row * 4;
          ctx.fillRect(px, by + 3, TILE, 1);
          const off = row % 2 ? 4 : 0;
          for (let bx = px + off; bx < px + TILE; bx += 8) ctx.fillRect(bx, by, 1, 3);
        }
        if (rng() < 0.25) {
          ctx.fillStyle = '#3f5a3a';
          ctx.fillRect(px + 2 + Math.floor(rng() * 10), py + 3, 3, 2);
        }
        if (rng() < 0.15) {
          // wall candle
          const cx = px + 6 + Math.floor(rng() * 4);
          ctx.fillStyle = '#e8dcc4';
          ctx.fillRect(cx, py + 6, 2, 4);
          ctx.fillStyle = '#f2c14e';
          ctx.fillRect(cx, py + 4, 2, 2);
        }
      }
    }
    return c;
  }
}
