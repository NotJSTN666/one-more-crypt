// Story mode, Act I: The Bell Beneath. Five chapters, each a short hand-picked descent
// with talk before and after. Story runs never touch the daily or the leaderboards.

export type Speaker = 'gravedigger' | 'aldric' | 'warden' | 'hound' | 'hero' | 'narrator';

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

export interface Chapter {
  n: number;
  title: string;
  blurb: string;
  /** First and last floor: chapters start deeper as the act goes on. */
  floors: [number, number];
  /** Relics the mentors hand you at the start. */
  gifts: number;
  /** Souls for finishing it the first time. */
  souls: number;
  /** What finishing it the first time unlocks, for the chapter list. */
  reward: string;
  /** Offer to summon another player's ghost before setting out. */
  summon?: boolean;
  intro: Line[];
  outro: Line[];
}

export const ACT_TITLE = 'Act I: The Bell Beneath';

export const SPEAKERS: Record<Speaker, string> = {
  gravedigger: 'Mortimer',
  aldric: 'Sir Aldric',
  warden: 'The Bone Warden',
  hound: '{pet}',
  hero: 'You',
  narrator: '',
};

/** The hound's name depends on how you met. */
export function petName(choice: string | undefined): string {
  return choice === 'left' ? 'Chomp' : 'Cinder';
}

export const CHAPTERS: Chapter[] = [
  {
    n: 1,
    title: 'Fresh Dirt',
    blurb: 'A gravedigger with a bad back asks you to look into a bell.',
    floors: [1, 2],
    gifts: 0,
    souls: 100,
    reward: '100 Souls',
    intro: [
      { who: 'narrator', text: 'Midnight. Somewhere beneath the graveyard, a bell tolls. The crypt groans and rearranges itself, like a sleeper rolling over.' },
      { who: 'gravedigger', text: "Oh good, a live one. Do you know how rare those are round here? Rarer than a polite ghoul." },
      { who: 'gravedigger', text: "Name's Mortimer. I dig the graves. Someone has to, and the dead are hopeless with shovels." },
      { who: 'gravedigger', text: 'That bell rings every midnight, and the whole crypt shuffles its furniture. I want to know who is ringing it. I want them to stop.' },
      { who: 'hero', text: 'And you want me to go down there.' },
      { who: 'gravedigger', text: "I'd go myself, but I've a bad back and a very strong sense of self-preservation. Two floors. Have a look. Try not to die, the paperwork is dreadful." },
    ],
    outro: [
      { who: 'narrator', text: 'Among the bones you find a length of rope, black with age. It hums faintly, as if it remembers being pulled.' },
      { who: 'gravedigger', text: "A bell-rope! Or a very long, very sad shoelace. Either way, someone's been pulling it." },
      { who: 'gravedigger', text: 'Hush. Hear that? Down below. Something is howling.' },
    ],
  },
  {
    n: 2,
    title: 'The Kennel',
    blurb: 'Something has been howling in the old kennels for a very long time.',
    floors: [1, 3],
    gifts: 0,
    souls: 150,
    reward: 'A companion',
    intro: [
      { who: 'gravedigger', text: 'The howling comes from the old kennels. The Warden kept hounds once, to sniff out escaped corpses. Long story. Very smelly.' },
      { who: 'gravedigger', text: "Whatever's down there has been crying for an age. Go on. You're braver than me. Low bar, I grant you." },
    ],
    outro: [
      { who: 'narrator', text: 'In the last cell, chained to the wall, sits a hound made of shadow and stubbornness. Its eyes glow like coals. Its tail, against all odds, is wagging.' },
      { who: 'hound', text: '*Wuff.*' },
      {
        key: 'hound',
        prompt: 'The chain is old. One good blow would break it.',
        options: [
          {
            label: 'Break the chain',
            value: 'freed',
            then: [
              { who: 'narrator', text: 'The chain snaps. The hound sniffs your boots, decides they are acceptable, and falls in step beside you.' },
              { who: 'gravedigger', text: "Ha! Look at that tail. I'd call it Cinder, for the eyes. Don't let it near my sandwiches." },
            ],
          },
          {
            label: "Leave it. It's probably cursed.",
            value: 'left',
            then: [
              { who: 'narrator', text: 'You walk away. Behind you the chain rattles. Then it rattles harder. Then something goes *crunch*.' },
              { who: 'narrator', text: 'When you reach the stairs, the hound is already sitting there, half a chain in its teeth, looking extremely pleased with itself.' },
              { who: 'gravedigger', text: "Ha! Dogs don't really do 'no'. You've been adopted. I'd call it Chomp, given the chain." },
            ],
          },
        ],
      },
      { who: 'narrator', text: 'The Crypt Hound joins you. It fights at your side in the story, and trots behind you in every crypt.' },
    ],
  },
  {
    n: 3,
    title: 'The Hollow Knight',
    blurb: 'A ghost in old armour has been waiting for someone foolish enough to try.',
    floors: [2, 4],
    gifts: 1,
    souls: 200,
    reward: "Aldric's Mantle, a cloak",
    intro: [
      { who: 'narrator', text: 'Deeper now. The air is cold enough to see your breath. {pet} growls at a shape standing in the dark.' },
      { who: 'aldric', text: 'Peace, hound. I am only a ghost, and a poor one at that.' },
      { who: 'aldric', text: 'I am Sir Aldric. Once, I came down here to silence the bell. As you can see, it went splendidly.' },
      { who: 'aldric', text: 'The Bone Warden guards the stair to the bell. I could not get past him. Perhaps you can. Take this, and show me what you are made of.' },
    ],
    outro: [
      { who: 'aldric', text: 'Well fought. You strike like someone with nothing to lose. Down here, that is most people.' },
      { who: 'aldric', text: 'Take my mantle. It kept me warm when I still had a body to keep warm.' },
      { who: 'gravedigger', text: '(from somewhere far above) IS THAT A GHOST? ASK HIM IF HE OWES ME FOR A FUNERAL.' },
      { who: 'aldric', text: '...I do not.' },
    ],
  },
  {
    n: 4,
    title: 'Borrowed Souls',
    blurb: "You don't have to go alone. The crypt remembers everyone who fell in it.",
    floors: [3, 4],
    gifts: 2,
    souls: 250,
    reward: '250 Souls',
    summon: true,
    intro: [
      { who: 'aldric', text: 'You need not walk alone. The crypt remembers every soul that ever fell in it. Their shades linger in the stone.' },
      { who: 'aldric', text: 'Call on one, and they will fight beside you for a time. The living call it asking for help. We called it summoning. It sounds more dignified.' },
      { who: 'gravedigger', text: '(from far above) IS HE DOING THE DIGNIFIED VOICE AGAIN?' },
      { who: 'aldric', text: '...I am.' },
    ],
    outro: [
      { who: 'aldric', text: 'The Warden waits below. He has guarded his door for four hundred years. Rest, if the dead allow it.' },
      { who: 'gravedigger', text: 'Bring snacks. Wardens are always grumpier on an empty stomach.' },
      { who: 'hound', text: '*Wuff.* (It agrees about the snacks.)' },
    ],
  },
  {
    n: 5,
    title: 'The Bone Warden',
    blurb: 'A jailer who has forgotten what he guards. He still guards it.',
    floors: [3, 5],
    gifts: 2,
    souls: 500,
    reward: "The Warden's Keys and a title",
    summon: true,
    intro: [
      { who: 'narrator', text: 'A great door of fused bone. Before it stands a figure in rusted armour, keys rattling at its belt like wind chimes.' },
      { who: 'warden', text: 'HALT. NONE MAY PASS THIS DOOR.' },
      { who: 'hero', text: "What's behind it?" },
      { who: 'warden', text: '...' },
      { who: 'warden', text: 'I have guarded it for four hundred years. I do not remember. Is it a nice door? It FEELS like a nice door.' },
      { who: 'warden', text: 'REGARDLESS. NONE. MAY. PASS.' },
    ],
    outro: [
      { who: 'warden', text: 'Ah. I remember now.' },
      { who: 'warden', text: 'It was never a door. It was a lid.' },
      { who: 'narrator', text: 'The Warden crumbles into a heap of bones and keys. Far below, the bell tolls once, though it is nowhere near midnight.' },
      { who: 'aldric', text: 'No... something is pulling at me. The bell. It is calling me down. I cannot—' },
      { who: 'narrator', text: 'Sir Aldric is gone. Only the cold he left behind remains. {pet} whines at the empty air.' },
      { who: 'gravedigger', text: "Well. That's not good. That's the opposite of good." },
      { who: 'gravedigger', text: "The Plague Abbot's cloister lies beneath. If someone is ringing that bell, it's someone with a grudge and good shoulders. Get some rest. You'll need it." },
      { who: 'narrator', text: 'End of Act I. Act II: The Plague Abbot is coming.' },
    ],
  },
];

export const CHAPTER_BY_N = Object.fromEntries(CHAPTERS.map((c) => [c.n, c])) as Record<number, Chapter>;

/** The hound grows with every story floor you clear together. */
export function houndStats(bond: number): { hp: number; dmg: number } {
  return { hp: 4 + Math.min(6, Math.floor(bond / 5)), dmg: 1 + Math.min(2, Math.floor(bond / 12)) };
}

// ---------- portraits ----------
// 16x16 pixel faces for the talk screens. Letters map to colours below.

const PAL: Record<string, string> = {
  k: '#0d0812',
  h: '#3a2a1e', H: '#7a5532', f: '#c9a27e', F: '#8a6a4e', w: '#d8d2c2', W: '#8a857a', c: '#3b3346', C: '#241f2c', s: '#9aa3b5', o: '#7a5532', e: '#0d0812',
  a: '#9fe8ff', A: '#3e8db5', d: '#1f4a63', y: '#fff2c0', r: '#d23a46',
  b: '#e8dcc4', B: '#a89a80', t: '#8a4a2a', T: '#4f2a18', Y: '#f2c14e', E: '#ff4d5a',
  n: '#7b6a8c', N: '#4f4560', u: '#9a8bab', g: '#f2c14e', R: '#d23a46',
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
