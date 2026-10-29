import { describe, expect, it } from 'vitest';
import { Game, fullPool, type RunConfig } from './game';
import { hashSeed } from './rng';

type Inner = { walls: boolean[]; enemies: { x: number; y: number; dead: boolean; ally?: boolean; hp: number; kind: string }[] };

/** A clear row: the Ranger at (0,3), a thrall at (1,3), a foe at (2,3). */
function lineUp(config: Partial<RunConfig>) {
  const g = new Game('endless', 77, 0, { hero: 'ranger', pool: fullPool(), ...config });
  const inner = g as unknown as Inner;
  for (const e of g.enemies) e.dead = true;
  for (let x = 0; x < 7; x++) inner.walls[3 * 7 + x] = false;
  g.player.x = 0;
  g.player.y = 3;
  const foe = g.enemies.find((e) => !e.ally)!;
  foe.dead = false;
  foe.x = 2;
  foe.y = 3;
  const thrall = { ...foe, id: 999, x: 1, y: 3, ally: true, dead: false };
  g.enemies.push(thrall as never);
  return { g, foe, thrall };
}

describe("the Ranger's volley", () => {
  it('shoots over your own thralls', () => {
    const { g, foe } = lineUp({ volley: true });
    expect(g.bowTarget(1, 0)).toBe(foe);
  });

  it('is blocked by them under the old rules', () => {
    const { g } = lineUp({});
    expect(g.bowTarget(1, 0)).toBeUndefined();
  });

  it('can lower the bow to step instead of shooting', () => {
    const { g, foe, thrall } = lineUp({ volley: true });
    thrall.dead = true;
    foe.x = 3;
    expect(g.toggleBow()).toBe(true);
    const hp = foe.hp;
    g.act(1, 0);
    expect(g.player.x).toBe(1);
    expect(foe.hp).toBe(hp);
    expect(g.log).toBe('oR');
  });

  it('only lets the Ranger lower a bow, and only with the volley', () => {
    expect(new Game('endless', 1, 0, { hero: 'knight', pool: fullPool(), volley: true }).toggleBow()).toBe(false);
    expect(new Game('endless', 1, 0, { hero: 'ranger', pool: fullPool() }).toggleBow()).toBe(false);
  });
});

describe('version 17 runs rebuild exactly', () => {
  const play = (g: Game, seed: number) => {
    let r = seed;
    const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let t = 0; t < 600 && g.phase !== 'dead'; t++) {
      if (g.phase === 'choose') g.choose(Math.floor(rnd() * 3) - 1);
      else if (g.phase === 'event') g.resolveEvent(rnd() < 0.5);
      else {
        if (rnd() < 0.05) g.toggleBow();
        const d = [[0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]][Math.floor(rnd() * 5)];
        g.act(d[0], d[1]);
      }
    }
  };
  const same = (g: Game) => {
    const re = Game.replay(g.mode, g.seed, g.dailyNo, g.header() + g.log);
    expect([re.floor, re.turns, re.kills, re.player.hp, re.relicLog.join(), re.bowDown]).toEqual([g.floor, g.turns, g.kills, g.player.hp, g.relicLog.join(), g.bowDown]);
    return re;
  };

  it('in Endless, with the bow lowered and raised', () => {
    for (let i = 0; i < 6; i++) {
      const g = new Game('endless', 300 + i, 0, { hero: 'ranger', pool: fullPool(), forge: true, mercy: true, depths: true, boons: true, reaper: true, deep: true, lurk: true, volley: true });
      play(g, i + 1);
      expect(g.header().startsWith('#17|')).toBe(true);
      const re = same(g);
      // An Endless run at version 17 doesn't pick up the Horde's rules.
      expect(re.config.surge).toBeUndefined();
    }
  });

  it('in the Horde, which keeps its rules', () => {
    for (let n = 50; n < 54; n++) {
      const g = new Game('horde', hashSeed('horde', n), n, { hero: 'ranger', pool: fullPool(), mercy: true, boons: true, surge: true, waves: true, magnet: true, armory: true, arsenal: true, volley: true });
      play(g, n);
      const re = same(g);
      expect(re.horde.score).toBe(g.horde.score);
      expect(re.config.arsenal).toBe(true);
    }
  });

  it('while older Horde logs still replay under the Horde rules', () => {
    const g = new Game('horde', hashSeed('horde', 9), 9, { hero: 'knight', pool: fullPool(), mercy: true, boons: true, surge: true, waves: true, magnet: true, armory: true, arsenal: true });
    play(g, 9);
    expect(g.header().startsWith('#16|')).toBe(true);
    expect(Game.replay('horde', g.seed, 9, g.header() + g.log).horde.score).toBe(g.horde.score);
  });
});
