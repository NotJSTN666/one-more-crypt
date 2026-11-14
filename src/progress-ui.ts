import { relicIcon } from './relic-icons';
// Screens for progress between runs: choosing a hero, the Ossuary (spend Souls on
// unlocks) and the Grimoire (relic codex, combos and achievements).

import { sfx } from './audio';
import { ACHIEVEMENTS, COMBOS, HEROES, HERO_BY_ID, type AchievementDef, type ComboDef, type HeroId } from './content';
import { heroPortrait } from './hero';
import { PYRE_GOAL, PYRE_SHARE, RELIC_COSTS, type UnlockNote, buyHero, buyItem, buyPet, claimPyreHound, giftables, notePyre, pyreEvent, pyreGiven, spendSouls, lookUnlocked, openSeasons, outfitFor, buyRelic, heroUnlocked, meta, relicDiscovered, saveMeta } from './meta';
import { AURAS, DECOR, DUNCE_AT, HEADS, LEGENDARY, LOOKS, MASTERY_SOULS, SEASONS, SHAME, isMarket, masteryRank, marketPiece, seasonOf, shopPrice, type AuraDef } from './progression';
import { dailyNumber } from './daily';
import { auraClass } from './aura';
import { ASCEND_FLOOR, ENDLESS_RELICS, FUSIONS, RELICS, RELIC_BY_ID, UNLOCKABLE_RELICS, type RelicId } from './relics';
import { $, esc, on, overlay, screen, showOverlay, toast } from './ui';
import { showWardrobe } from './wardrobe';
import { SHOP_COMPANIONS } from './companions';
import { ONLINE, pyreGive, pyreState, sendGift, type PyreState } from './online';
import { companionPortrait } from './companion-art';

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
  return `<span class="record"><b>⛧ Floor ${floor}</b> deepest${st?.runs ? ` · <b>💀 ${st.souls.toLocaleString()}</b> Souls · ${st.runs} run${st.runs === 1 ? '' : 's'}` : ''}</span>${masteryLine(st?.souls ?? 0)}`;
}

/** Mastery: five ranks from the Souls earned with a hero. Rank 3 brings a cloak, rank 5 a title. */
function masteryLine(souls: number): string {
  const rank = masteryRank(souls);
  const top = MASTERY_SOULS.length;
  const stars = '★'.repeat(rank) + '☆'.repeat(top - rank);
  const next = MASTERY_SOULS[rank];
  const prize = rank < 3 ? ' (rank 3: a mastery cloak)' : rank < top ? ' (rank 5: a Master title)' : '';
  return `<span class="mastery"><b>${stars}</b> Mastery ${rank}/${top}${next ? ` · ${(next - souls).toLocaleString()} more Souls to rank ${rank + 1}${prize}` : ' · mastered'}</span>`;
}

export function showHeroSelect(onPick: (hero: HeroId) => void, back: () => void, sub = "Endless Descent · relics you've unlocked join the pool") {
  const cards = HEROES.map((h) => {
    const owned = heroUnlocked(h.id);
    return `<button class="hero-card ${owned ? '' : 'locked'} ${meta.hero === h.id ? 'selected' : ''}" data-hero="${h.id}" ${owned ? '' : 'disabled'}>
      <img src="${portrait(h.id)}" alt="" width="60" height="60" />
      <span class="hero-info">
        <span class="name">${h.name}</span>
        <span class="tag">${h.hp} HP · ${h.perk}</span>
        <span class="desc">${owned ? h.perkDesc : h.story ? `🔒 Finish every quest of Act I in the story. ${h.perkDesc}` : `🔒 Unlock in the Ossuary for ${h.cost} Souls`}</span>
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

type OssuaryTab = 'unlocks' | 'wardrobe' | 'hall' | 'gift' | 'pyre';

/** Who is playing, as the online parts of the Ossuary need to know it (main registers this). */
let host: { signedIn: () => boolean; name: () => string; player: () => string; signIn: (then: () => void) => void } | null = null;
export function setOssuaryHost(h: NonNullable<typeof host>) {
  host = h;
}

/**
 * Whether the server has gifts and the pyre set up (both arrive in one piece of SQL). Asked once,
 * the first time the Ossuary opens; until it says yes, neither tab is shown.
 */
let onlineShop: boolean | null = null;
/** True right after the server answered, so redrawing the tab with that answer doesn't ask again. */
let pyreFresh = false;
/** The last word from the server on this month's pyre, kept so the tab draws at once. */
let pyreSeen: { event: string; st: PyreState } | null = null;
/** Who the last gift went to, so the name is there for the next one. */
let giftTo = '';

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
        <span class="shop-emoji">${relicIcon(id, r.emoji)}</span>
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
    const soldAuras = (season?: string) => AURAS.filter((a) => 'cost' in a.unlock && !isMarket(a.unlock) && (a.unlock.season ?? undefined) === season);
    const byPrice = <T extends { unlock?: Parameters<typeof shopPrice>[0] }>(a: T, b: T) => shopPrice(a.unlock) - shopPrice(b.unlock);
    const cloaks = LOOKS.filter((l) => shopPrice(l.unlock) && !seasonOf(l.unlock) && !isMarket(l.unlock)).sort(byPrice);
    const heads = HEADS.filter((h) => shopPrice(h.unlock) && !seasonOf(h.unlock) && !isMarket(h.unlock)).sort(byPrice);
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
      <h3 class="shop-head">Companions <small>${SHOP_COMPANIONS.filter((c) => meta.pets.includes(c.id)).length}/${SHOP_COMPANIONS.length}</small></h3>
      <p class="fine">A small creature that follows your hero in the Daily and Endless. Choose who comes along in the Wardrobe. (Four more can only be found by bringing friends.)</p>
      <div class="shop">${SHOP_COMPANIONS.map((c) => {
        const owned = meta.pets.includes(c.id);
        return `<div class="shop-item ${owned ? 'owned' : ''}">
          <img class="pet-art" src="${companionPortrait(c.id)}" alt="" width="40" height="40" />
          <span class="shop-info"><span class="name">${esc(c.name)} <em class="legend-tag">Companion</em></span><span class="desc">${esc(c.desc)}</span></span>
          ${owned ? '<span class="owned-tag">Owned</span>' : buy(`data-pet="${c.id}"`, c.cost!)}
        </div>`;
      }).join('')}</div>
      <h3 class="shop-head">Auras</h3>
      <p class="fine">Most auras are earned: by going deep, winning Dailies, long streaks and Soul Ranks. These three are for sale.</p>
      <div class="shop">${soldAuras().map(auraItem).join('')}</div>
      <h3 class="shop-head">Cloaks</h3>
      <div class="shop">${cloaks.map((l) => item('look', l.id, l.name, shopPrice(l.unlock))).join('')}</div>
      <h3 class="shop-head">Headwear</h3>
      <div class="shop">${heads.map((h) => item('head', h.id, h.name, shopPrice(h.unlock))).join('')}</div>
      <button class="btn" id="wardrobe">🎨 Open the Wardrobe</button>`;
  } else if (tab === 'gift') {
    const ready = Boolean(host?.signedIn());
    const art = (g: ReturnType<typeof giftables>[number]) =>
      g.kind === 'pet'
        ? `<img class="pet-art" src="${companionPortrait(g.id)}" alt="" width="40" height="40" />`
        : g.kind === 'aura'
          ? `<img class="${auraClass(g.id).cls}" style="${auraClass(g.id).style}" src="${heroPortrait(meta.hero, {}, [], 4, outfitFor(meta.hero).look, outfitFor(meta.hero).head)}" alt="" width="40" height="40" />`
          : `<img src="${heroPortrait(meta.hero, {}, [], 4, g.kind === 'look' ? g.id : outfitFor(meta.hero).look, g.kind === 'head' ? g.id : outfitFor(meta.hero).head)}" alt="" width="40" height="40" />`;
    const label = { pet: 'Companion', aura: 'Aura', look: 'Cloak', head: 'Headwear' };
    body = `
      <p class="fine">Send a friend something to wear. You pay its price in Souls and it's waiting for them the next time they open the game. If they already own it, they get half its price in Souls instead. Up to five gifts a day.</p>
      ${ready
        ? `<label class="gift-to"><span>Send to</span><input id="gift-to" type="text" maxlength="24" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Their player name" value="${esc(giftTo)}" /></label>
      <div class="shop">${giftables().sort((a, b) => a.cost - b.cost).map((g) => `<div class="shop-item">
          ${art(g)}
          <span class="shop-info"><span class="name">${esc(g.name)}</span><span class="desc">${label[g.kind]}</span></span>
          <button class="buy gift-send" data-gift="${g.item}" data-cost="${g.cost}" data-name="${esc(g.name)}" ${meta.souls >= g.cost ? '' : 'disabled'}>🎁 ${g.cost.toLocaleString()}</button>
        </div>`).join('')}</div>`
        : `<p class="fine">Gifts go from one named player to another, so sign in and pick a name first.</p><button class="btn primary" id="gift-signin">Sign in to send gifts</button>`}`;
  } else if (tab === 'pyre') {
    const event = pyreEvent();
    const st = pyreSeen?.event === event ? pyreSeen.st : null;
    const mine = Math.max(st?.mine ?? 0, meta.pyre[event] ?? 0);
    const total = st?.total ?? 0;
    const pct = Math.min(100, (total / PYRE_GOAL) * 100);
    const full = total >= PYRE_GOAL;
    const month = new Date(`${event}-15T00:00:00Z`).toLocaleDateString([], { month: 'long', timeZone: 'UTC' });
    const tiers: [number, string][] = [[1000, 'Kindler'], [10000, 'Pyre-Keeper'], [50000, 'Soulburner']];
    const given = pyreGiven();
    body = `
      <p class="fine">Everyone in the crypt feeds one fire. Fill it with <b>${PYRE_GOAL.toLocaleString()} Souls</b> before ${esc(month)} ends, and everyone who gave at least ${PYRE_SHARE.toLocaleString()} this month gets the <b>Pyre Hound</b>, a companion you can't buy. A new pyre is lit each month.</p>
      <div class="pyre">
        <img class="pet-art pyre-hound" src="${companionPortrait('pyrehound', 5)}" alt="The Pyre Hound" width="70" height="70" />
        <div class="pyre-bar ${full ? 'full' : ''}"><div class="pyre-fill" style="width:${pct.toFixed(1)}%"></div></div>
        <p class="pyre-count">${st ? `<b>${total.toLocaleString()}</b> / ${PYRE_GOAL.toLocaleString()} Souls · ${st.givers.toLocaleString()} ${st.givers === 1 ? 'player has' : 'players have'} given${full ? ' · 🔥 The pyre is full!' : ''}` : ONLINE ? 'Asking the pyre…' : 'The pyre needs a connection.'}</p>
        <p class="pyre-mine">You've given <b>${mine.toLocaleString()}</b> this month${mine >= PYRE_SHARE ? ' · ✓ you share in the Pyre Hound' : ` · ${(PYRE_SHARE - mine).toLocaleString()} more to share in the Pyre Hound`}</p>
      </div>
      <div class="pyre-give">
        ${[500, 1000, 5000, 25000].map((n) => `<button class="buy" data-pyre="${n}" ${meta.souls >= n && st ? '' : 'disabled'}>🔥 ${n.toLocaleString()}</button>`).join('')}
      </div>
      <h3 class="shop-head">Titles for giving</h3>
      <ul class="invite-ladder">${tiers.map(([n, name]) => `<li class="${given >= n ? 'got' : ''}"><span>${given >= n ? '✓' : `${Math.min(given, n).toLocaleString()}/${n.toLocaleString()}`}</span>📜 ${name}</li>`).join('')}</ul>
      ${st?.top.length ? `<h3 class="shop-head">This month's fire-feeders</h3><ol class="pyre-top">${st.top.map((t) => `<li><span>${esc(t.name || 'A guest')}</span><b>${t.souls.toLocaleString()}</b></li>`).join('')}</ol>` : ''}`;
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
    ...(ONLINE && onlineShop ? ([['gift', '🎁 Gifts'], ['pyre', '🔥 Pyre']] as [OssuaryTab, string][]) : []),
  ];
  if (ONLINE && host && onlineShop === null) {
    onlineShop = false;
    const event = pyreEvent();
    void pyreState(event, host.player()).then((st) => {
      if (!st) return;
      onlineShop = true;
      pyreSeen = { event, st };
      notePyre(event, st.mine);
      // (only add the tabs if the player is still looking at the same screen, and hasn't scrolled away)
      if (screen === 'ossuary' && !overlay.hidden && overlay.scrollTop < 40) showOssuary(back, tab);
    });
  }
  showOverlay('ossuary', `
    <h2>The Ossuary</h2>
    <p class="sub">Trade the Souls of the fallen for heroes, relics and finery.</p>
    ${soulsChip()}
    ${marketHtml(buy)}
    <div class="tabs" role="tablist">${tabs.map(([t, label]) => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div>
    ${body}
    <button class="btn primary" id="back">Back</button>`);
  overlay.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.addEventListener('click', () => showOssuary(back, b.dataset.tab as OssuaryTab)));
  // ---- gifts: pick a name, tap an item, tap again to send ----
  on('#gift-signin', () => host?.signIn(() => showOssuary(back, 'gift')));
  overlay.querySelector<HTMLInputElement>('#gift-to')?.addEventListener('input', (e) => (giftTo = (e.currentTarget as HTMLInputElement).value));
  overlay.querySelectorAll<HTMLButtonElement>('.gift-send').forEach((b) =>
    b.addEventListener('click', async () => {
      const to = giftTo.trim();
      const cost = Number(b.dataset.cost);
      if (!to) {
        toast('Type the name of the player to send it to.');
        overlay.querySelector<HTMLInputElement>('#gift-to')?.focus();
        return;
      }
      if (!b.classList.contains('confirm')) {
        overlay.querySelectorAll('.gift-send.confirm').forEach((o) => o.classList.remove('confirm'));
        b.classList.add('confirm');
        b.textContent = `Send to ${to}?`;
        return;
      }
      if (meta.souls < cost) return;
      b.disabled = true;
      try {
        const name = await sendGift(to, b.dataset.gift!);
        spendSouls(cost);
        sfx.relic();
        toast(`🎁 ${b.dataset.name} is on its way to ${name}.`);
      } catch (e) {
        toast((e as Error).message || 'The gift could not be sent.');
      }
      if (screen === 'ossuary') {
        const top = overlay.scrollTop;
        showOssuary(back, 'gift');
        overlay.scrollTop = top;
      }
    }),
  );
  // ---- the pyre: ask the server how it burns, and pour Souls on ----
  const pyreHeard = (event: string, st: PyreState) => {
    pyreSeen = { event, st };
    notePyre(event, st.mine);
    if (claimPyreHound(st.total, Math.max(st.mine, meta.pyre[event] ?? 0))) {
      sfx.relic();
      toast('🔥 The pyre is full! The Pyre Hound is yours. Find it in the Wardrobe.');
    }
  };
  if (tab === 'pyre' && ONLINE && host) {
    const event = pyreEvent();
    const stale = !pyreSeen || pyreSeen.event !== event || !pyreFresh;
    pyreFresh = false;
    if (stale) {
      void pyreState(event, host.player()).then((st) => {
        if (!st) return;
        pyreHeard(event, st);
        pyreFresh = true;
        if (screen === 'ossuary' && overlay.querySelector('.pyre')) showOssuary(back, 'pyre');
      });
    }
  }
  overlay.querySelectorAll<HTMLButtonElement>('[data-pyre]').forEach((b) =>
    b.addEventListener('click', async () => {
      const n = Number(b.dataset.pyre);
      if (!host || meta.souls < n) return;
      overlay.querySelectorAll<HTMLButtonElement>('[data-pyre]').forEach((o) => (o.disabled = true));
      const event = pyreEvent();
      try {
        const st = await pyreGive(event, host.player(), host.name(), n);
        spendSouls(n);
        pyreHeard(event, st);
        sfx.relic();
        toast(`🔥 ${n.toLocaleString()} Souls on the pyre.`);
      } catch (e) {
        toast((e as Error).message || 'The pyre would not take them.');
      }
      pyreFresh = true;
      if (screen === 'ossuary') showOssuary(back, 'pyre');
    }),
  );
  overlay.querySelectorAll<HTMLButtonElement>('.buy:not(.gift-send):not([data-pyre])').forEach((b) =>
    b.addEventListener('click', () => {
      const ok = b.dataset.pet
        ? buyPet(b.dataset.pet)
        : b.dataset.hero
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

/**
 * The Grave Market: one rare piece a day, the same for everyone, sold only on its day. Some
 * other day it comes round again, so there's always a reason to look in.
 */
function marketHtml(buy: (attrs: string, cost: number) => string): string {
  const p = marketPiece(dailyNumber());
  const fit = outfitFor(meta.hero);
  const owned = meta.bought.includes(p.id);
  const glow = p.kind === 'aura' ? auraClass(p.id) : { cls: '', style: '' };
  const img = heroPortrait(meta.hero, {}, [], 5, p.kind === 'look' ? p.id : fit.look, p.kind === 'head' ? p.id : fit.head);
  const what = p.kind === 'look' ? 'Cloak' : p.kind === 'head' ? 'Headwear' : 'Aura';
  return `<div class="market">
    <h3 class="shop-head">🕯️ Today in the Ossuary</h3>
    <div class="shop-item market-item ${owned ? 'owned' : ''}">
      <img class="${glow.cls}" style="${glow.style}" src="${img}" alt="" width="50" height="50" />
      <span class="shop-info"><span class="name">${esc(p.name)} <em class="legend-tag">${what}</em></span><span class="desc">${owned ? 'Yours. Wear it from the Wardrobe.' : "Sold only today. It comes round again some other day."}</span></span>
      ${owned ? '<span class="owned-tag">Owned</span>' : buy(`data-item="${p.id}" data-cost="${p.cost}"`, p.cost)}
    </div>
  </div>`;
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
        <span class="shop-emoji">${seen ? relicIcon(r.id, r.emoji) : '❔'}</span>
        <span class="shop-info"><span class="name">${seen ? r.name : '???'}</span>
        <span class="desc">${seen ? `${r.desc(1)} · taken ${meta.codex[r.id]}×` : 'Claim this relic to record it.'}</span></span>
      </div>`;
    }).join('')}</div>`;
  } else if (tab === 'fusions') {
    const row = (f: (typeof FUSIONS)[number]) => {
      const seen = !!meta.fusions[f.id];
      const r = RELIC_BY_ID[f.id];
      const parts = f.from.map((id) => (seen || relicDiscovered(id) ? relicIcon(id, RELIC_BY_ID[id].emoji) : '❔')).join(' + ');
      return `<div class="codex-item ${seen ? '' : 'unknown'}">
        <span class="shop-emoji">${seen ? relicIcon(f.id, r.emoji) : '❔'}</span>
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
      const parts = c.relics.map((id) => (relicDiscovered(id) ? relicIcon(id, RELIC_BY_ID[id].emoji) : '❔')).join(' + ');
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
let held = false;

/** Keep banners back while something fills the screen (the Soul Forge's fusion and its card), and let them out after. */
export function holdCelebrations(on: boolean) {
  held = on;
  if (!on && !showing && queue.length) next();
}

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
  if (held) {
    showing = false;
    el.hidden = true;
    return;
  }
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
