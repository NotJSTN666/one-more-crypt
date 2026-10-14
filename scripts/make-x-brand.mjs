// Renders the X profile picture and header from scripts/x-brand.html into brand/.
// Usage: npx vite --port 5199 &  then  node scripts/make-x-brand.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('brand', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1400 } });
await page.goto('http://localhost:5199/scripts/x-brand.html');
await page.waitForFunction(() => window.brandReady === true);
await page.locator('#avatar').screenshot({ path: 'brand/x-profile.png' });
await page.locator('#header').screenshot({ path: 'brand/x-header.png' });
await browser.close();
console.log('wrote brand/x-profile.png and brand/x-header.png');
