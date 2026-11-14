// What's new: patch notes players can read from the title screen, one entry per day,
// newest first.
//
// Each day gets a headline, a list of what's different and, if any, the bugs fixed, written
// for players (what they'll notice, not how it was built), each line starting with an emoji.
// A day only shows from its `date` (Central Time), so something that switches on later, like a
// season, can be written ahead and stays hidden until its day. One entry per date.

export type NewsGo = 'horde' | 'story' | 'howto' | 'settings' | 'wardrobe' | 'endless' | 'daily';

export interface NewsDay {
  /** The day it went live (YYYY-MM-DD, Central Time); hidden before then. Unique. */
  date: string;
  /** The day's headline. */
  title: string;
  /** What's different, a line each, each starting with an emoji. */
  notes: string[];
  /** Bugs fixed that players would notice, shown as a quieter line underneath. */
  fixes?: string[];
  /** Places to go and try it, shown under the notes. */
  go?: NewsGo[];
}

export const NEWS: NewsDay[] = [
  {
    date: '2026-11-13',
    title: 'Heavier hits, companions, gifts and the Soul Pyre',
    go: ['endless', 'wardrobe'],
    notes: [
      '💥 Hits land harder in the crypt: struck foes are knocked back, every kill holds the world still for a blink, and so does a blow that hurts you.',
      '🔢 Damage numbers are bigger than words like BLOCK and RISE, and pop-ups that used to land on top of each other now stack in a tidy column.',
      '🪜 Your hero walks down into the stairs when you descend.',
      '❤️ The health bar jolts when you are hurt and shows what the hit took before it drains. Floor, attack and kills are larger and jump when they change.',
      '🖥️ On a computer, a new panel under your health lists the foes left on the floor, with their health and how hard they hit.',
      '💀 Death looms on floor 150 and below: he is larger, a pool of shadow follows him and swallows the candlelight, and the dark closes in with a heartbeat as he nears.',
      '⏳ A countdown at the top of the board shows how long until Death rises, and the open stairs blaze gold while he walks.',
      '🌑 The floors where Death walks are darker and colder, so the deep feels deep.',
      '⚰️ If Death catches you, his scythe sweeps, the colour drains from the crypt, and the board holds a moment before your results.',
      '⚒️ The Soul Forge finishes better: the new relic glides out of the light onto its card, which now arrives whole, glows in the relic\'s own colour and shows the relic twice as large.',
      '🏷️ A fused relic\'s name is easier to read in the burst, and what it counts as is shown as tidy chips. Feat banners wait until you close the card.',
      '👥 Bring a friend pays more: when a friend you invite finishes their first run, you both get 500 Souls, a random companion and the Kindred Cloak. Every friend pays again.',
      '🦇 Four new companions to find by bringing friends: the Belfry Bat, Cinder Imp, Lost Wisp and Watchful Eye. Choose who follows you in the Wardrobe.',
      '☠️ Every way to die now has its own ending on the board: run through, shot, burned in lava, impaled on spikes, blown apart, taken by the plague, or broken by a boss.',
      '🛒 Companions are for sale in the Ossuary, under Cosmetics: eight to collect for Souls, from the Tame Ghoul to the Pocket Lich. Pick who follows you in the Wardrobe.',
      '🎲 In Endless you can now pay Souls to reroll the relics on offer: 100 Souls the first time, doubling with each reroll in that run.',
      '🎁 Send a friend a gift: in the Ossuary\'s new Gifts tab, pick any cloak, headwear, aura or companion it sells and send it to another player by name. If they already own it, they get half its price in Souls.',
      '🔥 The Soul Pyre is lit: everyone feeds one fire in the Ossuary. Fill it with 500,000 Souls before the month ends and everyone who gave 1,000 or more gets the Pyre Hound. New titles for giving: Kindler, Pyre-Keeper and Soulburner.',
      '🥇 The reward screen for finishing 1st in a Daily now mentions the gold glow your Crypt Champion title gets. Thanks to Seabastin for the report!',
    ],
  },
  {
    date: '2026-11-11',
    title: 'One More Crypt is coming to Android',
    notes: [
      '📱 One More Crypt is coming to the Google Play Store. Got an Android phone? Help test the app for 14 days: tap Android testers needed at the bottom of the title screen. Same game, and your progress carries over.',
    ],
  },
  {
    date: '2026-11-09',
    title: 'A quicker start for new players, and more life on screen',
    notes: [
      '👆 The tutorial is now three short steps, and a pointer shows your very first move.',
      '🎁 After your first run, tomorrow\'s gift is the first thing you see.',
      '✨ More life on screen: every hero takes a turn fighting off the dead under the title, each with their own attack, relics fly to your relic row when you claim them, heroes and foes lean into every strike, your hero blinks, and your results count up as the floors drop in.',
      '🌀 Soul Forge fusions look grander: each relic sweeps its own colour across the whole screen as the pair spin together.',
    ],
    fixes: ['🎬 The heroes under the title now keep taking turns on computers set to reduce motion, instead of standing still.'],
  },
  {
    date: '2026-11-07',
    title: 'Night Shift: choose your hero, ultimates, Night Ranks, and a tighter night',
    notes: [
      '🌙 Before each night, choose your hero and your companion. Your picks are remembered, so Start is still one tap.',
      '⚔️ Every hero now brings their own weapon to the night: the Knight\'s Bulwark, the Rogue\'s Shadow Knives, the Necromancer\'s Bone Legion, the Paladin\'s Holy Nova, the Ranger\'s Arrow Rain, the Mage\'s Arcane Orb, the Barbarian\'s Ground Slam and the Bell-Ringer\'s Great Toll. Each has its own Soul Forge fusion.',
      '🏅 Night Ranks: everything you put down counts toward the next rank, and ranks open new companions, the helper relics and new gear. Your past nights already count.',
      '🎬 Finish your first daily and a short clip shows what else waits in the crypt: Endless, Horde, the Night Shift and Story.',
      '📋 Copy your result is back where you can see it: right under your numbers when a run ends, and on the title screen for today\'s finished daily.',
      '⚡ Every hero has an ultimate in the Night Shift: fill the meter by putting down the dead, then unleash it with the gold button or E. Last Stand, Shadow Dance, Army of the Dead, Divine Light, Hail of Arrows, Meteor, Berserk and Doom Toll, each with its own big moment on screen and its own sound.',
      '🌙 A tighter Night Shift: bosses rise every minute and a half, two at a time from the tenth minute, the new dead arrive sooner, the Night Mother rises at 15 minutes and dawn breaks at 20.',
      '🎨 Every relic, fusion, boon, blessing and pact has a new hand-made pixel-art icon instead of an emoji.',
      '🗡️ Companion gear at the Night Shrine: Companion\'s Blade, War Banner, Old Bond, Helper\'s Charm and Oathstone, each opening at a Night Rank.',
      '🤝 Night Shift companions, hounds, spectral knights and thralls now roam the ground around you and fight there, instead of crowding at your side.',
      '👤 Spectral Knights are now pale ghosts, so you can always tell them from yourself.',
    ],
    fixes: ['🔍 The Night Shift no longer zooms out when your row of relics grows onto a new line.', '📏 The Night Shift\'s field stays full size however many relics you carry: they sit in one row you can swipe.', '⚡ No more lightning buzzing on and on while you choose a relic in the Night Shift.'],
  },
  {
    date: '2026-11-06',
    title: 'Companions in the Night Shift, a calmer title screen, and links straight into a mode',
    notes: [
      '🤝 Night Shift companions: choose another hero to walk the night with you. The Ranger shoots, the Mage casts, the Knight holds the dead off you, the Necromancer raises thralls, and more. Level-ups now and then make them stronger. Change who it is at the Night Shrine.',
      '🗿 Three new Night Shift relics that fight beside you: the Thrall Totem, the Crypt Hound and the Spectral Knight, each with its own fusion.',
      '🕯️ The title screen is now just today\'s crypt, Delve deeper (Endless, Horde and the Night Shift) and Story. Everything else is under More.',
      '🔗 Share a link that opens one mode directly, each with its own preview: onemorecrypt.com/daily, /endless, /horde or /night.',
      '🔥 On the relic screen, Rest now sits apart from the relics and asks for a second tap, so a slip no longer costs you a relic. When your health is low it still takes one tap.',
      '❤ Rest now says when you are already at full health.',
      '🔒 A privacy policy is now linked from Settings and the title screen.',
    ],
    fixes: ['💨 The Night Shift\'s dash button now lights back up when the dash is ready.'],
  },
  {
    date: '2026-11-05',
    title: 'The Night Shift\'s biggest night, and light in the dark',
    notes: [
      '🌅 Dawn: survive 30 minutes and the night is won. Greet the sun for half again the Souls, or walk on into the Nightmare.',
      '💀 New dead join as the night goes on: Bone Archers, walls of Shieldbearers, Drowned Chargers and Plague Monks who raise the fallen.',
      '👁️ The Void Eye joins the bosses, and at 25 minutes the Night Mother rises.',
      '🕯️ The Night Shrine: spend Souls on gifts for every night. More health, rerolls, banishing relics you never want, and a weapon to start with.',
      '🎲 Level-ups can be rerolled or skipped, and relics banished for the night.',
      '🦸 Every hero brings a perk to the night.',
      '🌙 Night events: every two minutes, a minute after each boss, the night turns. A Blood Moon, a Swarm closing in from every side, a Grave Fog, or a Treasure Ghoul fleeing with a chest worth two levels.',
      '✴️ Elites from level 55: glowing dead with gifts of their own. Armored ones shrug off harm until a dash cracks them; others split, explode or blink to your side.',
      '🕯️ Night Pacts: when a boss falls, take a curse on the night for a boon, or refuse. Every pact raises what the night can pay in Souls.',
      '✦ Ascension: from level 40, bosses leave a shard that ascends a fused relic into something far stronger, struck in gold.',
      '🏅 New achievements: Dawnbringer, Mother of Night, Into the Nightmare, Ascendant, Pactbound and Gold Digger.',
      '🕯️ The crypt is lit by its lights now: candles, lava, the open stairs, potions, burning and frozen foes and bosses each throw their own light, and your relics tint your lantern.',
      '🌙 The Night Shift: the night deepens and turns as the hours pass, every flame and strike lights the graveyard, and a moon by the clock shows the hour.',
      '☠️ Bosses in the Night Shift make an entrance, and the dead fall each their own way, leaving bones and ichor behind.',
      '🔢 Damage numbers for the Night Shift, if you like them, in Settings.',
      '☁️ Signed in? An unfinished run is kept on your account, so clearing your browser or switching device won\'t lose it.',
    ],
    fixes: ['✨ The choice you\'re on now lights up on every Night Shift card.'],
    go: ['settings'],
  },
  {
    date: '2026-11-04',
    title: 'The Mage casts Magic Missile',
    notes: [
      '✨ The Mage: wait a turn to cast a Magic Missile at the nearest foe in sight, every other turn. It hits like his attack, relics and all. In Endless and the story now; in the Daily and Horde from Daily #23.',
      '🎩 The Arcane Circlet: slay 25 foes with Magic Missiles in one run as the Mage.',
      '⏳ Relics that go off every few turns, kills or hits show a countdown on their icon, and the Rogue, Bell-Ringer and Mage get one for their own perk.',
      '👤 The Rogue: HIDING shows over your hero when your next step will go unseen.',
      '🚪 After the Daily, jump straight into Endless, the Horde or the Night Shift from right under your results.',
      '🔒 Picked a name as a guest? Add an email to keep it, so clearing your browser never loses it.',
    ],
    go: ['endless', 'wardrobe'],
  },
  {
    date: '2026-11-03',
    title: 'Weekly Trials, hero mastery and a pile of new goals',
    notes: [
      '🎯 The Weekly Trial: one goal a week, the same for everyone, met over your ordinary runs in any mode. Complete it for 300 Souls, and trials completed add up to a cloak and an aura.',
      '⭐ Hero mastery: every hero has five ranks, earned with the Souls you win as them. Rank 3 brings their mastery cloak, rank 5 the title Master.',
      '🛒 The Grave Market: one rare cloak, hat or aura on sale each day at the top of the Ossuary, the same for everyone. Each is sold only on its day.',
      '🛡️ Grave Wards: every 7 Dailies in a row earn a ward that keeps your streak through one missed day. Daily totals (10, 30, 100 and 365, in a row or not) bring Souls, titles and rewards.',
      '🌙 Night Shift achievements: survive 5, 15 and 25 minutes, put down thousands, take down all three bosses and more, with cloaks, hats, auras and Hall pieces.',
      '🏆 New achievements: Unscathed, Courier, Ascetic and Giant Killer for skilled runs; boss hats for slaying each boss 25 times; the Monster Hunter set from the Bestiary; and rewards for answering friends\' summons and winning challenges.',
      '🏰 Four new Hall decorations in the Ossuary: a Crypt Library, a Hound\'s Bed, a Trophy Pedestal and a Grave Hearth with a live fire.',
      '⚔️ Rivals: make anyone your rival from their Hall, and the title screen compares your Daily and your deepest descents.',
      '🤝 Everyone together: a monthly count of foes slain by all players. Reach 1,000,000 and everyone who played that month earns a Hall banner.',
      '💰 Soul Surge: double Souls from every run on the second Saturday of each month and the Sunday after.',
      '📈 The results screen names your next goal, and your 2nd and 3rd runs of the day pay extra Souls.',
      '🔁 A Retry button on every results screen but the Daily\'s, to jump straight back in.',
      '❤️ The support button is now a heart.',
      '🌫️ Act II\'s plague mist is now easy to see, even away from your light.',
    ],
    fixes: [
      '🔢 Small numbers are easier to read: a 2 no longer looks like an 8.',
      '✨ Menus no longer blink when you switch tabs or buy something, and the relic screen no longer flashes after it opens.',
    ],
    go: ['wardrobe', 'endless'],
  },
  {
    date: '2026-11-01',
    title: 'The Harvest Feast, and longer nights',
    notes: [
      '🍂 The Harvest Feast runs from today to Thanksgiving. Leaves fall over the Hollow, pumpkins sit on every lit doorstep, and down in every crypt leaves drift over the floor and gourds lean on the walls. The Night Shift\'s graveyard turns too.',
      '🧥 Play any run during the Feast for the Harvest Mantle.',
      '🛍️ The Ossuary sells autumn cloaks, hats and auras until Thanksgiving, and the Hall has harvest decorations to buy.',
      '🏰 A Decorate tab in your Hall: choose which decorations go up. Hidden pieces stay yours.',
      '🦇 Night Shift: the Shade Cloak, a new charm that brings your dash back sooner.',
      '🧪 Night Shift: healing potions now drop, and every boss leaves an ember from the Soul Forge to forge or sharpen a weapon for free.',
      '✨ Night Shift: once your relics are all maxed, blessings keep the level-ups coming.',
      '↩️ Every screen has a Back button in the top corner, and your phone\'s Back goes back a screen or pauses instead of closing the game.',
    ],
    go: ['wardrobe'],
  },
  {
    date: '2026-10-31',
    title: 'New mode: the Night Shift',
    notes: [
      '🌙 The Night Shift: survive as long as you can while the dead pour in. Your relics fight for you, a boss rises every two minutes, and kills are your score on its own leaderboard. Find it under Horde with the NEW button.',
      '💨 Dash through the dead to knock them aside (Space on a computer, the dash button on phones).',
      '🔥 Max a weapon and hold its charm to forge them together at the Soul Forge.',
      '🌾 Grave Shift has closed; what you bought from Mortimer stays yours.',
      '🖥️ On a computer the game fills the window, with your stats on one side and your relics on the other.',
      '🌀 The Soul Forge\'s fusion now plays on every computer. A new Calm motion setting skips it and softens movement.',
      '⚖️ On the deep floors, a blood shrine or a hidden vault gives one Abyss boon, the same as a chest. In Endless and the story now; in the Daily and Horde from Daily #19.',
    ],
    go: ['horde', 'settings'],
  },
  {
    date: '2026-10-30',
    title: 'Act II opens, Grave Shift, a new forge and fairer rules',
    notes: [
      '⛪ Act II, Part 1: The Sunken Cloister. Under the lid lies a drowned monastery: meet Brother Ambrose, fight through plague mist, hold the Chapter House and creep past the sleepers. 2 quests, 3 side quests and story-only rewards.',
      '🏅 Open the lid before 12 November for First Down the Lid.',
      '🌾 Grave Shift is open to everyone: Mortimer\'s old plot behind Gravesend. Grow crops, put restless graves back to rest, and trade with Mortimer for Obols, then spend them on cloaks, headwear and an aura only he sells.',
      '🔥 Fusing relics at the Soul Forge draws a magic circle in the colours of the two relics. They spiral in and meet in a burst, and the new relic gets its own reveal.',
      '✍️ Guests go straight onto the leaderboards. Type a name on the results screen to make it yours, and every run you have posted moves over to it.',
      '📖 A new How to play, with live demos of every rule and picture cards for every hero, foe and mode.',
      '⚙️ A Settings button on the title screen: sound, music, screen shake and a high contrast mode.',
      '📰 This What\'s new list.',
      '⚖️ No chest can be cut off behind the stairs, and Death\'s waiting square is safe to cross until he rises.',
      '🗡️ Death still walks on the Rogue\'s free steps. The Mage gains 1 attack for every 4, and the Knight heals a tenth of max HP each floor. In Endless and the story now; in the Daily and Horde from Daily #18.',
      '🗝️ A Skeleton Key\'s two relics (or two boons) now both show their names.',
      '⌨️ Every choice can be made from the keyboard.',
    ],
    fixes: [
      '🪣 On phones, walking into the well, the obelisk or a ghost no longer presses its buttons with the same tap.',
      '🎨 A page opened in the moment an update goes live now fixes itself instead of showing up without its styling.',
    ],
    go: ['story', 'howto', 'settings'],
  },
  {
    date: '2026-10-29',
    title: 'The Ranger\'s volley and a redrawn Hollow',
    notes: [
      '🏹 The Ranger\'s arrows fly over your thralls, and you can lower the bow (B, or the bow button) to step toward foes instead of shooting.',
      '🏚️ The Hollow, redrawn: textured ground, trees, graves, buildings and night light.',
      '🛡️ The Horde board shows each player\'s dressed-up hero, title and Soul Rank.',
      '🔤 Relic choices are in alphabetical order, and you can look at the relics you hold before you pick.',
      '💾 Horde runs save, so you can continue one later.',
    ],
    fixes: ['🚪 The chapel\'s and the tavern\'s doors are drawn where they really are, so walking up to them goes in.'],
    go: ['story'],
  },
  {
    date: '2026-10-28',
    title: 'A fresh coat of paint',
    notes: [
      '📜 Tap the scroll in the relic row for your whole build and the last few turns.',
      '🎁 Gifts from the Crypt Keeper: rare sets given by hand to players who help, like the Bug Exterminator for reporting bugs.',
      '💀 Death\'s Shadow, an aura for the Horde\'s Last One Standing.',
      '✨ A stone board, carved menus, punchier combat, and screens that slide in and out.',
    ],
    fixes: [
      '❄️ World bosses and story bosses shake off frost for a few turns, so they can\'t be frozen on every shot.',
      '📱 The relic row scrolls sideways on phones, so a long run\'s relics no longer push the controls down.',
    ],
  },
  {
    date: '2026-10-27',
    title: 'New mode: Horde',
    notes: [
      '🛡️ Horde: one arena a day, the same for everyone. Hold it against waves and chain kills for up to ×5.',
      '⚡ Kills fill a surge bar that brings relics, boons or the Soul Forge. A boss every 5th wave, and Death joins at wave 25.',
      '🧲 Horde-only relics: the Grave Magnet, War Drum, Gravedigger\'s Spade, Reaper\'s Invitation, Whirling Skulls and the Bone Quiver.',
      '🟣 Abyss boons: once every relic is yours deep in Endless, offers, vaults and the forge give boons instead.',
      '👆 Swipe to walk in the Hollow.',
      '☠️ Death waits in plain sight from a floor\'s first turn, with his countdown over him.',
    ],
    go: ['horde'],
  },
  {
    date: '2026-10-26',
    title: 'Death walks, and bring a friend',
    notes: [
      '☠️ From floor 150 in Endless, Death waits in a corner, then walks straight at you through walls. Take the stairs first.',
      '🤝 Bring a friend: after a run, tap 👥 Bring a friend to share your link. You both get the Kindred Cloak, and more as more friends join.',
    ],
    go: ['endless'],
  },
];

/** The days live on a Central date, newest first. */
export function liveNews(today: string, all: NewsDay[] = NEWS): NewsDay[] {
  return all.filter((n) => n.date <= today).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

/** How many live days are newer than the last one read. */
export function unreadNews(today: string, lastRead: string | null, all: NewsDay[] = NEWS): number {
  const live = liveNews(today, all);
  if (!lastRead) return live.length;
  return live.filter((n) => n.date > lastRead).length;
}
