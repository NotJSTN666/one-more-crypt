import { describe, expect, it } from 'vitest';
import { ghostOrder, ghostTarget } from './ghost-match';

const runs = (...floors: number[]) => floors.map((floor, i) => ({ floor, id: i }));

describe('ghost matching', () => {
  it('aims a little past your best, and at floor 9 with no best', () => {
    expect(ghostTarget(20)).toBe(23);
    expect(ghostTarget(0)).toBe(9);
  });
  it('tries the runs nearest your level first', () => {
    const order = ghostOrder(runs(5, 60, 24, 18, 30, 110), 20, () => 0.5).map((g) => g.floor);
    expect(order.slice(0, 3)).toEqual([24, 18, 30]);
    expect(order.slice(3).sort((a, b) => a - b)).toEqual([5, 60, 110]);
  });
  it('a new player meets an early-floor ghost, not a deep one', () => {
    expect(ghostOrder(runs(40, 9, 70, 7), 0, () => 0.5).at(0)?.floor).toBe(9);
  });
});
