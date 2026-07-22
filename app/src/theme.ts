// Central design tokens. Change here to re-skin the whole app.
export const theme = {
  color: {
    ink: "#0F1A2B",
    muted: "#5B6B82",
    faint: "#8B98AB",
    line: "#E6EAF1",
    bg: "#F5F7FB",
    card: "#FFFFFF",

    blue: "#2F5AF0",
    blueInk: "#1E3A5F",
    blueSoft: "#EEF2FF",

    green: "#16A34A",
    greenSoft: "#ECFDF3",
    greenLine: "#BBE8CC",

    red: "#E5484D",
    redSoft: "#FEF2F2",

    orange: "#F5872B",     // "Popular" / "Updated" badges
    orangeSoft: "#FFF3E9",
  },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  space: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  font: {
    // System stack keeps bundle small; swap for a custom face later.
    display: "800" as const,
    bold: "700" as const,
    semibold: "600" as const,
    regular: "400" as const,
  },
};

export type Theme = typeof theme;
