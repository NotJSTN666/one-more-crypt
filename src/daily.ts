// Daily run numbering. Daily #1 is the launch day; everyone worldwide shares the same
// UTC date, so the same seed.

const EPOCH_UTC = Date.UTC(2026, 9, 14); // 2026-10-14
const DAY_MS = 86_400_000;

export function dailyNumber(now = Date.now()): number {
  return Math.floor((now - EPOCH_UTC) / DAY_MS) + 1;
}

export function msUntilNextDaily(now = Date.now()): number {
  const elapsed = (now - EPOCH_UTC) % DAY_MS;
  return DAY_MS - (elapsed < 0 ? elapsed + DAY_MS : elapsed);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
