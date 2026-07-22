import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { theme } from "../theme";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowDecimal?: boolean;
  suffix?: string;
};

// Numbers only. Strips letters / e / +/- and extra decimals on every change,
// so paste and autofill are covered too.
function sanitize(raw: string, allowDecimal: boolean): string {
  let v = raw.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (allowDecimal) {
    const first = v.indexOf(".");
    if (first !== -1) v = v.slice(0, first + 1) + v.slice(first + 1).replace(/\./g, "");
  }
  return v;
}

export function NumericInput({ label, value, onChange, allowDecimal = false }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => onChange(sanitize(t, allowDecimal))}
        keyboardType={allowDecimal ? "decimal-pad" : "number-pad"}
        inputMode={allowDecimal ? "decimal" : "numeric"}
        placeholderTextColor={theme.color.faint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: {
    fontSize: 12.5,
    fontWeight: theme.font.semibold,
    color: theme.color.ink,
    marginBottom: 6,
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    fontSize: 15,
    color: theme.color.ink,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6DCE6",
    borderRadius: 10,
  },
});
