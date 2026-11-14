// Companions: small creatures that follow the hero in the Daily and Endless. Looks only. Four
// come from bringing friends (one at random per friend); the rest are sold for Souls in the
// Ossuary. Each borrows a creature's art, sometimes in its own colour. (The story's Crypt Hound
// is its own thing: id 'hound', earned in the kennels.)

import type { EnemyKind } from './game';

export interface Companion {
  id: string;
  /** Whose art it wears. */
  kind: EnemyKind;
  emoji: string;
  name: string;
  desc: string;
  /** Souls in the Ossuary; none for the ones friends bring. */
  cost?: number;
  /** A colour washed over the art, for a variant. */
  tint?: string;
}

export const COMPANIONS: Companion[] = [
  { id: 'bat', kind: 'bat', emoji: '🦇', name: 'Belfry Bat', desc: 'Flits along at your shoulder.' },
  { id: 'imp', kind: 'imp', emoji: '😈', name: 'Cinder Imp', desc: 'Small, smug, and on your side for once.' },
  { id: 'wraith', kind: 'wraith', emoji: '👻', name: 'Lost Wisp', desc: 'A little ghost that took a liking to you.' },
  { id: 'voideye', kind: 'voideye', emoji: '👁️', name: 'Watchful Eye', desc: 'It blinks. It follows. It means well.' },
  { id: 'ghoulpup', kind: 'ghoul', emoji: '🧟', name: 'Tame Ghoul', desc: 'Housebroken, mostly.', cost: 1500 },
  { id: 'thrall', kind: 'thrall', emoji: '💀', name: 'Loyal Thrall', desc: 'A skeleton that carries your bags and asks for nothing.', cost: 2000 },
  { id: 'drowned', kind: 'drowned', emoji: '💧', name: 'Soggy Friend', desc: 'Leaves little puddles wherever you go.', cost: 2500 },
  { id: 'squire', kind: 'boneknight', emoji: '🛡️', name: 'Squire of Bone', desc: 'Sworn to you. Takes it very seriously.', cost: 3500 },
  { id: 'brute', kind: 'brute', emoji: '👹', name: 'Gentle Brute', desc: 'Would not hurt a fly. Could, though.', cost: 4000 },
  { id: 'ghosthound', kind: 'hound', emoji: '🐕', name: 'Ghost Hound', desc: 'A good dog from the other side.', cost: 5000, tint: '#7fd8ff' },
  { id: 'goldbat', kind: 'bat', emoji: '🦇', name: 'Gilded Bat', desc: 'Dipped in gold. Insufferable about it.', cost: 8000, tint: '#f2c14e' },
  { id: 'lich', kind: 'lich', emoji: '🧙', name: 'Pocket Lich', desc: 'An ancient evil, travel size.', cost: 12000 },
];

export const COMPANION_BY_ID: Record<string, Companion> = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));
/** The ones a counted invite can bring. */
export const INVITE_COMPANIONS = COMPANIONS.filter((c) => !c.cost);
/** The ones sold in the Ossuary, cheapest first. */
export const SHOP_COMPANIONS = COMPANIONS.filter((c) => c.cost).sort((a, b) => a.cost! - b.cost!);
