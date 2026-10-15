import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { usePressFeedback } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space, type Palette } from "../../theme/tokens";
import { Text, type TextTone } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "md" | "lg";
  icon?: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const TONE: Record<ButtonVariant, TextTone> = {
  primary: "onPrimary",
  secondary: "ink",
  ghost: "primary",
  danger: "onDanger",
};

function fill(colors: Palette, variant: ButtonVariant) {
  switch (variant) {
    case "primary":
      return { backgroundColor: colors.primary, borderColor: colors.primary };
    case "danger":
      return { backgroundColor: colors.danger, borderColor: colors.danger };
    case "secondary":
      return { backgroundColor: colors.surface, borderColor: colors.ruleStrong };
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
  loading,
  disabled,
  block,
  accessibilityHint,
  testID,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const press = usePressFeedback();
  const inactive = disabled || loading;
  const tone = TONE[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      testID={testID}
      style={[block && styles.block, style]}
    >
      <Animated.View
        style={[
          styles.base,
          size === "lg" && styles.large,
          fill(colors, variant),
          inactive && styles.inactive,
          press.style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors[tone]} size="small" />
        ) : (
          <View style={styles.row}>
            {icon ? <Ionicons name={icon} size={18} color={colors[tone]} /> : null}
            <Text variant="body" tone={tone} weight="600" numberOfLines={1}>
              {label}
            </Text>
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
      minHeight: 48,
      paddingHorizontal: space.xl,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    large: { minHeight: 56 },
    row: { flexDirection: "row", alignItems: "center", gap: space.sm },
    inactive: { opacity: 0.5 },
  }),
);
