import { describe, expect, it } from 'vitest';
import { Game, fullPool, type Enemy } from './game';
import { finishRunMeta, headUnlocked, meta, shameFor, titleUnlocked } from './meta';
import { DUNCE_AT, HEAD_BY_ID, SHAME, TITLE_BY_ID } from './progression';

type Hurt = { hurtPlayer(amount: number, src: Enemy | null, cause?: string): void };
const hurt = (g: Game, amount: number, src: Enemy | null, cause?: string) => (g as unknown as Hurt).hurtPlayer(amount, src, cause);
const game = () => new Game('endless', 11, 0, { hero: 'knight', pool: fullPool(), forge: true, mercy: true, depths: true });

describe('Deaths of Shame', () => {
  it('knows a victory lap onto the spikes when it sees one', () => {
    const g = game();
    g.enemies = [];
    g.player.hp = 1;
    hurt(g, 1, null, 'the spikes');
    expect(g.phase).toBe('dead');
    const got = shameFor(g);
    expect(got).toContain('victory-lap');
    expect(got).toContain('pincushion');
    expect(got).toContain('floor-one');
    expect(got).not.toContain('bat-snack');
  });

  it('spots a one-hit death from full health by the last foe, a bat', () => {
    const g = game();
    const bat = g.alive[0];
    bat.kind = 'bat';
    g.enemies = [bat];
    hurt(g, 99, bat);
    const got = shameFor(g);
    expect(got).toEqual(expect.arrayContaining(['bat-snack', 'glass-jaw', 'outlasted', 'speedrun']));
    expect(got).not.toContain('victory-lap');
  });

  it('pays Souls once per death, unlocks its title, and the Dunce Cap at ten', () => {
    meta.shame = {};
    const g = game();
    g.enemies = [];
    g.player.hp = 1;
    hurt(g, 1, null, 'the lava');
    const before = meta.souls;
    const reward = finishRunMeta(g, 0);
    expect(meta.shame['hotfoot']).toBeTruthy();
    expect(meta.shame['victory-lap']).toBeTruthy();
    expect(meta.souls).toBeGreaterThanOrEqual(before + 25 * 2);
    expect(titleUnlocked('shame:hotfoot')).toBe(true);
    expect(TITLE_BY_ID['shame:hotfoot'].name).toBe('Hot Foot');
    expect(reward.unlocks.some((u) => u.title.includes('Hot Foot'))).toBe(true);
    // The same death again pays nothing new.
    const again = game();
    again.enemies = [];
    again.player.hp = 1;
    hurt(again, 1, null, 'the lava');
    expect(finishRunMeta(again, 0).unlocks.some((u) => u.title.includes('Hot Foot'))).toBe(false);
    expect(headUnlocked(HEAD_BY_ID.dunce)).toBe(false);
    for (const d of SHAME.slice(0, DUNCE_AT)) meta.shame[d.id] = 1;
    expect(headUnlocked(HEAD_BY_ID.dunce)).toBe(true);
  });

  it('leaves runs that are still going alone', () => {
    expect(shameFor(game())).toEqual([]);
  });
});
