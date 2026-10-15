import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { LocationLog } from "../../types/safetrack";

interface LocationListItemProps {
  log: LocationLog;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function LocationListItem({ log }: LocationListItemProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="location" size={16} color={colors.emerald} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.name}>{log.childName}</Text>
        <Text style={styles.meta}>
          {log.source} • ±{log.accuracyMeters}m • {formatDateTime(log.recordedAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.sageLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  textWrap: {
    flex: 1,
  },
  name: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  meta: {
    ...typography.caption,
  },
});
