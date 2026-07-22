import type { ComponentType } from "react";

// Every calculator is a self-contained module that exports one of these.
// The home grid and router are generated from the registry of manifests,
// so adding a calculator = drop a folder + register one line.
export type CalculatorManifest = {
  id: string;                 // route id, unique
  name: string;               // card + screen title
  description: string;        // card subtitle
  icon: IconName;             // maps to an icon in components/Icon
  badge?: "Popular" | "Updated" | "New";
  group: CalculatorGroup;     // for future filtering/sections
  Screen: ComponentType;      // the calculator UI
};

export type CalculatorGroup =
  | "profitability"
  | "advertising"
  | "fulfillment"
  | "listing"
  | "research";

export type IconName =
  | "calculator"
  | "box"
  | "target"
  | "chart"
  | "trend"
  | "clipboard"
  | "clipboard-check"
  | "external"
  | "image";
