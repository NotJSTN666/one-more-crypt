// Renders the Instagram story artwork from scripts/story.html into brand/.
// Usage: npx vite --port 5199 &  then  node scripts/make-story.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('brand', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const [query, file] of [['', 'brand/ig-story.png'], ['?frame=1', 'brand/ig-story-frame.png']]) {
  await page.goto(`http://localhost:5199/scripts/story.html${query}`);
  await page.waitForFunction(() => window.ready === true);
  await page.locator('#story').screenshot({ path: file });
  console.log('wrote', file);
}
await browser.close();
