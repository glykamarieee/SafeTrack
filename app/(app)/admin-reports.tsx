import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchAdminReportSummary,
  subscribeAdminUpdates,
  type AdminReportSummary,
} from "../../services/adminService";
import {
  generateServerActivityReport,
  type ServerReportFormat,
} from "../../services/adminServerReportService";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminShadow as shadow,
  adminSpacing as spacing,
} from "../../constants/adminDesign";

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function AdminReportsScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 980;

  const [startDate, setStartDate] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return toIsoDate(start);
  });
  const [endDate, setEndDate] = useState(() => toIsoDate(new Date()));
  const [summary, setSummary] = useState<AdminReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<ServerReportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (isRefresh = false) => {
      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        setError("Use YYYY-MM-DD format for both report dates.");
        setLoading(false);
        return;
      }
      if (startDate > endDate) {
        setError("The start date cannot be later than the end date.");
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        setSummary(await fetchAdminReportSummary(startDate, endDate));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to retrieve SafeTrack system records.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [endDate, startDate],
  );

  useEffect(() => {
    void loadSummary();
    const unsubscribe = subscribeAdminUpdates(() => void loadSummary());
    return unsubscribe;
  }, [loadSummary]);

  const totalRecords = useMemo(() => {
    if (!summary) return 0;
    return (
      summary.guardianAccounts +
      summary.registeredChildren +
      summary.smartwatchDevices +
      summary.locationRecords +
      summary.safeZoneEvents +
      summary.sosRecords
    );
  }, [summary]);

  const noRecords = Boolean(summary && totalRecords === 0);

  const exportReport = async (format: ServerReportFormat) => {
    if (!summary || exporting) return;
    if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
      Alert.alert("Invalid report dates", "Check the selected report date range first.");
      return;
    }

    setExporting(format);
    try {
      const result = await generateServerActivityReport({
        format,
        dateFrom: startDate,
        dateTo: endDate,
        reportTitle: "SafeTrack Activity Report",
      });
      const canOpen = await Linking.canOpenURL(result.signedUrl);
      if (!canOpen) throw new Error("The generated report link could not be opened on this device.");
      await Linking.openURL(result.signedUrl);
    } catch (reason) {
      Alert.alert(
        format === "pdf" ? "PDF export error" : "Excel export error",
        reason instanceof Error ? reason.message : "SafeTrack could not generate the report.",
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadSummary(true)} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.page}>
          <AdminPageHeader
            eyebrow="SYSTEM REPORTING"
            title="Reports"
            description="Choose an authorized date range, retrieve the existing SafeTrack report summary, then use the current PDF or Excel export workflow."
          />

          <View style={[styles.filterBand, wide && styles.filterBandWide]}>
            <View style={[styles.dateFields, wide && styles.dateFieldsWide]}>
              <DateField label="Start date" value={startDate} onChangeText={setStartDate} />
              <DateField label="End date" value={endDate} onChangeText={setEndDate} />
            </View>
            <Pressable
              onPress={() => void loadSummary()}
              style={({ pressed }) => [styles.retrieveButton, pressed && styles.pressed]}
            >
              <Ionicons name="filter-outline" size={17} color={colors.white} />
              <Text style={styles.retrieveText}>Retrieve records</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.inlineError}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}

          {loading && !summary ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.stateTitle}>Retrieving system records</Text>
              <Text style={styles.stateText}>Preparing the report summary for the selected period.</Text>
            </View>
          ) : null}

          {summary && noRecords ? (
            <View style={styles.stateBlock}>
              <View style={styles.stateIcon}><Ionicons name="document-outline" size={22} color={colors.primary} /></View>
              <Text style={styles.stateTitle}>No report records</Text>
              <Text style={styles.stateText}>No SafeTrack system records were found for the selected period. Change the date range and retrieve records again.</Text>
            </View>
          ) : null}

          {summary && !noRecords ? (
            <View style={[styles.reportWorkspace, wide && styles.reportWorkspaceWide]}>
              <View style={styles.summaryColumn}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEyebrow}>SELECTED PERIOD</Text>
                  <Text style={styles.sectionTitle}>System record summary</Text>
                  <Text style={styles.sectionDescription}>{startDate} to {endDate}</Text>
                </View>

                <View style={styles.summaryList}>
                  <SummaryRow icon="people-outline" label="Guardian accounts" value={summary.guardianAccounts} />
                  <SummaryRow icon="people-circle-outline" label="Registered children" value={summary.registeredChildren} />
                  <SummaryRow icon="watch-outline" label="Smartwatch devices" value={summary.smartwatchDevices} tone="blue" />
                  <SummaryRow icon="location-outline" label="Location records" value={summary.locationRecords} tone="blue" />
                  <SummaryRow icon="shield-outline" label="Safe-zone events" value={summary.safeZoneEvents} />
                  <SummaryRow icon="alert-circle-outline" label="SOS records" value={summary.sosRecords} tone={summary.sosRecords > 0 ? "danger" : "default"} last />
                </View>

                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>Combined retrieved count</Text>
                  <Text style={styles.totalValue}>{totalRecords.toLocaleString()}</Text>
                </View>
              </View>

              <View style={[styles.exportColumn, wide && styles.exportColumnWide]}>
                <Text style={styles.sectionEyebrow}>EXPORT</Text>
                <Text style={styles.sectionTitle}>Create report file</Text>
                <Text style={styles.exportDescription}>
                  The existing backend generates the report file and returns the temporary signed link used by the current SafeTrack export flow.
                </Text>

                <Pressable
                  disabled={exporting !== null}
                  onPress={() => void exportReport("pdf")}
                  style={({ pressed }) => [styles.exportPrimary, pressed && styles.pressed, exporting !== null && styles.disabled]}
                >
                  {exporting === "pdf" ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="document-text-outline" size={19} color={colors.white} />}
                  <View style={styles.exportCopy}>
                    <Text style={styles.exportPrimaryTitle}>Export PDF</Text>
                    <Text style={styles.exportPrimaryMeta}>Portable report document</Text>
                  </View>
                  <Ionicons name="open-outline" size={17} color={colors.white} />
                </Pressable>

                <Pressable
                  disabled={exporting !== null}
                  onPress={() => void exportReport("xlsx")}
                  style={({ pressed }) => [styles.exportSecondary, pressed && styles.pressed, exporting !== null && styles.disabled]}
                >
                  {exporting === "xlsx" ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="grid-outline" size={19} color={colors.primary} />}
                  <View style={styles.exportCopy}>
                    <Text style={styles.exportSecondaryTitle}>Export Excel</Text>
                    <Text style={styles.exportSecondaryMeta}>Spreadsheet report file</Text>
                  </View>
                  <Ionicons name="open-outline" size={17} color={colors.primary} />
                </Pressable>

                <View style={styles.privacyNote}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.privacyText}>Only records returned by the existing authorized reporting workflow are included.</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DateField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.dateField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  tone = "default",
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tone?: "default" | "blue" | "danger";
  last?: boolean;
}) {
  const color = tone === "danger" ? colors.danger : tone === "blue" ? colors.blue : colors.primary;
  const bg = tone === "danger" ? colors.dangerSoft : tone === "blue" ? colors.blueSoft : colors.primarySoft;
  return (
    <View style={[styles.summaryRow, !last && styles.summaryDivider]}>
      <View style={[styles.summaryIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={17} color={color} /></View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === "danger" && styles.summaryValueDanger]}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 110 },
  page: { width: "100%", maxWidth: adminLayout.pageMax, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: 28 },
  filterBand: { gap: 12, marginTop: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 16 },
  filterBandWide: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  dateFields: { gap: 10 },
  dateFieldsWide: { flex: 1, maxWidth: 620, flexDirection: "row" },
  dateField: { flex: 1 },
  fieldLabel: { color: colors.muted, fontSize: 10.5, fontWeight: "800", marginBottom: 6 },
  inputShell: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 12 },
  input: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: "700", paddingVertical: 0, outlineStyle: "none" } as any,
  retrieveButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: 16 },
  retrieveText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  inlineError: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, marginTop: 14 },
  inlineErrorText: { flex: 1, color: colors.danger, fontSize: 11.5, lineHeight: 17 },
  stateBlock: { minHeight: 250, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginTop: 22, padding: 24 },
  stateIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  stateTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 13, textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: "center", maxWidth: 480 },
  reportWorkspace: { marginTop: 30, gap: 30 },
  reportWorkspaceWide: { flexDirection: "row", alignItems: "flex-start", gap: 38 },
  summaryColumn: { flex: 1.35, minWidth: 0 },
  exportColumn: { flex: 0.85, minWidth: 0 },
  exportColumnWide: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 32 },
  sectionHeader: { marginBottom: 10 },
  sectionEyebrow: { color: colors.muted, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.15 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "800", letterSpacing: -0.3, marginTop: 5 },
  sectionDescription: { color: colors.muted, fontSize: 11, marginTop: 4 },
  summaryList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  summaryRow: { minHeight: 61, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  summaryDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  summaryLabel: { flex: 1, color: colors.text, fontSize: 12.3, fontWeight: "700" },
  summaryValue: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  summaryValueDanger: { color: colors.danger },
  totalLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, paddingHorizontal: 2 },
  totalLabel: { color: colors.muted, fontSize: 11 },
  totalValue: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  exportDescription: { color: colors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 8 },
  exportPrimary: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 14, marginTop: 18, ...shadow.soft },
  exportSecondary: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 14, marginTop: 10, borderWidth: 1, borderColor: colors.border },
  exportCopy: { flex: 1 },
  exportPrimaryTitle: { color: colors.white, fontSize: 12.5, fontWeight: "800" },
  exportPrimaryMeta: { color: "rgba(255,255,255,0.75)", fontSize: 10.5, marginTop: 2 },
  exportSecondaryTitle: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" },
  exportSecondaryMeta: { color: colors.muted, fontSize: 10.5, marginTop: 2 },
  privacyNote: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 15 },
  privacyText: { flex: 1, color: colors.muted, fontSize: 10.8, lineHeight: 16 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.52 },
});
