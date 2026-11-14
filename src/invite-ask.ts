// Bring a friend: a card that slides up over the Daily's results, saying what an invite pays
// (Souls, a random companion and the Kindred Cloak, for both of you) with one button to send
// the link. It comes after every third Daily, at most once a day, never on game portals, and
// stops for good after two "No thanks" (or once the link has been shared from it twice).

import { calmMotion } from './ui';

const KEY = 'omc:invite-ask';
/** Shown after every this-many Dailies. */
const EVERY = 3;
const MAX_NO = 2;
const MAX_SHARED = 2;

interface State { day: number; count: number; no: number; shared: number; shownDay: number }

function read(): State {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<State>;
    return { day: Number(o.day) || 0, count: Number(o.count) || 0, no: Number(o.no) || 0, shared: Number(o.shared) || 0, shownDay: Number(o.shownDay) || 0 };
  } catch {
    return { day: 0, count: 0, no: MAX_NO, shared: 0, shownDay: 0 };
  }
}

function write(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the card just may come again.
  }
}

/** A Daily was finished: count it, once per day. */
export function noteDailyForInvite(dailyNo: number) {
  const s = read();
  if (s.day === dailyNo) return;
  s.day = dailyNo;
  s.count++;
  write(s);
}

/** Whether to show the card over this Daily's results. */
export function inviteAskDue(portal: boolean, dailyNo: number): boolean {
  if (portal) return false;
  const s = read();
  return s.no < MAX_NO && s.shared < MAX_SHARED && s.count > 0 && s.count % EVERY === 0 && s.shownDay !== dailyNo;
}

export function showInviteAsk(o: { souls: number; floor: number; portrait: string; pets: string; dailyNo?: number; stillHere: () => boolean; share: () => void | Promise<void> }) {
  if (document.getElementById('invite-ask') || document.getElementById('tester-ask')) return;
  if (o.dailyNo) {
    const s = read();
    s.shownDay = o.dailyNo;
    write(s);
  }
  const card = document.createElement('aside');
  card.id = 'invite-ask';
  card.className = `tester-ask invite-ask${calmMotion() ? ' still' : ''}`;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'invite-ask-title');
  card.innerHTML = `
    <button type="button" class="tester-x" data-act="no" aria-label="No thanks">✕</button>
    <div class="invite-ask-top">
      <img src="${o.portrait}" alt="Your hero in the Kindred Cloak" width="72" height="72" />
      <div>
        <p class="tester-eyebrow">👥 Bring a friend</p>
        <h3 id="invite-ask-title">You both get ${o.souls} Souls</h3>
        <p class="invite-ask-plus">plus a random companion ${o.pets} and the Kindred Cloak</p>
      </div>
    </div>
    <p class="tester-why">${o.floor > 1 ? `You reached <b>floor ${o.floor}</b> today. Dare a friend to beat it. ` : ''}It counts when they finish their first run, and every friend pays again.</p>
    <button type="button" class="btn primary" data-act="share">📤 Send my link</button>
    <div class="tester-row">
      <button type="button" class="tester-link" data-act="no">No thanks</button>
    </div>`;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    card.classList.add('leaving');
    window.setTimeout(() => card.remove(), calmMotion() ? 0 : 220);
  };
  const decline = () => {
    const s = read();
    s.no++;
    write(s);
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') decline();
  };
  card.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'no') decline();
    else if (act === 'share') {
      const s = read();
      s.shared++;
      write(s);
      close();
      void o.share();
    }
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(card);
  // Leave with the results screen.
  const watch = window.setInterval(() => {
    if (!card.isConnected) return window.clearInterval(watch);
    if (!o.stillHere()) {
      window.clearInterval(watch);
      close();
    }
  }, 400);
}
