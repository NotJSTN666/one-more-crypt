// Makes the day's TikTok: today's idea from ideas.mjs, recorded as real gameplay with the
// game's own music under it, plus the caption and hashtags to post with it.
//
//   node scripts/tiktok/daily.mjs [YYYY-MM-DD] [out dir]
//
// Writes <out>/one-more-crypt-<date>.mp4 and caption.txt (default out/tiktok/<date>). Starts
// the dev server on port 5199 if it isn't running.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
// On the cloud machines Chromium is preinstalled at a fixed path, whatever Playwright version the
// project pins; elsewhere Playwright finds its own.
const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
import { readFileSync, readdirSync } from 'node:fs';
import { ideaFor } from './ideas.mjs';

const central = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const date = process.argv[2] || central;
const out = process.argv[3] || `out/tiktok/${date}`;
mkdirSync(out, { recursive: true });
// A trend for the day (out/tiktok/<date>/trend.json, written after looking at what's trending):
// anything in it replaces the day's idea (hook, caption, tags, scene, hero, seconds, ...), and
// `sound` names the trending sound to add in the TikTok app.
const trendFile = `${out}/trend.json`;
const trend = existsSync(trendFile) ? JSON.parse(readFileSync(trendFile, 'utf8')) : {};
const idea = { ...ideaFor(date), ...trend };

// the dev server
const up = async () => { try { await fetch('http://localhost:5199/'); return true; } catch { return false; } };
if (!(await up())) {
  spawn('npx', ['vite', '--port', '5199'], { detached: true, stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'test' } }).unref();
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
}

// 1. the gameplay
writeFileSync(`${out}/idea.json`, JSON.stringify(idea));
execFileSync('node', [new URL('./record.mjs', import.meta.url).pathname, `${out}/idea.json`, out], { stdio: 'inherit' });

// 2. the music: the Night Shift's score, rendered offline, hot from the start
// as long as the clip came out (a run that ends in death plays on past `seconds`)
const seconds = readdirSync(`${out}/frames`).length / 30;
const browser = await chromium.launch(BROWSER);
const page = await browser.newPage();
// On a page with no game running (only the audio module is loaded), so nothing else the game
// plays while it starts up can leak into the render.
await page.goto('http://localhost:5199/privacy.html');
/** Render a piece of the game's audio offline to a WAV file: the Night Shift's score, the crypt's
 * music at some intensity, or one sound effect. */
const renderWav = async (spec, file) => {
  const wav = await page.evaluate(async (spec) => {
    const a = await import('/src/audio.ts');
    const buf = spec.kind === 'night' ? await a.renderNight(spec.seconds, () => ({ heat: 3, boss: spec.boss }))
      : spec.kind === 'crypt' ? await a.renderCrypt(spec.seconds, spec.intensity)
      : await a.renderSfx(spec.name, [], spec.seconds);
    const n = buf.length, ch = buf.numberOfChannels;
    const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true);
    data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, n * ch * 2, true);
    const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
    for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) data.setInt16(o, Math.max(-1, Math.min(1, chans[c][i])) * 32767, true);
    let s = '';
    const bytes = new Uint8Array(data.buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, spec);
  writeFileSync(file, Buffer.from(wav, 'base64'));
};
const marks = existsSync(`${out}/marks.json`) ? JSON.parse(readFileSync(`${out}/marks.json`, 'utf8')) : {};
const deathClip = marks.death !== undefined;
if (!deathClip) {
  await renderWav({ kind: 'night', seconds: seconds + 0.5, boss: Boolean(idea.boss) }, `${out}/music.wav`);
} else {
  // A run that ends with Death: the crypt's music, quiet on the first floors and at full tilt
  // after the cut deeper, Death's bell as he rises, then the music stops dead on his touch and
  // the hero's death sound plays into the black.
  const J = marks.jumps?.[0] ?? 0;
  const D = marks.death;
  const R = marks.rise ?? Math.max(0, D - 2);
  await renderWav({ kind: 'crypt', seconds: J + 1, intensity: 1 }, `${out}/m1.wav`);
  await renderWav({ kind: 'crypt', seconds: D - J + 1, intensity: 4 }, `${out}/m2.wav`);
  await renderWav({ kind: 'sfx', name: 'toll', seconds: 3 }, `${out}/toll.wav`);
  await renderWav({ kind: 'sfx', name: 'death', seconds: 3 }, `${out}/death.wav`);
  const ms = (t) => Math.round(t * 1000);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', `${out}/m1.wav`, '-i', `${out}/m2.wav`, '-i', `${out}/toll.wav`, '-i', `${out}/death.wav`, '-filter_complex',
    `[0]atrim=0:${J.toFixed(3)},afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, J - 0.2).toFixed(3)}:d=0.2[a];` +
    `[1]atrim=0:${(D - J).toFixed(3)},afade=t=in:d=0.15,afade=t=out:st=${Math.max(0, D - J - 0.05).toFixed(3)}:d=0.05,adelay=${ms(J)}|${ms(J)}[b];` +
    `[2]volume=1.3,adelay=${ms(R)}|${ms(R)}[t];[3]volume=3,adelay=${ms(D)}|${ms(D)}[d];` +
    `[a][b][t][d]amix=inputs=4:normalize=0,apad=whole_dur=${(seconds + 0.5).toFixed(2)}[o]`,
    '-map', '[o]', `${out}/music.wav`]);
}
await browser.close();

// 3. together, with the music fading out over the end card
const video = `${out}/one-more-crypt-${date}.mp4`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', `${out}/frames/%05d.jpg`, '-i', `${out}/music.wav`,
  '-af', deathClip ? 'volume=1.6' : `afade=t=in:d=0.3,afade=t=out:st=${(seconds - 1.5).toFixed(2)}:d=1.5,volume=1.6`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', video]);
// and a copy with no music, to post with a trending sound added in the TikTok app
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', `${out}/frames/%05d.jpg`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', `${out}/one-more-crypt-${date}-no-music.mp4`]);
const caption = `${idea.caption}\n\n${idea.tags.join(' ')}\n`;
if (idea.sound) writeFileSync(`${out}/sound.txt`, `${idea.sound}\n`);
writeFileSync(`${out}/caption.txt`, caption);
console.log(`wrote ${video}\n\n${caption}`);
