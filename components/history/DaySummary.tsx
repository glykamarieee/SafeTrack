import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "../ui/NativeText";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { guardianRadius as radius, guardianShadow as shadow } from "../../constants/guardianDesign";

export type DayStatId = "records" | "distance" | "span" | "zones" | "sos";

type Props = {
  childName: string;
  /** "Today", "Yesterday" or a date. */
  dayLabel: string;
  records: number;
  distance: string;
  span: string;
  inZones: string;
  /** Share of the span spent in Safe Zones, 0..1 (null when unknown). */
  zoneShare: number | null;
  sos: number;
  /** SOS alerts of this day that are still active. */
  sosActive: number;
  loading?: boolean;
  onPress(id: DayStatId): void;
};

/** The headline for the day, from where the child spent their time. */
function headline(props: Props) {
  if (props.records === 0) return "No records on this day";
  if (props.sosActive > 0) return "SOS still needs attention";
  if (props.zoneShare == null) return "Records saved for this day";
  if (props.zoneShare >= 0.8) return "Inside Safe Zones most of the day";
  if (props.zoneShare >= 0.4) return "Partly inside Safe Zones";
  return "Mostly outside Safe Zones";
}

function description(props: Props) {
  const name = props.childName;
  if (props.records === 0) return `SafeTrack has no location records for ${name} on this day.`;
  const zones =
    props.zoneShare == null
      ? `${name} was recorded for ${props.span}`
      : `${name} spent ${props.inZones} of ${props.span} inside Safe Zones`;
  const sos =
    props.sos === 0
      ? "No SOS alerts."
      : `${props.sos} SOS alert${props.sos === 1 ? "" : "s"}${props.sosActive ? `, ${props.sosActive} still active` : ", all handled"}.`;
  return `${zones} and travelled about ${props.distance}. ${sos}`;
}

/**
 * The day at a glance, in the same style as the Safety Center "Current
 * safety pulse" card: a sentence about the day, a bar for time in Safe Zones
 * and pills for each figure. Every figure opens its explanation.
 */
export function DaySummary(props: Props) {
  const styles = useStyles();
  const { colors: theme, scheme } = useTheme();
  const { loading, zoneShare, onPress } = props;
  const alert = props.sosActive > 0;

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(1, zoneShare ?? 0)),
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [zoneShare, progress]);
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const percent = zoneShare == null ? null : Math.round(zoneShare * 100);

  return (
    <LinearGradient
      colors={alert ? ["#8F1C13", "#B42318"] : scheme === "dark" ? [theme.forest, theme.forestRaised] : ["#15803D", "#178A43"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.glow} />

      <View style={styles.topRow}>
        <View style={[styles.icon, alert && styles.iconDanger]}>
          <Ionicons name={alert ? "warning" : "footsteps"} size={25} color={alert ? "#B42318" : "#0D2A1E"} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>DAY AT A GLANCE · {props.dayLabel.toUpperCase()}</Text>
          {loading ? (
            <View style={[styles.skeleton, { width: "80%", height: 18, marginTop: 6 }]} />
          ) : (
            <Text style={styles.title}>{headline(props)}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={[styles.skeleton, { width: "95%", height: 12, marginTop: 16 }]} />
      ) : (
        <Text style={styles.description}>{description(props)}</Text>
      )}

      {/* Time in Safe Zones. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`In Safe Zones: ${props.inZones}${percent != null ? `, ${percent}% of the recorded time` : ""}. How is this calculated?`}
        onPress={() => onPress("zones")}
        style={({ pressed }) => [styles.zoneBlock, pressed && styles.pressed]}
      >
        <View style={styles.zoneLabels}>
          <View style={styles.zoneLabelLeft}>
            <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
            <Text style={styles.zoneLabel}>In Safe Zones</Text>
          </View>
          <Text style={styles.zoneValue}>{loading ? " " : percent == null ? "–" : `${percent}%  ·  ${props.inZones}`}</Text>
        </View>
        <View style={styles.track}>{!loading ? <Animated.View style={[styles.fill, { width: barWidth }]} /> : null}</View>
      </Pressable>

      <View style={styles.pills}>
        <Pill id="distance" icon="navigate" value={props.distance} label="travelled" loading={loading} onPress={onPress} />
        <Pill id="span" icon="time" value={props.span} label="recorded" loading={loading} onPress={onPress} />
        <Pill id="records" icon="pulse" value={String(props.records)} label="records" loading={loading} onPress={onPress} />
        <Pill
          id="sos"
          icon={props.sos > 0 ? "warning" : "checkmark-circle"}
          value={props.sos > 0 ? String(props.sos) : "No"}
          label="SOS"
          strong={props.sos > 0}
          loading={loading}
          onPress={onPress}
        />
      </View>
    </LinearGradient>
  );
}

function Pill({
  id,
  icon,
  value,
  label,
  strong = false,
  loading,
  onPress,
}: {
  id: DayStatId;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  strong?: boolean;
  loading?: boolean;
  onPress(id: DayStatId): void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}. How is this calculated?`}
      onPress={() => onPress(id)}
      style={({ pressed }) => [styles.pill, strong && styles.pillStrong, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={13} color={strong ? "#B42318" : "#FFFFFF"} />
      <Text numberOfLines={1} style={[styles.pillValue, strong && styles.pillStrongText]}>
        {loading ? "…" : value}
      </Text>
      <Text numberOfLines={1} style={[styles.pillLabel, strong && styles.pillStrongText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    card: { marginTop: 12, borderRadius: radius.xl, padding: 19, overflow: "hidden", ...shadow.floating },
    glow: {
      position: "absolute",
      right: -40,
      top: -55,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: "rgba(255,255,255,.08)",
    },
    topRow: { flexDirection: "row", alignItems: "center" },
    icon: { width: 56, height: 56, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#E7F6EC" },
    iconDanger: { backgroundColor: "#FDECEA" },
    copy: { flex: 1, marginLeft: 13 },
    kicker: { color: "rgba(255,255,255,.60)", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.25 },
    title: { marginTop: 4, color: "#FFFFFF", fontSize: 18, lineHeight: 22, fontWeight: "900" },
    description: { marginTop: 15, color: "rgba(255,255,255,.80)", fontSize: 11.5, lineHeight: 17 },
    zoneBlock: { marginTop: 16 },
    zoneLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    zoneLabelLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    zoneLabel: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
    zoneValue: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
    track: { marginTop: 8, height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(0,0,0,.18)" },
    fill: { height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
    pills: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 7 },
    pill: {
      minHeight: 33,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(0,0,0,.14)",
    },
    pillStrong: { backgroundColor: "#FFFFFF" },
    pillValue: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
    pillLabel: { color: "rgba(255,255,255,.75)", fontSize: 9.5, fontWeight: "700" },
    pillStrongText: { color: "#B42318" },
    skeleton: { borderRadius: 6, backgroundColor: "rgba(255,255,255,.18)" },
    pressed: { opacity: 0.75 },
  }),
);
