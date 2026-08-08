# Release Checklist — Seller Tools India

Derived from the 2026-08-08 audit (52 defects, [BUG_REGISTER.md](BUG_REGISTER.md)). Run this before
any release that touches `web/index.html`.

It is deliberately short on generic QA advice and long on **the specific mistakes this product has
actually made**. Every item below exists because something shipped wrong once.

**Setup:** Playwright is not in the repo (`web/` has no root `package.json`). Install it in a scratch
directory and symlink:

```bash
npm i playwright            # in a scratch dir, Chrome channel
ln -sfn <scratch>/node_modules node_modules   # remove when done
node qa/local-preview.mjs   # serves the build on :8899 — NOBANNER=1 matches production
```

---

## 1 · Automated gates — all must pass

| Command | Expect | Fails if |
|---|---|---|
| `python3 qa/syncheck.py` | `SYNTAX OK` | JS syntax broken |
| `node qa/tests/run-tests.mjs --real` | **75 passed, 0 failed** | any behaviour regression |
| `node qa/responsive-audit.mjs` | **0 layout problems**, 0 missing `<html lang>` | horizontal scroll at 390 px |
| `node qa/consistency-audit.mjs` | 38 routes, **0 page errors** | a route throws |
| `node qa/tests/perf.mjs` | 100k rows **< 300 ms**, heap **< 120 MB** | parser regression |
| `python3 qa/reference-calculations/settlement_ref.py <files>` | matches the site to the paisa | classification drift |

Current baseline: 100k rows parse in **203 ms**, total **277 ms**, heap **~98 MB**.

> ### `node --check` is not sufficient. Never treat it as the syntax gate.
> A top-level `const` referencing constants declared later in the file is **valid syntax** and a
> **dead application** — the temporal dead zone throws at load and every tool renders blank
> (BUG-051). `node --check` passed it. Only the browser test caught it.
> **After touching any top-level declaration in `web/index.html`, load a page in a real browser.**

---

## 2 · The six defect families

These are the classes this audit found repeatedly. Check every new or changed tool against all six.

### ① A correct-looking percentage on the wrong base
The most expensive family here — **nine P1 defects**, all in the free tier.

- [ ] Every `%` input: does the label's term have an **industry definition**, and does the code use it?
- [ ] ACOS is `ad spend ÷ ad sales`. Charged against residual contribution it understated advertising
      by **58%**, returned a price **₹85 too low**, and changed which price a tool recommended.
- [ ] Does the ledger's arithmetic **sum to the total printed above it**? Target Price showed rows
      totalling ₹71.70 under a stated ₹143.36.
- [ ] Do two tools given the same inputs return the same answer? Profit, Target Price and Price Bands
      must all give **₹317.83** at the shared defaults.

### ② Zero vs unavailable
- [ ] Is a displayed `0` a **measured zero** or an **unknown**? They must not look alike.
- [ ] Undefined ratios render as `—` / "Not measurable" / "Cannot calculate yet" — never `0` in green.
- [ ] Precedent: ACOS `0.00%` green after spending ₹5,000 (BUG-009); `∞` days of cover from zero
      sales (BUG-050); `0.00× ROAS` red from a zero CPC (BUG-035).

### ③ A verdict without the inputs it requires
- [ ] Does the tool **hold every input** the judgement needs? If not, it states the observation.
- [ ] "Profitable" needs settlement contribution **and** ad attribution **and** product cost.
- [ ] ACOS/ROAS/TACoS cannot be graded without a margin. 3× ROAS is fine at 50% and loss-making at 25%.
- [ ] Removed for this reason: "Worth running", "Healthy TACoS", ACOS red >30%, ROAS green >3×,
      "your planned price is efficient", "Beyond 6 months you tie up cash".

### ④ An unsourced number driving a real figure
- [ ] Any benchmark, median or "typical" — **where is it from?** If there's no defensible source,
      remove it; do not cite it vaguely.
- [ ] Removed: a per-category margin benchmark (4%/9%/16%), a per-category TACoS that drove an entire
      ad budget, "15–25% is a sustainable margin", "a typical launch leans heaviest on PPC".
- [ ] Assumptions that must stay become **visible inputs**: months in FBA storage, expected return
      cost, ₹150/hour, 90 seconds per order.

### ⑤ A cause asserted from a metric
- [ ] The report gives **signals**, not root causes. Pattern: *observed fact → evidence → possible
      interpretation → next investigation*. Never *metric → diagnosis → prescribed fix*.
- [ ] Removed: "the fix is the listing, not more ads"; "faster deliveries get refused less";
      "nobody sees them"; "which means real organic pull".
- [ ] **Elimination is allowed** and is the strongest thing these tools do: *"227 sessions, 0.88%
      conversion, 100% Featured Offer share — Featured Offer share is not the obvious issue here."*

### ⑥ Volume is not maturity
- [ ] Does the sample have enough **elapsed time**, not just enough rows? An RTO takes 2–3 weeks to
      record, so 15 shipments from yesterday is not a measurable RTO rate (BUG-020).
- [ ] Cohort gates apply to **every** surface — headline, tables, chips and recommendations. One
      confidence system per page, never two.

---

## 3 · Money and units

- [ ] Σ line items **= deposit total, to the paisa**, on every settlement including negative payouts.
- [ ] Balance movements between the two Account Type series are **not** fees (BUG-001).
- [ ] Advertising is **not** "other fees" (BUG-002).
- [ ] Unrecognised rows classify as `unknown` — never inferred from sign (BUG-013).
- [ ] `(no SKU)` is the account bucket: excluded from SKU counts, rankings and verdicts.
- [ ] Charts sum to **exactly** their stated total. FBA storage in a per-order pie pushed it past
      100% (BUG-038).
- [ ] Every count states its unit. `rtoCompute` dedupes by **order item**, not order — 189 items
      across 188 orders (BUG-021). **Read the parser; do not trust the label.**
- [ ] A smaller loss is **not** an earning (BUG-046).

---

## 4 · Claims and compliance

- [ ] No dated fee claim. "Since 10 June 2026…" rots; describe the mechanism instead (BUG-048).
- [ ] GST on Amazon fees is **potentially eligible** for ITC, never "claimable", and never added
      back into a profit figure.
- [ ] SAFE-T: the file proves Amazon refunded the buyer, **not** that a claim is eligible.
- [ ] No budget line, label or example implies paying for reviews — Amazon prohibits it and it puts
      the seller's account at risk (BUG-047).
- [ ] Marketing copy is **not more confident than the tool**. Check the landing page, tool tiles,
      catalogue `desc`, how-to steps and the meta description together — they drifted apart once.

---

## 5 · Privacy

- [ ] Upload a real report to the live site with DevTools open: **zero network requests** during
      parsing.
- [ ] Any new `localStorage` key is added to `toolDataKeys()`, or logout silently leaves it behind.
- [ ] Free tools that store personal data need their **own** clear control — their users never log
      out (PRIV-1: the GST Invoice Generator holds a business name, address and GSTIN with no login).
- [ ] `qa-data/` stays gitignored. No account name, order id, buyer detail or credential in
      `docs/qa/`.

---

## 6 · States to open by hand

Automation misses these; the audit found real defects in every one.

- [ ] **Empty** — before any file.
- [ ] **Loaded** — real data.
- [ ] **Wrong file** — a settlement into Traffic Doctor should name the right report, not parse garbage.
- [ ] **Header-only / unknown row type.**
- [ ] **Zero and negative** — negative payout, 100% returns, 0 sales, 0 CPC, all-loss price range.
- [ ] **Duplicate file.**
- [ ] **390 px** — every tool, not a sample.

---

## 7 · Before saying it is done

- [ ] Re-verify against the **live site**, not localhost. Everything above can pass locally and not
      be deployed.
- [ ] Anything blocked is recorded **BLOCKED — SOURCE DATA UNAVAILABLE**, never PASS. Partial
      coverage is stated as partial.
- [ ] If a test's expected value changed, say **why** in the commit — a changed test is the one thing
      that must never pass unexamined.
- [ ] Fix the **number** before the **word** that describes it. A global label rename once reached a
      calculator whose maths was still wrong, so it carried a correct label over a wrong figure for
      two commits.
