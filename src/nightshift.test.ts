import { describe, expect, it } from 'vitest';
import { cleanGraveState, newGraveState } from './graveshift';
import { DASH_COOLDOWN, FIELD, FIRST_BOSS, dash, MAX_LEVEL, chooseRelic, levelChoices, newNight, nightSouls, step, xpToLevel } from './nightshift';

/** A small fixed random source, so every run of a test is the same night. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Run a night, circling to stay alive and always taking the first choice. */
function play(seed: number, seconds: number) {
  const n = newNight(seeded(seed));
  let i = 0;
  while (!n.over && n.t < seconds && i++ < seconds * 60 + 10000) {
    if (n.pendingLevels) {
      const c = levelChoices(n);
      if (c.length) chooseRelic(n, c[0]);
      else n.pendingLevels = 0;
      continue;
    }
    step(n, 1 / 60, Math.cos(n.t * 0.4), Math.sin(n.t * 0.4));
  }
  return n;
}

describe('the Night Shift', () => {
  it('starts with the spade in the middle of the field', () => {
    const n = newNight(seeded(1));
    expect(n.relics).toEqual({ spade: 1 });
    expect(n.x).toBe(FIELD / 2);
    expect(n.hp).toBe(n.maxHp);
  });

  it('sends the dead in from every side, out of sight', () => {
    const n = newNight(seeded(2));
    for (let k = 0; k < 60 * 10; k++) step(n, 1 / 60, 0, 0);
    expect(n.foes.length + n.kills).toBeGreaterThan(5);
    const sides = new Set(n.foes.map((f) => `${Math.sign(Math.round(f.x - n.x))},${Math.sign(Math.round(f.y - n.y))}`));
    expect(sides.size).toBeGreaterThan(2);
  });

  it('levels you up from souls and waits for a choice', () => {
    const n = play(3, 90);
    expect(n.level).toBeGreaterThan(2);
    expect(Object.keys(n.relics).length).toBeGreaterThan(1);
    // A waiting level holds the night still.
    n.pendingLevels = 1;
    const t = n.t;
    step(n, 1, 1, 0);
    expect(n.t).toBe(t);
  });

  it('offers three different relics, never past the top level', () => {
    const n = newNight(seeded(4));
    n.relics.spade = MAX_LEVEL;
    const c = levelChoices(n);
    expect(c).toHaveLength(3);
    expect(new Set(c).size).toBe(3);
    expect(c).not.toContain('spade');
    n.pendingLevels = 1;
    chooseRelic(n, 'spade');
    expect(n.relics.spade).toBe(MAX_LEVEL);
    expect(n.pendingLevels).toBe(1);
  });

  it('an Iron Heart raises max health', () => {
    const n = newNight(seeded(5));
    n.pendingLevels = 1;
    chooseRelic(n, 'heart');
    expect(n.maxHp).toBe(25);
  });

  it('standing still with only a spade does not last', () => {
    const n = newNight(seeded(6));
    for (let k = 0; k < 600 * 60 && !n.over; k++) {
      if (n.pendingLevels) n.pendingLevels = 0;
      step(n, 1 / 60, 0, 0);
    }
    expect(n.over).toBe(true);
  });

  it('has no dawn: the night runs on, and bosses keep rising', () => {
    const n = newNight(seeded(7));
    n.maxHp = n.hp = 1e9;
    for (let k = 0; k < (FIRST_BOSS + 125) * 60; k++) {
      if (n.pendingLevels) n.pendingLevels = 0;
      step(n, 1 / 60, 0, 0);
    }
    expect(n.over).toBe(false);
    expect(n.bossesRisen).toBe(2);
  });

  it('bosses fire bolts or mark lanes to dodge', () => {
    const n = newNight(seeded(8));
    n.maxHp = n.hp = 1e9;
    let seen = false;
    for (let k = 0; k < (FIRST_BOSS + 10) * 60 && !seen; k++) {
      if (n.pendingLevels) n.pendingLevels = 0;
      step(n, 1 / 60, 0, 0);
      seen = n.lanes.length > 0 || n.shots.length > 0;
    }
    expect(seen).toBe(true);
  });

  it('dashes: a burst you cannot be hurt in, then a cooldown', () => {
    const n = newNight(seeded(10));
    const x = n.x;
    expect(dash(n, 1, 0)).toBe(true);
    for (let k = 0; k < 12; k++) step(n, 1 / 60, 0, 0);
    expect(n.x - x).toBeGreaterThan(2);
    expect(dash(n, 1, 0)).toBe(false);
    n.t = n.dashReady - 0.01;
    expect(dash(n)).toBe(false);
    n.t += DASH_COOLDOWN;
    expect(dash(n)).toBe(true);
    // mid-dash, a bite does nothing
    n.foes.push({ ...n.foes[0], id: 999, kind: 'ghoul', x: n.x, y: n.y, hp: 99, maxHp: 99, speed: 0, dmg: 5, r: 0.4, xp: 1, slowUntil: 0, skullAt: 0, kx: 0, ky: 0, hitAt: -1, boss: false, atkAt: 0, atkN: 0, tier: 0 });
    const hp = n.hp;
    step(n, 1 / 60, 0, 0);
    expect(n.hp).toBe(hp);
  });

  it('pays Souls for kills', () => {
    const n = newNight(seeded(9));
    n.kills = 600;
    expect(nightSouls(n)).toBe(100);
    n.kills = 99999;
    expect(nightSouls(n)).toBe(500);
  });

  it('needs more souls for each level', () => {
    expect(xpToLevel(2)).toBeGreaterThan(xpToLevel(1));
  });

  it('keeps its records in the saved Grave Shift', () => {
    const s = { ...newGraveState(0), nights: 3, dawns: 1, nightBest: 412, nightKills: 900 };
    const back = cleanGraveState(JSON.parse(JSON.stringify(s)), 0);
    expect(back).toMatchObject({ nights: 3, dawns: 1, nightBest: 412, nightKills: 900 });
    expect(cleanGraveState({ nights: 'x' }, 0).nights).toBe(0);
  });
});
