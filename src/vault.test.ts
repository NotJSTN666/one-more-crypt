import { describe, expect, it } from 'vitest';
import { auraUnlocked, grantVault, headUnlocked, lookUnlocked, meta, titleUnlocked } from './meta';
import { AURAS, DECOR, HEADS, LOOKS, TITLES } from './progression';
import { UNLOCKABLE_RELICS } from './relics';

describe('the vault', () => {
  it('opens every cosmetic, title and decoration, but no relics', () => {
    meta.vault = false;
    meta.bought = [];
    expect(grantVault()).toBe(true);
    expect(grantVault()).toBe(false);
    expect(LOOKS.every(lookUnlocked)).toBe(true);
    expect(HEADS.every(headUnlocked)).toBe(true);
    expect(AURAS.every(auraUnlocked)).toBe(true);
    expect(TITLES.every((t) => titleUnlocked(t.id))).toBe(true);
    expect(DECOR.every((d) => meta.bought.includes(d.id))).toBe(true);
    expect(UNLOCKABLE_RELICS.some((r) => meta.bought.includes(r))).toBe(false);
  });
});
