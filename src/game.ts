// Pure game logic: no DOM, no rendering. The renderer reads state and consumes
// `events` to play effects.

import { RELICS, RELIC_BY_ID, RARITY_WEIGHT, type RelicDef, type RelicId } from './relics';
import { hashSeed, mulberry32, randInt, weightedPick, type Rng } from './rng';

export const W = 7;
export const H = 7;

export interface Pos {
  x: number;
  y: number;
}

export type EnemyKind = 'ghoul' | 'bat' | 'archer' | 'brute' | 'wraith' | 'boss';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  burn: number;
  burnDmg: number;
  frozen: number;
  marked: boolean;
  aim: Pos | null;
  /** Turns left before a slow enemy can act again. */
  rest: number;
  turns: number;
  dead: boolean;
}

export const ENEMY_INFO: Record<EnemyKind, { name: string; hp: number; dmg: number }> = {
  ghoul: { name: 'Ghoul', hp: 2, dmg: 1 },
  bat: { name: 'Blood Bat', hp: 1, dmg: 1 },
  archer: { name: 'Skeleton Archer', hp: 1, dmg: 2 },
  brute: { name: 'Grave Brute', hp: 4, dmg: 3 },
  wraith: { name: 'Wraith', hp: 2, dmg: 1 },
  boss: { name: 'The Bone Warden', hp: 10, dmg: 2 },
};

export type HitKind = 'melee' | 'burn' | 'thorns' | 'bolt' | 'burst' | 'pierce' | 'whirl' | 'hellfire';

export type GameEvent =
  | { t: 'pattack'; dir: Pos }
  | { t: 'eattack'; id: number; dir: Pos }
  | { t: 'hit'; id: number; x: number; y: number; amount: number; kind: HitKind; crit?: boolean }
  | { t: 'kill'; id: number; x: number; y: number; kind: EnemyKind }
  | { t: 'hurt'; amount: number }
  | { t: 'heal'; amount: number }
  | { t: 'maxhp'; amount: number }
  | { t: 'dodge' }
  | { t: 'block' }
  | { t: 'revive' }
  | { t: 'bolt'; from: Pos; to: Pos }
  | { t: 'burst'; x: number; y: number }
  | { t: 'shot'; from: Pos; to: Pos; hit: boolean }
  | { t: 'summon'; x: number; y: number }
  | { t: 'stairs' }
  | { t: 'potion' }
  | { t: 'floor'; floor: number }
  | { t: 'death' };

export type Mode = 'daily' | 'endless';
export type Phase = 'play' | 'choose' | 'dead';

export interface Offer {
  relics: RelicDef[];
  restHeal: number;
}

const DIRS: Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
const DIRS8: Pos[] = [...DIRS, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];

export const START: Pos = { x: 3, y: 6 };
const BASE_HP = 10;
const POTION_HEAL = 3;
const REST_HEAL = 4;
const MAX_ENEMIES = 9;

export class Game {
  readonly mode: Mode;
  readonly seed: number;
  readonly dailyNo: number;

  floor = 0;
  walls: boolean[] = [];
  stairs: Pos = { x: 3, y: 0 };
  stairsOpen = false;
  potion: Pos | null = null;
  enemies: Enemy[] = [];
  player = { x: START.x, y: START.y, hp: BASE_HP, maxHp: BASE_HP };
  relics: Partial<Record<RelicId, number>> = {};
  /** Relics in the order taken, for the share card. */
  relicLog: RelicId[] = [];
  phase: Phase = 'play';
  offer: Offer | null = null;
  kills = 0;
  turns = 0;
  killedBy = '';
  events: GameEvent[] = [];

  private harvestBonus = 0;
  private shieldCharges = 0;
  private phylacteryUsed = false;
  private nextId = 1;
  private combat: Rng;

  constructor(mode: Mode, seed: number, dailyNo = 0) {
    this.mode = mode;
    this.seed = seed;
    this.dailyNo = dailyNo;
    this.combat = mulberry32(hashSeed(seed, 'combat'));
    this.enterFloor(1);
  }

  // ---------- queries ----------

  r(id: RelicId): number {
    return this.relics[id] ?? 0;
  }

  get atk(): number {
    return 1 + this.r('whetstone') + 2 * this.r('crown') + this.harvestBonus;
  }

  get shield(): number {
    return this.shieldCharges;
  }

  isWall(x: number, y: number): boolean {
    return this.walls[y * W + x];
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < W && y < H;
  }

  enemyAt(x: number, y: number): Enemy | undefined {
    return this.enemies.find((e) => !e.dead && e.x === x && e.y === y);
  }

  get alive(): Enemy[] {
    return this.enemies.filter((e) => !e.dead);
  }

  isBossFloor(f = this.floor): boolean {
    return f % 5 === 0;
  }

  // ---------- floor generation ----------

  private enterFloor(floor: number) {
    this.floor = floor;
    const rng = mulberry32(hashSeed(this.seed, 'floor', floor));
    this.generateLayout(rng);
    this.spawnEnemies(rng);
    this.potion = null;
    if (!this.isBossFloor() && floor > 1 && rng() < 0.4) {
      const spot = this.randomFreeTile(rng, 2);
      if (spot) this.potion = spot;
    }
    this.player.x = START.x;
    this.player.y = START.y;
    this.stairsOpen = false;
    this.harvestBonus = 0;
    this.shieldCharges = this.r('mirror');
    this.events.push({ t: 'floor', floor });

    const candle = this.r('candle');
    if (candle) this.heal(candle * 2);
    const hell = this.r('hellfire');
    if (hell) {
      for (const e of this.alive) this.damageEnemy(e, hell * 2, 'hellfire');
      if (this.player.hp > 1) {
        this.player.hp -= 1;
        this.events.push({ t: 'hurt', amount: 1 });
      }
      this.checkCleared();
    }
  }

  private generateLayout(rng: Rng) {
    for (let attempt = 0; attempt < 200; attempt++) {
      this.walls = new Array(W * H).fill(false);
      this.stairs = { x: randInt(rng, 1, W - 2), y: randInt(rng, 0, 1) };
      const count = randInt(rng, 4, 9);
      const mirror = rng() < 0.5;
      for (let i = 0; i < count; i++) {
        const x = randInt(rng, 0, W - 1);
        const y = randInt(rng, 1, H - 2);
        this.walls[y * W + x] = true;
        if (mirror) this.walls[y * W + (W - 1 - x)] = true;
      }
      this.walls[START.y * W + START.x] = false;
      this.walls[this.stairs.y * W + this.stairs.x] = false;
      if (this.allFloorConnected()) return;
    }
    this.walls = new Array(W * H).fill(false);
  }

  private allFloorConnected(): boolean {
    const dist = this.distanceMap(START, false);
    for (let i = 0; i < W * H; i++) {
      if (!this.walls[i] && dist[i] < 0) return false;
    }
    return true;
  }

  private spawnEnemies(rng: Rng) {
    this.enemies = [];
    const f = this.floor;
    if (this.isBossFloor()) {
      const tier = f / 5;
      const spot = { x: 3, y: 1 };
      this.walls[spot.y * W + spot.x] = false;
      const boss = this.makeEnemy('boss', spot.x, spot.y);
      boss.maxHp = boss.hp = 10 + 6 * (tier - 1) + 4 * Math.max(0, tier - 3) ** 2;
      boss.dmg = 2 + Math.floor((tier - 1) / 2) + Math.max(0, tier - 3);
      for (let i = 0; i < tier; i++) {
        const s = this.randomFreeTile(rng, 3);
        if (s) this.makeEnemy(i % 2 ? 'archer' : 'ghoul', s.x, s.y);
      }
      return;
    }
    const roster: { kind: EnemyKind; from: number; w: number }[] = [
      { kind: 'ghoul', from: 1, w: 10 },
      { kind: 'bat', from: 1, w: 7 },
      { kind: 'archer', from: 2, w: 6 },
      { kind: 'brute', from: 3, w: 4 },
      { kind: 'wraith', from: 4, w: 5 },
    ];
    const pool = roster.filter((p) => f >= p.from);
    const count = Math.min(MAX_ENEMIES - 1, 2 + Math.floor(f / 2));
    for (let i = 0; i < count; i++) {
      const spot = this.randomFreeTile(rng, 3);
      if (!spot) break;
      const kind = weightedPick(rng, pool, (p) => p.w).kind;
      this.makeEnemy(kind, spot.x, spot.y);
    }
  }

  private makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const info = ENEMY_INFO[kind];
    // Gentle scaling early, then steep past floor 15 so broken builds still meet an end.
    const late = Math.max(0, this.floor - 15);
    const hpBonus = kind === 'boss' ? 0 : Math.floor((this.floor - 1) / 4) + late;
    const dmgBonus = kind === 'boss' ? 0 : Math.floor((this.floor - 1) / 6) + Math.floor(late / 3);
    const e: Enemy = {
      id: this.nextId++,
      kind,
      x,
      y,
      hp: info.hp + hpBonus,
      maxHp: info.hp + hpBonus,
      dmg: info.dmg + dmgBonus,
      burn: 0,
      burnDmg: 0,
      frozen: 0,
      marked: false,
      aim: null,
      rest: kind === 'brute' || kind === 'boss' ? 1 : 0,
      turns: 0,
      dead: false,
    };
    this.enemies.push(e);
    return e;
  }

  private randomFreeTile(rng: Rng, minDistFromStart: number): Pos | null {
    const free: Pos[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.isWall(x, y)) continue;
        if (Math.abs(x - START.x) + Math.abs(y - START.y) < minDistFromStart) continue;
        if (x === this.stairs.x && y === this.stairs.y) continue;
        if (this.enemyAt(x, y)) continue;
        if (this.potion && this.potion.x === x && this.potion.y === y) continue;
        free.push({ x, y });
      }
    }
    return free.length ? free[Math.floor(rng() * free.length)] : null;
  }

  /** BFS distances from `from` over non-wall tiles; -1 for unreachable. */
  distanceMap(from: Pos, throughWalls: boolean): number[] {
    const dist = new Array(W * H).fill(-1);
    const queue: Pos[] = [from];
    dist[from.y * W + from.x] = 0;
    while (queue.length) {
      const p = queue.shift()!;
      const d = dist[p.y * W + p.x];
      for (const dir of DIRS) {
        const nx = p.x + dir.x;
        const ny = p.y + dir.y;
        if (!this.inBounds(nx, ny) || dist[ny * W + nx] >= 0) continue;
        if (!throughWalls && this.isWall(nx, ny)) continue;
        dist[ny * W + nx] = d + 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return dist;
  }

  // ---------- player actions ----------

  /** Returns true if the action consumed a turn. */
  act(dx: number, dy: number): boolean {
    if (this.phase !== 'play') return false;
    if (dx === 0 && dy === 0) {
      this.endTurn();
      return true;
    }
    const tx = this.player.x + dx;
    const ty = this.player.y + dy;
    if (!this.inBounds(tx, ty)) return false;
    const target = this.enemyAt(tx, ty);
    if (target) {
      this.playerAttack(target, { x: dx, y: dy });
      this.endTurn();
      return true;
    }
    if (this.isWall(tx, ty)) return false;

    this.player.x = tx;
    this.player.y = ty;
    if (this.potion && this.potion.x === tx && this.potion.y === ty) {
      this.potion = null;
      this.events.push({ t: 'potion' });
      this.heal(POTION_HEAL + 2 * this.r('flask'));
    }
    if (this.stairsOpen && tx === this.stairs.x && ty === this.stairs.y) {
      this.turns++;
      this.descend();
      return true;
    }
    this.endTurn();
    return true;
  }

  private playerAttack(e: Enemy, dir: Pos) {
    this.events.push({ t: 'pattack', dir });
    let dmg = this.atk;
    if (this.r('mark') && !e.marked) {
      dmg += 2 * this.r('mark');
      e.marked = true;
    }
    if (this.r('shatter') && e.frozen > 0) dmg += 3 * this.r('shatter');
    if (this.r('pact') && this.player.hp <= 4) dmg *= this.r('pact') + 1;
    let crit = false;
    if (this.r('dice') && this.combat() < 0.15 * this.r('dice')) {
      dmg *= 3;
      crit = true;
    }
    this.damageEnemy(e, dmg, 'melee', crit);

    if (!e.dead) {
      if (this.r('ember')) {
        e.burn = 3;
        e.burnDmg = Math.max(e.burnDmg, this.r('ember'));
      }
      if (this.r('frost')) e.frozen = Math.max(e.frozen, this.r('frost'));
    }
    for (let k = 1; k <= this.r('pike'); k++) {
      const behind = this.enemyAt(e.x + dir.x * k, e.y + dir.y * k);
      if (behind) this.damageEnemy(behind, dmg, 'pierce');
    }
    const whirl = this.r('whirl');
    if (whirl) {
      for (const d of DIRS) {
        const other = this.enemyAt(this.player.x + d.x, this.player.y + d.y);
        if (other && other !== e) this.damageEnemy(other, whirl, 'whirl');
      }
    }
    this.checkCleared();
  }

  private descend() {
    this.phase = 'choose';
    this.offer = this.makeOffer();
  }

  private makeOffer(): Offer {
    const rng = mulberry32(hashSeed(this.seed, 'relic', this.floor));
    const pool = RELICS.filter((r) => this.r(r.id) < r.maxStack);
    const n = 3 + this.r('coin');
    const picks: RelicDef[] = [];
    while (picks.length < n && pool.length) {
      const choice = weightedPick(rng, pool, (r) => RARITY_WEIGHT[r.rarity]);
      picks.push(choice);
      pool.splice(pool.indexOf(choice), 1);
    }
    return { relics: picks, restHeal: REST_HEAL };
  }

  /** Take a relic from the offer (index), or rest when index is -1. */
  choose(index: number) {
    if (this.phase !== 'choose' || !this.offer) return;
    if (index < 0) {
      this.heal(this.offer.restHeal);
    } else {
      const relic = this.offer.relics[index];
      if (!relic) return;
      this.addRelic(relic.id);
    }
    this.offer = null;
    this.phase = 'play';
    this.enterFloor(this.floor + 1);
  }

  addRelic(id: RelicId) {
    this.relics[id] = this.r(id) + 1;
    this.relicLog.push(id);
    if (id === 'heart') {
      this.changeMaxHp(3);
      this.heal(3);
    } else if (id === 'crown') {
      this.changeMaxHp(-3);
    }
  }

  private changeMaxHp(delta: number) {
    this.player.maxHp = Math.max(1, this.player.maxHp + delta);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    if (delta > 0) this.events.push({ t: 'maxhp', amount: delta });
  }

  private heal(amount: number) {
    const before = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    const healed = this.player.hp - before;
    if (healed > 0) this.events.push({ t: 'heal', amount: healed });
  }

  // ---------- damage ----------

  private damageEnemy(e: Enemy, amount: number, kind: HitKind, crit = false) {
    if (e.dead || amount <= 0) return;
    e.hp -= amount;
    this.events.push({ t: 'hit', id: e.id, x: e.x, y: e.y, amount, kind, crit });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.dead = true;
    e.hp = 0;
    this.kills++;
    this.events.push({ t: 'kill', id: e.id, x: e.x, y: e.y, kind: e.kind });

    if (this.r('fang')) this.heal(this.r('fang'));
    if (this.r('lantern') && this.kills % 6 === 0) {
      this.changeMaxHp(this.r('lantern'));
      this.heal(this.r('lantern'));
    }
    if (this.r('harvest')) this.harvestBonus += this.r('harvest');

    if (this.r('wildfire') && e.burn > 0) {
      for (const d of DIRS8) {
        const n = this.enemyAt(e.x + d.x, e.y + d.y);
        if (n) {
          n.burn = 3;
          n.burnDmg = Math.max(n.burnDmg, e.burnDmg);
        }
      }
    }
    if (this.r('bloom')) {
      this.events.push({ t: 'burst', x: e.x, y: e.y });
      for (const d of DIRS8) {
        const n = this.enemyAt(e.x + d.x, e.y + d.y);
        if (n) this.damageEnemy(n, this.r('bloom'), 'burst');
      }
    }
    if (this.r('storm')) {
      const targets = this.alive;
      const strikes = 1 + this.r('conductor');
      let from: Pos = { x: e.x, y: e.y };
      for (let i = 0; i < strikes && targets.length; i++) {
        const idx = Math.floor(this.combat() * targets.length);
        const t = targets.splice(idx, 1)[0];
        this.events.push({ t: 'bolt', from, to: { x: t.x, y: t.y } });
        from = { x: t.x, y: t.y };
        this.damageEnemy(t, this.r('storm') + 1, 'bolt');
      }
    }
  }

  private hurtPlayer(amount: number, src: Enemy | null) {
    if (this.phase === 'dead') return;
    const dust = this.r('dust');
    if (dust && this.combat() < Math.min(0.6, dust * 0.2)) {
      this.events.push({ t: 'dodge' });
      return;
    }
    if (this.shieldCharges > 0) {
      this.shieldCharges--;
      this.events.push({ t: 'block' });
      return;
    }
    this.player.hp -= amount;
    this.events.push({ t: 'hurt', amount });
    if (src && this.r('thorns')) this.damageEnemy(src, this.r('thorns'), 'thorns');
    if (this.player.hp <= 0) {
      if (this.r('phylactery') && !this.phylacteryUsed) {
        this.phylacteryUsed = true;
        this.player.hp = 1;
        this.events.push({ t: 'revive' });
        return;
      }
      this.player.hp = 0;
      this.phase = 'dead';
      this.killedBy = src ? ENEMY_INFO[src.kind].name : 'the dark';
      this.events.push({ t: 'death' });
    }
  }

  private checkCleared() {
    if (!this.stairsOpen && this.alive.length === 0) {
      this.stairsOpen = true;
      this.events.push({ t: 'stairs' });
    }
  }

  // ---------- enemy turn ----------

  private endTurn() {
    this.turns++;
    const dist = this.distanceMap(this.player, false);
    const ghostDist = this.distanceMap(this.player, true);
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      if (e.burn > 0) {
        e.burn--;
        this.damageEnemy(e, e.burnDmg, 'burn');
        if (e.dead) continue;
      }
      if (e.frozen > 0) {
        e.frozen--;
        continue;
      }
      this.enemyAct(e, e.kind === 'wraith' ? ghostDist : dist);
      if (this.phase === 'dead') break;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.checkCleared();
  }

  private adjacentToPlayer(e: Enemy): boolean {
    return Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) === 1;
  }

  private attackPlayer(e: Enemy) {
    this.events.push({ t: 'eattack', id: e.id, dir: { x: this.player.x - e.x, y: this.player.y - e.y } });
    this.hurtPlayer(e.dmg, e);
  }

  private enemyAct(e: Enemy, dist: number[]) {
    e.turns++;
    switch (e.kind) {
      case 'ghoul':
        if (this.adjacentToPlayer(e)) this.attackPlayer(e);
        else this.stepToward(e, dist, false);
        break;
      case 'bat':
        if (this.adjacentToPlayer(e)) this.attackPlayer(e);
        else if (this.combat() < 0.5) this.stepRandom(e);
        else this.stepToward(e, dist, false);
        break;
      case 'wraith':
        if (this.adjacentToPlayer(e)) this.attackPlayer(e);
        else this.stepToward(e, dist, true);
        break;
      case 'archer':
        this.archerAct(e, dist);
        break;
      case 'brute':
        if (e.rest > 0) {
          e.rest--;
          break;
        }
        if (this.adjacentToPlayer(e)) this.attackPlayer(e);
        else this.stepToward(e, dist, false);
        e.rest = 1;
        break;
      case 'boss':
        this.bossAct(e, dist);
        break;
    }
  }

  private archerAct(e: Enemy, dist: number[]) {
    if (e.aim) {
      const dir = e.aim;
      e.aim = null;
      let x = e.x;
      let y = e.y;
      let hit = false;
      for (;;) {
        const nx = x + dir.x;
        const ny = y + dir.y;
        if (!this.inBounds(nx, ny) || this.isWall(nx, ny) || this.enemyAt(nx, ny)) break;
        x = nx;
        y = ny;
        if (x === this.player.x && y === this.player.y) {
          hit = true;
          break;
        }
      }
      this.events.push({ t: 'shot', from: { x: e.x, y: e.y }, to: { x, y }, hit });
      if (hit) this.hurtPlayer(e.dmg, e);
      return;
    }
    const aim = this.lineOfSight(e);
    if (aim) {
      e.aim = aim;
      return;
    }
    this.stepToward(e, dist, false);
  }

  /** Direction to the player if aligned with a clear line, else null. */
  lineOfSight(e: Pos): Pos | null {
    const p = this.player;
    if (e.x !== p.x && e.y !== p.y) return null;
    const dir = { x: Math.sign(p.x - e.x), y: Math.sign(p.y - e.y) };
    let x = e.x + dir.x;
    let y = e.y + dir.y;
    while (x !== p.x || y !== p.y) {
      if (this.isWall(x, y) || this.enemyAt(x, y)) return null;
      x += dir.x;
      y += dir.y;
    }
    return dir;
  }

  private bossAct(e: Enemy, dist: number[]) {
    if (e.turns % 4 === 0 && this.alive.length < MAX_ENEMIES) {
      const spots = DIRS8.map((d) => ({ x: e.x + d.x, y: e.y + d.y })).filter(
        (p) =>
          this.inBounds(p.x, p.y) &&
          !this.isWall(p.x, p.y) &&
          !this.enemyAt(p.x, p.y) &&
          !(p.x === this.player.x && p.y === this.player.y),
      );
      if (spots.length) {
        const s = spots[Math.floor(this.combat() * spots.length)];
        this.makeEnemy('ghoul', s.x, s.y);
        this.events.push({ t: 'summon', x: s.x, y: s.y });
        return;
      }
    }
    if (this.adjacentToPlayer(e)) {
      this.attackPlayer(e);
      return;
    }
    if (e.rest > 0) {
      e.rest--;
      return;
    }
    this.stepToward(e, dist, false);
    e.rest = 1;
  }

  private canEnemyEnter(x: number, y: number, ghost: boolean): boolean {
    if (!this.inBounds(x, y)) return false;
    if (!ghost && this.isWall(x, y)) return false;
    if (this.enemyAt(x, y)) return false;
    if (x === this.player.x && y === this.player.y) return false;
    return true;
  }

  private stepToward(e: Enemy, dist: number[], ghost: boolean) {
    const here = dist[e.y * W + e.x];
    let best: Pos[] = [];
    let bestD = here < 0 ? Infinity : here;
    for (const d of DIRS) {
      const nx = e.x + d.x;
      const ny = e.y + d.y;
      if (!this.canEnemyEnter(nx, ny, ghost)) continue;
      const nd = dist[ny * W + nx];
      if (nd < 0) continue;
      if (nd < bestD) {
        bestD = nd;
        best = [{ x: nx, y: ny }];
      } else if (nd === bestD && nd < here) {
        best.push({ x: nx, y: ny });
      }
    }
    if (!best.length) return;
    const step = best[Math.floor(this.combat() * best.length)];
    e.x = step.x;
    e.y = step.y;
  }

  private stepRandom(e: Enemy) {
    const options = DIRS.filter((d) => this.canEnemyEnter(e.x + d.x, e.y + d.y, false));
    if (!options.length) return;
    const d = options[Math.floor(this.combat() * options.length)];
    e.x += d.x;
    e.y += d.y;
  }

  /** Tiles an archer's loaded shot will cross, for the telegraph. */
  shotPath(e: Enemy): Pos[] {
    if (!e.aim) return [];
    const path: Pos[] = [];
    let x = e.x + e.aim.x;
    let y = e.y + e.aim.y;
    while (this.inBounds(x, y) && !this.isWall(x, y) && !this.enemyAt(x, y)) {
      path.push({ x, y });
      x += e.aim.x;
      y += e.aim.y;
    }
    return path;
  }

  /** Short run summary used by the share card and results screen. */
  relicEmojis(max = 12): string {
    return this.relicLog
      .slice(0, max)
      .map((id) => RELIC_BY_ID[id].emoji)
      .join('');
  }
}
