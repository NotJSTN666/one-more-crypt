// Story mode, Act I: The Bell Beneath. Played out in the world above the crypt: you walk
// Gravesend, meet the people who live there in their own homes, and take on quests that
// send you down into dungeons. Story runs never touch the daily or the leaderboards.

import type { EnemyKind } from './game';

export type Speaker = 'gravedigger' | 'aldric' | 'warden' | 'hound' | 'bess' | 'agnes' | 'pip' | 'hero' | 'narrator';
/** People you can talk to in the world. */
export type NpcId = 'gravedigger' | 'aldric' | 'bess' | 'agnes' | 'pip';

export interface Say {
  who: Speaker;
  text: string;
}

export interface Choice {
  /** Remembered in the player's story choices under this key. */
  key: string;
  prompt: string;
  options: { label: string; value: string; then: Say[] }[];
}

export type Line = Say | Choice;

export interface Dungeon {
  name: string;
  /** First and last floor: later quests start deeper, with gifts to match. */
  floors: [number, number];
  gifts: number;
  summon?: boolean;
  boss?: { floor: number; kind: EnemyKind };
  /** Said when the boss floor opens. */
  bossLines?: Line[];
}

export interface Quest {
  n: number;
  title: string;
  side?: boolean;
  /** Who hands it out and who you report back to. */
  giver: NpcId;
  /** A quest that must be finished first. */
  needs?: number;
  dungeon: Dungeon;
  souls: number;
  reward: string;
  /** Where to go, for the quest log. */
  hint: string;
  offer: Line[];
  reminder: Line[];
  /** At the bottom of the dungeon. */
  cleared: Line[];
  /** Back with the giver. Without it the quest ends when the dungeon is cleared. */
  turnIn?: Line[];
  /** Shown when you try the dungeon's door before taking the quest. */
  barred: string;
}

export const ACT_TITLE = 'Act I: The Bell Beneath';

export const SPEAKERS: Record<Speaker, string> = {
  gravedigger: 'Mortimer',
  aldric: 'Sir Aldric',
  warden: 'The Bone Warden',
  hound: '{pet}',
  bess: 'Old Bess',
  agnes: 'Widow Agnes',
  pip: 'Pip',
  hero: 'You',
  narrator: '',
};

/** The hound's name depends on how you met. */
export function petName(choice: string | undefined): string {
  return choice === 'left' ? 'Chomp' : 'Cinder';
}

/** The hound grows with every story floor you clear together. */
export function houndStats(bond: number): { hp: number; dmg: number } {
  return { hp: 4 + Math.min(6, Math.floor(bond / 5)), dmg: 1 + Math.min(2, Math.floor(bond / 12)) };
}

export const QUESTS: Quest[] = [
  {
    n: 1,
    title: 'Fresh Dirt',
    giver: 'gravedigger',
    dungeon: { name: 'The Old Crypt Stairs', floors: [1, 6], gifts: 0 },
    souls: 150,
    reward: '150 Souls',
    hint: 'Take the Old Crypt Stairs in the graveyard, by Mortimer\'s cottage.',
    barred: "An iron gate, locked tight. Mortimer keeps the key, and Mortimer keeps the kettle on. His cottage is just there.",
    offer: [
      { who: 'gravedigger', text: "Oh good, a live one. Do you know how rare those are round here? Rarer than a polite ghoul. Come in, mind the shovels." },
      { who: 'gravedigger', text: "Name's Mortimer. I dig the graves. Someone has to, and the dead are hopeless with shovels." },
      { who: 'gravedigger', text: 'Every midnight a bell tolls under the graveyard, and the whole crypt shuffles its furniture. I want to know who is ringing it. I want them to stop.' },
      { who: 'hero', text: 'And you want me to go down there.' },
      { who: 'gravedigger', text: "I'd go myself, but I've a bad back and a very strong sense of self-preservation. Here's the key to the Old Crypt Stairs, out by the gate. Six floors down. Have a look. Try not to die, the paperwork is dreadful." },
    ],
    reminder: [{ who: 'gravedigger', text: "The Old Crypt Stairs, right outside. Six floors. I'll put the kettle on. For me, mostly." }],
    cleared: [
      { who: 'narrator', text: 'At the bottom of the stairs, among the bones, lies a length of rope black with age. It hums faintly, as if it remembers being pulled.' },
      { who: 'narrator', text: 'Mortimer will want to see this.' },
    ],
    turnIn: [
      { who: 'gravedigger', text: "A bell-rope! Or a very long, very sad shoelace. Either way, someone's been pulling it." },
      { who: 'gravedigger', text: "Here, take some Souls for your trouble. Don't ask where I keep them." },
      { who: 'gravedigger', text: 'Hush. Hear that? Through the window, from up past the village. Something is howling.' },
    ],
  },
  {
    n: 2,
    title: 'The Kennel',
    giver: 'gravedigger',
    needs: 1,
    dungeon: { name: 'The Kennel Cellar', floors: [2, 8], gifts: 1 },
    souls: 200,
    reward: 'A companion',
    hint: 'The old kennels are north of the village. Go down into the Kennel Cellar.',
    barred: 'The cellar door is chained shut. Something behind it howls. Mortimer will want to hear about this.',
    offer: [
      { who: 'gravedigger', text: 'The howling comes from the old kennels, north of the village. The Warden kept hounds once, to sniff out escaped corpses. Long story. Very smelly.' },
      { who: 'gravedigger', text: "Whatever's down that cellar has been crying for an age. Here's the key to the chain. Go on. You're braver than me. Low bar, I grant you." },
    ],
    reminder: [{ who: 'gravedigger', text: 'North through the village, to the kennels. Follow the howling. Or the smell. Both lead the same way.' }],
    cleared: [
      { who: 'narrator', text: 'In the last cell, chained to the wall, sits a hound made of shadow and stubbornness. Its eyes glow like coals. Its tail, against all odds, is wagging.' },
      { who: 'hound', text: '*Wuff.*' },
      {
        key: 'hound',
        prompt: 'The chain is old. One good blow would break it.',
        options: [
          {
            label: 'Break the chain',
            value: 'freed',
            then: [{ who: 'narrator', text: 'The chain snaps. The hound sniffs your boots, decides they are acceptable, and falls in step beside you. You decide to call it Cinder, for the eyes.' }],
          },
          {
            label: "Leave it. It's probably cursed.",
            value: 'left',
            then: [
              { who: 'narrator', text: 'You walk away. Behind you the chain rattles. Then it rattles harder. Then something goes *crunch*.' },
              { who: 'narrator', text: 'When you reach the stairs, the hound is already sitting there, half a chain in its teeth, looking extremely pleased with itself. Chomp, then.' },
            ],
          },
        ],
      },
      { who: 'narrator', text: 'The Crypt Hound joins you. It fights at your side in the story, and trots behind you everywhere else.' },
    ],
  },
  {
    n: 3,
    title: 'The Hollow Knight',
    giver: 'aldric',
    needs: 2,
    dungeon: { name: 'The Flooded Crypt', floors: [3, 9], gifts: 2 },
    souls: 250,
    reward: "Aldric's Mantle, a cloak",
    hint: 'Sir Aldric haunts the ruined chapel, east of the village. The Flooded Crypt lies beneath it.',
    barred: 'Black water fills the stairs below the chapel. Something in this room is watching you.',
    offer: [
      { who: 'narrator', text: 'The chapel is cold enough to see your breath. {pet} growls at the shape standing by the armour.' },
      { who: 'aldric', text: 'Peace, hound. I am only a ghost, and a poor one at that. Welcome to my quarters. Forgive the damp. And the lack of a roof.' },
      { who: 'aldric', text: 'I am Sir Aldric. Once, I came down here to silence the bell. As you can see, it went splendidly.' },
      { who: 'aldric', text: 'The Bone Warden guards the stair to the bell. Before you face him, show me what you are made of. The Flooded Crypt lies below this chapel. Reach the bottom and come back to me.' },
    ],
    reminder: [{ who: 'aldric', text: 'The stairs are behind the altar. Mind the water. It bites.' }],
    cleared: [
      { who: 'narrator', text: 'At the bottom of the Flooded Crypt, the black water stills. A cold voice echoes off the stones: "Well done. Come back up. I have something for you."' },
    ],
    turnIn: [
      { who: 'aldric', text: 'Well fought. You strike like someone with nothing to lose. Down here, that is most people.' },
      { who: 'aldric', text: 'Take my mantle. It kept me warm when I still had a body to keep warm.' },
      { who: 'gravedigger', text: '(faintly, through the chapel window) IS THAT A GHOST? ASK HIM IF HE OWES ME FOR A FUNERAL.' },
      { who: 'aldric', text: '...I do not.' },
    ],
  },
  {
    n: 4,
    title: 'The Bone Warden',
    giver: 'aldric',
    needs: 3,
    dungeon: {
      name: "The Warden's Stair",
      floors: [4, 10],
      gifts: 3,
      summon: true,
      boss: { floor: 10, kind: 'boss' },
      bossLines: [
        { who: 'narrator', text: 'A great door of fused bone. Before it stands a figure in rusted armour, keys rattling at its belt like wind chimes.' },
        { who: 'warden', text: 'HALT. NONE MAY PASS THIS DOOR.' },
        { who: 'hero', text: "What's behind it?" },
        { who: 'warden', text: '...' },
        { who: 'warden', text: 'I have guarded it for four hundred years. I do not remember. Is it a nice door? It FEELS like a nice door.' },
        { who: 'warden', text: 'REGARDLESS. NONE. MAY. PASS.' },
      ],
    },
    souls: 500,
    reward: "The Warden's Keys and a title",
    hint: "The Warden's Tower stands in the chapel grounds. His stair goes down from his lodge.",
    barred: 'The tower door is locked. Sir Aldric would know where the key went.',
    offer: [
      { who: 'aldric', text: 'You are ready. The Warden keeps a lodge in the tower outside. His stair goes down from there, all the way to his door. Here is the key. I took it from him. Long story. He did not notice. He notices very little.' },
      { who: 'aldric', text: 'And you need not walk alone. The crypt remembers every soul that fell in it. Call on one at the top of the stair, and they will fight beside you.' },
      { who: 'aldric', text: 'The living call it asking for help. We called it summoning. It sounds more dignified.' },
      { who: 'gravedigger', text: '(faintly, from the village) IS HE DOING THE DIGNIFIED VOICE AGAIN?' },
      { who: 'aldric', text: '...I am.' },
    ],
    reminder: [{ who: 'aldric', text: "The tower, outside. Ten floors down to the Warden's door. Bring the hound. Bring snacks." }],
    cleared: [
      { who: 'warden', text: 'Ah. I remember now.' },
      { who: 'warden', text: 'It was never a door. It was a lid.' },
      { who: 'narrator', text: 'The Warden crumbles into a heap of bones and keys. Far below, the bell tolls once, though it is nowhere near midnight.' },
      { who: 'aldric', text: '(his voice, from very far away) Something is pulling at me. The bell. It is calling me down. I cannot—' },
      { who: 'narrator', text: 'The cold leaves the air all at once. {pet} whines at nothing. Somewhere above, in the chapel, Sir Aldric is gone.' },
      { who: 'narrator', text: 'End of Act I. Act II: The Plague Abbot is coming. Mortimer will want to know.' },
    ],
  },
  {
    n: 11,
    title: 'A Ring in the Well',
    side: true,
    giver: 'agnes',
    needs: 1,
    dungeon: { name: 'The Village Well', floors: [1, 4], gifts: 0 },
    souls: 150,
    reward: "The Widow's Shawl, a cloak",
    hint: 'Climb down the village well and find Agnes\'s ring.',
    barred: "A long way down, and something down there is breathing. Someone in the village might have a reason to go.",
    offer: [
      { who: 'agnes', text: "Oh. A visitor. I don't get many. Most people are frightened of the black. It's only a shawl, dear." },
      { who: 'agnes', text: 'I dropped my wedding ring down the well. Forty years married, and I drop it down a well. My Harold would have laughed. Then he would have fallen in after it.' },
      { who: 'agnes', text: "Things live down there now. Four floors of things. Would you? I'd give you my good shawl. It's very warm, and only slightly haunted." },
    ],
    reminder: [{ who: 'agnes', text: 'The well is in the middle of the village. Do be careful. And if you see Harold down there, tell him dinner is at six.' }],
    cleared: [
      { who: 'narrator', text: 'In the mud at the bottom of the well: a small gold ring. Next to it, a skeleton wearing a matching one, holding a fishing rod.' },
      { who: 'narrator', text: 'You decide not to mention the second part.' },
    ],
    turnIn: [
      { who: 'agnes', text: "My ring! Oh, you dear thing. Here, take the shawl. It's yours." },
      { who: 'agnes', text: 'Did you... see anyone else down there?' },
      { who: 'hero', text: 'No one.' },
      { who: 'agnes', text: 'Hm. Dinner is at six anyway. Just in case.' },
    ],
  },
  {
    n: 12,
    title: 'Blue Coal',
    side: true,
    giver: 'pip',
    needs: 1,
    dungeon: { name: 'The Old Mine', floors: [3, 7], gifts: 1 },
    souls: 200,
    reward: "Smith's Goggles, headwear",
    hint: 'The Old Mine is in the woods by the kennels. Bring Pip some blue coal.',
    barred: "Boarded up, with a sign: 'NO. (signed, the Mayor)'. Pip at the smithy talks about this place.",
    offer: [
      { who: 'pip', text: "Oi! You're the one going down the crypt, yeah? Brilliant. I'm Pip. I'm the smith. Well. Apprentice smith. The smith died." },
      { who: 'pip', text: "Marta used to make the forge burn blue. Proper blue. With blue coal from the Old Mine, up in the woods by the kennels. Nobody's been down there since the mine started being haunted." },
      { who: 'pip', text: "Five floors down there's a seam. Bring me some and I'll make you my best goggles. They're my only goggles, but they're also my best." },
    ],
    reminder: [{ who: 'pip', text: "The Old Mine, up by the kennels. Blue coal. Don't lick it. I licked it. Don't." }],
    cleared: [
      { who: 'narrator', text: 'Deep in the mine, a seam of coal glows a cold, ghostly blue. It is warm to the touch, which seems wrong.' },
      { who: 'narrator', text: 'You fill a sack. Pip will be thrilled.' },
    ],
    turnIn: [
      { who: 'pip', text: "Is that... it IS! Look at it glow! Marta, you beautiful mad woman." },
      { who: 'pip', text: "Here. Goggles. I fixed the strap and everything. Mostly with string." },
    ],
  },
  {
    n: 13,
    title: "Bess's Best",
    side: true,
    giver: 'bess',
    needs: 1,
    dungeon: { name: 'The Tavern Cellar', floors: [2, 6], gifts: 1 },
    souls: 150,
    reward: 'The Tavern Regular title',
    hint: "Go down Bess's cellar stairs, behind the bar of the tavern.",
    barred: "Bess's cellar. You'd need her blessing to go down there. And possibly a mop.",
    offer: [
      { who: 'bess', text: "What'll it be? We've got ale, and we've got the other ale. The good stuff's gone." },
      { who: 'bess', text: "Someone nicked my last barrel of Bess's Best right out of the cellar. And by someone I mean something. I can hear them down there. Singing." },
      { who: 'bess', text: "Get it back and you'll drink free here forever. Terms apply. Forever is a long time and I'm not made of ale." },
    ],
    reminder: [{ who: 'bess', text: "Cellar's behind the bar. If you hear singing, that's them. If you hear good singing, that's not them." }],
    cleared: [
      { who: 'narrator', text: 'At the bottom of the cellar, a ring of ghouls sits around an empty barrel, swaying, in paper hats. One of them is crying.' },
      { who: 'narrator', text: "The barrel is empty. The party is over. You roll it back up anyway. It's the principle." },
    ],
    turnIn: [
      { who: 'bess', text: '...It\'s empty.' },
      { who: 'hero', text: "They had paper hats." },
      { who: 'bess', text: "Ghouls with paper hats. In my cellar. Well, you got the barrel back. You're a regular now, love. That's a title round here. The only title, actually." },
    ],
  },
];

export const QUEST_BY_N = Object.fromEntries(QUESTS.map((q) => [q.n, q])) as Record<number, Quest>;
export const MAIN_QUESTS = QUESTS.filter((q) => !q.side);

/** Where the player stands in the story. */
export interface StoryState {
  done: number[];
  active: number[];
  cleared: number[];
}

export type QuestStatus = 'locked' | 'available' | 'active' | 'cleared' | 'done';

export function questStatus(q: Quest, s: StoryState): QuestStatus {
  if (s.done.includes(q.n)) return 'done';
  if (s.cleared.includes(q.n)) return 'cleared';
  if (s.active.includes(q.n)) return 'active';
  return !q.needs || s.done.includes(q.needs) ? 'available' : 'locked';
}

/** Aldric haunts his chapel from the hound's quest until the bell takes him. */
export function npcPresent(npc: NpcId, s: StoryState): boolean {
  if (npc === 'aldric') return s.done.includes(2) && !s.done.includes(4);
  return true;
}

/** '!' a quest to take, '?' one to hand in, or nothing. */
export function npcMarker(npc: NpcId, s: StoryState): '!' | '?' | '' {
  const mine = QUESTS.filter((q) => q.giver === npc);
  if (mine.some((q) => questStatus(q, s) === 'cleared' && q.turnIn)) return '?';
  if (mine.some((q) => questStatus(q, s) === 'available')) return '!';
  return '';
}

/** What talking to someone does: hand in, take a quest, a reminder, or just chat. */
export function conversation(npc: NpcId, s: StoryState): { lines: Line[]; accept?: number; turnIn?: number } {
  const mine = QUESTS.filter((q) => q.giver === npc);
  const ready = mine.find((q) => questStatus(q, s) === 'cleared' && q.turnIn);
  if (ready) return { lines: ready.turnIn!, turnIn: ready.n };
  // Main quests first, so the story moves along.
  const offer = mine.find((q) => questStatus(q, s) === 'available');
  if (offer) return { lines: offer.offer, accept: offer.n };
  const active = mine.find((q) => questStatus(q, s) === 'active' || questStatus(q, s) === 'cleared');
  if (active) return { lines: active.reminder };
  return { lines: chatter(npc, s) };
}

function chatter(npc: NpcId, s: StoryState): Line[] {
  const has = (n: number) => s.done.includes(n);
  switch (npc) {
    case 'gravedigger':
      if (has(4)) return [
        { who: 'gravedigger', text: "Aldric's gone, then. Dragged down by the bell. I'd say he'll be missed, but I never got the money for his funeral." },
        { who: 'gravedigger', text: "The Plague Abbot's cloister lies under the Warden's door. If someone is ringing that bell, it's someone with a grudge and good shoulders. Get some rest. Act II is coming." },
      ];
      if (has(2)) return [
        { who: 'gravedigger', text: "Folk say the old chapel's haunted. East of the village. Take {pet}, ghosts hate dogs. Or love them. One of those." },
      ];
      return [{ who: 'gravedigger', text: 'Tea? No? More for me.' }];
    case 'aldric':
      return [{ who: 'aldric', text: 'The bell is quiet tonight. I do not trust it when it is quiet.' }];
    case 'bess':
      return has(13)
        ? [{ who: 'bess', text: "The usual, love? That's the ale. The usual's always the ale." }]
        : [{ who: 'bess', text: "Rumour has it Pip licked the blue coal. Rumour is Pip. He tells everyone." }];
    case 'agnes':
      return has(11)
        ? [{ who: 'agnes', text: "I set a place for Harold every night. Last night the chair was warm. Isn't that nice?" }]
        : [{ who: 'agnes', text: "It's very quiet in the village these days. Even the dead are quiet. Mostly." }];
    case 'pip':
      return has(12)
        ? [{ who: 'pip', text: "Look at that forge burn! Blue as a ghost's bum. Marta'd be proud. Or haunting me. Bit of both." }]
        : [{ who: 'pip', text: "Mind the anvil. It's heavier than it looks. It looks very heavy." }];
  }
}

// ---------- the journal ----------
// Things to look at in the world. Each one read is kept in the journal.

export const LORE: Record<string, { title: string; text: string }> = {
  'mort-photo': { title: 'A faded photograph', text: 'A young Mortimer, grinning, holding a very small shovel. Someone has written underneath: "Started early."' },
  'mort-ledger': { title: "Mortimer's ledger", text: '"Graves dug this year: 212. Graves that stayed filled: 198. Must have a word with the bell."' },
  'kennel-ledger': { title: "The kennel master's ledger", text: '"Hound no. 7 (the black one) refuses to stay chained. Recommend a stronger chain. Recommend a stronger kennel master."' },
  'kennel-bowl': { title: 'A dog bowl', text: 'Licked so clean it shines. Engraved on the rim, in careful letters: GOOD DOG.' },
  'aldric-journal': { title: "Aldric's journal", text: '"Day 3. The bell rang at midnight and the crypt moved. The Warden says he guards a door. I think he guards something else, and has forgotten what."' },
  'aldric-armour': { title: "Aldric's armour", text: 'His old armour, polished every day by someone with no hands. There is a dent in the back plate shaped exactly like a door.' },
  'warden-portrait': { title: 'A portrait of the Warden', text: 'Painted four hundred years ago: a young man holding a key bigger than his arm. The brass plate reads: "Keeper of the Lid."' },
  'warden-bed': { title: "The Warden's bed", text: 'Made with military precision. Never slept in. Under the pillow, a note in shaky letters: "Remember. REMEMBER. Remember what?"' },
  'tavern-board': { title: 'The notice board', text: '"MISSING: one barrel of Bess\'s Best. Reward: free drinks forever (terms apply)." Below it: "LOST: Harold. Answers to Harold."' },
  'agnes-letter': { title: 'A letter on the table', text: '"Dear Agnes, gone fishing in the well. Back for dinner. Love, H." The ink is forty years old.' },
  'marta-tongs': { title: "Marta's tongs", text: 'Black iron, burned blue at the tips. Hung on the wall like a sword. Pip dusts them every morning and talks to them.' },
};
export const LORE_COUNT = Object.keys(LORE).length;

// ---------- portraits ----------
// 16x16 pixel faces for the talk screens. Letters map to colours below.

const PAL: Record<string, string> = {
  k: '#0d0812',
  h: '#3a2a1e', H: '#7a5532', f: '#c9a27e', F: '#8a6a4e', w: '#d8d2c2', W: '#8a857a', c: '#3b3346', C: '#241f2c', s: '#9aa3b5', o: '#7a5532', e: '#0d0812',
  a: '#9fe8ff', A: '#3e8db5', d: '#1f4a63', y: '#fff2c0', r: '#d23a46',
  b: '#e8dcc4', B: '#a89a80', t: '#8a4a2a', T: '#4f2a18', Y: '#f2c14e', E: '#ff4d5a',
  n: '#7b6a8c', N: '#4f4560', u: '#9a8bab', g: '#f2c14e', R: '#d23a46',
  q: '#b5431c', Q: '#6e2410', m: '#4f6b3a', M: '#2a3b1f', v: '#2a2433', V: '#141119', i: '#8a8590', I: '#5d667a', l: '#6b4a2a', L: '#3a2818', p: '#5fe3ff',
};

const FACES: Partial<Record<Speaker, string[]>> = {
  gravedigger: [
    '................', '.....kkkkkk.....', '....khhhhhhk....', '....khhhhhhk....', '..kkHHHHHHHHkk..', '.khhhhhhhhhhhhk.',
    '..kkffffffffkk..', '...kfekffkefk...', '...kffffFfffk...', '...kwwfFFfwwk.s.', '..kwwwwwwwwwwks.', '..kcwwwWWwwwcks.',
    '.kccwWwwwwWwcko.', '.kcccWWWWWWcckok', '.kcccccccccccko.', '.kCcccccccccCko.',
  ],
  aldric: [
    '.......rr.......', '......rrrr......', '.....kkkkkk.....', '....kaaaaaak....', '...kaaAaaAaak...', '...kaAAAAAAak...',
    '...kakkkkkkak...', '...kakykkykak...', '...kaAAAAAAak...', '...kaaAaaAaak...', '...kAaaaaaaAk...', '..kddAaaaaAddk..',
    '.kdaaddAAddaadk.', '.kaaaadAAdaaaak.', '.kaaaaadddaaaak.', '.kAAAAAAAAAAAAk.',
  ],
  warden: [
    '....kkkkkkkk....', '...kTttttttTk...', '..kTttTttTtttk..', '..ktkkkkkkkktk..', '..ktkbbbbbbktk..', '..ktbbbbbbbbtk..',
    '..ktbkkbbkkbtk..', '..ktbkEkkEkbtk..', '..ktbbbbbbbbtk..', '..ktbbbkkbbbtk..', '..kkbkbkbkbbkk..', '...kbbbbbbbbk...',
    '.kTTkBkBkBkTTk..', 'kTttTkkkkkTttTk.', 'kTtYYTtTtTTYYtk.', 'kTtYTtTtTtTtYTk.',
  ],
  bess: [
    '.....kkkkkk.....', '....kqqqqqqk....', '...kqqQqqQqqk...', '...kqffffffqk...', '...kfekffkefk...', '...kffffFfffk...',
    '...kfffrrfffk...', '....kffffffk....', '...kkkffffkkk...', '..kmmkwwwwkmmk..', '.kmmmkwwwwkmmmk.', '.kmmmwwwwwwmmmk.',
    '.kmMmwwwwwwmMmk.', '.kmMmwwWWwwmMmk.', '.kmmmwwwwwwmmmk.', '.kkkkkkkkkkkkkk.',
  ],
  agnes: [
    '.....kkkkkk.....', '....kvvvvvvk....', '...kvviiiivvk...', '...kvifffffvk...', '...kvfekkefvk...', '...kvfffffffk...',
    '...kvffFFffvk...', '...kvvffffvvk...', '..kvvvkffkvvvk..', '.kvvvvvvvvvvvvk.', '.kvVvvvvvvvvVvk.', '.kvVvvvbbvvvVvk.',
    '.kvVvvvvvvvvVvk.', '.kvvVvvvvvvVvvk.', '.kvvvvvvvvvvvvk.', '.kkkkkkkkkkkkkk.',
  ],
  pip: [
    '.....kkkkkk.....', '....kHHHHHHk....', '...kHHHHHHHHk...', '...kkYYkkYYkk...', '...kYpYkkYpYk...', '...kkYYffYYkk...',
    '...kfFffffFfk...', '...kffekkeffk...', '....kfFffFfk....', '...kkkffffkkk...', '..kllkLLLLkllk..', '.klllkLsLLklllk.',
    '.klllLLLLLLlllk.', '.klLlLLsLLLlLlk.', '.klllLLLLLLlllk.', '.kkkkkkkkkkkkkk.',
  ],
  hound: [
    '................', '..kk........kk..', '.kNNk......kNNk.', '.kNnNk....kNnNk.', '..knnkkkkkknnk..', '..knnnnnnnnnnk..',
    '.knnnnnnnnnnnnk.', '.knEkknnnnkkEnk.', '.knnnnnnnnnnnnk.', '..knnnnuunnnnk..', '..knnnukkunnnk..', '...knnuRRunnk...',
    '...kkggggggkk...', '...kNnnggnnNk...', '..kNnnnnnnnnNk..', '..kkkkkkkkkkkk..',
  ],
};

const faceCache = new Map<Speaker, string>();

/** A speaker's portrait as an image URL, or '' for the narrator and the hero (drawn elsewhere). */
export function facePortrait(who: Speaker): string {
  const rows = FACES[who];
  if (!rows) return '';
  let url = faceCache.get(who);
  if (!url) {
    const scale = 6;
    const c = document.createElement('canvas');
    c.width = c.height = 16 * scale;
    const ctx = c.getContext('2d')!;
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const col = PAL[ch];
        if (!col) return;
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }),
    );
    url = c.toDataURL();
    faceCache.set(who, url);
  }
  return url;
}

// ---------- people in the world ----------
// 12x12 figures for walking around Gravesend, in the same colours as the portraits.

const FIGURES: Record<NpcId, string[]> = {
  gravedigger: [
    '...kkkkkk...', '..kHHHHHHk..', '.kkhhhhhhkk.', '...kfekfk.s.', '...kwwwwk.s.', '..kcwwwwck.o', '.kccWwwcckko',
    '.kcckcccck.o', '..kccccck..o', '..kcckcck...', '..kCk.kCk...', '..kk...kk...',
  ],
  aldric: [
    '....rr......', '...kkkk.....', '..kaaaak....', '..kakkak....', '..kaykyk..s.', '..kAAAAk..s.', '.kdaaaadk.s.',
    'kdaaAAaadkks', 'kakaaaakak.y', '..kaAAak....', '..kak.kak...', '..kk...kk...',
  ],
  bess: [
    '...kkkkk....', '..kqqQqqk...', '..kqffffk...', '..kfekefk...', '...kffrk....', '..kmkwwkmk..', '.kmmwwwwmmk.',
    '.kmkwwwwkmk.', '..kmwwwwmk..', '..kmmmmmmk..', '...kmk.kmk..', '...kk...kk..',
  ],
  agnes: [
    '...kkkkk....', '..kviiivk...', '..kvfffvk...', '..kvekevk...', '..kvvffvvk..', '.kvvvvvvvvk.', '.kvVvvvvVvk.',
    '.kvvvbbvvvk.', '..kvvvvvvk..', '..kvvvvvvk..', '...kvk.kvk..', '...kk...kk..',
  ],
  pip: [
    '...kkkkk....', '..kHHHHHk...', '..kYpkYpk...', '..kfffffk...', '..kfekefk...', '...kffffk...', '..klkLLklk..',
    '.kllLLLLllk.', '.kfkLLsLkfk.', '..kLLLLLLk..', '...kLk.kLk..', '...kk...kk..',
  ],
};

const figureCache = new Map<NpcId, HTMLCanvasElement>();

/** A person's little figure, ready to draw on the world map. */
export function npcFigure(npc: NpcId): HTMLCanvasElement {
  let c = figureCache.get(npc);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 12;
    const ctx = c.getContext('2d')!;
    FIGURES[npc].forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const col = PAL[ch];
        if (!col) return;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
    figureCache.set(npc, c);
  }
  return c;
}
