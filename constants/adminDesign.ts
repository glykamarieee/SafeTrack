import { Platform } from "react-native";

/**
 * SafeTrack Administrator visual system — mapped onto the SafeTrack design system (theme/tokens.ts).
 * Front-end tokens only. No routing, service, data, database, or backend logic lives here.
 */
export const adminColors = {
  background: "#F4F7F5",
  backgroundRaised: "#EEF2EF",
  surface: "#FFFFFF",
  surfaceRaised: "#F8FAF9",
  surfaceMuted: "#EEF2EF",
  surfaceStrong: "#E3E9E5",
  surfaceElevated: "#FFFFFF",
  ink: "#0E1411",
  text: "#4B5550",
  muted: "#636D68",
  subtle: "#8C948F",
  border: "#E3E9E5",
  borderStrong: "#CFD8D2",
  primary: "#15803D",
  primaryDark: "#0F5C2E",
  primaryBright: "#22B35E",
  primarySoft: "#E7F6EC",
  blue: "#245E9C",
  blueSoft: "#E2EBF5",
  cyan: "#245E9C",
  cyanSoft: "#E2EBF5",
  amber: "#8A5A00",
  amberSoft: "#FFF6E2",
  danger: "#B42318",
  dangerSoft: "#FDECEA",
  violet: "#0D2A1E",
  violetSoft: "#E7F6EC",
  white: "#FFFFFF",
  black: "#0E1411",
  sidebar: "#FFFFFF",
  sidebarMuted: "#636D68",
  sidebarBorder: "#E3E9E5",
  overlayOne: "rgba(34, 179, 94, 0.10)",
  overlayTwo: "rgba(34, 179, 94, 0.06)",
  overlayThree: "rgba(180, 35, 24, 0.06)",
  cream: "#F4F7F5",
  mint: "#E7F6EC",
  sky: "#E2EBF5",
  coral: "#FDECEA",
  navy: "#0E1411",
};

export const adminSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const adminRadius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
};

export const adminShadow = {
  soft: Platform.select({
    web: { boxShadow: "0 10px 28px rgba(14, 20, 17, 0.07)" } as any,
    default: {
      shadowColor: "#0E1411",
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
  }),
  lifted: Platform.select({
    web: { boxShadow: "0 20px 48px rgba(14, 20, 17, 0.10)" } as any,
    default: {
      shadowColor: "#0E1411",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.11,
      shadowRadius: 24,
      elevation: 5,
    },
  }),
  glow: Platform.select({
    web: { boxShadow: "0 0 0 1px rgba(21,128,61,0.03), 0 14px 34px rgba(14, 20, 17, 0.07)" } as any,
    default: {
      shadowColor: "#0E1411",
      shadowOffset: { width: 0, height: 9 },
      shadowOpacity: 0.09,
      shadowRadius: 20,
      elevation: 4,
    },
  }),
};

export const adminLayout = {
  pageMax: 1400,
  readingMax: 920,
  sidebarBreakpoint: 960,
};
