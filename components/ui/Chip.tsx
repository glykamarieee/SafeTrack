import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

import { usePressFeedback } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";
import { Text } from "./Text";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** Small count after the label, e.g. "SOS (2)". */
  count?: number;
  accessibilityLabel?: string;
};

/** A pill choice: outlined when off, solid green when selected. */
export function Chip({ label, selected, onPress, icon, count, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const press = usePressFeedback();
  const text = count === undefined ? label : `${label} (${count})`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityLabel={accessibilityLabel ?? text}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={4}
    >
      <Animated.View style={[styles.chip, selected && styles.selected, press.style]}>
        {icon ? <Ionicons name={icon} size={15} color={selected ? colors.onPrimary : colors.primary} /> : null}
        <Text variant="label" tone={selected ? "onPrimary" : "ink2"} weight={selected ? "700" : "600"}>
          {text}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    chip: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: space.lg,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.rule,
      backgroundColor: c.surface,
    },
    selected: { backgroundColor: c.primary, borderColor: c.primary },
  }),
);
