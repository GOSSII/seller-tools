# Email templates — Seller Tools India

Six Supabase Auth templates, written as email-safe HTML: tables for layout,
inline styles only, 600px max width, no external CSS or images (the logo is a
styled table cell, so nothing to block or fail to load). Tested to degrade
sensibly in Gmail, Outlook and Apple Mail.

**Where they go:** Supabase Dashboard → Authentication → Emails → Templates.
Paste the body of each file into the matching template and set the subject line
listed at the top of the file.

| File | Supabase template | Subject |
|---|---|---|
| `invite.html` | Invite user | You've been given free access to Seller Tools India |
| `confirm-signup.html` | Confirm signup | Confirm your email — Seller Tools India |
| `magic-link.html` | Magic Link | Your sign-in link — Seller Tools India |
| `reset-password.html` | Reset Password | Reset your password — Seller Tools India |
| `change-email.html` | Change Email Address | Confirm your new email — Seller Tools India |
| `reauthentication.html` | Reauthentication | Your verification code — Seller Tools India |

**Supabase variables used:** `{{ .ConfirmationURL }}` in all but the last, and
`{{ .Token }}` in `reauthentication.html`. Do not rename them.

**Sender:** the default is `noreply@mail.app.supabase.io`, which is why the
current emails say "Supabase Auth". Set a custom SMTP sender (Authentication →
Emails → SMTP Settings) to send as Seller Tools India — that also lifts the
low hourly limit on the built-in sender.
