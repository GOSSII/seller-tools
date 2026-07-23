// =============================================================
// Settlement flat-file V2 parser (Phase 1a) — pure functions.
//
// Reads Amazon India's Settlement report (Seller Central >
// Payments > Reports Repository > Settlement, flat file V2) into
// typed transaction records. Header-driven: columns are mapped by
// name from the file's own header, so column order and unknown
// extra columns don't break parsing.
//
// Runs fully local. No network calls, no I/O — text in, data out.
// =============================================================

import type {
  AmountLine,
  ParsedSettlement,
  ParseError,
  ParseOptions,
  SettlementSummary,
  TransactionRecord,
} from "./types";

// Canonical column keys we care about → the header names (and known
// aliases) that map to them. Names are matched case-insensitively
// after trimming and collapsing spaces/underscores to hyphens.
const COLUMN_ALIASES: Record<string, string[]> = {
  settlementId: ["settlement-id"],
  settlementStartDate: ["settlement-start-date"],
  settlementEndDate: ["settlement-end-date"],
  depositDate: ["deposit-date"],
  totalAmount: ["total-amount"],
  currency: ["currency"],
  transactionType: ["transaction-type"],
  orderId: ["order-id"],
  merchantOrderId: ["merchant-order-id"],
  adjustmentId: ["adjustment-id"],
  shipmentId: ["shipment-id"],
  marketplaceName: ["marketplace-name"],
  amountType: ["amount-type"],
  amountDescription: ["amount-description"],
  amount: ["amount"],
  fulfillmentId: ["fulfillment-id"],
  postedDate: ["posted-date"],
  postedDateTime: ["posted-date-time"],
  orderItemCode: ["order-item-code"],
  merchantOrderItemId: ["merchant-order-item-id"],
  merchantAdjustmentItemId: ["merchant-adjustment-item-id"],
  sku: ["sku"],
  quantityPurchased: ["quantity-purchased"],
  promotionId: ["promotion-id"],
};

// Columns without which we cannot produce meaningful records.
const REQUIRED_KEYS = [
  "settlementId",
  "transactionType",
  "amountType",
  "amountDescription",
  "amount",
];

const normaliseHeader = (name: string): string =>
  name.trim().toLowerCase().replace(/[\s_]+/g, "-");

// Build canonicalKey → columnIndex from the header row.
function mapColumns(header: string[]): {
  index: Record<string, number>;
  unmapped: string[];
} {
  const aliasToKey = new Map<string, string>();
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const a of aliases) aliasToKey.set(a, key);
  }

  const index: Record<string, number> = {};
  const unmapped: string[] = [];
  header.forEach((raw, i) => {
    const key = aliasToKey.get(normaliseHeader(raw));
    if (key && !(key in index)) index[key] = i;
    else if (!key) unmapped.push(raw);
  });
  return { index, unmapped };
}

// Split one delimited line into fields, honouring "quoted" values
// (RFC4180-style) so a comma/tab inside quotes doesn't split.
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      out.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

// Parse a money string to a number. Returns NaN if it isn't numeric,
// so the caller can report a malformed amount rather than coerce to 0.
export function parseAmount(raw: string, decimal: "dot" | "comma" = "dot"): number {
  const s = (raw ?? "").trim();
  if (s === "") return 0; // blank money cell = no amount on this line
  // Strip currency symbols/codes and spaces, keep digits, separators, sign.
  let cleaned = s.replace(/[^\d.,-]/g, "");
  if (decimal === "comma") {
    // 1.234,56 → 1234.56
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // 1,234.56 → 1234.56 (commas are thousands separators)
    cleaned = cleaned.replace(/,/g, "");
  }
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

const cell = (fields: string[], index: Record<string, number>, key: string): string => {
  const i = index[key];
  return i === undefined ? "" : (fields[i] ?? "").trim();
};

// Grouping key: everything that identifies one logical line item.
// Order-independent (built into a Map), so a refund and an order on
// the same order-id never merge (transaction-type differs), and two
// shipments of one order stay separate (shipment-id differs).
function groupKey(fields: string[], index: Record<string, number>): string {
  return [
    cell(fields, index, "settlementId"),
    cell(fields, index, "transactionType"),
    cell(fields, index, "orderId"),
    cell(fields, index, "orderItemCode") || cell(fields, index, "sku"),
    cell(fields, index, "shipmentId"),
    cell(fields, index, "adjustmentId"),
  ].join("");
}

export function parseSettlement(text: string, opts: ParseOptions = {}): ParsedSettlement {
  const errors: ParseError[] = [];
  const rawLines = text.split(/\r\n|\r|\n/);

  // Locate the header: first non-empty line.
  let headerLineNo = -1;
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim() !== "") { headerLineNo = i; break; }
  }
  if (headerLineNo === -1) {
    return {
      summary: null, records: [], errors: [], header: [],
      unmappedColumns: [], missingColumns: Object.keys(COLUMN_ALIASES),
    };
  }

  const headerLine = rawLines[headerLineNo];
  const delim: string =
    opts.delimiter ?? (headerLine.includes("\t") ? "\t" : ",");
  const decimal = opts.decimal ?? "dot";

  const header = splitLine(headerLine, delim).map((h) => h.trim());
  const { index, unmapped } = mapColumns(header);
  const missingColumns = REQUIRED_KEYS.filter((k) => !(k in index)).map(
    (k) => COLUMN_ALIASES[k][0]
  );

  let summary: SettlementSummary | null = null;
  // Preserve first-seen order of groups while merging their amount lines.
  const order: string[] = [];
  const groups = new Map<string, TransactionRecord>();
  const groupAmounts = new Map<string, AmountLine[]>();

  const missingRequired = missingColumns.length > 0;

  for (let i = headerLineNo + 1; i < rawLines.length; i++) {
    const lineNo = i + 1; // 1-based
    const raw = rawLines[i];
    if (raw.trim() === "") continue; // skip blank lines silently

    const fields = splitLine(raw, delim);
    if (fields.length !== header.length) {
      errors.push({
        line: lineNo,
        reason: `Expected ${header.length} columns, got ${fields.length}`,
        raw,
      });
      continue;
    }

    const transactionType = cell(fields, index, "transactionType");
    const orderId = cell(fields, index, "orderId");
    const totalRaw = cell(fields, index, "totalAmount");

    // Settlement summary row: no transaction-type, no order, but a
    // total-amount. Capture the first one; don't emit as a record.
    if (transactionType === "" && orderId === "" && totalRaw !== "") {
      if (!summary) {
        const total = parseAmount(totalRaw, decimal);
        if (Number.isNaN(total)) {
          errors.push({ line: lineNo, reason: `Unparseable total-amount "${totalRaw}"`, raw });
          continue;
        }
        summary = {
          settlementId: cell(fields, index, "settlementId"),
          settlementStartDate: cell(fields, index, "settlementStartDate"),
          settlementEndDate: cell(fields, index, "settlementEndDate"),
          depositDate: cell(fields, index, "depositDate"),
          totalAmount: total,
          currency: cell(fields, index, "currency"),
        };
      }
      continue;
    }

    if (missingRequired) {
      errors.push({
        line: lineNo,
        reason: `Cannot parse row: missing required column(s) ${missingColumns.join(", ")}`,
        raw,
      });
      continue;
    }

    // A data row with no transaction-type and no total isn't something
    // we understand — report it rather than guess.
    if (transactionType === "") {
      errors.push({ line: lineNo, reason: "Row has no transaction-type", raw });
      continue;
    }

    const amountRaw = cell(fields, index, "amount");
    const amount = parseAmount(amountRaw, decimal);
    if (Number.isNaN(amount)) {
      errors.push({ line: lineNo, reason: `Unparseable amount "${amountRaw}"`, raw });
      continue;
    }

    const key = groupKey(fields, index);
    let rec = groups.get(key);
    if (!rec) {
      const qtyRaw = cell(fields, index, "quantityPurchased");
      const qty = qtyRaw === "" ? 0 : Number(qtyRaw.replace(/,/g, ""));
      rec = {
        settlementId: cell(fields, index, "settlementId"),
        transactionType,
        orderId,
        sku: cell(fields, index, "sku"),
        quantity: Number.isFinite(qty) ? qty : 0,
        marketplaceName: cell(fields, index, "marketplaceName"),
        fulfillmentId: cell(fields, index, "fulfillmentId"),
        postedDate:
          cell(fields, index, "postedDate") || cell(fields, index, "postedDateTime"),
        orderItemCode: cell(fields, index, "orderItemCode"),
        shipmentId: cell(fields, index, "shipmentId"),
        adjustmentId: cell(fields, index, "adjustmentId"),
        promotionId: cell(fields, index, "promotionId"),
        principal: 0,
        amounts: [],
        fees: [],
        feeMap: {},
      };
      groups.set(key, rec);
      groupAmounts.set(key, []);
      order.push(key);
    }

    const amountDescription = cell(fields, index, "amountDescription");
    // Some line-item metadata (qty, sku) only appears on the principal
    // row; fill it in if the group started from a fee-only row.
    if (rec.sku === "") rec.sku = cell(fields, index, "sku");
    if (rec.quantity === 0) {
      const qtyRaw = cell(fields, index, "quantityPurchased");
      const qty = qtyRaw === "" ? 0 : Number(qtyRaw.replace(/,/g, ""));
      if (Number.isFinite(qty)) rec.quantity = qty;
    }

    groupAmounts.get(key)!.push({
      amountType: cell(fields, index, "amountType"),
      amountDescription,
      amount,
    });
  }

  // Finalise: split principal from fees, build the fee map.
  const records: TransactionRecord[] = order.map((key) => {
    const rec = groups.get(key)!;
    const lines = groupAmounts.get(key)!;
    rec.amounts = lines;
    for (const l of lines) {
      const isPrincipal = /^principal$/i.test(l.amountDescription);
      if (isPrincipal) {
        rec.principal += l.amount;
      } else {
        rec.fees.push(l);
        const d = l.amountDescription || l.amountType || "(unlabelled)";
        rec.feeMap[d] = (rec.feeMap[d] ?? 0) + l.amount;
      }
    }
    return rec;
  });

  return {
    summary,
    records,
    errors,
    header,
    unmappedColumns: unmapped,
    missingColumns,
  };
}
