import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { RAID_DECOR, RAID_REWARDS, AURAS, HEADS, LOOKS } from './progression';
import { currentRaid, nextRaid, raidConfig, raidHp, raidJoinable } from './raid';

// 2026-10-26 is in CDT (UTC-5): noon Central is 17:00 UTC.
const noon = Date.UTC(2026, 9, 26, 17, 0, 0);
const MIN = 60_000;

describe('The Bell Tolls', () => {
  it('rises at midnight Central and stays up all day', () => {
    const slot = currentRaid(noon);
    expect(slot.id).toBe('2026-10-26');
    // midnight CDT is 05:00 UTC
    expect(slot.start).toBe(Date.UTC(2026, 9, 26, 5));
    expect(slot.end).toBe(Date.UTC(2026, 9, 27, 5));
    expect(raidJoinable(slot, noon + 11 * 60 * MIN)).toBe(true);
    expect(currentRaid(slot.end - MIN).id).toBe('2026-10-26');
    expect(currentRaid(slot.end).id).toBe('2026-10-27');
    expect(raidJoinable(slot, slot.end)).toBe(false);
    expect(nextRaid(noon).id).toBe('2026-10-27');
    // the day the clocks go back is 25 hours long; after it, midnight CST is 06:00 UTC
    const fallBack = currentRaid(Date.UTC(2026, 10, 1, 12));
    expect(fallBack.end - fallBack.start).toBe(25 * 60 * MIN);
    expect(currentRaid(Date.UTC(2026, 10, 5, 18, 3)).start).toBe(Date.UTC(2026, 10, 5, 6));
  });

  it('scales the shared bar with the crowd', () => {
    expect(raidHp(1)).toBe(raidHp(3));
    expect(raidHp(9)).toBe(3 * raidHp(3));
  });

  it('fights the same boss in the same arena for everyone', () => {
    const slot = currentRaid(noon);
    const a = raidConfig(slot, 'knight');
    const g = new Game('story', a.seed, 0, a.config);
    const boss = g.enemies.find((e) => e.kind === slot.kind)!;
    expect(boss.maxHp).toBeGreaterThan(500);
    expect(g.isBossFloor()).toBe(true);
    expect(raidConfig(slot, 'mage').seed).toBe(a.seed);
  });

  it('has thirty rewards, one per boss felled', () => {
    expect(RAID_REWARDS).toHaveLength(30);
    expect(RAID_REWARDS.map((r) => r.n)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    const kinds = (k: string) => RAID_REWARDS.filter((r) => r.kind === k).length;
    expect([kinds('look'), kinds('head'), kinds('aura'), kinds('decor')]).toEqual([8, 8, 8, 6]);
    // Each reward's id is its own: no clash with any other cloak, headwear, aura or Hall piece.
    const all = [...LOOKS, ...HEADS, ...AURAS, ...RAID_DECOR].map((x) => x.id);
    for (const r of RAID_REWARDS) expect(all.filter((id) => id === r.id)).toHaveLength(1);
  });
});

describe('Frost on the world boss', () => {
  it("can't hold the boss still for good: a ranger shooting it every turn still lets it act", () => {
    const slot = { id: '2026-10-28-12', start: 0, end: 0, kind: 'boss' as const };
    const { seed, config } = raidConfig(slot, 'ranger');
    const g = new Game('story', seed, 0, config);
    const inner = g as unknown as { player: { x: number; y: number }; enemies: { kind: string; x: number; y: number; dead: boolean; turns: number }[] };
    // This toll's starting relics include the Frost Sigil.
    expect(g.r('frost')).toBeGreaterThan(0);
    for (const e of inner.enemies) if (e.kind !== 'boss') e.dead = true;
    inner.player.x = 0;
    inner.player.y = 0;
    const boss = inner.enemies.find((e) => e.kind === 'boss')!;
    let shots = 0;
    const before = boss.turns;
    for (let t = 0; t < 24 && g.phase === 'play'; t++) {
      const dx = Math.sign(boss.x), dy = Math.sign(boss.y);
      if ((boss.x === 0 || boss.y === 0) && g.bowTarget(dx, dy)) {
        g.act(dx, dy);
        shots++;
      } else g.act(0, 0);
    }
    expect(shots).toBeGreaterThan(8);
    // Frozen by every arrow, it used to never act; now it gets three turns for every one frozen.
    expect(boss.turns - before).toBeGreaterThan(14);
  });
});
