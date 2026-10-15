// Relic catalogue. Effects live in game.ts and look up how many of each relic the
// player holds, so most relics stack: two Vampire Fangs heal twice as much.

export type RelicId =
  | 'fang'
  | 'heart'
  | 'whetstone'
  | 'thorns'
  | 'ember'
  | 'frost'
  | 'storm'
  | 'bloom'
  | 'dust'
  | 'mark'
  | 'lantern'
  | 'crown'
  | 'pact'
  | 'whirl'
  | 'pike'
  | 'candle'
  | 'hellfire'
  | 'coin'
  | 'dice'
  | 'wildfire'
  | 'shatter'
  | 'conductor'
  | 'mirror'
  | 'phylactery'
  | 'flask'
  | 'harvest'
  | 'rosary'
  | 'idol'
  | 'hourglass'
  | 'chalice'
  | 'scale'
  // Unlocked in the Ossuary (always in the daily pool)
  | 'echo'
  | 'necro'
  | 'caltrops'
  | 'key'
  | 'mask'
  | 'tome'
  | 'wisp'
  | 'doom'
  | 'heretic'
  | 'moon'
  // Fused at the Soul Forge, never offered
  | FusedId;

export type FusedId =
  | 'plasma' | 'zero' | 'vheart' | 'aegis' | 'reaper' | 'pyre'
  | 'eternal' | 'fate' | 'oath' | 'lichbook' | 'dragon' | 'twinblade'
  // Ascended: two fused relics forged again, deep in the crypt
  | 'suneater' | 'bastion' | 'immortal' | 'wager' | 'thousand' | 'dracolich';

export type Rarity = 'common' | 'rare' | 'cursed' | 'fused' | 'ascended';

export interface RelicDef {
  id: RelicId;
  name: string;
  emoji: string;
  rarity: Rarity;
  /** Max copies a player can hold. */
  maxStack: number;
  /** Description given the count the player would have after taking it. */
  desc: (n: number) => string;
}

export const RELICS: RelicDef[] = [
  { id: 'fang', name: 'Vampire Fang', emoji: '🦷', rarity: 'common', maxStack: 5, desc: (n) => `Heal ${n} HP on each kill.` },
  { id: 'heart', name: 'Iron Heart', emoji: '🫀', rarity: 'common', maxStack: 9, desc: () => `+3 max HP and heal 3.` },
  { id: 'whetstone', name: 'Whetstone', emoji: '🗡️', rarity: 'common', maxStack: 9, desc: () => `+1 attack.` },
  { id: 'thorns', name: 'Thorned Mail', emoji: '🌵', rarity: 'common', maxStack: 5, desc: (n) => `Enemies that strike you take ${n} damage.` },
  { id: 'ember', name: 'Ember Brand', emoji: '🔥', rarity: 'common', maxStack: 5, desc: (n) => `Your hits set foes ablaze: ${n} damage per turn for 3 turns.` },
  { id: 'frost', name: 'Frost Sigil', emoji: '❄️', rarity: 'common', maxStack: 3, desc: (n) => `Your hits freeze foes for ${n} turn${n > 1 ? 's' : ''}.` },
  { id: 'storm', name: 'Storm Rune', emoji: '⚡', rarity: 'common', maxStack: 5, desc: (n) => `On kill, lightning strikes a random foe for ${n + 1} damage.` },
  { id: 'bloom', name: 'Corpse Bloom', emoji: '💥', rarity: 'common', maxStack: 5, desc: (n) => `Slain foes burst, dealing ${n} damage to adjacent foes.` },
  { id: 'dust', name: 'Grave Dust', emoji: '🌫️', rarity: 'common', maxStack: 3, desc: (n) => `${Math.min(50, n * 20)}% chance to dodge attacks.` },
  { id: 'mark', name: "Hunter's Mark", emoji: '🎯', rarity: 'common', maxStack: 5, desc: (n) => `Your first hit on each foe deals +${n * 2} damage.` },
  { id: 'lantern', name: 'Soul Lantern', emoji: '🏮', rarity: 'common', maxStack: 5, desc: (n) => `Every 6 kills, gain +${n} max HP.` },
  { id: 'crown', name: 'Cursed Crown', emoji: '👑', rarity: 'cursed', maxStack: 3, desc: () => `+2 attack, but -3 max HP.` },
  { id: 'pact', name: 'Blood Pact', emoji: '🩸', rarity: 'rare', maxStack: 3, desc: (n) => `At 4 HP or less, deal ${n + 1}x damage.` },
  { id: 'whirl', name: 'Whirling Blade', emoji: '🌀', rarity: 'common', maxStack: 5, desc: (n) => `Your attacks also hit every other adjacent foe for ${n}.` },
  { id: 'pike', name: 'Bone Pike', emoji: '🔱', rarity: 'common', maxStack: 3, desc: (n) => `Attacks pierce ${n} tile${n > 1 ? 's' : ''} behind your target.` },
  { id: 'candle', name: 'Votive Candle', emoji: '🕯️', rarity: 'common', maxStack: 5, desc: (n) => `Heal ${n * 2} HP when you enter a floor.` },
  { id: 'hellfire', name: 'Hellfire Pact', emoji: '☄️', rarity: 'rare', maxStack: 3, desc: (n) => `Entering a floor deals ${n * 2} damage to all foes. You take 1.` },
  { id: 'coin', name: "Ferryman's Coin", emoji: '🪙', rarity: 'rare', maxStack: 1, desc: () => `Relic offerings show 4 choices.` },
  { id: 'dice', name: 'Bone Dice', emoji: '🎲', rarity: 'common', maxStack: 4, desc: (n) => `${n * 15}% chance for hits to deal triple damage.` },
  { id: 'wildfire', name: 'Wildfire', emoji: '🌋', rarity: 'rare', maxStack: 1, desc: () => `Burning foes spread their flames to neighbours when they die.` },
  { id: 'shatter', name: 'Glacial Shatter', emoji: '💎', rarity: 'rare', maxStack: 3, desc: (n) => `Hits on frozen foes deal +${n * 3} damage.` },
  { id: 'conductor', name: 'Iron Conductor', emoji: '⛓️', rarity: 'rare', maxStack: 3, desc: (n) => `Lightning chains to ${n} more foe${n > 1 ? 's' : ''}.` },
  { id: 'mirror', name: 'Mirror Shield', emoji: '🛡️', rarity: 'common', maxStack: 3, desc: (n) => `Block the first ${n} hit${n > 1 ? 's' : ''} on each floor.` },
  { id: 'phylactery', name: 'Phylactery', emoji: '⚱️', rarity: 'rare', maxStack: 1, desc: () => `Once, survive a killing blow at 1 HP.` },
  { id: 'flask', name: 'Ichor Flask', emoji: '🧪', rarity: 'common', maxStack: 3, desc: (n) => `Potions heal ${n * 2} more.` },
  { id: 'harvest', name: 'Grim Harvest', emoji: '🪓', rarity: 'rare', maxStack: 3, desc: (n) => `Each kill grants +${n} attack until the floor ends.` },
  { id: 'echo', name: 'Echo Bell', emoji: '🔔', rarity: 'rare', maxStack: 2, desc: (n) => `Every ${n > 1 ? '3rd' : '4th'} attack strikes twice.` },
  { id: 'necro', name: 'Necrotic Touch', emoji: '🦴', rarity: 'rare', maxStack: 3, desc: (n) => `Slain foes have a ${n * 15}% chance to rise as your thralls.` },
  { id: 'caltrops', name: 'Caltrops', emoji: '🪤', rarity: 'common', maxStack: 2, desc: (n) => `Spike traps can't hurt you and deal +${n * 2} damage to foes.` },
  { id: 'key', name: 'Skeleton Key', emoji: '🗝️', rarity: 'common', maxStack: 1, desc: () => `Iron chests open freely, and each holds a second relic.` },
  { id: 'mask', name: 'Plague Mask', emoji: '🎭', rarity: 'rare', maxStack: 3, desc: (n) => `Foes next to you at the end of your turn take ${n} damage.` },
  { id: 'tome', name: 'Black Tome', emoji: '📕', rarity: 'rare', maxStack: 1, desc: () => `Every 3rd floor you enter grants a random relic.` },
  // Added after launch. New relics go at the end so older runs replay unchanged.
  { id: 'rosary', name: "Saint's Rosary", emoji: '📿', rarity: 'common', maxStack: 3, desc: (n) => `+${n} damage against the undead.` },
  { id: 'idol', name: 'Berserker Idol', emoji: '🗿', rarity: 'common', maxStack: 3, desc: (n) => `+${n} attack while at half health or less.` },
  { id: 'hourglass', name: 'Stopped Hourglass', emoji: '⏳', rarity: 'rare', maxStack: 1, desc: () => `Every 8th turn, time stops: every foe is frozen for a turn.` },
  { id: 'chalice', name: 'Blood Chalice', emoji: '🍷', rarity: 'common', maxStack: 3, desc: (n) => `Resting heals ${n * 2} more and potions heal ${n} more.` },
  { id: 'scale', name: 'Wyrm Scale', emoji: '🐉', rarity: 'common', maxStack: 3, desc: (n) => `Hits on you deal ${n} less damage (never below 1).` },
  // Forbidden relics added after launch.
  { id: 'wisp', name: 'Wisp Lantern', emoji: '👻', rarity: 'rare', maxStack: 3, desc: (n) => `A wisp strikes a random foe for ${n} damage every turn.` },
  { id: 'doom', name: 'Doom Bell', emoji: '🛎️', rarity: 'rare', maxStack: 2, desc: (n) => `Every 10th turn the bell tolls: ${n * 4} damage to every foe.` },
  { id: 'heretic', name: "Heretic's Codex", emoji: '📜', rarity: 'rare', maxStack: 1, desc: () => `Relic offerings show only rare and cursed relics.` },
  { id: 'moon', name: 'Blood Moon', emoji: '🌑', rarity: 'cursed', maxStack: 1, desc: () => `Deal double damage, but every hit on you deals 1 more.` },
];

/** Relics that start locked in Endless and are bought in the Ossuary. */
export const UNLOCKABLE_RELICS: RelicId[] = ['echo', 'necro', 'caltrops', 'key', 'mask', 'tome', 'wisp', 'doom', 'heretic', 'moon'];

/** The relics that existed at launch (run log version 2 and Daily #1). */
export const LEGACY_RELICS: RelicId[] = [
  'fang', 'heart', 'whetstone', 'thorns', 'ember', 'frost', 'storm', 'bloom', 'dust', 'mark', 'lantern', 'crown', 'pact',
  'whirl', 'pike', 'candle', 'hellfire', 'coin', 'dice', 'wildfire', 'shatter', 'conductor', 'mirror', 'phylactery', 'flask',
  'harvest', 'echo', 'necro', 'caltrops', 'key', 'mask', 'tome',
];

// ---------- the Soul Forge ----------
// Two relics fused into one. A fused relic works like several copies of its parts
// (its `grants`), sometimes with a twist of its own, and is never offered.

export interface FusionDef {
  id: FusedId;
  from: [RelicId, RelicId];
  /** Counts as this many of each relic. Ascended relics grant both fused relics they came from, and more. */
  grants: Partial<Record<RelicId, number>>;
  /** 2 for ascended relics, which only the deep forges can make. */
  tier?: 2;
}

/** Forges this deep (after the fourth boss) can also ascend two fused relics. */
export const ASCEND_FLOOR = 21;

export const FUSIONS: FusionDef[] = [
  { id: 'plasma', from: ['ember', 'storm'], grants: { ember: 2, storm: 2, conductor: 1 } },
  { id: 'zero', from: ['frost', 'shatter'], grants: { frost: 2, shatter: 3 } },
  { id: 'vheart', from: ['fang', 'phylactery'], grants: { fang: 3, phylactery: 1 } },
  { id: 'aegis', from: ['thorns', 'mirror'], grants: { thorns: 3, mirror: 2 } },
  { id: 'reaper', from: ['whirl', 'pike'], grants: { whirl: 3, pike: 2 } },
  { id: 'pyre', from: ['bloom', 'wildfire'], grants: { bloom: 3, wildfire: 1, ember: 1 } },
  { id: 'eternal', from: ['candle', 'lantern'], grants: { candle: 3, lantern: 2 } },
  { id: 'fate', from: ['dice', 'mark'], grants: { dice: 3, mark: 3 } },
  { id: 'oath', from: ['pact', 'idol'], grants: { pact: 2, idol: 3 } },
  { id: 'lichbook', from: ['necro', 'harvest'], grants: { necro: 3, harvest: 2 } },
  { id: 'dragon', from: ['heart', 'scale'], grants: { scale: 3 } },
  { id: 'twinblade', from: ['echo', 'whetstone'], grants: { echo: 2, whetstone: 2 } },
  // Ascended. Listed after every fusion so forge choices made before they existed keep their order.
  { id: 'suneater', from: ['plasma', 'pyre'], grants: { plasma: 1, pyre: 1, ember: 2, storm: 2, conductor: 1 }, tier: 2 },
  { id: 'bastion', from: ['zero', 'aegis'], grants: { zero: 1, aegis: 1, frost: 1, shatter: 2, thorns: 2, mirror: 1 }, tier: 2 },
  { id: 'immortal', from: ['vheart', 'eternal'], grants: { vheart: 1, eternal: 1, fang: 2, candle: 2, lantern: 1 }, tier: 2 },
  { id: 'wager', from: ['fate', 'oath'], grants: { fate: 1, oath: 1, dice: 1, mark: 2, pact: 1, idol: 2 }, tier: 2 },
  { id: 'thousand', from: ['reaper', 'twinblade'], grants: { reaper: 1, twinblade: 1, whirl: 2, pike: 1, whetstone: 3 }, tier: 2 },
  { id: 'dracolich', from: ['lichbook', 'dragon'], grants: { lichbook: 1, dragon: 1, necro: 1, harvest: 2, scale: 2 }, tier: 2 },
];

export const FUSED_RELICS: RelicDef[] = [
  { id: 'plasma', name: 'Plasma Brand', emoji: '🌩️', rarity: 'fused', maxStack: 1, desc: () => 'Burns like 2 Ember Brands, strikes like 2 Storm Runes, and its lightning chains and sets foes ablaze.' },
  { id: 'zero', name: 'Absolute Zero', emoji: '🧊', rarity: 'fused', maxStack: 1, desc: () => 'Hits freeze foes for 2 turns, and hits on frozen foes deal +9 damage.' },
  { id: 'vheart', name: "Vampire Lord's Heart", emoji: '🧛', rarity: 'fused', maxStack: 1, desc: () => 'Heal 3 HP on each kill. Survive a killing blow at full HP, once per boss floor.' },
  { id: 'aegis', name: 'Thorned Aegis', emoji: '🌹', rarity: 'fused', maxStack: 1, desc: () => 'Block the first 2 hits on each floor. Foes that strike you take 3 damage.' },
  { id: 'reaper', name: "Reaper's Scythe", emoji: '☠️', rarity: 'fused', maxStack: 1, desc: () => 'Attacks hit every other adjacent foe for 3 and pierce 2 tiles behind your target.' },
  { id: 'pyre', name: 'Funeral Pyre', emoji: '🎆', rarity: 'fused', maxStack: 1, desc: () => 'Your hits burn, slain foes burst for 3, and burning foes spread their flames when they die.' },
  { id: 'eternal', name: 'Eternal Flame', emoji: '🪔', rarity: 'fused', maxStack: 1, desc: () => 'Heal 6 HP on each new floor. Every 6 kills, gain +2 max HP.' },
  { id: 'fate', name: "Fate's Edge", emoji: '🃏', rarity: 'fused', maxStack: 1, desc: () => '45% chance for hits to deal triple damage. Your first hit on each foe deals +6.' },
  { id: 'oath', name: "Berserker's Oath", emoji: '😈', rarity: 'fused', maxStack: 1, desc: () => '+3 attack at half health or less, and triple damage at 4 HP or less.' },
  { id: 'lichbook', name: 'Book of the Dead', emoji: '📖', rarity: 'fused', maxStack: 1, desc: () => 'Slain foes have a 45% chance to rise as thralls. Each kill grants +2 attack until the floor ends.' },
  { id: 'dragon', name: 'Dragonheart', emoji: '🐲', rarity: 'fused', maxStack: 1, desc: () => '+6 max HP when forged. Hits on you deal 3 less damage (never below 1).' },
  { id: 'twinblade', name: 'Twin Blade', emoji: '⚔️', rarity: 'fused', maxStack: 1, desc: () => '+2 attack, and every 3rd attack strikes twice.' },
  { id: 'suneater', name: 'Sun Eater', emoji: '☀️', rarity: 'ascended', maxStack: 1, desc: () => 'Plasma Brand and Funeral Pyre in one, plus 2 more Ember Brands, 2 more Storm Runes and a longer lightning chain.' },
  { id: 'bastion', name: 'Glacier Bastion', emoji: '🏔️', rarity: 'ascended', maxStack: 1, desc: () => 'Absolute Zero and Thorned Aegis in one: block 3 hits a floor, freeze for 3 turns, +15 damage to frozen foes, 5 thorns.' },
  { id: 'immortal', name: 'Immortal Heart', emoji: '💖', rarity: 'ascended', maxStack: 1, desc: () => "Vampire Lord's Heart and Eternal Flame in one: heal 5 per kill, 10 per floor, and rise again at full HP every boss floor." },
  { id: 'wager', name: "Death's Wager", emoji: '⚰️', rarity: 'ascended', maxStack: 1, desc: () => "Fate's Edge and Berserker's Oath in one: 60% triple hits, +10 on first strikes, and fury when wounded." },
  { id: 'thousand', name: 'Thousand Cuts', emoji: '🌪️', rarity: 'ascended', maxStack: 1, desc: () => "Reaper's Scythe and Twin Blade in one: +5 attack, every 3rd attack strikes twice, 5 damage sweeps around you and attacks pierce 3 tiles." },
  { id: 'dracolich', name: 'Dracolich', emoji: '👁️', rarity: 'ascended', maxStack: 1, desc: () => '+10 max HP when forged. Book of the Dead and Dragonheart in one: 60% of the slain rise, +4 attack per kill, 5 less damage taken.' },
];

export const FUSION_BY_ID = Object.fromEntries(FUSIONS.map((f) => [f.id, f])) as Record<FusedId, FusionDef>;

export const RELIC_BY_ID: Record<RelicId, RelicDef> = Object.fromEntries(
  [...RELICS, ...FUSED_RELICS].map((r) => [r.id, r]),
) as Record<RelicId, RelicDef>;

/** Relic counts plus everything fused and ascended relics grant, e.g. for drawing the hero. */
export function withFusions(relics: Partial<Record<RelicId, number>>): Partial<Record<RelicId, number>> {
  const out = { ...relics };
  // An ascended relic grants fused relics, which grant base relics in turn.
  const open = FUSIONS.filter((f) => relics[f.id]).map((f) => f.id);
  while (open.length) {
    const f = FUSION_BY_ID[open.pop()!];
    for (const [id, n] of Object.entries(f.grants)) {
      out[id as RelicId] = (out[id as RelicId] ?? 0) + (n ?? 0);
      if (FUSION_BY_ID[id as FusedId]) open.push(id as FusedId);
    }
  }
  return out;
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 4, cursed: 5, fused: 0, ascended: 0 };
