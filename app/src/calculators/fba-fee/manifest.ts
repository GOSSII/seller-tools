import type { CalculatorManifest } from "../types";
import FbaFeeScreen from "./FbaFeeScreen";

const manifest: CalculatorManifest = {
  id: "fba-fee",
  name: "Amazon FBA Fee Calculator",
  description: "Estimate FBA fees, fulfilment costs, and net settlement before scaling SKUs.",
  icon: "box",
  group: "fulfillment",
  Screen: FbaFeeScreen,
};

export default manifest;
