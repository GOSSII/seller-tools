import React, { useMemo, useState } from "react";
import { Screen, Card, Row, Gap, Spacer, StatGrid, ResultRow, SectionTitle } from "../../components/ui";
import { NumericInput } from "../../components/NumericInput";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Dropdown } from "../../components/Dropdown";
import { CATEGORIES, type SizeTier, type Zone } from "../../data/amazonFees";
import { calculateFbaFee } from "./engine";
import { inr, inr0, pct } from "../profit/engine";

export default function FbaFeeScreen() {
  const [sp, setSp] = useState("999");
  const [category, setCategory] = useState("electronics");
  const [weight, setWeight] = useState("0.5");
  const [size, setSize] = useState<SizeTier>("standard");
  const [zone, setZone] = useState<Zone>("national");

  const r = useMemo(
    () => calculateFbaFee({ sellingPrice: +sp || 0, category, weightKg: +weight || 0.5, size, zone }),
    [sp, category, weight, size, zone]
  );

  return (
    <Screen>
      <Card>
        <Row>
          <NumericInput label="Selling Price (₹)" value={sp} onChange={setSp} />
        </Row>
        <Gap />
        <Dropdown
          label="Category"
          value={category}
          items={CATEGORIES.map((c) => ({ value: c.key, label: c.name }))}
          onChange={setCategory}
        />
        <Gap />
        <Row>
          <NumericInput label="Weight (kg)" value={weight} onChange={setWeight} allowDecimal />
          <Spacer />
          <SegmentedControl label="Size" value={size} onChange={setSize}
            options={[{ value: "standard", label: "Standard" }, { value: "large", label: "Large" }, { value: "oversize", label: "Oversize" }]} />
        </Row>
        <Gap />
        <SegmentedControl label="Zone" value={zone} onChange={setZone}
          options={[{ value: "local", label: "Local" }, { value: "national", label: "National" }]} />
      </Card>

      <StatGrid items={[
        { k: "Total FBA Fees", v: inr(r.totalFees), tone: "red" },
        { k: "Fees % of SP", v: pct(r.feePct), tone: "plain" },
        { k: "Net Settlement", v: inr(r.settlement), tone: "blue" },
        { k: "Referral Rate", v: pct(r.referralRate * 100), tone: "plain" },
      ]} />

      <Card style={{ padding: 0, marginTop: 14 }}>
        <ResultRow label="Selling Price" value={inr0(+sp || 0)} />
        <ResultRow label={`Referral fee (${(r.referralRate * 100).toFixed(1)}%)`} value={`-${inr(r.referral)}`} neg muted />
        <ResultRow label="Closing fee" value={`-${inr0(r.closing)}`} neg muted />
        <ResultRow label="Weight handling" value={`-${inr0(r.weightHandling)}`} neg muted />
        <ResultRow label="FBA pick & pack" value={`-${inr0(r.pickPack)}`} neg muted />
        <ResultRow label="FBA storage" value={`-${inr0(r.storage)}`} neg muted />
        <ResultRow label="GST on fees (18%)" value={`-${inr(r.gst)}`} neg muted />
        <ResultRow label="Net Settlement" value={inr(r.settlement)} final />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <SectionTitle>What this tells you</SectionTitle>
        <ResultRow label="Amazon keeps" value={pct(r.feePct)} muted />
        <ResultRow label="You receive" value={pct(100 - r.feePct)} muted />
      </Card>
    </Screen>
  );
}
