// =============================================================
// Settlement report — parsed data shapes (Phase 1a)
//
// ⚠️  ISOLATED MODULE. Nothing here imports from the calculators,
//     and no calculator imports from here. This is a standalone
//     library so it can be built and tested without touching the
//     live profit calculator that customers use.
//
//     Phase 1a is the PARSER ONLY. It normalises Amazon India's
//     Settlement flat-file V2 into typed records. It does NOT
//     interpret which fee is which, or reconcile against expected
//     fees — that is Phase 1b.
// =============================================================

// A single money line from the report: the amount-type /
// amount-description / amount triple that V2 uses for every charge.
export type AmountLine = {
  amountType: string;        // e.g. "ItemPrice", "ItemFees", "ItemWithheldTax"
  amountDescription: string; // e.g. "Principal", "Commission", "FixedClosingFee"
  amount: number;            // signed rupees (credits +, charges -)
};

// The settlement-level summary row (first data row of the file).
export type SettlementSummary = {
  settlementId: string;
  settlementStartDate: string;
  settlementEndDate: string;
  depositDate: string;
  totalAmount: number;
  currency: string;
};

// One logical transaction (an order line, a refund, an adjustment,
// a fee) with all its money lines grouped together.
export type TransactionRecord = {
  settlementId: string;
  transactionType: string;   // Order, Refund, Adjustment, FBA Inventory Fee, Service Fee, …
  orderId: string;
  sku: string;
  quantity: number;
  marketplaceName: string;
  fulfillmentId: string;     // AFN (FBA) / MFN (self / Easy Ship)
  postedDate: string;
  orderItemCode: string;
  shipmentId: string;
  adjustmentId: string;
  promotionId: string;

  // Money, itemised. `principal` is pulled out for convenience;
  // `amounts` keeps every line (incl. principal) for full fidelity;
  // `fees` is every non-principal line as a name→amount map plus
  // the raw list, so reconciliation can look fees up by description.
  principal: number;
  amounts: AmountLine[];
  fees: AmountLine[];
  feeMap: Record<string, number>; // amountDescription → summed amount (non-principal)
};

// A row we could not turn into data. Reported, never silently dropped.
export type ParseError = {
  line: number;   // 1-based line number in the source file
  reason: string;
  raw: string;    // the offending line, verbatim
};

export type ParsedSettlement = {
  summary: SettlementSummary | null;
  records: TransactionRecord[];
  errors: ParseError[];
  header: string[];           // the column names actually seen in the file
  unmappedColumns: string[];  // header columns we did not recognise (informational)
  missingColumns: string[];   // expected columns not present (informational)
};

export type ParseOptions = {
  // Delimiter override. Default: auto-detect (tab if the header has
  // tabs, else comma). Amazon's V2 flat file is tab-delimited.
  delimiter?: "\t" | ",";
  // Decimal convention. "dot" = 1,234.56 (India / US, the default).
  // "comma" = 1.234,56 (some EU locales). India files are "dot".
  decimal?: "dot" | "comma";
};
