// Depth zones: every twenty floors the crypt becomes somewhere new, with its own look,
// music key, hazard and resident foe. Past floor 100 the four deep zones come round
// again, harder, with a numeral on the name.

export type ZoneId =
  | 'crypt' | 'flooded' | 'ossuary' | 'burning' | 'abyss'
  // Story dungeons that are somewhere in particular.
  | 'kennel' | 'well' | 'mine' | 'cellar' | 'cloister';

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
  /** How the ground and walls are built (dressed stone unless said). */
  floorStyle?: 'stone' | 'dirt' | 'boards';
  wallStyle?: 'brick' | 'plank' | 'rock';
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
  kennel: {
    id: 'kennel',
    name: 'The Kennel Cellar',
    color: '#e0a85a',
    hint: '',
    key: 2,
    floor: ['#2a2016', '#2e2318', '#261c13'],
    bossFloor: ['#2e1a14', '#331d16', '#2a1712'],
    wall: { base: '#4a3420', top: '#7a5a36', face: '#5e4228', front: '#332314', edge: '#1e140b', brick: '#2e1f12', moss: '#8a7a3a' },
    light: ['rgba(255, 190, 110, 0.09)', 'rgba(10, 6, 2, 0.6)'],
    mote: '#d8b878',
    floorStyle: 'dirt',
    wallStyle: 'plank',
  },
  well: {
    id: 'well',
    name: 'The Village Well',
    color: '#8fe0c0',
    hint: 'Foes wading through <b>water</b> lose every other turn.',
    key: -3,
    floor: ['#1a2422', '#1d2826', '#16201e'],
    bossFloor: ['#1a2422', '#1d2826', '#16201e'],
    wall: { base: '#34443e', top: '#566e64', face: '#42564e', front: '#24302c', edge: '#121a18', brick: '#2a3632', moss: '#3f7a4a' },
    light: ['rgba(150, 240, 210, 0.06)', 'rgba(2, 8, 8, 0.68)'],
    mote: '#a8e8d0',
  },
  mine: {
    id: 'mine',
    name: 'The Old Mine',
    color: '#5fe3ff',
    hint: '',
    key: -5,
    floor: ['#221e1c', '#26211e', '#1e1a18'],
    bossFloor: ['#2a1c1a', '#2e1f1c', '#261917'],
    wall: { base: '#3c3530', top: '#5e544a', face: '#4a423b', front: '#2a2420', edge: '#151210', brick: '#2e2824', moss: '#5fe3ff' },
    light: ['rgba(255, 200, 120, 0.08)', 'rgba(6, 4, 2, 0.66)'],
    mote: '#c9b99a',
    floorStyle: 'dirt',
    wallStyle: 'rock',
  },
  cellar: {
    id: 'cellar',
    name: 'The Tavern Cellar',
    color: '#f2c14e',
    hint: '',
    key: 4,
    floor: ['#2e2016', '#33231a', '#2a1d14'],
    bossFloor: ['#331c16', '#381f18', '#2e1913'],
    wall: { base: '#4a2a22', top: '#7a463a', face: '#5e362c', front: '#33201a', edge: '#1e120e', brick: '#2e1a14', moss: '#5a4a2a' },
    light: ['rgba(255, 180, 90, 0.1)', 'rgba(10, 5, 2, 0.58)'],
    mote: '#e8c890',
    floorStyle: 'boards',
  },
  cloister: {
    id: 'cloister',
    name: 'The Sunken Cloister',
    color: '#9be36a',
    hint: '<b>Plague mist</b> hides foes and bites if you linger. Candles and tolls clear it.',
    key: -4,
    floor: ['#18201a', '#1b241c', '#151c16'],
    bossFloor: ['#22201a', '#26231c', '#1e1c16'],
    wall: { base: '#323c34', top: '#526256', face: '#3f4c42', front: '#232b25', edge: '#111712', brick: '#29322b', moss: '#5a8a3a' },
    light: ['rgba(170, 230, 120, 0.07)', 'rgba(2, 8, 3, 0.66)'],
    mote: '#9be36a',
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

/** Floors in each zone. */
export const ZONE_SPAN = 20;

const NUMERALS = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

export function zoneAt(floor: number): ZoneAt {
  if (floor <= ZONE_SPAN) return { def: ZONES.crypt, tier: 1, start: 1, title: ZONES.crypt.name };
  const k = Math.floor((floor - ZONE_SPAN - 1) / ZONE_SPAN);
  const def = ZONES[DEEP[k % DEEP.length]];
  const tier = Math.floor(k / DEEP.length) + 1;
  return { def, tier, start: ZONE_SPAN + 1 + k * ZONE_SPAN, title: def.name + (NUMERALS[tier] ?? ` ${tier}`) };
}

// ---------- deeper looks ----------
// Past floor 100 the deep zones come round again with the same rules, so each pass
// gets its own look: the whole palette leans toward a new colour, the air fills with
// something different and the floor gathers new detail. Drawing only: nothing here
// touches the game's rules, so runs replay exactly as they were played.

export type Weather = 'spores' | 'snow' | 'rain' | 'stars' | 'sparks';

export interface DeepLook {
  name: string;
  /** The colour everything leans toward, and how far (0-1). */
  tint: string;
  mix: number;
  /** Banner colour and drifting motes. */
  color: string;
  mote: string;
  weather: Weather;
  /** Torchlight: inner glow, then the dark at the edge. */
  light: [string, string];
}

/** One per pass after the first: floors 101-180, 181-260, 261-340, 341-420, 421-500, then round again. */
export const DEEP_LOOKS: DeepLook[] = [
  { name: 'Blighted', tint: '#3f6b2a', mix: 0.38, color: '#b5e07a', mote: '#c8f08a', weather: 'spores', light: ['rgba(170, 255, 120, 0.07)', 'rgba(4, 10, 2, 0.64)'] },
  { name: 'Frozen', tint: '#3f6f94', mix: 0.45, color: '#c9f2ff', mote: '#ffffff', weather: 'snow', light: ['rgba(200, 240, 255, 0.09)', 'rgba(2, 8, 16, 0.6)'] },
  { name: 'Bloodmoon', tint: '#5e1019', mix: 0.38, color: '#ff4d5a', mote: '#ff8a8a', weather: 'rain', light: ['rgba(255, 70, 80, 0.09)', 'rgba(16, 2, 4, 0.66)'] },
  { name: 'Starless', tint: '#0a0614', mix: 0.55, color: '#d0b8ff', mote: '#ffffff', weather: 'stars', light: ['rgba(200, 170, 255, 0.06)', 'rgba(1, 0, 4, 0.76)'] },
  { name: 'Gilded', tint: '#6e5212', mix: 0.42, color: '#ffd76a', mote: '#ffe9a8', weather: 'sparks', light: ['rgba(255, 215, 120, 0.1)', 'rgba(12, 8, 0, 0.6)'] },
];

/** The look for this stretch of floors, or null in the crypt, the first pass and story dungeons. */
export function deepLook(z: ZoneAt): DeepLook | null {
  if (z.tier < 2 || !DEEP.includes(z.def.id)) return null;
  return DEEP_LOOKS[(z.tier - 2) % DEEP_LOOKS.length];
}

function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const looked = new Map<string, ZoneDef>();

/** The zone as it is drawn: its own colours, leaned toward the pass's look when there is one. */
export function zoneLook(z: ZoneAt): ZoneDef {
  const look = deepLook(z);
  if (!look) return z.def;
  const key = `${z.def.id}:${look.name}`;
  let def = looked.get(key);
  if (!def) {
    const m = (c: string) => mixHex(c, look.tint, look.mix);
    const w = z.def.wall;
    def = {
      ...z.def,
      color: look.color,
      floor: z.def.floor.map(m),
      bossFloor: z.def.bossFloor.map(m),
      wall: { base: m(w.base), top: m(w.top), face: m(w.face), front: m(w.front), edge: m(w.edge), brick: m(w.brick), moss: mixHex(w.moss, look.tint, 0.7) },
      light: look.light,
      mote: look.mote,
    };
    looked.set(key, def);
  }
  return def;
}

/** The zone's name as the banner shows it, e.g. "The Burning Depths · Bloodmoon". */
export function zoneTitle(z: ZoneAt): string {
  const look = deepLook(z);
  if (!look) return z.title;
  const round = Math.floor((z.tier - 2) / DEEP_LOOKS.length);
  return `${z.def.name} · ${look.name}${round ? NUMERALS[round + 1] ?? ` ${round + 1}` : ''}`;
}
