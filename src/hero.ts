// The player's sprite, assembled from layers so the hero visibly changes as relics
// are collected: weapons swap, armour and trinkets appear, the cloak changes colour.

import type { HeroId } from './content';
import { withFusions, type RelicId } from './relics';
import { SPRITE_SIZE, type Sprite } from './sprites';
import { HEAD_BY_ID, LOOK_BY_ID } from './progression';

const COL = {
  outline: '#0d0812',
  steel: '#c9d1e0',
  steelDark: '#5d667a',
  gold: '#f2c14e',
  red: '#d23a46',
  redDark: '#701826',
  wood: '#7a5532',
  ice: '#9fe8ff',
  ember: '#ff8a2a',
  spark: '#fff3a0',
  thorn: '#7f9a52',
  rot: '#43572f',
  bone: '#e8dcc4',
};

// Cloak and eye colours are swapped by relics; everything else is fixed.
const BODY = [
  '....kkkk....',
  '...kPPPPk...',
  '..kPPPPPPk..',
  '..kPkkkkPk..',
  '..kPkEkEPk..',
  '...kPPPPk...',
  '..kpPppPpk..',
  '.kppPpppPpk.',
  '.kpkpppppk..',
  '..kkpPpPpk..',
  '...kSk.kSk..',
  '...kk...kk..',
];

const CLOAKS = {
  default: { p: '#3b4f7d', P: '#22304f' },
  rogue: { p: '#2f5238', P: '#1b3021' },
  necro: { p: '#45285a', P: '#26142f' },
  paladin: { p: '#c9c3b2', P: '#857d6c' }, // white tabard
  ranger: { p: '#55693a', P: '#33421f' }, // forest green
  mage: { p: '#2f4aa8', P: '#1a2a66' }, // deep blue robes
  barbarian: { p: '#7a3f24', P: '#4a2414' }, // fur and leather
  bellringer: { p: '#4f6b5a', P: '#2c3d33' }, // verdigris robes
  pact: { p: '#8a2232', P: '#4f0f1b' }, // Blood Pact: crimson
  dust: { p: '#6d6880', P: '#433f52' }, // Grave Dust: ashen
  crown: { p: '#4b3a78', P: '#2c2148' }, // Cursed Crown: royal purple
};

type Relics = Partial<Record<RelicId, number>>;

/** The elemental relic taken most recently decides the blade's colour. */
function bladeColor(relics: Relics, log: RelicId[]): string {
  for (let i = log.length - 1; i >= 0; i--) {
    const id = log[i];
    if (id === 'ember' || id === 'wildfire') return COL.ember;
    if (id === 'frost' || id === 'shatter') return COL.ice;
    if (id === 'storm' || id === 'conductor') return COL.spark;
  }
  return relics.whetstone ? '#e8eef8' : COL.steel;
}

function paint(ctx: CanvasRenderingContext2D, hero: HeroId, relics: Relics, log: RelicId[], solid?: string, look = '', head = '') {
  const all = withFusions(relics);
  const n = (id: RelicId) => all[id] ?? 0;
  const dot = (x: number, y: number, color: string) => {
    ctx.fillStyle = solid ?? color;
    ctx.fillRect(x, y, 1, 1);
  };

  const heroCloak = hero in CLOAKS ? CLOAKS[hero as keyof typeof CLOAKS] : CLOAKS.default;
  // An equipped cosmetic look wins; otherwise some relics recolour the cloak.
  const cloak = LOOK_BY_ID[look]?.cloak ?? (n('pact') ? CLOAKS.pact : n('crown') ? CLOAKS.crown : n('dust') ? CLOAKS.dust : heroCloak);
  const eyes = n('fang') ? COL.red : n('frost') >= 2 ? COL.ice : hero === 'necro' || hero === 'mage' ? COL.ice : hero === 'barbarian' ? COL.red : COL.gold;
  const palette: Record<string, string> = { k: COL.outline, P: cloak.P, p: cloak.p, S: COL.steelDark, E: eyes };
  BODY.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') dot(x, y, palette[row[x]]);
  });

  // --- class details ---
  if (hero === 'rogue') for (let x = 4; x <= 7; x++) dot(x, 5, COL.redDark); // scarf
  if (hero === 'paladin') {
    // gold cross on the tabard
    for (let y = 6; y <= 9; y++) dot(6, y, COL.gold);
    [5, 7].forEach((x) => dot(x, 7, COL.gold));
  }
  if (hero === 'mage') [[4, 7], [7, 9], [3, 9]].forEach(([x, y]) => dot(x, y, COL.gold)); // stars on the robe
  if (hero === 'barbarian') {
    // horned helm and a bare, scarred chest
    [[2, 0], [2, 1], [9, 0], [9, 1]].forEach(([x, y]) => dot(x, y, COL.bone));
    for (let x = 5; x <= 6; x++) dot(x, 7, '#c98b62');
    dot(5, 8, '#c98b62');
  }
  if (hero === 'bellringer') for (let x = 3; x <= 8; x++) dot(x, 8, x % 2 ? '#c9a24a' : '#8a6a2a'); // bell-rope belt
  if (hero === 'ranger') [[1, 3], [1, 4], [1, 5], [1, 6]].forEach(([x, y], i) => dot(x, y, i ? COL.wood : COL.red)); // quiver

  // --- body ---
  if (n('bloom')) [[3, 7], [7, 9], [6, 6]].slice(0, 1 + n('bloom')).forEach(([x, y]) => dot(x, y, COL.rot));
  if (n('heart')) {
    for (let x = 4; x <= 7; x++) dot(x, 6, COL.steel);
    for (let x = 4; x <= 7; x++) dot(x, 7, n('heart') >= 3 ? COL.steel : COL.steelDark);
    if (n('heart') >= 2) [3, 8].forEach((x) => dot(x, 6, COL.steelDark));
  }
  if (n('phylactery')) dot(6, 6, COL.ice);
  if (n('conductor')) [[2, 7], [3, 8], [4, 9], [8, 7]].forEach(([x, y]) => dot(x, y, COL.steelDark));
  if (n('thorns')) {
    [[2, 5], [1, 6], [9, 5], [10, 6]].forEach(([x, y]) => dot(x, y, COL.thorn));
    if (n('thorns') >= 3) [[3, 1], [8, 1]].forEach(([x, y]) => dot(x, y, COL.thorn));
  }
  if (n('shatter')) [[1, 5], [10, 5]].forEach(([x, y]) => dot(x, y, COL.ice));
  // belt trinkets
  if (n('coin')) dot(4, 8, COL.gold);
  if (n('dice')) dot(5, 8, COL.bone);
  if (n('flask')) dot(7, 8, COL.red);
  if (n('lantern')) {
    dot(10, 8, COL.outline);
    dot(10, 9, COL.gold);
    dot(10, 10, COL.outline);
  }

  // --- head ---
  if (n('mark')) for (let x = 4; x <= 7; x++) dot(x, 2, COL.red);
  if (n('hellfire')) {
    dot(1, 0, COL.red);
    dot(2, 1, COL.redDark);
    dot(10, 0, COL.red);
    dot(9, 1, COL.redDark);
  }
  if (n('crown')) {
    for (let x = 3; x <= 8; x++) dot(x, 1, COL.gold);
    [3, 5, 6, 8].forEach((x) => dot(x, 0, COL.gold));
    dot(5, 1, COL.red);
    if (n('crown') >= 2) dot(6, 1, COL.red);
  }
  if (n('candle')) {
    // a stub of candle on the shoulder
    dot(2, 4, COL.bone);
    dot(2, 3, COL.gold);
  }
  // Costume headwear sits over everything else on the head.
  for (const [x, y, c] of HEAD_BY_ID[head]?.pixels ?? []) dot(x, y, c);

  // --- off hand ---
  const blade = bladeColor(relics, log);
  if (n('whirl')) {
    for (let y = 2; y <= 5; y++) dot(0, y, blade);
    dot(0, 6, COL.gold);
  }
  if (n('mirror')) {
    const rim = n('mirror') >= 2 ? COL.gold : COL.steelDark;
    [[0, 6], [1, 6], [2, 6], [0, 7], [2, 7], [0, 8], [2, 8]].forEach(([x, y]) => dot(x, y, rim));
    dot(1, 7, COL.ice);
    dot(1, 8, COL.steel);
    dot(1, 9, rim);
  }

  // --- weapon hand: scythe > pike > the class weapon ---
  dot(10, 7, COL.outline); // gauntlet
  if (n('harvest')) {
    for (let y = 1; y <= 10; y++) dot(11, y, COL.wood);
    [[8, 0], [9, 0], [10, 0], [11, 0], [7, 1]].forEach(([x, y]) => dot(x, y, blade));
    dot(8, 1, COL.steelDark);
  } else if (n('pike')) {
    for (let y = 2; y <= 10; y++) dot(11, y, COL.wood);
    dot(11, 0, blade);
    dot(11, 1, blade);
    dot(10, 1, COL.steelDark);
    if (n('pike') >= 2) dot(10, 2, COL.steelDark);
  } else if (hero === 'rogue') {
    // Twin daggers; whetstones lengthen them.
    const top = 5 - Math.min(2, n('whetstone'));
    for (let y = top; y <= 6; y++) dot(11, y, blade);
    dot(11, 7, COL.gold);
    if (!n('mirror') && !n('whirl')) {
      for (let y = top; y <= 6; y++) dot(0, y, blade);
      dot(0, 7, COL.gold);
    }
  } else if (hero === 'ranger') {
    // Longbow: a curved limb with a taut string.
    [[10, 2], [11, 3], [11, 4], [11, 5], [11, 6], [11, 7], [11, 8], [10, 9]].forEach(([x, y]) => dot(x, y, COL.wood));
    for (let y = 3; y <= 8; y++) dot(10, y, y === 5 || y === 6 ? blade : COL.bone);
  } else if (hero === 'mage') {
    // Staff crowned with an arcane orb.
    for (let y = 3; y <= 10; y++) dot(11, y, COL.wood);
    const orb = blade === COL.steel || blade === '#e8eef8' ? '#b07cff' : blade;
    [[11, 1], [10, 2], [11, 2]].forEach(([x, y]) => dot(x, y, orb));
    dot(10, 1, '#ffffff');
  } else if (hero === 'barbarian') {
    // Great axe: long haft, broad head.
    for (let y = 2; y <= 10; y++) dot(11, y, COL.wood);
    [[9, 1], [10, 1], [9, 2], [10, 2], [9, 3], [10, 3], [8, 2]].forEach(([x, y]) => dot(x, y, blade));
    dot(11, 1, COL.steelDark);
  } else if (hero === 'paladin') {
    // Warhammer with a gilded head.
    for (let y = 4; y <= 10; y++) dot(11, y, COL.wood);
    [[10, 2], [11, 2], [10, 3], [11, 3]].forEach(([x, y]) => dot(x, y, blade === COL.steel ? COL.gold : blade));
    dot(11, 1, COL.gold);
  } else if (hero === 'bellringer') {
    // A handbell on a staff, its clapper catching the light.
    for (let y = 4; y <= 10; y++) dot(11, y, COL.wood);
    const bronze = blade === COL.steel || blade === '#e8eef8' ? '#c9a24a' : blade;
    [[11, 0], [10, 1], [11, 1], [9, 2], [10, 2], [11, 2]].forEach(([x, y]) => dot(x, y, bronze));
    dot(10, 3, COL.gold);
  } else if (hero === 'necro') {
    // Bone staff topped with a skull.
    for (let y = 2; y <= 10; y++) dot(11, y, COL.wood);
    dot(11, 1, COL.bone);
    dot(10, 1, COL.bone);
    dot(11, 0, blade === COL.steel ? COL.ice : blade);
  } else {
    // Whetstones lengthen the blade.
    const top = 3 - Math.min(2, n('whetstone'));
    for (let y = top; y <= 6; y++) dot(11, y, blade);
    dot(11, top, '#ffffff');
    dot(11, 7, COL.gold);
    if (n('whetstone') >= 3) dot(10, 6, COL.gold); // crossguard
  }
}

function bake(hero: HeroId, relics: Relics, log: RelicId[], solid?: string, look = '', head = ''): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  paint(c.getContext('2d')!, hero, relics, log, solid, look, head);
  return c;
}

// Recent sprites, rebuilt only when a hero's relics or look change. Several boards
// (the game, the background ghosts, the Hall) draw heroes at once.
const cache = new Map<string, Sprite>();

/** Sprite for a hero's build and look. */
export function heroSprite(hero: HeroId, relics: Relics, log: RelicId[], look = '', head = ''): Sprite {
  const key = `${hero}:${look}:${head}:${log.join(',')}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = { normal: bake(hero, relics, log, undefined, look, head), white: bake(hero, relics, log, '#ffffff', look, head) };
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
    cache.set(key, sprite);
  }
  return sprite;
}

/** A large, crisp portrait of the hero as a data URL, for the results screen. */
export function heroPortrait(hero: HeroId, relics: Relics, log: RelicId[], scale = 8, look = '', head = ''): string {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE * scale;
  c.height = SPRITE_SIZE * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bake(hero, relics, log, undefined, look, head), 0, 0, c.width, c.height);
  return c.toDataURL();
}

/** Colour of the particles a relic gives off when it's claimed. */
export function relicColor(id: RelicId): string {
  const map: Partial<Record<RelicId, string>> = {
    ember: COL.ember, wildfire: COL.ember, hellfire: COL.red, frost: COL.ice, shatter: COL.ice,
    storm: COL.spark, conductor: COL.spark, pact: COL.red, fang: COL.red, crown: COL.gold,
    coin: COL.gold, thorns: COL.thorn, bloom: COL.thorn, phylactery: COL.ice, mirror: COL.ice,
  };
  return map[id] ?? COL.gold;
}
