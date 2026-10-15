import type { Palette } from "./tokens";

/**
 * The older token sets (constants/guardianDesign, safeTrackDesign,
 * childDesign, adminDesign, theme) expressed in the current palette, so a
 * screen written against those names follows light and dark mode. Screens
 * get them through makeStyles((c) => { const colors = guardianPalette(c) … })
 * and useTheme(); new code uses the Palette directly.
 */

export function guardianPalette(c: Palette) {
  return {
    background: c.paper,
    backgroundAlt: c.sunken,
    white: c.surface,
    surface: c.surface,
    surfaceMuted: c.sunken,
    softMint: c.primaryTint,
    mintGlow: c.primaryTint,
    primary: c.primary,
    primaryDark: c.primary,
    primaryDeep: c.ink,
    primaryLight: c.brand,
    sage: c.offline,
    accent: c.primaryTint,
    accentBlue: c.info,
    accentViolet: c.info,
    accentAmber: c.warningFill,
    danger: c.danger,
    dangerDark: c.danger,
    dangerSoft: c.dangerTint,
    warning: c.warning,
    warningSoft: c.warningTint,
    ink: c.ink,
    text: c.ink2,
    muted: c.muted,
    mutedLight: c.offline,
    border: c.rule,
    borderStrong: c.ruleStrong,
    mapBlue: c.brand,
    overlay: c.scrim,
    glass: c.glass,
    glassDark: "rgba(13,42,30,0.92)",
    // Old screens put `white` text on the hero; `white` maps to the surface
    // colour, so the hero must stay the primary green in both modes.
    heroTop: c.primary,
    heroBottom: c.primary === "#3DDC84" ? c.brand : "#178A43",
    heroSoft: c.primaryTint,
    /** Text on primary-coloured fills (white in light, dark in dark mode). */
    onPrimary: c.onPrimary,
  };
}

export function safeTrackPalette(c: Palette) {
  return {
    background: c.paper,
    white: c.surface,
    surfaceMuted: c.sunken,
    softMint: c.primaryTint,
    primary: c.primary,
    primaryDark: c.primary,
    primaryLight: c.brand,
    sage: c.offline,
    accent: c.primaryTint,
    danger: c.danger,
    dangerSoft: c.dangerTint,
    warning: c.warningFill,
    warningSoft: c.warningTint,
    ink: c.ink,
    text: c.ink2,
    muted: c.muted,
    border: c.rule,
    overlay: c.scrim,
    onPrimary: c.onPrimary,
  };
}

export function childPalette(c: Palette) {
  return {
    canvas: c.paper,
    surface: c.surface,
    surfaceSubtle: c.sunken,
    ink: c.ink,
    text: c.ink2,
    muted: c.muted,
    line: c.rule,
    brand: c.primary,
    brandDeep: c.primary,
    brandSoft: c.primaryTint,
    brandWash: c.primaryTint,
    danger: c.danger,
    dangerDeep: c.danger,
    dangerSoft: c.dangerTint,
    warning: c.warning,
    warningSoft: c.warningTint,
    quiet: c.sunken,
    white: c.surface,
    overlay: c.scrim,
    onPrimary: c.onPrimary,
  };
}

export function themePalette(c: Palette) {
  return {
    sage: c.brand,
    sageLight: c.primaryTint,
    emerald: c.primary,
    emeraldDark: c.primary,
    white: c.surface,
    softGray: c.paper,
    gray: c.offline,
    border: c.rule,
    textPrimary: c.ink,
    textSecondary: c.ink2,
    textMuted: c.muted,
    danger: c.danger,
    dangerLight: c.dangerTint,
    warning: c.warning,
    warningLight: c.warningTint,
    success: c.primary,
    successLight: c.primaryTint,
    info: c.info,
    infoLight: c.infoTint,
    onPrimary: c.onPrimary,
  };
}

export function adminPalette(c: Palette) {
  const dark = c.primary === "#3DDC84";
  return {
    background: c.paper,
    backgroundRaised: c.sunken,
    surface: c.surface,
    surfaceRaised: c.surface,
    surfaceMuted: c.sunken,
    surfaceStrong: c.rule,
    surfaceElevated: c.surface,
    ink: c.ink,
    text: c.ink2,
    muted: c.muted,
    subtle: c.offline,
    border: c.rule,
    borderStrong: c.ruleStrong,
    primary: c.primary,
    primaryDark: c.primary,
    primaryBright: c.brand,
    primarySoft: c.primaryTint,
    blue: c.info,
    blueSoft: c.infoTint,
    cyan: c.info,
    cyanSoft: c.infoTint,
    amber: c.warning,
    amberSoft: c.warningTint,
    danger: c.danger,
    dangerSoft: c.dangerTint,
    violet: c.forest,
    violetSoft: c.primaryTint,
    white: c.surface,
    black: c.ink,
    sidebar: c.surface,
    sidebarMuted: c.muted,
    sidebarBorder: c.rule,
    overlayOne: dark ? "rgba(61, 220, 132, 0.06)" : "rgba(34, 179, 94, 0.10)",
    overlayTwo: dark ? "rgba(61, 220, 132, 0.04)" : "rgba(34, 179, 94, 0.06)",
    overlayThree: dark ? "rgba(255, 107, 92, 0.05)" : "rgba(180, 35, 24, 0.06)",
    cream: c.paper,
    mint: c.primaryTint,
    sky: c.infoTint,
    coral: c.dangerTint,
    navy: c.ink,
    onPrimary: c.onPrimary,
  };
}

/** constants/theme `typography`, with colours from the current palette. */
export function themeTypography(colors: ReturnType<typeof themePalette>) {
  return {
    display: { fontSize: 28, fontWeight: "800" as const, color: colors.textPrimary },
    title: { fontSize: 22, fontWeight: "800" as const, color: colors.textPrimary },
    subtitle: { fontSize: 17, fontWeight: "700" as const, color: colors.textPrimary },
    body: { fontSize: 15, fontWeight: "400" as const, color: colors.textSecondary },
    bodyStrong: { fontSize: 15, fontWeight: "600" as const, color: colors.textPrimary },
    caption: { fontSize: 13, fontWeight: "500" as const, color: colors.textMuted },
    label: { fontSize: 12, fontWeight: "700" as const, color: colors.textMuted, letterSpacing: 0.4 },
  };
}
