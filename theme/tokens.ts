import { Platform } from "react-native";

/**
 * SafeTrack design tokens: green, white and a little forest night.
 *
 * One design system for the guardian, child phone, auth and admin surfaces
 * (the approved board: https://claude.ai/artifact/4h3Bh1nUEePYVT4YEnLQCE).
 * Light and dark palettes share the same keys, so a screen styled from
 * `useTheme().colors` works in both. Every text pair passes WCAG AA.
 *
 * - `brand` (#22B35E) is for things that are live or safe: routes, rings,
 *   dots, chart bars. Never text on white, never under white text.
 * - `primary` is for buttons and green text.
 * - `forest` is the "black": a deep green from the same family, at most once
 *   per screen for the strongest card or button.
 * - `danger` (red) is reserved for SOS and destructive actions.
 */

export type ColorScheme = "light" | "dark";

export type Palette = {
  /** Page background. */
  paper: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Wells, pressed rows, track backgrounds, input fills. */
  sunken: string;
  /** Hairlines and dividers. */
  rule: string;
  /** Input borders, selected outlines. */
  ruleStrong: string;
  ink: string;
  ink2: string;
  muted: string;
  /** Buttons and green text. */
  primary: string;
  onPrimary: string;
  /** Mint wash behind green icons and selected chips. */
  primaryTint: string;
  /** Bright green for routes, rings, dots and bars (not text). */
  brand: string;
  /** The strongest card per screen. */
  forest: string;
  forestRaised: string;
  onForest: string;
  onForestMuted: string;
  danger: string;
  onDanger: string;
  dangerTint: string;
  /** Warning as text or icon. */
  warning: string;
  /** Warning as a fill (badges, the warning ring). */
  warningFill: string;
  onWarningFill: string;
  warningTint: string;
  safe: string;
  safeTint: string;
  info: string;
  infoTint: string;
  /** Offline ring / icon colour. */
  offline: string;
  offlineTint: string;
  /** Behind modals and sheets. */
  scrim: string;
  /** Glass bars floating over the map. */
  glass: string;
  glassBorder: string;
  /** Map placeholder ground. */
  mapGround: string;
};

export const lightPalette: Palette = {
  paper: "#F4F7F5",
  surface: "#FFFFFF",
  sunken: "#EEF2EF",
  rule: "#E3E9E5",
  ruleStrong: "#CFD8D2",
  ink: "#0E1411",
  ink2: "#4B5550",
  muted: "#636D68",
  primary: "#15803D",
  onPrimary: "#FFFFFF",
  primaryTint: "#E7F6EC",
  brand: "#22B35E",
  forest: "#0D2A1E",
  forestRaised: "#163D2B",
  onForest: "#FFFFFF",
  onForestMuted: "#9FC3AE",
  danger: "#B42318",
  onDanger: "#FFFFFF",
  dangerTint: "#FDECEA",
  warning: "#8A5A00",
  warningFill: "#F5B83D",
  onWarningFill: "#0E1411",
  warningTint: "#FFF6E2",
  safe: "#15803D",
  safeTint: "#E7F6EC",
  info: "#245E9C",
  infoTint: "#E2EBF5",
  offline: "#8C948F",
  offlineTint: "#EEF1EF",
  scrim: "rgba(14, 20, 17, 0.45)",
  glass: "rgba(255, 255, 255, 0.86)",
  glassBorder: "rgba(255, 255, 255, 0.95)",
  mapGround: "#E9EDEB",
};

export const darkPalette: Palette = {
  paper: "#0A120E",
  surface: "#12201A",
  sunken: "#0E1A14",
  rule: "#1E3329",
  ruleStrong: "#2C4A3B",
  ink: "#EEF2EF",
  ink2: "#BFD0C6",
  muted: "#97A89E",
  primary: "#3DDC84",
  onPrimary: "#0A120E",
  primaryTint: "#163D2B",
  brand: "#3DDC84",
  forest: "#183027",
  forestRaised: "#1F3D31",
  onForest: "#FFFFFF",
  onForestMuted: "#9FC3AE",
  danger: "#FF6B5C",
  onDanger: "#0A120E",
  dangerTint: "#3A1512",
  warning: "#F2B94B",
  warningFill: "#F2B94B",
  onWarningFill: "#0A120E",
  warningTint: "#33280F",
  safe: "#3DDC84",
  safeTint: "#163D2B",
  info: "#7DB2EA",
  infoTint: "#18263A",
  offline: "#97A89E",
  offlineTint: "#1A2A22",
  scrim: "rgba(0, 0, 0, 0.6)",
  glass: "rgba(18, 32, 26, 0.88)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  mapGround: "#0E1A14",
};

export const palettes: Record<ColorScheme, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};

/** Child status, shared by the avatar ring and the map marker. */
export type ChildState = "inside" | "outside" | "offline" | "sos" | "unknown";

export function stateColor(palette: Palette, state: ChildState): string {
  switch (state) {
    case "inside":
      return palette.brand;
    case "outside":
      return palette.warningFill;
    case "sos":
      return palette.danger;
    case "offline":
      return palette.offline;
    default:
      return palette.ruleStrong;
  }
}

export function stateTint(palette: Palette, state: ChildState): string {
  switch (state) {
    case "inside":
      return palette.primaryTint;
    case "outside":
      return palette.warningTint;
    case "sos":
      return palette.dangerTint;
    case "offline":
      return palette.offlineTint;
    default:
      return palette.sunken;
  }
}

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** Minimum horizontal page gutter on a phone. */
  gutter: 16,
} as const;

export const radius = {
  /** Small chips, tags. */
  xs: 10,
  /** Inputs, icon tiles. */
  sm: 16,
  /** Cards. */
  md: 22,
  /** Sheets, hero cards. */
  lg: 30,
  pill: 999,
} as const;

export const hairline = 1;

/**
 * Plus Jakarta Sans, loaded in app/_layout.tsx. Custom fonts on Android pick
 * the file by family name, not by fontWeight, so each weight is its own family.
 * Until the font loads (or if it fails) the system font is used.
 */
export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

export type FontWeightName = keyof typeof fontFamily;

export const type = {
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  legend: { fontSize: 10.5, lineHeight: 14, letterSpacing: 0.9 },
} as const;

/** Times, distances, counts and battery line up in columns. */
export const tabular = { fontVariant: ["tabular-nums" as const] };

export const motion = {
  press: 120,
  enter: 260,
  enterRise: 14,
  stagger: 60,
  sheetIn: 320,
  sheetOut: 200,
  segment: 220,
  countUp: 500,
  check: 300,
  pressScale: 0.97,
} as const;

/** Soft shadow for raised cards and floating map controls. */
export function shadow(scheme: ColorScheme, level: "card" | "float" = "card") {
  const strong = level === "float";
  const opacity = scheme === "dark" ? (strong ? 0.5 : 0.3) : strong ? 0.14 : 0.07;
  return Platform.select({
    web: { boxShadow: `0 ${strong ? 14 : 8}px ${strong ? 34 : 22}px rgba(14, 20, 17, ${opacity})` } as object,
    default: {
      shadowColor: "#0E1411",
      shadowOffset: { width: 0, height: strong ? 12 : 6 },
      shadowOpacity: opacity,
      shadowRadius: strong ? 24 : 14,
      elevation: strong ? 8 : 3,
    },
  }) as object;
}

/** @deprecated use shadow(scheme, "float") */
export const floatingShadow = (scheme: ColorScheme) => shadow(scheme, "float");
