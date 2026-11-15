// The chat's rules, checked here for a quick answer and again on the server (send_chat in
// supabase/schema.sql), which has the final say. Keep the two word lists the same.

export const CHAT_MAX = 200;

// Words blocked whatever follows them (checked after letters doubled up are squeezed to one,
// so "fuuuck" and "fuck" read the same).
const STEMS = ['fuck', 'fuk', 'fck', 'shit', 'bitch', 'cunt', 'ashole', 'niger', 'niga', 'fagot', 'retard', 'twat', 'wank', 'whor', 'slut', 'motherf', 'pusy', 'bastard', 'porn', 'dildo', 'cuck', 'jackof', 'jerkof'];
// Words blocked only on their own (so "assist", "pistol", "cockatrice" and "night" are fine).
const WORDS = ['ass', 'asses', 'dick', 'dicks', 'cock', 'cocks', 'fag', 'fags', 'piss', 'pissed', 'tit', 'tits', 'rape', 'raped', 'kys', 'stfu', 'cum', 'hoe', 'hoes', 'thot', 'nazi'];

const LINK = /(https?:\/\/|www\.|discord\.gg|\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|ly|co|me|tv|app)\b)/i;

/** The message as it will be sent: trimmed, spaces tidied, a long run of one character cut to three. */
export function tidyChat(text: string): string {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(.)\1{3,}/gu, '$1$1$1');
}

/**
 * Lower case, with look-alike digits and symbols read as the letters they stand in for, and
 * letters typed apart ("f u c k", "f.u.c.k") joined back up.
 */
function plain(text: string): string {
  const swap: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i', '|': 'i' };
  return text.toLowerCase().replace(/[013457@$!|]/g, (c) => swap[c]).replace(/[^a-z]+/g, ' ').trim().replace(/(?<=\b[a-z]) (?=[a-z]\b)/g, '');
}

/** Whether the text has a blocked word in it. */
export function rude(text: string): boolean {
  const words = plain(text);
  const squeezed = words.replace(/([a-z])\1+/g, '$1');
  const each = words.split(' ');
  const eachSqueezed = squeezed.split(' ');
  return (
    each.some((w) => WORDS.includes(w)) ||
    eachSqueezed.some((w) => STEMS.some((s) => w.startsWith(s)) && !w.startsWith('nigeria'))
  );
}

/** Why the message can't be sent, or null when it's fine. */
export function chatProblem(text: string): string | null {
  const t = tidyChat(text);
  if (!t) return 'Type a message first.';
  if (t.length > CHAT_MAX) return `Keep it under ${CHAT_MAX} characters.`;
  if (LINK.test(t)) return 'No links in chat.';
  if (rude(t)) return 'Keep it clean. That word isn’t allowed.';
  return null;
}
