import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../common/Card";
import { colors, spacing, typography } from "../../constants/theme";

interface StatTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  accentColor?: string;
}

export function StatTile({ icon, label, value, accentColor = colors.emerald }: StatTileProps) {
  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${accentColor}1A` }]}>
        <Ionicons name={icon} size={18} color={accentColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  value: {
    ...typography.title,
    fontSize: 20,
  },
  label: {
    ...typography.caption,
    marginTop: 2,
  },
});
