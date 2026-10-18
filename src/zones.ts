// Depth zones: every ten floors the crypt becomes somewhere new, with its own look,
// music key, hazard and resident foe. Past floor 50 the four deep zones come round
// again, harder, with a numeral on the name.

export type ZoneId = 'crypt' | 'flooded' | 'ossuary' | 'burning' | 'abyss';

export interface ZoneDef {
  id: ZoneId;
  name: string;
  /** Banner colour, and the tint of its light. */
  color: string;
  /** What the zone does, for the floor tip. */
  hint: string;
  /** Semitones the music moves when you enter it. */
  key: number;
  floor: string[];
  bossFloor: string[];
  wall: { base: string; top: string; face: string; front: string; edge: string; brick: string; moss: string };
  /** The torchlight around the hero (inner glow, then the dark at the edge). */
  light: [string, string];
  /** Drifting motes. */
  mote: string;
}

export const ZONES: Record<ZoneId, ZoneDef> = {
  crypt: {
    id: 'crypt',
    name: 'The Crypt',
    color: '#e8dcc4',
    hint: '',
    key: 0,
    floor: ['#1d1824', '#211b29', '#1a1520'],
    bossFloor: ['#2a1418', '#2f171c', '#261216'],
    wall: { base: '#3a3346', top: '#5a5070', face: '#4b4259', front: '#2a2433', edge: '#1d1824', brick: '#28222f', moss: '#3f5a3a' },
    light: ['rgba(255, 170, 80, 0.06)', 'rgba(6, 2, 10, 0.62)'],
    mote: '#c9b99a',
  },
  flooded: {
    id: 'flooded',
    name: 'The Flooded Catacombs',
    color: '#5fe3ff',
    hint: 'Foes wading through <b>water</b> lose every other turn.',
    key: -2,
    floor: ['#15212a', '#18262f', '#121c24'],
    bossFloor: ['#1c1a2a', '#211d31', '#181624'],
    wall: { base: '#2c3d48', top: '#4d6b78', face: '#3a515e', front: '#1f2c35', edge: '#121c24', brick: '#22313b', moss: '#2f6b5a' },
    light: ['rgba(120, 220, 255, 0.07)', 'rgba(2, 8, 14, 0.66)'],
    mote: '#8fd8ff',
  },
  ossuary: {
    id: 'ossuary',
    name: 'The Charnel Halls',
    color: '#f2e6c4',
    hint: '<b>Bone piles</b> block the way. Bump one to smash it; some hide a potion.',
    key: 3,
    floor: ['#24201b', '#29241e', '#201c18'],
    bossFloor: ['#2e1c18', '#33201b', '#2a1915'],
    wall: { base: '#4a4236', top: '#7a6e58', face: '#5e5444', front: '#332d25', edge: '#201c18', brick: '#3a3329', moss: '#6b5e3a' },
    light: ['rgba(255, 220, 150, 0.07)', 'rgba(10, 6, 2, 0.64)'],
    mote: '#e8dcc4',
  },
  burning: {
    id: 'burning',
    name: 'The Burning Depths',
    color: '#ff8a2a',
    hint: '<b>Lava</b> burns anything that walks into it. Lure them in.',
    key: 5,
    floor: ['#24140f', '#2a1711', '#20110c'],
    bossFloor: ['#2e100e', '#341210', '#290d0b'],
    wall: { base: '#3f2620', top: '#6b3a2a', face: '#523026', front: '#2a1813', edge: '#1a0c08', brick: '#301b15', moss: '#7a3a14' },
    light: ['rgba(255, 110, 40, 0.1)', 'rgba(14, 4, 2, 0.6)'],
    mote: '#ffb35a',
  },
  abyss: {
    id: 'abyss',
    name: 'The Abyss',
    color: '#b07cff',
    hint: 'Darkness: you only see what is near you. Candles and lanterns light the way.',
    key: -1,
    floor: ['#120d1c', '#150f21', '#0f0b18'],
    bossFloor: ['#1c0d1e', '#211023', '#180b1a'],
    wall: { base: '#2a2140', top: '#4a3a6e', face: '#382c55', front: '#1c1530', edge: '#0f0b18', brick: '#221a35', moss: '#4a2a6e' },
    light: ['rgba(176, 124, 255, 0.07)', 'rgba(3, 1, 8, 0.72)'],
    mote: '#b07cff',
  },
};

const DEEP: ZoneId[] = ['flooded', 'ossuary', 'burning', 'abyss'];

export interface ZoneAt {
  def: ZoneDef;
  /** 1 the first time through; 2, 3... each time the deep zones come round again. */
  tier: number;
  /** The first floor of this stretch. */
  start: number;
  /** Name with a numeral past the first pass, e.g. "The Charnel Halls II". */
  title: string;
}

const NUMERALS = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

export function zoneAt(floor: number): ZoneAt {
  if (floor <= 10) return { def: ZONES.crypt, tier: 1, start: 1, title: ZONES.crypt.name };
  const k = Math.floor((floor - 11) / 10);
  const def = ZONES[DEEP[k % DEEP.length]];
  const tier = Math.floor(k / DEEP.length) + 1;
  return { def, tier, start: 11 + k * 10, title: def.name + (NUMERALS[tier] ?? ` ${tier}`) };
}
