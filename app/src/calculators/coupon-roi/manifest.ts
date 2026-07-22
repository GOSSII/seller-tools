import type { CalculatorManifest } from "../types";
import CouponRoiScreen from "./CouponRoiScreen";

const manifest: CalculatorManifest = {
  id: "coupon-roi",
  name: "Amazon Coupon ROI Calculator",
  description: "Estimate coupon-funded discount cost, incremental orders, and net contribution.",
  icon: "target",
  group: "advertising",
  Screen: CouponRoiScreen,
};

export default manifest;
