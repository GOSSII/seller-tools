import React, { useMemo, useState } from "react";
import { Screen, Card, Gap, StatGrid, ResultRow, InfoBanner } from "../../components/ui";
import { NumericInput } from "../../components/NumericInput";
import { Dropdown } from "../../components/Dropdown";
import { CATEGORIES } from "../../data/amazonFees";
import { calculateMktBudget } from "./engine";
import { inr } from "../profit/engine";

export default function MarketingBudgetScreen() {
  const [revenue, setRevenue] = useState("500000");
  const [category, setCategory] = useState("electronics");
  const [customTacos, setCustomTacos] = useState("");

  const r = useMemo(
    () => calculateMktBudget({
      revenueTarget: +revenue || 0, category,
      customTacos: customTacos ? +customTacos : undefined,
    }),
    [revenue, category, customTacos]
  );

  return (
    <Screen>
      <Card>
        <NumericInput label="Monthly Revenue Target (₹)" value={revenue} onChange={setRevenue} />
        <Gap />
        <Dropdown label="Category" value={category}
          items={CATEGORIES.map((c) => ({ value: c.key, label: c.name }))} onChange={setCategory} />
        <Gap />
        <NumericInput label="Custom TACoS % (optional)" value={customTacos} onChange={setCustomTacos} allowDecimal />
      </Card>

      <StatGrid items={[
        { k: "Monthly Ad Budget", v: inr(r.monthlyBudget), tone: "blue" },
        { k: "Daily Budget", v: inr(r.dailyBudget), tone: "green" },
        { k: "Weekly Budget", v: inr(r.weeklyBudget), tone: "plain" },
        { k: "TACoS Used", v: r.tacosPct + "%", tone: "plain" },
      ]} />

      <InfoBanner tone="info" text={`Based on a ${r.tacosPct}% TACoS benchmark for this category, aim for about ${inr(r.dailyBudget)}/day to support a ${inr(+revenue || 0)} monthly revenue target. Enter a custom TACoS to match your own history.`} />

      <Card style={{ padding: 0, marginTop: 14 }}>
        <ResultRow label="Revenue target" value={inr(+revenue || 0)} highlight />
        <ResultRow label="TACoS benchmark" value={r.tacosPct + "%"} muted />
        <ResultRow label="Monthly budget" value={inr(r.monthlyBudget)} muted />
        <ResultRow label="Daily budget" value={inr(r.dailyBudget)} final />
      </Card>
    </Screen>
  );
}
