import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { ISLE_DOCK, ISLE_H, ISLE_ITEMS, ISLE_MAP, ISLE_W, LAND, ROOM_ENTRY, cleanIsle, emptyIsle, fits, isleSolid, islePerks, itemAt, owned, roomSolid } from './isle';
import { buyLand, finishRunMeta, meta, pickUpIsleItem, placeIsleItem, runConfig } from './meta';

/** Tiles reachable on foot from the jetty. */
function reach(isle = emptyIsle()) {
  const seen = new Set([ISLE_DOCK.y * ISLE_W + ISLE_DOCK.x]);
  const queue = [ISLE_DOCK];
  while (queue.length) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * ISLE_W + nx;
      if (nx < 0 || ny < 0 || nx >= ISLE_W || ny >= ISLE_H || seen.has(k) || isleSolid(isle, nx, ny)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

describe('your isle', () => {
  it('has a whole map, and every bit of cleared land can be walked to from the jetty', () => {
    expect(ISLE_MAP.every((r) => r.length === ISLE_W)).toBe(true);
    expect(ISLE_MAP[ISLE_DOCK.y][0]).toBe('<');
    for (let land = 0; land <= LAND.length; land++) {
      const isle = { ...emptyIsle(), land };
      const seen = reach(isle);
      for (let y = 0; y < ISLE_H; y++) {
        for (let x = 0; x < ISLE_W; x++) {
          const g = ISLE_MAP[y][x];
          if (g >= '0' && g <= '2' && Number(g) <= land) expect(seen.has(y * ISLE_W + x), `${x},${y} land ${land}`).toBe(true);
        }
      }
    }
    expect(new Set(ISLE_ITEMS.map((i) => i.id)).size).toBe(ISLE_ITEMS.length);
  });

  it('only builds on cleared land, and never on top of something else', () => {
    const isle = emptyIsle();
    expect(fits(isle, 'pine', 10, 6)).toBe(true);
    expect(fits(isle, 'pine', 3, 4)).toBe(false); // the thicket
    expect(fits(isle, 'pine', 2, 6)).toBe(false); // the jetty path
    expect(fits(isle, 'pine', 0, 0)).toBe(false); // water
    isle.placed.push(['cottage', 8, 5]);
    expect(itemAt(isle, 10, 6)).toBe(0);
    expect(fits(isle, 'pine', 10, 6)).toBe(false);
    expect(isleSolid(isle, 9, 6)).toBe(true);
    isle.placed.push(['path', 12, 6]);
    expect(isleSolid(isle, 12, 6)).toBe(false);
  });

  it('charges Souls, keeps things picked up for free, and holds one of each perk', () => {
    meta.isle = emptyIsle();
    meta.souls = 100;
    expect(placeIsleItem('pine', 10, 6)).toBe('ok');
    expect(meta.souls).toBe(60);
    expect(placeIsleItem('pine', 10, 6)).toBe('blocked');
    expect(pickUpIsleItem(10, 6)).toBe('pine');
    expect(meta.isle.stored.pine).toBe(1);
    expect(placeIsleItem('pine', 11, 6)).toBe('ok');
    expect(meta.souls).toBe(60);
    expect(meta.isle.stored.pine).toBeUndefined();
    expect(placeIsleItem('fountain', 7, 5)).toBe('souls');
    meta.souls = 10_000;
    expect(placeIsleItem('soulwell', 7, 5)).toBe('ok');
    expect(placeIsleItem('soulwell', 12, 7)).toBe('max');
    expect(buyLand()).toBe(true);
    expect(meta.isle.land).toBe(1);
    expect(placeIsleItem('pine', 6, 4)).toBe('ok');
  });

  it("reads saved isles safely, dropping what doesn't belong", () => {
    const isle = cleanIsle({ land: 9, placed: [['pine', 10, 6], ['nope', 9, 6], ['pine', 10, 6], ['rock', 0, 0], 'junk'], stored: { pine: 2, bad: 4 } });
    expect(isle.land).toBe(LAND.length);
    expect(isle.placed).toEqual([['pine', 10, 6]]);
    expect(isle.stored).toEqual({ pine: 2 });
    expect(cleanIsle(null)).toEqual(emptyIsle());
  });

  it('furnishes the inside of houses: floor things on the floor, wall things on the back wall', () => {
    meta.isle = emptyIsle();
    meta.souls = 10_000;
    expect(placeIsleItem('cottage', 8, 5)).toBe('ok');
    const room = 'cottage@8,5';
    expect(placeIsleItem('bed', 2, 2, 'nowhere@1,1')).toBe('blocked');
    expect(placeIsleItem('bed', 2, 2, room)).toBe('ok');
    expect(placeIsleItem('pine', 3, 2, room)).toBe('blocked'); // outdoor things stay outdoors
    expect(placeIsleItem('bed', 9, 9)).toBe('blocked'); // and furniture stays in
    expect(placeIsleItem('painting', 3, 2, room)).toBe('blocked'); // pictures go on the wall
    expect(placeIsleItem('painting', 3, 0, room)).toBe('ok');
    expect(placeIsleItem('chair', ROOM_ENTRY.x, ROOM_ENTRY.y, room)).toBe('blocked'); // the doorway stays clear
    expect(placeIsleItem('rug', 4, 3, room)).toBe('ok');
    expect(roomSolid(meta.isle, room, 2, 2)).toBe(true);
    expect(roomSolid(meta.isle, room, 4, 3)).toBe(false);
    expect(owned(meta.isle, 'bed')).toBe(1);
    expect(cleanIsle(JSON.parse(JSON.stringify(meta.isle))).rooms[room]).toHaveLength(3);

    // Picking the house up takes everything inside with it, into storage.
    expect(pickUpIsleItem(9, 6)).toBe('cottage');
    expect(meta.isle.rooms[room]).toBeUndefined();
    expect(meta.isle.stored).toEqual({ cottage: 1, bed: 1, painting: 1, rug: 1 });
    // Set down somewhere new, it starts empty, and the furniture goes back in for free.
    expect(placeIsleItem('cottage', 10, 6)).toBe('ok');
    const souls = meta.souls;
    expect(placeIsleItem('bed', 1, 1, 'cottage@10,6')).toBe('ok');
    expect(meta.souls).toBe(souls);
    meta.isle = emptyIsle();
  });

  it('gives its perks to Endless and the story, never the Daily', () => {
    meta.isle = emptyIsle();
    meta.isle.land = 2;
    expect(islePerks(meta.isle)).toEqual({ vigor: 0, souls: 0 });
    expect(runConfig('endless', 0).vigor).toBeUndefined();
    meta.isle.placed.push(['hut', 8, 5], ['shrine', 12, 5], ['soulwell', 8, 8]);
    expect(islePerks(meta.isle)).toEqual({ vigor: 2, souls: 0.1 });
    expect(runConfig('endless', 0).vigor).toBe(2);
    expect(runConfig('daily', 9).vigor).toBeUndefined();

    const g = new Game('endless', 7, 0, runConfig('endless', 0));
    expect(g.player.maxHp).toBe(12);
    expect(g.header()).toMatch(/^#[78]\|knight\|[a-z,]*\|2\|$/);
    for (const d of ['R', 'D', 'L', 'U', 'W']) g.act(d === 'R' ? 1 : d === 'L' ? -1 : 0, d === 'D' ? 1 : d === 'U' ? -1 : 0);
    const again = Game.replay('endless', 7, 0, g.header() + g.log);
    expect(again.player.maxHp).toBe(12);
    expect(again.player.hp).toBe(g.player.hp);
    expect(again.turn).toBe(g.turn);

    const souls = finishRunMeta(g, 0);
    expect(souls.lines.some(([k]) => k === 'Soul Well')).toBe(true);
    meta.isle = emptyIsle();
  });
});
