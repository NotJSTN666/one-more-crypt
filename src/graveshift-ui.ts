// Grave Shift's screens away from the plot: Mortimer's shed (seeds, selling, upgrades)
// and the request board.

import { sfx } from './audio';
import { centralDate } from './daily';
import {
  CAN_CUT, CROPS, FIELD_NAME, ITEM_EMOJI, ITEM_NAME, SELL, SPADE_DMG, WARES, buySeed, buyUpgrade, fillRequest, requestsFor, sellAll, upgradeCost, type Upgrade,
} from './graveshift';
import { heroPortrait } from './hero';
import { farmJob } from './hollow';
import { graveState, meta, outfitFor, receiveGift, saveMeta } from './meta';
import { AURA_BY_ID, HEAD_BY_ID, LOOK_BY_ID } from './progression';
import { esc, on, overlay, showOverlay, toast } from './ui';

/** Mortimer's shed: buy seeds, sell the satchel, and buy upgrades. */
export function showGraveShop(back: () => void) {
  const s = graveState();
  const satchel = Object.entries(s.inv).filter(([k, n]) => SELL[k] !== undefined && n > 0);
  const worth = satchel.reduce((sum, [k, n]) => sum + SELL[k] * n, 0);
  const seed = (c: (typeof CROPS)[number]) => {
    const locked = c.needs > s.fields;
    const mins = c.mins >= 60 ? `${c.mins / 60}h` : `${c.mins}m`;
    return `<div class="shop-item ${locked ? 'owned' : ''}">
      <span class="shop-emoji">${c.emoji}</span>
      <span class="shop-info"><span class="name">${esc(c.name)} seeds</span><span class="desc">${locked ? `Mortimer stocks these once you've cleared more ground.` : `Grows in ${mins} · sells for ${c.sell} 🪙 · you have ${s.inv[`seed:${c.id}`] ?? 0}`}</span></span>
      ${locked ? '<span class="owned-tag">Later</span>' : `<button class="buy" data-seed="${c.id}" data-n="1" ${s.obols < c.seed ? 'disabled' : ''}>🪙 ${c.seed}</button><button class="buy" data-seed="${c.id}" data-n="5" ${s.obols < c.seed * 5 ? 'disabled' : ''}>×5</button>`}
    </div>`;
  };
  const upgrade = (u: Upgrade, name: string, desc: string) => {
    const cost = upgradeCost(s, u);
    return `<div class="shop-item ${cost === null ? 'owned' : ''}">
      <span class="shop-emoji">${u === 'can' ? '🪣' : u === 'spade' ? '🗡️' : '🌾'}</span>
      <span class="shop-info"><span class="name">${esc(name)}</span><span class="desc">${esc(desc)}</span></span>
      ${cost === null ? '<span class="owned-tag">Done</span>' : `<button class="buy" data-up="${u}" ${s.obols < cost ? 'disabled' : ''}>🪙 ${cost}</button>`}
    </div>`;
  };
  const nextCan = Math.round(CAN_CUT[Math.min(s.can + 1, CAN_CUT.length - 1)] * 100);
  // Mortimer's wares: cosmetics for Obols, shown on your own hero.
  const ware = (w: (typeof WARES)[number]) => {
    const owned = meta.gifts.includes(`grave:${w.id}`);
    const def = w.kind === 'look' ? LOOK_BY_ID[w.id] : w.kind === 'head' ? HEAD_BY_ID[w.id] : AURA_BY_ID[w.id];
    const o = outfitFor(meta.hero);
    const pic = w.kind === 'aura' ? '✨' : `<img class="px" src="${heroPortrait(meta.hero, {}, [], 3, w.kind === 'look' ? w.id : o.look, w.kind === 'head' ? w.id : o.head)}" alt="" width="36" height="36" />`;
    const kind = w.kind === 'look' ? 'Cloak' : w.kind === 'head' ? 'Headwear' : 'Aura';
    return `<div class="shop-item ${owned ? 'owned' : ''}">
      <span class="shop-emoji">${pic}</span>
      <span class="shop-info"><span class="name">${esc(def?.name ?? w.id)}</span><span class="desc">${kind} for any hero. Only from Mortimer.</span></span>
      ${owned ? '<span class="owned-tag">Owned</span>' : `<button class="buy" data-ware="${w.id}" ${s.obols < w.price ? 'disabled' : ''}>🪙 ${w.price}</button>`}
    </div>`;
  };
  showOverlay('grave-shop', `
    <h2>Mortimer's Shed</h2>
    <p class="sub">"Seeds, spades, and no questions asked."</p>
    <div class="souls-chip">🪙 <b>${s.obols}</b> Obols</div>
    <h3 class="shop-head">Sell your satchel</h3>
    <p class="fine">${satchel.length ? satchel.map(([k, n]) => `${ITEM_EMOJI[k]} ${esc(ITEM_NAME[k])} ×${n}`).join(' · ') : 'Nothing to sell yet. Harvest crops, or put the risen down for ectoplasm.'}</p>
    ${satchel.length ? `<button class="btn primary" id="sell-all">Sell it all · 🪙 ${worth}</button>` : ''}
    <h3 class="shop-head">Seeds</h3>
    <div class="shop">${CROPS.map(seed).join('')}</div>
    <h3 class="shop-head">Tools and ground</h3>
    <div class="shop">
      ${upgrade('can', 'Better watering can', `Watering takes ${nextCan}% off the time left.`)}
      ${upgrade('spade', 'Sharper spade', `Hit the risen for ${SPADE_DMG[Math.min(s.spade + 1, SPADE_DMG.length - 1)]} a swing.`)}
      ${upgrade('field', FIELD_NAME[Math.min(s.fields + 1, FIELD_NAME.length - 1)] || 'Clear more ground', 'Ten more plots, and new seeds in the shed.')}
    </div>
    <h3 class="shop-head">Mortimer's wares</h3>
    <p class="fine">Things to wear, only sold here, only for Obols.</p>
    <div class="shop">${WARES.map(ware).join('')}</div>
    <button class="btn primary" id="back">Back to the plot</button>`);
  const reopen = () => {
    const top = overlay.scrollTop;
    showGraveShop(back);
    overlay.scrollTop = top;
  };
  on('#sell-all', () => {
    const made = sellAll(graveState(), Date.now());
    if (made) {
      sfx.relic();
      toast(`Sold for ${made} Obols.`);
      farmJob('sell');
      saveMeta();
    }
    reopen();
  });
  overlay.querySelectorAll<HTMLButtonElement>('[data-seed]').forEach((b) =>
    b.addEventListener('click', () => {
      if (buySeed(graveState(), b.dataset.seed!, Number(b.dataset.n), Date.now())) {
        sfx.step();
        saveMeta();
      }
      reopen();
    }),
  );
  overlay.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) =>
    b.addEventListener('click', () => {
      if (buyUpgrade(graveState(), b.dataset.up as Upgrade, Date.now())) {
        sfx.fuse();
        saveMeta();
      }
      reopen();
    }),
  );
  overlay.querySelectorAll<HTMLButtonElement>('[data-ware]').forEach((b) =>
    b.addEventListener('click', () => {
      const w = WARES.find((x) => x.id === b.dataset.ware);
      const gs = graveState();
      if (!w || meta.gifts.includes(`grave:${w.id}`) || gs.obols < w.price) return;
      gs.obols -= w.price;
      receiveGift(`grave:${w.id}`);
      sfx.relic();
      toast('Yours. Wear it from the Wardrobe.');
      saveMeta();
      reopen();
    }),
  );
  on('#back', back);
}

/** The request board: three villagers' asks a day, paid well in Obols. */
export function showGraveRequests(back: () => void) {
  const s = graveState();
  const day = centralDate();
  const reqs = requestsFor(day, s.fields);
  const done = s.reqDay === day ? s.reqDone : [];
  const who = ['Bess at the tavern', 'Pip at the smithy', 'Old Agnes'];
  showOverlay('grave-requests', `
    <h2>Request Board</h2>
    <p class="sub">New requests every day at midnight Central.</p>
    <div class="shop">${reqs.map((r, k) => {
      const have = s.inv[r.item] ?? 0;
      return `<div class="shop-item ${done[k] ? 'owned' : ''}">
        <span class="shop-emoji">${ITEM_EMOJI[r.item]}</span>
        <span class="shop-info"><span class="name">${esc(who[k])} wants ${r.n} ${esc(ITEM_NAME[r.item])}</span><span class="desc">${done[k] ? 'Delivered. Thank you!' : `You have ${have} · pays 🪙 ${r.reward}`}</span></span>
        ${done[k] ? '<span class="owned-tag">Done</span>' : `<button class="buy" data-req="${k}" ${have < r.n ? 'disabled' : ''}>Deliver</button>`}
      </div>`;
    }).join('')}</div>
    <button class="btn primary" id="back">Back to the plot</button>`);
  overlay.querySelectorAll<HTMLButtonElement>('[data-req]').forEach((b) =>
    b.addEventListener('click', () => {
      if (fillRequest(graveState(), day, Number(b.dataset.req), Date.now())) {
        sfx.relic();
        farmJob('request');
        saveMeta();
      }
      showGraveRequests(back);
    }),
  );
  on('#back', back);
}
