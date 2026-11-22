// Themes: a whole new look for the game, chosen in Settings. A theme recolours the
// menus and screens (the CSS colours in style.css) and dresses them in its own frames,
// fonts and drifting particles (themes.css, theme-fx.ts); it rebuilds the crypt's floors
// and walls in its own materials (theme-art.ts), with its own candle flames and weather.
// Heroes, foes and relics keep their own colours so they read the same in every theme.

import { ornamentVars, setFx } from './theme-fx';

/** How the music follows the theme (handed in by main.ts, so this module needs no audio of its own). */
let setMusicStyle: (id: string) => void = () => undefined;
let setForgeStyle: (id: string) => void = () => undefined;
export function onThemeMusic(set: (id: string) => void, forge?: (id: string) => void) {
  setMusicStyle = set;
  if (forge) setForgeStyle = forge;
}

export type ThemeId = 'classic' | 'ashen' | 'verdigris' | 'frost' | 'crimson' | 'gilded' | 'sunken' | 'infernal' | 'witchwood' | 'astral' | 'neon';

export interface Theme {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Colours for the picker's swatch: background, panel, accent, text. */
  swatch: [string, string, string, string];
  /** CSS colours set on the page (see :root in style.css). */
  vars: Record<string, string>;
  /** How the board is graded: a hue laid over the floors and walls, how strongly, and the torchlight's colour. */
  board?: { tint: string; mix: number; glow: string };
  /** The candles' flames: body, tip, sparks, and the light they throw ('r, g, b'). */
  flame?: { flame: string; tip: string; spark: string; glow: string };
  /** What drifts through the crypt (unless the depth or the season brings its own). */
  weather?: ThemeWeather;
  /** The heading font, loaded from Google Fonts when the theme is first put on. */
  font?: { family: string; css: string };
}

export type ThemeWeather = 'ash' | 'spores' | 'snow' | 'petals' | 'dust' | 'bubbles' | 'embers' | 'fireflies' | 'starlight' | 'neonrain';

export const THEMES: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'The crypt as it was built: violet dark and candle gold',
    swatch: ['#07040b', '#140d1c', '#f2c14e', '#e8dcc4'],
    vars: {},
  },
  {
    id: 'ashen',
    name: 'Ashen',
    blurb: 'Bone, ash and cold stone, with the colour bled out',
    swatch: ['#09090a', '#17171a', '#d9d2bf', '#e6e2da'],
    vars: {
      '--bg': '#09090a', '--panel': '#17171a', '--panel-2': '#212125', '--line': '#3f3f46',
      '--text': '#e6e2da', '--muted': '#99969e', '--gold': '#d9d2bf', '--bg-glow': '#1b1b1f',
      '--primary': '#8f8a84', '--primary-dark': '#3f3c39', '--primary-edge': '#d9d2bf', '--primary-base': '#141313', '--primary-ink': '#eee8dd',
    },
    board: { tint: '#8c8a86', mix: 0.85, glow: '#e8e4da' },
    flame: { flame: '#d8d2c2', tip: '#ffffff', spark: '#bdb7ad', glow: '220, 215, 205' },
    weather: 'ash',
    font: { family: "'Jacquarda Bastarda 9'", css: 'Jacquarda+Bastarda+9' },
  },
  {
    id: 'verdigris',
    name: 'Verdigris',
    blurb: 'A drowned tomb gone green with moss and old copper',
    swatch: ['#040a07', '#0d1a12', '#8fe36b', '#d8ead0'],
    vars: {
      '--bg': '#040a07', '--panel': '#0d1a12', '--panel-2': '#142519', '--line': '#2a4733',
      '--text': '#d8ead0', '--muted': '#8aa492', '--gold': '#8fe36b', '--spectral': '#8ff2d2', '--bg-glow': '#0f2416',
      '--primary': '#3f9a52', '--primary-dark': '#17421f', '--primary-edge': '#8fe36b', '--primary-base': '#06170b', '--primary-ink': '#dcf7cf',
    },
    board: { tint: '#3f8a52', mix: 0.55, glow: '#b4ff8a' },
    flame: { flame: '#5fe39a', tip: '#e6ffd0', spark: '#9cf5d6', glow: '110, 230, 150' },
    weather: 'spores',
    font: { family: "'Uncial Antiqua'", css: 'Uncial+Antiqua' },
  },
  {
    id: 'frost',
    name: 'Frostbound',
    blurb: 'Rime on every stone and a blue light that never warms',
    swatch: ['#03070d', '#0c1522', '#9fd8ff', '#e2eef8'],
    vars: {
      '--bg': '#03070d', '--panel': '#0c1522', '--panel-2': '#132032', '--line': '#2a4562',
      '--text': '#e2eef8', '--muted': '#8ea3ba', '--gold': '#9fd8ff', '--spectral': '#c8f2ff', '--bg-glow': '#0f2036',
      '--primary': '#3d7fbf', '--primary-dark': '#173556', '--primary-edge': '#9fd8ff', '--primary-base': '#06121f', '--primary-ink': '#d8efff',
    },
    board: { tint: '#5c8fc2', mix: 0.6, glow: '#bfe6ff' },
    flame: { flame: '#5fb8ff', tip: '#e6f6ff', spark: '#bfe6ff', glow: '120, 190, 255' },
    weather: 'snow',
    font: { family: "'Grenze Gotisch'", css: 'Grenze+Gotisch:wght@500' },
  },
  {
    id: 'crimson',
    name: 'Crimson Court',
    blurb: 'Blood-red velvet for a vampire lord\'s halls',
    swatch: ['#0b0204', '#1c090d', '#ff7466', '#f2dad5'],
    vars: {
      '--bg': '#0b0204', '--panel': '#1c090d', '--panel-2': '#290f15', '--line': '#521d28',
      '--text': '#f2dad5', '--muted': '#ad8e92', '--gold': '#ff7466', '--bg-glow': '#2c0a12',
    },
    board: { tint: '#a3283a', mix: 0.55, glow: '#ff8a7a' },
    flame: { flame: '#ff4d5a', tip: '#ffd0d0', spark: '#ff8a8a', glow: '255, 80, 90' },
    weather: 'petals',
    font: { family: "'UnifrakturMaguntia'", css: 'UnifrakturMaguntia' },
  },
  {
    id: 'gilded',
    name: 'Gilded Tomb',
    blurb: 'Sandstone and gold leaf from a buried king\'s tomb',
    swatch: ['#0c0803', '#1f160a', '#ffd36a', '#f6e8c6'],
    vars: {
      '--bg': '#0c0803', '--panel': '#1f160a', '--panel-2': '#2b1f0e', '--line': '#5c4421',
      '--text': '#f6e8c6', '--muted': '#b3a07d', '--gold': '#ffd36a', '--bg-glow': '#2a1b08',
      '--primary': '#c08a28', '--primary-dark': '#5a3a0c', '--primary-edge': '#ffd36a', '--primary-base': '#1f1404', '--primary-ink': '#fff0c8',
    },
    board: { tint: '#b8863a', mix: 0.6, glow: '#ffd88a' },
    flame: { flame: '#ffb02a', tip: '#fff6c8', spark: '#ffd36a', glow: '255, 190, 80' },
    weather: 'dust',
    font: { family: "'Cinzel Decorative'", css: 'Cinzel+Decorative:wght@700' },
  },
  {
    id: 'sunken',
    name: 'Sunken Ruins',
    blurb: 'A drowned temple: wet stone, kelp and rising bubbles',
    swatch: ['#020b0e', '#0a1c22', '#5fe0d0', '#d6f2ee'],
    vars: {
      '--bg': '#020b0e', '--panel': '#0a1c22', '--panel-2': '#10272f', '--line': '#1f4a52',
      '--text': '#d6f2ee', '--muted': '#86aaa8', '--gold': '#5fe0d0', '--spectral': '#9ff5ea', '--bg-glow': '#0a2a30',
      '--primary': '#1f8a8a', '--primary-dark': '#0c3a40', '--primary-edge': '#5fe0d0', '--primary-base': '#031215', '--primary-ink': '#d8fbf6',
    },
    board: { tint: '#2a8a90', mix: 0.6, glow: '#9ff5ea' },
    flame: { flame: '#5fe0d0', tip: '#e8fffb', spark: '#9ff5ea', glow: '110, 230, 215' },
    weather: 'bubbles',
    font: { family: "'Metamorphous'", css: 'Metamorphous' },
  },
  {
    id: 'infernal',
    name: 'Infernal Forge',
    blurb: 'Black iron and obsidian, split by seams of lava',
    swatch: ['#0a0303', '#1a0907', '#ff6a1a', '#f7ddc8'],
    vars: {
      '--bg': '#0a0303', '--panel': '#1a0907', '--panel-2': '#26100b', '--line': '#5a2414',
      '--text': '#f7ddc8', '--muted': '#b0907e', '--gold': '#ff8a2a', '--bg-glow': '#2e0c05',
      '--primary': '#d2501a', '--primary-dark': '#5a1806', '--primary-edge': '#ffb04a', '--primary-base': '#1a0502', '--primary-ink': '#fff0d8',
    },
    board: { tint: '#b8401a', mix: 0.55, glow: '#ff9a4a' },
    flame: { flame: '#ff6a1a', tip: '#fff2a0', spark: '#ffb04a', glow: '255, 120, 40' },
    weather: 'embers',
    font: { family: "'New Rocker'", css: 'New+Rocker' },
  },
  {
    id: 'witchwood',
    name: 'Witchwood',
    blurb: 'A crypt grown through by a haunted wood, lit by fireflies',
    swatch: ['#07050c', '#151022', '#c79bff', '#e6dcf2'],
    vars: {
      '--bg': '#07050c', '--panel': '#151022', '--panel-2': '#1e1630', '--line': '#3c2c58',
      '--text': '#e6dcf2', '--muted': '#9a8cb0', '--gold': '#d8ff7a', '--spectral': '#c79bff', '--bg-glow': '#1c1230',
      '--primary': '#6a3fb0', '--primary-dark': '#2a1650', '--primary-edge': '#c79bff', '--primary-base': '#0d0618', '--primary-ink': '#efe2ff',
    },
    board: { tint: '#5a3a8a', mix: 0.5, glow: '#d8ff9a' },
    flame: { flame: '#d8ff7a', tip: '#ffffff', spark: '#e8ffb0', glow: '210, 255, 140' },
    weather: 'fireflies',
    font: { family: "'Mystery Quest'", css: 'Mystery+Quest' },
  },
  {
    id: 'astral',
    name: 'Astral Observatory',
    blurb: 'Navy marble and brass star charts under a turning sky',
    swatch: ['#03040c', '#0c1028', '#e6c27a', '#e6e8f6'],
    vars: {
      '--bg': '#03040c', '--panel': '#0c1028', '--panel-2': '#131838', '--line': '#2c3466',
      '--text': '#e6e8f6', '--muted': '#9298c0', '--gold': '#e6c27a', '--spectral': '#b8c8ff', '--bg-glow': '#141a40',
      '--primary': '#3a4aa8', '--primary-dark': '#161c50', '--primary-edge': '#e6c27a', '--primary-base': '#05071a', '--primary-ink': '#eef0ff',
    },
    board: { tint: '#3a4a9a', mix: 0.6, glow: '#c8d4ff' },
    flame: { flame: '#b8c8ff', tip: '#ffffff', spark: '#e6c27a', glow: '170, 190, 255' },
    weather: 'starlight',
    font: { family: "'Marcellus SC'", css: 'Marcellus+SC' },
  },
  {
    id: 'neon',
    name: 'Neon Tomb',
    blurb: 'Glowing grid lines and tube-lit walls in the rain',
    swatch: ['#05020c', '#120828', '#ff3ad8', '#e8f6ff'],
    vars: {
      '--bg': '#05020c', '--panel': '#120828', '--panel-2': '#1a0c38', '--line': '#4a1e7a',
      '--text': '#e8f6ff', '--muted': '#9a8ac8', '--gold': '#3af0ff', '--spectral': '#ff3ad8', '--bg-glow': '#1e0a40',
      '--primary': '#c21ab0', '--primary-dark': '#4a0a5a', '--primary-edge': '#ff6ae8', '--primary-base': '#14021c', '--primary-ink': '#ffe8fb',
    },
    board: { tint: '#6a2ab8', mix: 0.55, glow: '#ff7ae8' },
    flame: { flame: '#3af0ff', tip: '#ffffff', spark: '#ff3ad8', glow: '90, 230, 255' },
    weather: 'neonrain',
    font: { family: "'Monoton'", css: 'Monoton' },
  },
];

const KEY = 'omc-theme';
let current: Theme = THEMES[0];

/** The theme in use. */
export function theme(): Theme {
  return current;
}

/** The theme saved on this device (Classic when none is). */
export function savedTheme(): ThemeId {
  try {
    const id = localStorage.getItem(KEY);
    if (THEMES.some((t) => t.id === id)) return id as ThemeId;
  } catch {
    /* no storage: Classic */
  }
  return 'classic';
}

/** Put a theme on: the page's colours now, the boards the next time they draw their ground. */
export function applyTheme(id: ThemeId, keep = true) {
  // (nothing to put on: keep the theme worn rather than falling back to Classic)
  if (!THEMES.some((t) => t.id === id)) return;
  current = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  for (const t of THEMES) for (const name of Object.keys(t.vars)) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(current.vars)) root.style.setProperty(name, value);
  root.style.removeProperty('--gothic');
  if (current.font) {
    loadFont(current.font.css);
    root.style.setProperty('--gothic', `${current.font.family}, 'Pirata One', Georgia, serif`);
  }
  for (const [name, value] of Object.entries(ornamentVars(current.id))) root.style.setProperty(name, value);
  setFx(current.weather ?? null);
  setMusicStyle(themeMusicOn() ? current.id : 'classic');
  setForgeStyle(themeMusicOn() ? current.id : 'classic');
  if (current.id === 'classic') delete root.dataset.theme;
  else root.dataset.theme = current.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', current.vars['--bg'] ?? '#07040b');
  if (keep) {
    try {
      localStorage.setItem(KEY, current.id);
    } catch {
      /* this visit only */
    }
  }
}

const MUSIC_KEY = 'omc:theme-music';
/** Whether the theme also changes the crypt's music (off until turned on in Settings, while it's being tried out). */
export function themeMusicOn(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) === '1';
  } catch {
    return false;
  }
}
export function setThemeMusic(on: boolean) {
  try {
    localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
  } catch {
    /* this visit only */
  }
  setMusicStyle(on ? current.id : 'classic');
  setForgeStyle(on ? current.id : 'classic');
}

const loaded = new Set<string>();
/** Fetch a heading font the first time its theme is put on. */
function loadFont(css: string) {
  if (loaded.has(css)) return;
  loaded.add(css);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${css}&display=swap`;
  document.head.appendChild(link);
}

/** Fetch every theme's heading font (for the picker, where each card is lettered in its own). */
export function loadThemeFonts() {
  for (const t of THEMES) if (t.font) loadFont(t.font.css);
}

/** The colour the board is cleared to. */
export function boardBack(): string {
  return current.vars['--bg'] ?? '#07040b';
}

/** Grade a board's cached ground (floors, walls and what lies on them) to the theme. */
export function gradeGround(c: HTMLCanvasElement) {
  const b = current.board;
  if (!b) return;
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Take the theme's hue but keep each pixel's brightness, so every stone and crack still shows.
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = b.mix;
  ctx.fillStyle = b.tint;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.restore();
}

/** The torchlight's colour under the theme: the same strength, the theme's warmth. */
export function themedLight(rgba: string): string {
  const b = current.board;
  if (!b) return rgba;
  const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(rgba);
  if (!m) return rgba;
  const g = [1, 3, 5].map((i) => parseInt(b.glow.slice(i, i + 2), 16));
  const mix = (i: number) => Math.round(Number(m[i + 1]) + (g[i] - Number(m[i + 1])) * 0.7);
  return `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, ${m[4] ?? 1})`;
}

/** The dark at the torchlight's edge under the theme: the same depth, in the theme's own black. */
export function themedDark(rgba: string): string {
  if (!current.board) return rgba;
  const m = /rgba?\(\s*\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/.exec(rgba);
  if (!m) return rgba;
  const bg = boardBack();
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${m[1] ?? 1})`;
}
