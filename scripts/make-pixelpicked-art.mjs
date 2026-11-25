// Renders scripts/pixelpicked-art.html into out/pixelpicked/: cover-1920x1080.png, icon-a.png and icon-b.png.
// Needs a board screenshot (a square PNG of #board) and the dev server on port 5199:
//   npx vite --port 5199 &  then  node scripts/make-pixelpicked-art.mjs board.png
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const board = `data:image/png;base64,${readFileSync(process.argv[2]).toString('base64')}`;
mkdirSync('out/pixelpicked', { recursive: true });
const b = await chromium.launch(BROWSER);
const p = await b.newPage({ viewport: { width: 2000, height: 2300 } });
await p.addInitScript((src) => { window.BOARD = src; }, board);
await p.goto('http://localhost:5199/scripts/pixelpicked-art.html');
await p.waitForFunction(() => window.artReady === true);
for (const [id, file] of [['banner', 'cover-1920x1080'], ['icon', 'icon-a'], ['icon2', 'icon-b']]) await p.locator(`#${id}`).screenshot({ path: `out/pixelpicked/${file}.png` });
await b.close();
console.log('wrote out/pixelpicked/cover-1920x1080.png, icon-a.png and icon-b.png');
