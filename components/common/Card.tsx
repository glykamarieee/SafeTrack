import type { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../../constants/theme";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette } from "../../theme/legacy";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  const styles = useStyles();

  return <View style={[styles.card, style]}>{children}</View>;
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  return StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
});
});
