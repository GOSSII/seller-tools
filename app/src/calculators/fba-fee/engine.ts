import {
  CATEGORY_MAP, CLOSING, SHIPPING_SLABS, FBA_STORAGE, fbaPickPack, GST_RATE,
  type SizeTier, type Zone,
} from "../../data/amazonFees";

export type FbaFeeInput = {
  sellingPrice: number;
  category: string;
  weightKg: number;
  size: SizeTier;
  zone: Zone;
};

export type FbaFeeResult = {
  referral: number; closing: number; weightHandling: number;
  pickPack: number; storage: number; gst: number;
  totalFees: number; feePct: number; settlement: number;
  referralRate: number;
};

export function calculateFbaFee(i: FbaFeeInput): FbaFeeResult {
  const sp = Math.max(0, i.sellingPrice || 0);
  const c = CATEGORY_MAP[i.category] ?? CATEGORY_MAP["other"];
  const rate = sp <= 300 ? c.referral[0] : sp <= 500 ? c.referral[1] : sp <= 1000 ? c.referral[2] : c.referral[3];
  const referral = sp * rate;
  const closing = sp <= 250 ? CLOSING.low : sp <= 500 ? CLOSING.mid : sp <= 1000 ? CLOSING.high : CLOSING.vhigh;

  const slab = SHIPPING_SLABS.find((s) => (i.weightKg || 0.5) <= s.maxKg) ?? SHIPPING_SLABS[SHIPPING_SLABS.length - 1];
  const weightHandling = i.zone === "national" ? slab.fbaNational : slab.fbaLocal;
  const pickPack = fbaPickPack(i.weightKg || 0.5);
  const storage = FBA_STORAGE[i.size];

  const feeSum = referral + closing + weightHandling + pickPack + storage;
  const gst = feeSum * GST_RATE;
  const totalFees = feeSum + gst;

  return {
    referral, closing, weightHandling, pickPack, storage, gst,
    totalFees, feePct: sp > 0 ? (totalFees / sp) * 100 : 0,
    settlement: sp - totalFees, referralRate: rate,
  };
}
