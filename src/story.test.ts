import { describe, expect, it } from 'vitest';
import { Game, fullPool } from './game';
import { QUESTS, QUEST_BY_N, conversation, houndStats, npcMarker, questStatus, type StoryState } from './story';

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
