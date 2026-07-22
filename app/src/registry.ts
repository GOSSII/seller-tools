import type { CalculatorManifest } from "./calculators/types";
import profit from "./calculators/profit/manifest";
import fbaFee from "./calculators/fba-fee/manifest";
import fbaStorage from "./calculators/fba-storage/manifest";
import acos from "./calculators/acos/manifest";
import breakEvenAcos from "./calculators/break-even-acos/manifest";
import advertisingRoi from "./calculators/advertising-roi/manifest";
import marketingBudget from "./calculators/marketing-budget/manifest";
import launchBudget from "./calculators/launch-budget/manifest";
import couponRoi from "./calculators/coupon-roi/manifest";

// ============================================================
// ADD A NEW CALCULATOR = add its manifest to this array.
// The home grid and navigation build themselves from here.
// ============================================================
export const CALCULATORS: CalculatorManifest[] = [
  profit,
  fbaFee,
  fbaStorage,
  acos,
  breakEvenAcos,
  advertisingRoi,
  marketingBudget,
  launchBudget,
  couponRoi,
];

export const CALCULATOR_MAP: Record<string, CalculatorManifest> = Object.fromEntries(
  CALCULATORS.map((c) => [c.id, c])
);
