// Builds the post people share to X after a run. Every share is an ad for the game,
// so it should read well in a feed and fit easily under the character limit.

import type { RunResult } from './storage';

export const GAME_NAME = 'WARDENFALL';

export function siteUrl(): string {
  return location.origin + location.pathname;
}

/** Wordle-style strip: one square per floor, a skull per boss slain, blood where you fell. */
export function descentStrip(floor: number, max = 12): string {
  const cells: string[] = [];
  for (let f = 1; f <= floor; f++) {
    if (f === floor) cells.push('🩸');
    else if (f % 5 === 0) cells.push('💀');
    else cells.push('🟪');
  }
  if (cells.length > max) return '…' + cells.slice(-max).join('');
  return cells.join('');
}

export function shareText(r: RunResult, label: string): string {
  return [
    `🕯️ ${GAME_NAME} · ${label}`,
    `${descentStrip(r.floor)}`,
    `Fell on floor ${r.floor}${r.hero ? ` as the ${r.hero}` : ''} to ${r.killedBy} · ${r.kills} kills`,
    r.relics ? `Relics: ${r.relics}` : 'No relics. Pure skill.',
    ...(r.combos ? [`Combos: ${r.combos}`] : []),
    `How deep can you go?`,
  ].join('\n');
}

export function xIntentUrl(text: string): string {
  const params = new URLSearchParams({ text, url: siteUrl() });
  return `https://x.com/intent/post?${params.toString()}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
