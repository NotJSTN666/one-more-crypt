// Content tables shared by the rules, the renderer and the menus.

import type { RelicId } from './relics';

// ---------- heroes ----------

export type HeroId = 'knight' | 'rogue' | 'necro' | 'paladin' | 'ranger' | 'mage' | 'barbarian';

export interface HeroDef {
  id: HeroId;
  name: string;
  hp: number;
  /** Souls to unlock in the Ossuary (0 = always available). */
  cost: number;
  perk: string;
  perkDesc: string;
}

export const HEROES: HeroDef[] = [
  { id: 'knight', name: 'Knight', hp: 10, cost: 0, perk: 'Second Wind', perkDesc: 'Heal 1 HP on every new floor.' },
  { id: 'rogue', name: 'Rogue', hp: 7, cost: 150, perk: 'Shadowstep', perkDesc: 'Every 3rd step is free: foes don\'t act. 15% dodge.' },
  { id: 'necro', name: 'Necromancer', hp: 8, cost: 300, perk: 'Raise Dead', perkDesc: 'Slain foes may rise as thralls that fight for you (up to 3).' },
  // Added after launch: new heroes go at the end so the daily rotation stays put.
  { id: 'paladin', name: 'Paladin', hp: 9, cost: 250, perk: 'Smite', perkDesc: '+1 damage against the undead. Slaying a boss heals you fully.' },
  { id: 'ranger', name: 'Ranger', hp: 7, cost: 350, perk: 'Longbow', perkDesc: 'Move toward a foe 2-3 tiles away in a clear line to shoot it instead.' },
  { id: 'mage', name: 'Mage', hp: 5, cost: 400, perk: 'Glass Cannon', perkDesc: '+2 attack, but only 5 HP. Every hit counts.' },
  { id: 'barbarian', name: 'Barbarian', hp: 11, cost: 450, perk: 'Rage', perkDesc: '+1 attack for every 3 HP you are missing.' },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h])) as Record<HeroId, HeroDef>;

/** Everyone plays the same hero in the daily crypt; it rotates each day. */
export function dailyHero(dailyNo: number): HeroId {
  return HEROES[(dailyNo - 1 + HEROES.length * 100) % HEROES.length].id;
}

// ---------- elites ----------

export type EliteMod = 'shielded' | 'swift' | 'vampiric' | 'splitting' | 'explosive';

export const ELITES: Record<EliteMod, { name: string; color: string; desc: string }> = {
  shielded: { name: 'Shielded', color: '#9fe8ff', desc: 'Blocks the first hit.' },
  swift: { name: 'Swift', color: '#f2c14e', desc: 'Acts twice each turn.' },
  vampiric: { name: 'Vampiric', color: '#d23a46', desc: 'Heals when it wounds you.' },
  splitting: { name: 'Splitting', color: '#7f9a52', desc: 'Splits in two when slain.' },
  explosive: { name: 'Explosive', color: '#ff8a2a', desc: 'Explodes when slain, hurting everything nearby.' },
};

export const ELITE_MODS = Object.keys(ELITES) as EliteMod[];

// ---------- floor events ----------

export type FeatureKind = 'shrine' | 'chest' | 'fountain' | 'forge';

export const FEATURES: Record<FeatureKind, { name: string; text: string; accept: string; leave: string }> = {
  shrine: {
    name: 'Blood Shrine',
    text: 'A shrine slick with old blood. It will trade a rare relic for a piece of your life.',
    accept: 'Offer 3 max HP',
    leave: 'Walk away',
  },
  chest: {
    name: 'Iron Chest',
    text: 'A rusted chest, its lock rigged with a blade. Prying it open will cut you.',
    accept: 'Pry it open (take 2 damage)',
    leave: 'Leave it',
  },
  fountain: {
    name: 'Pale Fountain',
    text: 'Still water glows faintly. Drinking it mends every wound.',
    accept: 'Drink (heal fully)',
    leave: 'Leave it',
  },
  forge: {
    name: 'Soul Forge',
    text: 'An anvil burning with blue soulfire. It can melt two of your relics into something greater.',
    accept: 'Fuse',
    leave: 'Walk away',
  },
};

// ---------- named combos ----------

export interface ComboDef {
  id: string;
  name: string;
  emoji: string;
  relics: RelicId[];
  desc: string;
}

export const COMBOS: ComboDef[] = [
  { id: 'inferno', name: 'Inferno', emoji: '🔥', relics: ['ember', 'wildfire', 'bloom'], desc: 'Flames that leap from corpse to corpse.' },
  { id: 'permafrost', name: 'Permafrost', emoji: '🧊', relics: ['frost', 'shatter'], desc: 'Freeze them, then break them.' },
  { id: 'thunderstorm', name: 'Thunderstorm', emoji: '🌩️', relics: ['storm', 'conductor'], desc: 'Every kill calls down a chain of lightning.' },
  { id: 'bloodlust', name: 'Bloodlust', emoji: '🩸', relics: ['fang', 'pact'], desc: 'Fight at the edge of death, drinking as you go.' },
  { id: 'bulwark', name: 'Bulwark', emoji: '🏰', relics: ['mirror', 'thorns', 'heart'], desc: 'Let them break themselves against you.' },
  { id: 'reaper', name: 'Reaper', emoji: '💀', relics: ['harvest', 'whirl'], desc: 'One swing, a ring of dead.' },
  { id: 'gravelord', name: 'Grave Lord', emoji: '⚰️', relics: ['necro', 'bloom'], desc: 'The dead rise, and the dead explode.' },
  { id: 'tinker', name: 'Trapmaster', emoji: '🪤', relics: ['caltrops', 'mask'], desc: 'Nothing near you is safe.' },
  { id: 'crusader', name: 'Crusader', emoji: '✝️', relics: ['rosary', 'mirror'], desc: 'Shielded by faith, wrath for the dead.' },
  { id: 'berserker', name: 'Berserker', emoji: '🪓', relics: ['idol', 'pact'], desc: 'The closer to death, the harder you hit.' },
  { id: 'timelock', name: 'Frozen Time', emoji: '⏳', relics: ['hourglass', 'frost', 'shatter'], desc: 'Nothing moves. Everything breaks.' },
  { id: 'sommelier', name: 'Blood Sommelier', emoji: '🍷', relics: ['chalice', 'flask', 'fang'], desc: 'Every drop restores you.' },
  { id: 'dragonhide', name: 'Dragonhide', emoji: '🐉', relics: ['scale', 'thorns'], desc: 'Hit me. See what happens.' },
  { id: 'apocalypse', name: 'Apocalypse', emoji: '☄️', relics: ['doom', 'hellfire'], desc: 'The floor burns before you arrive.' },
  { id: 'eclipse', name: 'Eclipse', emoji: '🌑', relics: ['moon', 'crown'], desc: 'All power, no armour.' },
  { id: 'wisps', name: 'Will-o-Wisps', emoji: '👻', relics: ['wisp', 'storm'], desc: 'Lights in the dark that bite.' },
  { id: 'gambler', name: 'Gambler', emoji: '🎲', relics: ['dice', 'coin'], desc: 'More choices, bigger rolls.' },
  { id: 'skewer', name: 'Skewer', emoji: '🔱', relics: ['pike', 'mark'], desc: 'Mark them, then run them through in a row.' },
];

// ---------- achievements ----------

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  souls: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-blood', name: 'First Blood', desc: 'Slay a foe.', souls: 10 },
  { id: 'floor5', name: 'Delver', desc: 'Reach floor 5.', souls: 20 },
  { id: 'floor10', name: 'Deep Delver', desc: 'Reach floor 10.', souls: 50 },
  { id: 'floor15', name: 'Abyss Walker', desc: 'Reach floor 15.', souls: 100 },
  { id: 'warden', name: "Warden's Fall", desc: 'Slay the Bone Warden.', souls: 40 },
  { id: 'abbot', name: 'Plague Doctor', desc: 'Slay the Plague Abbot.', souls: 75 },
  { id: 'lich', name: 'Lichbane', desc: 'Slay the Lich King.', souls: 120 },
  { id: 'close-call', name: 'Close Call', desc: 'Slay a boss with 1 HP left.', souls: 50 },
  { id: 'untouchable', name: 'Untouchable', desc: 'Clear floor 3 or deeper without taking damage.', souls: 30 },
  { id: 'chain', name: 'Chain Reaction', desc: 'Slay 3 foes in a single turn.', souls: 30 },
  { id: 'overkill', name: 'Overkill', desc: 'Deal 15 or more damage in one hit.', souls: 30 },
  { id: 'hoarder', name: 'Hoarder', desc: 'Hold 10 relics in one run.', souls: 40 },
  { id: 'elite-hunter', name: 'Elite Hunter', desc: 'Slay 10 elites (across all runs).', souls: 40 },
  { id: 'trapper', name: 'Trapper', desc: 'Lure 3 foes to die on spikes in one run.', souls: 30 },
  { id: 'army', name: 'Army of the Dead', desc: 'Command 3 thralls at once.', souls: 40 },
  { id: 'rogue8', name: 'Ghost Step', desc: 'Reach floor 8 as the Rogue.', souls: 50 },
  { id: 'collector', name: 'Collector', desc: 'Discover 15 relics.', souls: 40 },
  { id: 'completionist', name: 'Grimoire Complete', desc: 'Discover every relic.', souls: 150 },
  { id: 'combo', name: 'Synergy', desc: 'Complete a named combo.', souls: 20 },
  { id: 'combos-all', name: 'Arcanist', desc: 'Complete every named combo.', souls: 150 },
  { id: 'streak3', name: 'Devotee', desc: 'Play the daily crypt 3 days in a row.', souls: 30 },
  { id: 'streak7', name: 'Faithful', desc: 'Play the daily crypt 7 days in a row.', souls: 100 },
  // Added after launch.
  { id: 'floor20', name: 'Hollow Depths', desc: 'Reach floor 20.', souls: 150 },
  { id: 'floor30', name: 'Into the Abyss', desc: 'Reach floor 30.', souls: 250 },
  { id: 'floor50', name: 'Bottomless', desc: 'Reach floor 50.', souls: 500 },
  { id: 'butcher', name: 'Butcher', desc: 'Slay 100 foes in one run.', souls: 60 },
  { id: 'massacre', name: 'Massacre', desc: 'Slay 5 foes in a single turn.', souls: 60 },
  { id: 'annihilate', name: 'Annihilate', desc: 'Deal 50 or more damage in one hit.', souls: 60 },
  { id: 'swift', name: 'Swift Descent', desc: 'Reach floor 5 in 60 turns or fewer.', souls: 40 },
  { id: 'cheat-death', name: 'Cheat Death', desc: 'Survive a killing blow with the Phylactery.', souls: 30 },
  { id: 'midas', name: 'Crowned in Gold', desc: 'Wear 3 Cursed Crowns at once.', souls: 40 },
  { id: 'elite50', name: 'Elite Slayer', desc: 'Slay 50 elites (across all runs).', souls: 80 },
  { id: 'knight10', name: 'Iron Will', desc: 'Reach floor 10 as the Knight.', souls: 40 },
  { id: 'necro10', name: 'Lord of Bones', desc: 'Reach floor 10 as the Necromancer.', souls: 50 },
  { id: 'paladin-lich', name: 'Holy Light', desc: 'Slay the Lich King as the Paladin.', souls: 100 },
  { id: 'ranger-arrows', name: 'Deadeye', desc: 'Slay 25 foes with arrows in one run.', souls: 60 },
  { id: 'mage10', name: 'Glass Cannon', desc: 'Reach floor 10 as the Mage.', souls: 80 },
  { id: 'barbarian-rage', name: 'Unchained', desc: 'Reach floor 10 as the Barbarian.', souls: 60 },
  { id: 'full-party', name: 'Full Party', desc: 'Unlock every hero.', souls: 150 },
  { id: 'forbidden', name: 'Forbidden Knowledge', desc: 'Unlock every forbidden relic.', souls: 150 },
  { id: 'soulbound', name: 'Soulbound', desc: 'Earn 2,000 Souls in total.', souls: 100 },
  // The Soul Forge.
  { id: 'forge', name: 'Soul Smith', desc: 'Fuse two relics at the Soul Forge.', souls: 30 },
  { id: 'forge2', name: 'Twice Forged', desc: 'Hold 2 fused relics in one run.', souls: 60 },
  { id: 'forge-all', name: 'Master of the Forge', desc: 'Discover every fusion.', souls: 200 },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<string, AchievementDef>;
