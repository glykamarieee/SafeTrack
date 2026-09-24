import { Platform } from "react-native";

export const adminColors = {
  background: "#F5F7F6",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF2F0",
  surfaceStrong: "#E6ECE9",
  ink: "#14231C",
  text: "#314139",
  muted: "#748078",
  subtle: "#99A39E",
  border: "#DCE4E0",
  borderStrong: "#C9D5CF",
  primary: "#176B4D",
  primaryDark: "#0F5139",
  primaryBright: "#1FA675",
  primarySoft: "#E4F3EC",
  blue: "#356FA9",
  blueSoft: "#E8F0F8",
  amber: "#B9791E",
  amberSoft: "#FAF0DC",
  danger: "#B94452",
  dangerSoft: "#FBECEE",
  violet: "#665FA6",
  violetSoft: "#EFEDF8",
  white: "#FFFFFF",
  black: "#0E1713",
};

export const adminSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const adminRadius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const adminShadow = {
  soft: Platform.select({
    web: { boxShadow: "0 8px 24px rgba(22, 52, 39, 0.06)" } as any,
    default: {
      shadowColor: "#143326",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 2,
    },
  }),
  lifted: Platform.select({
    web: { boxShadow: "0 14px 36px rgba(18, 44, 32, 0.10)" } as any,
    default: {
      shadowColor: "#10291E",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.11,
      shadowRadius: 20,
      elevation: 4,
    },
  }),
};

export const adminLayout = {
  pageMax: 1240,
  readingMax: 860,
  sidebarBreakpoint: 900,
};
