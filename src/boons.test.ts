import { describe, expect, it } from 'vitest';
import { BOONS, Game, basePool } from './game';
import { mulberry32 } from './rng';

const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]];

/** A run whose relic pool is empty, so every offer is Abyss boons. Plays until a few have been taken. */
function play(seed: number) {
  const g = new Game('endless', seed, 0, { hero: 'knight', pool: [], forge: true, mercy: true, depths: true, boons: true });
  const rng = mulberry32(seed);
  for (let s = 0; s < 20000 && g.phase !== 'dead' && g.floor < 9; s++) {
    if (g.phase === 'choose') {
      expect(g.offer!.relics.length).toBe(0);
      expect(g.offer!.boons.length).toBe(3);
      g.choose(Math.floor(rng() * 3));
    } else if (g.phase === 'event') g.resolveEvent(false);
    else {
      const p = g.player;
      const t = g.alive[0] ?? (g.stairsOpen ? g.stairs : null);
      const d = t ? DIRS.find(([dx, dy]) => Math.abs(p.x + dx - t.x) + Math.abs(p.y + dy - t.y) < Math.abs(p.x - t.x) + Math.abs(p.y - t.y)) : undefined;
      if (!(d && g.act(...d))) g.act(...DIRS[Math.floor(rng() * 5)]);
    }
  }
  return g;
}

describe('Abyss boons', () => {
  it('fill the offer once relics run out, and replay exactly from the log', () => {
    const g = play(4242);
    const taken = Object.values(g.boons).reduce((a, b) => a + b, 0);
    expect(taken).toBeGreaterThan(0);
    for (const b of BOONS) if (b.max) expect(g.boons[b.id]).toBeLessThanOrEqual(b.max);
    expect(g.header().startsWith('#8|knight||0|')).toBe(true);
    // The header says boons are on (the empty test pool itself isn't recorded in it).
    expect(Game.parseLog(g.header() + g.log).config.boons).toBe(true);
    const again = new Game('endless', 4242, 0, { hero: 'knight', pool: [], forge: true, mercy: true, depths: true, boons: true });
    const moves: Record<string, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
    for (const ch of g.log) {
      if (moves[ch]) again.act(...moves[ch]);
      else if (ch === 'r') again.choose(-1);
      else if (ch === 'a' || ch === 'x') again.resolveEvent(ch === 'a');
      else again.choose(Number(ch));
    }
    expect(again.boons).toEqual(g.boons);
    expect([again.floor, again.kills, again.turns]).toEqual([g.floor, g.kills, g.turns]);
  });

  it('a real Endless run with boons on replays from its own log', () => {
    const g = new Game('endless', 777, 0, { hero: 'rogue', pool: basePool([]), forge: true, mercy: true, depths: true, boons: true });
    const rng = mulberry32(777);
    for (let s = 0; s < 3000 && g.phase !== 'dead'; s++) {
      if (g.phase === 'choose') g.choose(Math.floor(rng() * 3));
      else if (g.phase === 'event') g.resolveEvent(rng() < 0.5);
      else g.act(...DIRS[Math.floor(rng() * 5)]);
    }
    const again = Game.replay('endless', 777, 0, g.header() + g.log);
    expect([again.floor, again.kills, again.turns, again.phase]).toEqual([g.floor, g.kills, g.turns, g.phase]);
  });

  it('Abyssal Edge adds attack', () => {
    const g = new Game('endless', 1, 0, { hero: 'knight', pool: [], boons: true });
    const before = g.atk;
    g.boons.edge = 3;
    expect(g.atk).toBe(before + 3);
  });
});
