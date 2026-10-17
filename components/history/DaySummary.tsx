import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "../ui/NativeText";
import { makeStyles } from "../../theme/ThemeProvider";

export type DayStatId = "records" | "distance" | "span" | "zones" | "sos";

type Props = {
  records: number;
  distance: string;
  span: string;
  inZones: string;
  /** Share of the span spent in Safe Zones, 0..1 (null when unknown). */
  zoneShare: number | null;
  sos: number;
  sosActive: boolean;
  loading?: boolean;
  onPress(id: DayStatId): void;
};

const RING = 104;
const STROKE = 10;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The day at a glance: a ring for time in Safe Zones (the share of the
 * recorded span) next to four tiles. Every figure opens its explanation.
 */
export function DaySummary(props: Props) {
  const styles = useStyles();
  const { loading, zoneShare, onPress } = props;

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

  const radius = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  const percent = zoneShare == null ? null : Math.round(zoneShare * 100);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`In Safe Zones: ${props.inZones}${percent != null ? `, ${percent}% of the recorded time` : ""}. How is this calculated?`}
        onPress={() => onPress("zones")}
        style={({ pressed }) => [styles.ringSide, pressed && styles.pressed]}
      >
        <View style={styles.ring}>
          <Svg width={RING} height={RING}>
            <Circle cx={RING / 2} cy={RING / 2} r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth={STROKE} fill="none" />
            {!loading ? (
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={radius}
                stroke="#3DDC84"
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            ) : null}
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            {loading ? (
              <View style={[styles.skeleton, { width: 40, height: 18 }]} />
            ) : (
              <>
                <Text style={styles.ringValue}>{percent == null ? "–" : `${percent}%`}</Text>
                <Text style={styles.ringCaption}>in zones</Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.zoneTime}>
          <Ionicons name="shield-checkmark" size={12} color="#3DDC84" />
          <Text numberOfLines={1} style={styles.zoneTimeText}>
            {loading ? " " : props.inZones}
          </Text>
        </View>
      </Pressable>

      <View style={styles.grid}>
        <Tile id="distance" icon="navigate" tint="#7CC4FF" value={props.distance} label="Distance" loading={loading} onPress={onPress} />
        <Tile id="span" icon="time" tint="#FFD27A" value={props.span} label="Span" loading={loading} onPress={onPress} />
        <Tile id="records" icon="pulse" tint="#B9A6FF" value={String(props.records)} label="Records" loading={loading} onPress={onPress} />
        <Tile
          id="sos"
          icon={props.sos > 0 ? "warning" : "checkmark-circle"}
          tint={props.sos > 0 ? "#FF6B5C" : "#3DDC84"}
          value={props.sos > 0 ? String(props.sos) : "None"}
          label={props.sos > 0 ? (props.sosActive ? "SOS · active" : "SOS") : "SOS"}
          alert={props.sos > 0}
          loading={loading}
          onPress={onPress}
        />
      </View>
    </View>
  );
}

function Tile({
  id,
  icon,
  tint,
  value,
  label,
  alert = false,
  loading,
  onPress,
}: {
  id: DayStatId;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  label: string;
  alert?: boolean;
  loading?: boolean;
  onPress(id: DayStatId): void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. How is this calculated?`}
      onPress={() => onPress(id)}
      style={({ pressed }) => [styles.tile, alert && styles.tileAlert, pressed && styles.pressed]}
    >
      <View style={[styles.tileIcon, { backgroundColor: `${tint}26` }]}>
        <Ionicons name={icon} size={13} color={tint} />
      </View>
      {loading ? (
        <View style={[styles.skeleton, { width: 46, height: 14, marginTop: 7 }]} />
      ) : (
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileValue, alert && { color: tint }]}>
          {value}
        </Text>
      )}
      <Text numberOfLines={1} style={styles.tileLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 26,
      backgroundColor: c.forest,
    },
    ringSide: { alignItems: "center", paddingVertical: 2 },
    ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
    ringCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    ringValue: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
    ringCaption: { color: "#9FC3AE", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginTop: -2 },
    zoneTime: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
    zoneTimeText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" },
    grid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tile: {
      width: "47%",
      flexGrow: 1,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.07)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.06)",
    },
    tileAlert: { backgroundColor: "rgba(255,107,92,0.14)", borderColor: "rgba(255,107,92,0.35)" },
    tileIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    tileValue: { marginTop: 6, color: "#FFFFFF", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
    tileLabel: { marginTop: 1, color: "#9FC3AE", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    skeleton: { borderRadius: 6, backgroundColor: "rgba(255,255,255,0.12)" },
    pressed: { opacity: 0.75 },
  }),
);
