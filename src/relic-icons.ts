// The relic icons: 24x24 pixel art, all in one small image (built by scripts/icons/build.mjs),
// drawn as an inline element the size of the text around it. Shared text (copied results,
// toasts) keeps the emoji; anything drawn on screen uses these.
import atlas from './assets/relic-icons.png?inline';
import { ICON_COUNT, ICON_INDEX } from './relic-icon-index';
import { RELICS } from './relics';

let styled = false;
function ensureStyle() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `.ri{display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.25em;background-image:url(${atlas});background-size:${ICON_COUNT * 100}% 100%;background-repeat:no-repeat;image-rendering:pixelated;flex:none}`;
  document.head.appendChild(s);
}

/** An icon by key ('m:fang', 'n:spikes', 'nf:cleaver', 'b:edge', 'bl:might', 'p:hunger'), or '' if there's none. */
export function icon(key: string, title = ''): string {
  const i = ICON_INDEX[key];
  if (i === undefined) return '';
  ensureStyle();
  const x = ICON_COUNT > 1 ? (i / (ICON_COUNT - 1)) * 100 : 0;
  return `<i class="ri" style="background-position:${x.toFixed(4)}% 0"${title ? ` title="${title.replace(/"/g, '&quot;')}"` : ''} aria-hidden="true"></i>`;
}

/** The icon if there is one, else the emoji it replaces. */
export const iconOr = (key: string, emoji: string) => icon(key) || emoji;
/** Main-game relics and fusions, Abyss boons, Night Shift relics, fusions, blessings and pacts. */
export const relicIcon = (id: string, emoji = '') => iconOr(`m:${id}`, emoji);
export const boonIcon = (id: string, emoji = '') => iconOr(`b:${id}`, emoji);
export const nightIcon = (id: string, emoji = '') => iconOr(`n:${id}`, emoji);
export const nightFusionIcon = (id: string, emoji = '') => iconOr(`nf:${id}`, emoji);
export const blessingIcon = (id: string, emoji = '') => iconOr(`bl:${id}`, emoji);
export const pactIcon = (id: string, emoji = '') => iconOr(`p:${id}`, emoji);

// The atlas as an image too, for canvases (the Soul Forge's fusion).
let sheet: HTMLImageElement | null = null;
if (typeof Image !== 'undefined') {
  sheet = new Image();
  sheet.src = atlas;
}
/** One icon on its own small canvas (24x24), or null if it isn't ready. */
export function iconCanvas(key: string): HTMLCanvasElement | null {
  const i = ICON_INDEX[key];
  if (i === undefined || !sheet || !sheet.complete || !sheet.naturalWidth) return null;
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  c.getContext('2d')!.drawImage(sheet, i * 24, 0, 24, 24, 0, 0, 24, 24);
  return c;
}

/**
 * A relic list saved as emoji (leaderboard rows, old results) drawn as icons: each emoji is
 * matched to the relic that uses it. Anything unknown stays as it was.
 */
let EMOJI_TO_RELIC: Map<string, string> | null = null;
export function iconsFromEmoji(text: string): string {
  if (!text) return '';
  if (!EMOJI_TO_RELIC) {
    EMOJI_TO_RELIC = new Map();
    for (const r of RELICS) {
      if (!EMOJI_TO_RELIC.has(r.emoji)) EMOJI_TO_RELIC.set(r.emoji, r.id);
      const bare = r.emoji.replace(/\uFE0F/g, '');
      if (!EMOJI_TO_RELIC.has(bare)) EMOJI_TO_RELIC.set(bare, r.id);
    }
  }
  const byEmoji = EMOJI_TO_RELIC;
  type Seg = { segment(t: string): Iterable<{ segment: string }> };
  const Segmenter = (Intl as unknown as { Segmenter?: new (l: undefined, o: { granularity: string }) => Seg }).Segmenter;
  const parts = Segmenter ? [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment) : [...text];
  return parts.map((ch) => {
    const id = byEmoji.get(ch) ?? byEmoji.get(ch.replace(/️/g, ''));
    return id ? relicIcon(id, ch) : ch.replace(/[<>&"]/g, '');
  }).join('');
}
