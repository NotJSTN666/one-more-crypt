import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { RAID_DECOR, RAID_REWARDS, AURAS, HEADS, LOOKS } from './progression';
import { currentRaid, nextRaid, raidConfig, raidHp, raidJoinable } from './raid';

// 2026-10-26 is in CDT (UTC-5): noon Central is 17:00 UTC.
const noon = Date.UTC(2026, 9, 26, 17, 0, 0);
const MIN = 60_000;

describe('The Bell Tolls', () => {
  it('rises at noon, 6 PM and 9 PM Central', () => {
    expect(currentRaid(noon + 5 * MIN)?.id).toBe('2026-10-26-12');
    expect(raidJoinable(currentRaid(noon + 14 * MIN)!, noon + 14 * MIN)).toBe(true);
    expect(raidJoinable(currentRaid(noon + 16 * MIN)!, noon + 16 * MIN)).toBe(false);
    expect(currentRaid(noon + 26 * MIN)).toBeNull();
    expect(nextRaid(noon + 26 * MIN).id).toBe('2026-10-26-18');
    expect(nextRaid(noon + 6 * 60 * MIN).id).toBe('2026-10-26-21');
    expect(nextRaid(noon + 9 * 60 * MIN).id).toBe('2026-10-27-12');
    // After the clocks change (CST, UTC-6), noon is 18:00 UTC.
    expect(currentRaid(Date.UTC(2026, 10, 5, 18, 3))?.id).toBe('2026-11-05-12');
  });

  it('scales the shared bar with the crowd', () => {
    expect(raidHp(1)).toBe(raidHp(2));
    expect(raidHp(10)).toBe(5 * raidHp(2));
  });

  it('fights the same boss in the same arena for everyone', () => {
    const slot = currentRaid(noon)!;
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
