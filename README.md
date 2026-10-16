# One More Crypt

A daily dark-fantasy roguelite that runs in the browser. Same crypt for everyone, one attempt a day. Players go down floor by floor, stack relics into broken builds, and share how deep they got.

**Play:** https://onemorecrypt.com/

**Roblox:** a Roblox version, sharing the same daily crypt, lives in [`roblox/`](roblox/README.md). Open `roblox/OneMoreCrypt.rbxlx` in Roblox Studio and publish it.

## How it plays

- **Tutorial:** first-time players are offered a one-minute guided run (move, strike, dodge, descend, claim a relic), also playable from How to play. How to play itself shows each rule as a small live scene.
- New relics, heroes and combos never change a run already played: run logs carry a version, so launch-era runs (and Daily #1) replay with the launch relic set.
- 7×7 single-screen floors in a turn-based grid. Every move you make, every enemy makes one.
- Bump into an enemy to attack it. Kill everything on the floor to unseal the stairs.
- After each floor, take 1 of 3 relics or rest. Relics stack: 2 Vampire Fangs heal for 2.
- Seven heroes: the Knight, the Rogue (every 3rd step is free), the Necromancer (slain foes rise as thralls), the Paladin (smites the undead), the Ranger (shoots down straight lines), the Mage (glass cannon) and the Barbarian (hits harder as he bleeds).
- Elite foes with special tricks, spike traps you can lure enemies across, and floor events (Blood Shrine, Iron Chest, Pale Fountain).
- A boss every 5th floor: the Bone Warden, the Plague Abbot, then the Lich King. Below floor 30, the Abyss makes every hit hurt more.
- **Souls and the Ossuary:** every run earns Souls to unlock heroes and ten forbidden relics for Endless.
- **Grimoire:** a codex of 41 relics, 12 fusions, 6 ascended relics, 47 achievements and 18 named relic combos.
- **Soul Forge:** on the floor after each boss, fuse two relics into a stronger one. From floor 21, fuse two fused relics into an ascended relic.
- **The Hollow:** a walkable graveyard hub. Every building is a door into the game, old graves hold epitaphs, and today's best players wander it as ghosts.
- **Crypt Hall:** a shareable trophy room with Soul Ranks, titles, hero looks and the Bestiary.
- **Runs resume:** closing the tab mid-run loses nothing; the run is rebuilt from its saved inputs.
- **Daily Descent:** a new crypt at midnight Central Time, a seed fixed by that date, a hero of the day, one official attempt, and a Wordle-style share card for X. The results screen says what percentage of today's players you beat.
- **Endless:** random seeds for practice. Your best depth is saved.
- **The hero changes with every relic:** new weapons (pike, scythe, flaming or frozen blades), armour, shields, crowns, horns, cloak colours, and matching auras. The results screen shows your final form.
- **Background music:** a synthwave score generated in the browser that builds as you descend: a hazy pad on the menus, then kick and bass, snare and hats from floor 10, a lead arpeggio from floor 20 and double-time drums in the Abyss (floor 30+). Boss floors play one level hotter, and the death screen gets a slow lament. Music toggle in the pause menu.
- **Live player count:** "12 souls in the crypt right now" on the title, pause and results screens, using Supabase Realtime Presence. It only counts visible tabs. The free plan allows 200 players connected at once.
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
| `src/content.ts` | Heroes, elites, floor events, combos and achievements |
| `src/meta.ts` | Souls, unlocks, achievements and codex that carry between runs |
| `src/progress-ui.ts` | Hero select, Ossuary and Grimoire screens |
| `src/hero.ts` | The hero sprite, layered by relic (preview every look at `/scripts/heroes.html` under `npm run dev`) |
| `src/audio.ts` | Synthesized sound effects and the generative background music |
| `src/main.ts` | UI, input, overlays |
| `src/share.ts` | Share text for X |
| `src/daily.ts` | Daily numbering (Daily #1 = 2026-10-14; a new crypt at midnight Central Time) |
| `src/online.ts` | Supabase calls: sign-in, run upload, leaderboards |
| `src/social.ts` | Sign-in, profile and leaderboard screens |
| `supabase/schema.sql` | Database tables, security rules and leaderboard views |

## Online features (Supabase)

With no configuration the game runs fully offline: names and progress are saved on the device and the leaderboard is hidden. To turn on accounts and leaderboards:

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and click **Run**.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**. Email sign-in is on by default.
4. **Authentication → URL Configuration**: set **Site URL** to the game's address (`https://onemorecrypt.com/`) and add it under **Redirect URLs**, along with `https://notjstn666.github.io/one-more-crypt/` so the old address keeps working.
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

The game lives at the custom domain `onemorecrypt.com` (DNS at the registrar, then **Settings → Pages → Custom domain** with **Enforce HTTPS**). The link-preview tags use `https://onemorecrypt.com/`, set in `deploy.yml`; a repo variable `SITE_URL` overrides it. Share links use whatever address the player is on.

The social preview image is `public/og.png`. To regenerate it, run `npx vite --port 5199` and then `node scripts/make-og.mjs` (needs Playwright installed).
