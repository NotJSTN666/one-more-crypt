import { describe, expect, it } from 'vitest';
import { Game, fullPool } from './game';
import { CHAPTERS, houndStats } from './story';

const story = (n: number, pet = false) => {
  const ch = CHAPTERS[n - 1];
  return new Game('story', 42 + n, 0, {
    hero: 'knight',
    pool: fullPool(),
    forge: true,
    mercy: true,
    story: { start: ch.floors[0], end: ch.floors[1], gifts: ch.gifts, pet: pet ? houndStats(0) : undefined, ghost: n === 4 ? { name: 'Ally', hero: 'mage', look: '', head: '' } : undefined },
  });
};

describe('story chapters', () => {
  it("start on their first floor with the mentors' gifts", () => {
    for (const ch of CHAPTERS) {
      const g = story(ch.n);
      expect(g.floor).toBe(ch.floors[0]);
      expect(g.relicLog.length).toBe(ch.gifts);
    }
  });

  it('bring the hound and a summoned ghost as allies', () => {
    const g = story(4, true);
    expect(g.allies.map((a) => a.kind).sort()).toEqual(['hound', 'thrall']);
    expect(g.allies.find((a) => a.ghost)?.ghost?.name).toBe('Ally');
  });

  it('are won by taking the stairs on the last floor', () => {
    const g = story(1);
    for (let floor = 1; floor <= 2; floor++) {
      for (const e of g.enemies) if (!e.ally) e.dead = true;
      g.stairsOpen = true;
      g.player.x = g.stairs.x;
      g.player.y = g.stairs.y + 1;
      (g as unknown as { walls: boolean[] }).walls[g.player.y * 7 + g.player.x] = false;
      g.act(0, -1);
      if (floor === 1) {
        expect(g.phase).toBe('choose');
        g.choose(-1);
      }
    }
    expect(g.phase).toBe('won');
  });

  it('keep the hound coming back each floor', () => {
    const g = story(3, true);
    const hound = g.allies.find((a) => a.kind === 'hound')!;
    hound.dead = true;
    for (const e of g.enemies) if (!e.ally) e.dead = true;
    g.stairsOpen = true;
    g.player.x = g.stairs.x;
    g.player.y = g.stairs.y + 1;
    (g as unknown as { walls: boolean[] }).walls[g.player.y * 7 + g.player.x] = false;
    g.act(0, -1);
    g.choose(-1);
    expect(g.allies.some((a) => a.kind === 'hound')).toBe(true);
  });
});
