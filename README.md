# Cryptfall

A daily dark-fantasy roguelite that runs in the browser. Same crypt for everyone, one attempt a day. Players go down floor by floor, stack relics into broken builds, and share how deep they got.

**Play:** https://notjstn666.github.io/Browser-game/

## How it plays

- 7×7 single-screen floors in a turn-based grid. Every move you make, every enemy makes one.
- Bump into an enemy to attack it. Kill everything on the floor to unseal the stairs.
- After each floor, take 1 of 3 relics or rest. Relics stack: 2 Vampire Fangs heal for 2.
- The Bone Warden boss waits every 5th floor.
- **Daily Descent:** a seed fixed by the UTC date, one official attempt, with a Wordle-style share card for X.
- **Endless:** random seeds for practice. Your best depth is saved.

Controls: arrows / WASD / hjkl to move, Space to wait. On mobile, swipe, tap a tile, or use the d-pad.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # logic tests + a bot that plays 300 full runs
npm run build    # static build into dist/
```

Run `BALANCE=1 npx vitest run` to print how deep a simple bot gets, as a quick balance check.

No game engine: TypeScript, Vite and a `<canvas>`. Sprites are 12×12 pixel art written as strings in `src/sprites.ts`, and sound effects are synthesized with WebAudio, so there are no asset downloads. The gzipped build is about 16 KB of JS.

| File | What it does |
| --- | --- |
| `src/game.ts` | All game rules (pure logic, no DOM) |
| `src/relics.ts` | Relic catalogue: add new relics here, effects go in `game.ts` |
| `src/render.ts` | Canvas renderer, particles, lighting |
| `src/main.ts` | UI, input, overlays |
| `src/share.ts` | Share text for X |
| `src/daily.ts` | Daily numbering (Daily #1 = 2026-10-14 UTC) |

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**.

The social preview image is `public/og.png`. To regenerate it, run `npx vite --port 5199` and then `node scripts/make-og.mjs` (needs Playwright installed).
