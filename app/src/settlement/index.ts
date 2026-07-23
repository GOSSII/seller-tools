// Public API for the settlement module (Phase 1a — parser only).
// Import from here, not from ./parser directly.
export { parseSettlement, parseAmount } from "./parser";
export type {
  AmountLine,
  SettlementSummary,
  TransactionRecord,
  ParseError,
  ParsedSettlement,
  ParseOptions,
} from "./types";
