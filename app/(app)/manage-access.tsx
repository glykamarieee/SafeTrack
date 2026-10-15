import { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Text } from "../../components/ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../components/common/ScreenContainer";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { useAuthStore } from "../../store/authStore";
import { useMenuManagementStore } from "../../store/menuManagementStore";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { showAlert } from "../../lib/platformAlert";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette, themeTypography } from "../../theme/legacy";

const MENU_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  HOME: "home-outline",
  LOCATION: "location-outline",
  SOS_ALERTS: "warning-outline",
  REPORTS: "document-text-outline",
  PROFILE: "person-outline",
};

export default function ManageAccessScreen() {
  const styles = useStyles();
  const colors = themePalette(useTheme().colors);

  const role = useAuthStore((s) => s.role);
  const menus = useMenuManagementStore((s) => s.menus);
  const roles = useMenuManagementStore((s) => s.roles);
  const permissions = useMenuManagementStore((s) => s.permissions);
  const isLoading = useMenuManagementStore((s) => s.isLoading);
  const error = useMenuManagementStore((s) => s.error);
  const updatingKey = useMenuManagementStore((s) => s.updatingKey);
  const load = useMenuManagementStore((s) => s.load);
  const toggleVisibility = useMenuManagementStore((s) => s.toggleVisibility);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const visibleCountForSelectedRole = useMemo(
    () => permissions.filter((p) => p.roleId === selectedRoleId && p.canView).length,
    [permissions, selectedRoleId]
  );

  if (role !== "admin") {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Manage Access</Text>
        <EmptyState icon="lock-closed-outline" title="Not available" message="Only administrators can manage screen access." />
      </ScreenContainer>
    );
  }

  if (isLoading && menus.length === 0) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Manage Access</Text>
        <LoadingState message="Loading screen access settings..." />
      </ScreenContainer>
    );
  }

  if (error && menus.length === 0) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Manage Access</Text>
        <ErrorState message={error} onRetry={load} />
      </ScreenContainer>
    );
  }

  const handleToggle = (menuId: string, nextValue: boolean) => {
    if (!selectedRoleId) return;
    if (!nextValue && visibleCountForSelectedRole <= 1) {
      showAlert("Can't hide this screen", "At least one screen must stay visible for this role.");
      return;
    }
    toggleVisibility(selectedRoleId, menuId, nextValue);
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Manage Access</Text>
      <Text style={styles.subtitle}>Choose which screens each role can see.</Text>

      <View style={styles.roleRow}>
        {roles.map((r) => (
          <Button
            key={r.id}
            label={r.roleName}
            onPress={() => setSelectedRoleId(r.id)}
            variant={selectedRoleId === r.id ? "primary" : "outline"}
            fullWidth={false}
            style={styles.roleButton}
          />
        ))}
      </View>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <Card style={styles.listCard}>
        {menus.map((menu, index) => {
          const permission = permissions.find((p) => p.roleId === selectedRoleId && p.menuId === menu.id);
          const canView = permission?.canView ?? false;
          const key = `${selectedRoleId}:${menu.id}`;
          return (
            <View key={menu.id} style={[styles.row, index < menus.length - 1 && styles.rowDivider]}>
              <View style={styles.rowIconWrap}>
                <Ionicons name={MENU_ICONS[menu.menuKey] ?? "ellipse-outline"} size={18} color={colors.emerald} />
              </View>
              <Text style={styles.rowLabel}>{menu.menuName}</Text>
              <Switch
                value={canView}
                onValueChange={(next) => handleToggle(menu.id, next)}
                disabled={updatingKey === key}
                trackColor={{ true: colors.emerald }}
              />
            </View>
          );
        })}
      </Card>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  const typography = themeTypography(colors);
  return StyleSheet.create({
  title: {
    ...typography.display,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleButton: {
    paddingHorizontal: spacing.lg,
  },
  listCard: {
    padding: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.sageLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  rowLabel: {
    ...typography.bodyStrong,
    flex: 1,
  },
});
});
