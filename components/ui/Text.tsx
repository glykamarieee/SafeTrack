import type { TextProps as RNTextProps, TextStyle } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";
import { tabular as tabularStyle, type, type Palette } from "../../theme/tokens";
import { Text as FontText } from "./NativeText";

export type TextVariant = keyof typeof type;
export type TextTone =
  | "ink"
  | "ink2"
  | "muted"
  | "primary"
  | "danger"
  | "warning"
  | "safe"
  | "info"
  | "onPrimary"
  | "onDanger"
  | "onForest"
  | "onForestMuted";

const WEIGHT: Record<TextVariant, TextStyle["fontWeight"]> = {
  display: "800",
  title: "800",
  heading: "700",
  body: "400",
  label: "600",
  caption: "500",
  legend: "700",
};

const DEFAULT_TONE: Record<TextVariant, TextTone> = {
  display: "ink",
  title: "ink",
  heading: "ink",
  body: "ink2",
  label: "ink",
  caption: "muted",
  legend: "muted",
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Use for times, distances, counts and battery. */
  tabular?: boolean;
  weight?: TextStyle["fontWeight"];
  align?: TextStyle["textAlign"];
};

export function toneColor(colors: Palette, tone: TextTone) {
  return colors[tone];
}

/**
 * Text with a variant from the type scale. Legends are small uppercase
 * labels above values ("DISTANCE", "SAFE ZONES").
 */
export function Text({ variant = "body", tone, tabular, weight, align, style, children, ...rest }: TextProps) {
  const { colors } = useTheme();
  const heading = variant === "display" || variant === "title" || variant === "heading";

  return (
    <FontText
      {...rest}
      maxFontSizeMultiplier={rest.maxFontSizeMultiplier ?? (heading ? 1.4 : 1.8)}
      style={[
        type[variant],
        { color: toneColor(colors, tone ?? DEFAULT_TONE[variant]), fontWeight: weight ?? WEIGHT[variant] },
        variant === "legend" && { textTransform: "uppercase" },
        tabular && tabularStyle,
        align && { textAlign: align },
        style,
      ]}
    >
      {children}
    </FontText>
  );
}
