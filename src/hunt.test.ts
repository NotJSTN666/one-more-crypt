import { describe, expect, it, vi } from 'vitest';
import { Game, HUNT_REAPER_FLOOR, REAPER_FLOOR, fullPool, reaperDelay } from './game';

const base = { hero: 'knight' as const, pool: fullPool(), forge: true, mercy: true, depths: true, boons: true, reaper: true, deep: true, lurk: true, volley: true, fair: true, lean: true, missile: true };

describe('the Hunt (the Daily from #46)', () => {
  it('Death walks from floor 60 in the Hunt, 150 otherwise', () => {
    expect(new Game('daily', 7, 46, { ...base, hunt: true }).reaperFloor()).toBe(HUNT_REAPER_FLOOR);
    expect(new Game('endless', 7, 0, base).reaperFloor()).toBe(REAPER_FLOOR);
  });

  it("Death's countdown shrinks twice as fast in the Hunt", () => {
    expect(reaperDelay(60, true)).toBe(25);
    expect(reaperDelay(80, true)).toBe(15);
    expect(reaperDelay(110, true)).toBe(0);
    expect(reaperDelay(150)).toBe(25);
  });

  it('the run log carries the Hunt, and Endless runs do not', () => {
    const hunt = new Game('daily', 7, 46, { ...base, hunt: true });
    expect(hunt.header().startsWith('#21|')).toBe(true);
    expect(Game.parseLog(hunt.header() + 'W', 'daily').config.hunt).toBe(true);
    expect(new Game('endless', 7, 0, base).header().startsWith('#20|')).toBe(true);
    expect(Game.parseLog(new Game('endless', 7, 0, base).header(), 'endless').config.hunt).toBeUndefined();
  });

  it('foes past floor 30 are much tougher, and no different before', () => {
    const hp = (hunt: boolean, floor: number) => {
      const g = new Game('daily', 7, 46, { ...base, hunt }) as unknown as { enterFloor(f: number): void; enemies: { hp: number; kind: string }[] };
      g.enterFloor(floor);
      return g.enemies.filter((e) => e.kind === 'ghoul').map((e) => e.hp)[0] ?? g.enemies[0].hp;
    };
    expect(hp(true, 20)).toBe(hp(false, 20));
    expect(hp(true, 50)).toBeGreaterThan(hp(false, 50) * 1.8);
  });
});
