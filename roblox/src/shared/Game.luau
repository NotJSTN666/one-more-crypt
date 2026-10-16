--!nonstrict
-- Pure game logic, a line-by-line port of src/game.ts: no rendering, no Roblox
-- services. Everything random is seeded, so the same seed and inputs give the same
-- run as the web game (the daily crypt is the same crypt on both).

local Rng = require(script.Parent.Rng)
local Relics = require(script.Parent.Relics)
local Content = require(script.Parent.Content)

local mulberry32, hashSeed, randInt, weightedPick = Rng.mulberry32, Rng.hashSeed, Rng.randInt, Rng.weightedPick
local RELICS, BY_ID, FUSIONS = Relics.RELICS, Relics.BY_ID, Relics.FUSIONS
local contains = Relics.contains

local W, H = 7, 7

local Game = {}
Game.__index = Game
Game.W = W
Game.H = H

Game.ENEMY_INFO = {
	ghoul = { name = "Ghoul", hp = 2, dmg = 1 },
	bat = { name = "Blood Bat", hp = 1, dmg = 1 },
	archer = { name = "Skeleton Archer", hp = 1, dmg = 2 },
	brute = { name = "Grave Brute", hp = 4, dmg = 3 },
	wraith = { name = "Wraith", hp = 2, dmg = 1 },
	boss = { name = "The Bone Warden", hp = 10, dmg = 2 },
	abbot = { name = "The Plague Abbot", hp = 16, dmg = 2 },
	lich = { name = "The Lich King", hp = 22, dmg = 3 },
	thrall = { name = "Thrall", hp = 2, dmg = 1 },
}
local ENEMY_INFO = Game.ENEMY_INFO

local BOSS_KINDS = { "boss", "abbot", "lich" }
Game.UNDEAD = { "ghoul", "archer", "brute", "wraith", "boss", "lich" }
local UNDEAD = Game.UNDEAD
local FLYING = { "bat", "wraith" }

local function isBoss(e): boolean
	return contains(BOSS_KINDS, e.kind)
end
Game.isBoss = isBoss

local DIRS = {
	{ x = 0, y = -1 },
	{ x = 1, y = 0 },
	{ x = 0, y = 1 },
	{ x = -1, y = 0 },
}
local DIRS8 = { DIRS[1], DIRS[2], DIRS[3], DIRS[4], { x = 1, y = 1 }, { x = 1, y = -1 }, { x = -1, y = 1 }, { x = -1, y = -1 } }

Game.START = { x = 3, y = 6 }
local START = Game.START
local POTION_HEAL = 3
local REST_HEAL = 4
local MAX_ENEMIES = 9
local MAX_THRALLS = 3
local MAX_HP_CAP = 99
local ABYSS_FLOOR = 30
local FORGE_KEYS = "bcdefghijklm"
local BOW_RANGE = 3

local function filter<T>(list: { T }, pred: (T) -> boolean): { T }
	local out = {}
	for _, v in list do
		if pred(v) then
			table.insert(out, v)
		end
	end
	return out
end

local function sign(n: number): number
	return if n > 0 then 1 elseif n < 0 then -1 else 0
end

--- Every relic. `legacy` limits it to the launch set (Daily #1).
function Game.fullPool(legacy: boolean?): { string }
	local out = {}
	for _, r in RELICS do
		if not legacy or contains(Relics.LEGACY, r.id) then
			table.insert(out, r.id)
		end
	end
	return out
end

--- Endless: every relic except the forbidden ones not yet unlocked.
function Game.basePool(unlocked: { string }?, legacy: boolean?): { string }
	local have = unlocked or {}
	return filter(Game.fullPool(legacy), function(id)
		return not contains(Relics.UNLOCKABLE, id) or contains(have, id)
	end)
end

function Game.new(mode: string, seed: number, dailyNo: number?, config)
	local self = setmetatable({}, Game)
	self.mode = mode
	self.seed = seed
	self.dailyNo = dailyNo or 0
	self.config = config or { hero = "knight", pool = Game.fullPool() }

	self.floor = 0
	self.walls = {}
	self.spikes = {}
	self.stairs = { x = 3, y = 0 }
	self.stairsOpen = false
	self.potion = nil
	self.feature = nil
	self.warnings = {}
	self.enemies = {}
	self.player = { x = START.x, y = START.y, hp = 10, maxHp = 10 }
	self.relics = {}
	self.relicLog = {}
	self.phase = "play"
	self.offer = nil
	self.kills = 0
	self.turns = 0
	self.killedBy = ""
	self.stats = {
		elites = 0, bosses = {}, spikeKills = 0, maxKillsInTurn = 0, maxHit = 0, cleanFloors = 0, maxAllies = 0,
		bossAtOneHp = false, arrowKills = 0, revived = false, turnsTo5 = 0, kinds = {}, fusions = 0,
		shadowSteps = 0, dodges = 0, raised = 0, lowHpKills = 0,
	}
	self.log = ""
	self.events = {}

	self.harvestBonus = 0
	self.shieldCharges = 0
	self.phylacteryUsed = false
	self.nextId = 1
	self.steps = 0
	self.attacks = 0
	self.killsThisTurn = 0
	self.hurtThisFloor = false
	self.combat = mulberry32(hashSeed(seed, "combat"))
	self.boost = {}

	local hp = Content.HERO_BY_ID[self.config.hero].hp
	self.player.hp = hp
	self.player.maxHp = hp
	self:enterFloor(1)
	return self
end

-- ---------- queries ----------

function Game:r(id: string): number
	return (self.relics[id] or 0) + (self.boost[id] or 0)
end

function Game:own(id: string): number
	return self.relics[id] or 0
end

function Game:hero(): string
	return self.config.hero
end

function Game:atk(): number
	local atk = 1 + self:r("whetstone") + 2 * self:r("crown") + self.harvestBonus
	local missing = self.player.maxHp - self.player.hp
	if self.config.hero == "barbarian" then
		atk += math.floor(missing / 3)
	end
	if self.config.hero == "mage" then
		atk += 2
	end
	if self:r("idol") > 0 and self.player.hp * 2 <= self.player.maxHp then
		atk += self:r("idol")
	end
	return atk
end

function Game:shadowReady(): boolean
	return self.config.hero == "rogue" and (self.steps + 1) % 3 == 0
end

function Game:isWall(x: number, y: number): boolean
	return self.walls[y * W + x] == true
end

function Game:isSpike(x: number, y: number): boolean
	return self.spikes[y * W + x] == true
end

function Game:inBounds(x: number, y: number): boolean
	return x >= 0 and y >= 0 and x < W and y < H
end

function Game:enemyAt(x: number, y: number)
	for _, e in self.enemies do
		if not e.dead and not e.ally and e.x == x and e.y == y then
			return e
		end
	end
	return nil
end

function Game:unitAt(x: number, y: number)
	for _, e in self.enemies do
		if not e.dead and e.x == x and e.y == y then
			return e
		end
	end
	return nil
end

function Game:alive()
	return filter(self.enemies, function(e)
		return not e.dead and not e.ally
	end)
end

function Game:allies()
	return filter(self.enemies, function(e)
		return not e.dead and e.ally
	end)
end

function Game:isOver(): boolean
	return self.phase == "dead"
end

function Game:isBossFloor(f: number?): boolean
	return (f or self.floor) % 5 == 0
end

function Game:push(ev)
	table.insert(self.events, ev)
end

-- ---------- floor generation ----------

function Game:enterFloor(floor: number)
	self.floor = floor
	local rng = mulberry32(hashSeed(self.seed, "floor", floor))
	self:generateLayout(rng)
	local thralls = self:allies()
	self.enemies = {}
	self.spikes = {}
	self.potion = nil
	self.feature = nil
	self.warnings = {}
	self:spawnEnemies(rng)
	self:placeTraps(rng)
	if not self:isBossFloor() and floor > 1 and rng() < 0.4 then
		local spot = self:randomFreeTile(rng, 2)
		if spot then
			self.potion = spot
		end
	end
	if not self:isBossFloor() and floor > 1 and rng() < 0.35 then
		local kind = weightedPick(rng, { "shrine", "chest", "fountain" }, function(k)
			return if k == "fountain" then 2 else 4
		end)
		local spot = self:randomFreeTile(rng, 2)
		if spot then
			self.feature = { x = spot.x, y = spot.y, kind = kind, used = false }
		end
	end
	-- The Soul Forge waits on the floor after each boss, in place of any other feature.
	if self.config.forge and floor > 5 and floor % 5 == 1 then
		self.feature = nil
		local spot = self:randomFreeTile(mulberry32(hashSeed(self.seed, "forge", floor)), 2)
		if spot then
			self.feature = { x = spot.x, y = spot.y, kind = "forge", used = false }
		end
	end
	self.player.x = START.x
	self.player.y = START.y
	self:placeThralls(thralls)
	self.stairsOpen = false
	self.harvestBonus = 0
	self.hurtThisFloor = false
	self.shieldCharges = self:r("mirror")
	self:push({ t = "floor", floor = floor })
	if floor == 5 and self.stats.turnsTo5 == 0 then
		self.stats.turnsTo5 = self.turns
	end

	if self:r("vheart") > 0 and self:isBossFloor() then
		self.phylacteryUsed = false
	end
	if self.config.hero == "knight" and floor > 1 then
		self:heal(1)
	end
	local candle = self:r("candle")
	if candle > 0 then
		self:heal(candle * 2)
	end
	if self:r("tome") > 0 and floor % 3 == 0 then
		local gift = self:randomRelic(mulberry32(hashSeed(self.seed, "tome", floor)), function()
			return true
		end)
		if gift then
			self:addRelic(gift.id)
		end
	end
	local hell = self:r("hellfire")
	if hell > 0 then
		for _, e in self:alive() do
			self:damageEnemy(e, hell * 2, "hellfire")
		end
		if self.player.hp > 1 then
			self.player.hp -= 1
			self:push({ t = "hurt", amount = 1 })
		end
		self:checkCleared()
	end
end

function Game:generateLayout(rng)
	for _ = 1, 200 do
		self.walls = {}
		self.stairs = { x = randInt(rng, 1, W - 2), y = randInt(rng, 0, 1) }
		local count = randInt(rng, 4, 9)
		local mirror = rng() < 0.5
		for _ = 1, count do
			local x = randInt(rng, 0, W - 1)
			local y = randInt(rng, 1, H - 2)
			self.walls[y * W + x] = true
			if mirror then
				self.walls[y * W + (W - 1 - x)] = true
			end
		end
		self.walls[START.y * W + START.x] = nil
		self.walls[self.stairs.y * W + self.stairs.x] = nil
		if self:allFloorConnected() then
			return
		end
	end
	self.walls = {}
end

function Game:allFloorConnected(): boolean
	local dist = self:distanceMap({ START }, false)
	for i = 0, W * H - 1 do
		if not self.walls[i] and dist[i] < 0 then
			return false
		end
	end
	return true
end

function Game:spawnEnemies(rng)
	local f = self.floor
	if self:isBossFloor() then
		local tier = f // 5
		local kind = BOSS_KINDS[(tier - 1) % 3 + 1]
		local cycle = (tier - 1) // 3
		local spot = { x = 3, y = 1 }
		self.walls[spot.y * W + spot.x] = nil
		local boss = self:makeEnemy(kind, spot.x, spot.y)
		boss.hp = ENEMY_INFO[kind].hp + 12 * cycle + 4 * cycle * cycle
		boss.maxHp = boss.hp
		boss.dmg = ENEMY_INFO[kind].dmg + cycle
		for i = 0, math.min(tier, 4) - 1 do
			local s = self:randomFreeTile(rng, 3)
			if s then
				self:makeEnemy(if i % 2 == 1 then "archer" else "ghoul", s.x, s.y)
			end
		end
		return
	end
	local roster = {
		{ kind = "ghoul", from = 1, w = 10 },
		{ kind = "bat", from = 1, w = 7 },
		{ kind = "archer", from = 2, w = 6 },
		{ kind = "brute", from = if self.config.mercy then 4 else 3, w = 4 },
		{ kind = "wraith", from = 4, w = 5 },
	}
	local pool = filter(roster, function(p)
		return f >= p.from
	end)
	local count = math.min(MAX_ENEMIES - 1, 2 + math.floor(f / 2))
	local eliteChance = if f >= 3 then math.min(0.35, 0.06 + 0.025 * f) else 0
	for _ = 1, count do
		local spot = self:randomFreeTile(rng, 3)
		if not spot then
			break
		end
		local kind = weightedPick(rng, pool, function(p)
			return p.w
		end).kind
		local e = self:makeEnemy(kind, spot.x, spot.y)
		if rng() < eliteChance then
			self:makeElite(e, Content.ELITE_MODS[math.floor(rng() * #Content.ELITE_MODS) + 1])
		end
	end
end

function Game:makeElite(e, mod: string)
	e.elite = mod
	e.hp += 1
	e.maxHp += 1
	if mod == "shielded" then
		e.shield = 1
	end
end

function Game:placeTraps(rng)
	if self.floor < 2 or self:isBossFloor() then
		return
	end
	local count = math.min(3, randInt(rng, 0, 1 + math.floor(self.floor / 4)))
	for _ = 1, count do
		local spot = self:randomFreeTile(rng, 2)
		if spot then
			self.spikes[spot.y * W + spot.x] = true
		end
	end
end

function Game:placeThralls(thralls)
	for _, t in thralls do
		local spot = self:nearestFree(START)
		if spot then
			t.x = spot.x
			t.y = spot.y
			t.burn = 0
			t.frozen = 0
			table.insert(self.enemies, t)
		end
	end
end

function Game:makeEnemy(kind: string, x: number, y: number)
	local info = ENEMY_INFO[kind]
	-- Gentle scaling early, then steep past floor 15 so broken builds still meet an end.
	local late = math.max(0, self.floor - 15)
	local scaled = not isBoss({ kind = kind }) and kind ~= "thrall"
	local hpBonus = if scaled then math.floor((self.floor - 1) / 4) + late else 0
	local dmgBonus = if scaled then math.floor((self.floor - 1) / 6) + math.floor(late / 3) else 0
	local e = {
		id = self.nextId,
		kind = kind,
		x = x,
		y = y,
		hp = info.hp + hpBonus,
		maxHp = info.hp + hpBonus,
		-- Early Brutes hit a little softer, so one bad bump on floor 4 isn't the end.
		dmg = info.dmg + dmgBonus - (if self.config.mercy and kind == "brute" and self.floor < 6 then 1 else 0),
		burn = 0,
		burnDmg = 0,
		frozen = 0,
		marked = false,
		aim = nil,
		rest = if kind == "brute" or kind == "boss" or kind == "abbot" then 1 else 0,
		turns = 0,
		dead = false,
		ally = false,
		elite = nil,
		shield = 0,
	}
	self.nextId += 1
	table.insert(self.enemies, e)
	return e
end

function Game:raiseThrall(x: number, y: number)
	local t = self:makeEnemy("thrall", x, y)
	t.ally = true
	t.hp = 2 + math.floor(self.floor / 4)
	t.maxHp = t.hp
	t.dmg = 1 + math.floor(self.floor / 6)
	self:push({ t = "raise", x = x, y = y })
	self.stats.maxAllies = math.max(self.stats.maxAllies, #self:allies())
	self.stats.raised += 1
end

function Game:isFree(x: number, y: number): boolean
	if not self:inBounds(x, y) or self:isWall(x, y) or self:unitAt(x, y) then
		return false
	end
	if x == self.player.x and y == self.player.y then
		return false
	end
	return true
end

function Game:nearestFree(from)
	local dist = self:distanceMap({ from }, false)
	local best = nil
	local bestD = math.huge
	for y = 0, H - 1 do
		for x = 0, W - 1 do
			local d = dist[y * W + x]
			if d > 0 and d < bestD and self:isFree(x, y) and not self:isSpike(x, y) then
				bestD = d
				best = { x = x, y = y }
			end
		end
	end
	return best
end

function Game:randomFreeTile(rng, minDistFromStart: number)
	local free = {}
	for y = 0, H - 1 do
		for x = 0, W - 1 do
			local ok = not (self:isWall(x, y) or self:isSpike(x, y))
				and math.abs(x - START.x) + math.abs(y - START.y) >= minDistFromStart
				and not (x == self.stairs.x and y == self.stairs.y)
				and not self:unitAt(x, y)
				and not (self.potion and self.potion.x == x and self.potion.y == y)
				and not (self.feature and self.feature.x == x and self.feature.y == y)
			if ok then
				table.insert(free, { x = x, y = y })
			end
		end
	end
	return if #free > 0 then free[math.floor(rng() * #free) + 1] else nil
end

--- BFS distances from one or more tiles over non-wall tiles; -1 for unreachable.
function Game:distanceMap(from, throughWalls: boolean): { [number]: number }
	local dist = {}
	for i = 0, W * H - 1 do
		dist[i] = -1
	end
	local queue = table.clone(from)
	for _, p in queue do
		dist[p.y * W + p.x] = 0
	end
	local head = 1
	while head <= #queue do
		local p = queue[head]
		head += 1
		local d = dist[p.y * W + p.x]
		for _, dir in DIRS do
			local nx, ny = p.x + dir.x, p.y + dir.y
			if self:inBounds(nx, ny) and dist[ny * W + nx] < 0 and (throughWalls or not self:isWall(nx, ny)) then
				dist[ny * W + nx] = d + 1
				table.insert(queue, { x = nx, y = ny })
			end
		end
	end
	return dist
end

-- ---------- player actions ----------

--- Returns true if the action consumed a turn.
function Game:act(dx: number, dy: number): boolean
	local ok = self:doAct(dx, dy)
	if ok then
		self.log ..= if dx == 0 and dy == 0 then "W" elseif dx > 0 then "R" elseif dx < 0 then "L" elseif dy > 0 then "D" else "U"
	end
	return ok
end

function Game:doAct(dx: number, dy: number): boolean
	if self.phase ~= "play" then
		return false
	end
	self.killsThisTurn = 0
	if dx == 0 and dy == 0 then
		self:endTurn()
		return true
	end
	local tx, ty = self.player.x + dx, self.player.y + dy
	if not self:inBounds(tx, ty) then
		return false
	end
	local target = self:enemyAt(tx, ty)
	if target then
		self:playerAttack(target, { x = dx, y = dy })
		self:endTurn()
		return true
	end
	local mark = if self.config.hero == "ranger" then self:bowTarget(dx, dy) else nil
	if mark then
		self:playerAttack(mark, { x = dx, y = dy }, true)
		self:endTurn()
		return true
	end
	if self:isWall(tx, ty) then
		return false
	end

	-- Step past a thrall by swapping places with it.
	local thrall = self:unitAt(tx, ty)
	if thrall and thrall.ally then
		thrall.x = self.player.x
		thrall.y = self.player.y
	end
	self.player.x = tx
	self.player.y = ty
	self:playerEnters(tx, ty)
	if self:isOver() then
		return true
	end
	if self.potion and self.potion.x == tx and self.potion.y == ty then
		self.potion = nil
		self:push({ t = "potion" })
		self:heal(POTION_HEAL + 2 * self:r("flask") + self:r("chalice"))
	end
	if self.stairsOpen and tx == self.stairs.x and ty == self.stairs.y then
		self.turns += 1
		self:descend()
		return true
	end
	-- Rogue: every third step is taken unseen.
	self.steps += 1
	if self.config.hero == "rogue" and self.steps % 3 == 0 then
		self.turns += 1
		self:push({ t = "shadow" })
		self.stats.shadowSteps += 1
	else
		self:endTurn()
	end
	local f = self.feature
	if self.phase == "play" and f and not f.used and f.x == self.player.x and f.y == self.player.y then
		self.phase = "event"
		self:push({ t = "event", kind = f.kind })
	end
	return true
end

function Game:playerEnters(x: number, y: number)
	if self:isSpike(x, y) and self:r("caltrops") == 0 then
		self:push({ t = "spike", x = x, y = y })
		self:hurtPlayer(1, nil, "the spikes")
	end
end

function Game:unitEnters(e)
	if not self:isSpike(e.x, e.y) or e.ally or contains(FLYING, e.kind) then
		return
	end
	self:push({ t = "spike", x = e.x, y = e.y })
	self:damageEnemy(e, 2 + 2 * self:r("caltrops"), "spike")
	if e.dead then
		self.stats.spikeKills += 1
	end
end

--- Ranger: the first foe 2-3 tiles away in a clear straight line.
function Game:bowTarget(dx: number, dy: number)
	for k = 1, BOW_RANGE do
		local x, y = self.player.x + dx * k, self.player.y + dy * k
		if not self:inBounds(x, y) or self:isWall(x, y) then
			return nil
		end
		local u = self:unitAt(x, y)
		if u then
			return if not u.ally and k >= 2 then u else nil
		end
	end
	return nil
end

function Game:playerAttack(e, dir, ranged: boolean?)
	if ranged then
		self:push({ t = "shot", from = { x = self.player.x, y = self.player.y }, to = { x = e.x, y = e.y }, hit = false })
	else
		self:push({ t = "pattack", dir = dir })
	end
	self.attacks += 1
	local dmg = self:atk()
	if contains(UNDEAD, e.kind) then
		dmg += self:r("rosary") + (if self.config.hero == "paladin" then 1 else 0)
	end
	if self:r("moon") > 0 then
		dmg *= 2
	end
	if self:r("mark") > 0 and not e.marked then
		dmg += 2 * self:r("mark")
		e.marked = true
	end
	if self:r("shatter") > 0 and e.frozen > 0 then
		dmg += 3 * self:r("shatter")
	end
	if self:r("pact") > 0 and self.player.hp <= 4 then
		dmg *= self:r("pact") + 1
	end
	local crit = false
	if self:r("dice") > 0 and self.combat() < 0.15 * self:r("dice") then
		dmg *= 3
		crit = true
	end
	self.stats.maxHit = math.max(self.stats.maxHit, dmg)
	self:damageEnemy(e, dmg, if ranged then "pierce" else "melee", crit)
	if ranged and e.dead then
		self.stats.arrowKills += 1
	end
	local echoEvery = if self:r("echo") >= 2 then 3 else 4
	if self:r("echo") > 0 and self.attacks % echoEvery == 0 and not e.dead then
		self:damageEnemy(e, dmg, "melee")
	end

	if not e.dead then
		if self:r("ember") > 0 then
			e.burn = 3
			e.burnDmg = math.max(e.burnDmg, self:r("ember"))
		end
		if self:r("frost") > 0 then
			e.frozen = math.max(e.frozen, self:r("frost"))
		end
	end
	for k = 1, self:r("pike") do
		local behind = self:enemyAt(e.x + dir.x * k, e.y + dir.y * k)
		if behind then
			self:damageEnemy(behind, dmg, "pierce")
		end
	end
	local whirl = self:r("whirl")
	if whirl > 0 then
		for _, d in DIRS do
			local other = self:enemyAt(self.player.x + d.x, self.player.y + d.y)
			if other and other ~= e then
				self:damageEnemy(other, whirl, "whirl")
			end
		end
	end
	self:checkCleared()
end

function Game:descend()
	self.phase = "choose"
	self.offer = self:makeOffer()
end

function Game:randomRelic(rng, pred: (any) -> boolean)
	local pool = filter(RELICS, function(r)
		return contains(self.config.pool, r.id) and self:own(r.id) < r.maxStack and pred(r)
	end)
	if #pool == 0 then
		return nil
	end
	return weightedPick(rng, pool, function(r)
		return Relics.RARITY_WEIGHT[r.rarity]
	end)
end

function Game:makeOffer()
	local rng = mulberry32(hashSeed(self.seed, "relic", self.floor))
	local pool = filter(RELICS, function(r)
		return contains(self.config.pool, r.id) and self:own(r.id) < r.maxStack
	end)
	if self:r("heretic") > 0 then
		local dark = filter(pool, function(r)
			return r.rarity ~= "common"
		end)
		if #dark >= 3 then
			pool = dark
		end
	end
	local n = 3 + self:r("coin")
	local picks = {}
	while #picks < n and #pool > 0 do
		local choice = weightedPick(rng, pool, function(r)
			return Relics.RARITY_WEIGHT[r.rarity]
		end)
		table.insert(picks, choice)
		table.remove(pool, table.find(pool, choice))
	end
	return { relics = picks, restHeal = REST_HEAL + 2 * self:r("chalice") }
end

--- Take a relic from the offer (0-based index), or rest when index is -1.
function Game:choose(index: number)
	if self.phase ~= "choose" or not self.offer then
		return
	end
	if index < 0 then
		self:heal(self.offer.restHeal)
		self.log ..= "r"
	else
		local relic = self.offer.relics[index + 1]
		if not relic then
			return
		end
		self:addRelic(relic.id)
		self.log ..= tostring(index)
	end
	self.offer = nil
	self.phase = "play"
	self:enterFloor(self.floor + 1)
end

function Game:canAcceptEvent(): boolean
	if self.phase ~= "event" or not self.feature then
		return false
	end
	if self.feature.kind == "shrine" then
		return self.player.maxHp > 3
	end
	if self.feature.kind == "forge" then
		return #self:forgeOptions() > 0
	end
	return true
end

--- Fusions the player can make at the Soul Forge with the relics they hold.
function Game:forgeOptions()
	local out = {}
	for _, f in FUSIONS do
		local ok = (f.tier ~= 2 or self.floor >= Relics.ASCEND_FLOOR) and self:own(f.id) == 0
			and self:own(f.from[1]) > 0 and self:own(f.from[2]) > 0
		if ok and #out < #FORGE_KEYS then
			table.insert(out, f)
		end
	end
	return out
end

--- Fuse the chosen option (0-based) at the Soul Forge the player is standing on.
function Game:forge(index: number)
	if self.phase ~= "event" or not self.feature or self.feature.kind ~= "forge" then
		return
	end
	local f = self:forgeOptions()[index + 1]
	if not f then
		return
	end
	for _, id in f.from do
		self.relics[id] = self:own(id) - 1
		if self.relics[id] == 0 then
			self.relics[id] = nil
		end
		local at = nil
		for i = #self.relicLog, 1, -1 do
			if self.relicLog[i] == id then
				at = i
				break
			end
		end
		table.remove(self.relicLog, at or #self.relicLog)
	end
	self.relics[f.id] = 1
	table.insert(self.relicLog, f.id)
	local all = Relics.withFusions(self.relics)
	self.boost = {}
	for id, n in all do
		local extra = n - self:own(id)
		if extra ~= 0 then
			self.boost[id] = extra
		end
	end
	local grow = if f.id == "dragon" then 6 elseif f.id == "dracolich" then 10 else 0
	if grow > 0 then
		self:changeMaxHp(grow)
		self:heal(self.player.maxHp)
	end
	-- Mirror charges for this floor follow the new count.
	self.shieldCharges = math.max(self.shieldCharges, self:r("mirror"))
	self.stats.fusions += 1
	self:push({ t = "fuse", id = f.id, from = f.from })
	self.log ..= string.sub(FORGE_KEYS, index + 1, index + 1)
	self.feature.used = true
	self.phase = "play"
end

--- Accept or walk away from the floor event the player is standing on.
function Game:resolveEvent(accept: boolean)
	if self.phase ~= "event" or not self.feature then
		return
	end
	local f = self.feature
	local rng = mulberry32(hashSeed(self.seed, "event", self.floor))
	if accept and f.kind == "forge" then
		return
	end
	if accept and self:canAcceptEvent() then
		local any = function()
			return true
		end
		if f.kind == "shrine" then
			self:changeMaxHp(-3)
			local gift = self:randomRelic(rng, function(r)
				return r.rarity == "rare"
			end) or self:randomRelic(rng, any)
			if gift then
				self:addRelic(gift.id)
			end
		elseif f.kind == "chest" then
			if self:r("key") == 0 then
				local cut = math.min(2, self.player.hp - 1)
				if cut > 0 then
					self.player.hp -= cut
					self:push({ t = "hurt", amount = cut })
				end
			end
			local gifts = if self:r("key") > 0 then 2 else 1
			for _ = 1, gifts do
				local gift = self:randomRelic(rng, any)
				if gift then
					self:addRelic(gift.id)
				end
			end
		else
			self:heal(self.player.maxHp)
		end
	end
	self.log ..= if accept then "a" else "x"
	f.used = true
	self.phase = "play"
end

function Game:addRelic(id: string)
	self.relics[id] = self:r(id) + 1
	table.insert(self.relicLog, id)
	self:push({ t = "relic", id = id })
	if id == "heart" then
		self:changeMaxHp(3)
		self:heal(3)
	elseif id == "crown" then
		self:changeMaxHp(-3)
	end
end

function Game:changeMaxHp(delta: number)
	self.player.maxHp = math.min(MAX_HP_CAP, math.max(1, self.player.maxHp + delta))
	self.player.hp = math.min(self.player.hp, self.player.maxHp)
	if delta > 0 then
		self:push({ t = "maxhp", amount = delta })
	end
end

function Game:heal(amount: number)
	local before = self.player.hp
	self.player.hp = math.min(self.player.maxHp, self.player.hp + amount)
	local healed = self.player.hp - before
	if healed > 0 then
		self:push({ t = "heal", amount = healed })
	end
end

-- ---------- damage ----------

function Game:damageEnemy(e, amount: number, kind: string, crit: boolean?)
	if e.dead or amount <= 0 then
		return
	end
	if e.shield > 0 and kind ~= "burn" then
		e.shield -= 1
		self:push({ t = "eblock", id = e.id, x = e.x, y = e.y })
		return
	end
	e.hp -= amount
	self:push({ t = "hit", id = e.id, x = e.x, y = e.y, amount = amount, kind = kind, crit = crit == true })
	if e.hp <= 0 then
		self:killEnemy(e)
	end
end

function Game:killEnemy(e)
	e.dead = true
	e.hp = 0
	self:push({ t = "kill", id = e.id, x = e.x, y = e.y, kind = e.kind, ally = e.ally, elite = e.elite })
	if e.ally then
		return
	end

	self.kills += 1
	self.killsThisTurn += 1
	if self.player.hp <= 3 then
		self.stats.lowHpKills += 1
	end
	self.stats.kinds[e.kind] = (self.stats.kinds[e.kind] or 0) + 1
	self.stats.maxKillsInTurn = math.max(self.stats.maxKillsInTurn, self.killsThisTurn)
	if e.elite then
		self.stats.elites += 1
	end
	if isBoss(e) then
		self.stats.bosses[e.kind] = (self.stats.bosses[e.kind] or 0) + 1
		if self.player.hp == 1 then
			self.stats.bossAtOneHp = true
		end
		if self.config.hero == "paladin" then
			self:heal(self.player.maxHp)
		end
	end

	if self:r("fang") > 0 then
		self:heal(self:r("fang"))
	end
	if self:r("lantern") > 0 and self.kills % 6 == 0 then
		self:changeMaxHp(self:r("lantern"))
		self:heal(self:r("lantern"))
	end
	if self:r("harvest") > 0 then
		self.harvestBonus += self:r("harvest")
	end

	-- Raise the dead before anything else claims the tile.
	local raiseChance = (if self.config.hero == "necro" then 0.3 else 0) + 0.15 * self:r("necro")
	if raiseChance > 0 and not isBoss(e) and #self:allies() < MAX_THRALLS and self.combat() < raiseChance then
		self:raiseThrall(e.x, e.y)
	end

	if e.elite == "splitting" then
		local spawned = 0
		for _, d in DIRS do
			if spawned >= 2 then
				break
			end
			local x, y = e.x + d.x, e.y + d.y
			if self:isFree(x, y) and #self:alive() < MAX_ENEMIES then
				local child = self:makeEnemy(e.kind, x, y)
				child.hp = 1
				child.maxHp = 1
				self:push({ t = "summon", x = x, y = y })
				spawned += 1
			end
		end
	end
	if e.elite == "explosive" then
		self:push({ t = "burst", x = e.x, y = e.y })
		for _, d in DIRS8 do
			local x, y = e.x + d.x, e.y + d.y
			if x == self.player.x and y == self.player.y then
				self:hurtPlayer(2, nil, "an exploding foe")
			end
			local u = self:unitAt(x, y)
			if u then
				self:damageEnemy(u, 2, "burst")
			end
		end
	end
	if self:r("wildfire") > 0 and e.burn > 0 then
		for _, d in DIRS8 do
			local n = self:enemyAt(e.x + d.x, e.y + d.y)
			if n then
				n.burn = 3
				n.burnDmg = math.max(n.burnDmg, e.burnDmg)
			end
		end
	end
	if self:r("bloom") > 0 then
		self:push({ t = "burst", x = e.x, y = e.y })
		for _, d in DIRS8 do
			local n = self:enemyAt(e.x + d.x, e.y + d.y)
			if n then
				self:damageEnemy(n, self:r("bloom"), "burst")
			end
		end
	end
	if self:r("storm") > 0 then
		local targets = self:alive()
		local strikes = 1 + self:r("conductor")
		local from = { x = e.x, y = e.y }
		local i = 0
		while i < strikes and #targets > 0 do
			local idx = math.floor(self.combat() * #targets) + 1
			local t = table.remove(targets, idx)
			self:push({ t = "bolt", from = from, to = { x = t.x, y = t.y } })
			from = { x = t.x, y = t.y }
			self:damageEnemy(t, self:r("storm") + 1, "bolt")
			if self:r("plasma") > 0 and not t.dead then
				t.burn = 3
				t.burnDmg = math.max(t.burnDmg, self:r("ember"))
			end
			i += 1
		end
	end
end

function Game:hurtPlayer(amount: number, src, cause: string?)
	if self.phase == "dead" then
		return
	end
	local dodge = math.min(0.5, self:r("dust") * 0.2 + (if self.config.hero == "rogue" then 0.15 else 0))
	if dodge > 0 and self.combat() < dodge then
		self:push({ t = "dodge" })
		self.stats.dodges += 1
		return
	end
	if self.shieldCharges > 0 then
		self.shieldCharges -= 1
		self:push({ t = "block" })
		return
	end
	amount = math.max(1, amount - self:r("scale")) + self:r("moon")
	self.player.hp -= amount
	self.hurtThisFloor = true
	self:push({ t = "hurt", amount = amount })
	if src and src.elite == "vampiric" then
		src.hp = math.min(src.maxHp, src.hp + 1)
	end
	if src and self:r("thorns") > 0 then
		self:damageEnemy(src, self:r("thorns"), "thorns")
	end
	if self.player.hp <= 0 then
		if self:r("phylactery") > 0 and not self.phylacteryUsed then
			self.phylacteryUsed = true
			self.stats.revived = true
			self.player.hp = if self:r("vheart") > 0 then self.player.maxHp else 1
			self:push({ t = "revive" })
			return
		end
		self.player.hp = 0
		self.phase = "dead"
		self.killedBy = if src then ENEMY_INFO[src.kind].name else (cause or "the dark")
		self:push({ t = "death" })
	end
end

function Game:checkCleared()
	if not self.stairsOpen and #self:alive() == 0 then
		self.stairsOpen = true
		self.warnings = {}
		if self.floor >= 3 and not self.hurtThisFloor then
			self.stats.cleanFloors += 1
		end
		-- A breather for new players: clearing one of the first five floors heals 1 HP.
		if self.config.mercy and self.floor <= 5 then
			self:heal(1)
		end
		self:push({ t = "stairs" })
	end
end

-- ---------- the world's turn ----------

function Game:endTurn()
	self.turns += 1
	self:turnRelics()
	-- Plague Mask: whatever stands next to you at the end of your turn suffers.
	local mask = self:r("mask")
	if mask > 0 then
		for _, d in DIRS do
			local foe = self:enemyAt(self.player.x + d.x, self.player.y + d.y)
			if foe then
				self:damageEnemy(foe, mask, "mask")
			end
		end
	end
	-- Thralls act first.
	for _, a in self:allies() do
		if not a.dead then
			if a.frozen > 0 then
				a.frozen -= 1
			else
				self:allyAct(a)
			end
		end
	end
	self:resolveWarnings()
	if self.phase == "dead" then
		return
	end

	local dist = self:distanceMap({ self.player }, false)
	local ghostDist = self:distanceMap({ self.player }, true)
	for _, e in table.clone(self.enemies) do
		if e.dead or e.ally then
			continue
		end
		if e.burn > 0 then
			e.burn -= 1
			self:damageEnemy(e, e.burnDmg, "burn")
			if e.dead then
				continue
			end
		end
		if e.frozen > 0 then
			e.frozen -= 1
			continue
		end
		local moves = if e.elite == "swift" then 2 else 1
		local i = 0
		while i < moves and not e.dead and not self:isOver() do
			self:enemyAct(e, if e.kind == "wraith" then ghostDist else dist)
			i += 1
		end
		if self:isOver() then
			break
		end
	end
	self.enemies = filter(self.enemies, function(e)
		return not e.dead
	end)
	self:checkCleared()
end

function Game:turnRelics()
	local wisp = self:r("wisp")
	if wisp > 0 then
		local targets = self:alive()
		if #targets > 0 then
			local t = targets[math.floor(self.combat() * #targets) + 1]
			self:push({ t = "bolt", from = { x = self.player.x, y = self.player.y }, to = { x = t.x, y = t.y } })
			self:damageEnemy(t, wisp, "bolt")
		end
	end
	if self:r("doom") > 0 and self.turns % 10 == 0 and #self:alive() > 0 then
		self:push({ t = "toll" })
		for _, e in self:alive() do
			self:push({ t = "burst", x = e.x, y = e.y })
			self:damageEnemy(e, 4 * self:r("doom"), "burst")
		end
	end
	if self:r("hourglass") > 0 and self.turns % 8 == 0 and #self:alive() > 0 then
		self:push({ t = "timestop" })
		for _, e in self:alive() do
			e.frozen = math.max(e.frozen, 1)
		end
	end
	self:checkCleared()
end

function Game:resolveWarnings()
	local pending = self.warnings
	self.warnings = {}
	for _, w in pending do
		if w.x == self.player.x and w.y == self.player.y then
			self:hurtPlayer(w.dmg, nil, w.src)
		end
		local u = self:unitAt(w.x, w.y)
		if u and u.ally then
			self:damageEnemy(u, w.dmg, "bolt")
		end
		if self.phase == "dead" then
			return
		end
	end
end

function Game:adjacentToPlayer(e): boolean
	return math.abs(e.x - self.player.x) + math.abs(e.y - self.player.y) == 1
end

function Game:adjacentUnit(e, ally: boolean)
	for _, d in DIRS do
		local u = self:unitAt(e.x + d.x, e.y + d.y)
		if u and u.ally == ally then
			return u
		end
	end
	return nil
end

function Game:attackPlayer(e)
	self:push({ t = "eattack", id = e.id, dir = { x = self.player.x - e.x, y = self.player.y - e.y } })
	self:hurtPlayer(e.dmg + self:abyssDamage(), e)
end

--- Extra damage in the Abyss, so even unkillable builds eventually fall.
function Game:abyssDamage(): number
	local depth = self.floor - ABYSS_FLOOR
	return if depth > 0 then math.ceil((self.player.maxHp * depth * 3) / 100) else 0
end

--- Foes go for the player, but will maul a thrall that blocks the way.
function Game:meleeOrMove(e, dist, ghost: boolean)
	if self:adjacentToPlayer(e) then
		self:attackPlayer(e)
		return
	end
	local thrall = self:adjacentUnit(e, true)
	if thrall then
		self:push({ t = "eattack", id = e.id, dir = { x = thrall.x - e.x, y = thrall.y - e.y } })
		self:damageEnemy(thrall, e.dmg, "claw")
		return
	end
	self:stepToward(e, dist, ghost)
end

function Game:allyAct(a)
	local foe = self:adjacentUnit(a, false)
	if foe then
		self:push({ t = "eattack", id = a.id, dir = { x = foe.x - a.x, y = foe.y - a.y } })
		self:damageEnemy(foe, a.dmg, "ally")
		self:checkCleared()
		return
	end
	local foes = self:alive()
	if #foes > 0 then
		local spots = {}
		for _, f in foes do
			table.insert(spots, { x = f.x, y = f.y })
		end
		self:stepToward(a, self:distanceMap(spots, false), false)
	elseif math.abs(a.x - self.player.x) + math.abs(a.y - self.player.y) > 2 then
		self:stepToward(a, self:distanceMap({ self.player }, false), false)
	end
end

function Game:enemyAct(e, dist)
	e.turns += 1
	local k = e.kind
	if k == "ghoul" then
		self:meleeOrMove(e, dist, false)
	elseif k == "bat" then
		if self:adjacentToPlayer(e) then
			self:attackPlayer(e)
		elseif self.combat() < 0.5 then
			self:stepRandom(e)
		else
			self:stepToward(e, dist, false)
		end
	elseif k == "wraith" then
		self:meleeOrMove(e, dist, true)
	elseif k == "archer" then
		self:archerAct(e, dist)
	elseif k == "brute" then
		if e.rest > 0 then
			e.rest -= 1
			return
		end
		self:meleeOrMove(e, dist, false)
		e.rest = 1
	elseif k == "boss" then
		self:wardenAct(e, dist)
	elseif k == "abbot" then
		self:abbotAct(e, dist)
	elseif k == "lich" then
		self:lichAct(e)
	end
end

function Game:archerAct(e, dist)
	if e.aim then
		local dir = e.aim
		e.aim = nil
		local x, y = e.x, e.y
		local hit = false
		while true do
			local nx, ny = x + dir.x, y + dir.y
			if not self:inBounds(nx, ny) or self:isWall(nx, ny) then
				break
			end
			local blocker = self:unitAt(nx, ny)
			if blocker then
				-- Thralls take arrows meant for you.
				if blocker.ally then
					x, y = nx, ny
					self:damageEnemy(blocker, e.dmg, "claw")
				end
				break
			end
			x, y = nx, ny
			if x == self.player.x and y == self.player.y then
				hit = true
				break
			end
		end
		self:push({ t = "shot", from = { x = e.x, y = e.y }, to = { x = x, y = y }, hit = hit })
		if hit then
			self:hurtPlayer(e.dmg, e)
		end
		return
	end
	local aim = self:lineOfSight(e)
	if aim then
		e.aim = aim
		return
	end
	self:stepToward(e, dist, false)
end

--- Direction to the player if aligned with a clear line, else nil.
function Game:lineOfSight(e)
	local p = self.player
	if e.x ~= p.x and e.y ~= p.y then
		return nil
	end
	local dir = { x = sign(p.x - e.x), y = sign(p.y - e.y) }
	local x, y = e.x + dir.x, e.y + dir.y
	while x ~= p.x or y ~= p.y do
		if self:isWall(x, y) or self:unitAt(x, y) then
			return nil
		end
		x += dir.x
		y += dir.y
	end
	return dir
end

function Game:summonNear(e, kind: string)
	if #self:alive() >= MAX_ENEMIES then
		return nil
	end
	local spots = {}
	for _, d in DIRS8 do
		local p = { x = e.x + d.x, y = e.y + d.y }
		if self:isFree(p.x, p.y) then
			table.insert(spots, p)
		end
	end
	if #spots == 0 then
		return nil
	end
	local s = spots[math.floor(self.combat() * #spots) + 1]
	local made = self:makeEnemy(kind, s.x, s.y)
	self:push({ t = "summon", x = s.x, y = s.y })
	return made
end

--- Slow, summons ghouls every few turns.
function Game:wardenAct(e, dist)
	-- The first Warden (floor 5) raises fewer, frailer ghouls.
	local first = self.config.mercy and self.floor == 5
	if e.turns % (if first then 5 else 4) == 0 then
		local ghoul = self:summonNear(e, "ghoul")
		if ghoul then
			if first then
				ghoul.hp = math.max(1, ghoul.hp - 1)
				ghoul.maxHp = ghoul.hp
			end
			return
		end
	end
	if self:adjacentToPlayer(e) then
		self:attackPlayer(e)
		return
	end
	if e.rest > 0 then
		e.rest -= 1
		return
	end
	self:meleeOrMove(e, dist, false)
	e.rest = 1
end

--- Rains plague on tiles around you (telegraphed), and calls bats.
function Game:abbotAct(e, dist)
	if e.turns % 3 == 0 then
		local tiles = { { x = self.player.x, y = self.player.y } }
		local near = {}
		for y = 0, H - 1 do
			for x = 0, W - 1 do
				local d = math.abs(x - self.player.x) + math.abs(y - self.player.y)
				if d >= 1 and d <= 2 and not self:isWall(x, y) then
					table.insert(near, { x = x, y = y })
				end
			end
		end
		local i = 0
		while i < 3 and #near > 0 do
			table.insert(tiles, table.remove(near, math.floor(self.combat() * #near) + 1))
			i += 1
		end
		for _, t in tiles do
			table.insert(self.warnings, { x = t.x, y = t.y, dmg = e.dmg, kind = "plague", src = ENEMY_INFO.abbot.name })
		end
		self:push({ t = "warn" })
		return
	end
	if e.turns % 5 == 0 and self:summonNear(e, "bat") then
		return
	end
	if self:adjacentToPlayer(e) then
		self:attackPlayer(e)
		return
	end
	if e.rest > 0 then
		e.rest -= 1
		return
	end
	self:meleeOrMove(e, dist, false)
	e.rest = 1
end

--- Blinks around the room and fires bolts along its row and column (telegraphed).
function Game:lichAct(e)
	if e.turns % 4 == 0 then
		local spots = {}
		for y = 0, H - 1 do
			for x = 0, W - 1 do
				if self:isFree(x, y) and not self:isSpike(x, y) and math.abs(x - self.player.x) + math.abs(y - self.player.y) >= 3 then
					table.insert(spots, { x = x, y = y })
				end
			end
		end
		if #spots > 0 then
			local to = spots[math.floor(self.combat() * #spots) + 1]
			self:push({ t = "teleport", id = e.id, from = { x = e.x, y = e.y }, to = to })
			e.x = to.x
			e.y = to.y
			return
		end
	end
	if e.turns % 3 == 0 then
		for _, d in DIRS do
			local x, y = e.x + d.x, e.y + d.y
			while self:inBounds(x, y) and not self:isWall(x, y) do
				table.insert(self.warnings, { x = x, y = y, dmg = e.dmg, kind = "bolt", src = ENEMY_INFO.lich.name })
				x += d.x
				y += d.y
			end
		end
		self:push({ t = "warn" })
		return
	end
	if self:adjacentToPlayer(e) then
		self:attackPlayer(e)
	end
end

function Game:canEnemyEnter(x: number, y: number, ghost: boolean): boolean
	if not self:inBounds(x, y) then
		return false
	end
	if not ghost and self:isWall(x, y) then
		return false
	end
	if self:unitAt(x, y) then
		return false
	end
	if x == self.player.x and y == self.player.y then
		return false
	end
	return true
end

function Game:stepToward(e, dist, ghost: boolean)
	local here = dist[e.y * W + e.x]
	local best = {}
	local bestD = if here < 0 then math.huge else here
	for _, d in DIRS do
		local nx, ny = e.x + d.x, e.y + d.y
		if self:canEnemyEnter(nx, ny, ghost) then
			local nd = dist[ny * W + nx]
			if nd >= 0 then
				if nd < bestD then
					bestD = nd
					best = { { x = nx, y = ny } }
				elseif nd == bestD and nd < here then
					table.insert(best, { x = nx, y = ny })
				end
			end
		end
	end
	if #best == 0 then
		return
	end
	local step = best[math.floor(self.combat() * #best) + 1]
	e.x = step.x
	e.y = step.y
	self:unitEnters(e)
end

function Game:stepRandom(e)
	local options = filter(DIRS, function(d)
		return self:canEnemyEnter(e.x + d.x, e.y + d.y, false)
	end)
	if #options == 0 then
		return
	end
	local d = options[math.floor(self.combat() * #options) + 1]
	e.x += d.x
	e.y += d.y
	self:unitEnters(e)
end

--- Tiles an archer's loaded shot will cross, for the telegraph.
function Game:shotPath(e)
	if not e.aim then
		return {}
	end
	local path = {}
	local x, y = e.x + e.aim.x, e.y + e.aim.y
	while self:inBounds(x, y) and not self:isWall(x, y) and not self:unitAt(x, y) do
		table.insert(path, { x = x, y = y })
		x += e.aim.x
		y += e.aim.y
	end
	return path
end

--- Apply one input character, as in the web game's log: U/D/L/R/W, 0-3 picks, r rest,
--- a/x accept or leave a floor event, b-m Soul Forge options.
function Game:input(ch: string)
	local moves = { U = { 0, -1 }, D = { 0, 1 }, L = { -1, 0 }, R = { 1, 0 }, W = { 0, 0 } }
	if self.phase == "dead" then
		return
	end
	if moves[ch] then
		self:act(moves[ch][1], moves[ch][2])
	elseif ch == "r" then
		self:choose(-1)
	elseif ch == "a" or ch == "x" then
		self:resolveEvent(ch == "a")
	elseif string.find(FORGE_KEYS, ch, 1, true) then
		self:forge((string.find(FORGE_KEYS, ch, 1, true) :: number) - 1)
	elseif tonumber(ch) then
		self:choose(tonumber(ch) :: number)
	end
end

--- Souls a finished run pays, line by line (from src/meta.ts).
function Game:runSouls(): { { any } }
	local bosses = 0
	for _, n in self.stats.bosses do
		bosses += n
	end
	local lines = {
		{ `Floor {self.floor}`, self.floor * 4 },
		{ `{self.kills} kills`, self.kills },
	}
	if self.stats.elites > 0 then
		table.insert(lines, { `{self.stats.elites} elites`, self.stats.elites * 3 })
	end
	if bosses > 0 then
		table.insert(lines, { `{bosses} boss{if bosses > 1 then "es" else ""}`, bosses * 20 })
	end
	if self.mode == "daily" then
		local sum = 0
		for _, l in lines do
			sum += l[2]
		end
		table.insert(lines, { "Daily bonus", math.floor(sum * 0.5 + 0.5) })
	end
	return lines
end

function Game:relicEmojis(max: number?): string
	local out = {}
	for i, id in self.relicLog do
		if i > (max or 12) then
			break
		end
		table.insert(out, BY_ID[id].emoji)
	end
	return table.concat(out)
end

return Game
