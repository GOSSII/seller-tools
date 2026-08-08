#!/usr/bin/env python3
"""
Independent reference calculator — Amazon India Settlement Flat File V2.

Written from Amazon's report specification, NOT from the website's code.
Nothing here imports or mirrors web/index.html. Where the website groups or
labels rows a particular way, this file deliberately computes the *Amazon*
definition so a disagreement shows up instead of being hidden.

Usage:
    python3 settlement_ref.py <file.txt> [file2.txt ...]
    python3 settlement_ref.py --json <file.txt>
"""

import csv
import hashlib
import io
import json
import re
import sys
from collections import defaultdict


# ---------------------------------------------------------------- parsing


def read_rows(path):
    """Return (header, list-of-dict-rows, raw_line_count).

    Amazon hands out the settlement flat file as tab-separated UTF-8. The
    first non-blank line is the header. Every subsequent line is either the
    single summary row (all the transaction columns blank, total-amount set)
    or one amount line of one transaction.
    """
    with open(path, "rb") as fh:
        raw = fh.read()
    text = raw.decode("utf-8-sig")  # tolerate a BOM
    lines = [ln for ln in re.split(r"\r\n|\r|\n", text)]
    # first non-blank line is the header
    hidx = next(i for i, ln in enumerate(lines) if ln.strip() != "")
    delim = "\t" if "\t" in lines[hidx] else ","
    header = [h.strip() for h in next(csv.reader([lines[hidx]], delimiter=delim))]
    rows = []
    bad = []
    for i in range(hidx + 1, len(lines)):
        ln = lines[i]
        if ln.strip() == "":
            continue
        fields = next(csv.reader([ln], delimiter=delim))
        if len(fields) != len(header):
            bad.append((i + 1, len(fields)))
            continue
        rows.append(dict(zip(header, [f.strip() for f in fields])))
    return header, rows, bad


def money(s):
    """Amazon writes plain decimals with a leading minus. Blank means absent."""
    s = (s or "").strip()
    if s == "":
        return None
    return round(float(s.replace(",", "")), 2)


def qty(s):
    s = (s or "").strip()
    if s == "":
        return 0
    try:
        return int(float(s.replace(",", "")))
    except ValueError:
        return 0


# ------------------------------------------------------- classification
#
# These are Amazon's own categories, taken from the amount-type / amount-
# description pair the report carries. They are written independently of the
# site's saBucketOf(); if the two disagree the audit wants to know.

TAX_WITHHELD = re.compile(r"^tcs\b|tds|194", re.I)
# Amazon concatenates without separators — "MFNPostagePurchaseCompleteIGST" —
# so a \b-anchored match misses the tax it plainly is. Match the suffix too.
GST_ON_FEES = re.compile(r"\b(cgst|sgst|igst)\b|(cgst|sgst|igst)$", re.I)
PRODUCT_TAX = re.compile(r"^product tax$|^shipping tax$", re.I)
# Movements of the seller's own balance between statements and between the
# two account series. They are neither a fee Amazon charged this period nor a
# credit Amazon granted: they net to zero across the pair of statements.
BALANCE_MOVEMENT = re.compile(
    r"^payable to amazon$|^debt adjustment|reserve|^balance adjustment$", re.I)


ADVERTISING = re.compile(r"advertis", re.I)
# A fee and its reversal are the same kind of line with opposite signs — the
# sign must never decide the classification, or a "Weight Handling Fee Reversal"
# of +Rs 75 lands in "credits" while its -Rs 75 charge sits in "fees".
KNOWN_FEE = re.compile(
    r"commission|closing fee|referral|easy ship|weight handling|pick.*pack|postage|"
    r"base fee|\bfba\b|storage|shipping (charge|fee|service)|subscription|removal|"
    r"disposal|return fee|technology fee|fixed fee|variable closing|promo|"
    r"labelling|prep service|inbound transport", re.I)
KNOWN_CREDIT = re.compile(r"reimburse|compensat|goodwill", re.I)


def classify(amount_type, desc, amount, txn_type=""):
    """Return one of: principal, product_tax, tax_withheld, gst_on_fees,
    balance_movement, fee, credit — using the amount-type column first
    (Amazon's own grouping), falling back to the description."""
    d = (desc or "").strip()
    t = (amount_type or "").strip()
    if re.fullmatch(r"principal", d, re.I):
        return "principal"
    if txn_type.strip().lower() == "debt adjustment" or BALANCE_MOVEMENT.search(d):
        return "balance_movement"
    # Amazon India bills Sponsored Products inside the settlement as
    # transaction-type ServiceFee / amount-type "Cost of Advertising", with a
    # useless amount-description ("TransactionTotalAmount"). The amount-TYPE is
    # the column that says what it is.
    if ADVERTISING.search(t) or ADVERTISING.search(d):
        return "advertising"
    if TAX_WITHHELD.search(d) or t in ("ItemTCS", "ItemTDS"):
        return "tax_withheld"
    if GST_ON_FEES.search(d):
        return "gst_on_fees"
    if PRODUCT_TAX.search(d):
        return "product_tax"
    # narrow, unambiguous words before broad ones
    if KNOWN_CREDIT.search(d) or KNOWN_CREDIT.search(t):
        return "credit"
    if KNOWN_FEE.search(d) or KNOWN_FEE.search(t):
        return "fee"
    return "unknown"


# ----------------------------------------------------------- computation


def compute(path):
    header, rows, bad = read_rows(path)
    with open(path, "rb") as fh:
        sha = hashlib.sha256(fh.read()).hexdigest()

    summary = None
    txn = []
    for r in rows:
        if r.get("transaction-type", "") == "" and r.get("order-id", "") == "" \
                and r.get("total-amount", "") != "":
            if summary is None:
                summary = r
            continue
        txn.append(r)

    deposit_total = money(summary["total-amount"]) if summary else None

    # --- the invariant Amazon itself guarantees -----------------------
    sum_all = round(sum(money(r.get("amount")) or 0.0 for r in txn), 2)

    # --- principal split by transaction type --------------------------
    gross = refunded = other_principal = 0.0
    product_tax = tax_withheld = gst_on_fees = fees = credits = 0.0
    balance_movement = 0.0
    advertising = 0.0
    unrecognised = 0.0

    units_ordered = 0
    order_ids = set()
    order_item_codes = set()
    refund_order_ids = set()
    per_sku = defaultdict(lambda: {"units": 0, "sales": 0.0, "refunds": 0.0,
                                   "fees": 0.0, "taxes": 0.0})
    label_totals = defaultdict(float)
    label_counts = defaultdict(int)

    for r in txn:
        tt = r.get("transaction-type", "")
        desc = r.get("amount-description", "")
        atype = r.get("amount-type", "")
        amt = money(r.get("amount"))
        if amt is None:
            continue
        sku = r.get("sku", "")
        kind = classify(atype, desc, amt, tt)
        label = desc or atype or "(unlabelled)"
        label_totals[label] += amt
        label_counts[label] += 1

        is_order = tt == "Order"
        is_refund = "refund" in tt.lower()

        if kind == "principal":
            if is_order:
                gross += amt
                units_ordered += qty(r.get("quantity-purchased"))
                if r.get("order-id"):
                    order_ids.add(r["order-id"])
                if r.get("order-item-code"):
                    order_item_codes.add(r["order-item-code"])
                if sku:
                    per_sku[sku]["units"] += qty(r.get("quantity-purchased"))
                    per_sku[sku]["sales"] += amt
            elif is_refund:
                refunded += amt
                if r.get("order-id"):
                    refund_order_ids.add(r["order-id"])
                if sku:
                    per_sku[sku]["refunds"] += amt
            else:
                other_principal += amt
        elif kind == "product_tax":
            product_tax += amt
            if sku:
                per_sku[sku]["taxes"] += amt
        elif kind == "tax_withheld":
            tax_withheld += amt
            if sku:
                per_sku[sku]["taxes"] += amt
        elif kind == "gst_on_fees":
            gst_on_fees += amt
            if sku:
                per_sku[sku]["taxes"] += amt
        elif kind == "balance_movement":
            balance_movement += amt
        elif kind == "advertising":
            advertising += amt
        elif kind == "unknown":
            unrecognised += amt
        elif kind == "fee":
            fees += amt
            if sku:
                per_sku[sku]["fees"] += amt
        else:
            credits += amt
            if sku:
                per_sku[sku]["fees"] += amt

    rnd = lambda x: round(x, 2)
    bucket_sum = rnd(gross + refunded + other_principal + product_tax
                     + tax_withheld + gst_on_fees + fees + credits
                     + balance_movement + advertising + unrecognised)

    return {
        "file": path,
        "sha256": sha,
        "settlement_id": summary.get("settlement-id") if summary else None,
        "period_start": summary.get("settlement-start-date") if summary else None,
        "period_end": summary.get("settlement-end-date") if summary else None,
        "deposit_date": summary.get("deposit-date") if summary else None,
        "currency": summary.get("currency") if summary else None,
        "raw_transaction_rows": len(txn),
        "malformed_rows": bad,
        "deposit_total": deposit_total,
        "sum_of_all_amount_cells": sum_all,
        "reconciles": deposit_total is not None
        and abs(sum_all - deposit_total) < 0.005,
        "gross_product_sales": rnd(gross),
        "refunded_sales": rnd(refunded),
        "net_product_sales": rnd(gross + refunded),
        "other_principal": rnd(other_principal),
        "product_and_shipping_tax": rnd(product_tax),
        "tax_withheld_tcs_tds": rnd(tax_withheld),
        "gst_on_amazon_fees": rnd(gst_on_fees),
        "amazon_fees_ex_gst": rnd(fees),
        "balance_movements_not_fees": rnd(balance_movement),
        "advertising_cost": rnd(advertising),
        "unrecognised": rnd(unrecognised),
        "true_fee_ratio_pct": rnd(abs(fees) / gross * 100) if gross else None,
        "credits": rnd(credits),
        "bucket_sum": bucket_sum,
        "buckets_reconcile": deposit_total is not None
        and abs(bucket_sum - deposit_total) < 0.005,
        # Two different, both-defensible counts. The website shows ONE number
        # labelled "Orders" — the audit checks which of these it equals.
        "distinct_order_ids": len(order_ids),
        "distinct_order_item_codes": len(order_item_codes),
        "units_ordered": units_ordered,
        "distinct_refund_order_ids": len(refund_order_ids),
        "avg_order_value_by_order_id": rnd(gross / len(order_ids))
        if order_ids else None,
        "avg_order_value_by_order_item": rnd(gross / len(order_item_codes))
        if order_item_codes else None,
        "refund_rate_by_value_pct": rnd(abs(refunded) / gross * 100)
        if gross else None,
        "per_sku": {k: {kk: rnd(vv) if isinstance(vv, float) else vv
                        for kk, vv in v.items()}
                    for k, v in sorted(per_sku.items())},
        "label_totals": {k: rnd(v) for k, v in sorted(label_totals.items())},
        "label_counts": dict(sorted(label_counts.items())),
    }


def main():
    args = [a for a in sys.argv[1:] if a != "--json"]
    as_json = "--json" in sys.argv
    out = [compute(p) for p in args]
    if as_json:
        print(json.dumps(out, indent=2))
        return
    for r in out:
        print("=" * 78)
        print(f"{r['file']}")
        print(f"  sha256                 {r['sha256']}")
        print(f"  settlement             {r['settlement_id']}  "
              f"{r['period_start']} -> {r['period_end']}")
        print(f"  transaction rows       {r['raw_transaction_rows']}"
              + (f"   MALFORMED: {r['malformed_rows']}" if r["malformed_rows"] else ""))
        print(f"  deposit total          {r['deposit_total']}")
        print(f"  sum of all amounts     {r['sum_of_all_amount_cells']}   "
              f"reconciles={r['reconciles']}")
        print(f"  bucket sum             {r['bucket_sum']}   "
              f"reconciles={r['buckets_reconcile']}")
        print(f"  gross product sales    {r['gross_product_sales']}")
        print(f"  refunded sales         {r['refunded_sales']}")
        print(f"  net product sales      {r['net_product_sales']}")
        print(f"  product/shipping tax   {r['product_and_shipping_tax']}")
        print(f"  TCS + TDS withheld     {r['tax_withheld_tcs_tds']}")
        print(f"  GST on Amazon fees     {r['gst_on_amazon_fees']}")
        print(f"  Amazon fees (ex GST)   {r['amazon_fees_ex_gst']}")
        print(f"  balance movements      {r['balance_movements_not_fees']}  (NOT a fee)")
        print(f"  advertising            {r['advertising_cost']}")
        print(f"  unrecognised           {r['unrecognised']}")
        print(f"  true fee ratio         {r['true_fee_ratio_pct']}%")
        print(f"  credits                {r['credits']}")
        print(f"  distinct order-ids     {r['distinct_order_ids']}")
        print(f"  distinct order-items   {r['distinct_order_item_codes']}")
        print(f"  units ordered          {r['units_ordered']}")
        print(f"  AOV by order-id        {r['avg_order_value_by_order_id']}")
        print(f"  AOV by order-item      {r['avg_order_value_by_order_item']}")
        print(f"  refund rate by value   {r['refund_rate_by_value_pct']}%")
        print(f"  SKUs                   {len(r['per_sku'])}")


if __name__ == "__main__":
    main()
