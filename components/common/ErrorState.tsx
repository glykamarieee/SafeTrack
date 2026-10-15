import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { Button } from "./Button";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette, themeTypography } from "../../theme/legacy";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong. Please try again.", onRetry }: ErrorStateProps) {
  const styles = useStyles();
  const colors = themePalette(useTheme().colors);

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} variant="outline" fullWidth={false} style={styles.action} /> : null}
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  const typography = themeTypography(colors);
  return StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.dangerLight,
    borderRadius: radii.lg,
  },
  message: {
    ...typography.body,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
});
