import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { ROLE_LABELS } from "../../constants/roles";
import { colors, radii, spacing } from "../../constants/theme";
import type { UserRole } from "../../types/safetrack";

interface RoleBadgeProps {
  role: UserRole;
}

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  guardian: { bg: colors.sageLight, text: colors.emeraldDark },
  child: { bg: colors.infoLight, text: colors.info },
  admin: { bg: colors.warningLight, text: colors.warning },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const palette = ROLE_COLORS[role];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.text }]}>{ROLE_LABELS[role]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
  },
});
