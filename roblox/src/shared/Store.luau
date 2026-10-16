--!strict
-- Everything for sale. Create each item in the Creator Dashboard (see roblox/README.md),
-- then paste its ID number over the 0 here. Items with ID 0 show as "not on sale yet".
--
-- Nothing here touches the Daily Descent's fairness: passes are cosmetic or speed up
-- Ossuary unlocks, and Souls only buy heroes and relics for Endless.

local Store = {}

export type Pass = { key: string, id: number, name: string, emoji: string, price: number, desc: string }
export type Product = { key: string, id: number, name: string, emoji: string, price: number, souls: number }

-- Game Passes: bought once, kept forever. `price` is only the suggested Robux price;
-- the real price is whatever you set in the Creator Dashboard.
Store.PASSES = {
	{
		key = "doubleSouls", id = 0, name = "Grave Robber", emoji = "⚱️", price = 199,
		desc = "Earn 2× Souls from every run, forever. Unlock heroes and forbidden relics twice as fast.",
	},
	{
		key = "cloaks", id = 0, name = "Cloak Collection", emoji = "🧥", price = 99,
		desc = "Six new cloak colours for every hero: Crimson, Ash, Royal, Frost, Gilded and Void.",
	},
	{
		key = "aura", id = 0, name = "Soulfire Aura", emoji = "✨", price = 149,
		desc = "Your hero burns with blue soulfire and sheds embers as you descend.",
	},
	{
		key = "founder", id = 0, name = "Crypt Founder", emoji = "👑", price = 299,
		desc = "A golden crown for your hero and the Founder title. Thank you for keeping the crypt open!",
	},
} :: { Pass }

-- Developer Products: bought as often as you like.
Store.PRODUCTS = {
	{ key = "souls250", id = 0, name = "Pouch of Souls", emoji = "👝", price = 49, souls = 250 },
	{ key = "souls800", id = 0, name = "Urn of Souls", emoji = "🏺", price = 129, souls = 800 },
	{ key = "souls2500", id = 0, name = "Ossuary Hoard", emoji = "💀", price = 349, souls = 2500 },
} :: { Product }

-- Roblox Premium members earn this much extra Souls (Premium playtime also pays you).
Store.PREMIUM_BONUS = 0.2

-- Cloak Collection colours (p light, P dark), in menu order.
Store.CLOAKS = {
	{ key = "crimson", name = "Crimson", p = Color3.fromHex("#8a2232"), P = Color3.fromHex("#4f0f1b") },
	{ key = "ash", name = "Ash", p = Color3.fromHex("#6d6880"), P = Color3.fromHex("#433f52") },
	{ key = "royal", name = "Royal", p = Color3.fromHex("#4b3a78"), P = Color3.fromHex("#2c2148") },
	{ key = "frost", name = "Frost", p = Color3.fromHex("#5fa8c9"), P = Color3.fromHex("#2f5f78") },
	{ key = "gilded", name = "Gilded", p = Color3.fromHex("#c9982f"), P = Color3.fromHex("#7a5a14") },
	{ key = "void", name = "Void", p = Color3.fromHex("#1c1626"), P = Color3.fromHex("#0b0810") },
}

function Store.passByKey(key: string): Pass?
	for _, p in Store.PASSES do
		if p.key == key then
			return p
		end
	end
	return nil
end

function Store.passById(id: number): Pass?
	for _, p in Store.PASSES do
		if p.id ~= 0 and p.id == id then
			return p
		end
	end
	return nil
end

function Store.productById(id: number): Product?
	for _, p in Store.PRODUCTS do
		if p.id ~= 0 and p.id == id then
			return p
		end
	end
	return nil
end

function Store.cloakByKey(key: string?): any
	for _, c in Store.CLOAKS do
		if c.key == key then
			return c
		end
	end
	return nil
end

return Store
