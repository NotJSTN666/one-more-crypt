import { describe, expect, it } from 'vitest';
import { Game, START, W, H, fullPool, type EnemyKind } from './game';
import { zoneAt } from './zones';

/** A fresh run dropped straight onto a floor (tests only: enterFloor is private). */
function onFloor(seed: number, floor: number, depths = true): Game {
  const g = new Game('endless', seed, 0, { hero: 'knight', pool: fullPool(), forge: true, mercy: true, depths });
  (g as unknown as { enterFloor(f: number): void }).enterFloor(floor);
  g.events.length = 0;
  return g;
}

describe('depth zones', () => {
  it('names a zone for every stretch of ten floors, cycling past 50', () => {
    expect(zoneAt(1).def.id).toBe('crypt');
    expect(zoneAt(10).def.id).toBe('crypt');
    expect(zoneAt(11).def.id).toBe('flooded');
    expect(zoneAt(21).def.id).toBe('ossuary');
    expect(zoneAt(31).def.id).toBe('burning');
    expect(zoneAt(41).def.id).toBe('abyss');
    expect(zoneAt(50).def.id).toBe('abyss');
    expect(zoneAt(51).def.id).toBe('flooded');
    expect(zoneAt(51).title).toBe('The Flooded Catacombs II');
    expect(zoneAt(51).start).toBe(51);
    expect(zoneAt(95).tier).toBe(3);
  });

  it('keeps every floor whole: the stairs reachable, nothing laid on the start or the stairs', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (let f = 2; f <= 60; f++) {
        const g = onFloor(seed, f);
        const dist = g.distanceMap(START, false);
        expect(dist[g.stairs.y * W + g.stairs.x], `seed ${seed} floor ${f}`).toBeGreaterThan(0);
        for (const p of [START, g.stairs]) {
          expect(g.isLava(p.x, p.y) || g.bones[p.y * W + p.x] === true).toBe(false);
        }
        for (let i = 0; i < W * H; i++) {
          if (!g.walls[i] && !g.bones[i]) expect(dist[i], `seed ${seed} floor ${f} tile ${i}`).toBeGreaterThanOrEqual(0);
        }
        if (g.secret) expect(g.walls[g.secret.y * W + g.secret.x]).toBe(true);
      }
    }
  });

  it('lays each zone its own ground', () => {
    const count = (f: number, key: 'water' | 'lava' | 'bones') => {
      let n = 0;
      for (let seed = 1; seed <= 20; seed++) n += onFloor(seed, f)[key].filter(Boolean).length;
      return n;
    };
    expect(count(12, 'water')).toBeGreaterThan(20);
    expect(count(22, 'bones')).toBeGreaterThan(20);
    expect(count(32, 'lava')).toBeGreaterThan(20);
    expect(count(3, 'water') + count(3, 'lava') + count(3, 'bones')).toBe(0);
  });

  it('changes nothing for runs from before the zones', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = onFloor(seed, 33, false);
      expect(g.water.length + g.lava.length + g.bones.length).toBe(0);
      expect(g.secret).toBeNull();
    }
  });

  it('brings each deep zone its resident', () => {
    const seen = new Set<EnemyKind>();
    for (let seed = 1; seed <= 30; seed++) for (const f of [12, 23, 34, 46]) for (const e of onFloor(seed, f).enemies) seen.add(e.kind);
    for (const k of ['drowned', 'boneknight', 'imp', 'voideye'] as EnemyKind[]) expect(seen.has(k), k).toBe(true);
  });

  it('opens a cracked wall in two blows and pays out the vault', () => {
    let tried = 0;
    for (let seed = 1; seed <= 200 && tried < 5; seed++) {
      const g = onFloor(seed, 4);
      const s = g.secret;
      if (!s) continue;
      // Clear the floor and stand the hero beside the crack.
      g.enemies = [];
      const d = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => g.inBounds(s.x + dx, s.y + dy) && !g.isWall(s.x + dx, s.y + dy));
      if (!d) continue;
      tried++;
      g.player.x = s.x + d[0];
      g.player.y = s.y + d[1];
      const relics = g.relicLog.length;
      expect(g.act(-d[0], -d[1])).toBe(true);
      expect(g.secret?.hp).toBe(1);
      expect(g.act(-d[0], -d[1])).toBe(true);
      expect(g.secret).toBeNull();
      expect(g.vault).toEqual({ x: s.x, y: s.y });
      expect(g.act(-d[0], -d[1])).toBe(true);
      expect(g.vault).toBeNull();
      expect(g.stats.vaults).toBe(1);
      expect(g.relicLog.length).toBe(relics + 1);
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('survives long stretches of play in every zone', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (const f of [11, 21, 31, 41, 51]) {
        const g = onFloor(seed, f);
        g.player.hp = g.player.maxHp = 99;
        for (let s = 0; s < 400 && g.phase !== 'dead'; s++) {
          if (g.phase === 'choose') g.choose(0);
          else if (g.phase === 'event') g.resolveEvent(false);
          else {
            const d = [[0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]][(seed * 7 + s * 3) % 5];
            if (!g.act(d[0], d[1])) g.act(0, 0);
          }
        }
        expect(g.floor).toBeGreaterThanOrEqual(f);
      }
    }
  });
});
