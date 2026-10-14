// Faded gameplay in the empty space beside the game on wide screens: two ghost
// heroes play the crypt on their own, purely as decoration. They never touch saves,
// Souls or achievements.

import { HEROES } from './content';
import { Game, fullPool } from './game';
import { RELICS } from './relics';
import { Renderer } from './render';

const COLUMN = 520; // width kept clear for the real game
const MIN_SIZE = 180;
const STEP_MS = 340;

interface Ghost {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  game: Game;
  deadTicks: number;
}

const ghosts: Ghost[] = [];

function newGhostGame(): Game {
  const hero = HEROES[Math.floor(Math.random() * HEROES.length)].id;
  const g = new Game('endless', (Math.random() * 2 ** 32) >>> 0, 0, { hero, pool: fullPool() });
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
  if (g.phase === 'dead') {
    // Linger on the death for a moment, then a new hero descends.
    if (++ghost.deadTicks > 6) reset(ghost);
    return;
  }
  if (g.phase === 'choose') g.choose(g.offer?.relics.length ? Math.floor(Math.random() * g.offer.relics.length) : -1);
  else if (g.phase === 'event') g.resolveEvent(Math.random() < 0.6);
  else move(g);
  ghost.renderer.consume(g.events.splice(0));
}

/** Size and place each ghost board in the space beside the central column. */
function layout() {
  const side = (window.innerWidth - COLUMN) / 2;
  const size = Math.min(side - 48, window.innerHeight - 96);
  for (const ghost of ghosts) {
    if (size < MIN_SIZE) {
      ghost.canvas.hidden = true;
      continue;
    }
    ghost.canvas.hidden = false;
    ghost.renderer.resize(size);
  }
}

export function startGhosts() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const id of ['ghost-left', 'ghost-right']) {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas) continue;
    const ghost: Ghost = { canvas, renderer: new Renderer(canvas), game: newGhostGame(), deadTicks: 0 };
    ghosts.push(ghost);
    reset(ghost);
  }
  layout();
  window.addEventListener('resize', layout);
  // Offset the two so they don't move in lockstep.
  ghosts.forEach((ghost, i) => window.setTimeout(() => window.setInterval(() => step(ghost), STEP_MS), i * STEP_MS * 0.5));
}

/** Draw the ghosts; called from the main animation loop. */
export function drawGhosts(dt: number) {
  for (const ghost of ghosts) if (!ghost.canvas.hidden) ghost.renderer.frame(dt);
}
