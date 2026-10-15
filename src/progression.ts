// Long-term progression shown off in the Crypt Hall: Soul Ranks from lifetime Souls,
// titles to wear under your name, cosmetic looks for the hero, and the Bestiary.

import { ACHIEVEMENTS, type HeroId } from './content';
import type { EnemyKind } from './game';

// ---------- Soul Ranks ----------

export interface SoulRank {
  name: string;
  /** Lifetime Souls needed. */
  souls: number;
  color: string;
}

export const SOUL_RANKS: SoulRank[] = [
  { name: 'Grave Digger', souls: 0, color: '#9a8fa8' },
  { name: 'Bone Collector', souls: 200, color: '#e8dcc4' },
  { name: 'Crypt Keeper', souls: 600, color: '#7ee081' },
  { name: 'Death Knight', souls: 1500, color: '#9fe8ff' },
  { name: 'Lich Lord', souls: 4000, color: '#b07cff' },
  { name: 'Lord of the Abyss', souls: 10000, color: '#f2c14e' },
];

export function rankIndex(earned: number): number {
  let i = 0;
  while (i + 1 < SOUL_RANKS.length && earned >= SOUL_RANKS[i + 1].souls) i++;
  return i;
}

export function rankFor(earned: number): SoulRank {
  return SOUL_RANKS[rankIndex(earned)];
}

/** Progress toward the next rank, 0..1, and the Souls still needed (null at the top). */
export function rankProgress(earned: number): { next: SoulRank | null; fraction: number; needed: number } {
  const i = rankIndex(earned);
  const next = SOUL_RANKS[i + 1] ?? null;
  if (!next) return { next: null, fraction: 1, needed: 0 };
  const from = SOUL_RANKS[i].souls;
  return { next, fraction: (earned - from) / (next.souls - from), needed: next.souls - earned };
}

// ---------- the Bestiary ----------

export const BESTIARY_KINDS: EnemyKind[] = ['ghoul', 'bat', 'archer', 'brute', 'wraith', 'boss', 'abbot', 'lich'];
const BOSSES: EnemyKind[] = ['boss', 'abbot', 'lich'];

/** Kill counts for each milestone tier; bosses are rarer, so their tiers are lower. */
export function bestiaryTiers(kind: EnemyKind): number[] {
  return BOSSES.includes(kind) ? [1, 5, 25, 100] : [25, 100, 500, 2000];
}

export const TIER_SOULS = [10, 30, 100, 300];

/** The title earned at a kind's third tier. */
export const BESTIARY_TITLES: Partial<Record<EnemyKind, string>> = {
  ghoul: 'Ghoulbane',
  bat: 'Batcatcher',
  archer: 'Bonebreaker',
  brute: 'Giantslayer',
  wraith: 'Spirit Hunter',
  boss: 'Wardenbane',
  abbot: 'Plaguebreaker',
  lich: 'Kingslayer',
};
export const TITLE_TIER = 2;

// ---------- titles ----------

export interface TitleDef {
  id: string;
  name: string;
  /** How to earn it, for locked titles. */
  how: string;
}

export const TITLES: TitleDef[] = [
  ...ACHIEVEMENTS.map((a) => ({ id: `feat:${a.id}`, name: a.name, how: a.desc })),
  ...BESTIARY_KINDS.map((k) => ({
    id: `beast:${k}`,
    name: BESTIARY_TITLES[k]!,
    how: `Slay ${bestiaryTiers(k)[TITLE_TIER]} ${k === 'boss' ? 'Bone Wardens' : k === 'abbot' ? 'Plague Abbots' : k === 'lich' ? 'Lich Kings' : `${k}s`}.`,
  })),
  ...SOUL_RANKS.slice(1).map((r) => ({ id: `rank:${r.name}`, name: r.name, how: `Earn ${r.souls.toLocaleString()} Souls in total.` })),
];

export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t])) as Record<string, TitleDef>;

// ---------- cosmetic looks ----------

export interface LookDef {
  id: string;
  name: string;
  /** Cloak colours: light and shade. */
  cloak: { p: string; P: string };
  /** Colour of the drifting aura motes, if any. */
  aura: string | null;
  /** What unlocks it: an achievement, a Soul Rank (index) or a Bestiary tier. */
  unlock: { feat: string } | { rank: number } | { beast: EnemyKind; tier: number };
  how: string;
}

export const LOOKS: LookDef[] = [
  { id: 'bone', name: 'Bone White', cloak: { p: '#d8cfb8', P: '#8f8672' }, aura: null, unlock: { feat: 'warden' }, how: 'Slay the Bone Warden.' },
  { id: 'shadow', name: 'Shadow', cloak: { p: '#2c2834', P: '#141119' }, aura: '#6b6680', unlock: { feat: 'rogue8' }, how: 'Reach floor 8 as the Rogue.' },
  { id: 'plague', name: 'Plague Green', cloak: { p: '#5f7d34', P: '#36481c' }, aura: '#b5e07a', unlock: { feat: 'abbot' }, how: 'Slay the Plague Abbot.' },
  { id: 'blood', name: 'Bloodsworn', cloak: { p: '#8a1f2c', P: '#4a0d16' }, aura: '#ff4d5a', unlock: { feat: 'close-call' }, how: 'Slay a boss with 1 HP left.' },
  { id: 'lich', name: 'Lich Violet', cloak: { p: '#5a2f8a', P: '#311854' }, aura: '#d3b0ff', unlock: { feat: 'lich' }, how: 'Slay the Lich King.' },
  { id: 'frost', name: 'Frostbound', cloak: { p: '#3e8db5', P: '#1f4a63' }, aura: '#9fe8ff', unlock: { beast: 'wraith', tier: 1 }, how: 'Slay 100 wraiths.' },
  { id: 'ember', name: 'Ember Lord', cloak: { p: '#a8401a', P: '#5c200c' }, aura: '#ff8a2a', unlock: { feat: 'butcher' }, how: 'Slay 100 foes in one run.' },
  { id: 'gold', name: 'Gilded', cloak: { p: '#c99a2e', P: '#7a5a12' }, aura: '#f2c14e', unlock: { feat: 'midas' }, how: 'Wear 3 Cursed Crowns at once.' },
  { id: 'abyss', name: 'Abyssal', cloak: { p: '#2a1640', P: '#140a22' }, aura: '#b07cff', unlock: { feat: 'floor30' }, how: 'Reach floor 30.' },
  { id: 'forgefire', name: 'Forgefire', cloak: { p: '#3b4a6b', P: '#1c2438' }, aura: '#7fb4ff', unlock: { feat: 'forge-all' }, how: 'Discover every fusion at the Soul Forge.' },
  { id: 'godforged', name: 'Godforged', cloak: { p: '#e8dcc4', P: '#a8894a' }, aura: '#fff2c0', unlock: { feat: 'ascend' }, how: 'Forge an ascended relic.' },
  { id: 'soulfire', name: 'Soulfire', cloak: { p: '#1d3b4a', P: '#0e1f28' }, aura: '#5fe3ff', unlock: { rank: 4 }, how: 'Reach the Lich Lord Soul Rank.' },
];

export const LOOK_BY_ID = Object.fromEntries(LOOKS.map((l) => [l.id, l])) as Record<string, LookDef>;

// ---------- headwear ----------
// Costume pieces drawn over the hero's hood, chosen per hero in the Wardrobe.

export type Unlock = LookDef['unlock'];

export interface HeadDef {
  id: string;
  name: string;
  /** Pixels to paint: [x, y, colour] on the 12x12 sprite. */
  pixels: [number, number, string][];
  unlock: Unlock;
  how: string;
}

const row = (y: number, x0: number, x1: number, c: string): [number, number, string][] =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y, c] as [number, number, string]);

export const HEADS: HeadDef[] = [
  {
    id: 'horns', name: 'Demon Horns', unlock: { feat: 'massacre' }, how: 'Slay 5 foes in a single turn.',
    pixels: [[2, 0, '#d23a46'], [3, 1, '#701826'], [3, 2, '#701826'], [9, 0, '#d23a46'], [8, 1, '#701826'], [8, 2, '#701826']],
  },
  {
    id: 'halo', name: 'Halo', unlock: { feat: 'paladin-lich' }, how: 'Slay the Lich King as the Paladin.',
    pixels: [...row(0, 3, 8, '#fff2c0'), [2, 0, '#f2c14e'], [9, 0, '#f2c14e']],
  },
  {
    id: 'witch', name: 'Witch Hat', unlock: { feat: 'mage10' }, how: 'Reach floor 10 as the Mage.',
    pixels: [...row(2, 2, 9, '#2c2148'), ...row(1, 4, 7, '#2c2148'), [5, 1, '#f2c14e'], [6, 1, '#f2c14e'], [6, 0, '#2c2148'], [7, 0, '#2c2148'], [8, 0, '#4b3a78']],
  },
  {
    id: 'skull', name: 'Skull Mask', unlock: { beast: 'archer', tier: 1 }, how: 'Slay 100 skeleton archers.',
    pixels: [...row(3, 4, 7, '#e8dcc4'), [4, 4, '#e8dcc4'], [6, 4, '#e8dcc4'], [5, 4, '#d23a46'], [7, 4, '#d23a46'], [5, 5, '#e8dcc4'], [6, 5, '#e8dcc4']],
  },
  {
    id: 'circlet', name: 'Gold Circlet', unlock: { rank: 3 }, how: 'Reach the Death Knight Soul Rank.',
    pixels: [...row(2, 3, 8, '#f2c14e'), [5, 2, '#9fe8ff'], [6, 1, '#f2c14e']],
  },
  {
    id: 'antlers', name: 'Antlers', unlock: { feat: 'ranger-arrows' }, how: 'Slay 25 foes with arrows in one run.',
    pixels: [[1, 0, '#a8894a'], [2, 1, '#a8894a'], [3, 1, '#a8894a'], [2, 0, '#a8894a'], [10, 0, '#a8894a'], [9, 1, '#a8894a'], [8, 1, '#a8894a'], [9, 0, '#a8894a']],
  },
  {
    id: 'plague', name: 'Plague Doctor', unlock: { beast: 'abbot', tier: 1 }, how: 'Slay 5 Plague Abbots.',
    pixels: [...row(1, 2, 9, '#1a1520'), ...row(0, 4, 7, '#1a1520'), [5, 4, '#9fe8ff'], [7, 4, '#9fe8ff'], [8, 5, '#c9c3b2'], [9, 5, '#c9c3b2'], [7, 5, '#c9c3b2']],
  },
  {
    id: 'flame', name: 'Burning Crown', unlock: { feat: 'annihilate' }, how: 'Deal 50 or more damage in one hit.',
    pixels: [...row(1, 3, 8, '#ff8a2a'), [3, 0, '#ff8a2a'], [5, 0, '#f2c14e'], [6, 0, '#ff8a2a'], [8, 0, '#f2c14e'], [2, 1, '#d23a46'], [9, 1, '#d23a46']],
  },
  {
    id: 'icecrown', name: 'Ice Crown', unlock: { beast: 'wraith', tier: 2 }, how: 'Slay 500 wraiths.',
    pixels: [...row(1, 3, 8, '#9fe8ff'), [3, 0, '#ffffff'], [5, 0, '#9fe8ff'], [6, 0, '#9fe8ff'], [8, 0, '#ffffff']],
  },
  {
    id: 'tophat', name: "Gravedigger's Hat", unlock: { feat: 'gravekeeper' }, how: 'Read every epitaph in the Hollow.',
    pixels: [...row(0, 4, 7, '#1a1520'), ...row(1, 4, 7, '#d23a46'), ...row(2, 2, 9, '#1a1520')],
  },
  {
    id: 'forgehelm', name: 'Forged Helm', unlock: { feat: 'forge' }, how: 'Fuse two relics at the Soul Forge.',
    pixels: [...row(1, 3, 8, '#5d667a'), ...row(2, 3, 8, '#5d667a'), [3, 3, '#5d667a'], [8, 3, '#5d667a'], ...row(0, 5, 6, '#5fe3ff')],
  },
];

export const HEAD_BY_ID = Object.fromEntries(HEADS.map((h) => [h.id, h])) as Record<string, HeadDef>;

/** A hero's costume: cloak colour and aura (a look) and headwear. */
export interface Outfit {
  look: string;
  head: string;
}

// ---------- best runs (the Hall's statues) ----------

export interface BestRun {
  floor: number;
  kills: number;
  mode: 'daily' | 'endless';
  /** Relic counts and pick order, for drawing the statue in its final form. */
  relics: Record<string, number>;
  log: string[];
  look: string;
  /** Headwear worn on that run ('' for none; missing on older records). */
  head?: string;
  at: number;
}

export type BestRuns = Partial<Record<HeroId, BestRun>>;

export function betterRun(a: BestRun | undefined, b: BestRun | undefined): BestRun | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.floor > a.floor || (b.floor === a.floor && b.kills > a.kills) ? b : a;
}
