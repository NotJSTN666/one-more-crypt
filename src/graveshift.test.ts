import { describe, expect, it } from 'vitest';
import {
  CROP_BY_ID, FARM_MAP, GRAVE_TILES, PLOT_TILES, buySeed, buyUpgrade, cleanGraveState, fillRequest, growth, isRestless, newGraveState, plotOpen, requestsFor, sellAll, settleGrave, tapPlot,
} from './graveshift';

const MIN = 60_000;
const t0 = Date.UTC(2026, 9, 21, 15, 0);

describe('Grave Shift', () => {
  it('has a whole map with three fields of plots and eight graves', () => {
    expect(FARM_MAP.every((r) => r.length === FARM_MAP[0].length)).toBe(true);
    expect(GRAVE_TILES).toHaveLength(8);
    expect([0, 1, 2].map((f) => PLOT_TILES.filter((p) => p.field === f).length)).toEqual([15, 10, 10]);
  });

  it('clears, plants, waters and harvests with one tap at a time, in real time', () => {
    const s = newGraveState(t0);
    const i = 0;
    expect(tapPlot(s, i, 'glowcap', t0).did).toBe('till');
    expect(tapPlot(s, i, 'pumpkin', t0).did).toBe('noseed');
    expect(tapPlot(s, i, 'glowcap', t0)).toEqual({ did: 'plant', crop: 'glowcap' });
    expect(s.inv['seed:glowcap']).toBe(5);
    expect(s.plots[i].ready).toBe(t0 + 30 * MIN);
    // Watering ten minutes in takes 30% off the twenty minutes left.
    expect(tapPlot(s, i, 'glowcap', t0 + 10 * MIN).did).toBe('water');
    expect(s.plots[i].ready).toBe(t0 + 10 * MIN + 14 * MIN);
    expect(tapPlot(s, i, 'glowcap', t0 + 11 * MIN).did).toBe('growing');
    expect(growth(s.plots[i], t0 + 17 * MIN)).toBeGreaterThan(0.5);
    const got = tapPlot(s, i, 'glowcap', t0 + 25 * MIN);
    expect(got.did).toBe('harvest');
    expect(s.inv.glowcap).toBeGreaterThanOrEqual(1);
    expect(s.plots[i].crop).toBe('tilled');
  });

  it('keeps the outer fields wild until they are cleared', () => {
    const s = newGraveState(t0);
    const outer = PLOT_TILES.findIndex((p) => p.field === 1);
    expect(plotOpen(s, outer)).toBe(false);
    expect(tapPlot(s, outer, 'glowcap', t0).did).toBe('locked');
    s.obols = 5000;
    expect(buyUpgrade(s, 'field', t0)).toBe(true);
    expect(tapPlot(s, outer, 'glowcap', t0).did).toBe('till');
  });

  it('trades in Obols: seeds in, harvest and ectoplasm out', () => {
    const s = newGraveState(t0);
    expect(buySeed(s, 'pumpkin', 1, t0)).toBe(false); // needs the second field
    expect(buySeed(s, 'nightshade', 2, t0)).toBe(true);
    expect(s.obols).toBe(30 - 16);
    s.inv.nightshade = 3;
    s.inv.ecto = 2;
    expect(sellAll(s, t0)).toBe(3 * CROP_BY_ID.nightshade.sell + 2 * 10);
    expect(s.inv['seed:nightshade']).toBe(4);
  });

  it('lets graves go restless over time and quiets them when settled', () => {
    const s = newGraveState(t0);
    expect(isRestless(s, 0, t0)).toBe(true);
    expect(isRestless(s, 5, t0)).toBe(false);
    const paid = settleGrave(s, 0, t0, 0.5);
    expect(paid).toBeGreaterThanOrEqual(10);
    expect(isRestless(s, 0, t0 + 60 * MIN)).toBe(false);
    expect(isRestless(s, 0, t0 + 24 * 60 * MIN)).toBe(true);
  });

  it('posts the same three requests for everyone on a day, and pays once each', () => {
    const a = requestsFor('2026-10-21', 0);
    expect(a).toEqual(requestsFor('2026-10-21', 0));
    expect(a).toHaveLength(3);
    const s = newGraveState(t0);
    s.inv[a[0].item] = a[0].n;
    expect(fillRequest(s, '2026-10-21', 0, t0)).toBe(true);
    expect(fillRequest(s, '2026-10-21', 0, t0)).toBe(false);
    expect(s.obols).toBe(30 + a[0].reward);
  });

  it('reads saved plots safely', () => {
    const s = cleanGraveState({ obols: -5, plots: [{ crop: 'nonsense' }], inv: { glowcap: 2, bad: -1 }, can: 99 }, t0);
    expect(s.obols).toBe(0);
    expect(s.plots[0].crop).toBe('');
    expect(s.inv).toEqual({ glowcap: 2 });
    expect(s.can).toBe(2);
    expect(s.plots).toHaveLength(PLOT_TILES.length);
  });
});
