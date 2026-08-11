import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";

type SafeTrackBackButtonProps = {
  label?: string;
  fallbackHref?: Href;
};

export function SafeTrackBackButton({
  label,
  fallbackHref = "/(auth)/login",
}: SafeTrackBackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    /*
      Normal navigation:
      Returns to the actual previous screen.
    */
    if (router.canGoBack()) {
      router.back();
      return;
    }

    /*
      Fallback navigation:
      Used when the page was opened through router.replace()
      or directly opened without a previous navigation screen.
    */
    router.replace(fallbackHref);
  };

  return (
    <Pressable
      onPress={handleBack}
      accessibilityRole="button"
      accessibilityLabel={label ? `Back to ${label}` : "Go back"}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="arrow-back"
        size={23}
        color={colors.primaryDark}
      />

      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 54,
    minHeight: 54,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  label: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 7,
  },

  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.97 }],
  },
});