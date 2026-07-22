export type CouponInput = {
  price: number;
  discountPct: number;
  redemptionFee: number;   // ₹ per redeemed coupon (Amazon charges this)
  baselineOrders: number;  // orders/period without coupon
  upliftPct: number;       // % more orders the coupon drives
  unitCost: number;
  unitFees: number;        // Amazon fees per unit
};
export type CouponResult = {
  discountedPrice: number;
  totalOrders: number;
  incrementalOrders: number;
  discountCost: number;
  couponFees: number;
  marginPerUnit: number;
  contribution: number;        // with coupon
  baselineContribution: number;
  netVsBaseline: number;       // coupon worth it if > 0
  worthIt: boolean;
};

export function calculateCoupon(i: CouponInput): CouponResult {
  const price = Math.max(0, i.price || 0);
  const discountedPrice = price * (1 - (i.discountPct || 0) / 100);
  const baseline = i.baselineOrders || 0;
  const totalOrders = baseline * (1 + (i.upliftPct || 0) / 100);
  const incrementalOrders = totalOrders - baseline;

  const discountCost = totalOrders * (price - discountedPrice);
  const couponFees = totalOrders * (i.redemptionFee || 0);
  const marginPerUnit = discountedPrice - (i.unitCost || 0) - (i.unitFees || 0);

  const contribution = totalOrders * marginPerUnit - couponFees;
  const baselineContribution = baseline * (price - (i.unitCost || 0) - (i.unitFees || 0));
  const netVsBaseline = contribution - baselineContribution;

  return {
    discountedPrice, totalOrders, incrementalOrders,
    discountCost, couponFees, marginPerUnit,
    contribution, baselineContribution, netVsBaseline,
    worthIt: netVsBaseline > 0,
  };
}
