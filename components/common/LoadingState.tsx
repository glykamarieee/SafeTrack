import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { colors, spacing, typography } from "../../constants/theme";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette, themeTypography } from "../../theme/legacy";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  const styles = useStyles();
  const colors = themePalette(useTheme().colors);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.emerald} />
      <Text style={styles.message}>{message}</Text>
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
    paddingVertical: spacing.xl,
  },
  message: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
});
});
