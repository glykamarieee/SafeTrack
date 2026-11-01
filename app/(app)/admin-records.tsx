import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { TextInput } from "../../components/ui/NativeText";
import { Text } from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import { Rise, Skeleton, TonePill, TopBar, toneFor, useTone, type IconName, type ToneKey } from "../../components/admin/kit";
import { moveDate, todayKey } from "../../components/history/dates";
import { ADMIN_PAGE_SIZE, fetchAdminRecords, type AdminRecord, type AdminRecordKind } from "../../services/adminRecordsService";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius } from "../../theme/tokens";

const TABS: { id: AdminRecordKind; label: string; icon: IconName }[] = [
  { id: "sos", label: "SOS alerts", icon: "warning-outline" },
  { id: "location", label: "Location records", icon: "location-outline" },
  { id: "safety", label: "Safety events", icon: "shield-checkmark-outline" },
];

type Preset = "today" | "yesterday" | "7" | "30" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "custom", label: "Custom" },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TAG_LABELS: Record<string, string> = {
  active: "Active",
  acknowledged: "Acknowledged",
  cancelled: "Cancelled",
  entry: "Entered zone",
  exit: "Left zone",
  "possible anomaly": "AI notice · advisory",
  "watch disconnected": "Watch offline",
  "prolonged inactivity": "Inactivity",
  watch: "Smartwatch",
  phone: "Phone",
};

function rangeFor(preset: Exclude<Preset, "custom">, today: string) {
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") {
    const day = moveDate(today, -1);
    return { from: day, to: day };
  }
  return { from: moveDate(today, -(Number(preset) - 1)), to: today };
}

function dayKeyOf(value: string) {
  return new Date(Date.parse(value) + 8 * 3_600_000).toISOString().slice(0, 10);
}

function dayHeading(key: string, today: string) {
  if (key === today) return "Today";
  if (key === moveDate(today, -1)) return "Yesterday";
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

function clock(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
}

function toneOf(record: AdminRecord): ToneKey {
  if (record.kind === "location") return record.tag === "phone" ? "inactivity" : "ok";
  return toneFor(record.tag);
}

// supabase-js errors are plain objects, not Error instances.
function messageOf(reason: unknown) {
  const message = (reason as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "Records could not be loaded.";
}

/** Administrator timeline of SOS alerts, location records and safety events, by Philippine day. */
export default function AdminRecordsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();

  const today = todayKey();
  const [kind, setKind] = useState<AdminRecordKind>("sos");
  const [preset, setPreset] = useState<Preset>("7");
  const [fromKey, setFromKey] = useState(moveDate(today, -6));
  const [toKey, setToKey] = useState(today);
  const [applied, setApplied] = useState({ from: moveDate(today, -6), to: today });
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
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
        setTotal(result.total);
        setPage(nextPage);
        setUpdatedAt(new Date().toISOString());
      } catch (reason) {
        if (id !== request.current) return;
        setError(messageOf(reason));
        if (nextPage === 0) {
          setRecords([]);
          setTotal(0);
        }
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [kind, applied],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const choose = (next: Preset) => {
    setPreset(next);
    if (next === "custom") return;
    const range = rangeFor(next, today);
    setFromKey(range.from);
    setToKey(range.to);
    setApplied(range);
  };

  const applyCustom = () => {
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

  // Day groups, newest first.
  const groups = useMemo(() => {
    const map = new Map<string, AdminRecord[]>();
    for (const record of records) {
      const key = dayKeyOf(record.occurredAt);
      const list = map.get(key) ?? [];
      list.push(record);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [records]);

  // The ScrollView's children: header blocks, then per day a sticky heading and its entries.
  const children: ReactElement[] = [];
  const sticky: number[] = [];
  children.push(
    <View key="top" style={styles.top}>
      <Rise index={0}>
        <TopBar
          crumb="Records"
          title="Safety records"
          subtitle="Every SOS alert, location record and safety event across all children, newest first. Read-only."
          updatedAt={updatedAt}
        />
      </Rise>

      <Rise index={1} style={[styles.segment, { backgroundColor: colors.sunken }]}>
        {TABS.map((tab) => {
          const selected = tab.id === kind;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setKind(tab.id)}
              style={[styles.segmentItem, selected && [styles.segmentOn, { backgroundColor: colors.surface }]]}
            >
              <Ionicons name={tab.icon} size={16} color={selected ? colors.primary : colors.muted} />
              <Text variant="label" weight={selected ? "800" : "600"} tone={selected ? "ink" : "muted"}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </Rise>

      <Rise index={2} style={styles.filters}>
        <View style={styles.presets}>
          {PRESETS.map((item) => {
            const selected = item.id === preset;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => choose(item.id)}
                style={(state) => [
                  styles.preset,
                  { borderColor: selected ? colors.primary : colors.rule, backgroundColor: selected ? colors.primaryTint : colors.surface },
                  !selected && (state as { hovered?: boolean }).hovered && { borderColor: colors.ruleStrong },
                ]}
              >
                <Text variant="label" weight="800" tone={selected ? "primary" : "ink2"}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {preset === "custom" ? (
          <View style={styles.custom}>
            <DateInput label="From" value={fromKey} onChange={setFromKey} />
            <DateInput label="To" value={toKey} onChange={setToKey} />
            <Button label="Show" size="sm" onPress={applyCustom} />
          </View>
        ) : null}
        <Text variant="caption" tone="muted">
          {dayHeading(applied.from, today)}
          {applied.from !== applied.to ? ` to ${dayHeading(applied.to, today)}` : ""} · Philippine time · {total.toLocaleString()}{" "}
          {total === 1 ? "record" : "records"}
        </Text>
      </Rise>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.dangerTint }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text variant="label" style={{ flex: 1, color: colors.danger }}>
            {error}
          </Text>
          <Button label="Retry" size="sm" variant="soft" onPress={() => void load(0)} />
        </View>
      ) : null}
    </View>,
  );

  if (loading && records.length === 0) {
    children.push(
      <View key="skeleton" style={styles.block}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View key={index} style={styles.entry}>
            <Skeleton width={56} height={12} />
            <Skeleton width={12} height={12} radius={6} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="70%" height={11} />
            </View>
          </View>
        ))}
      </View>,
    );
  } else if (!error && records.length === 0) {
    children.push(
      <View key="empty" style={[styles.empty, { borderColor: colors.ruleStrong }]}>
        <Ionicons name="file-tray-outline" size={28} color={colors.muted} />
        <Text weight="800">No records in this period</Text>
        <Text variant="caption" tone="muted" align="center">
          Try a longer range, or another tab.
        </Text>
      </View>,
    );
  }

  groups.forEach(([day, list], groupIndex) => {
    // The oldest day shown may continue on the next page.
    const partial = hasMore && groupIndex === groups.length - 1;
    sticky.push(children.length);
    children.push(
      <View key={`h-${day}`} style={[styles.dayHead, { backgroundColor: colors.paper }]}>
        <Text variant="heading" weight="800">
          {dayHeading(day, today)}
        </Text>
        <Text variant="caption" tone="muted">
          {new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} · {list.length}
          {partial ? "+" : ""} {list.length === 1 && !partial ? "record" : "records"}
        </Text>
      </View>,
    );
    children.push(
      <View key={`d-${day}`} style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
        {list.map((record, index) => (
          <Entry key={record.id} record={record} last={index === list.length - 1} />
        ))}
      </View>,
    );
  });

  if (hasMore || (loading && records.length > 0)) {
    children.push(
      <View key="more" style={styles.more}>
        {loading ? <ActivityIndicator color={colors.primary} /> : <Button label={`Load ${ADMIN_PAGE_SIZE} more`} variant="soft" size="sm" onPress={() => void load(page + 1)} />}
      </View>,
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={sticky}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Entry({ record, last }: { record: AdminRecord; last: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = toneOf(record);
  const t = useTone(tone);
  return (
    <View style={styles.entry}>
      <Text variant="caption" weight="800" tone="ink2" tabular style={styles.time}>
        {clock(record.occurredAt)}
      </Text>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: t.fg, borderColor: colors.surface }]} />
        {!last ? <View style={[styles.line, { backgroundColor: colors.rule }]} /> : null}
      </View>
      <View style={styles.entryBody}>
        <View style={styles.entryTop}>
          <Text weight="800" numberOfLines={1} style={{ flexShrink: 1 }}>
            {record.title}
          </Text>
          <TonePill tone={tone} label={TAG_LABELS[record.tag] ?? record.tag} center />
        </View>
        <Text variant="caption" weight="800" tone="primary">
          {record.childName}
        </Text>
        {record.detail ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {record.detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.dateField}>
      <Text variant="caption" weight="800" tone="muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={`${label} date`}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={[styles.dateInput, { borderColor: colors.rule, backgroundColor: colors.surface, color: colors.ink }]}
      />
    </View>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    safe: { flex: 1 },
    content: { width: "100%", maxWidth: 1100, alignSelf: "center", padding: 24, paddingTop: 30, paddingBottom: 120 },
    top: { gap: 16, marginBottom: 8 },
    segment: { flexDirection: "row", flexWrap: "wrap", alignSelf: "flex-start", padding: 4, borderRadius: 14, gap: 4 },
    segmentItem: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, height: 40, borderRadius: 11 },
    segmentOn: { shadowColor: "#0D2A1E", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    filters: { gap: 10 },
    presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    preset: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, justifyContent: "center" },
    custom: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 10 },
    dateField: { width: 150, gap: 5 },
    dateInput: { height: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, fontSize: 13 },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12 },
    dayHead: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingTop: 16, paddingBottom: 10 },
    block: { borderRadius: radius.md, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 14 },
    entry: { flexDirection: "row", gap: 12, paddingVertical: 10 },
    time: { width: 66, textAlign: "right", paddingTop: 2 },
    rail: { width: 14, alignItems: "center" },
    dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, marginTop: 2 },
    line: { position: "absolute", top: 18, bottom: -12, width: 2 },
    entryBody: { flex: 1, minWidth: 0, gap: 2 },
    entryTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    empty: { alignItems: "center", gap: 6, padding: 32, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", marginTop: 8 },
    more: { alignItems: "center", paddingVertical: 18 },
  }),
);
