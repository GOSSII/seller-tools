import React, { useMemo, useState } from "react";
import { Screen, Card, Row, Gap, Spacer, StatGrid, ResultRow, InfoBanner } from "../../components/ui";
import { NumericInput } from "../../components/NumericInput";
import { calculateAdRoi } from "./engine";
import { inr, pct } from "../profit/engine";

export default function AdvertisingRoiScreen() {
  const [budget, setBudget] = useState("10000");
  const [cpc, setCpc] = useState("12");
  const [cvr, setCvr] = useState("8");
  const [aov, setAov] = useState("999");

  const r = useMemo(
    () => calculateAdRoi({ budget: +budget || 0, cpc: +cpc || 0, conversionRate: +cvr || 0, avgOrderValue: +aov || 0 }),
    [budget, cpc, cvr, aov]
  );

  return (
    <Screen>
      <Card>
        <Row>
          <NumericInput label="PPC Budget (₹)" value={budget} onChange={setBudget} />
          <Spacer />
          <NumericInput label="Avg CPC (₹)" value={cpc} onChange={setCpc} allowDecimal />
        </Row>
        <Gap />
        <Row>
          <NumericInput label="Conversion Rate (%)" value={cvr} onChange={setCvr} allowDecimal />
          <Spacer />
          <NumericInput label="Avg Order Value (₹)" value={aov} onChange={setAov} />
        </Row>
      </Card>

      <StatGrid items={[
        { k: "Est. Clicks", v: Math.round(r.clicks).toLocaleString("en-IN"), tone: "plain" },
        { k: "Est. Orders", v: Math.round(r.orders).toLocaleString("en-IN"), tone: "blue" },
        { k: "Projected Sales", v: inr(r.sales), tone: "green" },
        { k: "ROAS", v: r.roas.toFixed(2) + "x", tone: r.roas >= 3 ? "green" : "red" },
      ]} />

      <InfoBanner
        tone={r.roas >= 4 ? "good" : r.roas >= 2.5 ? "info" : "warn"}
        text={`At these inputs, ₹${(+budget || 0).toLocaleString("en-IN")} buys ~${Math.round(r.clicks)} clicks → ~${Math.round(r.orders)} orders → ${inr(r.sales)} in sales (${pct(r.acos)} ACOS).`}
      />

      <Card style={{ padding: 0, marginTop: 14 }}>
        <ResultRow label="Clicks" value={Math.round(r.clicks).toLocaleString("en-IN")} muted />
        <ResultRow label="Orders" value={Math.round(r.orders).toLocaleString("en-IN")} muted />
        <ResultRow label="Cost per order" value={inr(r.costPerOrder)} muted />
        <ResultRow label="Projected sales" value={inr(r.sales)} highlight />
        <ResultRow label="ACOS" value={pct(r.acos)} muted />
        <ResultRow label="ROAS" value={r.roas.toFixed(2) + "x"} final loss={r.roas < 1} />
      </Card>
    </Screen>
  );
}
