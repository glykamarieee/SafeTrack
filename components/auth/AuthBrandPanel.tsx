import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";

import { MapPattern } from "../ui/MapPattern";
import { Text } from "../ui/Text";
import { useDrift, useEntrance } from "../../theme/motion";
import { useTheme } from "../../theme/ThemeProvider";

/** The scene is drawn in this box and scaled to the panel width. */
const VIEW_W = 520;
const VIEW_H = 240;

/** The child's trip, home (first point) to school (last), along the drawn roads. */
const ROUTE: [number, number][] = [
  [58, 190],
  [140, 190],
  [168, 132],
  [270, 122],
  [300, 74],
  [418, 74],
  [452, 104],
];
const ROUTE_D = ROUTE.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
const SCHOOL = ROUTE[ROUTE.length - 1];
const HOME = ROUTE[0];

/** Share of the trip reached at each route point, by distance, so the dot moves at a steady pace. */
const STOPS = (() => {
  const lengths = ROUTE.slice(1).map(([x, y], index) => Math.hypot(x - ROUTE[index][0], y - ROUTE[index][1]));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let run = 0;
  return [0, ...lengths.map((value) => (run += value) / total)];
})();

const CHIPS: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; text: string }[] = [
  { icon: "home", color: "#3DDC84", title: "Left Home", text: "On the way to school" },
  { icon: "navigate", color: "#7CC4FF", title: "Latest location", text: "Following real roads" },
  { icon: "shield-checkmark", color: "#3DDC84", title: "Arrived at School", text: "Inside the safe zone" },
];

const POINTS = [
  { icon: "watch-outline" as const, text: "Smartwatch or phone" },
  { icon: "shield-checkmark-outline" as const, text: "Safe zones & SOS" },
  { icon: "sparkles-outline" as const, text: "AI notices" },
];

/**
 * The left half of the sign-in screens on a laptop: forest gradient, drifting
 * street lines, and a small animated scene of what SafeTrack does (a trip on
 * real roads ending inside a safe zone). Decorative: hidden from screen readers.
 */
export function AuthBrandPanel({ headline, lead }: { headline: string; lead: string }) {
  const { reduceMotion } = useTheme();
  const { height } = useWindowDimensions();
  const roomy = height >= 760;
  const drift = useDrift(18000);
  const enter = useEntrance(0, 18, 650);

  const trip = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const chipFade = useRef(new Animated.Value(1)).current;
  const [chip, setChip] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      trip.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(trip, { toValue: 0, duration: 0, useNativeDriver: false }),
        Animated.delay(500),
        Animated.timing(trip, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.delay(2200),
      ]),
    );
    const pulse = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: false }));
    loop.start();
    pulse.start();
    return () => {
      loop.stop();
      pulse.stop();
    };
  }, [reduceMotion, ring, trip]);

  // The status chip follows the trip: left home, on the way, arrived.
  useEffect(() => {
    if (reduceMotion) {
      setChip(2);
      return;
    }
    const id = trip.addListener(({ value }) => {
      const next = value < 0.08 ? 0 : value < 0.98 ? 1 : 2;
      setChip((current) => {
        if (current === next) return current;
        chipFade.setValue(0);
        Animated.timing(chipFade, { toValue: 1, duration: 320, useNativeDriver: false }).start();
        return next;
      });
    });
    return () => trip.removeListener(id);
  }, [chipFade, reduceMotion, trip]);

  const left = trip.interpolate({ inputRange: STOPS, outputRange: ROUTE.map(([x]) => `${(x / VIEW_W) * 100}%`) });
  const top = trip.interpolate({ inputRange: STOPS, outputRange: ROUTE.map(([, y]) => `${(y / VIEW_H) * 100}%`) });
  const current = CHIPS[chip];

  return (
    <LinearGradient colors={["#0D2A1E", "#123A28", "#15803D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.panel}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { right: -60, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }] }]}
      >
        <MapPattern opacity={0.06} />
      </Animated.View>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <Animated.View style={[styles.inner, enter]}>
        <Image source={require("../../assets/images/logo.png")} resizeMode="contain" style={styles.logo} accessibilityLabel="SafeTrack" />

        <View style={styles.copy}>
          <Text variant="legend" style={styles.eyebrow}>
            Child safety, made calm
          </Text>
          <Text variant="display" style={styles.headline}>
            {headline}
          </Text>
          <Text style={styles.lead}>{lead}</Text>
        </View>

        {/* The scene: roads, the trip, home and the school safe zone. */}
        <View style={styles.scene} accessible={false} importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
            <Path
              d="M0 190 L520 190 M0 122 L520 122 M0 74 L520 74 M168 0 L168 240 M300 0 L300 240 M452 0 L452 240 M60 0 L100 240"
              stroke="#FFFFFF"
              strokeOpacity={0.07}
              strokeWidth={14}
            />
            <Path d={ROUTE_D} stroke="#0D2A1E" strokeOpacity={0.55} strokeWidth={9} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Path d={ROUTE_D} stroke="#3DDC84" strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={SCHOOL[0]} cy={SCHOOL[1]} r={40} fill="#3DDC84" fillOpacity={0.12} stroke="#3DDC84" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="5 5" />
          </Svg>

          <Animated.View
            style={[
              styles.ring,
              {
                left: `${(SCHOOL[0] / VIEW_W) * 100}%`,
                top: `${(SCHOOL[1] / VIEW_H) * 100}%`,
                opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }],
              },
            ]}
          />

          <Pin x={HOME[0]} y={HOME[1]} icon="home" label="Home" />
          <Pin x={SCHOOL[0]} y={SCHOOL[1]} icon="school" label="School" />

          <Animated.View style={[styles.child, { left, top }]}>
            <View style={styles.childDot} />
          </Animated.View>

          <Animated.View style={[styles.chip, { opacity: chipFade }]}>
            <View style={[styles.chipIcon, { backgroundColor: `${current.color}26` }]}>
              <Ionicons name={current.icon} size={15} color={current.color} />
            </View>
            <View>
              <Text weight="800" style={styles.chipTitle}>
                {current.title}
              </Text>
              <Text style={styles.chipText}>{current.text}</Text>
            </View>
          </Animated.View>
        </View>

        {roomy ? (
          <View style={styles.points}>
            {POINTS.map((point) => (
              <View key={point.text} style={styles.point}>
                <Ionicons name={point.icon} size={15} color="#3DDC84" />
                <Text weight="700" style={styles.pointText}>
                  {point.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </LinearGradient>
  );
}

function Pin({ x, y, icon, label }: { x: number; y: number; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={[styles.pinWrap, { left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` }]}>
      <View style={styles.pin}>
        <Ionicons name={icon} size={14} color="#0D2A1E" />
      </View>
      <Text weight="800" style={styles.pinLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1.15, overflow: "hidden", justifyContent: "center" },
  glow: { position: "absolute", borderRadius: 999 },
  glowTop: { width: 560, height: 560, top: -240, right: -180, backgroundColor: "rgba(61,220,132,0.13)" },
  glowBottom: { width: 440, height: 440, bottom: -240, left: -140, backgroundColor: "rgba(255,255,255,0.06)" },
  inner: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 56, paddingVertical: 40, gap: 26 },
  logo: { width: 150, height: 88, marginLeft: -8 },
  copy: { gap: 10 },
  eyebrow: { color: "#3DDC84" },
  headline: { color: "#FFFFFF", fontSize: 40, lineHeight: 46 },
  lead: { color: "rgba(255,255,255,0.76)", fontSize: 15, lineHeight: 23, maxWidth: 500 },
  scene: {
    height: 240,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  ring: { position: "absolute", width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: 60, borderWidth: 2, borderColor: "#3DDC84" },
  pinWrap: { position: "absolute", alignItems: "center", marginLeft: -14, marginTop: -14, width: 28 },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#3DDC84",
  },
  pinLabel: { color: "#FFFFFF", fontSize: 11, marginTop: 4, width: 80, textAlign: "center" },
  child: { position: "absolute", width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 17, backgroundColor: "rgba(61,220,132,0.3)", alignItems: "center", justifyContent: "center" },
  childDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF", borderWidth: 4, borderColor: "#15803D" },
  chip: {
    position: "absolute",
    left: 16,
    top: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 16,
    borderRadius: 16,
    backgroundColor: "rgba(13,42,30,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  chipTitle: { color: "#FFFFFF", fontSize: 13 },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 11.5 },
  points: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  point: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pointText: { color: "#FFFFFF", fontSize: 12.5 },
});
