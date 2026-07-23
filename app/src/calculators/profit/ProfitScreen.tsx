import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { theme } from "../../theme";
import { NumericInput } from "../../components/NumericInput";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Dropdown } from "../../components/Dropdown";
import { CATEGORIES, CATEGORY_MAP, type SizeTier, type Fulfillment, type Zone } from "../../data/amazonFees";
import { calculateProfit, inr, inr0, pct } from "./engine";

const SPLIT_COLORS: Record<string, string> = {
  cost: "#64748B", pack: "#94A3B8", referral: "#EF4444", closing: "#F59E0B",
  shipping: "#EAB308", fba: "#0EA5E9", gst: "#8B5CF6", marketing: "#6366F1",
  returns: "#A855F7", profit: "#22C55E",
};

export default function ProfitScreen() {
  const [sp, setSp] = useState("999");
  const [cost, setCost] = useState("400");
  const [category, setCategory] = useState("electronics");
  const [weight, setWeight] = useState("0.5");
  const [size, setSize] = useState<SizeTier>("standard");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("self");
  const [zone, setZone] = useState<Zone>("local");
  const [pack, setPack] = useState("15");
  const [acos, setAcos] = useState("10");
  const [returns, setReturns] = useState("3");
  const [gstReg, setGstReg] = useState<"yes" | "no">("yes");

  const r = useMemo(
    () =>
      calculateProfit({
        sellingPrice: +sp || 0,
        productCost: +cost || 0,
        category,
        weightKg: +weight || 0.5,
        size,
        fulfillment,
        zone,
        packaging: +pack || 0,
        acosPct: +acos || 0,
        returnsPct: +returns || 0,
        gstRegistered: gstReg === "yes",
      }),
    [sp, cost, category, weight, size, fulfillment, zone, pack, acos, returns, gstReg]
  );

  const price = +sp || 0;
  const cat = CATEGORY_MAP[category];
  const zoneDisabled = fulfillment === "self";

  const segments = [
    { k: "cost", nm: "Your product cost", v: +cost || 0 },
    { k: "pack", nm: "Packaging", v: +pack || 0 },
    { k: "referral", nm: `Amazon referral (${(r.referralRate * 100).toFixed(1)}%)`, v: r.referral },
    { k: "closing", nm: "Closing fee", v: r.closing },
    { k: "shipping", nm: "Shipping", v: r.shipping },
    { k: "fba", nm: "FBA pick&pack + storage", v: r.fbaPickPack + r.fbaStorage },
    { k: "gst", nm: "GST on Amazon fees", v: r.gstOnFees },
    { k: "marketing", nm: "Marketing / ads", v: r.marketing },
    { k: "returns", nm: "Return loss", v: r.returns },
    { k: "profit", nm: r.isLoss ? "Net loss" : "Net profit kept", v: Math.max(0, r.netProfit) },
  ].filter((s) => s.v > 0 || s.k === "profit");

  const total = price || 1;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {/* INPUTS */}
      <View style={styles.card}>
        <View style={styles.row}>
          <NumericInput label="Selling Price (₹)" value={sp} onChange={setSp} />
          <View style={{ width: 12 }} />
          <NumericInput label="Product Cost (₹)" value={cost} onChange={setCost} />
        </View>
        <View style={styles.gap} />
        <Dropdown
          label="Category"
          value={category}
          items={CATEGORIES.map((c) => ({
            value: c.key,
            label: `${c.name} (${(c.referral[3] * 100).toFixed(c.referral[3] * 100 % 1 ? 1 : 0)}%)`,
          }))}
          onChange={setCategory}
        />
        <View style={styles.gap} />
        <View style={styles.row}>
          <NumericInput label="Weight (kg)" value={weight} onChange={setWeight} allowDecimal />
          <View style={{ width: 12 }} />
          <SegmentedControl
            label="Size"
            value={size}
            onChange={setSize}
            options={[
              { value: "standard", label: "Standard" },
              { value: "large", label: "Large" },
              { value: "oversize", label: "Oversize" },
            ]}
          />
        </View>
        <View style={styles.gap} />
        <SegmentedControl
          label="Fulfillment"
          value={fulfillment}
          onChange={setFulfillment}
          options={[
            { value: "self", label: "Self" },
            { value: "easyship", label: "Easy Ship" },
            { value: "fba", label: "FBA" },
          ]}
        />
        <View style={styles.gap} />
        <View style={{ opacity: zoneDisabled ? 0.45 : 1 }}>
          <SegmentedControl
            label="Zone"
            value={zone}
            onChange={(v) => !zoneDisabled && setZone(v)}
            options={[
              { value: "local", label: "Local" },
              { value: "national", label: "National" },
            ]}
          />
        </View>
        <View style={styles.gap} />
        <View style={styles.row}>
          <NumericInput label="Packaging (₹)" value={pack} onChange={setPack} />
          <View style={{ width: 12 }} />
          <NumericInput label="ACOS (%)" value={acos} onChange={setAcos} />
          <View style={{ width: 12 }} />
          <NumericInput label="Returns (%)" value={returns} onChange={setReturns} />
        </View>
        <View style={styles.gap} />
        <SegmentedControl
          label="GST Registered (claim ITC)"
          value={gstReg}
          onChange={setGstReg}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
        {gstReg === "yes" ? (
          <Text style={styles.itcNote}>
            The 18% GST Amazon charges on its fees is claimable back as input tax credit (ITC) in your GST return, so it isn't a true cost for registered sellers.
          </Text>
        ) : null}
      </View>

      {/* STAT CARDS */}
      <View style={styles.stats}>
        <Stat k="Settlement" v={inr(r.settlement)} tone="blue" />
        <Stat k="Net Profit" v={inr(r.netProfit)} tone={r.isLoss ? "red" : "green"} />
        <Stat k="Net Margin" v={pct(r.margin)} tone="plain" />
        <Stat k="ROI" v={pct(r.roi)} tone="plain" />
        {gstReg === "yes" ? (
          <>
            <Stat k="GST ITC Recoverable" v={inr(r.itcRecoverable)} tone="plain" />
            <Stat k="Profit After ITC" v={inr(r.netProfitAfterItc)} tone={r.netProfitAfterItc < 0 ? "red" : "green"} />
          </>
        ) : null}
      </View>

      {/* LOW MARGIN BANNER */}
      {r.lowMargin && price > 0 ? (
        <View style={styles.warn}>
          <Text style={styles.warnTxt}>
            Low margin ({r.margin.toFixed(1)}%). Sustainable range is typically 15–25%. Consider raising price, cutting cost, or trimming ad spend.
          </Text>
        </View>
      ) : null}

      {/* BREAKDOWN */}
      <View style={[styles.card, { padding: 0, marginTop: 14 }]}>
        <BdRow l="Selling Price" r={inr0(price)} />
        <BdRow l={`Amazon Fees (${r.amazonFeesPct.toFixed(2)}% of SP)`} r={`-${inr(r.amazonFees)}`} neg muted />
        <BdRow l="Settlement from Amazon" r={inr(r.settlement)} highlight bold />
        <BdRow l="Product + Packaging" r={`-${inr0(r.landed)}`} neg muted />
        <BdRow l={`Marketing (${acos || 0}%) + Returns (${returns || 0}%)`} r={`-${inr(r.marketing + r.returns)}`} neg muted />
        <BdRow l={`Net ${r.isLoss ? "Loss" : "Profit"} per Unit`} r={inr(r.netProfit)} final loss={r.isLoss} />
        {gstReg === "yes" ? (
          <>
            <BdRow l="GST on fees recoverable as ITC" r={`+${inr(r.itcRecoverable)}`} muted />
            <BdRow l="Net Profit after ITC" r={inr(r.netProfitAfterItc)} final loss={r.netProfitAfterItc < 0} />
          </>
        ) : null}
      </View>

      {/* COST SPLIT */}
      <View style={[styles.card, { marginTop: 14 }]}>
        <Text style={styles.h3}>Where every {inr0(price)} goes</Text>
        <View style={styles.bar}>
          {segments.filter((s) => s.v > 0).map((s) => (
            <View key={s.k} style={{ flex: s.v / total, backgroundColor: SPLIT_COLORS[s.k] }} />
          ))}
        </View>
        {segments.map((s) => {
          const val = s.k === "profit" && r.isLoss ? r.netProfit : s.v;
          return (
            <View key={s.k} style={styles.legRow}>
              <View style={[styles.dot, { backgroundColor: SPLIT_COLORS[s.k] }]} />
              <Text style={styles.legNm}>{s.nm}</Text>
              <Text style={styles.legAmt}>{inr(val)}</Text>
              <Text style={styles.legPct}>{((val / total) * 100).toFixed(1)}%</Text>
            </View>
          );
        })}
      </View>

      {/* BENCHMARK */}
      <View style={[styles.card, { marginTop: 14 }]}>
        <Text style={styles.h3}>Your margin vs. {cat.name} benchmark</Text>
        <Benchmark margin={r.margin} low={cat.benchmark.low} median={cat.benchmark.median} high={cat.benchmark.high} />
      </View>
    </ScrollView>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone: "blue" | "green" | "red" | "plain" }) {
  const toneStyle =
    tone === "blue" ? styles.statBlue : tone === "green" ? styles.statGreen : tone === "red" ? styles.statRed : null;
  const valColor =
    tone === "blue" ? theme.color.blue : tone === "green" ? theme.color.green : tone === "red" ? theme.color.red : theme.color.ink;
  return (
    <View style={[styles.stat, toneStyle]}>
      <Text style={styles.statK}>{k.toUpperCase()}</Text>
      <Text style={[styles.statV, { color: valColor }]}>{v}</Text>
    </View>
  );
}

function BdRow({ l, r, neg, muted, highlight, bold, final, loss }: {
  l: string; r: string; neg?: boolean; muted?: boolean; highlight?: boolean; bold?: boolean; final?: boolean; loss?: boolean;
}) {
  return (
    <View style={[styles.bdRow, highlight && styles.bdHl, final && (loss ? styles.bdFinalLoss : styles.bdFinal)]}>
      <Text style={[styles.bdL, muted && { color: theme.color.muted }, (bold || final) && { fontWeight: theme.font.bold }]}>{l}</Text>
      <Text style={[
        styles.bdR,
        neg && { color: theme.color.red },
        highlight && { color: theme.color.blue },
        final && { color: loss ? theme.color.red : theme.color.green, fontSize: 16 },
      ]}>{r}</Text>
    </View>
  );
}

function Benchmark({ margin, low, median, high }: { margin: number; low: number; median: number; high: number }) {
  const span = high - low || 1;
  const clamp = (v: number) => Math.max(0, Math.min(100, ((v - low) / span) * 100));
  const above = margin >= median;
  return (
    <View>
      <View style={styles.benchTop}>
        <Text style={styles.benchLabel}>Net margin %</Text>
        <Text style={[styles.benchFlag, { color: above ? theme.color.green : theme.color.red }]}>
          {above ? "↗ Above" : "↘ Below"} category median
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.med, { left: `${clamp(median)}%` }]} />
        <View style={[styles.you, { left: `${clamp(margin)}%` }]} />
      </View>
      <View style={styles.scale}>
        <Text style={styles.scaleTxt}>Low {low}%</Text>
        <Text style={[styles.scaleTxt, { fontWeight: theme.font.bold, color: theme.color.ink }]}>You {margin.toFixed(1)}%</Text>
        <Text style={styles.scaleTxt}>High {high}%</Text>
      </View>
      <Text style={styles.medNote}>Category median: {median}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  card: { backgroundColor: theme.color.card, borderWidth: 1, borderColor: theme.color.line, borderRadius: 14, padding: 18 },
  row: { flexDirection: "row" },
  gap: { height: 14 },

  stats: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 10 },
  stat: { flexGrow: 1, flexBasis: "47%", borderWidth: 1, borderColor: theme.color.line, borderRadius: 12, padding: 14, backgroundColor: "#fff" },
  statBlue: { backgroundColor: theme.color.blueSoft, borderColor: "#D5DEFC" },
  statGreen: { backgroundColor: theme.color.greenSoft, borderColor: theme.color.greenLine },
  statRed: { backgroundColor: theme.color.redSoft, borderColor: "#FBD5D5" },
  statK: { fontSize: 11, fontWeight: theme.font.bold, letterSpacing: 0.6, color: theme.color.faint, marginBottom: 6 },
  statV: { fontSize: 22, fontWeight: theme.font.bold },

  itcNote: { marginTop: 10, fontSize: 12.5, lineHeight: 18, color: theme.color.muted },

  warn: { marginTop: 14, backgroundColor: theme.color.orangeSoft, borderWidth: 1, borderColor: "#F7D9BE", borderRadius: 12, padding: 14 },
  warnTxt: { color: "#9A4B12", fontSize: 13, lineHeight: 19 },

  bdRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: theme.color.line },
  bdHl: { backgroundColor: theme.color.blueSoft },
  bdFinal: { backgroundColor: theme.color.greenSoft, borderBottomWidth: 0 },
  bdFinalLoss: { backgroundColor: theme.color.redSoft, borderBottomWidth: 0 },
  bdL: { fontSize: 14, color: theme.color.ink, flex: 1 },
  bdR: { fontSize: 14, fontWeight: theme.font.bold, color: theme.color.ink },

  h3: { fontSize: 16, fontWeight: theme.font.bold, color: theme.color.ink, marginBottom: 16 },
  bar: { flexDirection: "row", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 18, backgroundColor: "#EEF1F6" },
  legRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6.5 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  legNm: { flex: 1, fontSize: 13.5, color: theme.color.muted },
  legAmt: { fontSize: 13.5, fontWeight: theme.font.bold, color: theme.color.ink },
  legPct: { width: 52, textAlign: "right", fontSize: 12.5, color: theme.color.faint },

  benchTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  benchLabel: { fontSize: 14, fontWeight: theme.font.bold, color: theme.color.ink },
  benchFlag: { fontSize: 12.5, fontWeight: theme.font.semibold },
  track: { height: 6, borderRadius: 999, backgroundColor: "#E9F2EC", marginVertical: 10, position: "relative" },
  med: { position: "absolute", top: -4, width: 2, height: 14, backgroundColor: theme.color.ink, borderRadius: 2 },
  you: { position: "absolute", top: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: theme.color.blue, borderWidth: 2.5, borderColor: "#fff", marginLeft: -7 },
  scale: { flexDirection: "row", justifyContent: "space-between" },
  scaleTxt: { fontSize: 12, color: theme.color.faint },
  medNote: { fontSize: 12.5, color: theme.color.muted, marginTop: 10 },
});
