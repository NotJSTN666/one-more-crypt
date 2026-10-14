// Local save data. Wrapped in try/catch because storage can be blocked
// (private windows, embedded webviews such as the X in-app browser).

export interface RunResult {
  floor: number;
  kills: number;
  turns: number;
  relics: string;
  killedBy: string;
}

export interface Save {
  daily: Record<string, RunResult>;
  bestEndless: number;
  streak: { last: number; count: number };
  muted: boolean;
  seenHelp: boolean;
}

const KEY = 'cryptfall:v1';

function empty(): Save {
  return { daily: {}, bestEndless: 0, streak: { last: 0, count: 0 }, muted: false, seenHelp: false };
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

export function currentStreak(save: Save, today: number): number {
  return save.streak.last >= today - 1 ? save.streak.count : 0;
}
