// The Wardrobe: dress each hero in an unlocked cloak (colour and aura) and headwear.
// The outfit is worn in every run, on Hall statues and next to your name on the
// leaderboards.

import { sfx } from './audio';
import { HEROES, HERO_BY_ID, type HeroId } from './content';
import { heroPortrait } from './hero';
import { equipOutfit, headUnlocked, heroUnlocked, lookUnlocked, meta, outfitFor, setPet } from './meta';
import { petName } from './story';
import { HEADS, HERO_CLOAKS, LOOKS, LOOK_BY_ID, HEAD_BY_ID } from './progression';
import { esc, on, overlay, showOverlay } from './ui';

/** The story's Crypt Hound, once met: it trots behind your hero in every crypt. Looks only. */
function companionHtml(): string {
  if (!meta.story.done.includes(2)) {
    return `<h3 class="shop-head">Companion</h3><p class="fine">🔒 Something is howling in the story's second chapter.</p>`;
  }
  const name = petName(meta.story.choices.hound);
  const card = (id: string, label: string, desc: string) => `<button class="look-card ${meta.pet === id ? 'equipped' : ''}" data-pet="${id}">
      <span class="name">${label}</span>
      ${meta.pet === id ? '<span class="worn">✓ With you</span>' : ''}
      <span class="desc">${desc}</span>
    </button>`;
  return `<h3 class="shop-head">Companion</h3>
    <p class="fine">Trots behind your hero in the daily and Endless. Looks only: it fights only in the story.</p>
    <div class="looks">
      ${card('hound', `🐕 ${esc(name)}`, 'The Crypt Hound. A good dog, all things considered.')}
      ${card('', 'None', 'Leave the hound by the fire.')}
    </div>`;
}

export function showWardrobe(back: () => void, hero: HeroId = meta.hero, changed?: () => void) {
  const owned = HEROES.filter((h) => heroUnlocked(h.id));
  if (!heroUnlocked(hero)) hero = owned[0].id;
  const fit = outfitFor(hero);
  // This hero's own pieces first, then the ones every hero can wear.
  const ownCloaks = HERO_CLOAKS.filter((c) => c.hero === hero);
  const allCloaks = [...ownCloaks, ...LOOKS];
  const allHeads = [...HEADS.filter((h) => h.hero === hero), ...HEADS.filter((h) => !h.hero)];
  const cloaks = allCloaks.filter((l) => lookUnlocked(l)).length;
  const heads = allHeads.filter((h) => headUnlocked(h)).length;
  const heroName = HERO_BY_ID[hero].name;

  const heroTabs = owned
    .map((h) => {
      const o = outfitFor(h.id);
      return `<button class="ward-hero ${h.id === hero ? 'selected' : ''}" data-hero="${h.id}" aria-pressed="${h.id === hero}" title="${esc(h.name)}">
        <img src="${heroPortrait(h.id, {}, [], 3, o.look, o.head)}" alt="${esc(h.name)}" width="36" height="36" />
      </button>`;
    })
    .join('');

  const piece = (part: 'look' | 'head', id: string, name: string, how: string, has: boolean, own = false) => {
    const worn = fit[part] === id;
    const preview = part === 'look' ? heroPortrait(hero, {}, [], 4, has ? id : '', fit.head) : heroPortrait(hero, {}, [], 4, fit.look, has ? id : '');
    return `<button class="look-card ${worn ? 'equipped' : ''}" data-part="${part}" data-id="${esc(id)}" ${has ? '' : 'disabled'}>
      <img src="${preview}" alt="" width="48" height="48" class="${has ? '' : 'locked-look'}" />
      <span class="name">${has ? '' : '🔒 '}${esc(name)}</span>
      ${own ? `<span class="own">${esc(heroName)} only</span>` : ''}
      ${worn ? '<span class="worn">✓ Wearing</span>' : ''}
      <span class="desc">${!id ? esc(how) : has ? (how.startsWith('Sold in the Ossuary') ? 'Bought in the Ossuary.' : `Earned: ${esc(how)}`) : esc(how)}</span>
    </button>`;
  };

  const look = LOOK_BY_ID[fit.look];
  const head = HEAD_BY_ID[fit.head];
  showOverlay('wardrobe', `
    <h2>Wardrobe</h2>
    <p class="sub">Dress each hero. Their outfit shows in every run, on your Hall statues and on the leaderboards.</p>
    <div class="ward-heroes">${heroTabs}</div>
    <div class="ward-preview">
      <img src="${heroPortrait(hero, {}, [], 10, fit.look, fit.head)}" alt="${esc(HERO_BY_ID[hero].name)} in their outfit" width="120" height="120" />
      <div>
        <b>${esc(HERO_BY_ID[hero].name)}</b>
        <span>${look ? esc(look.name) : 'Hero colours'} · ${head ? esc(head.name) : 'No headwear'}</span>
      </div>
    </div>
    <h3 class="shop-head">Headwear <small>${heads}/${allHeads.length}</small></h3>
    <p class="fine">The ${esc(heroName)}'s own headwear is earned by playing to their strengths.</p>
    <div class="looks">
      ${piece('head', '', 'None', 'Just the hood.', true)}
      ${allHeads.map((h) => piece('head', h.id, h.name, h.how, headUnlocked(h), Boolean(h.hero))).join('')}
    </div>
    <h3 class="shop-head">Cloak <small>${cloaks}/${allCloaks.length}</small></h3>
    <div class="looks">
      ${piece('look', '', 'Hero colours', 'Their own colours.', true)}
      ${allCloaks.map((l) => piece('look', l.id, l.name, l.how, lookUnlocked(l), 'hero' in l)).join('')}
    </div>
    ${companionHtml()}
    <button class="btn primary" id="back">Back</button>`);

  overlay.querySelectorAll<HTMLButtonElement>('[data-pet]').forEach((b) =>
    b.addEventListener('click', () => {
      setPet(b.dataset.pet ?? '');
      sfx.relic();
      const top = overlay.scrollTop;
      showWardrobe(back, hero, changed);
      overlay.scrollTop = top;
    }),
  );
  overlay.querySelectorAll<HTMLButtonElement>('.ward-hero').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.step();
      showWardrobe(back, b.dataset.hero as HeroId, changed);
    }),
  );
  overlay.querySelectorAll<HTMLButtonElement>('.look-card[data-part]').forEach((b) =>
    b.addEventListener('click', () => {
      equipOutfit(hero, b.dataset.part as 'look' | 'head', b.dataset.id ?? '');
      sfx.relic();
      changed?.();
      const top = overlay.scrollTop;
      showWardrobe(back, hero, changed);
      overlay.scrollTop = top;
    }),
  );
  on('#back', back);
}
