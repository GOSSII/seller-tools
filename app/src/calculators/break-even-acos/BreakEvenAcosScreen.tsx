import React, { useMemo, useState } from "react";
import { Screen, Card, Row, Gap, Spacer, StatGrid, ResultRow, InfoBanner } from "../../components/ui";
import { NumericInput } from "../../components/NumericInput";
import { calculateBreakEven } from "./engine";
import { inr, pct } from "../profit/engine";

export default function BreakEvenAcosScreen() {
  const [price, setPrice] = useState("999");
  const [cost, setCost] = useState("400");
  const [fees, setFees] = useState("169");
  const [cvr, setCvr] = useState("10");
  const [target, setTarget] = useState("15");

  const r = useMemo(
    () => calculateBreakEven({
      sellingPrice: +price || 0, productCost: +cost || 0, amazonFees: +fees || 0,
      conversionRate: +cvr || 0, targetProfitPct: +target || 0,
    }),
    [price, cost, fees, cvr, target]
  );

  return (
    <Screen>
      <Card>
        <Row>
          <NumericInput label="Selling Price (₹)" value={price} onChange={setPrice} />
          <Spacer />
          <NumericInput label="Product Cost (₹)" value={cost} onChange={setCost} />
        </Row>
        <Gap />
        <Row>
          <NumericInput label="Amazon Fees (₹/unit)" value={fees} onChange={setFees} />
          <Spacer />
          <NumericInput label="Conversion Rate (%)" value={cvr} onChange={setCvr} allowDecimal />
        </Row>
        <Gap />
        <NumericInput label="Target Profit (% of price)" value={target} onChange={setTarget} allowDecimal />
      </Card>

      <StatGrid items={[
        { k: "Break-Even ACOS", v: pct(r.breakEvenAcos), tone: "blue" },
        { k: "Max CPC (break-even)", v: inr(r.breakEvenCpc), tone: "plain" },
        { k: "Target ACOS", v: pct(r.targetAcos), tone: "green" },
        { k: "Target Max CPC", v: inr(r.targetCpc), tone: "plain" },
      ]} />

      <InfoBanner tone="info" text={`Above ${r.breakEvenAcos.toFixed(1)}% ACOS you lose money on ad-driven sales. Bid so your CPC stays under ${inr(r.breakEvenCpc)} to break even, or under ${inr(r.targetCpc)} to keep your ${target}% target profit.`} />

      <Card style={{ padding: 0, marginTop: 14 }}>
        <ResultRow label="Profit before ads (per unit)" value={inr(r.profitBeforeAds)} highlight />
        <ResultRow label="Break-even ACOS" value={pct(r.breakEvenAcos)} muted />
        <ResultRow label="Break-even CPC" value={inr(r.breakEvenCpc)} muted />
        <ResultRow label="Max spend / order (target)" value={inr(r.maxSpendPerOrder)} muted />
        <ResultRow label="Target CPC" value={inr(r.targetCpc)} final />
      </Card>
    </Screen>
  );
}
