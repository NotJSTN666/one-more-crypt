// Renders the profile picture and cover images from scripts/x-brand.html into brand/:
//   profile.png        800x800, for X, Instagram, Discord (server icon) and itch.io
//   x-header.png       1500x500, the X header
//   discord-banner.png 960x540, the Discord server banner
//   itch-cover.png     630x500, the itch.io cover image
// Usage: npx vite --port 5199 &  then  node scripts/make-x-brand.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('brand', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 2600 } });
await page.goto('http://localhost:5199/scripts/x-brand.html');
await page.waitForFunction(() => window.brandReady === true);
for (const [id, file] of [['avatar', 'profile'], ['header', 'x-header'], ['discord', 'discord-banner'], ['itch', 'itch-cover']]) {
  await page.locator(`#${id}`).screenshot({ path: `brand/${file}.png` });
}
await browser.close();
console.log('wrote brand/profile.png, x-header.png, discord-banner.png and itch-cover.png');
