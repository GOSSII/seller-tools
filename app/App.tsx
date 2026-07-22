import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "./src/screens/HomeScreen";
import CalculatorScreen from "./src/screens/CalculatorScreen";
import { CALCULATOR_MAP } from "./src/registry";
import { theme } from "./src/theme";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: theme.color.bg },
            headerTitleStyle: { color: theme.color.ink, fontWeight: "700" },
            headerTintColor: theme.color.blue,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.color.bg },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Munafa" }} />
          <Stack.Screen
            name="Calculator"
            component={CalculatorScreen}
            options={({ route }: any) => ({
              title: CALCULATOR_MAP[route.params?.id]?.name ?? "Calculator",
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
