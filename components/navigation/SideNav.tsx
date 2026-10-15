import type { ComponentProps } from "react";
import type { Tabs } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "../ui/Text";
import { useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";

/** The props the Tabs navigator passes to a custom tab bar. */
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

type Props = BottomTabBarProps & {
  /** Forest sidebar (the admin dashboard); otherwise a white one. */
  forest: boolean;
  /** Shown at the bottom: who is signed in. */
  person?: { name: string; detail: string } | null;
  roleLabel: string;
};

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "ST";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/**
 * The wide-screen navigation: the SafeTrack logo, the visible tabs and the
 * signed-in person. Tab visibility, titles and icons come from the screens'
 * own options, so it shows exactly what the bottom bar would.
 */
export function SideNav({ state, descriptors, navigation, forest, person, roleLabel }: Props) {
  const { colors, scheme } = useTheme();
  const background = forest ? (scheme === "dark" ? colors.forest : "#0D2A1E") : colors.surface;
  const ink = forest ? "#FFFFFF" : colors.ink;
  const soft = forest ? "#BFD8C9" : colors.muted;

  return (
    <SafeAreaView edges={["top", "bottom", "left"]} style={[styles.root, { backgroundColor: background, borderRightColor: forest ? "transparent" : colors.rule }]}>
      <View style={styles.brand}>
        <Image
          source={forest || scheme === "dark" ? require("../../assets/images/logo.png") : require("../../assets/images/logo-black.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="SafeTrack"
        />
        <View>
          <Text variant="heading" weight="800" style={{ color: ink }}>
            SafeTrack
          </Text>
          <Text variant="caption" style={{ color: soft }}>
            {roleLabel}
          </Text>
        </View>
      </View>

      <Text variant="legend" style={[styles.section, { color: forest ? "#6F9580" : colors.muted }]}>
        Navigation
      </Text>

      <ScrollView contentContainerStyle={styles.items} showsVerticalScrollIndicator={false}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // expo-router hides `href: null` screens with display: "none".
          const itemStyle = StyleSheet.flatten(options.tabBarItemStyle) as { display?: string } | undefined;
          if (itemStyle?.display === "none") return null;
          const focused = state.index === index;
          const label = typeof options.title === "string" ? options.title : route.name;
          const color = focused ? (forest ? "#FFFFFF" : colors.primary) : soft;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.item,
                focused && { backgroundColor: forest ? "#1E4633" : colors.primaryTint },
                !focused && (pressed || hovered) && { backgroundColor: forest ? "rgba(255,255,255,0.06)" : colors.sunken },
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 20 })}
              <Text variant="label" weight={focused ? "800" : "600"} style={{ color }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {person ? (
        <View style={[styles.person, { borderTopColor: forest ? "#1E4633" : colors.rule }]}>
          <View style={[styles.avatar, { borderColor: forest ? "#3DDC84" : colors.primary, backgroundColor: forest ? "#163D2B" : colors.primaryTint }]}>
            <Text variant="caption" weight="800" style={{ color: forest ? "#3DDC84" : colors.primary }}>
              {initials(person.name)}
            </Text>
          </View>
          <View style={styles.personCopy}>
            <Text variant="label" weight="700" style={{ color: ink }} numberOfLines={1}>
              {person.name}
            </Text>
            <Text variant="caption" style={{ color: soft }} numberOfLines={1}>
              {person.detail}
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { width: 252, paddingHorizontal: space.md, paddingTop: space.xl, paddingBottom: space.lg, borderRightWidth: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.xs, marginBottom: space.xl },
  logo: { width: 48, height: 48 },
  section: { paddingHorizontal: space.sm, marginBottom: space.sm },
  items: { gap: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 46, paddingHorizontal: space.md, borderRadius: radius.sm - 2 },
  person: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: space.lg, borderTopWidth: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  personCopy: { flex: 1, minWidth: 0 },
});
