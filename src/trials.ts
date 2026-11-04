// The Weekly Trial: one goal a week, the same for everyone, met over the week's ordinary
// runs. It pays Souls, and trials completed add up to a cloak and an aura (see TRIAL_FEATS).

import { HERO_BY_ID, HEROES, type HeroId } from './content';
import { weekStart } from './daily';
import { hashSeed } from './rng';

export type TrialKind = 'kills' | 'bosses' | 'heroFloor' | 'horde' | 'night' | 'dailies' | 'vaults' | 'fusions';

export interface Trial {
  kind: TrialKind;
  /** How much is needed. */
  goal: number;
  /** For heroFloor: the hero this week. */
  hero?: HeroId;
  text: string;
}

/** Souls for completing a week's trial. */
export const TRIAL_SOULS = 300;

/** Trials completed, and the achievement each count earns. */
export const TRIAL_FEATS: [number, string][] = [[1, 'trial1'], [4, 'trial4'], [12, 'trial12']];

/** This week's trial: the same for everyone, picked from the week's Monday (Central Time). */
export function weekTrial(week = weekStart()): Trial {
  const h = hashSeed('trial', week);
  const hero = HEROES[h % HEROES.length].id;
  const all: Trial[] = [
    { kind: 'kills', goal: 400, text: 'Slay 400 foes in the crypt this week' },
    { kind: 'bosses', goal: 4, text: 'Slay 4 bosses in the crypt this week' },
    { kind: 'heroFloor', goal: 15, hero, text: `Reach floor 15 as the ${HERO_BY_ID[hero].name} this week` },
    { kind: 'horde', goal: 15, text: 'Hold the Horde to wave 15 this week' },
    { kind: 'night', goal: 600, text: 'Survive 10 minutes in one Night Shift this week' },
    { kind: 'dailies', goal: 5, text: 'Play 5 Daily Descents this week' },
    { kind: 'vaults', goal: 2, text: 'Find 2 secret vaults behind cracked walls this week' },
    { kind: 'fusions', goal: 4, text: 'Fuse 4 relics at the Soul Forge this week' },
  ];
  return all[(h >>> 3) % all.length];
}

/** Where a player stands on a trial. */
export interface TrialState {
  week: string;
  progress: number;
  done: boolean;
}

/** Something that happened in a run, to count toward the trial. */
export type TrialEvent =
  | { kind: 'run'; kills: number; bosses: number; hero: HeroId; floor: number; vaults: number; fusions: number; daily: boolean }
  | { kind: 'horde'; wave: number }
  | { kind: 'night'; seconds: number };

/**
 * Count an event toward this week's trial. Returns the new state, and whether it was
 * completed just now. Counts add up over the week; bests (a floor, a wave, a night) keep the best.
 */
export function advanceTrial(state: TrialState | undefined, e: TrialEvent, week = weekStart()): { state: TrialState; completed: boolean } {
  const t = weekTrial(week);
  const s: TrialState = state && state.week === week ? { ...state } : { week, progress: 0, done: false };
  if (s.done) return { state: s, completed: false };
  if (e.kind === 'run') {
    if (t.kind === 'kills') s.progress += e.kills;
    if (t.kind === 'bosses') s.progress += e.bosses;
    if (t.kind === 'heroFloor' && e.hero === t.hero) s.progress = Math.max(s.progress, e.floor);
    if (t.kind === 'dailies' && e.daily) s.progress += 1;
    if (t.kind === 'vaults') s.progress += e.vaults;
    if (t.kind === 'fusions') s.progress += e.fusions;
  }
  if (e.kind === 'horde' && t.kind === 'horde') s.progress = Math.max(s.progress, e.wave);
  if (e.kind === 'night' && t.kind === 'night') s.progress = Math.max(s.progress, Math.floor(e.seconds));
  const completed = s.progress >= t.goal;
  if (completed) s.done = true;
  return { state: s, completed };
}

/** Progress as words, e.g. "212 / 400" or "7:30 / 10:00". */
export function trialProgressText(t: Trial, s: TrialState | undefined): string {
  const p = s && s.week === weekStart() ? s.progress : 0;
  if (t.kind === 'night') {
    const m = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
    return `${m(Math.min(p, t.goal))} / ${m(t.goal)}`;
  }
  return `${Math.min(p, t.goal).toLocaleString()} / ${t.goal.toLocaleString()}`;
}
