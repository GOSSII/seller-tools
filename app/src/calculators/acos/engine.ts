export type AcosInput = { adSpend: number; adSales: number; totalSales: number };
export type AcosResult = {
  acos: number; roas: number; tacos: number;
  organicSales: number; organicPct: number; adSalesPct: number;
};

export function calculateAcos(i: AcosInput): AcosResult {
  const adSpend = i.adSpend || 0;
  const adSales = i.adSales || 0;
  const totalSales = i.totalSales || 0;
  const organicSales = Math.max(0, totalSales - adSales);
  return {
    acos: adSales > 0 ? (adSpend / adSales) * 100 : 0,
    roas: adSpend > 0 ? adSales / adSpend : 0,
    tacos: totalSales > 0 ? (adSpend / totalSales) * 100 : 0,
    organicSales,
    organicPct: totalSales > 0 ? (organicSales / totalSales) * 100 : 0,
    adSalesPct: totalSales > 0 ? (adSales / totalSales) * 100 : 0,
  };
}
