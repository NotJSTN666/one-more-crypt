import { describe, expect, it } from 'vitest';
import type { HeroId } from './content';
import { Game, H, W, basePool, fullPool, isBoss, type Pos } from './game';
import { HEROES } from './content';
import { FUSIONS, LEGACY_RELICS, type RelicId } from './relics';
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

function playOut(seed: number, maxTurns = 3000, hero: HeroId = 'knight', pool = fullPool()): Game {
  const g = new Game('endless', seed, 0, { hero, pool });
  for (let i = 0; i < maxTurns && g.phase !== 'dead'; i++) {
    if (g.phase === 'choose') g.choose(g.offer?.relics.length ? 0 : -1);
    else if (g.phase === 'event') g.resolveEvent(i % 2 === 0);
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
    // 3 + 4 from resting, +1 from the Knight's Second Wind on the new floor
    expect(g.player.hp).toBe(8);
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
  it('reproduces a run exactly from its header and input log', () => {
    const heroes: HeroId[] = ['knight', 'rogue', 'necro'];
    for (const seed of [1, 2, 3, 42, 777, 9001]) {
      const hero = heroes[seed % 3];
      const pool = seed % 2 ? fullPool() : basePool(['key', 'echo']);
      const g = playOut(seed, 3000, hero, pool);
      const r = Game.replay('endless', seed, 0, g.header() + g.log);
      expect(r.hero).toBe(hero);
      expect([r.floor, r.kills, r.turns, r.phase, r.player.hp, r.relicLog.join()]).toEqual([
        g.floor, g.kills, g.turns, g.phase, g.player.hp, g.relicLog.join(),
      ]);
    }
  });
});

describe('new content', () => {
  it('every hero survives hundreds of full runs without errors', () => {
    for (const hero of HEROES.map((h) => h.id)) {
      for (let seed = 0; seed < 150; seed++) playOut(seed + 5000, 3000, hero);
    }
  });

  it('replays launch-era runs with the launch relic set', () => {
    for (let seed = 0; seed < 40; seed++) {
      const legacy = playOut(seed + 9000, 3000, 'knight', fullPool(true));
      const full = legacy.header() + legacy.log;
      expect(full.startsWith('#2|')).toBe(true);
      const again = Game.replay('endless', seed + 9000, 0, full);
      expect([again.floor, again.kills, again.player.hp]).toEqual([legacy.floor, legacy.kills, legacy.player.hp]);
      expect(again.relicLog.every((id) => LEGACY_RELICS.includes(id))).toBe(true);
    }
    const modern = playOut(4242, 3000, 'knight', fullPool());
    expect(modern.header().startsWith('#3|')).toBe(true);
    const again = Game.replay('endless', 4242, 0, modern.header() + modern.log);
    expect([again.floor, again.kills]).toEqual([modern.floor, modern.kills]);
  });

  it('lets the Ranger shoot down a clear line, but not through walls', () => {
    const g = new Game('endless', 1, 0, { hero: 'ranger', pool: fullPool() });
    g.stage({ player: { x: 0, y: 3 }, enemies: [{ kind: 'ghoul', x: 3, y: 3, hp: 5 }] });
    g.act(1, 0);
    expect(g.player.x).toBe(0);
    expect(g.enemies[0].hp).toBe(4);
    g.stage({ player: { x: 0, y: 3 }, enemies: [{ kind: 'ghoul', x: 3, y: 3, hp: 5 }], walls: [{ x: 2, y: 3 }] });
    g.act(1, 0);
    expect(g.player.x).toBe(1);
  });

  it('gives the Paladin bonus damage against the undead only', () => {
    const g = new Game('endless', 1, 0, { hero: 'paladin', pool: fullPool() });
    g.stage({ player: { x: 3, y: 3 }, enemies: [{ kind: 'ghoul', x: 4, y: 3, hp: 9 }, { kind: 'bat', x: 2, y: 3, hp: 9 }] });
    g.act(1, 0);
    expect(g.enemies.find((e) => e.kind === 'ghoul')!.hp).toBe(7);
  });

  it('spawns elites, traps and floor events', () => {
    let elites = 0;
    let spikes = 0;
    let features = 0;
    for (let seed = 0; seed < 100; seed++) {
      const g = new Game('endless', seed);
      for (let f = 2; f <= 9; f++) {
        (g as unknown as { enterFloor: (n: number) => void }).enterFloor(f);
        elites += g.alive.filter((e) => e.elite).length;
        spikes += g.spikes.filter(Boolean).length;
        if (g.feature) features++;
      }
    }
    expect(elites).toBeGreaterThan(50);
    expect(spikes).toBeGreaterThan(50);
    expect(features).toBeGreaterThan(100);
  });

  it('rotates the three bosses', () => {
    const g = new Game('endless', 3);
    const bossOn = (f: number) => {
      (g as unknown as { enterFloor: (n: number) => void }).enterFloor(f);
      return g.enemies.find((e) => isBoss(e))?.kind;
    };
    expect([bossOn(5), bossOn(10), bossOn(15), bossOn(20)]).toEqual(['boss', 'abbot', 'lich', 'boss']);
  });

  it('the necromancer raises thralls that fight', () => {
    let raised = 0;
    for (let seed = 0; seed < 40; seed++) raised += playOut(seed, 3000, 'necro').stats.maxAllies;
    expect(raised).toBeGreaterThan(20);
  });

  it('the blood shrine trades max HP for a relic', () => {
    const g = new Game('endless', 11);
    g.feature = { x: g.player.x, y: g.player.y, kind: 'shrine', used: false };
    g.phase = 'event';
    const before = g.player.maxHp;
    g.resolveEvent(true);
    expect(g.player.maxHp).toBe(before - 3);
    expect(g.relicLog.length).toBe(1);
    expect(g.phase).toBe('play');
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
    for (const hero of HEROES.map((h) => h.id) as HeroId[]) {
      const floors = Array.from({ length: 400 }, (_, s) => playOut(s + 10_000, 3000, hero).floor).sort((a, b) => a - b);
      const q = (p: number) => floors[Math.floor(p * (floors.length - 1))];
      console.log(`${hero} bot floors: p10=${q(0.1)} p50=${q(0.5)} p90=${q(0.9)} max=${q(1)}`);
    }
  });
}

describe('the Soul Forge', () => {
  const INGREDIENTS = new Set(FUSIONS.flatMap((f) => f.from));

  /** Like playOut, but chases fusion ingredients and visits the forge once the floor is clear. */
  function forgeRun(seed: number, maxTurns = 4000): Game {
    const g = new Game('endless', seed, 0, { hero: 'knight', pool: fullPool(), forge: true });
    for (let i = 0; i < maxTurns && g.phase !== 'dead'; i++) {
      if (g.phase === 'choose') {
        const k = g.offer!.relics.findIndex((r) => INGREDIENTS.has(r.id));
        g.choose(k >= 0 ? k : 0);
      } else if (g.phase === 'event') {
        if (g.feature?.kind === 'forge' && g.forgeOptions().length) g.forge(0);
        else g.resolveEvent(false);
      } else if (g.stairsOpen && g.feature?.kind === 'forge' && !g.feature.used && g.forgeOptions().length) {
        const dist = g.distanceMap(g.feature, false);
        const p = g.player;
        const step = DIRS.filter((d) => g.inBounds(p.x + d.x, p.y + d.y) && dist[(p.y + d.y) * W + p.x + d.x] >= 0)
          .sort((a, b) => dist[(p.y + a.y) * W + p.x + a.x] - dist[(p.y + b.y) * W + p.x + b.x])[0];
        if (!step || !g.act(step.x, step.y)) g.act(0, 0);
      } else botStep(g);
      g.events.length = 0;
    }
    return g;
  }

  it('waits on the floor after each boss, only in forge runs', () => {
    const on = new Game('endless', 5, 0, { hero: 'knight', pool: fullPool(), forge: true });
    const off = new Game('endless', 5, 0, { hero: 'knight', pool: fullPool() });
    (on as unknown as { enterFloor(f: number): void }).enterFloor(6);
    (off as unknown as { enterFloor(f: number): void }).enterFloor(6);
    expect(on.feature?.kind).toBe('forge');
    expect(off.feature?.kind).not.toBe('forge');
    expect(on.walls).toEqual(off.walls);
    expect(on.header()).toMatch(/^#4\|/);
    expect(Game.parseLog(on.header()).config.forge).toBe(true);
    expect(Game.parseLog(off.header()).config.forge).toBeFalsy();
  });

  it('fuses two relics into one that counts as several, and replays exactly', () => {
    let fused: Game | null = null;
    for (let seed = 0; seed < 400 && !fused; seed++) {
      const g = forgeRun(seed);
      if (g.stats.fusions > 0) fused = g;
    }
    expect(fused).not.toBeNull();
    const g = fused!;
    const id = FUSIONS.find((f) => g.own(f.id))!;
    for (const [base, n] of Object.entries(id.grants)) expect(g.r(base as RelicId)).toBeGreaterThanOrEqual(n!);
    expect(g.relicLog).toContain(id.id);
    const again = Game.replay('endless', g.seed, 0, g.header() + g.log);
    expect([again.floor, again.kills, again.turns, again.player.hp]).toEqual([g.floor, g.kills, g.turns, g.player.hp]);
    expect(again.relics).toEqual(g.relics);
  });

  it('never offers fused relics', () => {
    for (let seed = 0; seed < 100; seed++) {
      const g = playOut(seed, 600);
      for (const id of Object.keys(g.relics)) expect(FUSIONS.some((f) => f.id === id)).toBe(false);
    }
  });
});

describe('ascension', () => {
  function deepForge(floor: number, held: Partial<Record<RelicId, number>>): Game {
    const g = new Game('endless', 11, 0, { hero: 'knight', pool: fullPool(), forge: true });
    (g as unknown as { enterFloor(f: number): void }).enterFloor(floor);
    g.relics = { ...held };
    g.relicLog = Object.keys(held) as RelicId[];
    g.phase = 'event';
    g.player.x = g.feature!.x;
    g.player.y = g.feature!.y;
    return g;
  }

  it('is only offered by forges from the ascension floor down', () => {
    expect(deepForge(16, { plasma: 1, pyre: 1 }).forgeOptions()).toHaveLength(0);
    expect(deepForge(21, { plasma: 1, pyre: 1 }).forgeOptions().map((f) => f.id)).toEqual(['suneater']);
  });

  it('keeps everything both fused relics did, and more', () => {
    const g = deepForge(21, { plasma: 1, pyre: 1, ember: 1 });
    g.forge(0);
    expect(g.own('suneater')).toBe(1);
    expect(g.own('plasma')).toBe(0);
    expect(g.r('plasma')).toBe(1);
    expect(g.r('pyre')).toBe(1);
    // 1 held + 2 from Plasma + 1 from Pyre + 2 from the Sun Eater itself
    expect(g.r('ember')).toBe(6);
    expect(g.r('wildfire')).toBe(1);
    expect(g.relicLog).toEqual(['ember', 'suneater']);
  });

  it('Dracolich grows max HP when forged', () => {
    const g = deepForge(21, { lichbook: 1, dragon: 1 });
    const before = g.player.maxHp;
    g.forge(0);
    expect(g.player.maxHp).toBe(before + 10);
    expect(g.r('scale')).toBe(5);
  });
});

describe('early-game tuning (mercy)', () => {
  const make = (seed: number, mercy: boolean) => new Game('endless', seed, 0, { hero: 'knight', pool: fullPool(), forge: true, mercy });
  const enter = (g: Game, f: number) => (g as unknown as { enterFloor(f: number): void }).enterFloor(f);

  it('is recorded in the log header and read back', () => {
    const g = make(3, true);
    expect(g.header()).toMatch(/^#5\|/);
    const { config } = Game.parseLog(g.header());
    expect(config.mercy).toBe(true);
    expect(config.forge).toBe(true);
    expect(Game.parseLog(make(3, false).header()).config.mercy).toBe(false);
  });

  it('keeps Grave Brutes off floor 3 and softens them until floor 6', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const g = make(seed, true);
      enter(g, 3);
      expect(g.alive.some((e) => e.kind === 'brute')).toBe(false);
      enter(g, 4);
      for (const e of g.alive) if (e.kind === 'brute' && !e.elite) expect(e.dmg).toBe(2);
    }
  });

  it('heals 1 HP when an early floor is cleared', () => {
    const g = make(8, true);
    enter(g, 2);
    g.player.hp = 3;
    for (const e of g.alive) e.dead = true;
    (g as unknown as { checkCleared(): void }).checkCleared();
    expect(g.stairsOpen).toBe(true);
    expect(g.player.hp).toBe(4);
  });

  it('leaves runs without it exactly as before', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = make(seed, false);
      for (let i = 0; i < 400 && g.phase !== 'dead'; i++) {
        if (g.phase === 'choose') g.choose(0);
        else if (g.phase === 'event') g.resolveEvent(false);
        else g.act(...([[0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]][(seed + i * 7) % 5] as [number, number]));
      }
      const again = Game.replay('endless', seed, 0, g.header() + g.log);
      expect([again.floor, again.kills, again.player.hp]).toEqual([g.floor, g.kills, g.player.hp]);
      expect(g.header()).toMatch(/^#4\|/);
    }
  });
});
