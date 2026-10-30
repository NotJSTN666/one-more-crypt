// What's new: the updates players can read from the title screen, newest first.
//
// Entries are added at the end of each day for whatever went live that day, written for
// players (what they'll notice, not how it was built). An entry only shows from its `date`
// (Central Time), so something that switches on later, like a season, can be written ahead
// and stays hidden until its day. Keep `id`s unique: the unread dot keys off the newest one.

export type NewsGo = 'horde' | 'story' | 'howto' | 'settings' | 'wardrobe' | 'endless' | 'daily';

export interface NewsItem {
  /** Unique, never reused. */
  id: string;
  /** The day it went live (YYYY-MM-DD, Central Time); hidden before then. */
  date: string;
  emoji: string;
  title: string;
  /** A line or two each, in plain words. */
  lines: string[];
  /** Somewhere to go and try it. */
  go?: NewsGo;
}

export const NEWS: NewsItem[] = [
  {
    id: '2026-10-30-name-box',
    date: '2026-10-30',
    emoji: '✍️',
    title: 'Your name on the board, right there',
    lines: [
      'Guests now go straight onto the leaderboards, so you can see where you placed.',
      'Type a name on the results screen to make it yours. Every run you have posted moves over to it.',
    ],
  },
  {
    id: '2026-10-30-forge',
    date: '2026-10-30',
    emoji: '🔥',
    title: 'A fusion worth watching',
    lines: [
      'Fusing two relics at the Soul Forge now draws a magic circle in the colours of the relics going in.',
      'They spiral in on ribbons of light and meet in a burst, and the new relic gets its own reveal.',
    ],
  },
  {
    id: '2026-10-30-howto',
    date: '2026-10-30',
    emoji: '📖',
    title: 'A new How to play',
    lines: ['Live demos of every rule, and picture cards for every hero, foe and mode.'],
    go: 'howto',
  },
  {
    id: '2026-10-30-balance',
    date: '2026-10-30',
    emoji: '⚖️',
    title: 'Fairer rules',
    lines: [
      'No chest can be cut off behind the stairs, and Death’s waiting square is safe to cross until he rises.',
      'Death still walks on the Rogue’s free steps. The Mage gains 1 attack for every 4, and the Knight heals a tenth of max HP each floor.',
      'In Endless and the story now; in the Daily and Horde from Daily #18.',
    ],
  },
  {
    id: '2026-10-30-settings',
    date: '2026-10-30',
    emoji: '⚙️',
    title: 'Settings, and easier on the eyes',
    lines: [
      'A ⚙️ button on the title screen: sound, music, screen shake and a high contrast mode.',
      'Every choice can now be made from the keyboard.',
    ],
    go: 'settings',
  },
  {
    id: '2026-10-30-act2',
    date: '2026-10-30',
    emoji: '⛪',
    title: 'Act II, Part 1: The Sunken Cloister',
    lines: [
      'Under the lid lies a drowned monastery. Meet Brother Ambrose, fight through plague mist, hold the Chapter House and creep past the sleepers.',
      '2 quests, 3 side quests and story-only rewards. Open the lid before 12 November for First Down the Lid.',
    ],
    go: 'story',
  },
  {
    id: '2026-10-29-ranger',
    date: '2026-10-29',
    emoji: '🏹',
    title: 'The Ranger’s volley',
    lines: ['Arrows fly over your thralls, and you can lower the bow (B, or the bow button) to step toward foes instead of shooting.'],
  },
  {
    id: '2026-10-29-hollow',
    date: '2026-10-29',
    emoji: '🏚️',
    title: 'The Hollow, redrawn',
    lines: ['Textured ground, trees, graves, buildings and night light all over the graveyard and village.'],
    go: 'story',
  },
  {
    id: '2026-10-29-relics',
    date: '2026-10-29',
    emoji: '🗝️',
    title: 'Easier relic choices',
    lines: [
      'Relic choices are in alphabetical order, and you can look at the relics you hold before you pick.',
      'Horde runs now save, so you can continue one later.',
    ],
  },
  {
    id: '2026-10-28-visual',
    date: '2026-10-28',
    emoji: '✨',
    title: 'A fresh coat of paint',
    lines: ['A stone board, carved menus, punchier combat, and screens that slide in and out.'],
  },
  {
    id: '2026-10-28-build',
    date: '2026-10-28',
    emoji: '📜',
    title: 'Your build at a glance',
    lines: ['Tap the scroll in the relic row for your whole build and the last few turns.'],
  },
  {
    id: '2026-10-27-horde',
    date: '2026-10-27',
    emoji: '🛡️',
    title: 'New mode: Horde',
    lines: [
      'One arena a day, the same for everyone. Hold it against waves and chain kills for up to ×5.',
      'Fill the surge bar for relics, meet Horde-only relics, and see if you last to wave 25, when Death joins in.',
    ],
    go: 'horde',
  },
  {
    id: '2026-10-27-deep',
    date: '2026-10-27',
    emoji: '🟣',
    title: 'Abyss boons',
    lines: ['Once every relic is yours deep in Endless, offers, vaults and the forge give boons instead: attack, shields, lives and more.'],
    go: 'endless',
  },
  {
    id: '2026-10-26-death',
    date: '2026-10-26',
    emoji: '☠️',
    title: 'Death walks from floor 150',
    lines: ['Deep in Endless, Death waits in a corner with a countdown, then walks straight at you through walls. Take the stairs first.'],
    go: 'endless',
  },
  {
    id: '2026-10-26-invite',
    date: '2026-10-26',
    emoji: '🤝',
    title: 'Bring a friend',
    lines: ['After a run, tap 👥 Bring a friend to share your invite link. You both get the Kindred Cloak, and more as more friends join.'],
  },
];

/** The entries live on a Central date, newest first. */
export function liveNews(today: string, all: NewsItem[] = NEWS): NewsItem[] {
  return all.filter((n) => n.date <= today).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

/** How many live entries are newer than the last one read. */
export function unreadNews(today: string, lastRead: string | null, all: NewsItem[] = NEWS): number {
  const live = liveNews(today, all);
  if (!lastRead) return live.length;
  const i = live.findIndex((n) => n.id === lastRead);
  return i < 0 ? live.length : i;
}
