import type { CalculatorManifest } from "../types";
import MarketingBudgetScreen from "./MarketingBudgetScreen";

const manifest: CalculatorManifest = {
  id: "marketing-budget",
  name: "Amazon Marketing Budget Planner",
  description: "Plan monthly Amazon ad spend by category benchmarks and revenue targets.",
  icon: "chart",
  group: "advertising",
  Screen: MarketingBudgetScreen,
};

export default manifest;
