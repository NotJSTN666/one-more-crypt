// One TikTok a day: the ideas go round in this order, one each day from November 10, 2026.
// hook: the line over the video (HTML, <b> for the gold words). caption and tags: the post.
// The scenes are explained in record.mjs.
const ULT = {
  knight: { companion: 'paladin', relics: { spade: 3, bulwark: 5, skulls: 5, storm: 4, frost: 3, heart: 4, lens: 2 }, fused: { halo: true } },
  rogue: { companion: 'mage', relics: { spade: 3, knives: 5, scythe: 4, storm: 4, cloak: 3, boots: 3 } },
  necro: { companion: 'knight', relics: { spade: 3, legion: 5, wisps: 5, spikes: 4, totem: 4, fang: 3 }, fused: { legion: true } },
  paladin: { companion: 'ranger', relics: { spade: 5, nova: 5, bell: 4, frost: 4, heart: 3, thorns: 2 } },
  ranger: { companion: 'barbarian', relics: { spade: 3, arrowrain: 5, quiver: 5, lance: 4, hound: 4, magnet: 3 } },
  mage: { companion: 'necro', relics: { spade: 3, orb: 5, storm: 5, ember: 4, frost: 3, lens: 3 } },
  barbarian: { companion: 'bellringer', relics: { spade: 5, slam: 5, skulls: 4, ember: 4, whetstone: 4 } },
  bellringer: { companion: 'rogue', relics: { spade: 3, toll: 5, bell: 5, spikes: 4, spectre: 3, thorns: 3 } },
};
const ult = (hero, extra) => ({ scene: 'night', hero, ...ULT[hero], t: 560, level: 44, kills: 4200, ultAt: 3.5, ...extra });

export const IDEAS = [
  ult('ranger', {
    hook: 'POV: you saved the Ranger\'s ultimate for <b>this moment</b>',
    caption: 'Arrow rain on a whole graveyard of the dead 🏹 The Night Shift in One More Crypt, free in your browser at onemorecrypt.com',
    tags: ['#roguelike', '#survivorslike', '#pixelart', '#indiegame', '#browsergame'],
  }),
  {
    scene: 'night', hero: 'mage', companion: 'necro', t: 900, level: 40, kills: 3800,
    relics: { spade: 5, skulls: 5, scythe: 5, wisps: 5, ember: 5, storm: 5, frost: 5, bell: 4, lens: 2, heart: 3, boots: 2 }, fused: { halo: true, eclipse: true, tempest: true, glacier: true },
    hook: '15 minutes into the night.<br><b>The relics do all the fighting.</b>',
    caption: 'Survive till dawn. Every relic you pick fights for you 🌙 Free to play at onemorecrypt.com',
    tags: ['#survivorslike', '#roguelite', '#pixelart', '#indiegame', '#freegames'],
  },
  {
    scene: 'crypt', hero: 'knight', floor: 44, seconds: 10,
    hook: 'Floor 44 of the crypt.<br>How deep can <b>you</b> go?',
    caption: 'One crypt, no limit, no saves. How far do you get? ⚔️ Free in your browser: onemorecrypt.com',
    tags: ['#roguelike', '#dungeoncrawler', '#pixelart', '#indiegame', '#browsergame'],
  },
  ult('mage', {
    hook: 'The Mage\'s ultimate clears the <b>whole screen</b>',
    caption: 'Which hero has the best ultimate? 🔮 Try them all free at onemorecrypt.com',
    tags: ['#roguelike', '#survivorslike', '#pixelart', '#gaming', '#indiegame'],
  }),
  {
    scene: 'daily', seconds: 10,
    hook: 'Everyone in the world gets <b>the same crypt</b> today.<br>You get one try.',
    caption: 'A new crypt every day, one attempt, one leaderboard. Beat my floor? 💀 onemorecrypt.com',
    tags: ['#dailychallenge', '#roguelike', '#pixelart', '#indiegame', '#freegames'],
  },
  ult('necro', {
    hook: 'Necromancer mains: your army <b>never stops growing</b>',
    caption: 'Every foe you take down joins your side 💀 The Night Shift, free at onemorecrypt.com',
    tags: ['#necromancer', '#survivorslike', '#pixelart', '#indiegame', '#roguelite'],
  }),
  {
    scene: 'horde', hero: 'barbarian', seconds: 10,
    hook: 'Horde mode: how many waves can <b>you</b> hold?',
    caption: 'Wave after wave of the dead and no way out 🛡️ Free in your browser at onemorecrypt.com',
    tags: ['#hordemode', '#roguelike', '#pixelart', '#indiegame', '#browsergame'],
  },
  ult('barbarian', {
    hook: 'The Barbarian\'s ultimate is <b>an earthquake</b>',
    caption: 'Slam. Everything. 🪓 One More Crypt is free to play at onemorecrypt.com',
    tags: ['#roguelike', '#survivorslike', '#pixelart', '#gaming', '#indiegame'],
  }),
  {
    scene: 'night', hero: 'knight', companion: 'ranger', t: 240, level: 24, kills: 1200, boss: true,
    relics: { spade: 4, skulls: 4, scythe: 3, quiver: 3, storm: 3, heart: 2 },
    hook: 'When the first boss rises at <b>minute 1:30</b>',
    caption: 'A boss every 90 seconds, then the Night Mother 🌙 Can you see the dawn? onemorecrypt.com',
    tags: ['#bossfight', '#survivorslike', '#pixelart', '#indiegame', '#roguelite'],
  },
  ult('paladin', {
    hook: 'The Paladin\'s ultimate: <b>holy nova</b>',
    caption: 'Light it up ✨ 8 heroes, 8 ultimates, free at onemorecrypt.com',
    tags: ['#paladin', '#survivorslike', '#pixelart', '#indiegame', '#freegames'],
  }),
  ult('rogue', {
    hook: 'Rogue ultimate: <b>a storm of knives</b>',
    caption: 'Fast, sharp, gone 🗡️ Play the Night Shift free at onemorecrypt.com',
    tags: ['#roguelike', '#survivorslike', '#pixelart', '#gaming', '#browsergame'],
  }),
  {
    scene: 'night', hero: 'ranger', companion: 'barbarian', t: 420, level: 32, kills: 2200,
    relics: { spade: 3, slam: 5, skulls: 4, storm: 4, hound: 4, spectre: 3, totem: 3, heart: 2, lens: 2 }, fused: { halo: true },
    hook: 'You don\'t fight the night alone.<br><b>Bring a companion.</b>',
    caption: 'Pick a hero, pick a companion, survive till dawn 🌙 Free in your browser: onemorecrypt.com',
    tags: ['#survivorslike', '#roguelite', '#pixelart', '#indiegame', '#coop'],
  },
  ult('knight', {
    hook: 'The Knight\'s ultimate: <b>nothing gets through</b>',
    caption: 'Shield up 🛡️ One More Crypt is free to play at onemorecrypt.com',
    tags: ['#roguelike', '#survivorslike', '#pixelart', '#indiegame', '#browsergame'],
  }),
  ult('bellringer', {
    hook: 'The Bellringer\'s ultimate: <b>the toll of the dead</b>',
    caption: 'For whom the bell tolls? Them 🔔 Free at onemorecrypt.com',
    tags: ['#roguelike', '#survivorslike', '#pixelart', '#indiegame', '#gaming'],
  }),
];

/** The idea for a day (YYYY-MM-DD). */
export function ideaFor(date) {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse('2026-11-10T12:00:00Z')) / 86400000);
  return IDEAS[((days % IDEAS.length) + IDEAS.length) % IDEAS.length];
}
