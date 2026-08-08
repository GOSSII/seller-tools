# UI Visual Audit — Seller Tools India

Screens captured at **real viewports** (Chrome, deviceScaleFactor 2) driven through each
tool's own file input with the same Amazon reports the accuracy audit used, then reviewed
by an independent party that had, until this round, only ever seen numbers.

```
node qa/ui-capture.mjs            # all three audited tools + error states
node qa/ui-capture.mjs settlement # one tool
node qa/local-preview.mjs         # click through the same build by hand
```

Screenshots are written to `qa-data/screenshots/`, which is **gitignored** — the
transaction table shows real order ids and SKU names and this repository is public.

| Tool | Desktop | Mobile | Error states | Reviewed | UX before | UX after | Issues | Fixed |
|---|---|---|---|---|---:|---:|---:|---|
| 21 · Settlement Analyzer | ✅ 1440×900 | ✅ 390×844 | ✅ 6 | ✅ ×2 rounds | 16/20 · 92 | **18.5/20 · 96** | 13 | 13 |
| 23 · SKU Profitability | ✅ | ✅ | shares 21's | ✅ ×2 rounds | 14.5/20 · 86 | **17.5/20 · 94** | 8 | 8 |
| 24 · Multi-Month Trends | ✅ | ✅ | ✅ duplicate-file | ✅ ×2 rounds | 15.5/20 · 91 | **18/20 · 95** | 9 | 9 |
| 25 · Reconciliation & SAFE-T | ✅ | ✅ | shares 21's | ✅ ×2 rounds | 13.5/20 · 84 | **17/20 · 93** | 10 | 10 |
| 28 · Ad Profitability | ✅ | ✅ | ⚠ **partial** | ✅ ×2 rounds | 14/20 · 79 | **17.5/20 · 94** | 17 | 15 |
| 31 · RTO Radar | ✅ | ✅ | shares 21's | ✅ ×2 rounds | 15/20 · 82 | **19/20 · 94** | 11 | 11 |
| 33 · Traffic Doctor | ✅ | ✅ | ✅ wrong-file | ✅ ×2 rounds | 17/20 · 82 | **19/20 · 94** | 10 | 10 |
| Landing page | ✅ | ✅ | n/a | ✅ ×2 rounds | — · 82 | **19/20 · 95** | 9 | 9 |
| Profit Calculator | ✅ | ✅ | ✅ zero/edge | ✅ ×2 rounds | — | *re-score pending* | 5 | 4 |
| Target Price | ✅ | ✅ | ✅ zero/edge | ✅ ×2 rounds | — | **94** | 4 | 4 |
| Advertising ROAS *(was "ROI")* | ✅ | ✅ | ✅ zero/edge | ✅ ×2 rounds | — | **88 → 95 on rename** | 3 | 3 |
| Break-Even ACOS | ✅ | ✅ | ✅ zero/edge | ✅ ×2 rounds | — | **95** | 3 | 3 |
| FBA Fee · FBA Storage · ACOS · Marketing Budget · Coupon ROI | ✅ | ✅ | ✅ zero/edge | in review | — | — | 6 | 6 |
| Launch Budget · Price Band Optimizer · Restock Planner | ✅ | ✅ | ✅ zero/edge | in review | — | — | 3 | 3 |

### Tool 28 is reviewed PARTIAL, not passed

The Sponsored Products **Advertised Product** report could not be obtained for any
authorised account, so only two of the tool's three states were reviewed: the initial
screen and the **missing-ad-report** state. The populated path — real per-SKU ad spend,
ACOS against ad-attributed sales, the ads-turn-this-SKU-negative verdict — is
**BLOCKED — SOURCE DATA UNAVAILABLE** and is not claimed as tested. Two accepted
recommendations are deferred for the same reason: mobile card layout for the wide table,
and the settlement-billed-vs-ad-report reconciliation check.

## Error and edge states captured

| State | How it was produced |
|---|---|
| Wrong report — Business Report into the Settlement Analyzer | real `SELLER-A-BUSINESS-REPORT-01` |
| Wrong report — All Orders into the Settlement Analyzer | real `SELLER-B-ALLORDERS-01` |
| Header row, no data rows | `qa/fixtures/settlement-header-only.txt` |
| **Unrecognised Amazon transaction type** | `qa/fixtures/settlement-unknown-row.txt` |
| Same settlement uploaded twice | real file passed twice to Trends |
| Settlement dropped into Traffic Doctor | real settlement into the wrong tool |

## What the screenshots caught that the numeric audit had not

**1 · A negative payout described as a deposit.** The card read *"DEPOSIT TOTAL −₹1,418.73"*
and the ledger closed with *"Deposited to your bank −₹1,418.73"* — on a green background.
Nothing was deposited. Every figure was arithmetically correct; the defect lived entirely in
the words and the colour attached to them, which is precisely what a numbers-only audit
cannot see. Negative settlements now read *"Net settlement balance / ⚠ no payout this
statement — carried forward against your balance"* in amber, and the closing ledger row
changes with it. Green is reserved for money that actually arrived.

**2 · A headline that contradicted the panel beneath it.** *"Net across all SKUs −₹1,418.73"*
sat directly above *"account-level lines … excluded from every per-SKU figure above"*. The
four product rows sum to **₹727.36**; ₹727.36 − ₹2,146.09 = −₹1,418.73. The total was
silently including the bucket the page promised to keep out. Totals now cover products only.

**3 · "Profit" claimed without cost of goods.** A SKU contributing ₹308 on a ₹399 sale is a
loss if the unit cost ₹350. The tool cannot know until COGS is entered, so it no longer says
"Good"; it says "Positive contribution", carries a standing *"Product cost not added"*
warning, and reserves "Profitable"/"Loss-making" for advanced mode where the cost is known.

**4 · A recommendation that did not match the cause.** A SKU whose entire sale was refunded
was met with *"check its price and weight band"* — neither caused it. When refunds explain
the loss the tool now says so.

**5 · The most important number was not the most prominent one.** Sponsored Ads at 44.3% of
gross sales cost **2.15×** every Amazon fee combined, and it was one KPI among six and one
chart among four. It is now a callout under the KPI row, KPI cards lead with rupees rather
than percentages, and the charts run product sales → ads % → fees % → refunds %.

**6 · A screen that contradicted itself in adjacent elements.** Ad Profitability showed
**"ADVERTISING ₹0"** immediately above a banner reading *"this settlement does show
₹4,492 of advertising"*. Both were rendered from the same computation. ₹0 attributed is
not ₹0 spent, and the real figure was **44.3% of gross sales** — the largest single cost
on the account. The card now reports the spend the settlement proves (**Sponsored Ads
billed −₹4,492**) and reports the attribution gap as a gap (**SKU-attributed ad spend:
Not available**). "Left after ads" is not computed at all until attribution exists,
because payout − 0 merely restated the payout while ignoring money the tool already knew
about.

**7 · The same defect class, unfixed in a second tool.** Three defects fixed in the SKU
Profitability Report were still live in Ad Profitability: `(no SKU)` ranked first among
products, "Profitable" claimed with no COGS, and a reassuring green zero. A per-tool
review found them; a per-defect review would not have. Every fix in this audit is now
checked against **all** tools that consume the same model, and missing COGS is `null`
rather than `0` in the compute layer so it cannot flow through a profit formula as a
real cost of zero.

**8 · Instructions that outlived their controls.** Reconciliation's "How to claim" block
told the seller to *"paste the text from the row's 📋 Claim button"* — under a table whose
Claim buttons had just been replaced by "Window likely closed" chips. Fixing a control
without re-reading the prose that describes it leaves a screen pointing at something that
no longer exists.

**9 · Volume is not maturity.** RTO Radar guarded its per-state rates at 10+ shipped
orders but showed **"RTO RATE 0.0%" in green** as its headline — on a five-day export where
its own banner said 137 of 189 order items were still pending and *"an RTO can take 2–3
weeks to be recorded"*. Zero of 17 shipped is not a low RTO rate; it is a cohort too young
to have one. A rate now requires 10+ shipped order items **at least 21 days old**, measured
against the newest order in the file — the only "as of" a file can prove — and the gate
applies to every table, chip and recommendation so the page holds one view of its own
confidence rather than two.

**10 · The wrong noun on every label.** `rtoCompute` deduplicates by order-item, so every
counter on the page is an **order item** — but the UI said "17 shipped **orders**" and "52
**orders**". The audited file is 189 order items across **188** distinct orders: close
enough to hide the defect, and materially wrong on any multi-item account. Found by the
independent reviewer, who demanded the parser be checked rather than the label be trusted.

**11 · A metric is not a cause.** Traffic Doctor read one ratio — 0.88% conversion on
227 sessions — and concluded *"the fix is the listing (images, price, reviews, first
bullet), **not more ads**"*. That ratio identifies none of images, price, reviews,
delivery promise, inventory, ad-traffic relevance or competitor promotions, and with no
advertising report loaded the tool had no basis whatsoever to advise against advertising.
The page now follows **signal → evidence → possible interpretation → investigation**.

It also gained the one diagnostic the evidence *does* support — **elimination**. For the
worst converter it now says: *"227 sessions, 0.88% conversion and 100% Featured Offer
share. Traffic exists and Featured Offer share is high in this export, but conversion is
well below the account's 2.63% benchmark. Featured Offer share is not the obvious issue
here."* It establishes what traffic proves, rules out the Featured Offer explanation, and
narrows the next step without naming a root cause — and it inverts when Featured Offer
share is low instead.

**12 · One model, or the tools disagree about the same SKU.** Three pricing calculators —
Profit, Target Price and Price Band Optimizer — each charged advertising against *residual
contribution* rather than the selling price. The Profit Calculator understated advertising
by **58%**; Target Price returned a price **₹85 too low** while its own ledger visibly
failed to sum to its total; and the Price Band Optimizer, whose whole purpose is comparing
prices, **recommended a different price** — ₹1,100 showing a ₹70 profit where the corrected
model finds a ₹281 loss at every price in range. They now share one model and return an
identical ₹317.83 at the shared defaults.

**13 · Unknown must mean unknown everywhere.** The first fix left an unrecognised row badged
"Fee" in the breakdown table while the banner above called it unrecognised. A row's category
now comes from its *classification*, not Amazon's transaction-type, so it reads
"⚠ Not recognised" in the table, the chips and the filters — and can never be badged a fee.

## Copy changes made

| Before | After |
|---|---|
| Deposit total / Deposited to your bank *(on a negative)* | Net settlement balance / no payout this statement — carried forward |
| Avg order value | Gross avg order value — before refunds |
| GST on fees — claim as ITC | GST charged on Amazon fees — may be claimable, check with your CA |
| Referral & closing fees *(with no referral fee present)* | Closing fees · Refund commission — Amazon's charge for processing the refund |
| Net across all SKUs | SKU settlement contribution |
| Good / Loss | Positive contribution / Negative contribution *(Profitable / Loss-making only with COGS)* |
| Best earner / Weakest | Strongest in this settlement / Needs attention — before product cost |
| Account-level lines | Costs and adjustments not tied to a product |
| Which days sell | Sales by weekday |
| `other-transaction` / `Debt Adjustment` | Other Amazon charges / Account balance transfer *(raw token kept in the tooltip)* |
| `TransactionTotalAmount` | Sponsored Ads spend (billed as a service fee) |
| "…the net that actually reached your bank — per SKU" | "…each SKU's settlement contribution — before product cost" |
| ₹ at stake *(every reconciliation check)* | Refund value · Excess charged · Overcharged · Duplicated fee · Fee not credited · Invoice value · Unit value · Net loss |
| SAFE-T-eligible refunds | Potential SAFE-T cases (seller-fulfilled refunds) |
| Claim *(on a row past the filing window)* | Window likely closed *(a chip, not a button)* |
| "a checklist of money worth chasing" | "check for fee discrepancies… confirmed discrepancies are kept separate from cases that need more evidence" |
| Advertising ₹0 | Sponsored Ads billed −₹4,492 · SKU-attributed ad spend: Not available |
| Left after ads *(= payout − 0)* | Net settlement cash flow · SKU ad profitability: Cannot calculate yet |
| Profitable *(no ad data, no COGS)* | Profit cannot be determined — needs ad report / needs product cost |
| Payout after fees | Settlement contribution |

## Method note

Playwright drives the capture because a true 390 px viewport is required and window
resizing does not reflow the browser-extension tab in this environment. It is a real Chrome
rendering the real file — not a source-code view. The paywall check is bypassed in a
temporary copy, because the capture is automated and has no login session; nothing else
differs from what a paying seller sees, and that was disclosed to the reviewer each time.
