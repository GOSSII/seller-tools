# ChatGPT independent audit — SELLER-A-TOOL-21/23/24-TEST-001

**Conversation:** "Claude Code Testing Audit" (project *amazon tools Testing*)
`https://chatgpt.com/g/g-p-6a771a904afc8191b5749b354112af79/c/6a771af3-831c-83ee-87f4-0c5405c80978`
**Date:** 2026-08-08
**Files attached (unmodified originals, same SHA-256 as used for the site and the reference calculator):**

| File | Series | Period | SHA-256 |
|---|---|---|---|
| `SELLER-A-STMT-ELEC-03.txt` | Electronic Transactions | 25.05.2026 → 01.06.2026 | `1160ee25…` |
| `SELLER-A-STMT-COD-03.txt` | COD / Non-Transactional Fees | 25.05.2026 → 01.06.2026 | `3a5728aa…` |

ChatGPT confirmed both hashes matched before analysing.

---

## Verdict

| Tool | ChatGPT verdict | ChatGPT score |
|---|---|---|
| Settlement Analyzer | **FAIL** — calculation/classification defect | 68/100 |
| SKU Profitability | **FAIL** — serious attribution defect | 55/100 |
| Multi-Month Trends | **WARNING / likely FAIL** (provisional — only 2 of the 6 statements were attached) | 60/100 |

---

## Agreement with this audit's independent reference calculator

Every figure ChatGPT derived from the raw rows matches `qa/reference-calculations/settlement_ref.py` to the paisa:

| Quantity | Reference calculator | ChatGPT | Website |
|---|---:|---:|---:|
| File A — Amazon operating fees, ex GST | −₹1,187.00 | −₹1,187.00 | **−₹2,826.24** |
| File A — GST on those fees | −₹213.66 | −₹213.66 | −₹213.66 ✓ |
| File A — cross-account debt transfer | −₹1,639.24 | −₹1,639.24 | counted as "Other fees" |
| File B — Amazon operating fees, ex GST | −₹398.00 | −₹398.00 | **−₹4,183.33** |
| File B — "Payable to Amazon" | −₹3,785.33 | −₹3,785.33 | counted as "Other fees" |
| File B — cross-account debt transfer | +₹1,639.24 | +₹1,639.24 | counted as "Reimbursements & credits" |
| Deposit total (both files) | exact | exact | exact ✓ |

Two independent parties, working from the raw rows without seeing each other's code, produced the
same numbers. The website's payout reconciliation is correct; its **classification** is not.

## Key points ChatGPT established that this audit had not yet proven

1. **The pair is provably one transfer, not two events.** Both `Debt Adjustment` rows share the same
   adjustment reference `<adjustment-id>` and the same posting timestamp
   `30.05.2026 12:22:57 UTC`. Across the account they net to **₹0.00**. Calling one side a
   "reimbursement" asserts an economic benefit that did not occur.
2. **Correct denominator standard.** Fee rate should be *Amazon service fees excluding GST ÷ gross
   product sales*, stated with the denominator visible, and never silently switched between tools.
   Correct rates for these files: File A **22.11%** of gross, File B **23.47%** of gross
   (vs the website's 150.0% and an implied 247%).
3. **"Payable to Amazon" is unattributable.** The row does not say what created the liability, so the
   product must not present it as a current-period selling fee; it should be shown as an account-level
   adjustment and excluded from fee-rate maths.
4. **AOV is gross AOV.** ₹488.09 is arithmetically right but ignores refunds in the numerator, so it
   should be labelled *Gross average order value*.
5. **The ITC claim is stated too strongly.** "GST on fees — claim as ITC ₹213.66" should become
   "GST charged on Amazon fees: ₹213.66 — may be eligible for input tax credit subject to your
   registration, invoices and business use." A settlement file cannot establish eligibility.

## Where this audit goes further than ChatGPT

- ChatGPT noted the `ServiceFee` / `Cost of Advertising` / `TransactionTotalAmount` row was **not**
  present in the two attached files. That is correct. This audit located it in the other two
  statements of the same account (`SELLER-A-STMT-COD-02.txt` −₹2,380.45 and `SELLER-A-STMT-COD-04.txt` −₹2,111.53),
  confirming **₹4,491.98 of advertising spend — 44.3% of gross sales** is being displayed to the
  seller as "Other fees" under the raw Amazon label `TransactionTotalAmount`.
  ChatGPT's recommended treatment (advertising as its own category) is therefore not hypothetical
  for this account — it is the single largest cost line the seller currently cannot see.
- ChatGPT could not validate the six-file Trends totals. This audit's reference calculator did:
  gross ₹10,148.00, refunds −₹1,986.00, **true Amazon fees −₹2,087.00 (20.6% of gross)**,
  GST on fees −₹375.66, advertising −₹4,491.98, balance movements −₹6,301.10, deposits −₹5,093.74.
  The website's "156.9%" is therefore confirmed wrong against the full six-file set, not just inferred.

## ChatGPT's recommended event taxonomy (adopted for the fix)

```
PRODUCT_REVENUE      Order   + ItemPrice + Principal
PRODUCT_REFUND       Refund  + ItemPrice + Principal
SELLING_FEE          ItemFees (closing fee, refund commission), Easy Ship charges, …
FEE_TAX              the GST/IGST companion row of a recognised fee
ADVERTISING          ServiceFee + amount-type "Cost of Advertising"
BALANCE_TRANSFER     transaction-type "Debt Adjustment" naming the other account series
ACCOUNT_PAYABLE      amount-description "Payable to Amazon"
REIMBURSEMENT        only explicitly recognised reimbursement rows — never inferred from amount > 0
UNKNOWN_ACCOUNT_ADJUSTMENT   anything not confidently mapped

amazon_fee_total = SELLING_FEE + FULFILMENT_FEE      (NOT "every negative amount")
Cross-account transfers must never enter profit calculations.
```

## ChatGPT's priority list

| Priority | Change |
|---|---|
| P0 | Remove Debt Adjustment from Amazon Fees |
| P0 | Remove "Payable to Amazon" from Amazon Fees |
| P0 | Never treat a Debt Adjustment as a reimbursement |
| P0 | Exclude account-level rows from SKU profitability |
| P1 | Separate advertising from selling/fulfilment fees |
| P1 | Show the gross-sales denominator beside every fee % |
| P1 | Add an exact settlement reconciliation ladder |
| P1 | Add an "Account adjustments" section |
| P1 | Detect paired Electronic ↔ COD transfers and collapse to ₹0 net |
| P1 | Never recommend SKU actions for `(no SKU)` |
| P2 | Rename AOV → Gross AOV |
| P2 | "ITC claimable" → "GST charged; potentially ITC eligible" |
| P2 | Source-row drill-down per bucket; formula tooltips; "Reconciled ✓" badge |

> ChatGPT's closing instruction: *"Do not patch the visible percentages only. Fix the financial-event
> taxonomy first… All three tools should consume that same normalized classification layer."*

This audit agrees and is implementing exactly that — one shared classifier, consumed by the
Settlement Analyzer, GST report, SKU Profitability, Trends, Fee Bands and Ad Profitability.
