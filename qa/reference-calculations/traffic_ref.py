#!/usr/bin/env python3
"""
Independent reference calculator — Amazon Business Reports,
"Detail Page Sales and Traffic By Child Item" (Amazon India).

Written from Amazon's own column definitions, not from the website's code.

Amazon's definitions used here:
  Sessions - Total ............ visits to the detail page in the period
  Units Ordered .............. units ordered from that page in the period
  Unit Session Percentage .... Amazon's own conversion = Units Ordered / Sessions
  Featured Offer Percentage .. share of page views where the seller held the
                               Featured Offer (Buy Box)
  Ordered Product Sales ...... ORDERED revenue (order date basis) — NOT
                               settlement revenue and NOT shipped revenue

Account conversion is deliberately computed two ways, because they are not the
same number and a product must not silently pick one and call it "your
conversion":
  A) unit-weighted   = SUM(units) / SUM(sessions)      <- the account's real rate
  B) simple mean     = mean(per-ASIN unit session pct) <- flatters small ASINs

Usage: python3 traffic_ref.py <BusinessReport.csv>
"""

import csv
import hashlib
import re
import sys


def num(v):
    """'₹5,988.00' -> 5988.0 ; '3.28%' -> 3.28 ; '' -> 0.0"""
    s = re.sub(r"[₹,%\s]", "", str(v or "")).replace(",", "")
    if s in ("", "-", "."):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def load(path):
    with open(path, "rb") as fh:
        raw = fh.read()
    sha = hashlib.sha256(raw).hexdigest()
    text = raw.decode("utf-8-sig")           # the export carries a BOM
    rows = list(csv.DictReader(text.splitlines()))
    # normalise header names once
    out = []
    for r in rows:
        out.append({(k or "").strip().lower(): v for k, v in r.items()})
    return sha, out


def compute(path):
    sha, rows = load(path)
    asins = []
    for r in rows:
        a = (r.get("(child) asin") or "").strip()
        if not a:
            continue
        asins.append({
            "asin": a,
            "parent": (r.get("(parent) asin") or "").strip(),
            "title": (r.get("title") or "").strip(),
            "sessions": num(r.get("sessions - total")),
            "page_views": num(r.get("page views - total")),
            "buy_box": num(r.get("featured offer percentage")),
            "units": num(r.get("units ordered")),
            "cvr_reported": num(r.get("unit session percentage")),
            "sales": num(r.get("ordered product sales")),
            "order_items": num(r.get("total order items")),
        })

    dupes = len(asins) - len({a["asin"] for a in asins})
    tot_sessions = sum(a["sessions"] for a in asins)
    tot_units = sum(a["units"] for a in asins)
    tot_sales = sum(a["sales"] for a in asins)

    cvr_unit_weighted = tot_units / tot_sessions * 100 if tot_sessions else 0.0
    per_asin = [a["cvr_reported"] for a in asins]
    cvr_simple_mean = sum(per_asin) / len(per_asin) if per_asin else 0.0

    # Amazon's own per-ASIN conversion vs recomputing it from the two columns —
    # if these disagree the report itself is rounded, and any tool that
    # recomputes will differ from Seller Central.
    recompute_gap = []
    for a in asins:
        if a["sessions"]:
            mine = a["units"] / a["sessions"] * 100
            if abs(mine - a["cvr_reported"]) > 0.05:
                recompute_gap.append((a["asin"], round(mine, 2), a["cvr_reported"]))

    return {
        "file": path,
        "sha256": sha,
        "asin_rows": len(asins),
        "duplicate_asin_rows": dupes,
        "total_sessions": tot_sessions,
        "total_units": tot_units,
        "total_ordered_product_sales": round(tot_sales, 2),
        "account_cvr_unit_weighted_pct": round(cvr_unit_weighted, 4),
        "account_cvr_simple_mean_pct": round(cvr_simple_mean, 4),
        "asins_with_zero_sessions": sum(1 for a in asins if a["sessions"] == 0),
        "asins_with_zero_units": sum(1 for a in asins if a["units"] == 0),
        "asins_missing_buy_box_col": sum(1 for a in asins if a["buy_box"] == 0),
        "per_asin_cvr_recompute_disagreements": recompute_gap,
        "asins": sorted(asins, key=lambda x: -x["sessions"]),
    }


def main():
    for p in sys.argv[1:]:
        r = compute(p)
        print("=" * 78)
        print(r["file"])
        print(f"  sha256                     {r['sha256']}")
        print(f"  ASIN rows                  {r['asin_rows']}"
              f"   (duplicates: {r['duplicate_asin_rows']})")
        print(f"  total sessions             {int(r['total_sessions'])}")
        print(f"  total units ordered        {int(r['total_units'])}")
        print(f"  ordered product sales      {r['total_ordered_product_sales']}")
        print(f"  account CVR (unit-weighted) {r['account_cvr_unit_weighted_pct']}%")
        print(f"  account CVR (simple mean)   {r['account_cvr_simple_mean_pct']}%")
        print(f"  ASINs with 0 sessions      {r['asins_with_zero_sessions']}")
        print(f"  ASINs with 0 units         {r['asins_with_zero_units']}")
        if r["per_asin_cvr_recompute_disagreements"]:
            print("  per-ASIN CVR recompute disagreements (asin, recomputed, reported):")
            for d in r["per_asin_cvr_recompute_disagreements"]:
                print(f"      {d}")
        print()
        print("  ASIN         SESS  PV   BB%    UNITS  CVR%   SALES")
        for a in r["asins"]:
            print(f"  {a['asin']:<12} {int(a['sessions']):>5} {int(a['page_views']):>5}"
                  f" {a['buy_box']:>6} {int(a['units']):>6} {a['cvr_reported']:>6}"
                  f" {a['sales']:>10.2f}")


if __name__ == "__main__":
    main()
