import { describe, expect, it } from 'vitest';
import { BOONS, Game, REAPER_FLOOR, reaperDelay, type RunConfig } from './game';

const base: RunConfig = { hero: 'knight', pool: [], forge: true, mercy: true, depths: true, boons: true };
type Inner = { openBoons(): string[]; openVault(): void; takeBoon(id: string): void; enterFloor(f: number): void };
const inner = (g: Game) => g as unknown as Inner;

describe('the deep boons', () => {
  it('only come in runs that have them, and Grave Dusk only with Death', () => {
    const deepIds = BOONS.filter((b) => b.deep).map((b) => b.id);
    const old = new Game('endless', 1, 0, { ...base, reaper: true });
    expect(inner(old).openBoons().some((id) => deepIds.includes(id as never))).toBe(false);
    const noDeath = new Game('endless', 1, 0, { ...base, deep: true });
    expect(inner(noDeath).openBoons()).toContain('vigor');
    expect(inner(noDeath).openBoons()).not.toContain('dusk');
    const full = new Game('endless', 1, 0, { ...base, reaper: true, deep: true });
    expect(inner(full).openBoons()).toEqual(expect.arrayContaining(['vigor', 'mend', 'dusk']));
  });

  it('log as version 10 and replay with the deep boons', () => {
    const g = new Game('endless', 3, 0, { ...base, reaper: true, deep: true });
    expect(g.header()).toMatch(/^#10\|/);
    const { config } = Game.parseLog(g.header() + 'W');
    expect(config.deep && config.reaper && config.boons).toBe(true);
    expect(Game.parseLog('#9|knight||0|W').config.deep).toBeUndefined();
  });

  it('Grave Vigor raises max HP, and Grave Dusk holds Death back', () => {
    const g = new Game('endless', 5, 0, { ...base, reaper: true, deep: true });
    const hp = g.player.maxHp;
    inner(g).takeBoon('vigor');
    expect(g.player.maxHp).toBe(hp + 2);
    inner(g).takeBoon('dusk');
    inner(g).enterFloor(REAPER_FLOOR);
    expect(g.reaperIn).toBe(reaperDelay(REAPER_FLOOR) + 3);
  });

  it('a vault with no relics left gives two boons, but only in deep runs', () => {
    const count = (g: Game) => Object.values(g.boons).reduce((a, b) => a + b, 0);
    const deep = new Game('endless', 7, 0, { ...base, deep: true });
    deep.vault = { x: 0, y: 0 };
    inner(deep).openVault();
    expect(count(deep)).toBe(2);
    const old = new Game('endless', 7, 0, { ...base });
    old.vault = { x: 0, y: 0 };
    inner(old).openVault();
    expect(count(old)).toBe(0);
  });
});

describe('deep floor events', () => {
  type Ev = { feature: { kind: string; x: number; y: number; used: boolean } | null; phase: string };
  const at = (g: Game, kind: string) => {
    (g as unknown as Ev).feature = { kind, x: 0, y: 0, used: false };
    (g as unknown as Ev).phase = 'event';
  };
  const count = (g: Game) => Object.values(g.boons).reduce((a, b) => a + b, 0);

  it('the forge, a shrine and a chest give boons once the relics run out', () => {
    const forge = new Game('endless', 11, 0, { ...base, deep: true });
    at(forge, 'forge');
    expect(forge.canAcceptEvent()).toBe(true);
    forge.resolveEvent(true);
    expect(count(forge)).toBe(1);
    expect(forge.log.endsWith('a')).toBe(true);
    const shrine = new Game('endless', 11, 0, { ...base, deep: true });
    expect(shrine.outOfRelics()).toBe(true);
    at(shrine, 'shrine');
    shrine.resolveEvent(true);
    expect(count(shrine)).toBe(2);
    const chest = new Game('endless', 11, 0, { ...base, deep: true });
    at(chest, 'chest');
    chest.resolveEvent(true);
    expect(count(chest)).toBe(1);
  });

  it('stay as they were in runs without the deep rules', () => {
    const forge = new Game('endless', 11, 0, { ...base });
    at(forge, 'forge');
    expect(forge.canAcceptEvent()).toBe(false);
    forge.resolveEvent(true);
    expect(forge.phase).toBe('event');
    expect(count(forge)).toBe(0);
    expect(forge.outOfRelics()).toBe(false);
  });
});
