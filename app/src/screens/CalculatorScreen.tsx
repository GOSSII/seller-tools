import React from "react";
import { View, Text } from "react-native";
import { CALCULATOR_MAP } from "../registry";

// Looks up the calculator by route id and renders its Screen.
// This host never changes as calculators are added.
export default function CalculatorScreen({ route }: any) {
  const { id } = route.params;
  const manifest = CALCULATOR_MAP[id];
  if (!manifest) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Calculator not found.</Text>
      </View>
    );
  }
  const Screen = manifest.Screen;
  return <Screen />;
}
