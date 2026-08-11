import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { safeTrackColors as colors, safeTrackRadius as radius, safeTrackShadow as shadow } from "../../constants/safeTrackDesign";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  trailing?: boolean;
  variant?: "primary" | "outline" | "danger";
  style?: ViewStyle;
  children?: ReactNode;
};

export function SafeTrackButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  trailing = false,
  variant = "primary",
  style,
}: Props) {
  const blocked = loading || disabled;
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";
  const backgroundColor = isOutline ? colors.white : isDanger ? colors.danger : colors.primary;
  const textColor = isOutline ? colors.primaryDark : colors.white;

  return (
    <Pressable
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, borderColor: isOutline ? colors.primary : backgroundColor },
        style,
        blocked && styles.disabled,
        pressed && !blocked && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : null}
      {!loading && icon && !trailing ? <Ionicons name={icon} size={19} color={textColor} style={styles.leading} /> : null}
      {!loading ? <Text style={[styles.label, { color: textColor }]}>{label}</Text> : null}
      {!loading && icon && trailing ? <Ionicons name={icon} size={19} color={textColor} style={styles.trailing} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    ...shadow.soft,
  },
  label: { fontSize: 15.5, fontWeight: "900" },
  leading: { marginRight: 8 },
  trailing: { marginLeft: 10 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});
