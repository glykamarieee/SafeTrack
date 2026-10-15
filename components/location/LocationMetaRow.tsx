import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../constants/theme";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette, themeTypography } from "../../theme/legacy";

interface LocationMetaRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

export function LocationMetaRow({ icon, label, value }: LocationMetaRowProps) {
  const styles = useStyles();
  const colors = themePalette(useTheme().colors);

  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.emerald} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  const typography = themeTypography(colors);
  return StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  icon: {
    marginRight: spacing.sm,
  },
  label: {
    ...typography.caption,
    flex: 1,
  },
  value: {
    ...typography.bodyStrong,
    fontSize: 13,
  },
});
});
