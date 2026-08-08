# Seller Tools India — Tool Manifest (Phase 0)

**Production:** https://amazonsellertools.vercel.app/
**Source of truth:** `web/index.html` (single-file app, 11,019 lines) — router at `web/index.html:10864`
**Audit date:** 2026-08-08
**Method:** every branch of `route()` read in source, then confirmed against the rendered production UI.

---

# TOTAL TOOLS DISCOVERED: 33

| Group | Count | Access |
|---|---:|---|
| A. Free calculators (`CALCS` array, generic renderer) | 12 | No login |
| B. Free utilities (own render function per tool) | 8 | No login |
| C. Paid report analyzers (upload an Amazon report) | 13 | Starter ₹199/mo (4) · Pro ₹499/mo (9) |
| **User-facing tools** | **33** | |
| D. Non-tool routes (auth, account, marketing, admin) | 10 | — |
| **Total routes** | **43** | |

Route count is 43 because `sku-report` has a second route (`sku-report/advanced`) that opens the
same tool with the Pro P&L panel requested — it is one tool, two entry points.

**No hidden or deprecated tool routes were found.** Every `if(h===…)` branch in `route()` is
reachable from the UI except `#/whoami` and `#/admin`, which are owner diagnostics (see §D).
Anything not matched falls through to `renderCalc(h)`, which for an unknown id **silently
redirects to the home page** (`web/index.html:3663`) — so there is no undocumented tool hiding
behind an unguessed hash. Note: `renderNotFound()` exists (`:3023`) but is only used to hide the
admin panel from non-owners; a mistyped or dead tool link therefore bounces to home with no
explanation instead of showing the 404 page that was written for it. Logged as UX-002.

---

## Cross-check: source routes vs live production UI

| Check | Result |
|---|---|
| Routes in `route()` | 43 |
| Tools linked from the production home page | 33 |
| Tools in source but not linked from home | 0 |
| Tools linked from home but missing in source | 0 |
| Home page's own claim | "20+ free tools" — actual free tools = **20** (12 + 8). Accurate. |
| Home page's Hindi section claim | "Barah tools" (twelve tools) = the 12 **paid** report tools listed in that section. The section lists 12 cards; the 13th paid tool (**SKU P&L with your costs**, `#/sku-report/advanced`) appears only in the pricing grid lower down. Minor inconsistency — logged as UX-001. |

---

# A. Free calculators (12)

All twelve share one renderer (`renderCalc`, `web/index.html:3661`) and one paint loop
(`paint`, `web/index.html:3731`). They take **typed inputs only — no file upload**, so
Phase 3/4 (same-file rule) does not apply to them; they are audited by driving the
production `compute()` with fixed input vectors and comparing against an independent
fee model.

**Shared fee engine** (`web/index.html:851–948`): `refRate` (23 category referral tiers ×
price band), `bandNote`, `closingFee`, `shipFee`, `esWeightHandling`, `fbaWeightHandling`,
plus the `CATS` / `CLOSING` / `SLABS` constants. A defect in this engine hits 6 of the 12
calculators at once, so it is audited once, separately, at the highest priority.

| Field | Value |
|---|---|
| **Category** | Pricing & profitability / Advertising / Planning |
| **Required Amazon report** | **None** — what-if calculators |
| **Optional reports** | Fee Preview report (to verify the referral rate the tool assumes); Business Reports or this site's SKU Profitability report to source a real daily sales rate for the Restock Planner |
| **Accepted file types** | n/a |
| **Expected Amazon columns** | n/a |
| **Date basis** | n/a (point-in-time rate card — "2026 rates", revised 16 Mar 2026 and 10 Jun 2026) |
| **Charts/tables** | Stat cards (≤4), a line-item breakdown, an optional stacked `split` bar, an optional `bench` benchmark slider |
| **Filters** | None |
| **Export** | None (no CSV/PDF on the free calculators) |
| **Empty-state behaviour** | Not applicable — every field has a default `d:` value, so results render on first paint |
| **Error handling** | Numeric inputs are coerced; no validation messages. Zero/blank denominators are the main risk and are audited per tool |
| **Related source files** | `web/index.html:949–1595` (definitions), `:851–948` (fee engine), `:3645–3803` (renderer). App parity: `app/src/calculators/*/engine.ts`, `app/src/data/amazonFees.ts` |

| # | Tool ID | Tool name | Production URL | Purpose | Inputs | Output metrics |
|---:|---|---|---|---|---|---|
| 1 | `profit` | Amazon Profit Calculator | `/#/profit` | True profit per unit after every Amazon India fee | Selling price, product cost, category, weight, L/W/H, fulfilment, zone, packaging, ACOS %, returns %, GST-registered toggle | Settlement, Net Profit, Net Margin, ROI, GST ITC Recoverable, Profit After ITC |
| 2 | `fba-fee` | FBA Fee Calculator | `/#/fba-fee` | What Amazon takes on an FBA sale | Price, category, weight, L/W/H, zone | Total FBA Fees, Fees % of SP, Net Settlement, Referral Rate |
| 3 | `fba-storage` | FBA Storage Fee Calculator | `/#/fba-storage` | Cost of holding stock in Amazon's warehouse | L/W/H, units in stock, units sold/month, days in stock, season | Monthly Storage, Months of Cover, Total Volume, Cost/Unit/Mo |
| 4 | `acos` | ACOS Calculator | `/#/acos` | Ad efficiency | Ad spend, ad sales, total sales | ACOS, ROAS, TACoS, Organic Share |
| 5 | `break-even-acos` | Break-Even ACOS Calculator | `/#/break-even-acos` | The ACOS at which an ad sale stops paying | Price, cost, fees/unit, conversion rate, target profit % | Break-Even ACOS, Break-Even CPC, Target ACOS, Target Max CPC |
| 6 | `advertising-roi` | Advertising ROI Calculator | `/#/advertising-roi` | What a PPC budget should return | PPC budget, avg CPC, conversion rate, AOV | Est. Clicks, Est. Orders, Projected Sales, ROAS |
| 7 | `marketing-budget` | Marketing Budget Planner | `/#/marketing-budget` | Budget needed for a revenue target | Monthly revenue target, category, custom TACoS % | Monthly / Daily / Weekly Ad Budget, TACoS Used |
| 8 | `launch-budget` | Product Launch Budget Calculator | `/#/launch-budget` | Total cost of launching a SKU | Launch days, daily PPC, coupon, creative, samples | Total Launch Budget, Avg Spend/Day, PPC Total, Launch Window |
| 9 | `coupon-roi` | Coupon ROI Calculator | `/#/coupon-roi` | Whether a coupon pays for itself | Price, discount %, coupon fee, uplift %, baseline orders, unit cost, fees | Discounted Price, Incremental Orders, Net vs Baseline, Coupon Fees |
| 10 | `price-bands` | Price Band Optimizer | `/#/price-bands` | Whether a price just under a fee step nets more | Planned price, cost, category, weight, size, fulfilment, zone, packaging, ACOS %, returns % | Best Price (≤ planned), Net at Best, Net at Planned, Uplift vs Planned |
| 11 | `target-price` | Target Price Calculator | `/#/target-price` | Lowest price that reaches a margin/profit goal | Target type + value, cost, category, weight, size, fulfilment, zone, packaging, ACOS %, returns % | Required Price, Best possible, Checked up to, Net Profit There, Margin There, Amazon Fees There |
| 12 | `restock-planner` | Restock Planner | `/#/restock-planner` | When to reorder and how much | Current stock, avg daily sales, lead time, safety buffer, days to order | Days of Cover, Stockout Date, Order By, Suggested Qty |

**Main calculations (free calculators):**
`referral = refRate(category, price) × price` · `closing = closingFee(price, fulfilment, category)` ·
`shipping = shipFee(price, fulfilment, zone, kg, sizeTier)` with volumetric weight from L·W·H ·
`GST = 18%` on Amazon fees · `settlement = price − allFees` · `net = settlement − cost − packaging − adCost − returnCost` ·
`margin = net / price` · `ROI = net / cost` · `ACOS = spend / adSales` · `ROAS = adSales / spend` ·
`TACoS = spend / totalSales` · `breakEvenACOS = contribution / price` · `daysOfCover = stock / dailySales`.

---

# B. Free utilities (8)

Own render function each; no login. Four accept a file.

| # | Tool ID | Tool name | Production URL | Purpose | Required Amazon report | Accepted files | Expected columns | Date basis | Main calculations | Output | Filters | Export | Empty state | Error handling | Source |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | `label-cropper` | Label Cropper | `/#/label-cropper` | Crop Easy Ship A4 label PDFs to 4×6 thermal, sorted by SKU | Orders → Manage Orders → **Print label & invoice** (PDF) | `.pdf`, multiple | n/a (PDF geometry + text extraction) | n/a | Page-half detection, SKU/order-id text extraction, invoice-page recognition, re-imposition | Cropped PDF (4×6, A4 1-up or 4-up), optional order list page | Output format, invoice handling, SKU-on-label toggle | Generated PDF download | Drop zone with instructions | Falls back gracefully if text layer missing | `:7132–7728` (pdf-lib + pdf.js via CDN) |
| 14 | `order-printer` | Order Printer | `/#/order-printer` | Picklists + packing slips | Orders → Order Reports → **Unshipped Orders** (`.txt`) | `.csv`, `.txt` | `order-id`, `sku` (required); `quantity-to-ship`/`quantity-purchased`, `product-name`, `recipient-name`, `ship-*`, `purchase-date`, `promise-date` | Purchase date (as supplied) | Group rows → orders; sum units per SKU | Picklist (units/SKU), packing slips (1/page) | None | Print | Drop zone | Names the missing required columns and stops | `:7729–7854` |
| 15 | `fnsku-labels` | FNSKU Sticker Generator | `/#/fnsku-labels` | Code-128 FBA unit stickers | None (FNSKU copied from Inventory → FBA Inventory) | n/a (typed rows) | n/a | n/a | Code-128 encoding (`fnskuCode128Values/Widths`), sheet imposition | A4 65/40/24-up or 4×6 thermal PDF | None | PDF download | Empty row table | Rows validated before generate | `:8261–8537` |
| 16 | `gst-invoice` | GST Invoice Generator | `/#/gst-invoice` | Buyer invoices from unshipped orders | Orders → Order Reports → **Unshipped Orders** (`.txt`, address columns enabled) | `.csv`, `.txt` | `order-id`, `sku`, ship-to address columns, price column if present | Purchase date | CGST+SGST if buyer state = seller state, else IGST; GST-inclusive/exclusive split | Merged A4 PDF, one invoice per order | Per-SKU unit price, GST rate, inclusive toggle | PDF download | Seller-details form first | Status line reports parse result | `:8538–9068` |
| 17 | `payout-forecast` | Payout Forecaster | `/#/payout-forecast` | Next settlement close + bank-credit date | None (last deposit date from Payments dashboard) | n/a | n/a | Settlement cycle dates | Cycle arithmetic + business-day shift for bank credit | Next deposit headline + next 6 settlement closes | Cycle length, deductions %, reserve %, bank delay | None | Defaults pre-filled | n/a | `:7855–8020` |
| 18 | `listing-checker` | Listing Quality Checker | `/#/listing-checker` | Score a listing's title/bullets/description | None | n/a (pasted text) | n/a | n/a | Banned-word, ALL-CAPS, repetition and keyword-coverage checks → weighted score | Score + "Fix first" list | None | None | Empty text areas | n/a | `:8021–8260` |
| 19 | `link-builder` | Amazon Link Builder | `/#/link-builder` | Search / 2-step / canonical / add-to-cart URLs | None (ASIN) | n/a | n/a | n/a | URL templating + slugging | 4 URLs with explanations | None | Copy buttons | Defaults | n/a | `:7010–7064` |
| 20 | `keyword-combiner` | Keyword Combiner | `/#/keyword-combiner` | Cartesian keyword lists for PPC | None (Search Term report is the suggested word source) | n/a | n/a | n/a | Cartesian product A×B×C, optional A↔B reversal, match-type wrapping | Combination list | Match type, reversal toggle | Copy | Empty text areas | n/a | `:7065–7131` |

---

# C. Paid report analyzers (13)

These are the tools that produce money numbers, and they are the audit's centre of gravity.
All parse **in the browser**; the privacy claim is verified in Phase 17, not assumed here.

**Shared parsing layer** — `saMapCols` (`:3804`), `saSplit` (`:3812`), `saParseAmount` (`:3819`),
`saCsvRecords` (`:9853`), `saReadDropped` (`:3932`), plus a dependency-free **XLSX reader**
(`:3844–3931`) that unzips the workbook in-browser and converts sheet 1 to CSV.

**Shared settlement parser** — `parseSettlement` (`:3952`), a plain-JS mirror of
`app/src/settlement/parser.ts`, with `parseUnifiedTransaction` (`:4045`) as a fallback that
converts the Monthly/Custom Unified Transaction report into the same record shape.

Settlement flat file **required columns** (`SA_REQUIRED`, `:3789`):
`settlement-id`, `transaction-type`, `amount-type`, `amount-description`, `amount`.
Also mapped: `settlement-start-date`, `settlement-end-date`, `deposit-date`, `total-amount`,
`currency`, `order-id`, `merchant-order-id`, `adjustment-id`, `shipment-id`, `marketplace-name`,
`fulfillment-id`, `posted-date`, `posted-date-time`, `order-item-code`, `merchant-order-item-id`,
`merchant-adjustment-item-id`, `sku`, `quantity-purchased`, `promotion-id`.

**Date basis (critical, differs per tool):**

| Basis | Meaning | Tools |
|---|---|---|
| **Settlement/posted date** | When Amazon *paid* — not when the order was placed or shipped | Settlement Analyzer, GST & TCS, SKU Profitability, Trends, Fee Bands, Ad Profitability, Returns (money side) |
| **Order date** | When the buyer ordered | RTO Radar (All Orders), Trends when an MTR is supplied |
| **Return/request date** | When the return was raised or received | Returns Analyzer (unit side), Reconciliation |
| **Report period (traffic)** | The window the Business Report was run for | Traffic Doctor |
| **Live snapshot (no period)** | State right now | Stranded Inventory |
| **Billing month** | The month Amazon billed storage | Storage Fee Analyzer |

These are **not interchangeable** — settlement revenue ≠ shipped revenue ≠ ordered revenue ≠
ad-attributed sales. Where a tool mixes bases (Reconciliation, Ad Profitability, Trends), the
mixing rule is itself an audit item.

---

### 21 · `settlement-analyzer` — Amazon Settlement Analyzer · Starter
| Field | Value |
|---|---|
| URL | `/#/settlement-analyzer` |
| Category | Payments & fees |
| Purpose | Itemise every rupee of a payout and prove it reconciles to the bank deposit |
| Required report | **Payments → All Statements → Download Flat File V2** (`.txt`, tab-delimited) |
| Optional | Monthly/Custom **Unified Transaction** report (auto-detected fallback) |
| Accepted files | `.csv`, `.txt` (single file) |
| Date basis | Settlement period / posted date |
| Main calculations | `saAggregate` (sales, fees, tax, credits), `saFlow` (every line into exactly one bucket), `saTrend` (daily), `saBucketOf` (fee labelling); reconciliation `|Σ all lines − total-amount| ≤ ₹1` |
| Output metrics | Deposit total · Net product sales · Amazon fees · Taxes/GST/withholding · Orders · Units · Avg order value · Refund rate (by value) · GST on fees claimable as ITC |
| Charts/tables | Daily trend bar chart, "Where the money went" bucket ledger, transactions-by-type, fee & deduction breakdown, full transaction table, "What should I do next?" |
| Filters | Search filter on the transaction table |
| Export | CSV (`settlement-<id>.csv`), branded PDF (Pro) |
| Empty state | Drop zone + how-to; premium gate for non-subscribers |
| Error handling | Per-line error list (column-count mismatch, unparseable amount, no transaction-type); missing-column banner; bucket-sum mismatch banner |
| Source | `:3952–4640` |

### 22 · `gst-report` — GST & TCS Report · Starter
| Field | Value |
|---|---|
| URL | `/#/gst-report` · Category: Tax |
| Required report | Same settlement flat file V2 |
| Accepted files | `.csv`, `.txt` |
| Date basis | Settlement period |
| Main calculations | `gstCompute` (`:4642`) — TCS (CGST/SGST/IGST split), TDS u/s 194-O, GST on Amazon fees (ITC), output GST collected |
| Output | TCS withheld · TDS (194-O) · GST on fees — claim as ITC · Output GST collected |
| Tables | TCS split, ITC on Amazon fees, every tax line in the settlement |
| Filters | None · **Export: none** (logged as UX gap) |
| Error handling | Inherits `parseSettlement` errors |
| Source | `:4642–4760` |

### 23 · `sku-report` — SKU Profitability Report · Starter (+ Pro P&L)
| Field | Value |
|---|---|
| URL | `/#/sku-report`, `/#/sku-report/advanced` (Pro) · Category: Profitability |
| Required report | Settlement flat file V2 |
| Optional | Product costs typed by the user (stored in `localStorage` under `sku_costs`) |
| Date basis | Settlement period |
| Main calculations | `skuCompute` (`:4764`) — per-SKU sales, fees, refunds, net; `skuStatus` (`:4805`) labels a SKU and explicitly says **"needs cost"** rather than showing a flattering profit |
| Output | SKUs · Units · Net across all SKUs · Fees as % of sales · Refunds as % of sales · True profit after product cost |
| Tables | Per-SKU breakdown; "What should I do next?" |
| Filters | Search + sort · **Export: CSV** (`sku-profitability.csv`) |
| Error handling | Inherits settlement parser; Pro panel gated with an upgrade card |
| Source | `:4761–5047` |

### 24 · `trends` — Multi-Month Trends · Starter
| Field | Value |
|---|---|
| URL | `/#/trends` · Category: Sales |
| Required report | **Several** settlement flat files (one per statement) |
| Optional | MTR B2C (`Reports → Tax Document Library → Merchant Tax Reports → B2C`) for order-date units |
| Accepted files | `.csv`, `.txt`, `.xlsx`, multiple; duplicates skipped |
| Date basis | Settlement period; MTR adds an order-date view. **All month-over-month comparisons use a daily run-rate** so a part-covered month is not misread as a crash |
| Main calculations | `trendCompute` (`:6564`), `trendInsights` (`:6711`) |
| Output | Months covered · Gross sales · Fees as % of sales · Refund rate (by value) · Net payout |
| Charts/tables | Month-by-month charts, plain-English "what changed", which days sell, per-SKU trend |
| Filters | SKU picker · **Export: CSV** (`trends-month-over-month.csv`) |
| Source | `:6564–6987` |

### 25 · `reconcile` — Reconciliation & SAFE-T Finder · Pro
| Field | Value |
|---|---|
| URL | `/#/reconcile` · Category: Money recovery |
| Required report | Settlement flat files **from both Account Types** — *Electronic Transactions* **and** *Cash On Delivery Transactions and Non-Transactional Fees*. Skipping one makes its orders look unpaid |
| Optional (each unlocks specific checks) | seller-fulfilled **Return Report** (Orders → Manage Returns → View reports → All Returns, 60-day ranges) · **Inventory Ledger** (detailed) · **Replacements** report · **FBA customer returns** + **Reimbursements** (must be supplied together, exact matching dates) · **MTR B2C** |
| Accepted files | `.csv`, `.txt`, `.xlsx`, multiple |
| Expected columns | Settlement: as §C shared. FBA returns: `return-date`, `order-id`, `sku`, `quantity`, `detailed-disposition`, `reason`. Reimbursements: `reimbursement-id`, `amazon-order-id`, `sku`, `amount-total`, `reason`, `approval-date`. Inventory Ledger: `date`, `msku`, `event type`, `quantity`, `disposition`, `reason`, `fnsku`. Replacements: `replacement-amazon-order-id`, `original-amazon-order-id`, `sku`. MFN returns: `order id`, `return request date`, `resolution`, `return delivery date`, `merchant sku`, `safet claim id`, `return type`, `refunded amount`, `return quantity`, `return reason`, `label cost`, `label to be paid by`. MTR: `order id`, `transaction type`, `sku`, `quantity`, `invoice amount`, `shipment date`, `order date` |
| Date basis | Mixed by design — settlement (money) vs return/request date (units) vs order date (MTR). Cross-basis joins are keyed on order id, not date |
| Main calculations | `recCompute` (`:5271`, ~460 lines) — missing referral-fee credits on refunds, SAFE-T-eligible refunds, shipped-but-unpaid orders, lost-in-warehouse stock, refunded-never-returned, damaged-at-Amazon; claim amounts exclude GST recoverable as ITC |
| Output | Checked · Issues flagged · Claimable (upper bound) · Refunds to review · Shipped, not yet paid · Still to action |
| Tables | One panel per check, each row with order, amount and the exact Seller Central claim path; tick-off state saved in `localStorage` (`rec_done`) |
| Export | CSV (`reconciliation-checklist.csv`) |
| Error handling | Warns when an `.xlsx` return report stores dates as serial numbers and disables the affected checks rather than guessing |
| Source | `:5048–6020` |

### 26 · `fee-bands` — Fee Band Optimizer · Pro
| Field | Value |
|---|---|
| URL | `/#/fee-bands` · Category: Fees |
| Required report | Settlement flat file(s) — several improves confidence |
| Accepted files | `.csv`, `.txt`, `.xlsx`, multiple |
| Date basis | Settlement period |
| Main calculations | `fbCompute` (`:6060`) — actual referral/closing/weight band **read from the fee lines actually billed**, then tested against `FB_EDGES` / `REC_FEE_FOR`; packed weights typed by the user (`localStorage` `fb_weights`) |
| Output | SKUs read · Proven, not guessed · Worth testing · Over this period |
| Tables | "Priced just over a fee step", "Weight bands" with a claimable / one-packaging-change / physically-impossible verdict; full rate card |
| Export | CSV (`fee-band-savings.csv`) |
| Known limitation stated in-product | Statements where selling fees are invoiced separately have no fee line to read a band from, so the price side is unavailable — matches this account's situation (see `owner-settlements-fee-invoiced`) |
| Source | `:6021–6563` |

### 27 · `ads-optimizer` — Ads Optimizer · Pro
| Field | Value |
|---|---|
| URL | `/#/ads-optimizer` · Category: Advertising |
| Required report | **Sponsored Products → Search term** report (Advertising console → Reports), 30–60 days |
| Optional | Sponsored Products **Advertised product** report + settlement files → per-SKU break-even ACOS instead of a flat line |
| Accepted files | `.xlsx` (native from the ads console), `.csv`, `.txt`, multiple; re-drops replace |
| Date basis | Ad-attributed, report period. **Ad sales are attributed sales, not settlement revenue** |
| Main calculations | `parseSearchTermReport` (`:9492`), `adsCompute` (`:9495`) |
| Output | Ad spend in report · Ad sales · Going to words that never convert · Winners under broad/auto |
| Tables | 🚫 Negate these · ⭐ Give these their own exact match · 🩸 Converting at a loss · 📋 Campaign scoreboard |
| Export | Paste-ready negative-keyword CSV |
| Source | `:9443–9551`, `:10709–10863` |

### 28 · `ad-profit` — Ad Profitability by SKU · Pro
| Field | Value |
|---|---|
| URL | `/#/ad-profit` · Category: Advertising × Profitability |
| Required reports | **Two**: settlement flat file (or Unified Transaction) **and** Sponsored Products **Advertised product** report for the same period — the only per-SKU ad-spend source |
| Optional | Product costs (without them the table shows payout, not profit) |
| Accepted files | `.csv`, `.txt`, `.xlsx`, multiple |
| Date basis | **Mixed** — settlement/posted date for revenue, ad report period for spend. This is the single most important semantic risk in the product and is audited explicitly |
| Main calculations | `parseApGroups` (`:9442`), `adpSpendFromSettlement` (`:9117`), `adpCompute` (`:9179`) — CTR, CPC, CVR, ACOS, TACOS per SKU, each SKU's break-even ACOS |
| Output | Payout after Amazon fees · Advertising · Left after ads · SKUs ads turn to a loss |
| Tables | Per-SKU funnel (impressions → clicks → orders), "ads turn profit into loss" list |
| Export | CSV (`ad-profitability-by-sku.csv`) |
| Source | `:9069–9442` |

### 29 · `returns` — Returns Analyzer · Pro
| Field | Value |
|---|---|
| URL | `/#/returns` · Category: Returns |
| Required reports | Any or all of: settlement flat files · **FBA customer returns** (Reports → Fulfilment → Customer Concessions) · seller-fulfilled **Return Report** (60-day ranges). Each panel switches on only when its file is present |
| Accepted files | `.csv`, `.txt`, `.tsv`, `.xlsx`, multiple |
| Date basis | Return date (units) + settlement date (money) |
| Main calculations | `returnsCompute` (`:9654`), `rtStatus` (`:9664`) |
| Output | Refunds (by value) · FBA stock recovered sellable · Seller-fulfilled: item came back · Return labels you paid |
| Tables | Why things come back (buckets → actions) · Amazon's own reasons · Per-SKU return economics · What should I do next? |
| Export | CSV (`returns-analyzer.csv`) |
| Source | `:9552–9945` |

### 30 · `storage` — Storage Fee Analyzer · Pro
| Field | Value |
|---|---|
| URL | `/#/storage` · Category: Inventory |
| Required report | **Reports → Fulfilment Reports → Payments → Monthly Storage Fees** (`.csv`), one file per month |
| Accepted files | `.csv`, `.txt`, `.tsv`, `.xlsx`, multiple months |
| Date basis | Billing month |
| Main calculations | `parseStorageFees` (`:9878`), `storageCompute` (`:9921`), `stoStatus` (`:9930`) — months of cover, rent per unit sold, zero-order ASINs |
| Output | Storage fee (latest month) · Rent on stock that sold nothing · Rent on 6+ months of cover · Avg stock on hand |
| Tables | Month by month · Who pays the rent · What should I do next? |
| Export | CSV (`storage-fees.csv`) |
| Source | `:9855–9945` |

### 31 · `rto` — RTO Radar · Pro
| Field | Value |
|---|---|
| URL | `/#/rto` · Category: Returns / logistics |
| Required report | **Fulfilment Reports → Sales → All Orders**, Order Date, last 30 days (`.txt`) |
| Optional | seller-fulfilled Return Report (which RTOs were already refunded) |
| Accepted files | `.csv`, `.txt`, `.tsv`, `.xlsx`, multiple with overlapping periods (deduped by order item) |
| Date basis | **Order date** |
| Main calculations | `parseAllOrders` (`:10091`), `rtoCompute` (`:10138`) — RTO rate by state with a minimum-sample guard, repeat-RTO pincodes, per-SKU RTO economics, cancellations separated |
| Output | RTO rate · Order value on RTO parcels · Cancelled before shipping · Worst state (enough data) |
| Tables | RTO by state · Repeat-RTO pincodes · RTO by SKU · By delivery speed · What should I do next? |
| Export | CSV (`rto-radar.csv`) |
| Privacy note | This report contains buyer ship-to city/state/pincode — handled in-browser; see Phase 17 |
| Source | `:10047–10290` |

### 32 · `stranded` — Stranded Inventory · Pro
| Field | Value |
|---|---|
| URL | `/#/stranded` · Category: Inventory |
| Required report | **Fulfilment Reports → Inventory → Stranded Inventory** (`.csv`) — live snapshot, no date range |
| Optional | Settlement files, to value rows whose listing was deleted at the SKU's own average selling price |
| Accepted files | `.csv`, `.txt`, `.tsv`, `.xlsx` |
| Date basis | **Snapshot — no period** |
| Main calculations | `parseStranded` (`:10336`), `strandedCompute` (`:10370`), `strStatus` (`:10377`) |
| Output | Units stranded · Value stuck · Longest stuck · Auto-removal scheduled |
| Tables | Why it's stranded — and the fix · Every stranded listing · What should I do next? |
| Export | CSV (`stranded-inventory.csv`) |
| Source | `:10292–10499` |

### 33 · `traffic` — Traffic Doctor · Pro
| Field | Value |
|---|---|
| URL | `/#/traffic` · Category: Listing performance |
| Required report | **Business Reports → By ASIN → Detail Page Sales and Traffic By Child Item** (`.csv`), ~30 days |
| Accepted files | `.csv`, `.txt`, `.xlsx` |
| Expected columns | `(child) asin` **(required)**, `sessions - total` **(required)**, `unit session percentage` **(required)**, `(parent) asin`, `title`, `page views - total`, `featured offer percentage`, `units ordered`, `ordered product sales` |
| Date basis | The Business Report's own period. Mixing periods double-counts sessions — the tool dedupes by ASIN and warns |
| Main calculations | `parseTraffic` (`:10513`), `trafficCompute` (`:10538`) — account CVR = units/sessions; `lowBar = max(1, accountCVR × 0.5)`; `starBar = accountCVR × 1.5`; `TD_MIN_SESS = 100`; diagnosis ∈ {invisible, buybox, noconv, star, thin, ok}; `lostUnits = sessions × (accountCVR − asinCVR)/100`, **labelled as an estimate** |
| Output | Account conversion, wasted sessions, estimated units/value lost |
| Tables | Traffic comes but buyers don't · ⭐ winners · invisible ASINs · Buy Box losses |
| Export | CSV |
| Source | `:10500–10708` |

---

# D. Non-tool routes (10)

| Route | Purpose | Notes |
|---|---|---|
| `#/` | Home / marketing | Lists all 33 tools |
| `#/pricing` | Plans & checkout | Razorpay; auto-renew disclosed, currently one-time (Subscriptions not yet active) |
| `#/login`, `#/signup`, `#/reset`, `#/new-password` | Supabase auth | Google OAuth + email |
| `#/account` | Plan, expiry, device sessions, tool links | |
| `#/changelog` | What's new | 16 entries, newest 2026-08-06 |
| `#/admin` | Owner admin — users, plans, online presence, client errors | Server-side authorised (`web/api/admin.js`) |
| `#/whoami` | Owner diagnostic | Not linked from the UI |

**Entitlement gating:** `PREMIUM_ROUTES` (`:10905`) — 14 route strings covering the 13 paid tools.
Gating is server-checked (`/api/entitlement`) with a last-known-plan grace cache, and re-checked
on window focus so a session taken on another device locks within seconds.

---

# Phase 1 summary — Website tool → Amazon report → columns → calculation

| Tool | Amazon report (exact Seller Central path) | Key columns | Headline calculation |
|---|---|---|---|
| Settlement Analyzer · GST & TCS · SKU Profitability | Payments → All Statements → Flat File V2 | `settlement-id`, `transaction-type`, `amount-type`, `amount-description`, `amount`, `sku`, `quantity-purchased`, `order-id` | Σ all lines = deposit; bucket every line exactly once |
| Multi-Month Trends | ≥2 × Flat File V2 (+ optional MTR B2C) | as above + MTR `order date`, `invoice amount` | Per-month totals on a **daily run-rate** basis |
| Reconciliation & SAFE-T | Flat File V2 **× both account types** + up to 6 optional reports | see §25 | Owed-but-unpaid detection, joined on order id |
| Fee Band Optimizer | Flat File V2 | fee lines per order | Billed band vs cheapest reachable band |
| Ads Optimizer | SP **Search term** report | campaign, ad group, search term, impressions, clicks, spend, 7-day sales/orders | Negate / promote / loss lists |
| Ad Profitability by SKU | SP **Advertised product** + Flat File V2 | advertised SKU, spend, sales, clicks, impressions + settlement per-SKU net | ACOS vs that SKU's break-even ACOS |
| Returns Analyzer | Flat File V2 + FBA customer returns + seller-fulfilled Return Report | `detailed-disposition`, `reason`, `label cost`, `label to be paid by`, `refunded amount` | Refund value / sales per SKU; sellable-recovery rate |
| Storage Fee Analyzer | Fulfilment → Payments → Monthly Storage Fees | asin, month, average quantity, estimated monthly storage fee | Rent vs units sold |
| RTO Radar | Fulfilment → Sales → All Orders (Order Date) | order id, order status, ship state/postal, sku, item price | RTO rate by state/pincode, min-sample guarded |
| Stranded Inventory | Fulfilment → Inventory → Stranded Inventory | sku, asin, stranded reason, units, date stranded, auto-removal date | Units × value, days stuck |
| Traffic Doctor | Business Reports → Detail Page Sales and Traffic **By Child Item** | `(child) asin`, `sessions - total`, `unit session percentage`, `featured offer percentage`, `units ordered`, `ordered product sales` | Diagnosis vs the account's own average CVR |
| Order Printer · GST Invoice Generator | Orders → Order Reports → Unshipped Orders | `order-id`, `sku`, `quantity-to-ship`, ship-to columns | Grouping + document generation |
| Label Cropper | Orders → Manage Orders → Print label & invoice (PDF) | n/a | PDF re-imposition |
| 12 free calculators + 4 free utilities | **None** | n/a | Fee-model arithmetic |

### Semantic separations the product must not blur (verified per tool in Phase 8)

| Metric | Where it comes from | Not the same as |
|---|---|---|
| **Settlement revenue** | Flat File V2 `principal` lines | Ordered revenue, shipped revenue |
| **Ordered revenue** | Business Report `ordered product sales` | Settlement revenue (excludes refunds, timing differs) |
| **Shipped revenue** | MTR / All Orders | Settlement revenue (payment lags shipment) |
| **Ad-attributed sales** | SP reports, 7/14-day attribution window | Any of the above — attribution ≠ cash |
| **Net sales** | Gross principal − refunded principal | "Net payout" (which is after fees and tax) |
| **Net payout / deposit** | `total-amount` on the summary row | Profit (no COGS) |

---

*Next: Phase 3 — download real reports from the authorized Seller Central accounts, checksum
them, and build the independent reference calculators before any number on the site is trusted.*
