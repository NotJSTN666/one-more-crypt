// Builds the relic icon atlas: every icon in recipes.js (24x24 pixel art, drawn by engine.js
// or hand-drawn in icons24.js) packed into one row, written to src/assets/relic-icons.png,
// with the order in src/relic-icon-index.ts. Run: node scripts/icons/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import vm from 'node:vm';

const here = new URL('.', import.meta.url);
const ctx = vm.createContext({ Math, Object, Array, Set });
for (const f of ['icons24.js', 'engine.js', 'recipes.js']) vm.runInContext(readFileSync(new URL(f, here), 'utf8'), ctx, { filename: f });
// `const` declarations stay inside the script, so fetch them by evaluating names.
const PAL = vm.runInContext('PAL', ctx);
const RECIPES = vm.runInContext('RECIPES', ctx);
const render = vm.runInContext('render', ctx);

// Which icon each thing in the game uses. m: main relics and fusions, b: Abyss boons,
// n: Night Shift relics, nf: Night Shift fusions, bl: blessings, p: pacts.
const MAP = {
  m: ['fang', 'heart', 'whetstone', 'thorns', 'ember', 'frost', 'storm', 'bloom', 'dust', 'mark', 'lantern', 'crown', 'pact', 'whirl', 'pike', 'candle', 'hellfire', 'coin', 'dice', 'wildfire', 'shatter', 'conductor', 'mirror', 'phylactery', 'flask', 'harvest', 'echo', 'necro', 'caltrops', 'key', 'mask', 'tome', 'rosary', 'idol', 'hourglass', 'chalice', 'scale', 'wisp', 'doom', 'heretic', 'moon', 'headsman', 'grail', 'thunder', 'leech', 'glass', 'magnet', 'drum', 'spade', 'invitation', 'orbit', 'quiver',
    'plasma', 'zero', 'vheart', 'aegis', 'reaper', 'pyre', 'eternal', 'fate', 'oath', 'lichbook', 'dragon', 'twinblade', 'suneater', 'bastion', 'immortal', 'wager', 'thousand', 'dracolich'],
  b: { edge: 'edge', ward: 'ward', veil: 'veil', candle: 'gravecandle', tithe: 'tithe', vigor: 'vigor', mend: 'mend', dusk: 'dusk' },
  n: { spade: 'spade', skulls: 'orbit', quiver: 'quiver', ember: 'ember', storm: 'storm', frost: 'frost', bell: 'bell', scythe: 'scythe', wisps: 'wisps', spikes: 'spikes', lance: 'lance', totem: 'totem', hound: 'hound', spectre: 'spectre', bulwark: 'bulwark', knives: 'knives', legion: 'legion', nova: 'nova', arrowrain: 'arrowrain', orb: 'orb', slam: 'slam', toll: 'toll', heart: 'heart', boots: 'boots', magnet: 'magnet', fang: 'fang', whetstone: 'whetstone', hourglass: 'hourglass', moss: 'moss', thorns: 'thorns', lens: 'lens', coin: 'coin', cloak: 'cloak' },
  nf: { cleaver: 'cleaver', halo: 'halo', barrage: 'barrage', hellwalk: 'hellwalk', tempest: 'tempest', glacier: 'glacier', requiem: 'requiem', eclipse: 'eclipse', legion: 'slegion', ossuary: 'ossuary', judgement: 'judgement', barrow: 'barrow', wildhunt: 'wildhunt', aegis: 'aegisns', nightblades: 'nightblades', deathmarch: 'deathmarch', sanctum: 'sanctum', starfall: 'starfall', singularity: 'singularity', earthshatter: 'earthshatter', deathknell: 'deathknell', revenant: 'revenant' },
  bl: { might: 'might', quickening: 'quickening', vigor: 'bvigor', reach: 'reach', warding: 'warding', fleet: 'fleet', greed: 'greed' },
  p: { hunger: 'hunger', haste: 'haste', throng: 'throng', blood: 'bloodpact', fangs: 'fangs' },
};

const cells = []; // recipe ids, in atlas order
const index = {};
for (const [ns, list] of Object.entries(MAP)) {
  const pairs = Array.isArray(list) ? list.map((id) => [id, id]) : Object.entries(list);
  for (const [id, recipe] of pairs) {
    if (!RECIPES[recipe]) throw new Error(`no icon for ${ns}:${id} (${recipe})`);
    let at = cells.indexOf(recipe);
    if (at < 0) at = cells.push(recipe) - 1;
    index[`${ns}:${id}`] = at;
  }
}

const S = 24;
const W = S * cells.length;
const px = Buffer.alloc(W * S * 4);
cells.forEach((id, i) => {
  const r = RECIPES[id];
  const rows = r.px ?? render(r.s);
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return;
    const hex = PAL[c];
    if (!hex) throw new Error(`${id}: no colour for '${c}'`);
    const o = (y * W + i * S + x) * 4;
    px[o] = parseInt(hex.slice(1, 3), 16);
    px[o + 1] = parseInt(hex.slice(3, 5), 16);
    px[o + 2] = parseInt(hex.slice(5, 7), 16);
    px[o + 3] = 255;
  }));
});

// a minimal PNG writer
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * S);
for (let y = 0; y < S; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(new URL('../../src/assets/relic-icons.png', here), png);
writeFileSync(new URL('../../src/relic-icon-index.ts', here), `// Generated by scripts/icons/build.mjs: where each icon sits in src/assets/relic-icons.png.\nexport const ICON_COUNT = ${cells.length};\nexport const ICON_INDEX: Record<string, number> = ${JSON.stringify(index)};\n`);
console.log(`${cells.length} icons, ${png.length} bytes`);
