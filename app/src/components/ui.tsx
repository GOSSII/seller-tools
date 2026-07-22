import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { theme } from "../theme";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Gap({ h = 14 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Spacer() {
  return <View style={{ width: 12 }} />;
}

type Tone = "blue" | "green" | "red" | "plain";

export function StatGrid({ items }: { items: { k: string; v: string; tone?: Tone }[] }) {
  return (
    <View style={styles.stats}>
      {items.map((s) => (
        <Stat key={s.k} k={s.k} v={s.v} tone={s.tone ?? "plain"} />
      ))}
    </View>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone: Tone }) {
  const bg =
    tone === "blue" ? styles.sBlue : tone === "green" ? styles.sGreen : tone === "red" ? styles.sRed : null;
  const color =
    tone === "blue" ? theme.color.blue : tone === "green" ? theme.color.green : tone === "red" ? theme.color.red : theme.color.ink;
  return (
    <View style={[styles.stat, bg]}>
      <Text style={styles.statK}>{k.toUpperCase()}</Text>
      <Text style={[styles.statV, { color }]}>{v}</Text>
    </View>
  );
}

export function ResultRow({ label, value, neg, muted, highlight, final, loss }: {
  label: string; value: string; neg?: boolean; muted?: boolean; highlight?: boolean; final?: boolean; loss?: boolean;
}) {
  return (
    <View style={[styles.rrow, highlight && styles.rHl, final && (loss ? styles.rFinalLoss : styles.rFinal)]}>
      <Text style={[styles.rL, muted && { color: theme.color.muted }, final && { fontWeight: theme.font.bold }]}>{label}</Text>
      <Text style={[
        styles.rR,
        neg && { color: theme.color.red },
        highlight && { color: theme.color.blue },
        final && { color: loss ? theme.color.red : theme.color.green, fontSize: 16 },
      ]}>{value}</Text>
    </View>
  );
}

export function InfoBanner({ text, tone = "warn" }: { text: string; tone?: "warn" | "info" | "good" }) {
  const map = {
    warn: { bg: theme.color.orangeSoft, border: "#F7D9BE", fg: "#9A4B12" },
    info: { bg: theme.color.blueSoft, border: "#D5DEFC", fg: theme.color.blueInk },
    good: { bg: theme.color.greenSoft, border: theme.color.greenLine, fg: "#166534" },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: map.bg, borderColor: map.border }]}>
      <Text style={[styles.bannerTxt, { color: map.fg }]}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h3}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  card: { backgroundColor: theme.color.card, borderWidth: 1, borderColor: theme.color.line, borderRadius: 14, padding: 18 },
  row: { flexDirection: "row" },

  stats: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 10 },
  stat: { flexGrow: 1, flexBasis: "47%", borderWidth: 1, borderColor: theme.color.line, borderRadius: 12, padding: 14, backgroundColor: "#fff" },
  sBlue: { backgroundColor: theme.color.blueSoft, borderColor: "#D5DEFC" },
  sGreen: { backgroundColor: theme.color.greenSoft, borderColor: theme.color.greenLine },
  sRed: { backgroundColor: theme.color.redSoft, borderColor: "#FBD5D5" },
  statK: { fontSize: 11, fontWeight: theme.font.bold, letterSpacing: 0.6, color: theme.color.faint, marginBottom: 6 },
  statV: { fontSize: 22, fontWeight: theme.font.bold },

  rrow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: theme.color.line },
  rHl: { backgroundColor: theme.color.blueSoft },
  rFinal: { backgroundColor: theme.color.greenSoft, borderBottomWidth: 0 },
  rFinalLoss: { backgroundColor: theme.color.redSoft, borderBottomWidth: 0 },
  rL: { fontSize: 14, color: theme.color.ink, flex: 1 },
  rR: { fontSize: 14, fontWeight: theme.font.bold, color: theme.color.ink },

  banner: { marginTop: 14, borderWidth: 1, borderRadius: 12, padding: 14 },
  bannerTxt: { fontSize: 13, lineHeight: 19 },

  h3: { fontSize: 16, fontWeight: theme.font.bold, color: theme.color.ink, marginBottom: 16 },
});
