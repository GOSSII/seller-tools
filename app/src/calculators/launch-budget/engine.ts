export type LaunchInput = {
  launchDays: number;
  dailyPpc: number;
  couponBudget: number;
  creativeCost: number;
  sampleCost: number;
};
export type LaunchResult = {
  ppcTotal: number;
  total: number;
  perDay: number;
  breakdown: { label: string; value: number; pct: number }[];
};

export function calculateLaunch(i: LaunchInput): LaunchResult {
  const ppcTotal = (i.launchDays || 0) * (i.dailyPpc || 0);
  const items = [
    { label: "PPC / ads", value: ppcTotal },
    { label: "Coupons & promos", value: i.couponBudget || 0 },
    { label: "Creative & photography", value: i.creativeCost || 0 },
    { label: "Samples & reviews", value: i.sampleCost || 0 },
  ];
  const total = items.reduce((s, x) => s + x.value, 0);
  return {
    ppcTotal,
    total,
    perDay: i.launchDays > 0 ? total / i.launchDays : 0,
    breakdown: items.map((x) => ({ ...x, pct: total > 0 ? (x.value / total) * 100 : 0 })),
  };
}
