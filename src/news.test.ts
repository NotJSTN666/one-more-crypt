import { describe, expect, it } from 'vitest';
import { NEWS, liveNews, unreadNews, type NewsDay } from './news';

const day = (date: string): NewsDay => ({ date, title: date, notes: ['✨ x'] });

describe("What's new", () => {
  it('has one entry per day, each with a real date, a title and something in it', () => {
    expect(new Set(NEWS.map((n) => n.date)).size).toBe(NEWS.length);
    for (const n of NEWS) {
      expect(n.date, n.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.title.length, n.date).toBeGreaterThan(0);
      expect(n.notes.length, n.date).toBeGreaterThan(0);
    }
  });

  it('shows days only from their date, newest first', () => {
    const all = [day('2026-10-26'), day('2026-11-01'), day('2026-10-30')];
    expect(liveNews('2026-10-30', all).map((n) => n.date)).toEqual(['2026-10-30', '2026-10-26']);
    expect(liveNews('2026-11-01', all).map((n) => n.date)).toEqual(['2026-11-01', '2026-10-30', '2026-10-26']);
  });

  it('counts the days newer than the last one read', () => {
    const all = [day('2026-10-26'), day('2026-10-29'), day('2026-10-30')];
    expect(unreadNews('2026-10-30', null, all)).toBe(3);
    expect(unreadNews('2026-10-30', '2026-10-29', all)).toBe(1);
    expect(unreadNews('2026-10-30', '2026-10-30', all)).toBe(0);
    // A day that isn't live yet doesn't light the dot.
    expect(unreadNews('2026-10-29', '2026-10-29', all)).toBe(0);
  });
});
