// The world boss: "The Bell Tolls". A few times a day (Central Time) a boss rises for
// everyone at once. Each player fights it in a short arena; every hit lands on one shared
// health bar on the server. Bring it down together and everyone who fought earns the next of
// the Bell-Breaker rewards (see RAID_REWARDS in progression.ts).

import { BOSS_KINDS, ENEMY_INFO, fullPool, type EnemyKind, type RunConfig } from './game';
import type { HeroId } from './content';
import { hashSeed } from './rng';

const ZONE = 'America/Chicago';
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

/** The hours (Central) the bell tolls: noon, 6 PM and 9 PM. Keep in step with the SQL. */
export const RAID_HOURS = [12, 18, 21];
/** Minutes after the toll that a fight can still be started. */
export const RAID_JOIN_MIN = 15;
/** Minutes after the toll that hits are still counted (a fight started late can finish). */
export const RAID_SUBMIT_MIN = 25;
/** How long one fight lasts, in turns. */
export const RAID_TURNS = 75;
/** The shared health bar: this much per player who joins (at least two players' worth). Keep in step with the SQL. */
export const RAID_HP_PER_PLAYER = 70;
/** The arena: one boss floor, with a few relics to start. */
export const RAID_FLOOR = 10;
const RAID_GIFTS = 4;
const RAID_VIGOR = 12;
const RAID_BOSS_DMG = 2;
/** The boss in your own arena can take far more than one fight can deal. */
const ARENA_HP = 999;

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', hourCycle: 'h23' });

export interface RaidSlot {
  /** e.g. 2026-10-26-18: the Central date and hour of the toll. */
  id: string;
  /** When the bell tolls (ms). */
  start: number;
  kind: EnemyKind;
}

function slotAt(hourStart: number): RaidSlot | null {
  const hour = Number(hourFormat.format(hourStart));
  if (!RAID_HOURS.includes(hour)) return null;
  const id = `${dateFormat.format(hourStart)}-${String(hour).padStart(2, '0')}`;
  return { id, start: hourStart, kind: raidBoss(id) };
}

/** Who rises for this toll. */
export function raidBoss(id: string): EnemyKind {
  return BOSS_KINDS[hashSeed('raid-boss', id) % BOSS_KINDS.length];
}

export function raidBossName(kind: EnemyKind): string {
  return ENEMY_INFO[kind].name;
}

/** The toll under way right now (hits still counted), if any. */
export function currentRaid(now = Date.now()): RaidSlot | null {
  // Central Time is a whole number of hours from UTC, so its hours start on UTC hours.
  const hourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const slot = slotAt(hourStart);
  return slot && now - slot.start < RAID_SUBMIT_MIN * MIN_MS ? slot : null;
}

/** Whether a new fight can still be started in this toll. */
export function raidJoinable(slot: RaidSlot, now = Date.now()): boolean {
  return now >= slot.start && now - slot.start < RAID_JOIN_MIN * MIN_MS;
}

/** The next toll that hasn't started yet. */
export function nextRaid(now = Date.now()): RaidSlot {
  let h = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  for (let i = 0; i < 48; i++, h += HOUR_MS) {
    const slot = slotAt(h);
    if (slot) return slot;
  }
  throw new Error('no raid hours');
}

/** The shared health bar for this many players. */
export function raidHp(players: number): number {
  return RAID_HP_PER_PLAYER * Math.max(2, players);
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

/** "6 PM" in the player's own time zone, for a toll. */
export function raidTimeLabel(start: number): string {
  return new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
