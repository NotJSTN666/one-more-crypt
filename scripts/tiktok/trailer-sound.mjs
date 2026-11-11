// Puts the sound under a take recorded by trailer.mjs and writes the finished video:
// the title menu music, the Soul Forge's sound at the fusion (the music dips under it), and
// every sound effect the game asked for during the take, each at its own moment.
//
//   node scripts/tiktok/trailer-sound.mjs <take dir> <out.mp4>
//
// Everything is rendered on a page with no game running (only the audio module is loaded), so
// nothing else can leak into the tracks. Needs the dev server: npx vite --port 5199
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const [, , dir, out] = process.argv;
const marks = JSON.parse(readFileSync(`${dir}/marks.json`, 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5199/privacy.html');
const tracks = await page.evaluate(async ({ total, events }) => {
  const a = await import('/src/audio.ts');
  const RATE = 44100;
  const wav = (chans) => {
    const n = chans[0].length, ch = chans.length;
    const d = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); d.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, ch, true);
    d.setUint32(24, RATE, true); d.setUint32(28, RATE * ch * 2, true);
    d.setUint16(32, ch * 2, true); d.setUint16(34, 16, true); str(36, 'data'); d.setUint32(40, n * ch * 2, true);
    for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) d.setInt16(o, Math.max(-1, Math.min(1, chans[c][i])) * 32767, true);
    let s = '';
    const bytes = new Uint8Array(d.buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const both = (buf) => [buf.getChannelData(0), buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0)];

  const music = await a.renderMenu(total + 0.5);
  const forgeCtx = new OfflineAudioContext(2, RATE * 4.6, RATE);
  a.fusionSound(false, 1.9, forgeCtx);
  const forge = await forgeCtx.startRendering();

  // the effects: each kind rendered once, then laid in wherever the game played it
  const n = Math.ceil((total + 0.5) * RATE);
  const mix = [new Float32Array(n), new Float32Array(n)];
  const made = new Map();
  const counts = {};
  for (const e of events) {
    const key = `${e.name}:${JSON.stringify(e.args)}`;
    if (!made.has(key)) made.set(key, both(await a.renderSfx(e.name, e.args, 3)));
    counts[e.name] = (counts[e.name] ?? 0) + 1;
    const at = Math.max(0, Math.round(e.t * RATE));
    made.get(key).forEach((src, c) => {
      for (let i = 0; i < src.length && at + i < n; i++) mix[c][at + i] += src[i];
    });
  }
  return { music: wav(both(music)), forge: wav(both(forge)), sfx: wav(mix), counts };
}, { total: marks.total, events: marks.sfx ?? [] });
await browser.close();
for (const k of ['music', 'forge', 'sfx']) writeFileSync(`${dir}/${k}.wav`, Buffer.from(tracks[k], 'base64'));
console.log('sound effects:', JSON.stringify(tracks.counts));

const F = marks.fuse;
const duck = `if(between(t,${F - 0.4},${F}),1-0.55*(t-${F - 0.4})/0.4,if(between(t,${F},${F + 3.6}),0.45,if(between(t,${F + 3.6},${F + 4.6}),0.45+0.55*(t-${F + 3.6}),1)))`;
const fade = `afade=t=in:d=0.5,afade=t=out:st=${(marks.end + 0.8).toFixed(2)}:d=2.1`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '60', '-i', `${dir}/frames/%05d.jpg`, '-i', `${dir}/music.wav`, '-i', `${dir}/forge.wav`, '-i', `${dir}/sfx.wav`,
  '-filter_complex',
  `[1:a]volume=4.0,volume='${duck}':eval=frame,${fade}[m];[2:a]adelay=${Math.round(F * 1000)}|${Math.round(F * 1000)},volume=1.1[f];[3:a]volume=2.6,${fade}[s];[m][f][s]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.95[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
console.log(`wrote ${out}`);
