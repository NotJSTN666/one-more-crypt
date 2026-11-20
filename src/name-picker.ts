// Choosing how you appear on the boards: your name's ink and effect (name-style.ts) and your
// title. Shown on the profile (tap your name on the title screen) and in the Hall's Name tab.

import { sfx } from './audio';
import { equipTitle, meta, unlockedTitles } from './meta';
import { DEPTH_INKS, EFFECTS, INKS, myNameStyle, needHave, needMet, needText, setNameStyle, styleClass, type StyleDef } from './name-style';
import { TITLE_BY_ID, rankFor, titleFxClass } from './progression';
import { esc, overlay } from './ui';

/** Your name as the boards show it, with your title under it. */
export function namePreviewHtml(name: string): string {
  const mine = myNameStyle();
  const title = (meta.title && TITLE_BY_ID[meta.title]?.name) || '';
  return `<div class="ns-preview"><small>HOW OTHERS SEE YOU</small>
    <span class="pname ${styleClass(mine)}" style="${mine.ink ? '' : `color:${rankFor(meta.earned).color}`}">${esc(name || 'You')}</span>
    ${title ? `<em class="title-tag ${titleFxClass(meta.title)}">${esc(title)}</em>` : '<em class="fine">No title</em>'}
  </div>`;
}

/** The inks and effects, earned and still to earn. */
export function namePickerHtml(): string {
  const mine = myNameStyle();
  const opt = (part: 'ink' | 'fx', d: StyleDef | null) => {
    const id = d?.id ?? '';
    const has = !d || needMet(d.need);
    const on = mine[part] === id;
    const look = part === 'ink' ? styleClass({ ink: id, fx: '' }) : styleClass({ ink: '', fx: id });
    const note = !has ? `🔒 ${esc(needText(d!.need))}` : !d ? (part === 'ink' ? 'Soul rank colour' : 'Start') : d.need.kind === 'start' ? 'Start' : esc(needText(d.need));
    return `<button class="ns-opt ${on ? 'on' : ''}" data-ns="${part}:${id}" ${has ? '' : 'disabled'} aria-pressed="${on}">
      <span class="pname ${look}">${d ? esc(d.name) : part === 'ink' ? 'Rank' : 'None'}</span><small>${note}</small>
    </button>`;
  };
  const dailies = needHave({ kind: 'dailies', n: 0 });
  const next = INKS.find((d) => !needMet(d.need));
  const nextNeed = next?.need.kind === 'dailies' ? next.need.n : 0;
  const prev = [...INKS].reverse().find((d) => needMet(d.need) && d.need.kind === 'dailies');
  const from = prev?.need.kind === 'dailies' ? prev.need.n : 0;
  const pct = nextNeed ? Math.round(((dailies - from) / (nextNeed - from)) * 100) : 100;
  return `
    <h3 class="shop-head">Ink <small>Dailies played: ${dailies}</small></h3>
    <div class="ns-grid">${opt('ink', null)}${INKS.map((d) => opt('ink', d)).join('')}</div>
    ${next ? `<div class="rank-track small"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div><p class="fine">${nextNeed - dailies} more ${nextNeed - dailies === 1 ? 'Daily' : 'Dailies'} to ${esc(next.name)}</p>` : ''}
    <h3 class="shop-head">Depth inks <small>Reach it once, any mode</small></h3>
    <div class="ns-grid">${DEPTH_INKS.map((d) => opt('ink', d)).join('')}</div>
    <h3 class="shop-head">Effect <small>Streaks, bosses, depth and wins</small></h3>
    <div class="ns-grid">${opt('fx', null)}${EFFECTS.map((d) => opt('fx', d)).join('')}</div>`;
}

/** The titles you hold, in a dropdown that shows each in its own style, to wear one (or none). */
export function titlePickerHtml(): string {
  const owned = unlockedTitles();
  const current = (meta.title && TITLE_BY_ID[meta.title]?.name) || '';
  const item = (id: string, name: string) =>
    `<button class="ns-title-opt ${meta.title === id ? 'on' : ''}" role="option" aria-selected="${meta.title === id}" data-pick-title="${esc(id)}">${id ? `<span class="title-tag ${titleFxClass(id)}">${esc(name)}</span>` : '<span class="fine">No title</span>'}${meta.title === id ? '<b>✓</b>' : ''}</button>`;
  return `
    <h3 class="shop-head">Title <small>${owned.length} earned</small></h3>
    <details class="ns-title-select">
      <summary aria-label="Choose a title">${current ? `<span class="title-tag ${titleFxClass(meta.title)}">${esc(current)}</span>` : '<span class="fine">No title</span>'}<i aria-hidden="true">▾</i></summary>
      <div class="ns-title-list" role="listbox">${item('', '')}${owned.map((t) => item(t.id, t.name)).join('')}</div>
    </details>
    ${owned.length ? '' : '<p class="fine">Earn titles by winning Dailies, filling the Bestiary, finishing the story and more. See them all in your Hall.</p>'}`;
}

/** Make the pickers work: `redraw` draws the screen again after a choice. */
export function wireNamePicker(redraw: () => void, changed?: () => void) {
  overlay.querySelectorAll<HTMLButtonElement>('[data-ns]').forEach((b) =>
    b.addEventListener('click', () => {
      const [part, id] = (b.dataset.ns ?? '').split(':');
      setNameStyle(part as 'ink' | 'fx', id ?? '');
      sfx.relic();
      changed?.();
      redraw();
    }),
  );
  overlay.querySelectorAll<HTMLButtonElement>('[data-pick-title]').forEach((b) =>
    b.addEventListener('click', () => {
      equipTitle(b.dataset.pickTitle ?? '');
      sfx.relic();
      changed?.();
      redraw();
    }),
  );
}
