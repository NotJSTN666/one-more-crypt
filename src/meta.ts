// Progress that carries between runs: Souls, unlocks, achievements, the relic codex
// and discovered combos. Saved locally and, when signed in, to the player's account.

import { ACHIEVEMENT_BY_ID, COMBOS, HEROES, dailyHero, type AchievementDef, type ComboDef, type HeroId } from './content';
import { basePool, fullPool, type Game, type Mode, type RunConfig } from './game';
import { FUSIONS, RELICS, UNLOCKABLE_RELICS, type FusedId, type RelicId } from './relics';
import {
  BESTIARY_KINDS, BESTIARY_TITLES, LOOKS, SOUL_RANKS, TIER_SOULS, TITLES, TITLE_TIER, betterRun, bestiaryTiers, rankIndex,
  type BestRuns, type LookDef,
} from './progression';
import type { EnemyKind } from './game';

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
  /** Fused relic id -> when first forged. */
  fusions: Record<string, number>;
  elitesSlain: number;
  /** Hero last picked for Endless. */
  hero: HeroId;
  /** Lifetime kills by kind, and how many Bestiary milestones each kind has paid out. */
  bestiary: Partial<Record<EnemyKind, number>>;
  bestiaryTier: Partial<Record<EnemyKind, number>>;
  /** Deepest run per hero: the statues in the Crypt Hall. */
  best: BestRuns;
  /** Equipped title id ('' for none) and cosmetic look ('' for the hero's own colours). */
  title: string;
  look: string;
  /** Looks already announced, and the highest Soul Rank announced. */
  looksSeen: string[];
  rankSeen: number;
}

export const RELIC_COSTS: Partial<Record<RelicId, number>> = {
  caltrops: 120,
  key: 120,
  echo: 220,
  mask: 260,
  necro: 300,
  wisp: 340,
  tome: 380,
  doom: 450,
  heretic: 500,
  moon: 600,
};

const KEY = 'wardenfall:meta';

function empty(): Meta {
  return {
    souls: 0, earned: 0, heroes: ['knight'], relics: [], achievements: {}, codex: {}, combos: {}, fusions: {}, elitesSlain: 0, hero: 'knight',
    bestiary: {}, bestiaryTier: {}, best: {}, title: '', look: '', looksSeen: [], rankSeen: 0,
  };
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
  meta.fusions = { ...(other.fusions ?? {}), ...meta.fusions };
  for (const [id, n] of Object.entries(other.codex ?? {})) {
    meta.codex[id as RelicId] = Math.max(meta.codex[id as RelicId] ?? 0, n ?? 0);
  }
  for (const [k, n] of Object.entries(other.bestiary ?? {})) {
    meta.bestiary[k as EnemyKind] = Math.max(meta.bestiary[k as EnemyKind] ?? 0, n ?? 0);
  }
  for (const [k, n] of Object.entries(other.bestiaryTier ?? {})) {
    meta.bestiaryTier[k as EnemyKind] = Math.max(meta.bestiaryTier[k as EnemyKind] ?? 0, n ?? 0);
  }
  for (const [h, run] of Object.entries(other.best ?? {})) {
    meta.best[h as HeroId] = betterRun(meta.best[h as HeroId], run);
  }
  meta.title ||= other.title ?? '';
  meta.look ||= other.look ?? '';
  meta.looksSeen = [...new Set([...meta.looksSeen, ...(other.looksSeen ?? [])])];
  meta.rankSeen = Math.max(meta.rankSeen, other.rankSeen ?? 0);
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

export const FORGE_DAILY = 2;

/** The daily crypt is identical for everyone; Endless uses your hero and unlocks. */
export function runConfig(mode: Mode, dailyNo: number): RunConfig {
  // Daily #1 ran with the launch relic set; new relics join from Daily #2.
  // The Soul Forge opens with Daily #2, so everyone in a daily crypt plays the same rules.
  if (mode === 'daily') return { hero: dailyHero(dailyNo), pool: fullPool(dailyNo <= 1), forge: dailyNo >= FORGE_DAILY };
  const hero = heroUnlocked(meta.hero) ? meta.hero : 'knight';
  return { hero, pool: basePool(meta.relics.filter((id) => UNLOCKABLE_RELICS.includes(id))), forge: true };
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
  const discovered = RELICS.filter((r) => meta.codex[r.id]).length;
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
    ['floor20', game.floor >= 20],
    ['floor30', game.floor >= 30],
    ['floor50', game.floor >= 50],
    ['butcher', game.kills >= 100],
    ['massacre', s.maxKillsInTurn >= 5],
    ['annihilate', s.maxHit >= 50],
    ['swift', s.turnsTo5 > 0 && s.turnsTo5 <= 60],
    ['cheat-death', s.revived],
    ['midas', game.r('crown') >= 3],
    ['elite50', meta.elitesSlain + s.elites >= 50],
    ['knight10', game.hero === 'knight' && game.floor >= 10],
    ['necro10', game.hero === 'necro' && game.floor >= 10],
    ['paladin-lich', game.hero === 'paladin' && (s.bosses.lich ?? 0) > 0],
    ['ranger-arrows', s.arrowKills >= 25],
    ['mage10', game.hero === 'mage' && game.floor >= 10],
    ['barbarian-rage', game.hero === 'barbarian' && game.floor >= 10],
    ['full-party', HEROES.every((h) => meta.heroes.includes(h.id))],
    ['forbidden', UNLOCKABLE_RELICS.every((id) => meta.relics.includes(id))],
    ['soulbound', meta.earned >= 2000],
    ['forge', s.fusions > 0],
    ['forge2', s.fusions >= 2],
    ['forge-all', FUSIONS.every((f) => meta.fusions[f.id])],
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
  unlocks: UnlockNote[];
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
  noteBestRun(game);
  const unlocks = progressUnlocks(game);
  saveMeta();
  return { souls, lines, achievements, unlocks };
}

// ---------- titles, looks and the Bestiary ----------

export function lookUnlocked(l: LookDef): boolean {
  const u = l.unlock;
  if ('feat' in u) return Boolean(meta.achievements[u.feat]);
  if ('rank' in u) return rankIndex(meta.earned) >= u.rank;
  return (meta.bestiaryTier[u.beast] ?? 0) > u.tier;
}

export function titleUnlocked(id: string): boolean {
  const [kind, key] = id.split(':');
  if (kind === 'feat') return Boolean(meta.achievements[key]);
  if (kind === 'beast') return (meta.bestiaryTier[key as EnemyKind] ?? 0) > TITLE_TIER;
  if (kind === 'rank') return meta.earned >= (SOUL_RANKS.find((r) => r.name === key)?.souls ?? Infinity);
  return false;
}

export function unlockedTitles() {
  return TITLES.filter((t) => titleUnlocked(t.id));
}

export function equipTitle(id: string) {
  meta.title = id && titleUnlocked(id) ? id : '';
  saveMeta();
}

export function equipLook(id: string) {
  const look = LOOKS.find((l) => l.id === id);
  meta.look = look && lookUnlocked(look) ? id : '';
  saveMeta();
}

/** A line for the unlock banner: icon, headline, detail. */
export interface UnlockNote {
  icon: string;
  title: string;
  detail: string;
}

/** After a run: Bestiary milestones, new looks and Soul Rank-ups to announce. */
function progressUnlocks(game: Game): UnlockNote[] {
  const notes: UnlockNote[] = [];
  for (const kind of BESTIARY_KINDS) {
    const add = game.stats.kinds[kind] ?? 0;
    if (!add) continue;
    const total = (meta.bestiary[kind] ?? 0) + add;
    meta.bestiary[kind] = total;
    const tiers = bestiaryTiers(kind);
    let paid = meta.bestiaryTier[kind] ?? 0;
    while (paid < tiers.length && total >= tiers[paid]) {
      const souls = TIER_SOULS[paid];
      meta.souls += souls;
      meta.earned += souls;
      const title = paid === TITLE_TIER ? ` · title: ${BESTIARY_TITLES[kind]}` : '';
      notes.push({ icon: '📜', title: `Bestiary: ${tiers[paid]} ${kind === 'boss' ? 'Bone Wardens' : kind === 'abbot' ? 'Plague Abbots' : kind === 'lich' ? 'Lich Kings' : `${kind}s`}`, detail: `+${souls} Souls${title}` });
      paid++;
    }
    meta.bestiaryTier[kind] = paid;
  }
  const rank = rankIndex(meta.earned);
  if (rank > meta.rankSeen) {
    meta.rankSeen = rank;
    notes.push({ icon: '👑', title: `Soul Rank: ${SOUL_RANKS[rank].name}`, detail: 'New title unlocked in your Hall' });
  }
  for (const look of LOOKS) {
    if (!meta.looksSeen.includes(look.id) && lookUnlocked(look)) {
      meta.looksSeen.push(look.id);
      notes.push({ icon: '🎨', title: `New look: ${look.name}`, detail: 'Wear it from your Hall' });
    }
  }
  return notes;
}

/** Keep the deepest run for each hero, for their statue in the Hall. */
function noteBestRun(game: Game) {
  const run = {
    floor: game.floor,
    kills: game.kills,
    mode: game.mode,
    relics: { ...game.relics } as Record<string, number>,
    log: [...game.relicLog],
    look: meta.look,
    at: Date.now(),
  };
  meta.best[game.hero] = betterRun(meta.best[game.hero], run);
}

/** Record a fusion made at the Soul Forge. True the first time it's ever made. */
export function noteFusion(id: FusedId): boolean {
  meta.codex[id] = (meta.codex[id] ?? 0) + 1;
  const first = !meta.fusions[id];
  if (first) meta.fusions[id] = Date.now();
  saveMeta();
  return first;
}

export function relicDiscovered(id: RelicId): boolean {
  return (meta.codex[id] ?? 0) > 0;
}
