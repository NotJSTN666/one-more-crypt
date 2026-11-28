// The Guide (onemorecrypt.com/guide/): a plain page anyone, and any search engine, can read
// without running the game. How to play, every mode, every hero, every relic and fusion, and a
// few answers. Built from the game's own lists at build time (see vite.config.ts), so it is never
// out of date. Pure: no DOM, nothing from the game that needs a browser.

import { COMBOS, ELITES, HEROES } from './content';
import { FUSED_RELICS, FUSIONS, RELICS, RELIC_BY_ID, ENDLESS_RELICS, UNLOCKABLE_RELICS, type RelicDef } from './relics';

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const LINKS = {
  discord: 'https://discord.gg/V454sdbTQH',
  x: 'https://x.com/OneMoreCrypt',
  kofi: 'https://ko-fi.com/onemorecrypt',
};

const MODES: [string, string, string, string][] = [
  ['daily', '🕯️', 'Daily Descent', 'One crypt a day, the same for every player in the world, and one try. A new crypt opens at midnight Central. Finish in the top 3 for exclusive headwear, and keep a streak going for streak rewards.'],
  ['endless', '♾️', 'Endless Descent', 'Pick your hero and go as deep as you dare, with every relic you have unlocked. From floor 150, Death comes for you. The top 3 on each week\'s board win prizes.'],
  ['race', '⚔️', 'Crypt Race', 'Race other players through the same crypt live, or race the ghost of a recorded run near your own level.'],
  ['horde', '🛡️', 'Horde', 'One arena a day. Waves pour in from the edges; kill turn after turn to build a score multiplier up to ×5. A boss every 5th wave, and Death joins at wave 25. Play as often as you like: your best score of the day counts.'],
  ['night', '🌙', 'The Night Shift', 'The dead come from every side and never stop. Your relics fight for you, a boss rises every two minutes, and you can dash out of trouble. Last 30 minutes to see the dawn.'],
  ['story', '📖', 'Story', 'Walk the village of Gravesend, meet its people and take on quests in crypts with their own bosses, friends and rewards.'],
];

const FAQ: [string, string][] = [
  ['Is One More Crypt free?', 'Yes. It is free to play, with no ads. You can support it on Ko-fi if you like it.'],
  ['Do I need to download anything or make an account?', 'No. It plays in your browser on a phone or computer. You can play as a guest and pick a name whenever you like; an account just keeps your progress across devices.'],
  ['When does the Daily Crypt reset?', 'A new Daily Crypt opens every day at midnight Central Time (US). Everyone gets the same crypt, and you get one try.'],
  ['How long is a run?', 'A few minutes, which is why there is always time for one more.'],
  ['Does it work on phones?', 'Yes. Swipe or tap a tile to move, and tap your hero to wait. You can add it to your home screen and it plays like an app.'],
  ['When does Death come?', 'From floor 60 in the Daily, and floor 150 in Endless. He appears in a far corner with a countdown, then walks straight at you through walls. Nothing stops his touch: clear the floor and take the stairs before he reaches you.'],
];

function relicTags(r: RelicDef): string {
  const tags: string[] = [];
  if (ENDLESS_RELICS.includes(r.id)) tags.push('Endless only');
  else if (r.horde) tags.push('Horde only');
  else if (UNLOCKABLE_RELICS.includes(r.id)) tags.push('Unlock in the Ossuary');
  if (r.maxStack > 1) tags.push(`stacks to ${r.maxStack}`);
  return tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('');
}

function relicRows(list: RelicDef[]): string {
  return list
    .map((r) => `<li><span class="ic" aria-hidden="true">${r.emoji}</span><div><h4>${esc(r.name)}</h4><p>${esc(r.desc(1))}</p>${relicTags(r)}</div></li>`)
    .join('\n');
}

export function guidePage(site: string): string {
  const url = `${site}guide/`;
  const byRarity = (k: RelicDef['rarity']) => RELICS.filter((r) => r.rarity === k);
  const fusedById = Object.fromEntries(FUSED_RELICS.map((r) => [r.id, r]));
  const nameOf = (id: string) => (RELIC_BY_ID as Record<string, RelicDef>)[id]?.name ?? fusedById[id]?.name ?? id;
  const fusionRows = (tier2: boolean) =>
    FUSIONS.filter((f) => Boolean(f.tier) === tier2)
      .map((f) => {
        const r = fusedById[f.id];
        return `<li><span class="ic" aria-hidden="true">${r.emoji}</span><div><h4>${esc(r.name)}</h4><p class="recipe">${esc(nameOf(f.from[0]))} + ${esc(nameOf(f.from[1]))}</p><p>${esc(r.desc(1))}</p></div></li>`;
      })
      .join('\n');
  const plainFusions = FUSIONS.filter((f) => !f.tier).length;
  const ascended = FUSIONS.length - plainFusions;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'One More Crypt', item: site },
        { '@type': 'ListItem', position: 2, name: 'Guide', item: url },
      ],
    },
  ];

  const title = 'One More Crypt Guide: How to Play, Heroes, Every Relic and Fusion';
  const desc = `How to play One More Crypt, the free daily roguelike for your browser: every mode, all ${HEROES.length} heroes, all ${RELICS.length} relics, ${FUSED_RELICS.length} Soul Forge fusions, combos and tips.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="One More Crypt" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${site}og.png?v=4" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#07040b" />
<link rel="icon" type="image/svg+xml" href="../favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Pirata+One&family=Silkscreen&family=Barlow:wght@400;600&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
:root { --bg: #0b0710; --panel: #160f1c; --line: #2f2238; --text: #e8dcc4; --muted: #a99db0; --red: #d23a46; --gold: #f2c14e; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.6 Barlow, system-ui, sans-serif; }
a { color: var(--gold); }
.wrap { max-width: 920px; margin: 0 auto; padding: 0 16px; }
header { text-align: center; padding: 44px 0 26px; background: radial-gradient(ellipse at 50% 0%, #3a1220 0%, var(--bg) 70%); }
header .logo { font: 64px/1 'Pirata One', Georgia, serif; color: var(--red); text-decoration: none; text-shadow: 0 0 24px rgba(210, 58, 70, 0.5); }
h1 { font: 16px Silkscreen, monospace; letter-spacing: 3px; color: var(--gold); margin: 14px 0 0; font-weight: 400; }
.lead { max-width: 640px; margin: 14px auto 0; color: var(--text); }
.play { display: inline-block; margin-top: 20px; padding: 13px 26px; font: 15px Silkscreen, monospace; letter-spacing: 2px; color: #fff; text-decoration: none; background: linear-gradient(#d93a4a, #8e1e2a); border: 2px solid #ff6a74; }
nav { position: sticky; top: 0; z-index: 2; background: rgba(11, 7, 16, 0.95); border-bottom: 1px solid var(--line); }
nav .wrap { display: flex; gap: 18px; overflow-x: auto; padding-top: 10px; padding-bottom: 10px; }
nav a { font: 12px Silkscreen, monospace; letter-spacing: 2px; color: var(--muted); text-decoration: none; white-space: nowrap; }
nav a:hover { color: var(--gold); }
section { padding: 30px 0 6px; }
h2 { font: 34px/1.1 'Pirata One', Georgia, serif; color: var(--red); margin: 0 0 12px; font-weight: 400; }
h3 { font: 14px Silkscreen, monospace; letter-spacing: 2px; color: var(--gold); margin: 22px 0 8px; font-weight: 400; }
h4 { margin: 0; font-size: 17px; }
ol.steps { padding-left: 22px; }
ol.steps li { margin: 6px 0; }
ul.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
ul.cards li { display: flex; gap: 12px; padding: 12px 14px; background: var(--panel); border: 1px solid var(--line); }
ul.cards p { margin: 3px 0 0; color: var(--muted); font-size: 15px; line-height: 1.45; }
.ic { font-size: 24px; line-height: 1.2; flex: none; }
.tag { display: inline-block; margin: 6px 6px 0 0; padding: 1px 7px; font: 11px Silkscreen, monospace; letter-spacing: 1px; color: var(--gold); border: 1px solid #5a4422; }
.recipe { color: var(--gold) !important; font-size: 14px !important; }
dl.faq dt { font-weight: 600; margin-top: 16px; }
dl.faq dd { margin: 4px 0 0; color: var(--muted); }
footer { margin-top: 40px; padding: 28px 0 40px; border-top: 1px solid var(--line); text-align: center; color: var(--muted); font-size: 15px; }
footer a { margin: 0 8px; }
@media (max-width: 520px) { header .logo { font-size: 48px; } h2 { font-size: 28px; } }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <a class="logo" href="../">One More Crypt</a>
    <h1>The Guide</h1>
    <p class="lead">One More Crypt is a free, turn-based pixel roguelike that plays in your browser. Every day there's a new crypt, the same for everyone in the world, and you get one try. Here's everything you need to know to go deeper.</p>
    <a class="play" href="../">Play free now</a>
  </div>
</header>
<nav><div class="wrap">
  <a href="#how">How to play</a><a href="#modes">Modes</a><a href="#heroes">Heroes</a><a href="#relics">Relics</a><a href="#forge">Soul Forge</a><a href="#combos">Combos</a><a href="#foes">Foes</a><a href="#faq">FAQ</a>
</div></nav>
<main class="wrap">

<section id="how">
  <h2>How to play</h2>
  <ol class="steps">
    <li><b>Move</b> with the arrow keys or WASD, or swipe or tap a tile on a phone. Every step you take, every foe takes one too, so think before you move. Press Space (or tap your hero) to wait a turn.</li>
    <li><b>Bump to strike.</b> Walk into a foe to attack it.</li>
    <li><b>Clear the floor.</b> Slay every foe to unseal the stairs, then step on them to go deeper.</li>
    <li><b>Claim relics.</b> After each floor, pick 1 of 3 relics. They stack and combo, and your build changes as you go.</li>
    <li><b>Red tiles mean danger.</b> Archers and bosses aim first. Step off the glowing tiles before they fire.</li>
    <li><b>Elites and bosses.</b> Glowing foes are elites with a trick, worth extra Souls. Every 5th floor a boss waits.</li>
    <li><b>Strike a deal.</b> Chests, shrines and fountains offer a deal: a relic for a little blood, a rare relic for max HP, or a full heal.</li>
  </ol>
  <h3>Deeper down</h3>
  <p>Every 20 floors the crypt becomes somewhere new: the Flooded Catacombs, where foes in water lose every other turn; the Charnel Halls, full of bone piles to smash; the Burning Depths, where lava burns anything that walks in; and the Abyss, where you only see what's near you. Cracked walls hide secret vaults: bump one twice. In the Daily, foes grow far tougher past floor 30 and Death comes for you from floor 60; in Endless he waits until floor 150.</p>
</section>

<section id="modes">
  <h2>Modes</h2>
  <ul class="cards">
${MODES.map(([id, ic, name, text]) => `    <li><span class="ic" aria-hidden="true">${ic}</span><div><h4>${id === 'story' ? esc(name) : `<a href="../${id}/">${esc(name)}</a>`}</h4><p>${esc(text)}</p></div></li>`).join('\n')}
    <li><span class="ic" aria-hidden="true">🔔</span><div><h4>The Bell Tolls</h4><p>A new world boss every day. Every hit from every player lands on one shared health bar, and everyone who fought it earns the reward when it's taken down.</p></div></li>
  </ul>
</section>

<section id="heroes">
  <h2>Heroes</h2>
  <p>${HEROES.length} heroes, each with their own perk. The Knight is free; the rest are unlocked with Souls in the Ossuary, except the Bell-Ringer, who joins you when you finish the story's first act.</p>
  <ul class="cards">
${HEROES.map((h) => `    <li><div><h4>${esc(h.name)} <span class="tag">♥ ${h.hp}</span>${h.story ? '<span class="tag">Story</span>' : h.cost ? `<span class="tag">${h.cost} Souls</span>` : '<span class="tag">Free</span>'}</h4><p><b>${esc(h.perk)}.</b> ${esc(h.perkDesc)}</p></div></li>`).join('\n')}
  </ul>
</section>

<section id="relics">
  <h2>Every relic</h2>
  <p>There are ${RELICS.length} relics. After each floor you choose 1 of 3. Commons are the backbone of a build, rares are stronger, and cursed relics give great power at a price. Numbers below are for one copy; many relics grow as you stack them.</p>
  <h3>Common</h3>
  <ul class="cards">
${relicRows(byRarity('common'))}
  </ul>
  <h3>Rare</h3>
  <ul class="cards">
${relicRows(byRarity('rare'))}
  </ul>
  <h3>Cursed</h3>
  <ul class="cards">
${relicRows(byRarity('cursed'))}
  </ul>
</section>

<section id="forge">
  <h2>The Soul Forge</h2>
  <p>A Soul Forge waits on the floor after each boss. Fuse two of your relics into one stronger relic that works like several copies of both, often with a twist of its own. There are ${plainFusions} fused relics, and from floor 21 the forges can also ascend two fused relics into one of ${ascended} ascended relics.</p>
  <h3>Fused relics</h3>
  <ul class="cards">
${fusionRows(false)}
  </ul>
  <h3>Ascended relics</h3>
  <ul class="cards">
${fusionRows(true)}
  </ul>
</section>

<section id="combos">
  <h2>Combos</h2>
  <p>Relics that work especially well together. Hold a whole set in one run to discover the combo; your Crypt Hall keeps count of the ones you've found.</p>
  <ul class="cards">
${COMBOS.map((c) => `    <li><span class="ic" aria-hidden="true">${c.emoji}</span><div><h4>${esc(c.name)}</h4><p class="recipe">${c.relics.map((r) => esc(nameOf(r))).join(' + ')}</p><p>${esc(c.desc)}</p></div></li>`).join('\n')}
  </ul>
</section>

<section id="foes">
  <h2>Foes and elites</h2>
  <p>Ghouls shamble toward you, blood bats fly erratically, skeleton archers aim down a line, grave brutes hit hard but rest between blows, and wraiths drift through walls. Bosses wait on every 5th floor: the Bone Warden, the Plague Abbot and the Lich King. Glowing foes are elites with one of these tricks:</p>
  <ul class="cards">
${Object.values(ELITES).map((e) => `    <li><div><h4 style="color:${e.color}">${esc(e.name)}</h4><p>${esc(e.desc)}</p></div></li>`).join('\n')}
  </ul>
</section>

<section id="faq">
  <h2>Questions</h2>
  <dl class="faq">
${FAQ.map(([q, a]) => `    <dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('\n')}
  </dl>
  <p style="text-align:center;margin-top:30px"><a class="play" href="../">Play today's crypt</a></p>
</section>

</main>
<footer>
  <div class="wrap">
    <a href="../">Play</a>·<a href="${LINKS.discord}" rel="noopener">Discord</a>·<a href="${LINKS.x}" rel="noopener">X</a>·<a href="${LINKS.kofi}" rel="noopener">Ko-fi</a>·<a href="../press/">Press kit</a>·<a href="../privacy.html">Privacy</a>
  </div>
</footer>
</body>
</html>
`;
}
