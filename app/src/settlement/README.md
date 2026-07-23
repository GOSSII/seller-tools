# Settlement analyzer — parser (Phase 1a)

**Isolated module.** This directory is standalone: nothing here imports from
`src/calculators/*`, and no calculator imports from here. The live profit
calculator that customers use is untouched. You can build, run, and test this
in isolation.

Phase 1a is the **parser only** — it turns Amazon India's Settlement flat-file
V2 into typed transaction records. It does **not** reconcile fees or decide
what Amazon "should" have charged; that is Phase 1b.

## What it does

`parseSettlement(text)` reads the report text and returns:

- `summary` — settlement id, dates, deposit date, total, currency (from the
  first data row)
- `records` — one entry per logical transaction (order line, refund,
  adjustment, fee), each with `orderId`, `sku`, `transactionType`, `quantity`,
  `principal`, and an itemised `fees[]` / `feeMap` of every other money line
- `errors` — malformed rows, each with a 1-based `line`, a `reason`, and the
  raw text. **Bad rows are reported, never silently dropped.**
- `header`, `unmappedColumns`, `missingColumns` — what the parser saw, for
  sanity-checking against a real export

It is **header-driven**: columns are matched by name from the file's own
header, so column order and unknown extra columns don't break it.

## Run the tests

From the `app/` directory:

```sh
npx tsx --test src/settlement/parser.test.ts
```

`tsx` runs TypeScript directly and is **not** added to the project's
dependencies — running the tests changes nothing about the app build. (If you
prefer, `npm i -D tsx` and add a `"test:settlement"` script; that's optional.)

## Before Phase 1b — one confirmation needed

The **column structure** (24 tab-delimited columns, header + summary row, the
`amount-type` / `amount-description` / `amount` triple per fee line) is from
Amazon's documented V2 flat-file format and is what the parser keys on.

What still needs a real file to pin down is the exact **`amount-description`
strings** Amazon India uses for each fee — e.g. is the referral fee labelled
`Commission`, the closing fee `FixedClosingFee`, GST/TCS as `TotalTaxWithheld`
vs `IGST`/`CGST`/`SGST`. The fixtures here use the documented/common labels,
but reconciliation (Phase 1b) matches on these strings, so **drop a real
exported settlement report (even a redacted one) and I'll confirm the label
map** before building the fee comparison. Because the parser is header-driven
and keeps every label verbatim in `feeMap`, confirming is a mapping step — not
a parser rewrite.
