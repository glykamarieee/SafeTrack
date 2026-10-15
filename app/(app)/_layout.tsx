import type { ColorValue } from "react-native";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { useGuardianPushRegistration } from "../../hooks/useGuardianPushRegistration";
import { useGuardianSosRealtime } from "../../hooks/useGuardianSosRealtime";
import { adminLayout } from "../../constants/adminDesign";
import { SideNav } from "../../components/navigation/SideNav";
import { fontStyle, useFontsReady } from "../../theme/fonts";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

function renderNavIcon(outline: IconName, filled: IconName, mode: "bar" | "sidebar", colors: Palette, sidebarForest: boolean) {
  return ({ color, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <View style={styles.iconWrap}>
      {/* A short green line above the active tab on phones. */}
      {mode === "bar" && focused ? <View style={[styles.indicator, { backgroundColor: colors.primary }]} /> : null}
      <View
        style={[
          styles.iconShell,
          focused && mode === "bar" && { backgroundColor: colors.primaryTint },
          focused && mode === "sidebar" && { backgroundColor: sidebarForest ? "rgba(61,220,132,0.14)" : colors.primaryTint },
        ]}
      >
        <Ionicons name={focused ? filled : outline} size={22} color={focused && sidebarForest ? "#3DDC84" : color} />
      </View>
    </View>
  );
}

export default function AppLayout() {
  const role = useAuthStore((state) => state.role);
  const { width } = useWindowDimensions();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const fontsReady = useFontsReady();
  const isAdmin = role === "admin";
  const isGuardian = role === "guardian";
  const wide = width >= adminLayout.sidebarBreakpoint;
  // The admin sidebar is forest green, as on the approved admin dashboard.
  const forestSidebar = isAdmin && wide;
  const mode = wide ? "sidebar" : "bar";
  const icon = (outline: IconName, filled: IconName) => renderNavIcon(outline, filled, mode, colors, forestSidebar);

  const guardianId = useAuthStore((state) => state.guardian?.id);
  const guardianName = useAuthStore((state) => state.guardian?.fullName);
  const guardianEmail = useAuthStore((state) => state.guardian?.email);
  const administrator = useAuthStore((state) => state.administrator);
  const person = isAdmin
    ? { name: administrator?.fullName || "Administrator", detail: administrator?.email || "SafeTrack admin" }
    : guardianName
      ? { name: guardianName, detail: guardianEmail ?? "Guardian" }
      : null;

  useGuardianPushRegistration(isGuardian);
  useGuardianSosRealtime(isGuardian ? guardianId : null);

  return (
    <Tabs
      tabBar={
        wide
          ? (props) => <SideNav {...props} forest={forestSidebar} person={person} roleLabel={isAdmin ? "Administrator" : "Guardian"} />
          : undefined
      }
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.paper },
        tabBarPosition: wide ? "left" : "bottom",
        tabBarVariant: wide ? "material" : "uikit",
        tabBarLabelPosition: wide ? "beside-icon" : "below-icon",
        tabBarActiveTintColor: forestSidebar ? "#FFFFFF" : colors.primary,
        tabBarInactiveTintColor: forestSidebar ? "#BFD8C9" : colors.muted,
        tabBarActiveBackgroundColor: forestSidebar ? "#1E4633" : wide ? colors.primaryTint : undefined,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: [wide ? styles.desktopLabel : styles.mobileLabel, fontStyle("700", fontsReady)],
        tabBarItemStyle: wide ? styles.desktopItem : styles.mobileItem,
        tabBarStyle: wide
          ? [
              styles.sidebar,
              {
                backgroundColor: forestSidebar ? (scheme === "dark" ? colors.forest : "#0D2A1E") : colors.surface,
                borderRightColor: forestSidebar ? "transparent" : colors.rule,
              },
            ]
          : [
              styles.bottomBar,
              // Clear Android's gesture/navigation bar on edge-to-edge screens.
              { height: 66 + insets.bottom, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.surface, borderTopColor: colors.rule },
            ],
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: isAdmin ? "Overview" : "Home",
          tabBarIcon: icon("home-outline", "home"),
        }}
      />

      <Tabs.Screen
        name="location"
        options={{
          title: "Location",
          href: isGuardian ? undefined : null,
          tabBarIcon: icon("location-outline", "location"),
        }}
      />
      <Tabs.Screen
        name="safety-center"
        options={{
          title: "Safety",
          href: isGuardian ? undefined : null,
          tabBarIcon: icon("shield-checkmark-outline", "shield-checkmark"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Activity",
          href: isGuardian ? undefined : null,
          tabBarIcon: icon("time-outline", "time"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: isGuardian ? undefined : null,
          tabBarIcon: icon("person-outline", "person"),
        }}
      />

      <Tabs.Screen
        name="admin-guardians"
        options={{
          title: "Guardians",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("people-outline", "people"),
        }}
      />
      <Tabs.Screen
        name="admin-devices"
        options={{
          title: "Devices",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("watch-outline", "watch"),
        }}
      />
      <Tabs.Screen
        name="admin-records"
        options={{
          title: "Records",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("list-outline", "list"),
        }}
      />
      <Tabs.Screen
        name="admin-reports"
        options={{
          title: "Reports",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("document-text-outline", "document-text"),
        }}
      />
      <Tabs.Screen
        name="admin-profile"
        options={{
          title: "Admin",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("person-circle-outline", "person-circle"),
        }}
      />

      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="safe-zones" options={{ href: null }} />
      <Tabs.Screen name="change-password" options={{ href: null }} />
      <Tabs.Screen name="notification-settings" options={{ href: null }} />
      <Tabs.Screen name="delete-account" options={{ href: null }} />
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
    width: 248,
    paddingTop: Platform.OS === "web" ? 28 : 18,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  bottomBar: {
    height: 78,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 12,
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  desktopItem: { minHeight: 48, marginVertical: 3, borderRadius: 14, overflow: "hidden" },
  mobileItem: { minHeight: 56 },
  desktopLabel: { fontSize: 13.5, letterSpacing: 0.1 },
  mobileLabel: { fontSize: 11, marginTop: 2 },
  iconWrap: { alignItems: "center" },
  indicator: { position: "absolute", top: -9, width: 22, height: 3, borderRadius: 2 },
  iconShell: { width: 38, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
