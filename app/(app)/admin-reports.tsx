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
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function SummaryTile({
  icon,
  label,
  value,
  color = colors.primary,
  background = colors.softMint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color?: string;
  background?: string;
}) {
  return (
    <View style={styles.summaryTile}>
      <View style={[styles.summaryIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export default function AdminReportsScreen() {
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

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const result = await fetchAdminReportSummary(startDate, endDate);
        setSummary(result);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to retrieve SafeTrack system records."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [endDate, startDate]
  );

useEffect(() => {

  void loadSummary();


  const unsubscribe =
    subscribeAdminUpdates(() => {

      void loadSummary();

    });


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
      if (!canOpen) {
        throw new Error("The generated report link could not be opened on this device.");
      }

      await Linking.openURL(result.signedUrl);
    } catch (reason) {
      Alert.alert(
        format === "pdf" ? "PDF export error" : "Excel export error",
        reason instanceof Error
          ? reason.message
          : "SafeTrack could not generate the report."
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadSummary(true)}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.eyebrow}>SYSTEM REPORTING</Text>
        <Text style={styles.heading}>Generate reports</Text>
        <Text style={styles.subtitle}>
          Select report criteria, retrieve authorized system records, and
          generate private PDF or Excel reports through the SafeTrack backend.
        </Text>

        <View style={styles.criteriaCard}>
          <Text style={styles.criteriaTitle}>Select report criteria</Text>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Start date</Text>

              <View style={styles.inputShell}>
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#98A49F"
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={[styles.dateField, styles.dateFieldRight]}>
              <Text style={styles.fieldLabel}>End date</Text>

              <View style={styles.inputShell}>
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#98A49F"
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => void loadSummary()}
            style={({ pressed }) => [styles.generateButton, pressed && styles.pressed]}
          >
            <Ionicons name="analytics-outline" size={18} color={colors.white} />
            <Text style={styles.generateButtonText}>Retrieve system records</Text>
          </Pressable>
        </View>

        {loading && !summary ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Retrieving system records...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {summary && noRecords ? (
          <View style={styles.noRecordsCard}>
            <View style={styles.noRecordsIcon}>
              <Ionicons name="document-outline" size={31} color={colors.primary} />
            </View>
            <Text style={styles.noRecordsTitle}>No report records</Text>
            <Text style={styles.noRecordsText}>
              No SafeTrack system records were found for the selected period.
              Change the date range and retrieve records again.
            </Text>
          </View>
        ) : null}

        {summary && !noRecords ? (
          <>
            <Text style={styles.sectionLabel}>SYSTEM RECORD SUMMARY</Text>

            <View style={styles.summaryGrid}>
              <SummaryTile icon="people-outline" label="Guardian Accounts" value={summary.guardianAccounts} />
              <SummaryTile icon="people-circle-outline" label="Registered Children" value={summary.registeredChildren} />
              <SummaryTile icon="watch-outline" label="Smartwatch Devices" value={summary.smartwatchDevices} color="#2875A8" background="#E9F4FC" />
              <SummaryTile icon="location-outline" label="Location Records" value={summary.locationRecords} color="#287C6B" background="#EAF8F2" />
              <SummaryTile icon="shield-outline" label="Safe-Zone Events" value={summary.safeZoneEvents} />
              <SummaryTile icon="warning-outline" label="SOS Records" value={summary.sosRecords} color={colors.danger} background={colors.dangerSoft} />
            </View>

            <View style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <View>
                  <Text style={styles.activityTitle}>Daily system activity</Text>
                  <Text style={styles.activitySubtitle}>Successfully stored records for the selected period.</Text>
                </View>
                <View style={styles.activityIcon}>
                  <Ionicons name="pulse-outline" size={20} color={colors.primary} />
                </View>
              </View>

              <View style={styles.activityRow}>
                <Ionicons name="location-outline" size={17} color={colors.primary} />
                <Text style={styles.activityText}>{summary.locationRecords} location record{summary.locationRecords === 1 ? "" : "s"} retrieved.</Text>
              </View>

              <View style={styles.activityRow}>
                <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} />
                <Text style={styles.activityText}>{summary.safeZoneEvents} safe-zone event{summary.safeZoneEvents === 1 ? "" : "s"} retrieved.</Text>
              </View>

              <View style={styles.activityRow}>
                <Ionicons name="warning-outline" size={17} color={summary.sosRecords > 0 ? colors.danger : colors.primary} />
                <Text style={styles.activityText}>{summary.sosRecords} SOS record{summary.sosRecords === 1 ? "" : "s"} retrieved.</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>EXPORT REPORT</Text>

            <View style={styles.exportRow}>
              <Pressable
                disabled={exporting !== null}
                onPress={() => void exportReport("pdf")}
                style={({ pressed }) => [
                  styles.pdfButton,
                  (pressed || exporting !== null) && styles.pressed,
                  exporting !== null && styles.disabled,
                ]}
              >
                {exporting === "pdf" ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="document-text-outline" size={18} color={colors.white} />
                )}
                <Text style={styles.pdfButtonText}>Export PDF</Text>
              </Pressable>

              <Pressable
                disabled={exporting !== null}
                onPress={() => void exportReport("xlsx")}
                style={({ pressed }) => [
                  styles.xlsxButton,
                  (pressed || exporting !== null) && styles.pressed,
                  exporting !== null && styles.disabled,
                ]}
              >
                {exporting === "xlsx" ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Ionicons name="grid-outline" size={18} color={colors.primaryDark} />
                )}
                <Text style={styles.xlsxButtonText}>Export Excel</Text>
              </Pressable>
            </View>

            <Text style={styles.exportNote}>
              Reports are generated on the SafeTrack backend, stored privately,
              and opened through a temporary signed link.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: 22, paddingBottom: 120 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  heading: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.7, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  criteriaCard: { padding: 15, borderRadius: radius.md, backgroundColor: colors.white, marginTop: 20, ...shadow.soft },
  criteriaTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  dateRow: { flexDirection: "row", marginTop: 13 },
  dateField: { flex: 1 },
  dateFieldRight: { marginLeft: 9 },
  fieldLabel: { color: colors.muted, fontSize: 10.5, fontWeight: "800", marginBottom: 6 },
  inputShell: { minHeight: 47, flexDirection: "row", alignItems: "center", paddingHorizontal: 9, borderRadius: radius.sm, backgroundColor: "#F6FAF8" },
  input: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: "700", marginLeft: 5, paddingVertical: 9 },
  generateButton: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primary, marginTop: 14 },
  generateButtonText: { color: colors.white, fontSize: 12, fontWeight: "900", marginLeft: 7 },
  loading: { alignItems: "center", paddingVertical: 35 },
  loadingText: { color: colors.muted, fontSize: 12, marginTop: 10 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", padding: 13, borderRadius: radius.md, backgroundColor: colors.dangerSoft, marginTop: 18 },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17, marginLeft: 8 },
  noRecordsCard: { alignItems: "center", padding: 28, borderRadius: radius.md, backgroundColor: colors.white, marginTop: 20, ...shadow.soft },
  noRecordsIcon: { width: 62, height: 62, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.softMint },
  noRecordsTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 12 },
  noRecordsText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 5 },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 22, marginBottom: 10 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  summaryTile: { width: "31.5%", minHeight: 116, padding: 10, borderRadius: radius.md, backgroundColor: colors.white, marginBottom: 10, ...shadow.soft },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryValue: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 11 },
  summaryLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, fontWeight: "800", marginTop: 3 },
  activityCard: { padding: 16, borderRadius: radius.md, backgroundColor: colors.white, marginTop: 2, ...shadow.soft },
  activityHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13 },
  activityTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  activitySubtitle: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  activityIcon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.softMint },
  activityRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border },
  activityText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16, marginLeft: 8 },
  exportRow: { flexDirection: "row", justifyContent: "space-between" },
  pdfButton: { width: "48.5%", minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primary },
  xlsxButton: { width: "48.5%", minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.softMint },
  pdfButtonText: { color: colors.white, fontSize: 12, fontWeight: "900", marginLeft: 7 },
  xlsxButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: "900", marginLeft: 7 },
  exportNote: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 10 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.58 },
});
