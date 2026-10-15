import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { RoleBadge } from "../common/RoleBadge";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { UserRole } from "../../types/safetrack";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette, themeTypography } from "../../theme/legacy";

interface ProfileHeaderProps {
  fullName: string;
  email: string;
  role: UserRole;
}

export function ProfileHeader({ fullName, email, role }: ProfileHeaderProps) {
  const styles = useStyles();
  const colors = themePalette(useTheme().colors);

  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        {initials ? <Text style={styles.initials}>{initials}</Text> : <Ionicons name="person" size={28} color={colors.white} />}
      </View>
      <Text style={styles.name}>{fullName}</Text>
      <Text style={styles.email}>{email}</Text>
      <RoleBadge role={role} />
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  const typography = themeTypography(colors);
  return StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radii.pill,
    backgroundColor: colors.emerald,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  initials: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "700",
  },
  name: {
    ...typography.title,
    marginBottom: 2,
  },
  email: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
});
});
