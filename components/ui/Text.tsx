import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { useFontsReady } from "../../theme/fonts";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts, tabular as tabularStyle, type, type Palette } from "../../theme/tokens";

export type TextVariant = keyof typeof type;
export type TextTone = "ink" | "ink2" | "muted" | "primary" | "danger" | "warning" | "safe" | "info" | "onPrimary" | "onDanger";

const SERIF: TextVariant[] = ["display", "title", "heading"];

const WEIGHT: Record<TextVariant, TextStyle["fontWeight"]> = {
  display: "600",
  title: "600",
  heading: "600",
  body: "400",
  label: "500",
  legend: "600",
};

const DEFAULT_TONE: Record<TextVariant, TextTone> = {
  display: "ink",
  title: "ink",
  heading: "ink",
  body: "ink2",
  label: "ink2",
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
 * The only text component new screens need. Headings use Fraunces; body,
 * labels and legends use the system font. Legends are uppercase map-legend
 * labels ("INSIDE · HOME · 2 MIN AGO").
 */
export function Text({
  variant = "body",
  tone,
  tabular,
  weight,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const fontsReady = useFontsReady();
  const serif = SERIF.includes(variant);

  return (
    <RNText
      {...rest}
      // Headings stay readable at large system font sizes, but don't grow
      // without limit inside fixed layouts.
      maxFontSizeMultiplier={rest.maxFontSizeMultiplier ?? (serif ? 1.4 : 1.8)}
      style={[
        type[variant],
        {
          color: toneColor(colors, tone ?? DEFAULT_TONE[variant]),
          fontWeight: serif && fontsReady ? undefined : weight ?? WEIGHT[variant],
        },
        serif && { fontFamily: fontsReady ? fonts.display : fonts.fallbackSerif },
        variant === "legend" && { textTransform: "uppercase" },
        tabular && tabularStyle,
        align && { textAlign: align },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
