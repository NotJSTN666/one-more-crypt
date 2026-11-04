import { describe, expect, it } from 'vitest';
import { advanceTrial, weekTrial } from './trials';

describe('the Weekly Trial', () => {
  it('is the same for everyone in a week, and changes from week to week', () => {
    expect(weekTrial('2026-11-02')).toEqual(weekTrial('2026-11-02'));
    const kinds = new Set(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07'].map((w) => weekTrial(w).kind));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('adds up over the week, completes once, and starts afresh next week', () => {
    const week = '2026-11-02';
    const t = weekTrial(week);
    const run = { kind: 'run' as const, kills: 250, bosses: 3, hero: t.hero ?? 'knight', floor: 16, vaults: 1, fusions: 2, daily: true };
    const horde = { kind: 'horde' as const, wave: 16 };
    const night = { kind: 'night' as const, seconds: 700 };
    let state = undefined;
    let completions = 0;
    for (let i = 0; i < 6; i++) {
      for (const e of [run, horde, night]) {
        const r = advanceTrial(state, e, week);
        state = r.state;
        if (r.completed) completions++;
      }
    }
    expect(completions).toBe(1);
    expect(state!.done).toBe(true);
    expect(advanceTrial(state, run, '2026-11-09').state).toMatchObject({ week: '2026-11-09', done: false });
  });
});
