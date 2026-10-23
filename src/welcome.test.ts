import { describe, expect, it } from 'vitest';
import { auraUnlocked, claimWelcome, headUnlocked, lookUnlocked, meta, mergeMeta, titleUnlocked, welcomeNext, welcomeWaiting } from './meta';
import { AURA_BY_ID, HEAD_BY_ID, LOOK_BY_ID, WELCOME } from './progression';

describe('Seven Nights', () => {
  it('gives one gift a day, in order, and waits through missed days', () => {
    meta.welcome = { claimed: 0, last: 0 };
    meta.vault = false;
    const souls = meta.souls;
    expect(welcomeWaiting(100)?.day).toBe(1);
    expect(claimWelcome(100)?.day).toBe(1);
    expect(meta.souls).toBe(souls + 100);
    // Same day: nothing more, and tomorrow's gift is the cloak.
    expect(claimWelcome(100)).toBeNull();
    expect(welcomeNext()?.reward).toEqual({ look: 'gravewalker' });
    expect(lookUnlocked(LOOK_BY_ID.gravewalker)).toBe(false);
    // Skipping a few days doesn't lose it.
    expect(claimWelcome(104)?.day).toBe(2);
    expect(lookUnlocked(LOOK_BY_ID.gravewalker)).toBe(true);
    for (let d = 105; d <= 109; d++) claimWelcome(d);
    expect(meta.welcome.claimed).toBe(WELCOME.length);
    expect(auraUnlocked(AURA_BY_ID.homecoming)).toBe(true);
    expect(headUnlocked(HEAD_BY_ID.sevennights)).toBe(true);
    expect(titleUnlocked('welcome:7')).toBe(true);
    expect(claimWelcome(110)).toBeNull();
    expect(welcomeNext()).toBeNull();
  });

  it('keeps the further progress when syncing devices', () => {
    meta.welcome = { claimed: 2, last: 50 };
    mergeMeta({ welcome: { claimed: 4, last: 52 } });
    expect(meta.welcome).toEqual({ claimed: 4, last: 52 });
    mergeMeta({ welcome: { claimed: 1, last: 60 } });
    expect(meta.welcome).toEqual({ claimed: 4, last: 52 });
    mergeMeta({ welcome: { claimed: 99, last: 'x' } } as never);
    expect(meta.welcome.claimed).toBe(WELCOME.length);
  });
});
