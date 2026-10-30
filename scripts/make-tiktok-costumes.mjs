// Renders the "trying on Halloween costumes" TikTok from scripts/tiktok-costumes.html.
// Usage: npx vite --port 5199 &  then  node scripts/make-tiktok-costumes.mjs out/dir
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] || 'out/tiktok';
mkdirSync(`${out}/frames`, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('http://localhost:5199/scripts/tiktok-costumes.html');
await page.waitForFunction(() => window.ready === true);
const n = await page.evaluate(() => window.frameCount);
for (let i = 0; i < n; i++) {
  const data = await page.evaluate((k) => {
    window.renderFrame(k);
    return document.getElementById('c').toDataURL('image/png');
  }, i);
  writeFileSync(`${out}/frames/${String(i).padStart(4, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
await browser.close();
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', `${out}/frames/%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-movflags', '+faststart', `${out}/one-more-crypt-costumes.mp4`]);
console.log(`wrote ${out}/one-more-crypt-costumes.mp4 (${n} frames)`);
