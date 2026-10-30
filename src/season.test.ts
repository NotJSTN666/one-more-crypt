import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, fullPool } from './game';
import { buyItem, finishRunMeta, lookUnlocked, meta, openSeasons } from './meta';
import { AURAS, DECOR, HEADS, LOOKS, LOOK_BY_ID, seasonDress, seasonOf, seasonOpen, thanksgiving } from './progression';

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
    expect(openSeasons(at('2026-10-10'))).toEqual([]);
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
    vi.setSystemTime(at('2026-10-10'));
    play();
    expect(lookUnlocked(LOOK_BY_ID.hallowed)).toBe(false);
    vi.setSystemTime(at('2026-10-30'));
    const reward = play();
    expect(lookUnlocked(LOOK_BY_ID.hallowed)).toBe(true);
    expect(reward.unlocks.some((u) => u.title.includes('Hallowed Shroud'))).toBe(true);
    expect(meta.seasons).toEqual(['halloween-2026']);
  });
});

describe('the Harvest Feast and Midwinter', () => {
  afterEach(() => vi.useRealTimers());

  it('open on their dates: the Harvest Feast from November 1, Midwinter from the day after Thanksgiving', () => {
    expect(thanksgiving(2026)).toBe('11-26');
    expect(thanksgiving(2027)).toBe('11-25');
    expect(thanksgiving(2028)).toBe('11-23');
    expect(seasonOpen('harvest', '2026-10-31')).toBe(false);
    expect(seasonOpen('harvest', '2026-11-01')).toBe(true);
    expect(seasonOpen('harvest', '2026-11-26')).toBe(true);
    expect(seasonOpen('harvest', '2026-11-27')).toBe(false);
    expect(seasonOpen('midwinter', '2026-11-26')).toBe(false);
    expect(seasonOpen('midwinter', '2026-11-27')).toBe(true);
    expect(seasonOpen('midwinter', '2026-12-25')).toBe(true);
    expect(seasonOpen('midwinter', '2027-01-06')).toBe(true);
    expect(seasonOpen('midwinter', '2027-01-07')).toBe(false);
    // Thanksgiving moves: in 2027 the feast ends on the 25th and Midwinter starts the 26th.
    expect(seasonOpen('harvest', '2027-11-26')).toBe(false);
    expect(seasonOpen('midwinter', '2027-11-26')).toBe(true);
    // The Hallowed Season's last two days overlap the feast's first two.
    expect(openSeasons(at('2026-11-01'))).toEqual(['halloween', 'harvest']);
    expect(openSeasons(at('2026-11-20'))).toEqual(['harvest']);
    expect(openSeasons(at('2026-12-25'))).toEqual(['midwinter']);
    expect(openSeasons(at('2027-01-03'))).toEqual(['midwinter']);
  });

  it('dress the world above the crypt: leaves for the feast, snow for Midwinter', () => {
    expect(seasonDress('2026-10-25')).toBeNull();
    expect(seasonDress('2026-11-01')).toBe('harvest');
    expect(seasonDress('2026-11-27')).toBe('midwinter');
    expect(seasonDress('2027-01-07')).toBeNull();
  });

  it('each have a free cloak, cloaks and hats to buy, an aura and Hall pieces', () => {
    for (const season of ['harvest', 'midwinter'] as const) {
      const free = LOOKS.filter((l) => 'season' in l.unlock && !('cost' in l.unlock) && l.unlock.season === season);
      expect(free, season).toHaveLength(1);
      expect(LOOKS.filter((l) => seasonOf(l.unlock) === season).length, season).toBeGreaterThanOrEqual(4);
      expect(HEADS.filter((h) => seasonOf(h.unlock) === season).length, season).toBeGreaterThanOrEqual(4);
      expect(AURAS.filter((a) => 'season' in a.unlock && a.unlock.season === season).length, season).toBeGreaterThanOrEqual(1);
      expect(DECOR.filter((d) => d.season === season).length, season).toBeGreaterThanOrEqual(3);
    }
  });

  it('sell their pieces only while they last', () => {
    vi.useFakeTimers();
    meta.souls = 10_000;
    meta.bought = [];
    vi.setSystemTime(at('2026-11-26'));
    expect(buyItem('turkeyhat', 800)).toBe(true);
    expect(buyItem('cornucopia', 750)).toBe(true);
    expect(buyItem('santahat', 500)).toBe(false);
    vi.setSystemTime(at('2027-01-02'));
    expect(buyItem('santahat', 500)).toBe(true);
    expect(buyItem('xmastree', 1500)).toBe(true);
    expect(buyItem('feast', 900)).toBe(false);
  });

  it('give the Midwinter Mantle for a run on New Year\'s Day', () => {
    vi.useFakeTimers();
    meta.seasons = [];
    vi.setSystemTime(at('2027-01-01'));
    finishRunMeta(new Game('endless', 3, 0, { hero: 'knight', pool: fullPool() }), 0);
    expect(lookUnlocked(LOOK_BY_ID.midwintermantle)).toBe(true);
    expect(lookUnlocked(LOOK_BY_ID.harvestmantle)).toBe(false);
  });
});
