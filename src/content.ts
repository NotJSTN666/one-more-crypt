// Content tables shared by the rules, the renderer and the menus.

import type { RelicId } from './relics';

// ---------- heroes ----------

export type HeroId = 'knight' | 'rogue' | 'necro';

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

export type FeatureKind = 'shrine' | 'chest' | 'fountain';

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
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<string, AchievementDef>;
