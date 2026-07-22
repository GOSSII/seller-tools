import type { CalculatorManifest } from "../types";
import AcosScreen from "./AcosScreen";

const manifest: CalculatorManifest = {
  id: "acos",
  name: "Amazon ACOS Calculator",
  description: "Calculate ACOS, TACoS, and ad efficiency benchmarks for Amazon PPC.",
  icon: "target",
  group: "advertising",
  Screen: AcosScreen,
};

export default manifest;
