export type AdRoiInput = {
  budget: number; cpc: number; conversionRate: number; avgOrderValue: number;
};
export type AdRoiResult = {
  clicks: number; orders: number; sales: number;
  roas: number; acos: number; costPerOrder: number;
};

export function calculateAdRoi(i: AdRoiInput): AdRoiResult {
  const budget = i.budget || 0;
  const cpc = i.cpc || 0;
  const cvr = (i.conversionRate || 0) / 100;
  const aov = i.avgOrderValue || 0;

  const clicks = cpc > 0 ? budget / cpc : 0;
  const orders = clicks * cvr;
  const sales = orders * aov;

  return {
    clicks, orders, sales,
    roas: budget > 0 ? sales / budget : 0,
    acos: sales > 0 ? (budget / sales) * 100 : 0,
    costPerOrder: orders > 0 ? budget / orders : 0,
  };
}
