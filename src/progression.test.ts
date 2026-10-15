import { describe, expect, it } from 'vitest';
import { Game, fullPool } from './game';
import { finishRunMeta, meta } from './meta';
import { SOUL_RANKS, TITLES, TITLE_BY_ID, betterRun, rankFor, rankProgress } from './progression';

describe('Soul Ranks', () => {
  it('climb with lifetime Souls', () => {
    expect(rankFor(0).name).toBe('Grave Digger');
    expect(rankFor(199).name).toBe('Grave Digger');
    expect(rankFor(200).name).toBe('Bone Collector');
    expect(rankFor(10_000_000).name).toBe(SOUL_RANKS[SOUL_RANKS.length - 1].name);
    expect(rankProgress(400)).toMatchObject({ needed: 200, fraction: 0.5 });
    expect(rankProgress(20_000).next).toBeNull();
  });

  it('every title has a unique id and a name', () => {
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
    for (const t of TITLES) expect(TITLE_BY_ID[t.id].name).toBeTruthy();
  });
});

describe('best runs', () => {
  const run = (floor: number, kills: number) => ({ floor, kills, mode: 'endless' as const, relics: {}, log: [], look: '', at: 0 });
  it('keep the deeper run, then more kills', () => {
    expect(betterRun(run(5, 10), run(6, 1))?.floor).toBe(6);
    expect(betterRun(run(6, 10), run(6, 11))?.kills).toBe(11);
    expect(betterRun(undefined, run(3, 1))?.floor).toBe(3);
  });
});

describe('the Bestiary', () => {
  it('counts kills by kind and pays out milestones once', () => {
    const g = new Game('endless', 1, 0, { hero: 'knight', pool: fullPool() });
    g.stats.kinds = { ghoul: 30, boss: 1 };
    g.floor = 6;
    const before = meta.earned;
    const reward = finishRunMeta(g, 0);
    expect(meta.bestiary.ghoul).toBe(30);
    expect(meta.bestiaryTier.ghoul).toBe(1);
    expect(meta.bestiaryTier.boss).toBe(1);
    expect(reward.unlocks.some((u) => u.title.includes('25'))).toBe(true);
    expect(meta.best.knight?.floor).toBe(6);
    // A second run below the next milestone pays nothing more.
    const g2 = new Game('endless', 2, 0, { hero: 'knight', pool: fullPool() });
    g2.stats.kinds = { ghoul: 5 };
    const again = finishRunMeta(g2, 0);
    expect(again.unlocks.filter((u) => u.title.startsWith('Bestiary'))).toHaveLength(0);
    expect(meta.bestiary.ghoul).toBe(35);
    expect(meta.earned).toBeGreaterThan(before);
  });
});

describe('per-hero records', () => {
  it('are rebuilt from past runs by replaying them', async () => {
    const { backfillHeroes } = await import('./meta');
    const g = new Game('endless', 77, 0, { hero: 'rogue', pool: fullPool() });
    for (let i = 0; i < 400 && g.phase !== 'dead'; i++) {
      if (g.phase === 'choose') g.choose(0);
      else if (g.phase === 'event') g.resolveEvent(false);
      else g.act(0, i % 2 ? -1 : 1);
    }
    meta.heroBackfill = 0;
    await backfillHeroes([{ mode: 'endless', daily_no: null, seed: 77, floor: g.floor, kills: g.kills, log: g.header() + g.log }]);
    expect(meta.heroStats.rogue?.floor).toBe(g.floor);
    expect(meta.heroStats.rogue?.runs).toBe(1);
    expect(meta.heroBackfill).toBe(1);
    expect(meta.best.rogue?.floor).toBe(g.floor);
  });
});

describe('the Wardrobe', () => {
  it('gives each hero their own costumes, earned their own way', async () => {
    const { equipOutfit, outfitFor, finishRunMeta, costumeUnlocked } = await import('./meta');
    meta.outfits = {};
    meta.heroUnlocks = {};
    meta.heroStats = { knight: { floor: 12, souls: 0, runs: 3 } };
    // Knight: the Great Helm comes from reaching floor 10 as the Knight.
    expect(costumeUnlocked('greathelm')).toBe(true);
    equipOutfit('knight', 'head', 'greathelm');
    expect(outfitFor('knight').head).toBe('greathelm');
    // Another hero's piece can't be worn, even once earned.
    equipOutfit('knight', 'head', 'horns');
    expect(outfitFor('knight').head).toBe('greathelm');
    // Barbarian: Demon Horns need 10 kills at 3 HP or less in one run.
    expect(costumeUnlocked('horns')).toBe(false);
    const g = new Game('endless', 3, 0, { hero: 'barbarian', pool: fullPool() });
    g.stats.lowHpKills = 10;
    const reward = finishRunMeta(g, 0);
    expect(costumeUnlocked('horns')).toBe(true);
    expect(reward.unlocks.some((u) => u.title.includes('Demon Horns'))).toBe(true);
    equipOutfit('barbarian', 'head', 'horns');
    expect(outfitFor('barbarian').head).toBe('horns');
    // Locked pieces stay off.
    equipOutfit('barbarian', 'look', 'bloodrage');
    expect(outfitFor('barbarian').look).toBe('');
  });
});
