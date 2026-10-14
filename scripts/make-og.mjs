// Renders public/og.png (the X / social link preview) from scripts/og.html.
// Usage: npx vite --port 5199 &  then  node scripts/make-og.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('http://localhost:5199/scripts/og.html');
await page.waitForFunction(() => window.ogReady === true);
await page.locator('#c').screenshot({ path: 'public/og.png' });
await browser.close();
console.log('wrote public/og.png');
