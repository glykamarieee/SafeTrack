import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  backgroundSharingSupported,
  isBackgroundSharingOn,
  startBackgroundSharing,
  stopBackgroundSharing,
} from "../../services/childBackgroundLocation";
import { isExpoGo } from "./mapSupport";

/** The child's own switch for automatic location sharing (consent). */
export function AutoShareToggle() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);

  const supported = backgroundSharingSupported() && !isExpoGo;

  const refresh = useCallback(async () => {
    setOn(await isBackgroundSharingOn());
  }, []);

  useEffect(() => {
    if (supported) void refresh();
  }, [supported, refresh]);

  const toggle = async (value: boolean) => {
    setBusy(true);
    setProblem(null);
    setNeedsSettings(false);
    try {
      if (!value) {
        await stopBackgroundSharing();
      } else {
        const result = await startBackgroundSharing();
        if (result === "foreground-denied") {
          setProblem("Location access was not allowed.");
          setNeedsSettings(true);
        } else if (result === "background-denied") {
          setProblem('Choose "Allow all the time" for location to share while SafeTrack is closed.');
          setNeedsSettings(true);
        } else if (result === "unavailable") {
          setProblem("Automatic sharing is not available on this device.");
        }
      }
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : "Automatic sharing could not be changed.");
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <View style={styles.card}>
        <Ionicons name="information-circle-outline" size={18} color="#5F6B66" />
        <Text style={styles.note}>
          Automatic sharing works in the installed SafeTrack app (not in Expo Go or a browser). Use "Share latest location" here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={on ? "radio" : "radio-outline"} size={20} color={on ? "#137A50" : "#5F6B66"} />
        <View style={styles.copy}>
          <Text style={styles.title}>Share location automatically</Text>
          <Text style={styles.note}>
            {on
              ? "On. Your location is sent about every 5 minutes, or when you move 100 m, even when SafeTrack is closed."
              : "Off. Your location is only sent when you tap Share latest location."}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Share location automatically"
          value={on}
          disabled={busy}
          onValueChange={(value) => void toggle(value)}
          trackColor={{ true: "#7FCBA8", false: "#D5DDD9" }}
          thumbColor={on ? "#137A50" : "#FFFFFF"}
        />
      </View>
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      {needsSettings ? (
        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
          <Text style={styles.link}>Open settings</Text>
        </Pressable>
      ) : null}
      {on ? (
        <Text style={styles.small}>After the phone restarts, open SafeTrack once to resume sharing.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE9E3",
    flexDirection: "column",
    gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1 },
  title: { color: "#14211B", fontSize: 13.5, fontWeight: "800" },
  note: { flex: 1, color: "#5F6B66", fontSize: 11.5, lineHeight: 16 },
  problem: { color: "#B3261E", fontSize: 12, lineHeight: 17 },
  link: { color: "#137A50", fontSize: 12.5, fontWeight: "800" },
  small: { color: "#7A8681", fontSize: 11 },
});
