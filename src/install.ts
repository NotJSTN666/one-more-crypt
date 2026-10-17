// Installing the game as an app: the browser's own install prompt where there is one
// (Chrome, Edge, Android), instructions for iPhone and iPad (Safari has no prompt), and
// nothing when the game is already installed or runs inside another page (itch.io).

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let listeners: (() => void)[] = [];

const framed = (() => {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
})();

function standalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function ios(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** What the install button should do right now. */
export function installMode(): 'prompt' | 'ios' | null {
  if (framed || standalone()) return null;
  if (deferred) return 'prompt';
  return ios() ? 'ios' : null;
}

/** Call back when the install option appears or goes away (the browser decides when). */
export function onInstallChange(cb: () => void) {
  listeners.push(cb);
}

/** Show the browser's install prompt. Resolves true if the player installed. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  listeners.forEach((cb) => cb());
  return outcome === 'accepted';
}

export function setupInstall() {
  if (framed) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((cb) => cb());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((cb) => cb());
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  }
}
