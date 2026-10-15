import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useEntrance } from "../../theme/motion";
import { useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";
import { Text, type TextTone } from "./Text";

type Tone = "success" | "error" | "warning" | "info" | "forest";

type Props = {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  icon?: ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
};

const ICON: Record<Tone, ComponentProps<typeof Ionicons>["name"]> = {
  success: "checkmark-circle",
  error: "alert-circle",
  warning: "warning",
  info: "information-circle",
  forest: "information-circle",
};

/** An inline message box that fades in: success, error, warning, info or forest (dark). */
export function Notice({ tone = "info", title, children, icon, style }: Props) {
  const { colors } = useTheme();
  const entrance = useEntrance(0, 6);

  const look: Record<Tone, { bg: string; fg: string; text: TextTone }> = {
    success: { bg: colors.primaryTint, fg: colors.primary, text: "ink" },
    error: { bg: colors.dangerTint, fg: colors.danger, text: "ink" },
    warning: { bg: colors.warningTint, fg: colors.warning, text: "ink" },
    info: { bg: colors.infoTint, fg: colors.info, text: "ink" },
    forest: { bg: colors.forest, fg: colors.brand, text: "onForest" },
  };
  const { bg, fg, text } = look[tone];

  return (
    <Animated.View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      style={[styles.box, { backgroundColor: bg }, entrance, style]}
    >
      <Ionicons name={icon ?? ICON[tone]} size={20} color={fg} style={styles.icon} />
      <View style={styles.copy}>
        {title ? (
          <Text variant="label" tone={text} weight="700">
            {title}
          </Text>
        ) : null}
        {typeof children === "string" ? (
          <Text variant="label" tone={tone === "forest" ? "onForestMuted" : "ink2"} weight="500">
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.md + 2, borderRadius: radius.sm },
  icon: { marginTop: 1 },
  copy: { flex: 1, gap: 2 },
});
