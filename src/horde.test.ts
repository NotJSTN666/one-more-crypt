import { describe, expect, it } from 'vitest';
import { Game, HORDE_DEATH_WAVE, HORDE_GIFT_EVERY, HORDE_SPARK, SURGE_FIRST, SURGE_STEP, fullPool } from './game';
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

describe('Horde surge', () => {
  const surge = () => new Game('horde', 21, 15, { hero: 'barbarian', pool: fullPool(), mercy: true, boons: true, surge: true });

  it('logs as version 12, and kills fill the bar until it opens an offer', () => {
    const g = surge();
    expect(g.header()).toMatch(/^#12\|/);
    expect(Game.parseLog(g.header() + 'W').config.surge).toBe(true);
    const rng = mulberry32(3);
    let offered = false;
    for (let s = 0; s < 3000 && g.phase !== 'dead' && !offered; s++) {
      if (g.phase === 'choose') offered = true;
      else {
        const p = g.player;
        const t = g.alive.find((e) => !e.ally);
        const d = t ? DIRS.find(([dx, dy]) => Math.abs(p.x + dx - t.x) + Math.abs(p.y + dy - t.y) < Math.abs(p.x - t.x) + Math.abs(p.y - t.y)) : undefined;
        if (!(d && g.act(...d))) g.act(...(DIRS[Math.floor(rng() * 4)] ?? [0, 0]));
      }
    }
    expect(offered).toBe(true);
    expect(g.horde.level).toBe(1);
    expect(g.horde.need).toBe(SURGE_FIRST + SURGE_STEP);
    // Relics no longer come on a wave timer.
    expect(g.relicLog.length).toBe(2);
  });

  it('can go to the Soul Forge instead, and back to the same relics', () => {
    const g = surge();
    const inner = g as unknown as { phase: string; offer: unknown; makeOffer(): unknown; relics: Record<string, number>; relicLog: string[] };
    // Hold two relics that fuse (Ember Brand + Storm Rune), and open an offer.
    g.addRelic('ember' as never);
    g.addRelic('storm' as never);
    if (!g.forgeOptions().length) return;
    inner.offer = inner.makeOffer();
    inner.phase = 'choose';
    const first = JSON.stringify(g.offer);
    g.hordeForge();
    expect(g.phase).toBe('event');
    g.resolveEvent(false);
    expect(g.phase).toBe('choose');
    expect(JSON.stringify(g.offer)).toBe(first);
    g.hordeForge();
    g.forge(0);
    expect(g.phase).toBe('play');
    expect(g.feature).toBeNull();
    expect(g.log.endsWith('zxz' + 'b')).toBe(true);
  });
});

describe('Horde waves', () => {
  const waves = (seed = 21) => new Game('horde', seed, 15, { hero: 'barbarian', pool: fullPool(), mercy: true, boons: true, surge: true, waves: true });
  type Inner = { phase: string; offer: unknown; makeOffer(): { relics: { id: string }[] }; feature: unknown; stashedFeature: unknown };

  it('logs as version 13 and never offers the Skeleton Key', () => {
    const g = waves();
    expect(g.header()).toMatch(/^#13\|/);
    expect(Game.parseLog(g.header() + 'W').config.waves).toBe(true);
    const inner = g as unknown as Inner;
    for (let level = 0; level < 60; level++) {
      g.horde.level = level;
      expect(inner.makeOffer().relics.map((r) => r.id)).not.toContain('key');
    }
  });

  it('treats each new wave as a new floor for floor-by-floor relics', () => {
    const g = waves();
    g.addRelic('candle' as never);
    g.player.hp = 3;
    g.act(0, 0);
    g.act(0, 0);
    expect(g.horde.wave).toBe(1);
    expect(g.player.hp).toBe(5);
  });

  it('leaves sparks from elites that top up the surge bar', () => {
    const g = waves();
    g.act(0, 0);
    g.act(0, 0);
    const p = g.player;
    g.sparks.push({ x: p.x + 1, y: p.y });
    for (const e of g.enemies) if (e.x === p.x + 1 && e.y === p.y) e.dead = true;
    const before = g.horde.charge;
    g.act(1, 0);
    expect(g.sparks.length).toBe(0);
    expect(g.horde.charge).toBeGreaterThanOrEqual(before + HORDE_SPARK - g.horde.need);
  });

  it('puts a chest back on the floor after the Soul Forge, and replays exactly', () => {
    const g = waves();
    const inner = g as unknown as Inner;
    const chest = { x: 2, y: 2, kind: 'chest', used: false };
    inner.feature = chest;
    g.addRelic('ember' as never);
    g.addRelic('storm' as never);
    if (g.forgeOptions().length) {
      inner.offer = inner.makeOffer();
      inner.phase = 'choose';
      g.hordeForge();
      g.forge(0);
      expect(g.feature).toBe(chest);
    }
    const run = waves(88);
    const rng = mulberry32(9);
    for (let s = 0; s < 2500 && run.phase !== 'dead'; s++) {
      if (run.phase === 'choose') run.choose(0);
      else if (run.phase === 'event') run.resolveEvent(true);
      else {
        const p = run.player;
        const t = run.alive.find((e) => !e.ally);
        const d = t ? DIRS.find(([dx, dy]) => Math.abs(p.x + dx - t.x) + Math.abs(p.y + dy - t.y) < Math.abs(p.x - t.x) + Math.abs(p.y - t.y)) : undefined;
        if (!(d && run.act(...d))) run.act(...(DIRS[Math.floor(rng() * 4)] ?? [0, 0]));
      }
    }
    const again = Game.replay('horde', 88, 15, run.header() + run.log);
    expect([again.horde.wave, again.horde.score, again.kills, again.player.hp, again.relicLog.join()]).toEqual([run.horde.wave, run.horde.score, run.kills, run.player.hp, run.relicLog.join()]);
  });
});
