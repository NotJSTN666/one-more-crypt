// A short tip the first time each screen opens: what it's for, in a line or two. Players who
// finish their first run meet the Ossuary, the Wardrobe, the Hall and the rest all at once;
// this says what each one is the first time they look. Seen once per browser.

const KEY = 'omc:tips-seen';

/** Each screen's tip: an emoji (drawn as a pixel icon) and one or two plain sentences. */
export const SCREEN_TIPS: Record<string, [string, string]> = {
  ossuary: ['💀', 'Every run earns Souls. Spend them here on new heroes, relics for Endless, cosmetics and Hall decor. One piece is on sale only today.'],
  wardrobe: ['🎨', 'Dress each hero in a cloak, headwear and an aura. What you wear shows in your runs, on the leaderboards and on your Hall statues. All of it is cosmetic.'],
  hall: ['🏰', 'Your Crypt Hall keeps your trophies, titles and bestiary. Pick a title to show beside your name, and decorate the Hall with what you earn.'],
  grimoire: ['📖', 'Every relic, combo and fusion you have found. Hold a whole combo in one run to discover it, and fuse relics at the Soul Forge after a boss.'],
  board: ['🏆', "The leaderboards. The top 3 on each day's Daily win exclusive headwear, and each week's Endless board has prizes too."],
  delve: ['⚔️', 'More ways to play beyond the Daily. Endless: your hero and relics, as deep as you dare. Horde: one arena a day, wave after wave. The Night Shift: survive the night while your relics fight for you.'],
  race: ['👻', 'Race other players through the same crypt live, or race the ghost of a recorded run near your level. Racing earns Laurels for trails and finishers.'],
  hollow: ['🗺️', 'The Hollow is the graveyard above the crypt. Walk up to a building to go in: each is a mode or a part of the story. West of here is your isle, which you build up with Souls.'],
  quests: ['📜', 'Your quest log: every story quest, who gave it and where to go next.'],
  raid: ['🔔', "A world boss everyone fights together: every hit lands on one shared health bar. When it's taken down, everyone who fought it that day earns the next Bell-Breaker reward."],
  heroes: ['🛡️', 'Each hero has a perk of their own. The Knight is free; unlock most of the others in the Ossuary with Souls.'],
};

function seen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function markSeen(name: string) {
  try {
    const s = seen();
    if (!s.includes(name)) localStorage.setItem(KEY, JSON.stringify([...s, name]));
  } catch {
    // shown again next time, which is fine
  }
}

/** The screen whose tip is showing this visit, so a redraw (a tab, a purchase) keeps it. */
let showing = '';

/**
 * The tip card for this screen, or null. Shown on the first visit (it stays while the screen is
 * redrawn) until the player closes it or leaves the screen.
 */
export function screenTip(name: string, fresh: boolean): HTMLElement | null {
  const tip = SCREEN_TIPS[name];
  if (!tip) {
    showing = '';
    return null;
  }
  if (fresh) showing = seen().includes(name) ? '' : name;
  if (showing !== name) return null;
  markSeen(name);
  const card = document.createElement('aside');
  // Only the first drawing fades in: a screen that redraws itself every second (a race lobby
  // waiting for players) would otherwise flash its tip each time.
  card.className = fresh ? 'screen-tip enter' : 'screen-tip';
  card.setAttribute('role', 'note');
  card.innerHTML = `<span class="screen-tip-icon" aria-hidden="true">${tip[0]}</span><p>${tip[1]}</p><button type="button" class="screen-tip-x" aria-label="Got it">✕</button>`;
  card.querySelector('button')!.addEventListener('click', () => {
    showing = '';
    card.remove();
  });
  return card;
}
