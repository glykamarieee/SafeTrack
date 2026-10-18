import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { Skeleton, TonePill, phTime } from "./kit";
import { useTheme } from "../../theme/ThemeProvider";
import { radius } from "../../theme/tokens";
import type { ActivityReport } from "../../types/safetrack";

const STEPS = ["Gathering stored records", "Designing the pages", "Saving the file securely"];

/** While generate-report works: an animated bar and the current step. */
export function ReportProgress({ format }: { format: "pdf" | "xlsx" }) {
  const { colors, reduceMotion } = useTheme();
  const sweep = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [sweep, reduceMotion]);

  useEffect(() => {
    const timer = setInterval(() => setStep((value) => Math.min(STEPS.length - 1, value + 1)), 1600);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: colors.primaryTint, borderColor: colors.rule }]} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Ionicons name={format === "pdf" ? "document-text" : "grid"} size={18} color={colors.primary} />
        <Text weight="800">Building your {format === "pdf" ? "PDF" : "Excel"} report…</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface }]}>
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: colors.primary,
              left: sweep.interpolate({ inputRange: [0, 1], outputRange: ["-35%", "100%"] }),
            },
          ]}
        />
      </View>
      {STEPS.map((label, index) => (
        <View key={label} style={styles.row}>
          <Ionicons
            name={index < step ? "checkmark-circle" : index === step ? "ellipse" : "ellipse-outline"}
            size={14}
            color={index <= step ? colors.primary : colors.muted}
          />
          <Text variant="caption" tone={index <= step ? "ink" : "muted"} weight={index === step ? "800" : "500"}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** After a successful export: what was made, and a download-again button. */
export function ReportReady({
  format,
  recordCount,
  generatedAt,
  onDownload,
  downloading,
}: {
  format: "pdf" | "xlsx";
  recordCount: number;
  generatedAt: string;
  onDownload: () => void;
  downloading: boolean;
}) {
  const { colors, reduceMotion } = useTheme();
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0.9)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: false, speed: 14, bounciness: 8 }).start();
  }, [pop]);
  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.brand, transform: [{ scale: pop }] }]}>
      <View style={styles.row}>
        <View style={[styles.okIcon, { backgroundColor: colors.primaryTint }]}>
          <Ionicons name="checkmark" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight="800">{format === "pdf" ? "PDF" : "Excel"} report ready</Text>
          <Text variant="caption" tone="muted">
            {recordCount.toLocaleString("en-PH")} records · generated {phTime(generatedAt)} (PHT)
          </Text>
        </View>
      </View>
      <Button label="Download again" variant="soft" size="sm" icon="download-outline" loading={downloading} onPress={onDownload} />
      <Text variant="caption" tone="muted">
        The download link stays valid for one hour.
      </Text>
    </Animated.View>
  );
}

/** The reports generated before, newest first. */
export function ReportHistory({ reports }: { reports: ActivityReport[] | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.history, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
      <View style={styles.historyHead}>
        <Text variant="heading" weight="800">
          Previous reports
        </Text>
        <Text variant="caption" tone="muted">
          {reports ? `${reports.length} generated` : ""}
        </Text>
      </View>
      {reports === null ? (
        <View style={{ gap: 10 }}>
          <Skeleton width="100%" height={44} radius={12} />
          <Skeleton width="100%" height={44} radius={12} />
        </View>
      ) : reports.length === 0 ? (
        <Text variant="caption" tone="muted">
          No report has been generated yet.
        </Text>
      ) : (
        reports.slice(0, 8).map((report, index) => {
          const pdf = String(report.exportFormat).toLowerCase().includes("pdf");
          return (
            <View key={report.id} style={[styles.historyRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.rule }]}>
              <View style={[styles.fileIcon, { backgroundColor: pdf ? colors.dangerTint : colors.primaryTint }]}>
                <Ionicons name={pdf ? "document-text" : "grid"} size={16} color={pdf ? colors.danger : colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="700" numberOfLines={1}>
                  {report.title || "SafeTrack Activity Report"}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {String(report.rangeStart).slice(0, 10)} to {String(report.rangeEnd).slice(0, 10)} · {phTime(report.generatedAt)} PHT
                </Text>
              </View>
              <TonePill tone={pdf ? "active" : "ok"} label={pdf ? "PDF" : "Excel"} icon={false} center />
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: 16, gap: 10, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  bar: { position: "absolute", top: 0, bottom: 0, width: "35%", borderRadius: 3 },
  okIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  history: { borderRadius: radius.md, borderWidth: 1, padding: 20, gap: 10, marginTop: 20 },
  historyHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  fileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
