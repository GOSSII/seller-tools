import { TACOS_BENCHMARK } from "../../data/amazonFees";

export type MktBudgetInput = {
  revenueTarget: number;   // monthly
  category: string;
  customTacos?: number;    // override benchmark
};
export type MktBudgetResult = {
  tacosPct: number;
  monthlyBudget: number;
  dailyBudget: number;
  weeklyBudget: number;
};

export function calculateMktBudget(i: MktBudgetInput): MktBudgetResult {
  const tacos = i.customTacos != null && i.customTacos > 0
    ? i.customTacos
    : (TACOS_BENCHMARK[i.category] ?? 10);
  const monthly = (i.revenueTarget || 0) * (tacos / 100);
  return {
    tacosPct: tacos,
    monthlyBudget: monthly,
    weeklyBudget: monthly / 4.345,
    dailyBudget: monthly / 30,
  };
}
