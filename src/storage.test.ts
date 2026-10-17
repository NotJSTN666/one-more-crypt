import { describe, expect, it } from 'vitest';
import { streakStats, type Save } from './storage';

const r = { floor: 1, kills: 0, turns: 0, relics: '', killedBy: '' };
const saveWith = (days: number[], legacy = { last: 0, count: 0 }) =>
  ({ daily: Object.fromEntries(days.map((d) => [d, r])), streak: legacy }) as unknown as Save;

describe('daily streak', () => {
  it('counts days in a row, alive through yesterday', () => {
    const s = saveWith([1, 2, 4, 5, 6]);
    expect(streakStats(s, 6)).toMatchObject({ current: 3, best: 3, last: 6 });
    expect(streakStats(s, 7).current).toBe(3); // today not played yet
    expect(streakStats(s, 8).current).toBe(0); // missed a day
  });

  it('keeps the best streak after it breaks', () => {
    expect(streakStats(saveWith([1, 2, 3, 4, 5, 9]), 9)).toMatchObject({ current: 1, best: 5 });
  });

  it('respects an older save that only kept a counter', () => {
    expect(streakStats(saveWith([10], { last: 10, count: 6 }), 10)).toMatchObject({ current: 6, best: 6 });
  });
});
