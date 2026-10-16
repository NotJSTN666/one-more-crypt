--!strict
-- Heroes, elites and floor events, ported from src/content.ts.

local Content = {}

export type HeroDef = { id: string, name: string, hp: number, cost: number, perk: string, perkDesc: string }

Content.HEROES = {
	{ id = "knight", name = "Knight", hp = 10, cost = 0, perk = "Second Wind", perkDesc = "Heal 1 HP on every new floor." },
	{ id = "rogue", name = "Rogue", hp = 7, cost = 150, perk = "Shadowstep", perkDesc = "Every 3rd step is free: foes don't act. 15% dodge." },
	{ id = "necro", name = "Necromancer", hp = 8, cost = 300, perk = "Raise Dead", perkDesc = "Slain foes may rise as thralls that fight for you (up to 3)." },
	{ id = "paladin", name = "Paladin", hp = 9, cost = 250, perk = "Smite", perkDesc = "+1 damage against the undead. Slaying a boss heals you fully." },
	{ id = "ranger", name = "Ranger", hp = 7, cost = 350, perk = "Longbow", perkDesc = "Move toward a foe 2-3 tiles away in a clear line to shoot it instead." },
	{ id = "mage", name = "Mage", hp = 5, cost = 400, perk = "Glass Cannon", perkDesc = "+2 attack, but only 5 HP. Every hit counts." },
	{ id = "barbarian", name = "Barbarian", hp = 11, cost = 450, perk = "Rage", perkDesc = "+1 attack for every 3 HP you are missing." },
} :: { HeroDef }

Content.HERO_BY_ID = {} :: { [string]: HeroDef }
for _, h in Content.HEROES do
	Content.HERO_BY_ID[h.id] = h
end

--- Everyone plays the same hero in the daily crypt; it rotates each day.
function Content.dailyHero(dailyNo: number): string
	local n = #Content.HEROES
	return Content.HEROES[(dailyNo - 1 + n * 100) % n + 1].id
end

Content.ELITE_MODS = { "shielded", "swift", "vampiric", "splitting", "explosive" }

Content.ELITES = {
	shielded = { name = "Shielded", color = Color3.fromRGB(159, 232, 255), desc = "Blocks the first hit." },
	swift = { name = "Swift", color = Color3.fromRGB(242, 193, 78), desc = "Acts twice each turn." },
	vampiric = { name = "Vampiric", color = Color3.fromRGB(210, 58, 70), desc = "Heals when it wounds you." },
	splitting = { name = "Splitting", color = Color3.fromRGB(127, 154, 82), desc = "Splits in two when slain." },
	explosive = { name = "Explosive", color = Color3.fromRGB(255, 138, 42), desc = "Explodes when slain, hurting everything nearby." },
}

Content.FEATURES = {
	shrine = {
		name = "Blood Shrine",
		text = "A shrine slick with old blood. It will trade a rare relic for a piece of your life.",
		accept = "Offer 3 max HP",
		leave = "Walk away",
	},
	chest = {
		name = "Iron Chest",
		text = "A rusted chest, its lock rigged with a blade. Prying it open will cut you.",
		accept = "Pry it open (take 2 damage)",
		leave = "Leave it",
	},
	fountain = {
		name = "Pale Fountain",
		text = "Still water glows faintly. Drinking it mends every wound.",
		accept = "Drink (heal fully)",
		leave = "Leave it",
	},
	forge = {
		name = "Soul Forge",
		text = "An anvil burning with blue soulfire. It can melt two of your relics into something greater.",
		accept = "Fuse",
		leave = "Walk away",
	},
}

return Content
