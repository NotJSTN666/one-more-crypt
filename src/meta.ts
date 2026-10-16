// Progress that carries between runs: Souls, unlocks, achievements, the relic codex
// and discovered combos. Saved locally and, when signed in, to the player's account.

import { ACHIEVEMENT_BY_ID, COMBOS, HEROES, HERO_BY_ID, dailyHero, type AchievementDef, type ComboDef, type HeroId } from './content';
import { Game, UNDEAD, basePool, fullPool, type Mode, type RunConfig } from './game';
import { FUSIONS, RELICS, UNLOCKABLE_RELICS, type FusedId, type RelicId } from './relics';
import {
  BESTIARY_KINDS, BESTIARY_TITLES, HEADS, HEAD_BY_ID, HERO_CLOAKS, HERO_COSTUMES, LOOKS, LOOK_BY_ID, SOUL_RANKS, TIER_SOULS, TITLES, TITLE_TIER, betterRun, bestiaryTiers, rankIndex,
  type BestRuns, type HeadDef, type LookDef, type Outfit, type RunGoal, type Unlock,
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
  /** Deepest floor and Souls earned with each hero. */
  heroStats: Partial<Record<HeroId, HeroStats>>;
  /** Epitaphs read in the Hollow. */
  epitaphs: string[];
  /** Set once per-hero records have been rebuilt from the account's past runs. */
  heroBackfill: number;
  /** Looks already announced, and the highest Soul Rank announced. */
  looksSeen: string[];
  /** Each hero's costume, set in the Wardrobe. Heroes without one wear `look`. */
  outfits: Partial<Record<HeroId, Outfit>>;
  /** Headwear already announced. */
  headsSeen: string[];
  /** Hero costumes earned by a feat within one run (records like floors are checked live). */
  heroUnlocks: Partial<Record<HeroId, string[]>>;
  rankSeen: number;
}

export interface HeroStats {
  floor: number;
  souls: number;
  runs: number;
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
    bestiary: {}, bestiaryTier: {}, best: {}, title: '', look: '', looksSeen: [], rankSeen: 0, heroStats: {}, heroBackfill: 0, epitaphs: [], outfits: {}, headsSeen: [], heroUnlocks: {},
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
  meta.headsSeen = [...new Set([...meta.headsSeen, ...(other.headsSeen ?? [])])];
  for (const [h, ids] of Object.entries(other.heroUnlocks ?? {})) {
    if (Array.isArray(ids)) meta.heroUnlocks[h as HeroId] = [...new Set([...(meta.heroUnlocks[h as HeroId] ?? []), ...ids.map(String)])];
  }
  for (const [h, o] of Object.entries(other.outfits ?? {})) {
    if (!meta.outfits[h as HeroId] && o && typeof o === 'object') meta.outfits[h as HeroId] = { look: String(o.look ?? ''), head: String(o.head ?? '') };
  }
  meta.rankSeen = Math.max(meta.rankSeen, other.rankSeen ?? 0);
  for (const [h, st] of Object.entries(other.heroStats ?? {})) mergeHeroStats(h as HeroId, st);
  meta.heroBackfill = Math.max(meta.heroBackfill, other.heroBackfill ?? 0);
  meta.epitaphs = [...new Set([...meta.epitaphs, ...(other.epitaphs ?? [])])];
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
/** Early-game tuning (gentler first floors) starts with Daily #4. */
export const MERCY_DAILY = 4;

/** The daily crypt is identical for everyone; Endless uses your hero and unlocks. */
export function runConfig(mode: Mode, dailyNo: number): RunConfig {
  // Daily #1 ran with the launch relic set; new relics join from Daily #2.
  // The Soul Forge opens with Daily #2, so everyone in a daily crypt plays the same rules.
  if (mode === 'daily') return { hero: dailyHero(dailyNo), pool: fullPool(dailyNo <= 1), forge: dailyNo >= FORGE_DAILY, mercy: dailyNo >= MERCY_DAILY };
  const hero = heroUnlocked(meta.hero) ? meta.hero : 'knight';
  return { hero, pool: basePool(meta.relics.filter((id) => UNLOCKABLE_RELICS.includes(id))), forge: true, mercy: true };
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
    ['forge-all', FUSIONS.filter((f) => f.tier !== 2).every((f) => meta.fusions[f.id])],
    ['ascend', FUSIONS.some((f) => f.tier === 2 && game.own(f.id) > 0)],
    ['ascend-all', FUSIONS.filter((f) => f.tier === 2).every((f) => meta.fusions[f.id])],
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

/** Keep the best of two records for a hero (from another device, or rebuilt from past runs). */
export function mergeHeroStats(hero: HeroId, st: Partial<HeroStats> | undefined) {
  if (!st || !HEROES.some((h) => h.id === hero)) return;
  const cur = meta.heroStats[hero] ?? { floor: 0, souls: 0, runs: 0 };
  meta.heroStats[hero] = {
    floor: Math.max(cur.floor, Number(st.floor) || 0),
    souls: Math.max(cur.souls, Number(st.souls) || 0),
    runs: Math.max(cur.runs, Number(st.runs) || 0),
  };
}

/** The Souls a finished run pays, line by line (achievements aside). */
export function runSouls(game: Game): [string, number][] {
  const bosses = Object.values(game.stats.bosses).reduce((a, b) => a + (b ?? 0), 0);
  const lines: [string, number][] = [
    [`Floor ${game.floor}`, game.floor * 4],
    [`${game.kills} kills`, game.kills],
  ];
  if (game.stats.elites) lines.push([`${game.stats.elites} elites`, game.stats.elites * 3]);
  if (bosses) lines.push([`${bosses} boss${bosses > 1 ? 'es' : ''}`, bosses * 20]);
  if (game.mode === 'daily') lines.push(['Daily bonus', Math.round(lines.reduce((sum, [, n]) => sum + n, 0) * 0.5)]);
  return lines;
}

/** Pay out Souls at the end of a run. */
export function finishRunMeta(game: Game, streak: number): RunReward {
  const lines = runSouls(game);
  const souls = lines.reduce((sum, [, n]) => sum + n, 0);
  const st = meta.heroStats[game.hero] ?? { floor: 0, souls: 0, runs: 0 };
  meta.heroStats[game.hero] = { floor: Math.max(st.floor, game.floor), souls: st.souls + souls, runs: st.runs + 1 };
  meta.souls += souls;
  meta.earned += souls;
  meta.elitesSlain += game.stats.elites;
  const achievements = checkRun(game);
  for (const id of [streak >= 3 ? 'streak3' : '', streak >= 7 ? 'streak7' : '']) {
    const got = id && grant(id);
    if (got) achievements.push(got);
  }
  noteBestRun(game);
  noteHeroCostumes(game);
  const unlocks = progressUnlocks(game);
  saveMeta();
  return { souls, lines, achievements, unlocks };
}

// ---------- titles, looks and the Bestiary ----------

export function lookUnlocked(l: LookDef): boolean {
  return unlockMet(l.unlock);
}

export function headUnlocked(h: HeadDef): boolean {
  return h.unlock ? unlockMet(h.unlock) : costumeUnlocked(h.id);
}

function unlockMet(u: Unlock): boolean {
  if ('feat' in u) return Boolean(meta.achievements[u.feat]);
  if ('rank' in u) return rankIndex(meta.earned) >= u.rank;
  if ('costume' in u) return costumeUnlocked(u.costume);
  return (meta.bestiaryTier[u.beast] ?? 0) > u.tier;
}

/** A hero's own costume piece: earned in a run, or reached through that hero's records. */
export function costumeUnlocked(id: string): boolean {
  const c = HERO_COSTUMES.find((x) => x.id === id);
  if (!c) return false;
  if (meta.heroUnlocks[c.hero]?.includes(id)) return true;
  const st = meta.heroStats[c.hero];
  const need = c.need;
  if ('floor' in need) return Math.max(st?.floor ?? 0, meta.best[c.hero]?.floor ?? 0) >= need.floor;
  if ('souls' in need) return (st?.souls ?? 0) >= need.souls;
  if ('runs' in need) return (st?.runs ?? 0) >= need.runs;
  return false;
}

/** Whether a piece can be worn by this hero: shared pieces by anyone, the rest by their own hero. */
export function fitsHero(hero: HeroId, part: keyof Outfit, id: string): boolean {
  const owner = part === 'head' ? HEAD_BY_ID[id]?.hero : HERO_CLOAKS.find((c) => c.id === id)?.hero;
  return !owner || owner === hero;
}

/** How far one run went toward a costume goal. */
function runGoal(game: Game, goal: RunGoal): number {
  const s = game.stats;
  switch (goal) {
    case 'bosses': return Object.values(s.bosses).reduce((a, b) => a + (b ?? 0), 0);
    case 'undead': return UNDEAD.reduce((a, k) => a + (s.kinds[k] ?? 0), 0);
    case 'allies': return s.maxAllies;
    default: return s[goal];
  }
}

/** Record costumes the hero just earned with a feat in this run. */
function noteHeroCostumes(game: Game) {
  for (const c of HERO_COSTUMES) {
    if (c.hero !== game.hero || !('run' in c.need)) continue;
    if (runGoal(game, c.need.run) < c.need.n) continue;
    const got = meta.heroUnlocks[c.hero] ?? [];
    if (!got.includes(c.id)) meta.heroUnlocks[c.hero] = [...got, c.id];
  }
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

/** What a hero wears: their Wardrobe outfit, or the default look and no headwear. */
export function outfitFor(hero: HeroId): Outfit {
  const o = meta.outfits[hero];
  const look = o ? o.look : meta.look;
  const head = o?.head ?? '';
  return {
    look: LOOK_BY_ID[look] && fitsHero(hero, 'look', look) && lookUnlocked(LOOK_BY_ID[look]) ? look : '',
    head: HEAD_BY_ID[head] && fitsHero(hero, 'head', head) && headUnlocked(HEAD_BY_ID[head]) ? head : '',
  };
}

/** Dress a hero in the Wardrobe; locked pieces are ignored. */
export function equipOutfit(hero: HeroId, part: keyof Outfit, id: string) {
  const cur = outfitFor(hero);
  const ok = !id || (fitsHero(hero, part, id) && (part === 'look' ? LOOK_BY_ID[id] && lookUnlocked(LOOK_BY_ID[id]) : HEAD_BY_ID[id] && headUnlocked(HEAD_BY_ID[id])));
  if (!ok) return;
  meta.outfits[hero] = { ...cur, [part]: id };
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
      notes.push({ icon: '🎨', title: `New cloak: ${look.name}`, detail: 'Dress your heroes in the Wardrobe' });
    }
  }
  for (const head of HEADS) {
    if (!meta.headsSeen.includes(head.id) && headUnlocked(head)) {
      meta.headsSeen.push(head.id);
      notes.push({ icon: '🎩', title: `New costume: ${head.name}`, detail: head.hero ? `For the ${HERO_BY_ID[head.hero].name}, in the Wardrobe` : 'For any hero, in the Wardrobe' });
    }
  }
  for (const c of HERO_CLOAKS) {
    if (!meta.looksSeen.includes(c.id) && lookUnlocked(c)) {
      meta.looksSeen.push(c.id);
      notes.push({ icon: '🎨', title: `New cloak: ${c.name}`, detail: `For the ${HERO_BY_ID[c.hero].name}, in the Wardrobe` });
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
    ...outfitFor(game.hero),
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

/** Read an epitaph in the Hollow. Reading them all earns the Gravekeeper achievement. */
export function readEpitaph(id: string, total: number): AchievementDef | null {
  if (meta.epitaphs.includes(id)) return null;
  meta.epitaphs.push(id);
  const got = meta.epitaphs.length >= total ? grant('gravekeeper') : null;
  saveMeta();
  return got;
}

export function relicDiscovered(id: RelicId): boolean {
  return (meta.codex[id] ?? 0) > 0;
}

/** A past run as stored on the account: enough to replay it. */
export interface PastRun {
  mode: Mode;
  daily_no: number | null;
  seed: number;
  floor: number;
  kills: number;
  log: string;
}

/**
 * Rebuild each hero's deepest floor, Souls earned and Hall statue from the account's
 * past runs, by replaying them. Runs once per account; yields between runs so the
 * page stays smooth.
 */
/** Bumped when rebuilding gets better, so every account rebuilds once more. */
export const BACKFILL_VERSION = 2;

export async function backfillHeroes(runs: PastRun[]): Promise<void> {
  const totals: Partial<Record<HeroId, HeroStats>> = {};
  for (const run of runs) {
    let hero: HeroId;
    let floor = run.floor;
    let souls: number;
    if (run.log.startsWith('#')) {
      let g: Game;
      try {
        g = Game.replay(run.mode, Number(run.seed), run.daily_no ?? 0, run.log);
      } catch {
        continue;
      }
      hero = g.hero;
      // Runs recorded under older rules can replay differently; trust the recorded result then.
      const exact = g.floor === run.floor && g.kills === run.kills;
      floor = run.floor;
      souls = exact ? runSouls(g).reduce((sum, [, n]) => sum + n, 0) : Math.round(run.floor * 4 + run.kills + Math.floor(run.floor / 5) * 20);
      if (exact) meta.best[hero] = betterRun(meta.best[hero], {
        floor: g.floor, kills: g.kills, mode: g.mode, relics: { ...g.relics } as Record<string, number>, log: [...g.relicLog], look: '', at: 0,
      });
    } else {
      // The earliest daily runs were logged without a header: estimate from the result.
      if (run.mode !== 'daily') continue;
      hero = dailyHero(run.daily_no ?? 1);
      souls = Math.round((run.floor * 4 + run.kills + Math.floor(run.floor / 5) * 20) * 1.5);
    }
    const t = totals[hero] ?? { floor: 0, souls: 0, runs: 0 };
    totals[hero] = { floor: Math.max(t.floor, floor), souls: t.souls + souls, runs: t.runs + 1 };
    await new Promise((r) => setTimeout(r, 0));
  }
  for (const [h, st] of Object.entries(totals)) mergeHeroStats(h as HeroId, st);
  meta.heroBackfill = BACKFILL_VERSION;
  saveMeta();
}
