import { afterEach, describe, expect, it } from 'vitest';
import { meta } from './meta';
import { DEPTH_INKS, EFFECTS, INKS, cleanStyle, earnedStyles, myNameStyle, needMet, setNameStyle, styleClass } from './name-style';

const was = { dailyTotal: meta.dailyTotal, deepest: meta.deepest, streak: { ...meta.streak }, style: { ...meta.nameStyle } };

describe('name styles', () => {
  afterEach(() => {
    meta.dailyTotal = was.dailyTotal;
    meta.deepest = was.deepest;
    meta.streak = { ...was.streak };
    meta.nameStyle = { ...was.style };
  });

  it('has every ink and effect once, each with a way to earn it', () => {
    const ids = [...INKS, ...DEPTH_INKS].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(EFFECTS.map((s) => s.id)).size).toBe(EFFECTS.length);
    expect(EFFECTS).toHaveLength(9);
  });

  it('earns inks by Dailies played, on any days', () => {
    meta.dailyTotal = 6;
    expect(needMet(INKS.find((s) => s.id === 'ember')!.need)).toBe(true);
    expect(needMet(INKS.find((s) => s.id === 'wisp')!.need)).toBe(false);
    expect(earnedStyles()).toContain('ink:gold');
  });

  it('only wears what is earned, and keeps nonsense off the boards', () => {
    meta.dailyTotal = 0;
    meta.streak = { best: 0, count: 0, last: 0 };
    setNameStyle('ink', 'pyre');
    setNameStyle('fx', 'flame');
    expect(myNameStyle()).toEqual({ ink: '', fx: '' });
    meta.dailyTotal = 30;
    meta.streak = { best: 14, count: 0, last: 0 };
    setNameStyle('ink', 'pyre');
    setNameStyle('fx', 'flame');
    expect(myNameStyle()).toEqual({ ink: 'pyre', fx: 'flame' });
    expect(styleClass(myNameStyle())).toBe('ns-ink-pyre ns-fx-flame');
    expect(cleanStyle({ ink: 'x" onload="', fx: 'glow' })).toEqual({ ink: '', fx: 'glow' });
    expect(cleanStyle('pyre')).toBeNull();
    expect(cleanStyle({})).toBeNull();
  });
});
