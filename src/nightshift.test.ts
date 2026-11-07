import { describe, expect, it } from 'vitest';
import { cleanGraveState, newGraveState } from './graveshift';
import { DAWN, MOTHER_AT, banish, chooseDawn, reroll, skipLevel, ASCEND_LEVEL, ELITE_LEVEL, FIRST_EVENT, NO_PACT, dashDamage, isAscend, isPact, DASH_COOLDOWN, FIELD, FIRST_BOSS, NIGHT_RELICS, POTION_HEAL, dash, dashCooldown, isBlessing, lateNight, MAX_LEVEL, chooseRelic, nightFeats, isFusion, levelChoices, newNight, nightSouls, step, wardMul, xpToLevel, ALLY_PICK, COMPANION_IDS, nightRank, companionOpen, MAX_NIGHT_RANK } from './nightshift';

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

  it('earns its achievements at the right moments', () => {
    const n = newNight(seeded(40));
    expect(nightFeats(n)).toEqual([]);
    n.t = 181;
    expect(nightFeats(n)).toContain('nsuntouched');
    n.firstHitAt = 120;
    expect(nightFeats(n)).not.toContain('nsuntouched');
    n.t = 901;
    n.kills = 1000;
    expect(nightFeats(n)).toEqual(expect.arrayContaining(['nsfirst', 'ns15', 'ns1k']));
    expect(nightFeats(n)).not.toContain('ns25');
    n.fused = { cleaver: true, halo: true, eclipse: true };
    n.felledKinds = ['boss', 'abbot', 'lich'];
    n.blessings = { might: 20, vigor: 5 };
    expect(nightFeats(n)).toEqual(expect.arrayContaining(['nsforge3', 'nsbosses', 'nsblessed']));
  });

  it('remembers each kind of boss felled, and the first hit taken', () => {
    const n = play(41, FIRST_BOSS + 1);
    expect(n.firstHitAt).not.toBe(0);
    const boss = n.foes.find((f) => f.boss)!;
    boss.hp = 0.0001;
    n.x = boss.x - 0.5;
    n.y = boss.y;
    for (let i = 0; i < 120 && n.foes.some((f) => f.boss); i++) {
      if (n.pendingLevels) chooseRelic(n, levelChoices(n)[0]);
      step(n, 1 / 60, 0, 0);
    }
    expect(n.felledKinds).toEqual([boss.kind]);
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
    n.pactOffers = 0;
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

describe('the late night: events, elites, pacts and ascension', () => {
  it('brings an event a minute after the bosses, one at a time, and not the same twice running', () => {
    const n = play(31, FIRST_EVENT + 1);
    expect(n.over || n.events >= 1).toBe(true);
    if (!n.over) {
      expect(n.event).not.toBeNull();
      const first = n.event!.kind;
      const m = play(31, FIRST_EVENT + 121);
      if (!m.over) expect(m.lastEvent).not.toBe(first);
    }
  });

  it('keeps the old rules when the late night is off', () => {
    const n = newNight(seeded(5), false);
    n.t = FIRST_EVENT + 5;
    n.level = ELITE_LEVEL + 40;
    for (let k = 0; k < 600; k++) step(n, 1 / 60, 1, 0);
    expect(n.events).toBe(0);
    expect(n.foes.some((f) => f.elite)).toBe(false);
  });

  it('sends elites past their level, and an armored one breaks only to a dash', () => {
    const n = newNight(seeded(6));
    n.level = ELITE_LEVEL + 50;
    for (let k = 0; k < 60 * 40 && !n.foes.some((f) => f.elite === 'armored'); k++) step(n, 1 / 60, Math.cos(k / 50), Math.sin(k / 50));
    const e = n.foes.find((f) => f.elite === 'armored');
    expect(e).toBeTruthy();
  });

  it('offers a pact when a boss falls, and a pact changes the night', () => {
    const n = play(24, FIRST_BOSS + 1);
    const boss = n.foes.find((f) => f.boss)!;
    boss.hp = 0.0001;
    n.x = boss.x - 0.5;
    n.y = boss.y;
    for (let i = 0; i < 120 && n.foes.some((f) => f.boss) && !n.pactOffers; i++) step(n, 1 / 60, 0, 0);
    expect(n.pactOffers).toBe(1);
    const c = levelChoices(n);
    expect(c.every(isPact)).toBe(true);
    expect(c).toContain(NO_PACT);
    const before = dashDamage(n);
    n.pacts = {};
    chooseRelic(n, 'fangs');
    expect(n.pacts.fangs).toBe(true);
    expect(dashDamage(n)).toBeCloseTo(before * 2);
    expect(n.pactOffers).toBe(0);
  });

  it('ascends a fused relic with a shard, past its level', () => {
    const n = newNight(seeded(8));
    n.level = ASCEND_LEVEL;
    n.relics.spade = MAX_LEVEL;
    n.relics.lens = 1;
    n.fused.cleaver = true;
    n.pickups.push({ x: n.x, y: n.y, kind: 'shard', v: 1 });
    step(n, 1 / 60, 0, 0);
    expect(n.ascendOffers).toBe(1);
    const c = levelChoices(n);
    expect(c).toEqual(['asc:cleaver']);
    expect(isAscend(c[0])).toBe(true);
    chooseRelic(n, c[0]);
    expect(n.ascended.cleaver).toBe(true);
    expect(nightFeats(n)).toContain('nsascend');
  });

  it('pays more Souls for every pact', () => {
    const n = newNight(seeded(9));
    n.kills = 12000;
    expect(nightSouls(n)).toBe(500);
    n.pacts = { hunger: true, haste: true };
    expect(nightSouls(n)).toBe(800);
  });
});

describe('the longer night: dawn, new dead, bosses, shrine and perks', () => {
  it('stops at dawn for a choice: greet it and the night ends in triumph, paying half again', () => {
    const n = newNight(seeded(40));
    n.t = DAWN - 0.01;
    n.kills = 1200;
    step(n, 1 / 60, 0, 0);
    expect(n.dawnOffer).toBe(true);
    const t = n.t;
    step(n, 1 / 60, 0, 0);
    expect(n.t).toBe(t);
    chooseDawn(n, false);
    expect(n.over).toBe(true);
    expect(n.dawn).toBe(true);
    expect(nightSouls(n)).toBe(300);
    expect(nightFeats(n)).toContain('nsdawn');
  });

  it('walks on into the Nightmare, where the dead are tougher', () => {
    const n = newNight(seeded(41));
    n.t = DAWN - 0.01;
    step(n, 1 / 60, 0, 0);
    chooseDawn(n, true);
    expect(n.over).toBe(false);
    expect(n.nightmare).toBe(true);
    for (let k = 0; k < 120; k++) step(n, 1 / 60, 1, 0);
    expect(n.t).toBeGreaterThan(DAWN);
  });

  it('brings the new dead late in the night, and the Night Mother at 25 minutes', () => {
    const n = newNight(seeded(42));
    n.t = MOTHER_AT - 0.01;
    n.bossesRisen = 12;
    step(n, 1 / 60, 0, 0);
    expect(n.foes.some((f) => f.kind === 'mother')).toBe(true);
    const m = newNight(seeded(43));
    m.t = 1250;
    m.maxHp = m.hp = 9999;
    for (let k = 0; k < 60 * 30; k++) step(m, 1 / 60, Math.cos(k / 40), Math.sin(k / 40));
    const kinds = new Set(m.foes.map((f) => f.kind));
    expect(kinds.has('archer') || kinds.has('drowned') || kinds.has('monk') || kinds.has('boneknight')).toBe(true);
  });

  it('gives the Shrine and the hero their gifts', () => {
    const n = newNight(seeded(44), true, { hero: 'mage', shrine: { vigor: 2, reroll: 1, banish: 1, start: 'scythe' } });
    expect(n.maxHp).toBe(28);
    expect(n.relics.storm).toBe(1);
    expect(n.relics.scythe).toBe(1);
    expect(n.rerolls).toBe(1);
    const off = newNight(seeded(44), false, { hero: 'mage', shrine: { vigor: 2 } });
    expect(off.maxHp).toBe(20);
    expect(off.relics.storm).toBeUndefined();
  });

  it('rerolls, banishes and skips a level', () => {
    const n = newNight(seeded(45), true, { shrine: { reroll: 1, banish: 1 } });
    n.pendingLevels = 2;
    expect(reroll(n)).not.toBeNull();
    expect(n.rerolls).toBe(0);
    expect(reroll(n)).toBeNull();
    const c = levelChoices(n).find((id) => !(id in n.relics) && id !== 'spade');
    expect(banish(n, c!)).not.toBeNull();
    expect(n.banished).toContain(c);
    for (let k = 0; k < 30; k++) expect(levelChoices(n)).not.toContain(c);
    n.hp = 5;
    skipLevel(n);
    expect(n.pendingLevels).toBe(1);
    expect(n.hp).toBe(8);
  });
});

describe('helpers: companions and the relics that fight beside you', () => {
  /** A night with nothing of yours fighting, one tough dummy a few tiles off, and no more dead coming. */
  function dummyNight(companion: string, seed = 7) {
    const n = newNight(seeded(seed), true, { companion });
    n.relics = {};
    while (!n.foes.length) step(n, 1 / 60, 0, 0);
    n.spawnDebt = -1e9;
    const f = n.foes[0];
    n.foes = [f];
    Object.assign(f, { hp: 1e6, maxHp: 1e6, speed: 0, dmg: 0, x: n.x + 3.5, y: n.y });
    return { n, f };
  }

  it('every companion hero fights the dead in their own way', () => {
    for (const id of COMPANION_IDS) {
      const { n, f } = dummyNight(id);
      expect(n.ally, id).not.toBeNull();
      for (let k = 0; k < 60 * 8; k++) step(n, 1 / 60, 0, 0);
      expect(f.hp, `${id} should hurt the dead`).toBeLessThan(1e6);
    }
  });

  it('walks alone without a companion, and the companion never takes the hero\'s own place in choices', () => {
    const alone = newNight(seeded(3));
    expect(alone.ally).toBeNull();
    for (let k = 0; k < 40; k++) {
      alone.pendingLevels = 1;
      expect(levelChoices(alone)).not.toContain(ALLY_PICK);
      chooseRelic(alone, levelChoices(alone)[0]);
    }
  });

  it('level-ups offer to sharpen the companion, up to the top level', () => {
    const n = newNight(seeded(11), true, { companion: 'ranger' });
    let offered = 0;
    for (let k = 0; k < 200 && n.ally!.level < MAX_LEVEL; k++) {
      n.pendingLevels = 1;
      const c = levelChoices(n);
      if (c.includes(ALLY_PICK)) {
        offered++;
        chooseRelic(n, ALLY_PICK);
      } else chooseRelic(n, c[0]);
    }
    expect(offered).toBeGreaterThan(0);
    expect(n.ally!.level).toBe(MAX_LEVEL);
    n.pendingLevels = 1;
    expect(levelChoices(n)).not.toContain(ALLY_PICK);
  });

  it('the Paladin heals you now and then', () => {
    const { n } = dummyNight('paladin');
    n.hp = 5;
    for (let k = 0; k < 60 * 12; k++) step(n, 1 / 60, 0, 0);
    expect(n.hp).toBeGreaterThan(5);
  });

  it('the Thrall Totem raises thralls that hunt, then crumble', () => {
    const { n, f } = dummyNight('');
    n.relics = { totem: 3 };
    for (let k = 0; k < 60 * 2; k++) step(n, 1 / 60, 0, 0);
    expect(n.minions.some((m) => m.kind === 'thrall')).toBe(true);
    for (let k = 0; k < 60 * 6; k++) step(n, 1 / 60, 0, 0);
    expect(f.hp).toBeLessThan(1e6);
    n.relics = {};
    for (let k = 0; k < 60 * 15; k++) step(n, 1 / 60, 0, 0);
    expect(n.minions.filter((m) => m.kind === 'thrall')).toHaveLength(0);
  });

  it('hounds and spectral knights come with their relics, more at higher levels and fused', () => {
    const { n, f } = dummyNight('');
    n.relics = { hound: 1, spectre: 1 };
    for (let k = 0; k < 60 * 6; k++) step(n, 1 / 60, 0, 0);
    expect(n.minions.filter((m) => m.kind === 'hound')).toHaveLength(1);
    expect(n.minions.filter((m) => m.kind === 'spectre')).toHaveLength(1);
    expect(f.hp).toBeLessThan(1e6);
    n.relics = { hound: 5, spectre: 5, boots: 1, thorns: 1 };
    n.fused = { wildhunt: true, revenant: true };
    step(n, 1 / 60, 0, 0);
    expect(n.minions.filter((m) => m.kind === 'hound')).toHaveLength(3);
    expect(n.minions.filter((m) => m.kind === 'spectre')).toHaveLength(6);
  });

  it('a Knight companion draws the ordinary dead to themself', () => {
    const { n, f } = dummyNight('knight');
    Object.assign(f, { speed: 1.5, x: n.ally!.x + 1.5, y: n.ally!.y + 1.5 });
    const before = Math.hypot(f.x - n.ally!.x, f.y - n.ally!.y);
    for (let k = 0; k < 20; k++) step(n, 1 / 60, 0, 0);
    expect(Math.hypot(f.x - n.ally!.x, f.y - n.ally!.y)).toBeLessThan(before);
  });
});

describe('heroes, Night Ranks and companion gear', () => {
  it('each hero starts with their own weapon, and only they are offered it', () => {
    const sig: Record<string, string> = { knight: 'bulwark', rogue: 'knives', necro: 'legion', paladin: 'nova', ranger: 'arrowrain', mage: 'orb', barbarian: 'slam', bellringer: 'toll' };
    for (const [hero, w] of Object.entries(sig)) {
      const n = newNight(seeded(5), true, { hero });
      expect(n.relics[w as keyof typeof n.relics], hero).toBe(1);
      for (let k = 0; k < 60; k++) {
        n.pendingLevels = 1;
        const c = levelChoices(n);
        for (const o of Object.values(sig)) if (o !== w) expect(c).not.toContain(o);
        chooseRelic(n, c[0]);
      }
    }
  });

  it('every signature weapon hurts the dead', () => {
    for (const hero of ['knight', 'rogue', 'necro', 'paladin', 'ranger', 'mage', 'barbarian', 'bellringer']) {
      const n = newNight(seeded(9), true, { hero });
      const keep = Object.keys(n.relics).filter((r) => r !== 'spade' && !['quiver', 'storm', 'bell'].includes(r));
      n.relics = Object.fromEntries(keep.map((r) => [r, 3]));
      while (!n.foes.length) step(n, 1 / 60, 0, 0);
      n.spawnDebt = -1e9;
      const f = n.foes[0];
      n.foes = [f];
      Object.assign(f, { hp: 1e6, maxHp: 1e6, speed: 0, dmg: 0, x: n.x + 1.5, y: n.y + 0.4 });
      n.fx = 1;
      n.fy = 0;
      // the Necromancer's legion needs kills: give it some weak dead
      for (let k = 0; k < 60 * 8; k++) step(n, 1 / 60, 0, 0);
      if (hero !== 'necro') expect(f.hp, hero).toBeLessThan(1e6);
    }
  });

  it('counts Night Ranks from lifetime kills', () => {
    expect(nightRank(0)).toBe(1);
    expect(nightRank(199)).toBe(1);
    expect(nightRank(200)).toBe(2);
    expect(nightRank(1e9)).toBe(MAX_NIGHT_RANK);
    expect(companionOpen('knight', 1)).toBe(true);
    expect(companionOpen('necro', 1)).toBe(false);
    expect(companionOpen('necro', 2)).toBe(true);
    expect(companionOpen('bellringer', 14)).toBe(false);
  });

  it('keeps helper relics out until their rank', () => {
    const n = newNight(seeded(4), true, { hero: 'knight', rank: 1 });
    for (let k = 0; k < 80; k++) {
      n.pendingLevels = 1;
      const c = levelChoices(n);
      expect(c).not.toContain('hound');
      expect(c).not.toContain('totem');
      expect(c).not.toContain('spectre');
      chooseRelic(n, c[0]);
    }
  });

  it('companion gear: a bond starts them higher, an oathstone lets them grow further', () => {
    const n = newNight(seeded(4), true, { companion: 'ranger', gear: { bond: 2, oath: 2 }, rank: 20 });
    expect(n.ally!.level).toBe(4);
    expect(n.allyMax).toBe(MAX_LEVEL + 5);
  });

  it('estimates lifetime kills for nights saved before the total was kept', () => {
    const g = cleanGraveState({ ...newGraveState(0), nights: 10, nightKills: 1000, nightTotal: undefined }, 0);
    expect(g.nightTotal).toBe(5000);
    expect(cleanGraveState({ ...newGraveState(0), nightTotal: 42 }, 0).nightTotal).toBe(42);
  });
});
