export type BreakEvenInput = {
  sellingPrice: number;
  productCost: number;
  amazonFees: number;   // per-unit fees (referral+closing+ship+gst etc)
  conversionRate: number; // %
  targetProfitPct: number; // % of price you want to keep after ads
};

export type BreakEvenResult = {
  profitBeforeAds: number;
  breakEvenAcos: number;   // % — ad spend that wipes profit
  breakEvenCpc: number;    // ₹ — CPC at break-even
  targetAcos: number;      // % — leaves target profit
  targetCpc: number;       // ₹ — CPC at target
  maxSpendPerOrder: number;
};

export function calculateBreakEven(i: BreakEvenInput): BreakEvenResult {
  const price = Math.max(0, i.sellingPrice || 0);
  const profitBeforeAds = price - (i.productCost || 0) - (i.amazonFees || 0);
  const cvr = (i.conversionRate || 0) / 100;

  const breakEvenAcos = price > 0 ? (profitBeforeAds / price) * 100 : 0;
  const breakEvenCpc = profitBeforeAds * cvr; // spend per click that breaks even

  const targetProfit = price * ((i.targetProfitPct || 0) / 100);
  const maxSpendPerOrder = Math.max(0, profitBeforeAds - targetProfit);
  const targetAcos = price > 0 ? (maxSpendPerOrder / price) * 100 : 0;
  const targetCpc = maxSpendPerOrder * cvr;

  return {
    profitBeforeAds,
    breakEvenAcos,
    breakEvenCpc,
    targetAcos,
    targetCpc,
    maxSpendPerOrder,
  };
}
