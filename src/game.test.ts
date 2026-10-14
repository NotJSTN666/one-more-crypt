import { describe, expect, it } from 'vitest';
import { Game, H, W, type Pos } from './game';
import { descentStrip } from './share';

const DIRS: Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Simple greedy bot: attack if adjacent, otherwise walk toward the nearest foe or the stairs. */
function botStep(g: Game) {
  const p = g.player;
  for (const d of DIRS) {
    if (g.enemyAt(p.x + d.x, p.y + d.y)) return g.act(d.x, d.y);
  }
  const goals = g.stairsOpen ? [g.stairs] : g.alive.map((e) => ({ x: e.x, y: e.y }));
  let best: Pos | null = null;
  let bestD = Infinity;
  for (const goal of goals) {
    const dist = g.distanceMap(goal, false);
    for (const d of DIRS) {
      const nx = p.x + d.x;
      const ny = p.y + d.y;
      if (!g.inBounds(nx, ny) || g.isWall(nx, ny)) continue;
      const v = dist[ny * W + nx];
      if (v >= 0 && v < bestD) {
        bestD = v;
        best = d;
      }
    }
  }
  if (best && g.act(best.x, best.y)) return true;
  return g.act(0, 0);
}

function playOut(seed: number, maxTurns = 3000): Game {
  const g = new Game('endless', seed);
  for (let i = 0; i < maxTurns && g.phase !== 'dead'; i++) {
    if (g.phase === 'choose') g.choose(g.offer?.relics.length ? 0 : -1);
    else botStep(g);
    g.events.length = 0;
  }
  return g;
}

describe('Game', () => {
  it('generates identical floors for the same seed', () => {
    const a = new Game('daily', 1234, 1);
    const b = new Game('daily', 1234, 1);
    expect(a.walls).toEqual(b.walls);
    expect(a.enemies.map((e) => [e.kind, e.x, e.y])).toEqual(b.enemies.map((e) => [e.kind, e.x, e.y]));
  });

  it('keeps every floor tile reachable from the start', () => {
    for (let seed = 0; seed < 200; seed++) {
      const g = new Game('endless', seed);
      const dist = g.distanceMap(g.player, false);
      for (let i = 0; i < W * H; i++) {
        if (!g.walls[i]) expect(dist[i]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a bot can play many full runs without errors', () => {
    const floors: number[] = [];
    for (let seed = 0; seed < 300; seed++) {
      const g = playOut(seed);
      expect(g.player.hp).toBeLessThanOrEqual(g.player.maxHp);
      floors.push(g.floor);
    }
    floors.sort((a, b) => a - b);
    const median = floors[Math.floor(floors.length / 2)];
    // A naive bot should get somewhere, but not trivially deep.
    expect(median).toBeGreaterThanOrEqual(2);
    expect(median).toBeLessThan(25);
  });

  it('rest heals and advances the floor', () => {
    const g = new Game('endless', 7);
    g.player.hp = 3;
    g.phase = 'choose';
    g.offer = { relics: [], restHeal: 4 };
    g.choose(-1);
    expect(g.floor).toBe(2);
    expect(g.player.hp).toBe(7);
  });

  it('phylactery saves the player once', () => {
    const g = new Game('endless', 99);
    g.addRelic('phylactery');
    g.player.hp = 1;
    const e = g.alive[0];
    (g as unknown as { hurtPlayer: (n: number, e: unknown) => void }).hurtPlayer(5, e);
    expect(g.player.hp).toBe(1);
    expect(g.phase).toBe('play');
    (g as unknown as { hurtPlayer: (n: number, e: unknown) => void }).hurtPlayer(5, e);
    expect(g.phase).toBe('dead');
  });
});

describe('replay', () => {
  it('reproduces a run exactly from its input log', () => {
    for (const seed of [1, 2, 3, 42, 777]) {
      const g = playOut(seed);
      const r = Game.replay('endless', seed, 0, g.log);
      expect([r.floor, r.kills, r.turns, r.phase, r.player.hp]).toEqual([g.floor, g.kills, g.turns, g.phase, g.player.hp]);
    }
  });
});

describe('share', () => {
  it('builds a descent strip with bosses and the death floor', () => {
    expect(descentStrip(6)).toBe('🟪🟪🟪🟪💀🩸');
  });
});

// Balance report, printed when run with BALANCE=1.
if (process.env.BALANCE) {
  it('balance report', () => {
    const floors = Array.from({ length: 500 }, (_, s) => playOut(s + 10_000).floor).sort((a, b) => a - b);
    const q = (p: number) => floors[Math.floor(p * (floors.length - 1))];
    console.log(`bot floors: p10=${q(0.1)} p50=${q(0.5)} p90=${q(0.9)} max=${q(1)}`);
  });
}
