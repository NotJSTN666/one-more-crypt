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
import { ideaFor } from './ideas.mjs';

const central = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const date = process.argv[2] || central;
const out = process.argv[3] || `out/tiktok/${date}`;
mkdirSync(out, { recursive: true });
const idea = ideaFor(date);

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
const seconds = (idea.seconds ?? 11) + 2.2;
const browser = await chromium.launch(BROWSER);
const page = await browser.newPage();
// On a page with no game running (only the audio module is loaded), so nothing else the game
// plays while it starts up can leak into the render.
await page.goto('http://localhost:5199/privacy.html');
const wav = await page.evaluate(async ({ seconds, boss }) => {
  const { renderNight } = await import('/src/audio.ts');
  const buf = await renderNight(seconds + 0.5, () => ({ heat: 3, boss }));
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
}, { seconds, boss: Boolean(idea.boss) });
await browser.close();
writeFileSync(`${out}/music.wav`, Buffer.from(wav, 'base64'));

// 3. together, with the music fading out over the end card
const video = `${out}/one-more-crypt-${date}.mp4`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', `${out}/frames/%05d.jpg`, '-i', `${out}/music.wav`,
  '-af', `afade=t=in:d=0.3,afade=t=out:st=${(seconds - 1.5).toFixed(2)}:d=1.5,volume=1.6`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', video]);
const caption = `${idea.caption}\n\n${idea.tags.join(' ')}\n`;
writeFileSync(`${out}/caption.txt`, caption);
console.log(`wrote ${video}\n\n${caption}`);
