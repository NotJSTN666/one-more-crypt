// Plays runs in the web game (src/game.ts), then replays the same inputs in the Luau
// port and checks both end in exactly the same state. Needs the `luau` CLI:
//   npx tsx roblox/tests/crosscheck.ts [path/to/luau] [runs]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEROES } from '../../src/content';
import { Game, W, fullPool, type Pos } from '../../src/game';
import { RELICS } from '../../src/relics';
import { hashSeed, mulberry32 } from '../../src/rng';
import { dailyNumber, msUntilNextDaily } from '../../src/daily';

const LUAU = process.argv[2] ?? 'luau';
const RUNS = Number(process.argv[3] ?? 400);
const SHARED = fileURLToPath(new URL('../src/shared', import.meta.url));
const DIRS: [number, number, string][] = [[0, -1, 'U'], [1, 0, 'R'], [0, 1, 'D'], [-1, 0, 'L']];

function summary(g: Game): string {
  const types = g.events.map((e) => e.t).join(',');
  return [
    g.floor, g.phase, g.player.hp, g.player.maxHp, g.player.x, g.player.y, g.kills, g.turns, g.atk,
    g.relicLog.join('+'), g.killedBy, g.stats.maxHit, g.stats.elites, g.enemies.length, g.events.length, hashSeed(types),
  ].join('|');
}

/** A greedy bot with some randomness, so runs wander through every system. */
function botInput(g: Game, rnd: () => number): string {
  if (g.phase === 'choose') {
    const n = g.offer!.relics.length;
    const i = Math.floor(rnd() * (n + 1));
    return i === n ? 'r' : String(i);
  }
  if (g.phase === 'event') {
    if (g.feature!.kind === 'forge') {
      const n = g.forgeOptions().length;
      return n && rnd() < 0.8 ? 'bcdefghijklm'[Math.floor(rnd() * n)] : 'x';
    }
    return rnd() < 0.6 ? 'a' : 'x';
  }
  if (rnd() < 0.15) return 'UDLRW'[Math.floor(rnd() * 5)];
  const p = g.player;
  for (const [dx, dy, ch] of DIRS) if (g.enemyAt(p.x + dx, p.y + dy)) return ch;
  const goals: Pos[] = g.stairsOpen ? [g.stairs] : g.alive.map((e) => ({ x: e.x, y: e.y }));
  const dist = g.distanceMap(goals.length ? goals : [g.stairs], false);
  let best = 'W';
  let bestD = Infinity;
  for (const [dx, dy, ch] of DIRS) {
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!g.inBounds(nx, ny) || g.isWall(nx, ny)) continue;
    const v = dist[ny * W + nx];
    if (v >= 0 && v < bestD) {
      bestD = v;
      best = ch;
    }
  }
  return best;
}

function feed(g: Game, ch: string) {
  const moves: Record<string, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
  if (moves[ch]) g.act(...moves[ch]);
  else if (ch === 'r') g.choose(-1);
  else if (ch === 'a' || ch === 'x') g.resolveEvent(ch === 'a');
  else if ('bcdefghijklm'.includes(ch)) g.forge('bcdefghijklm'.indexOf(ch));
  else g.choose(Number(ch));
}

const cases: string[] = [];
for (let i = 0; i < RUNS; i++) {
  const rnd = mulberry32(hashSeed('crosscheck', i));
  const seed = hashSeed('cryptfall-daily', i);
  const hero = HEROES[i % HEROES.length].id;
  const config = { hero, pool: fullPool(i % 9 === 0), forge: rnd() < 0.8, mercy: rnd() < 0.7 };
  const g = new Game('endless', seed, 0, config);
  // Half the runs start with a pile of relics so every effect gets exercised.
  const preload: string[] = [];
  if (i % 2 === 1) {
    for (let k = Math.floor(rnd() * 14); k > 0; k--) {
      const r = RELICS[Math.floor(rnd() * RELICS.length)];
      if (g.own(r.id) < r.maxStack) {
        g.addRelic(r.id);
        preload.push(r.id);
      }
    }
  }
  let inputs = '';
  for (let step = 0; step < 2500 && g.phase !== 'dead'; step++) {
    const ch = botInput(g, rnd);
    feed(g, ch);
    inputs += ch;
  }
  const q = (s: string) => JSON.stringify(s);
  cases.push(
    `{seed=${seed}, hero=${q(hero)}, legacy=${i % 9 === 0}, forge=${config.forge}, mercy=${config.mercy}, preload={${preload.map(q).join(',')}}, inputs=${q(inputs)}, expect=${q(summary(g))}}`,
  );
}

// Daily numbering around launch and across daylight-saving changes.
const times: string[] = [];
const trng = mulberry32(7);
for (let i = 0; i < 3000; i++) {
  const t = Math.floor(Date.UTC(2026, 0, 1) / 1000 + trng() * 3 * 365 * 86400);
  times.push(`{${t}, ${dailyNumber(t * 1000)}, ${msUntilNextDaily(t * 1000) / 1000}}`);
}
for (const iso of ['2026-11-01T06:59:59Z', '2026-11-01T07:00:00Z', '2027-03-14T07:59:59Z', '2027-03-14T08:00:00Z', '2026-10-14T05:00:00Z', '2026-10-14T04:59:59Z']) {
  const t = Date.parse(iso) / 1000;
  times.push(`{${t}, ${dailyNumber(t * 1000)}, ${msUntilNextDaily(t * 1000) / 1000}}`);
}

const modules = ['Rng', 'Relics', 'Content', 'Game', 'Daily'];
const bundled = modules
  .map((m) => {
    const src = readFileSync(join(SHARED, `${m}.luau`), 'utf8').replace(/^export type /gm, 'type ');
    return `__mods.${m} = function()\n${src}\nend`;
  })
  .join('\n');

const luau = `
Color3 = { fromRGB = function(r, g, b) return { r, g, b } end }
local __mods, __cache = {}, {}
local script = { Parent = setmetatable({}, { __index = function(_, k) return { __mod = k } end }) }
local function require(m)
  local name = m.__mod
  if __cache[name] == nil then __cache[name] = __mods[name]() end
  return __cache[name]
end
${bundled}
local Game = require(script.Parent.Game)
local Rng = require(script.Parent.Rng)
local function summary(g)
  local types = {}
  for _, e in g.events do table.insert(types, e.t) end
  local alive = 0
  return table.concat({
    g.floor, g.phase, g.player.hp, g.player.maxHp, g.player.x, g.player.y, g.kills, g.turns, g:atk(),
    table.concat(g.relicLog, "+"), g.killedBy, g.stats.maxHit, g.stats.elites, #g.enemies, #g.events,
    string.format("%d", Rng.hashSeed(table.concat(types, ","))),
  }, "|")
end
local cases = {
${cases.join(',\n')}
}
local bad = 0
for i, c in cases do
  local g = Game.new("endless", c.seed, 0, { hero = c.hero, pool = Game.fullPool(c.legacy), forge = c.forge, mercy = c.mercy })
  for _, id in c.preload do g:addRelic(id) end
  for k = 1, #c.inputs do g:input(string.sub(c.inputs, k, k)) end
  local got = summary(g)
  if got ~= c.expect then
    bad += 1
    if bad <= 5 then print("MISMATCH run " .. (i - 1) .. "\\n  web:  " .. c.expect .. "\\n  luau: " .. got) end
  end
end
local Daily = require(script.Parent.Daily)
local times = { ${times.join(',')} }
local badDays = 0
for _, t in times do
  local n, wait = Daily.number(t[1]), Daily.secondsUntilNext(t[1])
  if n ~= t[2] or wait ~= t[3] then
    badDays += 1
    if badDays <= 5 then print("DAILY MISMATCH at " .. t[1] .. ": web " .. t[2] .. "/" .. t[3] .. ", luau " .. n .. "/" .. wait) end
  end
end
print(string.format("%d/%d daily timestamps identical", #times - badDays, #times))
print(string.format("%d/%d runs identical", #cases - bad, #cases))
`;
const dir = mkdtempSync(join(tmpdir(), 'omc-'));
const file = join(dir, 'crosscheck.luau');
writeFileSync(file, luau);
const out = execFileSync(LUAU, [file], { encoding: 'utf8' });
process.stdout.write(out);
if (!/^(\d+)\/\1 runs identical/m.test(out) || !/^(\d+)\/\1 daily timestamps identical/m.test(out)) process.exit(1);
