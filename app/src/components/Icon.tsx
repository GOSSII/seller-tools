import React from "react";
import Svg, { Path, Circle, Rect, Polyline } from "react-native-svg";
import type { IconName } from "../calculators/types";
import { theme } from "../theme";

// Minimal line-icon set matching the reference card glyphs.
export function Icon({ name, size = 20, color = theme.color.blue }: {
  name: IconName; size?: number; color?: string;
}) {
  const p = { stroke: color, strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "calculator":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="5" y="3" width="14" height="18" rx="2" {...p} /><Path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15v4" {...p} /></Svg>;
    case "box":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" {...p} /></Svg>;
    case "target":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" {...p} /><Circle cx="12" cy="12" r="5" {...p} /><Circle cx="12" cy="12" r="1.5" {...p} /></Svg>;
    case "chart":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 20V10M10 20V4M16 20v-8M22 20H2" {...p} /></Svg>;
    case "trend":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="3,17 9,11 13,15 21,7" {...p} /><Polyline points="15,7 21,7 21,13" {...p} /></Svg>;
    case "clipboard":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="6" y="4" width="12" height="17" rx="2" {...p} /><Path d="M9 4V3h6v1" {...p} /></Svg>;
    case "clipboard-check":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="6" y="4" width="12" height="17" rx="2" {...p} /><Path d="M9 4V3h6v1M9 13l2 2 4-4" {...p} /></Svg>;
    case "external":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M14 5h5v5M19 5l-8 8M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" {...p} /></Svg>;
    case "image":
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="4" width="16" height="16" rx="2" {...p} /><Circle cx="9" cy="9" r="1.5" {...p} /><Path d="M4 16l4-4 3 3 4-4 5 5" {...p} /></Svg>;
    default:
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" {...p} /></Svg>;
  }
}
