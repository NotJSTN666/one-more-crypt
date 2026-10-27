import { describe, expect, it } from 'vitest';
import { Game, HORDE_DEATH_WAVE, HORDE_GIFT_EVERY, fullPool } from './game';
import { mulberry32 } from './rng';
import { hordeHero, dailyHero } from './content';

const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Plays toward the nearest foe, taking the first offer. */
function play(seed: number, maxSteps = 3000) {
  const g = new Game('horde', seed, 15, { hero: 'barbarian', pool: fullPool(), mercy: true, boons: true });
  const rng = mulberry32(seed);
  for (let s = 0; s < maxSteps && g.phase !== 'dead'; s++) {
    if (g.phase === 'choose') g.choose(0);
    else {
      const p = g.player;
      const t = g.alive.find((e) => !e.ally);
      const d = t ? DIRS.find(([dx, dy]) => Math.abs(p.x + dx - t.x) + Math.abs(p.y + dy - t.y) < Math.abs(p.x - t.x) + Math.abs(p.y - t.y)) : undefined;
      if (!(d && g.act(...d))) g.act(...(DIRS[Math.floor(rng() * 4)] ?? [0, 0]));
    }
  }
  return g;
}

describe('Horde', () => {
  it('starts in an empty arena with gifts, and the first wave comes in two turns', () => {
    const g = new Game('horde', 3, 15, { hero: 'knight', pool: fullPool(), mercy: true, boons: true });
    expect(g.alive.length).toBe(0);
    expect(g.relicLog.length).toBe(2);
    g.act(0, 0);
    expect(g.horde.wave).toBe(0);
    g.act(0, 0);
    expect(g.horde.wave).toBe(1);
    expect(g.alive.length).toBeGreaterThan(0);
  });

  it('scores kills, offers relics between waves without leaving the arena, and replays exactly', () => {
    const g = play(77);
    expect(g.horde.wave).toBeGreaterThanOrEqual(HORDE_GIFT_EVERY);
    expect(g.kills).toBeGreaterThan(0);
    expect(g.horde.score).toBeGreaterThan(g.kills * 10 - 1);
    expect(g.relicLog.length).toBeGreaterThan(2);
    const again = Game.replay('horde', 77, 15, g.header() + g.log);
    expect([again.horde.wave, again.horde.score, again.kills, again.phase]).toEqual([g.horde.wave, g.horde.score, g.kills, g.phase]);
  });

  it('brings Death into the arena from his wave', () => {
    const g = new Game('horde', 5, 15, { hero: 'knight', pool: fullPool(), mercy: true, boons: true });
    g.horde.wave = HORDE_DEATH_WAVE - 1;
    g.horde.next = 1;
    g.act(0, 0);
    expect(g.horde.wave).toBe(HORDE_DEATH_WAVE);
    expect(g.reaper).not.toBeNull();
  });

  it("plays a different hero from the Daily's", () => {
    for (let n = 1; n < 30; n++) expect(hordeHero(n)).not.toBe(dailyHero(n));
  });
});
