import { Platform } from "react-native";

/**
 * SafeTrack Administrator visual system — Light Editorial Safety Atlas.
 * Front-end tokens only. No routing, service, data, database, or backend logic lives here.
 */
export const adminColors = {
  background: "#F4F7F2",
  backgroundRaised: "#EEF4F0",
  surface: "#FFFFFF",
  surfaceRaised: "#F8FBF9",
  surfaceMuted: "#EDF5F1",
  surfaceStrong: "#E2EEE8",
  surfaceElevated: "#FFFFFF",
  ink: "#17343A",
  text: "#3C565C",
  muted: "#71858A",
  subtle: "#98A8A9",
  border: "#D9E5DF",
  borderStrong: "#C6D9D0",
  primary: "#167A5C",
  primaryDark: "#0F6048",
  primaryBright: "#20A47A",
  primarySoft: "#E3F3EC",
  blue: "#2E819A",
  blueSoft: "#E4F2F6",
  cyan: "#2E97AC",
  cyanSoft: "#E6F5F7",
  amber: "#B7792D",
  amberSoft: "#FAF0DD",
  danger: "#D65F66",
  dangerSoft: "#FCEBEC",
  violet: "#6E6AA8",
  violetSoft: "#EFEEF9",
  white: "#FFFFFF",
  black: "#0B171A",
  sidebar: "#EEF4EF",
  sidebarMuted: "#6F8580",
  sidebarBorder: "#D4E2DA",
  overlayOne: "rgba(32, 164, 122, 0.10)",
  overlayTwo: "rgba(46, 151, 172, 0.08)",
  overlayThree: "rgba(214, 95, 102, 0.07)",
  cream: "#FBF8F0",
  mint: "#DFF0E8",
  sky: "#E4F2F6",
  coral: "#F8E3E3",
  navy: "#17343A",
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
    web: { boxShadow: "0 10px 28px rgba(29, 62, 54, 0.07)" } as any,
    default: {
      shadowColor: "#24483D",
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
  }),
  lifted: Platform.select({
    web: { boxShadow: "0 20px 48px rgba(29, 62, 54, 0.10)" } as any,
    default: {
      shadowColor: "#1F4639",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.11,
      shadowRadius: 24,
      elevation: 5,
    },
  }),
  glow: Platform.select({
    web: { boxShadow: "0 0 0 1px rgba(22,122,92,0.03), 0 14px 34px rgba(26, 67, 55, 0.08)" } as any,
    default: {
      shadowColor: "#21483B",
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
