// The Android test: a card that slides up over the Daily's results asking players to help test
// the Google Play app. Two steps, as Google needs them: join the testers' Google Group, then opt
// in to the test and install. Shown only where it makes sense (not on iPhones, not inside the
// app itself, not on game portals, not on a new player's first dailies) and only until the test
// is done. Declining (No thanks, the ✕ or Escape) ends it for good, as does taking part; a
// player who only joins the group is asked again in three days to finish. The title page keeps
// a small "testers needed" link, for anyone who wants to join later.

import { calmMotion } from './ui';

export const TESTER_GROUP_URL = 'https://groups.google.com/g/one-more-crypt-testers';
export const TESTER_OPTIN_URL = 'https://play.google.com/apps/testing/com.onemorecrypt.app';
/** The test needs 14 days from 12 testers; after this the card stops showing. */
const ASK_UNTIL = Date.UTC(2026, 11, 20);
const KEY = 'omc:android-test';
const LATER_DAYS = 3;

function stored(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return 'no';
  }
}

function remember(v: string) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // asked again next time, which is fine
  }
}

/** Inside the Android app (its WebView adds this to the browser's name). */
export function inAndroidApp(): boolean {
  return /OneMoreCryptAndroid/.test(navigator.userAgent);
}

function onApple(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Where the test can be joined from at all: not on portals, iPhones or inside the app, and only while it runs. */
export function testerOffer(portal: boolean, now = Date.now()): boolean {
  return !portal && now < ASK_UNTIL && !inAndroidApp() && !onApple();
}

/** Whether to ask after this Daily (the first one included). */
export function testerAskDue(portal: boolean, now = Date.now()): boolean {
  if (!testerOffer(portal, now)) return false;
  const s = stored();
  if (s === 'no' || s === 'joined') return false;
  const later = Number(s);
  return !later || now >= later;
}

/** Slide the card up over the results. Gone on its own if the player leaves the screen. */
export function showTesterAsk(stillHere: () => boolean) {
  if (document.getElementById('tester-ask')) return;
  const card = document.createElement('aside');
  card.id = 'tester-ask';
  card.className = `tester-ask${calmMotion() ? ' still' : ''}`;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'tester-ask-title');
  card.innerHTML = `
    <button type="button" class="tester-x" data-act="no" aria-label="No thanks">✕</button>
    <p class="tester-eyebrow">📱 One More Crypt for Android</p>
    <h3 id="tester-ask-title">Help test the Play Store app</h3>
    <p class="tester-why">Got an Android phone? Google needs 12 players to test the app for 14 days before it can launch. Same game, your progress carries over.</p>
    <a class="btn tester-step" href="${TESTER_GROUP_URL}" target="_blank" rel="noopener" data-act="group"><span class="tester-n">1</span><span>Join the testers' group<small>With the Google account you use for the Play Store</small></span></a>
    <a class="btn primary tester-step" href="${TESTER_OPTIN_URL}" target="_blank" rel="noopener" data-act="optin"><span class="tester-n">2</span><span>Become a tester and install<small>Tap "Become a tester", then install from the Play Store</small></span></a>
    <div class="tester-row">
      <button type="button" class="tester-link" data-act="no">No thanks</button>
    </div>`;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    card.classList.add('leaving');
    window.setTimeout(() => card.remove(), calmMotion() ? 0 : 220);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      remember('no');
      close();
    }
  };
  card.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'no') {
      remember('no');
      close();
    } else if (act === 'group') {
      // Step one done; ask again later in case they don't get to step two.
      remember(String(Date.now() + LATER_DAYS * 86400000));
    } else if (act === 'optin') {
      remember('joined');
      window.setTimeout(close, 400);
    }
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(card);
  // Leave with the results screen.
  const watch = window.setInterval(() => {
    if (!card.isConnected) return window.clearInterval(watch);
    if (!stillHere()) {
      window.clearInterval(watch);
      close();
    }
  }, 400);
}
