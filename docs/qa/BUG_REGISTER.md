# Bug Register — Seller Tools India audit

**Audit date:** 2026-08-08 · **Auditor:** Claude Code · **Independent check:** ChatGPT ("Claude Code Testing Audit")
**Cross-tool rule (added after BUG-014…018):** a fix to a shared model is not complete until every
tool consuming that model is re-checked. Five of the six Ad Profitability defects were defects this
audit had already fixed elsewhere and never propagated.

**Status:** FIXED = fix landed in `web/index.html`, regression test added, **and** retested against the
identical SHA-256 file the defect was found on. OPEN = needs a product decision.

Priority: **P0** wrong money number or privacy hole · **P1** wrong metric definition, silent data loss,
wrong aggregation · **P2** confusing/unsupported recommendation or major UX · **P3** cosmetic.

Every row was reproduced on the **live production site** with a real, unmodified Amazon India report and
independently recomputed by `qa/reference-calculations/*.py`.

| ID | Pri | Tool(s) | Defect | Expected | Actual (production) | Status |
|---|---|---|---|---|---|---|
| BUG-001 | P0 | Settlement Analyzer, SKU Profitability, Multi-Month Trends | Balance movements between the two statement series counted as Amazon fees / reimbursements | fees ₹398.00 (23.5% of gross) | **fees ₹4,183.33 (150.0%)**; mirror row shown as "Reimbursements & credits +₹1,639.24" | **FIXED** |
| BUG-002 | P1 | Settlement Analyzer, SKU, Trends, GST | Advertising spend shown as "Other fees" under the raw token `TransactionTotalAmount` | own Advertising bucket — ₹4,491.98, 44.3% of sales | invisible as advertising | **FIXED** |
| BUG-003 | P1 | SKU Profitability | Synthetic `(no SKU)` row counted as a SKU, ranked "Weakest", given price/weight advice | excluded from SKU count and ranking | "SKUs 5" (4 real); "Weakest: (no SKU)"; "check its price… weight band" | **FIXED** |
| BUG-004 | P1 | RTO Radar | "Cancelled before shipping" divided by resolved orders only, denominator undisclosed, no sample guard | 18.5% of all order items, or "67.3% of the 52 resolved" | **67.3%**, red, no denominator shown | **FIXED** |
| BUG-005 | P2 | Multi-Month Trends | A month with zero sales got a fee ratio of **0%** instead of "undefined", then served as a Δ baseline | no ratio, no comparison | "Fees… up 150.1 points to 150.1%" measured against an empty April | **FIXED** |
| BUG-006 | P2 | Multi-Month Trends | Day-of-week budget advice with no minimum-sample guard | withhold the verdict | "concentrate coupons, budget and launches" from **one** Tuesday (3 orders) | **FIXED** |
| BUG-007 | P2 | Traffic Doctor | Lost-units estimate asserted as "a month" when the report carries no dates | "over the period this report covers" | "≈ 4 units / ₹1,586 **a month**" on a 99-day export (~3.3× over) | **FIXED** |
| BUG-008 | P3 | RTO Radar | Empty "RTO by SKU" table rendered as a bare header | say why it is empty | header row, no rows, no message | **FIXED** |
| BUG-009 | P1 | ACOS Calculator | ACOS with zero ad sales displayed as **0.00% in green** | undefined — "No ad sales", warning state | `ACOS 0.00%` green after spending ₹5,000 for nothing | **FIXED** |
| BUG-010 | P2 | Payout Forecaster (all pages using `.cols`) | Page scrolled sideways at 390 px — grid track grew to 522 px off `<input type="date">`'s intrinsic minimum | no horizontal scroll | `scrollWidth 522` vs `390` viewport | **FIXED** |
| BUG-011 | **P1** | Profit Calculator | Returns modelled as a haircut on remaining contribution rather than as an event with its own costs. **Correction to this row:** it computes **−₹41.77** at 100% returns (the ad cost alone), not ₹0.00 as first recorded — the returns term cancels the whole remaining contribution and nothing else | a real loss: product cost less recovery, return freight, and the fees Amazon retains | `Net Profit −₹41.77` when every unit comes back | **FIXED** — replaced by an optional rupee input |
| BUG-029 | **P1** | Profit Calculator | Field labelled **ACOS (%)** but ad cost computed as a share of *remaining contribution*, not of the selling price. On the default inputs: ACOS 0% → ₹417.73 net, ACOS 10% → ₹375.95, i.e. **₹41.78 charged where 10% of a ₹999 sale is ₹99.90** | ad spend = ACOS × selling price | advertising **under-counted by 58%**, erring optimistically; Net Margin and ROI inherit the error | **FIXED** — profit at defaults falls ₹375.95 → ₹317.83 |
| BUG-030 | P2 | Profit Calculator | `GST ITC Recoverable` and `Profit After ITC` as headline stats add the credit back into profit as though recovery is certain — the same overreach fixed in the GST tool and on the landing page | qualify as an eligibility review | two of six KPIs assert recovery | **FIXED** — card removed |
| BUG-031 | P2 | Profit Calculator | FBA storage hardcoded to one month at ₹45/cu ft, and a low-margin banner asserting "15–25% is usually a sustainable range", both presented as facts | expose as assumptions | hidden assumptions | **PART-FIXED** — margin band removed; FBA storage assumption still hardcoded |
| BUG-012 | **P1** | Reconciliation & SAFE-T | "Issues flagged 4 / Still to action 4" counts claims whose 60-day SAFE-T window has already closed (each row says so) | separate actionable from expired | 4 expired claims presented as 4 red issues, 4 actions and 4 Claim buttons | **FIXED** (raised to P1 by ChatGPT: the screen sends sellers to Amazon) |
| BUG-013 | P1 | Settlement classifier (all money tools) | The classifier's fallback was `negative → fee, positive → credit` — the same inference that turned a debt adjustment into a fee. A future/renamed Amazon row type would silently repeat the bug | an `unknown` class: counted in the payout reconciliation, excluded from every fee and profit ratio, and shown to the seller | any unrecognised negative row became a fee | **FIXED** (raised by ChatGPT on review of the fix) |
| BUG-014 | **P1** | Ad Profitability | `ADVERTISING ₹0` rendered directly above the tool's own banner saying the settlement contains ₹4,492 of advertising. ₹0 *attributed* is not ₹0 *spent* | "Sponsored Ads billed −₹4,491.98 · 44.3% of sales" and, separately, "SKU-attributed ad spend: Not available" | `ADVERTISING ₹0`, and `Left after ads` = payout − 0, restating the payout | **FIXED** |
| BUG-015 | **P1** | Ad Profitability | Every SKU verdicted **"Profitable"** in green with no ad report loaded and product cost blank — BUG-003's and the SKU report's COGS defect, never propagated to this tool | "Profit cannot be determined — needs ad report / needs product cost"; missing COGS is `null`, never `0` | 6 of 6 SKUs green "Profitable" | **FIXED** |
| BUG-016 | P2 | Ad Profitability | `SKUs ads turn to a loss: 0` in **green** with no ad data — the same shape as BUG-009 | not computable without attribution | reassuring green zero | **FIXED** |
| BUG-017 | P2 | Ad Profitability | `(no SKU)` ranked first among products at −₹10,793 and dominated "worst after ads" — BUG-003 in a second tool | own panel, excluded from rankings and verdicts | top row of the SKU table | **FIXED** |
| BUG-018 | P2 | Ad Profitability | "Worst after ads", "Ad spend" and "ACOS" sorts active with no ad report, silently sorting by something else | disabled with a reason | active and misleading | **FIXED** |
| BUG-019 | P2 | Reconciliation | "How to claim" instructed the seller to "paste the text from the row's 📋 Claim button" under a table whose Claim buttons had been replaced by "Window likely closed" chips | replace the filing path when every row is out of window | instructions pointing at a control that no longer existed | **FIXED** |
| BUG-020 | **P1** | RTO Radar | `RTO RATE 0.0%` in **green** on a five-day window where the tool's own banner says 137 of 189 order items are still pending and an RTO takes 2–3 weeks to record. Volume was guarded (10+ shipped); elapsed time was not | withhold the rate — "RTO outcome: Too early to measure", with the observed count and the raw rate demoted to a caveat | green 0.0% headline, reading as "my RTO is solved" | **FIXED** |
| BUG-021 | **P1** | RTO Radar | Every count is an **order item** (`rtoCompute` dedupes by `orderId\|orderItemId`) but the UI said "17 shipped **orders**", "52 **orders**". This file is 189 order items across **188** distinct orders — one order carries two | label the unit correctly and disclose both counts | wrong noun on every KPI, table header and explainer | **FIXED** (found by ChatGPT; parser check confirmed it) |
| BUG-022 | **P1** | RTO Radar | *"Faster deliveries get refused less — the buyer is still expecting the parcel when it arrives."* Standard: 13 shipped, 0 back. SecondDay: 4 shipped, 0 back. No pattern exists in the data, and the clause after the dash is a cause an All Orders report cannot establish | state that no pattern is visible yet and what would be needed to see one | a causal claim from a zero-signal sample | **FIXED** |
| BUG-023 | P2 | RTO Radar | Headline said "too early to measure" while the state/SKU/service tables printed rates and chips read "OK" — two confidence systems disagreeing on one page | one gate everywhere | contradictory confidence | **FIXED** |
| BUG-024 | **P1** | Traffic Doctor | *"These pages get real visitors and lose them — **the fix is the listing** (images, price, reviews, first bullet), **not more ads**."* A 0.88% conversion on 227 sessions identifies none of those, and with no ad report loaded the tool had no basis to advise against advertising | name the signal, list what to investigate, do not name the cause | a diagnosis and a prescribed fix from one ratio | **FIXED** |
| BUG-025 | **P1** | Traffic Doctor | `TRAFFIC BEING WASTED 227` — unitless, and false: those sessions converted at 0.88% rather than 2.63% and produced 2 units | "Low-conversion traffic · 227 sessions" | every session on an underperforming page counted as waste | **FIXED** |
| BUG-026 | P2 | Traffic Doctor | `INVISIBLE ASINS — nobody sees them`; an ASIN with 7 sessions is not invisible, and the file does not say whether that is 7 days or 90 | "Low-traffic ASINs — under 10 sessions in this export" | a diagnosis dressed as a metric | **FIXED** |
| BUG-027 | P2 | Traffic Doctor | `UNITS LOST VS AVG` reads as four orders the seller lost; it is a counterfactual against the account's own average | "Estimated upside at account avg", marked illustrative and not a forecast | an invented loss | **FIXED** |
| BUG-028 | P2 | Traffic Doctor | The report-period caveat sat *below* the table it qualifies, after the seller had already read the thresholds | banner above every diagnosis section | caveat arriving too late | **FIXED** |
| BUG-032 | **P1** | Target Price Calculator | The price search charged ads/returns against residual contribution while the ledger charged them against price, so **the displayed rows did not sum to the displayed total** — ₹716 with "Net Profit There ₹143.36" over rows summing to **₹71.70** | one model; rows that add up | a ₹71.66 gap visible on screen | **FIXED** |
| BUG-033 | **P1** | Target Price Calculator | Consequence of BUG-032: at the default 20% target it returned **₹716**, which actually yields a **13.01%** margin. Correct answer **₹801** | the price that meets the stated target | seller underprices by ₹85 believing they have 7 more margin points | **FIXED** |
| BUG-034 | P2 | Advertising ROI | ROAS coloured **green ≥3×, red below**, and banner graded at 4×/2.5×. ROAS is gross sales per ₹1 of ad spend; 3× is comfortable at a 50% contribution margin and loss-making at 25%, and the tool has no margin input | state the arithmetic and the break-even condition | an unearned verdict | **FIXED** |
| BUG-035 | P2 | Advertising ROI | CPC or CVR of zero rendered 0 clicks, 0 orders and **"0.00× ROAS" in red** — unknown, not zero | "—" and say why | zero-vs-unavailable | **FIXED** |
| BUG-036 | P2 | Advertising ROI Calculator | Named "ROI Calculator" but nothing on the screen computes ROI — it computes clicks, orders, ad-attributed sales, ACOS and ROAS. ROI needs profit/cost economics the tool's own copy says are absent | name it for what it computes | the title contradicted the corrected semantics | **FIXED** — renamed **Amazon Advertising ROAS Calculator** |
| BUG-037 | **P1** | FBA Fee Calculator | Banner asserted "fee share falls as price rises" unconditionally. **False across a referral band edge:** electronics ₹999 → ₹1,001 moves the rate 9% → 11% and the fee share **25.86% → 31.13%** — it rises 5.3 points for ₹2, at exactly the price sellers reprice around | check the next rupee and name the jump | a confident, wrong pricing claim | **FIXED** |
| BUG-038 | P2 | FBA Fee Calculator | The fee-composition chart included FBA storage as a slice of the selling price while the ledger row above said storage is "not deducted from this order" — the slices summed to **more than 100%** of the price | storage excluded, title says why | a chart contradicting its own ledger | **FIXED** |
| BUG-039 | P2 | FBA Storage Calculator | "Beyond roughly 6 months you tie up cash" / "Healthy cover…" — unsourced norms as verdicts, with months-of-cover coloured red/green on a 6-month rule | state the cost of holding this stock for as long as it takes to clear | unearned verdicts | **FIXED** |
| BUG-040 | P2 | ACOS Calculator | ACOS coloured **red >30%, green below**, and TACoS graded "Healthy… **which means** real organic pull" — an unsourced norm plus a causal claim, in a tool with no margin input | no grading; state what the ratios are and what they cannot say | same class as the ROAS grading | **FIXED** |
| BUG-041 | **P1** | Marketing Budget Planner | Entire rupee output driven by a **hardcoded per-category TACoS with no source** — the same unsourced benchmark deleted from the Profit Calculator, still live here | label the fallback a placeholder; prefer the seller's own TACoS | a budget computed from an invented benchmark | **FIXED** |
| BUG-042 | P2 | Coupon ROI Calculator | "Worth running" / "Not worth it" verdict derived entirely from the seller's own guessed uplift | lead with the break-even uplift the discount must produce | a guess returned as a recommendation | **FIXED** — break-even uplift is now a headline KPI |
| PRIV-1 | P2 | Account / all tools | Logout clears the auth token but **not** tool data — `sku_costs` (product costs), `gstinv_seller` (business name, address, GSTIN), `fnsku_rows`, `rec_done`, `fb_weights` survive in `localStorage` on a shared machine | clear tool data on logout, or offer "clear my saved data" | data persists | **OPEN** |

---

## The three that mattered — detail

### BUG-001 · Balance movements counted as Amazon fees — **P0, FIXED**

**Source:** `web/index.html` `saAggregate`, `saBucketOf`, `skuCompute`, `trendCompute`
**Test IDs:** SELLER-A-TOOL-21/23/24-TEST-001 · **Files:** `SELLER-A-STMT-ELEC-03.txt` `1160ee25…`, `SELLER-A-STMT-COD-03.txt` `3a5728aa…`

Amazon moves a seller's own balance between the *Electronic Transactions* and *COD / Non-Transactional
Fees* series with paired `Debt Adjustment` rows, and carries a prior negative balance forward as
`Payable to Amazon`. `saBucketOf` had no case for either, so they fell through to
`amt >= 0 ? "credits" : "otherFees"`, and `saAggregate` defined a fee as "negative and not tax".

Both halves of the pair share adjustment id `<adjustment-id>` and posting time
`30.05.2026 12:22:57 UTC`, and net to **₹0.00** across the account.

| | Reference calc | ChatGPT | Website before | Website after |
|---|---:|---:|---:|---:|
| File A — Amazon fees ex GST | −₹1,187.00 | −₹1,187.00 | −₹2,826.24 | **−₹1,187.00** |
| File B — Amazon fees ex GST | −₹398.00 | −₹398.00 | −₹4,183.33 | **−₹398.00** |
| File B — fees as % of gross | 23.47% | 23.47% | 150.0% | **23.5%** |
| Trends, six statements | 20.57% | not verifiable from 2 files | 156.9% | **20.6%** |

**Fix.** A single classifier, `saLineKind(line, transactionType)`, now decides what every settlement line
*is* — principal / advertising / balance / tax / fee / credit — and the analyzer, SKU report, Trends and
Reconciliation all consume it, so they cannot disagree again. Balance movements get their own ledger row
("Your own balance moved… — not a fee"), an explanatory banner, and are excluded from every fee figure.

**Regression tests:** `BUG-001 Amazon fees exclude balance movements`, `balance tracked separately`,
`balance not filed as a credit`, `flow has its own balance bucket`.

### BUG-013 · The fallback rule was the original bug in miniature — **P1, FIXED**

Raised by ChatGPT when it reviewed the fix: *"Do not let an unfamiliar future Amazon row fall into
`fee` or `credit` by default."* It was right — the corrected classifier still ended
`return amount < 0 ? "fee" : "credit"`, which is exactly the inference that made a balance movement a
fee. Amazon changes payment-report descriptors (India revised fee categories twice in 2026), so the
next new row type would have repeated BUG-001 silently.

**Fix.** A row must now *look like* a known Amazon charge (`SA_KNOWN_FEE`) or a known credit
(`SA_KNOWN_CREDIT`, checked first because "FBA Inventory Reimbursement" is money coming *to* the
seller) to be classified. Everything else is **`unknown`**: included in the settlement reconciliation
because it is real money, excluded from every fee and profit ratio, and surfaced in a banner naming the
amount and pointing at the labels. Reconciliation is now an invariant with a visible gap, not a
decoration.

**A real accuracy gain, not just hardening.** On `SELLER-A-STMT-COD-04.txt` the closing fee `−₹22.00` and its
reversal `+₹22.00`, and the Easy Ship `−₹75.00` and its `Weight Handling Fee Reversal +₹75.00`, used
to be split — the charges into fees, the reversals into "credits". Amazon fees for that statement are
now correctly **₹0.00** rather than **−₹97.00**.

**Regression tests:** `unrecognised positive row -> unknown, NOT credit`,
`unrecognised negative row -> unknown, NOT fee`, `a real reimbursement is still a credit`,
`advertising stays advertising when the amount is POSITIVE`, `a fee reversal is still a fee line,
positive`, plus `every line classified — nothing unrecognised` across all 7 real statements.

### BUG-002 · Advertising invisible — **P1, FIXED**

Amazon India bills Sponsored Products inside the settlement as `transaction-type = ServiceFee`,
`amount-type = Cost of Advertising`, `amount-description = TransactionTotalAmount`. The informative
column is the **amount-type**; the description is an internal token. `saBucketOf` read the description
first, so ad spend landed in "Other fees" and the breakdown table showed a row called
`TransactionTotalAmount`.

For Seller A that hid **₹4,491.98 — 44.3% of gross sales, more than every Amazon fee combined
(₹2,087.00)**. `adpSpendFromSettlement` already detected it correctly; the knowledge simply was not shared.

**After:** an "Advertising" stat card, its own ledger row and its own Trends series
("Advertising as % of sales — 44.3%"), plus a human label ("Sponsored Ads spend (billed as a service fee)").

### BUG-003 · `(no SKU)` ranked and advised as a product — **P1, FIXED**

Before: `SKUs · Units = 5 · 4` (four real SKUs); *"Weakest: (no SKU) (−₹2,146.09 net)"*; and
*"(no SKU) took ₹2,146.09 out of your settlement. Check **its price** … and **its weight band**."*

After: `SKUs · Units = 4 · 4`; *"Weakest: <a real SKU> (−₹197.06)"* — a real product; and a separate
**Account-level lines** panel that names what the money actually was, with advertising and balance
movements broken out and pointed at the right tool.

---

## Verified correct — recorded so the audit is falsifiable

| Check | Tool | Result |
|---|---|---|
| Σ of all line items = deposit total, to the paisa, on **7 of 7** statements incl. two negative payouts | Settlement Analyzer | PASS |
| Gross sales, refunds, net product sales, units, order count, refund-rate-by-value | Settlement Analyzer | PASS (exact) |
| TCS ₹2.14 · TDS 194-O ₹21.39 · ITC ₹13.86 · output GST ₹21.38 | GST & TCS Report | PASS (all four exact) |
| Per-SKU sales/fees/taxes/net, incl. order-level Easy Ship traced back through order id | SKU Profitability | PASS (exact on all real SKUs) |
| Sessions 1,254 · 17 ASINs · 33 units · account CVR 2.63% (unit-weighted — the correct definition) | Traffic Doctor | PASS (exact) |
| Wasted-traffic detection, lost-units 3.98 ≈ 4, lost value ₹1,586 | Traffic Doctor | PASS (exact) |
| Shipped 17 / cancelled 35 / pending 137 / RTO 0, per-state counts, date range | RTO Radar | PASS (exact) |
| 22 orders · 4 refunds · claimable ₹0.00 with the reason given; 22 closing fees audited against the rate card | Reconciliation | PASS (and honest — it declined to inflate) |
| 6 SKUs read, nothing flagged, sample rule stated ("4 units at one price") | Fee Band Optimizer | PASS |
| **Fee engine vs real Amazon charges:** closing ₹22 at ₹399 and ₹499; Easy Ship ₹55 at 0.4 kg, ₹75 at 0.9 kg; 0% referral under ₹1,000 | shared fee engine | PASS — matches the invoice |
| **Profit calculator vs a real settlement:** predicted ₹384.54 for a ₹499 Easy Ship order; Amazon paid **₹384.54** | Profit Calculator | PASS to the paisa |
| BOM, quoted `"₹5,988.00"`, `%` strings, tab `.txt`, comma `.csv`, CRLF, `DD.MM.YYYY`, negative amounts, multi-unit orders | shared parsers | PASS |
| Zero-denominator sweep across all 12 calculators — no NaN, no Infinity leak, no exception | free calculators | PASS (1 defect found: BUG-009) |
| 140 route × width combinations, no horizontal scroll, **0 unwrapped tables**, `<html lang>` present | responsive | PASS after BUG-010 |
| No network request of any kind during file parsing; all 9 outbound calls in source carry no file content | privacy | PASS — the claim is substantiated |
