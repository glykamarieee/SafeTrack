import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminColors as colors, adminRadius as radius } from "../../constants/adminDesign";

type Tone = "active" | "inactive" | "warning" | "neutral";

const config: Record<Tone, { color: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  active: {
    color: colors.primaryDark,
    bg: colors.primarySoft,
    border: "#C6E2D5",
    icon: "checkmark-circle-outline",
  },
  inactive: {
    color: colors.danger,
    bg: colors.dangerSoft,
    border: "#F1C8CB",
    icon: "pause-circle-outline",
  },
  warning: {
    color: colors.amber,
    bg: colors.amberSoft,
    border: "#EAD5B2",
    icon: "alert-circle-outline",
  },
  neutral: {
    color: colors.text,
    bg: colors.surfaceMuted,
    border: colors.border,
    icon: "ellipse-outline",
  },
};

export function AdminStatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const item = config[tone];

  return (
    <View style={[styles.root, { backgroundColor: item.bg, borderColor: item.border }]}>
      <Ionicons name={item.icon} size={13} color={item.color} />
      <Text style={[styles.label, { color: item.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: "flex-start",
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.12,
  },
});
