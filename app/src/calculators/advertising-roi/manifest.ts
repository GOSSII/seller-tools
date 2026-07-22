import type { CalculatorManifest } from "../types";
import AdvertisingRoiScreen from "./AdvertisingRoiScreen";

const manifest: CalculatorManifest = {
  id: "advertising-roi",
  name: "Amazon Advertising ROI Calculator",
  description: "Project clicks, orders, sales, and ROAS from PPC budget, CPC, and CVR inputs.",
  icon: "calculator",
  badge: "Updated",
  group: "advertising",
  Screen: AdvertisingRoiScreen,
};

export default manifest;
