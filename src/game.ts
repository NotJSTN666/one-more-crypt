// Pure game logic: no DOM, no rendering. The renderer reads state and consumes
// `events` to play effects. Everything random is seeded, so a run can be replayed
// exactly from its input log.

import { ELITE_MODS, HERO_BY_ID, type EliteMod, type FeatureKind, type HeroId } from './content';
import {
  ASCEND_FLOOR, FUSIONS, LEGACY_RELICS, RELICS, RELIC_BY_ID, RARITY_WEIGHT, UNLOCKABLE_RELICS, type FusedId, type FusionDef, type RelicDef, type RelicId, withFusions,
} from './relics';
import { hashSeed, mulberry32, randInt, weightedPick, type Rng } from './rng';

export const W = 7;
export const H = 7;

export interface Pos {
  x: number;
  y: number;
}

export type EnemyKind = 'ghoul' | 'bat' | 'archer' | 'brute' | 'wraith' | 'boss' | 'abbot' | 'lich' | 'thrall';

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
  /** Thralls fight for the player. */
  ally: boolean;
  elite: EliteMod | null;
  /** Hits an elite can still block. */
  shield: number;
}

export const ENEMY_INFO: Record<EnemyKind, { name: string; hp: number; dmg: number }> = {
  ghoul: { name: 'Ghoul', hp: 2, dmg: 1 },
  bat: { name: 'Blood Bat', hp: 1, dmg: 1 },
  archer: { name: 'Skeleton Archer', hp: 1, dmg: 2 },
  brute: { name: 'Grave Brute', hp: 4, dmg: 3 },
  wraith: { name: 'Wraith', hp: 2, dmg: 1 },
  boss: { name: 'The Bone Warden', hp: 10, dmg: 2 },
  abbot: { name: 'The Plague Abbot', hp: 16, dmg: 2 },
  lich: { name: 'The Lich King', hp: 22, dmg: 3 },
  thrall: { name: 'Thrall', hp: 2, dmg: 1 },
};

export const BOSS_KINDS: EnemyKind[] = ['boss', 'abbot', 'lich'];
/** The risen dead: the Paladin and the Saint's Rosary hit them harder. */
export const UNDEAD: EnemyKind[] = ['ghoul', 'archer', 'brute', 'wraith', 'boss', 'lich'];
const FLYING: EnemyKind[] = ['bat', 'wraith'];

export function isBoss(e: { kind: EnemyKind }): boolean {
  return BOSS_KINDS.includes(e.kind);
}

export type HitKind =
  | 'melee' | 'burn' | 'thorns' | 'bolt' | 'burst' | 'pierce' | 'whirl' | 'hellfire'
  | 'spike' | 'mask' | 'ally' | 'claw';

export type GameEvent =
  | { t: 'pattack'; dir: Pos }
  | { t: 'eattack'; id: number; dir: Pos }
  | { t: 'hit'; id: number; x: number; y: number; amount: number; kind: HitKind; crit?: boolean }
  | { t: 'eblock'; id: number; x: number; y: number }
  | { t: 'kill'; id: number; x: number; y: number; kind: EnemyKind; ally?: boolean; elite?: EliteMod | null }
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
  | { t: 'raise'; x: number; y: number }
  | { t: 'teleport'; id: number; from: Pos; to: Pos }
  | { t: 'warn' }
  | { t: 'spike'; x: number; y: number }
  | { t: 'shadow' }
  | { t: 'event'; kind: FeatureKind }
  | { t: 'stairs' }
  | { t: 'potion' }
  | { t: 'floor'; floor: number }
  | { t: 'death' }
  | { t: 'timestop' }
  | { t: 'toll' }
  | { t: 'fuse'; id: FusedId; from: [RelicId, RelicId] }
  | { t: 'relic'; id: RelicId };

export type Mode = 'daily' | 'endless';
export type Phase = 'play' | 'choose' | 'event' | 'dead';

export interface Offer {
  relics: RelicDef[];
  restHeal: number;
}

export interface Feature extends Pos {
  kind: FeatureKind;
  used: boolean;
}

/** A tile that will be struck at the start of the foes' next turn. */
export interface Warning extends Pos {
  dmg: number;
  kind: 'plague' | 'bolt';
  src: string;
}

export interface RunConfig {
  hero: HeroId;
  /** Relics that can be offered this run. */
  pool: RelicId[];
  /** A Soul Forge on the floor after each boss (run log version 4 and later). */
  forge?: boolean;
}

/** Daily runs use every relic; Endless only the unlocked ones. */
/** Every relic. `legacy` limits it to the launch set, for older runs and Daily #1. */
export function fullPool(legacy = false): RelicId[] {
  return RELICS.filter((r) => !legacy || LEGACY_RELICS.includes(r.id)).map((r) => r.id);
}

export function basePool(unlocked: RelicId[] = [], legacy = false): RelicId[] {
  return fullPool(legacy).filter((id) => !UNLOCKABLE_RELICS.includes(id) || unlocked.includes(id));
}

export interface RunStats {
  elites: number;
  bosses: Partial<Record<EnemyKind, number>>;
  spikeKills: number;
  maxKillsInTurn: number;
  maxHit: number;
  cleanFloors: number;
  maxAllies: number;
  bossAtOneHp: boolean;
  arrowKills: number;
  revived: boolean;
  /** Foes slain this run, by kind (for the Bestiary). */
  kinds: Partial<Record<EnemyKind, number>>;
  /** Turns taken to reach floor 5 (0 until then). */
  turnsTo5: number;
  /** Relics fused at the Soul Forge this run. */
  fusions: number;
  /** For hero costumes: unseen Rogue steps, attacks dodged, thralls raised, kills at 3 HP or less. */
  shadowSteps: number;
  dodges: number;
  raised: number;
  lowHpKills: number;
}

const DIRS: Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
const DIRS8: Pos[] = [...DIRS, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];

export const START: Pos = { x: 3, y: 6 };
const POTION_HEAL = 3;
const REST_HEAL = 4;
const MAX_ENEMIES = 9;
const MAX_THRALLS = 3;
const MAX_HP_CAP = 99;
/** Below this floor, every enemy hit also takes a growing share of your max HP. */
const ABYSS_FLOOR = 30;
const LOG_VERSION = 3;
/** Runs with the Soul Forge. */
const FORGE_LOG_VERSION = 4;
/** One input character per Soul Forge option. */
const FORGE_KEYS = 'bcdefghijklm';
const BOW_RANGE = 3;

export class Game {
  readonly mode: Mode;
  readonly seed: number;
  readonly dailyNo: number;
  readonly config: RunConfig;

  floor = 0;
  walls: boolean[] = [];
  spikes: boolean[] = [];
  stairs: Pos = { x: 3, y: 0 };
  stairsOpen = false;
  potion: Pos | null = null;
  feature: Feature | null = null;
  warnings: Warning[] = [];
  enemies: Enemy[] = [];
  player = { x: START.x, y: START.y, hp: 10, maxHp: 10 };
  relics: Partial<Record<RelicId, number>> = {};
  /** Relics in the order taken, for the share card. */
  relicLog: RelicId[] = [];
  phase: Phase = 'play';
  offer: Offer | null = null;
  kills = 0;
  turns = 0;
  killedBy = '';
  stats: RunStats = {
    elites: 0, bosses: {}, spikeKills: 0, maxKillsInTurn: 0, maxHit: 0, cleanFloors: 0, maxAllies: 0, bossAtOneHp: false,
    arrowKills: 0, revived: false, turnsTo5: 0, kinds: {}, fusions: 0, shadowSteps: 0, dodges: 0, raised: 0, lowHpKills: 0,
  };
  /**
   * Every input, in order: U/D/L/R moves, W waits, 0-3 relic picks, r rests,
   * a/x accept or leave a floor event. With `header()` it replays the run exactly.
   */
  log = '';
  events: GameEvent[] = [];

  private harvestBonus = 0;
  private shieldCharges = 0;
  private phylacteryUsed = false;
  private nextId = 1;
  private steps = 0;
  private attacks = 0;
  private killsThisTurn = 0;
  private hurtThisFloor = false;
  private combat: Rng;
  /** Base relic counts granted by fused relics. */
  private boost: Partial<Record<RelicId, number>> = {};

  constructor(mode: Mode, seed: number, dailyNo = 0, config: RunConfig = { hero: 'knight', pool: fullPool() }) {
    this.mode = mode;
    this.seed = seed;
    this.dailyNo = dailyNo;
    this.config = config;
    this.combat = mulberry32(hashSeed(seed, 'combat'));
    const hp = HERO_BY_ID[config.hero].hp;
    this.player.hp = this.player.maxHp = hp;
    this.enterFloor(1);
  }

  // ---------- queries ----------

  /** How many of a relic the player effectively holds, counting what fused relics grant. */
  r(id: RelicId): number {
    return (this.relics[id] ?? 0) + (this.boost[id] ?? 0);
  }

  /** How many copies of a relic the player actually holds. */
  own(id: RelicId): number {
    return this.relics[id] ?? 0;
  }

  get hero(): HeroId {
    return this.config.hero;
  }

  get atk(): number {
    let atk = 1 + this.r('whetstone') + 2 * this.r('crown') + this.harvestBonus;
    const missing = this.player.maxHp - this.player.hp;
    if (this.hero === 'barbarian') atk += Math.floor(missing / 3);
    if (this.hero === 'mage') atk += 2;
    if (this.r('idol') && this.player.hp * 2 <= this.player.maxHp) atk += this.r('idol');
    return atk;
  }

  get shield(): number {
    return this.shieldCharges;
  }

  /** Rogue only: the next step will be taken unseen. */
  get shadowReady(): boolean {
    return this.hero === 'rogue' && (this.steps + 1) % 3 === 0;
  }

  isWall(x: number, y: number): boolean {
    return this.walls[y * W + x];
  }

  isSpike(x: number, y: number): boolean {
    return this.spikes[y * W + x];
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < W && y < H;
  }

  /** A living foe (not a thrall) on this tile. */
  enemyAt(x: number, y: number): Enemy | undefined {
    return this.enemies.find((e) => !e.dead && !e.ally && e.x === x && e.y === y);
  }

  /** Any living unit, friend or foe, on this tile. */
  unitAt(x: number, y: number): Enemy | undefined {
    return this.enemies.find((e) => !e.dead && e.x === x && e.y === y);
  }

  /** Living foes. */
  get alive(): Enemy[] {
    return this.enemies.filter((e) => !e.dead && !e.ally);
  }

  get allies(): Enemy[] {
    return this.enemies.filter((e) => !e.dead && e.ally);
  }

  /** True once the player has died. (A method so checks after side effects aren't narrowed away.) */
  isOver(): boolean {
    return this.phase === 'dead';
  }

  isBossFloor(f = this.floor): boolean {
    return f % 5 === 0;
  }

  /** Prefix for the input log that records how the run was set up. */
  header(): string {
    const unlocked = UNLOCKABLE_RELICS.filter((id) => this.config.pool.includes(id));
    // Pools without any post-launch relic are logged as version 2 so they replay with the launch set.
    const version = this.config.forge ? FORGE_LOG_VERSION : this.config.pool.some((id) => !LEGACY_RELICS.includes(id)) ? LOG_VERSION : 2;
    return `#${version}|${this.config.hero}|${unlocked.join(',')}|`;
  }

  // ---------- floor generation ----------

  private enterFloor(floor: number) {
    this.floor = floor;
    const rng = mulberry32(hashSeed(this.seed, 'floor', floor));
    this.generateLayout(rng);
    const thralls = this.allies;
    this.enemies = [];
    this.spikes = new Array(W * H).fill(false);
    this.potion = null;
    this.feature = null;
    this.warnings = [];
    this.spawnEnemies(rng);
    this.placeTraps(rng);
    if (!this.isBossFloor() && floor > 1 && rng() < 0.4) {
      const spot = this.randomFreeTile(rng, 2);
      if (spot) this.potion = spot;
    }
    if (!this.isBossFloor() && floor > 1 && rng() < 0.35) {
      const kind = weightedPick(rng, ['shrine', 'chest', 'fountain'] as FeatureKind[], (k) => (k === 'fountain' ? 2 : 4));
      const spot = this.randomFreeTile(rng, 2);
      if (spot) this.feature = { ...spot, kind, used: false };
    }
    // The Soul Forge waits on the floor after each boss, in place of any other feature.
    if (this.config.forge && floor > 5 && floor % 5 === 1) {
      this.feature = null;
      const spot = this.randomFreeTile(mulberry32(hashSeed(this.seed, 'forge', floor)), 2);
      if (spot) this.feature = { ...spot, kind: 'forge', used: false };
    }
    this.player.x = START.x;
    this.player.y = START.y;
    this.placeThralls(thralls);
    this.stairsOpen = false;
    this.harvestBonus = 0;
    this.hurtThisFloor = false;
    this.shieldCharges = this.r('mirror');
    this.events.push({ t: 'floor', floor });
    if (floor === 5 && !this.stats.turnsTo5) this.stats.turnsTo5 = this.turns;

    if (this.r('vheart') && this.isBossFloor()) this.phylacteryUsed = false;
    if (this.hero === 'knight' && floor > 1) this.heal(1);
    const candle = this.r('candle');
    if (candle) this.heal(candle * 2);
    if (this.r('tome') && floor % 3 === 0) {
      const gift = this.randomRelic(mulberry32(hashSeed(this.seed, 'tome', floor)), () => true);
      if (gift) this.addRelic(gift.id);
    }
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

  /** Replace the floor with a hand-made scene. Used by the How to play demos. */
  stage(scene: {
    player: Pos;
    enemies: { kind: EnemyKind; x: number; y: number; elite?: EliteMod; hp?: number }[];
    walls?: Pos[];
    stairs?: Pos;
    potion?: Pos;
    hp?: number;
  }) {
    this.floor = 1;
    this.walls = new Array(W * H).fill(false);
    for (const w of scene.walls ?? []) this.walls[w.y * W + w.x] = true;
    this.spikes = new Array(W * H).fill(false);
    this.potion = scene.potion ?? null;
    this.feature = null;
    this.warnings = [];
    this.enemies = [];
    for (const e of scene.enemies) {
      const made = this.makeEnemy(e.kind, e.x, e.y);
      if (e.elite) this.makeElite(made, e.elite);
      if (e.hp) made.hp = made.maxHp = e.hp;
    }
    this.stairs = scene.stairs ?? { x: 3, y: 0 };
    this.stairsOpen = false;
    this.player.x = scene.player.x;
    this.player.y = scene.player.y;
    if (scene.hp) this.player.hp = this.player.maxHp = scene.hp;
    this.phase = 'play';
    this.events = [];
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
    const f = this.floor;
    if (this.isBossFloor()) {
      const tier = f / 5;
      const kind: EnemyKind = (['boss', 'abbot', 'lich'] as EnemyKind[])[(tier - 1) % 3];
      const cycle = Math.floor((tier - 1) / 3);
      const spot = { x: 3, y: 1 };
      this.walls[spot.y * W + spot.x] = false;
      const boss = this.makeEnemy(kind, spot.x, spot.y);
      boss.maxHp = boss.hp = ENEMY_INFO[kind].hp + 12 * cycle + 4 * cycle * cycle;
      boss.dmg = ENEMY_INFO[kind].dmg + cycle;
      for (let i = 0; i < Math.min(tier, 4); i++) {
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
    const eliteChance = f >= 3 ? Math.min(0.35, 0.06 + 0.025 * f) : 0;
    for (let i = 0; i < count; i++) {
      const spot = this.randomFreeTile(rng, 3);
      if (!spot) break;
      const kind = weightedPick(rng, pool, (p) => p.w).kind;
      const e = this.makeEnemy(kind, spot.x, spot.y);
      if (rng() < eliteChance) this.makeElite(e, ELITE_MODS[Math.floor(rng() * ELITE_MODS.length)]);
    }
  }

  private makeElite(e: Enemy, mod: EliteMod) {
    e.elite = mod;
    e.hp += 1;
    e.maxHp += 1;
    if (mod === 'shielded') e.shield = 1;
  }

  private placeTraps(rng: Rng) {
    if (this.floor < 2 || this.isBossFloor()) return;
    const count = Math.min(3, randInt(rng, 0, 1 + Math.floor(this.floor / 4)));
    for (let i = 0; i < count; i++) {
      const spot = this.randomFreeTile(rng, 2);
      if (spot) this.spikes[spot.y * W + spot.x] = true;
    }
  }

  private placeThralls(thralls: Enemy[]) {
    for (const t of thralls) {
      const spot = this.nearestFree(START);
      if (!spot) continue;
      t.x = spot.x;
      t.y = spot.y;
      t.burn = 0;
      t.frozen = 0;
      this.enemies.push(t);
    }
  }

  private makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const info = ENEMY_INFO[kind];
    // Gentle scaling early, then steep past floor 15 so broken builds still meet an end.
    const late = Math.max(0, this.floor - 15);
    const scaled = !isBoss({ kind }) && kind !== 'thrall';
    const hpBonus = scaled ? Math.floor((this.floor - 1) / 4) + late : 0;
    const dmgBonus = scaled ? Math.floor((this.floor - 1) / 6) + Math.floor(late / 3) : 0;
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
      rest: kind === 'brute' || kind === 'boss' || kind === 'abbot' ? 1 : 0,
      turns: 0,
      dead: false,
      ally: false,
      elite: null,
      shield: 0,
    };
    this.enemies.push(e);
    return e;
  }

  private raiseThrall(x: number, y: number) {
    const t = this.makeEnemy('thrall', x, y);
    t.ally = true;
    t.maxHp = t.hp = 2 + Math.floor(this.floor / 4);
    t.dmg = 1 + Math.floor(this.floor / 6);
    this.events.push({ t: 'raise', x, y });
    this.stats.maxAllies = Math.max(this.stats.maxAllies, this.allies.length);
    this.stats.raised++;
  }

  private isFree(x: number, y: number): boolean {
    if (!this.inBounds(x, y) || this.isWall(x, y) || this.unitAt(x, y)) return false;
    if (x === this.player.x && y === this.player.y) return false;
    return true;
  }

  private nearestFree(from: Pos): Pos | null {
    const dist = this.distanceMap(from, false);
    let best: Pos | null = null;
    let bestD = Infinity;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = dist[y * W + x];
        if (d > 0 && d < bestD && this.isFree(x, y) && !this.isSpike(x, y)) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  }

  private randomFreeTile(rng: Rng, minDistFromStart: number): Pos | null {
    const free: Pos[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.isWall(x, y) || this.isSpike(x, y)) continue;
        if (Math.abs(x - START.x) + Math.abs(y - START.y) < minDistFromStart) continue;
        if (x === this.stairs.x && y === this.stairs.y) continue;
        if (this.unitAt(x, y)) continue;
        if (this.potion && this.potion.x === x && this.potion.y === y) continue;
        if (this.feature && this.feature.x === x && this.feature.y === y) continue;
        free.push({ x, y });
      }
    }
    return free.length ? free[Math.floor(rng() * free.length)] : null;
  }

  /** BFS distances from one or more tiles over non-wall tiles; -1 for unreachable. */
  distanceMap(from: Pos | Pos[], throughWalls: boolean): number[] {
    const dist = new Array(W * H).fill(-1);
    const queue: Pos[] = Array.isArray(from) ? [...from] : [from];
    for (const p of queue) dist[p.y * W + p.x] = 0;
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
    const ok = this.doAct(dx, dy);
    if (ok) this.log += dx === 0 && dy === 0 ? 'W' : dx > 0 ? 'R' : dx < 0 ? 'L' : dy > 0 ? 'D' : 'U';
    return ok;
  }

  private doAct(dx: number, dy: number): boolean {
    if (this.phase !== 'play') return false;
    this.killsThisTurn = 0;
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
    const mark = this.hero === 'ranger' ? this.bowTarget(dx, dy) : undefined;
    if (mark) {
      this.playerAttack(mark, { x: dx, y: dy }, true);
      this.endTurn();
      return true;
    }
    if (this.isWall(tx, ty)) return false;

    // Step past a thrall by swapping places with it.
    const thrall = this.unitAt(tx, ty);
    if (thrall?.ally) {
      thrall.x = this.player.x;
      thrall.y = this.player.y;
    }
    this.player.x = tx;
    this.player.y = ty;
    this.playerEnters(tx, ty);
    if (this.isOver()) return true;
    if (this.potion && this.potion.x === tx && this.potion.y === ty) {
      this.potion = null;
      this.events.push({ t: 'potion' });
      this.heal(POTION_HEAL + 2 * this.r('flask') + this.r('chalice'));
    }
    if (this.stairsOpen && tx === this.stairs.x && ty === this.stairs.y) {
      this.turns++;
      this.descend();
      return true;
    }
    // Rogue: every third step is taken unseen.
    this.steps++;
    if (this.hero === 'rogue' && this.steps % 3 === 0) {
      this.turns++;
      this.events.push({ t: 'shadow' });
      this.stats.shadowSteps++;
    } else {
      this.endTurn();
    }
    if (this.phase === 'play' && this.feature && !this.feature.used && this.feature.x === this.player.x && this.feature.y === this.player.y) {
      this.phase = 'event';
      this.events.push({ t: 'event', kind: this.feature.kind });
    }
    return true;
  }

  private playerEnters(x: number, y: number) {
    if (this.isSpike(x, y) && !this.r('caltrops')) {
      this.events.push({ t: 'spike', x, y });
      this.hurtPlayer(1, null, 'the spikes');
    }
  }

  private unitEnters(e: Enemy) {
    if (!this.isSpike(e.x, e.y) || e.ally || FLYING.includes(e.kind)) return;
    this.events.push({ t: 'spike', x: e.x, y: e.y });
    this.damageEnemy(e, 2 + 2 * this.r('caltrops'), 'spike');
    if (e.dead) this.stats.spikeKills++;
  }

  /** Ranger: the first foe 2-3 tiles away in a clear straight line. */
  bowTarget(dx: number, dy: number): Enemy | undefined {
    for (let k = 1; k <= BOW_RANGE; k++) {
      const x = this.player.x + dx * k;
      const y = this.player.y + dy * k;
      if (!this.inBounds(x, y) || this.isWall(x, y)) return undefined;
      const u = this.unitAt(x, y);
      if (u) return !u.ally && k >= 2 ? u : undefined;
    }
    return undefined;
  }

  private playerAttack(e: Enemy, dir: Pos, ranged = false) {
    if (ranged) this.events.push({ t: 'shot', from: { x: this.player.x, y: this.player.y }, to: { x: e.x, y: e.y }, hit: false });
    else this.events.push({ t: 'pattack', dir });
    this.attacks++;
    let dmg = this.atk;
    if (UNDEAD.includes(e.kind)) dmg += this.r('rosary') + (this.hero === 'paladin' ? 1 : 0);
    if (this.r('moon')) dmg *= 2;
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
    this.stats.maxHit = Math.max(this.stats.maxHit, dmg);
    this.damageEnemy(e, dmg, ranged ? 'pierce' : 'melee', crit);
    if (ranged && e.dead) this.stats.arrowKills++;
    const echoEvery = this.r('echo') >= 2 ? 3 : 4;
    if (this.r('echo') && this.attacks % echoEvery === 0 && !e.dead) this.damageEnemy(e, dmg, 'melee');

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

  private randomRelic(rng: Rng, filter: (r: RelicDef) => boolean): RelicDef | null {
    const pool = RELICS.filter((r) => this.config.pool.includes(r.id) && this.own(r.id) < r.maxStack && filter(r));
    return pool.length ? weightedPick(rng, pool, (r) => RARITY_WEIGHT[r.rarity]) : null;
  }

  private makeOffer(): Offer {
    const rng = mulberry32(hashSeed(this.seed, 'relic', this.floor));
    let pool = RELICS.filter((r) => this.config.pool.includes(r.id) && this.own(r.id) < r.maxStack);
    if (this.r('heretic')) {
      const dark = pool.filter((r) => r.rarity !== 'common');
      if (dark.length >= 3) pool = dark;
    }
    const n = 3 + this.r('coin');
    const picks: RelicDef[] = [];
    while (picks.length < n && pool.length) {
      const choice = weightedPick(rng, pool, (r) => RARITY_WEIGHT[r.rarity]);
      picks.push(choice);
      pool.splice(pool.indexOf(choice), 1);
    }
    return { relics: picks, restHeal: REST_HEAL + 2 * this.r('chalice') };
  }

  /** Take a relic from the offer (index), or rest when index is -1. */
  choose(index: number) {
    if (this.phase !== 'choose' || !this.offer) return;
    if (index < 0) {
      this.heal(this.offer.restHeal);
      this.log += 'r';
    } else {
      const relic = this.offer.relics[index];
      if (!relic) return;
      this.addRelic(relic.id);
      this.log += String(index);
    }
    this.offer = null;
    this.phase = 'play';
    this.enterFloor(this.floor + 1);
  }

  /** Whether the current floor event's offer can be taken. */
  canAcceptEvent(): boolean {
    if (this.phase !== 'event' || !this.feature) return false;
    if (this.feature.kind === 'shrine') return this.player.maxHp > 3;
    if (this.feature.kind === 'forge') return this.forgeOptions().length > 0;
    return true;
  }

  /** Fusions the player can make at the Soul Forge with the relics they hold. */
  forgeOptions(): FusionDef[] {
    return FUSIONS.filter(
      (f) => (f.tier !== 2 || this.floor >= ASCEND_FLOOR) && !this.own(f.id) && f.from.every((id) => this.own(id) > 0),
    ).slice(0, FORGE_KEYS.length);
  }

  /** Fuse the chosen option at the Soul Forge the player is standing on. */
  forge(index: number) {
    if (this.phase !== 'event' || this.feature?.kind !== 'forge') return;
    const f = this.forgeOptions()[index];
    if (!f) return;
    for (const id of f.from) {
      this.relics[id] = this.own(id) - 1;
      if (!this.relics[id]) delete this.relics[id];
      this.relicLog.splice(this.relicLog.lastIndexOf(id), 1);
    }
    this.relics[f.id] = 1;
    this.relicLog.push(f.id);
    const all = withFusions(this.relics);
    this.boost = {};
    for (const [id, n] of Object.entries(all)) {
      const extra = (n ?? 0) - this.own(id as RelicId);
      if (extra) this.boost[id as RelicId] = extra;
    }
    const grow = f.id === 'dragon' ? 6 : f.id === 'dracolich' ? 10 : 0;
    if (grow) {
      this.changeMaxHp(grow);
      this.heal(this.player.maxHp);
    }
    // Mirror charges for this floor follow the new count.
    this.shieldCharges = Math.max(this.shieldCharges, this.r('mirror'));
    this.stats.fusions++;
    this.events.push({ t: 'fuse', id: f.id, from: f.from });
    this.log += FORGE_KEYS[index];
    this.feature.used = true;
    this.phase = 'play';
  }

  /** Accept or walk away from the floor event the player is standing on. */
  resolveEvent(accept: boolean) {
    if (this.phase !== 'event' || !this.feature) return;
    const f = this.feature;
    const rng = mulberry32(hashSeed(this.seed, 'event', this.floor));
    if (accept && f.kind === 'forge') return;
    if (accept && this.canAcceptEvent()) {
      if (f.kind === 'shrine') {
        this.changeMaxHp(-3);
        const gift = this.randomRelic(rng, (r) => r.rarity === 'rare') ?? this.randomRelic(rng, () => true);
        if (gift) this.addRelic(gift.id);
      } else if (f.kind === 'chest') {
        if (!this.r('key')) {
          const cut = Math.min(2, this.player.hp - 1);
          if (cut > 0) {
            this.player.hp -= cut;
            this.events.push({ t: 'hurt', amount: cut });
          }
        }
        const gifts = this.r('key') ? 2 : 1;
        for (let i = 0; i < gifts; i++) {
          const gift = this.randomRelic(rng, () => true);
          if (gift) this.addRelic(gift.id);
        }
      } else {
        this.heal(this.player.maxHp);
      }
    }
    this.log += accept ? 'a' : 'x';
    f.used = true;
    this.phase = 'play';
  }

  addRelic(id: RelicId) {
    this.relics[id] = this.r(id) + 1;
    this.relicLog.push(id);
    this.events.push({ t: 'relic', id });
    if (id === 'heart') {
      this.changeMaxHp(3);
      this.heal(3);
    } else if (id === 'crown') {
      this.changeMaxHp(-3);
    }
  }

  private changeMaxHp(delta: number) {
    this.player.maxHp = Math.min(MAX_HP_CAP, Math.max(1, this.player.maxHp + delta));
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
    if (e.shield > 0 && kind !== 'burn') {
      e.shield--;
      this.events.push({ t: 'eblock', id: e.id, x: e.x, y: e.y });
      return;
    }
    e.hp -= amount;
    this.events.push({ t: 'hit', id: e.id, x: e.x, y: e.y, amount, kind, crit });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.dead = true;
    e.hp = 0;
    this.events.push({ t: 'kill', id: e.id, x: e.x, y: e.y, kind: e.kind, ally: e.ally, elite: e.elite });
    if (e.ally) return;

    this.kills++;
    this.killsThisTurn++;
    if (this.player.hp <= 3) this.stats.lowHpKills++;
    this.stats.kinds[e.kind] = (this.stats.kinds[e.kind] ?? 0) + 1;
    this.stats.maxKillsInTurn = Math.max(this.stats.maxKillsInTurn, this.killsThisTurn);
    if (e.elite) this.stats.elites++;
    if (isBoss(e)) {
      this.stats.bosses[e.kind] = (this.stats.bosses[e.kind] ?? 0) + 1;
      if (this.player.hp === 1) this.stats.bossAtOneHp = true;
      if (this.hero === 'paladin') this.heal(this.player.maxHp);
    }

    if (this.r('fang')) this.heal(this.r('fang'));
    if (this.r('lantern') && this.kills % 6 === 0) {
      this.changeMaxHp(this.r('lantern'));
      this.heal(this.r('lantern'));
    }
    if (this.r('harvest')) this.harvestBonus += this.r('harvest');

    // Raise the dead before anything else claims the tile.
    const raiseChance = (this.hero === 'necro' ? 0.3 : 0) + 0.15 * this.r('necro');
    if (raiseChance && !isBoss(e) && this.allies.length < MAX_THRALLS && this.combat() < raiseChance) {
      this.raiseThrall(e.x, e.y);
    }

    if (e.elite === 'splitting') {
      let spawned = 0;
      for (const d of DIRS) {
        if (spawned >= 2) break;
        const x = e.x + d.x;
        const y = e.y + d.y;
        if (!this.isFree(x, y) || this.alive.length >= MAX_ENEMIES) continue;
        const child = this.makeEnemy(e.kind, x, y);
        child.maxHp = child.hp = 1;
        this.events.push({ t: 'summon', x, y });
        spawned++;
      }
    }
    if (e.elite === 'explosive') {
      this.events.push({ t: 'burst', x: e.x, y: e.y });
      for (const d of DIRS8) {
        const x = e.x + d.x;
        const y = e.y + d.y;
        if (x === this.player.x && y === this.player.y) this.hurtPlayer(2, null, 'an exploding foe');
        const u = this.unitAt(x, y);
        if (u) this.damageEnemy(u, 2, 'burst');
      }
    }
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
        if (this.r('plasma') && !t.dead) {
          t.burn = 3;
          t.burnDmg = Math.max(t.burnDmg, this.r('ember'));
        }
      }
    }
  }

  private hurtPlayer(amount: number, src: Enemy | null, cause = 'the dark') {
    if (this.phase === 'dead') return;
    const dodge = Math.min(0.5, this.r('dust') * 0.2 + (this.hero === 'rogue' ? 0.15 : 0));
    if (dodge && this.combat() < dodge) {
      this.events.push({ t: 'dodge' });
      this.stats.dodges++;
      return;
    }
    if (this.shieldCharges > 0) {
      this.shieldCharges--;
      this.events.push({ t: 'block' });
      return;
    }
    amount = Math.max(1, amount - this.r('scale')) + this.r('moon');
    this.player.hp -= amount;
    this.hurtThisFloor = true;
    this.events.push({ t: 'hurt', amount });
    if (src?.elite === 'vampiric') src.hp = Math.min(src.maxHp, src.hp + 1);
    if (src && this.r('thorns')) this.damageEnemy(src, this.r('thorns'), 'thorns');
    if (this.player.hp <= 0) {
      if (this.r('phylactery') && !this.phylacteryUsed) {
        this.phylacteryUsed = true;
        this.stats.revived = true;
        this.player.hp = this.r('vheart') ? this.player.maxHp : 1;
        this.events.push({ t: 'revive' });
        return;
      }
      this.player.hp = 0;
      this.phase = 'dead';
      this.killedBy = src ? ENEMY_INFO[src.kind].name : cause;
      this.events.push({ t: 'death' });
    }
  }

  private checkCleared() {
    if (!this.stairsOpen && this.alive.length === 0) {
      this.stairsOpen = true;
      this.warnings = [];
      if (this.floor >= 3 && !this.hurtThisFloor) this.stats.cleanFloors++;
      this.events.push({ t: 'stairs' });
    }
  }

  // ---------- the world's turn ----------

  private endTurn() {
    this.turns++;
    this.turnRelics();
    // Plague Mask: whatever stands next to you at the end of your turn suffers.
    const mask = this.r('mask');
    if (mask) {
      for (const d of DIRS) {
        const foe = this.enemyAt(this.player.x + d.x, this.player.y + d.y);
        if (foe) this.damageEnemy(foe, mask, 'mask');
      }
    }
    // Thralls act first.
    for (const a of this.allies) {
      if (a.dead) continue;
      if (a.frozen > 0) {
        a.frozen--;
        continue;
      }
      this.allyAct(a);
    }
    this.resolveWarnings();
    if (this.phase === 'dead') return;

    const dist = this.distanceMap(this.player, false);
    const ghostDist = this.distanceMap(this.player, true);
    for (const e of [...this.enemies]) {
      if (e.dead || e.ally) continue;
      if (e.burn > 0) {
        e.burn--;
        this.damageEnemy(e, e.burnDmg, 'burn');
        if (e.dead) continue;
      }
      if (e.frozen > 0) {
        e.frozen--;
        continue;
      }
      const moves = e.elite === 'swift' ? 2 : 1;
      for (let i = 0; i < moves && !e.dead && !this.isOver(); i++) {
        this.enemyAct(e, e.kind === 'wraith' ? ghostDist : dist);
      }
      if (this.isOver()) break;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.checkCleared();
  }

  /** Relics that act on their own every turn. */
  private turnRelics() {
    const wisp = this.r('wisp');
    if (wisp) {
      const targets = this.alive;
      if (targets.length) {
        const t = targets[Math.floor(this.combat() * targets.length)];
        this.events.push({ t: 'bolt', from: { x: this.player.x, y: this.player.y }, to: { x: t.x, y: t.y } });
        this.damageEnemy(t, wisp, 'bolt');
      }
    }
    if (this.r('doom') && this.turns % 10 === 0 && this.alive.length) {
      this.events.push({ t: 'toll' });
      for (const e of this.alive) {
        this.events.push({ t: 'burst', x: e.x, y: e.y });
        this.damageEnemy(e, 4 * this.r('doom'), 'burst');
      }
    }
    if (this.r('hourglass') && this.turns % 8 === 0 && this.alive.length) {
      this.events.push({ t: 'timestop' });
      for (const e of this.alive) e.frozen = Math.max(e.frozen, 1);
    }
    this.checkCleared();
  }

  private resolveWarnings() {
    const pending = this.warnings;
    this.warnings = [];
    for (const w of pending) {
      if (w.x === this.player.x && w.y === this.player.y) this.hurtPlayer(w.dmg, null, w.src);
      const u = this.unitAt(w.x, w.y);
      if (u?.ally) this.damageEnemy(u, w.dmg, 'bolt');
      if (this.phase === 'dead') return;
    }
  }

  private adjacentToPlayer(e: Enemy): boolean {
    return Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) === 1;
  }

  private adjacentUnit(e: Enemy, ally: boolean): Enemy | undefined {
    for (const d of DIRS) {
      const u = this.unitAt(e.x + d.x, e.y + d.y);
      if (u && u.ally === ally) return u;
    }
    return undefined;
  }

  private attackPlayer(e: Enemy) {
    this.events.push({ t: 'eattack', id: e.id, dir: { x: this.player.x - e.x, y: this.player.y - e.y } });
    this.hurtPlayer(e.dmg + this.abyssDamage(), e);
  }

  /** Extra damage in the Abyss, so even unkillable builds eventually fall. */
  private abyssDamage(): number {
    const depth = this.floor - ABYSS_FLOOR;
    return depth > 0 ? Math.ceil((this.player.maxHp * depth * 3) / 100) : 0;
  }

  /** Foes go for the player, but will maul a thrall that blocks the way. */
  private meleeOrMove(e: Enemy, dist: number[], ghost: boolean): void {
    if (this.adjacentToPlayer(e)) return this.attackPlayer(e);
    const thrall = this.adjacentUnit(e, true);
    if (thrall) {
      this.events.push({ t: 'eattack', id: e.id, dir: { x: thrall.x - e.x, y: thrall.y - e.y } });
      this.damageEnemy(thrall, e.dmg, 'claw');
      return;
    }
    this.stepToward(e, dist, ghost);
  }

  private allyAct(a: Enemy) {
    const foe = this.adjacentUnit(a, false);
    if (foe) {
      this.events.push({ t: 'eattack', id: a.id, dir: { x: foe.x - a.x, y: foe.y - a.y } });
      this.damageEnemy(foe, a.dmg, 'ally');
      this.checkCleared();
      return;
    }
    const foes = this.alive;
    if (foes.length) {
      this.stepToward(a, this.distanceMap(foes.map((f) => ({ x: f.x, y: f.y })), false), false);
    } else if (Math.abs(a.x - this.player.x) + Math.abs(a.y - this.player.y) > 2) {
      this.stepToward(a, this.distanceMap(this.player, false), false);
    }
  }

  private enemyAct(e: Enemy, dist: number[]) {
    e.turns++;
    switch (e.kind) {
      case 'ghoul':
        this.meleeOrMove(e, dist, false);
        break;
      case 'bat':
        if (this.adjacentToPlayer(e)) this.attackPlayer(e);
        else if (this.combat() < 0.5) this.stepRandom(e);
        else this.stepToward(e, dist, false);
        break;
      case 'wraith':
        this.meleeOrMove(e, dist, true);
        break;
      case 'archer':
        this.archerAct(e, dist);
        break;
      case 'brute':
        if (e.rest > 0) {
          e.rest--;
          break;
        }
        this.meleeOrMove(e, dist, false);
        e.rest = 1;
        break;
      case 'boss':
        this.wardenAct(e, dist);
        break;
      case 'abbot':
        this.abbotAct(e, dist);
        break;
      case 'lich':
        this.lichAct(e, dist);
        break;
      case 'thrall':
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
        if (!this.inBounds(nx, ny) || this.isWall(nx, ny)) break;
        const blocker = this.unitAt(nx, ny);
        if (blocker) {
          // Thralls take arrows meant for you.
          if (blocker.ally) {
            x = nx;
            y = ny;
            this.damageEnemy(blocker, e.dmg, 'claw');
          }
          break;
        }
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
      if (this.isWall(x, y) || this.unitAt(x, y)) return null;
      x += dir.x;
      y += dir.y;
    }
    return dir;
  }

  private summonNear(e: Enemy, kind: EnemyKind): boolean {
    if (this.alive.length >= MAX_ENEMIES) return false;
    const spots = DIRS8.map((d) => ({ x: e.x + d.x, y: e.y + d.y })).filter((p) => this.isFree(p.x, p.y));
    if (!spots.length) return false;
    const s = spots[Math.floor(this.combat() * spots.length)];
    this.makeEnemy(kind, s.x, s.y);
    this.events.push({ t: 'summon', x: s.x, y: s.y });
    return true;
  }

  /** Slow, summons ghouls every few turns. */
  private wardenAct(e: Enemy, dist: number[]) {
    if (e.turns % 4 === 0 && this.summonNear(e, 'ghoul')) return;
    if (this.adjacentToPlayer(e)) return this.attackPlayer(e);
    if (e.rest > 0) {
      e.rest--;
      return;
    }
    this.meleeOrMove(e, dist, false);
    e.rest = 1;
  }

  /** Rains plague on tiles around you (telegraphed), and calls bats. */
  private abbotAct(e: Enemy, dist: number[]) {
    if (e.turns % 3 === 0) {
      const tiles: Pos[] = [{ x: this.player.x, y: this.player.y }];
      const near: Pos[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.abs(x - this.player.x) + Math.abs(y - this.player.y);
          if (d >= 1 && d <= 2 && !this.isWall(x, y)) near.push({ x, y });
        }
      }
      for (let i = 0; i < 3 && near.length; i++) tiles.push(near.splice(Math.floor(this.combat() * near.length), 1)[0]);
      for (const t of tiles) this.warnings.push({ ...t, dmg: e.dmg, kind: 'plague', src: ENEMY_INFO.abbot.name });
      this.events.push({ t: 'warn' });
      return;
    }
    if (e.turns % 5 === 0 && this.summonNear(e, 'bat')) return;
    if (this.adjacentToPlayer(e)) return this.attackPlayer(e);
    if (e.rest > 0) {
      e.rest--;
      return;
    }
    this.meleeOrMove(e, dist, false);
    e.rest = 1;
  }

  /** Blinks around the room and fires bolts along its row and column (telegraphed). */
  private lichAct(e: Enemy, _dist: number[]) {
    if (e.turns % 4 === 0) {
      const spots: Pos[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (this.isFree(x, y) && !this.isSpike(x, y) && Math.abs(x - this.player.x) + Math.abs(y - this.player.y) >= 3) spots.push({ x, y });
        }
      }
      if (spots.length) {
        const to = spots[Math.floor(this.combat() * spots.length)];
        this.events.push({ t: 'teleport', id: e.id, from: { x: e.x, y: e.y }, to });
        e.x = to.x;
        e.y = to.y;
        return;
      }
    }
    if (e.turns % 3 === 0) {
      for (const d of DIRS) {
        let x = e.x + d.x;
        let y = e.y + d.y;
        while (this.inBounds(x, y) && !this.isWall(x, y)) {
          this.warnings.push({ x, y, dmg: e.dmg, kind: 'bolt', src: ENEMY_INFO.lich.name });
          x += d.x;
          y += d.y;
        }
      }
      this.events.push({ t: 'warn' });
      return;
    }
    if (this.adjacentToPlayer(e)) this.attackPlayer(e);
  }

  private canEnemyEnter(x: number, y: number, ghost: boolean): boolean {
    if (!this.inBounds(x, y)) return false;
    if (!ghost && this.isWall(x, y)) return false;
    if (this.unitAt(x, y)) return false;
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
    this.unitEnters(e);
  }

  private stepRandom(e: Enemy) {
    const options = DIRS.filter((d) => this.canEnemyEnter(e.x + d.x, e.y + d.y, false));
    if (!options.length) return;
    const d = options[Math.floor(this.combat() * options.length)];
    e.x += d.x;
    e.y += d.y;
    this.unitEnters(e);
  }

  /** Tiles an archer's loaded shot will cross, for the telegraph. */
  shotPath(e: Enemy): Pos[] {
    if (!e.aim) return [];
    const path: Pos[] = [];
    let x = e.x + e.aim.x;
    let y = e.y + e.aim.y;
    while (this.inBounds(x, y) && !this.isWall(x, y) && !this.unitAt(x, y)) {
      path.push({ x, y });
      x += e.aim.x;
      y += e.aim.y;
    }
    return path;
  }

  /** Parse a full log (header + inputs) back into its setup. */
  static parseLog(full: string): { config: RunConfig; inputs: string } {
    const m = /^#(\d+)\|([a-z]+)\|([a-z,]*)\|/.exec(full);
    if (!m) return { config: { hero: 'knight', pool: fullPool(true) }, inputs: full };
    const unlocked = m[3] ? (m[3].split(',') as RelicId[]) : [];
    // Runs logged before version 3 were played with the launch relic set.
    const legacy = Number(m[1]) < 3;
    const forge = Number(m[1]) >= FORGE_LOG_VERSION;
    return { config: { hero: m[2] as HeroId, pool: basePool(unlocked, legacy), forge }, inputs: full.slice(m[0].length) };
  }

  /** Re-simulate a run from its full input log. Used to verify scores and resume runs. */
  static replay(mode: Mode, seed: number, dailyNo: number, fullLog: string): Game {
    const { config, inputs } = Game.parseLog(fullLog);
    const g = new Game(mode, seed, dailyNo, config);
    const moves: Record<string, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
    for (const ch of inputs) {
      if (g.phase === 'dead') break;
      if (moves[ch]) g.act(moves[ch][0], moves[ch][1]);
      else if (ch === 'r') g.choose(-1);
      else if (ch === 'a' || ch === 'x') g.resolveEvent(ch === 'a');
      else if (FORGE_KEYS.includes(ch)) g.forge(FORGE_KEYS.indexOf(ch));
      else g.choose(Number(ch));
    }
    g.events.length = 0;
    return g;
  }

  /** Short run summary used by the share card and results screen. */
  relicEmojis(max = 12): string {
    return this.relicLog
      .slice(0, max)
      .map((id) => RELIC_BY_ID[id].emoji)
      .join('');
  }
}
