import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Screen, Card, Row, Gap, Spacer, StatGrid, ResultRow, SectionTitle } from "../../components/ui";
import { NumericInput } from "../../components/NumericInput";
import { calculateLaunch } from "./engine";
import { inr } from "../profit/engine";
import { theme } from "../../theme";

const COLORS = ["#6366F1", "#F59E0B", "#0EA5E9", "#22C55E"];

export default function LaunchBudgetScreen() {
  const [days, setDays] = useState("30");
  const [ppc, setPpc] = useState("1000");
  const [coupon, setCoupon] = useState("15000");
  const [creative, setCreative] = useState("8000");
  const [samples, setSamples] = useState("5000");

  const r = useMemo(
    () => calculateLaunch({
      launchDays: +days || 0, dailyPpc: +ppc || 0, couponBudget: +coupon || 0,
      creativeCost: +creative || 0, sampleCost: +samples || 0,
    }),
    [days, ppc, coupon, creative, samples]
  );

  const total = r.total || 1;

  return (
    <Screen>
      <Card>
        <Row>
          <NumericInput label="Launch Days" value={days} onChange={setDays} />
          <Spacer />
          <NumericInput label="Daily PPC (₹)" value={ppc} onChange={setPpc} />
        </Row>
        <Gap />
        <Row>
          <NumericInput label="Coupon Budget (₹)" value={coupon} onChange={setCoupon} />
          <Spacer />
          <NumericInput label="Creative (₹)" value={creative} onChange={setCreative} />
        </Row>
        <Gap />
        <NumericInput label="Samples & Reviews (₹)" value={samples} onChange={setSamples} />
      </Card>

      <StatGrid items={[
        { k: "Total Launch Budget", v: inr(r.total), tone: "blue" },
        { k: "Avg Spend / Day", v: inr(r.perDay), tone: "plain" },
        { k: "PPC Total", v: inr(r.ppcTotal), tone: "plain" },
        { k: "Launch Window", v: (+days || 0) + " days", tone: "plain" },
      ]} />

      <Card style={{ marginTop: 14 }}>
        <SectionTitle>Budget allocation</SectionTitle>
        <View style={{ flexDirection: "row", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 18, backgroundColor: "#EEF1F6" }}>
          {r.breakdown.filter((b) => b.value > 0).map((b, idx) => (
            <View key={b.label} style={{ flex: b.value / total, backgroundColor: COLORS[idx % COLORS.length] }} />
          ))}
        </View>
        {r.breakdown.map((b, idx) => (
          <ResultRow key={b.label} label={b.label} value={`${inr(b.value)}   ${b.pct.toFixed(0)}%`} muted />
        ))}
      </Card>
    </Screen>
  );
}
