import type { ColorValue } from "react-native";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { useGuardianPushRegistration } from "../../hooks/useGuardianPushRegistration";
import { guardianColors } from "../../constants/guardianDesign";
import { adminColors, adminLayout } from "../../constants/adminDesign";

type IconName = keyof typeof Ionicons.glyphMap;

function NavIcon(outline: IconName, filled: IconName = outline) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <View style={[styles.iconShell, focused && styles.iconShellActive]}>
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
        tabBarActiveTintColor: isAdmin ? adminColors.primary : guardianColors.primary,
        tabBarInactiveTintColor: isAdmin ? adminColors.muted : guardianColors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: wide ? styles.desktopLabel : styles.mobileLabel,
        tabBarItemStyle: wide ? styles.desktopItem : styles.mobileItem,
        tabBarStyle: wide
          ? [
              styles.sidebar,
              {
                backgroundColor: isAdmin ? adminColors.surface : guardianColors.surface,
                borderRightColor: isAdmin ? adminColors.border : guardianColors.border,
              },
            ]
          : [
              styles.bottomBar,
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
          tabBarIcon: NavIcon("home-outline", "home"),
        }}
      />

      <Tabs.Screen
        name="location"
        options={{
          title: "Location",
          href: isGuardian ? undefined : null,
          tabBarIcon: NavIcon("location-outline", "location"),
        }}
      />
      <Tabs.Screen
        name="safety-center"
        options={{
          title: "Safety",
          href: isGuardian ? undefined : null,
          tabBarIcon: NavIcon("shield-checkmark-outline", "shield-checkmark"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Activity",
          href: isGuardian ? undefined : null,
          tabBarIcon: NavIcon("time-outline", "time"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: isGuardian ? undefined : null,
          tabBarIcon: NavIcon("person-outline", "person"),
        }}
      />

      <Tabs.Screen
        name="admin-guardians"
        options={{
          title: "Guardians",
          href: isAdmin ? undefined : null,
          tabBarIcon: NavIcon("people-outline", "people"),
        }}
      />
      <Tabs.Screen
        name="admin-devices"
        options={{
          title: "Devices",
          href: isAdmin ? undefined : null,
          tabBarIcon: NavIcon("watch-outline", "watch"),
        }}
      />
      <Tabs.Screen
        name="admin-reports"
        options={{
          title: "Reports",
          href: isAdmin ? undefined : null,
          tabBarIcon: NavIcon("document-text-outline", "document-text"),
        }}
      />
      <Tabs.Screen
        name="admin-profile"
        options={{
          title: "Admin",
          href: isAdmin ? undefined : null,
          tabBarIcon: NavIcon("person-circle-outline", "person-circle"),
        }}
      />

      {/* Existing contextual Guardian routes remain addressable but are intentionally not primary tabs. */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="safe-zones" options={{ href: null }} />
      <Tabs.Screen name="help-support" options={{ href: null }} />
      <Tabs.Screen name="manage-access" options={{ href: null }} />
      <Tabs.Screen name="connection-code" options={{ href: null }} />
      <Tabs.Screen name="device-connection" options={{ href: null }} />
      <Tabs.Screen name="device-connection-code" options={{ href: null }} />
      <Tabs.Screen name="sos-alerts" options={{ href: null }} />

      {/* Existing non-tab routes. */}
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
    width: 238,
    paddingTop: Platform.OS === "web" ? 28 : 18,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  bottomBar: {
    height: 74,
    paddingTop: 7,
    paddingBottom: Platform.OS === "ios" ? 8 : 10,
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  desktopItem: {
    minHeight: 52,
    marginVertical: 2,
    borderRadius: 12,
  },
  mobileItem: { minHeight: 56 },
  desktopLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  mobileLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1,
  },
  iconShell: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  iconShellActive: {
    backgroundColor: "rgba(31, 166, 117, 0.10)",
  },
});
