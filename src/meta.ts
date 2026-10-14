// Progress that carries between runs: Souls, unlocks, achievements, the relic codex
// and discovered combos. Saved locally and, when signed in, to the player's account.

import { ACHIEVEMENT_BY_ID, COMBOS, HEROES, dailyHero, type AchievementDef, type ComboDef, type HeroId } from './content';
import { basePool, fullPool, type Game, type Mode, type RunConfig } from './game';
import { RELICS, UNLOCKABLE_RELICS, type RelicId } from './relics';

export interface Meta {
  souls: number;
  /** Lifetime Souls earned, for bragging rights. */
  earned: number;
  heroes: HeroId[];
  relics: RelicId[];
  /** Achievement id -> when it was earned. */
  achievements: Record<string, number>;
  /** Relic id -> times taken. */
  codex: Partial<Record<RelicId, number>>;
  /** Combo id -> when first completed. */
  combos: Record<string, number>;
  elitesSlain: number;
  /** Hero last picked for Endless. */
  hero: HeroId;
}

export const RELIC_COSTS: Partial<Record<RelicId, number>> = {
  caltrops: 60,
  key: 60,
  echo: 100,
  mask: 120,
  necro: 140,
  tome: 180,
};

const KEY = 'wardenfall:meta';

function empty(): Meta {
  return { souls: 0, earned: 0, heroes: ['knight'], relics: [], achievements: {}, codex: {}, combos: {}, elitesSlain: 0, hero: 'knight' };
}

function load(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

export const meta: Meta = load();

const listeners: (() => void)[] = [];

/** Called after every change, e.g. to sync to the player's account. */
export function onMetaChange(cb: () => void) {
  listeners.push(cb);
}

export function saveMeta() {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    // Storage blocked: progress lasts for this session only.
  }
  listeners.forEach((cb) => cb());
}

/** Combine progress from another device: keep the best of both. */
export function mergeMeta(other: Partial<Meta> | null | undefined): boolean {
  if (!other) return false;
  const before = JSON.stringify(meta);
  meta.souls = Math.max(meta.souls, other.souls ?? 0);
  meta.earned = Math.max(meta.earned, other.earned ?? 0);
  meta.elitesSlain = Math.max(meta.elitesSlain, other.elitesSlain ?? 0);
  meta.heroes = [...new Set([...meta.heroes, ...(other.heroes ?? [])])];
  meta.relics = [...new Set([...meta.relics, ...(other.relics ?? [])])];
  meta.achievements = { ...(other.achievements ?? {}), ...meta.achievements };
  meta.combos = { ...(other.combos ?? {}), ...meta.combos };
  for (const [id, n] of Object.entries(other.codex ?? {})) {
    meta.codex[id as RelicId] = Math.max(meta.codex[id as RelicId] ?? 0, n ?? 0);
  }
  const changed = JSON.stringify(meta) !== before;
  if (changed) saveMeta();
  return changed;
}

// ---------- unlocks ----------

export function heroUnlocked(id: HeroId): boolean {
  return meta.heroes.includes(id);
}

export function buyHero(id: HeroId): boolean {
  const hero = HEROES.find((h) => h.id === id)!;
  if (heroUnlocked(id) || meta.souls < hero.cost) return false;
  meta.souls -= hero.cost;
  meta.heroes.push(id);
  saveMeta();
  return true;
}

export function buyRelic(id: RelicId): boolean {
  const cost = RELIC_COSTS[id] ?? 0;
  if (meta.relics.includes(id) || meta.souls < cost) return false;
  meta.souls -= cost;
  meta.relics.push(id);
  saveMeta();
  return true;
}

/** The daily crypt is identical for everyone; Endless uses your hero and unlocks. */
export function runConfig(mode: Mode, dailyNo: number): RunConfig {
  if (mode === 'daily') return { hero: dailyHero(dailyNo), pool: fullPool() };
  const hero = heroUnlocked(meta.hero) ? meta.hero : 'knight';
  return { hero, pool: basePool(meta.relics.filter((id) => UNLOCKABLE_RELICS.includes(id))) };
}

// ---------- achievements ----------

/** Unlock an achievement if new. Returns it so the caller can celebrate. */
function grant(id: string): AchievementDef | null {
  if (meta.achievements[id]) return null;
  const a = ACHIEVEMENT_BY_ID[id];
  if (!a) return null;
  meta.achievements[id] = Date.now();
  meta.souls += a.souls;
  meta.earned += a.souls;
  return a;
}

export interface Unlocks {
  achievements: AchievementDef[];
  combos: ComboDef[];
}

/** Track relics taken this run: codex entries, and combos completed. */
export function noteRelic(game: Game, id: RelicId): Unlocks {
  meta.codex[id] = (meta.codex[id] ?? 0) + 1;
  const out: Unlocks = { achievements: [], combos: [] };
  for (const combo of COMBOS) {
    if (!combo.relics.includes(id)) continue;
    // Newly completed this run: every piece held, and this relic was the last one in.
    const complete = combo.relics.every((r) => game.r(r) > 0);
    const firstCopy = game.r(id) === 1;
    if (complete && firstCopy) {
      out.combos.push(combo);
      if (!meta.combos[combo.id]) {
        meta.combos[combo.id] = Date.now();
        meta.souls += 15;
        meta.earned += 15;
      }
    }
  }
  const discovered = Object.keys(meta.codex).length;
  const ids = [
    out.combos.length ? 'combo' : '',
    Object.keys(meta.combos).length >= COMBOS.length ? 'combos-all' : '',
    discovered >= 15 ? 'collector' : '',
    discovered >= RELICS.length ? 'completionist' : '',
  ];
  for (const a of ids) {
    const got = a && grant(a);
    if (got) out.achievements.push(got);
  }
  saveMeta();
  return out;
}

/** Check mid-run achievements after each turn. */
export function checkRun(game: Game): AchievementDef[] {
  const s = game.stats;
  const conditions: [string, boolean][] = [
    ['first-blood', game.kills >= 1],
    ['floor5', game.floor >= 5],
    ['floor10', game.floor >= 10],
    ['floor15', game.floor >= 15],
    ['warden', (s.bosses.boss ?? 0) > 0],
    ['abbot', (s.bosses.abbot ?? 0) > 0],
    ['lich', (s.bosses.lich ?? 0) > 0],
    ['close-call', s.bossAtOneHp],
    ['untouchable', s.cleanFloors > 0],
    ['chain', s.maxKillsInTurn >= 3],
    ['overkill', s.maxHit >= 15],
    ['hoarder', game.relicLog.length >= 10],
    ['trapper', s.spikeKills >= 3],
    ['army', s.maxAllies >= 3],
    ['rogue8', game.hero === 'rogue' && game.floor >= 8],
    ['elite-hunter', meta.elitesSlain + s.elites >= 10],
  ];
  const out: AchievementDef[] = [];
  for (const [id, ok] of conditions) {
    const got = ok && grant(id);
    if (got) out.push(got);
  }
  if (out.length) saveMeta();
  return out;
}

export interface RunReward {
  souls: number;
  lines: [string, number][];
  achievements: AchievementDef[];
}

/** Pay out Souls at the end of a run. */
export function finishRunMeta(game: Game, streak: number): RunReward {
  const bosses = Object.values(game.stats.bosses).reduce((a, b) => a + (b ?? 0), 0);
  const lines: [string, number][] = [
    [`Floor ${game.floor}`, game.floor * 4],
    [`${game.kills} kills`, game.kills],
  ];
  if (game.stats.elites) lines.push([`${game.stats.elites} elites`, game.stats.elites * 3]);
  if (bosses) lines.push([`${bosses} boss${bosses > 1 ? 'es' : ''}`, bosses * 20]);
  let souls = lines.reduce((sum, [, n]) => sum + n, 0);
  if (game.mode === 'daily') {
    const bonus = Math.round(souls * 0.5);
    lines.push(['Daily bonus', bonus]);
    souls += bonus;
  }
  meta.souls += souls;
  meta.earned += souls;
  meta.elitesSlain += game.stats.elites;
  const achievements = checkRun(game);
  for (const id of [streak >= 3 ? 'streak3' : '', streak >= 7 ? 'streak7' : '']) {
    const got = id && grant(id);
    if (got) achievements.push(got);
  }
  saveMeta();
  return { souls, lines, achievements };
}

export function relicDiscovered(id: RelicId): boolean {
  return (meta.codex[id] ?? 0) > 0;
}
