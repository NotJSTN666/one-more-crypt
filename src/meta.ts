// Progress that carries between runs: Souls, unlocks, achievements, the relic codex
// and discovered combos. Saved locally and, when signed in, to the player's account.

import { ACHIEVEMENT_BY_ID, COMBOS, HEROES, HERO_BY_ID, dailyHero, type AchievementDef, type ComboDef, type HeroId } from './content';
import { Game, REAPER_FLOOR, TITHE_SOULS, UNDEAD, basePool, fullPool, type Mode, type RunConfig } from './game';
import { cleanGraveState, newGraveState, type GraveState } from './graveshift';
import { ISLE_ITEM, LAND, cleanIsle, emptyIsle, fits, homeKey, homeOf, islePerks, itemAt, layout, owned, type IsleState } from './isle';
import { centralDate } from './daily';
import { QUESTS } from './story';
import { FUSIONS, RELICS, UNLOCKABLE_RELICS, type FusedId, type RelicId } from './relics';
import {
  AURAS, AURA_BY_ID, DUNCE_AT, SHAME, BESTIARY_KINDS, BESTIARY_TITLES, DECOR_BY_ID, beastPlural, HEADS, HEAD_BY_ID, HERO_CLOAKS, HERO_COSTUMES, LOOKS, LOOK_BY_ID, SEASONS, SOUL_RANKS, TIER_SOULS, TITLES, TITLE_BY_ID, TITLE_TIER, WELCOME, STORY_ALL, RAID_REWARDS,
  betterRun, bestiaryTiers, rankIndex, seasonOf, seasonOpen, type AuraDef, type BestRuns, type SeasonId, type HeadDef, type LookDef, type Outfit, type RunGoal, type Unlock, type WelcomeReward,
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
  /** Daily number -> place (1-3) for each Daily Descent finished on the podium. */
  podiums: Record<string, number>;
  /** The last daily already checked for a podium finish. */
  podiumChecked: number;
  /** Cosmetics and Hall decorations bought in the Ossuary. */
  bought: string[];
  /** Daily play streak, shown in the Hall: the longest ever, and the run ending at `last`. */
  streak: { best: number; count: number; last: number };
  /** Today's bounties: which three, progress toward each, and which have paid out. */
  bounties: { day: number; ids: string[]; progress: number[]; done: boolean[] };
  /** Week start (YYYY-MM-DD) -> place (1-3) on that week's Endless board, and the last week checked. */
  weekly: Record<string, number>;
  weeklyChecked: string;
  /** Story progress: chapters finished, choices made, and floors cleared with the hound. */
  story: StoryProgress;
  /** The companion that trails your hero outside the story ('' for none). Looks only. */
  pet: string;
  /** When your ghost's summons were last counted. */
  summonsSeen: string;
  /** A supporter on Ko-fi (set from the patrons table): the Patron title is theirs. */
  patron: boolean;
  /** The crypt's keeper: every cosmetic and title, granted by account in social.ts. */
  vault: boolean;
  /** Seven Nights: gifts claimed so far (0-7) and the daily number of the last claim. */
  welcome: { claimed: number; last: number };
  /** Your Isle: land cleared and everything built on it. */
  isle: IsleState;
  /** Seasons played in, e.g. 'halloween-2026', for their free pieces. */
  seasons: string[];
  /** The deepest floor ever reached, any mode (also fed from the account's synced records). */
  deepest: number;
  /** Deaths of Shame collected: id -> when first suffered. */
  shame: Record<string, number>;
  /** Challenges beaten (each counted once), and when we last checked who beat yours. */
  duels: string[];
  challengeSeen: string;
  /** Grave Shift: the old plot, its crops, graves and Obols (null until first visit). */
  grave: GraveState | null;
  /** The Bell Tolls: tolls fought in, world bosses felled together, and tolls that got away. */
  raid: RaidProgress;
  /** Bring a friend: who invited you (and whether your first run counted for them), and friends you've brought. */
  invite: { from: string; claimed: boolean; friends: number };
}

export interface RaidProgress {
  joined: string[];
  won: string[];
  lost: string[];
}

/** Story progress: quests taken, cleared (dungeon done) and finished, choices, the hound's bond, lore read. */
export interface StoryProgress {
  /** 2: the open-world Act I. Progress from the earlier chapter version starts over. */
  v: number;
  done: number[];
  active: number[];
  cleared: number[];
  choices: Record<string, string>;
  bond: number;
  journal: string[];
}

const STORY_V = 2;
const emptyStory = (): StoryProgress => ({ v: STORY_V, done: [], active: [], cleared: [], choices: {}, bond: 0, journal: [] });

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
  leech: 400,
  headsman: 450,
  thunder: 550,
  grail: 650,
  glass: 800,
};

const KEY = 'wardenfall:meta';

function empty(): Meta {
  return {
    souls: 0, earned: 0, heroes: ['knight'], relics: [], achievements: {}, codex: {}, combos: {}, fusions: {}, elitesSlain: 0, hero: 'knight',
    bestiary: {}, bestiaryTier: {}, best: {}, title: '', look: '', looksSeen: [], rankSeen: 0, heroStats: {}, heroBackfill: 0, epitaphs: [], outfits: {}, headsSeen: [], heroUnlocks: {},
    podiums: {}, podiumChecked: 0, bought: [], streak: { best: 0, count: 0, last: 0 },
    bounties: { day: 0, ids: [], progress: [], done: [] },
    weekly: {}, weeklyChecked: '',
    story: emptyStory(), pet: '', summonsSeen: '', patron: false, vault: false, welcome: { claimed: 0, last: 0 }, isle: emptyIsle(), seasons: [], deepest: 0, shame: {}, duels: [], challengeSeen: '', grave: null, raid: { joined: [], won: [], lost: [] }, invite: { from: '', claimed: false, friends: 0 },
  };
}

const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(String))] : []);
function cleanRaid(r: unknown): RaidProgress {
  const o = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
  return { joined: ids(o.joined).slice(-40), won: ids(o.won), lost: ids(o.lost).slice(-40) };
}

function cleanInvite(v: unknown): Meta['invite'] {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return { from: typeof o.from === 'string' ? o.from.slice(0, 24) : '', claimed: o.claimed === true, friends: Math.max(0, Math.min(10000, Math.floor(Number(o.friends) || 0))) };
}

function cleanWelcome(w: unknown): Meta['welcome'] {
  const o = w && typeof w === 'object' ? (w as Record<string, unknown>) : {};
  return { claimed: Math.max(0, Math.min(WELCOME.length, Math.floor(Number(o.claimed) || 0))), last: Math.max(0, Math.floor(Number(o.last) || 0)) };
}

function load(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const m: Meta = { ...empty(), ...JSON.parse(raw) };
    // The story moved into the open world: earlier chapter progress starts over (the hound stays).
    m.isle = cleanIsle(m.isle);
    m.welcome = cleanWelcome(m.welcome);
    m.raid = cleanRaid(m.raid);
    m.invite = cleanInvite(m.invite);
    m.grave = m.grave ? cleanGraveState(m.grave, Date.now()) : null;
    m.story = m.story?.v === STORY_V ? { ...emptyStory(), ...m.story } : { ...emptyStory(), choices: m.story?.choices ?? {}, bond: m.story?.bond ?? 0 };
    return m;
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
  meta.patron ||= other.patron === true;
  meta.vault ||= other.vault === true;
  // Seven Nights: the device that got further wins.
  const ow = cleanWelcome(other.welcome);
  if (ow.claimed > meta.welcome.claimed || (ow.claimed === meta.welcome.claimed && ow.last > meta.welcome.last)) meta.welcome = ow;
  meta.deepest = Math.max(meta.deepest, Number(other.deepest) || 0);
  const oi = cleanInvite(other.invite);
  meta.invite = { from: meta.invite.from || oi.from, claimed: meta.invite.claimed || oi.claimed, friends: Math.max(meta.invite.friends, oi.friends) };
  const or = cleanRaid(other.raid);
  meta.raid = cleanRaid({ joined: [...meta.raid.joined, ...or.joined], won: [...meta.raid.won, ...or.won], lost: [...meta.raid.lost, ...or.lost] });
  meta.shame = { ...(other.shame ?? {}), ...meta.shame };
  // Grave Shift is one plot: whichever device changed it last wins.
  if (other.grave && typeof other.grave === 'object' && (Number(other.grave.at) || 0) > (meta.grave?.at ?? -1)) meta.grave = cleanGraveState(other.grave, Date.now());
  meta.duels = [...new Set([...meta.duels, ...(Array.isArray(other.duels) ? other.duels.map(String) : [])])];
  if (String(other.challengeSeen ?? '') > meta.challengeSeen) meta.challengeSeen = String(other.challengeSeen);
  meta.seasons = [...new Set([...meta.seasons, ...(Array.isArray(other.seasons) ? other.seasons.map(String) : [])])];
  // The isle is one layout: whichever device changed it last wins.
  if (other.isle && (Number(other.isle.at) || 0) > meta.isle.at) meta.isle = cleanIsle(other.isle);
  meta.title ||= other.title ?? '';
  meta.look ||= other.look ?? '';
  meta.looksSeen = [...new Set([...meta.looksSeen, ...(other.looksSeen ?? [])])];
  meta.headsSeen = [...new Set([...meta.headsSeen, ...(other.headsSeen ?? [])])];
  for (const [h, ids] of Object.entries(other.heroUnlocks ?? {})) {
    if (Array.isArray(ids)) meta.heroUnlocks[h as HeroId] = [...new Set([...(meta.heroUnlocks[h as HeroId] ?? []), ...ids.map(String)])];
  }
  for (const [h, o] of Object.entries(other.outfits ?? {})) {
    if (!o || typeof o !== 'object') continue;
    const mine = meta.outfits[h as HeroId];
    if (!mine) meta.outfits[h as HeroId] = { look: String(o.look ?? ''), head: String(o.head ?? ''), aura: String(o.aura ?? '') };
    else if (!mine.aura && o.aura) mine.aura = String(o.aura);
  }
  meta.rankSeen = Math.max(meta.rankSeen, other.rankSeen ?? 0);
  for (const [h, st] of Object.entries(other.heroStats ?? {})) mergeHeroStats(h as HeroId, st);
  meta.heroBackfill = Math.max(meta.heroBackfill, other.heroBackfill ?? 0);
  meta.epitaphs = [...new Set([...meta.epitaphs, ...(other.epitaphs ?? [])])];
  for (const [d, place] of Object.entries(other.podiums ?? {})) {
    const p = Number(place);
    if (p >= 1 && p <= 3) meta.podiums[d] = Math.min(meta.podiums[d] ?? 9, p);
  }
  meta.podiumChecked = Math.max(meta.podiumChecked, other.podiumChecked ?? 0);
  meta.bought = [...new Set([...meta.bought, ...(Array.isArray(other.bought) ? other.bought.map(String) : [])])];
  const os = other.story;
  if (os && typeof os === 'object') {
    const nums = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => n > 0 && n < 100) : []);
    const union = (a: number[], b: unknown) => [...new Set([...a, ...nums(b)])].sort((x, y) => x - y);
    // Quest progress from the earlier chapter version doesn't carry over.
    if (os.v === STORY_V) {
      meta.story.done = union(meta.story.done, os.done);
      meta.story.active = union(meta.story.active, os.active);
      meta.story.cleared = union(meta.story.cleared, os.cleared);
      meta.story.journal = [...new Set([...meta.story.journal, ...(Array.isArray(os.journal) ? os.journal.map(String) : [])])];
    }
    for (const [k, v] of Object.entries(os.choices ?? {})) if (!meta.story.choices[k] && typeof v === 'string') meta.story.choices[k] = v;
    meta.story.bond = Math.max(meta.story.bond, Number(os.bond) || 0);
  }
  meta.pet ||= typeof other.pet === 'string' ? other.pet : '';
  if (typeof other.summonsSeen === 'string' && other.summonsSeen > meta.summonsSeen) meta.summonsSeen = other.summonsSeen;
  for (const [w, place] of Object.entries(other.weekly ?? {})) {
    const p = Number(place);
    if (p >= 1 && p <= 3) meta.weekly[w] = Math.min(meta.weekly[w] ?? 9, p);
  }
  if (typeof other.weeklyChecked === 'string' && other.weeklyChecked > meta.weeklyChecked) meta.weeklyChecked = other.weeklyChecked;
  const ob = other.bounties;
  if (ob && typeof ob === 'object' && Array.isArray(ob.ids) && ob.ids.length === 3) {
    const day = Number(ob.day) || 0;
    if (day > meta.bounties.day) {
      meta.bounties = { day, ids: ob.ids.map(String), progress: [0, 1, 2].map((i) => Number(ob.progress?.[i]) || 0), done: [0, 1, 2].map((i) => Boolean(ob.done?.[i])) };
    } else if (day === meta.bounties.day && ob.ids.join() === meta.bounties.ids.join()) {
      meta.bounties.progress = [0, 1, 2].map((i) => Math.max(meta.bounties.progress[i] ?? 0, Number(ob.progress?.[i]) || 0));
      meta.bounties.done = [0, 1, 2].map((i) => Boolean(meta.bounties.done[i] || ob.done?.[i]));
    }
  }
  const st = other.streak;
  if (st && typeof st === 'object') {
    meta.streak.best = Math.max(meta.streak.best, Number(st.best) || 0);
    const last = Number(st.last) || 0;
    if (last > meta.streak.last || (last === meta.streak.last && (Number(st.count) || 0) > meta.streak.count)) {
      meta.streak.last = last;
      meta.streak.count = Number(st.count) || 0;
    }
  }
  const changed = JSON.stringify(meta) !== before;
  if (changed) saveMeta();
  return changed;
}

// ---------- unlocks ----------

export function heroUnlocked(id: HeroId): boolean {
  // The Bell-Ringer is earned in the story, never bought.
  if (HERO_BY_ID[id]?.story) return storyDone(STORY_ALL);
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
/** Depth zones and secret vaults reach the daily crypt with Daily #6. */
export const DEPTHS_DAILY = 6;
/** Abyss boons join the daily from this crypt on, so everyone in a daily plays the same rules. */
export const BOONS_DAILY = 12;
/** Death comes for deep runs from this Daily (the day after it was announced), and in every new Endless run. */
export const REAPER_DAILY = 14;
/** The deep boons and boon-filled vaults reach the Daily from this one (the day after they were added). */
export const DEEP_DAILY = 15;

/** The daily crypt is identical for everyone; Endless uses your hero and unlocks. */
export function runConfig(mode: Mode, dailyNo: number): RunConfig {
  // Daily #1 ran with the launch relic set; new relics join from Daily #2.
  // The Soul Forge opens with Daily #2, so everyone in a daily crypt plays the same rules.
  if (mode === 'daily') {
    const config: RunConfig = { hero: dailyHero(dailyNo), pool: fullPool(dailyNo <= 1), forge: dailyNo >= FORGE_DAILY, mercy: dailyNo >= MERCY_DAILY };
    if (dailyNo >= DEPTHS_DAILY) config.depths = true;
    if (dailyNo >= BOONS_DAILY) config.boons = true;
    if (dailyNo >= REAPER_DAILY) config.reaper = true;
    if (dailyNo >= DEEP_DAILY) config.deep = true;
    return config;
  }
  const hero = heroUnlocked(meta.hero) ? meta.hero : 'knight';
  const config: RunConfig = { hero, pool: basePool(meta.relics.filter((id) => UNLOCKABLE_RELICS.includes(id))), forge: true, mercy: true, depths: true, boons: true, reaper: true, deep: true };
  // The isle's buildings help in Endless (never the Daily).
  const { vigor } = islePerks(meta.isle);
  if (vigor) config.vigor = vigor;
  return config;
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
const DEPTH_FEATS = new Set(['floor5', 'floor10', 'floor15', 'floor20', 'floor30', 'floor50', 'swift', 'rogue8', 'knight10', 'necro10', 'mage10', 'barbarian-rage', 'hoarder']);

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
    ['deathsdoor', Boolean(game.config.reaper) && game.floor >= REAPER_FLOOR],
    ['outran', Boolean(game.config.reaper) && game.floor >= REAPER_FLOOR + 25],
    ['cheated', Boolean(game.config.reaper) && game.floor >= REAPER_FLOOR + 50],
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
    // Story chapters start deeper with gift relics, so depth and speed feats aren't earned there.
    if (game.mode === 'story' && DEPTH_FEATS.has(id)) continue;
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

/** Keep the Hall's streak in step with the dailies played. Returns true if it changed. */
export function noteStreak(s: { best: number; count: number; last: number }): boolean {
  const before = JSON.stringify(meta.streak);
  meta.streak = {
    best: Math.max(meta.streak.best, s.best),
    count: s.last >= meta.streak.last ? s.count : meta.streak.count,
    last: Math.max(meta.streak.last, s.last),
  };
  if (JSON.stringify(meta.streak) === before) return false;
  saveMeta();
  return true;
}

/** Pay out Souls at the end of a run. */
export function finishRunMeta(game: Game, streak: number): RunReward {
  const lines = runSouls(game);
  // Soul Tithe (an Abyss boon): paid on top, outside the Soul Well's share.
  const tithe = game.boons.tithe * TITHE_SOULS;
  const bonus = game.mode === 'daily' ? 0 : islePerks(meta.isle).souls;
  if (bonus) lines.push(['Soul Well', Math.round(lines.reduce((sum, [, n]) => sum + n, 0) * bonus)]);
  if (tithe) lines.push([`Soul Tithe ×${game.boons.tithe}`, tithe]);
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
  // Playing while a season is open earns its free pieces (announced with the unlocks below).
  for (const season of openSeasons()) {
    const tag = `${season}-${centralDate().slice(0, 4)}`;
    if (!meta.seasons.includes(tag)) meta.seasons.push(tag);
  }
  const shame = noteShame(game);
  const unlocks = [...shame, ...progressUnlocks(game)];
  saveMeta();
  return { souls, lines, achievements, unlocks };
}

// ---------- titles, looks and the Bestiary ----------

export function lookUnlocked(l: LookDef): boolean {
  if (meta.vault) return true;
  return 'cost' in l.unlock ? meta.bought.includes(l.id) : unlockMet(l.unlock);
}

export function headUnlocked(h: HeadDef): boolean {
  if (meta.vault) return true;
  if (h.unlock && 'cost' in h.unlock) return meta.bought.includes(h.id);
  return h.unlock ? unlockMet(h.unlock) : costumeUnlocked(h.id);
}

/** The season an Ossuary item is sold in, if it's a seasonal piece. */
export function itemSeason(id: string): SeasonId | undefined {
  const aura = AURA_BY_ID[id]?.unlock;
  return DECOR_BY_ID[id]?.season ?? seasonOf(LOOK_BY_ID[id]?.unlock) ?? seasonOf(HEAD_BY_ID[id]?.unlock) ?? (aura && 'season' in aura ? aura.season : undefined);
}

/** Seasons open today (Central Time). */
export function openSeasons(now = Date.now()): SeasonId[] {
  const today = centralDate(now);
  return (Object.keys(SEASONS) as SeasonId[]).filter((id) => seasonOpen(id, today));
}

/** Buy a cosmetic or Hall decoration from the Ossuary. Seasonal pieces only while their season is open. */
export function buyItem(id: string, cost: number): boolean {
  if (meta.bought.includes(id) || meta.souls < cost) return false;
  const season = itemSeason(id);
  if (season && !openSeasons().includes(season)) return false;
  meta.souls -= cost;
  meta.bought.push(id);
  // Bought on purpose, so there's no need to announce it after the next run.
  if (!meta.looksSeen.includes(id)) meta.looksSeen.push(id);
  if (!meta.headsSeen.includes(id)) meta.headsSeen.push(id);
  if (AURA_BY_ID[id] && !meta.looksSeen.includes(`aura:${id}`)) meta.looksSeen.push(`aura:${id}`);
  saveMeta();
  return true;
}

function unlockMet(u: Unlock): boolean {
  if ('feat' in u) return Boolean(meta.achievements[u.feat]);
  if ('rank' in u) return rankIndex(meta.earned) >= u.rank;
  if ('costume' in u) return costumeUnlocked(u.costume);
  if ('podium' in u) return podiumCount(u.podium) > 0;
  if ('streak' in u) return meta.streak.best >= u.streak;
  if ('weekly' in u) return Object.values(meta.weekly).includes(u.weekly);
  if ('story' in u) return storyDone(u.story);
  if ('cost' in u) return false;
  if ('season' in u) return meta.seasons.some((x) => x.startsWith(`${u.season}-`));
  if ('shame' in u) return Object.keys(meta.shame).length >= u.shame;
  if ('welcome' in u) return meta.welcome.claimed >= u.welcome;
  if ('raid' in u) return raidWins() >= u.raid;
  if ('invite' in u) return inviteMet(u.invite);
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

/** How many times the player has finished in this place. */
export function podiumCount(place: number): number {
  return Object.values(meta.podiums).filter((p) => p === place).length;
}

/** Record a podium finish and pay its Souls. Returns false if it was already counted. */
export function grantPodium(dailyNo: number, place: number, souls: number, head: string): boolean {
  if (meta.podiums[dailyNo]) return false;
  meta.podiums[dailyNo] = place;
  meta.souls += souls;
  meta.earned += souls;
  if (!meta.headsSeen.includes(head)) meta.headsSeen.push(head);
  saveMeta();
  return true;
}

/** Take on a quest. */
export function acceptQuest(n: number) {
  if (!meta.story.active.includes(n)) meta.story.active = [...meta.story.active, n];
  saveMeta();
}

/** A quest's dungeon is cleared: the giver is waiting to hear about it. */
export function clearQuest(n: number) {
  if (!meta.story.cleared.includes(n) && !meta.story.done.includes(n)) meta.story.cleared = [...meta.story.cleared, n];
  saveMeta();
}

/** A quest is finished: record it, and pay out the first time. */
export function completeQuest(n: number, souls: number): { first: boolean; souls: number; feat: AchievementDef | null } {
  const first = !meta.story.done.includes(n);
  let feat: AchievementDef | null = null;
  meta.story.active = meta.story.active.filter((q) => q !== n);
  meta.story.cleared = meta.story.cleared.filter((q) => q !== n);
  if (first) {
    meta.story.done = [...meta.story.done, n].sort((a, b) => a - b);
    meta.souls += souls;
    meta.earned += souls;
    // The hound joins in the kennel quest and trails you everywhere from then on.
    if (n === 2 && !meta.pet) meta.pet = 'hound';
    if (n === 4) feat = grant('act1');
    if (n === 13) feat = grant('regular');
  }
  saveMeta();
  return { first, souls: first ? souls : 0, feat };
}

/** Something looked at in the world, kept in the journal. True the first time. */
export function readLore(id: string): boolean {
  if (meta.story.journal.includes(id)) return false;
  meta.story.journal = [...meta.story.journal, id];
  saveMeta();
  return true;
}

/** Remember a story choice (the first answer sticks). */
export function chooseStory(key: string, value: string) {
  if (!meta.story.choices[key]) meta.story.choices[key] = value;
  saveMeta();
}

/** Floors cleared with the hound count toward its bond even when the chapter is lost. */
export function noteBond(floors: number) {
  if (floors <= 0) return;
  meta.story.bond += floors;
  saveMeta();
}

export function setPet(id: string) {
  meta.pet = id;
  saveMeta();
}

/** Record a top-3 finish on a week's Endless board and pay its Souls. False if already counted. */
export function grantWeekly(week: string, place: number, souls: number, head: string): boolean {
  if (meta.weekly[week]) return false;
  meta.weekly[week] = place;
  meta.souls += souls;
  meta.earned += souls;
  if (head && !meta.headsSeen.includes(head)) meta.headsSeen.push(head);
  saveMeta();
  return true;
}

// ---------- Grave Shift ----------

/** The player's plot, made fresh on the first visit. */
export function graveState(): GraveState {
  if (!meta.grave) {
    meta.grave = newGraveState(Date.now());
    saveMeta();
  }
  return meta.grave;
}

// ---------- challenges ----------

/** Souls for beating someone's challenge, the first time. */
export const DUEL_SOULS = 50;

/** Record beating a challenge. Pays once per challenge; five wins earn Duelist. */
export function noteDuelWin(code: string): { souls: number; feat: AchievementDef | null } {
  if (meta.duels.includes(code)) return { souls: 0, feat: null };
  meta.duels.push(code);
  meta.souls += DUEL_SOULS;
  meta.earned += DUEL_SOULS;
  const feat = meta.duels.length >= 5 ? grant('duelist') : null;
  saveMeta();
  return { souls: DUEL_SOULS, feat };
}

export function noteChallengeSeen(at: string) {
  if (at > meta.challengeSeen) {
    meta.challengeSeen = at;
    saveMeta();
  }
}

// ---------- Deaths of Shame ----------

const SHAME_SOULS = 25;

/** Which Deaths of Shame a finished run counts as (from how it ended). */
export function shameFor(game: Game): string[] {
  const d = game.deathInfo;
  if (!d || game.phase !== 'dead') return [];
  const ground = d.cause === 'the spikes' || d.cause === 'the lava';
  const tests: [string, boolean][] = [
    ['victory-lap', ground && d.cleared],
    ['pincushion', d.cause === 'the spikes'],
    ['hotfoot', d.cause === 'the lava'],
    ['almost-there', d.nearStairs],
    ['bat-snack', d.kind === 'bat'],
    ['kaboom', d.cause === 'an exploding foe'],
    ['glass-jaw', d.hpBefore >= d.maxHp],
    ['colorblind', d.telegraphed],
    ['outlasted', d.lastFoe],
    ['speedrun', game.turns <= 15],
    ['floor-one', game.floor === 1],
    ['borrowed-time', d.revivedHere],
  ];
  return tests.filter(([, ok]) => ok).map(([id]) => id);
}

/** Record the run's Deaths of Shame. New ones pay Souls and unlock their title. */
function noteShame(game: Game): UnlockNote[] {
  if (game.mode === 'story') return [];
  const notes: UnlockNote[] = [];
  for (const id of shameFor(game)) {
    if (meta.shame[id]) continue;
    const def = SHAME.find((x) => x.id === id);
    if (!def) continue;
    meta.shame[id] = Date.now();
    meta.souls += SHAME_SOULS;
    meta.earned += SHAME_SOULS;
    notes.push({ icon: def.emoji, title: `Death of Shame: ${def.title}`, detail: `+${SHAME_SOULS} Souls · new title "${def.title}"` });
  }
  const n = Object.keys(meta.shame).length;
  if (notes.length && n < DUNCE_AT) notes.push({ icon: '🪦', title: `Deaths of Shame: ${n}/${SHAME.length}`, detail: `${DUNCE_AT - n} more for the Dunce Cap` });
  return notes;
}

// ---------- your isle ----------

export type BuildResult = 'ok' | 'souls' | 'blocked' | 'max';

/** Set a thing down (outside, or in a house's `room`): from storage if there's one waiting, otherwise bought with Souls. */
export function placeIsleItem(id: string, x: number, y: number, room?: string): BuildResult {
  const it = ISLE_ITEM[id];
  if (!it || (room && !homeOf(meta.isle, room)) || !fits(meta.isle, id, x, y, room)) return 'blocked';
  const stored = meta.isle.stored[id] ?? 0;
  if (!stored) {
    if (it.max && owned(meta.isle, id) >= it.max) return 'max';
    if (meta.souls < it.cost) return 'souls';
    meta.souls -= it.cost;
  } else if (stored > 1) meta.isle.stored[id] = stored - 1;
  else delete meta.isle.stored[id];
  layout(meta.isle, room).push([id, x, y]);
  meta.isle.at = Date.now();
  saveMeta();
  return 'ok';
}

/** Pick up whatever is on this tile and keep it in storage. Returns its id. A house takes its furniture with it. */
export function pickUpIsleItem(x: number, y: number, room?: string): string | null {
  const i = itemAt(meta.isle, x, y, room);
  if (i < 0) return null;
  const taken = layout(meta.isle, room).splice(i, 1)[0];
  const store = (id: string) => (meta.isle.stored[id] = (meta.isle.stored[id] ?? 0) + 1);
  const [id] = taken;
  store(id);
  if (!room && ISLE_ITEM[id].home) {
    for (const [f] of meta.isle.rooms[homeKey(taken)] ?? []) store(f);
    delete meta.isle.rooms[homeKey(taken)];
  }
  meta.isle.at = Date.now();
  saveMeta();
  return id;
}

/** Clear the next stretch of land. */
export function buyLand(): boolean {
  const next = LAND[meta.isle.land];
  if (!next || meta.souls < next.cost) return false;
  meta.souls -= next.cost;
  meta.isle.land++;
  meta.isle.at = Date.now();
  saveMeta();
  return true;
}

/** Total runs finished, every hero counted. */
export function runsPlayed(): number {
  return Object.values(meta.heroStats).reduce((n, s) => n + (s?.runs ?? 0), 0);
}

/** Mark this player a supporter. True the first time. */
export function grantPatron(): boolean {
  if (meta.patron) return false;
  meta.patron = true;
  saveMeta();
  return true;
}

/** Open every cosmetic, title and Hall decoration (never relics or heroes). True the first time. */
export function grantVault(): boolean {
  if (meta.vault) return false;
  meta.vault = true;
  const sold = [...LOOKS, ...HERO_CLOAKS, ...HEADS, ...AURAS].filter((x) => x.unlock && 'cost' in x.unlock).map((x) => x.id);
  for (const id of [...sold, ...Object.keys(DECOR_BY_ID)]) if (!meta.bought.includes(id)) meta.bought.push(id);
  // Mark it all seen, so the next run doesn't announce fifty unlocks.
  for (const id of [...LOOKS, ...HERO_CLOAKS].map((x) => x.id)) if (!meta.looksSeen.includes(id)) meta.looksSeen.push(id);
  for (const a of AURAS) if (!meta.looksSeen.includes(`aura:${a.id}`)) meta.looksSeen.push(`aura:${a.id}`);
  for (const h of HEADS) if (!meta.headsSeen.includes(h.id)) meta.headsSeen.push(h.id);
  saveMeta();
  return true;
}

export function titleUnlocked(id: string): boolean {
  if (meta.vault && TITLE_BY_ID[id]) return true;
  const [kind, key] = id.split(':');
  if (kind === 'podium') return podiumCount(Number(key)) > 0;
  if (kind === 'patron') return meta.patron;
  if (kind === 'welcome') return meta.welcome.claimed >= Number(key);
  if (kind === 'invite') return inviteMet(Number(key));
  if (kind === 'story') return storyDone(key === 'all' || key === 'bell' ? STORY_ALL : Number(key));
  if (kind === 'shame') return Boolean(meta.shame[key]);
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
  const aura = o?.aura ?? '';
  return {
    look: LOOK_BY_ID[look] && fitsHero(hero, 'look', look) && lookUnlocked(LOOK_BY_ID[look]) ? look : '',
    head: HEAD_BY_ID[head] && fitsHero(hero, 'head', head) && headUnlocked(HEAD_BY_ID[head]) ? head : '',
    aura: AURA_BY_ID[aura] && auraUnlocked(AURA_BY_ID[aura]) ? aura : '',
  };
}

/** The deepest floor this player has reached, in any mode and on any device. */
export function deepestFloor(): number {
  const best = Object.values(meta.best).map((r) => r?.floor ?? 0);
  const stats = Object.values(meta.heroStats).map((st) => st?.floor ?? 0);
  return Math.max(meta.deepest, 0, ...best, ...stats);
}

/** Record a floor reached (e.g. the account's best Endless run, synced from the server). */
export function noteDeepest(floor: number) {
  if (floor > meta.deepest) {
    meta.deepest = floor;
    saveMeta();
  }
}

export function auraUnlocked(a: AuraDef): boolean {
  if (meta.vault) return true;
  const u = a.unlock;
  if ('floor' in u) return deepestFloor() >= u.floor;
  if ('wins' in u) return podiumCount(1) >= u.wins;
  if ('streak' in u) return meta.streak.best >= u.streak;
  if ('rank' in u) return rankIndex(meta.earned) >= u.rank;
  if ('patron' in u) return meta.patron;
  if ('welcome' in u) return meta.welcome.claimed >= u.welcome;
  if ('story' in u) return storyDone(u.story);
  if ('raid' in u) return raidWins() >= u.raid;
  if ('invite' in u) return inviteMet(u.invite);
  return meta.bought.includes(a.id);
}

/** Dress a hero in the Wardrobe; locked pieces are ignored. */
export function equipOutfit(hero: HeroId, part: keyof Outfit, id: string) {
  const cur = outfitFor(hero);
  const ok =
    !id ||
    (part === 'aura'
      ? AURA_BY_ID[id] && auraUnlocked(AURA_BY_ID[id])
      : fitsHero(hero, part, id) && (part === 'look' ? LOOK_BY_ID[id] && lookUnlocked(LOOK_BY_ID[id]) : HEAD_BY_ID[id] && headUnlocked(HEAD_BY_ID[id])));
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
      notes.push({ icon: '📜', title: `Bestiary: ${tiers[paid]} ${beastPlural(kind)}`, detail: `+${souls} Souls${title}` });
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
  for (const a of AURAS) {
    const seen = `aura:${a.id}`;
    if (!meta.looksSeen.includes(seen) && auraUnlocked(a)) {
      meta.looksSeen.push(seen);
      notes.push({ icon: '✨', title: `New aura: ${a.name}`, detail: 'Radiate it in the Wardrobe' });
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
  // Hall statues remember real runs, not story chapters.
  if (game.mode === 'story') return;
  const run = {
    floor: game.floor,
    kills: game.kills,
    mode: game.mode === 'daily' ? ('daily' as const) : ('endless' as const),
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
        floor: g.floor, kills: g.kills, mode: g.mode === 'daily' ? 'daily' : 'endless', relics: { ...g.relics } as Record<string, number>, log: [...g.relicLog], look: '', at: 0,
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

// ---------- story rewards ----------

/** A quest of the story finished (or, for STORY_ALL, every one of them). */
export function storyDone(n: number): boolean {
  if (n === STORY_ALL) return QUESTS.every((q) => meta.story.done.includes(q.n));
  return meta.story.done.includes(n);
}

// ---------- Seven Nights ----------

/** Today's Seven Nights gift, if one is waiting to be claimed (by finishing a run). */
export function welcomeWaiting(today: number): { day: number; reward: WelcomeReward } | null {
  const w = meta.welcome;
  if (w.claimed >= WELCOME.length || w.last === today) return null;
  return { day: w.claimed + 1, reward: WELCOME[w.claimed] };
}

/** The next gift after today's, for "come back tomorrow". */
export function welcomeNext(): { day: number; reward: WelcomeReward } | null {
  const w = meta.welcome;
  return w.claimed < WELCOME.length ? { day: w.claimed + 1, reward: WELCOME[w.claimed] } : null;
}

/** Claim today's gift. Returns what was given, or null if there's nothing today. */
export function claimWelcome(today: number): { day: number; reward: WelcomeReward } | null {
  const gift = welcomeWaiting(today);
  if (!gift) return null;
  const r = gift.reward;
  if ('souls' in r) {
    meta.souls += r.souls;
    meta.earned += r.souls;
  }
  meta.welcome = { claimed: gift.day, last: today };
  // Announced by Seven Nights itself, not again as a new unlock after the next run.
  if ('look' in r && !meta.looksSeen.includes(r.look)) meta.looksSeen.push(r.look);
  if ('aura' in r && !meta.looksSeen.includes(`aura:${r.aura}`)) meta.looksSeen.push(`aura:${r.aura}`);
  if ('head' in r && !meta.headsSeen.includes(r.head)) meta.headsSeen.push(r.head);
  saveMeta();
  return gift;
}

// ---------- The Bell Tolls ----------

/** World bosses felled together. */
export function raidWins(): number {
  return meta.raid.won.length;
}

/** Fought in this toll: its outcome is checked once it's over. */
export function noteRaidJoin(id: string) {
  if (meta.raid.joined.includes(id)) return;
  meta.raid.joined = [...meta.raid.joined, id].slice(-40);
  saveMeta();
}

/** A toll you fought in is decided. Returns the reward number earned (1-based), or 0. */
export function settleRaid(id: string, felled: boolean): number {
  if (!meta.raid.joined.includes(id) || meta.raid.won.includes(id) || meta.raid.lost.includes(id)) return 0;
  if (felled) {
    meta.raid.won.push(id);
    // Shown on its own reward screen, so the next run needn't announce it again.
    const r = RAID_REWARDS[meta.raid.won.length - 1];
    if (r?.kind === 'look' && !meta.looksSeen.includes(r.id)) meta.looksSeen.push(r.id);
    if (r?.kind === 'aura' && !meta.looksSeen.includes(`aura:${r.id}`)) meta.looksSeen.push(`aura:${r.id}`);
    if (r?.kind === 'head' && !meta.headsSeen.includes(r.id)) meta.headsSeen.push(r.id);
  } else meta.raid.lost = [...meta.raid.lost, id].slice(-40);
  saveMeta();
  return felled ? meta.raid.won.length : 0;
}

/** Tolls fought in whose outcome isn't known yet. */
export function unsettledRaids(): string[] {
  return meta.raid.joined.filter((id) => !meta.raid.won.includes(id) && !meta.raid.lost.includes(id));
}

// ---------- Bring a friend ----------

/** The nth Bring-a-friend reward: n friends brought (the first is also the invited friend's own). */
export function inviteMet(n: number): boolean {
  return meta.invite.friends >= n || (n === 1 && meta.invite.claimed);
}

/** Arrived from a friend's invite link: remember who, once. */
export function noteInvitedBy(name: string) {
  if (meta.invite.from || meta.invite.claimed) return;
  meta.invite.from = name;
  saveMeta();
}

/** The invite was settled: it counted (claimed), or it can't (cleared). */
export function settleInvite(counted: boolean) {
  if (counted) meta.invite.claimed = true;
  else meta.invite.from = '';
  saveMeta();
}

/** The server's count of friends you've brought. Returns how many are new since last time. */
export function noteFriends(n: number): number {
  const fresh = Math.max(0, n - meta.invite.friends);
  if (fresh) {
    meta.invite.friends = n;
    saveMeta();
  }
  return fresh;
}
