import type { CalculatorManifest } from "../types";
import FbaStorageScreen from "./FbaStorageScreen";

const manifest: CalculatorManifest = {
  id: "fba-storage",
  name: "Amazon FBA Storage Fee Calculator",
  description: "Model FBA storage exposure, months of cover, and aged inventory risk.",
  icon: "box",
  group: "fulfillment",
  Screen: FbaStorageScreen,
};

export default manifest;
