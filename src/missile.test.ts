import { describe, expect, it } from 'vitest';
import { Game, H, MISSILE_RANGE, W, fullPool, type RunConfig } from './game';
import type { HeroId } from './content';

const config = (hero: HeroId, missile = true): RunConfig => ({ hero, pool: fullPool(), forge: true, mercy: true, depths: true, boons: true, reaper: true, deep: true, lurk: true, volley: true, fair: true, lean: true, ...(missile ? { missile } : {}) });
type Inside = { walls: boolean[]; bones: boolean[]; lava: boolean[]; spikes: boolean[]; water: boolean[]; mist: boolean[] };
const inside = (g: Game) => g as unknown as Inside;

/** An open floor with the hero in the middle and one tough foe placed where asked. */
function board(hero: HeroId, foe: { x: number; y: number }, missile = true): Game {
  const g = new Game('endless', 11, 0, config(hero, missile));
  for (const k of ['walls', 'bones', 'lava', 'spikes', 'water', 'mist'] as const) inside(g)[k] = new Array(W * H).fill(false);
  g.player.x = 3;
  g.player.y = 3;
  const e = g.enemies.find((x) => !x.ally)!;
  g.enemies = [e];
  Object.assign(e, { x: foe.x, y: foe.y, hp: 999, maxHp: 999, frozen: 99, asleep: false, elite: null });
  g.events.length = 0;
  return g;
}
const casts = (g: Game) => g.events.filter((e) => e.t === 'missile').length;

describe("the Mage's Magic Missile (log version 20)", () => {
  it('waiting casts at the nearest foe in sight', () => {
    const g = board('mage', { x: 3, y: 0 });
    expect(g.missileReady).toBe(true);
    g.act(0, 0);
    expect(casts(g)).toBe(1);
    expect(g.enemies[0].hp).toBeLessThan(999);
  });

  it('casts every other turn while standing still', () => {
    const g = board('mage', { x: 0, y: 3 });
    for (let i = 0; i < 6; i++) g.act(0, 0);
    expect(casts(g)).toBe(3);
  });

  it('a wall in the way blocks it', () => {
    const g = board('mage', { x: 3, y: 0 });
    inside(g).walls[1 * W + 3] = true;
    expect(g.missileReady).toBe(false);
    g.act(0, 0);
    expect(casts(g)).toBe(0);
  });

  it('reaches anywhere on a floor from its middle', () => {
    expect(MISSILE_RANGE).toBeGreaterThanOrEqual(Math.max(W, H) - 4);
  });

  it('skips sleeping foes and foes hidden in the mist', () => {
    const g = board('mage', { x: 3, y: 0 });
    g.enemies[0].asleep = true;
    expect(g.missileReady).toBe(false);
    g.enemies[0].asleep = false;
    inside(g).mist[0 * W + 3] = true;
    expect(g.missileReady).toBe(false);
  });

  it('only the Mage casts, and only with the new rules', () => {
    for (const g of [board('knight', { x: 3, y: 0 }), board('mage', { x: 3, y: 0 }, false)]) {
      g.act(0, 0);
      expect(casts(g)).toBe(0);
    }
  });

  it('logs as version 20 and replays the same', () => {
    const g = new Game('endless', 5, 0, config('mage'));
    expect(g.header()).toMatch(/^#20\|/);
    expect(Game.parseLog('#19|mage||0|W').config.missile).toBeUndefined();
    expect(Game.parseLog(g.header() + 'W').config.missile).toBe(true);
    const moves = 'WWULWWRDWWLLWWUUWWRRWW';
    for (const ch of moves) {
      const d = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] }[ch]!;
      g.act(d[0], d[1]);
      if (g.phase !== 'play') break;
    }
    const r = Game.replay('endless', 5, 0, g.header() + g.log);
    expect(r.kills).toBe(g.kills);
    expect(r.player.hp).toBe(g.player.hp);
    expect(r.turns).toBe(g.turns);
  });
});

describe('countdowns on the relic row', () => {
  it('count turns down to each timed relic, and fire when they say', () => {
    const g = board('knight', { x: 3, y: 0 });
    (g as unknown as { relics: Record<string, number> }).relics.doom = 1;
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      seen.push(g.relicTimer('doom')!.left);
      g.events.length = 0;
      g.act(0, 0);
      const tolled = g.events.some((e) => e.t === 'toll');
      expect(tolled).toBe(seen[i] === 1);
    }
    expect(seen[0]).toBe(10 - (g.turns - 10) % 10 || 10);
  });

  it("count the Rogue's steps to the unseen one, and the Mage's turns to the next cast", () => {
    const r = board('rogue', { x: 0, y: 0 });
    const before = r.perkTimer()!.left;
    expect(r.shadowReady).toBe(before === 1);
    const m = board('mage', { x: 3, y: 0 });
    expect(m.perkTimer()!.left).toBe(0);
    m.act(0, 0);
    expect(m.perkTimer()!.left).toBe(1);
    m.act(0, 0);
    expect(m.perkTimer()!.left).toBe(0);
    expect(board('knight', { x: 3, y: 0 }).perkTimer()).toBeNull();
  });
});
