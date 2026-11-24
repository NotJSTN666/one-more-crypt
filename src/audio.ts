// Tiny synthesized sound effects, so there are no audio files to download.

import { zoneAt } from './zones';

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
  applyMusicVolume();
}

export function isMuted() {
  return muted;
}

/** Must be called from a user gesture before sounds can play on mobile. */
/** Whether sound is actually playing (browsers hold it until the player interacts). */
export function audioRunning(): boolean {
  return ctx?.state === 'running';
}

const stateListeners: (() => void)[] = [];

/** Called whenever the browser starts or pauses the game's sound. */
export function onAudioState(cb: () => void) {
  stateListeners.push(cb);
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ctx.addEventListener('statechange', () => stateListeners.forEach((cb) => cb()));
  }
  if (ctx.state === 'suspended') void ctx.resume();
  startMusic();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function noise(dur: number, vol: number, filterFreq: number) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
}

/** Filtered noise, after a delay, its filter sweeping from one frequency to another. */
function noiseAt(delay: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur);
}

/** A tone with a slow wobble in pitch (for wails and roars). */
function wobble(freq: number, dur: number, type: OscillatorType, vol: number, slideTo: number, rate: number, depth: number, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lg = ctx.createGain();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  lfo.frequency.value = rate;
  lg.gain.value = depth;
  lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.15, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  lfo.start(t0);
  o.stop(t0 + dur);
  lfo.stop(t0 + dur);
}

/** Each hero's ultimate has its own sound. */
export function ultSound(hero: string) {
  switch (hero) {
    case 'rogue': {
      // a flurry of blades: swish after swish, then a sharp ring of steel
      for (let k = 0; k < 7; k++) noiseAt(k * 0.065, 0.1, 0.6, 'bandpass', 5200 - k * 300, 1400, 2);
      tone(2400, 0.35, 'sawtooth', 0.05, 3600, 0.5);
      tone(3600, 0.5, 'sine', 0.12, 3400, 0.5);
      noiseAt(0.5, 0.25, 0.3, 'highpass', 6000);
      break;
    }
    case 'necro': {
      // the earth stirs: a low drone, rattling bones, and a wail rising out of the grave
      tone(55, 1.6, 'sawtooth', 0.1, 50);
      tone(58, 1.6, 'sawtooth', 0.08, 52);
      noiseAt(0, 1.2, 0.18, 'lowpass', 180, 1600);
      for (let k = 0; k < 8; k++) noiseAt(0.25 + k * 0.09 + Math.random() * 0.04, 0.03, 0.2, 'bandpass', 2600 + Math.random() * 1200, 2600, 6);
      wobble(330, 1.4, 'sine', 0.11, 520, 6, 14, 0.2);
      wobble(247, 1.3, 'triangle', 0.04, 392, 5, 10, 0.3);
      break;
    }
    case 'paladin': {
      // light from above: a bright chime, a rising major arpeggio, and a soft wash
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.9 - i * 0.05, 'sine', 0.1, undefined, i * 0.06));
      tone(2093, 1.4, 'sine', 0.05, undefined, 0.35);
      tone(1568, 1.4, 'triangle', 0.04, undefined, 0.35);
      tone(262, 1.4, 'triangle', 0.06, undefined, 0.1);
      noiseAt(0.05, 1.2, 0.08, 'highpass', 4000, 9000);
      break;
    }
    case 'ranger': {
      // a bowstring, then arrows whistling down and thudding in all round
      tone(196, 0.2, 'triangle', 0.25, 120);
      noiseAt(0, 0.1, 0.4, 'bandpass', 900, 500, 3);
      for (let k = 0; k < 14; k++) {
        const d = 0.15 + k * 0.07 + Math.random() * 0.05;
        noiseAt(d, 0.16, 0.4, 'bandpass', 4200 + Math.random() * 1500, 1800, 3);
        noiseAt(d + 0.14, 0.06, 0.45, 'lowpass', 500, 200);
      }
      break;
    }
    case 'mage': {
      // a meteor falling (it lands about 0.6s in), then a blast and a rumble
      tone(1800, 0.6, 'sine', 0.06, 260);
      noiseAt(0, 0.6, 0.1, 'bandpass', 3000, 500, 2);
      noiseAt(0.58, 1.4, 0.45, 'lowpass', 1400, 120);
      tone(70, 1.2, 'sine', 0.3, 28, 0.58);
      tone(140, 0.4, 'square', 0.06, 50, 0.58);
      noiseAt(0.62, 0.25, 0.2, 'highpass', 3000, 6000);
      break;
    }
    case 'barbarian': {
      // a war roar over pounding drums
      [0, 0.18, 0.36, 0.5].forEach((d) => {
        tone(110, 0.25, 'sine', 0.22, 45, d);
        noiseAt(d, 0.12, 0.18, 'lowpass', 600, 200);
      });
      wobble(150, 1, 'sawtooth', 0.07, 105, 18, 9, 0.05);
      wobble(152, 1, 'sawtooth', 0.06, 102, 21, 11, 0.05);
      wobble(75, 1, 'square', 0.05, 55, 16, 4, 0.05);
      noiseAt(0.05, 0.9, 0.08, 'bandpass', 900, 500, 1.5);
      break;
    }
    case 'bellringer': {
      // one great bell, ringing out long
      tone(65, 3.2, 'sine', 0.22);
      tone(130, 2.6, 'sine', 0.1);
      tone(65 * 2.76, 2, 'sine', 0.07);
      tone(65 * 5.4, 1.3, 'sine', 0.04);
      tone(65 * 8.93, 0.8, 'sine', 0.025);
      noiseAt(0, 0.08, 0.25, 'bandpass', 1800, 1200, 2);
      break;
    }
    default: {
      // the Knight's Last Stand: a shield's clang, a deep boom, and a short rising call
      [220, 331, 662, 993].forEach((f, i) => tone(f, 0.5 - i * 0.08, 'square', 0.05 - i * 0.008));
      noiseAt(0, 0.12, 0.3, 'highpass', 3000, 5000);
      tone(90, 0.9, 'sine', 0.28, 38);
      [196, 247, 294, 392].forEach((f, i) => tone(f, 0.8, 'triangle', 0.06, undefined, 0.22 + i * 0.07));
      break;
    }
  }
}

export const sfx = {
  step: () => tone(90, 0.05, 'triangle', 0.08),
  hit: () => {
    noise(0.08, 0.25, 2200);
    tone(180, 0.08, 'square', 0.06, 90);
  },
  crit: () => {
    noise(0.12, 0.35, 4000);
    tone(520, 0.15, 'square', 0.08, 120);
  },
  kill: () => {
    noise(0.15, 0.2, 900);
    tone(300, 0.2, 'sawtooth', 0.06, 60);
  },
  hurt: () => {
    tone(160, 0.25, 'square', 0.12, 50);
    noise(0.1, 0.2, 600);
  },
  heal: () => {
    tone(523, 0.1, 'triangle', 0.08);
    tone(784, 0.15, 'triangle', 0.08, undefined, 0.08);
  },
  zap: () => {
    noise(0.1, 0.15, 6000);
    tone(1200, 0.1, 'sawtooth', 0.04, 300);
  },
  shot: () => noise(0.06, 0.12, 3000),
  stairs: () => {
    [392, 494, 587, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, undefined, i * 0.07));
  },
  relic: () => {
    [262, 330, 392, 523].forEach((f, i) => tone(f, 0.3, 'sine', 0.08, undefined, i * 0.05));
  },
  block: () => tone(880, 0.12, 'square', 0.06, 1200),
  /** A new chat message: a small, soft two-note ping. */
  ping: () => {
    tone(1320, 0.09, 'sine', 0.05);
    tone(1760, 0.14, 'sine', 0.045, undefined, 0.07);
  },
  /** The Soul Forge at work (see fusionSound for the full three-second piece). */
  fuse: () => fusionSound(false),
  death: () => {
    tone(220, 1.2, 'sawtooth', 0.1, 40);
    noise(0.6, 0.2, 400);
  },
  bump: () => tone(70, 0.06, 'square', 0.05),
  toll: () => {
    tone(98, 1.6, 'sine', 0.16);
    tone(196, 1.2, 'triangle', 0.06);
    tone(293, 0.9, 'sine', 0.04);
  },
  timestop: () => tone(1400, 0.5, 'sine', 0.06, 180),
  /** A dash: a quick rush of air. */
  dash: () => {
    noise(0.16, 0.12, 2600);
    tone(380, 0.16, 'sine', 0.05, 1100);
  },
  /** A boss falls: a deep crash and a falling groan, then a bright rising peal. */
  bossDown: () => {
    noise(0.9, 0.35, 700);
    tone(110, 1.1, 'sawtooth', 0.13, 30);
    tone(55, 1.4, 'sine', 0.2, 30);
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, 'triangle', 0.075, undefined, 0.35 + i * 0.08));
    tone(1568, 1.2, 'sine', 0.04, undefined, 0.75);
  },
};

// ---------- music ----------
// Synthwave score that gets heavier the deeper you go. Menus get a hazy pad and a
// soft arpeggio; in the crypt a kick and pulsing bass come in, then snare and hats
// (floor 10), a lead arpeggio (floor 20) and full double-time drums in the Abyss
// (floor 30+). Boss floors play one level hotter on a darker progression. Every
// sound is synthesized live; nothing to download.

export type Mood = 'crypt' | 'boss' | 'fallen' | 'silent' | 'night' | 'nightboss';

// D minor i - VI - iv - V, and Phrygian dread i - bII - i - vii° for bosses (MIDI notes).
const CHORDS: Record<'crypt' | 'boss' | 'fallen', number[][]> = {
  crypt: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
  boss: [[50, 53, 57], [51, 55, 58], [50, 53, 57], [49, 52, 56]],
  // The death screen: a slow lament, i - iv - VI - V.
  fallen: [[50, 53, 57], [43, 46, 50], [46, 50, 53], [45, 49, 52]],
};
const FALLEN_TEMPO = 96;
// The Night Shift has its own score: a fast E minor chase written as a song, so it doesn't loop
// one bar forever. Eight-bar sections come round in turn: a verse with a galloping bass and the
// main melody, a pre-chorus that climbs, the verse again an octave up, a half-time breakdown that
// builds back with a snare roll and a riser, and a big chorus. While a boss is up it switches to a
// darker section of its own, a chromatic riff over i - bII. The night's heat sets the tempo
// (140 to 172 BPM) and how much of the kit plays.
const NIGHT_TEMPO = [140, 148, 156, 164, 172];
type Section = 'verse' | 'climb' | 'verse2' | 'break' | 'chorus' | 'boss';
const SONG: Section[] = ['verse', 'climb', 'verse2', 'break', 'chorus'];
// Each section's chords, a bar each (MIDI triads; E minor, with B major for the pull home).
const Em = [52, 55, 59], C = [48, 52, 55], D = [50, 54, 57], B = [47, 51, 54], Am = [45, 48, 52], G = [43, 47, 50], F = [41, 45, 48], Ddim = [50, 53, 56];
const SECTION_CHORDS: Record<Section, number[][]> = {
  verse: [Em, Em, C, D, Em, Em, C, B],
  climb: [Am, Am, Em, Em, C, D, B, B],
  verse2: [Em, Em, C, D, Em, Em, C, B],
  break: [Em, Em, C, C, Am, Am, B, B],
  chorus: [Em, C, G, D, Em, C, B, B],
  boss: [Em, F, Em, Ddim, Em, F, B, B],
};
// Melodies, two bars at a time: [step in the two bars, MIDI note, length in steps].
type Phrase = [number, number, number][];
const VERSE_A: Phrase = [[0, 76, 3], [3, 74, 1], [4, 71, 2], [6, 74, 2], [8, 76, 4], [12, 79, 2], [14, 78, 2], [16, 76, 3], [19, 74, 1], [20, 72, 4], [24, 71, 4], [28, 74, 2], [30, 71, 2]];
const VERSE_B: Phrase = [[0, 72, 3], [3, 71, 1], [4, 72, 2], [6, 74, 2], [8, 76, 6], [14, 74, 2], [16, 71, 4], [20, 74, 2], [22, 72, 2], [24, 71, 6], [30, 66, 2]];
const VERSE_END: Phrase = [[0, 72, 3], [3, 71, 1], [4, 72, 2], [6, 74, 2], [8, 76, 6], [14, 78, 2], [16, 75, 4], [20, 78, 2], [22, 81, 2], [24, 83, 8]];
const CLIMB_A: Phrase = [[0, 81, 2], [2, 79, 2], [4, 76, 4], [8, 79, 2], [10, 81, 2], [12, 83, 4], [16, 79, 4], [20, 76, 2], [22, 74, 2], [24, 76, 8]];
const CLIMB_B: Phrase = [[0, 79, 2], [2, 76, 2], [4, 72, 4], [8, 74, 2], [10, 76, 2], [12, 78, 4], [16, 75, 6], [22, 78, 2], [24, 83, 4], [28, 86, 4]];
const CHORUS_A: Phrase = [[0, 83, 6], [6, 81, 2], [8, 79, 4], [12, 76, 4], [16, 79, 6], [22, 78, 2], [24, 74, 8]];
const CHORUS_B: Phrase = [[0, 76, 6], [6, 79, 2], [8, 83, 4], [12, 81, 4], [16, 78, 8], [24, 75, 4], [28, 78, 4]];
// The boss riff: low and chromatic, round the root and the flat second.
const BOSS_RIFF: Phrase = [[0, 64, 2], [2, 64, 1], [3, 65, 1], [4, 64, 2], [6, 67, 2], [8, 65, 2], [10, 64, 2], [12, 63, 4], [16, 64, 2], [18, 64, 1], [19, 65, 1], [20, 64, 2], [22, 70, 2], [24, 69, 2], [26, 67, 2], [28, 65, 2], [30, 63, 2]];
const SECTION_MELODY: Record<Section, Phrase[]> = {
  verse: [VERSE_A, VERSE_B, VERSE_A, VERSE_END],
  climb: [CLIMB_A, CLIMB_B, CLIMB_A, CLIMB_B],
  verse2: [VERSE_A, VERSE_B, VERSE_A, VERSE_END],
  break: [],
  chorus: [CHORUS_A, CHORUS_B, CHORUS_A, CHORUS_B],
  boss: [BOSS_RIFF, BOSS_RIFF, BOSS_RIFF, BOSS_RIFF],
};
let nightHeat = 0;
const ARP = [0, 1, 2, 1, 2, 0, 2, 1];
const TEMPO = [112, 120, 126, 133, 140]; // BPM per intensity level
const MUSIC_VOLUME = 0.32;

let musicEnabled = true;
let mood: Mood = 'crypt';
let depth = 0; // floor number; 0 means menus
let zoneKey = 0; // semitones for the current depth zone
let key = 0; // the key actually playing, changes on bar lines
let level = 0; // intensity actually playing, changes on bar lines
let bus: { out: GainNode; wet: GainNode; dry: GainNode; bass: AudioNode } | null = null;
let noiseBuf: AudioBuffer | null = null;
let timer = 0;
let nextTime = 0;
let stepIndex = 0;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export function isMusicEnabled() {
  return musicEnabled;
}

export function setMusicEnabled(on: boolean) {
  musicEnabled = on;
  applyMusicVolume();
}

/** Switch the score. Called on new floors, boss floors and death. */
export function setMusicMood(next: Mood) {
  if (next === mood) return;
  const prev = mood;
  mood = next;
  // The lament starts cleanly on a downbeat instead of waiting for the bar line.
  if (next === 'fallen') {
    level = 0;
    stepIndex = 0;
  }
  // A new night starts its song from the first bar (a boss rising doesn't).
  if (next === 'night' && prev !== 'nightboss') stepIndex = 0;
  applyMusicVolume();
}

/** Tell the music how deep the hero is (0 for menus) so it can build up, and shift key in each depth zone. */
export function setMusicDepth(floor: number, key = floor > 0 ? zoneAt(floor).def.key : 0) {
  depth = floor;
  zoneKey = key;
}

/** How hot the Night Shift is (0-4): the music builds with it. */
export function setNightHeat(heat: number) {
  nightHeat = Math.max(0, Math.min(4, Math.floor(heat)));
}

const isNight = () => mood === 'night' || mood === 'nightboss';

function targetLevel(): number {
  if (isNight()) return Math.min(4, nightHeat + (mood === 'nightboss' ? 1 : 0));
  if (depth <= 0 || mood === 'fallen') return 0;
  const base = depth >= 30 ? 4 : depth >= 20 ? 3 : depth >= 10 ? 2 : 1;
  return Math.min(4, base + (mood === 'boss' ? 1 : 0));
}

function audible(): boolean {
  return musicEnabled && !muted && mood !== 'silent';
}

function applyMusicVolume() {
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  bus.out.gain.cancelScheduledValues(t);
  bus.out.gain.setValueAtTime(bus.out.gain.value, t);
  bus.out.gain.linearRampToValueAtTime(audible() ? MUSIC_VOLUME : 0, t + (audible() ? 1.5 : 1.2));
}

function makeBus() {
  const c = ctx!;
  const out = c.createGain();
  out.gain.value = 0;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  // Short hazy room for the pad and lead.
  const reverb = c.createConvolver();
  const len = Math.floor(c.sampleRate * 2.2);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  reverb.buffer = ir;
  const wet = c.createGain();
  wet.gain.value = 0.35;
  const dry = c.createGain();
  dry.gain.value = 1;
  wet.connect(reverb).connect(comp);
  dry.connect(comp);
  comp.connect(out).connect(c.destination);
  // Gritty bass: resonant lowpass into soft clipping.
  const bassFilter = c.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.value = 900;
  bassFilter.Q.value = 4;
  const shaper = c.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) curve[i] = Math.tanh((i / 512 - 1) * 4);
  shaper.curve = curve;
  const bassGain = c.createGain();
  bassGain.gain.value = 0.2;
  bassFilter.connect(shaper).connect(bassGain).connect(dry);
  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  bus = { out, wet, dry, bass: bassFilter };
}

/** Start the music scheduler (needs the audio context, so call after a user gesture). */
export function startMusic() {
  if (!ctx || timer) return;
  makeBus();
  nextTime = ctx.currentTime + 0.1;
  timer = window.setInterval(schedule, 50);
  applyMusicVolume();
}

function schedule() {
  if (!ctx || !bus || ctx.state !== 'running') return;
  // Don't pile up notes after the tab was throttled.
  if (nextTime < ctx.currentTime - 0.5) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.2) {
    if (stepIndex % 16 === 0) {
      const next = targetLevel();
      if (next > level && stepIndex > 0 && mood !== 'silent') crash(nextTime);
      level = next;
    }
    if (mood !== 'silent') playStep(stepIndex, nextTime);
    nextTime += 60 / tempo() / 4;
    stepIndex++;
  }
}

function tempo(): number {
  return mood === 'fallen' ? FALLEN_TEMPO * Math.min(1, style.tempo ?? 1) : isNight() ? NIGHT_TEMPO[level] : TEMPO[level] * (style.tempo ?? 1);
}

function playStep(i: number, t: number) {
  if (isNight()) return nightStep(i, t);
  const s = i % 16;
  const bar = Math.floor(i / 16);
  const chords = mood === 'boss' ? CHORDS.boss : mood === 'fallen' ? CHORDS.fallen : style.chords ?? CHORDS.crypt;
  if (s === 0) key = mood === 'fallen' ? 0 : zoneKey;
  const chord = chords[bar % chords.length].map((n) => n + key);
  const s16 = 60 / tempo() / 4;
  const L = level;
  // (the lament keeps its own chords and pace, played on the theme's instruments)
  const sy = style;
  if (s === 0 && bus && sy.wet !== undefined && Math.abs(bus.wet.gain.value - sy.wet) > 0.01) bus.wet.gain.setTargetAtTime(sy.wet, t, 0.5);

  if (s === 0) padBy(sy.pad, chord, t, s16 * 16, L === 0 ? 0.045 : 0.035);
  // Bass: long notes in the menus, driving eighths and sixteenths in the crypt.
  if (L === 0) {
    if (s === 0) bassBy(sy.bass, midi(chord[0] - 12), t, s16 * 14, 0.5);
  } else if (L === 1) {
    if (s % 2 === 0) bassBy(sy.bass, midi(chord[0] - 12), t, s16 * 1.8, 0.9);
  } else {
    bassBy(sy.bass, midi(chord[0] - (s % 4 === 2 ? 0 : 12)), t, s16 * 0.95, 0.9);
  }
  // Arpeggio: soft in the menus, the lead from floor 20, an octave up in the Abyss.
  const arp = sy.arpPattern ?? ARP;
  const arpNote = midi(chord[arp[s % arp.length] % chord.length] + (L === 4 ? 24 : 12) + (sy.arpUp ?? 0));
  if (L === 0 && s % 2 === 0) leadBy(sy.lead, arpNote, t, s16 * 1.8, 0.018, s);
  if (L >= 3) leadBy(sy.lead, arpNote, t, s16 * 0.9, 0.03, s);
  // Drums.
  if (L >= 1 && s % 4 === 0) kickBy(sy.kick, t, 0.9);
  if (L >= 2) {
    hatBy(sy.hat, t, s % 2 ? (L === 4 ? 0.07 : 0.04) : 0.09, s);
    if (s === 4 || s === 12) snareBy(sy.snare, t, L === 4 ? 0.45 : 0.38);
    if (s === 14) kickBy(sy.kick, t, 0.6);
  }
  // The theme's own touch: a bell, bubbles, an anvil, a music box...
  sy.extra?.({ bar, s, t, chord, L, s16, boss: mood === 'boss' });
  // Midwinter: sleigh bells shaking on the beat, and now and then a high bell, like a sleigh far off.
  if (midwinterBells && mood !== 'fallen' && mood !== 'boss') {
    if (L === 0 ? s === 0 || s === 8 : s % 4 === 0) jingle(t, L === 0 ? 0.07 : 0.09, s);
    if (L >= 2 && s % 4 === 2) jingle(t, 0.05, s);
    if (s === 0 && bar % 2 === 0) bell(midi(chord[2] + 24), t, 0.03);
  }
  if (L === 4) {
    if (s % 4 === 2) kick(t, 0.5);
    if (s >= 12) tom(t, [130, 110, 95, 80][s - 12], 0.4);
  } else if (L >= 2 && bar % 2 === 1 && s >= 12) {
    tom(t, [130, 110, 95, 80][s - 12], 0.4);
  }
}

/** Midwinter's sleigh bells, over the crypt's music while the season lasts. */
let midwinterBells = false;
export function setMidwinterBells(on: boolean) {
  midwinterBells = on;
}

/** A shake of sleigh bells: a few bright little bursts, one after another. */
function jingle(t: number, vol: number, s: number) {
  for (let k = 0; k < 4; k++) burst(t + k * 0.014, 0.07, 'bandpass', 6500 + ((k * 1300 + s * 170) % 3200), vol * (1 - k * 0.18), 3, k % 2 ? -0.35 : 0.35);
}

/** A step of the Night Shift's score. */
function nightStep(i: number, t: number) {
  const s = i % 16;
  const bar = Math.floor(i / 16);
  const boss = mood === 'nightboss';
  const sec: Section = boss ? 'boss' : SONG[Math.floor(bar / 8) % SONG.length];
  const b8 = bar % 8;
  const chord = SECTION_CHORDS[sec][b8];
  const s16 = 60 / tempo() / 4;
  const L = level;
  const lastBar = b8 === 7;
  const half = sec === 'break' && b8 < 6;

  // A crash to open every section, and on every fourth bar once it's hot.
  if (s === 0 && (b8 === 0 || (b8 === 4 && (L >= 2 || sec === 'chorus' || boss)))) crash(t);
  // Pads: a wash under everything, thicker in the breakdown and the chorus.
  if (s === 0) pad(chord, t, s16 * 16, sec === 'break' ? 0.05 : sec === 'chorus' || boss ? 0.04 : 0.026);

  // ---- bass ----
  const root = chord[0] - 12;
  if (sec === 'break' && b8 < 6) {
    if (s === 0) bassNote(midi(root), t, s16 * 15, 0.8);
  } else if (sec === 'verse' || sec === 'verse2' || boss) {
    // the gallop: da-da-dum
    if ([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].includes(s)) bassNote(midi(root + (s === 8 && !boss ? 12 : 0)), t, s16 * 0.9, s % 4 === 0 ? 1 : 0.7);
  } else if (sec === 'climb') {
    // syncopated, with the fifth
    if ([0, 3, 6, 8, 10, 11, 14].includes(s)) bassNote(midi(root + (s === 6 || s === 14 ? 7 : 0)), t, s16 * 1.6, 0.9);
  } else {
    // the chorus drives in octaves
    bassNote(midi(root + (s % 2 ? 12 : 0)), t, s16 * 0.9, s % 4 === 0 ? 1 : 0.75);
  }

  // ---- drums ----
  if (half) {
    // the breakdown: half time, room to breathe
    if (s === 0) kick(t, 0.9);
    if (s === 8) snare(t, 0.4);
    if (s % 4 === 2) hat(t, 0.04, s);
  } else if (sec === 'break') {
    // ...and the last two bars build: a snare roll that thickens, and a rising wash
    if (s % 4 === 0) kick(t, 0.8);
    const roll = b8 === 6 ? s % 2 === 0 : true;
    if (roll) snare(t, 0.12 + 0.3 * ((b8 - 6) * 16 + s) / 32);
    if (b8 === 6 && s === 0) riser(t, s16 * 32);
  } else {
    if (s % 4 === 0) kick(t, 0.95);
    if (sec === 'climb' && (s === 7 || s === 10)) kick(t, 0.55);
    if ((sec === 'chorus' || boss || L >= 3) && (s === 6 || s === 14)) kick(t, 0.45);
    if (L >= 4 && s % 2 === 1 && s % 4 !== 3) kick(t, 0.3);
    if (s === 4 || s === 12) snare(t, 0.42);
    if ((L >= 2 || sec === 'chorus') && s === 15 && bar % 2 === 1) snare(t, 0.18);
    // hats: eighths, then sixteenths, with an open hat on the off-beat in the chorus
    if (s % 2 === 0 || L >= 2 || sec === 'chorus') hat(t, s % 2 ? 0.045 : 0.075, s);
    if ((sec === 'chorus' || boss) && s % 4 === 2) burst(t, 0.18, 'highpass', 7000, 0.06);
    // a fill to close every fourth bar
    if ((b8 === 3 || lastBar) && s >= 12) tom(t, [160, 130, 105, 85][s - 12], 0.45);
  }

  // ---- melody ----
  const phrases = SECTION_MELODY[sec];
  if (phrases.length) {
    const ph = phrases[Math.floor(b8 / 2)];
    const at = (b8 % 2) * 16 + s;
    const vol = boss ? 0.05 : L === 0 && sec === 'verse' ? 0.03 : 0.042;
    for (const [st, raw, len] of ph) {
      if (st !== at) continue;
      const note = boss ? raw : fitNote(raw, chord, len >= 2 || st % 4 === 0);
      melody(midi(note), t, s16 * len * 0.95, vol, boss);
      // the second verse is doubled an octave below, for weight
      if (sec === 'verse2') melody(midi(note - 12), t, s16 * len * 0.95, vol * 0.6, false);
    }
  }
  // ---- counter-lines ----
  // a bright arpeggio over the climb and the chorus
  if ((sec === 'climb' || sec === 'chorus') && (L >= 1 || sec === 'chorus')) lead(midi(chord[ARP[s % 8]] + 24), t, s16 * 0.8, 0.014, s);
  // bells in the breakdown, slow and high
  if (sec === 'break' && s % 4 === 0) bell(midi(chord[(s / 4 + b8) % 3] + 24), t, 0.05);
  // the boss gets a high wail on top
  if (boss && s === 0 && b8 % 2 === 0) melody(midi(chord[2] + 24), t, s16 * 14, 0.018, false);
}

/**
 * Local development only: render the Night Shift's score offline, for listening to without
 * playing. `plan` gives the heat (0-4) and whether a boss is up at each moment.
 */
export async function renderNight(seconds: number, plan: (t: number) => { heat: number; boss: boolean }): Promise<AudioBuffer> {
  const saved = { ctx, bus, mood, level, stepIndex };
  const off = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  ctx = off as unknown as AudioContext;
  makeBus();
  bus!.out.gain.value = MUSIC_VOLUME;
  let t = 0.05;
  let i = 0;
  while (t < seconds - 0.3) {
    const p = plan(t);
    mood = p.boss ? 'nightboss' : 'night';
    nightHeat = p.heat;
    if (i % 16 === 0) level = targetLevel();
    playStep(i, t);
    t += 60 / tempo() / 4;
    i++;
  }
  const out = await off.startRendering();
  ({ ctx, bus, mood, level, stepIndex } = saved);
  return out;
}
if (import.meta.env.DEV) (window as unknown as { renderNight?: typeof renderNight }).renderNight = renderNight;

/** Local development only: render the title menu's music offline (the crypt's score at rest), for trailers. */
export async function renderMenu(seconds: number): Promise<AudioBuffer> {
  const saved = { ctx, bus, mood, level, stepIndex };
  const off = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  ctx = off as unknown as AudioContext;
  makeBus();
  bus!.out.gain.value = MUSIC_VOLUME;
  mood = 'crypt';
  level = 0;
  let t = 0.05;
  for (let i = 0; t < seconds - 0.3; i++) {
    playStep(i, t);
    t += 60 / tempo() / 4;
  }
  const out = await off.startRendering();
  ({ ctx, bus, mood, level, stepIndex } = saved);
  return out;
}
if (import.meta.env.DEV) (window as unknown as { renderMenu?: typeof renderMenu }).renderMenu = renderMenu;

/** Local development only: the crypt's score at a set intensity (0-4; 4 is the Abyss, full drums), rendered offline for trailers. */
export async function renderCrypt(seconds: number, intensity: number): Promise<AudioBuffer> {
  const saved = { ctx, bus, mood, level, stepIndex };
  const off = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  ctx = off as unknown as AudioContext;
  makeBus();
  bus!.out.gain.value = MUSIC_VOLUME;
  mood = 'crypt';
  level = Math.max(0, Math.min(4, Math.round(intensity)));
  let t = 0.05;
  for (let i = 0; t < seconds - 0.3; i++) {
    if (i === 0 && level > 0) crash(t);
    playStep(i, t);
    t += 60 / tempo() / 4;
  }
  const out = await off.startRendering();
  ({ ctx, bus, mood, level, stepIndex } = saved);
  return out;
}

// Local development only: the sound effects, reachable from outside, so a recording can note which play and when.
if (import.meta.env.DEV) window.addEventListener('load', () => ((window as unknown as { omcSfx?: typeof sfx }).omcSfx = sfx));

/** Local development only: one sound effect rendered offline on its own, for laying under trailers. */
export async function renderSfx(name: string, args: unknown[] = [], seconds = 3): Promise<AudioBuffer> {
  const saved = ctx;
  const off = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  ctx = off as unknown as AudioContext;
  try {
    (sfx as unknown as Record<string, (...a: unknown[]) => void>)[name]?.(...args);
  } finally {
    ctx = saved;
  }
  return off.startRendering();
}

/**
 * Keep the melody in tune with the chord under it: a held or on-beat note moves to the nearest
 * note of the chord; a quick passing note to the nearest note in the key (E minor, with D sharp
 * over the B major chord).
 */
function fitNote(note: number, chord: number[], strong: boolean): number {
  const tones = strong ? chord.map((n) => n % 12) : chord === B ? [4, 6, 7, 9, 11, 0, 3] : [4, 6, 7, 9, 11, 0, 2];
  for (let d = 0; d <= 6; d++) {
    if (tones.includes((note + d) % 12)) return note + d;
    if (tones.includes((note - d + 120) % 12)) return note - d;
  }
  return note;
}

/** The singing lead: a detuned saw and square, with a little vibrato on long notes. */
function melody(freq: number, t: number, dur: number, vol: number, grit: boolean) {
  const c = ctx!;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(grit ? 1800 : 3400, t);
  f.frequency.linearRampToValueAtTime(grit ? 1200 : 2400, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.linearRampToValueAtTime(vol * 0.7, t + 0.12);
  g.gain.setValueAtTime(vol * 0.7, t + Math.max(0.13, dur - 0.05));
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06);
  g.connect(f);
  f.connect(bus!.dry);
  f.connect(bus!.wet);
  const a = osc('sawtooth', freq, t, dur + 0.06, g, -7);
  const b = osc(grit ? 'sawtooth' : 'square', freq, t, dur + 0.06, g, 7);
  if (dur > 0.25) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(18, t + Math.min(0.3, dur));
    lfo.connect(depth);
    depth.connect(a.detune);
    depth.connect(b.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }
}

/** A bell: a sine and its bright overtone, ringing out. */
function bell(freq: number, t: number, vol: number) {
  const c = ctx!;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  g.connect(bus!.dry);
  g.connect(bus!.wet);
  osc('sine', freq, t, 1.4, g);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(vol * 0.35, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  g2.connect(bus!.wet);
  osc('sine', freq * 2.76, t, 0.5, g2);
}

/** Rising noise into the drop. */
function riser(t: number, dur: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + dur);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
  src.connect(f).connect(g).connect(bus!.wet);
  g.connect(bus!.dry);
  src.start(t);
  src.stop(t + dur + 0.1);
}

function osc(type: OscillatorType, freq: number, t: number, dur: number, dest: AudioNode, detune = 0) {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

/** Wide detuned saw chord with a slow tape-like wobble. */
function pad(chord: number[], t: number, dur: number, vol: number) {
  const c = ctx!;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1300;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.08);
  g.gain.setValueAtTime(vol, t + dur - 0.1);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
  filter.connect(g);
  g.connect(bus!.dry);
  g.connect(bus!.wet);
  const wobble = c.createOscillator();
  const depthGain = c.createGain();
  wobble.frequency.value = 0.4;
  depthGain.gain.value = 9;
  wobble.connect(depthGain);
  wobble.start(t);
  wobble.stop(t + dur + 0.1);
  for (const n of chord) {
    for (const det of [-10, 0, 10]) {
      depthGain.connect(osc('sawtooth', midi(n + 12), t, dur + 0.05, filter, det).detune);
    }
  }
}

function bassNote(freq: number, t: number, dur: number, vol: number) {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.03, t + dur);
  g.connect(bus!.bass);
  osc('sawtooth', freq, t, dur, g);
  osc('square', freq / 2, t, dur, g);
}

function lead(freq: number, t: number, dur: number, vol: number, s: number) {
  const c = ctx!;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  const pan = c.createStereoPanner();
  f.type = 'lowpass';
  f.frequency.value = 2600;
  pan.pan.value = s % 2 ? -0.35 : 0.35;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(f).connect(pan);
  pan.connect(bus!.dry);
  pan.connect(bus!.wet);
  osc('square', freq, t, dur, g);
}

function kick(t: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol * 0.8, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g).connect(bus!.dry);
  o.start(t);
  o.stop(t + 0.42);
}

function burst(t: number, dur: number, type: BiquadFilterType, freq: number, vol: number, q = 1, pan = 0) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = c.createStereoPanner();
  p.pan.value = pan;
  src.connect(f).connect(g).connect(p).connect(bus!.dry);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const hat = (t: number, vol: number, s: number) => burst(t, 0.04, 'highpass', 8000, vol, 1, s % 2 ? -0.4 : 0.4);
const snare = (t: number, vol: number) => {
  burst(t, 0.22, 'bandpass', 1900, vol, 0.8);
  burst(t, 0.08, 'highpass', 5000, vol * 0.4);
};
const crash = (t: number) => burst(t, 1.4, 'highpass', 4000, 0.18);

function tom(t: number, f0: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(f0 * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(f0, t + 0.08);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(bus!.dry);
  o.start(t);
  o.stop(t + 0.4);
  burst(t, 0.12, 'lowpass', 1800, vol * 0.5);
}

// ---------- theme music ----------
// Each theme (themes.ts) plays the crypt's score in its own way: its own chords and tempo, a pad,
// bass, arpeggio and drums of its own, how much room it rings in, and a touch only it has. The
// song's shape stays the same, so it still builds with depth and turns dark on a boss floor
// (boss floors keep the shared dread progression; the lament on death is the same for all).

type PadKind = 'saw' | 'organ' | 'choir' | 'glass' | 'drone' | 'warm';
type BassKind = 'saw' | 'sub' | 'dist' | 'pluck';
type LeadKind = 'square' | 'pluck' | 'musicbox' | 'harpsi' | 'flute' | 'oud' | 'saw' | 'bell';
type HatKind = 'hat' | 'crackle' | 'chime' | 'click' | 'bubble' | 'shaker' | 'none';
type SnareKind = 'snare' | 'anvil' | 'gated' | 'clap' | 'frame' | 'soft';
type KickKind = 'kick' | 'deep' | 'soft';
interface Beat { bar: number; s: number; t: number; chord: number[]; L: number; s16: number; boss: boolean }
interface MusicStyle {
  /** The crypt's progression, a bar each (MIDI triads around D). */
  chords?: number[][];
  tempo?: number;
  /** Reverb send (Classic: 0.35). */
  wet?: number;
  pad?: PadKind;
  bass?: BassKind;
  lead?: LeadKind;
  hat?: HatKind;
  snare?: SnareKind;
  kick?: KickKind;
  /** Which chord notes the arpeggio walks, and how far up it sits. */
  arpPattern?: number[];
  arpUp?: number;
  extra?: (b: Beat) => void;
}
const CLASSIC: MusicStyle = {};
let style: MusicStyle = CLASSIC;

const STYLES: Record<string, MusicStyle> = {
  // bone and ash: slow and sparse, a drone, embers crackling, a far-off bell
  ashen: {
    chords: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [45, 48, 52]], tempo: 0.86, wet: 0.5,
    pad: 'drone', bass: 'sub', lead: 'flute', hat: 'crackle', snare: 'soft', kick: 'soft', arpPattern: [0, 2, 1, 2],
    extra: ({ bar, s, t, chord }) => { if (s === 0 && bar % 4 === 0) bell(midi(chord[0] + 12), t, 0.05); },
  },
  // moss and copper: Dorian, warm, a plucked dulcimer and hand drums
  verdigris: {
    chords: [[50, 53, 57], [43, 47, 50], [50, 53, 57], [48, 52, 55]], tempo: 0.95, wet: 0.4,
    pad: 'warm', bass: 'pluck', lead: 'pluck', hat: 'shaker', snare: 'frame', kick: 'soft', arpPattern: [0, 1, 2, 1, 0, 2, 1, 2],
    extra: ({ s, t, chord, L }) => { if (L >= 1 && s === 10) tom(t, midi(chord[0] - 12) * 2, 0.18); },
  },
  // rime and glass: lighter chords, a music box, chimes for hats, a long icy pad
  frost: {
    chords: [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]], wet: 0.55,
    pad: 'glass', bass: 'sub', lead: 'musicbox', hat: 'chime', snare: 'soft', kick: 'soft', arpUp: 12,
    extra: ({ s, t, chord, L }) => { if (L === 0 && s % 4 === 3 && Math.random() < 0.4) musicBox(midi(chord[Math.floor(Math.random() * 3)] + 36), t, 0.012); },
  },
  // velvet and blood: harmonic minor, a harpsichord over an organ, a waltz-like lilt
  crimson: {
    chords: [[50, 53, 57], [43, 46, 50], [45, 49, 52], [50, 53, 57]], tempo: 0.92, wet: 0.45,
    pad: 'organ', bass: 'saw', lead: 'harpsi', hat: 'hat', snare: 'clap', arpPattern: [0, 2, 1, 2, 0, 2],
  },
  // sandstone and gold: Phrygian dominant, an oud over a drone and frame drums
  gilded: {
    chords: [[50, 54, 57], [51, 55, 58], [50, 54, 57], [48, 51, 55]], tempo: 0.94, wet: 0.4,
    pad: 'drone', bass: 'pluck', lead: 'oud', hat: 'shaker', snare: 'frame', kick: 'deep', arpPattern: [0, 1, 0, 2, 1, 0, 2, 1],
  },
  // the drowned temple: slow and dreamy, washed in echo, bubbles for hats, a whale's call now and then
  sunken: {
    chords: [[50, 53, 57], [41, 45, 48], [46, 50, 53], [45, 48, 52]], tempo: 0.82, wet: 0.7,
    pad: 'warm', bass: 'sub', lead: 'flute', hat: 'bubble', snare: 'soft', kick: 'soft', arpPattern: [0, 1, 2, 1],
    extra: ({ bar, s, t, s16 }) => {
      if (s === 0 && bar % 8 === 4) whale(t, s16 * 16);
      if (s % 4 === 1 && Math.random() < 0.3) bubble(t, 0.03);
    },
  },
  // the forge: heavy and driving, distorted bass, anvils on the backbeat, a furnace roar on a boss
  infernal: {
    chords: [[50, 53, 57], [51, 55, 58], [50, 53, 57], [48, 51, 55]], tempo: 1.05, wet: 0.25,
    pad: 'organ', bass: 'dist', lead: 'saw', hat: 'crackle', snare: 'anvil', kick: 'deep', arpPattern: [0, 0, 1, 0, 2, 0, 1, 0],
    extra: ({ bar, s, t, s16, boss, L }) => {
      if (L === 0 && s === 8 && bar % 2 === 1) anvil(t, 0.08);
      if (boss && s === 0 && bar % 4 === 3) riser(t, s16 * 16);
    },
  },
  // the haunted wood: whole-tone and eerie, a wavering flute, wooden clicks, a music box in the quiet
  witchwood: {
    chords: [[50, 54, 58], [48, 52, 56], [46, 50, 54], [52, 56, 60]], tempo: 0.9, wet: 0.5,
    pad: 'choir', bass: 'pluck', lead: 'flute', hat: 'click', snare: 'soft', kick: 'soft', arpPattern: [0, 1, 2, 1, 2, 0],
    extra: ({ bar, s, t, chord, L }) => {
      if (L <= 1 && bar % 4 === 2 && s % 2 === 0 && s < 8) musicBox(midi(chord[(s / 2) % 3] + 24 - s), t, 0.02);
    },
  },
  // the observatory: Lydian, a soft choir, twinkling bell arpeggios, very little drum
  astral: {
    chords: [[50, 54, 57], [52, 56, 59], [47, 50, 54], [45, 49, 52]], tempo: 0.9, wet: 0.65,
    pad: 'choir', bass: 'sub', lead: 'bell', hat: 'chime', snare: 'soft', kick: 'soft', arpUp: 12, arpPattern: [0, 1, 2, 1],
    extra: ({ s, t, chord }) => { if (s % 2 === 1 && Math.random() < 0.25) musicBox(midi(chord[Math.floor(Math.random() * 3)] + 36), t, 0.01); },
  },
  // synthwave: pulsing bass, a bright saw lead, a big gated snare, a touch faster
  neon: {
    chords: [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]], tempo: 1.08, wet: 0.35,
    pad: 'saw', bass: 'saw', lead: 'saw', hat: 'hat', snare: 'gated', kick: 'kick', arpPattern: [0, 1, 2, 1, 0, 1, 2, 1],
  },
};

/** Play the crypt's score in a theme's style (unknown ids, and 'classic', play it as written). */
export function setMusicStyle(id: string) {
  style = STYLES[id] ?? CLASSIC;
}

function padBy(kind: PadKind | undefined, chord: number[], t: number, dur: number, vol: number) {
  if (!kind || kind === 'saw') return pad(chord, t, dur, vol);
  const c = ctx!;
  const g = c.createGain();
  const attack = kind === 'choir' || kind === 'glass' ? Math.min(0.6, dur * 0.3) : 0.08;
  const level = vol * (kind === 'drone' ? 1.6 : kind === 'glass' ? 0.9 : kind === 'organ' ? 0.75 : 1.4);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(level, t + attack);
  g.gain.setValueAtTime(level, t + dur - 0.1);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
  const f = c.createBiquadFilter();
  f.type = kind === 'choir' ? 'bandpass' : 'lowpass';
  f.frequency.value = kind === 'choir' ? 1100 : kind === 'glass' ? 5200 : kind === 'organ' ? 2200 : 1100;
  f.Q.value = kind === 'choir' ? 0.8 : 0.7;
  f.connect(g);
  g.connect(bus!.dry);
  g.connect(bus!.wet);
  const notes = kind === 'drone' ? [chord[0], chord[0] + 7] : chord;
  for (const n of notes) {
    if (kind === 'organ') {
      osc('square', midi(n + 12), t, dur, f, 0);
      osc('sine', midi(n + 24), t, dur, f, 4);
    } else if (kind === 'choir') {
      for (const det of [-14, 0, 14]) {
        const o = osc('triangle', midi(n + 12), t, dur, f, det);
        const lfo = c.createOscillator();
        const d = c.createGain();
        lfo.frequency.value = 4.6 + Math.random();
        d.gain.value = 12;
        lfo.connect(d).connect(o.detune);
        lfo.start(t);
        lfo.stop(t + dur + 0.1);
      }
    } else if (kind === 'glass') {
      osc('sine', midi(n + 24), t, dur, f, -6);
      osc('triangle', midi(n + 24), t, dur, f, 6);
    } else if (kind === 'drone') {
      osc('sawtooth', midi(n), t, dur, f, -5);
      osc('sine', midi(n - 12), t, dur, f, 0);
    } else {
      // warm: soft triangles, slightly spread
      osc('triangle', midi(n + 12), t, dur, f, -8);
      osc('triangle', midi(n + 12), t, dur, f, 8);
    }
  }
}

function bassBy(kind: BassKind | undefined, freq: number, t: number, dur: number, vol: number) {
  if (!kind || kind === 'saw') return bassNote(freq, t, dur, vol);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol * (kind === 'sub' ? 1.6 : kind === 'dist' ? 1.15 : 1.3), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.02, t + (kind === 'pluck' ? Math.min(dur, 0.22) : dur));
  g.connect(bus!.bass);
  if (kind === 'sub') osc('sine', freq, t, dur, g);
  else if (kind === 'pluck') {
    osc('triangle', freq, t, dur, g);
    osc('sine', freq * 2, t, Math.min(dur, 0.1), g);
  } else {
    // dist: two saws and a square, hard into the bass channel's clipper
    osc('sawtooth', freq, t, dur, g, -12);
    osc('sawtooth', freq, t, dur, g, 12);
    osc('square', freq / 2, t, dur, g);
  }
}

function leadBy(kind: LeadKind | undefined, freq: number, t: number, dur: number, vol: number, s: number) {
  if (!kind || kind === 'square') return lead(freq, t, dur, vol, s);
  if (kind === 'musicbox') return musicBox(freq * 2, t, vol * 1.1);
  if (kind === 'bell') return bell(freq * 2, t, vol * 1.3);
  const c = ctx!;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  const pan = c.createStereoPanner();
  pan.pan.value = s % 2 ? -0.3 : 0.3;
  g.connect(f).connect(pan);
  pan.connect(bus!.dry);
  pan.connect(bus!.wet);
  if (kind === 'flute') {
    // a breathy, wavering flute: a slow attack and a little vibrato
    f.type = 'lowpass';
    f.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * 1.4, t + Math.min(0.08, dur * 0.4));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const o = osc('sine', freq, t, dur, g);
    osc('triangle', freq * 2, t, dur, g, 3);
    const lfo = c.createOscillator();
    const d = c.createGain();
    lfo.frequency.value = 5;
    d.gain.value = 14;
    lfo.connect(d).connect(o.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    return;
  }
  const decay = kind === 'harpsi' ? 0.35 : kind === 'pluck' ? 0.3 : kind === 'oud' ? 0.4 : dur;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(kind === 'harpsi' ? 6000 : kind === 'saw' ? 3200 : 3600, t);
  f.frequency.exponentialRampToValueAtTime(kind === 'saw' ? 1800 : 700, t + Math.max(0.05, decay));
  g.gain.setValueAtTime(vol * (kind === 'saw' ? 1 : 1.5), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, decay));
  if (kind === 'harpsi') {
    osc('sawtooth', freq, t, decay, g);
    osc('square', freq * 2, t, decay, g, 5);
  } else if (kind === 'oud') {
    const o = osc('sawtooth', freq * 1.02, t, decay, g);
    o.frequency.setValueAtTime(freq * 1.03, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
  } else if (kind === 'pluck') {
    osc('triangle', freq, t, decay, g);
    osc('sawtooth', freq, t, Math.min(decay, 0.08), g);
  } else {
    // saw: a bright detuned synthwave lead
    osc('sawtooth', freq, t, dur, g, -9);
    osc('sawtooth', freq, t, dur, g, 9);
  }
}

function hatBy(kind: HatKind | undefined, t: number, vol: number, s: number) {
  if (!kind || kind === 'hat') return hat(t, vol, s);
  if (kind === 'none') return;
  if (kind === 'crackle') {
    if (Math.random() < 0.6) burst(t + Math.random() * 0.03, 0.015, 'bandpass', 2500 + Math.random() * 3000, vol * 0.9, 4, (Math.random() - 0.5) * 0.8);
  } else if (kind === 'chime') {
    if (s % 2 === 0) musicBox(midi(96 + [0, 3, 7, 10][(s / 2) % 4]), t, vol * 0.08);
  } else if (kind === 'click') {
    burst(t, 0.02, 'bandpass', 1800, vol * 1.2, 6, s % 2 ? -0.4 : 0.4);
  } else if (kind === 'bubble') {
    if (s % 2 === 0) bubble(t, vol * 0.25);
  } else if (kind === 'shaker') {
    burst(t, 0.07, 'bandpass', 6500, vol * 0.8, 1.5, s % 2 ? -0.3 : 0.3);
  }
}

function snareBy(kind: SnareKind | undefined, t: number, vol: number) {
  if (!kind || kind === 'snare') return snare(t, vol);
  if (kind === 'anvil') return anvil(t, vol * 0.22);
  if (kind === 'gated') {
    // a big gated snare: bright noise held, then cut dead
    const c = ctx!;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1700;
    f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(vol * 1.1, t);
    g.gain.setValueAtTime(vol * 0.9, t + 0.16);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.19);
    src.connect(f).connect(g);
    g.connect(bus!.dry);
    g.connect(bus!.wet);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.25);
    return;
  }
  if (kind === 'clap') {
    for (const d of [0, 0.012, 0.026]) burst(t + d, 0.06, 'bandpass', 1500, vol * 0.7, 1.2);
    return;
  }
  if (kind === 'frame') {
    tom(t, 140, vol * 0.7);
    burst(t, 0.08, 'bandpass', 900, vol * 0.4, 1);
    return;
  }
  burst(t, 0.12, 'bandpass', 1300, vol * 0.55, 0.9);
}

function kickBy(kind: KickKind | undefined, t: number, vol: number) {
  if (!kind || kind === 'kick') return kick(t, vol);
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(kind === 'deep' ? 120 : 110, t);
  o.frequency.exponentialRampToValueAtTime(kind === 'deep' ? 32 : 50, t + (kind === 'deep' ? 0.18 : 0.1));
  g.gain.setValueAtTime(vol * (kind === 'deep' ? 1 : 0.5), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'deep' ? 0.55 : 0.3));
  o.connect(g).connect(bus!.dry);
  o.start(t);
  o.stop(t + 0.6);
}

/** A music-box tine: a pure tone with a glassy overtone, gone in a moment. */
function musicBox(freq: number, t: number, vol: number) {
  const c = ctx!;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  g.connect(bus!.dry);
  g.connect(bus!.wet);
  osc('sine', freq, t, 0.9, g);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(vol * 0.4, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  g2.connect(bus!.wet);
  osc('sine', freq * 4.2, t, 0.25, g2);
}

/** A bubble: a quick upward blip. */
function bubble(t: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  const f0 = 500 + Math.random() * 700;
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + 0.07);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g);
  g.connect(bus!.dry);
  g.connect(bus!.wet);
  o.start(t);
  o.stop(t + 0.1);
}

/** A whale's call from far below: a slow sliding moan, mostly echo. */
function whale(t: number, dur: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.linearRampToValueAtTime(330, t + dur * 0.4);
  o.frequency.linearRampToValueAtTime(180, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.03, t + dur * 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(bus!.wet);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** An anvil struck: inharmonic metal, ringing, with the clank on top. */
function anvil(t: number, vol: number) {
  const c = ctx!;
  for (const [ratio, decay] of [[1, 0.7], [2.76, 0.4], [5.4, 0.25], [8.9, 0.15]]) {
    const g = c.createGain();
    g.gain.setValueAtTime(vol / ratio ** 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(bus!.dry);
    g.connect(bus!.wet);
    osc('square', 620 * ratio, t, decay, g);
  }
  burst(t, 0.05, 'highpass', 3000, vol * 2.5, 1);
}

// Pause audio while the tab is hidden; resume when it comes back.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else void ctx.resume();
});

/**
 * The sound of a fusion, about three seconds: a rising, accelerating charge as the two
 * relics are drawn together, a sucked-in silence, a huge impact, then a shimmering chord
 * as the new relic appears. `impactAt` is when the collision lands, in seconds.
 */
// ---------- the Soul Forge's sound, per theme ----------
// Each theme fuses relics in its own voice, in three parts like Classic's: the charge (a rising
// sweep under a beat that quickens), the impact, and the reveal (a chord blooming, with sparkles).
type ForgeBeat = 'thump' | 'anvil' | 'bubble' | 'tick' | 'chime' | 'drum';
type ForgeImpact = 'boom' | 'anvil' | 'splash' | 'glass' | 'gong' | 'zap';
type ForgeSparkle = 'tri' | 'musicbox' | 'bubble' | 'ember' | 'bell' | 'neon';
interface ForgeStyle {
  /** The rising tone under the charge, and how high it climbs. */
  charge: OscillatorType;
  top: number;
  beat: ForgeBeat;
  impact: ForgeImpact;
  /** The reveal chord (ratios over the root) and its voice. */
  chord: number[];
  wave: OscillatorType;
  sparkle: ForgeSparkle;
  /** Wobble on the charge (Hz, 0 for none). */
  wobble?: number;
}
const FORGE_CLASSIC: ForgeStyle = { charge: 'sawtooth', top: 660, beat: 'thump', impact: 'boom', chord: [1, 1.25, 1.5, 2, 2.5, 3], wave: 'triangle', sparkle: 'tri' };
const FORGE_STYLES: Record<string, ForgeStyle> = {
  ashen: { charge: 'triangle', top: 440, beat: 'thump', impact: 'gong', chord: [1, 1.2, 1.5, 2, 2.4], wave: 'sine', sparkle: 'ember' },
  verdigris: { charge: 'triangle', top: 620, beat: 'drum', impact: 'boom', chord: [1, 1.2, 1.5, 1.68, 2, 3], wave: 'triangle', sparkle: 'tri' },
  frost: { charge: 'sine', top: 1320, beat: 'chime', impact: 'glass', chord: [1, 1.5, 2, 3, 4], wave: 'sine', sparkle: 'musicbox' },
  crimson: { charge: 'sawtooth', top: 560, beat: 'thump', impact: 'boom', chord: [1, 1.2, 1.5, 1.875, 2, 2.4], wave: 'square', sparkle: 'bell' },
  gilded: { charge: 'sawtooth', top: 700, beat: 'drum', impact: 'gong', chord: [1, 1.06, 1.26, 1.5, 2, 2.52], wave: 'triangle', sparkle: 'tri' },
  sunken: { charge: 'sine', top: 520, beat: 'bubble', impact: 'splash', chord: [1, 1.25, 1.5, 2, 2.5], wave: 'sine', sparkle: 'bubble', wobble: 6 },
  infernal: { charge: 'sawtooth', top: 330, beat: 'anvil', impact: 'anvil', chord: [1, 1.5, 2, 3, 4], wave: 'sawtooth', sparkle: 'ember' },
  witchwood: { charge: 'triangle', top: 600, beat: 'tick', impact: 'boom', chord: [1, 1.12, 1.26, 1.41, 1.59, 2], wave: 'triangle', sparkle: 'musicbox', wobble: 4 },
  astral: { charge: 'sine', top: 990, beat: 'chime', impact: 'gong', chord: [1, 1.26, 1.41, 1.5, 2, 2.52], wave: 'sine', sparkle: 'bell' },
  neon: { charge: 'square', top: 880, beat: 'thump', impact: 'zap', chord: [1, 1.19, 1.5, 2, 2.38, 3], wave: 'sawtooth', sparkle: 'neon' },
};
let forge: ForgeStyle = FORGE_CLASSIC;

/** Fuse relics in a theme's voice ('classic', or an unknown id, plays the original). */
export function setForgeStyle(id: string) {
  forge = FORGE_STYLES[id] ?? FORGE_CLASSIC;
}

export function fusionSound(ascended: boolean, impactAt = 1.9, into?: BaseAudioContext) {
  // `into` renders it somewhere else (an OfflineAudioContext, e.g. for promo videos).
  const ctx = into ?? liveCtx();
  if (!ctx || (!into && muted)) return;
  const F = forge;
  const t0 = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  out.connect(comp).connect(ctx.destination);
  const hit = t0 + impactAt;

  const noiseBuf = (dur: number) => {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  /** A tone with a quick attack and an exponential fade. */
  const ping = (type: OscillatorType, freq: number, at: number, dur: number, vol: number, slideTo?: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + dur + 0.02);
  };
  /** Filtered noise, fading out. */
  const hiss = (at: number, dur: number, type: BiquadFilterType, f0: number, vol: number, f1 = f0) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf(dur);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(g).connect(out);
    src.start(at);
  };
  /** Struck metal: inharmonic partials ringing out. */
  const metal = (at: number, base: number, vol: number, decay: number) => {
    [[1, 1], [2.76, 0.6], [5.4, 0.4], [8.9, 0.25]].forEach(([r, d]) => ping('square', base * r, at, decay * d, vol / r ** 0.5));
  };

  // 1. The charge: a noise sweep and two detuned tones rising together.
  const sweep = ctx.createBufferSource();
  sweep.buffer = noiseBuf(impactAt);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(250, t0);
  bp.frequency.exponentialRampToValueAtTime(F.impact === 'splash' ? 2400 : 7000, hit - 0.05);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.02, t0);
  sg.gain.exponentialRampToValueAtTime(F.impact === 'glass' || F.charge === 'sine' ? 0.3 : 0.5, hit - 0.08);
  sg.gain.linearRampToValueAtTime(0, hit - 0.04);
  sweep.connect(bp).connect(sg).connect(out);
  sweep.start(t0);
  for (const detune of [-14, 9]) {
    const o = ctx.createOscillator();
    o.type = F.charge;
    o.detune.value = detune;
    o.frequency.setValueAtTime(82, t0);
    o.frequency.exponentialRampToValueAtTime(ascended ? F.top * 1.5 : F.top, hit - 0.05);
    if (F.wobble) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = F.wobble;
      depth.gain.value = 40;
      lfo.connect(depth).connect(o.detune);
      lfo.start(t0);
      lfo.stop(hit);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t0);
    lp.frequency.exponentialRampToValueAtTime(5000, hit - 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(F.charge === 'sine' || F.charge === 'triangle' ? 0.14 : 0.09, hit - 0.1);
    g.gain.linearRampToValueAtTime(0, hit - 0.04);
    o.connect(lp).connect(g).connect(out);
    o.start(t0);
    o.stop(hit);
  }
  // A beat that speeds up toward the collision: heartbeat thumps, or the theme's own.
  let at = 0;
  for (let gap = 0.42, n = 0; at < impactAt - 0.12; gap *= 0.8, n++) {
    const tb = t0 + at;
    if (F.beat === 'thump') ping('sine', 140, tb, 0.16, 0.45, 45);
    else if (F.beat === 'anvil') metal(tb, 520 + n * 12, 0.05, 0.35);
    else if (F.beat === 'bubble') ping('sine', 400 + Math.random() * 500, tb, 0.09, 0.12, 1200);
    else if (F.beat === 'tick') {
      ping('square', n % 2 ? 1800 : 1400, tb, 0.025, 0.06);
      hiss(tb, 0.02, 'bandpass', 2200, 0.15);
    } else if (F.beat === 'chime') ping('sine', 1046 * 2 ** ((n % 5) / 5), tb, 0.4, 0.05);
    else {
      // drum: a hand drum, low and skin-soft
      ping('sine', 170, tb, 0.18, 0.35, 90);
      hiss(tb, 0.05, 'lowpass', 900, 0.15);
    }
    at += Math.max(0.06, gap);
  }

  // 2. The impact.
  const boom = (f0: number, vol: number) => ping('sine', f0, hit, 1.4, vol, 28);
  if (F.impact === 'boom') {
    boom(95, 0.9);
    hiss(hit, 1.5, 'lowpass', 5000, 0.8, 300);
  } else if (F.impact === 'anvil') {
    boom(80, 1);
    metal(hit, 330, 0.18, 1.6);
    hiss(hit, 1.2, 'lowpass', 3000, 0.7, 200);
    hiss(hit + 0.05, 0.9, 'bandpass', 600, 0.25, 150); // the furnace breathing out
  } else if (F.impact === 'splash') {
    boom(70, 0.7);
    hiss(hit, 1.2, 'lowpass', 1800, 0.7, 200);
    for (let i = 0; i < 10; i++) ping('sine', 300 + Math.random() * 900, hit + 0.05 + Math.random() * 0.6, 0.1, 0.08, 1400);
  } else if (F.impact === 'glass') {
    boom(110, 0.5);
    hiss(hit, 0.8, 'highpass', 6000, 0.5, 4000);
    for (let i = 0; i < 14; i++) ping('sine', 2000 + Math.random() * 4000, hit + Math.random() * 0.4, 0.3 + Math.random() * 0.4, 0.03);
  } else if (F.impact === 'gong') {
    boom(85, 0.7);
    [[1, 2.6], [1.48, 2.2], [2.04, 1.8], [2.56, 1.3], [3.1, 1]].forEach(([r, d]) => ping('sine', 110 * r, hit, d, 0.12 / r));
    hiss(hit, 1.2, 'bandpass', 900, 0.3, 400);
  } else {
    // zap: a laser dropping out of the sky into a synth boom
    boom(90, 0.8);
    ping('sawtooth', 2400, hit - 0.02, 0.5, 0.12, 60);
    ping('square', 1800, hit, 0.35, 0.06, 90);
    hiss(hit, 1, 'lowpass', 6000, 0.5, 400);
  }

  // 3. The reveal: a chord blooming in the theme's harmony, and a few sparkles.
  const root = ascended ? 293.66 : 261.63;
  F.chord.forEach((m, i) => {
    for (const det of F.wave === 'sawtooth' ? [-9, 9] : [-6, 6]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i < 3 ? F.wave : F.wave === 'square' || F.wave === 'sawtooth' ? 'triangle' : 'sine';
      o.frequency.value = root * m;
      o.detune.value = det;
      const s0 = hit + 0.12 + i * 0.05;
      const vol = F.wave === 'square' || F.wave === 'sawtooth' ? 0.025 : 0.05;
      g.gain.setValueAtTime(0.001, s0);
      g.gain.exponentialRampToValueAtTime(vol, s0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, s0 + 1.6);
      o.connect(g).connect(out);
      o.start(s0);
      o.stop(s0 + 1.65);
    }
  });
  for (let i = 0; i < 6; i++) {
    const s0 = hit + 0.3 + i * 0.11;
    const f = 1568 * (1 + (i % 3) * 0.25);
    if (F.sparkle === 'tri') ping('triangle', f, s0, 0.18, 0.035);
    else if (F.sparkle === 'musicbox') {
      ping('sine', f, s0, 0.7, 0.03);
      ping('sine', f * 4.2, s0, 0.2, 0.012);
    } else if (F.sparkle === 'bubble') ping('sine', 500 + i * 120, s0, 0.09, 0.08, 1500 + i * 200);
    else if (F.sparkle === 'ember') hiss(s0 + Math.random() * 0.05, 0.03, 'bandpass', 2500 + Math.random() * 3000, 0.25);
    else if (F.sparkle === 'bell') {
      ping('sine', f / 2, s0, 1, 0.03);
      ping('sine', (f / 2) * 2.76, s0, 0.4, 0.012);
    } else ping('square', f * (i % 2 ? 1.5 : 1), s0, 0.12, 0.02);
  }
}

function liveCtx(): AudioContext | null {
  return ctx;
}
