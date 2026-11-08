#!/usr/bin/env node
// Marble music video generator.
//   node make-video.mjs songs.json [--out out/video.mp4] [--preview] [--fps 30] [--analyze-only] [--limit 10]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { decodeAudio, detectHits, midiMelody, inlineNotes, synthNotes, writeWav, probeDuration } from './lib/analyze.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SR = 44100;

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) o[k] = true; else { o[k] = nx; i++; } }
    else o._.push(a);
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
if (!args._[0]) {
  console.log('Usage: node make-video.mjs <songs.json> [--out out/video.mp4] [--preview] [--fps 30] [--analyze-only] [--limit SECONDS] [--gpu]');
  process.exit(1);
}
const cfgPath = path.resolve(args._[0]);
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const cfgDir = path.dirname(cfgPath);
const rel = (p) => (p ? path.resolve(cfgDir, p) : p);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'marble-'));

const fps = Number(args.fps ?? cfg.fps ?? 30);
const [W, H] = args.preview ? [540, 960] : [Number(cfg.width ?? 1080), Number(cfg.height ?? 1920)];
const out = path.resolve(args.out ?? path.join(ROOT, 'out', path.basename(cfgPath, '.json') + '.mp4'));
const gapBetween = Number(cfg.gapBetweenSongs ?? 0.25);

// ---------- 1. Build each song clip: audio wav + hit list ----------
const songs = cfg.songs ?? [];
if (!songs.length) throw new Error('songs.json needs a "songs" array');
const clips = [];
let offset = Number(cfg.leadIn ?? 0.6);
for (const [i, sg] of songs.entries()) {
  const start = Number(sg.start ?? 0);
  let duration = Number(sg.duration ?? cfg.clipSeconds ?? 9);
  const wav = path.join(tmp, `clip${i}.wav`);
  let hits;
  if (sg.audio) {
    const file = rel(sg.audio);
    if (!fs.existsSync(file)) throw new Error(`Song file not found: ${file}`);
    duration = Math.min(duration, Math.max(0.5, probeDuration(file) - start));
    const fadeOut = Math.min(0.6, duration / 4);
    const vol = sg.volume ?? 1;
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-t', String(duration), '-i', file,
      '-af', `volume=${vol},afade=t=in:d=0.04,afade=t=out:st=${(duration - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`,
      '-ac', '2', '-ar', String(SR), wav]);
    if (r.status !== 0) throw new Error(String(r.stderr));
    if (sg.hits) hits = sg.hits.map((h) => (typeof h === 'number' ? { t: h, pitch: 60 } : h));
    else if (sg.midi) hits = midiMelody(rel(sg.midi), { start: Number(sg.midiStart ?? start), duration, track: sg.track });
    else hits = detectHits(decodeAudio(file, start, duration, 22050), 22050, { hitsPerSecond: sg.hitsPerSecond ?? cfg.hitsPerSecond ?? 4, minGap: sg.minGap ?? 0.13 });
  } else if (sg.midi || sg.notes) {
    const notes = sg.midi ? midiMelody(rel(sg.midi), { start, duration, track: sg.track }) : inlineNotes(sg.notes);
    if (sg.notes && !sg.duration) duration = Math.max(...notes.map((n) => n.t + (n.dur ?? 0.4))) + 0.6;
    writeWav(wav, synthNotes(notes, duration, SR, { volume: sg.volume ?? 0.5 }), SR);
    hits = notes;
  } else throw new Error(`Song ${i + 1} ("${sg.name}") needs "audio", "midi" or "notes"`);
  hits = hits.filter((h) => h.t >= 0 && h.t < duration);
  if (sg.hitOffset) hits = hits.map((h) => ({ ...h, t: h.t + Number(sg.hitOffset) }));
  clips.push({ ...sg, wav, duration, offset, hits });
  console.log(`  ${String(i + 1).padStart(2)}. ${sg.name ?? '(untitled)'}  ${duration.toFixed(1)}s  ${hits.length} hits`);
  offset += duration + gapBetween;
}
const total = offset - gapBetween + Number(cfg.tail ?? 1.2);

if (args['analyze-only']) {
  for (const c of clips) console.log(`\n${c.name}:\n` + c.hits.map((h) => `${h.t.toFixed(2)}s  midi ${h.pitch}`).join('\n'));
  process.exit(0);
}

// ---------- 2. Mix the audio timeline ----------
const audioOut = path.join(tmp, 'mix.wav');
{
  const inputs = clips.flatMap((c) => ['-i', c.wav]);
  const filters = clips.map((c, i) => `[${i}:a]aformat=sample_rates=${SR}:channel_layouts=stereo,adelay=${Math.round(c.offset * 1000)}|${Math.round(c.offset * 1000)}[a${i}]`);
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,apad=whole_dur=${total.toFixed(3)}[out]`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', [...filters, mix].join(';'), '-map', '[out]', '-t', total.toFixed(3), audioOut]);
  if (r.status !== 0) throw new Error(String(r.stderr));
}

// ---------- 3. Global hit timeline + list overlay data ----------
const hits = clips.flatMap((c) => c.hits.map((h) => ({ t: h.t + c.offset, pitch: h.pitch })));
const n = clips.length;
const countdown = cfg.countdown ?? true;
const entries = clips.map((c, i) => ({ rank: c.rank ?? (countdown ? n - i : i + 1), name: c.name ?? `Song ${i + 1}`, revealAt: c.offset + Number(cfg.revealDelay ?? 0.4) }));
const data = {
  width: W, height: H, fps, duration: total, hits, entries,
  title: cfg.title ?? `Top ${n} Songs`, handle: cfg.handle, font: cfg.font ?? 'Inter',
  showList: cfg.showList ?? n > 1,
  current: clips.map((c) => ({ at: c.offset, name: c.name })),
  seed: cfg.seed ?? 7, colorMode: cfg.colorMode, background: cfg.background, floor: cfg.floor,
  bloom: cfg.bloom, railGap: cfg.railGap, decoration: cfg.decoration, cameraDistance: cfg.cameraDistance, litGlow: cfg.litGlow,
};

// ---------- 4. Render frames in headless Chromium, pipe into ffmpeg ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const { chromium } = require('playwright');
const browser = await chromium.launch({
  args: args.gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/render/scene.html`);
await page.waitForFunction(() => window.sceneReady === true);
const info = await page.evaluate((d) => window.setup(d), data);
console.log(`Scene: ${info.tubes} tubes, ${info.rails} rails. Rendering ${W}x${H} @ ${fps}fps, ${total.toFixed(1)}s`);

fs.mkdirSync(path.dirname(out), { recursive: true });
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-i', audioOut, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(cfg.crf ?? 18), '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((r) => ff.on('close', r));

const limit = args.limit ? Math.min(total, Number(args.limit)) : total;
const frames = Math.ceil(limit * fps);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const url = await page.evaluate((t) => window.renderFrame(t), f / fps);
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % fps === 0 || f === frames - 1) {
    const el = (Date.now() - t0) / 1000, eta = (el / (f + 1)) * (frames - f - 1);
    process.stdout.write(`\r  frame ${f + 1}/${frames}  ${(el).toFixed(0)}s elapsed, ~${eta.toFixed(0)}s left   `);
  }
}
ff.stdin.end();
const code = await ffDone;
await browser.close(); server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(code === 0 ? `\nDone: ${out}` : `\nffmpeg failed (${code})`);
process.exit(code === 0 ? 0 : 1);
