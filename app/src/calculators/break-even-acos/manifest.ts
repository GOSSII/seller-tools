import type { CalculatorManifest } from "../types";
import BreakEvenAcosScreen from "./BreakEvenAcosScreen";

const manifest: CalculatorManifest = {
  id: "break-even-acos",
  name: "Amazon Break-Even ACOS Calculator",
  description: "Find break-even ACOS, target ACOS, and max CPC from margin and conversion.",
  icon: "target",
  group: "advertising",
  Screen: BreakEvenAcosScreen,
};

export default manifest;
