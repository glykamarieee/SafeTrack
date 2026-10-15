/**
 * Legacy tokens, now mapped onto the SafeTrack design system
 * (theme/tokens.ts, light palette). Deleted when nothing imports it.
 */
export const colors = {
  sage: "#22B35E",
  sageLight: "#E7F6EC",
  emerald: "#15803D",
  emeraldDark: "#0F5C2E",
  white: "#FFFFFF",
  softGray: "#F4F7F5",
  gray: "#8C948F",
  border: "#E3E9E5",
  textPrimary: "#0E1411",
  textSecondary: "#4B5550",
  textMuted: "#636D68",
  danger: "#B42318",
  dangerLight: "#FDECEA",
  warning: "#8A5A00",
  warningLight: "#FFF6E2",
  success: "#15803D",
  successLight: "#E7F6EC",
  info: "#245E9C",
  infoLight: "#E2EBF5",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const shadows = {
  soft: {
    shadowColor: "#0E1411",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    shadowColor: "#0E1411",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: "800" as const, color: colors.textPrimary },
  title: { fontSize: 22, fontWeight: "800" as const, color: colors.textPrimary },
  subtitle: { fontSize: 17, fontWeight: "700" as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.textSecondary },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, color: colors.textPrimary },
  caption: { fontSize: 13, fontWeight: "500" as const, color: colors.textMuted },
  label: { fontSize: 12, fontWeight: "700" as const, color: colors.textMuted, letterSpacing: 0.4 },
};
