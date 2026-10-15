import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";

import { MapSheet, sheetStyles } from "../location/MapSheet";
import { monthGrid, shiftMonth } from "./dates";
import { errorMessage, loadActivityDays, type ActivityDays } from "../../services/activityHistoryService";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
type Props = {
  visible: boolean;
  childId: string | null;
  selected: string;
  today: string;
  onSelect(dateKey: string): void;
  onClose(): void;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Month calendar with a dot on each day that has records. */
export function HistoryCalendar({ visible, childId, selected, today, onSelect, onClose }: Props) {
  const styles = useStyles();
  const { colors: c } = useTheme();
  const [month, setMonth] = useState(selected);
  const [data, setData] = useState<ActivityDays | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setMonth(selected);
  }, [visible, selected]);

  const grid = monthGrid(month);

  useEffect(() => {
    if (!visible || !childId) return;
    let active = true;
    setLoading(true);
    setProblem(null);

    loadActivityDays(childId, grid.firstKey, grid.lastKey)
      .then((result) => active && setData(result))
      .catch((reason) => {
        if (!active) return;
        setData(null);
        setProblem(errorMessage(reason));
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [visible, childId, grid.firstKey, grid.lastKey]);

  const canGoForward = grid.lastKey < today;

  return (
    <MapSheet visible={visible} title="Choose a day" subtitle="Dots mark days with records" onClose={onClose}>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setMonth((value) => shiftMonth(value, -1))}
          style={styles.monthButton}
        >
          <Ionicons name="chevron-back" size={18} color={c.primary} />
        </Pressable>
        <Text style={styles.monthTitle}>{grid.title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canGoForward}
          onPress={() => setMonth((value) => shiftMonth(value, 1))}
          style={[styles.monthButton, !canGoForward && styles.disabled]}
        >
          <Ionicons name="chevron-forward" size={18} color={c.primary} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.weekday}>
            {day}
          </Text>
        ))}
        {Array.from({ length: grid.leading }, (_, index) => (
          <View key={`blank-${index}`} style={styles.cell} />
        ))}
        {grid.days.map((key) => {
          const info = data?.days[key];
          const future = key > today;
          const isSelected = key === selected;
          const dayNumber = Number(key.slice(8));

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${key}${info ? `, ${info.records} records` : ""}`}
              accessibilityState={{ selected: isSelected, disabled: future }}
              disabled={future}
              onPress={() => {
                onSelect(key);
                onClose();
              }}
              style={styles.cell}
            >
              <View style={[styles.day, isSelected && styles.daySelected, key === today && !isSelected && styles.dayToday]}>
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected, future && styles.dayTextFuture]}>
                  {dayNumber}
                </Text>
              </View>
              {info ? <View style={[styles.dot, info.sos > 0 && styles.dotSos]} /> : <View style={styles.dotSpace} />}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={c.primary} />
          <Text style={styles.statusText}>Checking which days have records</Text>
        </View>
      ) : null}
      {problem ? <Text style={[sheetStyles.note, styles.problem]}>Day markers unavailable: {problem}</Text> : null}
      {data && !data.available ? (
        <Text style={sheetStyles.note}>
          Day markers need the get_my_child_activity_days database function (migration 20261014_child_activity_days.sql).
        </Text>
      ) : null}
      <View style={styles.legend}>
        <View style={styles.dot} />
        <Text style={styles.legendText}>Records</Text>
        <View style={[styles.dot, styles.dotSos, styles.legendGap]} />
        <Text style={styles.legendText}>SOS that day</Text>
      </View>
    </MapSheet>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.sunken },
  disabled: { opacity: 0.35 },
  monthTitle: { color: c.ink, fontSize: 15, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", color: c.muted, fontSize: 11, fontWeight: "700", paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: c.primary },
  dayToday: { borderWidth: 1.5, borderColor: c.primary },
  dayText: { color: c.ink, fontSize: 13.5, fontWeight: "600" },
  dayTextSelected: { color: c.onPrimary, fontWeight: "800" },
  dayTextFuture: { color: c.ruleStrong },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2, backgroundColor: c.brand },
  dotSos: { backgroundColor: c.danger },
  dotSpace: { height: 8 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  statusText: { color: c.muted, fontSize: 12 },
  problem: { color: c.danger },
  legend: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  legendText: { marginLeft: 6, color: c.muted, fontSize: 11.5 },
  legendGap: { marginLeft: 14 },
}),
);
