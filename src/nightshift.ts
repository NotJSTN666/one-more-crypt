// The Night Shift: a survival mode. The dead come at you from every side, in real time, and
// never stop; you keep moving while your relics fight for you, and every level you pick a relic
// to add or sharpen. Bosses rise every two minutes, each tougher than the last, with attacks to
// dodge. The score is how many you put down before the night takes you.
//
// This is the simulation alone (no drawing): advance it with step(), feeding it the direction
// you're holding. Positions are in tiles. It takes its own random source, so tests can pin it.

export type FoeKind = 'ghoul' | 'bat' | 'wraith' | 'brute' | 'imp' | 'archer' | 'boneknight' | 'drowned' | 'monk' | 'boss' | 'abbot' | 'lich' | 'voideye' | 'mother';
export type BossKind = 'boss' | 'abbot' | 'lich' | 'voideye' | 'mother';
/** The late night's new dead: when each first comes, and what it does. */
export const NEW_FOES: { kind: FoeKind; at: number; name: string; text: string }[] = [
  { kind: 'archer', at: 480, name: 'Bone Archers', text: 'keep their distance and shoot' },
  { kind: 'boneknight', at: 720, name: 'Shieldbearers', text: 'march in a wall' },
  { kind: 'drowned', at: 960, name: 'Drowned Chargers', text: 'mark a line, then rush down it' },
  { kind: 'monk', at: 1200, name: 'Plague Monks', text: 'raise the dead around them. Hunt them down' },
];
/** The Night Mother rises at this time; dawn breaks at DAWN. */
export const MOTHER_AT = 1500;
export const DAWN = 1800;
/** Heroes in the Night Shift: each has a perk (with the late-night rules). */
export const NIGHT_PERKS: Record<string, string> = {
  knight: '+6 max health, and potions heal more.',
  rogue: 'The dash comes back 25% sooner.',
  necro: 'A fallen foe may rise as a wisp that fights for you.',
  paladin: 'Hits bosses 40% harder.',
  ranger: 'Starts with the Bone Quiver.',
  mage: 'Starts with the Storm Rune.',
  barbarian: 'Hits up to 40% harder as your health falls.',
  bellringer: 'Starts with the Grave Bell.',
};
/** What the Night Shrine has given (bought with Souls, kept between nights). */
export interface NightShrine { vigor?: number; reroll?: number; banish?: number; start?: RelicKind }

/**
 * A companion: a second hero who walks the night beside you, fighting in their own way. Chosen
 * before the night; level-ups now and then offer to sharpen them (up to MAX_LEVEL).
 */
export type CompanionId = 'knight' | 'rogue' | 'necro' | 'paladin' | 'ranger' | 'mage' | 'barbarian' | 'bellringer';
export const COMPANIONS: Record<CompanionId, { name: string; emoji: string; text: string; up: string }> = {
  knight: { name: 'Knight', emoji: '🛡️', text: 'Holds the line: draws the dead near them and bashes them back.', up: 'Draws them from further off, and bashes harder.' },
  rogue: { name: 'Rogue', emoji: '🗡️', text: 'Blinks to a foe and stabs it, again and again.', up: 'Quicker, deadlier stabs.' },
  necro: { name: 'Necromancer', emoji: '💀', text: 'Raises thralls from the earth to fight beside you.', up: 'More thralls, and they bite harder.' },
  paladin: { name: 'Paladin', emoji: '✝️', text: 'Smites the nearest foe, and now and then heals you.', up: 'Smites harder, and heals more often.' },
  ranger: { name: 'Ranger', emoji: '🏹', text: 'Shoots arrows at the dead from your side.', up: 'More arrows, and they pierce.' },
  mage: { name: 'Mage', emoji: '🔮', text: 'Casts seeking missiles at the dead.', up: 'More missiles, and they hit harder.' },
  barbarian: { name: 'Barbarian', emoji: '🪓', text: 'Wades in and spins, cutting everything round them.', up: 'A wider, harder spin.' },
  bellringer: { name: 'Bell-Ringer', emoji: '🔔', text: 'Rings a bell that throws back and slows the dead near them.', up: 'A louder, wider toll.' },
};
export const COMPANION_IDS = Object.keys(COMPANIONS) as CompanionId[];
/** The level-up choice that sharpens your companion. */
export const ALLY_PICK = 'ally';
export interface Ally { x: number; y: number; fx: number; level: number; next: number; actAt: number }
/** Your other helpers on the field: hounds and spectral knights (from relics), and thralls (which crumble in time). */
export interface Minion { kind: 'hound' | 'spectre' | 'thrall'; x: number; y: number; fx: number; next: number; until: number; actAt: number; dmg: number }
const MAX_THRALLS = 40;

export interface Foe {
  id: number;
  kind: FoeKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  /** Collision radius, in tiles. */
  r: number;
  xp: number;
  /** Slowed (by frost) until this time. */
  slowUntil: number;
  /** When each orbiting skull may hit this foe again. */
  skullAt: number;
  /** Knocked back (or charging): a push still to apply. */
  kx: number;
  ky: number;
  /** Just hit, for the flash. */
  hitAt: number;
  boss: boolean;
  /** A boss's next attack, and how many it has made. */
  atkAt: number;
  atkN: number;
  /** Which boss of the night this is (0 for the first), for how hard it hits. */
  tier: number;
  /** An elite's gift: armored, splitting, volatile or blinking. */
  elite?: EliteKind;
  /** An armored elite whose shell a dash has broken. */
  cracked?: boolean;
  /** A blinking elite's next jump. */
  blinkAt?: number;
  /** The Treasure Ghoul: flees, and leaves a chest if caught. */
  treasure?: boolean;
}

/** Elite foes, from level ELITE_LEVEL: tougher, glowing, and each with a gift. */
export type EliteKind = 'armored' | 'splitting' | 'volatile' | 'blinking';
export const ELITES: Record<EliteKind, { name: string; text: string; color: string }> = {
  armored: { name: 'Armored', text: 'Shrugs off most harm until a dash cracks its shell.', color: '#9aa3b5' },
  splitting: { name: 'Splitting', text: 'Bursts into three when it falls.', color: '#7ee081' },
  volatile: { name: 'Volatile', text: 'Blows up a moment after it falls. Step away.', color: '#ff8a2a' },
  blinking: { name: 'Blinking', text: 'Vanishes and reappears right beside you.', color: '#b07cff' },
};
export const ELITE_LEVEL = 55;

/** Night events: one every two minutes, a minute after each boss, from the fourth minute or so. */
export type NightEventKind = 'bloodmoon' | 'swarm' | 'fog' | 'treasure';
export const NIGHT_EVENTS: Record<NightEventKind, { name: string; emoji: string; text: string; secs: number }> = {
  bloodmoon: { name: 'Blood Moon', emoji: '🩸', text: 'The dead run faster and come thicker. Souls count double.', secs: 25 },
  swarm: { name: 'The Swarm', emoji: '🌀', text: 'They close in from every side. Break out!', secs: 15 },
  fog: { name: 'Grave Fog', emoji: '🌫️', text: 'You can barely see. Souls count half again.', secs: 20 },
  treasure: { name: 'Treasure Ghoul', emoji: '💰', text: 'A golden ghoul flees with a chest. Catch it!', secs: 20 },
};
/** The first event, and the gap between them. */
export const FIRST_EVENT = 270;
export const EVENT_EVERY = 120;

/**
 * Night Pacts, offered when a boss falls: take a curse on the night for a boon. Each can be
 * taken once; every pact also raises what the night can pay in Souls.
 */
export type PactId = 'hunger' | 'haste' | 'throng' | 'blood' | 'fangs';
export const NIGHT_PACTS: Record<PactId, { name: string; emoji: string; curse: string; boon: string }> = {
  hunger: { name: 'Pact of Hunger', emoji: '🍖', curse: 'The dead have 30% more health.', boon: 'Souls you gather count 30% more.' },
  haste: { name: 'Pact of Haste', emoji: '🐎', curse: 'The dead move 15% faster.', boon: 'Weapons come round 10% sooner.' },
  throng: { name: 'Pact of the Throng', emoji: '👥', curse: '30% more of the dead come.', boon: 'Dawn pays 30% more Souls.' },
  blood: { name: 'Pact of Blood', emoji: '🩸', curse: 'No more potions or glowcaps.', boon: 'Everything hits 20% harder.' },
  fangs: { name: 'Pact of Fangs', emoji: '🐺', curse: 'Their bites hurt 1 more.', boon: 'Your dash comes back 25% sooner and hits twice as hard.' },
};
export const PACT_IDS = Object.keys(NIGHT_PACTS) as PactId[];
/** Turning the pact down. */
export const NO_PACT = 'nopact';

/** Ascension: a fused relic, ascended with a shard a boss leaves, hits far harder and faster. */
export const ASCENDED: Record<FusionId, string> = {
  cleaver: 'Worldsplitter', halo: 'Crown of Bones', barrage: 'Bone Storm', hellwalk: 'Inferno Stride', tempest: 'Wrath of Heaven',
  glacier: 'Endless Winter', requiem: 'Doom Choir', eclipse: 'Black Sun', legion: 'Host of Souls', ossuary: 'Charnel Field', judgement: 'Last Judgement',
  barrow: 'Barrow King', wildhunt: 'Hounds of the Grave', revenant: 'Deathless Guard',
};
export const ASCEND_LEVEL = 40;
export const ASCEND_TEXT = 'Ascended: hits 75% harder and comes round 20% sooner.';
export type AscendPick = `asc:${FusionId}`;
export const isAscend = (id: string): id is AscendPick => id.startsWith('asc:');

export type Pickup = { x: number; y: number; kind: 'soul' | 'bigsoul' | 'glowcap' | 'potion' | 'forge' | 'chest' | 'shard'; v: number };

/** Your thrown things: bone darts, the scythe (which comes back) and wisps (which seek). */
export interface Dart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  pierce: number;
  life: number;
  hit: number[];
  kind: 'dart' | 'scythe' | 'wisp' | 'missile';
}
export interface Flame { x: number; y: number; until: number; r: number; dps: number }
/** A boss's bolt, flying at you. */
export interface Shot { x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number }
/**
 * A boss's lane: marked on the ground first, then it strikes everything along it. A Gravelord's
 * lane is the path of his charge.
 */
export interface Lane { x: number; y: number; ang: number; len: number; w: number; at: number; dmg: number; charge?: number; grasp?: boolean; blast?: boolean; quiet?: boolean }
/** Things to draw for a moment: a spade swing, a lightning strike, a bell's ring, spikes, a lance, a lane bursting. */
export interface Flash { kind: 'swing' | 'bolt' | 'ring' | 'spike' | 'beam' | 'lane' | 'grasp' | 'blast' | 'blink'; x: number; y: number; at: number; ang?: number; r?: number; asc?: boolean }

/** Relics in the Night Shift: weapons that fight on their own, and charms that help. */
export type RelicKind =
  | 'spade' | 'skulls' | 'quiver' | 'ember' | 'storm' | 'frost' | 'bell' | 'scythe' | 'wisps' | 'spikes' | 'lance'
  | 'totem' | 'hound' | 'spectre'
  | 'heart' | 'boots' | 'magnet' | 'fang' | 'whetstone' | 'hourglass' | 'moss' | 'thorns' | 'lens' | 'coin' | 'cloak';

export interface NightRelic {
  id: RelicKind;
  name: string;
  emoji: string;
  weapon: boolean;
  /** What each level does, for the level-up choice (index = level reached, 1-5). */
  text: (level: number) => string;
}

export const MAX_LEVEL = 5;
/** Weapons you can carry at once. */
export const MAX_WEAPONS = 6;

export const NIGHT_RELICS: NightRelic[] = [
  { id: 'spade', name: "Gravedigger's Spade", emoji: '⛏️', weapon: true, text: (l) => (l === 1 ? 'Swings at whatever is closest.' : 'A wider, harder, faster swing.') },
  { id: 'skulls', name: 'Whirling Skulls', emoji: '💀', weapon: true, text: (l) => (l === 1 ? 'Two skulls circle you, striking what they touch.' : 'One more skull, and they hit harder.') },
  { id: 'quiver', name: 'Bone Quiver', emoji: '🏹', weapon: true, text: (l) => (l === 1 ? 'Fires a bone dart at the nearest foe.' : 'More darts, and they pierce.') },
  { id: 'ember', name: 'Ember Brand', emoji: '🔥', weapon: true, text: (l) => (l === 1 ? 'You leave burning ground behind you.' : 'Hotter flames that burn for longer.') },
  { id: 'storm', name: 'Storm Rune', emoji: '⚡', weapon: true, text: (l) => (l === 1 ? 'Lightning strikes a foe near you now and then.' : 'Strikes one more foe, harder and sooner.') },
  { id: 'frost', name: 'Frost Sigil', emoji: '❄️', weapon: true, text: (l) => (l === 1 ? 'A cold that slows and bites everything close to you. The dead grow used to it as the night goes on.' : 'A wider ring that bites harder.') },
  { id: 'bell', name: 'Grave Bell', emoji: '🔔', weapon: true, text: (l) => (l === 1 ? 'Tolls now and then, throwing back everything near you.' : 'A louder toll that hits harder and more often.') },
  { id: 'scythe', name: 'Crescent Scythe', emoji: '🌙', weapon: true, text: (l) => (l === 1 ? 'A spinning blade that flies out and comes back, cutting through all in its way.' : 'More blades, and they cut deeper.') },
  { id: 'wisps', name: 'Wandering Wisps', emoji: '👻', weapon: true, text: (l) => (l === 1 ? 'Little ghosts that hunt down the dead for you.' : 'More wisps, and they bite harder.') },
  { id: 'spikes', name: 'Bone Spikes', emoji: '🦴', weapon: true, text: (l) => (l === 1 ? 'Spikes burst up under foes near you.' : 'More spikes, wider and harder.') },
  { id: 'lance', name: 'Soul Lance', emoji: '🔱', weapon: true, text: (l) => (l === 1 ? 'A beam that runs through every foe in a line.' : 'A longer beam that hits harder and more often.') },
  { id: 'totem', name: 'Thrall Totem', emoji: '🗿', weapon: true, text: (l) => (l === 1 ? 'Now and then raises thralls from the earth to fight for you a while.' : 'More thralls, lasting longer and biting harder.') },
  { id: 'hound', name: 'Crypt Hound', emoji: '🐕', weapon: true, text: (l) => (l === 1 ? 'A hound that runs down the nearest of the dead and bites.' : l === 4 ? 'A second hound joins the hunt.' : 'Faster, harder bites.') },
  { id: 'spectre', name: 'Spectral Knight', emoji: '👤', weapon: true, text: (l) => (l === 1 ? 'A ghostly knight walks with you, cutting down whatever comes close.' : l === 3 || l === 5 ? 'Another knight answers the call.' : 'Harder, quicker swings.') },
  { id: 'heart', name: 'Iron Heart', emoji: '🫀', weapon: false, text: () => '+5 max health, and heal 5.' },
  { id: 'boots', name: 'Swift Boots', emoji: '🥾', weapon: false, text: () => 'Move 8% faster.' },
  { id: 'magnet', name: 'Grave Magnet', emoji: '🧲', weapon: false, text: () => 'Pull in souls from further away.' },
  { id: 'fang', name: 'Vampire Fang', emoji: '🦷', weapon: false, text: () => 'A chance to heal 1 on each kill.' },
  { id: 'whetstone', name: 'Whetstone', emoji: '🗡️', weapon: false, text: () => 'Everything hits 12% harder.' },
  { id: 'hourglass', name: 'Stopped Hourglass', emoji: '⏳', weapon: false, text: () => 'Weapons come round 8% sooner.' },
  { id: 'moss', name: 'Grave Moss', emoji: '🍄', weapon: false, text: () => 'Slowly heal over time.' },
  { id: 'thorns', name: 'Thorn Mail', emoji: '🌵', weapon: false, text: () => 'Whatever bites you gets hurt back.' },
  { id: 'lens', name: "Seer's Lens", emoji: '🔮', weapon: false, text: () => 'A violet ring round you: your spade, bell, frost, flames and spikes all reach 15% further.' },
  { id: 'coin', name: "Reaper's Coin", emoji: '🪙', weapon: false, text: () => 'Souls count 15% more.' },
  { id: 'cloak', name: 'Shade Cloak', emoji: '🦇', weapon: false, text: () => 'Your dash comes back 10% sooner.' },
];
/**
 * The Soul Forge: a weapon at its top level fuses with its partner charm (any level) into
 * something stronger. A fusion is offered as one of the level-up choices once it's ready.
 */
export type FusionId = 'cleaver' | 'halo' | 'barrage' | 'hellwalk' | 'tempest' | 'glacier' | 'requiem' | 'eclipse' | 'legion' | 'ossuary' | 'judgement' | 'barrow' | 'wildhunt' | 'revenant';
export interface NightFusion { id: FusionId; name: string; emoji: string; weapon: RelicKind; charm: RelicKind; text: string }
export const NIGHT_FUSIONS: NightFusion[] = [
  { id: 'cleaver', name: 'Grave Cleaver', emoji: '🪓', weapon: 'spade', charm: 'lens', text: 'The spade swings all the way round, twice as hard.' },
  { id: 'halo', name: 'Bone Halo', emoji: '☠️', weapon: 'skulls', charm: 'heart', text: 'Twice the skulls on a wider orbit, hitting twice as hard.' },
  { id: 'barrage', name: 'Bone Barrage', emoji: '🎯', weapon: 'quiver', charm: 'hourglass', text: 'Darts at eight foes at once, piercing through three more.' },
  { id: 'hellwalk', name: 'Hellwalk', emoji: '🌋', weapon: 'ember', charm: 'boots', text: 'Your trail of fire burns wider, hotter and longer.' },
  { id: 'tempest', name: 'Tempest', emoji: '🌩️', weapon: 'storm', charm: 'magnet', text: 'Lightning twice as often, on twice as many, from further away.' },
  { id: 'glacier', name: 'Glacier', emoji: '🧊', weapon: 'frost', charm: 'moss', text: 'A far wider ring of cold that bites much harder.' },
  { id: 'requiem', name: 'Requiem Bell', emoji: '🛎️', weapon: 'bell', charm: 'thorns', text: 'Tolls twice as often and hits three times as hard.' },
  { id: 'eclipse', name: 'Eclipse Scythe', emoji: '🌑', weapon: 'scythe', charm: 'whetstone', text: 'Six blades at once, cutting twice as deep.' },
  { id: 'legion', name: 'Spirit Legion', emoji: '🕯️', weapon: 'wisps', charm: 'fang', text: 'Three times the wisps, and a wisp kill may heal you.' },
  { id: 'ossuary', name: 'Ossuary', emoji: '⚰️', weapon: 'spikes', charm: 'coin', text: 'Twice the spikes, wider and harder.' },
  { id: 'judgement', name: 'Judgement', emoji: '✨', weapon: 'lance', charm: 'hourglass', text: 'Four beams at once, one each way, and harder.' },
  { id: 'barrow', name: 'Barrow Host', emoji: '⚱️', weapon: 'totem', charm: 'moss', text: 'Twice the thralls, and they last twice as long.' },
  { id: 'wildhunt', name: 'The Wild Hunt', emoji: '🐺', weapon: 'hound', charm: 'boots', text: 'Three hounds, running faster and biting twice as hard.' },
  { id: 'revenant', name: 'Revenant Guard', emoji: '⚔️', weapon: 'spectre', charm: 'thorns', text: 'Twice the knights, and they cut twice as deep.' },
];
export const NIGHT_FUSION = Object.fromEntries(NIGHT_FUSIONS.map((f) => [f.id, f])) as Record<FusionId, NightFusion>;
/** The fusion a weapon became, if it did. */
export const fusionOf = (n: Night, weapon: RelicKind) => NIGHT_FUSIONS.find((f) => f.weapon === weapon && n.fused[f.id]);
/**
 * Blessings: small upgrades with no top level. They fill the level-up once there are fewer
 * than three relics left to take or sharpen, so a long night keeps getting stronger. Each one
 * is small, and the late night's dead toughen far faster, so they can't make you untouchable.
 */
export type BlessingId = 'might' | 'quickening' | 'vigor' | 'reach' | 'warding' | 'fleet' | 'greed';
export interface NightBlessing { id: BlessingId; name: string; emoji: string; text: string }
export const NIGHT_BLESSINGS: NightBlessing[] = [
  { id: 'might', name: 'Blessing of Might', emoji: '💪', text: 'Everything hits 6% harder.' },
  { id: 'quickening', name: 'Blessing of Quickening', emoji: '🌀', text: 'Weapons come round 4% sooner.' },
  { id: 'vigor', name: 'Blessing of Vigor', emoji: '❤️', text: '+4 max health, and heal 4.' },
  { id: 'reach', name: 'Blessing of Reach', emoji: '🌕', text: 'Area weapons reach 5% further.' },
  { id: 'warding', name: 'Blessing of Warding', emoji: '🛡️', text: 'Take 4% less damage.' },
  { id: 'fleet', name: 'Blessing of the Fleet', emoji: '🪶', text: 'Move 3% faster.' },
  { id: 'greed', name: 'Blessing of Greed', emoji: '💰', text: 'Souls count 5% more.' },
];
export const NIGHT_BLESSING = Object.fromEntries(NIGHT_BLESSINGS.map((b) => [b.id, b])) as Record<BlessingId, NightBlessing>;

/** A level-up choice: a relic, a fusion at the forge, a blessing, a pact (or refusing it), or an ascension. */
export type NightPick = RelicKind | FusionId | BlessingId | PactId | typeof NO_PACT | AscendPick | typeof ALLY_PICK;
export const isPact = (id: NightPick): id is PactId | typeof NO_PACT => id === NO_PACT || id in NIGHT_PACTS;
export const isFusion = (id: NightPick): id is FusionId => id in NIGHT_FUSION;
export const isBlessing = (id: NightPick): id is BlessingId => id in NIGHT_BLESSING;

export const NIGHT_RELIC = Object.fromEntries(NIGHT_RELICS.map((r) => [r.id, r])) as Record<RelicKind, NightRelic>;

/** The first boss rises at this time, then one more every BOSS_EVERY seconds. */
export const FIRST_BOSS = 90;
export const BOSS_EVERY = 120;
const BOSS_ORDER: BossKind[] = ['boss', 'abbot', 'lich'];
const BOSS_ORDER_V2: BossKind[] = ['boss', 'abbot', 'lich', 'voideye'];
export const isBoss = (k: FoeKind): k is BossKind => k === 'boss' || k === 'abbot' || k === 'lich' || k === 'voideye' || k === 'mother';
/** The field: a square of this many tiles a side. */
export const FIELD = 48;
const MAX_FOES = 260;

const STATS: Record<FoeKind, { hp: number; speed: number; dmg: number; r: number; xp: number }> = {
  ghoul: { hp: 4, speed: 1.5, dmg: 1, r: 0.35, xp: 1 },
  bat: { hp: 2, speed: 2.5, dmg: 1, r: 0.3, xp: 1 },
  wraith: { hp: 8, speed: 1.4, dmg: 2, r: 0.35, xp: 2 },
  brute: { hp: 24, speed: 1.0, dmg: 3, r: 0.55, xp: 5 },
  imp: { hp: 7, speed: 2.3, dmg: 2, r: 0.35, xp: 2 },
  boss: { hp: 450, speed: 1.3, dmg: 5, r: 1.0, xp: 50 },
  abbot: { hp: 1000, speed: 1.3, dmg: 6, r: 1.0, xp: 70 },
  lich: { hp: 1500, speed: 1.4, dmg: 7, r: 1.0, xp: 100 },
  archer: { hp: 6, speed: 1.4, dmg: 2, r: 0.35, xp: 3 },
  boneknight: { hp: 30, speed: 0.9, dmg: 3, r: 0.45, xp: 6 },
  drowned: { hp: 14, speed: 1.2, dmg: 3, r: 0.45, xp: 4 },
  monk: { hp: 20, speed: 1.0, dmg: 2, r: 0.4, xp: 8 },
  voideye: { hp: 2000, speed: 1.2, dmg: 7, r: 1.0, xp: 120 },
  mother: { hp: 2600, speed: 1.15, dmg: 8, r: 1.3, xp: 300 },
};

export interface Night {
  t: number;
  x: number;
  y: number;
  /** Which way you last moved. */
  fx: number;
  fy: number;
  hp: number;
  maxHp: number;
  hurtUntil: number;
  /** The dash: when it can be used again, and when the one under way ends (you can't be hit till then). */
  dashReady: number;
  dashUntil: number;
  /** Foes already struck by the dash under way. */
  dashHit: number[];
  /** Weapons fused at the Soul Forge. */
  fused: Partial<Record<FusionId, boolean>>;
  /** Where you last were when you moved a fair way, and when: stand too long and the dead claw up from below. */
  anchorX: number;
  anchorY: number;
  anchorT: number;
  graspAt: number;
  /** Graves that have clawed at you this night (the first comes with a warning). */
  grasps: number;
  level: number;
  xp: number;
  /** Levels waiting to be chosen. */
  pendingLevels: number;
  /** Of those, how many are the Soul Forge's (from a forge ember a boss dropped). */
  forgeOffers: number;
  /** When the last healing potion dropped, so they stay rare however fast the dead fall. */
  potionAt: number;
  /** Potions drunk this night. */
  potions: number;
  /** When you were first hit this night (-1 if not yet). */
  firstHitAt: number;
  /** The kinds of boss felled this night. */
  felledKinds: string[];
  relics: Partial<Record<RelicKind, number>>;
  /** Blessings taken, each as many times as you like. */
  blessings: Partial<Record<BlessingId, number>>;
  foes: Foe[];
  pickups: Pickup[];
  darts: Dart[];
  flames: Flame[];
  shots: Shot[];
  lanes: Lane[];
  flashes: Flash[];
  kills: number;
  bossKills: number;
  /** Next time each weapon fires. */
  next: Partial<Record<RelicKind, number>>;
  nextId: number;
  spawnDebt: number;
  bossesRisen: number;
  over: boolean;
  rand: () => number;
  /** The late-night rules (events, elites, pacts and ascension). */
  v2: boolean;
  /** The event under way, and when the next begins. */
  event: { kind: NightEventKind; at: number; until: number } | null;
  nextEventAt: number;
  lastEvent: NightEventKind | '';
  /** Events lived through this night. */
  events: number;
  pacts: Partial<Record<PactId, boolean>>;
  pactOffers: number;
  ascended: Partial<Record<FusionId, boolean>>;
  ascendOffers: number;
  /** Elites put down, and treasure chests opened. */
  eliteKills: number;
  chests: number;
  /** The hero, for their perk. */
  hero: string;
  /** Rerolls and banishes left this night, relics banished, and levels skipped. */
  rerolls: number;
  banishes: number;
  banished: RelicKind[];
  /** Dawn: offered (the night waits on the choice), greeted, and the Nightmare after. */
  dawnOffer: boolean;
  dawn: boolean;
  nightmare: boolean;
  motherRisen: boolean;
  motherFelled: boolean;
  /** Your companion (none if ''), where they are, and your other helpers. */
  companion: CompanionId | '';
  ally: Ally | null;
  minions: Minion[];
  /** Recent kills and hits, for the drawing (kept short). */
  deaths: { x: number; y: number; kind: FoeKind; at: number }[];
  hits: { x: number; y: number; amt: number; at: number }[];
}

export function newNight(rand: () => number = Math.random, v2 = true, opts: { hero?: string; shrine?: NightShrine; companion?: string } = {}): Night {
  const n = baseNight(rand, v2);
  if (!v2) return n;
  const hero = opts.hero ?? '';
  const sh = opts.shrine ?? {};
  n.hero = hero;
  n.maxHp += 4 * Math.min(5, sh.vigor ?? 0) + (hero === 'knight' ? 6 : 0);
  n.hp = n.maxHp;
  n.rerolls = Math.min(3, sh.reroll ?? 0);
  n.banishes = Math.min(3, sh.banish ?? 0);
  const start: Partial<Record<string, RelicKind>> = { ranger: 'quiver', mage: 'storm', bellringer: 'bell' };
  const s = start[hero];
  if (s) n.relics[s] = 1;
  if (sh.start && sh.start !== 'spade' && NIGHT_RELIC[sh.start]?.weapon) n.relics[sh.start] = Math.max(1, n.relics[sh.start] ?? 0);
  if (opts.companion && opts.companion in COMPANIONS) {
    n.companion = opts.companion as CompanionId;
    n.ally = { x: n.x - 1.2, y: n.y + 0.6, fx: 1, level: 1, next: 0, actAt: -1 };
  }
  return n;
}

function baseNight(rand: () => number, v2: boolean): Night {
  return {
    t: 0,
    x: FIELD / 2,
    y: FIELD / 2,
    fx: 1,
    fy: 0,
    hp: 20,
    maxHp: 20,
    hurtUntil: 0,
    dashReady: 0,
    dashUntil: 0,
    dashHit: [],
    fused: {},
    anchorX: FIELD / 2,
    anchorY: FIELD / 2,
    anchorT: 0,
    graspAt: 0,
    grasps: 0,
    level: 1,
    xp: 0,
    pendingLevels: 0,
    forgeOffers: 0,
    potionAt: 0,
    potions: 0,
    firstHitAt: -1,
    felledKinds: [],
    relics: { spade: 1 },
    blessings: {},
    foes: [],
    pickups: [],
    darts: [],
    flames: [],
    shots: [],
    lanes: [],
    flashes: [],
    kills: 0,
    bossKills: 0,
    next: {},
    nextId: 1,
    spawnDebt: 0,
    bossesRisen: 0,
    over: false,
    rand,
    v2,
    event: null,
    nextEventAt: FIRST_EVENT,
    lastEvent: '',
    events: 0,
    pacts: {},
    pactOffers: 0,
    ascended: {},
    ascendOffers: 0,
    eliteKills: 0,
    chests: 0,
    hero: 'knight',
    rerolls: 0,
    banishes: 0,
    banished: [],
    dawnOffer: false,
    dawn: false,
    nightmare: false,
    motherRisen: false,
    motherFelled: false,
    companion: '',
    ally: null,
    minions: [],
    deaths: [],
    hits: [],
  };
}

const lv = (n: Night, r: RelicKind) => n.relics[r] ?? 0;
/** Souls needed to go from this level to the next. */
export const xpToLevel = (level: number) => 2 + level * 2 + Math.floor((level * level) / 10);
/** How many times a blessing has been taken. */
export const bl = (n: Night, b: BlessingId) => n.blessings?.[b] ?? 0;
const dmgMul = (n: Night) => (1 + 0.12 * lv(n, 'whetstone')) * (1 + 0.06 * bl(n, 'might')) * (n.pacts?.blood ? 1.2 : 1) * (n.hero === 'barbarian' ? 1 + 0.4 * (1 - Math.max(0, n.hp) / n.maxHp) : 1);
// Quickening and warding shrink by a share each time, so they never reach nothing.
const cdMul = (n: Night) => (1 - 0.08 * lv(n, 'hourglass')) * 0.96 ** bl(n, 'quickening') * (n.pacts?.haste ? 0.9 : 1);
/** A weapon whose fusion has ascended: how much harder it hits, and how much sooner it comes round. */
const ascOf = (n: Night, r: RelicKind) => {
  const f = fusionOf(n, r);
  return Boolean(f && n.ascended?.[f.id]);
};
const pw = (n: Night, r: RelicKind) => (ascOf(n, r) ? 1.75 : 1);
/** Whether a weapon has ascended, for drawing it in gold. */
export const ascendedWeapon = (n: Night, r: RelicKind) => ascOf(n, r);
/** What's left of a hit after the Blessing of Warding. */
export const wardMul = (n: Night) => 0.96 ** bl(n, 'warding');
/** How far the Seer's Lens (and the Blessing of Reach) stretch every area weapon. */
export const area = (n: Night) => (1 + 0.15 * lv(n, 'lens')) * (1 + 0.05 * bl(n, 'reach'));
/** How far the spade's swing reaches. */
export const spadeReach = (n: Night) => (1.5 + 0.2 * lv(n, 'spade')) * area(n);
export const pickupRadius = (n: Night) => 1.3 + 1.2 * lv(n, 'magnet');
// The fleet blessing stops adding past +60%, so you can still steer.
export const playerSpeed = (n: Night) => 4 * (1 + 0.08 * lv(n, 'boots')) * (1 + Math.min(0.6, 0.03 * bl(n, 'fleet')));
export const skullCount = (n: Night) => (lv(n, 'skulls') ? (1 + lv(n, 'skulls')) * (n.fused.halo ? 2 : 1) : 0);
/** How far the skulls circle. */
export const skullOrbit = (n: Night) => (n.fused.halo ? 2.2 : 1.6);
export const frostRadius = (n: Night) => (lv(n, 'frost') ? (1.5 + 0.2 * lv(n, 'frost')) * area(n) * (n.fused.glacier ? 1.5 : 1) : 0);
/**
 * How much the Frost Sigil slows a foe (0 to 1): less than it used to, half on brutes and
 * bosses, and the dead shrug it off as the night goes on, so standing still in it never lasts.
 */
export function frostSlow(n: Night, f: Foe): number {
  const base = 0.15 + 0.03 * lv(n, 'frost');
  const hardy = f.boss || f.kind === 'brute' ? 0.5 : 1;
  const used = Math.max(0.35, 1 - n.t / 600);
  return base * hardy * used;
}
export const PLAYER_R = 0.35;
/** When the next boss rises. */
export const nextBossAt = (n: Night) => FIRST_BOSS + n.bossesRisen * BOSS_EVERY;

const readyFusions = (n: Night) => NIGHT_FUSIONS.filter((f) => !n.fused[f.id] && lv(n, f.weapon) >= MAX_LEVEL && lv(n, f.charm) > 0);

/** Three choices for a level-up: relics you can still add or sharpen. */
export function levelChoices(n: Night): NightPick[] {
  if (n.pactOffers > 0) return pactChoices(n);
  if (n.ascendOffers > 0) return ascendChoices(n);
  if (n.forgeOffers > 0) return forgeChoices(n);
  // A fusion ready at the forge is always offered first.
  const ready = readyFusions(n);
  const forge: NightPick[] = ready.length ? [ready[Math.floor(n.rand() * ready.length)].id] : [];
  return [...forge, ...relicChoices(n)].slice(0, 3);
}

/** A boss has fallen: two pacts you haven't taken, and turning them down. */
function pactChoices(n: Night): NightPick[] {
  const open = PACT_IDS.filter((id) => !n.pacts[id]);
  const out: NightPick[] = [];
  while (out.length < 2 && open.length) out.push(open.splice(Math.floor(n.rand() * open.length), 1)[0]);
  return [...out, NO_PACT];
}

/** A shard picked up: the fused relics that can still ascend (up to three). */
function ascendChoices(n: Night): NightPick[] {
  const open = NIGHT_FUSIONS.filter((f) => n.fused[f.id] && !n.ascended[f.id]).map((f) => `asc:${f.id}` as AscendPick);
  const out: NightPick[] = [];
  while (out.length < 3 && open.length) out.push(open.splice(Math.floor(n.rand() * open.length), 1)[0]);
  return out;
}

/**
 * A forge ember picked up: every fusion that's ready, and if that's fewer than three, a free
 * level for weapons you carry. With nothing to forge or sharpen, the usual choices.
 */
function forgeChoices(n: Night): NightPick[] {
  const out: NightPick[] = readyFusions(n).map((f) => f.id);
  const arms = NIGHT_RELICS.filter((r) => r.weapon && lv(n, r.id) > 0 && lv(n, r.id) < MAX_LEVEL).map((r) => r.id);
  while (out.length < 3 && arms.length) out.push(arms.splice(Math.floor(n.rand() * arms.length), 1)[0]);
  if (out.length) return out.slice(0, 3);
  return relicChoices(n);
}

function relicChoices(n: Night): NightPick[] {
  const weapons = NIGHT_RELICS.filter((r) => r.weapon && lv(n, r.id) > 0).length;
  const open = NIGHT_RELICS.filter((r) => !n.banished?.includes(r.id) && lv(n, r.id) < MAX_LEVEL && (lv(n, r.id) > 0 || !r.weapon || weapons < MAX_WEAPONS));
  const out: NightPick[] = [];
  const pool = [...open];
  // With only the spade in hand, one choice is always a new weapon.
  if (weapons < 2) {
    const arms = pool.filter((r) => r.weapon && !lv(n, r.id));
    if (arms.length) {
      const r = arms[Math.floor(n.rand() * arms.length)];
      out.push(r.id);
      pool.splice(pool.indexOf(r), 1);
    }
  }
  // Now and then, one choice sharpens your companion.
  if (n.ally && n.ally.level < MAX_LEVEL && out.length < 3 && n.rand() < 0.3) out.push(ALLY_PICK);
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(n.rand() * pool.length), 1)[0].id);
  // Running out of relics: blessings fill the rest, so there's always something to take.
  const blessings = [...NIGHT_BLESSINGS];
  while (out.length < 3) out.push(blessings.splice(Math.floor(n.rand() * blessings.length), 1)[0].id);
  return out;
}

/** Whether the choice on offer is an ordinary level (where reroll, banish and skip work). */
export const plainLevel = (n: Night) => n.pendingLevels > 0 && !n.pactOffers && !n.ascendOffers && !n.forgeOffers;

/** Spend a reroll: fresh choices for this level. */
export function reroll(n: Night): NightPick[] | null {
  if (!plainLevel(n) || n.rerolls <= 0) return null;
  n.rerolls--;
  return levelChoices(n);
}

/** Banish a relic for the rest of the night: it never comes up again. */
export function banish(n: Night, id: NightPick): NightPick[] | null {
  if (!plainLevel(n) || n.banishes <= 0 || !(id in NIGHT_RELIC) || lv(n, id as RelicKind) > 0) return null;
  n.banishes--;
  n.banished.push(id as RelicKind);
  return levelChoices(n);
}

/** Skip a level: a little health instead. */
export function skipLevel(n: Night) {
  if (!plainLevel(n)) return;
  n.pendingLevels--;
  n.hp = Math.min(n.maxHp, n.hp + 3);
}

/** Dawn's choice: end the night in triumph, or walk on into the Nightmare. */
export function chooseDawn(n: Night, nightmare: boolean) {
  if (!n.dawnOffer) return;
  n.dawnOffer = false;
  n.dawn = true;
  if (nightmare) n.nightmare = true;
  else n.over = true;
}

/** Take a relic (or its next level) for a waiting level. */
export function chooseRelic(n: Night, id: NightPick) {
  if (n.pendingLevels <= 0) return;
  if (n.pactOffers > 0) {
    if (!isPact(id)) return;
    if (id !== NO_PACT) n.pacts[id] = true;
    n.pactOffers--;
    n.pendingLevels--;
    return;
  }
  if (n.ascendOffers > 0) {
    if (!isAscend(id)) return;
    const f = id.slice(4) as FusionId;
    if (!n.fused[f] || n.ascended[f]) return;
    n.ascended[f] = true;
    n.ascendOffers--;
    n.pendingLevels--;
    return;
  }
  if (isPact(id) || isAscend(id)) return;
  if (id === ALLY_PICK) {
    if (!n.ally || n.ally.level >= MAX_LEVEL) return;
    n.ally.level++;
    n.pendingLevels--;
    if (n.forgeOffers > 0) n.forgeOffers--;
    return;
  }
  if (isBlessing(id)) {
    n.blessings[id] = bl(n, id) + 1;
    n.pendingLevels--;
    if (n.forgeOffers > 0) n.forgeOffers--;
    if (id === 'vigor') {
      n.maxHp += 4;
      n.hp = Math.min(n.maxHp, n.hp + 4);
    }
    return;
  }
  if (isFusion(id)) {
    if (n.fused[id]) return;
    n.fused[id] = true;
    n.pendingLevels--;
    if (n.forgeOffers > 0) n.forgeOffers--;
    return;
  }
  if (lv(n, id) >= MAX_LEVEL) return;
  n.relics[id] = lv(n, id) + 1;
  n.pendingLevels--;
  if (n.forgeOffers > 0) n.forgeOffers--;
  if (id === 'heart') {
    n.maxHp += 5;
    n.hp = Math.min(n.maxHp, n.hp + 5);
  }
}

/**
 * Somewhere just beyond what you can see, inside the field: on any side, but more often the
 * way you're heading, so running away only runs into more of them.
 */
function edgeSpot(n: Night): { x: number; y: number } {
  const ahead = n.rand() < 0.5;
  const ang = ahead ? Math.atan2(n.fy, n.fx) + (n.rand() - 0.5) * Math.PI * 1.2 : n.rand() * Math.PI * 2;
  const d = 9 + n.rand() * 3;
  return { x: Math.max(1, Math.min(FIELD - 1, n.x + Math.cos(ang) * d)), y: Math.max(1, Math.min(FIELD - 1, n.y + Math.sin(ang) * d)) };
}

function spawn(n: Night, kind: FoeKind, at?: { x: number; y: number }, elite?: EliteKind | 'treasure') {
  const s = STATS[kind];
  const { x, y } = at ?? edgeSpot(n);
  const boss = isBoss(kind);
  // They grow tougher as the night wears on; each boss is tougher than the one before, and
  // the first goes easier, since you're still finding your feet.
  const tier = n.bossesRisen;
  // Past ten minutes the dead harden every minute, so even a finished build can't stand forever.
  const late = lateNight(n);
  const nm = n.nightmare ? 1.5 : 1;
  const hp = Math.round(s.hp * (boss ? (tier === 0 ? 0.65 : 1 + 0.7 * tier) : 1 + n.t / 120 + (n.t / 300) ** 2) * LATE_HP ** late * nm);
  const dmg = s.dmg + Math.floor(n.t / (boss ? 240 : 180)) - (boss && tier === 0 ? 2 : 0) + Math.floor(late / 1.5) + (n.nightmare ? 2 : 0);
  // Pacts: hungrier, faster, harder-biting dead.
  const hunger = !boss && n.pacts?.hunger ? 1.3 : 1;
  const haste = !boss && n.pacts?.haste ? 1.15 : 1;
  const fangs = n.pacts?.fangs ? 1 : 0;
  const f: Foe = {
    id: n.nextId++, kind, x, y, hp: hp * hunger, maxHp: hp * hunger, speed: s.speed * (boss ? 1 + 0.05 * n.bossesRisen : 1 + Math.min(0.6, 0.06 * late)) * haste, dmg: dmg + fangs, r: s.r, xp: s.xp,
    slowUntil: 0, skullAt: 0, kx: 0, ky: 0, hitAt: -1, boss, atkAt: n.t + (tier === 0 ? 4 : 2.5), atkN: 0, tier,
  };
  // the new dead act on a timer of their own
  if (kind === 'archer' || kind === 'drowned' || kind === 'monk') f.atkAt = n.t + 2 + n.rand() * 2;
  if (elite === 'treasure') {
    // Golden, quick and tough, and it runs.
    f.treasure = true;
    f.hp = f.maxHp = Math.round(60 * (1 + n.t / 120));
    f.r = 0.45;
    f.xp = 25;
  } else if (elite) {
    f.elite = elite;
    f.hp = f.maxHp = f.hp * 4;
    f.r *= 1.3;
    f.xp *= 5;
    f.dmg += 1;
    if (elite === 'blinking') f.blinkAt = n.t + 2 + n.rand() * 2;
  }
  n.foes.push(f);
}

/** From ELITE_LEVEL, a share of the dead come as elites, more as the levels climb. */
function eliteRoll(n: Night): EliteKind | undefined {
  if (!n.v2 || n.level < ELITE_LEVEL) return undefined;
  if (n.rand() >= Math.min(0.12, 0.03 + (n.level - ELITE_LEVEL) * 0.002)) return undefined;
  const kinds: EliteKind[] = ['armored', 'splitting', 'volatile', 'blinking'];
  return kinds[Math.floor(n.rand() * kinds.length)];
}

/** Minutes past the tenth: how far into the late night it is (0 before). */
export const lateNight = (n: Night) => Math.max(0, (n.t - 600) / 60);
/** How much tougher the dead get with each late minute. */
const LATE_HP = 1.25;

/** Which of the dead come at this point in the night. */
function pickKind(n: Night): FoeKind {
  const t = n.t;
  const table: [FoeKind, number][] = [
    ['ghoul', 10],
    ['bat', t > 20 ? 6 : 0],
    ['wraith', t > 75 ? 4 : 0],
    ['brute', t > 150 ? 2 + t / 200 : 0],
    ['imp', t > 240 ? 4 : 0],
    ['archer', n.v2 && t > 480 ? 3 : 0],
    ['drowned', n.v2 && t > 960 ? 2 : 0],
    ['monk', n.v2 && t > 1200 ? 0.6 : 0],
  ];
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = n.rand() * total;
  for (const [k, w] of table) if ((r -= w) < 0) return k;
  return 'ghoul';
}

function hurtFoe(n: Night, f: Foe, amount: number, dashHit = false) {
  if (f.hp <= 0) return;
  // An armored elite's shell turns most harm aside, until a dash cracks it.
  if (f.elite === 'armored' && !f.cracked) {
    if (dashHit) f.cracked = true;
    else amount *= 0.25;
  }
  const dealt = amount * dmgMul(n) * (f.boss && n.hero === 'paladin' && n.v2 ? 1.4 : 1);
  f.hp -= dealt;
  f.hitAt = n.t;
  if (dealt >= 1) {
    n.hits.push({ x: f.x, y: f.y, amt: Math.round(dealt), at: n.t });
    if (n.hits.length > 40) n.hits.splice(0, n.hits.length - 40);
  }
  if (f.hp <= 0) {
    n.kills++;
    n.deaths.push({ x: f.x, y: f.y, kind: f.kind, at: n.t });
    if (n.deaths.length > 60) n.deaths.splice(0, n.deaths.length - 60);
    if (f.kind === 'mother') n.motherFelled = true;
    // the Necromancer's dead may rise again on your side, as a wisp
    if (n.hero === 'necro' && n.v2 && !f.boss && n.rand() < 0.05) {
      const a = n.rand() * Math.PI * 2;
      n.darts.push({ x: f.x, y: f.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, dmg: 6 + n.t / 60, pierce: 1, life: 3, hit: [], kind: 'wisp' });
    }
    n.pickups.push({ x: f.x, y: f.y, kind: f.xp >= 5 ? 'bigsoul' : 'soul', v: f.xp });
    const healing = !n.pacts?.blood;
    if (f.boss) {
      n.bossKills++;
      if (!n.felledKinds.includes(f.kind)) n.felledKinds.push(f.kind);
      if (n.v2) {
        // A pact to weigh, while any are left untaken.
        if (PACT_IDS.some((id) => !n.pacts[id])) {
          n.pactOffers++;
          n.pendingLevels++;
        }
        // A shard to ascend a fused relic, once there's one to ascend.
        if (n.level >= ASCEND_LEVEL && NIGHT_FUSIONS.some((x) => n.fused[x.id] && !n.ascended[x.id])) n.pickups.push({ x: f.x, y: f.y + 0.7, kind: 'shard', v: 1 });
      }
    }
    if (f.treasure) {
      n.pickups.push({ x: f.x, y: f.y, kind: 'chest', v: 1 });
    } else if (f.elite) {
      n.eliteKills++;
      if (f.elite === 'splitting') for (let k = 0; k < 3; k++) spawn(n, 'ghoul', { x: f.x + Math.cos(k * 2.1) * 0.6, y: f.y + Math.sin(k * 2.1) * 0.6 });
      if (f.elite === 'volatile') n.lanes.push({ x: f.x, y: f.y, ang: 0, len: 0, w: 1.7, at: n.t + 0.9, dmg: f.dmg + 2, blast: true });
      if (healing && n.rand() < 0.2) n.pickups.push({ x: f.x, y: f.y + 0.3, kind: 'glowcap', v: 5 });
    }
    if (f.boss) {
      // a boss leaves a healing potion and an ember from the Soul Forge
      if (healing) n.pickups.push({ x: f.x + 0.6, y: f.y, kind: 'potion', v: 1 });
      n.pickups.push({ x: f.x - 0.6, y: f.y, kind: 'forge', v: 1 });
    } else if (!healing) {
      // no potions or glowcaps under the Pact of Blood
    } else if (n.rand() < 0.012) n.pickups.push({ x: f.x, y: f.y + 0.3, kind: 'glowcap', v: 5 });
    else if (n.t - n.potionAt > POTION_GAP && n.rand() < 0.006) {
      n.potionAt = n.t;
      n.pickups.push({ x: f.x, y: f.y + 0.3, kind: 'potion', v: 1 });
    }
    if (lv(n, 'fang') && n.rand() < 0.05 * lv(n, 'fang')) n.hp = Math.min(n.maxHp, n.hp + 1);
  }
}

/** You take a hit, unless you've just been hit. */
function hurtYou(n: Night, dmg: number, from?: Foe) {
  if (n.t < n.hurtUntil || n.t < n.dashUntil) return;
  if (n.firstHitAt < 0) n.firstHitAt = n.t;
  n.hp -= dmg * wardMul(n);
  n.hurtUntil = n.t + 0.75;
  if (from && lv(n, 'thorns')) hurtFoe(n, from, 5 * lv(n, 'thorns'));
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** How far a point lies from a lane's line. */
export function laneDist(l: Lane, x: number, y: number): number {
  const ux = Math.cos(l.ang);
  const uy = Math.sin(l.ang);
  const along = Math.max(0, Math.min(l.len, (x - l.x) * ux + (y - l.y) * uy));
  return Math.hypot(x - (l.x + ux * along), y - (l.y + uy * along));
}

/** The dead shoulder each other aside rather than piling into one heap. */
function shoulder(n: Night) {
  const grid = new Map<number, Foe[]>();
  const cell = (x: number, y: number) => Math.floor(x) * 64 + Math.floor(y);
  for (const f of n.foes) {
    const k = cell(f.x, f.y);
    const list = grid.get(k);
    if (list) list.push(f);
    else grid.set(k, [f]);
  }
  for (const f of n.foes) {
    const cx = Math.floor(f.x);
    const cy = Math.floor(f.y);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const o of grid.get(gx * 64 + gy) ?? []) {
          if (o.id <= f.id) continue;
          const dx = o.x - f.x;
          const dy = o.y - f.y;
          const d = Math.hypot(dx, dy);
          const min = (o.r + f.r) * 0.85;
          if (d >= min || d === 0) continue;
          // the bigger one gives less ground
          const push = (min - d) / 2 / d;
          const wf = f.boss ? 0.1 : o.boss ? 1.9 : 1;
          const wo = 2 - wf;
          f.x -= dx * push * wf;
          f.y -= dy * push * wf;
          o.x += dx * push * wo;
          o.y += dy * push * wo;
        }
      }
    }
  }
}

/** A ring (or fan) of bolts from a point. */
function volley(n: Night, from: { x: number; y: number }, dmg: number, count: number, speed: number, aim: number | null, spread = Math.PI * 2) {
  for (let k = 0; k < count; k++) {
    const a = aim === null ? (k / count) * Math.PI * 2 : aim + (count > 1 ? (k / (count - 1) - 0.5) * spread : 0);
    n.shots.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 0.28, dmg, life: 6 });
  }
}

/**
 * The bosses' attacks. The Gravelord marks a lane and charges down it, throwing bolts where he
 * stops; the Drowned Abbot fires fans and rings of bolts; the Lich marks three lanes that burst
 * a moment later, and sometimes spins out a spiral. Each boss to rise attacks a little faster.
 */
function bossAttack(n: Night, f: Foe) {
  if (n.t < f.atkAt) return;
  const aim = Math.atan2(n.y - f.y, n.x - f.x);
  const bolt = Math.max(2, f.dmg - 1);
  // how fierce: the first boss gently, the rest as before (one step per boss risen)
  const k = f.tier === 0 ? 0 : f.tier + 1;
  if (f.kind === 'boss') {
    const len = Math.min(10, Math.hypot(n.x - f.x, n.y - f.y) + 3);
    // the first Gravelord marks his charge longer, so there's time to step aside
    n.lanes.push({ x: f.x, y: f.y, ang: aim, len, w: f.r, at: n.t + (k === 0 ? 1.3 : 0.9), dmg: f.dmg + 1, charge: f.id });
    f.atkAt = n.t + (k === 0 ? 5 : Math.max(2.6, 4 - 0.15 * k));
  } else if (f.kind === 'abbot') {
    // Spaced so there's always room to slip between the bolts: a ring with gaps wider than you,
    // and a fan spread wide enough to step into one of its gaps.
    if (f.atkN % 3 === 2) volley(n, f, bolt, 11 + k, 3.1, null);
    else volley(n, f, bolt, 5, 3.8, aim, 1.4);
    f.atkAt = n.t + Math.max(1.5, 2.6 - 0.1 * k);
  } else if (f.kind === 'voideye') {
    // The Void Eye: a turning cross of lanes, then a ring that closes the gaps.
    if (f.atkN % 2 === 0) {
      const off = f.atkN * 0.4;
      for (let q = 0; q < 4; q++) n.lanes.push({ x: f.x, y: f.y, ang: off + (q * Math.PI) / 2, len: 13, w: 0.55, at: n.t + 0.9, dmg: f.dmg });
    } else volley(n, f, bolt, 14 + k, 3.0, null);
    f.atkAt = n.t + Math.max(1.8, 2.6 - 0.08 * k);
  } else if (f.kind === 'mother') {
    // The Night Mother: three moods as she weakens. Fans and lanes; then the dead and spirals;
    // then all of it, faster.
    const phase = f.hp > f.maxHp * 0.66 ? 0 : f.hp > f.maxHp * 0.33 ? 1 : 2;
    const m = f.atkN % 3;
    if (phase === 0 || (phase === 2 && m === 0)) {
      volley(n, f, bolt, 7, 3.6, aim, 1.6);
      for (const o of [-0.6, 0.6]) n.lanes.push({ x: f.x, y: f.y, ang: aim + o, len: 14, w: 0.55, at: n.t + 0.9, dmg: f.dmg });
    } else if (phase === 1 || m === 1) {
      for (let q = 0; q < 6 && n.foes.length < MAX_FOES; q++) {
        const a = (q / 6) * Math.PI * 2;
        spawn(n, q % 2 ? 'wraith' : 'ghoul', { x: Math.max(1, Math.min(FIELD - 1, f.x + Math.cos(a) * 2)), y: Math.max(1, Math.min(FIELD - 1, f.y + Math.sin(a) * 2)) });
      }
      for (let q = 0; q < 18; q++) {
        const a = aim + q * 0.6;
        const back = q * 0.08;
        n.shots.push({ x: f.x - Math.cos(a) * back * 3.2, y: f.y - Math.sin(a) * back * 3.2, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, r: 0.28, dmg: bolt, life: 6 + back });
      }
    } else volley(n, f, bolt, 16, 3.3, null);
    f.atkAt = n.t + (phase === 2 ? 1.6 : 2.4);
  } else {
    if (f.atkN % 4 === 3) {
      // a spiral, poured out over two seconds
      for (let s = 0; s < 24; s++) {
        const a = aim + s * 0.55;
        const back = s * 0.09;
        n.shots.push({ x: f.x - Math.cos(a) * back * 3.4, y: f.y - Math.sin(a) * back * 3.4, vx: Math.cos(a) * 3.4, vy: Math.sin(a) * 3.4, r: 0.28, dmg: bolt, life: 6 + back });
      }
    } else {
      const later = Math.max(0.65, 1 - 0.05 * k);
      for (const off of [-0.45, 0, 0.45]) n.lanes.push({ x: f.x, y: f.y, ang: aim + off, len: 14, w: 0.55, at: n.t + later, dmg: f.dmg });
    }
    f.atkAt = n.t + Math.max(1.8, 2.8 - 0.1 * k);
  }
  f.atkN++;
}

/** The late night's new dead: archers shoot, chargers mark a line and rush, monks raise the dead. */
function foeAct(n: Night, f: Foe, d: number) {
  if (n.t < f.atkAt) return;
  const aim = Math.atan2(n.y - f.y, n.x - f.x);
  if (f.kind === 'archer') {
    if (d < 8) n.shots.push({ x: f.x, y: f.y, vx: Math.cos(aim) * 4.2, vy: Math.sin(aim) * 4.2, r: 0.22, dmg: f.dmg, life: 3 });
    f.atkAt = n.t + 2.6 + n.rand();
  } else if (f.kind === 'drowned') {
    if (d < 6) {
      n.lanes.push({ x: f.x, y: f.y, ang: aim, len: Math.min(7, d + 2), w: f.r, at: n.t + 0.8, dmg: f.dmg + 1, charge: f.id });
      f.atkAt = n.t + 5 + n.rand() * 2;
    } else f.atkAt = n.t + 0.5;
  } else if (f.kind === 'monk') {
    for (let k = 0; k < 3 && n.foes.length < MAX_FOES; k++) {
      const a = n.rand() * Math.PI * 2;
      spawn(n, 'ghoul', { x: Math.max(1, Math.min(FIELD - 1, f.x + Math.cos(a) * 1.2)), y: Math.max(1, Math.min(FIELD - 1, f.y + Math.sin(a) * 1.2)) });
    }
    n.flashes.push({ kind: 'grasp', x: f.x, y: f.y, at: n.t, r: 1.4 });
    f.atkAt = n.t + 6;
  }
  f.atkN++;
}

/** Stay within this many tiles for GRASP_AFTER seconds and the dead claw up at you. */
const GRASP_ROAM = 2;
export const GRASP_AFTER = 4;

/** The dash: how long it lasts, how much faster than walking, and how long until the next. */
export const DASH_TIME = 0.2;
const DASH_BURST = 4.5;
export const DASH_COOLDOWN = 2.5;
/** The dash's wait, shortened by the Shade Cloak. */
export const dashCooldown = (n: Night) => DASH_COOLDOWN * (1 - 0.1 * lv(n, 'cloak')) * (n.pacts?.fangs ? 0.75 : 1) * (n.hero === 'rogue' && n.v2 ? 0.75 : 1);
/** A healing potion mends this share of your max health. */
export const POTION_HEAL = 0.3;
/** At most one potion from the ordinary dead in this many seconds. */
const POTION_GAP = 25;

/** What the dash does to each foe it hits: more as the night (and the dead) get tougher. */
export const dashDamage = (n: Night) => (8 + n.t / 10) * dmgMul(n) * (n.pacts?.fangs ? 2 : 1);

/** Dash the way you're facing, if it's ready: a quick burst you can't be hurt during. */
export function dash(n: Night, dx = 0, dy = 0): boolean {
  if (n.over || n.pendingLevels > 0 || n.t < n.dashReady) return false;
  const len = Math.hypot(dx, dy);
  if (len > 0.1) {
    n.fx = dx / len;
    n.fy = dy / len;
  }
  n.dashUntil = n.t + DASH_TIME;
  n.dashReady = n.t + dashCooldown(n);
  n.dashHit = [];
  return true;
}

/** Advance the night by dt seconds, with (dx, dy) the direction held (any length; 0 to stand). */
export function step(n: Night, dt: number, dx: number, dy: number) {
  if (n.over || n.pendingLevels > 0 || n.dawnOffer) return;
  n.t += dt;
  // Dawn: the night waits while you choose.
  if (n.v2 && !n.dawn && n.t >= DAWN) {
    n.dawnOffer = true;
    return;
  }

  // ---- you ----
  const len = Math.hypot(dx, dy);
  if (n.t < n.dashUntil) {
    // mid-dash: a burst the way you were facing, through anything
    const sp = playerSpeed(n) * DASH_BURST * dt;
    n.x = Math.max(0.5, Math.min(FIELD - 0.5, n.x + n.fx * sp));
    n.y = Math.max(0.5, Math.min(FIELD - 0.5, n.y + n.fy * sp));
    // Ploughing through the dead: each one in the way is struck once and thrown aside.
    for (const f of n.foes) {
      if (f.hp <= 0 || n.dashHit.includes(f.id) || Math.hypot(f.x - n.x, f.y - n.y) > f.r + PLAYER_R + 0.35) continue;
      n.dashHit.push(f.id);
      hurtFoe(n, f, dashDamage(n), true);
      if (!f.boss) {
        // to whichever side of your path it was on
        const side = (f.x - n.x) * -n.fy + (f.y - n.y) * n.fx >= 0 ? 1 : -1;
        f.kx += -n.fy * side * 1.6 + n.fx * 0.4;
        f.ky += n.fx * side * 1.6 + n.fy * 0.4;
      }
    }
  } else if (len > 0.1) {
    const sp = playerSpeed(n) * dt;
    n.x = Math.max(0.5, Math.min(FIELD - 0.5, n.x + (dx / len) * sp));
    n.y = Math.max(0.5, Math.min(FIELD - 0.5, n.y + (dy / len) * sp));
    n.fx = dx / len;
    n.fy = dy / len;
  }
  // Standing your ground only works for so long: after a few seconds in one spot, hands claw up
  // from the earth under you (marked first, so there's time to step off).
  if (Math.hypot(n.x - n.anchorX, n.y - n.anchorY) > GRASP_ROAM) {
    n.anchorX = n.x;
    n.anchorY = n.y;
    n.anchorT = n.t;
  } else if (n.t > 20 && n.t - n.anchorT > GRASP_AFTER && n.t >= n.graspAt) {
    n.lanes.push({ x: n.x, y: n.y, ang: 0, len: 0, w: 1.1, at: n.t + 0.9, dmg: 3 + Math.floor(n.t / 120), grasp: true });
    n.graspAt = n.t + 2.2;
    n.grasps++;
  }
  const mossEvery = 6 - lv(n, 'moss');
  if (lv(n, 'moss') && Math.floor(n.t / mossEvery) !== Math.floor((n.t - dt) / mossEvery)) n.hp = Math.min(n.maxHp, n.hp + 1);

  // ---- the dead arrive ----
  const ev = n.event && n.t < n.event.until ? n.event.kind : null;
  const rate = (1.6 + (n.t / 60) * 1.0) * (n.pacts?.throng ? 1.3 : 1) * (ev === 'bloodmoon' ? 1.5 : 1) * (n.nightmare ? 1.3 : 1);
  n.spawnDebt += rate * dt;
  while (n.spawnDebt >= 1) {
    n.spawnDebt--;
    if (n.foes.length < MAX_FOES) spawn(n, pickKind(n), undefined, eliteRoll(n));
  }
  // ---- night events ----
  if (n.event && n.t >= n.event.until) {
    // The Treasure Ghoul gets away if it wasn't caught.
    if (n.event.kind === 'treasure') n.foes = n.foes.filter((f) => !f.treasure);
    n.event = null;
  }
  if (n.v2 && !n.event && n.t >= n.nextEventAt) {
    const kinds = (Object.keys(NIGHT_EVENTS) as NightEventKind[]).filter((k) => k !== n.lastEvent);
    const kind = kinds[Math.floor(n.rand() * kinds.length)];
    n.event = { kind, at: n.t, until: n.t + NIGHT_EVENTS[kind].secs };
    n.lastEvent = kind;
    n.events++;
    n.nextEventAt += EVENT_EVERY;
    if (kind === 'swarm') {
      // a ring of the dead, the tougher kinds too, closing in from all round
      const count = Math.min(80, 30 + Math.floor(n.t / 20));
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        const pick: FoeKind = k % 7 === 0 ? 'brute' : k % 3 === 0 ? 'wraith' : 'ghoul';
        spawn(n, pick, { x: Math.max(1, Math.min(FIELD - 1, n.x + Math.cos(a) * 8.5)), y: Math.max(1, Math.min(FIELD - 1, n.y + Math.sin(a) * 8.5)) });
      }
    }
    if (kind === 'treasure') {
      const a = n.rand() * Math.PI * 2;
      spawn(n, 'ghoul', { x: Math.max(1, Math.min(FIELD - 1, n.x + Math.cos(a) * 6)), y: Math.max(1, Math.min(FIELD - 1, n.y + Math.sin(a) * 6)) }, 'treasure');
    }
  }
  if (n.t >= nextBossAt(n)) {
    // While the Night Mother walks, the other bosses wait.
    if (!n.foes.some((f) => f.kind === 'mother')) {
      const order = n.v2 ? BOSS_ORDER_V2 : BOSS_ORDER;
      spawn(n, order[n.bossesRisen % order.length]);
    }
    n.bossesRisen++;
  }
  if (n.v2 && !n.motherRisen && n.t >= MOTHER_AT) {
    n.motherRisen = true;
    const a = n.rand() * Math.PI * 2;
    spawn(n, 'mother', { x: Math.max(2, Math.min(FIELD - 2, n.x + Math.cos(a) * 7)), y: Math.max(2, Math.min(FIELD - 2, n.y + Math.sin(a) * 7)) });
  }
  // From the twelfth minute, now and then a wall of Shieldbearers marches in.
  if (n.v2 && n.t > 720 && Math.floor(n.t / 40) > Math.floor((n.t - dt) / 40)) {
    const a = n.rand() * Math.PI * 2;
    const cx = n.x + Math.cos(a) * 9;
    const cy = n.y + Math.sin(a) * 9;
    for (let k = -2; k <= 2; k++) spawn(n, 'boneknight', { x: Math.max(1, Math.min(FIELD - 1, cx - Math.sin(a) * k * 0.95)), y: Math.max(1, Math.min(FIELD - 1, cy + Math.cos(a) * k * 0.95)) });
  }
  // Every so often, a ring of bats closes in from all round.
  if (Math.floor(n.t / 150) > Math.floor((n.t - dt) / 150)) {
    const count = 16 + Math.floor(n.t / 60) * 2;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      spawn(n, 'bat', { x: Math.max(1, Math.min(FIELD - 1, n.x + Math.cos(a) * 8)), y: Math.max(1, Math.min(FIELD - 1, n.y + Math.sin(a) * 8)) });
    }
  }

  // ---- your weapons ----
  const ready = (r: RelicKind, every: number) => {
    if (!lv(n, r)) return false;
    if ((n.next[r] ?? 0) > n.t) return false;
    n.next[r] = n.t + every * cdMul(n) * (ascOf(n, r) ? 0.8 : 1);
    return true;
  };
  const L = (r: RelicKind) => lv(n, r);
  const nearest = (from: { x: number; y: number }, within = Infinity) => {
    let best: Foe | null = null;
    let bd = within;
    for (const f of n.foes) {
      if (f.hp <= 0) continue;
      const d = near(from, f);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  };

  // The spade: an arc toward the nearest foe in reach (or the way you're going).
  if (ready('spade', Math.max(0.4, 1.0 - 0.12 * L('spade')))) {
    const reach = spadeReach(n);
    const half = n.fused.cleaver ? Math.PI : ((55 + 10 * L('spade')) * Math.PI) / 180;
    const target = nearest(n, reach + 1.5);
    const facing = target ? Math.atan2(target.y - n.y, target.x - n.x) : Math.atan2(n.fy, n.fx);
    n.flashes.push({ kind: 'swing', x: n.x, y: n.y, at: n.t, ang: facing, r: reach, asc: ascOf(n, 'spade') });
    for (const f of n.foes) {
      const d = near(n, f);
      if (d > reach + f.r) continue;
      let diff = Math.abs(Math.atan2(f.y - n.y, f.x - n.x) - facing);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff <= half || d < 0.6) {
        hurtFoe(n, f, (4 + 2 * L('spade')) * (n.fused.cleaver ? 2 : 1) * pw(n, 'spade'));
        if (!f.boss) {
          f.kx += ((f.x - n.x) / (d || 1)) * 0.5;
          f.ky += ((f.y - n.y) / (d || 1)) * 0.5;
        }
      }
    }
  }

  // Whirling skulls: orbit and strike what they touch.
  const skulls = skullCount(n);
  for (let k = 0; k < skulls; k++) {
    const a = n.t * 3 + (k / skulls) * Math.PI * 2;
    const sx = n.x + Math.cos(a) * skullOrbit(n);
    const sy = n.y + Math.sin(a) * skullOrbit(n);
    for (const f of n.foes) {
      if (f.skullAt > n.t || Math.hypot(f.x - sx, f.y - sy) > f.r + 0.35) continue;
      f.skullAt = n.t + 0.4;
      hurtFoe(n, f, (3 + L('skulls')) * (n.fused.halo ? 2 : 1) * pw(n, 'skulls'));
    }
  }

  // Bone darts at the nearest foes.
  if (ready('quiver', Math.max(0.35, 0.9 - 0.08 * L('quiver')))) {
    const targets = n.foes.filter((f) => f.hp > 0).sort((a, b) => near(n, a) - near(n, b)).slice(0, n.fused.barrage ? 8 : Math.min(4, Math.ceil(L('quiver') / 1.5)));
    for (const f of targets) {
      const d = near(n, f) || 1;
      n.darts.push({ x: n.x, y: n.y, vx: ((f.x - n.x) / d) * 10, vy: ((f.y - n.y) / d) * 10, dmg: (4 + L('quiver')) * pw(n, 'quiver'), pierce: Math.floor(L('quiver') / 2) + (n.fused.barrage ? 3 : 0), life: 1.2, hit: [], kind: 'dart' });
    }
  }
  // The scythe: out toward a foe, then home again, cutting through everything both ways.
  if (ready('scythe', Math.max(1.2, 2.4 - 0.2 * L('scythe')))) {
    const count = n.fused.eclipse ? 6 : 1 + Math.floor(L('scythe') / 2);
    const f = nearest(n);
    const base = f ? Math.atan2(f.y - n.y, f.x - n.x) : Math.atan2(n.fy, n.fx);
    for (let k = 0; k < count; k++) {
      const a = n.fused.eclipse ? base + (k / count) * Math.PI * 2 : base + (k - (count - 1) / 2) * 0.5;
      n.darts.push({ x: n.x, y: n.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, dmg: (6 + 2 * L('scythe')) * (n.fused.eclipse ? 2 : 1) * pw(n, 'scythe'), pierce: 999, life: 1.6, hit: [], kind: 'scythe' });
    }
  }
  // Wisps: slow little ghosts that turn toward the nearest foe.
  if (ready('wisps', Math.max(0.7, 1.6 - 0.15 * L('wisps')))) {
    for (let k = 0; k < (1 + Math.floor(L('wisps') / 2)) * (n.fused.legion ? 3 : 1); k++) {
      const a = n.rand() * Math.PI * 2;
      n.darts.push({ x: n.x, y: n.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, dmg: (5 + 2 * L('wisps')) * pw(n, 'wisps'), pierce: 0, life: 3, hit: [], kind: 'wisp' });
    }
  }
  for (const d of n.darts) {
    if (d.kind === 'scythe' && d.life < 0.8) {
      // coming home, and free to cut the same foes again
      if (d.life + dt >= 0.8) d.hit = [];
      const back = Math.atan2(n.y - d.y, n.x - d.x);
      d.vx = Math.cos(back) * 10;
      d.vy = Math.sin(back) * 10;
      if (Math.hypot(n.x - d.x, n.y - d.y) < 0.5) d.life = 0;
    } else if (d.kind === 'wisp' || d.kind === 'missile') {
      const f = nearest(d, 8);
      if (f) {
        const a = Math.atan2(f.y - d.y, f.x - d.x);
        d.vx += (Math.cos(a) * 7 - d.vx) * Math.min(1, dt * 4);
        d.vy += (Math.sin(a) * 7 - d.vy) * Math.min(1, dt * 4);
      }
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.life -= dt;
    for (const f of n.foes) {
      if (f.hp <= 0 || d.hit.includes(f.id) || Math.hypot(f.x - d.x, f.y - d.y) > f.r + (d.kind === 'scythe' ? 0.45 : 0.15)) continue;
      d.hit.push(f.id);
      hurtFoe(n, f, d.dmg);
      if (d.kind === 'wisp' && n.fused.legion && f.hp <= 0 && n.rand() < 0.1) n.hp = Math.min(n.maxHp, n.hp + 1);
      if (d.hit.length > d.pierce) {
        d.life = 0;
        break;
      }
    }
  }
  n.darts = n.darts.filter((d) => d.life > 0);

  // Ember: burning ground left behind you.
  if (ready('ember', 0.35)) {
    const hell = n.fused.hellwalk ? 1 : 0;
    n.flames.push({ x: n.x, y: n.y, until: n.t + (1.6 + 0.4 * L('ember')) * (1 + 0.5 * hell), r: (0.6 + 0.05 * L('ember')) * area(n) * (1 + 0.8 * hell), dps: (4 + 2 * L('ember')) * (1 + hell) * pw(n, 'ember') });
  }
  if (n.flames.length) {
    for (const fl of n.flames) for (const f of n.foes) if (Math.hypot(f.x - fl.x, f.y - fl.y) < fl.r + f.r) hurtFoe(n, f, fl.dps * dt);
    n.flames = n.flames.filter((fl) => fl.until > n.t);
  }

  // Storm: lightning on foes near you.
  if (ready('storm', Math.max(0.9, 2.3 - 0.25 * L('storm')) * (n.fused.tempest ? 0.5 : 1))) {
    const close = n.foes.filter((f) => f.hp > 0 && near(n, f) < (n.fused.tempest ? 10 : 7));
    for (let k = 0; k < (1 + L('storm')) * (n.fused.tempest ? 2 : 1) && close.length; k++) {
      const f = close.splice(Math.floor(n.rand() * close.length), 1)[0];
      n.flashes.push({ kind: 'bolt', x: f.x, y: f.y, at: n.t, asc: ascOf(n, 'storm') });
      hurtFoe(n, f, (8 + 4 * L('storm')) * pw(n, 'storm'));
    }
  }

  // Bone spikes: burst up under foes near you, hurting all round each.
  if (ready('spikes', Math.max(1, 2.2 - 0.2 * L('spikes')))) {
    const close = n.foes.filter((f) => f.hp > 0 && near(n, f) < 6);
    const r = (0.8 + 0.1 * L('spikes')) * area(n) * (n.fused.ossuary ? 1.4 : 1);
    for (let k = 0; k < (1 + L('spikes')) * (n.fused.ossuary ? 2 : 1) && close.length; k++) {
      const c = close.splice(Math.floor(n.rand() * close.length), 1)[0];
      const at = { x: c.x, y: c.y };
      n.flashes.push({ kind: 'spike', x: at.x, y: at.y, at: n.t, r, asc: ascOf(n, 'spikes') });
      for (const f of n.foes) if (near(at, f) < r + f.r) hurtFoe(n, f, (7 + 3 * L('spikes')) * (n.fused.ossuary ? 1.5 : 1) * pw(n, 'spikes'));
    }
  }

  // The soul lance: a beam through every foe in a line.
  if (ready('lance', Math.max(1.1, 2.6 - 0.25 * L('lance')))) {
    const f = nearest(n);
    const base = f ? Math.atan2(f.y - n.y, f.x - n.x) : Math.atan2(n.fy, n.fx);
    for (let k = 0; k < (n.fused.judgement ? 4 : 1); k++) {
      const ang = base + (k * Math.PI) / 2;
      const beam: Lane = { x: n.x, y: n.y, ang, len: 6 + L('lance'), w: 0.45, at: n.t, dmg: 0 };
      n.flashes.push({ kind: 'beam', x: n.x, y: n.y, at: n.t, ang, r: beam.len, asc: ascOf(n, 'lance') });
      for (const o of n.foes) if (laneDist(beam, o.x, o.y) < beam.w + o.r) hurtFoe(n, o, (10 + 5 * L('lance')) * (n.fused.judgement ? 1.5 : 1) * pw(n, 'lance'));
    }
  }

  // Frost: a ring of cold that slows and bites.
  const fr = frostRadius(n);
  if (fr) for (const f of n.foes) if (near(n, f) < fr + f.r) {
    f.slowUntil = n.t + 0.2;
    hurtFoe(n, f, (1 + 0.6 * L('frost')) * (n.fused.glacier ? 2.5 : 1) * pw(n, 'frost') * dt);
  }

  // The bell: a toll that throws everything back.
  if (ready('bell', Math.max(1.6, 4 - 0.45 * L('bell')) * (n.fused.requiem ? 0.5 : 1))) {
    const r = (2.4 + 0.4 * L('bell')) * area(n);
    n.flashes.push({ kind: 'ring', x: n.x, y: n.y, at: n.t, r, asc: ascOf(n, 'bell') });
    for (const f of n.foes) {
      const d = near(n, f);
      if (d > r + f.r) continue;
      hurtFoe(n, f, (5 + 3 * L('bell')) * (n.fused.requiem ? 3 : 1) * pw(n, 'bell'));
      if (!f.boss) {
        f.kx += ((f.x - n.x) / (d || 1)) * 1.6;
        f.ky += ((f.y - n.y) / (d || 1)) * 1.6;
      }
    }
  }
  helpers(n, dt);
  n.flashes = n.flashes.filter((fl) => n.t - fl.at < 0.4);

  // ---- the dead move, and bite ----
  for (const f of n.foes) {
    if (f.hp <= 0) continue;
    // A charging Gravelord doesn't stop to walk.
    const charging = Math.abs(f.kx) + Math.abs(f.ky) > 0.05 && f.boss;
    if (f.kx || f.ky) {
      f.x += f.kx * Math.min(1, dt * 10);
      f.y += f.ky * Math.min(1, dt * 10);
      f.kx *= 0.8;
      f.ky *= 0.8;
      if (Math.abs(f.kx) + Math.abs(f.ky) < 0.02) f.kx = f.ky = 0;
      f.x = Math.max(0.5, Math.min(FIELD - 0.5, f.x));
      f.y = Math.max(0.5, Math.min(FIELD - 0.5, f.y));
    }
    let d = near(n, f) || 1;
    // A Knight companion draws the ordinary dead to themself (they can't be hurt).
    const taunt = n.ally && n.companion === 'knight' && !f.boss && !f.treasure && near(n.ally, f) < 2.2 + 0.3 * n.ally.level ? n.ally : null;
    // A blinking elite: gone, and back right beside you.
    if (f.elite === 'blinking' && f.blinkAt !== undefined && n.t >= f.blinkAt) {
      f.blinkAt = n.t + 3.5 + n.rand() * 1.5;
      if (d > 2.5) {
        n.flashes.push({ kind: 'blink', x: f.x, y: f.y, at: n.t });
        const a = n.rand() * Math.PI * 2;
        f.x = Math.max(0.5, Math.min(FIELD - 0.5, n.x + Math.cos(a) * 2.2));
        f.y = Math.max(0.5, Math.min(FIELD - 0.5, n.y + Math.sin(a) * 2.2));
        n.flashes.push({ kind: 'blink', x: f.x, y: f.y, at: n.t });
        d = near(n, f) || 1;
      }
    }
    // The Treasure Ghoul runs from you (but never quite out of reach).
    if (f.treasure) {
      const away = d < 10 ? -1 : 0.3;
      const sp = playerSpeed(n) * 0.72 * (f.slowUntil > n.t ? 0.6 : 1);
      f.x = Math.max(0.7, Math.min(FIELD - 0.7, f.x + ((n.x - f.x) / d) * away * sp * dt + Math.sin(n.t * 2 + f.id) * 0.6 * dt));
      f.y = Math.max(0.7, Math.min(FIELD - 0.7, f.y + ((n.y - f.y) / d) * away * sp * dt + Math.cos(n.t * 2 + f.id) * 0.6 * dt));
      continue;
    }
    // Left far behind: it comes round again from out of sight.
    if (d > 15 && !f.boss) {
      Object.assign(f, edgeSpot(n));
      d = near(n, f) || 1;
    }
    if (f.boss) bossAttack(n, f);
    else if (f.kind === 'archer' || f.kind === 'drowned' || f.kind === 'monk') foeAct(n, f, d);
    // Archers and monks keep their distance.
    const keepOff = f.kind === 'archer' ? 5 : f.kind === 'monk' ? 6 : 0;
    const slow = (f.slowUntil > n.t ? 1 - frostSlow(n, f) : 1) * (ev === 'bloodmoon' && !f.boss ? 1.25 : 1);
    // Bats weave as they come.
    const wob = f.kind === 'bat' ? Math.sin(n.t * 6 + f.id) * 0.6 : 0;
    const tx = taunt ? taunt.x : n.x;
    const ty = taunt ? taunt.y : n.y;
    const td = taunt ? near(taunt, f) || 1 : d;
    const ux = (tx - f.x) / td;
    const uy = (ty - f.y) / td;
    const drownedCharge = f.kind === 'drowned' && Math.abs(f.kx) + Math.abs(f.ky) > 0.05;
    if (!charging && !drownedCharge) {
      const back = keepOff && d < keepOff ? -0.7 : keepOff && d < keepOff + 1 ? 0 : 1;
      f.x += (ux * back - uy * wob) * f.speed * slow * dt;
      f.y += (uy * back + ux * wob) * f.speed * slow * dt;
    }
    if (d < f.r + PLAYER_R) hurtYou(n, f.dmg, f);
  }
  n.foes = n.foes.filter((f) => f.hp > 0);
  shoulder(n);

  // ---- the bosses' bolts and lanes ----
  for (const s of n.shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (Math.hypot(s.x - n.x, s.y - n.y) < s.r + PLAYER_R) {
      hurtYou(n, s.dmg);
      s.life = 0;
    }
  }
  n.shots = n.shots.filter((s) => s.life > 0 && s.x > -1 && s.y > -1 && s.x < FIELD + 1 && s.y < FIELD + 1);
  for (const l of n.lanes) {
    if (n.t < l.at) continue;
    n.flashes.push({ kind: l.blast ? 'blast' : l.grasp ? 'grasp' : 'lane', x: l.x, y: l.y, at: n.t, ang: l.ang, r: l.grasp || l.blast ? l.w : l.len });
    if (laneDist(l, n.x, n.y) < l.w + PLAYER_R) hurtYou(n, l.dmg);
    const charger = l.charge ? n.foes.find((f) => f.id === l.charge) : undefined;
    if (charger && !charger.boss) {
      // a Drowned Charger rushes down its lane
      const ux = Math.cos(l.ang);
      const uy = Math.sin(l.ang);
      charger.kx = (Math.max(1, Math.min(FIELD - 1, l.x + ux * l.len)) - charger.x) / 0.83;
      charger.ky = (Math.max(1, Math.min(FIELD - 1, l.y + uy * l.len)) - charger.y) / 0.83;
    } else if (charger) {
      // down the lane at a run, then bolts all round where he stops
      const ux = Math.cos(l.ang);
      const uy = Math.sin(l.ang);
      const end = { x: Math.max(1, Math.min(FIELD - 1, l.x + ux * l.len)), y: Math.max(1, Math.min(FIELD - 1, l.y + uy * l.len)) };
      charger.kx = (end.x - charger.x) / 0.83;
      charger.ky = (end.y - charger.y) / 0.83;
      volley(n, end, Math.max(2, charger.dmg - 1), charger.tier === 0 ? 6 : 9 + charger.tier, charger.tier === 0 ? 2.8 : 3.4, null);
    }
  }
  n.lanes = n.lanes.filter((l) => n.t < l.at);

  if (n.hp <= 0) {
    n.hp = 0;
    n.over = true;
    return;
  }

  // ---- pickups ----
  const pull = pickupRadius(n);
  const evMul = ev === 'bloodmoon' ? 2 : ev === 'fog' ? 1.5 : 1;
  const soulMul = (1 + 0.15 * lv(n, 'coin')) * (1 + 0.05 * bl(n, 'greed')) * (n.pacts?.hunger ? 1.3 : 1) * evMul;
  for (const p of n.pickups) {
    const d = near(n, p);
    if (d < pull) {
      // drawn in, faster the closer it gets
      const k = Math.min(1, (dt * 9) / Math.max(0.3, d));
      p.x += (n.x - p.x) * k;
      p.y += (n.y - p.y) * k;
    }
    if (near(n, p) < 0.45) {
      if (p.kind === 'glowcap') n.hp = Math.min(n.maxHp, n.hp + p.v);
      else if (p.kind === 'potion') {
        n.hp = Math.min(n.maxHp, n.hp + Math.ceil(n.maxHp * (POTION_HEAL + (n.hero === 'knight' && n.v2 ? 0.15 : 0))));
        n.potions++;
      }
      else if (p.kind === 'forge') {
        n.pendingLevels++;
        n.forgeOffers++;
      } else if (p.kind === 'chest') {
        // the Treasure Ghoul's chest: two levels at once, and a heap of souls
        n.pendingLevels += 2;
        n.chests++;
        n.xp += 20 * soulMul;
      } else if (p.kind === 'shard') {
        if (NIGHT_FUSIONS.some((x) => n.fused[x.id] && !n.ascended[x.id])) {
          n.pendingLevels++;
          n.ascendOffers++;
        }
      } else n.xp += p.v * soulMul;
      p.v = 0;
    }
  }
  n.pickups = n.pickups.filter((p) => p.v > 0);
  // Too many souls lying about: the oldest are gathered into one big one.
  if (n.pickups.length > 400) {
    const keep = (p: Pickup) => p.kind !== 'soul' && p.kind !== 'bigsoul';
    const old = n.pickups.splice(0, n.pickups.length - 300);
    n.pickups.unshift(...old.filter(keep));
    old.splice(0, old.length, ...old.filter((p) => !keep(p)));
    if (old.length) n.pickups.push({ x: old[0].x, y: old[0].y, kind: 'bigsoul', v: old.reduce((a, p) => a + p.v, 0) });
  }
  while (n.xp >= xpToLevel(n.level)) {
    n.xp -= xpToLevel(n.level);
    n.level++;
    n.pendingLevels++;
  }
}

/** The nearest living foe to a point, within a distance. */
function nearestFoe(n: Night, from: { x: number; y: number }, within = Infinity): Foe | null {
  let best: Foe | null = null;
  let bd = within;
  for (const f of n.foes) {
    if (f.hp <= 0) continue;
    const d = near(from, f);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

/** Walk a helper toward a point at a speed, stopping short by `stop`. */
function walk(m: { x: number; y: number; fx: number }, tx: number, ty: number, speed: number, dt: number, stop = 0) {
  const d = Math.hypot(tx - m.x, ty - m.y);
  if (d <= stop || d < 0.01) return;
  const step = Math.min(d - stop, speed * dt);
  m.x = Math.max(0.5, Math.min(FIELD - 0.5, m.x + ((tx - m.x) / d) * step));
  m.y = Math.max(0.5, Math.min(FIELD - 0.5, m.y + ((ty - m.y) / d) * step));
  if (Math.abs(tx - m.x) > 0.05) m.fx = tx > m.x ? 1 : -1;
}

/** Raise thralls round a point: they hunt the dead for a while, then crumble. */
function raiseThralls(n: Night, at: { x: number; y: number }, count: number, life: number, dmg: number) {
  for (let k = 0; k < count; k++) {
    if (n.minions.filter((m) => m.kind === 'thrall').length >= MAX_THRALLS) return;
    const a = n.rand() * Math.PI * 2;
    n.minions.push({ kind: 'thrall', x: Math.max(0.5, Math.min(FIELD - 0.5, at.x + Math.cos(a) * 0.9)), y: Math.max(0.5, Math.min(FIELD - 0.5, at.y + Math.sin(a) * 0.9)), fx: 1, next: n.t + 0.4, until: n.t + life, actAt: -1, dmg });
    n.flashes.push({ kind: 'grasp', x: at.x + Math.cos(a) * 0.9, y: at.y + Math.sin(a) * 0.9, at: n.t, r: 0.5 });
  }
}

/**
 * Your helpers: the companion, the hounds and spectral knights your relics bring, and the
 * thralls the Necromancer and the Thrall Totem raise. They can't be hurt; they just fight.
 */
function helpers(n: Night, dt: number) {
  const cd = cdMul(n);
  // ---- the companion ----
  const a = n.ally;
  if (a) {
    const L = a.level;
    const ranged = n.companion === 'ranger' || n.companion === 'mage' || n.companion === 'paladin' || n.companion === 'necro';
    // Too far behind: they catch up in a blink.
    if (near(a, n) > 9) {
      a.x = n.x - n.fx;
      a.y = n.y - n.fy;
    }
    const foe = nearestFoe(n, n, ranged ? 7 : 5);
    if (foe && !ranged) walk(a, foe.x, foe.y, 4.6, dt, foe.r + 0.5);
    else walk(a, n.x - n.fx * 1.3 + (n.fy ? 0.8 : 0), n.y - n.fy * 1.3 + (n.fx ? 0.8 : 0), 4.4, dt, 0.4);
    if (n.t >= a.next) {
      const c = n.companion;
      let every = 1;
      if (c === 'knight') {
        every = Math.max(0.6, 1.3 - 0.12 * L);
        let any = false;
        for (const f of n.foes) {
          const d = near(a, f);
          if (f.hp <= 0 || d > 1.3 + f.r) continue;
          any = true;
          hurtFoe(n, f, 5 + 3 * L);
          if (!f.boss) {
            f.kx += ((f.x - a.x) / (d || 1)) * 0.9;
            f.ky += ((f.y - a.y) / (d || 1)) * 0.9;
          }
        }
        if (any) {
          a.actAt = n.t;
          n.flashes.push({ kind: 'swing', x: a.x, y: a.y, at: n.t, ang: Math.atan2(n.fy, n.fx), r: 1.3 });
        }
      } else if (c === 'rogue') {
        every = Math.max(0.45, 1.1 - 0.12 * L);
        const f = nearestFoe(n, a, 6);
        if (f) {
          n.flashes.push({ kind: 'blink', x: a.x, y: a.y, at: n.t });
          a.x = Math.max(0.5, Math.min(FIELD - 0.5, f.x - Math.sign(f.x - n.x || 1) * (f.r + 0.3)));
          a.y = f.y;
          hurtFoe(n, f, (12 + 6 * L) * (f.hp >= f.maxHp ? 1.5 : 1));
          a.actAt = n.t;
        }
      } else if (c === 'necro') {
        every = Math.max(2, 5 - 0.5 * L);
        raiseThralls(n, a, 1 + Math.floor(L / 2), 7 + L, 3 + 2 * L + n.t / 90);
        a.actAt = n.t;
      } else if (c === 'paladin') {
        every = Math.max(1, 2.3 - 0.22 * L);
        const f = nearestFoe(n, a, 7);
        if (f) {
          n.flashes.push({ kind: 'bolt', x: f.x, y: f.y, at: n.t });
          hurtFoe(n, f, (8 + 4 * L) * (f.boss ? 2 : 1));
          a.actAt = n.t;
        }
        // a gentle heal every few seconds
        const healEvery = Math.max(4, 10 - L);
        if (Math.floor(n.t / healEvery) !== Math.floor((n.t - every) / healEvery) && n.hp < n.maxHp) n.hp = Math.min(n.maxHp, n.hp + 1 + Math.floor(L / 2));
      } else if (c === 'ranger') {
        every = Math.max(0.35, 0.95 - 0.1 * L);
        const targets = n.foes.filter((f) => f.hp > 0 && near(a, f) < 8).sort((p, q) => near(a, p) - near(a, q)).slice(0, 1 + Math.floor(L / 2));
        for (const f of targets) {
          const d = near(a, f) || 1;
          n.darts.push({ x: a.x, y: a.y, vx: ((f.x - a.x) / d) * 11, vy: ((f.y - a.y) / d) * 11, dmg: 4 + 2 * L, pierce: Math.floor(L / 2), life: 1.1, hit: [], kind: 'dart' });
        }
        if (targets.length) a.actAt = n.t;
      } else if (c === 'mage') {
        every = Math.max(0.8, 1.9 - 0.2 * L);
        if (nearestFoe(n, a, 8)) {
          for (let k = 0; k < 1 + Math.floor(L / 2); k++) {
            const ang = n.rand() * Math.PI * 2;
            n.darts.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5, dmg: 10 + 5 * L, pierce: 0, life: 2.5, hit: [], kind: 'missile' });
          }
          a.actAt = n.t;
        }
      } else if (c === 'barbarian') {
        every = Math.max(0.8, 1.6 - 0.15 * L);
        const r = 1.5 + 0.12 * L;
        let any = false;
        for (const f of n.foes) {
          if (f.hp <= 0 || near(a, f) > r + f.r) continue;
          any = true;
          hurtFoe(n, f, 6 + 3 * L);
        }
        if (any) {
          a.actAt = n.t;
          n.flashes.push({ kind: 'swing', x: a.x, y: a.y, at: n.t, ang: 0, r });
        }
      } else if (c === 'bellringer') {
        every = Math.max(2, 4.6 - 0.45 * L);
        const r = 2.2 + 0.3 * L;
        n.flashes.push({ kind: 'ring', x: a.x, y: a.y, at: n.t, r });
        for (const f of n.foes) {
          const d = near(a, f);
          if (f.hp <= 0 || d > r + f.r) continue;
          hurtFoe(n, f, 4 + 3 * L);
          f.slowUntil = n.t + 1;
          if (!f.boss) {
            f.kx += ((f.x - a.x) / (d || 1)) * 1.4;
            f.ky += ((f.y - a.y) / (d || 1)) * 1.4;
          }
        }
        a.actAt = n.t;
      }
      a.next = n.t + every * cd;
    }
  }

  // ---- the relics' helpers: keep as many hounds and knights as their levels call for ----
  const want = (kind: 'hound' | 'spectre', count: number) => {
    const have = n.minions.filter((m) => m.kind === kind);
    for (let k = have.length; k < count; k++) n.minions.push({ kind, x: n.x + (n.rand() - 0.5) * 2, y: n.y + (n.rand() - 0.5) * 2, fx: 1, next: n.t + 0.5, until: Infinity, actAt: -1, dmg: 0 });
  };
  const hl = lv(n, 'hound');
  if (hl) want('hound', n.fused.wildhunt ? 3 : hl >= 4 ? 2 : 1);
  const sl = lv(n, 'spectre');
  if (sl) want('spectre', (1 + (sl >= 3 ? 1 : 0) + (sl >= 5 ? 1 : 0)) * (n.fused.revenant ? 2 : 1));
  // The Thrall Totem raises its own.
  const tl = lv(n, 'totem');
  if (tl && (n.next.totem ?? 0) <= n.t) {
    n.next.totem = n.t + Math.max(2.5, 6 - 0.6 * tl) * cd * (ascOf(n, 'totem') ? 0.8 : 1);
    const barrow = n.fused.barrow ? 2 : 1;
    raiseThralls(n, n, (1 + Math.floor(tl / 2)) * barrow, (6 + tl) * barrow, (3 + 2 * tl) * pw(n, 'totem'));
  }

  for (const m of n.minions) {
    if (m.kind === 'thrall') {
      const f = nearestFoe(n, m, 7);
      if (f) walk(m, f.x, f.y, 2.6, dt, f.r + 0.25);
      else walk(m, n.x, n.y, 2.6, dt, 1.2);
      if (f && n.t >= m.next && near(m, f) < f.r + 0.5) {
        hurtFoe(n, f, m.dmg);
        m.next = n.t + 0.6;
        m.actAt = n.t;
      }
      continue;
    }
    if (near(m, n) > 10) {
      m.x = n.x + (n.rand() - 0.5) * 2;
      m.y = n.y + (n.rand() - 0.5) * 2;
    }
    if (m.kind === 'hound') {
      const f = nearestFoe(n, n, 8);
      if (f) walk(m, f.x, f.y, (n.fused.wildhunt ? 7.5 : 6) * (1 + 0.05 * hl), dt, f.r + 0.2);
      else walk(m, n.x + 0.9, n.y + 0.4, 6, dt, 0.5);
      if (f && n.t >= m.next && near(m, f) < f.r + 0.45) {
        hurtFoe(n, f, (6 + 3 * hl) * (n.fused.wildhunt ? 2 : 1) * pw(n, 'hound'));
        m.next = n.t + Math.max(0.4, 0.9 - 0.1 * hl) * cd;
        m.actAt = n.t;
      }
    } else {
      // a spectral knight: walks out to the dead near you and swings at all round
      const f = nearestFoe(n, n, 6);
      if (f) walk(m, f.x, f.y, 3.8, dt, f.r + 0.6);
      else walk(m, n.x - 1, n.y - 0.6, 3.8, dt, 0.8);
      if (f && n.t >= m.next && near(m, f) < f.r + 1.3) {
        for (const o of n.foes) if (o.hp > 0 && near(m, o) < 1.3 + o.r) hurtFoe(n, o, (6 + 3 * sl) * (n.fused.revenant ? 2 : 1) * pw(n, 'spectre'));
        n.flashes.push({ kind: 'swing', x: m.x, y: m.y, at: n.t, ang: Math.atan2(f.y - m.y, f.x - m.x), r: 1.3, asc: ascOf(n, 'spectre') });
        m.next = n.t + Math.max(0.7, 1.4 - 0.12 * sl) * cd;
        m.actAt = n.t;
      }
    }
  }
  n.minions = n.minions.filter((m) => m.until > n.t);
}

/** What a night pays, in Souls: one for every six put down, up to 500, and up to 150 more for every pact taken. */
export function nightSouls(n: Night): number {
  const pacts = Object.values(n.pacts ?? {}).filter(Boolean).length;
  const base = Math.min(500 + 150 * pacts + (n.dawn ? 300 : 0), Math.floor((n.kills / 6) * (n.pacts?.throng ? 1.3 : 1)));
  // Greeting the dawn pays half again.
  return n.dawn ? Math.floor(base * 1.5) : base;
}

/** Night Shift achievements this night has earned so far (ids from ACHIEVEMENTS). */
export function nightFeats(n: Night): string[] {
  const out: string[] = [];
  if (n.t >= 300) out.push('nsfirst');
  if (n.t >= 900) out.push('ns15');
  if (n.t >= 1500) out.push('ns25');
  if (n.kills >= 1000) out.push('ns1k');
  if (n.kills >= 10000) out.push('ns10k');
  if (Object.values(n.fused).filter(Boolean).length >= 3) out.push('nsforge3');
  if (n.t >= 180 && (n.firstHitAt < 0 || n.firstHitAt >= 180)) out.push('nsuntouched');
  if (n.felledKinds.length >= 3) out.push('nsbosses');
  if (Object.values(n.blessings).reduce((a, b) => a + (b ?? 0), 0) >= 25) out.push('nsblessed');
  if (Object.values(n.ascended ?? {}).some(Boolean)) out.push('nsascend');
  if (Object.values(n.pacts ?? {}).filter(Boolean).length >= 3) out.push('nspacts');
  if ((n.chests ?? 0) >= 1) out.push('nstreasure');
  if (n.dawn) out.push('nsdawn');
  if (n.motherFelled) out.push('nsmother');
  if (n.nightmare && n.t >= DAWN + 300) out.push('nsnightmare');
  return out;
}
