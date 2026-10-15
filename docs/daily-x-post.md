# Automatic daily X posts

Every morning at **7 AM Central** (CDT in summer, CST in winter), GitHub posts two things
to @OneMoreCrypt:

1. **The crowning**: yesterday's daily champion, with a picture of their hero wearing a
   crown and their relics, their name, floor and kills. Ties are named together. Skipped
   if nobody played yesterday.
2. **The new crypt**: "Daily #N is open" with a picture of today's hero.

The job is `.github/workflows/daily-post.yml`; the script is `scripts/daily-post.mjs` and the
pictures are drawn by `scripts/post-cards.html`.

## One-time setup

### 1. Get X API keys (signed in as @OneMoreCrypt)

1. Go to https://developer.x.com and sign in as **@OneMoreCrypt**.
2. Sign up for the **Free** plan (or whatever the cheapest plan that allows posting is
   called when you sign up). Describe the use: "Posts a daily game announcement and
   the previous day's leaderboard winner for my browser game One More Crypt."
3. In the **Developer Portal**, open your **Project → App**.
4. **User authentication settings → Set up**:
   - App permissions: **Read and write**
   - Type of App: **Web App, Automated App or Bot**
   - Callback URI: `https://onemorecrypt.com/`
   - Website URL: `https://onemorecrypt.com/`
   - Save.
5. **Keys and tokens** tab:
   - **API Key and Secret → Regenerate** (or Generate). Copy both.
   - **Access Token and Secret → Generate**. Copy both. Do this *after* step 4, so the
     token can post. It should say "Created with Read and Write permissions".

### 2. Add them to GitHub as secrets

Repo → **Settings → Secrets and variables → Actions → Secrets** tab → **New repository
secret**, four times:

| Name | Value |
| --- | --- |
| `X_API_KEY` | API Key |
| `X_API_SECRET` | API Key Secret |
| `X_ACCESS_TOKEN` | Access Token |
| `X_ACCESS_SECRET` | Access Token Secret |

(`SUPABASE_URL` and `SUPABASE_ANON_KEY` are already set up as variables for the game.)

### 3. Test without posting

Repo → **Actions → Daily X post → Run workflow**, leave **Test run** ticked, **Run**.
When it finishes, open the run and download **post-preview** at the bottom: it has the two
pictures and the exact post text.

### 4. Make one real post (optional)

Run it again with **Test run** unticked. It posts both immediately. After that it runs by
itself every morning at 7 AM Central.

## Good to know

- GitHub's scheduler can start a few minutes late, so posts land between about 7:00 and
  7:20 AM.
- Champion names are whatever players picked (letters, numbers and underscores). If an
  offensive name ever wins, turn the workflow off for a day: **Actions → Daily X post →
  ⋯ → Disable workflow**.
- To stop the posts entirely, disable the workflow the same way, or delete the secrets.
