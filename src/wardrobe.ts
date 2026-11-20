// The Wardrobe: dress each hero in an unlocked cloak (colour and aura) and headwear.
// The outfit is worn in every run, on Hall statues and next to your name on the
// leaderboards.

import { sfx } from './audio';
import { HEROES, HERO_BY_ID, type HeroId } from './content';
import { heroPortrait } from './hero';
import { auraClass, drawAura } from './aura';
import { racePrizeOwned, wearRacePrize, auraUnlocked, equipOutfit, headUnlocked, heroUnlocked, lookUnlocked, meta, outfitFor, setPet } from './meta';
import { petName } from './story';
import { AURAS, AURA_BY_ID, HEADS, HERO_CLOAKS, LOOKS, LOOK_BY_ID, HEAD_BY_ID } from './progression';
import { esc, on, overlay, screen, showOverlay } from './ui';
import { COMPANIONS } from './companions';
import { FINISHERS, TRAILS, type RacePrize } from './race-prizes';

/** The story's Crypt Hound, once met: it trots behind your hero in every crypt. Looks only. */
/** Which sections are open (kept while you dress, so a pick doesn't fold the list away). */
const openSections = new Set<string>();

/** A Wardrobe section as a dropdown: shut, it says what's worn and how many you have. */
function section(id: string, title: string, worn: string, count: string, body: string): string {
  return `<details class="ward-section" data-sec="${id}"${openSections.has(id) ? ' open' : ''}>
    <summary><span class="ward-sec-title">${title}</span><span class="ward-sec-worn">${worn}</span><small>${count}</small><i aria-hidden="true">▾</i></summary>
    <div class="ward-sec-body">${body}</div>
  </details>`;
}

/** Owned pieces first, then the ones still to earn (each keeps its own order). */
function ownedFirst<T>(list: T[], has: (x: T) => boolean): T[] {
  return [...list.filter(has), ...list.filter((x) => !has(x))];
}

function companionHtml(): string {
  const hound = meta.story.done.includes(2);
  if (!hound && !meta.pets.length) {
    return section('pet', 'Companion', 'None yet', `0/${COMPANIONS.length + 1}`, `<p class="fine">🔒 Something is howling in the old kennels, in the story. Every friend you bring to the crypt brings a companion with them, and the Ossuary sells more.</p>`);
  }
  const name = petName(meta.story.choices.hound);
  const card = (id: string, label: string, desc: string) => `<button class="look-card ${meta.pet === id ? 'equipped' : ''}" data-pet="${id}">
      <span class="name">${label}</span>
      ${meta.pet === id ? '<span class="worn">✓ With you</span>' : ''}
      <span class="desc">${desc}</span>
    </button>`;
  const withYou = meta.pet === 'hound' ? `🐕 ${esc(name)}` : COMPANIONS.find((p) => p.id === meta.pet) ? `${COMPANIONS.find((p) => p.id === meta.pet)!.emoji} ${esc(COMPANIONS.find((p) => p.id === meta.pet)!.name)}` : 'None';
  return section('pet', 'Companion', withYou, `${meta.pets.length + (hound ? 1 : 0)}/${COMPANIONS.length + 1}`, `
    <p class="fine">Follows your hero in the daily and Endless. Looks only: the hound fights only in the story. Find more by bringing friends, or buy them in the Ossuary (${meta.pets.length}/${COMPANIONS.length} found).</p>
    <div class="looks">
      ${hound ? card('hound', `🐕 ${esc(name)}`, 'The Crypt Hound. A good dog, all things considered.') : ''}
      ${COMPANIONS.filter((p) => meta.pets.includes(p.id)).map((p) => card(p.id, `${p.emoji} ${esc(p.name)}`, esc(p.desc))).join('')}
      ${card('', 'None', 'Go down alone.')}
    </div>`);
}

/** Crypt Race prizes: trails and finishers, worn on every hero in every mode. */
function racePrizesHtml(): string {
  const prizes = (kind: 'trail' | 'finisher', title: string, blurb: string, list: RacePrize[]) => {
    const worn = meta.race[kind];
    const card = (id: string, label: string, desc: string, owned: boolean) => `<button class="look-card ${worn === id ? 'equipped' : ''} ${owned ? '' : 'locked'}" data-race-kind="${kind}" data-race-id="${id}" ${owned ? '' : 'disabled'}>
      <span class="name">${label}</span>
      ${worn === id ? '<span class="worn">✓ Worn</span>' : ''}
      <span class="desc">${desc}</span>
    </button>`;
    const wornPrize = list.find((p) => p.id === worn);
    return section(kind, title, wornPrize ? `${wornPrize.emoji} ${esc(wornPrize.name)}` : 'None', `${list.filter(racePrizeOwned).length}/${list.length}`, `
    <p class="fine">${blurb} Won with Laurels in Crypt Race (you have ${meta.race.laurels}), or on the Daily Descent's podium.</p>
    <div class="looks">
      ${card('', 'None', kind === 'trail' ? 'Leave no trace.' : 'Foes fall the usual way.', true)}
      ${ownedFirst(list, racePrizeOwned).map((p) => card(p.id, `${p.emoji} ${esc(p.name)}`, racePrizeOwned(p) ? esc(p.desc) : `🔒 ${p.how ? esc(p.how) : `${p.at} Laurels`}`, racePrizeOwned(p))).join('')}
    </div>`);
  };
  return prizes('trail', 'Trail', 'What your hero leaves behind as they walk.', TRAILS) + prizes('finisher', 'Finisher', 'How a foe you slay bursts apart.', FINISHERS);
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
  const aura = fit.aura ? AURA_BY_ID[fit.aura] : undefined;
  const auras = AURAS.filter((a) => auraUnlocked(a)).length;
  const auraCard = (id: string, name: string, how: string, has: boolean) => {
    const worn = (fit.aura ?? '') === id;
    const glow = auraClass(has ? id : '');
    return `<button class="look-card ${worn ? 'equipped' : ''}" data-part="aura" data-id="${esc(id)}" ${has ? '' : 'disabled'}>
      <img src="${heroPortrait(hero, {}, [], 4, fit.look, fit.head)}" alt="" width="48" height="48" class="${has ? glow.cls : 'locked-look'}" style="${glow.style}" />
      <span class="name">${has ? '' : '🔒 '}${esc(name)}</span>
      ${worn ? '<span class="worn">✓ Radiating</span>' : ''}
      <span class="desc">${!id ? esc(how) : has ? (how.startsWith('Sold in the Ossuary') ? 'Bought in the Ossuary.' : `Earned: ${esc(how)}`) : esc(how)}</span>
    </button>`;
  };
  showOverlay('wardrobe', `
    <h2>Wardrobe</h2>
    <p class="sub">Dress each hero. Their outfit shows in every run, on your Hall statues and on the leaderboards.</p>
    <div class="ward-heroes">${heroTabs}</div>
    <div class="ward-preview">
      <canvas id="ward-live" width="150" height="150" aria-label="${esc(HERO_BY_ID[hero].name)} in their outfit"></canvas>
      <div>
        <b>${esc(HERO_BY_ID[hero].name)}</b>
        <span>${look ? esc(look.name) : 'Hero colours'} · ${head ? esc(head.name) : 'No headwear'}${aura ? ` · ${esc(aura.name)}` : ''}</span>
      </div>
    </div>
    ${section('head', 'Headwear', head ? esc(head.name) : 'None', `${heads}/${allHeads.length}`, `
      <p class="fine">The ${esc(heroName)}'s own headwear is earned by playing to their strengths.</p>
      <div class="looks">
        ${piece('head', '', 'None', 'Just the hood.', true)}
        ${ownedFirst(allHeads, headUnlocked).map((h) => piece('head', h.id, h.name, h.how, headUnlocked(h), Boolean(h.hero))).join('')}
      </div>`)}
    ${section('look', 'Cloak', look ? esc(look.name) : 'Hero colours', `${cloaks}/${allCloaks.length}`, `
      <div class="looks">
        ${piece('look', '', 'Hero colours', 'Their own colours.', true)}
        ${ownedFirst(allCloaks, lookUnlocked).map((l) => piece('look', l.id, l.name, l.how, lookUnlocked(l), 'hero' in l)).join('')}
      </div>`)}
    ${section('aura', 'Aura', aura ? esc(aura.name) : 'None', `${auras}/${AURAS.length}`, `
      <p class="fine">Radiates off your hero in every run, in the Hollow, on your Hall statue and on the leaderboards. Earned by going deep, winning Dailies, long streaks and Soul Ranks.</p>
      <div class="looks">
        ${auraCard('', 'None', 'No aura.', true)}
        ${ownedFirst(AURAS, auraUnlocked).map((a) => auraCard(a.id, a.name, a.how, auraUnlocked(a))).join('')}
      </div>`)}
    ${companionHtml()}
    ${racePrizesHtml()}
    <button class="btn primary" id="back">Back</button>`);

  overlay.querySelectorAll<HTMLButtonElement>('[data-race-kind]').forEach((b) =>
    b.addEventListener('click', () => {
      wearRacePrize(b.dataset.raceKind as 'trail' | 'finisher', b.dataset.raceId ?? '');
      sfx.relic();
      const top = overlay.scrollTop;
      showWardrobe(back, hero, changed);
      overlay.scrollTop = top;
    }),
  );
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
      equipOutfit(hero, b.dataset.part as 'look' | 'head' | 'aura', b.dataset.id ?? '');
      sfx.relic();
      changed?.();
      const top = overlay.scrollTop;
      showWardrobe(back, hero, changed);
      overlay.scrollTop = top;
    }),
  );
  overlay.querySelectorAll<HTMLDetailsElement>('.ward-section').forEach((d) =>
    d.addEventListener('toggle', () => (d.open ? openSections.add(d.dataset.sec!) : openSections.delete(d.dataset.sec!))),
  );
  on('#back', back);
  livePreview(hero, fit.look, fit.head, fit.aura ?? '');
}

/** The big preview at the top: the hero in their outfit, with the aura moving round them. */
function livePreview(hero: HeroId, look: string, head: string, aura: string) {
  const canvas = overlay.querySelector<HTMLCanvasElement>('#ward-live');
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const img = new Image();
  img.src = heroPortrait(hero, {}, [], 8, look, head);
  const start = performance.now();
  const frame = (now: number) => {
    if (!canvas.isConnected || screen !== 'wardrobe') return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const t = (now - start) / 1000;
    drawAura(ctx, aura, 75, 128, 96, t, 'back');
    if (img.complete) ctx.drawImage(img, 27, 32, 96, 96);
    drawAura(ctx, aura, 75, 128, 96, t, 'front');
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
