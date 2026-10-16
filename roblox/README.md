# One More Crypt on Roblox

A Roblox version of One More Crypt. The rules are a line-by-line Luau port of `src/game.ts`, so the **Daily Descent is the same crypt on Roblox and onemorecrypt.com**: same seed, same layout, same relic offers, same hero of the day.

## Put it on Roblox

1. Install [Roblox Studio](https://create.roblox.com/) and sign in.
2. Download `roblox/OneMoreCrypt.rbxlx` from this repo and open it in Studio (double-click it, or **File → Open from File**).
3. Press **Play** to try it. Progress saving only works once the game is published (step 5).
4. **File → Publish to Roblox**. Give it a name and description, and pick a genre such as RPG.
5. Turn on saving: **Home → Game Settings → Security → Enable Studio Access to API Services**. Live servers save automatically; this setting lets Studio playtests save too.
6. Fill in the questionnaire Roblox asks for before a game can go public: **Creator Dashboard → your experience → Audience → Maturity & Compliance**. It's a short form about the game's content.
7. Make it public: **Game Settings → Permissions → Playability → Public**, or **Creator Dashboard → your experience → Privacy**.
8. Add an icon and thumbnails in the Creator Dashboard (`public/og.png` and the images in `brand/` work as a start).

## Turn on the shop

The game ships with a Shop (menu → 🛒 Shop) that is ready to sell once you create the items on Roblox. Until then every item shows "Not on sale yet".

1. Publish the game first (above).
2. Go to [create.roblox.com](https://create.roblox.com) → **Creations** → your game → **Monetization → Passes**. Create these four Game Passes, then open each one's **Sales** tab, turn on **Item for Sale** and set a price:

   | Pass | Suggested price | What it does |
   | --- | --- | --- |
   | Grave Robber | 199 Robux | 2× Souls from every run |
   | Cloak Collection | 99 Robux | Six extra cloak colours, picked on the menu |
   | Soulfire Aura | 149 Robux | Blue soulfire around the hero |
   | Crypt Founder | 299 Robux | Gold crown on the hero and the Founder title |

3. Under **Monetization → Developer Products**, create three products:

   | Product | Suggested price | Gives |
   | --- | --- | --- |
   | Pouch of Souls | 49 Robux | 250 Souls |
   | Urn of Souls | 129 Robux | 800 Souls |
   | Ossuary Hoard | 349 Robux | 2,500 Souls |

4. Copy each item's ID number (shown on its page, or **Copy Asset ID** from its "…" menu).
5. In Studio, open **ReplicatedStorage → OneMoreCrypt → Store** and replace each `id = 0` with the matching ID. If you prefer editing files, the same list is in `src/shared/Store.luau`; rebuild the place afterwards.
6. Publish again. The Shop now shows real prices and the buy buttons work.

Also switch on, in **Monetization**:
- **Private Servers**: let players rent their own server for a few Robux a month.
- **Premium Payouts** need no setup. Roblox pays you for the time Premium members spend in the game. The game gives Premium members +20% Souls so they have a reason to play.

The shop leaves the Daily Descent fair: passes are cosmetic or speed up Ossuary unlocks, and Souls only buy Endless unlocks, so nobody can pay for a better daily score.

Your Robux show up in the Creator Dashboard. Developer Exchange (DevEx) turns earned Robux into real money once you meet Roblox's requirements: be 13 or older, have a verified email, and earn more than the minimum balance. Check the current rate and minimum on Roblox's DevEx page.

## What's in it

- The full rules: all 7 heroes, 41 relics, 12 fusions and 6 ascended relics at the Soul Forge, elites, spike traps, Blood Shrines, Iron Chests, Pale Fountains, the three bosses and the Abyss below floor 30.
- **Daily Descent:** a new crypt at midnight Central Time, one official attempt per player, and a daily leaderboard.
- **Endless:** random crypts with your unlocked heroes and forbidden relics, and an all-time leaderboard.
- **Souls and the Ossuary:** every run pays Souls, spent on heroes and the ten forbidden relics. Saved to Roblox DataStores.
- **Runs resume:** leaving mid-run (closing Roblox, or the ☰ button) keeps the run. It's rebuilt from its saved inputs when you come back.
- **3D board:** a torch-lit 7×7 room. Heroes and monsters are voxel models built from the web game's 12×12 pixel art (`src/sprites.ts`, `src/enemy-art.ts`), and they shatter into voxels when they die.
- **Controls:** WASD, arrow keys or HJKL to move and Space to wait. On phones and tablets: swipe, tap a tile or use the on-screen d-pad.
- **Cheat-resistant:** the game runs on the server. The client only sends moves and draws the result.
- **Shop:** Game Passes and Soul packs (see above). Purchases are saved before they're confirmed, and each receipt pays out once.

Not ported yet: the Hollow hub, achievements, the Grimoire, hero looks that change with relics, the music, and share cards. The web game's Supabase accounts aren't linked: Roblox progress is separate.

## Files

| File | What it does |
| --- | --- |
| `OneMoreCrypt.rbxlx` | The built place. Open this in Studio |
| `default.project.json` | [Rojo](https://rojo.space) project that builds the place from `src/` |
| `src/shared/Game.luau` | The rules, ported from `src/game.ts` |
| `src/shared/Relics.luau`, `Content.luau` | Relics, fusions, heroes, elites and floor events |
| `src/shared/Rng.luau` | The seeded RNG, bit-for-bit identical to `src/rng.ts` |
| `src/shared/Daily.luau` | Daily numbering in Central Time, matching `src/daily.ts` |
| `src/shared/Store.luau` | Shop items and their IDs |
| `src/shared/Sprites.luau` | Pixel art, generated from the web sprites. Don't edit by hand |
| `src/server/CryptServer.server.luau` | Runs every player's game, saves progress, leaderboards |
| `src/client/CryptClient.client.luau` | The 3D board, effects, HUD, menus and controls |

## Changing it

Edit the `.luau` files, then rebuild the place with [Rojo](https://rojo.space) 7:

```bash
npx tsx roblox/scripts/gen-sprites.ts                       # only if the web sprites changed
rojo build roblox/default.project.json -o roblox/OneMoreCrypt.rbxlx
```

Or run `rojo serve roblox/default.project.json` with the Rojo Studio plugin to sync edits into Studio live.

When you change a rule in `src/game.ts`, make the same change in `src/shared/Game.luau`, or the daily crypt will differ between the two versions. Two checks need the [Luau CLI](https://github.com/luau-lang/luau/releases):

```bash
npx tsx roblox/tests/crosscheck.ts path/to/luau 800   # bots play 800 web runs; the Luau port must end each one identically
npx tsx roblox/tests/server-sim.ts path/to/luau       # the server script with mocked Roblox services
```
