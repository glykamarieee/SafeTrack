import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/ui/NativeText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { AdminStatusPill } from "../../components/admin/AdminStatusPill";
import { moveDate, todayKey } from "../../components/history/dates";
import {
  ADMIN_PAGE_SIZE,
  fetchAdminRecords,
  type AdminRecord,
  type AdminRecordKind,
} from "../../services/adminRecordsService";
import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminSpacing as spacing,
} from "../../constants/adminDesign";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { adminPalette } from "../../theme/legacy";

const TABS: { id: AdminRecordKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "sos", label: "SOS alerts", icon: "warning-outline" },
  { id: "location", label: "Location records", icon: "location-outline" },
  { id: "safety", label: "Safety events", icon: "shield-checkmark-outline" },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toneFor(record: AdminRecord): "active" | "inactive" | "warning" | "neutral" {
  if (record.kind === "sos") return record.tag === "active" ? "inactive" : record.tag === "acknowledged" ? "active" : "neutral";
  if (record.kind === "safety") return record.tag === "exit" || record.tag === "possible anomaly" ? "warning" : "neutral";
  return "neutral";
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// supabase-js errors are plain objects, not Error instances.
function messageOf(reason: unknown) {
  const message = (reason as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "Records could not be loaded.";
}

/** Administrator lists of SOS alerts, location records and safety events. */
export default function AdminRecordsScreen() {
  const styles = useStyles();
  const colors = adminPalette(useTheme().colors);

  const today = todayKey();
  const [kind, setKind] = useState<AdminRecordKind>("sos");
  const [fromKey, setFromKey] = useState(moveDate(today, -6));
  const [toKey, setToKey] = useState(today);
  const [applied, setApplied] = useState({ from: moveDate(today, -6), to: today });
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (nextPage: number) => {
      const id = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAdminRecords(kind, applied.from, applied.to, nextPage);
        if (id !== request.current) return;
        setRecords((current) => (nextPage === 0 ? result.records : [...current, ...result.records]));
        setHasMore(result.hasMore);
        setPage(nextPage);
      } catch (reason) {
        if (id !== request.current) return;
        setError(messageOf(reason));
        if (nextPage === 0) setRecords([]);
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [kind, applied],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const applyDates = () => {
    if (!DATE_PATTERN.test(fromKey) || !DATE_PATTERN.test(toKey)) {
      setError("Use dates in the form YYYY-MM-DD.");
      return;
    }
    if (fromKey > toKey) {
      setError("The start date must be on or before the end date.");
      return;
    }
    setApplied({ from: fromKey, to: toKey });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdminPageHeader
          eyebrow="RECORDS"
          title="Safety records"
          description="SOS alerts, location records and safety events across all children, newest first. Read-only."
        />

        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const selected = tab.id === kind;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setKind(tab.id)}
                style={[styles.tab, selected && styles.tabSelected]}
              >
                <Ionicons name={tab.icon} size={16} color={selected ? colors.white : colors.primaryDark} />
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.filters}>
          <DateInput label="From" value={fromKey} onChange={setFromKey} />
          <DateInput label="To" value={toKey} onChange={setToKey} />
          <Pressable accessibilityRole="button" onPress={applyDates} style={({ pressed }) => [styles.apply, pressed && styles.pressed]}>
            <Text style={styles.applyText}>Show</Text>
          </Pressable>
        </View>
        <Text style={styles.range}>
          {applied.from} to {applied.to} (Philippine time) · {records.length}
          {hasMore ? "+" : ""} shown
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load(0)}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {records.map((record, index) => (
            <View key={record.id} style={[styles.row, index > 0 && styles.rowDivider]}>
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {record.title}
                  </Text>
                  <AdminStatusPill label={record.tag} tone={toneFor(record)} />
                </View>
                <Text style={styles.rowChild}>{record.childName}</Text>
                {record.detail ? <Text style={styles.rowDetail}>{record.detail}</Text> : null}
              </View>
              <Text style={styles.rowTime}>{formatTime(record.occurredAt)}</Text>
            </View>
          ))}

          {!loading && !error && records.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={26} color={colors.muted} />
              <Text style={styles.emptyText}>No records in this date range.</Text>
            </View>
          ) : null}

          {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        </View>

        {hasMore && !loading ? (
          <Pressable onPress={() => void load(page + 1)} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
            <Text style={styles.moreText}>Load {ADMIN_PAGE_SIZE} more</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  const styles = useStyles();
  const colors = adminPalette(useTheme().colors);

  return (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={`${label} date`}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.subtle}
        autoCapitalize="none"
        style={styles.dateInput}
      />
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = adminPalette(__c);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: adminLayout.pageMax, alignSelf: "center", padding: spacing.xl, paddingBottom: 100 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabSelected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  tabText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" },
  tabTextSelected: { color: colors.white },
  filters: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 10, marginTop: 16 },
  dateField: { width: 150 },
  dateLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", marginBottom: 5 },
  dateInput: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 13,
  },
  apply: { height: 42, paddingHorizontal: 18, borderRadius: radius.md, justifyContent: "center", backgroundColor: colors.primary },
  applyText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  range: { marginTop: 10, color: colors.muted, fontSize: 11.5 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, color: colors.danger, fontSize: 12.5 },
  retry: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" },
  list: { marginTop: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden" },
  row: { flexDirection: "row", gap: 12, padding: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rowTitle: { color: colors.ink, fontSize: 13.5, fontWeight: "800", flexShrink: 1 },
  rowChild: { marginTop: 3, color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  rowDetail: { marginTop: 3, color: colors.text, fontSize: 12, lineHeight: 17 },
  rowTime: { color: colors.muted, fontSize: 11.5, maxWidth: 130, textAlign: "right" },
  empty: { alignItems: "center", gap: 6, padding: 30 },
  emptyText: { color: colors.muted, fontSize: 12.5 },
  loading: { margin: 20 },
  more: { alignSelf: "center", marginTop: 14, paddingHorizontal: 18, height: 42, borderRadius: radius.pill, justifyContent: "center", backgroundColor: colors.primarySoft },
  moreText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" },
  pressed: { opacity: 0.8 },
});
});
