import type { ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { usePressFeedback } from "../../theme/motion";
import { makeStyles } from "../../theme/ThemeProvider";
import { hairline, radius, space } from "../../theme/tokens";

type Props = {
  children: ReactNode;
  /** "card" sits on paper with a hairline; "sunken" is a quiet well. */
  tone?: "card" | "sunken" | "tint";
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** A card drawn with an ink-thin rule instead of a drop shadow. */
export function Surface({ children, tone = "card", padded = true, onPress, accessibilityLabel, accessibilityHint, style }: Props) {
  const styles = useStyles();
  const press = usePressFeedback();
  const body = [styles.base, styles[tone], padded && styles.padded, style];

  if (!onPress) return <View style={body}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View style={[body, press.style]}>{children}</Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    base: { borderRadius: radius.md, overflow: "hidden" },
    card: { backgroundColor: c.surface, borderWidth: hairline, borderColor: c.rule },
    sunken: { backgroundColor: c.sunken },
    tint: { backgroundColor: c.primaryTint },
    padded: { padding: space.lg },
  }),
);
