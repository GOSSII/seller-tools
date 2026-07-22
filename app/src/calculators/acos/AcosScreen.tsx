import React, { useMemo, useState } from "react";
import { Screen, Card, Row, Gap, Spacer, StatGrid, ResultRow, InfoBanner, SectionTitle } from "../../components/ui";
import { NumericInput } from "../../components/NumericInput";
import { calculateAcos } from "./engine";
import { inr, pct } from "../profit/engine";

export default function AcosScreen() {
  const [adSpend, setAdSpend] = useState("5000");
  const [adSales, setAdSales] = useState("20000");
  const [totalSales, setTotalSales] = useState("50000");

  const r = useMemo(
    () => calculateAcos({ adSpend: +adSpend || 0, adSales: +adSales || 0, totalSales: +totalSales || 0 }),
    [adSpend, adSales, totalSales]
  );

  return (
    <Screen>
      <Card>
        <Row>
          <NumericInput label="Ad Spend (₹)" value={adSpend} onChange={setAdSpend} />
          <Spacer />
          <NumericInput label="Ad Sales (₹)" value={adSales} onChange={setAdSales} />
        </Row>
        <Gap />
        <NumericInput label="Total Sales (₹)" value={totalSales} onChange={setTotalSales} />
      </Card>

      <StatGrid items={[
        { k: "ACOS", v: pct(r.acos), tone: r.acos > 30 ? "red" : "green" },
        { k: "ROAS", v: r.roas.toFixed(2) + "x", tone: "blue" },
        { k: "TACoS", v: pct(r.tacos), tone: "plain" },
        { k: "Organic Share", v: pct(r.organicPct), tone: "plain" },
      ]} />

      <InfoBanner
        tone={r.tacos < 10 ? "good" : r.tacos < 20 ? "info" : "warn"}
        text={
          r.tacos < 10
            ? "Healthy TACoS — ads are a small share of total revenue, so your brand has strong organic pull."
            : r.tacos < 20
            ? "Moderate TACoS. Watch that organic sales grow as you scale ad spend."
            : "High TACoS — you're leaning heavily on ads for revenue. Work on organic rank and conversion."
        }
      />

      <Card style={{ padding: 0, marginTop: 14 }}>
        <ResultRow label="Ad sales" value={inr(+adSales || 0) + `  (${pct(r.adSalesPct)})`} muted />
        <ResultRow label="Organic sales" value={inr(r.organicSales) + `  (${pct(r.organicPct)})`} muted />
        <ResultRow label="Total sales" value={inr(+totalSales || 0)} highlight />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <SectionTitle>What these mean</SectionTitle>
        <ResultRow label="ACOS" value="Ad spend ÷ ad sales" muted />
        <ResultRow label="TACoS" value="Ad spend ÷ total sales" muted />
        <ResultRow label="ROAS" value="Ad sales ÷ ad spend" muted />
      </Card>
    </Screen>
  );
}
