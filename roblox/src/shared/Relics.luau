--!strict
-- Relic catalogue, ported from src/relics.ts. Order matters: offers are drawn from
-- this list with a seeded RNG, so it must match the web game exactly.

export type RelicDef = {
	id: string,
	name: string,
	emoji: string,
	rarity: string,
	maxStack: number,
	desc: (n: number) -> string,
}

export type FusionDef = {
	id: string,
	from: { string },
	grants: { [string]: number },
	-- Keys of `grants` in source order, so ascended relics unpack the same way every time.
	grantOrder: { string },
	tier: number?,
}

local Relics = {}

local function s(n: number): string
	return if n > 1 then "s" else ""
end

local function def(id: string, name: string, emoji: string, rarity: string, maxStack: number, desc: (n: number) -> string): RelicDef
	return { id = id, name = name, emoji = emoji, rarity = rarity, maxStack = maxStack, desc = desc }
end

Relics.RELICS = {
	def("fang", "Vampire Fang", "🦷", "common", 5, function(n) return `Heal {n} HP on each kill.` end),
	def("heart", "Iron Heart", "🫀", "common", 9, function() return "+3 max HP and heal 3." end),
	def("whetstone", "Whetstone", "🗡️", "common", 9, function() return "+1 attack." end),
	def("thorns", "Thorned Mail", "🌵", "common", 5, function(n) return `Enemies that strike you take {n} damage.` end),
	def("ember", "Ember Brand", "🔥", "common", 5, function(n) return `Your hits set foes ablaze: {n} damage per turn for 3 turns.` end),
	def("frost", "Frost Sigil", "❄️", "common", 3, function(n) return `Your hits freeze foes for {n} turn{s(n)}.` end),
	def("storm", "Storm Rune", "⚡", "common", 5, function(n) return `On kill, lightning strikes a random foe for {n + 1} damage.` end),
	def("bloom", "Corpse Bloom", "💥", "common", 5, function(n) return `Slain foes burst, dealing {n} damage to adjacent foes.` end),
	def("dust", "Grave Dust", "🌫️", "common", 3, function(n) return `{math.min(50, n * 20)}% chance to dodge attacks.` end),
	def("mark", "Hunter's Mark", "🎯", "common", 5, function(n) return `Your first hit on each foe deals +{n * 2} damage.` end),
	def("lantern", "Soul Lantern", "🏮", "common", 5, function(n) return `Every 6 kills, gain +{n} max HP.` end),
	def("crown", "Cursed Crown", "👑", "cursed", 3, function() return "+2 attack, but -3 max HP." end),
	def("pact", "Blood Pact", "🩸", "rare", 3, function(n) return `At 4 HP or less, deal {n + 1}x damage.` end),
	def("whirl", "Whirling Blade", "🌀", "common", 5, function(n) return `Your attacks also hit every other adjacent foe for {n}.` end),
	def("pike", "Bone Pike", "🔱", "common", 3, function(n) return `Attacks pierce {n} tile{s(n)} behind your target.` end),
	def("candle", "Votive Candle", "🕯️", "common", 5, function(n) return `Heal {n * 2} HP when you enter a floor.` end),
	def("hellfire", "Hellfire Pact", "☄️", "rare", 3, function(n) return `Entering a floor deals {n * 2} damage to all foes. You take 1.` end),
	def("coin", "Ferryman's Coin", "🪙", "rare", 1, function() return "Relic offerings show 4 choices." end),
	def("dice", "Bone Dice", "🎲", "common", 4, function(n) return `{n * 15}% chance for hits to deal triple damage.` end),
	def("wildfire", "Wildfire", "🌋", "rare", 1, function() return "Burning foes spread their flames to neighbours when they die." end),
	def("shatter", "Glacial Shatter", "💎", "rare", 3, function(n) return `Hits on frozen foes deal +{n * 3} damage.` end),
	def("conductor", "Iron Conductor", "⛓️", "rare", 3, function(n) return `Lightning chains to {n} more foe{s(n)}.` end),
	def("mirror", "Mirror Shield", "🛡️", "common", 3, function(n) return `Block the first {n} hit{s(n)} on each floor.` end),
	def("phylactery", "Phylactery", "⚱️", "rare", 1, function() return "Once, survive a killing blow at 1 HP." end),
	def("flask", "Ichor Flask", "🧪", "common", 3, function(n) return `Potions heal {n * 2} more.` end),
	def("harvest", "Grim Harvest", "🪓", "rare", 3, function(n) return `Each kill grants +{n} attack until the floor ends.` end),
	def("echo", "Echo Bell", "🔔", "rare", 2, function(n) return `Every {if n > 1 then "3rd" else "4th"} attack strikes twice.` end),
	def("necro", "Necrotic Touch", "🦴", "rare", 3, function(n) return `Slain foes have a {n * 15}% chance to rise as your thralls.` end),
	def("caltrops", "Caltrops", "🪤", "common", 2, function(n) return `Spike traps can't hurt you and deal +{n * 2} damage to foes.` end),
	def("key", "Skeleton Key", "🗝️", "common", 1, function() return "Iron chests open freely, and each holds a second relic." end),
	def("mask", "Plague Mask", "🎭", "rare", 3, function(n) return `Foes next to you at the end of your turn take {n} damage.` end),
	def("tome", "Black Tome", "📕", "rare", 1, function() return "Every 3rd floor you enter grants a random relic." end),
	def("rosary", "Saint's Rosary", "📿", "common", 3, function(n) return `+{n} damage against the undead.` end),
	def("idol", "Berserker Idol", "🗿", "common", 3, function(n) return `+{n} attack while at half health or less.` end),
	def("hourglass", "Stopped Hourglass", "⏳", "rare", 1, function() return "Every 8th turn, time stops: every foe is frozen for a turn." end),
	def("chalice", "Blood Chalice", "🍷", "common", 3, function(n) return `Resting heals {n * 2} more and potions heal {n} more.` end),
	def("scale", "Wyrm Scale", "🐉", "common", 3, function(n) return `Hits on you deal {n} less damage (never below 1).` end),
	def("wisp", "Wisp Lantern", "👻", "rare", 3, function(n) return `A wisp strikes a random foe for {n} damage every turn.` end),
	def("doom", "Doom Bell", "🛎️", "rare", 2, function(n) return `Every 10th turn the bell tolls: {n * 4} damage to every foe.` end),
	def("heretic", "Heretic's Codex", "📜", "rare", 1, function() return "Relic offerings show only rare and cursed relics." end),
	def("moon", "Blood Moon", "🌑", "cursed", 1, function() return "Deal double damage, but every hit on you deals 1 more." end),
}

--- Relics that start locked in Endless and are bought with Souls.
Relics.UNLOCKABLE = { "echo", "necro", "caltrops", "key", "mask", "tome", "wisp", "doom", "heretic", "moon" }

Relics.COSTS = {
	caltrops = 120, key = 120, echo = 220, mask = 260, necro = 300,
	wisp = 340, tome = 380, doom = 450, heretic = 500, moon = 600,
}

--- The launch relic set (Daily #1).
Relics.LEGACY = {
	"fang", "heart", "whetstone", "thorns", "ember", "frost", "storm", "bloom", "dust", "mark", "lantern", "crown", "pact",
	"whirl", "pike", "candle", "hellfire", "coin", "dice", "wildfire", "shatter", "conductor", "mirror", "phylactery", "flask",
	"harvest", "echo", "necro", "caltrops", "key", "mask", "tome",
}

-- Forges this deep (after the fourth boss) can also ascend two fused relics.
Relics.ASCEND_FLOOR = 21

local function fusion(id: string, a: string, b: string, grants: { { any } }, tier: number?): FusionDef
	local map, order = {}, {}
	for _, g in grants do
		map[g[1]] = g[2]
		table.insert(order, g[1])
	end
	return { id = id, from = { a, b }, grants = map, grantOrder = order, tier = tier }
end

Relics.FUSIONS = {
	fusion("plasma", "ember", "storm", { { "ember", 2 }, { "storm", 2 }, { "conductor", 1 } }),
	fusion("zero", "frost", "shatter", { { "frost", 2 }, { "shatter", 3 } }),
	fusion("vheart", "fang", "phylactery", { { "fang", 3 }, { "phylactery", 1 } }),
	fusion("aegis", "thorns", "mirror", { { "thorns", 3 }, { "mirror", 2 } }),
	fusion("reaper", "whirl", "pike", { { "whirl", 3 }, { "pike", 2 } }),
	fusion("pyre", "bloom", "wildfire", { { "bloom", 3 }, { "wildfire", 1 }, { "ember", 1 } }),
	fusion("eternal", "candle", "lantern", { { "candle", 3 }, { "lantern", 2 } }),
	fusion("fate", "dice", "mark", { { "dice", 3 }, { "mark", 3 } }),
	fusion("oath", "pact", "idol", { { "pact", 2 }, { "idol", 3 } }),
	fusion("lichbook", "necro", "harvest", { { "necro", 3 }, { "harvest", 2 } }),
	fusion("dragon", "heart", "scale", { { "scale", 3 } }),
	fusion("twinblade", "echo", "whetstone", { { "echo", 2 }, { "whetstone", 2 } }),
	fusion("suneater", "plasma", "pyre", { { "plasma", 1 }, { "pyre", 1 }, { "ember", 2 }, { "storm", 2 }, { "conductor", 1 } }, 2),
	fusion("bastion", "zero", "aegis", { { "zero", 1 }, { "aegis", 1 }, { "frost", 1 }, { "shatter", 2 }, { "thorns", 2 }, { "mirror", 1 } }, 2),
	fusion("immortal", "vheart", "eternal", { { "vheart", 1 }, { "eternal", 1 }, { "fang", 2 }, { "candle", 2 }, { "lantern", 1 } }, 2),
	fusion("wager", "fate", "oath", { { "fate", 1 }, { "oath", 1 }, { "dice", 1 }, { "mark", 2 }, { "pact", 1 }, { "idol", 2 } }, 2),
	fusion("thousand", "reaper", "twinblade", { { "reaper", 1 }, { "twinblade", 1 }, { "whirl", 2 }, { "pike", 1 }, { "whetstone", 3 } }, 2),
	fusion("dracolich", "lichbook", "dragon", { { "lichbook", 1 }, { "dragon", 1 }, { "necro", 1 }, { "harvest", 2 }, { "scale", 2 } }, 2),
}

local function fixed(text: string): (n: number) -> string
	return function()
		return text
	end
end

Relics.FUSED = {
	def("plasma", "Plasma Brand", "🌩️", "fused", 1, fixed("Burns like 2 Ember Brands, strikes like 2 Storm Runes, and its lightning chains and sets foes ablaze.")),
	def("zero", "Absolute Zero", "🧊", "fused", 1, fixed("Hits freeze foes for 2 turns, and hits on frozen foes deal +9 damage.")),
	def("vheart", "Vampire Lord's Heart", "🧛", "fused", 1, fixed("Heal 3 HP on each kill. Survive a killing blow at full HP, once per boss floor.")),
	def("aegis", "Thorned Aegis", "🌹", "fused", 1, fixed("Block the first 2 hits on each floor. Foes that strike you take 3 damage.")),
	def("reaper", "Reaper's Scythe", "☠️", "fused", 1, fixed("Attacks hit every other adjacent foe for 3 and pierce 2 tiles behind your target.")),
	def("pyre", "Funeral Pyre", "🎆", "fused", 1, fixed("Your hits burn, slain foes burst for 3, and burning foes spread their flames when they die.")),
	def("eternal", "Eternal Flame", "🪔", "fused", 1, fixed("Heal 6 HP on each new floor. Every 6 kills, gain +2 max HP.")),
	def("fate", "Fate's Edge", "🃏", "fused", 1, fixed("45% chance for hits to deal triple damage. Your first hit on each foe deals +6.")),
	def("oath", "Berserker's Oath", "😈", "fused", 1, fixed("+3 attack at half health or less, and triple damage at 4 HP or less.")),
	def("lichbook", "Book of the Dead", "📖", "fused", 1, fixed("Slain foes have a 45% chance to rise as thralls. Each kill grants +2 attack until the floor ends.")),
	def("dragon", "Dragonheart", "🐲", "fused", 1, fixed("+6 max HP when forged. Hits on you deal 3 less damage (never below 1).")),
	def("twinblade", "Twin Blade", "⚔️", "fused", 1, fixed("+2 attack, and every 3rd attack strikes twice.")),
	def("suneater", "Sun Eater", "☀️", "ascended", 1, fixed("Plasma Brand and Funeral Pyre in one, plus 2 more Ember Brands, 2 more Storm Runes and a longer lightning chain.")),
	def("bastion", "Glacier Bastion", "🏔️", "ascended", 1, fixed("Absolute Zero and Thorned Aegis in one: block 3 hits a floor, freeze for 3 turns, +15 damage to frozen foes, 5 thorns.")),
	def("immortal", "Immortal Heart", "💖", "ascended", 1, fixed("Vampire Lord's Heart and Eternal Flame in one: heal 5 per kill, 10 per floor, and rise again at full HP every boss floor.")),
	def("wager", "Death's Wager", "⚰️", "ascended", 1, fixed("Fate's Edge and Berserker's Oath in one: 60% triple hits, +10 on first strikes, and fury when wounded.")),
	def("thousand", "Thousand Cuts", "🌪️", "ascended", 1, fixed("Reaper's Scythe and Twin Blade in one: +5 attack, every 3rd attack strikes twice, 5 damage sweeps around you and attacks pierce 3 tiles.")),
	def("dracolich", "Dracolich", "👁️", "ascended", 1, fixed("+10 max HP when forged. Book of the Dead and Dragonheart in one: 60% of the slain rise, +4 attack per kill, 5 less damage taken.")),
}

Relics.BY_ID = {} :: { [string]: RelicDef }
for _, r in Relics.RELICS do
	Relics.BY_ID[r.id] = r
end
for _, r in Relics.FUSED do
	Relics.BY_ID[r.id] = r
end

Relics.FUSION_BY_ID = {} :: { [string]: FusionDef }
for _, f in Relics.FUSIONS do
	Relics.FUSION_BY_ID[f.id] = f
end

Relics.RARITY_WEIGHT = { common = 10, rare = 4, cursed = 5, fused = 0, ascended = 0 }

Relics.RARITY_COLOR = {
	common = Color3.fromRGB(201, 209, 224),
	rare = Color3.fromRGB(127, 180, 255),
	cursed = Color3.fromRGB(210, 58, 70),
	fused = Color3.fromRGB(159, 232, 255),
	ascended = Color3.fromRGB(242, 193, 78),
}

--- Relic counts plus everything fused and ascended relics grant.
function Relics.withFusions(relics: { [string]: number }): { [string]: number }
	local out = table.clone(relics)
	local open = {}
	for _, f in Relics.FUSIONS do
		if (relics[f.id] or 0) > 0 then
			table.insert(open, f.id)
		end
	end
	while #open > 0 do
		local f = Relics.FUSION_BY_ID[table.remove(open) :: string]
		for _, id in f.grantOrder do
			out[id] = (out[id] or 0) + f.grants[id]
			if Relics.FUSION_BY_ID[id] then
				table.insert(open, id)
			end
		end
	end
	return out
end

function Relics.contains(list: { string }, id: string): boolean
	return table.find(list, id) ~= nil
end

return Relics
