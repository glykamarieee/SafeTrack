import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { usePressFeedback } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";
import { Text } from "./Text";

type Props = {
  title: string;
  description?: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  selected: boolean;
  onPress: () => void;
};

/** A selectable option card with an icon tile and a radio mark (single choice). */
export function ChoiceCard({ title, description, icon, selected, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const press = usePressFeedback();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${description ?? ""}`}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View style={[styles.card, selected && styles.selected, press.style]}>
        <View style={[styles.icon, selected && styles.iconSelected]}>
          <Ionicons name={icon} size={21} color={selected ? colors.onPrimary : colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text variant="label" weight="700">
            {title}
          </Text>
          {description ? <Text variant="caption">{description}</Text> : null}
        </View>
        <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md + 2,
      borderRadius: radius.sm + 2,
      borderWidth: 1.5,
      borderColor: c.rule,
      backgroundColor: c.surface,
    },
    selected: { borderColor: c.primary, backgroundColor: c.primaryTint },
    icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.primaryTint },
    iconSelected: { backgroundColor: c.primary },
    copy: { flex: 1, gap: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.ruleStrong, alignItems: "center", justifyContent: "center" },
    radioOn: { borderColor: c.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  }),
);
