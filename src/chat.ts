// Live chat: one room for every player, kept going. It opens as a drawer over whatever is on
// screen (so a run can carry on beside it on a computer), loads the newest messages, and new ones
// arrive as they're sent. The 💬 button shows a dot when something new came in while it was shut.
// The server (send_chat) has the final say on what can be posted; chat-filter.ts answers first.
import { chatProblem, CHAT_MAX, tidyChat } from './chat-filter';
import { chatRecent, OnlineError, sendChat, watchChat, type ChatLine } from './online';
import { esc } from './ui';
import { pxi } from './pixel-icons';
import { sfx } from './audio';

interface ChatHost {
  /** The signed-in player's account id and chosen name, or null for a guest or nobody. */
  me(): { id: string; name: string } | null;
  /** Sign in or pick a name, then come back to the chat. */
  signIn(then: () => void): void;
}

let host: ChatHost | null = null;
let ready = false;
let lines: ChatLine[] = [];
let unread = 0;
let drawer: HTMLElement | null = null;
const MUTED_KEY = 'omc:chat-muted';
const READ_KEY = 'omc:chat-read';

function muted(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(MUTED_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function setMuted(list: string[]) {
  try {
    localStorage.setItem(MUTED_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    // Private mode: the mute lasts until the page closes.
  }
}

function lastRead(): number {
  try {
    return Number(localStorage.getItem(READ_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markRead() {
  unread = 0;
  try {
    if (lines.length) localStorage.setItem(READ_KEY, String(lines[lines.length - 1].id));
  } catch {
    // ignore
  }
  paintChip();
}

let pingedAt = 0;
/** A soft ping for someone else's message (at most one every couple of seconds, so a busy room doesn't chime). */
function ping() {
  const now = Date.now();
  if (now - pingedAt < 2000) return;
  pingedAt = now;
  sfx.ping();
}

/** Start listening (once the game has settled). The 💬 button appears only if the server has a chat. */
export async function startChat(h: ChatHost) {
  host = h;
  const recent = await chatRecent();
  if (!recent) return;
  lines = recent;
  ready = true;
  const seen = lastRead();
  const me = host.me()?.id;
  unread = seen ? lines.filter((l) => l.id > seen && l.user_id !== me && !muted().includes(l.user_id)).length : 0;
  paintChip();
  sayTyping = await watchChat((line) => {
    if (lines.some((l) => l.id === line.id)) return;
    if (typers.delete(line.user_id)) paintTyping();
    lines.push(line);
    if (lines.length > 200) lines = lines.slice(-200);
    const fromOther = line.user_id !== host?.me()?.id && !muted().includes(line.user_id);
    if (fromOther) ping();
    if (drawer) {
      addLine(line);
      markRead();
    } else if (fromOther) {
      unread++;
      paintChip();
    }
  }, (id, name) => {
    if (id === host?.me()?.id || muted().includes(id)) return;
    typers.set(id, { name, until: Date.now() + TYPING_MS });
    paintTyping();
    window.setTimeout(paintTyping, TYPING_MS + 50);
  });
}

// ---- who is typing: each keyboard tells the room at most every few seconds, and a name shows
// for a few seconds after the last word from it ----
const TYPING_MS = 4000;
const typers = new Map<string, { name: string; until: number }>();
let sayTyping: ((id: string, name: string) => void) | null = null;
let saidTypingAt = 0;

function typingNames(): string[] {
  const now = Date.now();
  for (const [id, t] of typers) if (t.until <= now) typers.delete(id);
  return [...typers.values()].map((t) => t.name);
}

function typingText(names: string[]): string {
  if (!names.length) return '';
  if (names.length === 1) return `${esc(names[0])} is typing`;
  if (names.length === 2) return `${esc(names[0])} and ${esc(names[1])} are typing`;
  return 'Several people are typing';
}

/** The 💬 button bobs with dots while someone types; the drawer names them. */
function paintTyping() {
  const names = typingNames();
  document.querySelectorAll('[data-chat]').forEach((b) => b.classList.toggle('typing', names.length > 0));
  const line = drawer?.querySelector<HTMLElement>('.chat-typing');
  if (line) line.innerHTML = names.length ? `${typingText(names)}<span class="typing-dots"><i></i><i></i><i></i></span>` : '';
}

function noteTyping() {
  const me = host?.me();
  if (!me || !sayTyping || Date.now() - saidTypingAt < 2500) return;
  saidTypingAt = Date.now();
  sayTyping(me.id, me.name);
}

/** The 💬 button for the title screen's top row (empty until the chat is known to be there). */
export function chatChipHtml(id = 'title-chat'): string {
  if (!ready) return '';
  const typing = typingNames().length > 0;
  return `<button class="account-chip mute-chip chat-chip${typing ? ' typing' : ''}" ${id ? `id="${id}" ` : ''}data-chat aria-label="Chat${unread ? `, ${unread} new` : ''}"><span class="chat-bubble">${pxi('chat')}</span><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>${unread ? `<i class="news-dot"></i>` : ''}</button>`;
}

function paintChip() {
  const chips = document.querySelectorAll('#title-chat');
  chips.forEach((b) => (b.outerHTML = chatChipHtml()));
  // (the first time, the title screen is already up without one)
  if (!chips.length) document.querySelectorAll('#title-settings').forEach((b) => b.insertAdjacentHTML('beforebegin', chatChipHtml()));
  paintFab();
}

// ---- the 💬 button on other screens: a corner button over the menus, the Crypt Race lobby and
// the results, so the chat is never more than a tap away (not on the title, which has its own,
// and not over a run, the Night Shift or the story's world) ----
const NO_FAB = ['title', 'nightshift', 'hollow', 'choose', 'event', 'fused', 'build'];
let fab: HTMLElement | null = null;

function paintFab() {
  if (!ready) return;
  if (!fab) {
    fab = document.createElement('div');
    fab.id = 'chat-fab';
    document.body.appendChild(fab);
    const overlay = document.getElementById('overlay');
    if (overlay) new MutationObserver(placeFab).observe(overlay, { attributes: true, attributeFilter: ['hidden', 'data-screen'] });
  }
  fab.innerHTML = chatChipHtml('');
  placeFab();
}

function placeFab() {
  if (!fab) return;
  const overlay = document.getElementById('overlay');
  const shown = Boolean(overlay && !overlay.hidden && !NO_FAB.includes(overlay.dataset.screen ?? ''));
  fab.hidden = !shown;
}

document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest?.('[data-chat]')) {
    e.preventDefault();
    if (drawer) closeChat();
    else openChat();
  }
});

const time = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

function lineHtml(l: ChatLine): string {
  const mine = l.user_id === host?.me()?.id;
  return `<li class="chat-line${mine ? ' mine' : ''}" data-id="${l.id}"><button class="chat-name" data-user="${esc(l.user_id)}" data-name="${esc(l.name)}" ${mine ? 'disabled' : ''}>${esc(l.name)}</button><time>${time(l.created_at)}</time><p>${esc(l.body)}</p></li>`;
}

function visible(): ChatLine[] {
  const hide = muted();
  return lines.filter((l) => !hide.includes(l.user_id));
}

function addLine(l: ChatLine) {
  if (!drawer || muted().includes(l.user_id)) return;
  const list = drawer.querySelector('.chat-list')!;
  const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  drawer.querySelector('.chat-empty')?.remove();
  list.insertAdjacentHTML('beforeend', lineHtml(l));
  while (list.children.length > 200) list.firstElementChild?.remove();
  if (atEnd || l.user_id === host?.me()?.id) list.scrollTop = list.scrollHeight;
}

function footHtml(): string {
  const me = host?.me();
  if (!me) return `<button class="btn primary chat-signin">Sign in to chat</button>`;
  return `<form class="chat-form"><input class="chat-input" maxlength="${CHAT_MAX}" placeholder="Say something nice…" autocomplete="off" enterkeyhint="send" aria-label="Message"><button class="btn primary chat-send" type="submit" aria-label="Send">➤</button></form><p class="chat-status" role="status"></p>`;
}

export function openChat() {
  if (!ready || drawer) return;
  drawer = document.createElement('aside');
  drawer.className = 'chat-drawer';
  drawer.setAttribute('aria-label', 'Chat');
  const shown = visible();
  drawer.innerHTML = `
    <header><h2>💬 Crypt chat</h2><button class="chat-close" aria-label="Close chat">✕</button></header>
    <ul class="chat-list">${shown.length ? shown.map(lineHtml).join('') : '<li class="chat-empty">No one has said anything yet. Say hi!</li>'}</ul>
    <p class="chat-typing" aria-live="polite"></p>
    <p class="chat-rules">Be kind. No swearing, links or spam. Tap a name to mute them.</p>
    <div class="chat-foot">${footHtml()}</div>`;
  document.body.appendChild(drawer);
  const list = drawer.querySelector<HTMLElement>('.chat-list')!;
  list.scrollTop = list.scrollHeight;
  wire();
  markRead();
  paintTyping();
  requestAnimationFrame(() => drawer?.classList.add('open'));
}

export function closeChat() {
  const d = drawer;
  drawer = null;
  if (!d) return;
  d.classList.remove('open');
  window.setTimeout(() => d.remove(), 250);
}

function wire() {
  if (!drawer) return;
  const d = drawer;
  d.querySelector('.chat-close')!.addEventListener('click', closeChat);
  // Keys typed here are for the chat, not the hero.
  d.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeChat();
  });
  d.querySelector('.chat-signin')?.addEventListener('click', () => {
    closeChat();
    host?.signIn(() => openChat());
  });
  d.querySelector('.chat-list')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.chat-name');
    if (!b || b.disabled) return;
    const id = b.dataset.user ?? '';
    if (!id || !window.confirm(`Mute ${b.dataset.name}? You won't see their messages any more.`)) return;
    setMuted([...muted(), id]);
    d.querySelectorAll<HTMLElement>('.chat-name').forEach((n) => {
      if (n.dataset.user === id) n.closest('li')?.remove();
    });
  });
  const form = d.querySelector<HTMLFormElement>('.chat-form');
  const input = d.querySelector<HTMLInputElement>('.chat-input');
  const status = d.querySelector<HTMLElement>('.chat-status');
  if (!form || !input || !status) return;
  let sending = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const problem = chatProblem(input.value);
    status.textContent = problem ?? '';
    if (problem) return;
    sending = true;
    try {
      const line = await sendChat(tidyChat(input.value));
      input.value = '';
      if (!lines.some((l) => l.id === line.id)) {
        lines.push(line);
        addLine(line);
      }
      markRead();
    } catch (err) {
      status.textContent = err instanceof OnlineError ? err.message : 'Could not send that. Check your connection.';
    } finally {
      sending = false;
      input.focus();
    }
  });
  input.addEventListener('input', () => {
    status.textContent = '';
    if (input.value.trim()) noteTyping();
  });
  if (window.matchMedia('(pointer: fine)').matches) input.focus();
}
