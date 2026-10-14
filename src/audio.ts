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
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
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
};

// ---------- music ----------
// Generative dark ambient: a drone, a slow minor-key organ pad, sparse bell melodies
// with echo, and a crypt bell every few bars. Boss floors get a faster, darker
// progression and a heartbeat drum. Everything is synthesized; nothing to download.

export type Mood = 'crypt' | 'boss' | 'silent';

interface Song {
  chords: number[][]; // MIDI notes; each chord lasts two bars
  scale: number[]; // melody notes
  step: number; // seconds per eighth note
  melodyChance: number;
  heartbeat: boolean;
}

const SONGS: Record<Exclude<Mood, 'silent'>, Song> = {
  // D minor: i - VI - iv - V
  crypt: {
    chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
    scale: [62, 64, 65, 67, 69, 70, 73, 74],
    step: 0.42,
    melodyChance: 0.3,
    heartbeat: false,
  },
  // D Phrygian dread: i - bII - i - vii°
  boss: {
    chords: [[50, 53, 57], [51, 55, 58], [50, 53, 57], [49, 52, 55]],
    scale: [57, 58, 60, 62, 63, 65, 67],
    step: 0.3,
    melodyChance: 0.45,
    heartbeat: true,
  },
};

const MUSIC_VOLUME = 0.9;
let musicEnabled = true;
let mood: Mood = 'crypt';
let bus: { out: GainNode; wet: GainNode; dry: GainNode } | null = null;
let timer = 0;
let nextTime = 0;
let stepIndex = 0;
let lastNote = 62;

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
  stepIndex = 0;
  applyMusicVolume();
}

function audible(): boolean {
  return musicEnabled && !muted && mood !== 'silent';
}

function applyMusicVolume() {
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  bus.out.gain.cancelScheduledValues(t);
  bus.out.gain.setValueAtTime(bus.out.gain.value, t);
  bus.out.gain.linearRampToValueAtTime(audible() ? MUSIC_VOLUME : 0, t + (audible() ? 2.5 : 1.2));
}

function makeBus() {
  const c = ctx!;
  const out = c.createGain();
  out.gain.value = 0;
  // Long dark reverb from a decaying noise impulse.
  const reverb = c.createConvolver();
  const len = Math.floor(c.sampleRate * 3.5);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
  }
  reverb.buffer = ir;
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;
  const wet = c.createGain();
  wet.gain.value = 0.9;
  const dry = c.createGain();
  dry.gain.value = 0.6;
  dry.connect(tone);
  wet.connect(reverb).connect(tone);
  tone.connect(out).connect(c.destination);
  bus = { out, wet, dry };
}

/** Start the music scheduler (needs the audio context, so call after a user gesture). */
export function startMusic() {
  if (!ctx || timer) return;
  makeBus();
  nextTime = ctx.currentTime + 0.1;
  timer = window.setInterval(schedule, 60);
  applyMusicVolume();
}

function schedule() {
  if (!ctx || !bus || ctx.state !== 'running') return;
  while (nextTime < ctx.currentTime + 0.25) {
    if (mood !== 'silent') playStep(SONGS[mood], stepIndex, nextTime);
    nextTime += mood === 'silent' ? SONGS.crypt.step : SONGS[mood].step;
    stepIndex++;
  }
}

function playStep(song: Song, i: number, t: number) {
  const stepsPerChord = 16;
  const chord = song.chords[Math.floor(i / stepsPerChord) % song.chords.length];
  const chordLen = song.step * stepsPerChord;

  if (i % stepsPerChord === 0) {
    pad(chord, t, chordLen);
    drone(chord[0] - 12, t, chordLen);
  }
  if (i % 64 === 0) bell(chord[0] - 24, t);
  if (song.heartbeat && i % 8 === 0) {
    thump(t, 0.5);
    thump(t + song.step * 0.6, 0.3);
  }
  if (i % 2 === 0 && Math.random() < song.melodyChance) {
    // Wander a step or two through the scale, leaning on chord tones.
    const idx = song.scale.indexOf(lastNote);
    const from = idx < 0 ? 0 : idx;
    const move = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
    const next = song.scale[Math.max(0, Math.min(song.scale.length - 1, from + move))];
    lastNote = Math.random() < 0.25 ? chord[Math.floor(Math.random() * 3)] + 12 : next;
    chime(lastNote, t);
  }
}

function voice(type: OscillatorType, freq: number, t: number, dur: number, peak: number, attack: number, dest: AudioNode[], detune = 0) {
  const c = ctx!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + Math.max(attack, dur - 1.5));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
  osc.connect(g);
  dest.forEach((d) => g.connect(d));
  osc.start(t);
  osc.stop(t + dur + 1.6);
}

/** Soft organ chord. */
function pad(chord: number[], t: number, dur: number) {
  for (const n of chord) {
    voice('triangle', midi(n), t, dur, 0.035, 1.8, [bus!.wet, bus!.dry], -6);
    voice('sine', midi(n), t, dur, 0.035, 1.8, [bus!.wet], 7);
  }
}

/** Low growl under everything. */
function drone(note: number, t: number, dur: number) {
  const c = ctx!;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(180, t);
  filter.frequency.linearRampToValueAtTime(320, t + dur / 2);
  filter.frequency.linearRampToValueAtTime(180, t + dur);
  filter.connect(bus!.dry);
  voice('sawtooth', midi(note), t, dur, 0.05, 1.2, [filter], -8);
  voice('sawtooth', midi(note), t, dur, 0.05, 1.2, [filter], 8);
}

/** Glassy bell for the melody. */
function chime(note: number, t: number) {
  const c = ctx!;
  const f = midi(note);
  [
    [1, 0.05, 1.6],
    [2.76, 0.015, 0.5],
  ].forEach(([mult, vol, len]) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = f * mult;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g);
    g.connect(bus!.wet);
    g.connect(bus!.dry);
    osc.start(t);
    osc.stop(t + len + 0.05);
  });
}

/** The crypt's great bell: inharmonic partials with a long decay. */
function bell(note: number, t: number) {
  const c = ctx!;
  const f = midi(note);
  [
    [1, 0.09],
    [2, 0.05],
    [2.4, 0.04],
    [3, 0.025],
    [4.2, 0.015],
  ].forEach(([mult, vol]) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = f * mult;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    osc.connect(g);
    g.connect(bus!.wet);
    osc.start(t);
    osc.stop(t + 5.1);
  });
}

/** Heartbeat drum for boss floors. */
function thump(t: number, vol: number) {
  const c = ctx!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.setValueAtTime(95, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
  g.gain.setValueAtTime(vol * 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(g).connect(bus!.dry);
  osc.start(t);
  osc.stop(t + 0.4);
}

// Pause audio while the tab is hidden; resume when it comes back.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else void ctx.resume();
});
