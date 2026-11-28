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
    date: '2026-11-28',
    title: 'The Daily turns into a hunt',
    notes: [
      '☠️ Death now comes for you from floor 60 in the Daily, not 150, and his countdown shrinks faster the deeper you go. A great run is a tense chase to the finish, over in about twenty minutes instead of an hour.',
      '⚔️ Past floor 30 in the Daily, the crypt fights back: foes grow much tougher with every floor, hit harder, and more and more of them are elites. A strong build can no longer just wait for a floor to clear itself.',
      '♾️ Endless is unchanged: Death still waits until floor 150 for anyone who wants the long haul.',
    ],
    go: ['daily'],
  },
  {
    date: '2026-11-27',
    title: 'Midwinter, and Act III: The Long Night',
    notes: [
      '❄️ Midwinter is here until January 6. Snow is falling on Gravesend for the first time in four hundred years, and over the menus too.',
      '📖 Act III of the story, The Long Night: something under everything is knocking, three times a night, very politely. Four quests and two side quests take you to the Frozen Mere, a new place south of the village, deeper than ever (floors 11 to 20), with the Midwinter Guest waiting at the bottom and a choice to make at the end of the longest night. Its biggest moments play out as short animated scenes. Finish Act II to begin.',
      '🎁 The Twelve Gifts of Midwinter: finish a run on any day of Midwinter, in any mode, to open the next of twelve gifts. Souls, two cloaks, a gift bow, a candle wreath, the Silent Night aura, and on the twelfth day the Twelfth Crown and the title Keeper of Midwinter.',
      '🎄 Every crypt is dressed for the season: snow on the walls, icicles, holly, and red candles in holly wreaths.',
      '🎶 Sleigh bells in the crypt\'s music while Midwinter lasts.',
      '👀 Each of the Twelve Gifts shows how it looks on your hero before you open it.',
      '✨ The Crypt Keeper now gives every player the Keeper\'s Favour aura after their first run. Played before? It\'s waiting for you on the title screen.',
      '🎨 Most of the emoji left in the menus are now the game\'s own pixel icons: gifts, medals, crowns, coins, flames, ghosts, potions, dice and more, so every screen matches the crypt.',
      '💬 Chat messages older than today now show their date (or "Yesterday") next to the time.',
      '🔒 Saving your progress with an email now works even when the email\'s button opens a different browser: the email has a 6-digit code, and the game has a box to type it in.',
      '📱 Added to an iPhone home screen, the menus now stay clear of the notch and status bar, so the top buttons can be tapped again.',
      '💡 The first time you open the Ossuary, Wardrobe, Hall, Grimoire, leaderboards, the Hollow and other screens, a short tip says what each one is for.',
      '🏛️ Winter cloaks, headwear, auras and Hall pieces are in the Ossuary, this season only. The Midwinter Mantle is yours just for playing a run.',
      '✨ Act III\'s own rewards, never sold: the Rimewalker, the Hearthkeeper and Harold\'s Scarf cloaks, the Crown of Rime, Pip\'s Earmuffs, the Beacon Fire and Long Night auras, and six titles.',
    ],
    go: ['story', 'daily'],
  },
  {
    date: '2026-11-25',
    title: 'A Guide, and Android testers can join again',
    notes: [
      '📚 A new Guide at onemorecrypt.com/guide: how to play, every mode and hero, all 52 relics, every Soul Forge fusion and combo, in one page you can read anywhere. Tap Guide at the bottom of the title screen.',
      '🤖 The link to join the Android app test now opens a page with a Join button. Before, it showed a "no permission" page to anyone not already in the group. If that stopped you, the "testers needed" link on the title screen will get you in now.',
    ],
  },
  {
    date: '2026-11-24',
    title: 'No moving blind',
    notes: [
      '⛏️ When you cross into a new zone and the depth map plays, your hero now waits for it to finish instead of moving unseen underneath. Thanks to the player in the Discord who spotted it.',
    ],
  },
  {
    date: '2026-11-22',
    title: 'Every theme has its own music, and a streak flame',
    notes: [
      '👻 Racing a ghost now picks a recorded run near your own level, a little past your best Endless floor, so the race is close instead of a blowout either way.',
      '💬 On your phone, a new Message button beside Copy result opens your texts with your result and a link ready to send, so you can dare a friend in two taps.',
      '🕯️ Your Daily streak now burns as a little candle in the top-left corner of the title screen. It grows taller and changes colour the longer your streak runs, and glows red while today\'s Daily is still waiting. Tap it to see your Grave Wards and the next streak reward.',
      '🎼 Each theme now plays the crypt\'s music in its own style: a slow drone and a distant bell in Ashen, a music box in Frostbound, a harpsichord and organ in Crimson Court, an oud and frame drums in the Gilded Tomb, bubbles and a whale\'s call in Sunken Ruins, anvils in the Infernal Forge, an eerie flute in Witchwood, a soft choir in the Astral Observatory and synthwave in the Neon Tomb. It still builds as you go deeper.',
      '🔥 The Soul Forge fuses relics in each theme\'s voice too, from shattering ice to an anvil blow to a laser drop. Turn Theme music off in Settings to keep the classic sound with any theme.',
      '🎨 Opening the theme list in Settings no longer switches you back to Classic.',
      '🪦 The lament that plays when you fall is in your theme\'s style too.',
      '✨ When a floor is cleared, the Reroll and Rest buttons now arrive with the relic cards instead of popping in after them.',
      '🔤 A newly fused relic\'s name now appears in your theme\'s lettering from the start, instead of switching over when its card comes up.',
    ],
    go: ['settings'],
  },
  {
    date: '2026-11-21',
    title: 'Five more themes',
    notes: [
      '🎨 Five new themes, each its own crypt: Sunken Ruins (wet stone, kelp and rising bubbles), Infernal Forge (black iron split by seams of lava, with embers), Witchwood (roots, toadstools and fireflies), Astral Observatory (navy marble, brass star charts and twinkling stars) and Neon Tomb (glowing grid lines, tube-lit walls and neon rain).',
      '⚙️ Themes now pick from a dropdown in Settings that shows each one in its own colours and lettering, and the title screen points you to them until you\'ve had a look.',
      '🃏 Relic cards now flip up all together, so with the Ferryman\'s Coin you see all four choices at once.',
    ],
    go: ['settings'],
  },
  {
    date: '2026-11-20',
    title: 'Deaths, light and a deeper descent',
    notes: [
      '💀 Every foe now dies its own way: skeletons collapse into a heap of bones, wraiths and other spirits drift apart upward, bats spiral down, ghouls and the drowned melt into a puddle, imps burst into flame, and brutes, hounds and monks topple over with a thud.',
      '🕯️ Foes and your hero now cast longer shadows away from wall candles and your own light, and walls beside lava glow with its heat.',
      '🧍 Your hero breathes while waiting, their cloak stirs, and the light they carry flickers.',
      '⛏️ Crossing into a new zone now cuts to the depth map: your hero drops down the shaft to the new zone and its name rises underneath.',
      '📷 Copy result and Share image now sit right under your run on the results screen.',
    ],
  },
  {
    date: '2026-11-19',
    title: 'Themes, depths, name styles and a daily world boss',
    notes: [
      '🎨 Reskin the whole game in Settings with one of five new themes, each its own crypt: Ashen (rubble, ash and falling cinders), Verdigris (mossy cobbles, hanging vines and spores), Frostbound (ice walls, icicles and snow), Crimson Court (marble floors, velvet walls and rose petals) and Gilded Tomb (sandstone, carved walls and gold dust).',
      '🕯️ Each theme also brings its own candle flames, lettering, logo, button frames and board border, and the menus get their own drifting particles. Classic is still there if you want it back.',
      '🔔 The Bell Tolls is now a daily world boss: a new boss rises at midnight Central and stays up all day, so you can fight it whenever you play. Every hit lands on one shared health bar, and when it falls everyone who fought it that day earns the next Bell-Breaker reward, even if they join after it has fallen.',
      '⛏️ After a run, see how deep you went: a cross-section of the crypt with your hero where they fell, your best and today\'s deepest run beside it. The crypt now has five named depths: The Shallows, The Deep, The Underdeep, Death\'s Reach and The Bottomless. Tap Share image to post it.',
      '🖋️ Style your name on the leaderboards: 12 inks earned by playing Dailies and reaching each depth, and 9 effects (Drip, Glow, Flame, Frost, Embers, Haunted, Shadow, Starfall and Gilded) earned by streaks, world bosses, depth and winning a Daily. Tap your name at the top of the title screen to pick your ink, effect and title. You start with everything your past runs have earned.',
      '🗺️ The title screen now shows how deep you went: your deepest descent before today\'s Daily, then today\'s run in the Daily card, with Copy result and Share image right under it.',
      '👑 Yesterday\'s Daily champion now stands on the title screen for everyone: their hero in their own cloak, headwear and aura, their name in its style, their title and how deep they went. Tap them to visit their Hall.',
      '💬 Chat now plays a small ping when someone else posts, so you know without opening it. Mute sound in Settings to silence it.',
      '🧹 The More menu is tidier: the day\'s bounties, the Weekly Trial, Seven Nights and the rest now fold away under one Challenges bar, which shows what\'s left at a glance. Crypt Race has its own crossed-swords icon.',
      '👗 The Wardrobe is tidier: headwear, cloaks, auras, companions, trails and finishers each fold into their own dropdown that shows what you\'re wearing, with the pieces you own listed first.',
    ],
    fixes: ['🪦 The results now say you were slain by "an" Ember Imp, not "a".'],
    go: ['settings'],
  },
  {
    date: '2026-11-17',
    title: 'Pixel icons and relics you can see',
    notes: [
      '🎨 The menus and the bar above the crypt now use hand-drawn pixel icons instead of emoji, so they match the rest of the game.',
      '🔥 Foes set ablaze by Ember Brand and the other fire relics now visibly burn: flames lick up from their feet, taller the longer they have left to burn, with embers and smoke.',
      '🛡️ More relics now show when they work: the Plague Mask hangs a green haze round you and puffs it onto foes, Thorned Mail spikes back at whoever hits you, frozen foes shatter into shards, Vampire Fang draws a red stream from the slain, and the Echo Bell and Twin Blade cut a second, violet slash.',
      '🎲 A lucky Bone Dice hit throws a little die off the foe, the Mirror Shield shows a small shield over your head for each block left, and Blood Pact pulses red when it wakes.',
      '💀 Cursed relics now mark you: dark wisps rise off the Cursed Crown, the Blood Moon washes you red, and the Glass Skull leaves hairline cracks.',
    ],
    fixes: ['🕯️ The Vespers Candles aura now shows its green haze and the candles circling behind your hero.', '🚪 In a private window or on a first visit, going back to the title after a run no longer closes the game.'],
  },
  {
    date: '2026-11-16',
    title: 'The story: Act II ends',
    go: ['story'],
    notes: [
      '🔔 Act II of the story now has its ending. Three new quests from Brother Ambrose take you down the Bell Shaft: find who has been ringing the bells, hold the Ringing Chamber while the lost hymn is rung, and face the Plague Abbot in his garden. One choice along the way is yours to make.',
      '⚒️ A new side quest from Pip, Bell Metal, once the Bell Shaft is open: he wants to cast Gravesend a bell that only tells the time.',
      '🎁 New story-only rewards: three cloaks (the Bell-Rope Cloak, the Abbot\'s Cope, the Founder\'s Apron), two auras (Three Notes, The Silent Bell) and four titles.',
      '🧑‍🌾 Villagers are out in the lanes of Gravesend. Walk into one to hear what they think. More of them come out once the bells are quiet.',
      '🕯️ Homes look lived in: rugs, candles on the walls, moonlight through the window and cobwebs in the corners.',
      '🗺️ The quest log has a map showing where you are and where a quest is waiting.',
      '🎬 Each quest opens with a title card, and ends with its rewards laid out.',
      '🚪 Going in and out of buildings in the world is no longer an instant cut: the view closes in on your hero at the door and opens again on the other side. Roads to the next place dip through black.',
      '🎭 Conversations in the story now play out over the scene they happen in, with bigger portraits, each speaker in their own colour, and lines that spell themselves out. Tap once to finish a line, again to move on.',
      '👻 The runs playing behind the menus are calmer: slower, softer in colour and without the white hit flashes, so they are easier on the eyes. With reduced motion turned on they now hold still.',
    ],
  },
  {
    date: '2026-11-15',
    title: 'Live chat, race prizes and a random hero',
    go: ['wardrobe'],
    notes: [
      '🌿 Crypt Race has prizes: racing earns Laurels (3 for a win against players, 1 for finishing a race, 1 for beating a ghost), and Laurels unlock two new kinds of cosmetic found nowhere else.',
      '💨 Trails follow your hero as they walk: Dust Kick, Ember Step, Lightning Stride and Starfall. Finishers change how the foes you slay burst apart: Gold Burst, Bat Swarm, Soul-Fire and Victory Lap. Wear them from the Wardrobe; they show in every mode.',
      '📜 Two race titles to earn: Quickfoot at 10 Laurels and The Unoutrun at 100. The full prize ladder is on the Crypt Race screen.',
      '⚒️ In the Soul Forge, a fused relic\'s name now glides up onto its card along with the relic, instead of fading out and popping back in.',
      '🥇 New prizes for the Daily Descent podium, worn from the Wardrobe and only ever won there: 1st gets Crowning Blow, where every foe you slay leaves a little gold crown. 2nd gets Quicksilver, silver afterimages of your hero. 3rd gets Bronze Bell, a ripple of bronze with every step. Win three Dailies for the Royal Procession: a red carpet under your feet.',
      '👑 Yesterday\'s Daily champion is named on everyone\'s title screen, and heralded as each player enters today\'s crypt.',
      '🎲 Every Crypt Race now deals a random hero, the same for every racer, with every relic in play, so no one\'s own unlocks decide the race. The countdown tells you who you\'re playing.',
      '💬 Live chat: tap 💬 at the top of the title screen, or in the corner of the Crypt Race lobby, the results and the other menus, to talk with everyone in the crypt. On a computer it can stay open while you play. The 💬 button bobs while someone is typing, and the chat shows who. Choose a name and finish a run to post; swearing, links and spam are blocked, and tapping a name mutes that player for you.',
    ],
    fixes: ['⚔️ Joining the open Crypt Race no longer fails with an error.', '🏁 Rival boards in a race no longer cut names short or cover the list of foes.'],
  },
  {
    date: '2026-11-14',
    title: 'Crypt Race: live races against other players',
    go: ['daily'],
    notes: [
      '⚔️ Crypt Race: live races against other players. Tap Crypt Race on the title screen, then Join a race, and you land in the open lobby with whoever else is waiting. The button shows how many are waiting. Ready up when you want to go: the race starts when everyone there is ready, or straight away once four are in. Up to four of you race the same crypt, each watching the others\' runs on small boards. Deepest floor in five minutes wins.',
      '👻 Nobody around? Race a ghost: a real player\'s recorded run, played back beside you. You can also open a private room for a friend. Races are their own runs: not saved, not on the leaderboards, and they pay Souls at the end.',
      '🧹 The results screen is much shorter: your run, what it earned, tomorrow\'s Daily and your streak, and where to go next all fit on one screen. The rest is folded under "More from this run".',
      '🏅 Feats and unlocks from a run are listed on the results instead of popping up over them.',
      '✨ Your hero now has a thin pale rim, so they are easier to pick out on dark stone, and the Harvest leaves on the floor are quieter.',
      '🔤 Tips, sub-headings and the captions under buttons use the easier-to-read lettering.',
      '🎨 Every death now takes the whole screen with it: black and white when Death claims you, blood red for a blade, burning orange in lava, sick green in the plague, a white-out for a blast, a trap snapping shut on spikes, the dark closing round an arrow, and a red throb for a boss.',
      '📺 The title screen shows the game being played: the runs behind it are brighter, and a Live line says which hero you are watching and how deep they are.',
      '👆 The tutorial\'s first ghoul stands closer, and if you wait, your hero takes the first step for you.',
    ],
  },
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
