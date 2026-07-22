import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { theme } from "../theme";
import { Icon } from "../components/Icon";
import { CALCULATORS } from "../registry";
import type { CalculatorManifest } from "../calculators/types";

export default function HomeScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const cols = width >= 1000 ? 3 : width >= 640 ? 2 : 1;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>Seller Tools</Text>
      <Text style={styles.subtitle}>Free calculators for Indian marketplace sellers · Updated 2026</Text>

      <View style={styles.grid}>
        {CALCULATORS.map((c) => (
          <View key={c.id} style={{ width: `${100 / cols}%`, padding: 6 }}>
            <CalcCard manifest={c} onPress={() => navigation.navigate("Calculator", { id: c.id })} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function CalcCard({ manifest, onPress }: { manifest: CalculatorManifest; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <Icon name={manifest.icon} />
        </View>
        {manifest.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{manifest.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle}>{manifest.name}</Text>
      <Text style={styles.cardDesc}>{manifest.description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  title: { fontSize: 26, fontWeight: theme.font.display, color: theme.color.ink, letterSpacing: -0.5, marginTop: 4 },
  subtitle: { fontSize: 13.5, color: theme.color.muted, marginTop: 6, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: { backgroundColor: theme.color.card, borderWidth: 1, borderColor: theme.color.line, borderRadius: 16, padding: 20, minHeight: 150 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.color.blueSoft, alignItems: "center", justifyContent: "center" },
  badge: { backgroundColor: theme.color.orange, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt: { color: "#fff", fontSize: 11, fontWeight: theme.font.bold },
  cardTitle: { fontSize: 17, fontWeight: theme.font.bold, color: theme.color.ink, marginBottom: 6 },
  cardDesc: { fontSize: 13.5, color: theme.color.muted, lineHeight: 19 },
});
