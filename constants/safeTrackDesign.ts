/**
 * Legacy shared tokens, now mapped onto the SafeTrack design system
 * (theme/tokens.ts, light palette). Deleted when nothing imports it.
 */
export const safeTrackColors = {
  background: "#F4F7F5",
  white: "#FFFFFF",
  surfaceMuted: "#EEF2EF",
  softMint: "#E7F6EC",
  primary: "#15803D",
  primaryDark: "#0F5C2E",
  primaryLight: "#22B35E",
  sage: "#8C948F",
  accent: "#CFE6D6",
  danger: "#B42318",
  dangerSoft: "#FDECEA",
  warning: "#F5B83D",
  warningSoft: "#FFF6E2",
  ink: "#0E1411",
  text: "#4B5550",
  muted: "#636D68",
  border: "#E3E9E5",
  overlay: "rgba(14, 20, 17, 0.45)",
} as const;

export const safeTrackRadius = {
  xs: 10,
  sm: 16,
  md: 22,
  lg: 30,
  pill: 999,
} as const;

export const safeTrackSpacing = {
  xxs: 6,
  xs: 10,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
  xxl: 42,
} as const;

export const safeTrackShadow = {
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
} as const;
