import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawAura } from './aura';
import { auraUnlocked, buyItem, deepestFloor, equipOutfit, meta, noteDeepest, outfitFor } from './meta';
import { AURAS, AURA_BY_ID, SOUL_RANKS, rankFor } from './progression';

/** A stand-in canvas context that accepts every call. */
function fakeCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop: () => undefined };
  return new Proxy({} as Record<string, unknown>, {
    get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad : () => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

describe('auras', () => {
  afterEach(() => vi.useRealTimers());

  it('each has a unique id and draws without trouble at any size', () => {
    expect(new Set(AURAS.map((a) => a.id)).size).toBe(AURAS.length);
    const ctx = fakeCtx();
    for (const a of AURAS) {
      for (const w of [12, 96]) {
        for (const t of [0, 0.5, 3.7, 120]) {
          drawAura(ctx, a.id, 50, 50, w, t, 'back');
          drawAura(ctx, a.id, 50, 50, w, t, 'front');
        }
      }
    }
    drawAura(ctx, 'nonsense', 0, 0, 12, 0, 'back');
  });

  it('unlocks the depth auras from floors already reached, including the account record', () => {
    meta.best = {};
    meta.heroStats = {};
    meta.deepest = 0;
    expect(auraUnlocked(AURA_BY_ID.candleglow)).toBe(false);
    meta.heroStats.knight = { floor: 52, souls: 0, runs: 3 };
    expect(deepestFloor()).toBe(52);
    expect(auraUnlocked(AURA_BY_ID.emberheart)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.tidecaller)).toBe(false);
    noteDeepest(290);
    expect(auraUnlocked(AURA_BY_ID.abyssal)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.voidcrown)).toBe(false);
  });

  it('can be worn only once earned, per hero', () => {
    meta.deepest = 120;
    meta.outfits = {};
    equipOutfit('knight', 'aura', 'bonewind');
    expect(outfitFor('knight').aura).toBe('');
    equipOutfit('knight', 'aura', 'tidecaller');
    expect(outfitFor('knight').aura).toBe('tidecaller');
    expect(outfitFor('mage').aura).toBe('');
  });

  it('gives the rainbow to patrons and the top auras to the new Soul Ranks', () => {
    meta.patron = false;
    expect(auraUnlocked(AURA_BY_ID.patronglow)).toBe(false);
    meta.patron = true;
    expect(auraUnlocked(AURA_BY_ID.patronglow)).toBe(true);
    expect(SOUL_RANKS.map((r) => r.name).slice(-3)).toEqual(['Soulreaver', 'Crypt Sovereign', 'The Eternal']);
    expect(rankFor(25_000).name).toBe('Soulreaver');
    meta.earned = 12_608;
    expect(auraUnlocked(AURA_BY_ID.soulstorm)).toBe(false);
    meta.earned = 100_000;
    expect(auraUnlocked(AURA_BY_ID.eternity)).toBe(true);
  });

  it('sells the shop auras, and the Halloween one only in season', () => {
    vi.useFakeTimers();
    meta.souls = 20_000;
    meta.bought = [];
    expect(buyItem('frostbite', 2500)).toBe(true);
    expect(auraUnlocked(AURA_BY_ID.frostbite)).toBe(true);
    vi.setSystemTime(new Date('2026-11-10T17:00:00Z'));
    expect(buyItem('hallowedwisps', 3000)).toBe(false);
    vi.setSystemTime(new Date('2026-10-25T17:00:00Z'));
    expect(buyItem('hallowedwisps', 3000)).toBe(true);
  });
});
