// What Crypt Race gives besides Souls. Racing earns Laurels, and Laurels unlock two kinds of
// cosmetic found nowhere else in the game:
//   - trails: what your hero leaves behind as they walk (dust, embers, lightning, stars)
//   - finishers: how a foe you slay bursts apart (coins, a swarm of bats, a soul-fire, confetti)
// plus two titles. Looks only, never power. Equipped in the Wardrobe; they show in every mode.

export type PrizeKind = 'trail' | 'finisher' | 'title';

export interface RacePrize {
  kind: PrizeKind;
  id: string;
  name: string;
  /** Laurels needed. */
  at: number;
  emoji: string;
  desc: string;
}

/** Laurels: 3 for winning a race against players, 1 for finishing one, 1 for beating a ghost. */
export const LAURELS = { liveWin: 3, liveFinish: 1, ghostWin: 1 };

export const RACE_PRIZES: RacePrize[] = [
  { kind: 'trail', id: 'dust', name: 'Dust Kick', at: 2, emoji: '💨', desc: 'Puffs of grave dust at your heels.' },
  { kind: 'finisher', id: 'coins', name: 'Gold Burst', at: 5, emoji: '🪙', desc: 'The foes you slay burst into a shower of coins.' },
  { kind: 'title', id: 'race:10', name: 'Quickfoot', at: 10, emoji: '📜', desc: 'A title for your name.' },
  { kind: 'trail', id: 'ember', name: 'Ember Step', at: 15, emoji: '🔥', desc: 'Every step leaves a lick of flame.' },
  { kind: 'finisher', id: 'bats', name: 'Bat Swarm', at: 22, emoji: '🦇', desc: 'The foes you slay scatter into bats.' },
  { kind: 'trail', id: 'lightning', name: 'Lightning Stride', at: 30, emoji: '⚡', desc: 'Sparks crackle along the stones you cross.' },
  { kind: 'finisher', id: 'soulfire', name: 'Soul-Fire', at: 40, emoji: '💠', desc: 'The foes you slay go up in a column of blue fire.' },
  { kind: 'trail', id: 'stars', name: 'Starfall', at: 55, emoji: '✨', desc: 'A wake of falling stars.' },
  { kind: 'finisher', id: 'confetti', name: 'Victory Lap', at: 75, emoji: '🎉', desc: 'The foes you slay pop like party crackers. Insufferable.' },
  { kind: 'title', id: 'race:100', name: 'The Unoutrun', at: 100, emoji: '👑', desc: 'A golden title for your name.' },
];

export const TRAILS = RACE_PRIZES.filter((p) => p.kind === 'trail');
export const FINISHERS = RACE_PRIZES.filter((p) => p.kind === 'finisher');
