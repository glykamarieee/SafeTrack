import { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ColorValue,
} from "react-native";
import { Redirect, Tabs, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useChildMobileStore } from "../../store/childMobileStore";
import {
  childColors as colors,
  childShadow as shadow,
} from "../../constants/childDesign";

function createTabIcon(
  iconName: keyof typeof Ionicons.glyphMap,
  options: { danger?: boolean } = {}
) {
  return ({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) => (
    <View
      style={[
        styles.iconShell,
        focused && styles.iconShellFocused,
        options.danger && styles.iconShellDanger,
        options.danger && focused && styles.iconShellDangerFocused,
      ]}
    >
      <Ionicons
        name={iconName}
        size={Math.min(size, 22)}
        color={options.danger ? colors.danger : color}
      />
    </View>
  );
}

export default function ChildLayout() {
  const bootstrap = useChildMobileStore((state) => state.bootstrap);
  const isBootstrapped = useChildMobileStore((state) => state.isBootstrapped);
  const context = useChildMobileStore((state) => state.context);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!isBootstrapped) {
    return (
      <View style={styles.loading}>
        <View style={styles.loadingMark}>
          <Ionicons name="shield-checkmark-outline" size={30} color={colors.brand} />
        </View>
        <ActivityIndicator size="small" color={colors.brand} style={styles.spinner} />
      </View>
    );
  }

  if (!context) {
    return <Redirect href={"/(auth)/child-device-link" as Href} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 78,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.surface,
          ...shadow.soft,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="child-home"
        options={{
          title: "Home",
          tabBarIcon: createTabIcon("home-outline"),
        }}
      />
      <Tabs.Screen
        name="child-safety"
        options={{
          title: "Safety",
          tabBarIcon: createTabIcon("shield-checkmark-outline"),
        }}
      />
      <Tabs.Screen
        name="child-sos"
        options={{
          title: "SOS",
          tabBarActiveTintColor: colors.danger,
          tabBarIcon: createTabIcon("warning-outline", { danger: true }),
        }}
      />
      <Tabs.Screen
        name="child-profile"
        options={{
          title: "Profile",
          tabBarIcon: createTabIcon("person-outline"),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  loadingMark: {
    width: 70,
    height: 70,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSoft,
  },
  spinner: { marginTop: 16 },
  iconShell: {
    width: 38,
    height: 31,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  iconShellFocused: { backgroundColor: colors.brandSoft },
  iconShellDanger: { backgroundColor: "transparent" },
  iconShellDangerFocused: { backgroundColor: colors.dangerSoft },
});
