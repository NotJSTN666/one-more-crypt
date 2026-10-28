// Long-term progression shown off in the Crypt Hall: Soul Ranks from lifetime Souls,
// titles to wear under your name, cosmetic looks for the hero, and the Bestiary.

import { ACHIEVEMENTS, type HeroId } from './content';
import type { EnemyKind } from './game';

/** In a `{ story }` unlock: every quest of the act, side quests included. */
export const STORY_ALL = 99;

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
  { name: 'Soulreaver', souls: 25000, color: '#ff8a2a' },
  { name: 'Crypt Sovereign', souls: 50000, color: '#ff4d5a' },
  { name: 'The Eternal', souls: 100000, color: '#fff2c0' },
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

export const BESTIARY_KINDS: EnemyKind[] = ['ghoul', 'bat', 'archer', 'brute', 'wraith', 'drowned', 'boneknight', 'imp', 'voideye', 'boss', 'abbot', 'lich'];

const PLURALS: Partial<Record<EnemyKind, string>> = {
  boss: 'Bone Wardens', abbot: 'Plague Abbots', lich: 'Lich Kings', drowned: 'Drowned', boneknight: 'Bone Knights', imp: 'Ember Imps', voideye: 'Void Eyes',
};

/** "ghouls", "Bone Knights": how a Bestiary milestone names a crowd of them. */
export function beastPlural(kind: EnemyKind): string {
  return PLURALS[kind] ?? `${kind}s`;
}
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
  drowned: 'Tidebreaker',
  boneknight: 'Shieldbreaker',
  imp: 'Flamesnuffer',
  voideye: 'Voidseer',
  boss: 'Wardenbane',
  abbot: 'Plaguebreaker',
  lich: 'Kingslayer',
};
export const TITLE_TIER = 2;

// ---------- Deaths of Shame ----------
// Silly ways to fall. Each pays a few Souls and a title to wear; collect ten for the Dunce Cap.

export interface ShameDef {
  id: string;
  emoji: string;
  /** The title it unlocks. */
  title: string;
  how: string;
}

export const SHAME: ShameDef[] = [
  { id: 'victory-lap', emoji: '🏃', title: 'Victory Lap', how: 'Slay every foe on the floor, then die to the spikes or the lava.' },
  { id: 'pincushion', emoji: '📌', title: 'Pincushion', how: 'Die on the spikes.' },
  { id: 'hotfoot', emoji: '🔥', title: 'Hot Foot', how: 'Walk into lava and die.' },
  { id: 'almost-there', emoji: '🚪', title: 'Almost There', how: 'Die one step from the open stairs.' },
  { id: 'bat-snack', emoji: '🦇', title: 'Bat Snack', how: 'Be slain by a Blood Bat.' },
  { id: 'kaboom', emoji: '💥', title: 'Kaboom', how: 'Stand too close to an exploding foe.' },
  { id: 'glass-jaw', emoji: '🥊', title: 'Glass Jaw', how: 'Go from full health to dead in one hit.' },
  { id: 'colorblind', emoji: '🟥', title: 'Colorblind', how: 'Die to a shot or spell you were warned about (the red tiles).' },
  { id: 'outlasted', emoji: '🫠', title: 'Outlasted', how: 'Be slain by the very last foe on the floor.' },
  { id: 'speedrun', emoji: '⏱️', title: 'Speedrunner', how: 'Die within your first 15 turns.' },
  { id: 'floor-one', emoji: '🍌', title: 'First Floor Fumble', how: 'Fall on floor 1.' },
  { id: 'borrowed-time', emoji: '⏳', title: 'Borrowed Time', how: 'Die on the same floor the Phylactery saved you.' },
];

/** Deaths of Shame needed for the Dunce Cap. */
export const DUNCE_AT = 10;

// ---------- titles ----------

export interface TitleDef {
  id: string;
  name: string;
  /** How to earn it, for locked titles. */
  how: string;
  /** Not listed or counted until it is yours. */
  secret?: boolean;
}

export const TITLES: TitleDef[] = [
  ...ACHIEVEMENTS.map((a) => ({ id: `feat:${a.id}`, name: a.name, how: a.desc })),
  ...BESTIARY_KINDS.map((k) => ({
    id: `beast:${k}`,
    name: BESTIARY_TITLES[k]!,
    how: `Slay ${bestiaryTiers(k)[TITLE_TIER]} ${beastPlural(k)}.`,
  })),
  ...SOUL_RANKS.slice(1).map((r) => ({ id: `rank:${r.name}`, name: r.name, how: `Earn ${r.souls.toLocaleString()} Souls in total.` })),
  { id: 'podium:1', name: 'Crypt Champion', how: 'Finish 1st in a Daily Descent.' },
  // Deaths of Shame: silly ways to fall, each worn as a title.
  ...SHAME.map((d) => ({ id: `shame:${d.id}`, name: d.title, how: d.how })),
  // Story mode only.
  { id: 'story:1', name: "Gravedigger's Apprentice", how: 'Finish Fresh Dirt in the story.' },
  { id: 'story:2', name: 'Friend of Hounds', how: 'Finish The Kennel in the story.' },
  { id: 'story:3', name: "Aldric's Squire", how: 'Finish The Hollow Knight in the story.' },
  { id: 'story:11', name: 'Ring Finder', how: 'Finish A Ring in the Well in the story.' },
  { id: 'story:12', name: 'Coal Runner', how: 'Finish Blue Coal in the story.' },
  { id: 'story:bell', name: 'The Bell-Ringer', how: 'Finish every quest in Act I of the story.' },
  { id: 'story:all', name: 'Hero of Gravesend', how: 'Finish every quest in Act I of the story, side quests too.' },
  { id: 'welcome:7', name: 'Keeper of Seven Nights', how: 'Play on seven different days (Seven Nights).' },
  { id: 'invite:10', name: 'The Crypt Crier', how: 'Bring 10 friends to the crypt.' },
  // Given by hand to supporters (the patrons table), never sold in the game.
  { id: 'patron:1', name: 'Patron of the Crypt', how: 'Helped keep the crypt open. Thank you.', secret: true },
];

/** Rewards for the top 3 of each Daily Descent, given once the day is over. */
export const PODIUM = [
  { place: 1, medal: '🥇', name: 'Crypt Champion', souls: 300, head: 'champcrown' },
  { place: 2, medal: '🥈', name: 'Silver Shade', souls: 150, head: 'silvercirclet' },
  { place: 3, medal: '🥉', name: 'Bronze Bones', souls: 75, head: 'bronzelaurel' },
];

/** Weekly Endless prizes: the top 3 of each week's Endless board (Monday to Sunday, Central). */
export const WEEKLY = [
  { place: 1, medal: '♾️', name: 'Endless Champion', souls: 600, head: 'endlesscrown' },
  { place: 2, medal: '🥈', name: 'Endless Runner-up', souls: 300, head: '' },
  { place: 3, medal: '🥉', name: 'Endless Contender', souls: 150, head: '' },
];

export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t])) as Record<string, TitleDef>;

/** The hardest titles shimmer, glow or flow wherever they're shown. */
export type TitleFx = 'prism' | 'gold' | 'eternal' | 'sovereign' | 'soul' | 'abyss' | 'arcane' | 'ember' | 'steel';

export const TITLE_FX: Record<string, TitleFx> = {
  'invite:10': 'gold',
  'patron:1': 'prism',
  'story:bell': 'gold',
  'story:all': 'gold',
  'podium:1': 'gold',
  'rank:The Eternal': 'eternal',
  'rank:Crypt Sovereign': 'sovereign',
  'rank:Soulreaver': 'soul',
  'rank:Lord of the Abyss': 'abyss',
  'feat:floor50': 'abyss',
  'feat:outran': 'soul',
  'feat:cheated': 'eternal',
  'feat:ascend-all': 'arcane',
  'feat:ascend': 'arcane',
  'feat:completionist': 'arcane',
  'feat:combos-all': 'arcane',
  'feat:forge-all': 'arcane',
  'beast:boss': 'ember',
  'beast:abbot': 'ember',
  'beast:lich': 'ember',
  'feat:annihilate': 'ember',
  ...Object.fromEntries(BESTIARY_KINDS.filter((k) => !BOSSES.includes(k)).map((k) => [`beast:${k}`, 'steel'])),
};

/** The CSS class for a title's effect ('' for plain titles). */
export const titleFxClass = (id: string | null | undefined) => (id && TITLE_FX[id] ? `title-fx fx-${TITLE_FX[id]}` : '');

// ---------- cosmetic looks ----------

export interface LookDef {
  id: string;
  name: string;
  /** Cloak colours: light and shade. */
  cloak: { p: string; P: string };
  /** Colour of the drifting aura motes, if any. */
  aura: string | null;
  /** What unlocks it: an achievement, a Soul Rank (index) or a Bestiary tier. */
  unlock: { feat: string } | { rank: number } | { beast: EnemyKind; tier: number } | { costume: string } | { podium: number } | { cost: number; season?: SeasonId } | { streak: number } | { weekly: number } | { story: number } | { season: SeasonId } | { shame: number } | { welcome: number } | { raid: number } | { invite: number };
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
  // Seven Nights: a gift for each of a player's first seven days.
  { id: 'gravewalker', name: 'Gravewalker', cloak: { p: '#3d5a6c', P: '#1d2c36' }, aura: '#9fe8ff', unlock: { welcome: 2 }, how: 'Seven Nights, day 2: come back on a second day.' },
];

// Earned in the story.
LOOKS.push(
  { id: 'aldric', name: "Aldric's Mantle", cloak: { p: '#5f9fc0', P: '#2a5470' }, aura: '#9fe8ff', unlock: { story: 3 }, how: "Finish Sir Aldric's trial in the story." },
  { id: 'shawl', name: "The Widow's Shawl", cloak: { p: '#2a2433', P: '#141119' }, aura: '#8a8590', unlock: { story: 11 }, how: "Find Agnes's ring in the story." },
  { id: 'gravecoat', name: "Gravedigger's Coat", cloak: { p: '#6b4a2e', P: '#3d2a1a' }, aura: '#c4a46a', unlock: { story: 1 }, how: "Dig Mortimer's grave in the story (Fresh Dirt)." },
  { id: 'bellvestment', name: "Bell-Ringer's Vestment", cloak: { p: '#8a6a2a', P: '#4a3812' }, aura: '#f2c14e', unlock: { story: STORY_ALL }, how: 'Finish every quest in Act I of the story.' },
  { id: 'houndhide', name: 'Houndhide', cloak: { p: '#3a3029', P: '#1c1714' }, aura: '#a8894a', unlock: { story: 2 }, how: 'Bring the crypt hound home in the story (The Kennel).' },
);

// The Bell Tolls: earned only by felling world bosses together, one piece per boss felled.
export const raidHow = (n: number) => (n === 1 ? 'Help bring down a world boss in The Bell Tolls.' : `Help bring down ${n} world bosses in The Bell Tolls.`);
const raid = (n: number) => ({ unlock: { raid: n }, how: raidHow(n) });
LOOKS.push(
  { id: 'tollbreaker', name: 'Tollbreaker', cloak: { p: '#a8803a', P: '#5c4418' }, aura: '#f2c14e', ...raid(1) },
  { id: 'warbandred', name: 'Warband Crimson', cloak: { p: '#9e2a2a', P: '#4e1010' }, aura: '#ff8a2a', ...raid(5) },
  { id: 'plaguebane', name: 'Plaguebane', cloak: { p: '#d8e8c8', P: '#6b8a4a' }, aura: '#b5e07a', ...raid(9) },
  { id: 'wardenbane', name: 'Wardenbane', cloak: { p: '#b8b2a4', P: '#5d667a' }, aura: '#e8dcc4', ...raid(13) },
  { id: 'lichbane', name: 'Lichbane', cloak: { p: '#8a7ab8', P: '#3a2a6b' }, aura: '#d3b0ff', ...raid(17) },
  { id: 'nightwatch', name: 'Nightwatch', cloak: { p: '#26324a', P: '#101624' }, aura: '#c9d1e0', ...raid(21) },
  { id: 'emberwake', name: 'Emberwake', cloak: { p: '#c0461c', P: '#2a0f08' }, aura: '#ffd23f', ...raid(25) },
  { id: 'eclipse', name: 'Eclipse Mantle', cloak: { p: '#141119', P: '#c99a2e' }, aura: '#fff2c0', ...raid(28) },
);

// Bring a friend: the first is shared with the friend you brought.
LOOKS.push({ id: 'kindred', name: 'Kindred Cloak', cloak: { p: '#c46a2e', P: '#5a2a12' }, aura: '#ffb35a', unlock: { invite: 1 }, how: 'Bring a friend to the crypt (they get it too). Find your link under Bring a friend.' });

// Horde: for holding the crypt.
LOOKS.push({ id: 'siegemantle', name: 'Siege Mantle', cloak: { p: '#6b6f7a', P: '#2e3038' }, aura: '#ff8a2a', unlock: { feat: 'horde20' }, how: 'Hold the crypt to wave 20 in Horde.' });
LOOKS.push({ id: 'unmarked', name: 'Unmarked Mantle', cloak: { p: '#d9dde6', P: '#7f8798' }, aura: '#9fe8ff', unlock: { feat: 'hordeuntouched' }, how: 'Clear a Horde wave, at wave 10 or later, without taking a hit after it arrives.' });
LOOKS.push({ id: 'siegelord', name: "Siege Lord's Mantle", cloak: { p: '#8a1f2c', P: '#c99a2e' }, aura: '#ffd23f', unlock: { feat: 'horde50k' }, how: 'Score 50,000 points in one Horde run.' });
LOOKS.push({ id: 'macabre', name: 'Danse Macabre', cloak: { p: '#141119', P: '#e8dcc4' }, aura: '#d3b0ff', unlock: { feat: 'hordedanced' }, how: 'Hold 10 Horde waves with Death in the arena.' });

// Death's own: for outrunning him.
LOOKS.push({ id: 'reapershroud', name: "Reaper's Shroud", cloak: { p: '#1d1428', P: '#0a0710' }, aura: '#d3b0ff', unlock: { feat: 'outran' }, how: 'Reach floor 175 with Death on your heels.' });

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

// ---------- seasons ----------
// Limited-time pieces: sold (or given) only while their season is open, kept for good after.

export type SeasonId = 'halloween';

export const SEASONS: Record<SeasonId, { name: string; emoji: string; from: string; to: string; dates: string }> = {
  // Month-day, Central Time, both days included.
  halloween: { name: 'The Hallowed Season', emoji: '🎃', from: '10-19', to: '11-02', dates: 'October 19 to November 2' },
};

/** Whether a season is open on a Central date (YYYY-MM-DD). */
export function seasonOpen(id: SeasonId, date: string): boolean {
  const md = date.slice(5);
  const { from, to } = SEASONS[id];
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** The season a shop item belongs to, if any. */
export function seasonOf(unlock: Unlock | undefined): SeasonId | undefined {
  return unlock && 'season' in unlock ? unlock.season : undefined;
}

const hallowed = (cost: number) => ({ unlock: { cost, season: 'halloween' as const }, how: `Sold in the Ossuary during the Hallowed Season (October 19 to November 2) for ${cost.toLocaleString()} Souls.` });
LOOKS.push(
  // Free: play any run while the season is open.
  { id: 'hallowed', name: 'Hallowed Shroud', cloak: { p: '#d35400', P: '#2a1505' }, aura: '#ffb35a', unlock: { season: 'halloween' }, how: 'Play any run during the Hallowed Season (October 19 to November 2).' },
  { id: 'candycorn', name: 'Candy Corn', cloak: { p: '#f2c14e', P: '#e0661c' }, aura: '#fff2c0', ...hallowed(400) },
  { id: 'pumpkincloak', name: 'Pumpkin Patch', cloak: { p: '#e67e22', P: '#3d6b2a' }, aura: null, ...hallowed(450) },
  { id: 'witchcloak', name: "Witch's Cloak", cloak: { p: '#3b2060', P: '#1a0f26' }, aura: '#8aff6a', ...hallowed(600) },
  { id: 'gravemist', name: 'Graveyard Mist', cloak: { p: '#3f4f45', P: '#1c2620' }, aura: '#b5e07a', ...hallowed(700) },
  { id: 'vampcape', name: 'Vampire Cape', cloak: { p: '#141119', P: '#8a1f2c' }, aura: '#ff4d5a', ...hallowed(900) },
  { id: 'banshee', name: 'Banshee Shroud', cloak: { p: '#dfe8f2', P: '#8fa4c0' }, aura: '#c9f2ff', ...hallowed(1100) },
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
  /** Sold only while this season is open. */
  season?: SeasonId;
}

export const DECOR: DecorDef[] = [
  { id: 'skulls', name: 'Skull Piles', emoji: '💀', cost: 300, desc: 'Heaps of skulls in the corners of your Hall.' },
  { id: 'carpet', name: 'Blood Carpet', emoji: '🟥', cost: 500, desc: 'A gold-trimmed red carpet before your statues.' },
  { id: 'cat', name: 'Grave Cat', emoji: '🐈‍⬛', cost: 700, desc: 'A black cat that keeps watch, and blinks.' },
  { id: 'braziers', name: 'Twin Braziers', emoji: '🔥', cost: 900, desc: 'Two roaring braziers either side of your throne room.' },
  { id: 'tomb', name: 'Your Tomb', emoji: '🪦', cost: 1500, desc: 'A gravestone with your name and deepest floor carved in.' },
  { id: 'throne', name: 'Bone Throne', emoji: '🪑', cost: 2500, desc: 'A throne of bone at the heart of your Hall.' },
  // The Hallowed Season.
  { id: 'cobwebs', name: 'Cobwebs', emoji: '🕸️', cost: 400, desc: 'Great webs in the high corners, with a spider that comes down to look.', season: 'halloween' },
  { id: 'garland', name: 'Hallowed Garland', emoji: '🎏', cost: 500, desc: 'Orange and purple bunting strung along the top of the wall.', season: 'halloween' },
  { id: 'jacks', name: "Jack-o'-Lanterns", emoji: '🎃', cost: 800, desc: 'A row of grinning pumpkins along the floor, lit from inside.', season: 'halloween' },
  { id: 'bats', name: 'Bat Swarm', emoji: '🦇', cost: 900, desc: 'Bats that flit across your Hall, forever.', season: 'halloween' },
  { id: 'cauldron', name: "Witch's Cauldron", emoji: '🧪', cost: 1200, desc: 'A great iron pot of green brew that never stops bubbling.', season: 'halloween' },
  { id: 'ghosts', name: 'Wandering Ghosts', emoji: '👻', cost: 1800, desc: 'Two pale ghosts that drift through your Hall and pass through the walls.', season: 'halloween' },
];
export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d])) as Record<string, DecorDef>;

/** Hall pieces from The Bell Tolls: never sold, one per world boss felled. */
export interface RaidDecorDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  raid: number;
}

export const RAID_DECOR: RaidDecorDef[] = [
  { id: 'raidbanners', name: 'War Banners', emoji: '🚩', raid: 4, desc: 'Two tattered war banners, one for each side of your Hall.' },
  { id: 'bellshardpile', name: 'Pile of Bell Shards', emoji: '🔔', raid: 8, desc: 'Bronze shards of a broken bell, still humming.' },
  { id: 'bossskull', name: 'Mounted Boss Skull', emoji: '💀', raid: 12, desc: "A great horned skull over your Hall, eyes still glowing." },
  { id: 'chandelier', name: 'Raid Chandelier', emoji: '🕯️', raid: 16, desc: 'An iron wheel of candles hung from the ceiling.' },
  { id: 'warhorn', name: 'The War Horn', emoji: '📯', raid: 20, desc: 'The horn that calls the crypt to the fight, on its stand.' },
  { id: 'rollofhonor', name: 'Roll of Honour', emoji: '📜', raid: 24, desc: 'A stone tablet that counts every world boss you helped bring down.' },
];
export const RAID_DECOR_BY_ID = Object.fromEntries(RAID_DECOR.map((d) => [d.id, d])) as Record<string, RaidDecorDef>;

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
  knight: 'Knight', rogue: 'Rogue', necro: 'Necromancer', paladin: 'Paladin', ranger: 'Ranger', mage: 'Mage', barbarian: 'Barbarian', bellringer: 'Bell-Ringer',
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
  { id: 'goggles', name: "Smith's Goggles", unlock: { story: 12 }, how: 'Bring Pip the blue coal in the story.', pixels: [...row(2, 3, 8, '#6b4a2a'), [4, 2, '#f2c14e'], [5, 2, '#5fe3ff'], [7, 2, '#f2c14e'], [8, 2, '#5fe3ff']] },
  { id: 'bellhelm', name: 'The Bell Helm', unlock: { story: STORY_ALL }, how: 'Finish every quest in Act I of the story.', pixels: [[5, 0, '#5d4a2a'], [6, 0, '#5d4a2a'], ...row(1, 4, 7, '#c9a24a'), ...row(2, 3, 8, '#c9a24a'), ...row(3, 3, 8, '#8a6a2a'), [4, 1, '#fff2c0'], [3, 2, '#fff2c0'], [2, 3, '#8a6a2a'], [9, 3, '#8a6a2a']] },
  { id: 'tavernkerchief', name: "Bess's Kerchief", unlock: { story: 13 }, how: "Get Bess's Best back from the tavern cellar in the story.", pixels: [...row(1, 4, 7, '#c0392b'), ...row(2, 3, 8, '#c0392b'), [4, 1, '#ffffff'], [7, 2, '#ffffff'], [5, 2, '#ffffff'], [9, 3, '#c0392b']] },
  { id: 'wardenkeys', name: "The Warden's Keys", unlock: { story: 4 }, how: 'Finish Act I of the story.', pixels: [...row(2, 3, 8, '#8a4a2a'), [3, 1, '#8a4a2a'], [8, 1, '#8a4a2a'], [4, 1, GOLD], [5, 0, GOLD], [6, 0, GOLD], [7, 1, GOLD], [4, 3, GOLD], [7, 3, GOLD]] },
  { id: 'endlesscrown', name: 'Crown of the Endless', unlock: { weekly: 1 }, how: 'Win a week on the Endless leaderboard.', pixels: [[3, 0, '#b07cff'], [5, 0, '#5fe3ff'], [6, 0, '#5fe3ff'], [8, 0, '#b07cff'], ...row(1, 3, 8, '#7b5cff'), ...row(2, 3, 8, '#311854'), [4, 2, '#5fe3ff'], [7, 2, '#5fe3ff']] },
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
  // The Hallowed Season: sold only October 19 to November 2.
  { id: 'catears', name: 'Black Cat Ears', ...hallowed(400), pixels: [[3, 0, DARK], [3, 1, '#ff9ab0'], [4, 1, DARK], [8, 0, DARK], [8, 1, '#ff9ab0'], [7, 1, DARK]] },
  { id: 'strawhat', name: 'Scarecrow Hat', ...hallowed(450), pixels: [...row(0, 4, 7, '#8a6a3a'), ...row(1, 3, 8, '#a8894a'), ...row(2, 1, 10, '#c4a46a'), [4, 1, '#5a1622'], [7, 1, '#5a1622'], [1, 3, '#c4a46a'], [10, 3, '#c4a46a']] },
  { id: 'devilhorns', name: 'Devil Horns', ...hallowed(500), pixels: [[2, 0, RED], [3, 1, RED], [3, 2, '#8a1f2c'], [9, 0, RED], [8, 1, RED], [8, 2, '#8a1f2c']] },
  { id: 'witchhat', name: "Witch's Hat", ...hallowed(600), pixels: [[7, 0, '#2a1640'], [8, 0, '#2a1640'], ...row(0, 5, 6, '#2a1640'), ...row(1, 4, 7, '#7a34b0'), [5, 1, GOLD], ...row(2, 1, 10, '#1a0f26')] },
  { id: 'skullmask', name: 'Skull Mask', ...hallowed(700), pixels: [...row(3, 4, 7, BONE), [4, 4, BONE], [5, 4, '#0d0812'], [6, 4, BONE], [7, 4, '#0d0812'], ...row(5, 4, 7, '#c9c3b2'), [5, 5, '#0d0812'], [7, 5, '#0d0812']] },
  { id: 'ghostsheet', name: 'Ghost Sheet', ...hallowed(700), pixels: [...row(0, 4, 7, '#f2f2f2'), ...row(1, 3, 8, '#f2f2f2'), ...row(2, 2, 9, '#f2f2f2'), ...row(3, 2, 9, '#f2f2f2'), [4, 3, '#0d0812'], [7, 3, '#0d0812'], ...row(4, 2, 9, '#e2e6ee'), [5, 4, '#0d0812'], [6, 4, '#0d0812'], ...row(5, 2, 9, '#d2d8e2'), [2, 6, '#c8d0dc'], [4, 6, '#c8d0dc'], [7, 6, '#c8d0dc'], [9, 6, '#c8d0dc']] },
  { id: 'mummy', name: 'Mummy Wraps', ...hallowed(800), pixels: [...row(1, 3, 8, '#d8d2c2'), ...row(2, 3, 8, '#b8b0a0'), ...row(3, 4, 7, '#d8d2c2'), [4, 4, '#b8b0a0'], [5, 4, '#ffd23f'], [6, 4, '#b8b0a0'], [7, 4, '#b8b0a0'], [3, 3, '#b8b0a0'], [8, 3, '#d8d2c2'], [9, 2, '#d8d2c2'], [10, 3, '#d8d2c2']] },
  { id: 'vampire', name: 'Vampire Count', ...hallowed(900), pixels: [...row(1, 3, 8, '#141119'), [3, 2, '#141119'], [4, 2, '#e8e0e8'], [5, 2, '#141119'], [6, 2, '#141119'], [7, 2, '#e8e0e8'], [8, 2, '#141119'], ...row(3, 4, 7, '#e8e0e8'), [4, 4, '#e8e0e8'], [5, 4, RED], [6, 4, '#e8e0e8'], [7, 4, RED], [5, 5, '#ffffff'], [6, 5, '#701826'], [7, 5, '#ffffff']] },
  { id: 'monster', name: 'Stitched Monster', ...hallowed(900), pixels: [...row(0, 4, 7, '#141119'), ...row(1, 3, 8, '#141119'), ...row(2, 3, 8, '#7f9a52'), [4, 2, '#2a2a2a'], [5, 2, '#2a2a2a'], [6, 2, '#2a2a2a'], ...row(3, 4, 7, '#7f9a52'), [4, 4, '#7f9a52'], [5, 4, '#f2f2f2'], [6, 4, '#7f9a52'], [7, 4, '#f2f2f2'], [1, 4, '#9aa3b5'], [2, 4, '#5d667a'], [9, 4, '#5d667a'], [10, 4, '#9aa3b5']] },
  // Legendary: skulls circle your head in the crypt.
  { id: 'skullhalo', name: 'Halo of Skulls', ...sold(10000), pixels: [...row(0, 3, 8, '#fff2c0'), [2, 1, GOLD], [9, 1, GOLD]] },
  { id: 'bronzelaurel', name: 'Bronze Laurel', unlock: { podium: 3 }, how: 'Finish 3rd in a Daily Descent.', pixels: [[2, 3, '#8a5a28'], [2, 2, '#b07a3c'], [3, 1, '#cd8f4a'], [4, 1, '#b07a3c'], [9, 3, '#8a5a28'], [9, 2, '#b07a3c'], [8, 1, '#cd8f4a'], [7, 1, '#b07a3c']] },
  // Daily streak helms: play the Daily Descent this many days in a row. Kept for good once earned.
  ...STREAK_HELMS.map(([n, id, name, pixels]) => ({ id, name, unlock: { streak: n }, how: `Play the daily ${n} days in a row.`, pixels })),
  { id: 'dunce', name: 'Dunce Cap', unlock: { shame: DUNCE_AT }, how: `Collect ${DUNCE_AT} Deaths of Shame.`, pixels: [[6, 0, '#ffffff'], [5, 0, '#e8dcc4'], ...row(1, 4, 7, '#e8dcc4'), [6, 1, '#d23a46'], ...row(2, 3, 8, '#f2f2f2'), [4, 2, '#d23a46'], [7, 2, '#d23a46'], ...row(3, 2, 9, '#2f4aa8'), [3, 3, '#f2c14e'], [8, 3, '#f2c14e']] },
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
  // The Bell Tolls: felling world bosses together.
  { id: 'bellcrown', name: 'Bell Crown', ...raid(2), pixels: [...row(2, 3, 8, '#8a6a2a'), [3, 1, '#c9a24a'], [5, 1, '#c9a24a'], [6, 1, '#c9a24a'], [8, 1, '#c9a24a'], [5, 0, '#fff2c0'], [6, 0, '#5d4a2a'], [4, 2, '#fff2c0'], [7, 2, '#fff2c0']] },
  { id: 'raidhorns', name: "Raider's Helm", ...raid(6), pixels: [...row(1, 3, 8, STEEL), ...row(2, 3, 8, '#9aa3b5'), [5, 3, '#9aa3b5'], [6, 3, '#9aa3b5'], [2, 1, BONE], [1, 0, BONE], [9, 1, BONE], [10, 0, BONE], [5, 0, STEEL], [6, 0, STEEL]] },
  { id: 'beakmask', name: "Abbot's Beak", ...raid(10), pixels: [...row(3, 4, 7, '#3a4a2a'), [4, 3, '#b5e07a'], [7, 3, '#b5e07a'], [8, 4, '#d8cfb8'], [9, 4, '#d8cfb8'], [9, 5, '#c9c3b2'], [10, 5, '#c9c3b2'], ...row(1, 3, 8, '#2a3420'), ...row(2, 2, 9, '#2a3420')] },
  { id: 'wardenvisor', name: "Warden's Visor", ...raid(14), pixels: [...row(1, 3, 8, BONE), ...row(2, 3, 8, '#c9c3b2'), ...row(3, 3, 8, BONE), [4, 3, DARK], [5, 3, DARK], [6, 3, DARK], [7, 3, DARK], [5, 0, BONE], [6, 0, BONE]] },
  { id: 'lichdiadem', name: 'Lich Shard Diadem', ...raid(18), pixels: [...row(2, 3, 8, '#311854'), [4, 1, '#d3b0ff'], [5, 0, '#ffffff'], [6, 0, '#d3b0ff'], [7, 1, '#d3b0ff'], [5, 2, '#b07cff'], [6, 2, '#b07cff'], [3, 1, '#5a2f8a'], [8, 1, '#5a2f8a']] },
  { id: 'crestplume', name: 'Banner Crest', ...raid(22), pixels: [...row(1, 4, 7, '#5d667a'), ...row(2, 3, 8, '#8a8a96'), [4, 0, '#701826'], [5, 0, RED], [6, 0, RED], [7, 0, '#ff6b6b'], [8, 1, RED], [9, 2, '#701826']] },
  { id: 'embercirclet', name: 'Ember Circlet', ...raid(26), pixels: [...row(2, 3, 8, '#3a1a12'), [3, 1, '#d23a46'], [4, 1, '#ff8a2a'], [6, 1, '#ffd23f'], [8, 1, '#ff8a2a'], [6, 0, '#ff8a2a'], [5, 2, '#ffd23f'], [6, 2, '#ffd23f']] },
  { id: 'worldcrown', name: 'Crown of the World Boss', ...raid(29), pixels: [[3, 0, GOLD], [5, 0, '#fff2c0'], [6, 0, '#fff2c0'], [8, 0, GOLD], ...row(1, 3, 8, GOLD), ...row(2, 3, 8, '#141119'), [4, 2, '#5fe3ff'], [5, 2, RED], [6, 2, '#b5e07a'], [7, 2, '#b07cff'], [2, 1, '#a8781f'], [9, 1, '#a8781f']] },
  // Horde: wave 10.
  { id: 'gatehelm', name: "Gatekeeper's Helm", unlock: { feat: 'horde10' }, how: 'Hold the crypt to wave 10 in Horde.', pixels: [...row(1, 3, 8, STEEL), ...row(2, 3, 8, '#9aa3b5'), ...row(3, 3, 8, '#5d667a'), [4, 3, DARK], [5, 3, DARK], [6, 3, DARK], [7, 3, DARK], [5, 0, '#ff8a2a'], [6, 0, '#ffd23f'], [2, 2, '#5d667a'], [9, 2, '#5d667a']] },
  // Horde: an unbroken chain of kills.
  { id: 'warpaint', name: 'Warpaint Band', unlock: { feat: 'hordeunbroken' }, how: 'Reach the ×5 score multiplier in Horde.', pixels: [...row(2, 3, 8, RED), [4, 2, '#ffd23f'], [7, 2, '#ffd23f'], [9, 2, RED], [10, 3, RED], [10, 4, '#8a1f2c'], [9, 4, '#8a1f2c']] },
  // Horde: 10,000 points in one run.
  { id: 'defendercoif', name: "Defender's Coif", unlock: { feat: 'horde10k' }, how: 'Score 10,000 points in one Horde run.', pixels: [...row(0, 4, 7, '#9aa3b5'), ...row(1, 3, 8, STEEL), ...row(2, 2, 9, '#9aa3b5'), [4, 1, '#5d667a'], [6, 1, '#5d667a'], [3, 2, '#5d667a'], [5, 2, '#5d667a'], [7, 2, '#5d667a'], [2, 3, '#9aa3b5'], [9, 3, '#9aa3b5'], [2, 4, '#5d667a'], [9, 4, '#5d667a']] },
  // Horde: 100,000 points in one run.
  { id: 'hordecrown', name: 'Crown of the Horde', unlock: { feat: 'horde100k' }, how: 'Score 100,000 points in one Horde run.', pixels: [[3, 0, '#5d667a'], [5, 0, '#9aa3b5'], [6, 0, '#9aa3b5'], [8, 0, '#5d667a'], ...row(1, 3, 8, '#3a3346'), ...row(2, 3, 8, '#5d667a'), [4, 1, '#ff8a2a'], [5, 1, '#ffd23f'], [6, 1, '#ffd23f'], [7, 1, '#ff8a2a'], [2, 2, '#3a3346'], [9, 2, '#3a3346'], [5, 2, RED], [6, 2, RED]] },
  // Bring a friend: five friends brought.
  { id: 'lanternhood', name: 'Lantern Hood', unlock: { invite: 5 }, how: 'Bring 5 friends to the crypt.', pixels: [...row(1, 3, 8, '#5a2a12'), ...row(2, 2, 9, '#7a3a18'), [5, 0, '#3a3346'], [6, 0, '#3a3346'], [8, 0, '#3a3346'], [9, 1, '#ffd23f'], [10, 1, '#ff8a2a'], [9, 2, '#3a3346'], [10, 2, '#3a3346'], [4, 2, '#ffb35a'], [7, 2, '#ffb35a']] },
  // Death's own hood, skull and all: for cheating him.
  { id: 'deathshood', name: "Death's Hood", unlock: { feat: 'cheated' }, how: 'Reach floor 200 with Death on your heels.', pixels: [...row(0, 4, 7, '#141119'), ...row(1, 3, 8, '#141119'), ...row(2, 2, 9, '#1d1428'), [2, 3, '#1d1428'], [3, 3, '#1d1428'], ...row(3, 4, 7, BONE), [8, 3, '#1d1428'], [9, 3, '#1d1428'], [3, 4, '#1d1428'], [4, 4, '#d3b0ff'], [5, 4, BONE], [6, 4, BONE], [7, 4, '#d3b0ff'], [8, 4, '#1d1428'], [3, 5, '#1d1428'], [5, 5, '#c9c3b2'], [6, 5, '#c9c3b2'], [8, 5, '#1d1428']] },
  // Seven Nights: the last day's gift.
  { id: 'sevennights', name: 'Crown of Seven Nights', unlock: { welcome: 7 }, how: 'Seven Nights, day 7: play on seven different days.', pixels: [...row(2, 3, 8, '#2a3d4a'), [4, 2, '#7cf5c4'], [7, 2, '#7cf5c4'], [3, 1, '#c9d1e0'], [5, 1, '#c9d1e0'], [6, 1, '#c9d1e0'], [8, 1, '#c9d1e0'], [3, 0, '#9fe8ff'], [5, 0, '#7cf5c4'], [6, 0, '#7cf5c4'], [8, 0, '#9fe8ff']] },
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
  /** An aura that radiates off the hero ('' for none). */
  aura?: string;
}

// ---------- auras ----------
// A glow and moving effect around the hero: in runs, the Hollow, on Hall statues and next
// to your name on the leaderboards. Looks only. Most are earned; a few are sold.

export type AuraStyle =
  | 'candle' | 'ember' | 'tide' | 'bone' | 'abyss' | 'void' | 'rays' | 'sunburst' | 'flame'
  | 'wisps' | 'snow' | 'storm' | 'mist' | 'souls' | 'crown' | 'eternity' | 'rainbow' | 'bell'
  | 'shards' | 'blades' | 'banner' | 'eclipse' | 'reaper';

export type AuraUnlock =
  | { floor: number }
  | { wins: number }
  | { streak: number }
  | { rank: number }
  | { patron: true }
  | { welcome: number }
  | { story: number }
  | { raid: number }
  | { invite: number }
  | { feat: string }
  | { cost: number; season?: SeasonId };

export interface AuraDef {
  id: string;
  name: string;
  style: AuraStyle;
  /** The glow's colour (the rainbow cycles instead). */
  color: string;
  unlock: AuraUnlock;
  how: string;
}

const auraSold = (cost: number) => ({ unlock: { cost }, how: `Sold in the Ossuary for ${cost.toLocaleString()} Souls.` });

export const AURAS: AuraDef[] = [
  // Depth: the deepest floor reached in any run, any hero.
  { id: 'candleglow', name: 'Candleglow', style: 'candle', color: '#ffb35a', unlock: { floor: 25 }, how: 'Reach floor 25.' },
  { id: 'emberheart', name: 'Emberheart', style: 'ember', color: '#ff8a2a', unlock: { floor: 50 }, how: 'Reach floor 50.' },
  { id: 'tidecaller', name: 'Tidecaller', style: 'tide', color: '#5fe3ff', unlock: { floor: 100 }, how: 'Reach floor 100.' },
  { id: 'bonewind', name: 'Bonewind', style: 'bone', color: '#e8dcc4', unlock: { floor: 150 }, how: 'Reach floor 150.' },
  { id: 'abyssal', name: 'Abyssal', style: 'abyss', color: '#b07cff', unlock: { floor: 200 }, how: 'Reach floor 200.' },
  { id: 'voidcrown', name: 'Voidcrown', style: 'void', color: '#7b5cff', unlock: { floor: 300 }, how: 'Reach floor 300.' },
  // The Daily Descent.
  { id: 'gilded', name: 'Gilded Radiance', style: 'rays', color: '#f2c14e', unlock: { wins: 1 }, how: 'Win a Daily Descent.' },
  { id: 'sunburst', name: 'Sunburst', style: 'sunburst', color: '#ffd23f', unlock: { wins: 5 }, how: 'Win 5 Daily Descents.' },
  { id: 'eternalflame', name: 'Eternal Flame', style: 'flame', color: '#5fa8ff', unlock: { streak: 30 }, how: 'Play the daily 30 days in a row.' },
  // Soul Ranks past Lord of the Abyss.
  { id: 'soulstorm', name: 'Soulstorm', style: 'souls', color: '#9fe8ff', unlock: { rank: 6 }, how: 'Reach the Soulreaver Soul Rank (25,000 Souls).' },
  { id: 'sovereign', name: "Sovereign's Halo", style: 'crown', color: '#ff4d5a', unlock: { rank: 7 }, how: 'Reach the Crypt Sovereign Soul Rank (50,000 Souls).' },
  { id: 'eternity', name: 'Eternity', style: 'eternity', color: '#fff2c0', unlock: { rank: 8 }, how: 'Reach The Eternal Soul Rank (100,000 Souls).' },
  // Supporters on Ko-fi.
  { id: 'patronglow', name: "Patron's Prism", style: 'rainbow', color: '#ff4d5a', unlock: { patron: true }, how: 'Support One More Crypt on Ko-fi. Thank you.' },
  // Story mode only: earned through The Bell Beneath, never sold.
  { id: 'spectralvigil', name: 'Spectral Vigil', style: 'mist', color: '#9fe8ff', unlock: { story: 3 }, how: "Finish Sir Aldric's trial in the story." },
  { id: 'belltoll', name: 'Toll of the Bell', style: 'tide', color: '#c9a24a', unlock: { story: 4 }, how: 'Finish Act I of the story: silence the Bone Warden.' },
  { id: 'wishingwell', name: 'Wishing Well', style: 'snow', color: '#5fe3ff', unlock: { story: 11 }, how: "Find Agnes's ring in the story." },
  { id: 'greatbell', name: 'The Great Bell', style: 'bell', color: '#c9a24a', unlock: { story: STORY_ALL }, how: 'Finish every quest in Act I of the story: the bell answers to you now.' },
  { id: 'gravesendlight', name: 'Light of Gravesend', style: 'candle', color: '#9fe8ff', unlock: { story: STORY_ALL }, how: 'Finish every quest in Act I of the story, side quests too.' },
  { id: 'homecoming', name: 'Homecoming', style: 'souls', color: '#7cf5c4', unlock: { welcome: 5 }, how: 'Seven Nights, day 5: come back on a fifth day.' },
  { id: 'kindredflame', name: 'Kindred Flame', style: 'candle', color: '#ff8a2a', unlock: { invite: 3 }, how: 'Bring 3 friends to the crypt.' },
  // The Bell Tolls: felling world bosses together.
  // Horde: earned holding the crypt, never sold.
  { id: 'overcharge', name: 'Overcharge', style: 'storm', color: '#5fe3ff', unlock: { feat: 'hordeovercharged' }, how: 'Trigger 10 power surges in one Horde run.' },
  { id: 'hordelegend', name: 'Legend of the Horde', style: 'sunburst', color: '#ff8a2a', unlock: { feat: 'horde100k' }, how: 'Score 100,000 points in one Horde run.' },
  { id: 'deathsdance', name: "Death's Dance", style: 'bone', color: '#d3b0ff', unlock: { feat: 'hordedanced' }, how: 'Hold 10 Horde waves with Death in the arena.' },
  { id: 'deathsshadow', name: "Death's Shadow", style: 'reaper', color: '#9a6bff', unlock: { feat: 'horde30' }, how: 'Hold the crypt to wave 30 in Horde, with Death in the arena.' },
  { id: 'raidember', name: 'Warcry Embers', style: 'ember', color: '#ff4d5a', ...raid(3) },
  { id: 'bellshards', name: 'Bell Shards', style: 'shards', color: '#c9a24a', ...raid(7) },
  { id: 'plaguecenser', name: 'Censer Smoke', style: 'mist', color: '#8fd47f', ...raid(11) },
  { id: 'warband', name: 'Warband Blades', style: 'blades', color: '#c9d1e0', ...raid(15) },
  { id: 'lichfire', name: 'Lichfire', style: 'flame', color: '#b07cff', ...raid(19) },
  { id: 'rallybanner', name: 'Rallying Banner', style: 'banner', color: '#d23a46', ...raid(23) },
  { id: 'stormtoll', name: 'Thunder Toll', style: 'storm', color: '#f2c14e', ...raid(27) },
  { id: 'worldbreaker', name: 'Worldbreaker', style: 'eclipse', color: '#f2c14e', ...raid(30) },
  // Sold in the Ossuary.
  { id: 'frostbite', name: 'Frostbite', style: 'snow', color: '#c9f2ff', ...auraSold(2500) },
  { id: 'stormcharged', name: 'Stormcharged', style: 'storm', color: '#9fe8ff', ...auraSold(5000) },
  { id: 'bloodmist', name: 'Bloodmist', style: 'mist', color: '#d23a46', ...auraSold(10000) },
  // The Hallowed Season.
  { id: 'hallowedwisps', name: 'Hallowed Wisps', style: 'wisps', color: '#ff8a2a', unlock: { cost: 3000, season: 'halloween' }, how: 'Sold in the Ossuary during the Hallowed Season (October 19 to November 2) for 3,000 Souls.' },
];

export const AURA_BY_ID = Object.fromEntries(AURAS.map((a) => [a.id, a])) as Record<string, AuraDef>;

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

// ---------- Seven Nights ----------
// A gift for each of a player's first seven days, claimed by finishing a run, one a day.
// Missing a day doesn't reset it: the next gift simply waits.

export type WelcomeReward = { souls: number } | { look: string } | { aura: string } | { head: string; title: string };

export const WELCOME: WelcomeReward[] = [
  { souls: 100 },
  { look: 'gravewalker' },
  { souls: 250 },
  { souls: 300 },
  { aura: 'homecoming' },
  { souls: 500 },
  { head: 'sevennights', title: 'welcome:7' },
];

export function welcomeLabel(r: WelcomeReward): { icon: string; name: string } {
  if ('souls' in r) return { icon: '💀', name: `${r.souls} Souls` };
  if ('look' in r) return { icon: '🧥', name: `${LOOK_BY_ID[r.look]?.name ?? r.look} cloak` };
  if ('aura' in r) return { icon: '✨', name: `${AURA_BY_ID[r.aura]?.name ?? r.aura} aura` };
  return { icon: '👑', name: `${HEAD_BY_ID[r.head]?.name ?? r.head} + a title` };
}

// ---------- The Bell Tolls rewards ----------

export type RaidRewardKind = 'look' | 'head' | 'aura' | 'decor';

/** Every Bell-Breaker reward in order: the nth is earned with the nth world boss felled. */
export const RAID_REWARDS: { n: number; kind: RaidRewardKind; id: string; name: string }[] = [
  ...LOOKS.filter((l) => 'raid' in l.unlock).map((l) => ({ n: (l.unlock as { raid: number }).raid, kind: 'look' as const, id: l.id, name: l.name })),
  ...HEADS.filter((h) => h.unlock && 'raid' in h.unlock).map((h) => ({ n: (h.unlock as { raid: number }).raid, kind: 'head' as const, id: h.id, name: h.name })),
  ...AURAS.filter((a) => 'raid' in a.unlock).map((a) => ({ n: (a.unlock as { raid: number }).raid, kind: 'aura' as const, id: a.id, name: a.name })),
  ...RAID_DECOR.map((d) => ({ n: d.raid, kind: 'decor' as const, id: d.id, name: d.name })),
].sort((a, b) => a.n - b.n);

export const RAID_KIND_LABEL: Record<RaidRewardKind, string> = { look: '🎨 Cloak', head: '🎩 Headwear', aura: '✨ Aura', decor: '🏰 Hall piece' };
