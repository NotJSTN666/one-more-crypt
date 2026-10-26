import { describe, expect, it } from 'vitest';
import { Game, REAPER_FLOOR, fullPool, reaperDelay, type RunConfig } from './game';

const config = (reaper: boolean): RunConfig => ({ hero: 'knight', pool: fullPool(), forge: true, mercy: true, depths: true, boons: true, ...(reaper ? { reaper } : {}) });

/** A game dropped onto a deep floor, with every foe gone so only Death matters. */
function deep(floor: number, reaper = true): Game {
  const g = new Game('endless', 42, 0, config(reaper));
  (g as unknown as { enterFloor(f: number): void }).enterFloor(floor);
  for (const e of g.enemies) e.dead = true;
  g.enemies = [];
  return g;
}

describe('Death', () => {
  it('rises later the shallower you are, and right away from floor 250', () => {
    expect(reaperDelay(REAPER_FLOOR)).toBe(25);
    expect(reaperDelay(200)).toBe(13);
    expect(reaperDelay(250)).toBe(0);
  });

  it('logs as version 9 and replays with Death', () => {
    const g = new Game('endless', 9, 0, config(true));
    expect(g.header()).toMatch(/^#9\|/);
    expect(Game.parseLog(g.header() + 'W').config.reaper).toBe(true);
    expect(Game.parseLog('#8|knight||0|W').config.reaper).toBeUndefined();
  });

  it('never comes for runs made before him, or above floor 150', () => {
    const old = deep(200, false);
    for (let i = 0; i < 40; i++) old.act(0, 0);
    expect(old.reaper).toBeNull();
    const shallow = deep(REAPER_FLOOR - 1);
    for (let i = 0; i < 40; i++) shallow.act(0, 0);
    expect(shallow.reaper).toBeNull();
  });

  it('rises in the far corner, walks through walls and kills on touch, shields or not', () => {
    const g = deep(REAPER_FLOOR);
    (g as unknown as { shieldCharges: number }).shieldCharges = 5;
    for (let i = 0; i < reaperDelay(REAPER_FLOOR) - 1; i++) g.act(0, 0);
    expect(g.reaper).toBeNull();
    g.act(0, 0);
    expect(g.reaper).not.toBeNull();
    const d0 = Math.abs(g.reaper!.x - g.player.x) + Math.abs(g.reaper!.y - g.player.y);
    expect(d0).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < 20 && g.phase !== 'dead'; i++) g.act(0, 0);
    expect(g.phase).toBe('dead');
    expect(g.killedBy).toBe('Death');
  });
});
