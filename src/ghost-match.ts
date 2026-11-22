// Which ghost to race: a recorded run near the player's own best, a little ahead of it, so the
// race is close. Runs far from it come last, in a random order, as a fallback.

/** The floor a fair ghost reaches: a touch past your best Endless floor (floor 8 if you have none). */
export function ghostTarget(best: number): number {
  return Math.round(Math.max(8, best) * 1.15);
}

/**
 * Candidates in the order to try them: those within the band round the target first (closest
 * first, ties shuffled), then the rest at random. `rand` is injectable for tests.
 */
export function ghostOrder<T extends { floor: number }>(all: T[], best: number, rand: () => number = Math.random): T[] {
  const target = ghostTarget(best);
  const lo = target * 0.7, hi = target * 1.4;
  const keyed = all.map((g) => ({ g, near: g.floor >= lo && g.floor <= hi, d: Math.abs(g.floor - target), r: rand() }));
  return keyed
    .sort((a, b) => (a.near === b.near ? (a.near ? a.d - b.d || a.r - b.r : a.r - b.r) : a.near ? -1 : 1))
    .map((k) => k.g);
}
