// Name styles: how a player's name looks on the leaderboards. An ink (its colour) and an
// effect (something it does), each earned by playing: inks for Dailies played and depths
// reached, effects for streaks, world bosses, depth and winning a Daily. The choice lives in
// the player's saved progress (meta.nameStyle), which the boards read for everyone.

import { deepestFloor, meta, podiumCount, saveMeta } from './meta';

export type Need =
  | { kind: 'start' }
  | { kind: 'dailies'; n: number }
  | { kind: 'floor'; n: number }
  | { kind: 'streak'; n: number }
  | { kind: 'bosses'; n: number }
  | { kind: 'champion' };

export interface StyleDef {
  id: string;
  name: string;
  need: Need;
}

export interface NameStyle {
  ink: string;
  fx: string;
}

/** Inks for Dailies played, on any days. (No ink keeps the colour of your Soul rank.) */
export const INKS: StyleDef[] = [
  { id: 'bone', name: 'Bone', need: { kind: 'start' } },
  { id: 'gold', name: 'Gold', need: { kind: 'dailies', n: 3 } },
  { id: 'ember', name: 'Ember', need: { kind: 'dailies', n: 5 } },
  { id: 'wisp', name: 'Wisp', need: { kind: 'dailies', n: 7 } },
  { id: 'moss', name: 'Moss', need: { kind: 'dailies', n: 10 } },
  { id: 'blood', name: 'Blood', need: { kind: 'dailies', n: 15 } },
  { id: 'hex', name: 'Hex', need: { kind: 'dailies', n: 20 } },
  { id: 'pyre', name: 'Pyre', need: { kind: 'dailies', n: 30 } },
];

/** Inks for reaching each depth once (depth.ts), in any mode. */
export const DEPTH_INKS: StyleDef[] = [
  { id: 'deep', name: 'Deep', need: { kind: 'floor', n: 21 } },
  { id: 'under', name: 'Under', need: { kind: 'floor', n: 101 } },
  { id: 'reaper', name: 'Reaper', need: { kind: 'floor', n: 151 } },
  { id: 'starless', name: 'Starless', need: { kind: 'floor', n: 301 } },
];

export const EFFECTS: StyleDef[] = [
  { id: 'drip', name: 'Drip', need: { kind: 'streak', n: 3 } },
  { id: 'glow', name: 'Glow', need: { kind: 'streak', n: 7 } },
  { id: 'flame', name: 'Flame', need: { kind: 'streak', n: 14 } },
  { id: 'frost', name: 'Frost', need: { kind: 'streak', n: 30 } },
  { id: 'embers', name: 'Embers', need: { kind: 'bosses', n: 5 } },
  { id: 'haunted', name: 'Haunted', need: { kind: 'floor', n: 50 } },
  { id: 'shadow', name: 'Shadow', need: { kind: 'floor', n: 151 } },
  { id: 'starfall', name: 'Starfall', need: { kind: 'floor', n: 301 } },
  { id: 'gilded', name: 'Gilded', need: { kind: 'champion' } },
];

const ALL_INKS = [...INKS, ...DEPTH_INKS];
const INK_BY_ID = Object.fromEntries(ALL_INKS.map((s) => [s.id, s]));
const FX_BY_ID = Object.fromEntries(EFFECTS.map((s) => [s.id, s]));

/** How far along a need the player is. */
export function needHave(need: Need): number {
  switch (need.kind) {
    case 'start':
      return 1;
    case 'dailies':
      return meta.dailyTotal ?? 0;
    case 'floor':
      return deepestFloor();
    case 'streak':
      return meta.streak.best;
    case 'bosses':
      return meta.raid.won.length;
    case 'champion':
      return podiumCount(1);
  }
}

export function needMet(need: Need): boolean {
  if (meta.vault) return true;
  const n = need.kind === 'start' || need.kind === 'champion' ? 1 : need.n;
  return needHave(need) >= n;
}

/** What it takes, short: "3 Dailies", "Floor 151", "7-day streak". */
export function needText(need: Need): string {
  switch (need.kind) {
    case 'start':
      return 'Start';
    case 'dailies':
      return `${need.n} Dailies`;
    case 'floor':
      return `Floor ${need.n}`;
    case 'streak':
      return `${need.n}-day streak`;
    case 'bosses':
      return `${need.n} world bosses`;
    case 'champion':
      return 'Win a Daily';
  }
}

/** A style from anywhere (the server, an old save), kept only if every part is real. */
export function cleanStyle(raw: unknown): NameStyle | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ink = typeof o.ink === 'string' && INK_BY_ID[o.ink] ? o.ink : '';
  const fx = typeof o.fx === 'string' && FX_BY_ID[o.fx] ? o.fx : '';
  return ink || fx ? { ink, fx } : null;
}

/** The player's own style, worn only as far as it's still earned. */
export function myNameStyle(): NameStyle {
  const s = cleanStyle(meta.nameStyle) ?? { ink: '', fx: '' };
  return {
    ink: s.ink && needMet(INK_BY_ID[s.ink].need) ? s.ink : '',
    fx: s.fx && needMet(FX_BY_ID[s.fx].need) ? s.fx : '',
  };
}

export function setNameStyle(part: keyof NameStyle, id: string) {
  const def = part === 'ink' ? INK_BY_ID[id] : FX_BY_ID[id];
  if (id && (!def || !needMet(def.need))) return;
  meta.nameStyle = { ...myNameStyle(), [part]: id };
  saveMeta();
}

/** The classes that dress a name in a style. */
export function styleClass(s: NameStyle | null): string {
  if (!s) return '';
  return [s.ink ? `ns-ink-${s.ink}` : '', s.fx ? `ns-fx-${s.fx}` : ''].filter(Boolean).join(' ');
}

/** Every style earned so far, as "ink:gold" / "fx:drip" keys (to spot new ones after a run). */
export function earnedStyles(): string[] {
  return [...ALL_INKS.filter((s) => needMet(s.need)).map((s) => `ink:${s.id}`), ...EFFECTS.filter((s) => needMet(s.need)).map((s) => `fx:${s.id}`)];
}

/** The name of a style key from earnedStyles(). */
export function styleName(key: string): string {
  const [part, id] = key.split(':');
  return (part === 'ink' ? INK_BY_ID[id] : FX_BY_ID[id])?.name ?? id;
}

// ---------- on the boards ----------

/** Other players' styles, by name, as last fetched. */
const known = new Map<string, { style: NameStyle | null; at: number }>();
const FRESH_MS = 5 * 60_000;

function dress(el: HTMLElement, s: NameStyle | null) {
  el.classList.add('pname');
  if (!s) return;
  for (const c of [...el.classList]) if (c.startsWith('ns-')) el.classList.remove(c);
  const cls = styleClass(s);
  if (cls) el.classList.add(...cls.split(' '));
  // an ink replaces the Soul-rank colour
  if (s.ink) el.style.removeProperty('color');
}

/**
 * Dress every name under `root` marked with data-pname: yours straight away, everyone else's
 * once fetched. `fetch` looks up styles by player name.
 */
export function paintNames(root: ParentNode, me: string, fetch: ((names: string[]) => Promise<Record<string, unknown>>) | null) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-pname]')];
  const now = Date.now();
  const missing = new Set<string>();
  for (const el of els) {
    const name = el.dataset.pname ?? '';
    if (name && name === me) dress(el, myNameStyle());
    else if (known.has(name)) dress(el, known.get(name)!.style);
    if (name && name !== me && (!known.has(name) || now - known.get(name)!.at > FRESH_MS)) missing.add(name);
  }
  if (!fetch || !missing.size) return;
  void fetch([...missing].slice(0, 200))
    .then((found) => {
      for (const name of missing) known.set(name, { style: cleanStyle(found[name]), at: Date.now() });
      for (const el of els) {
        const name = el.dataset.pname ?? '';
        if (el.isConnected && name !== me && known.has(name)) dress(el, known.get(name)!.style);
      }
    })
    .catch(() => undefined);
}
