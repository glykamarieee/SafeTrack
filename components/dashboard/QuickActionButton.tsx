import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../constants/theme";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette, themeTypography } from "../../theme/legacy";

interface QuickActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

export function QuickActionButton({ icon, label, onPress }: QuickActionButtonProps) {
  const styles = useStyles();
  const colors = themePalette(useTheme().colors);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.emerald} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.gray} />
    </Pressable>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  const typography = themeTypography(colors);
  return StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.sageLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  label: {
    ...typography.bodyStrong,
    fontSize: 14,
    flex: 1,
  },
});
});
