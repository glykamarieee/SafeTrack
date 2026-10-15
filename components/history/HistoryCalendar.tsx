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
          <Ionicons name="chevron-back" size={18} color="#137A50" />
        </Pressable>
        <Text style={styles.monthTitle}>{grid.title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canGoForward}
          onPress={() => setMonth((value) => shiftMonth(value, 1))}
          style={[styles.monthButton, !canGoForward && styles.disabled]}
        >
          <Ionicons name="chevron-forward" size={18} color="#137A50" />
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
          <ActivityIndicator size="small" color="#137A50" />
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

const styles = StyleSheet.create({
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF4F1" },
  disabled: { opacity: 0.35 },
  monthTitle: { color: "#14211B", fontSize: 15, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", color: "#7A8681", fontSize: 11, fontWeight: "700", paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: "#137A50" },
  dayToday: { borderWidth: 1.5, borderColor: "#137A50" },
  dayText: { color: "#1E2B25", fontSize: 13.5, fontWeight: "600" },
  dayTextSelected: { color: "#FFFFFF", fontWeight: "800" },
  dayTextFuture: { color: "#B9C3BE" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2, backgroundColor: "#2DBE84" },
  dotSos: { backgroundColor: "#D93025" },
  dotSpace: { height: 8 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  statusText: { color: "#66736D", fontSize: 12 },
  problem: { color: "#B3261E" },
  legend: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  legendText: { marginLeft: 6, color: "#66736D", fontSize: 11.5 },
  legendGap: { marginLeft: 14 },
});
