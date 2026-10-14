// A short guided first run on hand-made floors: move, strike, dodge, clear the floor,
// claim a relic. It plays on the real rules but never touches saves or progress.

import type { Game, GameEvent } from './game';

export interface TutorialStep {
  title: string;
  coach: string;
  scene: Parameters<Game['stage']>[0];
  done: (g: Game, events: GameEvent[]) => boolean;
}

export const TUTORIAL: TutorialStep[] = [
  {
    title: 'Move',
    coach: 'Walk to the <b>potion</b>. Use the <b>arrow keys</b> or <b>WASD</b>. On a phone, <b>swipe</b> or <b>tap a tile</b>.',
    scene: {
      player: { x: 3, y: 6 },
      potion: { x: 3, y: 2 },
      enemies: [],
      walls: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 0, y: 4 }, { x: 6, y: 4 }],
      hp: 10,
    },
    done: (g) => g.potion === null,
  },
  {
    title: 'Strike',
    coach: 'A ghoul! <b>Walk into it to strike.</b> Every move you make, it makes one too.',
    scene: {
      player: { x: 3, y: 5 },
      enemies: [{ kind: 'ghoul', x: 3, y: 1, hp: 3 }],
      walls: [{ x: 1, y: 2 }, { x: 5, y: 2 }, { x: 1, y: 4 }, { x: 5, y: 4 }],
      hp: 10,
    },
    done: (_g, events) => events.some((e) => e.t === 'kill'),
  },
  {
    title: 'Dodge',
    coach: 'Archers aim first: <b>red tiles</b> show where the arrow will fly. <b>Step out of the line</b>, then hunt it down.',
    scene: {
      player: { x: 0, y: 3 },
      enemies: [{ kind: 'archer', x: 6, y: 3, hp: 2 }],
      walls: [{ x: 3, y: 1 }, { x: 3, y: 5 }, { x: 2, y: 2 }, { x: 4, y: 4 }],
      hp: 10,
    },
    done: (_g, events) => events.some((e) => e.t === 'kill'),
  },
  {
    title: 'Descend',
    coach: '<b>Slay every foe</b> to unseal the stairs at the top, then <b>step on them</b> to go deeper.',
    scene: {
      player: { x: 3, y: 6 },
      enemies: [
        { kind: 'ghoul', x: 1, y: 3, hp: 1 },
        { kind: 'ghoul', x: 5, y: 3, hp: 1 },
      ],
      walls: [{ x: 2, y: 1 }, { x: 4, y: 1 }],
      stairs: { x: 3, y: 0 },
      hp: 10,
    },
    done: (g) => g.phase === 'choose',
  },
];

export const RELIC_COACH = 'After every floor, <b>claim a relic</b>. They stack and combo, and your hero changes as you build. Pick one!';
