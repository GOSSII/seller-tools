import type { CalculatorManifest } from "../types";
import ProfitScreen from "./ProfitScreen";

const manifest: CalculatorManifest = {
  id: "profit",
  name: "Amazon Profit Calculator",
  description: "Calculate Amazon India fees, referral, closing, FBA charges, and final profit per SKU.",
  icon: "calculator",
  badge: "Popular",
  group: "profitability",
  Screen: ProfitScreen,
};

export default manifest;
