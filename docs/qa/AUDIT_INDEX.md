# Audit Index — Seller Tools India, 2026-08-08

Everything produced by the full production audit, and how to re-run it.

## Reports

| Document | What it is |
|---|---|
| [SELLER_TOOLS_FULL_AUDIT.md](SELLER_TOOLS_FULL_AUDIT.md) | **Start here.** Executive summary, tool scoreboard, three-way validation tables, per-tool reports, performance, responsive, privacy |
| [TOOL_MANIFEST.md](TOOL_MANIFEST.md) | All **33** tools across 43 routes, with the 18 required fields each, plus the Website Tool → Amazon Report → columns → calculation map |
| [BUG_REGISTER.md](BUG_REGISTER.md) | 12 defects + 1 privacy finding, with expected vs actual, root cause, fix, regression test and status |
| [UX_REGISTER.md](UX_REGISTER.md) | 22 UX findings with seller impact and whether implemented; beginner-comprehension scores; information-architecture recommendation |
| [UI_VISUAL_AUDIT.md](UI_VISUAL_AUDIT.md) | The screenshot round: per-tool desktop/mobile/error coverage, before/after UX scores, what the rendered UI exposed that the numbers could not, and every copy change made |

## Independent second opinion

| Document | What it is |
|---|---|
| [chatgpt-audits/SELLER-A-TOOL-21-23-24-TEST-001.md](chatgpt-audits/SELLER-A-TOOL-21-23-24-TEST-001.md) | ChatGPT's independent analysis of the same two unmodified settlement files (hashes verified), its verdicts and scores, the event taxonomy it recommended, and where this audit went further |

## Code written for the audit

| Path | Purpose |
|---|---|
| `qa/reference-calculations/settlement_ref.py` | Independent settlement Flat File V2 calculator, written from Amazon's spec — **does not** import or mirror the website's logic |
| `qa/reference-calculations/traffic_ref.py` | Independent Business Report (by Child Item) calculator; computes account conversion two ways so the product cannot silently pick one |
| `qa/tests/run-tests.mjs` | 48 assertions on committed fixtures, 69 with `--real`. Drives the **shipped** functions in a browser, not a copy |
| `qa/tests/render-check.mjs` | Renders the premium tools against a real file and prints stat cards, ledger and banners — the before/after evidence |
| `qa/tests/perf.mjs` | 1k / 10k / 50k / 100k row timings against the shipped parser |
| `qa/responsive-audit.mjs` | 140 route × width layout, tap-target and accessible-name checks |
| `qa/fixtures/settlement-balance-and-ads.txt` | Sanitized fixture reproducing the balance-movement and Cost-of-Advertising shapes |
| `qa/fixtures/settlement-multiunit-bom.csv` | Sanitized fixture: BOM + CRLF + comma-delimited + a multi-unit order |

## Source data

`qa-data/` holds the 9 genuine Amazon reports and `CHECKSUMS.txt`. **It is gitignored and must stay
that way** — the All Orders report contains buyer city/state/pincode. Aliases (SELLER-A/B/C) are used
throughout the documents; no account name, order id or buyer detail appears in `docs/qa/`.

## Changes made to the product

All in `web/index.html`:

- **`saLineKind()`** — one classifier deciding what every settlement line *is*, consumed by the
  Settlement Analyzer, SKU Profitability, Trends and Reconciliation so they cannot disagree
- **`saBucketOf()`** — two new buckets, `ads` and `balance`
- **`saAggregate()`** — returns `ads` and `balance` separately from `fees`
- **`saFlow()`** — new buckets, plus `distinctOrders` for a correct average order value
- **`saNiceLabel()`** — human names for Amazon's opaque internal tokens
- **`skuCompute()` / `skuRenderResults()`** — `(no SKU)` excluded from the SKU count, ranking and
  recommendations; new Account-level lines panel
- **`trendCompute()` / `trendInsights()`** — advertising tracked and charted; ratios are `null` rather
  than `0%` when a month had no sales; empty months can no longer anchor a delta; day-of-week verdict
  now needs 4+ occurrences per weekday and 30+ orders
- **ACOS calculator** — undefined ACOS renders as "No ad sales" in a warning state, never 0% in green
- **RTO Radar** — cancellation-rate denominator disclosed and sample-guarded; empty SKU table explained
- **Traffic Doctor** — the "a month" assumption removed
- **CSS** — `.cols>*{min-width:0}` and `min-width:0` on inputs, fixing horizontal scroll at 390 px

## Re-running

```bash
npm i playwright                       # Chrome channel
node qa/tests/run-tests.mjs            # fixtures only
node qa/tests/run-tests.mjs --real     # + real files from qa-data/
node qa/tests/render-check.mjs qa-data/raw/SELLER-A/settlements/*.txt
node qa/responsive-audit.mjs           # add --live to test production
node qa/tests/perf.mjs
python3 qa/reference-calculations/settlement_ref.py qa-data/raw/SELLER-A/settlements/*.txt
```

## Aliases

Public documents use `SELLER-A/B/C` and `SELLER-A-STMT-…` aliases throughout. The key
mapping them to real accounts, settlement ids and SHA-256 hashes is
`qa-data/AUDIT_FIGURES.md`, which is **gitignored and must stay that way** — this
repository is public.

## Status at hand-off

**0 P0 · 0 P1 outstanding.** Three P2 items remain open (BUG-011, BUG-012, PRIV-1).
**All fixes are merged and deployed** — PR #110 plus five follow-up commits are live.

Visually reviewed: Settlement Analyzer **96/100**, Multi-Month Trends **95/100**,
SKU Profitability **94/100**. Remaining tools await visual review in this order:
Reconciliation → Ad Profitability → SAFE-T → a true-profit tool → RTO Radar →
Traffic Doctor → the landing page → the shared-layout calculators in batches.
