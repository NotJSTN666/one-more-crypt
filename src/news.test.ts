import { describe, expect, it } from 'vitest';
import { NEWS, liveNews, unreadNews, type NewsItem } from './news';

const item = (id: string, date: string): NewsItem => ({ id, date, emoji: '✨', title: id, lines: ['x'] });

describe("What's new", () => {
  it('has unique ids and real dates', () => {
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
    for (const n of NEWS) expect(n.date, n.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows entries only from their day, newest first', () => {
    const all = [item('a', '2026-10-26'), item('c', '2026-11-01'), item('b', '2026-10-30')];
    expect(liveNews('2026-10-30', all).map((n) => n.id)).toEqual(['b', 'a']);
    expect(liveNews('2026-11-01', all).map((n) => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('counts what is newer than the last one read', () => {
    const all = [item('a', '2026-10-26'), item('b', '2026-10-29'), item('c', '2026-10-30')];
    expect(unreadNews('2026-10-30', null, all)).toBe(3);
    expect(unreadNews('2026-10-30', 'b', all)).toBe(1);
    expect(unreadNews('2026-10-30', 'c', all)).toBe(0);
    // An entry that isn't live yet doesn't light the dot.
    expect(unreadNews('2026-10-29', 'b', all)).toBe(0);
  });
});
