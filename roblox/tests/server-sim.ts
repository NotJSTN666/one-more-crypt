// Runs the Roblox server script under the Luau CLI with mocked Roblox services, and
// drives it like a client would: daily attempt, death, Souls, leaderboard, resume.
//   npx tsx roblox/tests/server-sim.ts [path/to/luau]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LUAU = process.argv[2] ?? 'luau';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/^export type /gm, 'type ');
const modules = ['Rng', 'Relics', 'Content', 'Game', 'Daily', 'Sprites', 'Store'];

const luau = `
local function signal()
  local s = { fns = {} }
  function s:Connect(fn) table.insert(self.fns, fn); return { Disconnect = function() end } end
  function s:Fire(...) for _, fn in self.fns do fn(...) end end
  return s
end
Color3 = { fromRGB = function(r, g, b) return { r, g, b } end, fromHex = function(h) return h end }
-- task.spawn runs at once; task.wait inside a spawned task parks it until pump() resumes it.
local sleepers = {}
task = {
  spawn = function(fn, ...) local co = coroutine.create(fn); local ok, err = coroutine.resume(co, ...); if not ok then error(err) end end,
  wait = function() if coroutine.isyieldable() then table.insert(sleepers, (coroutine.running())); coroutine.yield() end end,
  delay = function() end,
}
local function pump(n)
  for _ = 1, n do
    local list = sleepers
    sleepers = {}
    for _, co in list do local ok, err = coroutine.resume(co); if not ok then error(err) end end
  end
end
Random = { new = function() return { NextInteger = function(_, a, b) return a + (os.clock() * 1e6) % (b - a + 1) // 1 end } end }

local __mods, __cache = {}, {}
local function load(name)
  if __cache[name] == nil then __cache[name] = __mods[name]() end
  return __cache[name]
end
local function require(m) return load(m.__mod) end
local function folder(prefix)
  return setmetatable({}, { __index = function(_, k) return { __mod = k } end })
end
local script = { Parent = folder() }
${modules.map((m) => `__mods.${m} = function()\n${read(`src/shared/${m}.luau`)}\nend`).join('\n')}

-- ---------- mocked services ----------
local stores = {}
local function store(name, ordered)
  stores[name] = stores[name] or { data = {} }
  local s = stores[name]
  return {
    GetAsync = function(_, k) return s.data[k] end,
    SetAsync = function(_, k, v) s.data[k] = v end,
    UpdateAsync = function(_, k, fn) local v = fn(s.data[k]); if v ~= nil then s.data[k] = v end end,
    GetSortedAsync = function(_, asc, n)
      local rows = {}
      for k, v in s.data do table.insert(rows, { key = k, value = v }) end
      table.sort(rows, function(a, b) return a.value > b.value end)
      return { GetCurrentPage = function() return rows end }
    end,
  }
end
Enum = {
  ProductPurchaseDecision = { PurchaseGranted = "granted", NotProcessedYet = "notyet" },
  MembershipType = { Premium = "premium", None = "none" },
}
local ownedPasses = {}
local passFinished = signal()
local MarketplaceService = {
  PromptGamePassPurchaseFinished = passFinished,
  UserOwnsGamePassAsync = function(_, userId, passId) return ownedPasses[passId] == true end,
}
local pushed = {}
local playerAdded, playerRemoving = signal(), signal()
local playerList = {}
local Players = {
  CharacterAutoLoads = true,
  PlayerAdded = playerAdded, PlayerRemoving = playerRemoving,
  GetPlayers = function() return playerList end,
  GetNameFromUserIdAsync = function(_, id) return "Player" .. id end,
  GetPlayerByUserId = function(_, id) for _, p in playerList do if p.UserId == id then return p end end return nil end,
}
local shared = folder()
local remote
local services = {
  Players = Players,
  ReplicatedStorage = { WaitForChild = function() return shared end },
  DataStoreService = {
    GetDataStore = function(_, n) return store(n) end,
    GetOrderedDataStore = function(_, n) return store(n, true) end,
  },
  RunService = { IsStudio = function() return false end },
  MarketplaceService = MarketplaceService,
}
game = { GetService = function(_, n) return services[n] end, BindToClose = function() end }
Instance = { new = function(class)
  local inst = { ClassName = class }
  if class == "RemoteFunction" then remote = inst end
  if class == "RemoteEvent" then inst.FireClient = function(_, _, msg) table.insert(pushed, msg) end end
  return inst
end }

-- Each call moves the clock a second on, so the input rate limit never trips.
local fakeClock = 0
local os = setmetatable({ clock = function() fakeClock += 1; return fakeClock end }, { __index = os })

-- Pretend the creator has set up the store.
local Store = load("Store")
for i, p in Store.PASSES do p.id = 1000 + i end
for i, p in Store.PRODUCTS do p.id = 2000 + i end
ownedPasses[1003] = true -- already owns the Soulfire Aura

local function serverMain()
${read('src/server/CryptServer.server.luau').replace(/^--!nonstrict/, '')}
end
serverMain()

-- ---------- drive it ----------
local Game = load("Game")
local Daily = load("Daily")
local fails = 0
local function check(cond, msg)
  if not cond then fails += 1; print("FAIL: " .. msg) else print("ok   " .. msg) end
end
local alice = { UserId = 1, Name = "alice", Parent = true, MembershipType = "premium" }
table.insert(playerList, alice)
playerAdded:Fire(alice)
local function invoke(req) return remote.OnServerInvoke(alice, req) end

check(Players.CharacterAutoLoads == false, "avatars are turned off")
local p = invoke({ op = "profile" }).profile
check(p.souls == 0 and p.daily.number == Daily.number() and p.online, "fresh profile with today's daily")

local res = invoke({ op = "start", mode = "daily" })
check(res.state and res.state.floor == 1 and res.state.mode == "daily", "daily run starts on floor 1")
local seedGame = Game.new("daily", load("Rng").hashSeed("cryptfall-daily", Daily.number()), Daily.number(), nil)
check(#res.state.walls == (function() local n = 0 for i = 0, 48 do if seedGame.walls[i] then n += 1 end end return n end)(), "daily layout uses the shared daily seed")

-- Walk a few steps, leave, and resume: the run must come back exactly.
local function step(ch) return invoke({ op = "input", ch = ch }) end
for _, ch in { "U", "U", "L", "W", "R" } do res = step(ch) end
local before = res.state
invoke({ op = "leave" })
check(invoke({ op = "profile" }).profile.daily.resumable, "a daily left mid-run can be resumed")
playerRemoving:Fire(alice)
playerAdded:Fire(alice)
res = invoke({ op = "start", mode = "daily" })
check(res.state.turns == before.turns and res.state.x == before.x and res.state.hp == before.hp and #res.state.enemies == #before.enemies, "resume after rejoining rebuilds the same run")

-- Play to the death with a simple bot.
local guard = 0
local lcg = 42
while res.state.phase ~= "dead" and guard < 5000 do
  guard += 1
  local s = res.state
  local ch = "W"
  if s.phase == "choose" then ch = "0"
  elseif s.phase == "event" then ch = "x"
  else
    local dirs = { { 0, -1, "U" }, { 1, 0, "R" }, { 0, 1, "D" }, { -1, 0, "L" } }
    local target = nil
    for _, e in s.enemies do if not e.ally then target = e break end end
    if not target and s.stairsOpen then target = s.stairs end
    if target then
      local dx, dy = target.x - s.x, target.y - s.y
      if math.abs(dx) >= math.abs(dy) and dx ~= 0 then ch = if dx > 0 then "R" else "L"
      elseif dy ~= 0 then ch = if dy > 0 then "D" else "U" end
    end
    lcg = (lcg * 75 + 74) % 65537
    if lcg % 2 == 0 then ch = dirs[(lcg // 2) % 4 + 1][3] end
  end
  res = step(ch)
end
check(res.state.phase == "dead" and res.result ~= nil, "the run ends with a result")
check(res.result.souls > 0 and #res.result.lines >= 3, "souls are paid out with a daily bonus line")
check(res.result.board and #res.result.board == 1 and res.result.board[1].name == "Player1", "the daily leaderboard has the run")
p = invoke({ op = "profile" }).profile
check(p.souls == res.result.souls and p.daily.played == res.state.floor and not p.daily.resumable, "profile records souls and today's depth")
res = invoke({ op = "start", mode = "daily" })
check(res.error ~= nil, "only one official daily attempt")
check(step("U").error == "no run", "inputs without a run are refused")
check(invoke({ op = "input", ch = "Z" }).error ~= nil, "unknown inputs are refused")

-- Ossuary and Endless.
check(invoke({ op = "buyHero", id = "barbarian" }).profile.heroes[7].owned == (p.souls >= 450), "heroes cost souls")
local rich = stores["OneMoreCrypt_Profiles_v1"]
res = invoke({ op = "start", mode = "endless", hero = "mage" })
check(res.state.hero == "knight", "locked heroes can't be picked for Endless")
for i = 1, 6 do res = step("W") end
invoke({ op = "leave" })
res = invoke({ op = "start", mode = "endless", hero = "resume" })
check(res.state.turns == 6, "Endless runs resume too")
local saved = rich.data["u1"]
check(saved and saved.souls == invoke({ op = "profile" }).profile.souls, "profile is saved to the DataStore")
-- ---------- the store ----------
p = invoke({ op = "profile" }).profile
check(p.cosmetics.aura and not p.cosmetics.crown, "owned passes are found on join")
local soulsBefore = p.souls
local receipt = { PlayerId = 1, ProductId = 2002, PurchaseId = "r-1" }
check(MarketplaceService.ProcessReceipt(receipt) == "granted", "a Soul pack purchase is granted")
check(MarketplaceService.ProcessReceipt(receipt) == "granted", "a retried receipt is acknowledged")
p = invoke({ op = "profile" }).profile
check(p.souls == soulsBefore + 800, "a receipt pays out exactly once")
check(pushed[#pushed].kind == "souls" and pushed[#pushed].amount == 800, "the client is told about the Souls")
check(stores["OneMoreCrypt_Profiles_v1"].data["u1"].souls == p.souls, "Souls from a purchase are saved before granting")
check(MarketplaceService.ProcessReceipt({ PlayerId = 99, ProductId = 2001, PurchaseId = "r-2" }) == "notyet", "a receipt for someone not here waits")
check(invoke({ op = "pickCloak", key = "void" }).profile.cosmetics.cloak == "", "cloaks need the Cloak Collection")
passFinished:Fire(alice, 1002, true)
check(invoke({ op = "pickCloak", key = "void" }).profile.cosmetics.cloak == "void", "buying the Cloak Collection unlocks cloaks at once")
passFinished:Fire(alice, 1001, true)
-- A quick Endless death to see the Souls lines.
res = invoke({ op = "start", mode = "endless" })
guard = 0
while res.state.phase ~= "dead" and guard < 20000 do
  guard += 1
  local s = res.state
  if s.phase == "choose" then res = step("0")
  elseif s.phase == "event" then res = step("x")
  else
    lcg = (lcg * 75 + 74) % 65537
    res = step(({ "U", "D", "L", "R" })[lcg % 4 + 1])
  end
end
local labels = {}
for _, l in res.result.lines do labels[l.label] = l.souls end
check(labels["Grave Robber 2×"] ~= nil and labels["Premium bonus"] ~= nil, "Grave Robber doubles Souls and Premium adds a bonus")
check(res.result.upsell == false, "no Grave Robber upsell once it's owned")
-- ---------- the Crypt Race ----------
local bob = { UserId = 2, Name = "bob", DisplayName = "Bob", Parent = true, MembershipType = "none" }
table.insert(playerList, bob)
playerAdded:Fire(bob)
local function as(who, req) return remote.OnServerInvoke(who, req) end
local function lastPush(who, kind)
  for i = #pushed, 1, -1 do if pushed[i].kind == kind then return pushed[i] end end
  return nil
end
table.clear(pushed)
local r1 = as(alice, { op = "raceJoin" }).race
check(r1.joined and r1.count == 1 and r1.phase == "lobby", "first racer waits in the lobby")
as(bob, { op = "raceJoin" })
pump(1)
check(lastPush(alice, "race").race.phase == "countdown", "two racers start the countdown")
local guardRace = 0
while not lastPush(alice, "raceStart") and guardRace < 100 do pump(1); guardRace += 1 end
local starts = {}
for _, m in pushed do if m.kind == "raceStart" then table.insert(starts, m) end end
check(#starts == 2, "both racers get a starting board")
check(#starts == 2 and table.concat(starts[1].state.walls, ",") == table.concat(starts[2].state.walls, ",") and starts[1].state.hero == starts[2].state.hero, "both race the same crypt with the same hero")
local savedBefore = invoke({ op = "profile" }).profile.endlessResumable
for _, ch in { "U", "U", "L" } do as(alice, { op = "input", ch = ch }) end
local st = lastPush(alice, "race")
pump(1)
st = lastPush(alice, "race").race
local mine = nil
for _, row in st.standings do if row.name == "alice" then mine = row end end
check(mine ~= nil and mine.floor >= 1 and mine.alive, "standings track each racer")
playerRemoving:Fire(alice); playerAdded:Fire(alice)
check(invoke({ op = "profile" }).profile.endlessResumable == savedBefore, "a race never replaces a saved run")
-- alice dropped out by rejoining; re-add her to the race state check: bob races on alone until time.
local soulsBob = as(bob, { op = "profile" }).profile.souls
guardRace = 0
while not lastPush(bob, "raceEnd") and guardRace < 2000 do pump(1); guardRace += 1 end
local ended = lastPush(bob, "raceEnd")
check(ended ~= nil, "the race ends when the timer runs out")
check(ended and ended.you.total > 0 and as(bob, { op = "profile" }).profile.souls == soulsBob + ended.you.total, "racers are paid Souls when the race ends")
check(ended and ended.race.results[1].name == "Bob", "results rank the racers")
check(as(bob, { op = "input", ch = "U" }).error == "no run", "the race board closes at the end")
guardRace = 0
while lastPush(bob, "race").race.phase ~= "lobby" and guardRace < 500 do pump(1); guardRace += 1 end
check(lastPush(bob, "race").race.phase == "lobby", "the lobby reopens after the results")

-- A contested finish pays prizes.
table.clear(pushed)
as(alice, { op = "raceJoin" }); as(bob, { op = "raceJoin" })
guardRace = 0
while not lastPush(alice, "raceStart") and guardRace < 200 do pump(1); guardRace += 1 end
as(alice, { op = "input", ch = "U" })
guardRace = 0
while not lastPush(alice, "raceEnd") and guardRace < 2000 do pump(1); guardRace += 1 end
local winners = 0
for _, m in pushed do
  if m.kind == "raceEnd" then for _, l in m.you.lines do if string.find(l.label, "Race winner") then winners += 1 end end end
end
check(winners == 1, "exactly one racer gets the winner's prize")
print(if fails == 0 then "server sim: all checks passed" else ("server sim: " .. fails .. " failed"))
`;
const dir = mkdtempSync(join(tmpdir(), 'omc-'));
const file = join(dir, 'server-sim.luau');
writeFileSync(file, luau);
let out = '';
try {
  out = execFileSync(LUAU, [file], { encoding: 'utf8' });
} catch (e: any) {
  out = (e.stdout ?? '') + (e.stderr ?? '');
}
process.stdout.write(out);
if (!out.includes('all checks passed')) process.exit(1);
