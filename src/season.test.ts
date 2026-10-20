import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, fullPool } from './game';
import { buyItem, finishRunMeta, lookUnlocked, meta, openSeasons } from './meta';
import { DECOR, HEADS, LOOKS, LOOK_BY_ID, seasonOf, seasonOpen } from './progression';

// Noon Central on a given date.
const at = (date: string) => new Date(`${date}T17:00:00Z`).getTime();

describe('the Hallowed Season', () => {
  afterEach(() => vi.useRealTimers());

  it('is open from October 19 to November 2, Central Time', () => {
    expect(seasonOpen('halloween', '2026-10-18')).toBe(false);
    expect(seasonOpen('halloween', '2026-10-19')).toBe(true);
    expect(seasonOpen('halloween', '2026-10-31')).toBe(true);
    expect(seasonOpen('halloween', '2026-11-02')).toBe(true);
    expect(seasonOpen('halloween', '2026-11-03')).toBe(false);
    expect(openSeasons(at('2026-10-31'))).toEqual(['halloween']);
    expect(openSeasons(at('2026-12-25'))).toEqual([]);
  });

  it('has its own pieces, each with a unique id', () => {
    const ids = [...LOOKS.map((l) => l.id), ...HEADS.map((h) => h.id), ...DECOR.map((d) => d.id)];
    const seasonal = [...LOOKS.filter((l) => seasonOf(l.unlock)), ...HEADS.filter((h) => seasonOf(h.unlock)), ...DECOR.filter((d) => d.season)].map((x) => x.id);
    for (const id of seasonal) expect(ids.filter((x) => x === id), id).toHaveLength(1);
    expect(LOOKS.filter((l) => seasonOf(l.unlock) === 'halloween').length).toBeGreaterThanOrEqual(6);
    expect(HEADS.filter((h) => seasonOf(h.unlock) === 'halloween').length).toBeGreaterThanOrEqual(8);
    expect(DECOR.filter((d) => d.season === 'halloween').length).toBeGreaterThanOrEqual(6);
  });

  it('sells its pieces only while it lasts, and keeps them after', () => {
    vi.useFakeTimers();
    meta.souls = 10_000;
    meta.bought = [];
    vi.setSystemTime(at('2026-11-05'));
    expect(buyItem('witchhat', 600)).toBe(false);
    expect(buyItem('cobwebs', 400)).toBe(false);
    expect(buyItem('cinder', 300)).toBe(true); // all-year pieces sell any time
    vi.setSystemTime(at('2026-10-25'));
    expect(buyItem('witchhat', 600)).toBe(true);
    expect(buyItem('cobwebs', 400)).toBe(true);
    vi.setSystemTime(at('2026-11-05'));
    expect(meta.bought).toContain('witchhat');
  });

  it('gives the Hallowed Shroud for playing any run during it', () => {
    vi.useFakeTimers();
    meta.seasons = [];
    const play = () => finishRunMeta(new Game('endless', 3, 0, { hero: 'knight', pool: fullPool() }), 0);
    vi.setSystemTime(at('2026-11-10'));
    play();
    expect(lookUnlocked(LOOK_BY_ID.hallowed)).toBe(false);
    vi.setSystemTime(at('2026-10-30'));
    const reward = play();
    expect(lookUnlocked(LOOK_BY_ID.hallowed)).toBe(true);
    expect(reward.unlocks.some((u) => u.title.includes('Hallowed Shroud'))).toBe(true);
    expect(meta.seasons).toEqual(['halloween-2026']);
  });
});
