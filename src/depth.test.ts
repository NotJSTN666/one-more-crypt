import { describe, expect, it } from 'vitest';
import { DEPTHS, depthAt, depthRange, depthY } from './depth';
import { REAPER_FLOOR } from './game';

describe('the depths', () => {
  it('names every floor, with the breaks where the game changes', () => {
    expect(depthAt(1).name).toBe('The Shallows');
    expect(depthAt(20).id).toBe('shallows');
    expect(depthAt(21).id).toBe('deep');
    expect(depthAt(100).id).toBe('deep');
    expect(depthAt(101).id).toBe('underdeep');
    // Death's Reach starts where Death starts hunting
    expect(depthAt(REAPER_FLOOR + 1).id).toBe('reach');
    expect(depthAt(REAPER_FLOOR).id).toBe('underdeep');
    expect(depthAt(300).id).toBe('reach');
    expect(depthAt(301).id).toBe('bottomless');
    expect(depthAt(99999).id).toBe('bottomless');
    expect(depthRange(DEPTHS[1])).toBe('Floors 21-100');
    expect(depthRange(DEPTHS[4])).toBe('Floors 301+');
  });

  it('draws deeper floors lower, every depth the same height, never off the bottom', () => {
    let last = 0;
    for (const f of [1, 2, 10, 20, 21, 60, 100, 101, 150, 151, 220, 300, 301, 400, 2000]) {
      const y = depthY(f);
      expect(y).toBeGreaterThan(last);
      last = y;
    }
    const band = depthY(100.999) - depthY(20.999);
    expect(Math.abs(depthY(20.999) - depthY(0.999) - band)).toBeLessThan(1);
    expect(depthY(1e9)).toBeLessThanOrEqual(170);
  });
});
