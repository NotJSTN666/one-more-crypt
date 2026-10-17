// Daily bounties: three small tasks a day for Souls, an easy, a medium and a hard one.
// Progress builds up over every run that day, daily and Endless alike. The day's three
// are fixed when the day starts, so unlocking a hero midway doesn't swap them out.
import { HERO_BY_ID, type HeroId } from './content';
import type { EnemyKind, Game } from './game';
import { meta, saveMeta, type UnlockNote } from './meta';
import { hashSeed } from './rng';

type Measure = 'sum' | 'max';

interface BountyDef {
  text: string;
  goal: number;
  measure: Measure;
  /** What a finished run adds (sum) or reaches (max). */
  value: (g: Game) => number;
}

const SOULS = [40, 80, 150];

const kills = (kind: EnemyKind) => (g: Game) => g.stats.kinds[kind] ?? 0;
const bosses = (g: Game) => Object.values(g.stats.bosses).reduce((a, n) => a + (n ?? 0), 0);
const endlessFloor = (g: Game) => (g.mode === 'endless' ? g.floor : 0);

/** Bounty ids by tier. `hero:<id>` ids are filled in with one of the player's heroes. */
const TIERS: string[][] = [
  ['ghouls', 'bats', 'archers', 'floor8', 'daily'],
  ['elites', 'hero', 'endless15', 'brutes', 'wraiths', 'bosses2'],
  ['forge', 'endless25', 'kills150', 'bosses4'],
];

function def(id: string): BountyDef | null {
  const [key, arg] = id.split(':');
  switch (key) {
    case 'ghouls': return { text: 'Slay 25 ghouls', goal: 25, measure: 'sum', value: kills('ghoul') };
    case 'bats': return { text: 'Slay 15 blood bats', goal: 15, measure: 'sum', value: kills('bat') };
    case 'archers': return { text: 'Slay 10 skeleton archers', goal: 10, measure: 'sum', value: kills('archer') };
    case 'floor8': return { text: 'Reach floor 8 in any run', goal: 8, measure: 'max', value: (g) => g.floor };
    case 'daily': return { text: "Finish today's Daily Descent", goal: 1, measure: 'sum', value: (g) => (g.mode === 'daily' ? 1 : 0) };
    case 'elites': return { text: 'Slay 5 elites', goal: 5, measure: 'sum', value: (g) => g.stats.elites };
    case 'brutes': return { text: 'Slay 8 grave brutes', goal: 8, measure: 'sum', value: kills('brute') };
    case 'wraiths': return { text: 'Slay 10 wraiths', goal: 10, measure: 'sum', value: kills('wraith') };
    case 'bosses2': return { text: 'Slay 2 bosses', goal: 2, measure: 'sum', value: bosses };
    case 'endless15': return { text: 'Reach floor 15 in Endless', goal: 15, measure: 'max', value: endlessFloor };
    case 'hero': {
      const hero = HERO_BY_ID[arg as HeroId];
      if (!hero) return null;
      return { text: `Slay 60 foes as the ${hero.name}`, goal: 60, measure: 'sum', value: (g) => (g.hero === hero.id ? g.kills : 0) };
    }
    case 'forge': return { text: 'Fuse a relic at the Soul Forge', goal: 1, measure: 'sum', value: (g) => g.stats.fusions };
    case 'endless25': return { text: 'Reach floor 25 in Endless', goal: 25, measure: 'max', value: endlessFloor };
    case 'kills150': return { text: 'Slay 150 foes in one run', goal: 150, measure: 'max', value: (g) => g.kills };
    case 'bosses4': return { text: 'Slay 4 bosses', goal: 4, measure: 'sum', value: bosses };
    default: return null;
  }
}

function pick(today: number): string[] {
  return TIERS.map((ids, tier) => {
    const id = ids[hashSeed('bounty', today, tier) % ids.length];
    if (id !== 'hero') return id;
    const heroes = [...meta.heroes].sort();
    return `hero:${heroes[hashSeed('bounty-hero', today) % heroes.length] ?? 'knight'}`;
  });
}

/** Start the day's bounties if they haven't been set yet. */
export function ensureBounties(today: number) {
  if (meta.bounties.day === today && meta.bounties.ids.length === 3) return;
  meta.bounties = { day: today, ids: pick(today), progress: [0, 0, 0], done: [false, false, false] };
  saveMeta();
}

export interface BountyView {
  text: string;
  goal: number;
  progress: number;
  done: boolean;
  souls: number;
}

export function bountyList(today: number): BountyView[] {
  ensureBounties(today);
  const b = meta.bounties;
  return b.ids.flatMap((id, i) => {
    const d = def(id);
    return d ? [{ text: d.text, goal: d.goal, progress: Math.min(d.goal, b.progress[i] ?? 0), done: Boolean(b.done[i]), souls: SOULS[i] }] : [];
  });
}

/** Count a finished run toward today's bounties. Pays out any it completes. */
export function progressBounties(game: Game, today: number): { souls: number; lines: [string, number][]; notes: UnlockNote[] } {
  ensureBounties(today);
  const b = meta.bounties;
  const out = { souls: 0, lines: [] as [string, number][], notes: [] as UnlockNote[] };
  b.ids.forEach((id, i) => {
    const d = def(id);
    if (!d || b.done[i]) return;
    const v = d.value(game);
    b.progress[i] = d.measure === 'sum' ? (b.progress[i] ?? 0) + v : Math.max(b.progress[i] ?? 0, v);
    if (b.progress[i] >= d.goal) {
      b.done[i] = true;
      out.souls += SOULS[i];
      out.lines.push([`Bounty: ${d.text}`, SOULS[i]]);
      out.notes.push({ icon: '📜', title: `Bounty complete: ${d.text}`, detail: `+${SOULS[i]} Souls` });
    }
  });
  meta.souls += out.souls;
  meta.earned += out.souls;
  saveMeta();
  return out;
}

/** The title screen's bounty card. */
export function bountiesHtml(today: number): string {
  const list = bountyList(today);
  const done = list.filter((b) => b.done).length;
  const rows = list
    .map(
      (b) => `<li class="${b.done ? 'done' : ''}"><span>${b.done ? '✅' : '📜'} ${b.text}</span><span class="bounty-n">${b.done ? `+${b.souls}` : `${b.progress}/${b.goal} · ${b.souls}💀`}</span></li>`,
    )
    .join('');
  return `<details class="card bounties" ${done < list.length ? 'open' : ''}>
      <summary>Today's bounties · ${done}/${list.length} done</summary>
      <ul>${rows}</ul>
      <p class="fine">Any run counts. New bounties at midnight Central.</p>
    </details>`;
}
