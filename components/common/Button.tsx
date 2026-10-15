import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Text } from "../ui/NativeText";
import { colors, radii, spacing, typography } from "../../constants/theme";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" || variant === "ghost" ? colors.emerald : colors.white} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, textVariantStyles[variant], icon ? { marginLeft: spacing.sm } : undefined]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = StyleSheet.create({
  primary: { backgroundColor: colors.emerald },
  secondary: { backgroundColor: colors.sageLight },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.emerald },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: "transparent" },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.emeraldDark },
  outline: { color: colors.emerald },
  danger: { color: colors.white },
  ghost: { color: colors.emerald },
});
