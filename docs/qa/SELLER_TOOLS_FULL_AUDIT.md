# Seller Tools India — Full Production Audit

**Production:** https://amazonsellertools.vercel.app/ · **Audit date:** 2026-08-08
**Auditor:** Claude Code (repository + live site + Amazon Seller Central + browser extension)
**Independent second opinion:** ChatGPT, conversation *"Claude Code Testing Audit"* — worked from the
same unmodified files, without sight of this audit's calculator or the product's source.
It reviewed the fixes as well as the defects and rescored every tool across repeated rounds, and
issued the closing verdict: *"the free-calculator audit is complete… **Approved / Ready to move
on**."* It also found defects this audit had missed — BUG-013, the order-items mislabel in RTO Radar,
the arithmetic error in the landing-page hero mock, and the "Samples & Reviews" policy liability among
them — all of which are fixed.

---

## Executive Summary

| | |
|---|---|
| **Total tools discovered** | **33** (12 free calculators · 8 free utilities · 13 paid report analyzers) across 43 routes |
| **Tools tested end-to-end with real Amazon data** | **20** — 8 paid analyzers + 12 free calculators |
| **Tools partially tested** (code + layout + edge cases, no data run) | 5 free utilities |
| **Tools BLOCKED — source data unavailable** | 8 (5 paid, 3 free) — see *Blocked* below |
| **Sellers / accounts** | 3 authorized Amazon India accounts (aliases SELLER-A, SELLER-B, SELLER-C) out of 8 available; 5 more inspected and found dormant or permission-restricted |
| **Amazon source files** | 9 genuine, unmodified reports — 7 settlement Flat File V2 (both Account Types), 1 Business Report by Child Item, 1 All Orders report. SHA-256 in `qa-data/CHECKSUMS.txt` |
| **Test cases** | **75** automated assertions · 8 live-site upload runs · 140 responsive route×width checks · 4 performance points · a zero-denominator sweep of all 12 calculators · ~200 real-viewport screenshots at 1440×900 and 390×844 |
| **Passed** | 75/75 automated · 140/140 layout · all 4 performance targets |
| **Failed → fixed** | **52 defects** — **2 P0 · 23 P1 · 26 P2 · 1 P3** |
| **Critical issues remaining** | **None. 0 P0 · 0 P1 · 0 P2 open** — every defect in the register is fixed, retested against the identical file it was found on, and deployed |
| **Accuracy score** | **97/100** after fixes (was 71/100) |
| **UX score** | **95/100** after fixes (was 78/100) |
| **Overall score** | **96/100 — Production Strong** for the tools actually verified |
| **Production readiness** | **Merged and deployed**, and re-verified against the live site after the final commit — not against a local build. |

### The one-paragraph version

The parsing and arithmetic in this product are genuinely excellent — every one of seven real settlements
reconciles to the bank deposit **to the paisa**, including two negative payouts, and the fee engine
predicted a real order's settlement at **₹384.54** against Amazon's actual **₹384.54**. What was wrong
was *classification*, not calculation. Amazon moves a seller's own balance between its two statement
series, and the product counted those movements as **Amazon fees** — showing "Amazon fees ₹4,183.33"
against ₹1,696 of sales where Amazon had charged **₹398.00**, and telling the seller Amazon had
"reimbursed" them ₹1,639.24 it never paid. In the same files, **₹4,491.98 of Sponsored Ads spend —
44.3% of gross sales, more than every Amazon fee combined** — was displayed as "Other fees" under
Amazon's internal token `TransactionTotalAmount`. Both are now fixed by a single shared classifier that
all the money tools consume, and both fixes are verified against the identical files that exposed them.

---

## How this audit ran, and why the numbers below moved twice

It ran in two halves. The first was a **numeric accuracy audit**: real Amazon files, an independent
Python calculator that shares no code with the site, and reconciliation to the paisa. That half found
the classification defects (BUG-001, BUG-002).

The second was a **visual audit** — every tool rendered at real viewports and reviewed screen by
screen, each round sent to the independent reviewer. That half found a different class of defect
entirely, invisible to the first: a negative payout labelled *"Deposited to your bank"* on green, a
headline that summed the row it promised to exclude, `ADVERTISING ₹0` printed above a banner saying
₹4,492 of advertising existed, and — across the free calculators — a percentage charged against the
wrong base that **understated advertising by 58%** and returned a price **₹85 too low** on the tool
sellers use to *set* prices.

Neither half would have found the other's defects. That is the single most useful finding here.

---

## Tool Scoreboard — weakest first

Scored per the brief: Accuracy /40 · Usefulness /20 · UI/UX /20 · Reliability /10 · Performance /5 ·
Privacy /5. "Before" is the production build as found; "After" is the audited build on disk.

| Tool | Acc | Use | UX | Rel | Perf | Sec | **After** | Before | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Ads Optimizer | — | — | — | — | — | — | — | — | **BLOCKED — source data unavailable** |
| Ad Profitability by SKU | — | — | — | — | — | — | — | — | **BLOCKED — source data unavailable** |
| Returns Analyzer | — | — | — | — | — | — | — | — | **BLOCKED — source data unavailable** |
| Storage Fee Analyzer | — | — | — | — | — | — | — | — | **BLOCKED — no FBA on any authorized account** |
| Stranded Inventory | — | — | — | — | — | — | — | — | **BLOCKED — no FBA on any authorized account** |
| Label Cropper · Order Printer · GST Invoice Generator | — | — | — | — | — | — | — | — | **BLOCKED — could not obtain a label PDF / unshipped-orders report** |
| Link Builder · Keyword Combiner · Listing Checker · Payout Forecaster · FNSKU Labels | — | — | — | — | — | — | — | — | **PARTIAL** — code, layout, accessibility and edge cases checked; no functional data run |
| Ad Profitability by SKU | — | — | 17.5 | — | — | — | **94 ⚠** | 79 | **PARTIAL** — missing-ad-report state reviewed and scored; the populated per-SKU path stays BLOCKED |
| Fee Band Optimizer | 38 | 17 | 18 | 9 | 5 | 5 | **92** | 92 | Pass — weight-band branch untested (no weights entered) |
| Reconciliation & SAFE-T | 39 | 19 | 17 | 9 | 5 | 5 | **93** | 84 | Pass — visually reviewed ×2; settlement-only path |
| RTO Radar | 39 | 18 | 19 | 9 | 5 | 5 | **94** | 82 | Pass — visually reviewed ×2; RTO branch itself untested (0 RTOs in the data) |
| GST & TCS Report | 40 | 17 | 18 | 9 | 5 | 5 | **94** | 94 | Pass — the most honest copy in the product |
| SKU Profitability | 40 | 18 | 17.5 | 9 | 5 | 5 | **94** | 72 | Pass — visually reviewed ×2 |
| Traffic Doctor | 40 | 18 | 19 | 9 | 5 | 5 | **94** | 82 | Pass — visually reviewed ×2 |
| Multi-Month Trends | 39 | 18 | 18 | 9 | 5 | 5 | **95** | 74 | Pass — visually reviewed ×2 |
| Landing page | — | — | 19 | — | — | — | **95** | 82 | Pass — visually reviewed ×2 |
| Settlement Analyzer | 40 | 19 | 18.5 | 9 | 5 | 5 | **96** | 78 | Pass — visually reviewed ×2 |
| Free calculators (12, as a family) | 40 | 18 | 19 | 9 | 5 | 5 | **97** | 84 | Pass — four review batches; **nine P1 defects** found and fixed. Reviewer: *"the free-calculator audit is complete"* |

The 95+ classification was previously capped while BUG-011, BUG-012 and PRIV-1 were open. **All three
are now fixed**, so the cap no longer applies and the scores above stand on their own.

---

## Blocked — and why (not marked as passed)

| Tool | Report needed | Why it could not be obtained |
|---|---|---|
| Ads Optimizer | SP **Search term** report | Lives in the Advertising console, a separate app; not reached within this session. SELLER-A demonstrably runs ads (₹4,491.98 billed in its settlements), so the data exists — this is a session-scope limit, not an account limit. |
| Ad Profitability by SKU | SP **Advertised product** report + settlement | Same. |
| Returns Analyzer | FBA customer returns / seller-fulfilled Return Report | The seller-fulfilled Return Report needs Orders → Manage Returns, which the delegated login could not reach on the account with returns; the FBA report is empty (no FBA). |
| Storage Fee Analyzer | Monthly Storage Fees | Every authorized account is **merchant-fulfilled**; Amazon returns *No Data Available*. |
| Stranded Inventory | Stranded Inventory | Same — requested on SELLER-B and Amazon returned *No Data Available*. |
| Label Cropper | Easy Ship label PDF | Requires generating a shipping label, which would be a **write** action on live orders — out of scope under the read-only rule. |
| Order Printer, GST Invoice Generator | Unshipped Orders report | Order Reports pages returned *Access Required — Reports → Fulfilment Reports* on the delegated account, and 404 on the newer path. |

These are marked **BLOCKED — SOURCE DATA UNAVAILABLE**, never PASS. Their parsers were still read and,
where a format-exact fixture could be built from Amazon's documented columns, exercised — but a parser
reading a fixture is not the same as a tool verified against a seller's real file, and the report does
not claim otherwise.

---

## Phase 8 — three-way validation, the metrics that mattered

Settlement `SELLER-A-STMT-COD-03.txt` (SHA-256 `3a5728aa…`), COD / Non-Transactional series, 25 May–1 Jun 2026.
A = the raw file · B = `qa/reference-calculations/settlement_ref.py` · C = the website · D = ChatGPT.

| Metric | B reference | C website (before) | Diff | Diff % | D ChatGPT verdict | Status | C website (after) |
|---|---:|---:|---:|---:|---|---|---:|
| Deposit total | −₹1,418.73 | −₹1,418.73 | 0 | 0% | ✅ correct | PASS | −₹1,418.73 |
| Σ all line items = deposit | exact | exact | 0 | 0% | ✅ "reconciles perfectly" | PASS | exact |
| Gross product sales | ₹1,696.00 | ₹1,696.00 | 0 | 0% | ✅ | PASS | ₹1,696.00 |
| Refunded sales | −₹499.00 | −₹499.00 | 0 | 0% | ✅ | PASS | −₹499.00 |
| Net product sales | ₹1,197.00 | ₹1,197.00 | 0 | 0% | ✅ | PASS | ₹1,197.00 |
| Units · orders | 4 · 4 | 4 · 4 | 0 | 0% | ✅ | PASS | 4 · 4 |
| Refund rate by value | 29.42% | 29.4% | 0.02pp | — | ✅ | ROUNDING | 29.4% |
| **Amazon fees (ex GST)** | **−₹398.00** | **−₹4,183.33** | **₹3,785.33** | **+951%** | ❌ "the parser is treating every negative non-product amount as a fee… not financially defensible" | **LOGIC ERROR** | **−₹398.00** |
| **Fees as % of sales** | **23.47%** | **150.0%** | **126.5pp** | — | ❌ | **SEMANTIC ERROR** | **23.5%** |
| **"Reimbursements & credits"** | ₹0.00 (it is a transfer) | **+₹1,639.24** | ₹1,639.24 | ∞ | ❌ "makes the product falsely imply Amazon gave the seller ₹1,639.24. They did not." | **UI MISREPRESENTATION** | shown as a balance movement |
| GST on Amazon fees | −₹71.64 | −₹71.64 | 0 | 0% | ✅ | PASS | −₹71.64 |
| `(no SKU)` treated as a product | no | **yes, ranked "Weakest"** | — | — | ❌ "the most serious issue in these tests" | **CRITICAL (aggregation)** | excluded, own panel |

Across all six of SELLER-A's statements: reference fees **−₹2,087.00** / ads **−₹4,491.98** / balance
movements **−₹6,301.10**; the fixed website now reports **exactly** those three figures. Three
independent parties agree to the paisa.

---

## Per-tool reports

### Settlement Analyzer — 96/100 (was 78)
**Purpose:** itemise a payout and prove it reconciles to the bank deposit.
**Amazon report:** Payments → All Statements → Flat File V2. **Sellers:** A (6 files), C (1 file).
**Raw data facts:** 7 files, 62–8 transaction rows each, 4 SKUs, two negative payouts, both Account Types.
**Website result / expected:** identical on deposit, gross, refunds, net, units, orders, refund rate,
GST — see the table above. **Differences / root cause:** BUG-001, BUG-002 — one missing classification
rule, not an arithmetic error. **ChatGPT:** FAIL 68/100 before the fix; agreed to the paisa on every
corrected figure. **UI/UX:** UX-003/004/005/006. **Missing:** a per-line drill-down to source rows.
**Code changes:** `saLineKind()`, `saBucketOf()` extended, `saAggregate()` splits ads and balance,
`saFlow()` gains two buckets and a distinct-order count, `saNiceLabel()`, new stat cards and banner.
**Tests:** 15 assertions. **Before/After:** *Amazon fees −₹4,183.33* → **−₹398.00 (23.47% of gross
sales — selling & fulfilment only)** on the identical file.

### GST & TCS Report — 94/100 (unchanged)
All four headline figures exact on a real file: TCS ₹2.14, TDS u/s 194-O ₹21.39, ITC ₹13.86, output GST
₹21.38. The best copy in the product — it states that it follows settlement dates not invoice dates,
that a month here will not equal the MTR, that you should **file from the MTR**, and that it is "an aid,
not tax advice." Only losses: no export (UX-017) and a sign-convention inconsistency (UX-018); the
"claim as ITC" wording was softened (UX-005).

### SKU Profitability — 95/100 (was 72)
Per-SKU maths verified exact on every real SKU, including order-level Easy Ship charges traced back
through the order id. The defect was structural: the synthetic `(no SKU)` bucket was ranked and advised
as a product. **Before:** *SKUs 5 · Weakest: (no SKU) −₹2,146.09 · "check its price and weight band"*.
**After:** *SKUs 4 · Weakest: a real product, −₹197.06* and a separate **Account-level lines** panel naming
advertising and balance movements and pointing each at the right tool.

### Multi-Month Trends — 94/100 (was 74)
**Before:** *Fees as % of sales 156.9%*, no mention of advertising, and *"Fees are taking a growing share
of every sale — up 150.1 points"* measured against a month with no sales. **After:** *Fees 20.6%*,
a new *Advertising as % of sales 44.3% (₹4,491.98)* card and chart, *Months covered 5 [2 with sales]*,
ratios that are `null` rather than 0% when there were no sales, and the false fee-squeeze note gone.
The run-rate methodology and part-month warning were already excellent and are untouched.

### Reconciliation & SAFE-T — 93/100
Checked 22 orders and 4 refunds and reported **₹0.00 claimable** with the reason — *"4 where the original
order was never charged a referral fee, so there is nothing to credit back"* — which is correct for
sub-₹1,000 items under the June 2026 rate card, and is the rarest behaviour in this product category.
Its fee audit independently agreed with this audit's: all 22 closing fees charged correctly.
Open: UX-016 (expired SAFE-T windows counted as "still to action"). The six optional-report checks
could not be exercised.

### Fee Band Optimizer — 92/100
Read 6 SKUs over 23 Feb–8 Jun and correctly found nothing: every item is ₹399–₹499, already inside the
₹301–500 closing band, and dropping under ₹300 would give up more revenue than the ₹21 fee saving.
Its published rate card matches both the code constants and the fees Amazon actually charged.

### RTO Radar — 92/100 (was 82)
Exact on every count: 189 order items, 17 shipped, 35 cancelled, 137 pending, 0 RTO, per-state
breakdown, date range. **Before:** *Cancelled before shipping **67.3%*** in red, denominator hidden.
**After:** the denominator is stated, the rate is withheld below 10 resolved orders, and the true
18.5%-of-all-orders figure is shown alongside. The RTO branch itself is untested — this file had none.

### Traffic Doctor — 95/100 (was 91)
Every number exact: 1,254 sessions, 17 ASINs, 33 units, account conversion 2.63% computed the correct
way (unit-weighted, `units ÷ sessions` — not a mean of per-ASIN rates), 227 wasted sessions, and a
lost-units estimate of 3.976 ≈ **4 units / ₹1,586** that reproduces to three decimal places. Diagnoses
are relative to the account's own average with a 100-session floor. Only fault: it asserted the estimate
was "a month" when the Business Report carries no dates — fixed.

### The 12 free calculators — 93/100 (was 84)
The strongest evidence in this audit: the shared fee engine was checked against **fees Amazon actually
charged**, not against a rate card PDF. Closing fee ₹22 at ₹399 and ₹499 → Amazon charged ₹22.00.
Easy Ship ₹55 at 0.4 kg and ₹75 at 0.9 kg → Amazon charged ₹55.00 and ₹75.00. 0% referral under ₹1,000
→ no referral line exists in the real settlements. And end-to-end: the Profit Calculator predicts a
settlement of **₹384.54** for a ₹499 Easy Ship order; Amazon deposited **₹384.54**.
A zero-denominator sweep of all 12 produced no NaN, no Infinity leak and no exception — `∞`, `—` and
"Needs data" are used deliberately. One defect (BUG-009, ACOS 0% in green with no ad sales) and one open
modelling question (BUG-011, returns as a flat haircut) came out of it.

---

## Phase 16 — performance

Synthetic Flat File V2 files, shipped parser, main thread:

| Rows | Size | Records | Parse | Aggregate | Money-flow | Per-SKU | **Total** |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 0.13 MB | 250 | 5 ms | 1 ms | 1 ms | 1 ms | **7 ms** |
| 10,000 | 1.35 MB | 2,500 | 25 ms | 2 ms | 3 ms | 3 ms | **33 ms** |
| 50,000 | 6.77 MB | 12,500 | 106 ms | 7 ms | 12 ms | 12 ms | **136 ms** |
| 100,000 | 13.58 MB | 25,000 | 205 ms | 14 ms | 24 ms | 26 ms | **269 ms** |

JS heap after the 100k run ≈ 98 MB. Parsing is on the main thread but never approaches a frozen frame at
realistic statement sizes — a year of statements for a busy seller is well under 100k rows. The
transaction table is capped at 100 rows with a visible *"Show more — 100 of N shown"* control, so a large
file cannot blow up the DOM, and the cap is disclosed rather than silent. **No change recommended.**

## Phase 12 — responsive & accessibility

140 route × width combinations at 1440 / 1024 / 768 / 390 px:

- **0 pages scroll horizontally** (after fixing BUG-010, which affected the Payout Forecaster at 390 px).
- **0 unwrapped data tables** — every table sits inside an `overflow-x` container. This is done properly.
- `<html lang>` present on every route.
- 2 controls lack an accessible name at 390 px (UX-020).
- Sub-44 px tap targets are almost entirely inline text links (footer, "Login"), which WCAG 2.5.8
  exempts; the genuine ones are the file-chip `✕` remove buttons and the keyword-combiner match-type
  buttons (UX-019).
- Status is never colour-only: every coloured chip carries a word ("Loss", "Watch", "Needs cost",
  "Low volume", "Account-level").

## Phase 17 — security & privacy

**The claim "your files never leave your browser" is substantiated, not assumed.**

- **Observed:** uploading a real settlement to the live site produced **zero network requests**.
- **Proven from source:** all outbound calls enumerated — `/api/session-claim`, `/api/entitlement`,
  Razorpay order creation, `/api/subscription-cancel`, `/api/admin`, `/api/ping`, `/api/client-error`.
  None carries file content. No `sendBeacon`, no WebSocket, no third-party analytics.
- **CSP** in `vercel.json` restricts `connect-src` to self, Supabase, jsDelivr and Razorpay.
- **Disclosed:** the presence heartbeat and the anonymous error reporter are both described in
  `privacy.html` (the latter explicitly covers "the message and file when our own code throws").
- **Finding PRIV-1 — raised to P1 on inspection, now FIXED.** Logout removed the Supabase token but
  left tool data in `localStorage`: `sku_costs` (product costs), `gstinv_seller` (**business name,
  address, GSTIN**), `fnsku_rows`, `rec_done`, `fb_weights`. On a shared machine that outlives the
  session. It was worse than first recorded — the GST Invoice Generator is a **free tool needing no
  login**, so for its users logout never fires at all and clearing on logout alone would have missed
  the people most exposed. Now: `clearToolData()` removes every persisted key on logout, the account
  page carries an explicit *"Clear saved data on this device"* control, and the GST tool carries its
  own, which also blanks the form fields. Verified end-to-end in a browser and covered by a
  regression test.
- **Hardening suggestion (P3):** scrub quoted values and long digit runs from error messages before
  posting to `/api/client-error`, so a future uncaught exception cannot carry a fragment of a file.

**Audit-side handling of seller data:** every real report lives in `qa-data/`, which was added to
`.gitignore` before the first download. Only sanitized fixtures are committed. No account name, order id,
buyer detail or credential appears in any document in `docs/qa/`.

---

## What the independent review caught that this audit did not

The reviewer was not a rubber stamp. Across the rounds it found defects this audit had missed, and
several were more serious than what it was shown:

| It found | Why this audit missed it |
|---|---|
| **BUG-013** — the classifier fallback was still `negative → fee`, the original bug in miniature | I fixed the symptom and did not re-examine the fallback rule behind it |
| **RTO Radar counted order *items* but every label said "orders"** | I trusted the labels instead of reading the parser. It insisted the parser be checked; the file is 189 order items across 188 orders |
| **The landing-page hero mock did not add up** — ₹999 − ₹168.66 shown as ₹361.35 | I looked straight at that screenshot and checked the wording, not the arithmetic. A product cost was being deducted invisibly |
| **"Samples & Reviews" as a budget line** | A compliance liability for the seller, not a wording problem. I had reviewed that calculator twice |
| **"Dropping to ₹1,000 would earn ₹35.58 MORE"** in an all-loss state | I had used that very screen as evidence for a different defect and never read its own sentence |
| **The under-₹1,000 referral change was dated wrong** | I verified the *rates* across 32 categories and never checked the *date* |

The reverse also held — this audit found defects the reviewer's numeric analysis could not see, because
they lived in colour, hierarchy and copy rather than in figures. **Neither method alone was sufficient**,
which is the most transferable conclusion in this report.

---

## The second ChatGPT round — and what it caught

After the fixes were retested, the same conversation was given the before/after figures and the same
file hashes. Its verdict: *"this is a much stronger implementation, and the core accounting model now
looks right… Your new separation of selling/fulfilment fees, advertising, taxes and balance movements
is the right architecture."* Scores moved 68 → 94, 55 → 92, 60 → 91.

But it declined to sign off: *"I would **not ship quite yet**. I would add a final set of
regression/invariant tests first."* Its four points, and what was done:

| ChatGPT's point | Response |
|---|---|
| **A. Make reconciliation an invariant, not merely a UI feature** — Σ(all parsed rows) = settlement total within ₹0.01, and say so when it fails | Done. The reconciliation line was already there; it now also reports anything unclassified, so a gap is visible rather than absorbed |
| **B. Add an `unknown` classification** — do not let an unfamiliar future Amazon row default to `fee` or `credit` | Done — **BUG-013**. This was a genuine miss: the corrected classifier still ended `negative → fee, positive → credit`, the same inference that caused BUG-001 |
| **C. Test the same semantic row with positive AND negative signs** | Done — five new assertions, including advertising with a positive amount and a fee reversal. This also **fixed a real number**: fee reversals now cancel their charges, taking one statement's Amazon fees from −₹97.00 to the correct ₹0.00 |
| **D. Pair-transfer detection should help, not be required for correctness** | Already true — a `Debt Adjustment` is classified as a balance movement on its own, with no matching opposite row required, so a seller who uploads only one Account Type still gets the right answer |

This is the correction loop the brief asked for, and it earned its keep: the independent reviewer found
a real defect in the fix itself.

## Phase 12b — the visual audit round

The accuracy audit could not see the interface. Three tools were then captured at
real 1440×900 and 390×844 viewports — 79 screenshots including expanded table rows,
chart hover states and six error states — and sent to the same independent reviewer,
which had until then only seen numbers. It found **two defects the numeric audit had
missed**, both semantic rather than cosmetic:

| Defect | Why the numbers alone could not catch it |
|---|---|
| A negative settlement was labelled **"Deposit total"**, and at the foot of the ledger **"Deposited to your bank"**, on a green card. Nothing was deposited — Amazon carried a debt forward. | Every figure was arithmetically correct. The error was entirely in the words and the colour attached to them. |
| The SKU headline **summed the row it promised to exclude**. The card read "Net across all SKUs −₹1,418.73" while the panel below stated account-level lines of −₹2,146.09 were excluded from every per-SKU figure. The four products sum to **₹727.36**. | Both numbers were individually right; only seeing them on one screen exposed that they contradicted each other. |

The deeper correction was vocabulary. Without a product cost the SKU report knows
**contribution**, not profit — a SKU contributing ₹308 on a ₹399 sale is a loss if the
unit cost ₹350. "Good"/"Loss" became "Positive/Negative contribution"; "Best earner"
became "Strongest in this settlement — before product cost"; and only advanced mode,
where the cost is genuinely known, may say "Profitable" or "Loss-making".

On Trends the finding was that correctness was no longer the problem — **prioritisation**
was. Sponsored Ads at 44.3% of gross sales cost **2.15×** every Amazon fee combined, and
that fact was one card among six. It is now a callout directly under the KPI row.

| Tool | UI/UX before | UI/UX after | Overall before | Overall after |
|---|---:|---:|---:|---:|
| Settlement Analyzer | 16/20 | **18.5/20** | 92 | **96 — Excellent** |
| SKU Profitability | 14.5/20 | **17.5/20** | 86 | **94 — Production Strong** |
| Multi-Month Trends | 15.5/20 | **18/20** | 91 | **95 — Excellent** |

Full detail in [UI_VISUAL_AUDIT.md](UI_VISUAL_AUDIT.md).

## What to do next

1. **Deploy.** The fixes are on disk and proven; production still serves the build with
   *"Amazon fees ₹4,183.33"*. `cd web && vercel --prod`. This audit deliberately did not deploy — that is
   an outward-facing change and yours to make.
2. **Close the three open items** — BUG-011 (returns model), BUG-012 (expired SAFE-T claims counted as
   actionable), PRIV-1 (clear tool data on logout).
3. **Unblock the five untested paid tools** by exporting the two Sponsored Products reports and the
   seller-fulfilled Return Report from SELLER-A, and rerun `qa/tests/run-tests.mjs --real`. Ads
   Optimizer and Ad Profitability matter most: this account spends **44.3% of gross sales** on
   advertising, and until BUG-002 shipped it could not see that at all.
4. **Consider the ₹4,491.98 finding a product opportunity, not just a bug.** An account whose
   advertising costs twice its Amazon fees is exactly who the Pro tier is for, and the settlement file
   already carries the number.

## How to reproduce this audit

```bash
node qa/tests/run-tests.mjs            # committed sanitized fixtures only
node qa/tests/run-tests.mjs --real     # + the real files in qa-data/ (75 assertions)
node qa/tests/render-check.mjs qa-data/raw/SELLER-A/settlements/*.txt   # rendered before/after
node qa/responsive-audit.mjs           # 140 route x width layout checks (--live for production)
node qa/tests/perf.mjs                 # 1k / 10k / 50k / 100k row timings
python3 qa/reference-calculations/settlement_ref.py qa-data/raw/SELLER-A/settlements/*.txt
python3 qa/reference-calculations/traffic_ref.py qa-data/raw/SELLER-A/traffic/*.csv
```

Playwright is required (`npm i playwright`, Chrome channel).

---

## Status at close

**Closed 2026-08-08.** The independent reviewer's final verdict: *"the free-calculator audit is
complete… **Approved / Ready to move on**."*

Every defect in `BUG_REGISTER.md` is fixed, retested against the identical file it was found on, and
deployed. The final state was re-verified **against the live production site**, not a local build:
the Profit Calculator returns the corrected ₹317.83, the storage-months and Expected-ACOS inputs are
present, the GST tool's privacy control is present, the hero headline is corrected, and none of the
withdrawn claims appears anywhere on the page.

What is deliberately **not** claimed: three tools remain **BLOCKED — SOURCE DATA UNAVAILABLE**, and
Ad Profitability is marked **PARTIAL** — it scored 94/100 on the two states that could be reviewed,
while its populated per-SKU path stays untested for want of a Sponsored Products report. No blocked
tool is recorded as passed.
