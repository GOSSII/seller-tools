import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { theme } from "../theme";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label?: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <View style={{ flex: 1 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.track}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[styles.seg, on && styles.segOn]}
            >
              <Text style={[styles.txt, on && styles.txtOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12.5,
    fontWeight: theme.font.semibold,
    color: theme.color.ink,
    marginBottom: 6,
  },
  track: {
    flexDirection: "row",
    backgroundColor: "#F1F4F9",
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    padding: 3,
    height: 44,
  },
  seg: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  segOn: {
    backgroundColor: "#fff",
    shadowColor: theme.color.ink,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  txt: { fontSize: 13, fontWeight: theme.font.semibold, color: theme.color.muted },
  txtOn: { color: theme.color.ink },
});
