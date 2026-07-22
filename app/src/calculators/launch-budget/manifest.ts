import type { CalculatorManifest } from "../types";
import LaunchBudgetScreen from "./LaunchBudgetScreen";

const manifest: CalculatorManifest = {
  id: "launch-budget",
  name: "Amazon Product Launch Budget Calculator",
  description: "Plan PPC, coupons, creative, and launch investment for Amazon SKU launches.",
  icon: "trend",
  group: "advertising",
  Screen: LaunchBudgetScreen,
};

export default manifest;
