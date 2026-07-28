import {
  CATEGORY_MAP,
  CLOSING,
  SHIPPING_SLABS,
  FBA_STORAGE,
  fbaPickPack,
  GST_RATE,
  type SizeTier,
  type Fulfillment,
  type Zone,
} from "../../data/amazonFees";

export type ProfitInput = {
  sellingPrice: number;
  productCost: number;
  category: string;
  weightKg: number;
  size: SizeTier;
  fulfillment: Fulfillment;
  zone: Zone;
  packaging: number;
  acosPct: number;
  returnsPct: number;
  // GST-registered sellers reclaim the 18% GST on Amazon fees as input tax
  // credit. Optional so existing callers are untouched; undefined = registered.
  gstRegistered?: boolean;
};

export type ProfitResult = {
  referral: number;
  closing: number;
  shipping: number;
  fbaPickPack: number;
  fbaStorage: number;
  gstOnFees: number;
  amazonFees: number;        // total incl GST (the settlement deduction)
  amazonFeesPct: number;     // % of selling price
  settlement: number;
  marketing: number;
  returns: number;
  landed: number;            // productCost + packaging
  netProfit: number;
  margin: number;            // %
  roi: number;               // %
  referralRate: number;      // fraction actually applied
  isLoss: boolean;
  lowMargin: boolean;        // < 15%
  itcRecoverable: number;    // GST on Amazon fees claimable as ITC (0 if not registered)
  netProfitAfterItc: number; // netProfit + itcRecoverable
};

function referralRate(categoryKey: string, price: number): number {
  const c = CATEGORY_MAP[categoryKey] ?? CATEGORY_MAP["other"];
  const [a, b, cc, d] = c.referral;
  if (price <= 300) return a;
  if (price <= 500) return b;
  if (price <= 1000) return cc;
  return d;
}

function closingFee(price: number, fulfillment: Fulfillment): number {
  let fee: number;
  if (price <= 250) fee = CLOSING.low;
  else if (price <= 500) fee = CLOSING.mid;
  else if (price <= 1000) fee = CLOSING.high;
  else fee = CLOSING.vhigh;
  // Easy Ship gets a ₹5 relief at the lowest band.
  if (price <= 250 && fulfillment === "easyship") fee = Math.max(0, fee - 5);
  return fee;
}

function shippingFee(
  price: number,
  fulfillment: Fulfillment,
  zone: Zone,
  weightKg: number
): number {
  if (fulfillment === "self") return 0;
  const slab =
    SHIPPING_SLABS.find((s) => weightKg <= s.maxKg) ??
    SHIPPING_SLABS[SHIPPING_SLABS.length - 1];

  let fee: number;
  if (fulfillment === "easyship") {
    fee = zone === "national" ? slab.esNational : slab.esLocal;
    if (price < 300) fee = Math.max(0, fee - 10); // Easy Ship low-price relief
  } else {
    fee = zone === "national" ? slab.fbaNational : slab.fbaLocal;
  }
  return fee;
}

export function calculateProfit(i: ProfitInput): ProfitResult {
  const sp = Math.max(0, i.sellingPrice || 0);
  const hasSale = sp > 0;

  const rate = referralRate(i.category, sp);
  const referral = sp * rate;
  const closing = hasSale ? closingFee(sp, i.fulfillment) : 0;
  const shipping = hasSale ? shippingFee(sp, i.fulfillment, i.zone, i.weightKg || 0.5) : 0;

  const pickPack = i.fulfillment === "fba" && hasSale ? fbaPickPack(i.weightKg || 0.5) : 0;
  const storage = i.fulfillment === "fba" && hasSale ? FBA_STORAGE[i.size] : 0;

  const feeSum = referral + closing + shipping + pickPack + storage;
  const gstOnFees = feeSum * GST_RATE;
  const amazonFees = feeSum + gstOnFees;
  const settlement = sp - amazonFees;

  const landed = (i.productCost || 0) + (i.packaging || 0);
  // ACOS % and Returns % apply to what's left after Amazon's settlement
  // and product+packaging cost (owner's convention, July 2026).
  const remaining = Math.max(0, settlement - landed);
  const marketing = remaining * ((i.acosPct || 0) / 100);
  const returns = remaining * ((i.returnsPct || 0) / 100);

  const netProfit = settlement - landed - marketing - returns;
  const margin = hasSale ? (netProfit / sp) * 100 : 0;
  const invested = landed + marketing + returns;
  const roi = invested > 0 ? (netProfit / invested) * 100 : 0;

  const itcRecoverable = i.gstRegistered !== false ? gstOnFees : 0;
  const netProfitAfterItc = netProfit + itcRecoverable;

  return {
    referral,
    closing,
    shipping,
    fbaPickPack: pickPack,
    fbaStorage: storage,
    gstOnFees,
    amazonFees,
    amazonFeesPct: hasSale ? (amazonFees / sp) * 100 : 0,
    settlement,
    marketing,
    returns,
    landed,
    netProfit,
    margin,
    roi,
    referralRate: rate,
    isLoss: netProfit < 0,
    lowMargin: margin < 15,
    itcRecoverable,
    netProfitAfterItc,
  };
}

// Formatting helpers (kept with the engine so screens stay dumb).
export const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const inr0 = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");
export const pct = (n: number) => n.toFixed(2) + "%";
