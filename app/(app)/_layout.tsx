import type { ColorValue } from "react-native";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { useGuardianPushRegistration } from "../../hooks/useGuardianPushRegistration";
import { guardianColors } from "../../constants/guardianDesign";
import { adminColors, adminLayout } from "../../constants/adminDesign";

type IconName = keyof typeof Ionicons.glyphMap;

function renderNavIcon(
  outline: IconName,
  filled: IconName = outline,
  isAdmin = false,
) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <View
      style={[
        styles.iconShell,
        isAdmin && styles.iconShellAdmin,
        focused && styles.iconShellActive,
        focused && isAdmin && styles.iconShellAdminActive,
      ]}
    >
      <Ionicons name={focused ? filled : outline} size={size} color={color} />
    </View>
  );
}

export default function AppLayout() {
  const role = useAuthStore((state) => state.role);
  const { width } = useWindowDimensions();
  const isAdmin = role === "admin";
  const isGuardian = role === "guardian";
  const wide = width >= adminLayout.sidebarBreakpoint;
  const colors = isAdmin ? adminColors : guardianColors;

  useGuardianPushRegistration(isGuardian);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarPosition: wide ? "left" : "bottom",
        tabBarVariant: wide ? "material" : "uikit",
        tabBarLabelPosition: wide ? "beside-icon" : "below-icon",
        tabBarActiveTintColor: isAdmin ? adminColors.primaryDark : guardianColors.primary,
        tabBarInactiveTintColor: isAdmin ? adminColors.sidebarMuted : guardianColors.muted,
        tabBarActiveBackgroundColor: isAdmin && wide ? "rgba(255,255,255,0.72)" : undefined,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: wide
          ? [styles.desktopLabel, isAdmin && styles.desktopLabelAdmin]
          : styles.mobileLabel,
        tabBarItemStyle: wide
          ? [styles.desktopItem, isAdmin && styles.desktopItemAdmin]
          : styles.mobileItem,
        tabBarStyle: wide
          ? [
              styles.sidebar,
              isAdmin ? styles.sidebarAdmin : null,
              {
                backgroundColor: isAdmin ? adminColors.sidebar : guardianColors.surface,
                borderRightColor: isAdmin ? adminColors.sidebarBorder : guardianColors.border,
              },
            ]
          : [
              styles.bottomBar,
              isAdmin ? styles.bottomBarAdmin : null,
              {
                backgroundColor: isAdmin ? adminColors.surface : guardianColors.surface,
                borderTopColor: isAdmin ? adminColors.border : guardianColors.border,
              },
            ],
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: isAdmin ? "Overview" : "Home",
          tabBarIcon: renderNavIcon("home-outline", "home", isAdmin),
        }}
      />

      <Tabs.Screen
        name="location"
        options={{
          title: "Location",
          href: isGuardian ? undefined : null,
          tabBarIcon: renderNavIcon("location-outline", "location", isAdmin),
        }}
      />
      <Tabs.Screen
        name="safety-center"
        options={{
          title: "Safety",
          href: isGuardian ? undefined : null,
          tabBarIcon: renderNavIcon("shield-checkmark-outline", "shield-checkmark", isAdmin),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Activity",
          href: isGuardian ? undefined : null,
          tabBarIcon: renderNavIcon("time-outline", "time", isAdmin),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: isGuardian ? undefined : null,
          tabBarIcon: renderNavIcon("person-outline", "person", isAdmin),
        }}
      />

      <Tabs.Screen
        name="admin-guardians"
        options={{
          title: "Guardians",
          href: isAdmin ? undefined : null,
          tabBarIcon: renderNavIcon("people-outline", "people", true),
        }}
      />
      <Tabs.Screen
        name="admin-devices"
        options={{
          title: "Devices",
          href: isAdmin ? undefined : null,
          tabBarIcon: renderNavIcon("watch-outline", "watch", true),
        }}
      />
      <Tabs.Screen
        name="admin-reports"
        options={{
          title: "Reports",
          href: isAdmin ? undefined : null,
          tabBarIcon: renderNavIcon("document-text-outline", "document-text", true),
        }}
      />
      <Tabs.Screen
        name="admin-profile"
        options={{
          title: "Admin",
          href: isAdmin ? undefined : null,
          tabBarIcon: renderNavIcon("person-circle-outline", "person-circle", true),
        }}
      />

      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="safe-zones" options={{ href: null }} />
      <Tabs.Screen name="help-support" options={{ href: null }} />
      <Tabs.Screen name="manage-access" options={{ href: null }} />
      <Tabs.Screen name="connection-code" options={{ href: null }} />
      <Tabs.Screen name="device-connection" options={{ href: null }} />
      <Tabs.Screen name="device-connection-code" options={{ href: null }} />
      <Tabs.Screen name="sos-alerts" options={{ href: null }} />

      <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
      <Tabs.Screen name="child-profile" options={{ href: null }} />
      <Tabs.Screen name="activity-map" options={{ href: null }} />
      <Tabs.Screen name="anomaly-details" options={{ href: null }} />
      <Tabs.Screen name="admin-device-details" options={{ href: null }} />
      <Tabs.Screen name="admin-guardian-details" options={{ href: null }} />
      <Tabs.Screen name="edit-child-profile" options={{ href: null }} />
      <Tabs.Screen name="edit-guardian-profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 242,
    paddingTop: Platform.OS === "web" ? 26 : 18,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  sidebarAdmin: {
    width: 264,
    paddingTop: Platform.OS === "web" ? 30 : 18,
    paddingHorizontal: 14,
  },
  bottomBar: {
    height: 74,
    paddingTop: 7,
    paddingBottom: Platform.OS === "ios" ? 8 : 10,
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  bottomBarAdmin: {
    height: 78,
  },
  desktopItem: {
    minHeight: 54,
    marginVertical: 3,
    borderRadius: 14,
  },
  desktopItemAdmin: {
    marginVertical: 4,
    borderRadius: 16,
    overflow: "hidden",
  },
  mobileItem: {
    minHeight: 56,
  },
  desktopLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  desktopLabelAdmin: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.18,
  },
  mobileLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1,
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconShellAdmin: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.42)",
    borderWidth: 1,
    borderColor: "rgba(22,122,92,0.05)",
  },
  iconShellActive: {
    backgroundColor: "rgba(31, 166, 117, 0.10)",
  },
  iconShellAdminActive: {
    backgroundColor: "#DDF0E7",
    borderWidth: 1,
    borderColor: "#BDDCCF",
  },
});
