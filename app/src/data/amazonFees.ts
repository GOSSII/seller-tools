// =============================================================
// Amazon India fee data — SINGLE SOURCE OF TRUTH
// Every calculator imports from here. Update rates in ONE place
// and all calculators stay in sync. Verified to the paisa against
// the reference tool across low/light and high/heavy/oversize cases.
//
// ⚠️  Verify against your live Seller Central rate card before
//     production pricing. Amazon revised referral fees on
//     16 Mar 2026 (0% on many sub-₹1,000 items + tiered above).
// =============================================================

export const GST_RATE = 0.18;

// Referral rate by price band: [<=300, <=500, <=1000, >1000]
export type Category = {
  key: string;
  name: string;
  referral: [number, number, number, number]; // fractions
  benchmark: { low: number; median: number; high: number }; // net-margin %
};

export const CATEGORIES: Category[] = [
  { key: "electronics",      name: "Electronics",              referral: [0.045, 0.06,  0.07,  0.09],  benchmark: { low: 4,  median: 9,  high: 16 } },
  { key: "mobile-phones",    name: "Mobile Phones & Tablets",  referral: [0.04,  0.04,  0.045, 0.05],  benchmark: { low: 2,  median: 5,  high: 9  } },
  { key: "computers",        name: "Computers & Laptops",      referral: [0.04,  0.05,  0.055, 0.06],  benchmark: { low: 3,  median: 7,  high: 12 } },
  { key: "clothing",         name: "Clothing & Apparel",       referral: [0.05,  0.05,  0.14,  0.17],  benchmark: { low: 6,  median: 14, high: 24 } },
  { key: "footwear",         name: "Footwear",                 referral: [0.05,  0.05,  0.11,  0.14],  benchmark: { low: 6,  median: 13, high: 22 } },
  { key: "watches",          name: "Watches",                  referral: [0.06,  0.075, 0.115, 0.135], benchmark: { low: 8,  median: 17, high: 28 } },
  { key: "beauty",           name: "Beauty & Cosmetics",       referral: [0.04,  0.075, 0.13,  0.17],  benchmark: { low: 10, median: 20, high: 32 } },
  { key: "personal-care",    name: "Personal Care Appliances", referral: [0.045, 0.065, 0.08,  0.10],  benchmark: { low: 6,  median: 13, high: 22 } },
  { key: "grocery",          name: "Grocery & Gourmet",        referral: [0.035, 0.045, 0.05,  0.055], benchmark: { low: 3,  median: 7,  high: 12 } },
  { key: "home-kitchen",     name: "Home & Kitchen",           referral: [0.045, 0.09,  0.10,  0.15],  benchmark: { low: 6,  median: 14, high: 24 } },
  { key: "furniture",        name: "Furniture",                referral: [0.06,  0.09,  0.115, 0.145], benchmark: { low: 5,  median: 12, high: 20 } },
  { key: "toys",             name: "Toys & Games",             referral: [0.045, 0.06,  0.075, 0.095], benchmark: { low: 7,  median: 15, high: 25 } },
  { key: "sports",           name: "Sports & Fitness",         referral: [0.045, 0.06,  0.075, 0.09],  benchmark: { low: 7,  median: 14, high: 23 } },
  { key: "books",            name: "Books",                    referral: [0.04,  0.04,  0.04,  0.04],  benchmark: { low: 4,  median: 9,  high: 16 } },
  { key: "jewellery",        name: "Fashion Jewellery",        referral: [0.115, 0.165, 0.195, 0.225], benchmark: { low: 8,  median: 18, high: 30 } },
  { key: "baby-products",    name: "Baby Products",            referral: [0.04,  0.05,  0.055, 0.06],  benchmark: { low: 7,  median: 14, high: 23 } },
  { key: "automotive",       name: "Automotive",               referral: [0.06,  0.085, 0.095, 0.11],  benchmark: { low: 6,  median: 12, high: 20 } },
  { key: "pet-supplies",     name: "Pet Supplies",             referral: [0.04,  0.05,  0.05,  0.065], benchmark: { low: 8,  median: 16, high: 25 } },
  { key: "health",           name: "Health & Nutrition",       referral: [0.05,  0.065, 0.075, 0.09],  benchmark: { low: 9,  median: 18, high: 28 } },
  { key: "large-appliances", name: "Large Appliances",         referral: [0.04,  0.045, 0.05,  0.055], benchmark: { low: 3,  median: 7,  high: 12 } },
  { key: "small-appliances", name: "Small Appliances",         referral: [0.04,  0.045, 0.05,  0.055], benchmark: { low: 4,  median: 9,  high: 15 } },
  { key: "headphones",       name: "Headphones & Earphones",   referral: [0.075, 0.115, 0.145, 0.18],  benchmark: { low: 4,  median: 9,  high: 16 } },
  { key: "other",            name: "Other",                    referral: [0.06,  0.09,  0.12,  0.15],  benchmark: { low: 5,  median: 12, high: 20 } },
];

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
);

// Closing fee bands (₹) shared by all categories.
export const CLOSING = { low: 5, mid: 9, high: 30, vhigh: 56 };

// Weight-slab shipping (₹). Columns: ES Local, ES National, FBA Local, FBA National.
// (A "Zonal" column exists on the source but the engine reads Local/National only.)
export const SHIPPING_SLABS: {
  maxKg: number;
  esLocal: number; esNational: number;
  fbaLocal: number; fbaNational: number;
}[] = [
  { maxKg: 0.5, esLocal: 43,  esNational: 65,  fbaLocal: 35,  fbaNational: 55  },
  { maxKg: 1,   esLocal: 55,  esNational: 82,  fbaLocal: 45,  fbaNational: 70  },
  { maxKg: 2,   esLocal: 75,  esNational: 110, fbaLocal: 60,  fbaNational: 90  },
  { maxKg: 3,   esLocal: 95,  esNational: 140, fbaLocal: 80,  fbaNational: 115 },
  { maxKg: 5,   esLocal: 130, esNational: 195, fbaLocal: 110, fbaNational: 160 },
  { maxKg: 10,  esLocal: 200, esNational: 300, fbaLocal: 170, fbaNational: 250 },
  { maxKg: 20,  esLocal: 350, esNational: 500, fbaLocal: 300, fbaNational: 420 },
  { maxKg: 999, esLocal: 500, esNational: 750, fbaLocal: 450, fbaNational: 650 },
];

// FBA pick&pack by weight (₹).
export function fbaPickPack(kg: number): number {
  if (kg <= 0.5) return 14;
  if (kg <= 1) return 20;
  if (kg <= 3) return 26;
  if (kg <= 5) return 38;
  return 50;
}

// FBA storage by size tier (₹).
export const FBA_STORAGE: Record<SizeTier, number> = {
  standard: 5,
  large: 12,
  oversize: 25,
};

export type SizeTier = "standard" | "large" | "oversize";
export type Fulfillment = "self" | "easyship" | "fba";
export type Zone = "local" | "national";

// ---- Additional shared data for other calculators ----

// FBA storage: ₹ per cubic foot per month. Amazon India charges more in the
// Oct–Dec peak. Long-term (aged) surcharge applies to inventory > 365 days.
export const STORAGE = {
  perCubicFootStandard: 45,   // Jan–Sep
  perCubicFootPeak: 48,       // Oct–Dec
  agedSurchargePerCubicFoot: 300, // long-term storage, per cu.ft, per month
};

// Recommended TACoS (total ad cost of sale) benchmark % by category, used by
// the Marketing Budget Planner to translate a revenue target into an ad budget.
export const TACOS_BENCHMARK: Record<string, number> = {
  electronics: 8, "mobile-phones": 5, computers: 6, clothing: 12, footwear: 12,
  watches: 14, beauty: 15, "personal-care": 12, grocery: 6, "home-kitchen": 11,
  furniture: 10, toys: 12, sports: 11, books: 7, jewellery: 16, "baby-products": 11,
  automotive: 9, "pet-supplies": 12, health: 13, "large-appliances": 6,
  "small-appliances": 7, headphones: 10, other: 10,
};
