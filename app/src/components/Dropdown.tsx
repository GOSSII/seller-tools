import React, { useState } from "react";
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from "react-native";
import { theme } from "../theme";

type Item = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  items: Item[];
  onChange: (v: string) => void;
};

export function Dropdown({ label, value, items, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value);

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={styles.fieldTxt}>{selected?.label ?? "Select"}</Text>
        <Text style={styles.chev}>⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={items}
              keyExtractor={(i) => i.value}
              renderItem={({ item }) => {
                const on = item.value === value;
                return (
                  <Pressable
                    style={[styles.row, on && styles.rowOn]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.rowTxt, on && styles.rowTxtOn]}>{item.label}</Text>
                    {on ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: theme.font.semibold, color: theme.color.ink, marginBottom: 6 },
  field: {
    height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: "#D6DCE6",
    borderRadius: 10, backgroundColor: "#fff", flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
  },
  fieldTxt: { fontSize: 15, color: theme.color.ink },
  chev: { fontSize: 18, color: theme.color.muted, marginTop: -4 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,26,43,0.35)", justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: "#fff", borderRadius: 14, maxHeight: "70%", overflow: "hidden" },
  row: {
    paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1,
    borderBottomColor: theme.color.line, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
  },
  rowOn: { backgroundColor: theme.color.blueSoft },
  rowTxt: { fontSize: 15, color: theme.color.ink },
  rowTxtOn: { color: theme.color.blue, fontWeight: theme.font.semibold },
  check: { color: theme.color.blue, fontWeight: theme.font.bold },
});
