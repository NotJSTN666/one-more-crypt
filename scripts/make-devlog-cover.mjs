// Renders scripts/devlog-cover.html into out/itch/: devlog-cover-midwinter.png (a still) and
// devlog-cover-midwinter.gif (32 frames, 80 ms each, looping). Needs the dev server on 5199 and
// a screenshot of a snowy crypt for the background:
//   node scripts/make-devlog-cover.mjs out/itch/media-2026-11-28/04-winter-crypt.png
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const BROWSER = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const FRAMES = 32;
const bg = `data:image/png;base64,${readFileSync(process.argv[2]).toString('base64')}`;
const dir = 'out/itch/cover-frames';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const b = await chromium.launch(BROWSER);
const p = await b.newPage({ viewport: { width: 700, height: 560 } });
await p.addInitScript((src) => { window.BG = src; }, bg);
await p.goto('http://localhost:5199/scripts/devlog-cover.html');
await p.waitForFunction(() => window.coverReady === true);
for (let i = 0; i < FRAMES; i++) {
  await p.evaluate((x) => window.frame(x), i / FRAMES);
  await p.locator('#cover').screenshot({ path: `${dir}/${String(i).padStart(2, '0')}.png` });
}
await b.close();
execFileSync('python3', ['-c', `
from PIL import Image
import glob
fs = sorted(glob.glob('${dir}/*.png'))
frames = [Image.open(f).convert('RGB') for f in fs]
frames[0].save('out/itch/devlog-cover-midwinter.png')
pal = frames[0].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
q[0].save('out/itch/devlog-cover-midwinter.gif', save_all=True, append_images=q[1:], duration=80, loop=0, optimize=True)
`]);
console.log('wrote out/itch/devlog-cover-midwinter.png and .gif');
