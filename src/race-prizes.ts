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
  /** Laurels needed (race prizes; 0 for the Daily podium's). */
  at: number;
  /** Daily podium prizes: finish in this place in a Daily Descent... */
  podium?: 1 | 2 | 3;
  /** ...or win this many Daily Descents. */
  wins?: number;
  /** How a podium prize is earned, for the Wardrobe. */
  how?: string;
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

/**
 * Trails and finishers only the Daily Descent's top three can wear: one for each place, and one
 * for winning three. They can't be raced for or bought.
 */
export const PODIUM_PRIZES: RacePrize[] = [
  { kind: 'finisher', id: 'crowning', name: 'Crowning Blow', at: 0, podium: 1, emoji: '👑', desc: 'Every foe you slay leaves a little gold crown rising from where it fell.', how: 'Finish 1st in a Daily Descent.' },
  { kind: 'trail', id: 'quicksilver', name: 'Quicksilver', at: 0, podium: 2, emoji: '🥈', desc: 'You move so fast you leave silver afterimages behind.', how: 'Finish 2nd in a Daily Descent.' },
  { kind: 'trail', id: 'bronze', name: 'Bronze Bell', at: 0, podium: 3, emoji: '🔔', desc: 'Each step rings out in a ripple of bronze.', how: 'Finish 3rd in a Daily Descent.' },
  { kind: 'trail', id: 'royal', name: 'Royal Procession', at: 0, wins: 3, emoji: '🎺', desc: 'A red carpet with a gold edge rolls out under your feet.', how: 'Win 3 Daily Descents.' },
];

/** Every trail and finisher, from both. */
export const ALL_PRIZES = [...RACE_PRIZES, ...PODIUM_PRIZES];
export const TRAILS = ALL_PRIZES.filter((p) => p.kind === 'trail');
export const FINISHERS = ALL_PRIZES.filter((p) => p.kind === 'finisher');
