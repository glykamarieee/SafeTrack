import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../common/Card";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { ActivityReport } from "../../types/safetrack";

const TYPE_LABELS: Record<ActivityReport["type"], string> = {
  daily_summary: "Daily Summary",
  location_history: "Location History",
  sos_history: "SOS History",
  weekly_summary: "Weekly Summary",
};

const STATUS_META: Record<ActivityReport["status"], { label: string; color: string }> = {
  generating: { label: "Generating", color: colors.warning },
  ready: { label: "Ready", color: colors.success },
  failed: { label: "Failed", color: colors.danger },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface ReportListItemProps {
  report: ActivityReport;
}

export function ReportListItem({ report }: ReportListItemProps) {
  const statusMeta = STATUS_META[report.status];
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="document-text-outline" size={18} color={colors.emerald} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.subtitle}>{TYPE_LABELS[report.type]} • {report.childName}</Text>
        </View>
        <Text style={styles.exportFormat}>{report.exportFormat.toUpperCase()}</Text>
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.dateRange}>
          {formatDate(report.rangeStart)} – {formatDate(report.rangeEnd)}
        </Text>
        <Text style={[styles.status, { color: statusMeta.color }]}>{statusMeta.label}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  titleWrap: {
    flex: 1,
  },
  title: {
    ...typography.bodyStrong,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  exportFormat: {
    ...typography.label,
    color: colors.emerald,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateRange: {
    ...typography.caption,
  },
  status: {
    fontSize: 12,
    fontWeight: "700",
  },
});
