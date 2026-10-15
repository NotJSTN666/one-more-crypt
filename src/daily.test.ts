import { describe, expect, it } from 'vitest';
import { dailyNumber, msUntilNextDaily } from './daily';

const t = (iso: string) => Date.parse(iso);

describe('daily numbering', () => {
  it('rolls over at midnight Central Time', () => {
    expect(dailyNumber(t('2026-10-14T05:00:00Z'))).toBe(1); // 00:00 CDT Oct 14
    expect(dailyNumber(t('2026-10-15T04:59:59Z'))).toBe(1); // 23:59:59 CDT
    expect(dailyNumber(t('2026-10-15T05:00:00Z'))).toBe(2); // midnight CDT Oct 15
    expect(msUntilNextDaily(t('2026-10-15T00:30:00Z'))).toBe(4.5 * 3600_000);
  });

  it('follows daylight saving time', () => {
    // After clocks fall back on Nov 1, midnight is 06:00 UTC.
    expect(dailyNumber(t('2026-11-03T05:59:59Z'))).toBe(dailyNumber(t('2026-11-02T12:00:00Z')));
    expect(dailyNumber(t('2026-11-03T06:00:00Z'))).toBe(dailyNumber(t('2026-11-02T12:00:00Z')) + 1);
    expect(msUntilNextDaily(t('2026-11-03T05:00:00Z'))).toBe(3600_000);
    expect(msUntilNextDaily(t('2026-11-01T05:00:00Z'))).toBe(25 * 3600_000);
  });
});
