import { describe, expect, it } from 'vitest';
import { dailyNumber } from './daily';
import { buyItem, meta } from './meta';
import { marketPiece, marketPieces } from './progression';

describe('the Grave Market', () => {
  it('offers every piece in turn before any comes back', () => {
    const all = marketPieces();
    expect(all.length).toBeGreaterThanOrEqual(10);
    const seen = new Set(Array.from({ length: all.length }, (_, d) => marketPiece(100 + d).id));
    expect(seen.size).toBe(all.length);
    expect(marketPiece(123).id).toBe(marketPiece(123).id);
    expect(marketPiece(123).id).not.toBe(marketPiece(124).id);
  });

  it('sells a piece only on its day', () => {
    meta.souls = 100000;
    const today = marketPiece(dailyNumber());
    const other = marketPieces().find((p) => p.id !== today.id)!;
    expect(buyItem(other.id, other.cost)).toBe(false);
    expect(buyItem(today.id, today.cost)).toBe(true);
    expect(meta.bought).toContain(today.id);
  });
});
