import { describe, expect, it } from 'vitest';
import { Game, H, REAPER_FLOOR, W, fullPool, type RunConfig } from './game';
import type { HeroId } from './content';

const config = (hero: HeroId, fair: boolean): RunConfig => ({ hero, pool: fullPool(), forge: true, mercy: true, depths: true, boons: true, reaper: true, deep: true, lurk: true, volley: true, ...(fair ? { fair } : {}) });
type Inside = { enterFloor(f: number): void; walls: boolean[]; bones: boolean[]; steps: number; reaperIn: number; relics: Record<string, number> };
const inside = (g: Game) => g as unknown as Inside;

/** A deep floor with every foe gone and no walls, so only Death matters. */
function deep(hero: HeroId, fair: boolean): Game {
  const g = new Game('endless', 42, 0, config(hero, fair));
  inside(g).enterFloor(REAPER_FLOOR);
  g.enemies = [];
  inside(g).walls = new Array(W * H).fill(false);
  return g;
}

describe('the fairer rules (log version 18)', () => {
  it('log as version 18 and replay with the same rules', () => {
    const g = new Game('endless', 3, 0, config('mage', true));
    expect(g.header()).toMatch(/^#18\|/);
    expect(Game.parseLog(g.header() + 'W').config.fair).toBe(true);
    expect(Game.parseLog('#17|mage||0|W').config.fair).toBeUndefined();
  });

  it('never leave a tile reachable only across the stairs', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const g = new Game('endless', seed, 0, config('knight', true));
      for (const floor of [2, 7, 23, 61]) {
        inside(g).enterFloor(floor);
        const blocked = inside(g).walls.map((w, i) => w || inside(g).bones[i] === true);
        blocked[g.stairs.y * W + g.stairs.x] = true;
        const seen = new Set([g.player.y * W + g.player.x]);
        const queue = [{ x: g.player.x, y: g.player.y }];
        while (queue.length) {
          const p = queue.shift()!;
          for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
            const x = p.x + dx;
            const y = p.y + dy;
            if (x < 0 || y < 0 || x >= W || y >= H || blocked[y * W + x] || seen.has(y * W + x)) continue;
            seen.add(y * W + x);
            queue.push({ x, y });
          }
        }
        for (let i = 0; i < W * H; i++) if (!blocked[i]) expect(seen.has(i), `seed ${seed} floor ${floor} tile ${i}`).toBe(true);
      }
    }
  });

  it("let you cross Death's square while he waits, and he rises elsewhere if you stand on it", () => {
    for (const fair of [true, false]) {
      const g = deep('knight', fair);
      g.reaper = { x: g.player.x + 1, y: g.player.y, frozen: 0, waiting: true };
      inside(g).reaperIn = 5;
      g.act(1, 0);
      expect(g.phase).toBe(fair ? 'play' : 'dead');
    }
    const g = deep('knight', true);
    g.reaper = { x: g.player.x, y: g.player.y, frozen: 0, waiting: true };
    inside(g).reaperIn = 1;
    g.act(0, 0);
    expect(g.phase).toBe('play');
    expect(g.reaper!.waiting).toBeFalsy();
    expect(g.reaper!.x !== g.player.x || g.reaper!.y !== g.player.y).toBe(true);
  });

  it("let Death walk on the Rogue's unseen steps", () => {
    for (const fair of [true, false]) {
      const g = deep('rogue', fair);
      g.reaper = { x: 0, y: 0, frozen: 0 };
      inside(g).steps = 2;
      const before = { ...g.reaper };
      expect(g.shadowReady).toBe(true);
      expect(g.act(0, -1)).toBe(true);
      const moved = g.reaper.x !== before.x || g.reaper.y !== before.y;
      expect(moved).toBe(fair);
    }
  });

  it("grow the Mage's bonus with attack", () => {
    for (const fair of [true, false]) {
      const g = new Game('endless', 5, 0, config('mage', fair));
      expect(g.atk).toBe(3);
      inside(g).relics.whetstone = 9;
      expect(g.atk).toBe(fair ? 15 : 12);
    }
  });

  it("heal the Knight a tenth of max HP each floor", () => {
    for (const fair of [true, false]) {
      const g = new Game('endless', 5, 0, config('knight', fair));
      g.player.maxHp = 40;
      g.player.hp = 10;
      inside(g).enterFloor(2);
      expect(g.player.hp).toBe(fair ? 14 : 11);
    }
  });
});
