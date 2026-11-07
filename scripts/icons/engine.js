// A small pixel-art renderer: an icon is a list of shapes with materials, drawn into a 24x24
// grid with light from the top left, a bevel on every shape, a dark line where a shape sits on
// another, and a dark outline round the whole. Uses the palette in icons24.js.
var RAMP = {
  bone: ['w', 'b', 'B', 'x'], blood: ['p', 'r', 'R', 'Q'], gold: ['y', 'g', 'G', 'H'],
  steel: ['a', 's', 'S', 'D', 'd'], ice: ['c', 'C', 'i', 'I'], fire: ['q', 'o', 'O', 'f'],
  violet: ['v', 'V', 'u', 'U'], green: ['e', 'E', 'F', 'j'], wood: ['m', 'n', 'N', 'M'],
  stone: ['t', 'Z', 'z', 'l'], white: ['h', 'w', 'b', 'B'], soul: ['h', 'e', 'E', 'F'],
  shadow: ['t', 'Z', 'z', 'l'],
};
var N = 24;
function inside(p, x, y) {
  const cx = x + 0.5, cy = y + 0.5;
  switch (p.t) {
    case 'rect': return cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h;
    case 'circle': return (cx - p.x) ** 2 + (cy - p.y) ** 2 <= p.r ** 2;
    case 'ellipse': return ((cx - p.x) / p.rx) ** 2 + ((cy - p.y) / p.ry) ** 2 <= 1;
    case 'ring': { const d = Math.hypot(cx - p.x, cy - p.y); if (d > p.r || d < p.r - (p.w ?? 2)) return false; if (p.a0 === undefined) return true; let a = Math.atan2(cy - p.y, cx - p.x); const tw = Math.PI * 2; const A0 = ((p.a0 % tw) + tw) % tw; a = ((a - A0) % tw + tw) % tw; return a <= p.a1 - p.a0; }
    case 'line': { const dx = p.x2 - p.x1, dy = p.y2 - p.y1; const L = dx * dx + dy * dy || 1; let u = ((cx - p.x1) * dx + (cy - p.y1) * dy) / L; u = Math.max(0, Math.min(1, u)); const w = p.w0 !== undefined ? p.w0 + (p.w1 - p.w0) * u : p.w; return Math.hypot(cx - (p.x1 + dx * u), cy - (p.y1 + dy * u)) <= w / 2; }
    case 'poly': { let c = false; const v = p.pts; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { if ((v[i][1] > cy) !== (v[j][1] > cy) && cx < ((v[j][0] - v[i][0]) * (cy - v[i][1])) / (v[j][1] - v[i][1]) + v[i][0]) c = !c; } return c; }
    case 'px': return false;
  }
  return false;
}
function render(shapes) {
  const g = Array.from({ length: N }, () => Array(N).fill(null)); // {c, id}
  const ids = Array.from({ length: N }, () => Array(N).fill(-1));
  shapes.forEach((p, id) => {
    if (p.t === 'px') {
      for (const [x, y, c] of p.pts) if (x >= 0 && y >= 0 && x < N && y < N) { g[y][x] = c; ids[y][x] = id; }
      return;
    }
    if (p.t === 'sprite') {
      p.rows.forEach((r, dy) => [...r].forEach((c, dx) => { const x = p.x + dx, y = p.y + dy; if (c !== '.' && x >= 0 && y >= 0 && x < N && y < N) { g[y][x] = c; ids[y][x] = id; } }));
      return;
    }
    const ramp = RAMP[p.m] || [p.m];
    const mask = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => inside(p, x, y)));
    let minx = N, miny = N, maxx = 0, maxy = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (mask[y][x]) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    const round = p.t === 'circle' || p.t === 'ellipse' || p.shade === 'round';
    const at = (x, y) => x >= 0 && y >= 0 && x < N && y < N && mask[y][x];
    let best = null;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!mask[y][x]) continue;
      let lum;
      if (round) {
        const cx = p.x ?? (minx + maxx + 1) / 2, cy = p.y ?? (miny + maxy + 1) / 2;
        const rx = p.rx ?? p.r ?? (maxx - minx + 1) / 2, ry = p.ry ?? p.r ?? (maxy - miny + 1) / 2;
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        lum = Math.max(0, Math.min(1, 0.15 + 0.85 * (-0.5 * nx - 0.6 * ny + 0.62 * nz)));
      } else {
        const u = (x - minx) / Math.max(1, maxx - minx), v = (y - miny) / Math.max(1, maxy - miny);
        lum = p.flat ? 0.7 : 0.82 - 0.42 * (0.45 * u + 0.55 * v);
      }
      let i = Math.round((1 - lum) * (ramp.length - 1) + (p.dark ?? 0));
      // a bevel: lit on the top-left edge, shaded on the bottom-right
      if (!p.nobevel) {
        if (!at(x - 1, y) || !at(x, y - 1)) i -= 1;
        if (!at(x + 1, y) || !at(x, y + 1)) i += 1;
      }
      i = Math.max(0, Math.min(ramp.length - 1, i));
      g[y][x] = ramp[i];
      ids[y][x] = id;
      if (!best || lum > best.lum) best = { x, y, lum };
    }
    // a dark seam where this shape sits on one already drawn
    if (p.seam !== false) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (mask[y][x] || ids[y][x] < 0 || ids[y][x] === id) continue;
        if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) g[y][x] = 'l';
      }
    }
    if (p.hi && best) { g[best.y][best.x] = 'h'; if (p.hi > 1 && best.x + 1 < N && mask[best.y][best.x + 1]) g[best.y][best.x + 1] = 'h'; }
  });
  // the outline round everything
  const out = g.map((r) => r.slice());
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x]) continue;
    const n = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'k'; };
    if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) out[y][x] = 'k';
  }
  return out.map((r) => r.map((c) => c || '.').join(''));
}
if (typeof module !== 'undefined') module.exports = { render, RAMP };
