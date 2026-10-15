import type { ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { usePressFeedback } from "../../theme/motion";
import { makeStyles } from "../../theme/ThemeProvider";
import { hairline, radius, shadow, space } from "../../theme/tokens";

type Props = {
  children: ReactNode;
  /**
   * card: white card with a soft shadow. flat: white, no shadow.
   * sunken: quiet grey well. tint: mint wash. forest: the strong dark card.
   */
  tone?: "card" | "flat" | "sunken" | "tint" | "forest";
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

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

const useStyles = makeStyles((c, scheme) =>
  StyleSheet.create({
    base: { borderRadius: radius.md },
    card: {
      backgroundColor: c.surface,
      // Dark mode separates cards with a rule; light mode with a soft shadow.
      ...(scheme === "dark" ? { borderWidth: hairline, borderColor: c.rule } : shadow(scheme)),
    },
    flat: { backgroundColor: c.surface, borderWidth: hairline, borderColor: c.rule },
    sunken: { backgroundColor: c.sunken },
    tint: { backgroundColor: c.primaryTint },
    forest: { backgroundColor: c.forest },
    padded: { padding: space.lg },
  }),
);
