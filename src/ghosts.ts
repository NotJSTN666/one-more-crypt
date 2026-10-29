// Faded gameplay filling the whole page background: a grid of ghost boards, each with
// a ghost hero playing the crypt on its own. Purely decoration: they never touch
// saves, Souls or achievements.

import { HEROES } from './content';
import { Game, fullPool } from './game';
import { RELICS } from './relics';
import { Renderer } from './render';

const TARGET_BOARD = 640; // rough board size in CSS px; boards are stretched to tile exactly
const STEP_MS = 340;

interface Ghost {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  game: Game;
  deadTicks: number;
}

const ghosts: Ghost[] = [];
let container: HTMLElement | null = null;
let frameSkip = false;

/** The deep zones a ghost can be seen fighting through. */
const DEEP_LOOKS = ['flooded', 'ossuary', 'burning', 'abyss'] as const;

/** Each new ghost takes the next mode in turn, so neighbouring boards differ. */
let nextKind = Math.floor(Math.random() * 4);

/** A ghost run in one of the game's modes, so the background shows what there is to play. */
function newGhostGame(): Game {
  const hero = HEROES[Math.floor(Math.random() * HEROES.length)].id;
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const pool = fullPool();
  const kind = nextKind++ % 4;
  let g: Game;
  if (kind === 0) {
    // Horde: holding one arena against wave after wave.
    g = new Game('horde', seed, 1, { hero, pool, mercy: true, boons: true, surge: true, waves: true, magnet: true, armory: true, arsenal: true });
  } else if (kind === 1) {
    // Act II: the Sunken Cloister, plague mist and monks.
    const start = 5 + Math.floor(Math.random() * 4);
    g = new Game('story', seed, 0, { hero, pool, mercy: true, story: { start, end: start + 6, gifts: 2, look: 'cloister', mist: 3, monks: true } });
  } else if (kind === 2) {
    // Deep in Endless: the flooded catacombs, the charnel halls, the burning depths, the abyss.
    const zone = Math.floor(Math.random() * DEEP_LOOKS.length);
    const start = 22 + zone * 20 + Math.floor(Math.random() * 10);
    g = new Game('story', seed, 0, { hero, pool, mercy: true, story: { start, end: start + 8, gifts: 4, look: DEEP_LOOKS[zone] } });
  } else {
    // Endless with today's rules.
    g = new Game('endless', seed, 0, { hero, pool, forge: true, mercy: true, depths: true, boons: true, reaper: true, deep: true, lurk: true });
  }
  // A few relics so the hero looks the part, and extra health so it reaches bosses.
  for (let i = 0; i < 3; i++) g.addRelic(RELICS[Math.floor(Math.random() * RELICS.length)].id);
  g.player.maxHp = g.player.hp = 30;
  return g;
}

function reset(ghost: Ghost) {
  ghost.game = newGhostGame();
  ghost.deadTicks = 0;
  ghost.renderer.setGame(ghost.game);
  ghost.renderer.consume(ghost.game.events.splice(0));
}

/** Greedy ghost player: strike if adjacent, else walk toward a foe (or the open stairs). */
function move(g: Game) {
  const p = g.player;
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (const [x, y] of dirs) if (g.enemyAt(p.x + x, p.y + y) && g.act(x, y)) return;
  const goals = g.stairsOpen ? [g.stairs] : g.alive.map((e) => ({ x: e.x, y: e.y }));
  let best: number[] | null = null;
  let bestD = Infinity;
  for (const goal of goals) {
    const dist = g.distanceMap(goal, false);
    for (const [x, y] of dirs) {
      const nx = p.x + x;
      const ny = p.y + y;
      if (!g.inBounds(nx, ny) || g.isWall(nx, ny)) continue;
      const d = dist[ny * 7 + nx];
      if (d >= 0 && d < bestD) {
        bestD = d;
        best = [x, y];
      }
    }
  }
  if (!(best && g.act(best[0], best[1]))) g.act(0, 0);
}

function step(ghost: Ghost) {
  const g = ghost.game;
  if (g.phase === 'dead' || g.phase === 'won') {
    // Linger on the death for a moment, then a new hero descends.
    if (++ghost.deadTicks > 6) reset(ghost);
    return;
  }
  if (g.phase === 'choose') {
    const n = (g.offer?.relics.length ?? 0) + (g.offer?.boons.length ?? 0);
    g.choose(n ? Math.floor(Math.random() * n) : -1);
  }
  else if (g.phase === 'event') g.resolveEvent(Math.random() < 0.6);
  else move(g);
  ghost.renderer.consume(g.events.splice(0));
}

/** Tile the viewport with boards: about 640px each on desktop, full-width stacks on phones. */
function layout() {
  if (!container) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // A tab opened or restored in the background can report no size yet; lay out once it's shown.
  if (!vw || !vh) return;
  const cols = Math.max(1, Math.round(vw / TARGET_BOARD));
  const size = Math.ceil(vw / cols);
  const rows = Math.max(1, Math.ceil(vh / size));
  const needed = cols * rows;
  while (ghosts.length < needed) {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const ghost: Ghost = { canvas, renderer: new Renderer(canvas, true), game: newGhostGame(), deadTicks: 0 };
    reset(ghost);
    ghosts.push(ghost);
    // Stagger the ghosts so they don't all move in lockstep.
    window.setTimeout(() => window.setInterval(() => ghost.canvas.isConnected && step(ghost), stepMs), Math.random() * stepMs);
  }
  while (ghosts.length > needed) ghosts.pop()!.canvas.remove();
  ghosts.forEach((ghost, i) => {
    ghost.renderer.resize(size);
    // Stretch to the exact cell so the boards tile edge to edge.
    Object.assign(ghost.canvas.style, {
      width: `${size}px`,
      height: `${size}px`,
      left: `${(i % cols) * size}px`,
      top: `${Math.floor(i / cols) * size}px`,
    });
  });
}

/** Slower ghosts for players who ask their system for less motion. */
let stepMs = STEP_MS;

export function startGhosts() {
  container = document.getElementById('ghosts');
  if (!container) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) stepMs = STEP_MS * 4;
  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('pageshow', layout);
  document.addEventListener('visibilitychange', () => !document.hidden && layout());
}

/** Draw the ghosts at half the frame rate; called from the main animation loop. */
export function drawGhosts(dt: number) {
  frameSkip = !frameSkip;
  if (frameSkip) return;
  for (const ghost of ghosts) ghost.renderer.frame(dt * 2);
}
