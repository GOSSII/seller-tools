# UX Register — Seller Tools India audit

Audited at 1440 / 1024 / 768 / 390 px across **140 route × width combinations**
(`node qa/responsive-audit.mjs`, results in `qa/out/responsive-audit.json`), plus a
beginner-comprehension pass on every screen that produced output during the audit.

**The headline:** this product is unusually good at UX honesty — it states its formulas, names its
data basis, warns about part-covered months, guards small samples in two tools, and refuses to inflate
a claimable figure. The findings below are mostly about places where that discipline lapsed, not about
a product that lacks it.

| ID | Tool / screen | Problem | Seller impact | Recommendation | Pri | Implemented? |
|---|---|---|---|---|---|---|
| UX-001 | Home, "Teen kaam. Barah tools." section | Says twelve paid tools; there are **13** (SKU P&L with your costs appears only in the pricing grid) | Small credibility hit; a Pro feature is under-sold | Say thirteen, or add the card | P3 | No |
| UX-002 | Router | An unknown `#/…` hash silently redirects to home. `renderNotFound()` exists (`:3023`) but is only used to hide the admin panel | A dead/mistyped link bounces with no explanation | Route unknown ids to `renderNotFound()` | P3 | No |
| UX-003 | Settlement Analyzer | "Amazon fees" was a single ambiguous number with no denominator | Seller could not tell fees from advertising from balance movement | Split fees / advertising / account adjustments; show "23.5% of gross sales" under the card | P1 | **Yes** |
| UX-004 | Settlement Analyzer | "Avg order value" ignored refunds and counted order-*items* | Overstates on multi-SKU orders; label implies net | Renamed **Gross avg order value** with "before refunds"; denominator now distinct order ids | P2 | **Yes** |
| UX-005 | Settlement Analyzer, GST report | "GST on fees — **claim as ITC**" asserts eligibility a settlement file cannot establish | A seller may claim ITC they are not entitled to | "GST charged on Amazon fees — may be claimable as input tax credit, check with your CA" | P2 | **Yes** |
| UX-006 | Settlement Analyzer, SKU report | Amazon's internal tokens shown raw: `TransactionTotalAmount`, `MFNPostagePurchaseCompleteIGST`, `Payable to Amazon` | Unreadable; the biggest cost line looked like noise | `saNiceLabel()` renames only the genuinely opaque ones, keeping ordinary fee names intact for cross-checking against Seller Central | P2 | **Yes** |
| UX-007 | SKU Profitability | `(no SKU)` ranked among products and given price/weight advice | Actively misleading advice | Own "Account-level lines" panel, excluded from ranking | P1 | **Yes** |
| UX-008 | Multi-Month Trends | Day-of-week verdict from one occurrence of a weekday | Would send real budget to a day chosen by noise | Withhold the verdict until each weekday has 4+ occurrences and the period has 30+ orders; show the table as history | P2 | **Yes** |
| UX-009 | Multi-Month Trends | Zero-sales months drew a 0% fee bar and anchored a Δ | "Fees up 150.1 points" from an empty month | Ratios are `null` when there are no sales; charts skip them; table shows "—"; "Months covered 5 [2 with sales]" | P2 | **Yes** |
| UX-010 | Traffic Doctor | Estimate labelled "a month"; the Business Report has no dates | Overstated ~3.3× on a 99-day export | Say "over the period this report covers" and explain why the tool cannot know | P2 | **Yes** |
| UX-011 | Traffic Doctor | No data-provenance line: the period is never shown or asked for | Seller cannot tell what window the numbers describe | Add an optional "period covered" input, echo it beside every figure | P2 | No |
| UX-012 | RTO Radar | "Cancelled before shipping 67.3%" with the denominator hidden and no sample guard | Alarming and wrong-looking; true rate 18.5% of all orders | Show the denominator; withhold the rate under 10 resolved orders; suppress the red state | P1 | **Yes** |
| UX-013 | RTO Radar | Empty "RTO by SKU" table = bare header | Reads as broken | Explain why it is empty | P3 | **Yes** |
| UX-014 | ACOS Calculator | `ACOS 0.00%` in **green** when ad sales are zero | Reads as perfect ads on the screen where every rupee was lost | "No ad sales", red, with a banner explaining the spend returned nothing | P1 | **Yes** |
| UX-015 | Payout Forecaster (any `.cols` page) | Horizontal page scroll at 390 px | Whole page slides sideways on a phone | `.cols>*{min-width:0}` + `min-width:0` on inputs | P2 | **Yes** |
| UX-016 | Reconciliation | "Issues flagged 4 · Still to action 4" when all four SAFE-T windows have closed (each row says so) | Sends the seller to file claims that cannot be filed | Split "actionable now" from "window closed" in the headline counts | P2 | No |
| UX-017 | GST & TCS Report | No CSV/PDF export, unlike its sibling reports | The one report meant to be handed to a CA is the one you cannot export | Add the CSV export the other tools have | P2 | No |
| UX-018 | GST & TCS Report | Stat cards show ₹2.14 positive while the table shows −₹2.14 for the same figure | Reader wonders which sign is right | Pick one convention per screen, or label "withheld" vs "movement" | P3 | No |
| UX-019 | Mobile, several tools | Sub-44 px tap targets: the file-chip `✕` remove buttons and the keyword-combiner match-type buttons | Fiddly on a phone; the `✕` deletes an uploaded file | Pad to 44 px (footer/inline text links are exempt under WCAG 2.5.8) | P2 | No |
| UX-020 | Home / all tools | Two controls have no accessible name at 390 px | Screen-reader users cannot identify them | Add `aria-label` | P2 | No |
| UX-021 | Account page | Logout does not clear tool data (product costs, GSTIN/business address, FNSKU rows) | On a shared machine the next user can read it | Clear tool keys on logout, or a "clear my saved data" control | P2 | No |
| UX-022 | Free calculators | No CSV/PDF export or shareable state on any of the 12 | A seller cannot hand a costing to a partner | Low priority — but a "copy result" button is cheap | P3 | No |

## Beginner comprehension — the 10-second test

Scored against the brief's four questions (*What is this? Is my number good or bad? Why does it matter?
What should I do?*), on screens driven with real data.

| Screen | Before | After fixes | Note |
|---|---|---|---|
| Settlement Analyzer | 6/10 — reconciliation excellent, but the headline fee number was economically wrong | **9/10** | Bucket ledger that sums to the deposit is genuinely best-in-class |
| GST & TCS Report | 9/10 | 9/10 | Best copy in the product: says plainly that it follows settlement dates, that the MTR is what you file from, and that it is "an aid, not tax advice" |
| SKU Profitability | 5/10 — a non-product ranked as the weakest product | **9/10** | "needs cost" instead of a flattering profit was already the right call |
| Multi-Month Trends | 6/10 | **8/10** | The run-rate explanation and part-month warning are excellent; the weekday panel was the weak point |
| Traffic Doctor | 8/10 | **9/10** | Diagnoses relative to the account's own average, and labels its one estimate as an estimate |
| RTO Radar | 6/10 | **8/10** | Min-sample guard was already there for RTO; it just wasn't applied to cancellations |
| Reconciliation & SAFE-T | 9/10 | 9/10 | Tells you ₹0.00 is claimable and why — the rarest thing in this category |
| Fee Band Optimizer | 9/10 | 9/10 | "Proven, not guessed" framing, full rate card shown for checking |

## Information architecture

The existing taxonomy — **Paisa wapas lo** (recover) / **Kharcha ghatao** (cut cost) / **Hisaab samjho**
(understand) — is better than the generic Sales/Profitability/Advertising split the brief offered,
because it is organised by *what the seller wants to do* rather than by report type. Keep it. Two notes:

1. The section lists 12 of the 13 paid tools (UX-001).
2. The 20 free tools are one long undifferentiated grid. They would read better in the same
   job-shaped groups — *Price it right* (profit, fba-fee, price-bands, target-price, break-even-acos),
   *Ship it* (label-cropper, order-printer, fnsku-labels, gst-invoice), *Advertise it*
   (acos, advertising-roi, marketing-budget, launch-budget, coupon-roi, keyword-combiner, link-builder),
   *Stock it* (restock-planner, fba-storage, payout-forecast), *Fix the listing* (listing-checker).
