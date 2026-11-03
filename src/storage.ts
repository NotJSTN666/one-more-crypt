import type { RunSubmission } from './online';

// Local save data. Wrapped in try/catch because storage can be blocked
// (private windows, embedded webviews such as the X in-app browser).

export interface RunResult {
  floor: number;
  kills: number;
  turns: number;
  relics: string;
  killedBy: string;
  /** Hero name, e.g. "Rogue". */
  hero?: string;
  /** Combos completed this run, e.g. "🔥 Inferno". */
  combos?: string;
  /** Seconds of active play. */
  seconds?: number;
}

export interface Save {
  daily: Record<string, RunResult>;
  bestEndless: number;
  streak: { last: number; count: number };
  muted: boolean;
  musicOff: boolean;
  /** Display settings: no screen shake, and the high-contrast board. */
  shakeOff: boolean;
  highContrast: boolean;
  seenHelp: boolean;
  tutorialDone: boolean;
  /** True once the player has seen (or skipped) the sign-in screen. */
  seenLogin: boolean;
  /** Same, for the online sign-in screen, so offline players still get asked once leaderboards go live. */
  seenOnlineLogin: boolean;
  /** Name used when playing offline. */
  name: string;
  totals: { runs: number; kills: number; bestDaily: number };
  /** Finished runs waiting to be uploaded to the leaderboard. */
  pending: RunSubmission[];
}

// Named after the game's launch title; kept so existing players keep their progress.
const KEY = 'cryptfall:v1';

function empty(): Save {
  return {
    daily: {},
    bestEndless: 0,
    streak: { last: 0, count: 0 },
    muted: false,
    musicOff: false,
    shakeOff: false,
    highContrast: false,
    seenHelp: false,
    tutorialDone: false,
    seenLogin: false,
    seenOnlineLogin: false,
    name: '',
    totals: { runs: 0, kills: 0, bestDaily: 0 },
    pending: [],
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

export function writeSave(save: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage unavailable; progress just won't persist.
  }
}

/** Record a finished daily run and update the play streak. */
export function recordDaily(save: Save, dailyNo: number, result: RunResult) {
  if (save.daily[dailyNo]) return;
  save.daily[dailyNo] = result;
  if (save.streak.last === dailyNo - 1) save.streak.count += 1;
  else if (save.streak.last !== dailyNo) save.streak.count = 1;
  save.streak.last = dailyNo;
}

export interface StreakStats {
  /** Days in a row ending today, or yesterday if today isn't played yet. 0 once broken. */
  current: number;
  /** The longest run of days in a row ever. */
  best: number;
  /** The last daily played, and the run of days ending there. */
  last: number;
  count: number;
  /** Grave Wards ready in the streak under way: each covers one missed day. */
  wards: number;
  /** Dailies played in all, in a row or not. */
  total: number;
}

/** Every this-many days in a streak earns a Grave Ward, which covers one missed day. */
export const WARD_EVERY = 7;

/** Play streak from the dailies on record (on a signed-in account, from every device). */
export function streakStats(save: Save, today: number): StreakStats {
  const days = Object.keys(save.daily).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  let best = 0;
  let count = 0;
  let last = 0;
  // Grave Wards spent in the streak under way: one carries it over a single missed day.
  let used = 0;
  const wardsLeft = () => Math.floor(count / WARD_EVERY) - used;
  for (const d of days) {
    if (d === last + 1) count++;
    else if (d === last + 2 && wardsLeft() > 0) {
      count++;
      used++;
    } else {
      count = 1;
      used = 0;
    }
    last = d;
    best = Math.max(best, count);
  }
  // Older saves kept only a counter.
  if (save.streak.last > last || (save.streak.last === last && save.streak.count > count)) {
    last = save.streak.last;
    count = save.streak.count;
  }
  best = Math.max(best, count);
  // A ward keeps the streak alive through one missed day.
  const alive = last >= today - 1 || (last === today - 2 && wardsLeft() > 0);
  return { current: alive ? count : 0, best, last, count, wards: Math.max(0, wardsLeft()), total: days.length };
}

export function currentStreak(save: Save, today: number): number {
  return streakStats(save, today).current;
}
