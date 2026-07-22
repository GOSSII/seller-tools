import React, { useMemo, useState } from "react";
import { Screen, Card, Row, Gap, Spacer, StatGrid, ResultRow, InfoBanner, SectionTitle } from "../../components/ui";
import { NumericInput } from "../../components/NumericInput";
import { SegmentedControl } from "../../components/SegmentedControl";
import { calculateStorage } from "./engine";
import { inr, pct } from "../profit/engine";

export default function FbaStorageScreen() {
  const [l, setL] = useState("30");
  const [w, setW] = useState("20");
  const [h, setH] = useState("10");
  const [units, setUnits] = useState("500");
  const [sales, setSales] = useState("150");
  const [peak, setPeak] = useState<"off" | "on">("off");
  const [age, setAge] = useState("60");

  const r = useMemo(
    () => calculateStorage({
      lengthCm: +l || 0, widthCm: +w || 0, heightCm: +h || 0,
      units: +units || 0, monthlySales: +sales || 0,
      peakSeason: peak === "on", daysInStock: +age || 0,
    }),
    [l, w, h, units, sales, peak, age]
  );

  const cover = isFinite(r.monthsOfCover) ? r.monthsOfCover.toFixed(1) + " mo" : "—";

  return (
    <Screen>
      <Card>
        <SectionTitle>Unit dimensions (cm)</SectionTitle>
        <Row>
          <NumericInput label="Length" value={l} onChange={setL} allowDecimal />
          <Spacer />
          <NumericInput label="Width" value={w} onChange={setW} allowDecimal />
          <Spacer />
          <NumericInput label="Height" value={h} onChange={setH} allowDecimal />
        </Row>
        <Gap />
        <Row>
          <NumericInput label="Units in stock" value={units} onChange={setUnits} />
          <Spacer />
          <NumericInput label="Units sold / month" value={sales} onChange={setSales} />
        </Row>
        <Gap />
        <Row>
          <NumericInput label="Days in stock" value={age} onChange={setAge} />
          <Spacer />
          <SegmentedControl label="Season" value={peak} onChange={setPeak}
            options={[{ value: "off", label: "Jan–Sep" }, { value: "on", label: "Oct–Dec" }]} />
        </Row>
      </Card>

      <StatGrid items={[
        { k: "Monthly Storage", v: inr(r.monthlyStorage), tone: "blue" },
        { k: "Months of Cover", v: cover, tone: r.monthsOfCover > 6 ? "red" : "green" },
        { k: "Total Volume", v: r.totalVolumeCuFt.toFixed(2) + " ft³", tone: "plain" },
        { k: "Monthly Exposure", v: inr(r.totalMonthlyExposure), tone: r.aged ? "red" : "plain" },
      ]} />

      {r.monthsOfCover > 6 && isFinite(r.monthsOfCover) ? (
        <InfoBanner tone="warn" text={`You're holding ${r.monthsOfCover.toFixed(1)} months of cover. Over ~6 months ties up cash and risks long-term storage fees. Consider a promotion or removal order.`} />
      ) : null}
      {r.aged ? (
        <InfoBanner tone="warn" text={`This inventory is over 365 days old — an aged-storage surcharge of ${inr(r.agedSurcharge)}/month applies on top of standard storage.`} />
      ) : null}

      <Card style={{ padding: 0, marginTop: 14 }}>
        <ResultRow label="Unit volume" value={r.unitVolumeCuFt.toFixed(4) + " ft³"} muted />
        <ResultRow label="Total volume" value={r.totalVolumeCuFt.toFixed(2) + " ft³"} muted />
        <ResultRow label={`Rate (${peak === "on" ? "peak" : "standard"})`} value={inr(r.ratePerCuFt) + " / ft³"} muted />
        <ResultRow label="Standard storage" value={inr(r.monthlyStorage)} highlight />
        {r.aged ? <ResultRow label="Aged surcharge" value={inr(r.agedSurcharge)} neg muted /> : null}
        <ResultRow label="Total monthly exposure" value={inr(r.totalMonthlyExposure)} final />
      </Card>
    </Screen>
  );
}
