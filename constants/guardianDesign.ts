/**
 * Guardian-only presentation tokens.
 *
 * These tokens intentionally live outside safeTrackDesign.ts so the Guardian
 * redesign does not alter Authentication, Child, or Administrator surfaces.
 */
export const guardianColors = {
  background: "#F4F8F5",
  backgroundAlt: "#EAF3EE",
  white: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF7F2",
  softMint: "#DCF4E6",
  mintGlow: "#C7EFD8",
  primary: "#1BAE72",
  primaryDark: "#0A764F",
  primaryDeep: "#0D4736",
  primaryLight: "#68D49D",
  sage: "#86A996",
  accent: "#BFE8CF",
  accentBlue: "#4E86EA",
  accentViolet: "#766AE8",
  accentAmber: "#F1B54A",
  danger: "#E15D66",
  dangerDark: "#B63D49",
  dangerSoft: "#FDEBED",
  warning: "#E7A433",
  warningSoft: "#FFF2D7",
  ink: "#10231B",
  text: "#2B3A33",
  muted: "#718078",
  mutedLight: "#9AA79F",
  border: "#DCE8E1",
  borderStrong: "#C8D9D0",
  mapBlue: "#2F7FEA",
  overlay: "rgba(8, 31, 23, 0.52)",
  glass: "rgba(255,255,255,0.93)",
  glassDark: "rgba(13,71,54,0.90)",
  heroTop: "#0E4B39",
  heroBottom: "#157E58",
  heroSoft: "#E2F5EA",
} as const;

export const guardianRadius = {
  xs: 10,
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

export const guardianSpacing = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const guardianShadow = {
  card: {
    shadowColor: "#123D2D",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 5,
  },
  soft: {
    shadowColor: "#123D2D",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  floating: {
    shadowColor: "#0B2A1F",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;
