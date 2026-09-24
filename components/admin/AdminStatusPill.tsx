import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminColors as colors, adminRadius as radius } from "../../constants/adminDesign";

type Tone = "active" | "inactive" | "warning" | "neutral";

const config: Record<Tone, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  active: { color: colors.primaryDark, bg: colors.primarySoft, icon: "checkmark-circle-outline" },
  inactive: { color: colors.danger, bg: colors.dangerSoft, icon: "pause-circle-outline" },
  warning: { color: colors.amber, bg: colors.amberSoft, icon: "alert-circle-outline" },
  neutral: { color: colors.text, bg: colors.surfaceMuted, icon: "ellipse-outline" },
};

export function AdminStatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const item = config[tone];
  return (
    <View style={[styles.root, { backgroundColor: item.bg }]}>
      <Ionicons name={item.icon} size={14} color={item.color} />
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
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
});
