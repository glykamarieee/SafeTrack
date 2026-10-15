import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../constants/theme";

interface LocationMetaRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

export function LocationMetaRow({ icon, label, value }: LocationMetaRowProps) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.emerald} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  icon: {
    marginRight: spacing.sm,
  },
  label: {
    ...typography.caption,
    flex: 1,
  },
  value: {
    ...typography.bodyStrong,
    fontSize: 13,
  },
});
