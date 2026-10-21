// Screens for progress between runs: choosing a hero, the Ossuary (spend Souls on
// unlocks) and the Grimoire (relic codex, combos and achievements).

import { sfx } from './audio';
import { ACHIEVEMENTS, COMBOS, HEROES, HERO_BY_ID, type AchievementDef, type ComboDef, type HeroId } from './content';
import { heroPortrait } from './hero';
import { RELIC_COSTS, type UnlockNote, buyHero, buyItem, lookUnlocked, openSeasons, outfitFor, buyRelic, heroUnlocked, meta, relicDiscovered, saveMeta } from './meta';
import { AURAS, DECOR, DUNCE_AT, HEADS, LEGENDARY, LOOKS, SEASONS, SHAME, seasonOf, shopPrice, type AuraDef } from './progression';
import { auraClass } from './aura';
import { ASCEND_FLOOR, ENDLESS_RELICS, FUSIONS, RELICS, RELIC_BY_ID, UNLOCKABLE_RELICS, type RelicId } from './relics';
import { $, esc, on, overlay, showOverlay } from './ui';
import { showWardrobe } from './wardrobe';

const soulsChip = () => `<div class="souls-chip" title="Souls">💀 <b>${meta.souls}</b> Souls</div>`;

function portrait(hero: HeroId): string {
  const o = outfitFor(hero);
  return heroPortrait(hero, {}, [], 5, o.look, o.head);
}

// ---------- hero select ----------

/** Deepest floor and Souls earned with a hero. */
function heroRecord(hero: HeroId): string {
  const st = meta.heroStats[hero];
  const floor = Math.max(st?.floor ?? 0, meta.best[hero]?.floor ?? 0);
  if (!st?.runs && !floor) return '<span class="record">No descents yet</span>';
  return `<span class="record"><b>⛧ Floor ${floor}</b> deepest${st?.runs ? ` · <b>💀 ${st.souls.toLocaleString()}</b> Souls · ${st.runs} run${st.runs === 1 ? '' : 's'}` : ''}</span>`;
}

export function showHeroSelect(onPick: (hero: HeroId) => void, back: () => void, sub = "Endless Descent · relics you've unlocked join the pool") {
  const cards = HEROES.map((h) => {
    const owned = heroUnlocked(h.id);
    return `<button class="hero-card ${owned ? '' : 'locked'} ${meta.hero === h.id ? 'selected' : ''}" data-hero="${h.id}" ${owned ? '' : 'disabled'}>
      <img src="${portrait(h.id)}" alt="" width="60" height="60" />
      <span class="hero-info">
        <span class="name">${h.name}</span>
        <span class="tag">${h.hp} HP · ${h.perk}</span>
        <span class="desc">${owned ? h.perkDesc : `🔒 Unlock in the Ossuary for ${h.cost} Souls`}</span>
        ${owned ? heroRecord(h.id) : ''}
      </span>
    </button>`;
  }).join('');
  showOverlay('heroes', `
    <h2>Choose your hero</h2>
    <p class="sub">${sub}</p>
    <div class="hero-list">${cards}</div>
    <div class="row">
      <button class="btn" id="wardrobe">🎨 Wardrobe</button>
      <button class="btn" id="ossuary">🏛️ Ossuary ${soulsChip()}</button>
    </div>
    <button class="btn primary" id="back">Back</button>`);
  overlay.querySelectorAll<HTMLButtonElement>('.hero-card:not(.locked)').forEach((b) =>
    b.addEventListener('click', () => {
      meta.hero = b.dataset.hero as HeroId;
      saveMeta();
      onPick(meta.hero);
    }),
  );
  on('#ossuary', () => showOssuary(() => showHeroSelect(onPick, back, sub)));
  on('#wardrobe', () => showWardrobe(() => showHeroSelect(onPick, back, sub), meta.hero));
  on('#back', back);
}

// ---------- the Ossuary ----------

type OssuaryTab = 'unlocks' | 'wardrobe' | 'hall';

export function showOssuary(back: () => void, tab: OssuaryTab = 'unlocks') {
  const buy = (attrs: string, cost: number) => `<button class="buy" ${attrs} ${meta.souls >= cost ? '' : 'disabled'}>💀 ${cost.toLocaleString()}</button>`;
  let body = '';
  if (tab === 'unlocks') {
    const heroes = HEROES.filter((h) => h.cost > 0).map((h) => {
      const owned = heroUnlocked(h.id);
      return `<div class="shop-item ${owned ? 'owned' : ''}">
        <img src="${portrait(h.id)}" alt="" width="40" height="40" />
        <span class="shop-info"><span class="name">${h.name}</span><span class="desc">${h.hp} HP · ${h.perk}: ${h.perkDesc}</span></span>
        ${owned ? '<span class="owned-tag">Unlocked</span>' : buy(`data-hero="${h.id}"`, h.cost)}
      </div>`;
    }).join('');
    const relicItem = (id: RelicId) => {
      const r = RELIC_BY_ID[id];
      const cost = RELIC_COSTS[id] ?? 0;
      const owned = meta.relics.includes(id);
      return `<div class="shop-item ${owned ? 'owned' : ''}">
        <span class="shop-emoji">${r.emoji}</span>
        <span class="shop-info"><span class="name">${r.name}${r.endless ? ' <em class="endless-tag">Endless only</em>' : ''}</span><span class="desc">${r.desc(1)}</span></span>
        ${owned ? '<span class="owned-tag">In the pool</span>' : buy(`data-relic="${id}"`, cost)}
      </div>`;
    };
    body = `
      <h3 class="shop-head">Heroes</h3>
      <div class="shop">${heroes}</div>
      <h3 class="shop-head">Forbidden relics</h3>
      <p class="fine">Bought relics join the Endless pool. The daily crypt is the same for everyone.</p>
      <div class="shop">${UNLOCKABLE_RELICS.filter((id) => !ENDLESS_RELICS.includes(id)).map(relicItem).join('')}</div>
      <h3 class="shop-head">Endless-only relics</h3>
      <p class="fine">Darker relics that are only ever offered in Endless.</p>
      <div class="shop">${ENDLESS_RELICS.map(relicItem).join('')}</div>`;
  } else if (tab === 'wardrobe') {
    const hero = meta.hero;
    const fit = outfitFor(hero);
    const item = (part: 'look' | 'head', id: string, name: string, cost: number) => {
      const owned = meta.bought.includes(id);
      const look = part === 'look' ? id : fit.look;
      const head = part === 'head' ? id : fit.head;
      const legendary = LEGENDARY.includes(id);
      return `<div class="shop-item ${owned ? 'owned' : ''} ${legendary ? 'legendary' : ''}">
        <img src="${heroPortrait(hero, {}, [], 4, look, head)}" alt="" width="40" height="40" />
        <span class="shop-info"><span class="name">${esc(name)}${legendary ? ' <em class="legend-tag">Legendary</em>' : ''}</span><span class="desc">${part === 'look' ? 'Cloak' : 'Headwear'} for any hero${legendary ? (part === 'look' ? ', trailing embers in the crypt' : ', with skulls that circle you in the crypt') : ''}.</span></span>
        ${owned ? '<span class="owned-tag">Owned</span>' : buy(`data-item="${id}" data-cost="${cost}"`, cost)}
      </div>`;
    };
    const auraItem = (a: AuraDef) => {
      const owned = meta.bought.includes(a.id);
      const cost = 'cost' in a.unlock ? a.unlock.cost : 0;
      const glow = auraClass(a.id);
      return `<div class="shop-item ${owned ? 'owned' : ''}">
        <img class="${glow.cls}" style="${glow.style}" src="${heroPortrait(hero, {}, [], 4, fit.look, fit.head)}" alt="" width="40" height="40" />
        <span class="shop-info"><span class="name">${esc(a.name)} <em class="legend-tag">Aura</em></span><span class="desc">Radiates off any hero, in runs and on the leaderboards.</span></span>
        ${owned ? '<span class="owned-tag">Owned</span>' : buy(`data-item="${a.id}" data-cost="${cost}"`, cost)}
      </div>`;
    };
    const soldAuras = (season?: string) => AURAS.filter((a) => 'cost' in a.unlock && (a.unlock.season ?? undefined) === season);
    const byPrice = <T extends { unlock?: Parameters<typeof shopPrice>[0] }>(a: T, b: T) => shopPrice(a.unlock) - shopPrice(b.unlock);
    const cloaks = LOOKS.filter((l) => shopPrice(l.unlock) && !seasonOf(l.unlock)).sort(byPrice);
    const heads = HEADS.filter((h) => shopPrice(h.unlock) && !seasonOf(h.unlock)).sort(byPrice);
    // Seasonal pieces: on sale only while their season is open.
    const seasonal = openSeasons()
      .map((season) => {
        const sc = LOOKS.filter((l) => shopPrice(l.unlock) && seasonOf(l.unlock) === season).sort(byPrice);
        const sh = HEADS.filter((h) => shopPrice(h.unlock) && seasonOf(h.unlock) === season).sort(byPrice);
        const free = LOOKS.find((l) => !shopPrice(l.unlock) && seasonOf(l.unlock) === season);
        const freeLine = free
          ? `<p class="fine season-free">${lookUnlocked(free) ? `✅ Your free <b>${esc(free.name)}</b> is in the Wardrobe.` : `🎁 Play any run before the season ends to get the <b>${esc(free.name)}</b> cloak free.`}</p>`
          : '';
        return `<div class="season-block">
          <h3 class="shop-head">${SEASONS[season].emoji} ${esc(SEASONS[season].name)} <small>· until ${esc(SEASONS[season].dates.split(' to ')[1])}</small></h3>
          <p class="fine">Exclusive pieces, sold only during the season. Yours to keep for good.</p>
          ${freeLine}
          <div class="shop">${soldAuras(season).map(auraItem).join('')}${sc.map((l) => item('look', l.id, l.name, shopPrice(l.unlock))).join('')}${sh.map((h) => item('head', h.id, h.name, shopPrice(h.unlock))).join('')}</div>
        </div>`;
      })
      .join('');
    body = `
      <p class="fine">Looks only, never power. Shown on your ${esc(HERO_BY_ID[hero].name)}; wear them on any hero in the Wardrobe.</p>
      ${seasonal}
      <h3 class="shop-head">Auras</h3>
      <p class="fine">Most auras are earned: by going deep, winning Dailies, long streaks and Soul Ranks. These three are for sale.</p>
      <div class="shop">${soldAuras().map(auraItem).join('')}</div>
      <h3 class="shop-head">Cloaks</h3>
      <div class="shop">${cloaks.map((l) => item('look', l.id, l.name, shopPrice(l.unlock))).join('')}</div>
      <h3 class="shop-head">Headwear</h3>
      <div class="shop">${heads.map((h) => item('head', h.id, h.name, shopPrice(h.unlock))).join('')}</div>
      <button class="btn" id="wardrobe">🎨 Open the Wardrobe</button>`;
  } else {
    const decorItem = (d: (typeof DECOR)[number]) => {
      const owned = meta.bought.includes(d.id);
      return `<div class="shop-item ${owned ? 'owned' : ''}">
          <span class="shop-emoji">${d.emoji}</span>
          <span class="shop-info"><span class="name">${esc(d.name)}</span><span class="desc">${esc(d.desc)}</span></span>
          ${owned ? '<span class="owned-tag">In your Hall</span>' : buy(`data-item="${d.id}" data-cost="${d.cost}"`, d.cost)}
        </div>`;
    };
    const open = openSeasons();
    // Seasonal decorations you own stay listed after the season; the rest leave the shop.
    const seasonalDecor = open
      .map((season) => `<div class="season-block">
          <h3 class="shop-head">${SEASONS[season].emoji} ${esc(SEASONS[season].name)} <small>· until ${esc(SEASONS[season].dates.split(' to ')[1])}</small></h3>
          <p class="fine">Exclusive decorations, sold only during the season. Yours to keep for good.</p>
          <div class="shop">${DECOR.filter((d) => d.season === season).map(decorItem).join('')}</div>
        </div>`)
      .join('');
    const kept = DECOR.filter((d) => d.season && !open.includes(d.season) && meta.bought.includes(d.id));
    body = `
      <p class="fine">Decorate your Crypt Hall. Everyone who visits your Hall sees them.</p>
      ${seasonalDecor}
      ${seasonalDecor ? '<h3 class="shop-head">All year</h3>' : ''}
      <div class="shop">${DECOR.filter((d) => !d.season).map(decorItem).join('')}${kept.map(decorItem).join('')}</div>
      <button class="btn" id="see-hall">🏰 See your Hall</button>`;
  }
  const tabs: [OssuaryTab, string][] = [
    ['unlocks', 'Heroes & relics'],
    ['wardrobe', 'Cosmetics'],
    ['hall', 'Hall decor'],
  ];
  showOverlay('ossuary', `
    <h2>The Ossuary</h2>
    <p class="sub">Trade the Souls of the fallen for heroes, relics and finery.</p>
    ${soulsChip()}
    <div class="tabs" role="tablist">${tabs.map(([t, label]) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div>
    ${body}
    <button class="btn primary" id="back">Back</button>`);
  overlay.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.addEventListener('click', () => showOssuary(back, b.dataset.tab as OssuaryTab)));
  overlay.querySelectorAll<HTMLButtonElement>('.buy').forEach((b) =>
    b.addEventListener('click', () => {
      const ok = b.dataset.hero
        ? buyHero(b.dataset.hero as HeroId)
        : b.dataset.relic
          ? buyRelic(b.dataset.relic as RelicId)
          : buyItem(b.dataset.item!, Number(b.dataset.cost));
      if (ok) {
        sfx.relic();
        const top = overlay.scrollTop;
        showOssuary(back, tab);
        overlay.scrollTop = top;
      }
    }),
  );
  on('#wardrobe', () => showWardrobe(() => showOssuary(back, 'wardrobe'), meta.hero));
  on('#see-hall', () => hallHook?.(() => showOssuary(back, 'hall')));
  on('#back', back);
}

let hallHook: ((back: () => void) => void) | null = null;
/** The Hall lives in main (it needs the player's name); it registers how to open it here. */
export function setHallOpener(open: (back: () => void) => void) {
  hallHook = open;
}

// ---------- the Grimoire ----------

type GrimoireTab = 'relics' | 'combos' | 'fusions' | 'achievements' | 'shame';

export function showGrimoire(back: () => void, tab: GrimoireTab = 'relics') {
  const found = RELICS.filter((r) => relicDiscovered(r.id)).length;
  const combosFound = COMBOS.filter((c) => meta.combos[c.id]).length;
  const feats = ACHIEVEMENTS.filter((a) => meta.achievements[a.id]).length;
  const tabs: [GrimoireTab, string][] = [
    ['relics', `Relics ${found}/${RELICS.length}`],
    ['combos', `Combos ${combosFound}/${COMBOS.length}`],
    ['fusions', `Fusions ${FUSIONS.filter((f) => meta.fusions[f.id]).length}/${FUSIONS.length}`],
    ['achievements', `Achievements ${feats}/${ACHIEVEMENTS.length}`],
    ['shame', `Deaths of Shame ${SHAME.filter((d) => meta.shame[d.id]).length}/${SHAME.length}`],
  ];
  let body = '';
  if (tab === 'relics') {
    body = `<div class="codex">${RELICS.map((r) => {
      const seen = relicDiscovered(r.id);
      return `<div class="codex-item ${seen ? '' : 'unknown'}">
        <span class="shop-emoji">${seen ? r.emoji : '❔'}</span>
        <span class="shop-info"><span class="name">${seen ? r.name : '???'}</span>
        <span class="desc">${seen ? `${r.desc(1)} · taken ${meta.codex[r.id]}×` : 'Claim this relic to record it.'}</span></span>
      </div>`;
    }).join('')}</div>`;
  } else if (tab === 'fusions') {
    const row = (f: (typeof FUSIONS)[number]) => {
      const seen = !!meta.fusions[f.id];
      const r = RELIC_BY_ID[f.id];
      const parts = f.from.map((id) => (seen || relicDiscovered(id) ? RELIC_BY_ID[id].emoji : '❔')).join(' + ');
      return `<div class="codex-item ${seen ? '' : 'unknown'}">
        <span class="shop-emoji">${seen ? r.emoji : '❔'}</span>
        <span class="shop-info"><span class="name">${seen ? r.name : '???'}</span>
        <span class="desc">${seen ? `${parts} · ${r.desc(1)}` : `${parts} · fuse at the Soul Forge to discover`}</span></span>
      </div>`;
    };
    body = `<p class="fine">Fuse two relics at the Soul Forge, found on the floor after each boss.</p>
      <div class="codex">${FUSIONS.filter((f) => f.tier !== 2).map(row).join('')}</div>
      <h3 class="shop-head">Ascended</h3>
      <p class="fine">From floor ${ASCEND_FLOOR}, the forge can fuse two fused relics into one.</p>
      <div class="codex">${FUSIONS.filter((f) => f.tier === 2).map(row).join('')}</div>`;
  } else if (tab === 'combos') {
    body = `<div class="codex">${COMBOS.map((c) => {
      const seen = !!meta.combos[c.id];
      const parts = c.relics.map((id) => (relicDiscovered(id) ? RELIC_BY_ID[id].emoji : '❔')).join(' + ');
      return `<div class="codex-item ${seen ? '' : 'unknown'}">
        <span class="shop-emoji">${seen ? c.emoji : '❔'}</span>
        <span class="shop-info"><span class="name">${seen ? c.name : '???'}</span>
        <span class="desc">${parts}${seen ? ` · ${c.desc}` : ' · hold them all in one run'}</span></span>
      </div>`;
    }).join('')}</div>`;
  } else if (tab === 'shame') {
    const got = SHAME.filter((d) => meta.shame[d.id]).length;
    body = `<p class="fine">Silly ways to fall. Each one pays ${25} Souls and a title to wear. Collect ${DUNCE_AT} for the <b>Dunce Cap</b>${got >= DUNCE_AT ? ' (yours!)' : ''}.</p>
      <div class="codex">${SHAME.map((d) => {
        const when = meta.shame[d.id];
        return `<div class="codex-item ${when ? '' : 'unknown'}">
          <span class="shop-emoji">${when ? d.emoji : '🪦'}</span>
          <span class="shop-info"><span class="name">${esc(d.title)}</span><span class="desc">${esc(d.how)}${when ? ` · ${new Date(when).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}</span></span>
        </div>`;
      }).join('')}</div>`;
  } else {
    body = `<div class="codex">${ACHIEVEMENTS.map((a) => {
      const got = !!meta.achievements[a.id];
      return `<div class="codex-item ${got ? '' : 'unknown'}">
        <span class="shop-emoji">${got ? '🏅' : '🔒'}</span>
        <span class="shop-info"><span class="name">${a.name}</span><span class="desc">${a.desc} · 💀 ${a.souls}</span></span>
      </div>`;
    }).join('')}</div>`;
  }
  showOverlay('grimoire', `
    <h2>Grimoire</h2>
    <div class="tabs" role="tablist">${tabs.map(([t, label]) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div>
    ${body}
    <button class="btn primary" id="back">Back</button>`);
  overlay.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) =>
    b.addEventListener('click', () => showGrimoire(back, b.dataset.tab as GrimoireTab)),
  );
  on('#back', back);
}

// ---------- celebrations ----------

const queue: string[] = [];
let showing = false;

/** Slide in a banner for each new achievement or combo, one at a time. */
export function celebrate(achievements: AchievementDef[], combos: ComboDef[] = []) {
  for (const c of combos) queue.push(`<b>${c.emoji} ${esc(c.name.toUpperCase())}!</b><span>Combo complete</span>`);
  for (const a of achievements) queue.push(`<b>🏅 ${esc(a.name)}</b><span>${esc(a.desc)} · +${a.souls} Souls</span>`);
  if (!showing) next();
}

/** Banners for unlocks between runs: Bestiary milestones, Soul Ranks, new looks. */
export function celebrateNotes(notes: UnlockNote[]) {
  for (const n of notes) queue.push(`<b>${n.icon} ${esc(n.title)}</b><span>${esc(n.detail)}</span>`);
  if (!showing) next();
}

function next() {
  const el = $('feat');
  const item = queue.shift();
  if (!item) {
    showing = false;
    el.hidden = true;
    return;
  }
  showing = true;
  sfx.relic();
  el.innerHTML = item;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
  window.setTimeout(next, 2600);
}
