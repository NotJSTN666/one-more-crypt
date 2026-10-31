import { describe, expect, it } from 'vitest';
import { Game, fullPool } from './game';
import { auraUnlocked, finishRunMeta, grantVault, headUnlocked, lookUnlocked, meta, titleUnlocked } from './meta';
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

  it('takes in pieces added later quietly, without announcing each one', () => {
    meta.vault = false;
    grantVault();
    // As if a season's pieces were added after the vault opened.
    meta.looksSeen = meta.looksSeen.filter((id) => id !== 'candycane' && id !== 'aura:snowglobe');
    meta.headsSeen = meta.headsSeen.filter((id) => id !== 'santahat');
    const { unlocks } = finishRunMeta(new Game('endless', 4, 0, { hero: 'knight', pool: fullPool() }), 0);
    expect(unlocks.filter((u) => /cloak|costume|aura/i.test(u.title))).toEqual([]);
    expect(meta.looksSeen).toContain('candycane');
    expect(meta.looksSeen).toContain('aura:snowglobe');
    expect(meta.headsSeen).toContain('santahat');
  });
});
