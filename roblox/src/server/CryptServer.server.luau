--!nonstrict
-- One More Crypt server. Each player's run lives here, so the client only sends
-- inputs and draws what comes back: nobody can edit their HP or skip floors.
-- Saves Souls, unlocks and best depths to DataStores, keeps one official daily
-- attempt per player, runs the daily and Endless leaderboards, and sells the
-- Game Passes and Soul packs listed in Store.luau.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local MarketplaceService = game:GetService("MarketplaceService")

local Shared = ReplicatedStorage:WaitForChild("OneMoreCrypt")
local Game = require(Shared.Game)
local Relics = require(Shared.Relics)
local Content = require(Shared.Content)
local Daily = require(Shared.Daily)
local Rng = require(Shared.Rng)
local Store = require(Shared.Store)

-- The board is the whole game: no avatar to walk around.
Players.CharacterAutoLoads = false

local remote = Instance.new("RemoteFunction")
remote.Name = "Crypt"
remote.Parent = Shared

-- Server-to-client nudges, e.g. "your purchase went through".
local push = Instance.new("RemoteEvent")
push.Name = "CryptPush"
push.Parent = Shared

local presence = Instance.new("IntValue")
presence.Name = "SoulsInCrypt"
presence.Parent = Shared

-- The seed name the web game has used since launch, so every daily is the same crypt everywhere.
local DAILY_SEED_NAME = "cryptfall-daily"
local FORGE_DAILY = 2
local MERCY_DAILY = 4
local PROFILE_VERSION = 1

-- ---------- storage ----------

local storeOk, profileStore = pcall(function()
	return DataStoreService:GetDataStore("OneMoreCrypt_Profiles_v1")
end)
if not storeOk then
	warn("[One More Crypt] DataStores unavailable; progress will not be saved. In Studio, turn on Game Settings > Security > Enable Studio Access to API Services.")
	profileStore = nil
end
-- GetDataStore succeeds even when requests will fail (Studio without API access), so probe once.
if profileStore then
	local ok = pcall(function()
		profileStore:GetAsync("probe")
	end)
	if not ok then
		warn("[One More Crypt] DataStores unavailable; progress will not be saved. In Studio, turn on Game Settings > Security > Enable Studio Access to API Services.")
		profileStore = nil
	end
end

local function orderedStore(name: string)
	if not profileStore then
		return nil
	end
	local ok, store = pcall(function()
		return DataStoreService:GetOrderedDataStore(name)
	end)
	return if ok then store else nil
end

local endlessBoard = orderedStore("OneMoreCrypt_Endless_v1")

local function dailyBoard(dailyNo: number)
	return orderedStore("OneMoreCrypt_Daily_v1_" .. dailyNo)
end

local function newProfile()
	return {
		version = PROFILE_VERSION,
		souls = 0,
		earned = 0,
		heroes = { "knight" },
		relics = {},
		hero = "knight",
		bestEndless = 0,
		runs = 0,
		-- dailyNo (as a string key) -> deepest floor reached in the official attempt
		daily = {},
		-- The run in progress, so leaving mid-run loses nothing: rebuilt from its inputs.
		active = nil,
		-- Cloak Collection colour ("" = the hero's own).
		cloak = "",
		-- Recent Developer Product purchase IDs, so a receipt is never paid out twice.
		receipts = {},
	}
end

local profiles = {} -- [Player] = profile
local runs = {} -- [Player] = Game
local runMeta = {} -- [Player] = { mode, dailyNo }
local lastInput = {} -- [Player] = os.clock()
local passes = {} -- [Player] = { [pass key] = true }

local function loadProfile(player: Player)
	local profile = newProfile()
	if profileStore then
		local ok, data = pcall(function()
			return profileStore:GetAsync("u" .. player.UserId)
		end)
		if ok and type(data) == "table" then
			for k, v in data do
				profile[k] = v
			end
		elseif not ok then
			warn("[One More Crypt] Could not load profile:", data)
		end
	end
	return profile
end

--- Remember the run in progress on the profile, so it can be resumed later.
local function captureActive(player: Player)
	local profile = profiles[player]
	if not profile then
		return
	end
	local g = runs[player]
	local meta = runMeta[player]
	if g and meta and not g:isOver() then
		profile.active = {
			mode = meta.mode,
			seed = g.seed,
			dailyNo = meta.dailyNo,
			hero = g.config.hero,
			relics = profile.relics,
			forge = g.config.forge,
			mercy = g.config.mercy,
			legacy = meta.legacy,
			inputs = meta.inputs,
		}
	end
end

--- Returns true once the profile is safely stored (or there's no store to save to).
local function saveProfile(player: Player): boolean
	local profile = profiles[player]
	if not profile then
		return false
	end
	captureActive(player)
	if not profileStore then
		return true
	end
	local ok, err = pcall(function()
		profileStore:SetAsync("u" .. player.UserId, profile)
	end)
	if not ok then
		warn("[One More Crypt] Could not save profile:", err)
	end
	return ok
end

-- ---------- the store ----------

local function owns(player: Player, key: string): boolean
	return passes[player] ~= nil and passes[player][key] == true
end

local function loadPasses(player: Player)
	local owned = {}
	for _, pass in Store.PASSES do
		if pass.id ~= 0 then
			local ok, has = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, pass.id)
			if ok and has then
				owned[pass.key] = true
			end
		end
	end
	passes[player] = owned
end

local function isPremium(player: Player): boolean
	return player.MembershipType == Enum.MembershipType.Premium
end

--- Soul packs. Roblox retries until this returns PurchaseGranted, so only say so once
--- the Souls are saved, and remember each receipt so it can't pay out twice.
MarketplaceService.ProcessReceipt = function(receipt)
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	local product = Store.productById(receipt.ProductId)
	if not player or not product then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local profile = profiles[player]
	if not profile then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	if table.find(profile.receipts, receipt.PurchaseId) then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	profile.souls += product.souls
	table.insert(profile.receipts, receipt.PurchaseId)
	while #profile.receipts > 50 do
		table.remove(profile.receipts, 1)
	end
	if not saveProfile(player) then
		profile.souls -= product.souls
		table.remove(profile.receipts, table.find(profile.receipts, receipt.PurchaseId))
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	push:FireClient(player, { kind = "souls", amount = product.souls, name = product.name })
	return Enum.ProductPurchaseDecision.PurchaseGranted
end


local function submitScore(store, player: Player, score: number)
	if not store then
		return
	end
	task.spawn(function()
		pcall(function()
			store:UpdateAsync("u" .. player.UserId, function(old)
				if old and old >= score then
					return nil
				end
				return score
			end)
		end)
	end)
end

-- Leaderboards are cached for a minute so busy servers stay inside DataStore limits.
local boardCache = {}
local function readBoard(key: string, store)
	local cached = boardCache[key]
	if cached and os.clock() - cached.at < 60 then
		return cached.rows
	end
	local rows = {}
	if store then
		local ok, pages = pcall(function()
			return store:GetSortedAsync(false, 20)
		end)
		if ok then
			for i, entry in pages:GetCurrentPage() do
				local userId = tonumber(string.sub(entry.key, 2))
				local name = "Unknown soul"
				if userId then
					local okName, n = pcall(Players.GetNameFromUserIdAsync, Players, userId)
					if okName then
						name = n
					end
				end
				table.insert(rows, { rank = i, name = name, score = entry.value })
			end
		end
	end
	boardCache[key] = { at = os.clock(), rows = rows }
	return rows
end

-- ---------- runs ----------

local function unlockedRelics(profile)
	local out = {}
	for _, id in profile.relics do
		if Relics.contains(Relics.UNLOCKABLE, id) then
			table.insert(out, id)
		end
	end
	return out
end

local function dailyConfig(dailyNo: number)
	return {
		hero = Content.dailyHero(dailyNo),
		pool = Game.fullPool(dailyNo <= 1),
		forge = dailyNo >= FORGE_DAILY,
		mercy = dailyNo >= MERCY_DAILY,
	}
end

local function relicView(id: string, n: number)
	local def = Relics.BY_ID[id]
	return { id = id, n = n, name = def.name, emoji = def.emoji, rarity = def.rarity, desc = def.desc(math.max(1, n)) }
end

--- Everything the client needs to draw the board and menus.
local function snapshot(g)
	local walls, spikes = {}, {}
	for i = 0, Game.W * Game.H - 1 do
		if g.walls[i] then
			table.insert(walls, i)
		end
		if g.spikes[i] then
			table.insert(spikes, i)
		end
	end
	local enemies = {}
	for _, e in g.enemies do
		if not e.dead then
			local path = {}
			for _, p in g:shotPath(e) do
				table.insert(path, { x = p.x, y = p.y })
			end
			table.insert(enemies, {
				id = e.id, kind = e.kind, x = e.x, y = e.y, hp = e.hp, maxHp = e.maxHp, elite = e.elite or "",
				frozen = e.frozen, burn = e.burn, ally = e.ally, shield = e.shield, path = path,
				name = Game.ENEMY_INFO[e.kind].name,
			})
		end
	end
	local relics = {}
	local seen = {}
	for _, id in g.relicLog do
		if not seen[id] then
			seen[id] = true
			table.insert(relics, relicView(id, g:own(id)))
		end
	end
	local offer = nil
	if g.offer then
		local picks = {}
		for _, r in g.offer.relics do
			table.insert(picks, relicView(r.id, g:own(r.id) + 1))
		end
		offer = { relics = picks, restHeal = g.offer.restHeal }
	end
	local feature = nil
	if g.feature then
		local f = Content.FEATURES[g.feature.kind]
		feature = {
			x = g.feature.x, y = g.feature.y, kind = g.feature.kind, used = g.feature.used,
			name = f.name, text = f.text, accept = f.accept, leave = f.leave,
		}
	end
	local forge = {}
	if g.phase == "event" and g.feature and g.feature.kind == "forge" then
		for i, f in g:forgeOptions() do
			local a, b = Relics.BY_ID[f.from[1]], Relics.BY_ID[f.from[2]]
			local made = Relics.BY_ID[f.id]
			table.insert(forge, {
				index = i - 1, id = f.id, name = made.name, emoji = made.emoji, rarity = made.rarity, desc = made.desc(1),
				recipe = `{a.emoji} {a.name} + {b.emoji} {b.name}`,
			})
		end
	end
	local warnings = {}
	for _, w in g.warnings do
		table.insert(warnings, { x = w.x, y = w.y, kind = w.kind })
	end
	return {
		mode = g.mode,
		dailyNo = g.dailyNo,
		hero = g.config.hero,
		heroName = Content.HERO_BY_ID[g.config.hero].name,
		floor = g.floor,
		phase = g.phase,
		hp = g.player.hp,
		maxHp = g.player.maxHp,
		x = g.player.x,
		y = g.player.y,
		atk = g:atk(),
		shield = g.shieldCharges,
		kills = g.kills,
		turns = g.turns,
		shadowReady = g:shadowReady(),
		boss = g:isBossFloor(),
		walls = walls,
		spikes = spikes,
		stairs = { x = g.stairs.x, y = g.stairs.y },
		stairsOpen = g.stairsOpen,
		potion = if g.potion then { x = g.potion.x, y = g.potion.y } else nil,
		feature = feature,
		warnings = warnings,
		enemies = enemies,
		relics = relics,
		emojis = g:relicEmojis(20),
		offer = offer,
		forge = forge,
		canAccept = g:canAcceptEvent(),
		killedBy = g.killedBy,
	}
end

local function storeView(player: Player)
	local out = { passes = {}, products = {}, cloaks = {}, premium = isPremium(player), premiumBonus = Store.PREMIUM_BONUS }
	for _, p in Store.PASSES do
		table.insert(out.passes, { key = p.key, id = p.id, name = p.name, emoji = p.emoji, price = p.price, desc = p.desc, owned = owns(player, p.key) })
	end
	for _, p in Store.PRODUCTS do
		table.insert(out.products, { key = p.key, id = p.id, name = p.name, emoji = p.emoji, price = p.price, souls = p.souls })
	end
	for _, c in Store.CLOAKS do
		table.insert(out.cloaks, { key = c.key, name = c.name })
	end
	return out
end

local function profileView(player: Player)
	local profile = profiles[player]
	local today = Daily.number()
	local heroes = {}
	for _, h in Content.HEROES do
		table.insert(heroes, {
			id = h.id, name = h.name, hp = h.hp, cost = h.cost, perk = h.perk, perkDesc = h.perkDesc,
			owned = Relics.contains(profile.heroes, h.id),
		})
	end
	local forbidden = {}
	for _, id in Relics.UNLOCKABLE do
		local def = Relics.BY_ID[id]
		table.insert(forbidden, {
			id = id, name = def.name, emoji = def.emoji, rarity = def.rarity, desc = def.desc(1),
			cost = Relics.COSTS[id], owned = Relics.contains(profile.relics, id),
		})
	end
	local played = profile.daily[tostring(today)]
	local active = profile.active
	return {
		souls = profile.souls,
		earned = profile.earned,
		hero = profile.hero,
		bestEndless = profile.bestEndless,
		heroes = heroes,
		forbidden = forbidden,
		daily = {
			number = today,
			hero = Content.HERO_BY_ID[Content.dailyHero(today)].name,
			played = played,
			resumable = active ~= nil and active.mode == "daily" and active.dailyNo == today,
			secondsLeft = Daily.secondsUntilNext(),
		},
		endlessResumable = active ~= nil and active.mode == "endless",
		online = profileStore ~= nil,
		store = storeView(player),
		cosmetics = {
			cloak = if owns(player, "cloaks") then profile.cloak else "",
			aura = owns(player, "aura"),
			crown = owns(player, "founder"),
		},
	}
end

local function finishRun(player: Player, g)
	local profile = profiles[player]
	local meta = runMeta[player]
	local lines = g:runSouls()
	local total = 0
	for _, l in lines do
		total += l[2]
	end
	local base = total
	if owns(player, "doubleSouls") then
		table.insert(lines, { "Grave Robber 2×", base })
		total += base
	end
	if isPremium(player) then
		local bonus = math.floor(base * Store.PREMIUM_BONUS + 0.5)
		table.insert(lines, { "Premium bonus", bonus })
		total += bonus
	end
	profile.souls += total
	profile.earned += total
	profile.runs += 1
	local newBest = false
	local score = g.floor * 10000 + math.min(9999, g.kills)
	if meta.mode == "daily" then
		submitScore(dailyBoard(meta.dailyNo), player, score)
		boardCache["daily" .. meta.dailyNo] = nil
	else
		if g.floor > profile.bestEndless then
			profile.bestEndless = g.floor
			newBest = true
		end
		submitScore(endlessBoard, player, score)
		boardCache.endless = nil
	end
	runs[player] = nil
	runMeta[player] = nil
	profile.active = nil
	task.spawn(saveProfile, player)
	local outLines = {}
	for _, l in lines do
		table.insert(outLines, { label = l[1], souls = l[2] })
	end
	return {
		souls = total, lines = outLines, newBest = newBest, bestEndless = profile.bestEndless, emojis = g:relicEmojis(20),
		upsell = not owns(player, "doubleSouls") and (Store.passByKey("doubleSouls") :: any).id ~= 0,
	}
end

local function startRun(player: Player, mode: string, heroId: string?)
	local profile = profiles[player]
	local active = profile.active
	if mode == "daily" then
		local today = Daily.number()
		-- Rejoining mid-attempt rebuilds the run from its inputs.
		if active and active.mode == "daily" and active.dailyNo == today then
			local g = Game.new("daily", active.seed, today, dailyConfig(today))
			for k = 1, #active.inputs do
				g:input(string.sub(active.inputs, k, k))
			end
			g.events = {}
			runs[player] = g
			runMeta[player] = { mode = "daily", dailyNo = today, inputs = active.inputs }
			return g
		end
		if profile.daily[tostring(today)] then
			return nil, "You have already braved today's crypt. A new one opens at midnight Central Time; try Endless meanwhile."
		end
		local g = Game.new("daily", Rng.hashSeed(DAILY_SEED_NAME, today), today, dailyConfig(today))
		profile.daily[tostring(today)] = 1
		profile.active = nil
		runs[player] = g
		runMeta[player] = { mode = "daily", dailyNo = today, inputs = "" }
		task.spawn(saveProfile, player)
		return g
	end

	if heroId == "resume" and active and active.mode == "endless" then
		local pool = Game.basePool(unlockedRelics({ relics = active.relics or {} }))
		local g = Game.new("endless", active.seed, 0, { hero = active.hero, pool = pool, forge = true, mercy = true })
		for k = 1, #active.inputs do
			g:input(string.sub(active.inputs, k, k))
		end
		g.events = {}
		runs[player] = g
		runMeta[player] = { mode = "endless", dailyNo = 0, inputs = active.inputs }
		return g
	end
	local hero = if heroId and Relics.contains(profile.heroes, heroId) then heroId else profile.hero
	if not Relics.contains(profile.heroes, hero) then
		hero = "knight"
	end
	profile.hero = hero
	local seed = Random.new():NextInteger(0, 2147483646) * 2 + Random.new():NextInteger(0, 1)
	local g = Game.new("endless", seed, 0, { hero = hero, pool = Game.basePool(unlockedRelics(profile)), forge = true, mercy = true })
	profile.active = nil
	runs[player] = g
	runMeta[player] = { mode = "endless", dailyNo = 0, inputs = "" }
	return g
end

local VALID_INPUT = "^[UDLRWrax0-3b-m]$"

local handlers = {}

function handlers.profile(player: Player)
	return { profile = profileView(player) }
end

function handlers.start(player: Player, req)
	if runs[player] and not runs[player]:isOver() and req.mode ~= "daily" then
		-- Starting a new Endless run abandons the current one.
		runs[player] = nil
	end
	local g, err = startRun(player, req.mode == "daily" and "daily" or "endless", req.hero)
	if not g then
		return { error = err, profile = profileView(player) }
	end
	return { state = snapshot(g), events = {} }
end

function handlers.input(player: Player, req)
	local g = runs[player]
	if not g or type(req.ch) ~= "string" or not string.match(req.ch, VALID_INPUT) then
		return { error = "no run" }
	end
	-- Turn-based, but keep a lid on spam.
	local now = os.clock()
	if lastInput[player] and now - lastInput[player] < 0.03 then
		return { state = snapshot(g), events = {} }
	end
	lastInput[player] = now
	local before = #g.log
	local floorBefore = g.floor
	g.events = {}
	g:input(req.ch)
	local meta = runMeta[player]
	if #g.log > before then
		meta.inputs ..= string.sub(g.log, before + 1)
	end
	local state = snapshot(g)
	local events = g.events
	g.events = {}
	local result = nil
	local profile = profiles[player]
	if meta.mode == "daily" then
		profile.daily[tostring(meta.dailyNo)] = math.max(profile.daily[tostring(meta.dailyNo)] or 0, g.floor)
	end
	if g:isOver() then
		result = finishRun(player, g)
		result.board = readBoard(if meta.mode == "daily" then "daily" .. meta.dailyNo else "endless", if meta.mode == "daily" then dailyBoard(meta.dailyNo) else endlessBoard)
	elseif g.floor ~= floorBefore then
		task.spawn(saveProfile, player)
	end
	return { state = state, events = events, result = result }
end

function handlers.leave(player: Player)
	-- Back to the menu; the run is kept and can be resumed.
	captureActive(player)
	task.spawn(saveProfile, player)
	runs[player] = nil
	runMeta[player] = nil
	return { profile = profileView(player) }
end

function handlers.buyHero(player: Player, req)
	local profile = profiles[player]
	local hero = Content.HERO_BY_ID[req.id]
	if hero and not Relics.contains(profile.heroes, hero.id) and profile.souls >= hero.cost then
		profile.souls -= hero.cost
		table.insert(profile.heroes, hero.id)
		task.spawn(saveProfile, player)
	end
	return { profile = profileView(player) }
end

function handlers.buyRelic(player: Player, req)
	local profile = profiles[player]
	local cost = Relics.COSTS[req.id]
	if cost and not Relics.contains(profile.relics, req.id) and profile.souls >= cost then
		profile.souls -= cost
		table.insert(profile.relics, req.id)
		task.spawn(saveProfile, player)
	end
	return { profile = profileView(player) }
end

function handlers.pickHero(player: Player, req)
	local profile = profiles[player]
	if Relics.contains(profile.heroes, req.id) then
		profile.hero = req.id
	end
	return { profile = profileView(player) }
end

function handlers.pickCloak(player: Player, req)
	local profile = profiles[player]
	if owns(player, "cloaks") and (req.key == "" or Store.cloakByKey(req.key)) then
		profile.cloak = req.key
	end
	return { profile = profileView(player) }
end

function handlers.board(player: Player, req)
	if req.board == "daily" then
		local n = Daily.number()
		return { board = readBoard("daily" .. n, dailyBoard(n)), title = `Daily #{n}` }
	end
	return { board = readBoard("endless", endlessBoard), title = "Endless" }
end

remote.OnServerInvoke = function(player: Player, req)
	if type(req) ~= "table" or type(req.op) ~= "string" then
		return { error = "bad request" }
	end
	while not profiles[player] and player.Parent do
		task.wait(0.1)
	end
	local handler = handlers[req.op]
	if not handler then
		return { error = "unknown op" }
	end
	local ok, res = pcall(handler, player, req)
	if not ok then
		warn("[One More Crypt] " .. req.op .. " failed:", res)
		return { error = "Something went wrong in the crypt." }
	end
	return res
end

-- A Game Pass bought in-game counts straight away.
MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
	local pass = Store.passById(passId)
	if purchased and pass and passes[player] then
		passes[player][pass.key] = true
		push:FireClient(player, { kind = "pass", name = pass.name })
	end
end)

Players.PlayerAdded:Connect(function(player)
	task.spawn(loadPasses, player)
	profiles[player] = loadProfile(player)
	presence.Value = #Players:GetPlayers()
end)

Players.PlayerRemoving:Connect(function(player)
	saveProfile(player)
	profiles[player] = nil
	runs[player] = nil
	runMeta[player] = nil
	lastInput[player] = nil
	passes[player] = nil
	presence.Value = #Players:GetPlayers() - 1
end)

for _, player in Players:GetPlayers() do
	task.spawn(function()
		loadPasses(player)
		profiles[player] = loadProfile(player)
	end)
end

game:BindToClose(function()
	if RunService:IsStudio() and not profileStore then
		return
	end
	for _, player in Players:GetPlayers() do
		saveProfile(player)
	end
end)
