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
// The Night Shift has its own score: a fast E minor chase (i - VII - VI - VII) with a
// galloping riff, and a darker turn (i - bII - v - bII) while a boss is up. It builds with
// the night, from a driving start to double-time drums and a screaming lead.
const NIGHT_CHORDS: Record<'night' | 'nightboss', number[][]> = {
  night: [[52, 55, 59], [50, 54, 57], [48, 52, 55], [50, 54, 57]],
  nightboss: [[52, 55, 59], [53, 57, 60], [47, 50, 54], [53, 57, 60]],
};
const NIGHT_TEMPO = [140, 148, 156, 164, 172];
// The riff, a step at a time: which chord note (3 is the root an octave up), or -1 to rest.
const RIFF = [0, -1, 0, 1, -1, 2, -1, 1, 0, -1, 3, -1, 2, -1, 1, 2];
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
  mood = next;
  // The lament starts cleanly on a downbeat instead of waiting for the bar line.
  if (next === 'fallen') {
    level = 0;
    stepIndex = 0;
  }
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
  return mood === 'fallen' ? FALLEN_TEMPO : isNight() ? NIGHT_TEMPO[level] : TEMPO[level];
}

function playStep(i: number, t: number) {
  if (isNight()) return nightStep(i, t);
  const s = i % 16;
  const bar = Math.floor(i / 16);
  const chords = CHORDS[mood === 'boss' ? 'boss' : mood === 'fallen' ? 'fallen' : 'crypt'];
  if (s === 0) key = mood === 'fallen' ? 0 : zoneKey;
  const chord = chords[bar % chords.length].map((n) => n + key);
  const s16 = 60 / tempo() / 4;
  const L = level;

  if (s === 0) pad(chord, t, s16 * 16, L === 0 ? 0.045 : 0.035);
  // Bass: long notes in the menus, driving eighths and sixteenths in the crypt.
  if (L === 0) {
    if (s === 0) bassNote(midi(chord[0] - 12), t, s16 * 14, 0.5);
  } else if (L === 1) {
    if (s % 2 === 0) bassNote(midi(chord[0] - 12), t, s16 * 1.8, 0.9);
  } else {
    bassNote(midi(chord[0] - (s % 4 === 2 ? 0 : 12)), t, s16 * 0.95, 0.9);
  }
  // Arpeggio: soft in the menus, the lead from floor 20, an octave up in the Abyss.
  const arpNote = midi(chord[ARP[s % 8]] + (L === 4 ? 24 : 12));
  if (L === 0 && s % 2 === 0) lead(arpNote, t, s16 * 1.8, 0.018, s);
  if (L >= 3) lead(arpNote, t, s16 * 0.9, 0.03, s);
  // Drums.
  if (L >= 1 && s % 4 === 0) kick(t, 0.9);
  if (L >= 2) {
    hat(t, s % 2 ? (L === 4 ? 0.07 : 0.04) : 0.09, s);
    if (s === 4 || s === 12) snare(t, L === 4 ? 0.45 : 0.38);
    if (s === 14) kick(t, 0.6);
  }
  if (L === 4) {
    if (s % 4 === 2) kick(t, 0.5);
    if (s >= 12) tom(t, [130, 110, 95, 80][s - 12], 0.4);
  } else if (L >= 2 && bar % 2 === 1 && s >= 12) {
    tom(t, [130, 110, 95, 80][s - 12], 0.4);
  }
}

/** A step of the Night Shift's score. */
function nightStep(i: number, t: number) {
  const s = i % 16;
  const bar = Math.floor(i / 16);
  const boss = mood === 'nightboss';
  const chord = NIGHT_CHORDS[boss ? 'nightboss' : 'night'][bar % 4];
  const s16 = 60 / tempo() / 4;
  const L = level;

  if (s === 0) pad(chord, t, s16 * 16, boss ? 0.04 : 0.028);
  if (s === 0 && bar % 4 === 0 && (L >= 3 || boss)) crash(t);
  // Bass: rolling sixteenths, jumping the octave on the off-beats.
  bassNote(midi(chord[0] - (s % 2 ? 0 : 12)), t, s16 * 0.9, s % 4 === 0 ? 1 : 0.75);
  // Drums: four on the floor from the start, snare and hats at once, more as it builds.
  if (s % 4 === 0) kick(t, 0.95);
  if (L >= 3 && s % 4 === 3) kick(t, 0.45);
  if (L >= 4 && s % 2 === 1 && s % 4 !== 3) kick(t, 0.35);
  hat(t, s % 2 ? 0.05 : 0.08, s);
  if (s === 4 || s === 12) snare(t, 0.42);
  if (L >= 2 && (s === 7 || s === 15) && bar % 2 === 1) snare(t, 0.2);
  if (bar % 4 === 3 && s >= 12) tom(t, [150, 125, 100, 80][s - 12], 0.45);
  // The riff: from the start on a soft arp, the full lead from heat 2, an octave up at the top.
  const r = RIFF[s];
  if (r >= 0) {
    const note = (r === 3 ? chord[0] + 12 : chord[r]) + (L >= 4 ? 24 : 12);
    if (L <= 1) lead(midi(note), t, s16 * 0.8, 0.016, s);
    else lead(midi(note), t, s16 * 0.95, L >= 4 ? 0.034 : 0.028, s);
  }
  // A high counter-line over bosses: long notes on the chord's top.
  if (boss && s % 8 === 0) lead(midi(chord[2] + 24), t, s16 * 7, 0.02, s);
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
export function fusionSound(ascended: boolean, impactAt = 1.9, into?: BaseAudioContext) {
  // `into` renders it somewhere else (an OfflineAudioContext, e.g. for promo videos).
  const ctx = into ?? liveCtx();
  if (!ctx || (!into && muted)) return;
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

  // 1. The charge: a noise sweep and two detuned saws rising together.
  const sweep = ctx.createBufferSource();
  sweep.buffer = noiseBuf(impactAt);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(250, t0);
  bp.frequency.exponentialRampToValueAtTime(7000, hit - 0.05);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.02, t0);
  sg.gain.exponentialRampToValueAtTime(0.5, hit - 0.08);
  sg.gain.linearRampToValueAtTime(0, hit - 0.04);
  sweep.connect(bp).connect(sg).connect(out);
  sweep.start(t0);
  for (const detune of [-14, 9]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = detune;
    o.frequency.setValueAtTime(82, t0);
    o.frequency.exponentialRampToValueAtTime(ascended ? 990 : 660, hit - 0.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t0);
    lp.frequency.exponentialRampToValueAtTime(5000, hit - 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, hit - 0.1);
    g.gain.linearRampToValueAtTime(0, hit - 0.04);
    o.connect(lp).connect(g).connect(out);
    o.start(t0);
    o.stop(hit);
  }
  // Heartbeat thumps that speed up toward the collision.
  let at = 0;
  for (let gap = 0.42; at < impactAt - 0.12; gap *= 0.8) {
    const k = ctx.createOscillator();
    const kg = ctx.createGain();
    k.frequency.setValueAtTime(140, t0 + at);
    k.frequency.exponentialRampToValueAtTime(45, t0 + at + 0.12);
    kg.gain.setValueAtTime(0.45, t0 + at);
    kg.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.16);
    k.connect(kg).connect(out);
    k.start(t0 + at);
    k.stop(t0 + at + 0.18);
    at += Math.max(0.06, gap);
  }

  // 2. The impact: a deep drop, a burst and a long crash.
  const boom = ctx.createOscillator();
  const bg = ctx.createGain();
  boom.frequency.setValueAtTime(95, hit);
  boom.frequency.exponentialRampToValueAtTime(28, hit + 1.3);
  bg.gain.setValueAtTime(0.9, hit);
  bg.gain.exponentialRampToValueAtTime(0.001, hit + 1.4);
  boom.connect(bg).connect(out);
  boom.start(hit);
  boom.stop(hit + 1.45);
  const burst = ctx.createBufferSource();
  burst.buffer = noiseBuf(1.6);
  const blp = ctx.createBiquadFilter();
  blp.type = 'lowpass';
  blp.frequency.setValueAtTime(5000, hit);
  blp.frequency.exponentialRampToValueAtTime(300, hit + 1.5);
  const burstG = ctx.createGain();
  burstG.gain.setValueAtTime(0.8, hit);
  burstG.gain.exponentialRampToValueAtTime(0.001, hit + 1.5);
  burst.connect(blp).connect(burstG).connect(out);
  burst.start(hit);

  // 3. The reveal: a bright chord blooming and a few sparkles.
  const root = ascended ? 293.66 : 261.63;
  [1, 1.25, 1.5, 2, 2.5, 3].forEach((m, i) => {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i < 3 ? 'triangle' : 'sine';
      o.frequency.value = root * m;
      o.detune.value = det;
      const s0 = hit + 0.12 + i * 0.05;
      g.gain.setValueAtTime(0.001, s0);
      g.gain.exponentialRampToValueAtTime(0.05, s0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, s0 + 1.6);
      o.connect(g).connect(out);
      o.start(s0);
      o.stop(s0 + 1.65);
    }
  });
  for (let i = 0; i < 6; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const s0 = hit + 0.3 + i * 0.11;
    o.type = 'triangle';
    o.frequency.value = 1568 * (1 + (i % 3) * 0.25);
    g.gain.setValueAtTime(0.035, s0);
    g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.18);
    o.connect(g).connect(out);
    o.start(s0);
    o.stop(s0 + 0.2);
  }
}

function liveCtx(): AudioContext | null {
  return ctx;
}
