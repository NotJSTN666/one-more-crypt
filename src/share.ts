// Builds the post people share to X after a run. Every share is an ad for the game,
// so it should read well in a feed and fit easily under the character limit.

import type { RunResult } from './storage';

export const GAME_NAME = 'ONE MORE CRYPT';

/** The game's public address. The itch.io build sets VITE_PUBLIC_URL, since it runs in itch's frame. */
export function siteUrl(): string {
  return import.meta.env.VITE_PUBLIC_URL || location.origin + location.pathname;
}

/** Play time as "4:05" or "1:02:03". */
export function playTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
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

export function shareText(r: RunResult, label: string, beat: number | null = null): string {
  return [
    `${GAME_NAME} · ${label} 🕯️`,
    `${descentStrip(r.floor)}`,
    `Fell on floor ${r.floor}${r.hero ? ` as the ${r.hero}` : ''} to ${r.killedBy} · ${r.kills} kills`,
    ...(beat != null ? [`Beat ${beat}% of today's delvers`] : []),
    r.relics ? `Relics: ${r.relics}` : 'No relics. Pure skill.',
    ...(r.combos ? [`Combos: ${r.combos}`] : []),
    `How deep can you go? @${X_HANDLE}`,
  ].join('\n');
}

export const X_HANDLE = 'OneMoreCrypt';

/** "Follow us on X" link for the title and results screens. */
export const followXHtml = `<a class="follow-x" href="https://x.com/${X_HANDLE}" target="_blank" rel="noopener">𝕏 Follow @${X_HANDLE}</a>`;

export const KOFI_URL = 'https://ko-fi.com/onemorecrypt';
export const DISCORD_URL = 'https://discord.gg/V454sdbTQH';

/** The community server: results, deep runs, bugs and ideas. */
export const discordHtml = `<a class="follow-x discord" href="${DISCORD_URL}" target="_blank" rel="noopener">💬 Join the Discord</a>`;

/** The tip jar: free, no ads, tips keep the domain and servers running. */
export const kofiHtml = `<a class="follow-x kofi" href="${KOFI_URL}" target="_blank" rel="noopener">☕ Keep the crypt open</a>`;

export function xIntentUrl(text: string): string {
  // Everything goes in `text`, the link included. X's app ignores `via` and handles a
  // separate `url` field its own way, which left a gap at the top of the post.
  const params = new URLSearchParams({ text: `${text.trim()}\n${siteUrl()}` });
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
