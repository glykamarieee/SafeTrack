import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../constants/theme";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette, themeTypography } from "../../theme/legacy";

interface OfflineBannerProps {
  cachedAt?: string | null;
}

function formatCachedAt(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OfflineBanner({ cachedAt }: OfflineBannerProps) {
  const styles = useStyles();
  const colors = themePalette(useTheme().colors);

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text style={styles.message}>
        You're offline — showing saved data{cachedAt ? ` from ${formatCachedAt(cachedAt)}` : ""}.
      </Text>
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  const typography = themeTypography(colors);
  return StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
  },
});
});
