// Story mode, Act I: The Bell Beneath. Played out in the world above the crypt: you walk
// Gravesend, meet the people who live there in their own homes, and take on quests that
// send you down into dungeons. Story runs never touch the daily or the leaderboards.

import type { EnemyKind } from './game';
import type { ZoneId } from './zones';
import { onCanvasReset } from './sprites';

export type Speaker = 'gravedigger' | 'aldric' | 'warden' | 'hound' | 'bess' | 'agnes' | 'pip' | 'ambrose' | 'abbot' | 'guest' | 'hero' | 'narrator';
/** People you can talk to in the world. */
export type NpcId = 'gravedigger' | 'aldric' | 'bess' | 'agnes' | 'pip' | 'ambrose';

export interface Say {
  who: Speaker;
  text: string;
}

export interface Choice {
  /** Remembered in the player's story choices under this key. */
  key: string;
  prompt: string;
  options: { label: string; value: string; then: (Say | Cut)[] }[];
}

/** A cutscene: a few seconds of animated pixel scene, in the middle of a conversation. */
export interface Cut {
  scene: 'knock' | 'beacon' | 'chair' | 'sink';
}

export type Line = Say | Choice | Cut;

export interface Dungeon {
  name: string;
  /** First and last floor: later quests start deeper, with gifts to match. */
  floors: [number, number];
  gifts: number;
  summon?: boolean;
  boss?: { floor: number; kind: EnemyKind };
  /** What the place looks like down there (and the ground it brings). */
  look?: ZoneId;
  /** Said when the boss floor opens. */
  bossLines?: Line[];
  /** Act II: patches of plague mist on each floor, and plague monks among the foes. */
  mist?: number;
  monks?: boolean;
  /** Act II: the last floor is a hold-out of this many waves. */
  holdout?: number;
  /** Act II: everyone asleep, the stairs open. */
  sleepers?: boolean;
}

export interface Quest {
  n: number;
  title: string;
  side?: boolean;
  /** Which act it belongs to (Act I unless said). */
  act?: 2 | 3;
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
export const ACT2_TITLE = 'Act II: The Plague Abbot';

/** Act II opens at midnight Central on Friday 30 October 2026. */
export const ACT2_OPENS = Date.UTC(2026, 9, 30, 5);
export const act2Open = (now = Date.now()) => now >= ACT2_OPENS;

export const ACT3_TITLE = 'Act III: The Long Night';
/** Act III opens with Midwinter: midnight Central on Friday 27 November 2026, the day after Thanksgiving. */
export const ACT3_OPENS = Date.UTC(2026, 10, 27, 6);
export const act3Open = (now = Date.now()) => now >= ACT3_OPENS;

export const SPEAKERS: Record<Speaker, string> = {
  gravedigger: 'Mortimer',
  aldric: 'Sir Aldric',
  warden: 'The Bone Warden',
  hound: '{pet}',
  bess: 'Old Bess',
  agnes: 'Widow Agnes',
  pip: 'Pip',
  ambrose: 'Brother Ambrose',
  abbot: 'Abbot Ansel',
  guest: 'The Guest',
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
    reward: "150 Souls, the Gravedigger's Coat and a title",
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
    dungeon: { name: 'The Kennel Cellar', floors: [2, 6], gifts: 1, look: 'kennel' },
    souls: 200,
    reward: 'A companion, the Houndhide cloak and a title',
    hint: 'From the graveyard, take the east road into Gravesend, then the north road out of the village to the old kennels. Go down into the Kennel Cellar (follow the gold arrows).',
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
    dungeon: { name: 'The Flooded Crypt', floors: [3, 9], gifts: 2, look: 'flooded' },
    souls: 250,
    reward: "Aldric's Mantle, the Spectral Vigil aura and a title",
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
      look: 'ossuary',
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
    reward: "The Warden's Keys, the Toll of the Bell aura and a title",
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
    dungeon: { name: 'The Village Well', floors: [1, 4], gifts: 0, look: 'well' },
    souls: 150,
    reward: "The Widow's Shawl, the Wishing Well aura and a title",
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
    dungeon: { name: 'The Old Mine', floors: [3, 7], gifts: 1, look: 'mine' },
    souls: 200,
    reward: "Smith's Goggles and a title",
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
    dungeon: { name: 'The Tavern Cellar', floors: [2, 6], gifts: 1, look: 'cellar' },
    souls: 150,
    reward: "Bess's Kerchief and the Tavern Regular title",
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
  // ---------- Act II: The Plague Abbot (Part 1) ----------
  {
    n: 21,
    act: 2,
    title: 'The Lid',
    giver: 'gravedigger',
    needs: 4,
    dungeon: { name: 'Beneath the Lid', floors: [5, 9], gifts: 3, look: 'cloister', mist: 2, monks: true },
    souls: 300,
    reward: "The Monk's Habit and a title",
    hint: 'The Lid has sunk into the chapel grounds, by the Warden\'s tower. Go down.',
    barred: 'A great round lid of stone, carved with a bell. It is cold, and it hums. Mortimer will have opinions about this.',
    offer: [
      { who: 'gravedigger', text: "There you are. I haven't slept. The bell rings every night now, and every night it sounds closer. Like it's coming up the stairs." },
      { who: 'gravedigger', text: "And the ground by the Warden's tower has sunk. There's a lid showing through the grass. A big stone one. With a bell carved on it. I don't like it. I don't like it at all." },
      { who: 'hero', text: "Aldric's down there." },
      { who: 'gravedigger', text: "I know. Poor sod still owes me for a funeral. Go and fetch him. And whatever's under that lid, tell it the village is closed." },
      { who: 'gravedigger', text: "One more thing. The air down there smells of the old plague. Green mist, the old stories say. Don't stand about in it. Candles help, apparently. So does a big loud bell, if you've got one." },
    ],
    reminder: [{ who: 'gravedigger', text: "The lid, in the chapel grounds, by the tower. Five floors down, the stories say. Hold your breath in the green bits." }],
    cleared: [
      { who: 'narrator', text: 'The last stair opens onto a cloister, flooded to the ankles and lit by candles nobody has lit in four hundred years. The mist pools in the corners like it is waiting for something.' },
      { who: 'narrator', text: 'A monk in a patched brown habit is sweeping the water. Just sweeping it, back and forth. He looks up.' },
      { who: 'ambrose', text: 'Oh! Oh, a living person. Forgive me, I would bow, but my knees stopped bowing around the time of the plague.' },
      { who: 'ambrose', text: 'I am Brother Ambrose. The last of the brothers who did not sing for the Abbot. Welcome to the Sunken Cloister. Mind the mist. Mind the monks. Mind most things, really.' },
      { who: 'ambrose', text: 'Your knight came through here. Bound in bell-rope, dragged toward the shaft. Come and find me in my cell. We have a great deal to talk about, and very little time before the evening bell.' },
      { who: 'narrator', text: 'The Sunken Cloister is open. Take the old stair from the chapel grounds.' },
    ],
  },
  {
    n: 22,
    act: 2,
    title: 'Vespers',
    giver: 'ambrose',
    needs: 21,
    dungeon: { name: 'The Chapter House', floors: [6, 10], gifts: 3, look: 'cloister', mist: 2, monks: true, holdout: 4, summon: true },
    souls: 400,
    reward: 'The Vespers Candles aura and a title',
    hint: 'The Chapter House stands in the Sunken Cloister. Break up the evening service: hold out on the last floor.',
    barred: 'Singing comes through the door. Low, slow, and wrong. Brother Ambrose would know what it is.',
    offer: [
      { who: 'ambrose', text: 'Every evening the bell rings for Vespers, and the monks gather in the Chapter House to sing. Every evening the song gets a little louder. And every evening the graves of your village get a little more restless.' },
      { who: 'ambrose', text: 'The Abbot is using the service. The song carries the bell, and the bell carries the plague. Break up the service and the song falls apart.' },
      { who: 'hero', text: 'How many monks are we talking about?' },
      { who: 'ambrose', text: 'Oh, the whole choir. They come in waves, by the bell. Four of them, if the hymn-sheet is right. Stand your ground until the last verse, and the stair will open.' },
      { who: 'ambrose', text: 'Take a friend if you have one. The dead can help, I am told. I have never had a friend, personally. I had a cat once. It was also a monk. Long story.' },
    ],
    reminder: [{ who: 'ambrose', text: 'The Chapter House, across the cloister. Four waves of the choir on the last floor. Do not join in with the singing, however catchy.' }],
    cleared: [
      { who: 'narrator', text: 'The last monk falls mid-note. The candles gutter. Somewhere far below, the bell rings once, sour and off-key, and stops.' },
      { who: 'narrator', text: 'Silence. Real silence, for the first time in four hundred years. Ambrose will want to hear about this.' },
    ],
    turnIn: [
      { who: 'ambrose', text: 'Did you hear it? The bell. It missed a stroke! It has never missed a stroke. Not once since the plague.' },
      { who: 'ambrose', text: 'Here, take these. The choir candles. They were meant to light the way to Vespers. Now they can light the way out of it.' },
      { who: 'ambrose', text: 'The Abbot will be angry. Good. Angry people make mistakes. I should know. I am very calm, and I have never made a mistake. Apart from becoming a monk in a plague cloister.' },
    ],
  },
  {
    n: 31,
    act: 2,
    title: 'Bitter Herbs',
    side: true,
    giver: 'ambrose',
    needs: 21,
    dungeon: { name: 'The Sunken Garden', floors: [5, 8], gifts: 2, look: 'cloister', mist: 4, monks: true },
    souls: 250,
    reward: 'The Plague Coat',
    hint: 'Go down into the Sunken Garden, in the cloister, and bring Ambrose his herbs.',
    barred: 'A stair down into a garden thick with green mist. Something in there is coughing. Brother Ambrose tends it, or used to.',
    offer: [
      { who: 'ambrose', text: 'Before the plague I kept the herb garden. Feverfew, rue, bitter wormwood. The only things that ever worked against the sickness.' },
      { who: 'ambrose', text: 'The garden sank with everything else, and now the mist sits in it like soup. Thick. Very thick. You will not see the monks in it until they are on top of you.' },
      { who: 'ambrose', text: 'At the bottom grows a wormwood that never died. Bring me a sprig and I can brew something for your village. The cough has reached the wells, I hear.' },
    ],
    reminder: [{ who: 'ambrose', text: 'The garden stair, by the cloister wall. Thick mist. Keep moving: it bites if you linger.' }],
    cleared: [
      { who: 'narrator', text: 'At the bottom of the garden, in a clear patch the mist will not touch, a grey-green bush stands perfectly healthy. It smells awful. That is how you know it works.' },
    ],
    turnIn: [
      { who: 'ambrose', text: 'Wormwood! Still alive, the stubborn old thing. Like me.' },
      { who: 'ambrose', text: 'Take the coat from the infirmary hook. Waxed linen, for working in the sick-wards. The mist slides right off it. Mostly.' },
    ],
  },
  {
    n: 32,
    act: 2,
    title: "Pip's Cough",
    side: true,
    giver: 'pip',
    needs: 21,
    dungeon: { name: 'The Infirmary', floors: [5, 9], gifts: 2, look: 'cloister', mist: 2, monks: true },
    souls: 250,
    reward: "The Physician's Mask and a title",
    hint: "Find the Abbot's tincture in the Infirmary, in the Sunken Cloister, and bring it to Pip.",
    barred: 'The Infirmary door. Beds in rows beyond it, and something moving between them. Someone in the village needs medicine.',
    offer: [
      { who: 'pip', text: "*cough* Oh, it's you. Don't come too close. *cough* Everyone in the village has got it. Green spit. Very fashionable." },
      { who: 'pip', text: "Bess says it came up the well when the lid opened. Agnes says it's Harold's fault. Agnes says everything is Harold's fault." },
      { who: 'pip', text: "Old books say the monks had a tincture for it. In their infirmary. Under the lid. Where you go. *cough* Would you? I'd make you something. A mask, maybe. Beaky. Very stylish." },
    ],
    reminder: [{ who: 'pip', text: "The Infirmary, down in the cloister. A tincture. Green bottle, probably. Everything down there's green. *cough*" }],
    cleared: [
      { who: 'narrator', text: 'In the last ward, on a shelf above a row of empty beds, stands a bottle of something dark that glows faintly. The label reads: "FOR THE COUGH. NOT FOR THE ABBOT."' },
    ],
    turnIn: [
      { who: 'pip', text: "*glug* Ugh. Oh, that's foul. That's... *cough*... that's actually working. My spit's gone back to normal colour. Normal-ish." },
      { who: 'pip', text: "I'll get the rest round the village. And here, I made this while I was coughing. A beak mask, like the old plague doctors. Stuffed with herbs. Smells like Ambrose." },
    ],
  },
  {
    n: 33,
    act: 2,
    title: 'The Silent Choir',
    side: true,
    giver: 'ambrose',
    needs: 22,
    dungeon: { name: 'The Dormitory', floors: [6, 9], gifts: 2, look: 'cloister', mist: 1, monks: true, sleepers: true },
    souls: 300,
    reward: 'The Choir Robe and a title',
    hint: "Sneak through the sleeping Dormitory, in the cloister, to Brother Cuthbert's cell.",
    barred: 'Snoring, through the door. A great deal of snoring. Brother Ambrose says to be quiet.',
    offer: [
      { who: 'ambrose', text: 'Since Vespers broke, the choir sleeps by day. All of them, in the Dormitory. Except one.' },
      { who: 'ambrose', text: 'Brother Cuthbert never sang for the Abbot. Not a note. They locked him in the last cell with the lost hymn. The one the bells were made to ring.' },
      { who: 'ambrose', text: 'I need that hymn. Go through the Dormitory. The stairs are open, the monks are asleep. Do not end a step beside one. They wake. And they wake each other. And they are very grumpy in the mornings.' },
    ],
    reminder: [{ who: 'ambrose', text: "The Dormitory. Quietly. If one wakes, either run or make sure it doesn't wake the others." }],
    cleared: [
      { who: 'narrator', text: 'In the last cell sits a skeleton in a choir robe, a sheet of music folded neatly in its lap. On the wall, scratched over and over: "NOT THIS ONE."' },
      { who: 'narrator', text: 'The hymn has only three notes, marked for three bells. You take the page, and, after a moment, the robe. Cuthbert does not seem to mind.' },
    ],
    turnIn: [
      { who: 'ambrose', text: 'The lost hymn. Cuthbert, you stubborn old goose. You kept it after all.' },
      { who: 'ambrose', text: 'Three bells, three notes. There are three bells in the shaft. Ring them in this order and... well. We shall see. When the shaft opens.' },
      { who: 'ambrose', text: 'Keep the robe. Cuthbert would want someone to wear it who will not sing.' },
    ],
  },
  {
    n: 23,
    act: 2,
    title: 'The Bell Shaft',
    giver: 'ambrose',
    needs: 22,
    dungeon: { name: 'The Bell Shaft', floors: [8, 12], gifts: 3, look: 'cloister', mist: 3, monks: true },
    souls: 350,
    reward: 'The Bell-Rope Cloak and a title',
    hint: 'The Bell Shaft stands in the Sunken Cloister, north-east of the Chapter House. Climb down to the bells.',
    barred: "Sealed with the Abbot's mark. Far below, a bell is waiting. Brother Ambrose has been eyeing the seal.",
    offer: [
      { who: 'ambrose', text: 'The seal on the Bell Shaft cracked the night Vespers broke. I have been at it since with a chisel and a great deal of prayer. Mostly the chisel.' },
      { who: 'ambrose', text: 'It is open. I wish I could say I felt brave about it.' },
      { who: 'hero', text: 'What is down there?' },
      { who: 'ambrose', text: 'Three bells, and whoever has been ringing them for four hundred years. The Abbot does not pull his own ropes. He never did. He had novices for that.' },
      { who: 'ambrose', text: 'Go down. See who is on the rope. And if it is who I think it is, be gentle. He was a knight once, and he has had a very long shift.' },
    ],
    reminder: [{ who: 'ambrose', text: 'The Bell Shaft, across the cloister. Five floors down to the bells. Mind the mist, it pools at the bottom of things.' }],
    cleared: [
      { who: 'narrator', text: 'The shaft opens into a chamber as tall as a church. Three bells hang in the dark, each bigger than a house, and under them a figure in pale armour hauls on the ropes.' },
      { who: 'narrator', text: 'He does not look up. His hands do not stop. On his back plate is a dent shaped exactly like a door.' },
      { who: 'hero', text: 'Aldric?' },
      { who: 'aldric', text: 'I cannot let go. I have tried. He rings me and I ring the bell. Do not come closer. Go and tell the monk.' },
      { who: 'narrator', text: '{pet} whines, and for one stroke the bell is late.' },
    ],
    turnIn: [
      { who: 'ambrose', text: 'So it is him. The knight from the chapel. The Abbot always did like a strong back and a guilty conscience.' },
      { who: 'ambrose', text: 'Take this. It is a bell-rope, an old one, cut before the plague. It never rang for him. Wear it and the bells will know you are not his.' },
      { who: 'ambrose', text: 'There is a way to make him let go. But we will need a song.' },
    ],
  },
  {
    n: 24,
    act: 2,
    title: 'Three Notes',
    giver: 'ambrose',
    needs: 23,
    dungeon: { name: 'The Ringing Chamber', floors: [9, 13], gifts: 3, look: 'cloister', mist: 2, monks: true, holdout: 5, summon: true },
    souls: 450,
    reward: 'The Three Notes aura and a title',
    hint: 'Go back down the Bell Shaft to the Ringing Chamber. Hold out on the last floor while the three bells are rung.',
    barred: 'The bells are ringing down there, slow and steady. Brother Ambrose has a plan. He says it is a good one.',
    offer: [
      { who: 'ambrose', text: 'Three bells, three notes. The hymn they were cast to ring, before the Abbot taught them something worse. Ring it once, right through, and his hold on the ropes breaks.' },
      { who: 'ambrose', text: 'The trouble is that somebody has to stand under the bells while it happens. The whole cloister will come to stop it. Five waves, by my count. I counted twice. I got five and then six, so let us say five.' },
      { who: 'hero', text: 'And who rings the hymn?' },
      { who: 'ambrose', text: 'Aldric does. He is already on the ropes. He only has to pull the right ones, for once, and you only have to keep everyone off him until he is done.' },
      { who: 'ambrose', text: 'Take a friend. Take the hound. Take whatever the dead will lend you.' },
    ],
    reminder: [{ who: 'ambrose', text: 'The Ringing Chamber, at the bottom of the shaft. Five waves on the last floor. Three notes. Do not hum along, you will put him off.' }],
    cleared: [
      { who: 'narrator', text: 'The third note rings out and holds. It is the first clean sound this place has made in four hundred years. The ropes go slack in Aldric\'s hands.' },
      { who: 'aldric', text: 'I can feel my fingers. I had forgotten I had them. I am told I do not, strictly, but I can feel them.' },
      { who: 'aldric', text: 'Listen to me. The Abbot is below us, and he will want a ringer. If the rope hangs empty he will find another. Someone living, this time. Someone from the village.' },
      { who: 'aldric', text: 'I could stay. Hold the rope still, and keep it out of his hands until you have dealt with him. Or you can cut it, and we take our chances. It is your crypt now. You choose.' },
      {
        key: 'aldric',
        prompt: 'Aldric waits, one hand still on the rope.',
        options: [
          {
            label: 'Cut the rope. He has rung enough.',
            value: 'free',
            then: [
              { who: 'narrator', text: 'You cut it. The rope falls a long way. Aldric watches it go, and then, very carefully, sits down.' },
              { who: 'aldric', text: 'Four hundred years. I should like to see my chapel. Is the roof still off? Good. I liked the stars.' },
              { who: 'narrator', text: 'When you look again he is gone, and the cold has gone with him, up the shaft towards home.' },
            ],
          },
          {
            label: 'Let him hold it. Nobody else gets taken.',
            value: 'stay',
            then: [
              { who: 'aldric', text: 'Then I stay, and this time it is my hand on the rope and my choice. That is a different thing altogether.' },
              { who: 'aldric', text: 'Go on. I will keep the bells quiet. Tell the gravedigger I am doing the dignified voice.' },
              { who: 'narrator', text: 'He stands under the three bells like a knight at vigil, and for the first time the rope does not move.' },
            ],
          },
        ],
      },
    ],
    turnIn: [
      { who: 'ambrose', text: 'I heard it. All three notes. I wept, a little. Do not tell the novices. There are no novices. Do not tell the frogs.' },
      { who: 'ambrose', text: 'Take this. The hymn is yours now. It will ring wherever you walk, very quietly, to anyone who is listening.' },
      { who: 'ambrose', text: 'One thing left, then. He is at the bottom, where he has always been. His name was Ansel. He was my friend.' },
    ],
  },
  {
    n: 25,
    act: 2,
    title: 'The Plague Abbot',
    giver: 'ambrose',
    needs: 24,
    dungeon: {
      name: "The Abbot's Sanctum",
      floors: [10, 15],
      gifts: 4,
      look: 'cloister',
      mist: 3,
      monks: true,
      summon: true,
      boss: { floor: 15, kind: 'abbot' },
      bossLines: [
        { who: 'narrator', text: 'The sanctum is a garden. Everything in it is dead and everything in it is growing. At the far end a tall figure in a beaked mask tends a bed of grey flowers.' },
        { who: 'abbot', text: 'You broke my choir. You stopped my bells. I am not angry. Anger is a symptom, and I cured myself of those long ago.' },
        { who: 'hero', text: 'You have kept a whole village dying for four hundred years.' },
        { who: 'abbot', text: 'I have kept it from dying. Nobody in my cloister has died since the plague. They only sleep, and sing, and get up again. Can your gravedigger say the same?' },
        { who: 'abbot', text: 'Ambrose sent you. He always did send someone else. Come, then. Let me take your temperature.' },
      ],
    },
    souls: 800,
    reward: "The Abbot's Cope, the Silent Bell aura and a title",
    hint: "The Abbot's Sanctum lies at the very bottom of the Bell Shaft. Fifteen floors. He is waiting in his garden.",
    barred: 'Below the bells the stair keeps going. It smells of herbs and something sweeter. Brother Ambrose would like a word first.',
    offer: [
      { who: 'ambrose', text: 'Ansel was the best physician the cloister ever had. When the plague came he would not let anyone die of it. Not one. He found a way to keep them.' },
      { who: 'ambrose', text: 'That is all the bell ever was. A way to wake the dead before they noticed they were dead. He thought it was kindness. I think he still does.' },
      { who: 'hero', text: 'And you hid in a cell for four hundred years.' },
      { who: 'ambrose', text: 'I did. I am not proud of it. I am asking you to do what I could not, which is the least proud thing of all.' },
      { who: 'ambrose', text: 'His sanctum is under the bells. Take anyone who will go with you. And when it is done, tell me how he looked. No. Do not. Yes. Tell me.' },
    ],
    reminder: [{ who: 'ambrose', text: "The Abbot's Sanctum, at the bottom of the shaft. He rains plague where you stand, so do not stand. I shall be here, being useless with great devotion." }],
    cleared: [
      { who: 'narrator', text: 'The mask cracks down the middle. Behind it is a tired old man who has not slept since the plague.' },
      { who: 'abbot', text: 'Oh. It is quiet. I had forgotten that was allowed.' },
      { who: 'abbot', text: 'Tell Ambrose the garden was for him. He never came down to see it.' },
      { who: 'narrator', text: 'He lies down among the grey flowers, and one by one, all through the cloister, four hundred years of monks lie down with him. The mist thins. Far above, three bells hang still.' },
      {
        key: 'aldric',
        prompt: 'The bells are quiet.',
        options: [
          { label: '', value: 'free', then: [{ who: 'narrator', text: 'Somewhere over Gravesend a roofless chapel has a knight in it again, looking up at the stars.' }] },
          { label: '', value: 'stay', then: [{ who: 'narrator', text: 'Under the bells, Sir Aldric takes his hand off the rope at last, salutes nobody in particular, and starts the long climb home.' }] },
        ],
      },
      { who: 'narrator', text: 'And then, from under the sanctum floor, from under everything, something knocks. Three times. Politely.' },
      { who: 'narrator', text: 'End of Act II. Ambrose will want to hear how it went. Mortimer will want to hear about the knocking.' },
    ],
    turnIn: [
      { who: 'ambrose', text: 'It is done, then. I felt them go. All of them, like candles. Tell me how he looked.' },
      { who: 'hero', text: 'Tired. He said the garden was for you.' },
      { who: 'ambrose', text: '...' },
      { who: 'ambrose', text: 'Of course it was. Stubborn old goose. I shall go down and water it. Somebody should.' },
      { who: 'ambrose', text: 'Take his cope. He would hate you having it, which is most of why I want you to. And thank you. I have not said that to anyone since the plague. It is nicer than I remembered.' },
    ],
  },
  {
    n: 34,
    act: 2,
    title: 'Bell Metal',
    side: true,
    giver: 'pip',
    needs: 23,
    dungeon: { name: 'The Deep Seam', floors: [7, 10], gifts: 2, look: 'mine' },
    souls: 250,
    reward: "The Founder's Apron and a title",
    hint: 'Pip needs bell-bronze from the Deep Seam: take the Old Mine, north of the village by the kennels, and keep going down.',
    barred: 'The deep seam is boarded over, with a sign in Marta\'s handwriting: "NOT YET, PIP." Pip will know what that means.',
    offer: [
      { who: 'pip', text: "I've had an idea. It's a good one. Don't make that face." },
      { who: 'pip', text: "Everyone in this village flinches when a bell rings. That's four hundred years of flinching. So I'm going to cast us a new one. A nice one. One that only says what time it is." },
      { who: 'pip', text: "Marta always said there's bell-bronze in the deep seam, under the old mine. She also said never go down there. I've decided she meant me, specifically." },
      { who: 'hero', text: 'So you want me to go.' },
      { who: 'pip', text: "You're very quick. Four floors, past where you found the coal. Bring back as much as you can carry and I'll do the rest. I've read a book about it. Most of a book." },
    ],
    reminder: [{ who: 'pip', text: 'The Deep Seam, down the Old Mine. Bell-bronze. It rings when you drop it, so try not to drop it near anything hungry.' }],
    cleared: [
      { who: 'narrator', text: 'At the bottom of the seam the rock is the colour of old pennies. A pick still stands in it, with M.S. burned into the handle.' },
      { who: 'narrator', text: 'You fill your pack. Every lump hums a little, each on a different note, like a choir warming up.' },
    ],
    turnIn: [
      { who: 'pip', text: "That's it! That's the stuff! Listen to it! No, don't, it's not a bell yet, it's just rocks. But LISTEN to it!" },
      { who: 'pip', text: "You found her pick. I'll hang it next to the tongs. She'd say I was getting sentimental. She'd be right." },
      { who: 'pip', text: "Give me a week. Gravesend's getting a bell that never woke anybody who wasn't supposed to get up. Here, take the apron, I've got two and one's on fire." },
    ],
  },
  // ---------- Act III: The Long Night (opens with Midwinter) ----------
  {
    n: 41,
    act: 3,
    title: 'Three Knocks',
    giver: 'gravedigger',
    needs: 25,
    dungeon: { name: 'Under the Cottage', floors: [11, 15], gifts: 3, look: 'frozen' },
    souls: 400,
    reward: 'The Rimewalker cloak and a title',
    hint: "Lift the rug in Mortimer's cottage: the trapdoor is under the kettle. Five floors down to whatever is knocking.",
    barred: 'A trapdoor under the rug, with a kettle standing on it. Mortimer has kept a kettle on it for a very long time. Ask him why.',
    offer: [
      { who: 'gravedigger', text: "You'll have noticed it's snowing. It hasn't snowed in Gravesend since before I was digging. Not once. I thought snow was something that happened to other villages." },
      { who: 'gravedigger', text: 'And there is the knocking. Three times, every night, polite as a vicar. It started under the Abbot\'s garden. Last night it came up under my floor. Under the kettle.' },
      { who: 'hero', text: 'Something wants to come in.' },
      { who: 'gravedigger', text: 'Everything wants to come in. That is what doors are for. But this one knocks like it was taught manners, and that frightens me more than the howling ever did.' },
      { who: 'gravedigger', text: "There's a trapdoor under the rug. I put the kettle on it a long time ago and I've never once moved it. Go down. Have a look. And whatever you do, don't answer the door." },
    ],
    reminder: [{ who: 'gravedigger', text: 'Under the rug, under the kettle. Five floors. If anything knocks, you were never here.' }],
    cleared: [
      { who: 'narrator', text: 'At the bottom the crypt is rimed white. Your breath hangs in the air and does not fall.' },
      { who: 'narrator', text: 'Set into the ice is a door, black and very old, with a brass knocker on the wrong side. Beside it stands a chair carved out of frost, and on the chair sits a wooden bowl, empty, with a child\'s spoon in it.' },
      { scene: 'knock' },
      { who: 'narrator', text: '{pet} sits down and will not go any closer. You take the spoon. Mortimer will want to see it.' },
    ],
    turnIn: [
      { who: 'gravedigger', text: "That's my spoon." },
      { who: 'gravedigger', text: "...I mean, it's a spoon. Lots of people have spoons. Spoons are very common." },
      { who: 'gravedigger', text: "Look. There's an old Midwinter custom. Older than the crypt, older than me, and I'm older than I look. Bess's family kept the book of it at the inn. Ask her. I'd sooner you heard it from someone who isn't me." },
      { who: 'gravedigger', text: "And take this coat. It's warm. Mine never was." },
    ],
  },
  {
    n: 42,
    act: 3,
    title: 'The Hearth Book',
    giver: 'bess',
    needs: 41,
    dungeon: { name: 'The Ice-House', floors: [12, 16], gifts: 3, look: 'frozen' },
    souls: 400,
    reward: 'The Hearthkeeper cloak and a title',
    hint: "The inn's old ice-house stands on the shore of the Frozen Mere, south of the village. Bring back the Hearth Book.",
    barred: 'The old ice-house. Bess has the key, and Bess has a grievance with the cold.',
    offer: [
      { who: 'bess', text: "My fire's gone cold. Oh, it's burning, I can see it burning, but you could warm your hands on a fish. Ale's frozen in the barrel. I've a pub full of people drinking tea. TEA." },
      { who: 'bess', text: "Mortimer sent you about the Guest, didn't he. Course he did. He'd rather fight a ghoul than say that word out loud." },
      { who: 'bess', text: 'My gran used to tell it. Every Midwinter, on the longest night, Gravesend set a chair by one fire, left one door on the latch, and carried a bowl of soup down to the mere. The Guest came up, sat the night by the fire, and in the morning the winter turned kind. Warm it for one night, and it keeps the cold down below all year.' },
      { who: 'hero', text: 'And when did Gravesend stop?' },
      { who: 'bess', text: "That's the thing, love. Nobody remembers. It's all written in the Hearth Book, and the Hearth Book's in the old ice-house down on the mere, where Gran hid it to keep it safe. Safe from what, she never said. Something's moved in down there. Go and get it back." },
    ],
    reminder: [{ who: 'bess', text: 'The old ice-house, on the mere, south out of the village. Mind the ice. Mind whatever has moved in.' }],
    cleared: [
      { who: 'narrator', text: 'Under the ice-house, between blocks of ice cut four hundred years ago, the Hearth Book lies wrapped in oilcloth. The last pages are in a careful, frightened hand.' },
      { who: 'narrator', text: '"Midwinter. Chair set at the Last Orders. Door on the latch. The soup to be carried down to the Guest by the gravedigger\'s boy, as is his family\'s right."' },
      { who: 'narrator', text: '"Plague in the cloister. The Abbot\'s bells have not stopped all night. The boy came back with the bowl still full. He would not say what he saw. The Guest did not come."' },
      { who: 'narrator', text: '"The bells have rung every midnight since. Midwinter has not come again."' },
    ],
    turnIn: [
      { who: 'bess', text: "The gravedigger's boy. Well, that's not Mortimer. Mortimer's old, but he's not THAT old." },
      { who: 'bess', text: '...Is he?' },
      { who: 'bess', text: 'Four hundred years of bells, love. They kept the monks up and walking. Who\'s to say they didn\'t keep a frightened little boy digging the same graves the whole time.' },
      { who: 'bess', text: "Here. Gran's winter cloak, from behind the bar. Then go and talk to him. Gently. You'll want to be gentle." },
    ],
  },
  {
    n: 43,
    act: 3,
    title: "Mortimer's Errand",
    giver: 'gravedigger',
    needs: 42,
    dungeon: { name: 'The Beacon Hearth', floors: [13, 17], gifts: 3, look: 'frozen', holdout: 5, summon: true },
    souls: 500,
    reward: 'The Beacon Fire aura and a title',
    hint: 'The old Beacon stands on the shore of the Frozen Mere. Go down to its hearth and hold out on the last floor while the Midwinter fire catches.',
    barred: 'The old Beacon, dark and drifted with snow. Nobody has lit it in four hundred years. Mortimer knows why.',
    offer: [
      { who: 'gravedigger', text: "She told you, then. Good. I couldn't." },
      { who: 'gravedigger', text: "I was nine. Mum gave me the bowl and said, Mortimer, it's our family's honour. Carry it down, set it on the chair, say good evening and come straight home. Easy." },
      { who: 'gravedigger', text: 'I got as far as the door. It knocked. From the inside. I dropped the spoon and I ran. And behind me, up at the cloister, the bells started, and they never stopped. Not that night, not for four hundred years.' },
      { who: 'gravedigger', text: "Everyone got kept, you see. Not just the monks. Me too. Nine, then twelve, then forty, then this, and never a day older after. Same graves. Same shovel. Same kettle. Now the bells are quiet and my knees have caught up all at once. I'm not complaining. Well. I am a bit." },
      { who: 'hero', text: 'What do you need?' },
      { who: 'gravedigger', text: "The Beacon on the mere. That's where the Midwinter fire was lit at dusk, to show the Guest the way up, and every hearth in Gravesend was lit from it. That's why Bess's fire won't warm: it's waiting for the Beacon." },
      { who: 'gravedigger', text: "Light it, and every bit of cold down there will come for the flame at once. Hold them off it until it catches. I'll be at the top, keeping the matches dry. Well. Holding them." },
    ],
    reminder: [{ who: 'gravedigger', text: 'The Beacon, on the mere. Five waves of cold, by my count. Keep them off the fire until it catches.' }],
    cleared: [
      { scene: 'beacon' },
      { who: 'narrator', text: 'The Midwinter fire catches with a sound like a held breath let go. All over Gravesend, every hearth flares warm at once. Up at the Last Orders somebody cheers. Bess, probably. Then the ale.' },
      { who: 'narrator', text: 'The cold falls back from the flame. And from far below, from under the mere, the knocking comes again. Softer now. Hopeful.' },
      { who: 'guest', text: 'Thank you. That is much better. I can see the way up now.' },
      { who: 'guest', text: 'May I come in?' },
    ],
    turnIn: [
      { who: 'gravedigger', text: 'I heard it. All the way up here, through the snow. It asked nicely. It always asked nicely. That was the worst part.' },
      { who: 'gravedigger', text: "Here. A bit of the Beacon, in a lantern. It'll keep you warm. You'll want warm. Down there is where we're going next, I'm afraid." },
    ],
  },
  {
    n: 44,
    act: 3,
    title: 'The Longest Night',
    giver: 'bess',
    needs: 43,
    dungeon: {
      name: 'The Frozen Mere',
      floors: [15, 20],
      gifts: 4,
      look: 'frozen',
      summon: true,
      boss: { floor: 20, kind: 'guest' },
      bossLines: [
        { who: 'narrator', text: 'The bottom of the mere is a hall of black ice. At the far end stands the door with the knocker on the wrong side, and in front of it, far too tall, a figure in a robe of frost and a crown of icicles.' },
        { who: 'hero', text: 'Good evening.' },
        { who: 'guest', text: '...Good evening. Oh. Oh, nobody has said that to me in such a long time.' },
        { who: 'guest', text: 'I knocked. Four hundred winters I knocked, and the bells said go away, go away, go away. I was so very polite. I am still polite. I am only so very, very hungry.' },
        { who: 'guest', text: 'Forgive me. I do not think I can stop myself eating your warmth. Please do try to stop me.' },
      ],
    },
    souls: 900,
    reward: 'The Crown of Rime, the Long Night aura and a title',
    hint: 'A hole has been cut in the middle of the Frozen Mere. Go down through the ice: twenty floors. The Guest is waiting by its door.',
    barred: 'A hole cut in the middle of the mere, edged with old frost. Far below, something is waiting politely. Bess has made soup.',
    offer: [
      { who: 'narrator', text: 'Mortimer is at the Last Orders, by the fire, with a covered bowl on his knees. He has not taken his eyes off it.' },
      { who: 'bess', text: "Soup. Proper soup, with things in it. Gran's way. I've made it every Midwinter of my life and never knew who for." },
      { who: 'gravedigger', text: "Here's the trouble. Four hundred winters it's been knocking and nobody answered. That's a long time to be cold and polite. Anything that's been that hungry that long isn't only a guest any more. Part of it's just hunger now, with a crown of ice on." },
      { who: 'hero', text: 'So I break the crown.' },
      { who: 'gravedigger', text: "You break the crown. And after that there'll be a choice, and I'd sooner you made it than me. I've had one go at this already, and I dropped the spoon." },
      { who: 'gravedigger', text: 'Down through the ice in the middle of the mere. Twenty floors. Take the hound. Take anyone the dead will lend you. And when you get to the door...' },
      { who: 'gravedigger', text: 'Say good evening. It matters. Somebody should have said it four hundred years ago.' },
    ],
    reminder: [{ who: 'bess', text: "Down through the ice in the middle of the mere. Twenty floors. Mortimer says to say good evening. He's said it to me nine times. I'm passing it on." }],
    cleared: [
      { who: 'narrator', text: 'The crown of icicles cracks, and falls, and shatters on the black ice like a dropped bell. The hall goes quiet. The thing in front of you is smaller now, and old, and shivering.' },
      { who: 'guest', text: 'Oh. Oh, that is better. I am sorry about all that. I was not myself. I was four hundred years of not being let in.' },
      { who: 'narrator', text: 'Footsteps on the ice behind you. Mortimer, out of breath, carrying a covered bowl and a wooden spoon.' },
      { who: 'gravedigger', text: "Sorry I'm late. Four hundred years late. Good evening." },
      { who: 'guest', text: 'Good evening, little gravedigger. You grew.' },
      { who: 'gravedigger', text: "Not as much as you'd think." },
      {
        key: 'guest',
        prompt: 'The Guest looks at the bowl, then at the door, then at you.',
        options: [
          {
            label: 'Bring it up to the inn. Give it the chair by the fire.',
            value: 'chair',
            then: [
              { who: 'narrator', text: 'You lead it up through the ice, and Mortimer carries the soup the whole way, and does not spill a drop.' },
              { who: 'narrator', text: 'At the Last Orders, Bess has set the chair by the fire. The Guest sits. It is shy about the soup, and then it is not. The whole village stays up. Somebody plays a fiddle badly, and nobody minds.' },
              { who: 'narrator', text: 'Near dawn, Mortimer sits down by the fire, just for a moment, to rest his knees.' },
              { who: 'guest', text: 'He is very tired. He has been on his errand a long time. Shall I take him with me, when I go? I would see that he is warm.' },
              { who: 'gravedigger', text: "That's kind. It really is. But not yet. Someone's got to dig, and someone's got to carry the soup next year, and I've only just got the hang of it." },
              { who: 'guest', text: 'Next year, then. I shall look forward to it. I have never looked forward to anything before.' },
              { scene: 'chair' },
              { who: 'narrator', text: 'When the sun comes up, the chair by the fire is empty and the snow has stopped. Mortimer is asleep in the chair beside it, holding an empty bowl, smiling like a boy who carried it all the way.' },
            ],
          },
          {
            label: "Ring it back down with Pip's new bell, until next year.",
            value: 'bell',
            then: [
              { who: 'narrator', text: "Pip's bell rings out over the mere: one clean note, the hour, and nothing else. The Guest listens with its head on one side." },
              { who: 'guest', text: 'A kind bell. It does not say go away. It says, not tonight. I can wait for not tonight. I am very good at waiting.' },
              { who: 'guest', text: 'Next Midwinter, then. Set the chair. Leave the door on the latch. Send the gravedigger with the soup.' },
              { who: 'gravedigger', text: "I'll come. I promise. I'll bring two spoons, in case I drop one." },
              { scene: 'sink' },
              { who: 'narrator', text: 'It sinks back into the dark, slowly, politely, and the ice closes over it like a door shut gently. Mortimer stands a long time out on the mere, holding the bowl, while the snow comes down.' },
            ],
          },
        ],
      },
      { who: 'narrator', text: 'End of Act III. The longest night is over. Bess will want to hear how it went.' },
    ],
    turnIn: [
      {
        key: 'guest',
        prompt: '',
        options: [
          {
            label: '',
            value: 'chair',
            then: [
              { who: 'bess', text: "He slept right through till noon in that chair. First proper sleep in four hundred years, he says. Woke up asking for breakfast and his shovel." },
              { who: 'bess', text: "The Guest asked to take him, you know. He said not yet. I've never been so glad to hear a man turn down a lift." },
              { who: 'bess', text: 'The Guest left this on the chair for you. Ice that will not melt. It said thank you for the soup, and that you were the first to say good evening.' },
            ],
          },
          {
            label: '',
            value: 'bell',
            then: [
              { who: 'bess', text: "He came in at dawn and sat right there with the bowl on his knees. Said it was the best night he's had in four hundred years. Then he fell asleep in the chair and snored the place down." },
              { who: 'bess', text: "He's going back next year. Two spoons. He's already practising good evening in the mirror. It's very irritating." },
              { who: 'bess', text: 'This came up through the ice after the Guest went down. Frost that will not melt. I think it is a thank-you. It certainly is not mine.' },
            ],
          },
        ],
      },
      { who: 'bess', text: "Happy Midwinter, love. First one in four hundred years. Let's do it properly." },
    ],
  },
  {
    n: 51,
    act: 3,
    title: 'Rime-Salt',
    side: true,
    giver: 'pip',
    needs: 41,
    dungeon: { name: 'The Salt Caves', floors: [11, 14], gifts: 2, look: 'frozen' },
    souls: 300,
    reward: "Pip's Earmuffs and a title",
    hint: 'The Salt Caves open on the west shore of the Frozen Mere. Four floors down, the walls grow rime-salt.',
    barred: 'The Salt Caves, glittering and very cold. Pip has been eyeing them, and not in a good way.',
    offer: [
      { who: 'pip', text: "Bad news. The new bell. The one I cast. With the bronze. The one I've polished every morning and talk to like a person." },
      { who: 'pip', text: 'It cracked. The cold got into it. Right down the side. Ping. Like an egg.' },
      { who: 'pip', text: "Marta's notes say a bell cast in winter wants rime-salt in the mould, or it sulks. Rime-salt grows in the caves by the mere. Grew. Grows. Marta's handwriting is not good." },
      { who: 'hero', text: 'And the caves are full of something.' },
      { who: 'pip', text: "Everything's full of something lately. Four floors down. Bring back a sack. A big sack. I'll mend the bell, and then it'll ring properly. Properly-properly." },
    ],
    reminder: [{ who: 'pip', text: "The Salt Caves, west side of the mere. Rime-salt. It glitters. It tastes of tears. Don't ask how I know." }],
    cleared: [
      { who: 'narrator', text: 'The walls of the lowest cave are furred with salt that glitters like frost and tastes like tears. You fill the sack.' },
      { who: 'narrator', text: 'Somewhere above, a crack in a bell is about to have a very bad day.' },
    ],
    turnIn: [
      { who: 'pip', text: "Rime-salt! Look at it! Don't lick it. I licked it." },
      { who: 'pip', text: 'Give me a night with this and the bell will be better than new. Marta says a bell that has cracked and been mended never says go away. It says not tonight. Which is politer.' },
      { who: 'pip', text: 'Here, earmuffs. I made them out of the old bellows. They only squeak a bit.' },
    ],
  },
  {
    n: 52,
    act: 3,
    title: 'The Waits',
    side: true,
    giver: 'agnes',
    needs: 41,
    dungeon: { name: 'The Carol Barrow', floors: [12, 15], gifts: 2, look: 'frozen', sleepers: true },
    souls: 300,
    reward: "Harold's Scarf and a title",
    hint: 'The Carol Barrow is the old burial mound on the east shore of the Frozen Mere. Go quietly: everything down there is asleep.',
    barred: 'The old barrow, with lantern-light still glowing faintly somewhere inside. Agnes has been watching it from her window.',
    offer: [
      { who: 'agnes', text: 'The waits went out carolling last night. They always used to, at Midwinter. Lanterns and terrible singing. Harold sang bass. Harold sang everything bass.' },
      { who: 'agnes', text: "They went down to the old barrow by the mere to sing to the dead, which is a tradition, and which is daft, and they haven't come back." },
      { who: 'hero', text: 'Lost?' },
      { who: 'agnes', text: 'Asleep, I think. Frozen in the middle of a verse. The cold does that if you stand still long enough. Harold always said carols were dangerous.' },
      { who: 'agnes', text: "Go quietly, dear. Whatever's down there is asleep too, and you don't want it joining in." },
    ],
    reminder: [{ who: 'agnes', text: 'The Carol Barrow, on the east shore. Tiptoe. If anything wakes up, do not, whatever you do, let it pick the next carol.' }],
    cleared: [
      { who: 'narrator', text: 'In the deepest chamber the waits stand in a ring, lanterns raised, mouths open, white with frost from head to foot. Among them, very faint, stands a bass-shaped ghost holding a hymn book.' },
      { who: 'narrator', text: 'You light their lanterns from your own. One by one they thaw, blink, and finish the verse exactly where they left off. Slightly flat.' },
      { who: 'narrator', text: 'The ghost sings the last line. He holds the low note a long time. Then he tips his hat to you, and goes up the stair ahead of them, towards a house with a warm chair in it.' },
    ],
    turnIn: [
      { who: 'agnes', text: 'They came in stamping and singing and demanding cake. And there was a bass line under it. A good one. Wrong words, as usual.' },
      { who: 'agnes', text: "He's home for Midwinter, I think. Just for the night. Isn't that nice?" },
      { who: 'agnes', text: "Take Harold's scarf. He'd want someone to have it. He'd want it to be someone who can't sing." },
    ],
  },
];

export const QUEST_BY_N = Object.fromEntries(QUESTS.map((q) => [q.n, q])) as Record<number, Quest>;
/** Act I's quests (finishing them all unlocks the Bell-Ringer), and its main story. */
export const ACT1_QUESTS = QUESTS.filter((q) => !q.act);
export const MAIN_QUESTS = ACT1_QUESTS.filter((q) => !q.side);
export const ACT2_QUESTS = QUESTS.filter((q) => q.act === 2);
export const ACT2_MAIN = ACT2_QUESTS.filter((q) => !q.side);
export const ACT3_QUESTS = QUESTS.filter((q) => q.act === 3);
export const ACT3_MAIN = ACT3_QUESTS.filter((q) => !q.side);

/** Where the player stands in the story. */
export interface StoryState {
  done: number[];
  active: number[];
  cleared: number[];
  /** Choices made along the way (the hound's name, what became of Aldric, where the Guest spent Midwinter). */
  choices?: Record<string, string>;
}

export type QuestStatus = 'locked' | 'available' | 'active' | 'cleared' | 'done';

export function questStatus(q: Quest, s: StoryState): QuestStatus {
  if (s.done.includes(q.n)) return 'done';
  if (s.cleared.includes(q.n)) return 'cleared';
  if (s.active.includes(q.n)) return 'active';
  if (q.act === 2 && !act2Open()) return 'locked';
  if (q.act === 3 && !act3Open()) return 'locked';
  return !q.needs || s.done.includes(q.needs) ? 'available' : 'locked';
}

/** Aldric haunts his chapel from the hound's quest until the bell takes him. */
export function npcPresent(npc: NpcId, s: StoryState): boolean {
  // ...and comes home to it once the bells are quiet (straight away, if you cut his rope).
  if (npc === 'aldric') return (s.done.includes(2) && !s.done.includes(4)) || s.done.includes(25) || (s.done.includes(24) && s.choices?.aldric === 'free');
  if (npc === 'ambrose') return s.done.includes(21);
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
  const offer = mine.find((q) => !q.side && questStatus(q, s) === 'available') ?? mine.find((q) => questStatus(q, s) === 'available');
  if (offer) return { lines: offer.offer, accept: offer.n };
  const active = mine.find((q) => questStatus(q, s) === 'active' || questStatus(q, s) === 'cleared');
  if (active) return { lines: active.reminder };
  return { lines: chatter(npc, s) };
}

function chatter(npc: NpcId, s: StoryState): Line[] {
  const has = (n: number) => s.done.includes(n);
  const guest = s.choices?.guest;
  switch (npc) {
    case 'gravedigger':
      if (has(44)) return guest === 'chair'
        ? [
          { who: 'gravedigger', text: "It asked to take me with it. Kind of it. I said I'd a few graves in me yet, and next year's soup." },
          { who: 'gravedigger', text: "I've moved the kettle off the trapdoor. Nothing down there to keep out any more. Just a friend, waiting for next year." },
        ]
        : [
          { who: 'gravedigger', text: "Two spoons. I've practised. Good evening. Good evening. Good EVENING. Bess says I'm doing it too loud." },
          { who: 'gravedigger', text: "Next Midwinter I'm carrying that bowl all the way. Four hundred years late, but you can't rush soup." },
        ];
      if (has(43)) return [{ who: 'gravedigger', text: "Every hearth in the village is warm, and I'm sat here shivering anyway. That's not the cold. That's nerves. Four hundred years of them." }];
      if (has(42)) return [{ who: 'gravedigger', text: "Bess told you, then. I can see it on your face. Go on. Ask me how old I am. No. Don't." }];
      if (has(41)) return [{ who: 'gravedigger', text: "I've moved the kettle back onto the trapdoor. Habit. It doesn't stop the knocking. It never did. It just made me feel better." }];
      if (has(25)) return [
        { who: 'gravedigger', text: "Not one grave's moved in a week. I've had to start a hobby. It's digging. Turns out I just like digging." },
        { who: 'gravedigger', text: "Knocking, you say. Under the Abbot's garden. Three times, polite. I don't like polite. Nothing good ever knocked." },
      ];
      if (has(24)) return [
        { who: 'gravedigger', text: 'I heard three notes come up through the floor last night. Proper ones. The cat sat up and listened. I have not got a cat.' },
      ];
      if (has(22)) return [
        { who: 'gravedigger', text: "The bell missed a stroke last night. Whole village heard it. Bess served free ale for an hour before she realised what she was doing." },
      ];
      if (has(21)) return [
        { who: 'gravedigger', text: "A monk, you say? Living under my graveyard this whole time? I'll be charging him rent." },
      ];
      if (has(4)) return [
        { who: 'gravedigger', text: "Aldric's gone, then. Dragged down by the bell. I'd say he'll be missed, but I never got the money for his funeral." },
        { who: 'gravedigger', text: "The Plague Abbot's cloister lies under the Warden's door. If someone is ringing that bell, it's someone with a grudge and good shoulders. Get some rest." },
        { who: 'gravedigger', text: act2Open() ? "Act II is coming." : "The ground by the tower has started to sink. Come back Friday, and bring a lantern. Act II opens Friday." },
      ];
      if (has(2)) return [
        { who: 'gravedigger', text: "Folk say the old chapel's haunted. East of the village. Take {pet}, ghosts hate dogs. Or love them. One of those." },
      ];
      return [{ who: 'gravedigger', text: 'Tea? No? More for me.' }];
    case 'aldric':
      if (has(44)) return [{ who: 'aldric', text: guest === 'chair' ? 'I saw the Guest go at dawn, alone across the mere, walking lighter than it came. The gravedigger waved it off from the inn door. I saluted. It seemed right.' : 'Snow on the chapel floor, and the stars through the roof. A knight could keep a worse vigil.' }];
      if (has(41)) return [{ who: 'aldric', text: 'The bells kept something else below, all those years. I felt it under the ropes. Cold. Patient. Very well brought up.' }];
      if (has(25)) return [{ who: 'aldric', text: 'It is quiet. I keep waiting for midnight, and then midnight comes, and nothing happens. It is the best thing that has ever not happened to me.' }];
      if (has(24)) return [{ who: 'aldric', text: 'I am home. The roof is still off. Finish it, friend. He is at the bottom, where the mist comes from.' }];
      return [{ who: 'aldric', text: 'The bell is quiet tonight. I do not trust it when it is quiet.' }];
    case 'bess':
      if (has(44)) return guest === 'chair'
        ? [{ who: 'bess', text: "Mortimer's claimed the chair next to the Guest's. Says he's keeping it warm for next year. He keeps it warm by sleeping in it." }]
        : [{ who: 'bess', text: "Mortimer's in every night now, practising good evening at the fire. The fire's got very polite." }];
      if (has(43)) return [{ who: 'bess', text: "Fire's warm! Ale's flowing! I've a chair by the hearth that nobody's to sit in, so of course everyone wants to." }];
      if (has(42)) return [{ who: 'bess', text: "I've read Gran's book cover to cover. There's a recipe for the soup. There's also a recipe for a pie that I think is mostly a threat." }];
      if (has(41) && !has(42)) return [{ who: 'bess', text: 'Tea. TEA. In my pub.' }];
      if (has(25)) return [{ who: 'bess', text: "Slept right through, I did. First time since I was a girl. Woke up and didn't know what to do with myself, so I opened early." }];
      return has(13)
        ? [{ who: 'bess', text: "The usual, love? That's the ale. The usual's always the ale." }]
        : [{ who: 'bess', text: "Rumour has it Pip licked the blue coal. Rumour is Pip. He tells everyone." }];
    case 'agnes':
      if (has(52)) return [{ who: 'agnes', text: "The chair was warm again last night. And somebody hummed the bass line of every carol we know. Wrong words. Isn't that nice?" }];
      if (has(41)) return [{ who: 'agnes', text: 'Snow on the graves. Harold would have built a snowman and given it his hat. And then complained about the hat.' }];
      if (has(25)) return [{ who: 'agnes', text: "Harold says it's very peaceful now. He says it through the kettle, mostly. One whistle for yes." }];
      return has(11)
        ? [{ who: 'agnes', text: "I set a place for Harold every night. Last night the chair was warm. Isn't that nice?" }]
        : [{ who: 'agnes', text: "It's very quiet in the village these days. Even the dead are quiet. Mostly." }];
    case 'ambrose':
      if (has(44)) return [{ who: 'ambrose', text: 'Ansel\'s bells kept the Guest out for four hundred years, and he never once knew it. I think he would have laughed. He did not laugh often. It was worth waiting for.' }];
      if (has(41)) return [{ who: 'ambrose', text: 'Snow in the cloister garden. My red flower is wearing a little white hat. I am choosing to find this encouraging.' }];
      if (has(25)) return [{ who: 'ambrose', text: 'I went down to the garden. Grey flowers, every one of them. I have planted a red one. We shall see who wins.' }];
      if (has(22)) return [{ who: 'ambrose', text: 'Listen. No singing. I had forgotten what quiet sounded like. It sounds like dripping, mostly.' }];
      return [{ who: 'ambrose', text: 'The bell shaft is sealed. Only the Abbot opens it. Or a very large hammer. We have neither, for now.' }];
    case 'pip':
      if (has(51)) return [{ who: 'pip', text: "Mended bell's hung. Rings like a spoon on a cup. Says not tonight, very politely. I've started saying it too. To customers. They don't like it." }];
      if (has(41) && !has(34)) return [{ who: 'pip', text: "Forge is the only warm place in the village and everyone knows it. I've got eleven people in here. Three of them are ghouls. I'm not asking." }];
      if (has(34)) return [{ who: 'pip', text: has(25) ? "Hear that? Noon. Just noon. Nobody got up who shouldn't. Best bell I ever made. Only bell I ever made." : "Bell's cooling. Don't touch it. I touched it. Don't touch it." }];
      if (has(32)) return [{ who: 'pip', text: "Cough's gone. Village is pink again. Well, the usual grey. Healthy grey." }];
      if (has(21) && !has(32)) return [{ who: 'pip', text: '*cough* Sorry. Everyone has it. *cough*' }];
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
  'ambrose-rule': { title: 'The Rule of the Cloister', text: '"Rise at the bell. Pray at the bell. Sleep at the bell. Do not, under any circumstances, ring the bell yourself." The last line is underlined four times.' },
  'ambrose-letter': { title: 'An unsent letter', text: '"Brother Ansel, they say you found a cure inside the plague. They say you hear it singing. Come home. The garden misses you. So do I. A."' },
  'mort-kettle': { title: "Mortimer's kettle", text: 'Black with age and never once cold. It stands on a rug, and the rug lies over a trapdoor, and a draught comes up round the edges that smells of snow.' },
  'guest-chair': { title: 'The chair by the fire', text: 'A high-backed chair, set a little apart from the others, with a cushion nobody sits on. Carved into the back, worn almost smooth: FOR THE GUEST.' },
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
  // Act III: the Midwinter Guest, pale and polite under a crown of icicles.
  guest: [
    '....a..a..a.....', '....aa.aa.aa....', '...kaaaaaaaak...', '...kwwwwwwwwk...', '..kwwwwwwwwwwk..', '..kwwkkwwkkwwk..',
    '..kwwkdwwkdwwk..', '..kwwwwwwwwwwk..', '..kwwwwkkwwwwk..', '..kwwwwwwwwwwk..', '...kwwwwwwwwk...', '..kAkwwwwwwkAk..',
    '.kAAAkkkkkkAAAk.', '.kAaaAAAAAAaaAk.', '.kAaaaAAAAaaaAk.', '.kAAAAAAAAAAAAk.',
  ],
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
  abbot: [
    '......kkkk......', '.....kYYYYk.....', '....kYYggYYk....', '....kYgYYgYk....', '...kkkkkkkkkk...', '..kvvvvvvvvvvk..',
    '..kvkkkkkkkkvk..', '..kvkbbbbbbkvk..', '..kvbmmbbmmbvk..', '..kvbmYbbmYbvk..', '..kvbbbBBbbbvk..', '..kvkbbBBbbkvk..',
    '..kvvkbBBbkvvk..', '.kvvvvkBBkvvvvk.', '.kvVvvvkkvvvVvk.', '.kkkkkkkkkkkkkk.',
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
  ambrose: [
    '.....kkkkkk.....', '....kllllllk....', '...kllLLLLllk...', '..kllLkkkkLllk..', '..klLkffffkLlk..', '..klLfekkefLlk..',
    '..klLffffffLlk..', '..klLfFffFfLlk..', '..kllLffffLllk..', '.kllllLLLLllllk.', '.klLllllllllLlk.', '.klLllllllllLlk.',
    '.klLBBBBBBBBLlk.', '.klLlllllllllLk.', '.kllllllllllllk.', '.kkkkkkkkkkkkkk.',
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
  ambrose: [
    '...kkkkk....', '..kllllLk...', '..klfekLk...', '..klffflk...', '..kllllllk..', '.kllLLLLllky', '.klLllllLlkw',
    '.kfLBBBBLfkw', '..klllllllk.', '..kllllllk..', '...klk.klk..', '...kk...kk..',
  ],
  pip: [
    '...kkkkk....', '..kHHHHHk...', '..kYpkYpk...', '..kfffffk...', '..kfekefk...', '...kffffk...', '..klkLLklk..',
    '.kllLLLLllk.', '.kfkLLsLkfk.', '..kLLLLLLk..', '...kLk.kLk..', '...kk...kk..',
  ],
};

const figureCache = new Map<NpcId, HTMLCanvasElement>();
onCanvasReset(() => figureCache.clear());

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
