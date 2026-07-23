// Tests for the settlement flat-file V2 parser (Phase 1a).
//
// Uses Node's built-in test runner — no new project dependency.
// Run from the app/ directory with:
//     npx tsx --test src/settlement/parser.test.ts
//
// (tsx runs TypeScript directly; it is not added to the project's
// dependencies, so nothing about the live app build changes.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSettlement, parseAmount } from "./index";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(join(HERE, "__fixtures__", name), "utf8");

test("normal order: groups principal + fees into one record", () => {
  const r = parseSettlement(fixture("normal-order.tsv"));
  assert.equal(r.errors.length, 0, "no parse errors");
  assert.ok(r.summary, "summary captured");
  assert.equal(r.summary!.settlementId, "12345678901");
  assert.equal(r.summary!.totalAmount, 830.34);
  assert.equal(r.summary!.currency, "INR");

  assert.equal(r.records.length, 1, "one logical record");
  const o = r.records[0];
  assert.equal(o.transactionType, "Order");
  assert.equal(o.orderId, "403-1111111-1111111");
  assert.equal(o.sku, "TEE-BLK-M");
  assert.equal(o.quantity, 1);
  assert.equal(o.principal, 999);
  assert.equal(o.fulfillmentId, "MFN");
  // Two non-principal money lines, itemised.
  assert.equal(o.fees.length, 2);
  assert.equal(o.feeMap["Commission"], -89.91);
  assert.equal(o.feeMap["TotalTaxWithheld"], -16.18);
});

test("multi-fee order: every fee line is preserved and summed", () => {
  const r = parseSettlement(fixture("multi-fee-order.tsv"));
  assert.equal(r.errors.length, 0);
  assert.equal(r.records.length, 1);
  const o = r.records[0];
  assert.equal(o.principal, 1499);
  assert.equal(o.fulfillmentId, "AFN");
  assert.equal(o.fees.length, 4);
  assert.equal(o.feeMap["Commission"], -209.86);
  assert.equal(o.feeMap["FBAPerUnitFulfillmentFee"], -70);
  assert.equal(o.feeMap["FixedClosingFee"], -56);
  assert.equal(o.feeMap["TotalTaxWithheld"], -60.45);
});

test("refund: kept separate from orders, negative principal", () => {
  const r = parseSettlement(fixture("refund.tsv"));
  assert.equal(r.errors.length, 0);
  assert.equal(r.records.length, 1);
  const o = r.records[0];
  assert.equal(o.transactionType, "Refund");
  assert.equal(o.principal, -999);
  // Two fee lines with the same order but they net out per description.
  assert.equal(o.feeMap["Commission"], 89.91);
  assert.equal(o.feeMap["RefundCommission"], -13.49);
});

test("malformed row: reported with line number, not silently dropped", () => {
  const r = parseSettlement(fixture("malformed-row.tsv"));
  // Two bad rows: a short row and an unparseable amount.
  assert.equal(r.errors.length, 2, "both bad rows reported");

  const shortErr = r.errors.find((e) => /Expected .* columns/.test(e.reason));
  assert.ok(shortErr, "short row reported as column-count error");
  assert.ok(shortErr!.line > 0, "has a 1-based line number");
  assert.match(shortErr!.raw, /oops-too-few-columns/);

  const amtErr = r.errors.find((e) => /Unparseable amount/.test(e.reason));
  assert.ok(amtErr, "bad amount reported");
  assert.match(amtErr!.reason, /N\/A/);

  // The one good order still parsed.
  const good = r.records.find((x) => x.orderId === "403-4444444-4444444");
  assert.ok(good, "good order survived alongside the errors");
  assert.equal(good!.principal, 599);
});

test("header-driven: reordered columns and an unknown extra column", () => {
  // Minimal reordered header with an unrecognised trailing column.
  const csv =
    "transaction-type\torder-id\tsettlement-id\tamount-type\tamount-description\tamount\tsku\tquantity-purchased\tmystery-col\n" +
    "Order\t111\tS1\tItemPrice\tPrincipal\t500.00\tSKU1\t2\thello\n" +
    "Order\t111\tS1\tItemFees\tCommission\t-45.00\tSKU1\t2\tworld\n";
  const r = parseSettlement(csv);
  assert.equal(r.errors.length, 0);
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].principal, 500);
  assert.equal(r.records[0].quantity, 2);
  assert.equal(r.records[0].feeMap["Commission"], -45);
  assert.deepEqual(r.unmappedColumns, ["mystery-col"]);
});

test("missing required column is reported, rows not silently mis-parsed", () => {
  // No amount column at all.
  const csv =
    "settlement-id\ttransaction-type\torder-id\tamount-type\tamount-description\n" +
    "S1\tOrder\t111\tItemPrice\tPrincipal\n";
  const r = parseSettlement(csv);
  assert.ok(r.missingColumns.includes("amount"), "amount flagged missing");
  assert.ok(r.errors.length >= 1, "data row reported rather than dropped");
});

test("parseAmount handles signs, thousands, blanks, and junk", () => {
  assert.equal(parseAmount("999.00"), 999);
  assert.equal(parseAmount("-89.91"), -89.91);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("₹1,499.00"), 1499);
  assert.equal(parseAmount(""), 0);
  assert.ok(Number.isNaN(parseAmount("N/A")));
  assert.equal(parseAmount("1.234,56", "comma"), 1234.56);
});
