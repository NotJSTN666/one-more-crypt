// Tiny synthesized sound effects, so there are no audio files to download.

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

export type Mood = 'crypt' | 'boss' | 'fallen' | 'silent';

// D minor i - VI - iv - V, and Phrygian dread i - bII - i - vii° for bosses (MIDI notes).
const CHORDS: Record<'crypt' | 'boss' | 'fallen', number[][]> = {
  crypt: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
  boss: [[50, 53, 57], [51, 55, 58], [50, 53, 57], [49, 52, 56]],
  // The death screen: a slow lament, i - iv - VI - V.
  fallen: [[50, 53, 57], [43, 46, 50], [46, 50, 53], [45, 49, 52]],
};
const FALLEN_TEMPO = 96;
const ARP = [0, 1, 2, 1, 2, 0, 2, 1];
const TEMPO = [112, 120, 126, 133, 140]; // BPM per intensity level
const MUSIC_VOLUME = 0.32;

let musicEnabled = true;
let mood: Mood = 'crypt';
let depth = 0; // floor number; 0 means menus
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

/** Tell the music how deep the hero is (0 for menus) so it can build up. */
export function setMusicDepth(floor: number) {
  depth = floor;
}

function targetLevel(): number {
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
  return mood === 'fallen' ? FALLEN_TEMPO : TEMPO[level];
}

function playStep(i: number, t: number) {
  const s = i % 16;
  const bar = Math.floor(i / 16);
  const chords = CHORDS[mood === 'boss' ? 'boss' : mood === 'fallen' ? 'fallen' : 'crypt'];
  const chord = chords[bar % chords.length];
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
