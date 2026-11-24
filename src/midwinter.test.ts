import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, fullPool } from './game';
import { auraUnlocked, claimMidwinter, headUnlocked, lookUnlocked, meta, midwinterOpened, midwinterWaiting, midwinterYear, titleUnlocked } from './meta';
import { AURA_BY_ID, HEADS, LOOKS, MIDWINTER_GIFTS } from './progression';
import { ACT3_OPENS, ACT3_QUESTS, QUEST_BY_N, act3Open, conversation, npcPresent, questStatus, type StoryState } from './story';

describe('the Twelve Gifts of Midwinter', () => {
  afterEach(() => vi.useRealTimers());

  it('open one a day, only while Midwinter is open', () => {
    meta.midwinter = { year: 0, opened: 0, last: 0, best: 0 };
    meta.souls = 0;
    // Thanksgiving: the season has not begun.
    expect(midwinterWaiting(100, '2026-11-26')).toBeNull();
    expect(claimMidwinter(101, '2026-11-27')).toEqual({ n: 1, reward: MIDWINTER_GIFTS[0] });
    expect(meta.souls).toBe(150);
    // Once a day: a second run that day opens nothing.
    expect(claimMidwinter(101, '2026-11-27')).toBeNull();
    // A missed day doesn't matter: the next gift waits.
    expect(claimMidwinter(105, '2026-12-01')?.n).toBe(2);
    expect(lookUnlocked(LOOKS.find((l) => l.id === 'twelfthnight')!)).toBe(true);
    expect(midwinterOpened('2026-12-01')).toBe(2);
  });

  it('run over New Year as one season, and start again the next', () => {
    expect(midwinterYear('2026-12-31')).toBe(2026);
    expect(midwinterYear('2027-01-05')).toBe(2026);
    meta.midwinter = { year: 2026, opened: 12, last: 140, best: 12 };
    expect(midwinterWaiting(141, '2027-01-02')).toBeNull();
    expect(midwinterWaiting(141, '2027-01-07')).toBeNull();
    // Next Midwinter: the gifts begin again, and what was earned stays earned.
    expect(midwinterOpened('2027-11-27')).toBe(0);
    expect(midwinterWaiting(500, '2027-11-27')?.n).toBe(1);
    expect(headUnlocked(HEADS.find((h) => h.id === 'twelfthcrown')!)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.silentnight)).toBe(true);
    expect(titleUnlocked('midwinter:12')).toBe(true);
  });

  it('are twelve, with a crown and a title at the end', () => {
    expect(MIDWINTER_GIFTS).toHaveLength(12);
    expect(MIDWINTER_GIFTS[11]).toEqual({ head: 'twelfthcrown', title: 'midwinter:12' });
  });
});

describe('Act III: The Long Night', () => {
  const state = (done: number[], choices: Record<string, string> = {}): StoryState => ({ done, active: [], cleared: [], choices });

  it('opens with Midwinter, at midnight Central on the day after Thanksgiving', () => {
    expect(new Date(ACT3_OPENS).toISOString()).toBe('2026-11-27T06:00:00.000Z');
    expect(act3Open(ACT3_OPENS - 1)).toBe(false);
    expect(act3Open(ACT3_OPENS)).toBe(true);
  });

  it('waits for Act II to be finished, then starts under the kettle', () => {
    vi.useFakeTimers();
    vi.setSystemTime(ACT3_OPENS - 60_000);
    expect(questStatus(QUEST_BY_N[41], state([25]))).toBe('locked');
    vi.setSystemTime(ACT3_OPENS + 60_000);
    expect(questStatus(QUEST_BY_N[41], state([24]))).toBe('locked');
    expect(questStatus(QUEST_BY_N[41], state([25]))).toBe('available');
    expect(conversation('gravedigger', state([1, 2, 3, 4, 21, 22, 23, 24, 25])).accept).toBe(41);
    vi.useRealTimers();
  });

  it('ends with a choice, and Mortimer stays in Gravesend either way', () => {
    const done = ACT3_QUESTS.map((q) => q.n);
    expect(npcPresent('gravedigger', state(done, { guest: 'bell' }))).toBe(true);
    expect(npcPresent('gravedigger', state(done, { guest: 'chair' }))).toBe(true);
  });

  it('ends at the Midwinter Guest, twenty floors down', () => {
    const d = QUEST_BY_N[44].dungeon;
    const g = new Game('story', 44, 0, { hero: 'knight', pool: fullPool(), forge: true, mercy: true, story: { start: d.floors[0], end: d.floors[1], gifts: d.gifts, boss: d.boss } });
    expect(g.isBossFloor(20)).toBe(true);
    g.enterFloor(20);
    expect(g.enemies.some((e) => e.kind === 'guest')).toBe(true);
  });

  it('knocks, then drops frost on you and the four tiles diagonal to you', () => {
    const d = QUEST_BY_N[44].dungeon;
    const g = new Game('story', 44, 0, { hero: 'knight', pool: fullPool(), forge: true, mercy: true, story: { start: 20, end: 20, gifts: 0, boss: d.boss } });
    for (const e of g.enemies) if (e.kind !== 'guest') e.dead = true;
    g.player.maxHp = g.player.hp = 999;
    let frost: { x: number; y: number }[] = [];
    for (let i = 0; i < 6 && !frost.length; i++) {
      g.act(0, 0);
      frost = g.warnings.filter((w) => w.kind === 'frost');
    }
    expect(frost.length).toBeGreaterThan(0);
    const p = g.player;
    expect(frost.some((w) => w.x === p.x && w.y === p.y)).toBe(true);
    for (const w of frost) expect(Math.abs(w.x - p.x) === Math.abs(w.y - p.y)).toBe(true);
  });
});
