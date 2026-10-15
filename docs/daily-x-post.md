# Daily X posts

Every morning at **7 AM Central** (CDT in summer, CST in winter), GitHub makes the day's
posts for @OneMoreCrypt, each with its own picture:

1. **The endless leader**: when someone set a new #1 endless record in the last day,
   "New endless record" with their crowned hero. Every Monday, even without a new record,
   "Reigning endless champion".
2. **Yesterday's daily champion**: their hero wearing a crown and their relics, with their
   name, floor and kills. Ties are named together. Skipped if nobody played.
3. **Today's crypt**: "Daily #N is open" with today's hero.

By default it **emails them to you** to post by hand: each post's picture, its text, and an
"Open in X with this text" button. Post them in the order given.

The job is `.github/workflows/daily-post.yml`; the script is `scripts/daily-post.mjs`; the
pictures are drawn by `scripts/post-cards.html`.

## Setup: the daily email

1. **Resend key.** resend.com → **API Keys → Create API Key**. Name `daily-posts`,
   permission **Sending access**, domain `onemorecrypt.com`. Copy the `re_…` key.
2. **GitHub secrets.** Repo → **Settings → Secrets and variables → Actions → Secrets** →
   **New repository secret**:

   | Name | Value |
   | --- | --- |
   | `RESEND_API_KEY` | the `re_…` key |
   | `POST_EMAIL_TO` | the address to send them to (several: separate with commas) |

3. **Test.** Repo → **Actions → Daily X post → Run workflow**, mode **email** → **Run**.
   The email arrives from One More Crypt <crypt@onemorecrypt.com> within a minute or two.
   Check spam the first time and mark it "not spam".

Run modes for manual runs: **email** sends the kit now, **preview** only saves the pictures
and text in the run's **post-preview** download, **post** posts to X.

## Later: posting automatically

Posting through the X API needs prepaid X credits (Developer Console → **Billing →
Credits**). With credits and the four X secrets in place (`X_API_KEY`, `X_API_SECRET`,
`X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, from the app's **Keys and tokens**, with
**Read and write** permission), add a repository **variable** (Variables tab, not Secrets)
`AUTO_POST` = `true`. The 7 AM job then posts to X instead of emailing.

## Good to know

- GitHub's scheduler can start a few minutes late, so the email lands between about 7:00
  and 7:20 AM.
- Champion names are whatever players picked. Glance at them before posting.
- To stop the job: **Actions → Daily X post → ⋯ → Disable workflow**.
