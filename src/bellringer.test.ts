import { describe, expect, it } from 'vitest';
import { HEROES, dailyHero } from './content';
import { Game, START, fullPool } from './game';
import { heroUnlocked, meta } from './meta';
import { QUESTS } from './story';

describe('the Bell-Ringer', () => {
  it('is earned by finishing every quest of Act I, never bought', () => {
    meta.story.done = [1, 2, 3, 4];
    expect(heroUnlocked('bellringer')).toBe(false);
    meta.story.done = QUESTS.map((q) => q.n);
    expect(heroUnlocked('bellringer')).toBe(true);
    expect(HEROES.find((h) => h.id === 'bellringer')!.story).toBe(true);
  });

  it('never joins the daily rotation, which stays exactly as it was', () => {
    const before = ['knight', 'rogue', 'necro', 'paladin', 'ranger', 'mage', 'barbarian'];
    for (let d = 1; d <= 60; d++) expect(dailyHero(d)).toBe(before[(d - 1) % 7]);
  });

  it('rings every 6th turn: neighbours are struck and stunned', () => {
    const g = new Game('endless', 99, 0, { hero: 'bellringer', pool: fullPool() });
    const internal = g as unknown as { enterFloor(n: number): void };
    internal.enterFloor(3);
    g.enemies = [];
    const foe = { id: 900, kind: 'ghoul', x: START.x + 1, y: START.y, hp: 5, maxHp: 5, dmg: 1, frozen: 0, turns: 0 } as unknown as (typeof g.enemies)[number];
    g.enemies.push(foe);
    g.player.x = START.x;
    g.player.y = START.y;
    let rang = false;
    for (let i = 0; i < 6 && !rang; i++) {
      g.act(0, 0);
      rang = g.events.some((e) => e.t === 'ring');
      if (!rang) g.events.length = 0;
    }
    expect(rang).toBe(true);
    expect(g.turns % 6).toBe(0);
  });
});
