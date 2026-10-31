// What's new: patch notes players can read from the title screen, one entry per day,
// newest first.
//
// Each day gets a headline and lists of what's new, what changed and what was fixed, written
// for players (what they'll notice, not how it was built), each line starting with an emoji.
// A day only shows from its `date` (Central Time), so something that switches on later, like a
// season, can be written ahead and stays hidden until its day. One entry per date.

export type NewsGo = 'horde' | 'story' | 'howto' | 'settings' | 'wardrobe' | 'endless' | 'daily';

export interface NewsDay {
  /** The day it went live (YYYY-MM-DD, Central Time); hidden before then. Unique. */
  date: string;
  /** The day's headline. */
  title: string;
  new?: string[];
  changes?: string[];
  fixes?: string[];
  /** Places to go and try it, shown under the notes. */
  go?: NewsGo[];
}

export const NEWS: NewsDay[] = [
  {
    date: '2026-10-30',
    title: 'Act II opens, a new forge and fairer rules',
    new: [
      '⛪ Act II, Part 1: The Sunken Cloister. Under the lid lies a drowned monastery: meet Brother Ambrose, fight through plague mist, hold the Chapter House and creep past the sleepers. 2 quests, 3 side quests and story-only rewards.',
      '🏅 Open the lid before 12 November for First Down the Lid.',
      '🔥 Fusing relics at the Soul Forge draws a magic circle in the colours of the two relics. They spiral in and meet in a burst, and the new relic gets its own reveal.',
      '✍️ Guests go straight onto the leaderboards. Type a name on the results screen to make it yours, and every run you have posted moves over to it.',
      '📖 A new How to play, with live demos of every rule and picture cards for every hero, foe and mode.',
      '⚙️ A Settings button on the title screen: sound, music, screen shake and a high contrast mode.',
      '📰 This What\'s new list.',
    ],
    changes: [
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
    new: [
      '🏹 The Ranger\'s arrows fly over your thralls, and you can lower the bow (B, or the bow button) to step toward foes instead of shooting.',
      '🏚️ The Hollow, redrawn: textured ground, trees, graves, buildings and night light.',
      '🛡️ The Horde board shows each player\'s dressed-up hero, title and Soul Rank.',
    ],
    changes: [
      '🔤 Relic choices are in alphabetical order, and you can look at the relics you hold before you pick.',
      '💾 Horde runs save, so you can continue one later.',
    ],
    fixes: ['🚪 The chapel\'s and the tavern\'s doors are drawn where they really are, so walking up to them goes in.'],
    go: ['story'],
  },
  {
    date: '2026-10-28',
    title: 'A fresh coat of paint',
    new: [
      '📜 Tap the scroll in the relic row for your whole build and the last few turns.',
      '🎁 Gifts from the Crypt Keeper: rare sets given by hand to players who help, like the Bug Exterminator for reporting bugs.',
      '💀 Death\'s Shadow, an aura for the Horde\'s Last One Standing.',
    ],
    changes: ['✨ A stone board, carved menus, punchier combat, and screens that slide in and out.'],
    fixes: [
      '❄️ World bosses and story bosses shake off frost for a few turns, so they can\'t be frozen on every shot.',
      '📱 The relic row scrolls sideways on phones, so a long run\'s relics no longer push the controls down.',
    ],
  },
  {
    date: '2026-10-27',
    title: 'New mode: Horde',
    new: [
      '🛡️ Horde: one arena a day, the same for everyone. Hold it against waves and chain kills for up to ×5.',
      '⚡ Kills fill a surge bar that brings relics, boons or the Soul Forge. A boss every 5th wave, and Death joins at wave 25.',
      '🧲 Horde-only relics: the Grave Magnet, War Drum, Gravedigger\'s Spade, Reaper\'s Invitation, Whirling Skulls and the Bone Quiver.',
      '🟣 Abyss boons: once every relic is yours deep in Endless, offers, vaults and the forge give boons instead.',
      '👆 Swipe to walk in the Hollow.',
    ],
    changes: ['☠️ Death waits in plain sight from a floor\'s first turn, with his countdown over him.'],
    go: ['horde'],
  },
  {
    date: '2026-10-26',
    title: 'Death walks, and bring a friend',
    new: [
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
