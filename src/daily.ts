// Daily run numbering. Daily #1 is the launch day. A new crypt opens at midnight
// Central Time (America/Chicago, so CST in winter and CDT in summer), and everyone
// worldwide shares that day's seed.

const ZONE = 'America/Chicago';
const EPOCH = Date.UTC(2026, 9, 14); // Daily #1: 2026-10-14
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** The calendar date in Central Time, as a UTC midnight timestamp. */
function centralDay(now: number): number {
  const [y, m, d] = dateFormat.format(now).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** The Monday that starts a week in Central Time, as YYYY-MM-DD: this week, or `weeksAgo` before. */
export function weekStart(weeksAgo = 0, now = Date.now()): string {
  const day = new Date(centralDay(now));
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - sinceMonday - 7 * weeksAgo);
  return day.toISOString().slice(0, 10);
}

/** Today's date in Central Time, as YYYY-MM-DD. */
export function centralDate(now = Date.now()): string {
  return dateFormat.format(now);
}

export function dailyNumber(now = Date.now()): number {
  return Math.round((centralDay(now) - EPOCH) / DAY_MS) + 1;
}

export function msUntilNextDaily(now = Date.now()): number {
  const [h, m, s] = timeFormat.format(now).split(':').map(Number);
  const intoDay = ((h * 60 + m) * 60 + s) * 1000 + (now % 1000);
  let next = now + DAY_MS - intoDay;
  // Daylight saving days are 23 or 25 hours long.
  const today = dailyNumber(now);
  if (dailyNumber(next) === today) next += HOUR_MS;
  else if (dailyNumber(next - HOUR_MS) > today) next -= HOUR_MS;
  return next - now;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
