// Emoji in the menus drawn as the game's own pixel icons. Screens are written with emoji (they
// read well in the code, in shared text and in What's new); as they reach the page, each emoji
// that has a pixel icon is swapped for it, so the whole interface matches the pixel art.
// Text people wrote themselves (chat, names) and form fields keep their emoji, and anything
// copied or shared is built as text and never passes through here.

import { pxi, type PixelIcon } from './pixel-icons';

/** Emoji (without the variation selector) and the pixel icon drawn in their place. */
export const EMOJI_ICON: Record<string, PixelIcon> = {
  '📜': 'scroll',
  '💀': 'skull',
  '☠': 'skull',
  '✨': 'sparkle',
  '🕯': 'candle',
  '🔔': 'bell',
  '🛎': 'bell',
  '🔥': 'fire',
  '⚔': 'swords',
  '🗡': 'sword',
  '🎨': 'palette',
  '🎁': 'gift',
  '🛡': 'shield',
  '❄': 'snowflake',
  '💬': 'chat',
  '🔒': 'lock',
  '🎩': 'tophat',
  '🪙': 'coin',
  '👻': 'ghost',
  '🥇': 'gold',
  '🏅': 'gold',
  '🥈': 'silver',
  '🥉': 'bronze',
  '🌙': 'moon',
  '👑': 'crown',
  '❤': 'heart',
  '⚡': 'bolt',
  '🏰': 'castle',
  '❔': 'help',
  '📖': 'book',
  '📕': 'book',
  '👥': 'friends',
  '🎯': 'target',
  '🏆': 'trophy',
  '🪦': 'grave',
  '🦴': 'bones',
  '✅': 'check',
  '📧': 'letter',
  '📨': 'letter',
  '📬': 'letter',
  '✉': 'letter',
  '🏛': 'ossuary',
  '♾': 'infinity',
  '⏳': 'hourglass',
  '⌛': 'hourglass',
  '⚙': 'gear',
  '📱': 'phone',
  '📲': 'phone',
  '🔊': 'sound',
  '🔇': 'mute',
  '🧥': 'cloak',
  '👘': 'cloak',
  '🗺': 'map',
  '📋': 'scroll',
  '📤': 'share',
  '🏹': 'bow',
  '🩸': 'drop',
  '🎲': 'dice',
  '🧪': 'potion',
  '👤': 'person',
  '🎵': 'music',
  '🎶': 'music',
  '🎼': 'music',
  '📷': 'camera',
  '🗝': 'key',
  '🌅': 'sun',
  '🌄': 'sun',
  '☀': 'sun',
  '🎃': 'pumpkin',
  '🐞': 'bug',
  '💡': 'idea',
  '📅': 'calendar',
};

const VS = /\uFE0F/g;
const ANY = new RegExp(`(${Object.keys(EMOJI_ICON).join('|')})\\uFE0F?`, 'gu');
/** Where emoji stay as they are: what players typed, and form fields. */
const KEEP = 'textarea, input, select, option, pre, code, svg, .chat-list, [data-pname], [data-keep-emoji]';

/** Swap every known emoji under `root` for its pixel icon. */
export function pixelizeEmoji(root: Node) {
  if (typeof document === 'undefined') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    ANY.lastIndex = 0;
    if (!t.data || !ANY.test(t.data)) continue;
    const parent = t.parentElement;
    if (!parent || parent.closest(KEEP)) continue;
    hits.push(t);
  }
  for (const t of hits) {
    const span = document.createElement('span');
    span.innerHTML = t.data
      .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
      .replace(ANY, (m) => pxi(EMOJI_ICON[m.replace(VS, '')]));
    t.replaceWith(...span.childNodes);
  }
}

/** Keep the page's emoji as pixel icons from now on, whatever draws them. */
export function startEmojiIcons() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  pixelizeEmoji(document.body);
  let queued: Node[] = [];
  let pending = false;
  const flush = () => {
    pending = false;
    const nodes = queued;
    queued = [];
    for (const n of nodes) if (n.isConnected) pixelizeEmoji(n.nodeType === Node.TEXT_NODE ? n.parentNode ?? n : n);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') queued.push(r.target);
      else r.addedNodes.forEach((n) => queued.push(n));
    }
    if (queued.length && !pending) {
      pending = true;
      // before the next paint, so an emoji never shows for a frame
      queueMicrotask(flush);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
