export const childColors = {
  canvas: "#F4FAF7",
  surface: "#FFFFFF",
  surfaceSubtle: "#EEF7F2",
  ink: "#10251D",
  text: "#263830",
  muted: "#74847D",
  line: "#D9E8E1",
  brand: "#18AD70",
  brandDeep: "#087B4E",
  brandSoft: "#DDF5E8",
  brandWash: "#EBF8F1",
  danger: "#E45A5A",
  dangerDeep: "#B83D3D",
  dangerSoft: "#FDEAEA",
  warning: "#B77519",
  warningSoft: "#FFF3DF",
  quiet: "#EDF2EF",
  white: "#FFFFFF",
  overlay: "rgba(8, 32, 23, 0.46)",
} as const;

export const childRadius = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 36,
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
    shadowColor: "#14372A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  lift: {
    shadowColor: "#14372A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
} as const;
