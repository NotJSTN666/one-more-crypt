// "How to play" with living examples: tiny scenes run on the real game rules and
// renderer, each looping a few scripted moves so new players can see each rule.

import { Game, fullPool } from './game';
import type { EliteMod } from './content';
import { heroPortrait } from './hero';
import { RELIC_BY_ID, type RelicId } from './relics';
import { Renderer } from './render';

type Input = 'U' | 'D' | 'L' | 'R' | 'W';
const DIRS: Record<Input, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
const STEP_MS = 520;

interface DemoDef {
  rows: [number, number]; // first and last board row to show
  scene: Parameters<Game['stage']>[0];
  script: Input[];
}

const DEMOS: Record<string, DemoDef> = {
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
};

interface Running {
  def: DemoDef;
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
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

/** The How to play body. Call startHowTo() once it is in the page. */
export function howToHtml(): string {
  const demo = (id: string, title: string, text: string) => `
    <section class="howto">
      <div class="demo" data-demo="${id}"><canvas></canvas></div>
      <h3>${title}</h3>
      <p>${text}</p>
    </section>`;
  return `
    <section class="howto">
      <div class="controls">
        <div>${keycaps(['↑', '←', '↓', '→'])}<span>or</span>${keycaps(['W', 'A', 'S', 'D'])}</div>
        <div>${keycaps(['Space'])}<span>wait a turn</span></div>
        <div class="touch">📱 <span>Swipe or tap a tile · tap your hero to wait</span></div>
      </div>
      <h3>1 · Move</h3>
      <p>Every step you take, every foe takes one too. Think before you move. Waiting a turn lets foes come to you.</p>
    </section>
    ${demo('strike', '2 · Bump to strike', 'Walk into a foe to attack it. Numbers show the damage dealt.')}
    ${demo('stairs', '3 · Clear the floor', 'Slay every foe to unseal the stairs, then step on them to go deeper.')}
    <section class="howto">
      <div class="evolution">${relicStrip()}</div>
      <h3>4 · Claim relics</h3>
      <p>After each floor, pick 1 of 3 relics. They stack and combo, and your hero changes as you build.</p>
    </section>
    ${demo('dodge', '5 · Red tiles mean danger', 'Archers and bosses aim first. Step off the glowing tiles before they fire.')}
    ${demo('bosses', '6 · Elites and bosses', 'Glowing foes are elites with a trick. Every 5th floor a boss waits.')}
  `;
}

function reset(r: Running) {
  r.game = new Game('endless', 1, 0, { hero: 'knight', pool: fullPool() });
  r.game.stage(r.def.scene);
  r.renderer.setGame(r.game);
  r.step = 0;
  r.wait = STEP_MS * 1.6;
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
        const [dx, dy] = DIRS[r.def.script[r.step++]];
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
    if (!def) return;
    const r: Running = { def, wrap, canvas, renderer: new Renderer(canvas), game: null as unknown as Game, step: 0, wait: 0 };
    reset(r);
    layout(r);
    running.push(r);
  });
  if (!raf && running.length) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

