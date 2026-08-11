import { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ColorValue,
} from "react-native";
import {
  Redirect,
  Tabs,
  type Href,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useChildMobileStore } from "../../store/childMobileStore";

import {
  safeTrackColors as colors,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";

function createTabIcon(
  iconName: keyof typeof Ionicons.glyphMap
) {
  return ({
    color,
    size,
  }: {
    color: ColorValue;
    size: number;
  }) => (
    <Ionicons
      name={iconName}
      size={size}
      color={color}
    />
  );
}

export default function ChildLayout() {
  const bootstrap = useChildMobileStore(
    (state) => state.bootstrap
  );

  const isBootstrapped = useChildMobileStore(
    (state) => state.isBootstrapped
  );

  const context = useChildMobileStore(
    (state) => state.context
  );

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!isBootstrapped) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </View>
    );
  }

  if (!context) {
    return (
      <Redirect
        href={"/(auth)/child-device-link" as Href}
      />
    );
  }

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
          tabBarIcon: createTabIcon(
            "shield-checkmark-outline"
          ),
        }}
      />

      <Tabs.Screen
        name="child-sos"
        options={{
          title: "SOS",
          tabBarIcon: createTabIcon("warning-outline"),
        }}
      />

      <Tabs.Screen
        name="child-profile"
        options={{
          title: "Profile",
          tabBarIcon: createTabIcon("person-outline"),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});