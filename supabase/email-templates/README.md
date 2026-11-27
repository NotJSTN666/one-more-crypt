# Email templates

Branded versions of the Supabase Auth emails the game sends. Paste each into
**Authentication → Emails → Templates** in the Supabase dashboard (switch the editor to
source/HTML), and set the subject line shown below.

| Template in Supabase | File | Subject |
| --- | --- | --- |
| Confirm signup | `confirm-signup.html` | Your key to One More Crypt |
| Magic Link | `magic-link.html` | Your key to One More Crypt |
| Change Email Address | `change-email.html` | Save your One More Crypt progress |

The header image is the game's social card, served from https://onemorecrypt.com/og.png.
`{{ .Token }}` is the 6-digit code players can type into the game when the link opens in
a different browser (common in the X and Reddit apps). All three templates carry it: the
save-progress screen in the game has a box for the change-email code too.

The sender shows as "Supabase Auth" until custom SMTP is set up
(**Authentication → Emails → SMTP Settings**); then the sender name and address can be
"One More Crypt <crypt@onemorecrypt.com>" or similar.
