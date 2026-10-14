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
  // Unlocked in the Ossuary (always in the daily pool)
  | 'echo'
  | 'necro'
  | 'caltrops'
  | 'key'
  | 'mask'
  | 'tome';

export type Rarity = 'common' | 'rare' | 'cursed';

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
];

/** Relics that start locked in Endless and are bought in the Ossuary. */
export const UNLOCKABLE_RELICS: RelicId[] = ['echo', 'necro', 'caltrops', 'key', 'mask', 'tome'];

export const RELIC_BY_ID: Record<RelicId, RelicDef> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
) as Record<RelicId, RelicDef>;

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 4, cursed: 5 };
