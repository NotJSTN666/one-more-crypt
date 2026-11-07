// Every relic icon: a few shapes each, drawn by engine.js. Hand-drawn ones come from icons24.js.
// Helpers for the shapes that come up again and again.
const SKULL = ['..bwwwb..', '.bwhwwwbB', 'bwwwwwwbB', 'wkkwwwkkB', 'wkkkwkkkB', 'bwwwkwwbB', '.bwwwwwB.', '..wkwkwk.', '..BBBBB..'];
const SKULL_S = ['.bwwb.', 'bwhwwB', 'wkkwkB', 'bwwwbB', '.wkwk.'];
const BOLT = ['....kgk', '...kgGk', '..kggk.', '.kgggk.', 'kgyggk.', '..kgGk.', '..kgk..', '.kgk...', '.kk....'];
const GHOST = ['..hhhh..', '.hheeeh.', 'hheeeeeE', 'heFeeFeE', 'heFeeFeE', 'heeeeeeE', 'heeeeeEE', 'hEeEEeEE', 'E.E..E.E'];
const skull = (x, y) => ({ t: 'sprite', x, y, rows: SKULL });
const skullS = (x, y) => ({ t: 'sprite', x, y, rows: SKULL_S });
const bolt = (x, y) => ({ t: 'sprite', x, y, rows: BOLT });
const bone = (x1, y1, x2, y2, w = 2.2) => [
  { t: 'line', x1, y1, x2, y2, w, m: 'bone' },
  { t: 'circle', x: x1 - 0.8, y: y1 - 0.4, r: 1.5, m: 'bone', seam: false },
  { t: 'circle', x: x1 + 0.4, y: y1 + 0.8, r: 1.5, m: 'bone', seam: false },
  { t: 'circle', x: x2 + 0.8, y: y2 + 0.4, r: 1.5, m: 'bone', seam: false },
  { t: 'circle', x: x2 - 0.4, y: y2 - 0.8, r: 1.5, m: 'bone', seam: false },
];
const flame = (cx, by, h, m = 'fire', core = true) => [
  { t: 'poly', pts: [[cx - h * 0.45, by], [cx - h * 0.5, by - h * 0.45], [cx - h * 0.15, by - h * 0.8], [cx, by - h], [cx + h * 0.2, by - h * 0.6], [cx + h * 0.42, by - h * 0.75], [cx + h * 0.5, by - h * 0.35], [cx + h * 0.45, by]], m, shade: 'round' },
  ...(core ? [{ t: 'ellipse', x: cx, y: by - h * 0.3, rx: h * 0.22, ry: h * 0.3, m: m === 'fire' ? 'white' : m, seam: false, nobevel: true }] : []),
];
const sword = (x1, y1, x2, y2, m = 'steel', guard = 'gold') => {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const gx = x1 + ux * 5, gy = y1 + uy * 5;
  return [
    { t: 'line', x1: gx, y1: gy, x2, y2, w0: 3.2, w1: 0.6, m, hi: 1 },
    { t: 'line', x1, y1, x2: gx, y2: gy, w: 2, m: 'wood' },
    { t: 'line', x1: gx - uy * 3.2, y1: gy + ux * 3.2, x2: gx + uy * 3.2, y2: gy - ux * 3.2, w: 1.8, m: guard },
    { t: 'circle', x: x1, y: y1, r: 1.5, m: guard },
  ];
};
const heartPts = (cx, cy, s) => { const p = []; for (let a = 0; a < Math.PI * 2; a += 0.15) { const x = 16 * Math.sin(a) ** 3, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); p.push([cx + x * s, cy + y * s]); } return p; };
const heart = (cx, cy, s, m = 'blood', extra = {}) => ({ t: 'poly', pts: heartPts(cx, cy, s), m, shade: 'round', hi: 2, ...extra });
const star = (cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) => { const p = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1; const a = rot + (i * Math.PI) / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
const bellShape = (m, cx = 12, top = 4, bot = 18, w = 8) => [
  { t: 'ring', x: cx, y: top, r: 1.8, w: 1.2, m: 'gold', seam: false },
  { t: 'poly', pts: [[cx - 3.5, top + 1.5], [cx + 3.5, top + 1.5], [cx + 5.5, top + 4], [cx + 6, bot - 5], [cx + w - 0.5, bot - 1.5], [cx + w, bot], [cx - w, bot], [cx - w + 0.5, bot - 1.5], [cx - 6, bot - 5], [cx - 5.5, top + 4]], m, shade: 'round', hi: 1 },
  { t: 'rect', x: cx - w - 0.5, y: bot - 0.5, w: w * 2 + 1, h: 2, m },
  { t: 'circle', x: cx, y: bot + 2.2, r: 1.5, m: 'wood' },
];

var RECIPES = {
  // ---------------- main game relics ----------------
  whetstone: { name: 'Whetstone', old: '🗡️', s: sword(4, 20, 20, 4) },
  thorns: { name: 'Thorned Mail', old: '🌵', s: [
    { t: 'poly', pts: [[3, 7], [8, 3], [16, 3], [21, 7], [22.5, 14], [18.5, 14.5], [18, 22], [6, 22], [5.5, 14.5], [1.5, 14]], m: 'steel', hi: 1 },
    { t: 'ellipse', x: 12, y: 4, rx: 3.5, ry: 2.2, m: 'stone', dark: 2, seam: false, nobevel: true },
    { t: 'px', pts: [[7, 8, 'D'], [9, 9, 'D'], [11, 8, 'D'], [13, 9, 'D'], [15, 8, 'D'], [17, 9, 'D'], [8, 11, 'D'], [10, 12, 'D'], [12, 11, 'D'], [14, 12, 'D'], [16, 11, 'D'], [8, 15, 'D'], [10, 16, 'D'], [12, 15, 'D'], [14, 16, 'D'], [16, 15, 'D'], [9, 19, 'D'], [11, 20, 'D'], [13, 19, 'D'], [15, 20, 'D']] },
    { t: 'rect', x: 6, y: 13, w: 12, h: 1.6, m: 'wood' },
    { t: 'poly', pts: [[4, 6], [1, 2], [5.5, 4.5]], m: 'green' }, { t: 'poly', pts: [[20, 6], [23, 2], [18.5, 4.5]], m: 'green' },
    { t: 'poly', pts: [[2, 12], [0, 16], [3, 14]], m: 'green' }, { t: 'poly', pts: [[22, 12], [24, 16], [21, 14]], m: 'green' },
    { t: 'poly', pts: [[7, 21], [5, 24], [8.5, 22]], m: 'green' }, { t: 'poly', pts: [[17, 21], [19, 24], [15.5, 22]], m: 'green' },
  ] },
  frost: { name: 'Frost Sigil', old: '❄️', s: [
    { t: 'line', x1: 12, y1: 1.5, x2: 12, y2: 22.5, w: 2.2, m: 'ice' },
    { t: 'line', x1: 2.9, y1: 6.7, x2: 21.1, y2: 17.3, w: 2.2, m: 'ice', seam: false },
    { t: 'line', x1: 2.9, y1: 17.3, x2: 21.1, y2: 6.7, w: 2.2, m: 'ice', seam: false },
    ...[[12, 5, -1], [12, 19, 1]].flatMap(([x, y, d]) => [{ t: 'line', x1: x, y1: y, x2: x - 3, y2: y - 3 * d, w: 1.4, m: 'ice', seam: false }, { t: 'line', x1: x, y1: y, x2: x + 3, y2: y - 3 * d, w: 1.4, m: 'ice', seam: false }]),
    { t: 'circle', x: 12, y: 12, r: 3.2, m: 'ice', hi: 2 },
  ] },
  storm: { name: 'Storm Rune', old: '⚡', s: [
    { t: 'poly', pts: [[6, 3], [16, 2], [19, 5], [19, 20], [15, 22], [5, 21], [4, 6]], m: 'stone' },
    { t: 'sprite', x: 8, y: 7, rows: BOLT },
    { t: 'px', pts: [[7, 5, 't'], [8, 5, 't'], [7, 6, 't'], [16, 19, 'l'], [17, 18, 'l']] },
  ] },
  bloom: { name: 'Corpse Bloom', old: '💥', s: [
    ...[0, 1, 2, 3, 4, 5].map((k) => ({ t: 'circle', x: 12 + Math.cos(k * 1.047 - 1.57) * 6, y: 12 + Math.sin(k * 1.047 - 1.57) * 6, r: 3.8, m: 'violet' })),
    { t: 'circle', x: 12, y: 12, r: 4, m: 'green', hi: 1 },
    { t: 'px', pts: [[11, 11, 'j'], [13, 12, 'j'], [12, 14, 'j']] },
  ] },
  dust: { name: 'Grave Dust', old: '🌫️', s: [
    { t: 'ellipse', x: 9, y: 16, rx: 6, ry: 5.5, m: 'wood', hi: 1 },
    { t: 'rect', x: 6, y: 9, w: 6, h: 2.5, m: 'wood', dark: 1 },
    { t: 'line', x1: 6, y1: 11, x2: 12, y2: 11, w: 1, m: 'gold', seam: false },
    { t: 'circle', x: 15, y: 7, r: 3, m: 'stone', dark: -1 }, { t: 'circle', x: 19, y: 5, r: 2.4, m: 'stone', dark: -1 }, { t: 'circle', x: 18.5, y: 10, r: 2.6, m: 'stone', dark: -1 }, { t: 'circle', x: 21.5, y: 8.5, r: 1.6, m: 'stone', dark: -1 },
  ] },
  mark: { name: "Hunter's Mark", old: '🎯', s: [
    { t: 'circle', x: 12, y: 12, r: 10, m: 'blood' },
    { t: 'circle', x: 12, y: 12, r: 7.2, m: 'white', seam: false },
    { t: 'circle', x: 12, y: 12, r: 4.6, m: 'blood', seam: false },
    { t: 'circle', x: 12, y: 12, r: 2, m: 'white', seam: false },
    { t: 'line', x1: 12, y1: 12, x2: 22, y2: 2, w: 1.4, m: 'wood' },
    { t: 'poly', pts: [[19, 2], [23, 1], [22, 5]], m: 'blood' },
  ] },
  pact: { name: 'Blood Pact', old: '🩸', s: [
    { t: 'rect', x: 4, y: 4, w: 14, h: 17, m: 'bone' },
    { t: 'ellipse', x: 11, y: 4, rx: 8, ry: 1.8, m: 'bone', dark: 1 },
    { t: 'ellipse', x: 11, y: 21, rx: 8, ry: 1.8, m: 'bone', dark: 1 },
    { t: 'px', pts: [[7, 8, 'B'], [8, 8, 'B'], [9, 8, 'B'], [10, 8, 'B'], [11, 8, 'B'], [12, 8, 'B'], [7, 11, 'B'], [8, 11, 'B'], [9, 11, 'B'], [10, 11, 'B'], [7, 14, 'B'], [8, 14, 'B'], [9, 14, 'B']] },
    { t: 'poly', pts: [[17, 9], [20.5, 15], [20.5, 17.5], [17, 20], [13.5, 17.5], [13.5, 15]], m: 'blood', shade: 'round', hi: 1 },
  ] },
  whirl: { name: 'Whirling Blade', old: '🌀', s: [
    ...[0, 2.094, 4.189].map((a) => ({ t: 'ring', x: 12, y: 12, r: 10, w: 3, a0: a, a1: a + 1.5, m: 'steel', hi: 1 })),
    ...[0, 2.094, 4.189].map((a) => ({ t: 'line', x1: 12, y1: 12, x2: 12 + Math.cos(a) * 8, y2: 12 + Math.sin(a) * 8, w: 2, m: 'steel', seam: false })),
    { t: 'circle', x: 12, y: 12, r: 3, m: 'gold', hi: 1 },
  ] },
  pike: { name: 'Bone Pike', old: '🔱', s: [
    ...bone(4, 21, 14, 10, 2.4).slice(0, 3),
    { t: 'poly', pts: [[12.5, 10], [21.5, 1.5], [15.5, 12.5]], m: 'steel', hi: 1 },
    { t: 'poly', pts: [[10.5, 8.5], [12.5, 4], [14, 9.5]], m: 'steel' },
    { t: 'poly', pts: [[15.5, 13], [20, 11], [14.5, 15]], m: 'steel' },
    { t: 'rect', x: 11.5, y: 10.5, w: 3, h: 3, m: 'gold' },
  ] },
  candle: { name: 'Votive Candle', old: '🕯️', s: [
    { t: 'ellipse', x: 12, y: 20, rx: 8, ry: 2.5, m: 'gold' },
    { t: 'rect', x: 8, y: 9, w: 8, h: 11, m: 'bone', hi: 1 },
    { t: 'ellipse', x: 12, y: 9, rx: 4, ry: 1.3, m: 'bone', dark: -1, seam: false },
    { t: 'px', pts: [[15, 11, 'B'], [15, 12, 'B'], [15, 13, 'x'], [9, 10, 'B']] },
    { t: 'line', x1: 12, y1: 6, x2: 12, y2: 8.5, w: 1, m: 'shadow' },
    ...flame(12, 7, 6),
  ] },
  hellfire: { name: 'Hellfire Pact', old: '☄️', s: [
    ...flame(12, 13, 12),
    skull(7, 10),
    { t: 'px', pts: [[9, 13, 'r'], [13, 13, 'r']] },
  ] },
  coin: { name: "Ferryman's Coin", old: '🪙', s: [
    { t: 'circle', x: 12, y: 12, r: 9.5, m: 'gold', hi: 2 },
    { t: 'ring', x: 12, y: 12, r: 7.5, w: 1, m: 'gold', dark: 1.2, nobevel: true, seam: false },
    { t: 'sprite', x: 9, y: 8, rows: ['.HHHH.', 'HgGGgH', 'HHyyHH', '.GHHG.', '.H..H.', '.HHHH.'] },
  ] },
  dice: { name: 'Bone Dice', old: '🎲', s: [
    { t: 'poly', pts: [[3, 8], [12, 3.5], [21, 8], [12, 12.5]], m: 'bone', dark: -0.6 },
    { t: 'poly', pts: [[3, 8], [12, 12.5], [12, 22], [3, 17.5]], m: 'bone' },
    { t: 'poly', pts: [[12, 12.5], [21, 8], [21, 17.5], [12, 22]], m: 'bone', dark: 1 },
    { t: 'px', pts: [[11, 7, 'k'], [12, 7, 'k'], [6, 12, 'R'], [9, 15, 'R'], [7, 18, 'k'], [5, 15, 'k'], [17, 12, 'k'], [15, 15, 'k'], [18, 16, 'k'], [14, 18, 'k']] },
  ] },
  wildfire: { name: 'Wildfire', old: '🌋', s: [
    { t: 'poly', pts: [[1, 22], [8, 9], [16, 9], [23, 22]], m: 'stone' },
    { t: 'poly', pts: [[8, 9], [16, 9], [14.5, 13], [12, 11], [9.5, 14]], m: 'fire', seam: false },
    ...flame(12, 10, 9),
    { t: 'circle', x: 5, y: 5, r: 1.8, m: 'fire' }, { t: 'circle', x: 19, y: 4, r: 1.5, m: 'fire' },
  ] },
  shatter: { name: 'Glacial Shatter', old: '💎', s: [
    { t: 'poly', pts: [[12, 1], [16, 8], [12, 21], [8, 8]], m: 'ice', hi: 2 },
    { t: 'poly', pts: [[5, 6], [8, 9], [7, 17], [3, 12]], m: 'ice' },
    { t: 'poly', pts: [[19, 6], [21, 12], [17, 17], [16, 9]], m: 'ice', dark: 0.5 },
    { t: 'poly', pts: [[3, 18], [6, 20], [4, 23], [1, 21]], m: 'ice' }, { t: 'poly', pts: [[19, 19], [22, 20], [21, 23], [18, 22]], m: 'ice' },
  ] },
  conductor: { name: 'Iron Conductor', old: '⛓️', s: [
    { t: 'ring', x: 7, y: 7, r: 5, w: 2.2, m: 'steel' },
    { t: 'ring', x: 12, y: 12, r: 5, w: 2.2, m: 'steel' },
    { t: 'ring', x: 17, y: 17, r: 5, w: 2.2, m: 'steel' },
    { t: 'sprite', x: 16, y: 1, rows: ['..kgk', '.kgGk', 'kggk.', '.kgk.', 'kgk..', 'kk...'] },
  ] },
  flask: { name: 'Ichor Flask', old: '🧪', s: [
    { t: 'rect', x: 10, y: 1.5, w: 4, h: 3, m: 'wood' },
    { t: 'rect', x: 10.5, y: 4.5, w: 3, h: 5, m: 'ice', dark: 0.5 },
    { t: 'circle', x: 12, y: 15, r: 7.5, m: 'ice', hi: 2 },
    { t: 'ellipse', x: 12, y: 17, rx: 6.4, ry: 4.6, m: 'green', seam: false },
    { t: 'px', pts: [[9, 12, 'h'], [8, 13, 'c'], [14, 16, 'e'], [11, 18, 'e']] },
  ] },
  harvest: { name: 'Grim Harvest', old: '🪓', s: [
    { t: 'line', x1: 5, y1: 22, x2: 15, y2: 3, w: 2.2, m: 'wood' },
    { t: 'poly', pts: [[12, 5], [20, 2], [23, 9], [20, 15], [13, 11]], m: 'steel', shade: 'round', hi: 2 },
    { t: 'px', pts: [[19, 4, 'r'], [21, 11, 'R'], [20, 12, 'r']] },
    { t: 'rect', x: 11.5, y: 8, w: 3, h: 2.5, m: 'gold' },
  ] },
  necro: { name: 'Necrotic Touch', old: '🦴', s: [
    { t: 'circle', x: 12, y: 15, r: 8.5, m: 'green', dark: 1, nobevel: true },
    { t: 'ellipse', x: 12, y: 17, rx: 4.5, ry: 3.5, m: 'bone' },
    ...[[7, 6], [10, 4], [13.5, 4], [17, 6]].map(([x, y]) => ({ t: 'line', x1: x + (12 - x) * 0.5, y1: 15, x2: x, y2: y, w: 1.8, m: 'bone', seam: false })),
    { t: 'line', x1: 8.5, y1: 17, x2: 4, y2: 13, w: 1.8, m: 'bone', seam: false },
    { t: 'line', x1: 12, y1: 20, x2: 12, y2: 23, w: 2.5, m: 'bone', seam: false },
    { t: 'px', pts: [[7, 9, 'e'], [10, 8, 'e'], [14, 8, 'e'], [17, 10, 'e']] },
  ] },
  caltrops: { name: 'Caltrops', old: '🪤', s: [
    ...[[7, 8], [17, 9], [12, 17]].flatMap(([x, y]) => [{ t: 'poly', pts: star(x, y, 5.5, 1.6, 4, -0.3), m: 'steel', hi: 1 }]),
  ] },
  key: { name: 'Skeleton Key', old: '🗝️', s: [
    { t: 'ring', x: 7, y: 7, r: 5.5, w: 2.4, m: 'gold' },
    { t: 'line', x1: 10.5, y1: 10.5, x2: 21, y2: 21, w: 2.4, m: 'gold' },
    { t: 'line', x1: 17, y1: 17, x2: 14, y2: 20, w: 2.2, m: 'gold' },
    { t: 'line', x1: 20, y1: 20, x2: 17.5, y2: 22.5, w: 2.2, m: 'gold' },
    skullS(4, 4),
  ] },
  mask: { name: 'Plague Mask', old: '🎭', s: [
    { t: 'ellipse', x: 10, y: 10, rx: 8, ry: 8, m: 'wood' },
    { t: 'poly', pts: [[11, 11], [22, 22], [14, 18], [8, 15]], m: 'bone', hi: 1 },
    { t: 'circle', x: 7, y: 9, r: 2.6, m: 'ice', hi: 1 },
    { t: 'circle', x: 13, y: 7, r: 2.6, m: 'ice', hi: 1 },
    { t: 'line', x1: 3, y1: 4, x2: 16, y2: 2, w: 1.6, m: 'shadow' },
  ] },
  rosary: { name: "Saint's Rosary", old: '📿', s: [
    ...Array.from({ length: 12 }, (_, k) => ({ t: 'circle', x: 12 + Math.cos(k * 0.5236 - 1.57) * 8, y: 10 + Math.sin(k * 0.5236 - 1.57) * 7, r: 1.7, m: 'wood' })),
    { t: 'line', x1: 12, y1: 17, x2: 12, y2: 23, w: 2, m: 'gold' },
    { t: 'line', x1: 9, y1: 19.5, x2: 15, y2: 19.5, w: 2, m: 'gold', hi: 1 },
  ] },
  idol: { name: 'Berserker Idol', old: '🗿', s: [
    { t: 'poly', pts: [[6, 5], [18, 5], [19, 20], [5, 20]], m: 'stone', dark: -0.5 },
    { t: 'poly', pts: [[6, 6], [2, 1], [4, 7]], m: 'bone' }, { t: 'poly', pts: [[18, 6], [22, 1], [20, 7]], m: 'bone' },
    { t: 'rect', x: 7, y: 9, w: 4, h: 2, m: 'blood', hi: 1, seam: false }, { t: 'rect', x: 13, y: 9, w: 4, h: 2, m: 'blood', hi: 1, seam: false },
    { t: 'rect', x: 10.5, y: 11, w: 3, h: 4, m: 'stone', dark: 1.5, seam: false },
    { t: 'rect', x: 8, y: 16, w: 8, h: 1.5, m: 'shadow', seam: false },
    { t: 'rect', x: 4, y: 20, w: 16, h: 3, m: 'stone', dark: 1 },
  ] },
  scale: { name: 'Wyrm Scale', old: '🐉', s: [
    { t: 'poly', pts: [[12, 2], [20, 7], [19, 16], [12, 22], [5, 16], [4, 7]], m: 'green', shade: 'round', hi: 2 },
    { t: 'line', x1: 12, y1: 4, x2: 12, y2: 20, w: 1.2, m: 'green', dark: 1.5, seam: false, nobevel: true },
    { t: 'line', x1: 6, y1: 9, x2: 12, y2: 13, w: 1, m: 'green', dark: 1.5, seam: false, nobevel: true },
    { t: 'line', x1: 18, y1: 9, x2: 12, y2: 13, w: 1, m: 'green', dark: 1.5, seam: false, nobevel: true },
    { t: 'px', pts: [[9, 5, 'e'], [8, 6, 'e']] },
  ] },
  wisp: { name: 'Wisp Lantern', old: '👻', s: [
    { t: 'rect', x: 9, y: 1.5, w: 6, h: 3, m: 'wood' },
    { t: 'ellipse', x: 12, y: 14, rx: 8, ry: 9, m: 'ice', dark: 0.5, hi: 2 },
    { t: 'sprite', x: 8, y: 9, rows: GHOST },
  ] },
  doom: { name: 'Doom Bell', old: '🛎️', s: [
    ...bellShape('stone'),
    { t: 'px', pts: [[10, 9, 'r'], [11, 10, 'r'], [11, 11, 'R'], [10, 12, 'r'], [10, 13, 'r'], [14, 12, 'r'], [15, 13, 'R'], [14, 14, 'r'], [9, 15, 'R']] },
  ] },
  heretic: { name: "Heretic's Codex", old: '📜', s: [
    { t: 'rect', x: 4, y: 5, w: 16, h: 14, m: 'bone' },
    { t: 'ellipse', x: 12, y: 5, rx: 9, ry: 2, m: 'bone', dark: 1 },
    { t: 'ellipse', x: 12, y: 19, rx: 9, ry: 2, m: 'bone', dark: 1 },
    { t: 'px', pts: Array.from({ length: 24 }, (_, k) => [7 + (k % 8), 8 + Math.floor(k / 8) * 3, k % 3 ? 'u' : 'V']) },
    { t: 'circle', x: 16, y: 16, r: 3, m: 'blood', hi: 1 },
  ] },
  moon: { name: 'Blood Moon', old: '🌑', s: [
    { t: 'circle', x: 12, y: 12, r: 10, m: 'blood', hi: 2 },
    { t: 'circle', x: 9, y: 8, r: 2.4, m: 'blood', dark: 1.6, seam: false, nobevel: true },
    { t: 'circle', x: 15, y: 14, r: 3, m: 'blood', dark: 1.6, seam: false, nobevel: true },
    { t: 'circle', x: 9, y: 16, r: 1.6, m: 'blood', dark: 1.6, seam: false, nobevel: true },
    { t: 'circle', x: 16, y: 7, r: 1.2, m: 'blood', dark: 1.6, seam: false, nobevel: true },
  ] },
  headsman: { name: "Headsman's Blade", old: '🔪', s: [
    { t: 'poly', pts: [[7, 2], [18, 2], [18, 15], [7, 15]], m: 'steel', hi: 2 },
    { t: 'poly', pts: [[7, 2], [11, 2], [9, 5]], m: 'blood', seam: false },
    { t: 'px', pts: [[8, 4, 'R'], [8, 6, 'r']] },
    { t: 'rect', x: 5, y: 15, w: 15, h: 2.2, m: 'gold' },
    { t: 'rect', x: 11, y: 17, w: 3, h: 5, m: 'wood' },
    { t: 'circle', x: 12.5, y: 22.5, r: 1.5, m: 'gold' },
  ] },
  grail: { name: 'Unholy Grail', old: '🏆', s: [
    { t: 'poly', pts: [[4, 3], [20, 3], [18, 10], [13, 13], [11, 13], [6, 10]], m: 'gold', shade: 'round', hi: 2 },
    { t: 'ellipse', x: 12, y: 4, rx: 7.5, ry: 1.6, m: 'green', seam: false },
    { t: 'rect', x: 11, y: 13, w: 2, h: 5, m: 'gold' },
    { t: 'ellipse', x: 12, y: 20, rx: 6, ry: 2.2, m: 'gold' },
    skullS(9, 6),
  ] },
  thunder: { name: 'Thunderhead', old: '🌩️', s: [
    { t: 'circle', x: 8, y: 9, r: 5, m: 'stone', dark: -0.5 }, { t: 'circle', x: 14, y: 7, r: 6, m: 'stone', dark: -0.5, seam: false }, { t: 'circle', x: 18.5, y: 11, r: 4, m: 'stone', dark: -0.5, seam: false },
    { t: 'rect', x: 4, y: 10, w: 17, h: 4.5, m: 'stone', seam: false },
    { t: 'sprite', x: 9, y: 13, rows: BOLT },
  ] },
  leech: { name: 'Leech Ring', old: '💍', s: [
    { t: 'ring', x: 12, y: 14, r: 8, w: 2.6, m: 'gold', hi: 1 },
    { t: 'poly', pts: [[12, 1], [16.5, 5.5], [12, 10], [7.5, 5.5]], m: 'blood', hi: 2 },
  ] },
  glass: { name: 'Glass Skull', old: '💀', s: [
    { t: 'circle', x: 12, y: 10, r: 8.5, m: 'ice', hi: 2 },
    { t: 'rect', x: 7, y: 15, w: 10, h: 5, m: 'ice' },
    { t: 'ellipse', x: 8.5, y: 11, rx: 2.4, ry: 2.6, m: 'stone', dark: 1, seam: false },
    { t: 'ellipse', x: 15.5, y: 11, rx: 2.4, ry: 2.6, m: 'stone', dark: 1, seam: false },
    { t: 'px', pts: [[12, 14, 'I'], [11, 15, 'I'], [9, 19, 'I'], [11, 19, 'I'], [13, 19, 'I'], [15, 19, 'I'], [6, 6, 'h']] },
  ] },
  magnet: { name: 'Grave Magnet', old: '🧲', s: [
    { t: 'ring', x: 12, y: 11, r: 9, w: 5, a0: 0, a1: Math.PI, m: 'blood', hi: 1 },
    { t: 'rect', x: 3, y: 3, w: 5, h: 8, m: 'blood' }, { t: 'rect', x: 16, y: 3, w: 5, h: 8, m: 'blood' },
    { t: 'rect', x: 3, y: 2, w: 5, h: 3.5, m: 'steel' }, { t: 'rect', x: 16, y: 2, w: 5, h: 3.5, m: 'steel' },
  ] },
  drum: { name: 'War Drum', old: '🥁', s: [
    { t: 'rect', x: 4, y: 9, w: 16, h: 11, m: 'wood', shade: 'round' },
    { t: 'ellipse', x: 12, y: 20, rx: 8, ry: 2.2, m: 'wood', dark: 1 },
    { t: 'ellipse', x: 12, y: 9, rx: 8, ry: 2.6, m: 'bone', hi: 1 },
    { t: 'rect', x: 4, y: 12, w: 16, h: 1.5, m: 'blood', seam: false }, { t: 'rect', x: 4, y: 17, w: 16, h: 1.5, m: 'blood', seam: false },
    { t: 'line', x1: 3, y1: 2, x2: 10, y2: 8, w: 1.5, m: 'wood' }, { t: 'line', x1: 21, y1: 2, x2: 14, y2: 8, w: 1.5, m: 'wood' },
    { t: 'circle', x: 3, y: 2, r: 1.6, m: 'bone' }, { t: 'circle', x: 21, y: 2, r: 1.6, m: 'bone' },
  ] },
  spade: { name: "Gravedigger's Spade", old: '⛏️', s: [
    { t: 'line', x1: 18, y1: 2, x2: 11, y2: 13, w: 2, m: 'wood' },
    { t: 'line', x1: 16, y1: 1.5, x2: 20.5, y2: 4.5, w: 2, m: 'wood' },
    { t: 'poly', pts: [[9, 11], [14, 14], [12, 20], [7, 22], [3, 19], [4, 14]], m: 'steel', shade: 'round', hi: 2 },
    { t: 'px', pts: [[6, 20, 'N'], [8, 21, 'N']] },
  ] },
  invitation: { name: "Reaper's Invitation", old: '💌', s: [
    { t: 'rect', x: 2, y: 6, w: 20, h: 13, m: 'stone', dark: -0.5 },
    { t: 'poly', pts: [[2, 6], [22, 6], [12, 14]], m: 'stone', dark: -1.2 },
    { t: 'circle', x: 12, y: 14, r: 3.4, m: 'blood', hi: 1 },
    { t: 'px', pts: [[11, 13, 'Q'], [13, 13, 'Q'], [12, 15, 'Q']] },
  ] },
  orbit: { name: 'Whirling Skulls', old: '☠️', s: [
    { t: 'ring', x: 12, y: 12, r: 10.5, w: 1, m: 'gold', dark: 0.5, nobevel: true },
    skull(7, 7),
    skullS(1, 2), skullS(17, 16),
  ] },
  quiver: { name: 'Bone Quiver', old: '🏹', s: [
    ...[[7, 2], [11, 1], [15, 2]].flatMap(([x, y]) => [{ t: 'line', x1: x, y1: y + 2, x2: x + 1, y2: y + 9, w: 1, m: 'wood' }, { t: 'poly', pts: [[x - 1.5, y], [x + 1.5, y], [x + 1.5, y + 3], [x, y + 4.5], [x - 1.5, y + 3]], m: 'blood' }]),
    { t: 'poly', pts: [[4, 8], [19, 8], [17, 22], [6, 22]], m: 'wood', hi: 1 },
    { t: 'rect', x: 4, y: 8, w: 15, h: 2.2, m: 'gold' },
    { t: 'rect', x: 5, y: 15, w: 13, h: 1.5, m: 'gold', dark: 1, seam: false },
    skullS(9, 17),
  ] },
  // ---------------- main game fusions ----------------
  plasma: { name: 'Plasma Brand', old: '🌩️', px: (() => {
    // the Ember Brand's flame, burned violet, with a bolt through it
    const map = { q: 'v', y: 'c', o: 'V', O: 'u', f: 'U' };
    const g = ICONS.ember.px.map((r) => [...r].map((c) => map[c] ?? c));
    const bolt = [[13, 7], [12, 8], [12, 9], [11, 10], [11, 11], [10, 12], [11, 12], [12, 12], [13, 12], [12, 13], [12, 14], [11, 15], [11, 16], [10, 17]];
    for (const [x, y] of bolt) g[y][x] = 'g';
    for (const [x, y] of [[14, 7], [13, 8], [14, 12], [13, 13], [12, 15]]) g[y][x] = 'y';
    return g.map((r) => r.join(''));
  })() },
  zero: { name: 'Absolute Zero', old: '🧊', s: [
    { t: 'poly', pts: [[3, 7], [12, 3], [21, 7], [12, 11]], m: 'ice', dark: -1 },
    { t: 'poly', pts: [[3, 7], [12, 11], [12, 22], [3, 18]], m: 'ice' },
    { t: 'poly', pts: [[12, 11], [21, 7], [21, 18], [12, 22]], m: 'ice', dark: 1 },
    { t: 'px', pts: [[6, 10, 'h'], [6, 11, 'h'], [7, 12, 'c'], [15, 14, 'c']] },
  ] },
  vheart: { name: 'Vampire Lord', old: '🧛', s: [
    { t: 'poly', pts: [[11, 9], [1, 3], [3, 8], [0, 11], [4, 12], [3, 16], [10, 14]], m: 'stone', dark: -0.6 },
    { t: 'poly', pts: [[13, 9], [23, 3], [21, 8], [24, 11], [20, 12], [21, 16], [14, 14]], m: 'stone', dark: -0.6 },
    heart(12, 12, 0.5),
    { t: 'px', pts: [[10, 18, 'w'], [10, 19, 'w'], [14, 18, 'w'], [14, 19, 'w']] },
  ] },
  aegis: { name: 'Thorned Aegis', old: '🌹', s: [
    { t: 'poly', pts: [[3, 3], [21, 3], [20, 13], [12, 22], [4, 13]], m: 'steel', hi: 1 },
    { t: 'circle', x: 12, y: 10, r: 4.2, m: 'blood', hi: 1 },
    { t: 'px', pts: [[11, 9, 'R'], [12, 10, 'R'], [13, 9, 'Q']] },
    { t: 'line', x1: 12, y1: 14, x2: 12, y2: 19, w: 1.4, m: 'green' },
    { t: 'poly', pts: [[12, 16], [8, 14], [11, 17.5]], m: 'green' },
  ] },
  reaper: { name: "Reaper's Bargain", old: '☠️', s: [
    { t: 'poly', pts: [[12, 1], [20, 7], [21, 22], [3, 22], [4, 7]], m: 'stone' },
    { t: 'ellipse', x: 12, y: 11, rx: 5, ry: 6, m: 'shadow', dark: 3, seam: false, nobevel: true },
    skullS(9, 9),
    { t: 'line', x1: 21, y1: 2, x2: 21, y2: 23, w: 1.5, m: 'wood' },
    { t: 'ring', x: 17, y: 4, r: 5, w: 2, a0: Math.PI, a1: Math.PI * 1.7, m: 'steel' },
  ] },
  pyre: { name: 'Funeral Pyre', old: '🎆', s: [
    ...flame(12, 16, 14),
    { t: 'line', x1: 3, y1: 17, x2: 21, y2: 21, w: 2.6, m: 'wood' },
    { t: 'line', x1: 3, y1: 21, x2: 21, y2: 17, w: 2.6, m: 'wood' },
    { t: 'line', x1: 4, y1: 19, x2: 20, y2: 19, w: 2.6, m: 'wood', dark: 0.5 },
  ] },
  eternal: { name: 'Eternal Flame', old: '🪔', px: (() => {
    // the Ember Brand's flame burning cold blue-white, on a gold lamp
    const map = { q: 'c', y: 'h', o: 'C', O: 'i', f: 'I', N: 'G', n: 'g', M: 'H' };
    return ICONS.ember.px.map((r) => [...r].map((c) => map[c] ?? c).join(''));
  })() },
  fate: { name: "Fate's Card", old: '🃏', s: [
    { t: 'rect', x: 5, y: 2, w: 14, h: 20, m: 'bone' },
    { t: 'rect', x: 7, y: 4, w: 10, h: 16, m: 'violet', dark: 1, seam: false },
    skullS(9, 8),
    { t: 'poly', pts: star(12, 16, 2.4, 1, 4), m: 'gold', seam: false },
    { t: 'poly', pts: star(12, 6, 1.6, 0.7, 4), m: 'gold', seam: false },
  ] },
  oath: { name: "Berserker's Oath", old: '😈', s: [
    { t: 'circle', x: 12, y: 13, r: 8.5, m: 'blood', hi: 1 },
    { t: 'poly', pts: [[5, 9], [1, 1], [8, 6]], m: 'bone' }, { t: 'poly', pts: [[19, 9], [23, 1], [16, 6]], m: 'bone' },
    { t: 'poly', pts: [[7, 11], [11, 13], [7, 13]], m: 'gold', seam: false }, { t: 'poly', pts: [[17, 11], [13, 13], [17, 13]], m: 'gold', seam: false },
    { t: 'poly', pts: [[8, 16], [16, 16], [12, 19]], m: 'shadow', dark: 2, seam: false },
  ] },
  lichbook: { name: 'Book of the Dead', old: '📖', s: [
    { t: 'poly', pts: [[0.5, 9], [12, 11], [23.5, 9], [23.5, 21], [12, 23], [0.5, 21]], m: 'green', dark: 1.6 },
    { t: 'poly', pts: [[2, 8], [12, 10], [12, 21], [2, 19]], m: 'bone' },
    { t: 'poly', pts: [[12, 10], [22, 8], [22, 19], [12, 21]], m: 'bone', dark: 0.7 },
    { t: 'line', x1: 12, y1: 10, x2: 12, y2: 21, w: 1, m: 'stone', seam: false },
    skullS(4, 11),
    { t: 'px', pts: [[14, 12, 'x'], [15, 12, 'x'], [17, 12, 'x'], [18, 12, 'x'], [19, 12, 'x'], [14, 14, 'x'], [16, 14, 'x'], [17, 14, 'x'], [19, 14, 'x'], [14, 16, 'x'], [15, 16, 'x'], [16, 16, 'x'], [18, 16, 'x'], [14, 18, 'x'], [15, 18, 'x']] },
    ...[[7, 6, 'e'], [8, 4, 'E'], [6, 2, 'e'], [12, 7, 'e'], [13, 5, 'E'], [12, 3, 'e'], [12, 1, 'E'], [17, 6, 'e'], [16, 4, 'E'], [18, 2, 'e']].map(([x, y, c]) => ({ t: 'px', pts: [[x, y, c]] })),
  ] },
  dragon: { name: 'Dragonheart', old: '🐲', s: [
    heart(12, 12, 0.6, 'blood'),
    { t: 'px', pts: [[8, 8, 'F'], [10, 7, 'F'], [14, 7, 'F'], [16, 8, 'F'], [9, 11, 'E'], [12, 10, 'E'], [15, 11, 'E'], [10, 14, 'F'], [14, 14, 'F'], [12, 16, 'E']] },
    { t: 'poly', pts: [[6, 5], [3, 0.5], [8, 4]], m: 'bone' }, { t: 'poly', pts: [[18, 5], [21, 0.5], [16, 4]], m: 'bone' },
  ] },
  twinblade: { name: 'Twin Blade', old: '⚔️', s: [...sword(3, 21, 20, 3), ...sword(21, 21, 4, 3)] },
  suneater: { name: 'Sun Eater', old: '☀️', s: [
    { t: 'poly', pts: star(12, 12, 11.5, 7, 12, 0), m: 'fire', hi: 1 },
    { t: 'circle', x: 12, y: 12, r: 7, m: 'gold', seam: false },
    { t: 'circle', x: 13.5, y: 11, r: 5.8, m: 'stone', dark: 2, seam: false, nobevel: true },
  ] },
  bastion: { name: 'Glacier Bastion', old: '🏔️', s: [
    { t: 'poly', pts: [[1, 22], [9, 6], [12, 9], [16, 3], [23, 22]], m: 'ice', hi: 2 },
    { t: 'poly', pts: [[7, 10], [9, 6], [11, 9], [9, 11]], m: 'white', seam: false }, { t: 'poly', pts: [[14, 6], [16, 3], [18, 7], [16, 8]], m: 'white', seam: false },
    { t: 'rect', x: 8, y: 15, w: 8, h: 7, m: 'stone' },
    { t: 'rect', x: 10.5, y: 18, w: 3, h: 4, m: 'shadow', dark: 2, seam: false },
    { t: 'px', pts: [[8, 14, 'Z'], [10, 14, 'Z'], [12, 14, 'Z'], [14, 14, 'Z']] },
  ] },
  immortal: { name: 'Immortal Heart', old: '💖', s: [
    { t: 'ring', x: 12, y: 4, r: 4.5, w: 1.4, m: 'gold', seam: false },
    heart(12, 14, 0.55, 'blood'),
    { t: 'px', pts: [[7, 12, 'y'], [8, 11, 'y'], [16, 17, 'y'], [12, 19, 'p']] },
  ] },
  wager: { name: "Death's Wager", old: '⚰️', s: [
    { t: 'poly', pts: [[8, 1], [16, 1], [19, 7], [16, 23], [8, 23], [5, 7]], m: 'wood', hi: 1 },
    { t: 'line', x1: 12, y1: 5, x2: 12, y2: 16, w: 1.8, m: 'gold', seam: false },
    { t: 'line', x1: 9, y1: 8.5, x2: 15, y2: 8.5, w: 1.8, m: 'gold', seam: false },
    { t: 'circle', x: 18, y: 19, r: 3.5, m: 'gold', hi: 1 },
  ] },
  thousand: { name: 'Thousand Cuts', old: '🌪️', s: [
    ...[[12, 3, 10.5, 2.2], [12.5, 7, 9, 2], [12, 11, 7, 1.9], [11, 15, 5, 1.7], [10.5, 18.5, 3.2, 1.5], [11, 21.5, 1.8, 1.2]].map(([x, y, rx, ry], k) => ({ t: 'ellipse', x, y, rx, ry, m: 'white', dark: 0.6 + k * 0.15 })),
    ...[[2, 7, 7, 4], [16, 9, 22, 6], [5, 14, 9, 12], [14, 17, 19, 15]].map(([x1, y1, x2, y2]) => ({ t: 'line', x1, y1, x2, y2, w0: 2, w1: 0.5, m: 'steel', hi: 1, seam: false })),
    { t: 'px', pts: [[1, 7, 'r'], [15, 9, 'r'], [4, 14, 'r'], [13, 17, 'r']] },
  ] },
  dracolich: { name: 'Dracolich', old: '👁️', s: [
    { t: 'ellipse', x: 12, y: 12, rx: 11, ry: 7, m: 'bone', hi: 1 },
    { t: 'circle', x: 12, y: 12, r: 5.5, m: 'green', seam: false },
    { t: 'ellipse', x: 12, y: 12, rx: 1.2, ry: 4.5, m: 'stone', dark: 3, seam: false, nobevel: true },
    { t: 'px', pts: [[10, 9, 'h'], [10, 10, 'e']] },
  ] },
  // ---------------- Abyss boons ----------------
  edge: { name: 'Abyssal Edge', old: '⚔️', s: sword(4, 20, 20, 4, 'violet', 'stone') },
  ward: { name: 'Bone Ward', old: '🪞', s: [
    { t: 'ellipse', x: 12, y: 12, rx: 9, ry: 10.5, m: 'bone' },
    { t: 'ellipse', x: 12, y: 12, rx: 6, ry: 7.5, m: 'violet', seam: false, hi: 2 },
    ...[[12, 1], [12, 23], [2, 12], [22, 12]].map(([x, y]) => ({ t: 'circle', x, y, r: 1.6, m: 'bone' })),
  ] },
  veil: { name: 'Shade Step', old: '🌫️', s: [
    { t: 'poly', pts: [[8, 3], [14, 3], [14, 13], [21, 16], [21, 20], [8, 20]], m: 'violet', dark: 0.8 },
    { t: 'rect', x: 7, y: 19, w: 15, h: 2.5, m: 'shadow' },
    ...[[2, 8, 4], [1, 12, 5], [3, 16, 3]].map(([x, y, w]) => ({ t: 'line', x1: x, y1: y, x2: x + w, y2: y, w: 1.2, m: 'violet', seam: false })),
  ] },
  gravecandle: { name: 'Grave Candle', old: '🕯️', s: [
    { t: 'ellipse', x: 12, y: 20, rx: 7, ry: 2.4, m: 'stone' },
    { t: 'rect', x: 8.5, y: 9, w: 7, h: 11, m: 'stone', dark: -1 },
    { t: 'px', pts: [[9, 10, 'Z'], [14, 12, 'l'], [14, 13, 'l']] },
    { t: 'line', x1: 12, y1: 6, x2: 12, y2: 8.5, w: 1, m: 'shadow' },
    ...flame(12, 7, 6, 'violet'),
  ] },
  tithe: { name: 'Soul Tithe', old: '💀', s: [
    { t: 'circle', x: 12, y: 12, r: 10, m: 'violet', hi: 1 },
    { t: 'ring', x: 12, y: 12, r: 8, w: 1, m: 'violet', dark: 1.5, seam: false, nobevel: true },
    skull(8, 7),
  ] },
  vigor: { name: 'Grave Vigor', old: '❤️', s: [
    heart(12, 13, 0.62, 'blood'),
    { t: 'rect', x: 10.5, y: 8, w: 3, h: 9, m: 'white', seam: false }, { t: 'rect', x: 7.5, y: 11, w: 9, h: 3, m: 'white', seam: false },
  ] },
  mend: { name: 'Bloodmend', old: '🩸', s: [
    { t: 'poly', pts: [[12, 1], [18.5, 11], [19, 15], [16, 20.5], [12, 22], [8, 20.5], [5, 15], [5.5, 11]], m: 'blood', shade: 'round', hi: 2 },
    { t: 'line', x1: 8.5, y1: 15, x2: 15.5, y2: 15, w: 1.6, m: 'white', seam: false },
    { t: 'line', x1: 12, y1: 11.5, x2: 12, y2: 18.5, w: 1.6, m: 'white', seam: false },
  ] },
  dusk: { name: 'Grave Dusk', old: '🌘', s: [
    { t: 'circle', x: 12, y: 12, r: 10, m: 'violet', hi: 1 },
    { t: 'circle', x: 16.5, y: 9.5, r: 8.5, m: 'shadow', dark: 3, seam: false, nobevel: true },
    { t: 'px', pts: [[18, 16, 'v'], [20, 6, 'v'], [15, 19, 'u']] },
  ] },
  // ---------------- Night Shift relics (others share the main game's) ----------------
  bell: { name: 'Grave Bell', old: '🔔', s: bellShape('gold') },
  wisps: { name: 'Wandering Wisps', old: '👻', s: [
    { t: 'poly', pts: [[5, 9], [7, 4], [12, 2], [17, 4], [19, 9], [19, 21], [16.5, 19], [14, 21.5], [12, 19], [10, 21.5], [7.5, 19], [5, 21]], m: 'soul', shade: 'round', hi: 2 },
    { t: 'ellipse', x: 9.5, y: 10, rx: 1.3, ry: 2, m: 'green', dark: 3, seam: false, nobevel: true },
    { t: 'ellipse', x: 14.5, y: 10, rx: 1.3, ry: 2, m: 'green', dark: 3, seam: false, nobevel: true },
    { t: 'ellipse', x: 12, y: 15, rx: 1.4, ry: 1.2, m: 'green', dark: 3, seam: false, nobevel: true },
  ] },
  spikes: { name: 'Bone Spikes', old: '🦴', s: [
    { t: 'poly', pts: [[3, 22], [6, 6], [9, 22]], m: 'bone', hi: 1 },
    { t: 'poly', pts: [[8, 22], [12, 2], [16, 22]], m: 'bone', hi: 1 },
    { t: 'poly', pts: [[15, 22], [18, 9], [21, 22]], m: 'bone' },
    { t: 'rect', x: 1, y: 20, w: 22, h: 3, m: 'wood', dark: 1 },
  ] },
  lance: { name: 'Soul Lance', old: '🔱', s: [
    { t: 'line', x1: 4, y1: 21, x2: 15, y2: 10, w: 2.2, m: 'stone', dark: -1 },
    { t: 'poly', pts: [[13, 9], [22, 1], [17, 12]], m: 'ice', hi: 2 },
    { t: 'poly', pts: [[12, 8], [13, 3], [15, 8]], m: 'ice' },
    { t: 'poly', pts: [[17, 12], [21, 10], [16, 14]], m: 'ice' },
    { t: 'circle', x: 14, y: 11, r: 2, m: 'violet' },
  ] },
  totem: { name: 'Thrall Totem', old: '🗿', s: [
    { t: 'rect', x: 7, y: 9, w: 10, h: 13, m: 'wood' },
    { t: 'rect', x: 7, y: 14, w: 10, h: 1.5, m: 'blood', seam: false },
    { t: 'rect', x: 7, y: 18, w: 10, h: 1.5, m: 'blood', seam: false },
    skull(7, 1),
    { t: 'poly', pts: [[7, 10], [2, 7], [3, 12]], m: 'green' }, { t: 'poly', pts: [[17, 10], [22, 7], [21, 12]], m: 'green' },
  ] },
  hound: { name: 'Crypt Hound', old: '🐕', s: [
    { t: 'poly', pts: [[5, 9], [8, 3], [10, 7], [15, 7], [17, 3], [19, 9], [19, 15], [15, 21], [9, 21], [5, 15]], m: 'stone', dark: -1, shade: 'round', hi: 1 },
    { t: 'ellipse', x: 12, y: 17, rx: 3.5, ry: 3.3, m: 'stone', dark: -2, seam: false },
    { t: 'px', pts: [[9, 11, 'r'], [10, 11, 'r'], [14, 11, 'r'], [15, 11, 'r'], [11, 15, 'k'], [12, 15, 'k'], [13, 15, 'k'], [10, 19, 'w'], [14, 19, 'w']] },
  ] },
  spectre: { name: 'Spectral Knight', old: '👤', s: [
    { t: 'poly', pts: [[5, 9], [7, 3], [12, 1], [17, 3], [19, 9], [19, 18], [12, 22], [5, 18]], m: 'ice', dark: -0.5, hi: 2 },
    { t: 'rect', x: 6, y: 9, w: 12, h: 2, m: 'stone', dark: 2, seam: false, nobevel: true },
    { t: 'rect', x: 11, y: 11, w: 2, h: 7, m: 'stone', dark: 2, seam: false, nobevel: true },
    { t: 'px', pts: [[8, 10, 'e'], [9, 10, 'h'], [15, 10, 'e'], [16, 10, 'h']] },
    { t: 'poly', pts: [[12, 1], [10, -2], [14, -2]], m: 'blood' },
  ] },
  bulwark: { name: 'Bulwark (Knight)', old: '🛡️', s: [
    { t: 'poly', pts: [[3, 2], [21, 2], [20, 13], [12, 23], [4, 13]], m: 'gold', hi: 1 },
    { t: 'poly', pts: [[5, 4], [19, 4], [18, 12.5], [12, 20.5], [6, 12.5]], m: 'steel', seam: false, hi: 1 },
    { t: 'rect', x: 10.5, y: 5, w: 3, h: 13, m: 'blood', seam: false }, { t: 'rect', x: 6.5, y: 8, w: 11, h: 3, m: 'blood', seam: false },
  ] },
  knives: { name: 'Shadow Knives (Rogue)', old: '🔪', s: [
    ...[[3, 21, 10, 3], [7, 22, 16, 5], [11, 23, 21, 9]].flatMap(([x1, y1, x2, y2]) => [
      { t: 'line', x1: x1 + (x2 - x1) * 0.35, y1: y1 + (y2 - y1) * 0.35, x2, y2, w0: 2.6, w1: 0.6, m: 'steel', hi: 1 },
      { t: 'line', x1, y1, x2: x1 + (x2 - x1) * 0.35, y2: y1 + (y2 - y1) * 0.35, w: 1.8, m: 'stone', dark: -1 },
    ]),
  ] },
  legion: { name: 'Bone Legion (Necromancer)', old: '🧟', s: [
    { t: 'rect', x: 1, y: 18, w: 22, h: 5, m: 'wood', dark: 1.3 },
    { t: 'poly', pts: [[16, 3], [21, 3], [21, 18], [16, 18]], m: 'stone' },
    { t: 'line', x1: 7, y1: 19, x2: 8, y2: 11, w: 2.6, m: 'bone' },
    ...[[4, 4], [6.5, 3], [9, 3.5], [11, 5]].map(([x, y]) => ({ t: 'line', x1: 7.5, y1: 11, x2: x, y2: y, w: 1.5, m: 'bone', seam: false })),
    { t: 'line', x1: 7, y1: 13, x2: 3, y2: 10, w: 1.5, m: 'bone', seam: false },
    { t: 'px', pts: [[18, 6, 'Z'], [18, 7, 'Z'], [17, 7, 'Z'], [19, 7, 'Z'], [5, 2, 'e'], [10, 2, 'e']] },
  ] },
  nova: { name: 'Holy Nova (Paladin)', old: '🌟', s: [
    { t: 'poly', pts: star(12, 12, 11.5, 4, 8), m: 'gold', hi: 1 },
    { t: 'circle', x: 12, y: 12, r: 5, m: 'white', seam: false, hi: 1 },
  ] },
  arrowrain: { name: 'Arrow Rain (Ranger)', old: '🌧️', s: [
    { t: 'circle', x: 7, y: 6, r: 4, m: 'stone', dark: -0.5 }, { t: 'circle', x: 13, y: 4.5, r: 4.5, m: 'stone', dark: -0.5, seam: false }, { t: 'circle', x: 18, y: 6.5, r: 3.5, m: 'stone', dark: -0.5, seam: false },
    { t: 'rect', x: 4, y: 6, w: 16, h: 4, m: 'stone', seam: false },
    ...[[6, 12], [12, 14], [18, 12], [9, 19], [15, 19]].flatMap(([x, y]) => [{ t: 'line', x1: x, y1: y - 4, x2: x, y2: y + 1, w: 1, m: 'wood' }, { t: 'poly', pts: [[x - 1.5, y], [x + 1.5, y], [x, y + 3]], m: 'steel' }]),
  ] },
  orb: { name: 'Arcane Orb (Mage)', old: '🟣', s: [
    { t: 'circle', x: 12, y: 12, r: 8.5, m: 'violet', hi: 2 },
    { t: 'ring', x: 12, y: 12, r: 11.5, w: 1.2, a0: 2.4, a1: 5.2, m: 'violet', seam: false, nobevel: true },
    { t: 'poly', pts: star(12, 12, 3.5, 1.2, 4), m: 'white', seam: false },
  ] },
  slam: { name: 'Ground Slam (Barbarian)', old: '💥', s: [
    { t: 'rect', x: 0, y: 18, w: 24, h: 6, m: 'stone' },
    { t: 'line', x1: 21, y1: 1, x2: 12, y2: 12, w: 2.2, m: 'wood' },
    { t: 'poly', pts: [[5, 9], [14, 4], [18, 12], [9, 17]], m: 'steel', hi: 2 },
    { t: 'line', x1: 6.5, y1: 12, x2: 16, y2: 7, w: 1.2, m: 'gold', seam: false },
    { t: 'px', pts: [[9, 18, 'l'], [8, 19, 'l'], [10, 19, 'l'], [7, 20, 'l'], [11, 20, 'l'], [6, 21, 'l'], [12, 21, 'l'], [9, 20, 'l'], [9, 21, 'l'], [10, 22, 'l'], [5, 22, 'l'], [13, 22, 'l']] },
    ...[[1, 16, 3, 12], [17, 16, 20, 13], [0, 11, 2, 8], [22, 17, 24, 14]].map(([x1, y1, x2, y2]) => ({ t: 'line', x1, y1, x2, y2, w: 1.4, m: 'fire', seam: false })),
    { t: 'circle', x: 3.5, y: 18, r: 2, m: 'stone', dark: -1.5, seam: false }, { t: 'circle', x: 15, y: 18, r: 2, m: 'stone', dark: -1.5, seam: false },
  ] },
  toll: { name: 'Great Toll (Bell-Ringer)', old: '📯', s: [
    ...bellShape('gold', 12, 5, 17, 6),
    { t: 'ring', x: 12, y: 12, r: 11.5, w: 1.2, a0: 2.6, a1: 3.7, m: 'violet', seam: false, nobevel: true },
    { t: 'ring', x: 12, y: 12, r: 11.5, w: 1.2, a0: -0.55, a1: 0.55, m: 'violet', seam: false, nobevel: true },
  ] },
  boots: { name: 'Swift Boots', old: '🥾', s: [
    { t: 'rect', x: 8, y: 3, w: 7, h: 12, m: 'wood' },
    { t: 'poly', pts: [[8, 14], [15, 14], [21, 16], [21, 20], [8, 20]], m: 'wood' },
    { t: 'rect', x: 7, y: 19, w: 15, h: 2.5, m: 'shadow' },
    { t: 'rect', x: 7.5, y: 3, w: 8, h: 2, m: 'gold' },
    { t: 'line', x1: 2, y1: 8, x2: 6, y2: 10, w: 1.4, m: 'white', seam: false },
    { t: 'line', x1: 1, y1: 13, x2: 6, y2: 14, w: 1.4, m: 'white', seam: false },
  ] },
  moss: { name: 'Grave Moss', old: '🍄', s: [
    { t: 'rect', x: 9.5, y: 11, w: 5, h: 10, m: 'bone' },
    { t: 'ellipse', x: 12, y: 10, rx: 10, ry: 6.5, m: 'green', hi: 2 },
    { t: 'px', pts: [[7, 8, 'e'], [12, 6, 'e'], [16, 9, 'e'], [9, 11, 'e']] },
    { t: 'ellipse', x: 12, y: 21, rx: 7, ry: 2, m: 'green', dark: 1.5 },
  ] },
  lens: { name: "Seer's Lens", old: '🔮', s: [
    { t: 'poly', pts: [[6, 22], [8, 17], [16, 17], [18, 22]], m: 'gold' },
    { t: 'circle', x: 12, y: 10, r: 8.5, m: 'violet', hi: 2 },
    { t: 'ellipse', x: 12, y: 11, rx: 3, ry: 4, m: 'white', seam: false, dark: 1 },
    { t: 'circle', x: 12, y: 11, r: 1.5, m: 'stone', dark: 3, seam: false, nobevel: true },
  ] },
  cloak: { name: 'Shade Cloak', old: '🦇', s: [
    { t: 'poly', pts: [[12, 8], [8, 4], [1, 5], [3, 9], [0, 13], [5, 13], [6, 18], [12, 14], [18, 18], [19, 13], [24, 13], [21, 9], [23, 5], [16, 4]], m: 'violet', dark: 0.8 },
    { t: 'ellipse', x: 12, y: 11, rx: 3, ry: 4, m: 'stone', dark: -0.5, seam: false },
    { t: 'px', pts: [[11, 10, 'r'], [13, 10, 'r'], [10, 7, 'Z'], [14, 7, 'Z']] },
  ] },
  // ---------------- Night Shift fusions ----------------
  cleaver: { name: 'Grave Cleaver', old: '🪓', s: [
    { t: 'line', x1: 3, y1: 22, x2: 11, y2: 12, w: 2.4, m: 'wood' },
    { t: 'poly', pts: [[8, 11], [16, 2], [23, 8], [15, 17]], m: 'steel', hi: 2 },
    { t: 'line', x1: 16, y1: 2, x2: 23, y2: 8, w: 1.3, m: 'violet', seam: false },
    { t: 'circle', x: 13, y: 9, r: 1.4, m: 'stone', dark: 2, seam: false },
  ] },
  halo: { name: 'Bone Halo', old: '☠️', s: [
    { t: 'ring', x: 12, y: 12, r: 10.5, w: 1.2, m: 'violet', nobevel: true },
    ...Array.from({ length: 6 }, (_, k) => skullS(Math.round(9 + Math.cos(k * 1.047) * 8), Math.round(9.5 + Math.sin(k * 1.047) * 8))),
    { t: 'circle', x: 12, y: 12, r: 2.5, m: 'violet', hi: 1 },
  ] },
  barrage: { name: 'Bone Barrage', old: '🎯', s: [
    { t: 'circle', x: 10, y: 14, r: 8.5, m: 'blood' }, { t: 'circle', x: 10, y: 14, r: 5.8, m: 'white', seam: false }, { t: 'circle', x: 10, y: 14, r: 3, m: 'blood', seam: false },
    ...[[10, 14, 21, 3], [8, 12, 15, 1], [12, 16, 23, 9]].flatMap(([x1, y1, x2, y2]) => [{ t: 'line', x1, y1, x2, y2, w: 1.4, m: 'bone' }, { t: 'poly', pts: [[x2 - 2, y2], [x2 + 1, y2 - 1], [x2, y2 + 2]], m: 'blood' }]),
  ] },
  hellwalk: { name: 'Hellwalk', old: '🌋', s: [
    ...flame(4, 21, 8), ...flame(8, 21, 12), { t: 'poly', pts: [[1, 13], [5, 15], [2, 16]], m: 'fire' }, { t: 'poly', pts: [[3, 8], [8, 12], [4, 12]], m: 'fire' },
    { t: 'rect', x: 11, y: 4, w: 7, h: 12, m: 'stone', dark: -0.6 },
    { t: 'poly', pts: [[11, 15], [18, 15], [23, 17.5], [23, 21], [11, 21]], m: 'stone', dark: -0.6 },
    { t: 'rect', x: 10.5, y: 4, w: 8, h: 2.2, m: 'fire' },
    { t: 'rect', x: 10, y: 20, w: 14, h: 2.5, m: 'fire', dark: 1 },
    { t: 'px', pts: [[13, 9, 'O'], [15, 11, 'O'], [14, 13, 'O']] },
  ] },
  tempest: { name: 'Tempest', old: '🌩️', s: [
    { t: 'circle', x: 7, y: 7, r: 4.5, m: 'stone', dark: -0.5 }, { t: 'circle', x: 13, y: 5, r: 5, m: 'stone', dark: -0.5, seam: false }, { t: 'circle', x: 18.5, y: 8, r: 4, m: 'stone', dark: -0.5, seam: false },
    { t: 'rect', x: 3, y: 8, w: 18, h: 3.5, m: 'stone', seam: false },
    { t: 'sprite', x: 2, y: 12, rows: BOLT }, { t: 'sprite', x: 13, y: 13, rows: BOLT },
  ] },
  glacier: { name: 'Glacier', old: '🧊', s: [
    { t: 'poly', pts: [[0, 22], [6, 9], [10, 13], [15, 3], [24, 22]], m: 'ice', hi: 2 },
    { t: 'poly', pts: [[13, 7], [15, 3], [18, 9], [15, 10]], m: 'white', seam: false },
    { t: 'poly', pts: [[4.5, 12], [6, 9], [8, 12]], m: 'white', seam: false },
    { t: 'rect', x: 0, y: 20, w: 24, h: 3, m: 'ice', dark: 1.5 },
  ] },
  requiem: { name: 'Requiem Bell', old: '🛎️', s: [
    ...bellShape('stone'),
    { t: 'line', x1: 4, y1: 12, x2: 20, y2: 17, w: 1.4, m: 'green', seam: false },
    { t: 'line', x1: 6, y1: 17, x2: 18, y2: 9, w: 1.4, m: 'green', seam: false },
    { t: 'px', pts: [[7, 12, 'E'], [11, 14, 'E'], [16, 15, 'E'], [9, 14, 'e'], [14, 12, 'e'], [17, 10, 'E']] },
    { t: 'circle', x: 12, y: 14, r: 2, m: 'blood', hi: 1, seam: false },
  ] },
  eclipse: { name: 'Eclipse Scythe', old: '🌑', s: [
    { t: 'circle', x: 12, y: 12, r: 10.5, m: 'violet', dark: 1.5 },
    { t: 'circle', x: 15, y: 10, r: 8.5, m: 'stone', dark: 3, seam: false, nobevel: true },
    { t: 'ring', x: 12, y: 12, r: 10.5, w: 2.2, a0: 1.6, a1: 4.6, m: 'violet', seam: false, hi: 1 },
  ] },
  slegion: { name: 'Spirit Legion', old: '🕯️', s: [
    { t: 'sprite', x: 1, y: 8, rows: GHOST }, { t: 'sprite', x: 15, y: 8, rows: GHOST }, { t: 'sprite', x: 8, y: 2, rows: GHOST },
    { t: 'sprite', x: 8, y: 13, rows: GHOST },
  ] },
  ossuary: { name: 'Ossuary', old: '⚰️', s: [
    { t: 'poly', pts: [[2, 9], [22, 9], [20, 22], [4, 22]], m: 'wood' },
    { t: 'rect', x: 1, y: 7, w: 22, h: 3, m: 'wood', dark: 1 },
    skull(4, 1), skull(11, 0),
    ...bone(4, 16, 20, 16, 2),
  ] },
  judgement: { name: 'Judgement', old: '✨', s: [
    { t: 'poly', pts: star(12, 12, 12, 2.6, 4), m: 'gold', hi: 1 },
    { t: 'poly', pts: star(12, 12, 7, 1.8, 4, -Math.PI / 4), m: 'white', seam: false },
    { t: 'circle', x: 12, y: 12, r: 2.8, m: 'white', seam: false, hi: 1 },
  ] },
  barrow: { name: 'Barrow Host', old: '⚱️', s: [
    { t: 'circle', x: 12, y: 6, r: 6, m: 'green', dark: 1.4, nobevel: true },
    { t: 'poly', pts: [[7, 6], [17, 6], [16, 9], [20, 13], [18.5, 20], [5.5, 20], [4, 13], [8, 9]], m: 'stone', dark: -0.7, shade: 'round', hi: 1 },
    { t: 'rect', x: 6.5, y: 5, w: 11, h: 2, m: 'stone', dark: 0.5 },
    { t: 'rect', x: 5, y: 20, w: 14, h: 2.5, m: 'stone', dark: 1 },
    skull(8, 10),
    ...[[6, 5, 4, 1], [18, 5, 20, 1]].flatMap(([x1, y1, x2, y2]) => [{ t: 'line', x1, y1, x2, y2, w: 1.6, m: 'bone' }, { t: 'px', pts: [[x2 - 1, y2, 'w'], [x2 + 1, y2, 'w'], [x2, y2 - 1, 'w']] }]),
    { t: 'px', pts: [[10, 2, 'e'], [12, 1, 'e'], [14, 3, 'e']] },
  ] },
  wildhunt: { name: 'The Wild Hunt', old: '🐺', s: [
    { t: 'poly', pts: [[4, 10], [6, 1], [10, 7], [14, 7], [18, 1], [20, 10], [20, 15], [12, 23], [4, 15]], m: 'stone', dark: -1.5, shade: 'round', hi: 1 },
    { t: 'poly', pts: [[8, 15], [16, 15], [12, 22]], m: 'stone', dark: -2.5, seam: false },
    { t: 'px', pts: [[8, 11, 'y'], [9, 11, 'y'], [15, 11, 'y'], [16, 11, 'y'], [11, 16, 'k'], [12, 16, 'k'], [13, 16, 'k'], [10, 19, 'w'], [14, 19, 'w']] },
  ] },
  aegisns: { name: 'Aegis', old: '🔰', s: [
    { t: 'poly', pts: [[3, 2], [21, 2], [20, 13], [12, 23], [4, 13]], m: 'gold', hi: 1 },
    { t: 'poly', pts: [[5, 4], [19, 4], [18, 12.5], [12, 20.5], [6, 12.5]], m: 'ice', seam: false, hi: 2 },
    { t: 'poly', pts: star(12, 11, 5, 2, 4), m: 'white', seam: false },
  ] },
  nightblades: { name: 'Night Blades', old: '🌒', s: [
    { t: 'ring', x: 12, y: 12, r: 11, w: 3.5, a0: 2.2, a1: 5.0, m: 'violet', hi: 1 },
    { t: 'ring', x: 12, y: 12, r: 6.5, w: 2.5, a0: -0.9, a1: 1.9, m: 'steel', hi: 1 },
    { t: 'circle', x: 12, y: 12, r: 1.8, m: 'violet' },
  ] },
  deathmarch: { name: 'Death March', old: '🪦', s: [
    { t: 'poly', pts: [[5, 22], [5, 8], [7, 4], [12, 2], [17, 4], [19, 8], [19, 22]], m: 'stone', dark: -0.8, hi: 1 },
    { t: 'line', x1: 12, y1: 6, x2: 12, y2: 15, w: 2, m: 'stone', dark: 1.5, seam: false },
    { t: 'line', x1: 8.5, y1: 9, x2: 15.5, y2: 9, w: 2, m: 'stone', dark: 1.5, seam: false },
    { t: 'rect', x: 2, y: 20, w: 20, h: 3, m: 'green', dark: 1 },
    { t: 'px', pts: [[3, 19, 'E'], [6, 19, 'E'], [18, 19, 'E'], [21, 19, 'E']] },
  ] },
  sanctum: { name: 'Sanctum', old: '☀️', s: [
    { t: 'poly', pts: star(12, 12, 11.5, 7.5, 12, 0), m: 'gold', hi: 1 },
    { t: 'circle', x: 12, y: 12, r: 7, m: 'white', seam: false, hi: 2 },
    { t: 'rect', x: 11, y: 8, w: 2, h: 8, m: 'gold', seam: false }, { t: 'rect', x: 8, y: 11, w: 8, h: 2, m: 'gold', seam: false },
  ] },
  starfall: { name: 'Starfall', old: '🌠', s: [
    { t: 'line', x1: 2, y1: 22, x2: 14, y2: 10, w0: 0.8, w1: 4, m: 'ice', dark: -1, nobevel: true },
    { t: 'poly', pts: star(16, 8, 7.5, 3, 5), m: 'gold', hi: 2 },
    { t: 'poly', pts: star(5, 5, 2.5, 1, 4), m: 'white' },
  ] },
  singularity: { name: 'Singularity', old: '🕳️', s: [
    { t: 'circle', x: 12, y: 12, r: 11, m: 'violet', dark: 0.5 },
    { t: 'ring', x: 12, y: 12, r: 8.5, w: 1.6, a0: 0.4, a1: 3.3, m: 'violet', dark: -1, seam: false },
    { t: 'ring', x: 12, y: 12, r: 6, w: 1.4, a0: 3.6, a1: 6.2, m: 'violet', dark: -1, seam: false },
    { t: 'circle', x: 12, y: 12, r: 4, m: 'stone', dark: 3, seam: false, nobevel: true },
  ] },
  earthshatter: { name: 'Earthshatter', old: '⛰️', s: [
    { t: 'poly', pts: [[0, 21], [6, 7], [11, 12], [16, 3], [24, 21]], m: 'stone', dark: -1.6, hi: 1 },
    { t: 'poly', pts: [[13.5, 4.5], [16, 3], [18.5, 7], [16, 6.5]], m: 'white', seam: false },
    { t: 'poly', pts: [[10, 21], [12.5, 15], [10.5, 12.5], [14, 8], [13, 13.5], [15.5, 16], [13.5, 21]], m: 'fire', seam: false, hi: 1 },
    { t: 'rect', x: 0, y: 20, w: 24, h: 3, m: 'stone', dark: 0.5 },
    { t: 'poly', pts: [[3, 3], [5, 2], [5.5, 4.5], [3.5, 5]], m: 'stone', dark: -1 }, { t: 'poly', pts: [[20, 2], [22, 2.5], [21, 5]], m: 'stone', dark: -1 },
  ] },
  deathknell: { name: 'Death Knell', old: '🔕', s: [
    ...bellShape('gold'),
    { t: 'sprite', x: 9, y: 9, rows: SKULL_S },
    { t: 'line', x1: 3, y1: 3, x2: 21, y2: 21, w: 2, m: 'blood', seam: false },
  ] },
  revenant: { name: 'Revenant Guard', old: '⚔️', s: [...sword(3, 21, 20, 3, 'ice', 'stone'), ...sword(21, 21, 4, 3, 'ice', 'stone')] },
  // ---------------- blessings ----------------
  might: { name: 'Blessing of Might', old: '💪', s: [
    { t: 'rect', x: 5, y: 7, w: 14, h: 12, m: 'gold', hi: 2 },
    { t: 'poly', pts: [[5, 13], [2, 10], [3, 7], [7, 8]], m: 'gold', dark: 0.5 },
    ...[8.5, 12, 15.5].map((x) => ({ t: 'line', x1: x, y1: 7.5, x2: x, y2: 12, w: 1, m: 'gold', dark: 2, seam: false, nobevel: true })),
    { t: 'line', x1: 6, y1: 12.5, x2: 18, y2: 12.5, w: 1, m: 'gold', dark: 2, seam: false, nobevel: true },
    { t: 'rect', x: 7, y: 19, w: 10, h: 3.5, m: 'blood' },
    { t: 'poly', pts: star(20, 4, 3.5, 1.2, 4), m: 'white' },
  ] },
  quickening: { name: 'Blessing of Quickening', old: '🌀', s: [
    { t: 'ring', x: 12, y: 12, r: 10, w: 2.6, a0: 0, a1: 4.8, m: 'violet', hi: 1 },
    { t: 'ring', x: 12, y: 12, r: 6, w: 2.4, a0: 3, a1: 7.6, m: 'violet', dark: -0.6, seam: false },
    { t: 'circle', x: 12, y: 12, r: 2, m: 'white' },
  ] },
  bvigor: { name: 'Blessing of Vigor', old: '❤️', s: [
    heart(12, 13, 0.62, 'blood'),
    { t: 'poly', pts: star(18, 5, 4, 1.4, 4), m: 'gold' },
  ] },
  reach: { name: 'Blessing of Reach', old: '🌕', s: [
    { t: 'circle', x: 12, y: 12, r: 10, m: 'gold', hi: 2 },
    { t: 'circle', x: 9, y: 9, r: 2.2, m: 'gold', dark: 1.3, seam: false, nobevel: true }, { t: 'circle', x: 15, y: 14, r: 2.8, m: 'gold', dark: 1.3, seam: false, nobevel: true },
  ] },
  warding: { name: 'Blessing of Warding', old: '🛡️', s: [
    { t: 'poly', pts: [[3, 2], [21, 2], [20, 13], [12, 23], [4, 13]], m: 'white', hi: 1 },
    { t: 'poly', pts: star(12, 10, 6, 2.2, 4), m: 'gold', seam: false },
  ] },
  fleet: { name: 'Blessing of the Fleet', old: '🪶', s: [
    { t: 'poly', pts: [[3, 22], [9, 10], [17, 2], [21, 4], [16, 12], [8, 18]], m: 'white', shade: 'round', hi: 1 },
    { t: 'line', x1: 3, y1: 22, x2: 18, y2: 4, w: 1, m: 'bone', dark: 2, seam: false, nobevel: true },
  ] },
  greed: { name: 'Blessing of Greed', old: '💰', s: [
    { t: 'ellipse', x: 12, y: 15, rx: 9, ry: 7.5, m: 'wood', hi: 1 },
    { t: 'poly', pts: [[8, 5], [16, 5], [14, 8.5], [10, 8.5]], m: 'wood', dark: 0.6 },
    { t: 'rect', x: 9, y: 8, w: 6, h: 1.6, m: 'gold', seam: false },
    { t: 'sprite', x: 10, y: 12, rows: ['.yg.', 'gG..', '.gG.', '..gG', 'gGG.'] },
  ] },
  // ---------------- pacts ----------------
  hunger: { name: 'Pact of Hunger', old: '🍖', s: [
    { t: 'ellipse', x: 14, y: 10, rx: 8, ry: 7, m: 'blood', hi: 1 },
    { t: 'ellipse', x: 14, y: 10, rx: 5, ry: 4.4, m: 'blood', dark: -1, seam: false },
    ...bone(9, 15, 3, 21, 2.4),
  ] },
  haste: { name: 'Pact of Haste', old: '🐎', s: [
    { t: 'ring', x: 12, y: 11, r: 9.5, w: 4.2, a0: 2.4, a1: 7.0, m: 'steel', hi: 1 },
    { t: 'rect', x: 3, y: 15, w: 4.5, h: 4, m: 'steel', dark: 0.5 }, { t: 'rect', x: 16.5, y: 15, w: 4.5, h: 4, m: 'steel', dark: 0.5 },
    ...[[4.5, 10], [7, 5], [12, 3], [17, 5], [19.5, 10]].map(([x, y]) => ({ t: 'circle', x, y, r: 0.7, m: 'stone', dark: 3, seam: false, nobevel: true })),
    { t: 'poly', pts: [[9, 21], [12, 15], [15, 21], [12, 19]], m: 'blood', seam: false },
    { t: 'poly', pts: [[21, 3], [24, 1], [23, 6], [20, 7]], m: 'white' }, { t: 'poly', pts: [[21, 7], [24, 6], [22, 10], [19.5, 9]], m: 'white', dark: 0.5 },
  ] },
  throng: { name: 'Pact of the Throng', old: '👥', s: [
    skullS(2, 6), skullS(16, 6), skull(7, 3),
    { t: 'rect', x: 1, y: 13, w: 22, h: 10, m: 'stone', dark: -0.5 },
    { t: 'px', pts: [[5, 15, 'Z'], [12, 15, 'Z'], [19, 15, 'Z']] },
  ] },
  bloodpact: { name: 'Pact of Blood', old: '🩸', s: [
    { t: 'poly', pts: [[12, 1], [18.5, 11], [19, 15], [16, 20.5], [12, 22], [8, 20.5], [5, 15], [5.5, 11]], m: 'blood', shade: 'round', hi: 2 },
    skullS(9, 12),
  ] },
  fangs: { name: 'Pact of Fangs', old: '🐺', s: [
    { t: 'poly', pts: [[2, 4], [22, 4], [20, 9], [4, 9]], m: 'blood', dark: 0.5 },
    { t: 'poly', pts: [[4, 8], [8, 8], [6, 19]], m: 'bone', hi: 1 }, { t: 'poly', pts: [[16, 8], [20, 8], [18, 19]], m: 'bone', hi: 1 },
    ...[[9, 8], [11.5, 8], [14, 8]].map(([x, y]) => ({ t: 'poly', pts: [[x, y], [x + 2, y], [x + 1, y + 4]], m: 'bone' })),
    { t: 'poly', pts: [[2, 22], [22, 22], [20, 17], [4, 17]], m: 'blood', dark: 0.5 },
    ...[[9, 18], [12, 18]].map(([x, y]) => ({ t: 'poly', pts: [[x, y], [x + 2, y], [x + 1, y - 3]], m: 'bone' })),
  ] },
};
// The hand-drawn ones.
for (const id of ['fang', 'heart', 'ember', 'crown', 'tome', 'hourglass', 'chalice', 'phylactery', 'echo', 'mirror', 'lantern', 'scythe']) {
  const old = { fang: '🦷', heart: '🫀', ember: '🔥', crown: '👑', tome: '📕', hourglass: '⏳', chalice: '🍷', phylactery: '⚱️', echo: '🔔', mirror: '🛡️', lantern: '🏮', scythe: '🌙' }[id];
  RECIPES[id] = { name: ICONS[id].name.replace(' (Night Shift)', ''), old, px: ICONS[id].px };
}
var TITLE = 'All relic icons · 24×24 (old emoji on the left)';
var GROUPS = [
  ['Relics', ['fang', 'heart', 'whetstone', 'thorns', 'ember', 'frost', 'storm', 'bloom', 'dust', 'mark', 'lantern', 'crown', 'pact', 'whirl', 'pike', 'candle', 'hellfire', 'coin', 'dice', 'wildfire', 'shatter', 'conductor', 'mirror', 'phylactery', 'flask', 'harvest', 'echo', 'necro', 'caltrops', 'key', 'mask', 'tome', 'rosary', 'idol', 'hourglass', 'chalice', 'scale', 'wisp', 'doom', 'heretic', 'moon', 'headsman', 'grail', 'thunder', 'leech', 'glass', 'magnet', 'drum', 'spade', 'invitation', 'orbit', 'quiver']],
  ['Fusions', ['plasma', 'zero', 'vheart', 'aegis', 'reaper', 'pyre', 'eternal', 'fate', 'oath', 'lichbook', 'dragon', 'twinblade', 'suneater', 'bastion', 'immortal', 'wager', 'thousand', 'dracolich']],
  ['Abyss boons', ['edge', 'ward', 'veil', 'gravecandle', 'tithe', 'vigor', 'mend', 'dusk']],
  ['Night Shift relics (the rest share the icons above)', ['bell', 'scythe', 'wisps', 'spikes', 'lance', 'totem', 'hound', 'spectre', 'bulwark', 'knives', 'legion', 'nova', 'arrowrain', 'orb', 'slam', 'toll', 'boots', 'moss', 'lens', 'cloak']],
  ['Night Shift fusions', ['cleaver', 'halo', 'barrage', 'hellwalk', 'tempest', 'glacier', 'requiem', 'eclipse', 'slegion', 'ossuary', 'judgement', 'barrow', 'wildhunt', 'aegisns', 'nightblades', 'deathmarch', 'sanctum', 'starfall', 'singularity', 'earthshatter', 'deathknell', 'revenant']],
  ['Blessings and pacts', ['might', 'quickening', 'bvigor', 'reach', 'warding', 'fleet', 'greed', 'hunger', 'haste', 'throng', 'bloodpact', 'fangs']],
];
