// Small DOM helpers shared by every screen.

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const overlay = $('overlay');

/** Which overlay is showing, so background updates only redraw the screen they belong to. */
export let screen = '';

/** Screens shown during a run keep the board visible behind them; the rest are menus. */
const RUN_SCREENS = ['choose', 'event', 'pause'];

export function showOverlay(name: string, html: string) {
  screen = name;
  const menu = !RUN_SCREENS.includes(name);
  document.body.classList.toggle('menu', menu);
  overlay.classList.toggle('menu', menu);
  overlay.innerHTML = `<div class="panel">${html}</div>`;
  overlay.hidden = false;
  overlay.scrollTop = 0;
}

export function hideOverlay() {
  screen = '';
  document.body.classList.remove('menu');
  overlay.classList.remove('menu');
  overlay.hidden = true;
  overlay.innerHTML = '';
}

export function on(selector: string, fn: () => void) {
  overlay.querySelector(selector)?.addEventListener('click', fn);
}

export function onSubmit(selector: string, fn: (form: HTMLFormElement) => void) {
  const form = overlay.querySelector<HTMLFormElement>(selector);
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    fn(form);
  });
}

export function field(form: HTMLFormElement, name: string): string {
  return (form.elements.namedItem(name) as HTMLInputElement).value.trim();
}

/** Show an inline error (or clear it) and re-enable the form's buttons. */
export function formStatus(form: HTMLFormElement, message: string, busy = false) {
  const status = form.querySelector('.form-status');
  if (status) status.textContent = message;
  form.querySelectorAll('button').forEach((b) => (b.disabled = busy));
}

export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

let toastTimer = 0;
export function toast(msg: string) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2000);
}
