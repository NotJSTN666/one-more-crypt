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

describe('Frost on the world boss', () => {
  it("can't hold the boss still for good: a ranger shooting it every turn still lets it act", () => {
    const slot = { id: '2026-10-28-12', start: 0, kind: 'boss' as const };
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
