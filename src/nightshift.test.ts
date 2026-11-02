import { describe, expect, it } from 'vitest';
import { cleanGraveState, newGraveState } from './graveshift';
import { DASH_COOLDOWN, FIELD, FIRST_BOSS, NIGHT_RELICS, POTION_HEAL, dash, dashCooldown, isBlessing, lateNight, MAX_LEVEL, chooseRelic, isFusion, levelChoices, newNight, nightSouls, step, wardMul, xpToLevel } from './nightshift';

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

  it('never runs out of upgrades: blessings fill in once the relics are done', () => {
    const n = newNight(seeded(30));
    // six weapons and every charm at the top level, every fusion made
    const weapons = NIGHT_RELICS.filter((r) => r.weapon).slice(0, 6);
    for (const r of NIGHT_RELICS) if (!r.weapon || weapons.includes(r)) n.relics[r.id] = MAX_LEVEL;
    n.fused = { cleaver: true, halo: true, barrage: true, hellwalk: true, tempest: true, glacier: true };
    for (let k = 0; k < 40; k++) {
      n.pendingLevels = 1;
      const c = levelChoices(n);
      expect(c).toHaveLength(3);
      expect(new Set(c).size).toBe(3);
      for (const id of c) expect(isBlessing(id)).toBe(true);
      chooseRelic(n, c[0]);
      expect(n.pendingLevels).toBe(0);
    }
    const taken = Object.values(n.blessings).reduce((a, b) => a + (b ?? 0), 0);
    expect(taken).toBe(40);
  });

  it('blessings stack without a cap, but warding never makes you untouchable', () => {
    const n = newNight(seeded(31));
    n.pendingLevels = 1;
    chooseRelic(n, 'vigor');
    expect(n.maxHp).toBe(24);
    n.blessings.warding = 30;
    expect(wardMul(n)).toBeGreaterThan(0.25);
    expect(wardMul(n)).toBeLessThan(0.35);
  });

  it('150 level-ups in a row always offer three choices', () => {
    const n = newNight(seeded(32));
    for (let k = 0; k < 150; k++) {
      n.pendingLevels = 1;
      const c = levelChoices(n);
      expect(c).toHaveLength(3);
      chooseRelic(n, c[k % 3]);
      expect(n.pendingLevels).toBe(0);
    }
    expect(Object.keys(n.blessings).length).toBeGreaterThan(0);
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

  it('offers the Soul Forge once a weapon is maxed and its charm is held', () => {
    const n = newNight(seeded(11));
    n.relics = { spade: 5 };
    expect(levelChoices(n)).not.toContain('cleaver');
    n.relics.lens = 1;
    const c = levelChoices(n);
    expect(c[0]).toBe('cleaver');
    n.pendingLevels = 1;
    chooseRelic(n, 'cleaver');
    expect(n.fused.cleaver).toBe(true);
    expect(levelChoices(n)).not.toContain('cleaver');
  });

  it('the Shade Cloak brings the dash back sooner', () => {
    const n = newNight(seeded(21));
    expect(dashCooldown(n)).toBe(DASH_COOLDOWN);
    n.relics.cloak = 5;
    expect(dashCooldown(n)).toBeCloseTo(DASH_COOLDOWN / 2);
    expect(dash(n, 1, 0)).toBe(true);
    expect(n.dashReady - n.t).toBeCloseTo(DASH_COOLDOWN / 2);
  });

  it('a potion heals a share of max health, and they stay rare', () => {
    const n = newNight(seeded(22));
    n.maxHp = 40;
    n.hp = 10;
    n.pickups.push({ x: n.x, y: n.y, kind: 'potion', v: 1 });
    step(n, 1 / 60, 0, 0);
    expect(n.hp).toBe(10 + Math.ceil(40 * POTION_HEAL));
    expect(n.potions).toBe(1);
    // ten minutes of ordinary kills drop a handful at most, never one every few seconds
    const m = play(23, 600);
    const dropped = m.potions + m.pickups.filter((p) => p.kind === 'potion').length;
    expect(dropped).toBeLessThanOrEqual(600 / 25 + m.bossKills + 1);
  });

  it('a boss leaves a potion and a forge ember, and the ember opens the forge', () => {
    const n = play(24, FIRST_BOSS + 1);
    const boss = n.foes.find((f) => f.boss)!;
    expect(boss).toBeTruthy();
    // strike it down
    boss.hp = 0.0001;
    n.relics.spade = MAX_LEVEL;
    n.relics.lens = 1;
    n.x = boss.x - 0.5;
    n.y = boss.y;
    for (let i = 0; i < 120 && n.foes.some((f) => f.boss); i++) {
      if (n.pendingLevels) chooseRelic(n, levelChoices(n)[0]);
      step(n, 1 / 60, 0, 0);
    }
    const drops = n.pickups.filter((p) => p.kind === 'potion' || p.kind === 'forge').map((p) => p.kind);
    // already gathered, or lying close by
    expect(n.potions + drops.filter((k) => k === 'potion').length).toBeGreaterThanOrEqual(1);
    // gather the ember: the next choice is the forge, with the ready fusion first
    n.pickups.push({ x: n.x, y: n.y, kind: 'forge', v: 1 });
    n.pendingLevels = 0;
    n.forgeOffers = 0;
    step(n, 1 / 60, 0, 0);
    expect(n.pendingLevels).toBe(1);
    expect(n.forgeOffers).toBe(1);
    const c = levelChoices(n);
    expect(c[0]).toBe('cleaver');
    chooseRelic(n, c[0]);
    expect(n.fused.cleaver).toBe(true);
    expect(n.forgeOffers).toBe(0);
  });

  it('with nothing to fuse, the forge sharpens a weapon you carry', () => {
    const n = newNight(seeded(25));
    n.relics = { spade: 2, skulls: 1, heart: 1 };
    n.pendingLevels = 1;
    n.forgeOffers = 1;
    const c = levelChoices(n);
    expect(c.length).toBeGreaterThan(0);
    for (const id of c) expect(!isFusion(id) && ['spade', 'skulls'].includes(id)).toBe(true);
  });

  it('a dash strikes the dead in its way and throws them aside', () => {
    const n = newNight(seeded(12));
    n.foes.push({ id: 900, kind: 'ghoul', x: n.x + 1, y: n.y + 0.2, hp: 999, maxHp: 999, speed: 0, dmg: 1, r: 0.35, xp: 1, slowUntil: 0, skullAt: 0, kx: 0, ky: 0, hitAt: -1, boss: false, atkAt: 0, atkN: 0, tier: 0 });
    n.relics = {};
    dash(n, 1, 0);
    for (let k = 0; k < 6; k++) step(n, 1 / 60, 0, 0);
    const f = n.foes.find((x) => x.id === 900)!;
    expect(f.hp).toBeLessThan(999);
    expect(Math.abs(f.y - n.y)).toBeGreaterThan(0.4);
  });

  it('the late night hardens the dead every minute past ten', () => {
    const n = newNight(seeded(13));
    expect(lateNight(n)).toBe(0);
    n.t = 900;
    expect(lateNight(n)).toBe(5);
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
