// The world boss: "The Bell Tolls". Every day at midnight (Central Time, with the Daily Crypt)
// the bell tolls and a boss rises for everyone, and it stays up all day. Each player fights it in
// a short arena, as often as they like; every hit lands on one shared health bar on the server.
// Bring it down together and everyone who fought it that day earns the next of the Bell-Breaker
// rewards (see RAID_REWARDS in progression.ts). Once it has fallen, anyone who still fights it
// that day shares the reward too.

import { BOSS_KINDS, ENEMY_INFO, fullPool, type EnemyKind, type RunConfig } from './game';
import type { HeroId } from './content';
import { hashSeed } from './rng';

const ZONE = 'America/Chicago';
const HOUR_MS = 3_600_000;

/** How long one fight lasts, in turns. */
export const RAID_TURNS = 75;
/** The shared health bar: this much per player who fights it (at least three players' worth). Keep in step with the SQL. */
export const RAID_HP_PER_PLAYER = 150;
export const RAID_MIN_PLAYERS = 3;
/** The arena: one boss floor, with a few relics to start. */
export const RAID_FLOOR = 10;
const RAID_GIFTS = 4;
const RAID_VIGOR = 12;
const RAID_BOSS_DMG = 2;
/** The boss in your own arena can take far more than one fight can deal. */
const ARENA_HP = 999;

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export interface RaidSlot {
  /** e.g. 2026-11-20: the Central date the boss is up. (Older tolls were by the hour: 2026-10-26-18.) */
  id: string;
  /** When it rose and when it leaves: midnight to midnight, Central (ms). */
  start: number;
  end: number;
  kind: EnemyKind;
}

/** The first moment of the Central day holding `t`. (Central is a whole number of hours from UTC, so its days start on UTC hours.) */
function dayStart(t: number): number {
  const day = dateFormat.format(t);
  let h = Math.floor(t / HOUR_MS) * HOUR_MS;
  while (dateFormat.format(h - HOUR_MS) === day) h -= HOUR_MS;
  return h;
}

function slotAt(t: number): RaidSlot {
  const start = dayStart(t);
  // (a day is 23 to 25 hours long when the clocks change)
  let end = start + 22 * HOUR_MS;
  const id = dateFormat.format(start);
  while (dateFormat.format(end) === id) end += HOUR_MS;
  return { id, start, end, kind: raidBoss(id) };
}

/** Who rises for this toll. */
export function raidBoss(id: string): EnemyKind {
  return BOSS_KINDS[hashSeed('raid-boss', id) % BOSS_KINDS.length];
}

export function raidBossName(kind: EnemyKind): string {
  return ENEMY_INFO[kind].name;
}

/** Today's boss (Central Time). */
export function currentRaid(now = Date.now()): RaidSlot {
  return slotAt(now);
}

/** Whether a new fight can still be started against this boss. */
export function raidJoinable(slot: RaidSlot, now = Date.now()): boolean {
  return now >= slot.start && now < slot.end;
}

/** Tomorrow's boss. */
export function nextRaid(now = Date.now()): RaidSlot {
  return slotAt(currentRaid(now).end);
}

/** The shared health bar for this many players. */
export function raidHp(players: number): number {
  return RAID_HP_PER_PLAYER * Math.max(RAID_MIN_PLAYERS, players);
}

/** The arena everyone fights in this toll: the same crypt for all, your own hero. */
export function raidConfig(slot: RaidSlot, hero: HeroId): { seed: number; config: RunConfig } {
  const kind = slot.kind;
  return {
    seed: hashSeed('raid', slot.id),
    config: {
      hero,
      pool: fullPool(),
      mercy: true,
      // Hardier than in a run, so a fight lasts long enough to matter.
      vigor: RAID_VIGOR,
      story: { start: RAID_FLOOR, end: RAID_FLOOR, gifts: RAID_GIFTS, boss: { floor: RAID_FLOOR, kind, hp: ARENA_HP, dmg: RAID_BOSS_DMG } },
    },
  };
}
