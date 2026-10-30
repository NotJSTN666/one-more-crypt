// "How to play" with living examples: tiny scenes run on the real game rules and
// renderer, each looping a few scripted moves so new players can see each rule.
// Below them, picture cards for the modes, the deeper crypt, every hero and every foe.

import { ENEMY_INFO, Game, REAPER_FLOOR, fullPool, type EnemyKind } from './game';
import { HEROES, type EliteMod } from './content';
import { heroPortrait } from './hero';
import { RELIC_BY_ID, type RelicId } from './relics';
import { Renderer } from './render';
import { enemyFrames, sprites } from './sprites';

type Input = 'U' | 'D' | 'L' | 'R' | 'W';
const DIRS: Record<Input, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
/** What each scripted move looks like on the keycap in the demo's corner. */
const KEYCAP: Record<Input, string> = { U: '↑', D: '↓', L: '←', R: '→', W: 'WAIT' };
const STEP_MS = 520;

interface DemoDef {
  rows: [number, number]; // first and last board row to show
  scene: Parameters<Game['stage']>[0];
  script: Input[];
  /** Death stands on the board, already risen (the demo is set at his depth). */
  death?: { x: number; y: number };
}

const DEMOS: Record<string, DemoDef> = {
  move: {
    rows: [1, 4],
    scene: { player: { x: 1, y: 4 }, enemies: [{ kind: 'ghoul', x: 5, y: 1, hp: 9 }], walls: [{ x: 3, y: 2 }, { x: 3, y: 3 }] },
    script: ['U', 'U', 'R', 'W', 'W'],
  },
  strike: {
    rows: [2, 4],
    scene: { player: { x: 1, y: 3 }, enemies: [{ kind: 'ghoul', x: 5, y: 3, hp: 2 }], walls: [{ x: 0, y: 2 }, { x: 6, y: 4 }] },
    script: ['R', 'R', 'R', 'R', 'R', 'W', 'W'],
  },
  stairs: {
    rows: [0, 4],
    scene: {
      player: { x: 3, y: 4 },
      enemies: [{ kind: 'ghoul', x: 3, y: 2, hp: 1 }],
      walls: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 0, y: 3 }, { x: 6, y: 3 }],
      stairs: { x: 3, y: 0 },
    },
    script: ['W', 'U', 'U', 'U', 'U', 'U'],
  },
  dodge: {
    rows: [1, 3],
    scene: { player: { x: 1, y: 2 }, enemies: [{ kind: 'archer', x: 6, y: 2 }], walls: [{ x: 3, y: 1 }, { x: 3, y: 3 }] },
    script: ['W', 'W', 'D', 'W', 'W'],
  },
  bosses: {
    rows: [1, 5],
    scene: {
      player: { x: 3, y: 5 },
      enemies: [
        { kind: 'boss', x: 3, y: 2 },
        { kind: 'ghoul', x: 1, y: 4, elite: 'vampiric' as EliteMod },
        { kind: 'bat', x: 5, y: 3, elite: 'swift' as EliteMod },
      ],
      walls: [{ x: 0, y: 1 }, { x: 6, y: 1 }],
    },
    script: [],
  },
  deal: {
    rows: [2, 4],
    scene: { player: { x: 1, y: 3 }, enemies: [], walls: [{ x: 0, y: 2 }, { x: 6, y: 4 }], stairs: { x: 6, y: 0 }, feature: { x: 4, y: 3, kind: 'chest' } },
    script: ['W', 'R', 'R', 'R'],
  },
  death: {
    rows: [0, 4],
    scene: { player: { x: 2, y: 4 }, enemies: [], walls: [{ x: 4, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 3 }, { x: 0, y: 2 }], stairs: { x: 2, y: 0 } },
    death: { x: 6, y: 3 },
    script: ['U', 'U', 'U', 'U'],
  },
};

interface Running {
  def: DemoDef;
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  key: HTMLElement;
  renderer: Renderer;
  game: Game;
  step: number;
  wait: number;
}

let running: Running[] = [];
let raf = 0;
let last = 0;

function keycaps(keys: string[]): string {
  return keys.map((k) => `<kbd>${k}</kbd>`).join('');
}

function relicStrip(): string {
  const stages: RelicId[][] = [[], ['whetstone'], ['whetstone', 'ember', 'crown'], ['whetstone', 'ember', 'crown', 'mirror', 'storm']];
  return stages
    .map((log, i) => {
      const relics: Partial<Record<RelicId, number>> = {};
      for (const id of log) relics[id] = (relics[id] ?? 0) + 1;
      const added = i === 0 ? '' : log.slice(stages[i - 1].length).map((id) => RELIC_BY_ID[id].emoji).join('');
      return `${i ? `<span class="evo-arrow">${added}<br>➜</span>` : ''}<img src="${heroPortrait('knight', relics, log, 5)}" alt="" width="48" height="48" style="--i:${i}" />`;
    })
    .join('');
}

/** Three face-down choices with one lifted: what picking a relic looks like. */
function relicPick(): string {
  const three: RelicId[] = ['ember', 'mirror', 'storm'];
  return `<div class="pick3">${three
    .map((id, i) => `<div class="pick3-card${i === 1 ? ' chosen' : ''}"><span>${RELIC_BY_ID[id].emoji}</span><b>${RELIC_BY_ID[id].name}</b></div>`)
    .join('')}</div>`;
}

/** A sprite canvas blown up into a crisp image. */
const spriteCache = new Map<string, string>();
function spriteUrl(key: string, img: CanvasImageSource & { width: number; height: number }, scale = 4): string {
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.width * scale;
  c.height = img.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL();
  spriteCache.set(key, url);
  return url;
}
const foeImg = (kind: EnemyKind) => `<img class="px" src="${spriteUrl(kind, enemyFrames(kind).idle[0].normal)}" alt="" width="40" height="40" />`;
const deathImg = () => `<img class="px" src="${spriteUrl('reaper', sprites().reaper.normal)}" alt="" width="40" height="40" />`;

/** A picture card: a sprite or icon, a name, and a line about it. */
function card(pic: string, name: string, text: string, extra = ''): string {
  return `<div class="hcard"${extra}><div class="hcard-pic">${pic}</div><div><b>${name}</b><span>${text}</span></div></div>`;
}
const icon = (e: string) => `<span class="hcard-icon">${e}</span>`;

const FOES: [EnemyKind, string][] = [
  ['ghoul', 'Shambles toward you.'],
  ['bat', 'Erratic flier.'],
  ['archer', 'Aims, then fires down a line. Red tiles mean danger.'],
  ['brute', 'Slow, hits for 3. Strike while it rests.'],
  ['wraith', 'Drifts through walls.'],
  ['thrall', 'Yours: the Necromancer raises them. Walk into one to swap places.'],
];
const BOSSES: [EnemyKind, string][] = [
  ['boss', 'Floor 5, then every 15. Summons ghouls.'],
  ['abbot', 'Floor 10, then every 15. Rains plague, calls bats.'],
  ['lich', 'Floor 15, then every 15. Teleports, fires bolts.'],
];
const ZONES: [EnemyKind, string, string, string][] = [
  ['drowned', 'Flooded Catacombs', '#5fa8ff', 'Foes wading through water lose every other turn. The Drowned heal in it.'],
  ['boneknight', 'Charnel Halls', '#e8dcc4', 'Bone piles block the way: bump one to smash it, some hide a potion. Bone Knights shrug off the first blow.'],
  ['imp', 'Burning Depths', '#ff8a2a', 'Lava burns anything that walks in, so lure foes into it. Imps leave lava where they die.'],
  ['voideye', 'The Abyss', '#b07cff', "It's dark: you only see what's near you. Void Eyes aim, then fire down a line."],
];

/** The How to play body. Call startHowTo() once it is in the page. */
export function howToHtml(links: { discord: string; kofi: string }): string {
  const demo = (id: string, title: string, text: string, extra = '') => `
    <section class="howto">
      <div class="demo" data-demo="${id}"><canvas></canvas><span class="demo-key" aria-hidden="true"></span></div>
      ${extra}
      <h3>${title}</h3>
      <p>${text}</p>
    </section>`;
  const head = (text: string) => `<h3 class="howto-head">${text}</h3>`;
  const mode = (cls: string, emoji: string, name: string, line: string, more: string) => `
    <details class="mode-tile ${cls}">
      <summary><span class="mode-ic">${emoji}</span><span><b>${name}</b><span>${line}</span></span></summary>
      <p>${more}</p>
    </details>`;
  const heroes = HEROES.filter((h) => !h.story)
    .map((h) => card(`<img class="px" src="${heroPortrait(h.id, {}, [], 4)}" alt="" width="40" height="40" />`, `${h.name} <i class="hp">♥ ${h.hp}</i>`, `<em>${h.perk}.</em> ${h.perkDesc}`))
    .join('');
  return `
    ${head('The basics')}
    <section class="howto">
      <div class="controls">
        <div>${keycaps(['↑', '←', '↓', '→'])}<span>or</span>${keycaps(['W', 'A', 'S', 'D'])}</div>
        <div>${keycaps(['Space'])}<span>wait a turn</span></div>
        <div class="touch">📱 <span>Swipe or tap a tile · tap your hero to wait</span></div>
      </div>
    </section>
    ${demo('move', '1 · Move', 'Every step you take, every foe takes one too. Think before you move. Waiting a turn lets foes come to you.')}
    ${demo('strike', '2 · Bump to strike', 'Walk into a foe to attack it. Numbers show the damage dealt.')}
    ${demo('stairs', '3 · Clear the floor', 'Slay every foe to unseal the stairs, then step on them to go deeper.')}
    <section class="howto">
      ${relicPick()}
      <div class="evolution">${relicStrip()}</div>
      <h3>4 · Claim relics</h3>
      <p>After each floor, pick 1 of 3 relics. They stack and combo, and your hero changes as you build.</p>
    </section>
    ${demo('dodge', '5 · Red tiles mean danger', 'Archers and bosses aim first. Step off the glowing tiles before they fire.')}
    ${demo('bosses', '6 · Elites and bosses', 'Glowing foes are elites with a trick (the tip under the map says which), worth extra Souls. Every 5th floor a boss waits.')}
    ${demo('deal', '7 · Strike a deal', 'Chests, shrines and fountains offer a deal: a relic for a little blood, a rare relic for max HP, or a full heal. Step on one to choose.')}

    ${head('Four ways to play')}
    <div class="modes">
      ${mode('m-daily', '📅', 'Daily Descent', 'Same crypt, same hero, everyone, once a day.', 'Share your depth. Finish in the <b>top 3</b> for exclusive headwear and Souls, and keep a <b>streak</b> going for streak helms.')}
      ${mode('m-endless', '♾️', 'Endless', 'Your hero and relics, as deep as you dare.', 'The top 3 on each week\'s Endless board win prizes. Deep down, Death comes for you.')}
      ${mode('m-horde', '🛡️', 'Horde', 'One arena a day. Hold back the waves.', 'Waves pour in from the edges, faster when you clear them quickly. Kill on turn after turn to build a score multiplier (up to ×5). Every kill fills the surge bar; when it\'s full, pick a relic, a boon, or fuse two relics. A boss comes every 5th wave, and Death joins at wave 25. Play as often as you like: your best score of the day goes on the board.')}
      ${mode('m-story', '📜', 'Story', 'Help Mortimer find who rings the bell beneath.', 'Start it from the title screen, or knock on his door in the Hollow. Quests take you into crypts with their own bosses, friends and rewards.')}
    </div>

    ${head('Deeper down')}
    <div class="hcards">
      ${card(icon('🔥'), 'Soul Forge', 'Waits on the floor after each boss. Fuse two of your relics into a stronger one.')}
      ${card(icon('🧱'), 'Cracked walls', 'Bump one twice to find a secret vault: a rare relic and a heal.')}
      ${card(icon('▦'), 'Spikes', 'Hurt anything that steps on them, foes included.')}
      ${card(icon('🟣'), 'Abyss boons', 'Once every relic is yours, offers hold boons instead: attack, shields, lives and more.')}
    </div>
    <p class="howto-sub">Every 20 floors the crypt becomes somewhere new:</p>
    <div class="hcards">
      ${ZONES.map(([k, name, color, text]) => card(foeImg(k), name, text, ` style="--zone:${color}"`)).join('')}
    </div>
    ${demo('death', `8 · From floor ${REAPER_FLOOR}, Death`, 'He waits in a far corner with a countdown, then rises and walks straight at you, through walls. Nothing stops his touch. Clear the floor and take the stairs first.')}

    ${head('Heroes')}
    <div class="hcards">${heroes}</div>

    ${head('Foes')}
    <div class="hcards">${FOES.map(([k, t]) => card(foeImg(k), ENEMY_INFO[k].name, t)).join('')}</div>
    <div class="hcards bosses">${BOSSES.map(([k, t]) => card(foeImg(k), ENEMY_INFO[k].name.replace(/^The /, ''), t)).join('')}${card(deathImg(), 'Death', `From floor ${REAPER_FLOOR}, and wave 25 of the Horde. Run.`)}</div>

    ${head('Between runs')}
    <div class="hcards">
      ${card(icon('💀'), 'Souls &amp; the Ossuary', 'Every run earns Souls. Spend them on new heroes, relics and cosmetics.')}
      ${card(icon('🎯'), 'Daily bounties', 'Goals in any mode that pay Souls.')}
      ${card(icon('🪦'), 'The Hollow', 'Walk the graveyard: every building is a way in, and the old graves hold stories.')}
      ${card(icon('🏝️'), 'Your isle', 'West of the graveyard. Build it up with Souls; some buildings help in Endless and the story.')}
      ${card(icon('🏛️'), 'Crypt Hall', 'Your trophies, statues and titles.')}
      ${card(icon('👘'), 'Wardrobe', 'Dress your heroes. Outfits show in runs and on the leaderboards.')}
    </div>
    <p class="howto-foot">Share runs, report bugs and suggest ideas in the <a href="${links.discord}" target="_blank" rel="noopener">Discord</a> 💬 · Free, with no ads: <a href="${links.kofi}" target="_blank" rel="noopener">tip on Ko-fi</a> ☕</p>
  `;
}

function reset(r: Running) {
  const death = r.def.death;
  r.game = new Game('endless', 1, 0, { hero: 'knight', pool: fullPool(), ...(death ? { reaper: true } : {}) });
  r.game.stage(r.def.scene);
  if (death) {
    (r.game as unknown as { floor: number }).floor = REAPER_FLOOR;
    r.game.reaper = { x: death.x, y: death.y, frozen: 0 };
  }
  r.renderer.setGame(r.game);
  r.step = 0;
  r.wait = STEP_MS * 1.6;
  r.key.classList.remove('on');
}

function layout(r: Running) {
  const size = r.wrap.clientWidth;
  r.renderer.resize(size);
  const w = parseFloat(r.canvas.style.width) || size;
  const [a, b] = r.def.rows;
  r.wrap.style.width = `${w}px`;
  r.wrap.style.height = `${(w * (b - a + 1)) / 7}px`;
  r.canvas.style.top = `${(-w * a) / 7}px`;
}

/** Flash the key for this move in the demo's corner, so it's clear what was pressed. */
function showKey(r: Running, input: Input) {
  r.key.textContent = KEYCAP[input];
  r.key.classList.remove('on');
  void r.key.offsetWidth;
  r.key.classList.add('on');
}

function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  running = running.filter((r) => r.canvas.isConnected);
  if (!running.length) {
    raf = 0;
    return;
  }
  for (const r of running) {
    r.wait -= dt * 1000;
    if (r.def.script.length && r.wait <= 0) {
      if (r.step >= r.def.script.length || r.game.phase !== 'play') reset(r);
      else {
        const input = r.def.script[r.step++];
        const [dx, dy] = DIRS[input];
        showKey(r, input);
        r.game.act(dx, dy);
        r.renderer.consume(r.game.events.splice(0));
        r.wait = r.step >= r.def.script.length || r.game.phase !== 'play' ? STEP_MS * 2.5 : STEP_MS;
      }
    }
    r.renderer.frame(dt);
  }
  raf = requestAnimationFrame(tick);
}

/** Start the demo scenes inside the given container. They stop when removed from the page. */
export function startHowTo(root: ParentNode) {
  running = [];
  root.querySelectorAll<HTMLElement>('.demo').forEach((wrap) => {
    const def = DEMOS[wrap.dataset.demo ?? ''];
    const canvas = wrap.querySelector('canvas')!;
    const key = wrap.querySelector<HTMLElement>('.demo-key')!;
    if (!def) return;
    const r: Running = { def, wrap, canvas, key, renderer: new Renderer(canvas), game: null as unknown as Game, step: 0, wait: 0 };
    reset(r);
    layout(r);
    running.push(r);
  });
  if (!raf && running.length) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}
