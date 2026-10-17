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
  { id: 'podium:1', name: 'Crypt Champion', how: 'Finish 1st in a Daily Descent.' },
];

/** Rewards for the top 3 of each Daily Descent, given once the day is over. */
export const PODIUM = [
  { place: 1, medal: '🥇', name: 'Crypt Champion', souls: 300, head: 'champcrown' },
  { place: 2, medal: '🥈', name: 'Silver Shade', souls: 150, head: 'silvercirclet' },
  { place: 3, medal: '🥉', name: 'Bronze Bones', souls: 75, head: 'bronzelaurel' },
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
  unlock: { feat: string } | { rank: number } | { beast: EnemyKind; tier: number } | { costume: string } | { podium: number } | { cost: number } | { streak: number };
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

// Cloaks sold in the Ossuary for Souls. Looks only, so the daily crypt stays fair.
const sold = (cost: number) => ({ unlock: { cost }, how: `Sold in the Ossuary for ${cost.toLocaleString()} Souls.` });
LOOKS.push(
  { id: 'cinder', name: 'Cinder Cloak', cloak: { p: '#b5431c', P: '#6e2410' }, aura: '#ff8a2a', ...sold(300) },
  { id: 'moss', name: 'Gravemoss', cloak: { p: '#4f6b3a', P: '#2a3b1f' }, aura: null, ...sold(300) },
  { id: 'glacier', name: 'Glacier Shroud', cloak: { p: '#7fb4d8', P: '#3d6a8a' }, aura: '#e8fbff', ...sold(450) },
  { id: 'ash', name: 'Ashen Robe', cloak: { p: '#8a8590', P: '#4a4652' }, aura: '#c8c3d7', ...sold(500) },
  { id: 'royal', name: 'Royal Purple', cloak: { p: '#7a34b0', P: '#3a1458' }, aura: '#f2c14e', ...sold(700) },
  { id: 'void', name: 'Voidwalker', cloak: { p: '#1a1430', P: '#0a0716' }, aura: '#7b5cff', ...sold(900) },
  { id: 'ghostlight', name: 'Ghostlight', cloak: { p: '#c9f2e6', P: '#7fb8a8' }, aura: '#e8fff8', ...sold(1100) },
  { id: 'molten', name: 'Molten Gold', cloak: { p: '#e0aa2e', P: '#8a6012' }, aura: '#ffd23f', ...sold(1500) },
  // Legendary: drifts embers in the crypt.
  { id: 'inferno', name: 'Inferno Mantle', cloak: { p: '#ff5a1f', P: '#8a1f0c' }, aura: '#ff8a2a', ...sold(5000) },
);

export const LOOK_BY_ID = Object.fromEntries(LOOKS.map((l) => [l.id, l])) as Record<string, LookDef>;

/** Ossuary items that are pure show: the price, and whether it's a legendary piece. */
export function shopPrice(unlock: Unlock | undefined): number {
  return unlock && 'cost' in unlock ? unlock.cost : 0;
}
export const LEGENDARY = ['inferno', 'skullhalo'];

// ---------- Hall decorations ----------
// Bought in the Ossuary and shown in your Crypt Hall, for you and every visitor.

export interface DecorDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  desc: string;
}

export const DECOR: DecorDef[] = [
  { id: 'skulls', name: 'Skull Piles', emoji: '💀', cost: 300, desc: 'Heaps of skulls in the corners of your Hall.' },
  { id: 'carpet', name: 'Blood Carpet', emoji: '🟥', cost: 500, desc: 'A gold-trimmed red carpet before your statues.' },
  { id: 'cat', name: 'Grave Cat', emoji: '🐈‍⬛', cost: 700, desc: 'A black cat that keeps watch, and blinks.' },
  { id: 'braziers', name: 'Twin Braziers', emoji: '🔥', cost: 900, desc: 'Two roaring braziers either side of your throne room.' },
  { id: 'tomb', name: 'Your Tomb', emoji: '🪦', cost: 1500, desc: 'A gravestone with your name and deepest floor carved in.' },
  { id: 'throne', name: 'Bone Throne', emoji: '🪑', cost: 2500, desc: 'A throne of bone at the heart of your Hall.' },
];
export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d])) as Record<string, DecorDef>;

// ---------- costumes ----------
// Headwear is drawn over the hero's hood. A few pieces are shared by every hero; the
// rest belong to one hero each and are earned by playing to that hero's strengths.

export type Unlock = LookDef['unlock'];

type Px = [number, number, string][];

const row = (y: number, x0: number, x1: number, c: string): Px =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y, c] as [number, number, string]);

/** What a hero-specific costume asks for: a record with the hero, or a feat in one run. */
export type HeroNeed =
  | { floor: number }
  | { souls: number }
  | { runs: number }
  | { run: RunGoal; n: number };

export type RunGoal =
  | 'bosses' | 'shadowSteps' | 'dodges' | 'raised' | 'allies' | 'undead' | 'arrowKills' | 'maxHit' | 'lowHpKills' | 'cleanFloors';

export interface HeadDef {
  id: string;
  name: string;
  /** Pixels to paint: [x, y, colour] on the 12x12 sprite. */
  pixels: Px;
  /** Shared pieces unlock account-wide; hero pieces through `hero` and `need`. */
  unlock?: Unlock;
  hero?: HeroId;
  need?: HeroNeed;
  how: string;
}

const HERO_NAMES: Record<HeroId, string> = {
  knight: 'Knight', rogue: 'Rogue', necro: 'Necromancer', paladin: 'Paladin', ranger: 'Ranger', mage: 'Mage', barbarian: 'Barbarian',
};

/** "Reach floor 10 as the Knight." and so on. */
export function needText(hero: HeroId, need: HeroNeed): string {
  const as = `as the ${HERO_NAMES[hero]}`;
  if ('floor' in need) return `Reach floor ${need.floor} ${as}.`;
  if ('souls' in need) return `Earn ${need.souls.toLocaleString()} Souls ${as}.`;
  if ('runs' in need) return `Play ${need.runs} runs ${as}.`;
  const n = need.n;
  const goal: Record<RunGoal, string> = {
    bosses: `Slay ${n} bosses in one run`,
    shadowSteps: `Take ${n} unseen steps in one run`,
    dodges: `Dodge ${n} attacks in one run`,
    raised: `Raise ${n} thralls in one run`,
    allies: `Command ${n} thralls at once`,
    undead: `Slay ${n} undead in one run`,
    arrowKills: `Slay ${n} foes with arrows in one run`,
    maxHit: `Deal ${n} damage in one hit`,
    lowHpKills: `Slay ${n} foes at 3 HP or less in one run`,
    cleanFloors: `Clear ${n} floors without being hit in one run`,
  };
  return `${goal[need.run]} ${as}.`;
}

const hero = (id: string, name: string, h: HeroId, need: HeroNeed, pixels: Px): HeadDef => ({ id, name, hero: h, need, pixels, how: needText(h, need) });

const STEEL = '#c9d1e0';
const BONE = '#e8dcc4';
const GOLD = '#f2c14e';
const RED = '#d23a46';
const DARK = '#1a1520';

/** Streak milestones and their helms: [days, id, name, pixels]. */
export const STREAK_HELMS: [number, string, string, HeadDef['pixels']][] = [
  [5, 'pilgrim', "Pilgrim's Cap", [...row(1, 4, 7, '#8a5a28'), ...row(2, 3, 8, '#b07a3c'), [3, 3, '#8a5a28'], [8, 3, '#8a5a28'], [5, 0, '#cd8f4a'], [6, 0, '#cd8f4a']]],
  [10, 'vigil', 'Vigil Helm', [...row(1, 3, 8, STEEL), ...row(2, 3, 8, '#9aa3b5'), [3, 3, '#9aa3b5'], [8, 3, '#9aa3b5'], [5, 0, BONE], [6, 0, '#ff8a2a']]],
  [20, 'devoted', 'Helm of the Devoted', [...row(0, 4, 7, '#c9d1e0'), ...row(1, 3, 8, '#eef3fb'), ...row(2, 3, 8, '#c9d1e0'), [3, 3, '#c9d1e0'], [8, 3, '#c9d1e0'], [3, 4, '#c9d1e0'], [8, 4, '#c9d1e0'], [5, 1, '#5fe3ff'], [6, 1, '#5fe3ff']]],
  [30, 'moonsworn', 'Moonsworn Helm', [...row(1, 3, 8, '#2a1640'), ...row(2, 3, 8, '#3b2060'), [3, 3, '#2a1640'], [8, 3, '#2a1640'], [4, 0, GOLD], [5, 0, '#fff2c0'], [6, 0, '#fff2c0'], [7, 0, GOLD], [5, 2, '#d3b0ff'], [6, 2, '#d3b0ff']]],
  [50, 'eternal', 'Eternal Helm', [...row(1, 4, 7, GOLD), ...row(2, 3, 8, '#a8781f'), [3, 3, '#a8781f'], [8, 3, '#a8781f'], [5, 0, RED], [6, 0, RED], [1, 1, '#ffffff'], [2, 1, '#ffffff'], [2, 2, '#e8dcc4'], [10, 1, '#ffffff'], [9, 1, '#ffffff'], [9, 2, '#e8dcc4']]],
  [100, 'undying', 'Crown of the Undying', [...row(1, 3, 8, '#0b0710'), ...row(2, 3, 8, '#701826'), [3, 0, RED], [5, 0, '#ff8a2a'], [6, 0, GOLD], [8, 0, RED], [5, 2, '#ff4d5a'], [6, 2, '#ff4d5a'], [2, 1, '#701826'], [9, 1, '#701826']]],
];

export const HEADS: HeadDef[] = [
  // Shared by every hero.
  // Daily podium rewards: only ever won by finishing in the top 3 of a Daily Descent.
  { id: 'champcrown', name: "Champion's Crown", unlock: { podium: 1 }, how: 'Finish 1st in a Daily Descent.', pixels: [[3, 0, GOLD], [5, 0, '#fff2c0'], [6, 0, '#fff2c0'], [8, 0, GOLD], ...row(1, 3, 8, GOLD), ...row(2, 3, 8, '#a8781f'), [4, 2, RED], [5, 2, '#9fe8ff'], [6, 2, '#9fe8ff'], [7, 2, RED]] },
  { id: 'silvercirclet', name: 'Silver Circlet', unlock: { podium: 2 }, how: 'Finish 2nd in a Daily Descent.', pixels: [...row(2, 3, 8, '#c9d1e0'), [5, 1, '#eef3fb'], [6, 1, '#eef3fb'], [5, 2, '#9fe8ff'], [6, 2, '#7fb4ff']] },
  // Sold in the Ossuary for Souls.
  { id: 'jester', name: 'Jester Cap', ...sold(400), pixels: [...row(2, 3, 8, '#5a1622'), [3, 1, RED], [2, 0, RED], [8, 1, '#2e8b57'], [9, 0, '#2e8b57'], [1, 0, GOLD], [10, 0, GOLD]] },
  { id: 'toadstool', name: 'Toadstool Cap', ...sold(500), pixels: [...row(0, 4, 7, '#c0392b'), ...row(1, 3, 8, '#c0392b'), ...row(2, 2, 9, '#c0392b'), [5, 0, '#ffffff'], [4, 1, '#ffffff'], [7, 1, '#ffffff'], [3, 2, '#ffffff'], [8, 2, '#ffffff']] },
  { id: 'candles', name: 'Candle Crown', ...sold(600), pixels: [...row(2, 3, 8, BONE), [3, 1, BONE], [3, 0, '#ff8a2a'], [6, 1, BONE], [6, 0, GOLD], [8, 1, BONE], [8, 0, '#ff8a2a']] },
  { id: 'ironhorns', name: 'Iron Horns', ...sold(700), pixels: [...row(2, 4, 7, '#5d667a'), [3, 2, '#5d667a'], [8, 2, '#5d667a'], [2, 1, '#8a8a96'], [2, 0, STEEL], [9, 1, '#8a8a96'], [9, 0, STEEL]] },
  { id: 'raven', name: 'Raven Mask', ...sold(800), pixels: [...row(3, 4, 7, '#141119'), [6, 5, '#3a3346'], [7, 5, '#3a3346'], [8, 5, '#5a5466'], [9, 6, '#5a5466']] },
  { id: 'cyclops', name: 'Cyclops Helm', ...sold(1000), pixels: [...row(1, 3, 8, STEEL), ...row(2, 3, 8, '#9aa3b5'), ...row(3, 3, 8, '#9aa3b5'), ...row(4, 3, 8, '#9aa3b5'), [5, 4, '#ff4d5a'], [6, 4, '#ff4d5a']] },
  { id: 'executioner', name: "Executioner's Hood", ...sold(1200), pixels: [...row(0, 4, 7, '#0b0710'), ...row(1, 3, 8, '#0b0710'), ...row(2, 2, 9, '#0b0710'), ...row(3, 2, 9, '#0b0710'), [3, 4, '#0b0710'], [4, 4, '#0b0710'], [6, 4, '#0b0710'], [8, 4, '#0b0710']] },
  { id: 'pumpkin', name: "Jack-o'-Lantern", ...sold(1500), pixels: [[5, 0, '#3d6b2a'], [6, 0, '#3d6b2a'], ...row(1, 4, 7, '#e67e22'), ...row(2, 3, 8, '#e67e22'), ...row(3, 3, 8, '#e67e22'), ...row(4, 3, 8, '#e67e22'), ...row(5, 3, 8, '#e67e22'), ...row(6, 4, 7, '#d35400'), [4, 3, '#ffd23f'], [7, 3, '#ffd23f'], [4, 5, '#ffd23f'], [5, 5, '#2a1505'], [6, 5, '#ffd23f'], [7, 5, '#2a1505']] },
  // Legendary: skulls circle your head in the crypt.
  { id: 'skullhalo', name: 'Halo of Skulls', ...sold(10000), pixels: [...row(0, 3, 8, '#fff2c0'), [2, 1, GOLD], [9, 1, GOLD]] },
  { id: 'bronzelaurel', name: 'Bronze Laurel', unlock: { podium: 3 }, how: 'Finish 3rd in a Daily Descent.', pixels: [[2, 3, '#8a5a28'], [2, 2, '#b07a3c'], [3, 1, '#cd8f4a'], [4, 1, '#b07a3c'], [9, 3, '#8a5a28'], [9, 2, '#b07a3c'], [8, 1, '#cd8f4a'], [7, 1, '#b07a3c']] },
  // Daily streak helms: play the Daily Descent this many days in a row. Kept for good once earned.
  ...STREAK_HELMS.map(([n, id, name, pixels]) => ({ id, name, unlock: { streak: n }, how: `Play the daily ${n} days in a row.`, pixels })),
  { id: 'tophat', name: "Gravedigger's Hat", unlock: { feat: 'gravekeeper' }, how: 'Read every epitaph in the Hollow.', pixels: [...row(0, 4, 7, DARK), ...row(1, 4, 7, RED), ...row(2, 2, 9, DARK)] },
  { id: 'forgehelm', name: 'Forged Helm', unlock: { feat: 'forge' }, how: 'Fuse two relics at the Soul Forge.', pixels: [...row(1, 3, 8, '#5d667a'), ...row(2, 3, 8, '#5d667a'), [3, 3, '#5d667a'], [8, 3, '#5d667a'], ...row(0, 5, 6, '#5fe3ff')] },

  // Knight: steadfast, a boss-slayer who keeps coming back.
  hero('greathelm', 'Great Helm', 'knight', { floor: 10 }, [...row(0, 4, 7, STEEL), ...row(1, 3, 8, STEEL), ...row(2, 2, 9, '#9aa3b5'), ...row(3, 3, 8, '#9aa3b5'), [3, 4, '#9aa3b5'], [4, 4, DARK], [6, 4, DARK], [8, 4, '#9aa3b5']]),
  hero('plume', 'Red Plume', 'knight', { run: 'bosses', n: 3 }, [[4, 1, GOLD], [5, 0, RED], [6, 0, RED], [7, 0, '#ff6b6b'], [8, 1, RED], [9, 2, '#701826']]),
  hero('circlet', 'Gold Circlet', 'knight', { souls: 1500 }, [...row(2, 3, 8, GOLD), [5, 2, '#9fe8ff'], [6, 1, GOLD]]),

  // Rogue: unseen and untouchable.
  hero('cowl', 'Shadow Cowl', 'rogue', { run: 'shadowSteps', n: 30 }, [...row(1, 3, 8, '#141119'), ...row(2, 2, 9, '#141119'), ...row(3, 3, 8, '#0b0710')]),
  hero('bandana', 'Bandit Mask', 'rogue', { run: 'dodges', n: 10 }, [...row(5, 4, 7, RED), [9, 5, RED], [10, 6, RED], [9, 6, '#701826']]),
  hero('tricorn', 'Tricorn', 'rogue', { floor: 15 }, [...row(0, 3, 8, DARK), ...row(1, 2, 9, DARK), [2, 1, GOLD], [9, 1, GOLD], [5, 0, GOLD]]),

  // Necromancer: an army of the dead.
  hero('bonecrown', 'Bone Crown', 'necro', { run: 'raised', n: 10 }, [...row(1, 3, 8, BONE), [3, 0, BONE], [5, 0, BONE], [6, 0, BONE], [8, 0, BONE], [5, 1, '#7ee081']]),
  hero('plague', 'Plague Doctor', 'necro', { floor: 10 }, [...row(1, 2, 9, DARK), ...row(0, 4, 7, DARK), [5, 4, '#9fe8ff'], [7, 4, '#9fe8ff'], [8, 5, '#c9c3b2'], [9, 5, '#c9c3b2'], [7, 5, '#c9c3b2']]),
  hero('skull', 'Skull Mask', 'necro', { run: 'allies', n: 3 }, [...row(3, 4, 7, BONE), [4, 4, BONE], [6, 4, BONE], [5, 4, RED], [7, 4, RED], [5, 5, BONE], [6, 5, BONE]]),

  // Paladin: the bane of the undead.
  hero('halo', 'Halo', 'paladin', { run: 'undead', n: 50 }, [...row(0, 3, 8, '#fff2c0'), [2, 0, GOLD], [9, 0, GOLD]]),
  hero('winged', 'Winged Helm', 'paladin', { floor: 10 }, [...row(1, 4, 7, GOLD), ...row(0, 5, 6, GOLD), [1, 0, '#ffffff'], [2, 0, '#ffffff'], [2, 1, '#ffffff'], [3, 1, '#ffffff'], [10, 0, '#ffffff'], [9, 0, '#ffffff'], [9, 1, '#ffffff'], [8, 1, '#ffffff']]),
  hero('suncrest', 'Sun Crest', 'paladin', { souls: 1500 }, [...row(1, 4, 7, GOLD), [5, 0, '#fff2c0'], [6, 0, '#fff2c0'], [3, 0, GOLD], [8, 0, GOLD], [2, 1, '#ff8a2a'], [9, 1, '#ff8a2a']]),

  // Ranger: the deadeye of the wilds.
  hero('antlers', 'Antlers', 'ranger', { run: 'arrowKills', n: 25 }, [[1, 0, '#a8894a'], [2, 1, '#a8894a'], [3, 1, '#a8894a'], [2, 0, '#a8894a'], [10, 0, '#a8894a'], [9, 1, '#a8894a'], [8, 1, '#a8894a'], [9, 0, '#a8894a']]),
  hero('feather', 'Feathered Cap', 'ranger', { floor: 10 }, [...row(1, 3, 8, '#55693a'), ...row(2, 2, 9, '#33421f'), [9, 0, RED], [10, 0, RED], [9, 1, GOLD]]),
  hero('wolf', 'Wolf Pelt', 'ranger', { souls: 1500 }, [...row(0, 3, 8, '#8a8a96'), ...row(1, 2, 9, '#8a8a96'), [2, 0, '#6b6680'], [9, 0, '#6b6680'], [4, 2, '#e8dcc4'], [7, 2, '#e8dcc4']]),

  // Mage: a glass cannon that hits like a storm.
  hero('witch', 'Witch Hat', 'mage', { floor: 10 }, [...row(2, 2, 9, '#2c2148'), ...row(1, 4, 7, '#2c2148'), [5, 1, GOLD], [6, 1, GOLD], [6, 0, '#2c2148'], [7, 0, '#2c2148'], [8, 0, '#4b3a78']]),
  hero('flame', 'Burning Crown', 'mage', { run: 'maxHit', n: 30 }, [...row(1, 3, 8, '#ff8a2a'), [3, 0, '#ff8a2a'], [5, 0, GOLD], [6, 0, '#ff8a2a'], [8, 0, GOLD], [2, 1, RED], [9, 1, RED]]),
  hero('icecrown', 'Ice Crown', 'mage', { run: 'cleanFloors', n: 3 }, [...row(1, 3, 8, '#9fe8ff'), [3, 0, '#ffffff'], [5, 0, '#9fe8ff'], [6, 0, '#9fe8ff'], [8, 0, '#ffffff']]),

  // Barbarian: strongest with their back to the wall.
  hero('horns', 'Demon Horns', 'barbarian', { run: 'lowHpKills', n: 10 }, [[2, 0, RED], [3, 1, '#701826'], [3, 2, '#701826'], [9, 0, RED], [8, 1, '#701826'], [8, 2, '#701826']]),
  hero('bearskull', 'Bear Skull', 'barbarian', { floor: 10 }, [...row(1, 3, 8, BONE), ...row(2, 3, 8, '#c9b99a'), [4, 3, BONE], [7, 3, BONE], [3, 0, '#c9b99a'], [8, 0, '#c9b99a']]),
  hero('warpaint', 'War Paint', 'barbarian', { souls: 1500 }, [[3, 4, RED], [4, 4, RED], [8, 4, RED], [4, 5, RED], [6, 5, RED], [7, 5, RED]]),
];

export const HEAD_BY_ID = Object.fromEntries(HEADS.map((h) => [h.id, h])) as Record<string, HeadDef>;

/** Each hero's own cloak, earned by mastering them. Worn like any look. */
export interface HeroCloak extends LookDef {
  hero: HeroId;
  need: HeroNeed;
}

const cloak = (id: string, name: string, h: HeroId, need: HeroNeed, p: string, P: string, aura: string | null): HeroCloak => ({
  id, name, hero: h, need, cloak: { p, P }, aura, unlock: { costume: id }, how: needText(h, need),
});

export const HERO_CLOAKS: HeroCloak[] = [
  cloak('banner', 'Banner Red', 'knight', { runs: 20 }, '#9a2b2b', '#561414', '#f2c14e'),
  cloak('nightshade', 'Nightshade', 'rogue', { floor: 20 }, '#1d3a3a', '#0e1f1f', '#5fe3c0'),
  cloak('gravemoss', 'Grave Moss', 'necro', { run: 'raised', n: 25 }, '#3d4a2a', '#212a14', '#b5e07a'),
  cloak('sacred', 'Sacred Gold', 'paladin', { run: 'undead', n: 100 }, '#e8d9a0', '#a8894a', '#fff2c0'),
  cloak('autumn', 'Autumn', 'ranger', { run: 'arrowKills', n: 50 }, '#a8622a', '#5c3414', '#ff8a2a'),
  cloak('arcane', 'Arcane Violet', 'mage', { floor: 15 }, '#6a3fd0', '#3a1f80', '#d3b0ff'),
  cloak('bloodrage', 'Blood Rage', 'barbarian', { run: 'lowHpKills', n: 25 }, '#701826', '#3a0a12', '#ff4d5a'),
];

for (const c of HERO_CLOAKS) LOOK_BY_ID[c.id] = c;

/** Every hero-specific piece (headwear and cloaks), for unlock checks. */
export const HERO_COSTUMES: { id: string; name: string; hero: HeroId; need: HeroNeed; part: 'head' | 'look' }[] = [
  ...HEADS.filter((h) => h.hero && h.need).map((h) => ({ id: h.id, name: h.name, hero: h.hero!, need: h.need!, part: 'head' as const })),
  ...HERO_CLOAKS.map((c) => ({ id: c.id, name: c.name, hero: c.hero, need: c.need, part: 'look' as const })),
];

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
