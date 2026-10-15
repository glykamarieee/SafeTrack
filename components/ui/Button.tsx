import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { usePressFeedback } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space, type Palette } from "../../theme/tokens";
import { Text, type TextTone } from "./Text";

/**
 * primary: green, the main action. forest: the one strong dark action.
 * secondary: green outline. soft: mint wash. danger: SOS and destructive.
 * ghost: text only.
 */
export type ButtonVariant = "primary" | "forest" | "secondary" | "soft" | "ghost" | "danger";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: ComponentProps<typeof Ionicons>["name"];
  iconRight?: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const TONE: Record<ButtonVariant, TextTone> = {
  primary: "onPrimary",
  forest: "onForest",
  secondary: "primary",
  soft: "primary",
  ghost: "primary",
  danger: "onDanger",
};

function fill(colors: Palette, variant: ButtonVariant) {
  switch (variant) {
    case "primary":
      return { backgroundColor: colors.primary, borderColor: colors.primary };
    case "forest":
      return { backgroundColor: colors.forest, borderColor: colors.forest };
    case "danger":
      return { backgroundColor: colors.danger, borderColor: colors.danger };
    case "secondary":
      return { backgroundColor: colors.surface, borderColor: colors.primary };
    case "soft":
      return { backgroundColor: colors.primaryTint, borderColor: colors.primaryTint };
    default:
      return { backgroundColor: "transparent", borderColor: "transparent" };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  disabled,
  block,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const press = usePressFeedback();
  const inactive = disabled || loading;
  const tone = TONE[variant];
  const iconSize = size === "sm" ? 16 : 19;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      testID={testID}
      style={[block && styles.block, style]}
    >
      <Animated.View style={[styles.base, styles[size], fill(colors, variant), inactive && styles.inactive, press.style]}>
        {loading ? (
          <ActivityIndicator color={colors[tone]} size="small" />
        ) : (
          <View style={styles.row}>
            {icon ? <Ionicons name={icon} size={iconSize} color={colors[tone]} /> : null}
            <Text variant={size === "sm" ? "label" : "body"} tone={tone} weight="700" numberOfLines={1}>
              {label}
            </Text>
            {iconRight ? <Ionicons name={iconRight} size={iconSize} color={colors[tone]} /> : null}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    block: { alignSelf: "stretch" },
    base: {
      paddingHorizontal: space.xl,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    sm: { minHeight: 40, paddingHorizontal: space.lg },
    md: { minHeight: 52 },
    lg: { minHeight: 58 },
    row: { flexDirection: "row", alignItems: "center", gap: space.sm },
    inactive: { opacity: 0.5 },
  }),
);
