import { describe, expect, it } from 'vitest';
import { flameTier, flameView } from './streak-flame';
import type { StreakStats } from './storage';

const stats = (o: Partial<StreakStats>): StreakStats => ({ current: 0, best: 0, last: 0, count: 0, wards: 0, total: 0, ...o });

describe('streak flame', () => {
  it('shows nothing before the first Daily', () => {
    expect(flameView(stats({}), 100)).toBeNull();
  });
  it('is lit once today is played', () => {
    const v = flameView(stats({ current: 4, best: 4, last: 100, count: 4, total: 4 }), 100)!;
    expect(v.state).toBe('lit');
    expect(v.days).toBe(4);
    expect(v.line).toMatch(/5 days/);
    expect(v.wardIn).toBe(3);
  });
  it('burns low when yesterday was the last Daily', () => {
    expect(flameView(stats({ current: 4, last: 99, count: 4, total: 4 }), 100)!.state).toBe('low');
  });
  it('is kept by a Grave Ward after a missed day', () => {
    expect(flameView(stats({ current: 8, last: 98, count: 8, wards: 1, total: 8 }), 100)!.state).toBe('warded');
  });
  it('goes out when the streak is broken', () => {
    const v = flameView(stats({ current: 0, best: 9, last: 90, count: 9, total: 12 }), 100)!;
    expect(v.state).toBe('out');
    expect(v.line).toMatch(/best: 9 days/);
  });
  it('grows with the streak', () => {
    expect([1, 2, 3, 6, 7, 13, 14, 29, 30, 99].map(flameTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
