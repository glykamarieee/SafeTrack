export const safeTrackColors = {
  background: "#F4FBF8",
  white: "#FFFFFF",
  surfaceMuted: "#EAF8F0",
  softMint: "#DFF5E8",
  primary: "#1EA96B",
  primaryDark: "#128754",
  primaryLight: "#5BCB91",
  sage: "#70A982",
  accent: "#A7DDBB",
  danger: "#E25E5E",
  dangerSoft: "#FDE8E8",
  warning: "#F4B63F",
  warningSoft: "#FFF5D9",
  ink: "#10201A",
  text: "#22322C",
  muted: "#71807A",
  border: "#DCE9E3",
  overlay: "rgba(10, 30, 20, 0.48)",
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
    shadowColor: "#17392A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  soft: {
    shadowColor: "#17392A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
} as const;
