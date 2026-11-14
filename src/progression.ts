// Long-term progression shown off in the Crypt Hall: Soul Ranks from lifetime Souls,
// titles to wear under your name, cosmetic looks for the hero, and the Bestiary.

import { ACHIEVEMENTS, HEROES, type HeroId } from './content';

// ---------- hero mastery ----------

/** Souls earned with a hero for each mastery rank (rank 3 brings a cloak, rank 5 a title). */
export const MASTERY_SOULS = [500, 1500, 4000, 10000, 25000];

/** Mastery rank (0-5) for this many Souls earned with a hero. */
export const masteryRank = (souls: number) => MASTERY_SOULS.filter((n) => souls >= n).length;

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
  // The Soul Pyre: Souls given to it, all told.
  { id: 'pyre:1000', name: 'Kindler', how: 'Give 1,000 Souls to the Soul Pyre.' },
  { id: 'pyre:10000', name: 'Pyre-Keeper', how: 'Give 10,000 Souls to the Soul Pyre.' },
  { id: 'pyre:50000', name: 'Soulburner', how: 'Give 50,000 Souls to the Soul Pyre.' },
  // Gifted by hand by the Crypt Keeper.
  { id: 'gift:exterminator', name: 'Bug Exterminator', how: 'A gift from the Crypt Keeper, for hunting down bugs and reporting them.' },
  { id: 'gift:plotkeeper', name: 'Keeper of the Old Plot', how: 'Put 25 graves back to rest in Grave Shift.' },
  { id: 'gift:sawdawn', name: 'The Unsleeping', how: 'Put down 1,000 of the dead in one Night Shift.' },
  { id: 'gift:brightidea', name: 'Bright Idea', how: 'A gift from the Crypt Keeper, for an idea that made it into the game.' },
  // Deaths of Shame: silly ways to fall, each worn as a title.
  ...SHAME.map((d) => ({ id: `shame:${d.id}`, name: d.title, how: d.how })),
  // Story mode only.
  // Hero mastery: the top rank with each hero.
  ...HEROES.map((h) => ({ id: `mastery:${h.id}`, name: `Master ${h.name}`, how: `Reach mastery rank ${MASTERY_SOULS.length} with the ${h.name}: earn ${MASTERY_SOULS[MASTERY_SOULS.length - 1].toLocaleString()} Souls as them.` })),
  { id: 'story:1', name: "Gravedigger's Apprentice", how: 'Finish Fresh Dirt in the story.' },
  { id: 'story:2', name: 'Friend of Hounds', how: 'Finish The Kennel in the story.' },
  { id: 'story:3', name: "Aldric's Squire", how: 'Finish The Hollow Knight in the story.' },
  { id: 'story:11', name: 'Ring Finder', how: 'Finish A Ring in the Well in the story.' },
  { id: 'story:12', name: 'Coal Runner', how: 'Finish Blue Coal in the story.' },
  { id: 'story:bell', name: 'The Bell-Ringer', how: 'Finish every quest in Act I of the story.' },
  { id: 'story:all', name: 'Hero of Gravesend', how: 'Finish every quest in Act I of the story, side quests too.' },
  { id: 'story:21', name: 'Down the Lid', how: 'Finish The Lid in Act II of the story.' },
  { id: 'story:22', name: 'Brother of the Cloister', how: 'Finish Vespers in Act II of the story.' },
  { id: 'story:32', name: 'Physician', how: "Finish Pip's Cough in Act II of the story." },
  { id: 'story:33', name: 'Keeper of the Hymn', how: 'Finish The Silent Choir in Act II of the story.' },
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
  'gift:exterminator': 'arcane',
  'gift:brightidea': 'gold',
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
  unlock: { feat: string } | { rank: number } | { beast: EnemyKind; tier: number } | { costume: string } | { podium: number } | { cost: number; season?: SeasonId; market?: true } | { streak: number } | { weekly: number } | { story: number } | { season: SeasonId } | { shame: number } | { welcome: number } | { raid: number } | { invite: number } | { gift: string };
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
  { id: 'monkshabit', name: "Monk's Habit", cloak: { p: '#5a4a3a', P: '#33281f' }, aura: '#9be36a', unlock: { story: 21 }, how: 'Open the lid in Act II of the story.' },
  { id: 'plaguecoat', name: 'Plague Coat', cloak: { p: '#2e2a24', P: '#151310' }, aura: '#9be36a', unlock: { story: 31 }, how: 'Bring Ambrose his herbs in Act II of the story (Bitter Herbs).' },
  { id: 'choirrobe', name: 'Choir Robe', cloak: { p: '#d8d2c2', P: '#7a2a2a' }, aura: '#fff2c0', unlock: { story: 33 }, how: 'Bring back the lost hymn in Act II of the story (The Silent Choir).' },
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
// The Weekly Trial.
LOOKS.push({ id: 'trialcloak', name: "Trialbearer's Cloak", cloak: { p: '#4a5a8a', P: '#c99a2e' }, aura: '#f2c14e', unlock: { feat: 'trial4' }, how: 'Complete 4 Weekly Trials.' });
// Friends: answering summons as a ghost.
LOOKS.push({ id: 'shepherd', name: "Shepherd's Shroud", cloak: { p: '#9fb4cc', P: '#4a5a72' }, aura: '#c9f2ff', unlock: { feat: 'shepherd10' }, how: 'Have your ghost answer 10 summons from other players.' });
// Feats of skill.
LOOKS.push({ id: 'asceticrobe', name: "Ascetic's Robe", cloak: { p: '#b8a888', P: '#6a5a40' }, aura: null, unlock: { feat: 'ascetic' }, how: 'Reach floor 10 having taken no more than 1 relic.' });
// The Bestiary.
LOOKS.push({ id: 'huntermantle', name: "Monster Hunter's Mantle", cloak: { p: '#5a4a2a', P: '#2a1f12' }, aura: '#c4a046', unlock: { feat: 'hunterhalf' }, how: 'Master 6 foes in the Bestiary.' });
// Dailies played in all.
LOOKS.push({ id: 'pilgrimmantle', name: "Pilgrim's Mantle", cloak: { p: '#8a6a3a', P: '#4a3418' }, aura: '#e8c27a', unlock: { feat: 'dailies30' }, how: 'Play 30 Daily Descents.' });
// The Night Shift.
LOOKS.push({ id: 'watchcoat', name: "Night Watchman's Coat", cloak: { p: '#4a3a2a', P: '#231a12' }, aura: '#cfa25a', unlock: { feat: 'ns15' }, how: 'Survive 15 minutes in the Night Shift.' });
LOOKS.push({ id: 'ghostweave', name: 'Ghostweave', cloak: { p: '#c8d4e6', P: '#6a7890' }, aura: '#9fe8ff', unlock: { feat: 'nsuntouched' }, how: 'Get through the first 3 minutes of a Night Shift without being hit.' });
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

export type SeasonId = 'halloween' | 'harvest' | 'midwinter';

/** A season's first or last day: a month-day, or a day set by Thanksgiving (it moves each year). */
type SeasonDay = string | 'thanksgiving' | 'after-thanksgiving';

export const SEASONS: Record<SeasonId, { name: string; emoji: string; from: SeasonDay; to: SeasonDay; dates: string }> = {
  // Month-day, Central Time, both days included.
  halloween: { name: 'The Hallowed Season', emoji: '🎃', from: '10-19', to: '11-02', dates: 'October 19 to November 2' },
  // From November 1 up to and including Thanksgiving Day.
  harvest: { name: 'The Harvest Feast', emoji: '🍂', from: '11-01', to: 'thanksgiving', dates: 'November 1 to Thanksgiving' },
  // From the day after Thanksgiving, over the new year, to Twelfth Night.
  midwinter: { name: 'Midwinter', emoji: '❄️', from: 'after-thanksgiving', to: '01-06', dates: 'the day after Thanksgiving to January 6' },
};

/** Thanksgiving in the United States: the fourth Thursday of November, as a month-day. */
export function thanksgiving(year: number): string {
  const firstDay = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstThursday = 1 + ((4 - firstDay + 7) % 7);
  return `11-${String(firstThursday + 21).padStart(2, '0')}`;
}

function seasonDay(day: SeasonDay, year: number): string {
  if (day === 'thanksgiving') return thanksgiving(year);
  if (day === 'after-thanksgiving') return `11-${String(Number(thanksgiving(year).slice(3)) + 1).padStart(2, '0')}`;
  return day;
}

/** Whether a season is open on a Central date (YYYY-MM-DD). */
export function seasonOpen(id: SeasonId, date: string): boolean {
  const md = date.slice(5);
  const year = Number(date.slice(0, 4));
  const from = seasonDay(SEASONS[id].from, year);
  const to = seasonDay(SEASONS[id].to, year);
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** The season the world above the crypt is dressed for on a Central date: snow wins over leaves. */
export function seasonDress(date: string): 'harvest' | 'midwinter' | null {
  if (seasonOpen('midwinter', date)) return 'midwinter';
  if (seasonOpen('harvest', date)) return 'harvest';
  return null;
}

/** The season a shop item belongs to, if any. */
export function seasonOf(unlock: Unlock | undefined): SeasonId | undefined {
  return unlock && 'season' in unlock ? unlock.season : undefined;
}

const harvestHead = (cost: number) => ({ unlock: { cost, season: 'harvest' as const }, how: `Sold in the Ossuary during the Harvest Feast (November 1 to Thanksgiving) for ${cost.toLocaleString()} Souls.` });
const winterHead = (cost: number) => ({ unlock: { cost, season: 'midwinter' as const }, how: `Sold in the Ossuary during Midwinter (the day after Thanksgiving to January 6) for ${cost.toLocaleString()} Souls.` });
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

const harvested = (cost: number) => ({ unlock: { cost, season: 'harvest' as const }, how: `Sold in the Ossuary during the Harvest Feast (November 1 to Thanksgiving) for ${cost.toLocaleString()} Souls.` });
LOOKS.push(
  { id: 'harvestmantle', name: 'Harvest Mantle', cloak: { p: '#c0662a', P: '#5a2e12' }, aura: '#ffb35a', unlock: { season: 'harvest' }, how: 'Play any run during the Harvest Feast (November 1 to Thanksgiving).' },
  { id: 'autumnleaf', name: 'Autumn Leaves', cloak: { p: '#e0a030', P: '#b5401f' }, aura: '#ffd23f', ...harvested(400) },
  { id: 'cranberry', name: 'Cranberry Cloak', cloak: { p: '#9a2042', P: '#3e0b1c' }, aura: null, ...harvested(500) },
  { id: 'cornsilk', name: 'Cornsilk', cloak: { p: '#e8c25a', P: '#7a5a1a' }, aura: '#fff2c0', ...harvested(700) },
  { id: 'flannel', name: 'Plaid Flannel', cloak: { p: '#a8391f', P: '#2a1a14' }, aura: null, ...harvested(550) },
  { id: 'pumpkinspice', name: 'Pumpkin Spice', cloak: { p: '#d98a3a', P: '#6b3a17' }, aura: '#ffd23f', ...harvested(650) },
  { id: 'oldoak', name: 'Old Oak', cloak: { p: '#6b4a2a', P: '#2e2219' }, aura: '#d9a03a', ...harvested(900) },
);

// Grave Shift: Mortimer sells these for Obols, the farm's coin; his cap is for finishing his first jobs.
const wares = (price: number) => ({ how: `Sold at Mortimer's shed in Grave Shift for ${price.toLocaleString()} Obols.` });
LOOKS.push(
  { id: 'plotcoat', name: "Plot-Keeper's Coat", cloak: { p: '#5a4a3a', P: '#2a2018' }, aura: '#b5e07a', unlock: { gift: 'grave:plotcoat' }, ...wares(600) },
  { id: 'scarecrowrags', name: 'Scarecrow Rags', cloak: { p: '#c4a046', P: '#6b4a2a' }, aura: '#e8c25a', unlock: { gift: 'grave:scarecrowrags' }, ...wares(900) },
);

const wintry = (cost: number) => ({ unlock: { cost, season: 'midwinter' as const }, how: `Sold in the Ossuary during Midwinter (the day after Thanksgiving to January 6) for ${cost.toLocaleString()} Souls.` });
LOOKS.push(
  { id: 'midwintermantle', name: 'Midwinter Mantle', cloak: { p: '#2e7d4f', P: '#8a1f2c' }, aura: '#ffffff', unlock: { season: 'midwinter' }, how: 'Play any run during Midwinter (the day after Thanksgiving to January 6).' },
  { id: 'snowfall', name: 'Snowfall', cloak: { p: '#eef3fb', P: '#9fb4cc' }, aura: '#ffffff', ...wintry(400) },
  { id: 'holly', name: 'Holly and Berry', cloak: { p: '#1f6b3a', P: '#0f3a1f' }, aura: '#ff4d5a', ...wintry(500) },
  { id: 'gingerbread', name: 'Gingerbread', cloak: { p: '#b8692e', P: '#6b3a17' }, aura: '#fff2c0', ...wintry(600) },
  { id: 'frostgiant', name: 'Frost Giant', cloak: { p: '#7fc8ff', P: '#2a5a8a' }, aura: '#c9f2ff', ...wintry(800) },
  { id: 'krampus', name: 'Krampus Fur', cloak: { p: '#4a3428', P: '#120b08' }, aura: '#ff4d5a', ...wintry(900) },
  { id: 'aurora', name: 'Aurora', cloak: { p: '#5fd3a6', P: '#5a3a9a' }, aura: '#9fe8ff', ...wintry(1200) },
  { id: 'candycane', name: 'Candy Cane', cloak: { p: '#f2f2f2', P: '#d23a46' }, aura: null, ...wintry(500) },
  { id: 'nutcracker', name: 'Nutcracker', cloak: { p: '#c0392b', P: '#1a1520' }, aura: '#f2c14e', ...wintry(700) },
  { id: 'icequeen', name: "Ice Queen's Mantle", cloak: { p: '#c9f2ff', P: '#5a3a9a' }, aura: '#e8fbff', ...wintry(1500) },
);

// The Grave Market: pieces sold one a day, each only on its day (see marketPiece).
const market = (cost: number) => ({ unlock: { cost, market: true as const }, how: `Sold in the Ossuary for ${cost.toLocaleString()} Souls, but only on the days it's today's piece.` });
LOOKS.push(
  { id: 'bloodmoon', name: 'Blood Moon Mantle', cloak: { p: '#6a0f1a', P: '#2a0508' }, aura: '#ff4d5a', ...market(1200) },
  { id: 'starless', name: 'Starless Night', cloak: { p: '#0d0b1a', P: '#2a1f4a' }, aura: '#9fb4ff', ...market(1400) },
  { id: 'verdigris', name: 'Verdigris', cloak: { p: '#3f8f7a', P: '#1f4a3f' }, aura: '#7cf5c4', ...market(1000) },
  { id: 'ashenpilgrim', name: 'Ashen Pilgrim', cloak: { p: '#8f8a80', P: '#45423c' }, aura: null, ...market(900) },
  { id: 'royalcrypt', name: 'Royal Crypt', cloak: { p: '#2a3a8a', P: '#c99a2e' }, aura: '#f2c14e', ...market(1600) },
  { id: 'drownedcoral', name: 'Drowned Coral', cloak: { p: '#e06a5a', P: '#2a5a6a' }, aura: '#9fe8ff', ...market(1100) },
  { id: 'hexweaver', name: 'Hexweaver', cloak: { p: '#5a1a6a', P: '#0f0a14' }, aura: '#d3b0ff', ...market(1300) },
  { id: 'ivorysaint', name: 'Ivory Saint', cloak: { p: '#f4ecd8', P: '#c9a24a' }, aura: '#fff2c0', ...market(1500) },
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
  { id: 'bookshelf', name: 'Crypt Library', emoji: '📚', cost: 800, desc: 'A tall shelf of mouldering books and a skull for a bookend.' },
  { id: 'houndbed', name: "Hound's Bed", emoji: '🐾', cost: 600, desc: 'A worn cushion by the wall, with a chewed bone, for the hound.' },
  { id: 'pedestal', name: 'Trophy Pedestal', emoji: '🏆', cost: 1000, desc: 'A stone pedestal with your deepest floor carved in gold.' },
  { id: 'hearth', name: 'Grave Hearth', emoji: '🔥', cost: 1200, desc: 'A stone fireplace with a fire that crackles and glows.' },
  // The Hallowed Season.
  { id: 'cobwebs', name: 'Cobwebs', emoji: '🕸️', cost: 400, desc: 'Great webs in the high corners, with a spider that comes down to look.', season: 'halloween' },
  { id: 'garland', name: 'Hallowed Garland', emoji: '🎏', cost: 500, desc: 'Orange and purple bunting strung along the top of the wall.', season: 'halloween' },
  { id: 'jacks', name: "Jack-o'-Lanterns", emoji: '🎃', cost: 800, desc: 'A row of grinning pumpkins along the floor, lit from inside.', season: 'halloween' },
  { id: 'bats', name: 'Bat Swarm', emoji: '🦇', cost: 900, desc: 'Bats that flit across your Hall, forever.', season: 'halloween' },
  { id: 'cauldron', name: "Witch's Cauldron", emoji: '🧪', cost: 1200, desc: 'A great iron pot of green brew that never stops bubbling.', season: 'halloween' },
  { id: 'ghosts', name: 'Wandering Ghosts', emoji: '👻', cost: 1800, desc: 'Two pale ghosts that drift through your Hall and pass through the walls.', season: 'halloween' },
  { id: 'leafgarland', name: 'Autumn Garland', emoji: '🍁', cost: 400, desc: 'Red, orange and gold leaves strung along the top of the wall.', season: 'harvest' },
  { id: 'hay', name: 'Hay Bales and Gourds', emoji: '🌾', cost: 500, desc: 'A hay bale stacked with squash and gourds by the wall.', season: 'harvest' },
  { id: 'feast', name: 'The Harvest Table', emoji: '🦃', cost: 900, desc: 'A long table laid with a roast, a pie and candles that flicker.', season: 'harvest' },
  { id: 'wreaths', name: 'Holly Wreaths', emoji: '🎄', cost: 400, desc: 'A wreath with a red bow on each of your trophy frames.', season: 'midwinter' },
  { id: 'stringlights', name: 'Twinkle Lights', emoji: '💡', cost: 500, desc: 'Coloured lights strung along the wall, twinkling in turn.', season: 'midwinter' },
  { id: 'stockings', name: 'Stockings', emoji: '🧦', cost: 600, desc: 'A row of stockings hung on the wall, one bulging.', season: 'midwinter' },
  { id: 'presents', name: 'Pile of Presents', emoji: '🎁', cost: 700, desc: 'Wrapped boxes stacked by the wall, ribbons and all.', season: 'midwinter' },
  { id: 'snowman', name: 'Snowman', emoji: '⛄', cost: 900, desc: 'A snowman with a coal smile and a carrot nose, somehow not melting.', season: 'midwinter' },
  { id: 'hallsnow', name: 'Indoor Snowfall', emoji: '❄️', cost: 1200, desc: 'Snow drifting down through your Hall, forever.', season: 'midwinter' },
  { id: 'sheaves', name: 'Wheat Sheaves', emoji: '🌾', cost: 400, desc: 'Two bundles of golden wheat, tied with twine, leaning on the wall.', season: 'harvest' },
  { id: 'applebarrel', name: 'Apple Barrel', emoji: '🍎', cost: 550, desc: 'A barrel brimming with red apples, one rolled loose.', season: 'harvest' },
  { id: 'cornucopia', name: 'Cornucopia', emoji: '🌽', cost: 750, desc: 'A horn of plenty spilling corn, grapes and gourds.', season: 'harvest' },
  { id: 'icicles', name: 'Icicles', emoji: '🧊', cost: 500, desc: 'Icicles along the top of the wall, one dripping now and then.', season: 'midwinter' },
  { id: 'gingerhouse', name: 'Gingerbread House', emoji: '🏠', cost: 1000, desc: 'A gingerbread house iced white and studded with sweets, its window lit.', season: 'midwinter' },
  { id: 'xmastree', name: 'Midwinter Tree', emoji: '🌲', cost: 1500, desc: 'A tall tree hung with lights that twinkle, and a star on top.', season: 'midwinter' },
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

/** Hall pieces earned in the Night Shift: never sold, each for one of its feats. */
export interface FeatDecorDef { id: string; name: string; emoji: string; desc: string; feat: string }
export const FEAT_DECOR: FeatDecorDef[] = [
  { id: 'forgeanvil', name: 'Forge Anvil', emoji: '⚒️', desc: 'An anvil from the Soul Forge, its coals still glowing.', feat: 'nsforge3' },
  { id: 'threeskulls', name: 'Three Skulls', emoji: '💀', desc: 'The skulls of the Gravelord, the Drowned Abbot and the Lich, on a stand.', feat: 'nsbosses' },
  { id: 'manybanner', name: 'Banner of the Many', emoji: '🏳️', desc: 'Raised for playing in a month when everyone together reached the community goal.', feat: 'together' },
];
export const FEAT_DECOR_BY_ID = Object.fromEntries(FEAT_DECOR.map((d) => [d.id, d])) as Record<string, FeatDecorDef>;

/** Cloaks, headwear and auras that come with these achievements, to announce. */
export function featCosmetics(ids: string[]): { icon: string; title: string; detail: string }[] {
  const won = (u: object | undefined) => Boolean(u && 'feat' in u && ids.includes((u as { feat: string }).feat));
  return [
    ...LOOKS.filter((l) => won(l.unlock)).map((l) => ({ icon: '🧥', title: l.name, detail: 'New cloak in the Wardrobe' })),
    ...HEADS.filter((x) => won(x.unlock)).map((x) => ({ icon: '🪖', title: x.name, detail: 'New headwear in the Wardrobe' })),
    ...AURAS.filter((a) => won(a.unlock)).map((a) => ({ icon: '✨', title: a.name, detail: 'New aura in the Wardrobe' })),
    ...FEAT_DECOR.filter((d) => ids.includes(d.feat)).map((d) => ({ icon: d.emoji, title: d.name, detail: 'New piece in your Crypt Hall' })),
  ];
}

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
  | 'bosses' | 'shadowSteps' | 'dodges' | 'raised' | 'allies' | 'undead' | 'arrowKills' | 'missileKills' | 'maxHit' | 'lowHpKills' | 'cleanFloors';

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
    missileKills: `Slay ${n} foes with Magic Missiles in one run`,
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
  { id: 'physicianmask', name: "Physician's Mask", unlock: { story: 32 }, how: "Cure Pip's cough in Act II of the story.", pixels: [...row(1, 3, 8, '#e8dcc4'), ...row(2, 2, 9, '#c9b99a'), [3, 3, '#c9a24a'], [4, 3, '#1a1520'], [5, 3, '#c9a24a'], [6, 3, '#c9a24a'], [7, 3, '#1a1520'], [8, 3, '#c9a24a'], ...row(4, 6, 9, '#e8dcc4'), ...row(5, 7, 10, '#c9b99a'), [5, 0, '#c9b99a'], [6, 0, '#c9b99a']] },
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
  // Grave Shift.
  { id: 'mortimercap', name: "Mortimer's Cap", unlock: { gift: 'grave:mortimercap' }, how: "Finish Mortimer's first jobs in Grave Shift.", pixels: [...row(1, 3, 8, '#5a4a3a'), ...row(2, 2, 9, '#4a3a2a'), [3, 1, '#6b5a48'], [9, 2, '#3a2a1a'], [10, 2, '#3a2a1a']] },
  { id: 'gourdhelm', name: 'Gourd Helm', unlock: { gift: 'grave:gourdhelm' }, ...wares(700), pixels: [[5, 0, '#5a3a1a'], [6, 0, '#3d6b2a'], ...row(1, 3, 8, '#5f8a3a'), ...row(2, 2, 9, '#4f7a2a'), [4, 1, '#8ab85a'], [7, 1, '#e8c25a'], [3, 2, '#e8c25a'], [8, 2, '#e8c25a']] },
  // The Harvest Feast: sold only November 1 to Thanksgiving.
  { id: 'acorncap', name: 'Acorn Cap', ...harvestHead(400), pixels: [[5, 0, '#5a3a1a'], [6, 0, '#5a3a1a'], ...row(1, 3, 8, '#8a5a28'), ...row(2, 2, 9, '#a8743a'), [3, 1, '#6b4420'], [5, 1, '#6b4420'], [7, 1, '#6b4420'], [4, 2, '#8a5a28'], [6, 2, '#8a5a28'], [8, 2, '#8a5a28']] },
  { id: 'leafcrown', name: 'Autumn Wreath', ...harvestHead(500), pixels: [[2, 2, '#d9822b'], [3, 1, '#c0392b'], [4, 1, '#ffd23f'], [5, 0, '#d9822b'], [6, 0, '#c0392b'], [7, 1, '#ffd23f'], [8, 1, '#d9822b'], [9, 2, '#c0392b'], [3, 2, '#8a3b12'], [8, 2, '#8a3b12'], [5, 1, '#e67e22'], [6, 1, '#8a3b12']] },
  { id: 'buckle', name: 'Buckle Hat', ...harvestHead(650), pixels: [...row(0, 4, 7, '#4a4458'), ...row(1, 4, 7, '#3d3546'), ...row(2, 4, 7, '#2a2433'), [5, 2, GOLD], [6, 2, GOLD], [4, 0, '#5d5568'], ...row(3, 2, 9, '#4a4458'), [2, 3, '#5d5568']] },
  { id: 'turkeyhat', name: 'Roast Turkey Hat', ...harvestHead(800), pixels: [...row(0, 4, 7, '#c0702a'), ...row(1, 3, 8, '#a8581f'), ...row(2, 3, 8, '#8a4418'), [5, 0, '#f0b070'], [4, 1, '#d98a3a'], [5, 1, '#e09a50'], [3, 1, '#c0702a'], [2, 2, '#c0702a'], [2, 1, '#d98a3a'], [1, 0, '#ffffff'], [9, 2, '#c0702a'], [9, 1, '#d98a3a'], [10, 0, '#ffffff'], ...row(3, 2, 9, '#e8e0d0')] },
  { id: 'knitscarf', name: 'Knit Scarf', ...harvestHead(450), pixels: [...row(5, 3, 8, '#a8391f'), [4, 5, '#d9a03a'], [6, 5, '#d9a03a'], [8, 5, '#d9a03a'], [8, 6, '#a8391f'], [8, 7, '#a8391f'], [8, 8, '#d9a03a']] },
  { id: 'piehat', name: 'Pumpkin Pie Hat', ...harvestHead(550), pixels: [[5, 0, '#fff8e8'], [6, 0, '#fff8e8'], ...row(1, 3, 8, '#d9822b'), [4, 1, '#e0b860'], [7, 1, '#e0b860'], ...row(2, 2, 9, '#c4a046'), [3, 2, '#e0b860'], [8, 2, '#e0b860']] },
  { id: 'sunflower', name: 'Sunflower Crown', ...harvestHead(600), pixels: [[5, 0, '#ffd23f'], [6, 0, '#ffd23f'], [4, 1, '#ffd23f'], [5, 1, '#5a3a1a'], [6, 1, '#5a3a1a'], [7, 1, '#ffd23f'], [5, 2, '#ffd23f'], [6, 2, '#ffd23f'], [3, 2, '#3d6b2a'], [8, 2, '#3d6b2a'], [2, 2, '#5f8a3a'], [9, 2, '#5f8a3a']] },
  // Midwinter: sold only the day after Thanksgiving to January 6.
  { id: 'mistletoe', name: 'Mistletoe Sprig', ...winterHead(400), pixels: [[6, 0, '#3d6b2a'], [4, 1, '#3aa860'], [5, 1, '#2e8a4c'], [6, 1, '#f2f2f2'], [7, 1, '#2e8a4c'], [8, 1, '#3aa860'], [5, 2, '#f2f2f2'], [7, 2, '#f2f2f2'], [6, 2, '#d23a46']] },
  { id: 'shako', name: "Nutcracker's Shako", ...winterHead(650), pixels: [...row(0, 4, 7, '#1a1520'), ...row(1, 4, 7, '#2a2433'), [5, 1, GOLD], [6, 1, GOLD], ...row(2, 3, 8, '#c9a24a'), [8, 0, RED], [8, 1, RED], ...row(5, 4, 7, '#ffffff'), [3, 5, '#e8e8e8'], [8, 5, '#e8e8e8']] },
  { id: 'frostcrown', name: 'Frost Crown', ...winterHead(1000), pixels: [[3, 0, '#c9f2ff'], [5, 0, '#e8fbff'], [6, 0, '#e8fbff'], [8, 0, '#c9f2ff'], ...row(1, 3, 8, '#9fe8ff'), [4, 1, '#ffffff'], [7, 1, '#ffffff'], ...row(2, 3, 8, '#5fa8ff'), [5, 2, '#e8fbff'], [6, 2, '#e8fbff']] },
  { id: 'hollycrown', name: 'Holly Crown', ...winterHead(400), pixels: [[3, 1, '#1f6b3a'], [4, 1, '#2e8a4c'], [5, 0, RED], [6, 0, RED], [5, 1, '#1f6b3a'], [6, 1, '#2e8a4c'], [7, 1, '#1f6b3a'], [8, 1, '#2e8a4c'], [2, 2, '#1f6b3a'], [9, 2, '#1f6b3a'], [4, 0, '#ff4d5a']] },
  { id: 'earmuffs', name: 'Earmuffs', ...winterHead(400), pixels: [...row(0, 4, 7, '#9aa3b5'), [3, 1, '#9aa3b5'], [8, 1, '#9aa3b5'], [1, 3, '#e8a0c0'], [2, 3, '#ff9ab0'], [1, 4, '#ff9ab0'], [2, 4, '#e8a0c0'], [9, 3, '#e8a0c0'], [10, 3, '#ff9ab0'], [9, 4, '#ff9ab0'], [10, 4, '#e8a0c0'], [2, 2, '#9aa3b5'], [9, 2, '#9aa3b5']] },
  { id: 'elfhat', name: 'Elf Hat', ...winterHead(450), pixels: [[8, 0, GOLD], [7, 0, '#2e8a4c'], [6, 0, '#2e8a4c'], ...row(1, 4, 7, '#2e8a4c'), [8, 1, '#1f6b3a'], ...row(2, 3, 8, RED), [4, 1, '#3aa860']] },
  { id: 'bobble', name: 'Bobble Hat', ...winterHead(450), pixels: [[5, 0, '#ffffff'], [6, 0, '#ffffff'], ...row(1, 4, 7, '#5fa8ff'), ...row(2, 3, 8, '#ffffff'), ...row(3, 3, 8, '#5fa8ff'), [4, 1, '#ffffff'], [6, 1, '#ffffff']] },
  { id: 'santahat', name: 'Winter Hat', ...winterHead(500), pixels: [[9, 1, '#ffffff'], [8, 0, RED], [7, 0, RED], ...row(1, 4, 8, RED), [6, 0, RED], ...row(2, 3, 8, '#ffffff'), [5, 1, '#ff4d5a']] },
  { id: 'reindeer', name: 'Reindeer Antlers', ...winterHead(550), pixels: [[3, 2, '#8a5a28'], [2, 1, '#8a5a28'], [1, 0, '#a8743a'], [3, 0, '#a8743a'], [2, 0, '#8a5a28'], [8, 2, '#8a5a28'], [9, 1, '#8a5a28'], [10, 0, '#a8743a'], [8, 0, '#a8743a'], [9, 0, '#8a5a28'], [6, 5, '#ff4d5a']] },
  { id: 'snowmanhat', name: 'Snowman', ...winterHead(700), pixels: [...row(0, 4, 7, '#141119'), ...row(1, 4, 7, '#141119'), [5, 1, RED], [6, 1, RED], ...row(2, 3, 8, '#141119'), ...row(3, 3, 8, '#f2f6fb'), [4, 4, '#f2f6fb'], [5, 4, '#141119'], [6, 4, '#f2f6fb'], [7, 4, '#141119'], [3, 4, '#f2f6fb'], [8, 4, '#f2f6fb'], [6, 5, '#ff8a2a'], [7, 5, '#ff8a2a'], [8, 5, '#e06a1a']] },
  { id: 'starcrown', name: 'Star of Midwinter', ...winterHead(900), pixels: [[5, 0, '#fff2c0'], [6, 0, '#fff2c0'], [4, 1, GOLD], [5, 1, '#ffffff'], [6, 1, '#ffffff'], [7, 1, GOLD], [3, 1, '#a8781f'], [8, 1, '#a8781f'], [5, 2, GOLD], [6, 2, GOLD], [4, 2, '#a8781f'], [7, 2, '#a8781f']] },
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
  hero('arcanecirclet', 'Arcane Circlet', 'mage', { run: 'missileKills', n: 25 }, [...row(2, 3, 8, '#6a3fd0'), [5, 1, '#d3b0ff'], [6, 1, '#d3b0ff'], [5, 0, '#ffffff'], [6, 0, '#b07cff'], [3, 1, '#3a1f80'], [8, 1, '#3a1f80']]),
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
  // A gift from the Crypt Keeper, for hunting down bugs.
  { id: 'bughelm', name: "Exterminator's Mask", unlock: { gift: 'exterminator' }, how: 'A gift from the Crypt Keeper, for hunting down bugs and reporting them.', pixels: [...row(1, 3, 8, '#4a5a30'), ...row(2, 2, 9, '#3d4a2a'), [3, 3, '#1a1520'], [4, 3, '#7fe0ff'], [5, 3, '#1a1520'], [6, 3, '#1a1520'], [7, 3, '#7fe0ff'], [8, 3, '#1a1520'], ...row(4, 4, 7, '#5d667a'), [4, 5, '#9aa3b5'], [5, 5, '#3a3346'], [6, 5, '#3a3346'], [7, 5, '#9aa3b5'], [5, 0, '#ffd23f'], [6, 0, '#ffd23f']] },
  // Bring a friend: five friends brought.
  { id: 'lanternhood', name: 'Lantern Hood', unlock: { invite: 5 }, how: 'Bring 5 friends to the crypt.', pixels: [...row(1, 3, 8, '#5a2a12'), ...row(2, 2, 9, '#7a3a18'), [5, 0, '#3a3346'], [6, 0, '#3a3346'], [8, 0, '#3a3346'], [9, 1, '#ffd23f'], [10, 1, '#ff8a2a'], [9, 2, '#3a3346'], [10, 2, '#3a3346'], [4, 2, '#ffb35a'], [7, 2, '#ffb35a']] },
  // Death's own hood, skull and all: for cheating him.
  { id: 'deathshood', name: "Death's Hood", unlock: { feat: 'cheated' }, how: 'Reach floor 200 with Death on your heels.', pixels: [...row(0, 4, 7, '#141119'), ...row(1, 3, 8, '#141119'), ...row(2, 2, 9, '#1d1428'), [2, 3, '#1d1428'], [3, 3, '#1d1428'], ...row(3, 4, 7, BONE), [8, 3, '#1d1428'], [9, 3, '#1d1428'], [3, 4, '#1d1428'], [4, 4, '#d3b0ff'], [5, 4, BONE], [6, 4, BONE], [7, 4, '#d3b0ff'], [8, 4, '#1d1428'], [3, 5, '#1d1428'], [5, 5, '#c9c3b2'], [6, 5, '#c9c3b2'], [8, 5, '#1d1428']] },
  // Bosses slain 25 times: their own headgear.
  { id: 'wardenhelm', name: "Warden's Horned Helm", unlock: { beast: 'boss', tier: 2 }, how: 'Slay the Bone Warden 25 times.', pixels: [[1, 0, BONE], [2, 1, BONE], [10, 0, BONE], [9, 1, BONE], ...row(1, 3, 8, '#c9c3b2'), ...row(2, 3, 8, BONE), [3, 3, '#c9c3b2'], [8, 3, '#c9c3b2'], [5, 2, '#5d5568'], [6, 2, '#5d5568']] },
  { id: 'abbotcowl', name: "Plague Abbot's Cowl", unlock: { beast: 'abbot', tier: 2 }, how: 'Slay the Plague Abbot 25 times.', pixels: [...row(0, 4, 7, '#3a4a2a'), ...row(1, 3, 8, '#4a5e34'), ...row(2, 2, 9, '#3a4a2a'), [2, 3, '#3a4a2a'], [9, 3, '#3a4a2a'], [2, 4, '#3a4a2a'], [9, 4, '#3a4a2a'], [5, 1, '#b5e07a'], [6, 1, '#b5e07a']] },
  { id: 'lichcrown', name: "Lich King's Crown", unlock: { beast: 'lich', tier: 2 }, how: 'Slay the Lich King 25 times.', pixels: [[3, 0, '#d3b0ff'], [6, 0, '#d3b0ff'], [8, 0, '#d3b0ff'], [4, 0, '#5a2f8a'], ...row(1, 3, 8, '#5a2f8a'), ...row(2, 3, 8, '#311854'), [5, 1, '#9fe8ff'], [6, 1, '#9fe8ff'], [3, 2, '#d3b0ff'], [8, 2, '#d3b0ff']] },
  // Grand Duelist: a sash and plume for beating 10 challenges.
  { id: 'duelsash', name: "Duelist's Plume", unlock: { feat: 'duelist10' }, how: 'Beat 10 challenges from other players.', pixels: [...row(2, 3, 8, '#8a1f2c'), [4, 2, GOLD], [7, 2, GOLD], [8, 1, '#e8dcc4'], [9, 0, '#e8dcc4'], [9, 1, '#c9c3b2'], [10, 0, '#ffffff']] },
  // Courier: a winged cap for a fast descent.
  { id: 'couriercap', name: "Courier's Cap", unlock: { feat: 'courier' }, how: 'Reach floor 15 in 200 turns or fewer.', pixels: [...row(1, 4, 7, '#5a7ab0'), ...row(2, 3, 8, '#3a5a8a'), [2, 1, '#e8f6ff'], [1, 0, '#e8f6ff'], [2, 0, '#c9d1e0'], [9, 1, '#e8f6ff'], [10, 0, '#e8f6ff'], [9, 0, '#c9d1e0'], [5, 1, GOLD], [6, 1, GOLD]] },
  // Master of Beasts: the hunter's hat.
  { id: 'huntertricorn', name: "Hunter's Tricorn", unlock: { feat: 'hunterall' }, how: 'Master every foe in the Bestiary.', pixels: [...row(0, 4, 7, '#3a2a1a'), ...row(1, 2, 9, '#4a3420'), ...row(2, 1, 10, '#2a1a10'), [3, 1, GOLD], [8, 1, GOLD], [10, 0, '#c4a046'], [11, 0, '#e8dcc4']] },
  // The Grave Market's headwear.
  { id: 'plaguebeak', name: "Plague Doctor's Beak", ...market(1200), pixels: [...row(0, 3, 8, DARK), ...row(1, 3, 8, DARK), ...row(2, 1, 10, '#2a2433'), [4, 4, '#5fe3ff'], [7, 4, '#5fe3ff'], [8, 5, BONE], [9, 5, BONE], [10, 6, '#c9c3b2']] },
  { id: 'graveantlers', name: 'Grave Antlers', ...market(1000), pixels: [[1, 0, '#a8845a'], [2, 1, '#8a6a4a'], [1, 2, '#a8845a'], [3, 2, '#8a6a4a'], [4, 3, '#8a6a4a'], [10, 0, '#a8845a'], [9, 1, '#8a6a4a'], [10, 2, '#a8845a'], [8, 2, '#8a6a4a'], [7, 3, '#8a6a4a']] },
  { id: 'crackedhalo', name: 'Cracked Halo', ...market(1400), pixels: [...row(0, 3, 8, '#fff2c0'), [6, 0, '#8f8672'], [2, 1, '#ffe08a'], [9, 1, '#ffe08a']] },
  { id: 'hexhat', name: "Hexweaver's Hat", ...market(1100), pixels: [[8, 0, '#3b2060'], ...row(1, 6, 8, '#3b2060'), ...row(2, 4, 7, '#5a1a6a'), ...row(3, 2, 9, '#3b2060'), [5, 2, '#d3b0ff'], [6, 2, '#d3b0ff']] },
  // A year of Dailies: a crown of twelve points, one for each month.
  { id: 'yearcrown', name: 'Crown of the Year', unlock: { feat: 'dailies365' }, how: 'Play 365 Daily Descents.', pixels: [[2, 0, GOLD], [4, 0, '#9fe8ff'], [6, 0, GOLD], [8, 0, '#ff8a2a'], [10, 0, GOLD], ...row(1, 2, 10, GOLD), ...row(2, 2, 10, '#a8781f'), [4, 2, '#ff4d5a'], [6, 2, '#7cf5c4'], [8, 2, '#d3b0ff']] },
  // The Night Shift: a hood with a lantern hung off it, and a crown of bone.
  { id: 'watchlantern', name: "Watchman's Lantern", unlock: { feat: 'ns1k' }, how: 'Put down 1,000 in one Night Shift.', pixels: [...row(0, 4, 7, '#2a2433'), ...row(1, 3, 8, '#2a2433'), ...row(2, 2, 9, '#3d3546'), [2, 3, '#3d3546'], [9, 3, '#3d3546'], [10, 1, '#5d5568'], [10, 2, '#5d5568'], [10, 3, '#ffb35a'], [11, 3, '#ff8a2a'], [10, 4, '#ffd23f'], [11, 4, '#5d5568']] },
  { id: 'bonecrown', name: 'Bone Crown', unlock: { feat: 'ns10k' }, how: 'Put down 10,000 in one Night Shift.', pixels: [[3, 0, BONE], [5, 0, BONE], [6, 0, BONE], [8, 0, BONE], ...row(1, 3, 8, BONE), ...row(2, 3, 8, '#c9c3b2'), [5, 1, '#d23a46'], [6, 1, '#d23a46'], [4, 2, '#8f8672'], [7, 2, '#8f8672']] },
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
  cloak('tolling', 'Tolling Bronze', 'bellringer', { floor: 15 }, '#8a5a28', '#4a2e12', '#e8c27a'),
  // Mastery rank 3 with each hero (see MASTERY_SOULS).
  cloak('lionheart', 'Lionheart', 'knight', { souls: 4000 }, '#c99a2e', '#7a1f1f', '#ffd23f'),
  cloak('whisperweave', 'Whisperweave', 'rogue', { souls: 4000 }, '#3a3a52', '#14141f', '#c9d1e0'),
  cloak('lichcloth', 'Lichcloth', 'necro', { souls: 4000 }, '#2a4a3a', '#0a1a12', '#7cf5c4'),
  cloak('dawnward', 'Dawnward', 'paladin', { souls: 4000 }, '#f2e6c0', '#5a7ab0', '#fff2c0'),
  cloak('wildwood', 'Wildwood', 'ranger', { souls: 4000 }, '#4a6a2a', '#2a3a14', '#b5e07a'),
  cloak('starweave', 'Starweave', 'mage', { souls: 4000 }, '#1f2a6a', '#0a0f2a', '#9fe8ff'),
  cloak('warchief', "Warchief's Pelt", 'barbarian', { souls: 4000 }, '#6a4a2a', '#2a1a0a', '#ff8a2a'),
  cloak('belfry', 'Belfry Robe', 'bellringer', { souls: 4000 }, '#5a5a6a', '#2a2a36', '#f2c14e'),
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
  | 'shards' | 'blades' | 'banner' | 'eclipse' | 'reaper' | 'favour' | 'zapper' | 'vespers' | 'bulbs'
  | 'leaves' | 'snowglobe' | 'fairylights' | 'moon' | 'aurora';

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
  | { gift: string }
  | { cost: number; season?: SeasonId; market?: true };

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
  { id: 'vespercandles', name: 'Vespers Candles', style: 'vespers', color: '#9be36a', unlock: { story: 22 }, how: 'Break up Vespers in Act II of the story.' },
  { id: 'homecoming', name: 'Homecoming', style: 'souls', color: '#7cf5c4', unlock: { welcome: 5 }, how: 'Seven Nights, day 5: come back on a fifth day.' },
  { id: 'kindredflame', name: 'Kindred Flame', style: 'candle', color: '#ff8a2a', unlock: { invite: 3 }, how: 'Bring 3 friends to the crypt.' },
  // Horde: earned holding the crypt, never sold.
  { id: 'overcharge', name: 'Overcharge', style: 'storm', color: '#5fe3ff', unlock: { feat: 'hordeovercharged' }, how: 'Trigger 10 power surges in one Horde run.' },
  { id: 'hordelegend', name: 'Legend of the Horde', style: 'sunburst', color: '#ff8a2a', unlock: { feat: 'horde100k' }, how: 'Score 100,000 points in one Horde run.' },
  { id: 'deathsdance', name: "Death's Dance", style: 'bone', color: '#d3b0ff', unlock: { feat: 'hordedanced' }, how: 'Hold 10 Horde waves with Death in the arena.' },
  { id: 'deathsshadow', name: "Death's Shadow", style: 'reaper', color: '#9a6bff', unlock: { feat: 'horde30' }, how: 'Hold the crypt to wave 30 in Horde, with Death in the arena.' },
  // Given by hand by the Crypt Keeper, never earned or sold.
  { id: 'keepersfavour', name: "Keeper's Favour", style: 'favour', color: '#ffd27a', unlock: { gift: 'keepersfavour' }, how: "A rare gift from the Crypt Keeper. It can't be earned or bought." },
  { id: 'bugzapper', name: 'Bug Zapper', style: 'zapper', color: '#5fe3ff', unlock: { gift: 'exterminator' }, how: 'A gift from the Crypt Keeper, for hunting down bugs and reporting them.' },
  { id: 'brightideas', name: 'Bright Ideas', style: 'bulbs', color: '#ffd23f', unlock: { gift: 'brightidea' }, how: 'A gift from the Crypt Keeper, for an idea that made it into the game.' },
  // The Bell Tolls: felling world bosses together.
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
  // Grave Shift: sold at Mortimer's shed for Obols.
  { id: 'fireflyswarm', name: 'Firefly Swarm', style: 'favour', color: '#c8f05a', unlock: { gift: 'grave:fireflyswarm' }, how: "Sold at Mortimer's shed in Grave Shift for 1,500 Obols." },
  // The Harvest Feast.
  { id: 'harvestmoon', name: 'Harvest Moon', style: 'moon', color: '#e8902a', unlock: { cost: 3500, season: 'harvest' }, how: 'Sold in the Ossuary during the Harvest Feast (November 1 to Thanksgiving) for 3,500 Souls.' },
  { id: 'fallingleaves', name: 'Falling Leaves', style: 'leaves', color: '#e67e22', unlock: { cost: 2500, season: 'harvest' }, how: 'Sold in the Ossuary during the Harvest Feast (November 1 to Thanksgiving) for 2,500 Souls.' },
  // Midwinter.
  { id: 'fairylights', name: 'Fairy Lights', style: 'fairylights', color: '#ffd23f', unlock: { cost: 2500, season: 'midwinter' }, how: 'Sold in the Ossuary during Midwinter (the day after Thanksgiving to January 6) for 2,500 Souls.' },
  { id: 'northernlights', name: 'Northern Lights', style: 'aurora', color: '#5fd3a6', unlock: { cost: 4000, season: 'midwinter' }, how: 'Sold in the Ossuary during Midwinter (the day after Thanksgiving to January 6) for 4,000 Souls.' },
  { id: 'proven', name: 'Proven', style: 'banner', color: '#f2c14e', unlock: { feat: 'trial12' }, how: 'Complete 12 Weekly Trials.' },
  { id: 'guidinglight', name: 'Guiding Light', style: 'wisps', color: '#c9f2ff', unlock: { feat: 'shepherd50' }, how: 'Have your ghost answer 50 summons from other players.' },
  { id: 'unscathed', name: 'Unscathed', style: 'shards', color: '#e8fbff', unlock: { feat: 'unscathed' }, how: 'Clear 5 floors in one run without taking damage (from floor 3).' },
  { id: 'trophyhunter', name: 'Trophy Hunter', style: 'bone', color: '#c4a046', unlock: { feat: 'hunterall' }, how: 'Master every foe in the Bestiary.' },
  // The Grave Market's auras.
  { id: 'cinderfall', name: 'Cinderfall', style: 'ember', color: '#ff6a3a', unlock: { cost: 2200, market: true }, how: "Sold in the Ossuary for 2,200 Souls, but only on the days it's today's piece." },
  { id: 'restless', name: 'Restless Spirits', style: 'wisps', color: '#9fe8ff', unlock: { cost: 2500, market: true }, how: "Sold in the Ossuary for 2,500 Souls, but only on the days it's today's piece." },
  { id: 'hundreddawns', name: 'Hundred Dawns', style: 'sunburst', color: '#ffd9a0', unlock: { feat: 'dailies100' }, how: 'Play 100 Daily Descents.' },
  // The Night Shift.
  { id: 'moonlit', name: 'Moonlit', style: 'moon', color: '#cfe0ff', unlock: { feat: 'ns25' }, how: 'Survive 25 minutes in the Night Shift.' },
  { id: 'blessedhalo', name: 'Halo of Blessings', style: 'sunburst', color: '#dcc4ff', unlock: { feat: 'nsblessed' }, how: 'Take 25 blessings in one Night Shift.' },
  { id: 'snowglobe', name: 'Snow Globe', style: 'snowglobe', color: '#c9f2ff', unlock: { cost: 3500, season: 'midwinter' }, how: 'Sold in the Ossuary during Midwinter (the day after Thanksgiving to January 6) for 3,500 Souls.' },
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

// ---------- gifts from the Crypt Keeper ----------

/** Rare sets the Crypt Keeper sends by hand from the stats dashboard: cosmetic only. */
export interface GiftDef {
  id: string;
  name: string;
  /** Why it's given, shown in the pop-up. */
  why: string;
  aura?: string;
  head?: string;
  title?: string;
}

export const GIFTS: GiftDef[] = [
  { id: 'keepersfavour', name: "Keeper's Favour", why: "A rare gift from the Crypt Keeper. It can't be earned or bought.", aura: 'keepersfavour' },
  { id: 'exterminator', name: 'Bug Exterminator', why: 'For hunting down bugs in the crypt and reporting them. Thank you!', head: 'bughelm', aura: 'bugzapper', title: 'gift:exterminator' },
  { id: 'brightidea', name: 'Bright Idea', why: 'Your idea made it into the crypt. Thank you!', aura: 'brightideas', title: 'gift:brightidea' },
];

export const GIFT_BY_ID = Object.fromEntries(GIFTS.map((g) => [g.id, g])) as Record<string, GiftDef>;

// ---------- the Grave Market ----------

export type MarketPiece = { kind: 'look' | 'head' | 'aura'; id: string; name: string; cost: number };

/** Whether a piece is only ever sold as the Grave Market's piece of the day. */
export const isMarket = (unlock: object | undefined) => Boolean(unlock && 'market' in unlock);

/** Every Grave Market piece, in the order they come round. */
export function marketPieces(): MarketPiece[] {
  return [
    ...LOOKS.filter((l) => isMarket(l.unlock)).map((l) => ({ kind: 'look' as const, id: l.id, name: l.name, cost: shopPrice(l.unlock) })),
    ...HEADS.filter((h) => isMarket(h.unlock)).map((h) => ({ kind: 'head' as const, id: h.id, name: h.name, cost: shopPrice(h.unlock) })),
    ...AURAS.filter((a) => isMarket(a.unlock)).map((a) => ({ kind: 'aura' as const, id: a.id, name: a.name, cost: 'cost' in a.unlock ? a.unlock.cost : 0 })),
  ];
}

/** Today's piece in the Grave Market: the same for everyone, a different one each day. */
export function marketPiece(dailyNo: number): MarketPiece {
  const all = marketPieces();
  // A step that shares no factor with the count visits every piece before any repeats.
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  let step = 5;
  while (gcd(step, all.length) !== 1) step++;
  return all[(((dailyNo * step) % all.length) + all.length) % all.length];
}

// ---------- together, and Soul Surge weekends ----------

/** Foes everyone together sets out to slay each month, for the Banner of the Many. */
export const COMMUNITY_GOAL = 1_000_000;

/**
 * Soul Surge: double Souls from every run on the second weekend of each month (the Saturday
 * and Sunday that fall on the 8th to 14th, Central Time).
 */
export function soulSurge(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  // the second Saturday of the month, and the Sunday after it
  return (dow === 6 && d >= 8 && d <= 14) || (dow === 0 && d >= 9 && d <= 15);
}
