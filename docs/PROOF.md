# Proof — what the tools actually found on real accounts

Every number here came out of the live tools run against real Amazon India seller
accounts during development (six accounts, 40+ settlement files, all reconciling
to the paisa against Amazon's own payout figures). Nothing is modelled or
estimated unless the line says so.

**Rules for using these numbers publicly**
- Never name the account. "A Delhi apparel seller", "an FBA home-goods seller".
- Never publish a figure that isn't in this file — if a new claim is needed, re-run
  the tool and add it here first, with the date.
- Say what the number *is*: money already lost, money claimable, or an estimate.
  The single fastest way to lose a seller's trust is an inflated "recover ₹X lakh".

---

## 1. Money Amazon owed and hadn't paid

| Finding | Number | What it is |
|---|---|---|
| SAFE-T claimable after filtering | **₹9,859** in one 2-month window | Claim-ready, after removing 414 false positives the first version produced |
| MFN refunds never returned to the seller | **10 units / ₹3,184** in 30 days | Refunded to buyer, item never came back |
| Refunds with no return request at all | **32 units / ₹13,581** | Buyer refunded, no return ever raised |
| Stock lost in Amazon's warehouse, never reimbursed | **2 units / ₹744**, stuck 48–61 days | Inventory ledger vs reimbursements |

**The honest part worth telling sellers:** the first version of this tool claimed
₹1,81,099 was "worth chasing". After verification against real files, the true
claimable figure was ₹9,859. Most tools in this category never do that second pass.

## 2. Money leaking out

| Finding | Number | What it is |
|---|---|---|
| Warehouse rent on stock that sold nothing | **₹1,683/month**, 18 dead ASINs | Already charged |
| Seller-paid return labels | **₹6,187 in 30 days** | Already charged |
| Weight-band savings available | **₹43,800 over 64 days** | Estimate — requires repacking |
| Wasted ad spend on SKUs with no attributable sales | **₹1,196** genuinely wasted of ₹27,756 flagged | After crediting sibling-SKU sales |

## 3. Problems that were invisible

| Finding | Number |
|---|---|
| Stock stranded and unsellable | **407 units, ₹1.44–2.24 lakh**, 135 units stuck **142 days** |
| RTO rate by state | **Jharkhand 18.8%** vs **Maharashtra 3.9%** (same seller, same period) |
| Returns caused by the wrong item being sent | **48 of 123** returns on one account |
| Refund rate on a distressed account | **37.5% of sales** in one month |
| ASIN with traffic but no conversion | **8,188 sessions at 1.38%** against a 3.56% account average |

## 4. Headline lines that are safe to use

> "One seller's stock had been stranded for 142 days. Amazon never told them —
> it's in a report they'd never opened."

> "₹6,187 of return shipping labels in 30 days, paid by the seller. It's in the
> returns report, in a column most sellers never read."

> "Jharkhand returned 18.8% of this seller's parcels. Maharashtra returned 3.9%.
> Same products, same month."

> "We found ₹1,81,099 'worth chasing'. Then we checked it properly. The real
> number was ₹9,859 — and every rupee of it was claimable."

---

## Suggested placements

1. **Landing page, under the hero** — the ticker already carries several of these.
2. **Each paid tool's paywall** — one number from the matching tool, so the proof
   is specific to what the seller is being asked to pay for.
3. **A "What we found" page** — the full table above, dated, with the methodology
   note. This is the page a sceptical seller shares with their CA.

## What would make this far stronger

Amazon's acceptance rate on the SAFE-T claims. File 5 claims from the ₹9,859 list,
record what Amazon pays, and the copy becomes "sellers have recovered ₹X, at a Y%
acceptance rate" — which is the only claim competitors can't copy.
