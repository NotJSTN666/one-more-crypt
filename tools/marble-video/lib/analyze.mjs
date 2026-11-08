// Audio + MIDI analysis: turns a song clip into a list of "hits" ({ t, pitch })
// that the marble lands on. Pure Node + ffmpeg, no native deps.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Decode a slice of any audio/video file to mono Float32 PCM via ffmpeg. */
export function decodeAudio(file, start = 0, duration = null, sr = 22050) {
  const args = ['-v', 'error', '-ss', String(start)];
  if (duration) args.push('-t', String(duration));
  args.push('-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-');
  const res = spawnSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  if (res.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${res.stderr}`);
  const buf = res.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
}

// ---------- FFT ----------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

function spectrogram(pcm, n = 2048, hop = 256) {
  const win = new Float32Array(n).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  const frames = [];
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let s = 0; s + n <= pcm.length; s += hop) {
    for (let i = 0; i < n; i++) { re[i] = pcm[s + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const mag = new Float32Array(n / 2);
    for (let k = 0; k < n / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    frames.push(mag);
  }
  return frames;
}

/** Rough fundamental estimate (harmonic product spectrum) -> MIDI note number. */
function estimatePitch(mag, sr, n) {
  const binHz = sr / n;
  const lo = Math.floor(90 / binHz), hi = Math.floor(1100 / binHz);
  let best = -1, bestK = lo;
  for (let k = lo; k < hi; k++) {
    const p = Math.log1p(mag[k]) + 0.8 * Math.log1p(mag[2 * k] || 0) + 0.6 * Math.log1p(mag[3 * k] || 0);
    if (p > best) { best = p; bestK = k; }
  }
  const f = bestK * binHz;
  return Math.round(69 + 12 * Math.log2(f / 440));
}

/**
 * Onset detection tuned toward melody: band-limited (250-4000 Hz) log spectral flux,
 * local-mean threshold, then keep the strongest onsets up to a target density.
 */
export function detectHits(pcm, sr, { hitsPerSecond = 4, minGap = 0.13, bandLo = 250, bandHi = 4000 } = {}) {
  const n = 2048, hop = 256;
  const frames = spectrogram(pcm, n, hop);
  const binHz = sr / n;
  const k0 = Math.floor(bandLo / binHz), k1 = Math.min(n / 2, Math.ceil(bandHi / binHz));
  const flux = new Float32Array(frames.length);
  let prev = null;
  for (let f = 0; f < frames.length; f++) {
    const cur = new Float32Array(k1 - k0);
    for (let k = k0; k < k1; k++) cur[k - k0] = Math.log1p(100 * frames[f][k]);
    if (prev) { let s = 0; for (let k = 0; k < cur.length; k++) { const d = cur[k] - prev[k]; if (d > 0) s += d; } flux[f] = s; }
    prev = cur;
  }
  const W = 10;
  const peaks = [];
  for (let f = 2; f < flux.length - 2; f++) {
    if (!(flux[f] >= flux[f - 1] && flux[f] >= flux[f + 1] && flux[f] >= flux[f - 2] && flux[f] >= flux[f + 2])) continue;
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, f - W); j < Math.min(flux.length, f + W); j++) { sum += flux[j]; cnt++; }
    const strength = flux[f] - sum / cnt;
    if (strength > 0) peaks.push({ f, strength });
  }
  const dur = pcm.length / sr;
  const maxCount = Math.max(1, Math.round(hitsPerSecond * dur));
  const maxStrength = Math.max(1e-9, ...peaks.map((p) => p.strength));
  peaks.sort((a, b) => b.strength - a.strength);
  const chosen = [];
  for (const p of peaks) {
    if (chosen.length >= maxCount) break;
    if (p.strength < 0.12 * maxStrength) break;
    const t = (p.f * hop) / sr;
    if (chosen.some((c) => Math.abs(c.t - t) < minGap)) continue;
    const pf = Math.min(frames.length - 1, p.f + 3);
    chosen.push({ t, pitch: estimatePitch(frames[pf], sr, n) });
  }
  return chosen.sort((a, b) => a.t - b.t);
}

/** Load MIDI notes in [start, start+duration), reduced to a melody line (highest note per onset). */
export function midiMelody(file, { start = 0, duration = 1e9, track = null, minGap = 0.08 } = {}) {
  const { Midi } = require('@tonejs/midi');
  const midi = new Midi(fs.readFileSync(file));
  let tracks = midi.tracks.filter((tr) => tr.notes.length && !(tr.instrument && tr.instrument.percussion));
  if (track !== null && track !== undefined) tracks = [midi.tracks[track]];
  const notes = tracks.flatMap((tr) => tr.notes)
    .filter((nt) => nt.time >= start && nt.time < start + duration)
    .map((nt) => ({ t: nt.time - start, pitch: nt.midi, dur: nt.duration, vel: nt.velocity }))
    .sort((a, b) => a.t - b.t || b.pitch - a.pitch);
  return skyline(notes, minGap);
}

/** Inline notes: [[time, midi, duration?], ...] or [{t, pitch, dur}] */
export function inlineNotes(list, minGap = 0.08) {
  const notes = list.map((n) => Array.isArray(n) ? { t: n[0], pitch: n[1], dur: n[2] ?? 0.4, vel: 0.8 } : { vel: 0.8, dur: 0.4, ...n });
  return skyline(notes.sort((a, b) => a.t - b.t || b.pitch - a.pitch), minGap);
}

function skyline(notes, minGap) {
  const out = [];
  for (const n of notes) {
    const last = out[out.length - 1];
    if (last && n.t - last.t < 0.03) { if (n.pitch > last.pitch) Object.assign(last, n); continue; }
    if (last && n.t - last.t < minGap) continue;
    out.push({ ...n });
  }
  return out;
}

// ---------- Synth (for MIDI / inline notes with no audio file) ----------
/** Render notes as a bright mallet/chime sound. Returns Float32Array at sr. */
export function synthNotes(notes, duration, sr = 44100, { volume = 0.5 } = {}) {
  const out = new Float32Array(Math.ceil(duration * sr));
  for (const n of notes) {
    const f = 440 * Math.pow(2, (n.pitch - 69) / 12);
    const len = Math.min(out.length - Math.floor(n.t * sr), Math.floor(sr * Math.max(1.2, (n.dur || 0.4) + 0.8)));
    const s0 = Math.floor(n.t * sr);
    const amp = volume * (0.6 + 0.4 * (n.vel ?? 0.8));
    const partials = [[1, 1, 3.2], [2.0, 0.35, 6], [3.0, 0.12, 9], [4.07, 0.08, 14]];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.004);
      let v = 0;
      for (const [ratio, a, decay] of partials) v += a * Math.exp(-decay * t) * Math.sin(2 * Math.PI * f * ratio * t);
      out[s0 + i] += amp * attack * v * 0.5;
    }
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.95) for (let i = 0; i < out.length; i++) out[i] *= 0.95 / peak;
  return out;
}

export function writeWav(file, pcm, sr) {
  const data = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

export function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(String(r.stdout)) || 0;
}
