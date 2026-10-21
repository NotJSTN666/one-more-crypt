// The Hollow: the world above the crypt. It starts in the graveyard, where every building is
// a door into part of the game (the daily crypt, Endless, the Ossuary, the Forge, the Hall),
// old graves hold epitaphs and the ghosts of today's best players wander. With the story
// open, the road leads on to Gravesend: a village, the old kennels and a ruined chapel,
// homes to walk into, people to talk to, and quests that send you down into dungeons.

import { drawAura } from './aura';
import { dailyHero } from './content';
import {
  HOME_CATS, ISLE_CATS, ISLE_DOCK, ISLE_ITEM, ISLE_ITEMS, ISLE_MAP, LAND, ROOM_ENTRY, ROOM_H, ROOM_MAP, ROOM_W, drawIsleGround, drawIsleItem, drawIsleItems, fits,
  homeKey, homeOf, isleIcon, isleSolid, itemAt, roomSolid, type IsleCat, type IsleState,
} from './isle';
import { dailyNumber } from './daily';
import { heroSprite } from './hero';
import { buyLand, meta, outfitFor, pickUpIsleItem, placeIsleItem } from './meta';
import { LOOK_BY_ID } from './progression';
import { enemyFrames } from './sprites';
import { npcFigure, type NpcId } from './story';
import { esc, overlay, screen, showOverlay, staleTap, toast } from './ui';

export type HollowPlace = 'daily' | 'endless' | 'forge' | 'ossuary' | 'hall' | 'grimoire' | 'wardrobe' | 'ranks';

export const EPITAPHS: Record<string, string> = {
  '1': 'Here lies Aldric, first Warden of the crypt. He sealed the dead below, and became one of them.',
  '2': 'Brother Ansel sought a cure inside the plague, and found a congregation instead.',
  '3': 'For the nameless delver who reached the hundredth floor. Nobody believes it. Nobody came back to ask.',
  '4': 'Marta the smith taught the forge to burn blue. Two relics in, one relic out. She never said what fuels it.',
  '5': 'The ice below remembers. When the seal breaks, the Frozen Catacombs will wake.',
};

// ---------- the world ----------
// Outside: # fence  . grass  : path  T tree  + grave  W bonfire  ~ water  @ the well
//   < > ^ _ roads to the next area, 1-5 graves with epitaphs (graveyard), s the sealed gate.
//   Upper-case letters are buildings (solid), lower-case letters their doors.
// Inside: # wall  . floor  x the way out  z stairs down  b bed  t table  c chair  k hearth
//   s shelf  r barrel  n anvil  e pew  l altar, and 1-2 things worth a closer look.

const GRAVEYARD_MAP = [
  '#####################',
  '#.EEE.DDDDD.FFF.MMM.#',
  '#.EEE.DDDDD.FFF.MMM.#',
  '#..n...:d:...f...m..#',
  '<:::::::::::::::::::>',
  '#OOO.+..:..1.HHH.CC.#',
  '#OOO.+..:..+.HHH.CC.#',
  '#.o.:::::::::.h..c..#',
  '#T..:.2.W.:.3..T....#',
  '#GGG.:..:RRR..L..+..#',
  '#GGG.+.::RRR..L..+..#',
  '#.g..:..:.r4..:5..T.#',
  '########s############',
];
const VILLAGE_MAP = [
  '##########^##########',
  '#T..AAAA..:..KKK..T.#',
  '#...AAAA..:..KKK....#',
  '#....a....:...k.....#',
  '<:::::::::::::::::::>',
  '#..NNN....:...QQQ.T.#',
  '#..NNN....:...QQQ...#',
  '#...n....:@:........#',
  '#.T......:.:...TT...#',
  '#..QQ....:.:......T.#',
  '#..QQ...::.::..T....#',
  '#.T...:::...:::...T.#',
  '#####################',
];
const KENNELS_MAP = [
  '#####################',
  '#TT.T..TTT.T..TT.T.T#',
  '#T..ZZZZZ....T..III.#',
  '#...ZZZZZ.......III.#',
  '#T....z..::::...:i:T#',
  '#.....:::::.:::::...#',
  '#T.T..:.....:....T..#',
  '#..HHH:..T..:..T....#',
  '#..HHH:.....:.....T.#',
  '#T..h::.T...:..T....#',
  '#.T........::....T..#',
  '#TT..T.T..T:..TT..TT#',
  '###########_#########',
];
const CHAPEL_MAP = [
  '#####################',
  '#T.+.+.T....UUU..T..#',
  '#..PPPPP....UUU.+...#',
  '#..PPPPP....UUU.....#',
  '<:.PPPPP....UUU..+..#',
  '#:....p.....:u:.....#',
  '#::::::::::::::.T...#',
  '#..+..+...:...~~~...#',
  '#T....+...:..~~~~~..#',
  '#..+......:...~~~.T.#',
  '#.....+..T:.........#',
  '#T..T.....:..T...T..#',
  '#####################',
];
const COTTAGE_MAP = [
  '###########',
  '#s.1..k..s#',
  '#.........#',
  '#..tc.....#',
  '#.......b.#',
  '#r......2.#',
  '#####x#####',
];
const TAVERN_MAP = [
  '###########',
  '#rr.1...rr#',
  '#.........#',
  '#.tc...tc.#',
  '#.........#',
  '#z.tc...r.#',
  '#####x#####',
];
const SMITHY_MAP = [
  '###########',
  '#k..1..s..#',
  '#.........#',
  '#..n......#',
  '#.........#',
  '#r.....r..#',
  '#####x#####',
];
const AGNES_MAP = [
  '###########',
  '#b...s...k#',
  '#.........#',
  '#...tc1...#',
  '#.........#',
  '#c.......r#',
  '#####x#####',
];
const KENNELHOUSE_MAP = [
  '###########',
  '#s..1....b#',
  '#.........#',
  '#..t......#',
  '#.....2...#',
  '#r.......r#',
  '#####x#####',
];
const CHAPEL_IN_MAP = [
  '###########',
  '#..l...1..#',
  '#.........#',
  '#.ee...ee.#',
  '#.........#',
  '#z2...ee..#',
  '#####x#####',
];
const LODGE_MAP = [
  '###########',
  '#1....s..2#',
  '#.........#',
  '#..tc.....#',
  '#.........#',
  '#r......z.#',
  '#####x#####',
];

type Door =
  | { place: HollowPlace }
  | { interior: string; gate?: number }
  | { out: true }
  | { dungeon: number };

type LoreLook = 'painting' | 'book' | 'board' | 'tongs' | 'letter' | 'bowl' | 'armour' | 'bed';

interface Building {
  letter: string;
  wall: string;
  roof: string;
  glow: string;
  label?: () => string;
  kind?: 'house' | 'stairs' | 'mine' | 'tower' | 'chapel' | 'ruin';
}

interface Area {
  name: string;
  map: string[];
  interior?: boolean;
  buildings?: Building[];
  doors: Record<string, Door>;
  exits?: Record<string, { to: string; x: number; y: number }>;
  npcs?: { id: NpcId; x: number; y: number }[];
  lore?: Record<string, { id: string; look: LoreLook }>;
  /** Interiors: the colour of the floorboards. */
  floor?: string;
  /** Your Isle: the ground and what stands on it come from the save. */
  isle?: boolean;
}

const AREAS: Record<string, Area> = {
  graveyard: {
    name: 'The Hollow',
    map: GRAVEYARD_MAP,
    buildings: [
      { letter: 'D', wall: '#3a3346', roof: '#5a1622', glow: '#d23a46', label: () => `DAILY #${dailyNumber()}` },
      { letter: 'E', wall: '#2a2433', roof: '#311854', glow: '#b07cff', label: () => 'ENDLESS' },
      { letter: 'F', wall: '#2f3440', roof: '#1f2a3a', glow: '#5fe3ff', label: () => 'FORGE' },
      { letter: 'O', wall: '#4a4038', roof: '#2e2620', glow: '#e8dcc4', label: () => 'OSSUARY' },
      { letter: 'H', wall: '#3a3346', roof: '#7a5a12', glow: '#f2c14e', label: () => 'HALL' },
      { letter: 'G', wall: '#2f2838', roof: '#3a2a10', glow: '#ff8a2a', label: () => 'GRIMOIRE' },
      { letter: 'R', wall: '#3a2433', roof: '#6b1f4a', glow: '#ff7ac8', label: () => 'WARDROBE' },
      { letter: 'M', wall: '#4a3a2a', roof: '#2a3b1f', glow: '#f2c14e', label: () => 'MORTIMER' },
      { letter: 'C', wall: '#3a3346', roof: '#2a2433', glow: '#9fe8ff', label: () => 'CRYPT', kind: 'stairs' },
    ],
    doors: {
      d: { place: 'daily' }, n: { place: 'endless' }, f: { place: 'forge' }, o: { place: 'ossuary' },
      h: { place: 'hall' }, g: { place: 'grimoire' }, r: { place: 'wardrobe' },
      m: { interior: 'cottage' }, c: { dungeon: 1 },
    },
    exits: { '>': { to: 'village', x: 1, y: 4 }, '<': { to: 'isle', x: ISLE_DOCK.x, y: ISLE_DOCK.y } },
  },
  isle: {
    name: 'Your Isle',
    map: ISLE_MAP,
    isle: true,
    doors: {},
    exits: { '<': { to: 'graveyard', x: 1, y: 4 } },
  },
  // Inside one of the houses on your isle (which one is `room`).
  home: { name: 'Home', interior: true, map: ROOM_MAP, floor: '#4a3020', doors: { x: { out: true } } },
  village: {
    name: 'Gravesend',
    map: VILLAGE_MAP,
    buildings: [
      { letter: 'A', wall: '#4a3a2a', roof: '#5a1622', glow: '#f2c14e', label: () => 'TAVERN' },
      { letter: 'K', wall: '#2f3440', roof: '#2a2433', glow: '#5fe3ff', label: () => 'SMITHY' },
      { letter: 'N', wall: '#2a2433', roof: '#141119', glow: '#c9c3b2', label: () => 'AGNES' },
      { letter: 'Q', wall: '#2f2838', roof: '#241f2c', glow: '' },
    ],
    doors: { a: { interior: 'tavern' }, k: { interior: 'smithy' }, n: { interior: 'agnes' } },
    exits: { '<': { to: 'graveyard', x: 19, y: 4 }, '>': { to: 'chapel', x: 1, y: 4 }, '^': { to: 'kennels', x: 11, y: 11 } },
  },
  kennels: {
    name: 'The Old Kennels',
    map: KENNELS_MAP,
    buildings: [
      { letter: 'Z', wall: '#4a3a2a', roof: '#3a2818', glow: '#ff4d5a', label: () => 'KENNELS' },
      { letter: 'H', wall: '#3a3030', roof: '#241f2c', glow: '#8a857a', kind: 'ruin' },
      { letter: 'I', wall: '#3a2818', roof: '#6b4a2a', glow: '#5fe3ff', label: () => 'OLD MINE', kind: 'mine' },
    ],
    doors: { z: { dungeon: 2 }, h: { interior: 'kennelhouse' }, i: { dungeon: 12 } },
    exits: { _: { to: 'village', x: 10, y: 1 } },
  },
  chapel: {
    name: 'The Chapel Grounds',
    map: CHAPEL_MAP,
    buildings: [
      { letter: 'P', wall: '#4b4259', roof: '#2f2838', glow: '#9fe8ff', label: () => 'CHAPEL', kind: 'chapel' },
      { letter: 'U', wall: '#3a3346', roof: '#241f2c', glow: '#ff4d5a', label: () => 'TOWER', kind: 'tower' },
    ],
    doors: { p: { interior: 'chapel-in' }, u: { interior: 'lodge', gate: 4 } },
    exits: { '<': { to: 'village', x: 19, y: 4 } },
  },
  cottage: {
    name: "Mortimer's Cottage", interior: true, map: COTTAGE_MAP, floor: '#3a2818',
    doors: { x: { out: true } },
    npcs: [{ id: 'gravedigger', x: 5, y: 2 }],
    lore: { '1': { id: 'mort-photo', look: 'painting' }, '2': { id: 'mort-ledger', look: 'book' } },
  },
  tavern: {
    name: 'The Last Orders', interior: true, map: TAVERN_MAP, floor: '#4a3020',
    doors: { x: { out: true }, z: { dungeon: 13 } },
    npcs: [{ id: 'bess', x: 5, y: 2 }],
    lore: { '1': { id: 'tavern-board', look: 'board' } },
  },
  smithy: {
    name: 'The Smithy', interior: true, map: SMITHY_MAP, floor: '#2a2433',
    doors: { x: { out: true } },
    npcs: [{ id: 'pip', x: 5, y: 3 }],
    lore: { '1': { id: 'marta-tongs', look: 'tongs' } },
  },
  agnes: {
    name: "Agnes's House", interior: true, map: AGNES_MAP, floor: '#2f2838',
    doors: { x: { out: true } },
    npcs: [{ id: 'agnes', x: 3, y: 4 }],
    lore: { '1': { id: 'agnes-letter', look: 'letter' } },
  },
  kennelhouse: {
    name: "The Kennel Master's House", interior: true, map: KENNELHOUSE_MAP, floor: '#2a2018',
    doors: { x: { out: true } },
    lore: { '1': { id: 'kennel-ledger', look: 'book' }, '2': { id: 'kennel-bowl', look: 'bowl' } },
  },
  'chapel-in': {
    name: 'The Ruined Chapel', interior: true, map: CHAPEL_IN_MAP, floor: '#2a2a38',
    doors: { x: { out: true }, z: { dungeon: 3 } },
    npcs: [{ id: 'aldric', x: 4, y: 2 }],
    lore: { '1': { id: 'aldric-journal', look: 'book' }, '2': { id: 'aldric-armour', look: 'armour' } },
  },
  lodge: {
    name: "The Warden's Lodge", interior: true, map: LODGE_MAP, floor: '#2a2433',
    doors: { x: { out: true }, z: { dungeon: 4 } },
    lore: { '1': { id: 'warden-portrait', look: 'painting' }, '2': { id: 'warden-bed', look: 'bed' } },
  },
};

const TILE = 16;
const SCALE = 4;
const SPAWN = { x: 8, y: 9 };
const OUTDOOR_SOLID = new Set(['#', 'T', '+', 'W', '~', '@', 's', 'L']);
const INDOOR_SOLID = new Set(['#', 'b', 't', 'c', 'k', 's', 'r', 'n', 'e', 'l', '1', '2']);

export interface HollowHooks {
  enter: (place: HollowPlace) => void;
  /** A line about a place, for the "enter or back out" prompt at its door. */
  describe: (place: HollowPlace) => string;
  visit: (name: string) => void;
  epitaph: (id: string) => void;
  menu: () => void;
  /** Names of today's leading players, to wander the graveyard as ghosts. */
  ghosts: () => Promise<string[]>;
  /** Whether the story (and the world past the graveyard) is open to this player. */
  storyOpen: () => boolean;
  npcPresent: (id: NpcId) => boolean;
  npcMarker: (id: NpcId) => string;
  talk: (id: NpcId) => void;
  /** A dungeon's door: open (with what's down there) or barred (and why). */
  dungeon: (n: number) => { open: boolean; title: string; text: string };
  enterDungeon: (n: number) => void;
  /** Story doors that open once a quest is taken. */
  gate: (n: number) => boolean;
  lore: (id: string) => { title: string; text: string } | null;
  readLore: (id: string) => void;
  loreRead: (id: string) => boolean;
  /** The Crypt Hound trots along behind. */
  pet: () => boolean;
  quests: () => void;
  /** Something built, picked up or bought on the isle. */
  built?: (what: 'place' | 'pickup' | 'land' | 'fail') => void;
}

const PLACE_NAMES: Record<HollowPlace, string> = {
  daily: 'The Daily Crypt',
  endless: 'The Endless Stair',
  forge: 'The Soul Forge',
  ossuary: 'The Ossuary',
  hall: 'Your Crypt Hall',
  grimoire: 'The Grimoire',
  wardrobe: 'The Wardrobe',
  ranks: 'The Obelisk of Ranks',
};

// Where the player stands persists between visits.
let areaId = 'graveyard';
const pos = { x: SPAWN.x, y: SPAWN.y };
const draw = { x: SPAWN.x, y: SPAWN.y };
/** Inside a building: the door to step back out of. */
let outside: { area: string; x: number; y: number } | null = null;
let trail = { x: SPAWN.x - 1, y: SPAWN.y };
const trailDraw = { x: SPAWN.x - 1, y: SPAWN.y };
let path: { x: number; y: number }[] = [];
let lastStep = 0;
let ghosts: Ghost[] = [];
let ghostsLoaded = 0;
let hooks: HollowHooks;
let dialog: string | null = null;
/** Waiting for the player to confirm going through a door (or visiting a ghost's Hall). */
let pending: { place: HollowPlace } | { ghost: string } | { dungeon: number } | null = null;
let raf = 0;
let facing = 1;
/** The on-screen arrow being held down, stepping again every so often. */
let hold = 0;
/** Build mode on your isle: the thing being set down (or picking up), and the shop tab. */
let build: { item: string | null; pickup: boolean; cat: IsleCat | 'land' } | null = null;
/** The tile under the pointer (or last tapped) while building, for the preview. */
let cursor: { x: number; y: number } | null = null;
/** The house on the isle you're inside (its room key), when in 'home'. */
let room: string | null = null;
/** Each house's floorboards. */
const HOME_FLOORS: Record<string, string> = {
  shack: '#3a2818', cottage: '#4a3020', hut: '#2e3424', tower: '#2a2433', windmill: '#4a3a24', mausoleum: '#2a2a38',
};
/** Looking round someone else's isle: theirs to draw, and where to go back to. */
let visiting: { name: string; isle: IsleState; back: () => void; home: { area: string; x: number; y: number; outside: { area: string; x: number; y: number } | null; room: string | null } } | null = null;

function stopHold() {
  window.clearInterval(hold);
  hold = 0;
}
// A finger lifted anywhere ends a hold, even off the button.
window.addEventListener('pointerup', stopHold);
window.addEventListener('pointercancel', stopHold);
/** Narrow screens see part of the map, following the hero; `camX` is in map pixels. */
let viewCols = 17;
let camX = 0;

interface Ghost {
  name: string;
  x: number;
  y: number;
  px: number;
  py: number;
  next: number;
}

const area = () => AREAS[areaId];
/** The isle being shown: yours, or the one you're visiting. */
const isleData = () => visiting?.isle ?? meta.isle;
const cols = () => area().map[0].length;
const rows = () => area().map.length;
/**
 * Every area is drawn in a box as tall as the tallest outdoor map, so the on-screen
 * arrows never jump when a door swaps in a shorter room (and a held thumb doesn't
 * land on the opposite arrow).
 */
const STAGE_ROWS = Math.max(...Object.values(AREAS).map((a) => a.map.length));
/** Roads that are always open, story or not: the ferry to your isle and back. */
const openRoad = (to: string) => to === 'isle' || areaId === 'isle';
const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols() || y >= rows() ? '#' : area().map[y][x]);
const isBuilding = (c: string) => Boolean(area().buildings?.some((b) => b.letter === c));
const doorAt = (x: number, y: number): Door | undefined => area().doors[at(x, y)];
const npcAt = (x: number, y: number) => area().npcs?.find((n) => n.x === x && n.y === y && hooks.npcPresent(n.id));

function walkable(x: number, y: number): boolean {
  const c = at(x, y);
  if (area().isle) return !isleSolid(isleData(), x, y);
  if (areaId === 'home') return Boolean(room) && !roomSolid(isleData(), room!, x, y);
  if (isBuilding(c)) return false;
  if (area().interior) return !INDOOR_SOLID.has(c);
  if (areaId === 'graveyard' && EPITAPHS[c]) return false;
  return !OUTDOOR_SOLID.has(c);
}

/** Where the player stands right now (for tests). */
export function debugPos() {
  return { area: areaId, x: pos.x, y: pos.y };
}

/** Put the player somewhere in the world, for the next time it opens. */
export function setHollowSpot(to: string, x: number, y: number) {
  if (!AREAS[to]) return;
  areaId = to;
  outside = null;
  pos.x = x;
  pos.y = y;
}

export function showHollow(h: HollowHooks) {
  hooks = h;
  // The world past the graveyard is the story's; without it, start back in the graveyard.
  visiting = null;
  build = null;
  // A house that's no longer there (moved on another device): back out to the jetty.
  if (areaId === 'home' && (!room || !homeOf(meta.isle, room))) {
    areaId = 'isle';
    room = null;
    pos.x = ISLE_DOCK.x;
    pos.y = ISLE_DOCK.y;
  }
  if (areaId !== 'graveyard' && areaId !== 'isle' && areaId !== 'home' && !hooks.storyOpen()) {
    areaId = 'graveyard';
    outside = null;
    pos.x = SPAWN.x;
    pos.y = SPAWN.y;
  }
  // Coming back out of a door: step out in front of it.
  stepOut();
  open();
}

/** Draw the current area (again, after moving to a new one). */
function open() {
  stopHold();
  draw.x = pos.x;
  draw.y = pos.y;
  trail = { x: pos.x - 1 >= 0 && walkable(pos.x - 1, pos.y) ? pos.x - 1 : pos.x, y: pos.y + (walkable(pos.x - 1, pos.y) ? 0 : 1) };
  trailDraw.x = trail.x;
  trailDraw.y = trail.y;
  path = [];
  dialog = null;
  pending = null;
  const touch = matchMedia('(pointer: coarse)').matches;
  // Building shows the whole isle at once; walking follows the hero.
  viewCols = build ? cols() : Math.min(cols(), window.innerWidth < 600 ? 11 : 17);
  camX = cameraTarget();
  const story = hooks.storyOpen();
  const isle = Boolean(area().isle) || areaId === 'home';
  const title = visiting && areaId !== 'home' ? `${visiting.name}'s Isle` : area().name;
  const right = visiting
    ? '<span></span>'
    : isle
      ? `<button class="btn ${build ? 'on' : ''}" id="isle-build">${build ? '✓ Done' : '🔨 Build'}</button>`
      : story
        ? '<button class="btn" id="hollow-quests">📜 Quests</button>'
        : `<span class="souls-chip">💀 <b>${meta.souls}</b></span>`;
  showOverlay('hollow', `
    <div class="hollow-wrap">
      <div class="hollow-top">
        ${visiting ? '<button class="btn" id="hollow-back">← Back</button>' : '<button class="btn" id="hollow-menu">☰ Menu</button>'}
        <span class="hollow-title">${esc(title)}</span>
        ${right}
      </div>
      <div class="hollow-stage" style="aspect-ratio: ${build ? cols() : window.innerWidth < 600 ? 11 : 17} / ${STAGE_ROWS}">
        <canvas id="hollow-canvas" width="${viewCols * TILE * SCALE}" height="${rows() * TILE * SCALE}" aria-label="${esc(area().name)}, a place to explore"></canvas>
      </div>
      <div class="hollow-dialog" id="hollow-dialog" hidden></div>
      ${build ? '<div class="isle-panel" id="isle-panel"></div>' : ''}
      ${touch && !build ? `<div class="hollow-dpad" aria-label="Move">
        <button type="button" data-d="0,-1" aria-label="Up">▲</button>
        <button type="button" data-d="-1,0" aria-label="Left">◀</button>
        <button type="button" data-d="1,0" aria-label="Right">▶</button>
        <button type="button" data-d="0,1" aria-label="Down">▼</button>
      </div>` : ''}
      ${build ? '' : `<p class="fine hollow-hint">${touch ? 'Use the arrows or tap a spot to walk.' : 'Arrows or WASD to walk, or click a spot.'} ${
        visiting
          ? areaId === 'home'
            ? 'Have a look round. The door takes you back out.'
            : 'Have a look round. Walk into a house to go inside. The jetty takes you back.'
          : areaId === 'home'
            ? 'Tap 🔨 Build to furnish it. The door takes you back out.'
            : isle
              ? 'Tap 🔨 Build to spend Souls on your land. Walk into a house to go inside.'
              : area().interior
              ? 'Walk into people to talk. Look closer at anything that glows.'
              : story
                ? 'Walk into doors and people. Roads at the edges lead on.'
                : 'Step through a door to enter. Read the old graves. The road west leads to your isle.'
      }</p>`}
    </div>`);
  overlay.querySelector('#hollow-menu')?.addEventListener('click', () => hooks.menu());
  overlay.querySelector('#hollow-back')?.addEventListener('click', () => leaveVisit());
  overlay.querySelector('#isle-build')?.addEventListener('click', () => {
    build = build ? null : { item: null, pickup: false, cat: areaId === 'home' ? 'furniture' : 'nature' };
    cursor = null;
    open();
  });
  overlay.querySelector('#hollow-quests')?.addEventListener('click', () => hooks.quests());
  const canvas = overlay.querySelector<HTMLCanvasElement>('#hollow-canvas')!;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    if (pending) return;
    const tx = Math.floor(((e.clientX - r.left) / r.width) * viewCols + camX / TILE);
    const ty = Math.floor(((e.clientY - r.top) / r.height) * rows());
    if (dialog) return closeDialog();
    if (build) return buildTap(tx, ty);
    walkTo(tx, ty);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!build || e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    cursor = {
      x: Math.floor(((e.clientX - r.left) / r.width) * viewCols + camX / TILE),
      y: Math.floor(((e.clientY - r.top) / r.height) * rows()),
    };
  });
  canvas.addEventListener('pointerleave', () => {
    if (build && !matchMedia('(pointer: coarse)').matches) cursor = null;
  });
  if (build) renderPanel();
  overlay.querySelector('#hollow-dialog')?.addEventListener('click', (e) => {
    // The finger that walked into a sign or door shouldn't also dismiss what it opened.
    if (staleTap(e, dialogShownAt)) return;
    const choice = (e.target as HTMLElement).closest<HTMLElement>('[data-choice]')?.dataset.choice;
    if (pending) {
      if (choice === 'go') confirmGo();
      else if (choice === 'back') backOut();
      return;
    }
    closeDialog();
  });
  // On-screen arrows: tap to step, hold to keep walking. Only one arrow is ever held, and
  // the hold ends with the finger, or when this area's screen goes away (a door or road
  // redraws it, and the button under the finger never hears it lift).
  overlay.querySelectorAll<HTMLButtonElement>('.hollow-dpad button').forEach((b) => {
    const [dx, dy] = b.dataset.d!.split(',').map(Number);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stopHold();
      if (pending) return backOut();
      if (dialog) return closeDialog();
      path = [];
      step(dx, dy);
      hold = window.setInterval(() => {
        if (screen !== 'hollow' || dialog || pending || !b.isConnected) return stopHold();
        step(dx, dy);
      }, 180);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stopHold);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  if (areaId === 'graveyard' && Date.now() - ghostsLoaded > 60_000) {
    ghostsLoaded = Date.now();
    void hooks
      .ghosts()
      .then((names) => {
        ghosts = names.slice(0, 4).map((name, i) => {
          const spot = randomFloor(i * 7 + 3);
          return { name, x: spot.x, y: spot.y, px: spot.x, py: spot.y, next: performance.now() + 800 * i };
        });
      })
      .catch(() => undefined);
  }
  if (isle && !visiting && !build && !meta.isle.placed.length && !meta.isle.land) {
    dialog = 'intro';
    showDialog(
      '<b>Your Isle</b>The ferryman rows you over to a scrap of land in the black water. It\'s yours. Spend the Souls from every run on it: trees, lights, houses you can walk into and furnish. Tap 🔨 Build to start. A few buildings even help you in Endless and the story.',
    );
  }
  cancelAnimationFrame(raf);
  const ctx = canvas.getContext('2d')!;
  let last = performance.now();
  const shown = areaId;
  const loop = (now: number) => {
    if (screen !== 'hollow' || !canvas.isConnected || areaId !== shown) return;
    update(now, Math.min(0.05, (now - last) / 1000));
    last = now;
    render(ctx, now / 1000);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function cameraTarget(): number {
  const max = (cols() - viewCols) * TILE;
  return Math.max(0, Math.min(max, (draw.x + 0.5 - viewCols / 2) * TILE));
}

function randomFloor(seed: number) {
  let r = seed * 9301 + 49297;
  for (let i = 0; i < 200; i++) {
    r = (r * 9301 + 49297) % 233280;
    const x = 1 + (r % (cols() - 2));
    const y = 4 + (Math.floor(r / 7) % (rows() - 5));
    if (walkable(x, y) && !doorAt(x, y) && !EXIT_KEYS.includes(at(x, y))) return { x, y };
  }
  return { x: SPAWN.x, y: SPAWN.y };
}

const EXIT_KEYS = ['<', '>', '^', '_'];

/** Go to another area (a road at the edge, or through a door). */
function travel(to: string, x: number, y: number) {
  areaId = to;
  pos.x = x;
  pos.y = y;
  open();
}

// ---------- your isle ----------

const icons = new Map<string, string>();
const icon = (id: string) => {
  if (!icons.has(id)) icons.set(id, isleIcon(id));
  return icons.get(id)!;
};

/** Where a thing's corner goes when you tap a tile: the tile is its bottom middle. */
function anchor(id: string, tx: number, ty: number) {
  const it = ISLE_ITEM[id];
  return { x: tx - Math.floor(((it.w ?? 1) - 1) / 2), y: ty - ((it.h ?? 1) - 1) };
}

/** The shop under the map while building: tabs, things to buy, and what tapping will do. */
function renderPanel() {
  const el = document.getElementById('isle-panel');
  if (!el || !build) return;
  const b = build;
  const tabs = (areaId === 'home' ? HOME_CATS : [...ISLE_CATS, { id: 'land' as const, name: '🗺️ Land' }])
    .map((c) => `<button type="button" class="isle-tab ${b.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.name}</button>`)
    .join('');
  let items = '';
  if (b.cat === 'land') {
    const next = LAND[meta.isle.land];
    items = next
      ? `<div class="isle-land"><b>${esc(next.name)}</b><span>${esc(next.desc)}</span>
          <button type="button" class="btn primary" id="isle-land" ${meta.souls < next.cost ? 'disabled' : ''}>Clear it · 💀 ${next.cost.toLocaleString()}</button></div>`
      : '<div class="isle-land"><b>The whole isle is yours</b><span>Every bramble is gone, right down to the water.</span></div>';
  } else {
    items = ISLE_ITEMS.filter((it) => it.cat === b.cat)
      .map((it) => {
        const stored = meta.isle.stored[it.id] ?? 0;
        const have = meta.isle.placed.filter((p) => p[0] === it.id).length + stored;
        const maxed = Boolean(it.max && have >= it.max && !stored);
        const price = stored ? `${stored} stored` : maxed ? 'Built' : `💀 ${it.cost.toLocaleString()}`;
        const poor = !stored && !maxed && meta.souls < it.cost;
        return `<button type="button" class="isle-item ${b.item === it.id ? 'on' : ''} ${poor || maxed ? 'dim' : ''}" data-item="${it.id}">
            <img src="${icon(it.id)}" alt="" width="32" height="32" /><span>${esc(it.name)}</span><small>${price}</small>
          </button>`;
      })
      .join('');
  }
  const sel = b.item ? ISLE_ITEM[b.item] : null;
  const hint = b.pickup
    ? 'Tap anything to pick it up. It waits in storage and goes back down free.'
    : sel
      ? `Tap the map to set down a <b>${esc(sel.name)}</b>${meta.isle.stored[sel.id] ? ' (from storage)' : ` for ${sel.cost.toLocaleString()} Souls`}.${sel.perk ? ` <b class="isle-perk">${esc(sel.perk)}</b>` : ''}`
      : b.cat === 'land'
        ? 'Clear more land to build further out.'
        : b.cat === 'wall'
          ? 'Wall things hang on the back wall: choose one, then tap the wall.'
          : 'Choose something, then tap the map to set it down.';
  el.innerHTML = `<div class="isle-panel-top">
      <span class="souls-chip">💀 <b>${meta.souls.toLocaleString()}</b></span>
      <button type="button" class="btn ${b.pickup ? 'on' : ''}" id="isle-pickup">🧹 Pick up</button>
    </div>
    <div class="isle-tabs">${tabs}</div>
    <div class="isle-items">${items}</div>
    <p class="fine isle-hint">${hint}</p>`;
  el.querySelectorAll<HTMLElement>('[data-cat]').forEach((t) =>
    t.addEventListener('click', () => {
      b.cat = t.dataset.cat as IsleCat | 'land';
      renderPanel();
    }),
  );
  el.querySelectorAll<HTMLElement>('[data-item]').forEach((t) =>
    t.addEventListener('click', () => {
      b.item = b.item === t.dataset.item ? null : t.dataset.item!;
      b.pickup = false;
      renderPanel();
    }),
  );
  el.querySelector('#isle-pickup')?.addEventListener('click', () => {
    b.pickup = !b.pickup;
    if (b.pickup) b.item = null;
    renderPanel();
  });
  el.querySelector('#isle-land')?.addEventListener('click', () => {
    if (buyLand()) {
      hooks.built?.('land');
      toast(`🗺️ ${LAND[meta.isle.land - 1].name}: done. More room to build.`);
    } else hooks.built?.('fail');
    renderPanel();
  });
}

/** A tap on the map while building: set the chosen thing down, or pick something up. */
function buildTap(tx: number, ty: number) {
  if (!build) return;
  cursor = { x: tx, y: ty };
  if (build.pickup) {
    const id = pickUpIsleItem(tx, ty, room ?? undefined);
    if (id) {
      if (!room && ISLE_ITEM[id].home) toast(`${ISLE_ITEM[id].name} picked up, with everything inside it. It all waits in storage.`);
      hooks.built?.('pickup');
      renderPanel();
    }
    return;
  }
  if (!build.item) {
    if (itemAt(meta.isle, tx, ty, room ?? undefined) >= 0) toast('Use 🧹 Pick up to move things.');
    return;
  }
  const it = ISLE_ITEM[build.item];
  const { x, y } = anchor(build.item, tx, ty);
  const onYou = pos.x >= x && pos.y >= y && pos.x < x + (it.w ?? 1) && pos.y < y + (it.h ?? 1);
  if (onYou && !it.walk) {
    hooks.built?.('fail');
    return toast('Step out of the way first.');
  }
  const result = placeIsleItem(build.item, x, y, room ?? undefined);
  if (result === 'ok') {
    hooks.built?.('place');
    if (it.max) build.item = null;
    renderPanel();
    return;
  }
  hooks.built?.('fail');
  if (result === 'souls') toast(`Not enough Souls: a ${it.name} costs ${it.cost.toLocaleString()}.`);
  else if (result === 'max') toast(`One ${it.name} is all an isle can hold.`);
  else if (room) toast(it.wall ? 'That hangs on the back wall.' : "It doesn't fit there.");
  else toast(meta.isle.land < LAND.length ? "It doesn't fit there. Clear more land in the Land tab." : "It doesn't fit there.");
}

/** Step inside one of the isle's houses. */
function enterHome(key: string) {
  const house = homeOf(isleData(), key);
  if (!house) return;
  const it = ISLE_ITEM[house[0]];
  room = key;
  build = null;
  AREAS.home.name = visiting ? `${visiting.name}'s ${it.name.replace(/^.*'s /, '')}` : `Your ${it.name}`;
  AREAS.home.floor = HOME_FLOORS[house[0]] ?? '#4a3020';
  outside = { area: 'isle', x: pos.x, y: pos.y };
  travel('home', ROOM_ENTRY.x, ROOM_ENTRY.y);
}

/** Look round someone else's isle. `back` runs when they leave. */
export function showIsleVisit(h: HollowHooks, name: string, isle: IsleState, back: () => void) {
  hooks = h;
  build = null;
  visiting = { name, isle, back, home: { area: areaId, x: pos.x, y: pos.y, outside, room } };
  room = null;
  areaId = 'isle';
  outside = null;
  pos.x = ISLE_DOCK.x;
  pos.y = ISLE_DOCK.y;
  open();
}

function leaveVisit() {
  const v = visiting;
  if (!v) return;
  visiting = null;
  areaId = v.home.area;
  pos.x = v.home.x;
  pos.y = v.home.y;
  outside = v.home.outside;
  room = v.home.room;
  v.back();
}

/** The isle: its ground, what's built, the ferry, and while building a preview of what a tap will do. */
function renderIsle(ctx: CanvasRenderingContext2D, px: Px, t: number) {
  const isle = isleData();
  drawIsleGround(ctx, px, isle, t);
  // the ferry, tied up at the end of the jetty
  const fy = 7 * TILE + 1 + Math.round(Math.sin(t * 1.5));
  px(2, fy, 26, 5, '#3a2818');
  px(4, fy + 5, 22, 3, '#2a1c12');
  px(13, fy - 8, 2, 8, '#2a2018');
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4);
  px(12, fy - 11, 4, 3, '#f2c14e');
  ctx.globalAlpha = 1;
  if (build) {
    // a faint grid over land you can build on
    ctx.globalAlpha = 0.12;
    for (let y = 0; y < rows(); y++) {
      for (let x = 0; x < cols(); x++) {
        const g = ISLE_MAP[y][x];
        if (g >= '0' && g <= '2' && Number(g) <= isle.land) {
          px(x * TILE, y * TILE, TILE, 1, '#e8dcc4');
          px(x * TILE, y * TILE, 1, TILE, '#e8dcc4');
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  drawIsleItems(ctx, px, isle.placed, t);
  buildPreview(ctx, px, t);
  sign(ctx, visiting ? 'BACK' : 'GRAVEYARD', 3 * TILE, 6 * TILE - 2, '#c9c3b2');
}

/** Inside a house: the room, its furniture, and the build preview. */
function renderHome(ctx: CanvasRenderingContext2D, px: Px, t: number) {
  renderInside(ctx, px, t);
  const isle = isleData();
  if (build) {
    ctx.globalAlpha = 0.12;
    for (let y = 0; y < ROOM_H - 1; y++) {
      for (let x = 1; x < ROOM_W - 1; x++) {
        if (x === ROOM_ENTRY.x && y === ROOM_ENTRY.y) continue;
        px(x * TILE, y * TILE, TILE, 1, '#e8dcc4');
        px(x * TILE, y * TILE, 1, TILE, '#e8dcc4');
      }
    }
    ctx.globalAlpha = 1;
  }
  if (room) drawIsleItems(ctx, px, isle.rooms[room] ?? [], t);
  buildPreview(ctx, px, t);
}

/** While building: what a tap will set down (green fits, red doesn't), or pick up. */
function buildPreview(ctx: CanvasRenderingContext2D, px: Px, t: number) {
  const isle = isleData();
  const where = room ?? undefined;
  if (build && cursor) {
    if (build.pickup) {
      const i = itemAt(isle, cursor.x, cursor.y, where);
      if (i >= 0) {
        const [id, x, y] = (where ? isle.rooms[where] : isle.placed)[i];
        const it = ISLE_ITEM[id];
        ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 6);
        px(x * TILE, y * TILE, (it.w ?? 1) * TILE, (it.h ?? 1) * TILE, '#d23a46');
        ctx.globalAlpha = 1;
      }
    } else if (build.item) {
      const it = ISLE_ITEM[build.item];
      const { x, y } = anchor(build.item, cursor.x, cursor.y);
      const ok = fits(isle, build.item, x, y, where);
      ctx.globalAlpha = 0.25;
      px(x * TILE, y * TILE, (it.w ?? 1) * TILE, (it.h ?? 1) * TILE, ok ? '#5fd36a' : '#d23a46');
      ctx.globalAlpha = ok ? 0.75 : 0.35;
      drawIsleItem(ctx, px, build.item, x * TILE, y * TILE, t);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- moving ----------

/** Arrow keys and WASD walk; Escape opens the menu. Returns true if the key was used. */
export function hollowKey(e: KeyboardEvent): boolean {
  const dirs: Record<string, [number, number]> = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };
  if (pending) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) confirmGo();
    } else if (e.key === 'Escape' || dirs[e.key]) {
      e.preventDefault();
      backOut();
    }
    return true;
  }
  if (dialog && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || dirs[e.key])) {
    e.preventDefault();
    closeDialog();
    return true;
  }
  if (e.key === 'Escape') {
    if (build) {
      build = null;
      open();
    } else if (visiting) leaveVisit();
    else hooks.menu();
    return true;
  }
  const d = dirs[e.key];
  if (!d) return false;
  e.preventDefault();
  if (e.repeat && performance.now() - lastStep < 140) return true;
  path = [];
  step(d[0], d[1]);
  return true;
}

const SOON = '<b>Coming soon</b>The road to Gravesend is still being laid. Mortimer says "soon". Mortimer says that about everything.';

function step(dx: number, dy: number) {
  if (dx) facing = dx;
  lastStep = performance.now();
  const x = pos.x + dx;
  const y = pos.y + dy;
  const tile = at(x, y);
  const story = hooks.storyOpen();
  const npc = npcAt(x, y);
  if (npc) {
    path = [];
    return hooks.talk(npc.id);
  }
  const ghost = areaId === 'graveyard' ? ghosts.find((g) => g.x === x && g.y === y) : undefined;
  if (ghost) {
    path = [];
    return ask({ ghost: ghost.name }, `<b>${esc(ghost.name)}</b>A ghost of one of today's best. Visit their Crypt Hall?`, 'Visit their Hall');
  }
  if (areaId === 'graveyard' && EPITAPHS[tile]) {
    path = [];
    openDialog(tile);
    return;
  }
  const lore = area().lore?.[tile];
  if (lore) {
    path = [];
    const l = hooks.lore(lore.id);
    if (!l) return;
    dialog = 'lore';
    showDialog(`<b>${esc(l.title)}</b>${esc(l.text)}`);
    hooks.readLore(lore.id);
    return;
  }
  if (areaId === 'graveyard' && tile === 'L') {
    path = [];
    return askPlace('ranks');
  }
  if (tile === 's' && areaId === 'graveyard') {
    path = [];
    dialog = 'sealed';
    showDialog('<b>A sealed gate</b>Frost creeps from under the iron. Something below is waiting for the seal to break.');
    return;
  }
  if (tile === '@') {
    path = [];
    return askDungeon(11);
  }
  const exit = area().exits?.[tile];
  if (exit) {
    path = [];
    if (visiting) return leaveVisit();
    if (!story && !openRoad(exit.to)) {
      dialog = 'soon';
      return showDialog(SOON);
    }
    build = null;
    return travel(exit.to, exit.x, exit.y);
  }
  if (area().isle) {
    // Walking into the front of a house takes you inside.
    const isle = isleData();
    const i = itemAt(isle, x, y);
    const house = i >= 0 ? isle.placed[i] : null;
    if (house && ISLE_ITEM[house[0]].home && y === house[2] + (ISLE_ITEM[house[0]].h ?? 1) - 1) {
      path = [];
      return enterHome(homeKey(house));
    }
  }
  if (!walkable(x, y)) return;
  const door = doorAt(x, y);
  // Story doors stay shut until the story opens.
  if (door && !('place' in door) && !story) {
    path = [];
    dialog = 'soon';
    return showDialog(areaId === 'graveyard' && 'interior' in door ? "<b>Mortimer's cottage</b>A note on the door: \"Back soon. Probably.\" (Coming soon.)" : SOON);
  }
  if (door && 'interior' in door && door.gate && !hooks.gate(door.gate)) {
    path = [];
    const info = hooks.dungeon(door.gate);
    dialog = 'barred';
    return showDialog(`<b>Locked</b>${esc(info.text)}`);
  }
  moveTo(x, y);
  if (!door) return;
  path = [];
  if ('out' in door) {
    const back = outside ?? { area: 'graveyard', x: SPAWN.x, y: SPAWN.y };
    outside = null;
    room = null;
    build = null;
    areaId = back.area;
    pos.x = back.x;
    pos.y = back.y;
    stepOut();
    return open();
  }
  if ('interior' in door) {
    outside = { area: areaId, x, y };
    const inside = AREAS[door.interior];
    const ex = inside.map.findIndex((row) => row.includes('x'));
    return travel(door.interior, inside.map[ex].indexOf('x'), ex - 1);
  }
  // Let the walk-in finish, then ask: a stray step shouldn't, say, start today's daily.
  window.setTimeout(() => {
    if (screen !== 'hollow' || pos.x !== x || pos.y !== y) return;
    if ('place' in door) askPlace(door.place);
    else askDungeon(door.dungeon);
  }, 160);
}

function moveTo(x: number, y: number) {
  if (Math.abs(x - pos.x) + Math.abs(y - pos.y) === 1) trail = { x: pos.x, y: pos.y };
  pos.x = x;
  pos.y = y;
}

/** Off a door tile onto the nearest open ground (doors face down, a few sit by a wall). */
function stepOut() {
  if (!doorAt(pos.x, pos.y)) return;
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    const x = pos.x + dx;
    const y = pos.y + dy;
    if (walkable(x, y) && !doorAt(x, y) && !EXIT_KEYS.includes(at(x, y))) {
      pos.x = x;
      pos.y = y;
      return;
    }
  }
}

function askPlace(place: HollowPlace) {
  ask({ place }, `<b>${PLACE_NAMES[place]}</b>${esc(hooks.describe(place))}`, place === 'ranks' ? 'Read the obelisk' : 'Enter');
}

function askDungeon(n: number) {
  if (!hooks.storyOpen()) {
    dialog = 'soon';
    return showDialog(SOON);
  }
  const info = hooks.dungeon(n);
  if (!info.open) {
    dialog = 'barred';
    showDialog(`<b>${esc(info.title)}</b>${esc(info.text)}`);
    stepOut();
    return;
  }
  ask({ dungeon: n }, `<b>${esc(info.title)}</b>${esc(info.text)}`, 'Descend');
}

function ask(what: NonNullable<typeof pending>, html: string, go: string) {
  pending = what;
  dialog = 'confirm';
  const el = document.getElementById('hollow-dialog');
  if (!el) return;
  el.innerHTML = `${html}<div class="hollow-choices">
      <button type="button" class="btn primary" data-choice="go">${esc(go)}</button>
      <button type="button" class="btn" data-choice="back">Back out</button>
    </div><small>Enter to go in · Esc or any arrow to back out</small>`;
  el.hidden = false;
}

function confirmGo() {
  const what = pending;
  if (!what) return;
  pending = null;
  closeDialog();
  if ('ghost' in what) hooks.visit(what.ghost);
  else if ('dungeon' in what) hooks.enterDungeon(what.dungeon);
  else hooks.enter(what.place);
}

function backOut() {
  pending = null;
  closeDialog();
  stepOut();
}

/** Shortest path to a tapped tile (or next to it, when it's something solid, a person or a ghost). */
function walkTo(tx: number, ty: number) {
  const C = cols();
  const key = (x: number, y: number) => y * C + x;
  const prev = new Map<number, number>();
  const start = key(pos.x, pos.y);
  prev.set(start, -1);
  const queue = [start];
  let goal = -1;
  const blocked = (x: number, y: number) => !walkable(x, y) || Boolean(npcAt(x, y));
  const target = (x: number, y: number) => (x === tx && y === ty) || (blocked(tx, ty) && Math.abs(x - tx) + Math.abs(y - ty) === 1);
  while (queue.length) {
    const k = queue.shift()!;
    const x = k % C;
    const y = Math.floor(k / C);
    if (target(x, y)) {
      goal = k;
      break;
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const nk = key(nx, ny);
      if (prev.has(nk) || blocked(nx, ny)) continue;
      // Don't route through doors or roads on the way somewhere else.
      if ((doorAt(nx, ny) || EXIT_KEYS.includes(at(nx, ny))) && !(nx === tx && ny === ty)) continue;
      prev.set(nk, k);
      queue.push(nk);
    }
  }
  if (goal < 0) return;
  const steps: { x: number; y: number }[] = [];
  for (let k = goal; k !== start; k = prev.get(k)!) steps.unshift({ x: k % C, y: Math.floor(k / C) });
  // Ending beside something solid (a grave, a person, a ghost): bump into it.
  if (blocked(tx, ty) || ghosts.some((g) => g.x === tx && g.y === ty)) steps.push({ x: tx, y: ty });
  path = steps;
}

function update(now: number, dt: number) {
  if (path.length && now - lastStep > 150 && !dialog) {
    const n = path.shift()!;
    step(n.x - pos.x, n.y - pos.y);
  }
  const k = Math.min(1, dt * 14);
  draw.x += (pos.x - draw.x) * k;
  draw.y += (pos.y - draw.y) * k;
  trailDraw.x += (trail.x - trailDraw.x) * Math.min(1, dt * 10);
  trailDraw.y += (trail.y - trailDraw.y) * Math.min(1, dt * 10);
  camX += (cameraTarget() - camX) * Math.min(1, dt * 6);
  if (areaId !== 'graveyard') return;
  for (const g of ghosts) {
    if (now > g.next) {
      g.next = now + 1400 + Math.random() * 1600;
      const options = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => {
        const x = g.x + dx;
        const y = g.y + dy;
        return walkable(x, y) && !doorAt(x, y) && !EXIT_KEYS.includes(at(x, y)) && !(x === pos.x && y === pos.y);
      });
      if (options.length) {
        const [dx, dy] = options[Math.floor(Math.random() * options.length)];
        g.x += dx;
        g.y += dy;
      }
    }
    g.px += (g.x - g.px) * Math.min(1, dt * 4);
    g.py += (g.y - g.py) * Math.min(1, dt * 4);
  }
}

// ---------- epitaphs and dialogs ----------

function openDialog(id: string) {
  dialog = id;
  const first = !meta.epitaphs.includes(id);
  showDialog(`<b>${first ? 'An old grave' : 'A grave you know'}</b>${esc(EPITAPHS[id])}`);
  hooks.epitaph(id);
}

let dialogShownAt = 0;

function showDialog(html: string) {
  const el = document.getElementById('hollow-dialog');
  if (!el) return;
  dialogShownAt = performance.now();
  el.innerHTML = `${html}<small>Tap or press any key</small>`;
  el.hidden = false;
}

function closeDialog() {
  dialog = null;
  const el = document.getElementById('hollow-dialog');
  if (el) el.hidden = true;
}

// ---------- drawing ----------

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

function render(ctx: CanvasRenderingContext2D, t: number) {
  ctx.setTransform(SCALE, 0, 0, SCALE, -Math.round(camX * SCALE), 0);
  ctx.imageSmoothingEnabled = false;
  const px: Px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  if (areaId === 'home') renderHome(ctx, px, t);
  else if (area().interior) renderInside(ctx, px, t);
  else if (area().isle) renderIsle(ctx, px, t);
  else renderOutside(ctx, px, t);

  // people, with a mark over anyone who has a quest for you (!) or is waiting to hear back (?)
  for (const n of area().npcs ?? []) {
    if (!hooks.npcPresent(n.id)) continue;
    const X = n.x * TILE + 2;
    const Y = n.y * TILE + 1 + Math.round(Math.sin(t * 2 + n.x) * 0.6);
    px(X + 2, n.y * TILE + 13, 8, 2, 'rgba(0,0,0,0.4)');
    ctx.globalAlpha = n.id === 'aldric' ? 0.75 + 0.15 * Math.sin(t * 3) : 1;
    ctx.save();
    if (pos.x < n.x) {
      ctx.translate(X + 12, Y);
      ctx.scale(-1, 1);
      ctx.drawImage(npcFigure(n.id), 0, 0, 12, 12);
    } else ctx.drawImage(npcFigure(n.id), X, Y, 12, 12);
    ctx.restore();
    ctx.globalAlpha = 1;
    const mark = hooks.npcMarker(n.id);
    if (mark) questMark(px, n.x * TILE, n.y * TILE - 5, mark, t);
  }

  // ghosts of today's best, in the graveyard
  if (areaId === 'graveyard') {
    const daily = heroSprite(dailyHero(dailyNumber()), {}, []).white;
    for (const g of ghosts) {
      const bob = Math.sin(t * 2 + g.name.length) * 1;
      ctx.globalAlpha = 0.45;
      ctx.drawImage(daily, g.px * TILE + 2, g.py * TILE + 1 + bob, 12, 12);
      ctx.globalAlpha = 1;
      nameTag(ctx, g.name, g.px * TILE + 8, g.py * TILE + bob);
    }
  }

  // the hound, one step behind
  if (hooks.pet() && (trail.x !== pos.x || trail.y !== pos.y) && walkable(trail.x, trail.y) && !npcAt(trail.x, trail.y)) {
    const frames = enemyFrames('hound');
    const img = frames.idle[Math.floor(t * 2) % 2].normal;
    const hx = trailDraw.x * TILE + 2;
    const hy = trailDraw.y * TILE + 2;
    px(hx + 2, hy + 11, 8, 2, 'rgba(0,0,0,0.35)');
    ctx.save();
    if (pos.x < trail.x) {
      ctx.translate(hx + 12, hy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, 12, 12);
    } else ctx.drawImage(img, hx, hy, 12, 12);
    ctx.restore();
  }

  // the player
  const fit = outfitFor(meta.hero);
  const hero = heroSprite(meta.hero, {}, [], fit.look, fit.head).normal;
  const hx = draw.x * TILE + 2;
  const hy = draw.y * TILE + 1;
  px(hx + 2, hy + 12, 8, 2, 'rgba(0,0,0,0.4)');
  drawAura(ctx, fit.aura, hx + 6, hy + 12, 12, t, 'back');
  ctx.save();
  if (facing < 0) {
    ctx.translate(hx + 12, hy);
    ctx.scale(-1, 1);
    ctx.drawImage(hero, 0, 0, 12, 12);
  } else ctx.drawImage(hero, hx, hy, 12, 12);
  ctx.restore();
  drawAura(ctx, fit.aura, hx + 6, hy + 12, 12, t, 'front');
  // A cloak's faint motes, unless a proper aura is on.
  const aura = fit.aura ? null : LOOK_BY_ID[fit.look]?.aura;
  if (aura) {
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3) % 1;
      ctx.globalAlpha = 0.8 * (1 - p);
      px(hx + 2 + ((i * 4) % 9), hy + 10 - p * 12, 1, 1, aura);
    }
    ctx.globalAlpha = 1;
  }

  // light: moonlight and fireflies outside, a warm glow inside
  const W = cols() * TILE;
  const H = rows() * TILE;
  const vx = camX + (viewCols * TILE) / 2;
  const v = ctx.createRadialGradient(vx, H / 2, 40, vx, H / 2, area().interior ? 120 : 190);
  v.addColorStop(0, area().interior ? 'rgba(255,170,90,0.06)' : 'rgba(7,4,11,0)');
  v.addColorStop(1, 'rgba(7,4,11,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  if (!area().interior) {
    for (let i = 0; i < 10; i++) {
      const fx = (Math.sin(t * 0.3 + i * 1.7) * 0.5 + 0.5) * W;
      const fy = (Math.cos(t * 0.23 + i * 2.3) * 0.5 + 0.5) * H;
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 3 + i);
      px(fx, fy, 1, 1, i % 3 ? '#b5e07a' : '#f2c14e');
    }
    ctx.globalAlpha = 1;
  }
}

function renderOutside(ctx: CanvasRenderingContext2D, px: Px, t: number) {
  const C = cols();
  const R = rows();
  const map = area().map;
  // ground
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const c = map[y][x];
      const X = x * TILE;
      const Y = y * TILE;
      const n = (x * 7 + y * 13) % 5;
      if (c === ':' || area().doors[c] || EXIT_KEYS.includes(c)) {
        px(X, Y, TILE, TILE, '#2a2433');
        px(X + 1 + n, Y + 2, 5, 4, '#332c3e');
        px(X + 8, Y + 9 - (n % 3), 6, 4, '#332c3e');
      } else if (c === '~') {
        px(X, Y, TILE, TILE, '#10202c');
        const w = Math.sin(t * 2 + x + y) > 0 ? 1 : 0;
        px(X + 2 + w, Y + 5, 5, 1, '#1f4a63');
        px(X + 8 - w, Y + 11, 5, 1, '#1f4a63');
      } else {
        px(X, Y, TILE, TILE, n % 2 ? '#141a17' : '#161d19');
        if (n === 0) px(X + 4, Y + 10, 1, 2, '#2c3a2f');
        if (n === 3) px(X + 11, Y + 5, 1, 2, '#2c3a2f');
      }
    }
  }
  // roads at the edges: a faint arrow, so it's clear the world goes on
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const c = map[y][x];
      if (!EXIT_KEYS.includes(c)) continue;
      const X = x * TILE + 8;
      const Y = y * TILE + 8;
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 3);
      const col = '#c9c3b2';
      if (c === '>') { px(X - 2, Y - 3, 2, 6, col); px(X, Y - 2, 2, 4, col); px(X + 2, Y - 1, 2, 2, col); }
      if (c === '<') { px(X + 2, Y - 3, 2, 6, col); px(X, Y - 2, 2, 4, col); px(X - 2, Y - 1, 2, 2, col); }
      if (c === '^') { px(X - 3, Y + 2, 6, 2, col); px(X - 2, Y, 4, 2, col); px(X - 1, Y - 2, 2, 2, col); }
      if (c === '_') { px(X - 3, Y - 2, 6, 2, col); px(X - 2, Y, 4, 2, col); px(X - 1, Y + 2, 2, 2, col); }
      ctx.globalAlpha = 1;
    }
  }

  // fence, trees, graves, bonfire, the well
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const c = map[y][x];
      const X = x * TILE;
      const Y = y * TILE;
      const epitaph = areaId === 'graveyard' && EPITAPHS[c];
      if (c === '#') {
        px(X, Y + 4, TILE, 2, '#3a3346');
        px(X, Y + 11, TILE, 2, '#3a3346');
        for (const bx of [2, 7, 12]) {
          px(X + bx, Y + 1, 2, 14, '#4b4259');
          px(X + bx, Y, 2, 1, '#6b6680');
        }
      } else if (c === 'T') {
        px(X + 7, Y + 4, 2, 12, '#2a2018');
        px(X + 3, Y + 5, 4, 1, '#2a2018');
        px(X + 3, Y + 3, 1, 2, '#2a2018');
        px(X + 9, Y + 7, 4, 1, '#2a2018');
        px(X + 12, Y + 4, 1, 3, '#2a2018');
      } else if (c === '+' || epitaph) {
        const read = epitaph && meta.epitaphs.includes(c);
        px(X + 4, Y + 4, 8, 10, '#4b4259');
        px(X + 5, Y + 3, 6, 1, '#4b4259');
        px(X + 6, Y + 6, 4, 1, '#2f2838');
        px(X + 7, Y + 5, 2, 5, '#2f2838');
        px(X + 3, Y + 14, 10, 1, '#0b0710');
        if (epitaph && !read) {
          // unread epitaphs glow faintly
          ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2 + x);
          px(X + 2, Y + 2, 12, 13, '#9fe8ff');
          ctx.globalAlpha = 1;
          px(X + 4, Y + 4, 8, 10, '#5d667a');
          px(X + 7, Y + 5, 2, 5, '#2f2838');
          px(X + 6, Y + 6, 4, 1, '#2f2838');
        }
      } else if (c === 'W') {
        const f = Math.sin(t * 9) > 0 ? 1 : 0;
        const glow = ctx.createRadialGradient(X + 8, Y + 8, 2, X + 8, Y + 8, 40);
        glow.addColorStop(0, 'rgba(255,140,60,0.35)');
        glow.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(X - 32, Y - 32, 80, 80);
        px(X + 3, Y + 12, 10, 2, '#4a3a2a');
        px(X + 5, Y + 6 - f, 6, 6 + f, '#ff8a2a');
        px(X + 6, Y + 8, 4, 4, '#f2c14e');
        px(X + 7, Y + 4 - f, 2, 3, '#ff8a2a');
      } else if (c === '@') {
        px(X + 2, Y + 5, 12, 10, '#4b4259');
        px(X + 4, Y + 7, 8, 6, '#0b1a24');
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2);
        px(X + 5, Y + 9, 6, 1, '#1f4a63');
        ctx.globalAlpha = 1;
        px(X + 2, Y + 1, 1, 5, '#3a2818');
        px(X + 13, Y + 1, 1, 5, '#3a2818');
        px(X + 2, Y + 1, 12, 1, '#3a2818');
        px(X + 7, Y + 2, 1, 4, '#8a857a');
        sign(ctx, 'WELL', X + 8, Y - 1, '#9fe8ff');
      } else if (c === 's' && areaId === 'graveyard') {
        px(X, Y + 1, TILE, 15, '#1f4a63');
        for (const bx of [2, 6, 10, 14]) px(X + bx - 1, Y, 2, 16, '#9fe8ff');
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 1.5);
        px(X - 4, Y - 6, TILE + 8, 6, '#9fe8ff');
        ctx.globalAlpha = 1;
      }
    }
  }

  // buildings
  for (const b of area().buildings ?? []) building(ctx, px, b, t);
  if (areaId === 'graveyard') graveyardDetails(ctx, px, t);

  // someone inside has something for you: show their mark over the door
  if (hooks.storyOpen()) {
    for (let y = 0; y < R; y++) {
      for (let x = 0; x < C; x++) {
        const door = area().doors[map[y][x]];
        if (!door || !('interior' in door)) continue;
        const marks = (AREAS[door.interior].npcs ?? []).filter((n) => hooks.npcPresent(n.id)).map((n) => hooks.npcMarker(n.id));
        const mark = marks.includes('?') ? '?' : marks.includes('!') ? '!' : '';
        if (mark) questMark(px, x * TILE, y * TILE - 20, mark, t);
      }
    }
  }
}

function questMark(px: Px, X: number, Y: number, mark: string, t: number) {
  const my = Y + Math.sin(t * 4) * 1.5;
  const color = mark === '?' ? '#9fe8ff' : '#f2c14e';
  px(X + 6, my - 1, 4, 10, 'rgba(7,4,11,0.7)');
  px(X + 7, my, 2, 5, color);
  px(X + 7, my + 6, 2, 2, color);
  if (mark === '?') {
    px(X + 6, my, 4, 1, color);
    px(X + 9, my + 1, 1, 2, color);
  }
}

function box(letter: string) {
  const map = area().map;
  let x0 = cols(), y0 = rows(), x1 = 0, y1 = 0;
  for (let y = 0; y < rows(); y++) for (let x = 0; x < cols(); x++) if (map[y][x] === letter) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { X: x0 * TILE, Y: y0 * TILE, W: (x1 - x0 + 1) * TILE, H: (y1 - y0 + 1) * TILE };
}

function building(ctx: CanvasRenderingContext2D, px: Px, bd: Building, t: number) {
  const b = box(bd.letter);
  // A building made of several separate blocks (houses dotted about): draw each one.
  const parts = blocks(bd.letter);
  if (parts.length > 1) {
    for (const p of parts) drawBlock(ctx, px, bd, p, t);
  } else drawBlock(ctx, px, bd, b, t);
}

/** Connected groups of a building's tiles, for letters used by more than one house. */
function blocks(letter: string) {
  const map = area().map;
  const seen = new Set<number>();
  const out: { X: number; Y: number; W: number; H: number }[] = [];
  for (let y = 0; y < rows(); y++) for (let x = 0; x < cols(); x++) {
    if (map[y][x] !== letter || seen.has(y * 100 + x)) continue;
    let x0 = x, y0 = y, x1 = x, y1 = y;
    const stack = [[x, y]];
    seen.add(y * 100 + x);
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (at(nx, ny) === letter && !seen.has(ny * 100 + nx)) {
          seen.add(ny * 100 + nx);
          stack.push([nx, ny]);
        }
      }
    }
    out.push({ X: x0 * TILE, Y: y0 * TILE, W: (x1 - x0 + 1) * TILE, H: (y1 - y0 + 1) * TILE });
  }
  return out;
}

function drawBlock(ctx: CanvasRenderingContext2D, px: Px, bd: Building, b: { X: number; Y: number; W: number; H: number }, t: number) {
  const kind = bd.kind ?? 'house';
  const dx = b.X + b.W / 2 - 4;
  const door = (glow: string) => {
    if (!glow) {
      px(dx + 1, b.Y + b.H - 9, 6, 9, '#141119');
      return;
    }
    const pulse = 0.6 + 0.4 * Math.sin(t * 2.4 + b.X);
    ctx.globalAlpha = pulse;
    px(dx - 2, b.Y + b.H - 13, 12, 13, glow);
    ctx.globalAlpha = 1;
    px(dx, b.Y + b.H - 11, 8, 11, '#07040b');
  };
  if (kind === 'stairs') {
    // a stone arch over steps going down
    px(b.X + 2, b.Y + 4, b.W - 4, b.H - 4, bd.wall);
    px(b.X + 4, b.Y + 2, b.W - 8, 2, bd.wall);
    px(b.X + 6, b.Y + 8, b.W - 12, b.H - 8, '#07040b');
    for (let i = 0; i < 4; i++) px(b.X + 7, b.Y + 12 + i * 4, b.W - 14, 1, '#2a2433');
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2);
    px(b.X + 6, b.Y + 8, b.W - 12, b.H - 8, bd.glow);
    ctx.globalAlpha = 1;
  } else if (kind === 'mine') {
    px(b.X + 2, b.Y + 6, b.W - 4, b.H - 6, '#2a2018');
    px(b.X + 4, b.Y + 4, 3, b.H - 4, bd.roof);
    px(b.X + b.W - 7, b.Y + 4, 3, b.H - 4, bd.roof);
    px(b.X + 2, b.Y + 3, b.W - 4, 3, bd.roof);
    px(b.X + 8, b.Y + 10, b.W - 16, b.H - 10, '#07040b');
    px(b.X + 6, b.Y + 13, b.W - 12, 1, '#8a857a');
    px(b.X + 6, b.Y + 19, b.W - 12, 1, '#8a857a');
  } else if (kind === 'tower') {
    px(b.X + 6, b.Y + 6, b.W - 12, b.H - 6, bd.wall);
    for (let i = 0; i < 3; i++) px(b.X + 6 + i * 6, b.Y + 2, 4, 4, bd.wall);
    for (let y = b.Y + 10; y < b.Y + b.H; y += 6) px(b.X + 6, y, b.W - 12, 1, 'rgba(0,0,0,0.25)');
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 1.3);
    px(b.X + b.W / 2 - 1, b.Y + 14, 3, 5, bd.glow);
    ctx.globalAlpha = 1;
    door(bd.glow);
  } else if (kind === 'chapel') {
    px(b.X + 2, b.Y + 10, b.W - 4, b.H - 10, bd.wall);
    // a broken roof, open to the sky on one side
    for (let i = 0; i < 9; i++) px(b.X + i * 2, b.Y + 10 - i, b.W / 2 - i * 2 + 6, 1, bd.roof);
    px(b.X + b.W - 18, b.Y + 4, 2, 6, bd.roof);
    // the cross on the gable
    px(b.X + b.W / 2 - 1, b.Y - 4, 2, 9, '#c9c3b2');
    px(b.X + b.W / 2 - 4, b.Y - 1, 8, 2, '#c9c3b2');
    // a round window, glowing cold
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 1.7);
    px(b.X + b.W / 2 - 3, b.Y + 16, 6, 6, bd.glow);
    ctx.globalAlpha = 1;
    door(bd.glow);
  } else if (kind === 'ruin') {
    px(b.X + 2, b.Y + 8, b.W - 4, b.H - 8, bd.wall);
    for (let i = 0; i < 6; i++) px(b.X + i * 2, b.Y + 8 - i, b.W - i * 4 - 10, 1, bd.roof);
    px(b.X + b.W - 10, b.Y + 9, 6, 4, '#07040b');
    door(bd.glow);
  } else {
    px(b.X + 2, b.Y + 8, b.W - 4, b.H - 8, bd.wall);
    for (let y = b.Y + 12; y < b.Y + b.H; y += 6) px(b.X + 2, y, b.W - 4, 1, 'rgba(0,0,0,0.25)');
    // pointed roof
    for (let i = 0; i < 8; i++) px(b.X + i * 2, b.Y + 8 - i, b.W - i * 4, 1, bd.roof);
    px(b.X, b.Y + 8, b.W, 2, bd.roof);
    // lit windows on homes people live in
    if (bd.glow && b.W >= 48) {
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 1.1 + b.X);
      px(b.X + 6, b.Y + 13, 5, 4, '#f2c14e');
      px(b.X + b.W - 11, b.Y + 13, 5, 4, '#f2c14e');
      ctx.globalAlpha = 1;
    }
    door(bd.glow);
  }
  const label = bd.label?.();
  if (label) sign(ctx, label, b.X + b.W / 2, b.Y - 1, bd.glow || '#8a857a');
}

/** The graveyard's own touches: a cloak by the Wardrobe, forge smoke, the Ossuary skull, the Hall crown, the obelisk. */
function graveyardDetails(ctx: CanvasRenderingContext2D, px: Px, t: number) {
  const rb = box('R');
  const cloak = LOOK_BY_ID[outfitFor(meta.hero).look]?.cloak ?? { p: '#3b4f7d', P: '#22304f' };
  px(rb.X + 6, rb.Y + 11, 6, 1, '#a8894a');
  px(rb.X + 7, rb.Y + 12, 4, 6, cloak.p);
  px(rb.X + 9, rb.Y + 12, 2, 6, cloak.P);
  const f = box('F');
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 0.5 * (1 - p);
    px(f.X + f.W - 8 + Math.sin(p * 6 + i) * 2, f.Y + 4 - p * 14, 3, 3, '#7fb4ff');
  }
  ctx.globalAlpha = 1;
  const o = box('O');
  px(o.X + 8, o.Y + 12, 6, 5, '#e8dcc4');
  px(o.X + 9, o.Y + 14, 1, 1, '#07040b');
  px(o.X + 12, o.Y + 14, 1, 1, '#07040b');
  const hb = box('H');
  px(hb.X + 8, hb.Y + 12, 7, 2, '#f2c14e');
  px(hb.X + 8, hb.Y + 10, 1, 2, '#f2c14e');
  px(hb.X + 11, hb.Y + 10, 1, 2, '#f2c14e');
  px(hb.X + 14, hb.Y + 10, 1, 2, '#f2c14e');
  // chimney smoke from Mortimer's cottage: the kettle is always on
  const mb = box('M');
  px(mb.X + mb.W - 12, mb.Y + 1, 3, 5, '#3a2818');
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.4 + i / 3) % 1;
    ctx.globalAlpha = 0.4 * (1 - p);
    px(mb.X + mb.W - 12 + Math.sin(p * 5 + i) * 2, mb.Y - p * 12, 3, 3, '#8a857a');
  }
  ctx.globalAlpha = 1;
  const L = box('L');
  px(L.X + 4, L.Y + 4, 8, L.H - 6, '#4b4259');
  px(L.X + 6, L.Y, 4, 4, '#4b4259');
  px(L.X + 2, L.Y + L.H - 3, 12, 3, '#3a3346');
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
  px(L.X + 7, L.Y + 8, 2, 10, '#f2c14e');
  ctx.globalAlpha = 1;
  sign(ctx, 'RANKS', L.X + L.W / 2, L.Y - 1, '#f2c14e');
  sign(ctx, 'ISLE', 1.5 * TILE, 4 * TILE - 1, '#9fe8ff');
}

function renderInside(ctx: CanvasRenderingContext2D, px: Px, t: number) {
  const C = cols();
  const R = rows();
  const map = area().map;
  const floor = area().floor ?? '#2a2433';
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const c = map[y][x];
      const X = x * TILE;
      const Y = y * TILE;
      if (c === '#' && y === 0) {
        // the back wall, with a skirting board
        px(X, Y, TILE, TILE, '#241f2c');
        px(X, Y + 3, TILE, 1, '#2f2838');
        px(X, Y + 9, TILE, 1, '#2f2838');
        px(X, Y + 14, TILE, 2, '#141119');
      } else if (c === '#') {
        px(X, Y, TILE, TILE, '#141119');
        if (y === R - 1) px(X, Y, TILE, 2, '#241f2c');
      } else {
        // floorboards
        px(X, Y, TILE, TILE, floor);
        px(X, Y + ((x * 5) % 4) * 4, TILE, 1, 'rgba(0,0,0,0.25)');
        px(X + ((y * 7) % 12), Y, 1, TILE, 'rgba(0,0,0,0.15)');
      }
    }
  }
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const c = map[y][x];
      const X = x * TILE;
      const Y = y * TILE;
      const lore = area().lore?.[c];
      if (lore) drawLore(ctx, px, lore, X, Y, t);
      else furniture(ctx, px, c, X, Y, t);
    }
  }
}

function furniture(ctx: CanvasRenderingContext2D, px: Px, c: string, X: number, Y: number, t: number) {
  switch (c) {
    case 'x': {
      // the way out: night air through the doorway
      px(X + 3, Y, 10, TILE, '#07040b');
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2);
      px(X + 3, Y, 10, TILE, '#3e8db5');
      ctx.globalAlpha = 1;
      break;
    }
    case 'z':
      px(X + 1, Y + 1, 14, 14, '#07040b');
      for (let i = 0; i < 4; i++) px(X + 2 + i, Y + 3 + i * 3, 12 - i * 2, 2, i % 2 ? '#2a2433' : '#3a3346');
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 2.5);
      px(X + 1, Y + 1, 14, 14, '#9fe8ff');
      ctx.globalAlpha = 1;
      break;
    case 'b':
      px(X + 1, Y + 2, 14, 12, '#4a3a2a');
      px(X + 2, Y + 3, 12, 4, '#d8d2c2');
      px(X + 2, Y + 7, 12, 6, '#5a1622');
      break;
    case 't':
      px(X + 1, Y + 5, 14, 5, '#6b4a2a');
      px(X + 2, Y + 10, 2, 5, '#3a2818');
      px(X + 12, Y + 10, 2, 5, '#3a2818');
      px(X + 6, Y + 3, 3, 2, '#c9c3b2');
      break;
    case 'c':
      px(X + 4, Y + 3, 8, 3, '#6b4a2a');
      px(X + 4, Y + 6, 8, 2, '#3a2818');
      px(X + 4, Y + 8, 2, 6, '#3a2818');
      px(X + 10, Y + 8, 2, 6, '#3a2818');
      break;
    case 'k': {
      // hearth (or forge): stone with a live fire
      px(X + 1, Y + 1, 14, 14, '#3a3346');
      px(X + 3, Y + 5, 10, 9, '#07040b');
      const fl = Math.sin(t * 9) > 0 ? 1 : 0;
      const blue = areaId === 'smithy';
      px(X + 5, Y + 8 - fl, 6, 5 + fl, blue ? '#5fe3ff' : '#ff8a2a');
      px(X + 6, Y + 10, 4, 3, blue ? '#e8fbff' : '#f2c14e');
      const glow = ctx.createRadialGradient(X + 8, Y + 10, 2, X + 8, Y + 10, 36);
      glow.addColorStop(0, blue ? 'rgba(95,227,255,0.25)' : 'rgba(255,140,60,0.3)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(X - 28, Y - 28, 72, 72);
      break;
    }
    case 's':
      px(X + 1, Y + 1, 14, 14, '#3a2818');
      for (const sy of [4, 9]) px(X + 2, Y + sy, 12, 1, '#6b4a2a');
      px(X + 3, Y + 2, 2, 2, '#9fe8ff');
      px(X + 7, Y + 2, 3, 2, '#d23a46');
      px(X + 4, Y + 6, 3, 3, '#c9c3b2');
      px(X + 9, Y + 7, 2, 2, '#f2c14e');
      break;
    case 'r':
      px(X + 3, Y + 2, 10, 12, '#6b4a2a');
      px(X + 3, Y + 4, 10, 1, '#3a2818');
      px(X + 3, Y + 11, 10, 1, '#3a2818');
      px(X + 5, Y + 2, 6, 1, '#8a6a4e');
      break;
    case 'n':
      px(X + 2, Y + 5, 12, 4, '#5d667a');
      px(X + 1, Y + 5, 3, 2, '#5d667a');
      px(X + 5, Y + 9, 6, 5, '#3a3346');
      px(X + 3, Y + 4, 10, 1, '#9aa3b5');
      break;
    case 'e':
      px(X + 1, Y + 6, 14, 3, '#3a2818');
      px(X + 1, Y + 3, 14, 3, '#4a3a2a');
      px(X + 2, Y + 9, 2, 5, '#2a2018');
      px(X + 12, Y + 9, 2, 5, '#2a2018');
      break;
    case 'l':
      px(X + 1, Y + 6, 14, 8, '#4b4259');
      px(X + 1, Y + 5, 14, 2, '#c9c3b2');
      for (const cx of [3, 11]) {
        px(X + cx, Y + 2, 2, 3, '#e8dcc4');
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 7 + cx);
        px(X + cx, Y, 2, 2, '#f2c14e');
        ctx.globalAlpha = 1;
      }
      break;
  }
}

/** Things worth a closer look. Unread ones glow faintly. */
function drawLore(ctx: CanvasRenderingContext2D, px: Px, lore: { id: string; look: LoreLook }, X: number, Y: number, t: number) {
  const unread = !hooks.loreRead(lore.id);
  if (unread) {
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2.5 + X);
    px(X + 1, Y + 1, 14, 14, '#9fe8ff');
    ctx.globalAlpha = 1;
  }
  switch (lore.look) {
    case 'painting':
      px(X + 2, Y + 2, 12, 11, '#a8781f');
      px(X + 3, Y + 3, 10, 9, '#2a3b1f');
      px(X + 6, Y + 5, 4, 4, '#c9a27e');
      px(X + 5, Y + 9, 6, 3, '#3b3346');
      break;
    case 'book':
      px(X + 1, Y + 5, 14, 5, '#6b4a2a');
      px(X + 2, Y + 10, 2, 5, '#3a2818');
      px(X + 12, Y + 10, 2, 5, '#3a2818');
      px(X + 4, Y + 2, 8, 4, '#5a1622');
      px(X + 5, Y + 2, 6, 3, '#e8dcc4');
      break;
    case 'board':
      px(X + 2, Y + 2, 12, 11, '#6b4a2a');
      px(X + 4, Y + 4, 4, 4, '#e8dcc4');
      px(X + 9, Y + 5, 3, 5, '#d8d2c2');
      px(X + 5, Y + 9, 3, 2, '#d8d2c2');
      break;
    case 'tongs':
      px(X + 3, Y + 2, 1, 11, '#2a2433');
      px(X + 6, Y + 2, 1, 11, '#2a2433');
      px(X + 3, Y + 1, 4, 2, '#5fe3ff');
      px(X + 9, Y + 4, 4, 8, '#5d667a');
      break;
    case 'letter':
      px(X + 1, Y + 5, 14, 5, '#6b4a2a');
      px(X + 2, Y + 10, 2, 5, '#3a2818');
      px(X + 12, Y + 10, 2, 5, '#3a2818');
      px(X + 4, Y + 3, 7, 4, '#e8dcc4');
      px(X + 5, Y + 4, 5, 1, '#8a857a');
      break;
    case 'bowl':
      px(X + 3, Y + 9, 10, 4, '#8a857a');
      px(X + 4, Y + 8, 8, 1, '#c9d1e0');
      px(X + 5, Y + 13, 6, 1, '#5d667a');
      break;
    case 'armour':
      px(X + 7, Y + 1, 2, 14, '#3a2818');
      px(X + 4, Y + 2, 8, 4, '#9aa3b5');
      px(X + 3, Y + 6, 10, 6, '#c9d1e0');
      px(X + 6, Y + 3, 4, 1, '#141119');
      px(X + 7, Y + 8, 2, 2, '#5d667a');
      break;
    case 'bed':
      px(X + 1, Y + 2, 14, 12, '#3a2818');
      px(X + 2, Y + 3, 12, 4, '#e8dcc4');
      px(X + 2, Y + 7, 12, 6, '#3a3346');
      px(X + 2, Y + 7, 12, 1, '#c9d1e0');
      break;
  }
}

function sign(ctx: CanvasRenderingContext2D, label: string, cx: number, y: number, color: string) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${5 * SCALE}px Silkscreen, monospace`;
  ctx.textAlign = 'center';
  const w = ctx.measureText(label).width + 6 * SCALE;
  const x = (cx - camX) * SCALE;
  const top = Math.max(0, (y - 6) * SCALE);
  ctx.fillStyle = 'rgba(7,4,11,0.85)';
  ctx.fillRect(x - w / 2, top, w, 7 * SCALE);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, top + 7 * SCALE - SCALE, w, SCALE / 2);
  ctx.fillText(label, x, top + 5.4 * SCALE);
  ctx.restore();
}

function nameTag(ctx: CanvasRenderingContext2D, name: string, cx: number, y: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${4 * SCALE}px Silkscreen, monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(7,4,11,0.7)';
  const w = ctx.measureText(name).width + 4 * SCALE;
  const x = (cx - camX) * SCALE;
  ctx.fillRect(x - w / 2, (y - 6) * SCALE, w, 6 * SCALE);
  ctx.fillStyle = '#c9a6ff';
  ctx.fillText(name, x, (y - 1.4) * SCALE);
  ctx.restore();
}
