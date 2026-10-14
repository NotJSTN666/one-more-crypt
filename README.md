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
- **Accounts and leaderboards:** claim a name in one tap (guest account), or sign in with email or X. There's a daily leaderboard per crypt, an all-time endless leaderboard, and a profile page with your stats.

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
| `src/online.ts` | Supabase calls: sign-in, run upload, leaderboards |
| `src/social.ts` | Sign-in, profile and leaderboard screens |
| `supabase/schema.sql` | Database tables, security rules and leaderboard views |

## Online features (Supabase)

With no configuration the game runs fully offline: names and progress are saved on the device and the leaderboard is hidden. To turn on accounts and leaderboards:

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and click **Run**.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**. Email sign-in is on by default.
4. **Authentication → URL Configuration**: set **Site URL** to the game's address (for example `https://notjstn666.github.io/cryptfall/`) and add the same URL under **Redirect URLs**.
5. **Authentication → Emails → Magic Link**: add `Your code: {{ .Token }}` to the template. Players who open the email outside the game's browser (common in the X app) can then type the code instead of tapping the link.
6. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
7. In this GitHub repo, go to **Settings → Secrets and variables → Actions → Variables** and add `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Then re-run the deploy workflow.

The anon key is designed to be public; the security rules in `schema.sql` decide what it can do. Players can only submit runs for themselves, get one daily attempt each, and can't submit dailies for other days. Anyone can read the leaderboards.

Optional:
- **Sign in with X:** create an app in the X developer portal, enable the **Twitter** provider in Supabase with its keys, then add a repo variable `AUTH_X` = `true`.
- **Before a big launch:** Supabase's built-in email sender only allows a few emails an hour. Set up custom SMTP (for example Resend, which has a free tier) under **Authentication → Emails → SMTP Settings**.

Every run uploads its full input log. The game is deterministic, so `Game.replay()` rebuilds any run from its log, which makes it possible to check leaderboard entries for cheating.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**.

The site's address in the link-preview tags is worked out from the repo name at build time, so renaming the repo needs no code change. For a custom domain, set a repo variable `SITE_URL` (e.g. `https://cryptfall.gg/`).

The social preview image is `public/og.png`. To regenerate it, run `npx vite --port 5199` and then `node scripts/make-og.mjs` (needs Playwright installed).
