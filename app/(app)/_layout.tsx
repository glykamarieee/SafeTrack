import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import {
  safeTrackColors as colors,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";

function createTabIcon(iconName: keyof typeof Ionicons.glyphMap) {
  return ({
    color,
    size,
  }: {
    color: ColorValue;
    size: number;
  }) => <Ionicons name={iconName} size={size} color={color} />;
}

export default function AppLayout() {
  const role = useAuthStore((state) => state.role);
  const isAdmin = role === "admin";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 11,
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          ...shadow.soft,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: createTabIcon("home-outline"),
        }}
      />

      <Tabs.Screen
        name="admin-guardians"
        options={{
          title: "Guardians",
          href: isAdmin ? undefined : null,
          tabBarIcon: createTabIcon("people-outline"),
        }}
      />

      <Tabs.Screen
        name="admin-devices"
        options={{
          title: "Devices",
          href: isAdmin ? undefined : null,
          tabBarIcon: createTabIcon("watch-outline"),
        }}
      />

      <Tabs.Screen
        name="admin-reports"
        options={{
          title: "Reports",
          href: isAdmin ? undefined : null,
          tabBarIcon: createTabIcon("document-text-outline"),
        }}
      />

      <Tabs.Screen
        name="admin-profile"
        options={{
          title: "Profile",
          href: isAdmin ? undefined : null,
          tabBarIcon: createTabIcon("person-outline"),
        }}
      />

      <Tabs.Screen
        name="admin-guardian-details"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="admin-device-details"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="location"
        options={{
          title: "Location",
          href: isAdmin ? null : undefined,
          tabBarIcon: createTabIcon("location-outline"),
        }}
      />

      <Tabs.Screen
        name="safety-center"
        options={{
          title: "Safety",
          href: isAdmin ? null : undefined,
          tabBarIcon: createTabIcon("shield-checkmark-outline"),
        }}
      />

      <Tabs.Screen
        name="sos-alerts"
        options={{
          title: "SOS Alerts",
          href: isAdmin ? null : undefined,
          tabBarIcon: createTabIcon("warning-outline"),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: isAdmin ? null : undefined,
          tabBarIcon: createTabIcon("person-outline"),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="safe-zones"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="manage-access"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="edit-child-profile"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="edit-guardian-profile"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
  name="child-mobile-link"
  options={{
    href: null,
  }}
/>
    </Tabs>
  );
}