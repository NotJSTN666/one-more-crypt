--!strict
-- Daily numbering, matching src/daily.ts: Daily #1 is 2026-10-14 and a new crypt opens
-- at midnight Central Time (US daylight saving rules), so Roblox and the web share it.

local Daily = {}

local DAY = 86400
local EPOCH_DAY = 20740 -- 2026-10-14, in days since 1970-01-01

-- Days since 1970-01-01 for a calendar date (Howard Hinnant's days_from_civil).
local function daysFromCivil(y: number, m: number, d: number): number
	if m <= 2 then
		y -= 1
	end
	local era = (if y >= 0 then y else y - 399) // 400
	local yoe = y - era * 400
	local mp = (m + 9) % 12
	local doy = (153 * mp + 2) // 5 + d - 1
	local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
	return era * 146097 + doe - 719468
end

-- The nth Sunday of a month, as days since 1970.
local function nthSunday(y: number, m: number, n: number): number
	local first = daysFromCivil(y, m, 1)
	local weekday = (first + 4) % 7 -- 1970-01-01 was a Thursday; 0 = Sunday
	return first + (7 - weekday) % 7 + 7 * (n - 1)
end

--- Seconds to add to UTC for Central Time at this moment (CDT -5h, CST -6h).
function Daily.centralOffset(utc: number): number
	local y = tonumber(os.date("!%Y", utc)) :: number
	-- Daylight time runs from 2:00 CST on the second Sunday of March (08:00 UTC)
	-- to 2:00 CDT on the first Sunday of November (07:00 UTC).
	local start = nthSunday(y, 3, 2) * DAY + 8 * 3600
	local stop = nthSunday(y, 11, 1) * DAY + 7 * 3600
	return if utc >= start and utc < stop then -5 * 3600 else -6 * 3600
end

function Daily.number(utc: number?): number
	local now = utc or os.time()
	local localDay = (now + Daily.centralOffset(now)) // DAY
	return localDay - EPOCH_DAY + 1
end

--- Seconds until the next crypt opens.
function Daily.secondsUntilNext(utc: number?): number
	local now = utc or os.time()
	local today = Daily.number(now)
	-- Step an hour at a time from the next local midnight guess; handles 23/25-hour days.
	local guess = (((now + Daily.centralOffset(now)) // DAY) + 1) * DAY - Daily.centralOffset(now)
	while Daily.number(guess) == today do
		guess += 3600
	end
	while Daily.number(guess - 3600) > today do
		guess -= 3600
	end
	return guess - now
end

function Daily.countdown(seconds: number): string
	local s = math.max(0, math.floor(seconds))
	return string.format("%02d:%02d:%02d", s // 3600, (s % 3600) // 60, s % 60)
end

return Daily
