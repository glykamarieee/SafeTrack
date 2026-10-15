import { Platform } from "react-native";

/**
 * SafeTrack design tokens: "calm cartography".
 *
 * One design system for the guardian, child phone, auth and admin surfaces.
 * Colours come in a light and a dark palette with the same keys, so a screen
 * styled from `useTheme().colors` works in both. Contrast ratios are listed in
 * docs/redesign-plan.md; every text pair passes WCAG AA.
 *
 * Red (`danger`) is reserved for SOS and destructive actions.
 */

export type ColorScheme = "light" | "dark";

export type Palette = {
  /** Page background: warm paper. */
  paper: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Wells, pressed rows, track backgrounds. */
  sunken: string;
  /** 1-px hairlines that replace drop shadows. */
  rule: string;
  /** Stronger hairline for focused inputs and selected chips. */
  ruleStrong: string;
  ink: string;
  ink2: string;
  muted: string;
  primary: string;
  /** Text and icons placed on `primary`. */
  onPrimary: string;
  primaryTint: string;
  danger: string;
  onDanger: string;
  dangerTint: string;
  /** Warning as text or icon. */
  warning: string;
  /** Warning as a fill (badges, the warning dot). */
  warningFill: string;
  onWarningFill: string;
  warningTint: string;
  safe: string;
  safeTint: string;
  info: string;
  infoTint: string;
  offline: string;
  /** Behind modals and sheets. */
  scrim: string;
  /** The faint contour-line motif. */
  contour: string;
};

export const lightPalette: Palette = {
  paper: "#F5F2EA",
  surface: "#FFFDF8",
  sunken: "#ECE7DC",
  rule: "#DED7C9",
  ruleStrong: "#C2B9A7",
  ink: "#1B2420",
  ink2: "#46504A",
  muted: "#666F69",
  primary: "#1E5C45",
  onPrimary: "#FFFFFF",
  primaryTint: "#E1ECE4",
  danger: "#B4301F",
  onDanger: "#FFFFFF",
  dangerTint: "#F8E3DD",
  warning: "#8A5A00",
  warningFill: "#F0B23C",
  onWarningFill: "#1B2420",
  warningTint: "#F7EAD0",
  safe: "#2B7A4B",
  safeTint: "#E1EFE5",
  info: "#245E9C",
  infoTint: "#E2EBF5",
  offline: "#636963",
  scrim: "rgba(27, 36, 32, 0.45)",
  contour: "rgba(30, 92, 69, 0.10)",
};

export const darkPalette: Palette = {
  paper: "#111513",
  surface: "#181D1A",
  sunken: "#0C0F0D",
  rule: "#2A322D",
  ruleStrong: "#3E4842",
  ink: "#EDEFE9",
  ink2: "#BCC3BC",
  muted: "#8E968F",
  primary: "#7CC79F",
  onPrimary: "#111513",
  primaryTint: "#1C2E25",
  danger: "#FF7A6B",
  onDanger: "#111513",
  dangerTint: "#3A1D19",
  warning: "#F2B94B",
  warningFill: "#F2B94B",
  onWarningFill: "#111513",
  warningTint: "#33280F",
  safe: "#6ACB93",
  safeTint: "#1A2E22",
  info: "#7DB2EA",
  infoTint: "#18263A",
  offline: "#9AA19B",
  scrim: "rgba(0, 0, 0, 0.6)",
  contour: "rgba(124, 199, 159, 0.08)",
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
      return palette.safe;
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
  /** Inputs, chips. */
  sm: 8,
  /** Cards, sheets, the map. */
  md: 14,
  pill: 999,
} as const;

export const hairline = 1;

/**
 * Fraunces is loaded in app/_layout.tsx. Until it loads (or if it fails) the
 * headings fall back to the platform serif, never to a missing font.
 */
export const fonts = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_500Medium_Italic",
  fallbackSerif: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" }) as string,
} as const;

export const type = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.4 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  heading: { fontSize: 19, lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, lineHeight: 18 },
  legend: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
} as const;

/** Times, distances, counts and battery line up in columns. */
export const tabular = { fontVariant: ["tabular-nums" as const] };

export const motion = {
  press: 120,
  enter: 200,
  enterRise: 8,
  stagger: 40,
  sheetIn: 280,
  sheetOut: 200,
  segment: 220,
  countUp: 400,
  check: 300,
  pressScale: 0.98,
} as const;

/** Only floating elements (map controls, sheets, the SOS band) get a shadow. */
export function floatingShadow(scheme: ColorScheme) {
  const opacity = scheme === "dark" ? 0.5 : 0.12;
  return Platform.select({
    web: { boxShadow: `0 8px 24px rgba(0, 0, 0, ${opacity})` } as object,
    default: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: opacity,
      shadowRadius: 16,
      elevation: 6,
    },
  }) as object;
}
