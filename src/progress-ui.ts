// Screens for progress between runs: choosing a hero, the Ossuary (spend Souls on
// unlocks) and the Grimoire (relic codex, combos and achievements).

import { sfx } from './audio';
import { ACHIEVEMENTS, COMBOS, HEROES, type AchievementDef, type ComboDef, type HeroId } from './content';
import { heroPortrait } from './hero';
import { RELIC_COSTS, type UnlockNote, buyHero, buyRelic, heroUnlocked, meta, relicDiscovered, saveMeta } from './meta';
import { ASCEND_FLOOR, FUSIONS, RELICS, RELIC_BY_ID, UNLOCKABLE_RELICS } from './relics';
import { $, esc, on, overlay, showOverlay } from './ui';

const soulsChip = () => `<div class="souls-chip" title="Souls">💀 <b>${meta.souls}</b> Souls</div>`;

function portrait(hero: HeroId): string {
  return heroPortrait(hero, {}, [], 5);
}

// ---------- hero select ----------

export function showHeroSelect(onPick: (hero: HeroId) => void, back: () => void) {
  const cards = HEROES.map((h) => {
    const owned = heroUnlocked(h.id);
    return `<button class="hero-card ${owned ? '' : 'locked'} ${meta.hero === h.id ? 'selected' : ''}" data-hero="${h.id}" ${owned ? '' : 'disabled'}>
      <img src="${portrait(h.id)}" alt="" width="60" height="60" />
      <span class="hero-info">
        <span class="name">${h.name}</span>
        <span class="tag">${h.hp} HP · ${h.perk}</span>
        <span class="desc">${owned ? h.perkDesc : `🔒 Unlock in the Ossuary for ${h.cost} Souls`}</span>
      </span>
    </button>`;
  }).join('');
  showOverlay('heroes', `
    <h2>Choose your hero</h2>
    <p class="sub">Endless Descent · relics you've unlocked join the pool</p>
    <div class="hero-list">${cards}</div>
    <button class="btn" id="ossuary">🏛️ The Ossuary ${soulsChip()}</button>
    <button class="link-btn" id="back">Back</button>`);
  overlay.querySelectorAll<HTMLButtonElement>('.hero-card:not(.locked)').forEach((b) =>
    b.addEventListener('click', () => {
      meta.hero = b.dataset.hero as HeroId;
      saveMeta();
      onPick(meta.hero);
    }),
  );
  on('#ossuary', () => showOssuary(() => showHeroSelect(onPick, back)));
  on('#back', back);
}

// ---------- the Ossuary ----------

export function showOssuary(back: () => void) {
  const heroes = HEROES.filter((h) => h.cost > 0).map((h) => {
    const owned = heroUnlocked(h.id);
    const afford = meta.souls >= h.cost;
    return `<div class="shop-item ${owned ? 'owned' : ''}">
      <img src="${portrait(h.id)}" alt="" width="40" height="40" />
      <span class="shop-info"><span class="name">${h.name}</span><span class="desc">${h.hp} HP · ${h.perk}: ${h.perkDesc}</span></span>
      ${owned ? '<span class="owned-tag">Unlocked</span>' : `<button class="buy" data-hero="${h.id}" ${afford ? '' : 'disabled'}>💀 ${h.cost}</button>`}
    </div>`;
  }).join('');
  const relics = UNLOCKABLE_RELICS.map((id) => {
    const r = RELIC_BY_ID[id];
    const cost = RELIC_COSTS[id] ?? 0;
    const owned = meta.relics.includes(id);
    return `<div class="shop-item ${owned ? 'owned' : ''}">
      <span class="shop-emoji">${r.emoji}</span>
      <span class="shop-info"><span class="name">${r.name}</span><span class="desc">${r.desc(1)}</span></span>
      ${owned ? '<span class="owned-tag">In the pool</span>' : `<button class="buy" data-relic="${id}" ${meta.souls >= cost ? '' : 'disabled'}>💀 ${cost}</button>`}
    </div>`;
  }).join('');
  showOverlay('ossuary', `
    <h2>The Ossuary</h2>
    <p class="sub">Trade the Souls of the fallen for new heroes and relics. Unlocks apply to Endless; the daily crypt is the same for everyone.</p>
    ${soulsChip()}
    <h3 class="shop-head">Heroes</h3>
    <div class="shop">${heroes}</div>
    <h3 class="shop-head">Forbidden relics</h3>
    <div class="shop">${relics}</div>
    <button class="btn primary" id="back">Back</button>`);
  overlay.querySelectorAll<HTMLButtonElement>('.buy').forEach((b) =>
    b.addEventListener('click', () => {
      const ok = b.dataset.hero ? buyHero(b.dataset.hero as HeroId) : buyRelic(b.dataset.relic as never);
      if (ok) {
        sfx.relic();
        showOssuary(back);
      }
    }),
  );
  on('#back', back);
}

// ---------- the Grimoire ----------

type GrimoireTab = 'relics' | 'combos' | 'fusions' | 'achievements';

export function showGrimoire(back: () => void, tab: GrimoireTab = 'relics') {
  const found = RELICS.filter((r) => relicDiscovered(r.id)).length;
  const combosFound = COMBOS.filter((c) => meta.combos[c.id]).length;
  const feats = ACHIEVEMENTS.filter((a) => meta.achievements[a.id]).length;
  const tabs: [GrimoireTab, string][] = [
    ['relics', `Relics ${found}/${RELICS.length}`],
    ['combos', `Combos ${combosFound}/${COMBOS.length}`],
    ['fusions', `Fusions ${FUSIONS.filter((f) => meta.fusions[f.id]).length}/${FUSIONS.length}`],
    ['achievements', `Achievements ${feats}/${ACHIEVEMENTS.length}`],
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
