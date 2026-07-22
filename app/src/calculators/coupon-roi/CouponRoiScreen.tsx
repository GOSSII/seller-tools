import React, { useMemo, useState } from "react";
import { Screen, Card, Row, Gap, Spacer, StatGrid, ResultRow, InfoBanner } from "../../components/ui";
import { NumericInput } from "../../components/NumericInput";
import { calculateCoupon } from "./engine";
import { inr } from "../profit/engine";

export default function CouponRoiScreen() {
  const [price, setPrice] = useState("999");
  const [discount, setDiscount] = useState("15");
  const [fee, setFee] = useState("6");
  const [baseline, setBaseline] = useState("100");
  const [uplift, setUplift] = useState("40");
  const [cost, setCost] = useState("400");
  const [fees, setFees] = useState("169");

  const r = useMemo(
    () => calculateCoupon({
      price: +price || 0, discountPct: +discount || 0, redemptionFee: +fee || 0,
      baselineOrders: +baseline || 0, upliftPct: +uplift || 0,
      unitCost: +cost || 0, unitFees: +fees || 0,
    }),
    [price, discount, fee, baseline, uplift, cost, fees]
  );

  return (
    <Screen>
      <Card>
        <Row>
          <NumericInput label="Regular Price (₹)" value={price} onChange={setPrice} />
          <Spacer />
          <NumericInput label="Discount (%)" value={discount} onChange={setDiscount} allowDecimal />
        </Row>
        <Gap />
        <Row>
          <NumericInput label="Coupon Fee (₹)" value={fee} onChange={setFee} allowDecimal />
          <Spacer />
          <NumericInput label="Sales Uplift (%)" value={uplift} onChange={setUplift} allowDecimal />
        </Row>
        <Gap />
        <Row>
          <NumericInput label="Baseline Orders" value={baseline} onChange={setBaseline} />
          <Spacer />
          <NumericInput label="Unit Cost (₹)" value={cost} onChange={setCost} />
          <Spacer />
          <NumericInput label="Amazon Fees (₹)" value={fees} onChange={setFees} />
        </Row>
      </Card>

      <StatGrid items={[
        { k: "Discounted Price", v: inr(r.discountedPrice), tone: "plain" },
        { k: "Incremental Orders", v: "+" + Math.round(r.incrementalOrders), tone: "blue" },
        { k: "Net vs Baseline", v: inr(r.netVsBaseline), tone: r.worthIt ? "green" : "red" },
        { k: "Coupon Fees", v: inr(r.couponFees), tone: "plain" },
      ]} />

      <InfoBanner
        tone={r.worthIt ? "good" : "warn"}
        text={
          r.worthIt
            ? `Worth it: the coupon adds ${inr(r.netVsBaseline)} in contribution over baseline, driven by ~${Math.round(r.incrementalOrders)} extra orders.`
            : `Not worth it at these numbers: contribution drops ${inr(Math.abs(r.netVsBaseline))} vs baseline. You'd need more uplift, a smaller discount, or higher margin to make the coupon pay.`
        }
      />

      <Card style={{ padding: 0, marginTop: 14 }}>
        <ResultRow label="Discount cost" value={`-${inr(r.discountCost)}`} neg muted />
        <ResultRow label="Coupon redemption fees" value={`-${inr(r.couponFees)}`} neg muted />
        <ResultRow label="Margin per unit (discounted)" value={inr(r.marginPerUnit)} muted />
        <ResultRow label="Contribution with coupon" value={inr(r.contribution)} highlight />
        <ResultRow label="Baseline contribution" value={inr(r.baselineContribution)} muted />
        <ResultRow label="Net vs baseline" value={inr(r.netVsBaseline)} final loss={!r.worthIt} />
      </Card>
    </Screen>
  );
}
