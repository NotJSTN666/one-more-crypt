--!strict
-- Small deterministic RNG, bit-for-bit identical to src/rng.ts, so a seed builds the
-- same crypt on Roblox as on onemorecrypt.com.

local Rng = {}

export type Rng = () -> number

local TWO32 = 4294967296

-- Math.imul: the low 32 bits of a 32x32-bit product, without losing precision in doubles.
local function imul(a: number, b: number): number
	a %= TWO32
	b %= TWO32
	local ah, al = a // 65536, a % 65536
	local bh, bl = b // 65536, b % 65536
	return (((ah * bl + al * bh) % 65536) * 65536 + al * bl) % TWO32
end
Rng.imul = imul

function Rng.mulberry32(seed: number): Rng
	local a = seed % TWO32
	return function(): number
		a = (a + 0x6d2b79f5) % TWO32
		local t = a
		t = imul(bit32.bxor(t, bit32.rshift(t, 15)), bit32.bor(t, 1))
		t = bit32.bxor(t, (t + imul(bit32.bxor(t, bit32.rshift(t, 7)), bit32.bor(t, 61))) % TWO32)
		return bit32.bxor(t, bit32.rshift(t, 14)) / TWO32
	end
end

local function partString(part: string | number): string
	if type(part) == "number" then
		if part == math.floor(part) then
			return string.format("%d", part)
		end
		return tostring(part)
	end
	return part
end

--- Hash any number of values into a 32-bit seed.
function Rng.hashSeed(...: string | number): number
	local h = 2166136261
	for i = 1, select("#", ...) do
		local s = partString((select(i, ...)))
		for c = 1, #s do
			h = bit32.bxor(h, string.byte(s, c))
			h = imul(h, 16777619)
		end
		h = bit32.bxor(h, 0x9e3779b9)
		h = imul(h, 16777619)
	end
	return h
end

function Rng.randInt(rng: Rng, min: number, maxInclusive: number): number
	return min + math.floor(rng() * (maxInclusive - min + 1))
end

function Rng.weightedPick<T>(rng: Rng, items: { T }, weight: (T) -> number): T
	local total = 0
	for _, t in items do
		total += weight(t)
	end
	local r = rng() * total
	for _, t in items do
		r -= weight(t)
		if r <= 0 then
			return t
		end
	end
	return items[#items]
end

return Rng
