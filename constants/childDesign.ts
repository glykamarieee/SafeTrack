/**
 * Legacy child-phone tokens, now mapped onto the SafeTrack design system
 * (theme/tokens.ts, light palette). Deleted when nothing imports it.
 */
export const childColors = {
  canvas: "#F4F7F5",
  surface: "#FFFFFF",
  surfaceSubtle: "#EEF2EF",
  ink: "#0E1411",
  text: "#4B5550",
  muted: "#636D68",
  line: "#E3E9E5",
  brand: "#15803D",
  brandDeep: "#0F5C2E",
  brandSoft: "#E7F6EC",
  brandWash: "#EEF7F1",
  danger: "#B42318",
  dangerDeep: "#8F1C13",
  dangerSoft: "#FDECEA",
  warning: "#8A5A00",
  warningSoft: "#FFF6E2",
  quiet: "#EEF2EF",
  white: "#FFFFFF",
  overlay: "rgba(14, 20, 17, 0.45)",
} as const;

export const childRadius = {
  sm: 14,
  md: 20,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

export const childSpacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 40,
} as const;

export const childShadow = {
  soft: {
    shadowColor: "#0E1411",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  lift: {
    shadowColor: "#0E1411",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
} as const;
