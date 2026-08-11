import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { colors, spacing, typography } from "../../constants/theme";
import type { SosAlert } from "../../types/safetrack";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS_COLOR: Record<SosAlert["status"], string> = {
  active: colors.danger,
  acknowledged: colors.warning,
  resolved: colors.emerald,
};

interface SosAlertCardProps {
  alert: SosAlert;
  onAcknowledge?: () => void;
  onResolve?: () => void;
  showChildName?: boolean;
}

export function SosAlertCard({ alert, onAcknowledge, onResolve, showChildName = true }: SosAlertCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconWrap, { backgroundColor: alert.status === "active" ? colors.dangerLight : colors.sageLight }]}>
            <Ionicons name={alert.status === "active" ? "warning-outline" : "shield-checkmark-outline"} size={18} color={STATUS_COLOR[alert.status]} />
          </View>
          <View>
            <Text style={styles.title}>{showChildName ? alert.childName : "SOS Alert"}</Text>
            <Text style={styles.meta}>{formatDateTime(alert.triggeredAt)}{alert.isTestAlert ? " • Test alert" : ""}</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: alert.status === "active" ? colors.dangerLight : alert.status === "acknowledged" ? colors.warningLight : colors.successLight }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[alert.status] }]}>{alert.status.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.detail}>Activation: {alert.activationMethod.replace(/_/g, " ")}</Text>
      {alert.locationSource ? <Text style={styles.detail}>Location source: {alert.locationSource}</Text> : null}

      {alert.status === "active" && onAcknowledge ? <Button label="Acknowledge" onPress={onAcknowledge} variant="outline" style={styles.action} /> : null}
      {alert.status === "acknowledged" && onResolve ? <Button label="Resolve Alert" onPress={onResolve} style={styles.action} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, padding: spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { ...typography.bodyStrong, fontSize: 14 },
  meta: { ...typography.caption, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start" },
  statusText: { fontSize: 9, fontWeight: "900" },
  detail: { color: colors.textSecondary, fontSize: 11, marginTop: 8 },
  action: { marginTop: spacing.md },
});
