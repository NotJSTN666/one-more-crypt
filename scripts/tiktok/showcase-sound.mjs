// Puts the sound under a take recorded by showcase.mjs and writes the finished video. The music
// climbs: the title menu's quiet score under the first clip, then the Night Shift's score with its
// heat rising clip by clip, the boss music from the Night Shift on, and a fade under the end card.
// The Soul Forge's sound plays at each fusion and every sound effect at its own moment.
//
//   node scripts/tiktok/showcase-sound.mjs <take dir> <out.mp4>
//
// Everything is rendered on a page with no game running (only the audio module is loaded), so
// nothing else can leak into the tracks. Needs the dev server: npx vite --port 5199
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
// On the cloud machines Chromium is preinstalled at a fixed path, whatever Playwright version the
// project pins; elsewhere Playwright finds its own.
const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};

const [, , dir, out] = process.argv;
const marks = JSON.parse(readFileSync(`${dir}/marks.json`, 'utf8'));
const browser = await chromium.launch(BROWSER);
const page = await browser.newPage();
await page.goto('http://localhost:5199/privacy.html');
const tracks = await page.evaluate(async ({ total, events, cuts, ult }) => {
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

  const menu = await a.renderMenu(cuts[1] + 1.5);
  // heat climbs from 0 to 4 between the end of the title and the ultimate; the boss score after the Night Shift starts
  const rise = cuts[1], top = ult ?? total * 0.8, boss = (ult ?? total) - 3.4;
  const night = await a.renderNight(total + 0.5, (t) => ({ heat: Math.max(0, Math.min(4, Math.floor(((t - rise) / (top - rise)) * 4.99))), boss: t >= boss }));
  const music = new OfflineAudioContext(2, night.length, RATE).createBuffer(2, night.length, RATE);
  const X0 = Math.round((cuts[1] - 0.4) * RATE), X1 = Math.round((cuts[1] + 0.6) * RATE);
  for (let c = 0; c < 2; c++) {
    const m = menu.getChannelData(Math.min(c, menu.numberOfChannels - 1)), nn = night.getChannelData(Math.min(c, night.numberOfChannels - 1)), o = music.getChannelData(c);
    for (let i = 0; i < o.length; i++) {
      const k = i < X0 ? 0 : i > X1 ? 1 : (i - X0) / (X1 - X0);
      o[i] = (i < m.length ? m[i] * (1 - k) * 1.3 : 0) + nn[i] * k;
    }
  }
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
}, { total: marks.total, events: marks.sfx ?? [], cuts: marks.cuts, ult: marks.ults?.[0] });
await browser.close();
for (const k of ['music', 'forge', 'sfx']) writeFileSync(`${dir}/${k}.wav`, Buffer.from(tracks[k], 'base64'));
console.log('sound effects:', JSON.stringify(tracks.counts));

const F = marks.fuses?.[0] ?? 1e4;
const duck = `if(between(t,${F},${F + 3.4}),0.4,if(between(t,${F + 3.4},${F + 4}),0.4+(t-${F + 3.4}),1))`;
const U = marks.ults?.[0] ?? marks.total * 0.8;
const swell = `0.5+0.5*min(1,t/${U.toFixed(2)})`;
const fade = `afade=t=in:d=0.3,afade=t=out:st=${(marks.end + 1.2).toFixed(2)}:d=${(marks.total - marks.end - 1.2).toFixed(2)}`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', `${dir}/frames/%05d.jpg`, '-i', `${dir}/music.wav`, '-i', `${dir}/forge.wav`, '-i', `${dir}/sfx.wav`,
  '-filter_complex',
  `[1:a]volume=4.4,volume='${swell}':eval=frame,volume='${duck}':eval=frame,${fade}[m];[2:a]adelay=${Math.round(F * 1000)}|${Math.round(F * 1000)},volume=1.1[f];[3:a]volume=2.2,${fade}[s];[m][f][s]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.95[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
console.log(`wrote ${out}`);
