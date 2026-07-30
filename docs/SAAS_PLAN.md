# SaaS Plan — Seller Tools India (amazonsellertools.vercel.app)

This is the master plan to turn the free tool site into a paid product.
Give the prompts in section 5 to Claude Code **one at a time, in order**.
Each prompt is self-contained. Do not skip the ground rules in section 4.

---

## 1. Decisions already made (do not re-open these)

| Topic | Decision |
|---|---|
| Domain | Stay on `amazonsellertools.vercel.app` for now. Real domain later (do NOT use "amazon" in the future domain). |
| Hosting | Vercel, deploys from `main`. Vercel project root is **`web/`** (so serverless functions go in `web/api/`). |
| Auth + database | Supabase (email/password auth + Postgres). `supabase-js` from CDN in the browser; service-role key only inside `web/api/*` functions. |
| Payments | Razorpay. Start with one-time payments for 30-day / 365-day access (checkout + webhook). Razorpay Subscriptions (auto-renew) can come later. |
| Email | Resend (optional, later). Supabase built-in email is enough at the start. |
| Plans | **Free**: all calculators, Label Cropper, Order Printer, Link Builder, Keyword Combiner, FBA Reimbursement, all free tools. **Starter ₹199/month or ₹999/year**: Settlement Analyzer, GST & TCS Report, SKU Report. **Pro ₹499/month or ₹2,499/year**: everything in Starter + SKU P&L with product costs, Reconciliation, multi-month Trends (built in Phase 7). |
| Session policy | One active session per user. New login kicks out the old session. |
| Device tracking | Allowed, but it must be **disclosed** in the Privacy Policy (India DPDP Act). Never call it "secret" anywhere. We store: device fingerprint hash, browser/OS, IP, login time. Limit: 3 known devices per account (admin can reset). |
| Old password gate | The "2023" sessionStorage gate stays working as an owner bypass until Phase 4 is live and tested. After that it is removed. |
| Files/privacy | Settlement files and label PDFs are processed **in the browser only** and are never uploaded. This stays true forever — it is our main trust selling point. |

## 2. Things the OWNER must do by hand (Claude cannot do these)

Do these when the plan says they are needed — not all up front.

1. **Before Phase 2**: Create a free Supabase account (supabase.com) → New project (region: Mumbai `ap-south-1`) → copy three values: `Project URL`, `anon public key`, `service_role key`.
2. **Before Phase 2**: In Vercel → Project → Settings → Environment Variables, add:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. **After Phase 1 is live** (legal pages must exist first): Sign up at razorpay.com as **Individual / Unregistered business (freelancer)** with your PAN + personal savings account. Submit the site URL for KYC review.
4. **Before Phase 4**: From Razorpay dashboard copy `Key Id` and `Key Secret`, and create a webhook secret. Add to Vercel env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Set webhook URL to `https://amazonsellertools.vercel.app/api/razorpay-webhook` with event `payment.captured`.
5. **Phase 5**: nothing manual.
6. **Before Phase 6**: decide your admin email (the account that gets the admin panel) — it is `gossiistudio@gmail.com` unless you change it.

## 3. Architecture (what gets built)

- `web/index.html` — stays the single-file app with all tools. Gains: login/signup UI, account page, pricing page, paywall screens.
- `web/terms.html`, `web/privacy.html`, `web/refunds.html`, `web/contact.html` — real static pages (Razorpay KYC reviewers must be able to open them at plain URLs).
- `web/api/*.js` — Vercel serverless functions (Node): `entitlement.js`, `create-order.js`, `razorpay-webhook.js`, `session-claim.js`, `admin-*.js`.
- Supabase tables (created via SQL in Phase 2/4/5):
  - `profiles` (id = auth.users id, email, name, phone, created_at, is_admin bool, active_session_id text, device_limit int default 3)
  - `entitlements` (user_id, plan text check in ('starter','pro'), source text, starts_at, expires_at, payment_id, created_at)
  - `payments` (id, user_id, razorpay_order_id, razorpay_payment_id, amount_paise, plan, period, status, raw jsonb, created_at)
  - `login_events` (id, user_id, at, ip, user_agent, device_hash, kicked_previous bool)
  - `devices` (id, user_id, device_hash, label, first_seen, last_seen)
  - RLS ON for every table; users read only their own rows; writes only via service-role from `web/api/*`.
- Gating model (be honest about limits): the site is client-side, so a determined person can read the code. The paid value is the *analysis logic staying updated + convenience*, and gating works like this: premium routes ask `/api/entitlement` (JWT from Supabase auth) → server answers `{plan, expires_at}` → UI unlocks. This keeps honest users honest; it is not DRM. Do not over-engineer it.

## 4. GROUND RULES — paste this block at the top of EVERY prompt

```text
GROUND RULES (read fully before coding):
- Repo: GOSSII/seller-tools. The whole web app is web/index.html (single file,
  vanilla JS, hash router, CALCS array + custom page renderers). Vercel project
  root is web/, production deploys from main, REAL CUSTOMERS use the site daily.
- NEVER change the maths or behaviour of existing tools (profit calculator,
  fee engine, label cropper, settlement analyzer parsing, etc.). New code must
  be additive. app/ (Expo React Native) must not be touched at all.
- The gated tools currently use password "2023" (sessionStorage sa_unlocked).
  Keep that working unless the prompt explicitly says to remove it.
- Read docs/SAAS_PLAN.md first for decisions already made. Do not re-open
  decided questions.
- Verification is mandatory before every commit:
  1) extract the <script> from web/index.html and run node --check on it;
  2) run/extend a Playwright test (chromium at /opt/pw-browsers/chromium if
     present) that loads the changed routes, checks for zero page errors, and
     asserts the acceptance criteria of this prompt;
  3) regression: #/profit with Easy Ship + defaults must still show
     Settlement ₹830.34 and Net Profit ₹361.35.
- Secrets: never put service_role keys or Razorpay secrets in web/index.html
  or anywhere client-side. Client may only see SUPABASE_URL, SUPABASE_ANON_KEY
  and RAZORPAY_KEY_ID.
- When done: commit with a clear message, push, open a PR to main titled with
  the phase name, and merge it so I can test on Vercel production.
```

## 5. THE PROMPTS — give these to Claude Code one at a time

---

### Prompt 1 — Landing page, pricing page, legal pages (no backend)

```text
<paste GROUND RULES block>

TASK: Phase 1 of docs/SAAS_PLAN.md — marketing pages. No backend, no auth yet.

1) Upgrade the home route (#/) of web/index.html into a real landing page,
   keeping the tool grid below it:
   - Hero: headline "Free tools for Amazon India sellers — know your real
     munafa", subline about fees/settlements/labels, two buttons:
     "Use free tools" (scrolls to grid) and "See pricing" (#/pricing).
   - Trust strip: "Files never leave your browser", "Built for Amazon.in",
     "No login needed for free tools".
   - 3 feature sections with small screenshots/illustrations (pure CSS mockups
     are fine, no external images): (a) Settlement Analyzer — paste your
     settlement file, see where every rupee went; (b) Label Cropper — crop,
     sort by SKU, print 4x6 with SKU on the label; (c) Calculators — profit,
     fees, GST, price bands.
   - FAQ section (5-6 questions: is it free, do you upload my files, which
     marketplaces (Amazon.in only), how do I get my settlement report, refund
     policy, contact).
   - Footer on every page: links to Pricing, Terms, Privacy, Refunds, Contact,
     plus "© <year> Seller Tools India. Not affiliated with Amazon.com, Inc.
     Amazon is a trademark of Amazon.com, Inc."
2) New route #/pricing: 3-column pricing table exactly per the plans table in
   docs/SAAS_PLAN.md section 1 (Free / Starter ₹199 per month or ₹999 per year /
   Pro ₹499 per month or ₹2,499 per year, with feature lists). Starter+Pro
   buttons say "Coming soon — join waitlist" and open a mailto link to
   gossiistudio@gmail.com with subject "Waitlist" (until payments phase ships).
   Mark Pro rows that are not built yet as "coming soon".
3) Create real standalone files web/terms.html, web/privacy.html,
   web/refunds.html, web/contact.html (shared minimal CSS, link back to /).
   These MUST work as plain URLs (Razorpay KYC reviewers open them directly).
   Content requirements:
   - Terms: service description, free vs paid plans, one-active-session rule,
     acceptable use, no affiliation with Amazon, "tools are estimates, verify
     with your own CA/Seller Central", liability limits, governing law India.
   - Privacy (DPDP Act 2023 compliant, plain English): what we collect
     (account email, plan+payment status, login events including IP, browser
     and a device identifier used to prevent account sharing, and NOTHING from
     your uploaded files because they are processed in your browser only),
     why, retention, user rights (access/correction/erasure — email us),
     grievance contact gossiistudio@gmail.com. The device tracking MUST be
     disclosed here clearly — that is a legal requirement, never hide it.
   - Refunds: 7-day money-back on first purchase, no pro-rata refund after
     that, how to claim (email), processing time 5-7 working days to original
     payment method.
   - Contact: email gossiistudio@gmail.com, expected reply time, and a line for
     business name/address placeholder I can fill later.
   - Also link these 4 pages from the SPA footer and add them to
     web/sitemap.xml.
4) SEO: title/description meta for the landing and pricing routes.

ACCEPTANCE: landing renders with zero JS errors; #/pricing shows 3 plans with
correct prices; the 4 html files open standalone; every existing tool route
still works; profit regression number intact. Screenshot the landing page and
pricing page in the PR description.
```

---

### Prompt 2 — Supabase auth (accounts, login, logout)

```text
<paste GROUND RULES block>

TASK: Phase 2 of docs/SAAS_PLAN.md — user accounts with Supabase. Read
docs/SAAS_PLAN.md section 3 for the schema.

PREREQ (I have done this): Supabase project exists; Vercel env vars
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are set. Put the
public URL + anon key in a small config object in web/index.html (they are
safe to expose; say so in a comment).

1) Write web/db/schema.sql (idempotent, with RLS policies) creating: profiles,
   entitlements, payments, login_events, devices — columns per
   docs/SAAS_PLAN.md section 3. Add a trigger creating a profiles row on
   auth.users insert. I will paste this into the Supabase SQL editor myself —
   print clear instructions in the PR description.
2) In web/index.html load @supabase/supabase-js@2 from CDN lazily (same lazy
   pattern as pdf-lib) only when an auth-related screen is opened.
3) New routes: #/login (email+password, links to signup and reset),
   #/signup (name, email, password, checkbox "I agree to Terms & Privacy"
   linking to the html pages — required), #/reset (email reset flow using
   Supabase's built-in email). Friendly Hindi-English error messages.
4) Header: when logged out show "Login" button; when logged in show the user's
   name with a menu: Account, Logout.
5) New route #/account: shows email, name (editable), current plan (reads
   entitlements — will show "Free" for everyone until payments phase), plan
   expiry, and a Logout button.
6) Do NOT gate any tool yet. The "2023" password gate stays untouched.
7) Add web/api/health.js (returns {ok:true}) to prove the api/ directory works
   as Vercel functions from the web/ project root, and document in the PR what
   Vercel setting I must check if /api/health 404s.

ACCEPTANCE (Playwright, mock the Supabase network calls where needed): signup
form validates and requires the terms checkbox; login/logout toggles the
header; #/account renders; all existing routes unaffected; profit regression
intact.
```

---

### Prompt 3 — Entitlement gate on premium tools

```text
<paste GROUND RULES block>

TASK: Phase 3 of docs/SAAS_PLAN.md — gate the three premium tools by plan,
with the old password as a bypass.

1) web/api/entitlement.js: verifies the Supabase JWT from the Authorization
   header (use the service role key + Supabase auth API), reads the newest
   non-expired row from entitlements, responds
   {plan: "free"|"starter"|"pro", expires_at}. Cache-Control: no-store.
2) In web/index.html: a getEntitlement() helper (memoised per session) that
   calls it with the current session token; logged-out users are "free".
3) Gate settlement-analyzer, gst-report, sku-report: they need plan starter or
   pro. If user lacks it, show a paywall panel in place of the tool: what the
   tool does (one line + mini screenshot mockup), "₹199/month — unlock with
   Starter", buttons [See pricing] [Login]. Keep the existing "2023" password
   input working below it, restyled as small text "Have an access code?" —
   sessionStorage sa_unlocked still unlocks everything (owner bypass, removed
   in a later phase).
4) #/pricing buttons change: if logged out → go to #/signup; if logged in →
   still "join waitlist" mailto (payments come next phase).
5) #/account shows the entitlement from the API, not a hardcoded value.

ACCEPTANCE (Playwright with /api/entitlement mocked): free user sees paywall
on all three tools; "2023" still unlocks them; a mocked starter entitlement
unlocks all three without the password; expired entitlement shows paywall
again; logged-out flow sends to signup; profit regression intact.
```

---

### Prompt 4 — Razorpay payments (go-live money moment)

```text
<paste GROUND RULES block>

TASK: Phase 4 of docs/SAAS_PLAN.md — take real payments with Razorpay
Checkout + webhook, using one-time payments for timed access (NOT
Subscriptions API yet).

PREREQ (I have done this): Razorpay KYC approved; Vercel env has
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET; dashboard
webhook points at /api/razorpay-webhook for payment.captured.

Price list (single source of truth, define once server-side):
  starter_monthly ₹199 → 30 days, starter_yearly ₹999 → 365 days,
  pro_monthly ₹499 → 30 days, pro_yearly ₹2499 → 365 days.

1) web/api/create-order.js: auth required (Supabase JWT). Input: plan key from
   the list above. Creates a Razorpay order (amount from the server-side
   list — NEVER trust a client amount), stores a pending row in payments,
   returns {order_id, key_id, amount}.
2) #/pricing buttons for logged-in users open Razorpay Checkout (checkout.js
   from Razorpay CDN, lazy-loaded) with that order, prefilled email.
3) web/api/razorpay-webhook.js: verify X-Razorpay-Signature HMAC against the
   raw body (reject on mismatch), idempotent by razorpay_payment_id. On
   payment.captured: mark payments row paid, then upsert entitlements —
   if the user has an active entitlement of the same-or-lower plan, EXTEND
   from its expires_at, else start now. Store the raw event jsonb.
4) Post-payment UX: checkout success handler polls /api/entitlement for up to
   30s until the plan appears, then celebration panel "Starter unlocked till
   <date>". Handle payment failure and popup-close gracefully.
5) #/account gains: payment history table (date, plan, amount, id), plan
   expiry with "days left", and Renew button.
6) Send a simple confirmation email if RESEND_API_KEY exists, else skip
   silently (do not fail the webhook on email errors).
7) Keep the "2023" bypass for now — I remove it myself after testing real
   payments (leave a single clearly-marked function removeLegacyGate note in
   the code comment instead of removing).

ACCEPTANCE: unit-test the webhook handler with node (signature valid/invalid,
duplicate event, extend-vs-new entitlement date maths — pin dates, no
Date.now in assertions); Playwright covers paywall→checkout-open with
Razorpay CDN mocked, and the success-poll flow with /api mocked; profit
regression intact. In the PR, list the exact manual test I should do with a
real ₹1 test-mode payment (Razorpay test keys) before switching keys to live.
```

---

### Prompt 5 — One active session + device history (disclosed)

```text
<paste GROUND RULES block>

TASK: Phase 5 of docs/SAAS_PLAN.md — enforce one active session per user and
record login/device history. This must match what web/privacy.html discloses —
read it first; if anything here is not disclosed there, update privacy.html in
the same PR.

1) web/api/session-claim.js: auth required. Generates a random session_id,
   writes it to profiles.active_session_id, appends a login_events row
   (ip from x-forwarded-for, user_agent, device_hash from body,
   kicked_previous=true if a different session_id existed), upserts devices
   (device_hash, first/last_seen; label from UA like "Chrome on Windows").
   If the user now has more than profiles.device_limit distinct devices,
   respond 403 {error:"device_limit"} and do NOT claim the session.
   Response: {session_id}.
2) Client: on login (and on app load with an existing Supabase session) call
   session-claim once, store session_id in localStorage. device_hash =
   SHA-256 of (userAgent + platform + screen size + timezone + a random salt
   stored in localStorage so it is per-browser-profile, not creepy
   cross-site fingerprinting).
3) /api/entitlement additionally receives the session_id header and responds
   409 {error:"session_taken"} if it no longer matches
   profiles.active_session_id. Client on 409: show a full-screen, polite
   panel "You logged in on another device, so this session was signed out.
   One login at a time is part of keeping prices low." with a [Use here
   instead] button that re-claims the session (kicking the other device).
   Premium tools re-check entitlement when the tab regains focus, so a kicked
   session locks within seconds of the user coming back to it.
4) On device_limit 403: panel explains the 3-device limit and says to email
   support to reset devices.
5) #/account gains "Login activity": last 10 logins (time, device label,
   masked IP like 103.44.x.x) and the device list. Plus a "Log out
   everywhere" button (clears active_session_id server-side via
   session-claim with action:"logout_all").
6) Free tools NEVER require login — this must not touch them.

ACCEPTANCE: node unit tests for the claim/kick/limit logic (mock supabase
client); Playwright: two contexts logged in as the same (mocked) user — the
first gets the session_taken panel after the second claims, [Use here
instead] recovers it; account page renders activity; free tools work logged
out; profit regression intact.
```

---

### Prompt 6 — Admin panel

```text
<paste GROUND RULES block>

TASK: Phase 6 of docs/SAAS_PLAN.md — admin panel for the owner.

Admin = profiles.is_admin true (I set it by SQL for gossiistudio@gmail.com; put
the exact UPDATE statement in the PR description).

1) web/api/admin.js: one function, action-based, every action requires a
   valid JWT whose profile has is_admin (verify server-side, never trust the
   client). Actions: list_users (search by email, with plan+expiry+device
   count+last login), user_detail (entitlements, payments, login_events,
   devices), grant (plan, days — inserts entitlement with source "admin"),
   revoke (expire entitlement now), reset_devices (delete devices rows +
   clear active_session_id), set_device_limit, stats (users total, paid
   count, revenue this month from payments, signups last 30 days per day).
2) Route #/admin in web/index.html: hidden from all menus; non-admins get a
   plain 404-style "Not found" (no hint the route exists). For admins: stats
   cards on top (reuse the existing .stats CSS), a daily-signups bar chart
   (reuse the existing viz helpers/CSS from the settlement analyzer — follow
   the same colour choices), searchable user table, and a user detail view
   with Grant/Revoke/Reset devices/Change limit buttons (each with a confirm
   step).
3) Audit: every admin action appends to login_events with a device_hash of
   "admin-action:<action>" so there is a trail (cheap but real).

ACCEPTANCE: node unit tests for admin auth rejection + grant date maths;
Playwright with mocked /api: non-admin sees Not found, admin sees stats +
can grant a plan through the UI flow; existing routes unaffected; profit
regression intact.
```

---

### Prompt 7 — Pro features (the reason Pro exists)

```text
<paste GROUND RULES block>

TASK: Phase 7 of docs/SAAS_PLAN.md — build the Pro-plan tools. Gate each
behind plan "pro" using the existing getEntitlement() paywall pattern (with
starter users seeing an upgrade panel, price difference shown).

7a) SKU P&L (Advanced mode of #/sku-report). Groundwork ALREADY EXISTS on
    main: saBucketOf/SA_BUCKET_NAMES, saFlow returns {B,orders,units,refunds},
    and skuCompute already aggregates per-SKU buckets into s.b — read that
    code first and build on it, do not redo it.
    - "Advanced P&L" toggle in the sku-report filter bar (pro only).
    - Per-SKU product cost inputs (₹/unit), persisted in localStorage
      sku_costs, with an "apply one cost to all" helper.
    - New columns: cost (cost×units sold net of returns) and True P&L
      (net − cost), coloured green/red.
    - Each SKU row expands to show its full fee breakdown from s.b using
      SA_BUCKET_NAMES labels.
    - Stat card: "True profit after product cost" with count of loss-making
      SKUs.
7b) Reconciliation (#/reconcile, pro): upload MTR/settlement file(s) and it
    flags: orders shipped but no payment line, refunds where the referral fee
    was not returned, negative-total orders, and SAFE-T/reimbursement-worthy
    rows. Output = a checklist table with claim instructions (Seller Central
    path per row) and CSV export. Reuse the existing settlement parser —
    do NOT fork it.
7c) Trends (#/trends, pro): upload multiple settlement files; combined
    month-by-month charts (sales, fees %, refund rate, net payout) using the
    existing viz helpers; a per-SKU trend picker; everything stays
    client-side (files never uploaded — keep the trust promise).

Ship 7a, 7b, 7c as three separate PRs in that order, each with its own
Playwright coverage incl. the real-file fixtures in the repo tests where
present. Use fixture settlement data with known expected numbers — assert to
the paisa. Profit regression intact in every PR.
```

---

### Prompt 8 — Launch polish

```text
<paste GROUND RULES block>

TASK: Phase 8 of docs/SAAS_PLAN.md — pre-launch polish.

1) Remove the "2023" legacy gate entirely (search sa_unlocked) — CONFIRM in
   the PR that paid gating fully replaces it. (Only run this prompt after I
   say real payments are tested.)
2) Add plausible-style privacy-friendly analytics WITHOUT third-party
   scripts: a tiny /api/ping that counts route hits per day into a Supabase
   table (no cookies, no personal data), and an #/admin traffic card.
3) Error visibility: window.onerror handler that posts {message, route,
   line} to /api/ping (rate-limited client-side) so I hear about production
   JS errors in #/admin.
4) Empty/edge states pass: every tool with a file input gets a friendly
   "wrong file type" message with a link to its help section.
5) SEO: per-route <title>/meta description, JSON-LD for the landing page,
   refresh web/sitemap.xml, verify robots.txt.
6) A "What's new" changelog route #/changelog fed from a simple JS array.

ACCEPTANCE: Playwright sweep of ALL routes with zero console errors, paywall
behaviour re-verified without the legacy gate, profit regression intact.
```

## 6. Order and timing

| Phase | Prompt | Needs from owner first | Rough effort |
|---|---|---|---|
| 1 Marketing + legal | 1 | nothing | 1 session |
| 2 Auth | 2 | Supabase project + env vars | 1-2 sessions |
| 3 Gating | 3 | nothing | 1 session |
| 4 Payments | 4 | Razorpay KYC + env + webhook | 1-2 sessions |
| 5 Sessions/devices | 5 | nothing | 1 session |
| 6 Admin | 6 | admin SQL update | 1 session |
| 7 Pro tools | 7 (3 PRs) | nothing | 3 sessions |
| 8 Polish/launch | 8 | real payment tested | 1 session |

Phases 1→4 are the money path — do them first and start earning with
Starter. Phases 5→6 protect the money. Phase 7 justifies Pro. Phase 8 is
launch quality.

## 7. Env vars reference (all set in Vercel, never committed)

```
SUPABASE_URL                # safe for client too
SUPABASE_ANON_KEY           # safe for client too
SUPABASE_SERVICE_ROLE_KEY   # SERVER ONLY (web/api/*)
RAZORPAY_KEY_ID             # safe for client
RAZORPAY_KEY_SECRET         # SERVER ONLY
RAZORPAY_WEBHOOK_SECRET     # SERVER ONLY
RESEND_API_KEY              # optional, server only
```
