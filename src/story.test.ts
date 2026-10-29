import { describe, expect, it, vi } from 'vitest';
import { Game, fullPool } from './game';
import { ACT2_OPENS, QUESTS, QUEST_BY_N, conversation, houndStats, npcMarker, questStatus, type StoryState } from './story';

const dungeon = (n: number, pet = false) => {
  const d = QUEST_BY_N[n].dungeon;
  return new Game('story', 42 + n, 0, {
    hero: 'knight',
    pool: fullPool(),
    forge: true,
    mercy: true,
    story: { start: d.floors[0], end: d.floors[1], gifts: d.gifts, pet: pet ? houndStats(0) : undefined, boss: d.boss, ghost: d.summon ? { name: 'Ally', hero: 'mage', look: '', head: '' } : undefined },
  });
};

const clearFloor = (g: Game) => {
  for (const e of g.enemies) if (!e.ally) e.dead = true;
  g.stairsOpen = true;
  g.player.x = g.stairs.x;
  g.player.y = g.stairs.y + 1;
  (g as unknown as { walls: boolean[] }).walls[g.player.y * 7 + g.player.x] = false;
  for (const a of g.allies) if (a.x === g.player.x && a.y === g.player.y) a.x = (a.x + 3) % 7;
  g.act(0, -1);
};

describe('story dungeons', () => {
  it("start on their first floor with the mentors' gifts", () => {
    for (const q of QUESTS) {
      const g = dungeon(q.n);
      expect(g.floor).toBe(q.dungeon.floors[0]);
      // At least the gifts: a gifted Tome can add one more on its own.
      expect(g.relicLog.length).toBeGreaterThanOrEqual(q.dungeon.gifts);
    }
  });

  it('have no boss floors, except the one a quest names', () => {
    const g = dungeon(1);
    expect([1, 2, 3, 4, 5, 6].some((f) => g.isBossFloor(f))).toBe(false);
    const w = dungeon(4);
    expect(w.isBossFloor(10)).toBe(true);
    expect(w.isBossFloor(5)).toBe(false);
  });

  it('are cleared by taking the stairs on the last floor', () => {
    const g = dungeon(11);
    const [a, b] = QUEST_BY_N[11].dungeon.floors;
    for (let f = a; f <= b; f++) {
      clearFloor(g);
      if (f < b) {
        expect(g.phase).toBe('choose');
        g.choose(-1);
      }
    }
    expect(g.phase).toBe('won');
  });

  it('keep the hound coming back each floor', () => {
    const g = dungeon(3, true);
    g.allies.find((a) => a.kind === 'hound')!.dead = true;
    clearFloor(g);
    g.choose(-1);
    expect(g.allies.some((a) => a.kind === 'hound')).toBe(true);
  });
});

describe('quests', () => {
  const state = (s: Partial<StoryState>): StoryState => ({ done: [], active: [], cleared: [], ...s });

  it('open one after another', () => {
    expect(questStatus(QUEST_BY_N[1], state({}))).toBe('available');
    expect(questStatus(QUEST_BY_N[2], state({}))).toBe('locked');
    expect(questStatus(QUEST_BY_N[11], state({}))).toBe('locked');
    expect(questStatus(QUEST_BY_N[11], state({ done: [1] }))).toBe('available');
  });

  it('are offered, reminded and handed in by their giver', () => {
    expect(conversation('gravedigger', state({})).accept).toBe(1);
    expect(conversation('gravedigger', state({ active: [1] })).accept).toBeUndefined();
    expect(npcMarker('gravedigger', state({ active: [1], cleared: [1] }))).toBe('?');
    expect(conversation('gravedigger', state({ active: [1], cleared: [1] })).turnIn).toBe(1);
    expect(npcMarker('agnes', state({ done: [1] }))).toBe('!');
  });
});

describe('Act II', () => {
  const act2 = (n: number) => {
    const d = QUEST_BY_N[n].dungeon;
    return new Game('story', 7 + n, 0, {
      hero: 'knight',
      pool: fullPool(),
      story: { start: d.floors[0], end: d.floors[1], gifts: 0, look: d.look, mist: d.mist, monks: d.monks, holdout: d.holdout, sleepers: d.sleepers },
    });
  };

  it('fills cloister floors with plague mist that bites every third turn', () => {
    const g = act2(31);
    expect(g.mist.some(Boolean)).toBe(true);
    for (const e of g.enemies) e.dead = true;
    g.mist[g.player.y * 7 + g.player.x] = true;
    const hp = g.player.hp;
    for (let t = 0; t < 3; t++) g.act(0, 0);
    expect(g.player.hp).toBe(hp - 1);
  });

  it('holds the Vespers stairs shut until the last wave falls', () => {
    const g = act2(22);
    const [, end] = QUEST_BY_N[22].dungeon.floors;
    while (g.floor < end) {
      clearFloor(g);
      g.choose(-1);
    }
    expect(g.holdout).toEqual({ wave: 1, of: 4 });
    for (let w = 1; w < 4; w++) {
      for (const e of g.enemies) e.dead = true;
      g.act(0, 0);
      expect(g.holdout!.wave).toBe(w + 1);
      expect(g.stairsOpen).toBe(false);
      expect(g.enemies.some((e) => !e.dead)).toBe(true);
    }
    for (const e of g.enemies) e.dead = true;
    g.act(0, 0);
    expect(g.stairsOpen).toBe(true);
  });

  it('puts the Dormitory to sleep with the stairs open, and wakes a sleeper you stand beside', () => {
    const g = act2(33);
    expect(g.stairsOpen).toBe(true);
    const foes = g.enemies.filter((e) => !e.ally && !e.dead);
    expect(foes.length).toBeGreaterThan(0);
    expect(foes.every((e) => e.asleep)).toBe(true);
    const e = foes[0];
    for (const o of foes.slice(1)) o.dead = true;
    g.player.x = e.x === 0 ? 1 : e.x - 1;
    g.player.y = e.y;
    (g as unknown as { walls: boolean[] }).walls[g.player.y * 7 + g.player.x] = false;
    g.act(0, 0);
    expect(e.asleep).toBe(false);
  });

  it('stays shut until Friday', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(ACT2_OPENS - 1);
    expect(questStatus(QUEST_BY_N[21], state({ done: [1, 2, 3, 4] }))).toBe('locked');
    expect(npcMarker('gravedigger', state({ done: [1, 2, 3, 4] }))).toBe('');
    now.mockReturnValue(ACT2_OPENS);
    expect(questStatus(QUEST_BY_N[21], state({ done: [1, 2, 3, 4] }))).toBe('available');
    now.mockRestore();
  });

  it('only counts Act I towards the Bell-Ringer', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(ACT2_OPENS);
    expect(QUESTS.filter((q) => q.act === 2).map((q) => q.n)).toEqual([21, 22, 31, 32, 33]);
    expect(questStatus(QUEST_BY_N[21], state({ done: [1, 2, 3] }))).toBe('locked');
    expect(questStatus(QUEST_BY_N[21], state({ done: [1, 2, 3, 4] }))).toBe('available');
    expect(conversation('ambrose', state({ done: [21] })).accept).toBe(22);
    now.mockRestore();
  });
});

const state = (s: Partial<StoryState>): StoryState => ({ done: [], active: [], cleared: [], ...s });
