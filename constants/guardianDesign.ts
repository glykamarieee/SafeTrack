/**
 * Legacy guardian tokens, now mapped onto the SafeTrack design system
 * (theme/tokens.ts, light palette). Screens move to `useTheme()` as they are
 * restyled; this file is deleted when nothing imports it.
 */
export const guardianColors = {
  background: "#F4F7F5",
  backgroundAlt: "#EEF2EF",
  white: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF2EF",
  softMint: "#E7F6EC",
  mintGlow: "#CFE6D6",
  primary: "#15803D",
  primaryDark: "#0F5C2E",
  primaryDeep: "#0D2A1E",
  primaryLight: "#22B35E",
  sage: "#8C948F",
  accent: "#CFE6D6",
  accentBlue: "#245E9C",
  accentViolet: "#245E9C",
  accentAmber: "#F5B83D",
  danger: "#B42318",
  dangerDark: "#8F1C13",
  dangerSoft: "#FDECEA",
  warning: "#C98A0B",
  warningSoft: "#FFF6E2",
  ink: "#0E1411",
  text: "#4B5550",
  muted: "#636D68",
  mutedLight: "#8C948F",
  border: "#E3E9E5",
  borderStrong: "#CFD8D2",
  mapBlue: "#22B35E",
  overlay: "rgba(14, 20, 17, 0.45)",
  glass: "rgba(255,255,255,0.9)",
  glassDark: "rgba(13,42,30,0.92)",
  heroTop: "#15803D",
  heroBottom: "#178A43",
  heroSoft: "#E7F6EC",
} as const;

export const guardianRadius = {
  xs: 10,
  sm: 14,
  md: 20,
  lg: 24,
  xl: 30,
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
    shadowColor: "#0E1411",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  soft: {
    shadowColor: "#0E1411",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  floating: {
    shadowColor: "#0E1411",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
