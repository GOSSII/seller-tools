// Dev tool — inspect a real settlement report by eye.
//
// Point it at a settlement file you exported from Seller Central and
// it prints what the parser understood: the summary, each record with
// its itemised fees, and any malformed rows. Nothing leaves your
// machine — it just reads the file and prints.
//
// Usage, from the app/ directory:
//     npx tsx src/settlement/inspect.ts /path/to/settlement.txt
//
// (This is a standalone script, not part of the app build.)

import { readFileSync } from "node:fs";
import { parseSettlement } from "./index";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx src/settlement/inspect.ts <path-to-settlement-file>");
  process.exit(1);
}

const inr = (n: number) =>
  (n < 0 ? "-" : "") + "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const text = readFileSync(path, "utf8");
const r = parseSettlement(text);

console.log("=".repeat(60));
console.log("SETTLEMENT REPORT —", path);
console.log("=".repeat(60));

if (r.summary) {
  console.log("\nSummary:");
  console.log("  settlement id :", r.summary.settlementId);
  console.log("  period        :", r.summary.settlementStartDate, "→", r.summary.settlementEndDate);
  console.log("  deposit date  :", r.summary.depositDate);
  console.log("  total amount  :", inr(r.summary.totalAmount), r.summary.currency);
} else {
  console.log("\n(No settlement summary row found.)");
}

console.log("\nColumns seen (" + r.header.length + "):", r.header.join(", "));
if (r.unmappedColumns.length)
  console.log("Unrecognised columns (kept, just not normalised):", r.unmappedColumns.join(", "));
if (r.missingColumns.length)
  console.log("⚠️  Missing expected columns:", r.missingColumns.join(", "));

// How many of each transaction type?
const byType: Record<string, number> = {};
for (const rec of r.records) byType[rec.transactionType] = (byType[rec.transactionType] ?? 0) + 1;
console.log("\nRecords:", r.records.length, "—", Object.entries(byType).map(([t, n]) => `${t}: ${n}`).join(", ") || "(none)");

// Every distinct fee label the file uses — this is the list Phase 1b
// reconciliation will match on, so it's the useful thing to eyeball.
const feeLabels = new Set<string>();
for (const rec of r.records) for (const f of rec.fees) feeLabels.add(f.amountDescription || f.amountType);
console.log("\nDistinct fee labels (amount-description) in this file:");
for (const label of [...feeLabels].sort()) console.log("  •", label);

// Show the first few records in full.
const SHOW = 5;
console.log(`\nFirst ${Math.min(SHOW, r.records.length)} record(s):`);
for (const rec of r.records.slice(0, SHOW)) {
  console.log(`\n  [${rec.transactionType}] order ${rec.orderId || "—"}  sku ${rec.sku || "—"}  qty ${rec.quantity}  (${rec.fulfillmentId || "?"})`);
  console.log("    principal:", inr(rec.principal));
  for (const [desc, amt] of Object.entries(rec.feeMap)) console.log("    fee:", desc, "=", inr(amt));
}

if (r.errors.length) {
  console.log(`\n⚠️  ${r.errors.length} malformed row(s) (reported, not dropped):`);
  for (const e of r.errors.slice(0, 20)) console.log(`  line ${e.line}: ${e.reason}`);
  if (r.errors.length > 20) console.log(`  … and ${r.errors.length - 20} more`);
} else {
  console.log("\nNo malformed rows. ✅");
}
console.log("");
