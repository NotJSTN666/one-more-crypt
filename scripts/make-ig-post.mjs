// Renders the Instagram carousel slides from scripts/ig-post.html into brand/.
// Usage: npx vite --port 5199 &  then  node scripts/make-ig-post.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('brand', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
await page.goto('http://localhost:5199/scripts/ig-post.html');
await page.waitForFunction(() => window.ready === true);
for (let n = 1; n <= 6; n++) {
  await page.evaluate((i) => window.draw(i), n);
  await page.locator('#slide').screenshot({ path: `brand/ig-post-${n}.png` });
  console.log(`wrote brand/ig-post-${n}.png`);
}
await browser.close();
