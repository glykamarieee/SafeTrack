import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Text } from "../ui/Text";
import { nativeDriver } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, shadow, space } from "../../theme/tokens";

/**
 * Onboarding illustrations, drawn in code. Each scene plays its animation
 * when `active` (its page is on screen) and stays still with Reduce Motion.
 */
export type SceneName = "pin" | "zone" | "sos" | "route" | "bell" | "share" | "hold" | "auto" | "done";

const SIZE = 280;

function useTimeline(active: boolean, build: (value: Animated.Value) => Animated.CompositeAnimation, loop = false) {
  const { reduceMotion } = useTheme();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      value.setValue(0);
      return;
    }
    if (reduceMotion) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    const animation = loop ? Animated.loop(build(value)) : build(value);
    animation.start();
    return () => animation.stop();
    // `build` is a stable inline description of the scene's motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduceMotion, loop, value]);

  return value;
}

const timing = (value: Animated.Value, toValue: number, duration: number, delay = 0, easing = Easing.out(Easing.cubic)) =>
  Animated.timing(value, { toValue, duration, delay, easing, useNativeDriver: nativeDriver });

/** A soft rounded map: grey ground, white streets, green parks. */
function MapTile({ children, tint }: { children?: ReactNode; tint?: string }) {
  const { colors, scheme } = useTheme();
  const street = scheme === "dark" ? "#1A2C22" : "#FFFFFF";
  const park = scheme === "dark" ? "#163D2B" : "#CFE6D6";

  return (
    <View style={[stylesStatic.map, { backgroundColor: tint ?? colors.mapGround }]}>
      <Svg width="100%" height="100%" viewBox="0 0 280 280" style={StyleSheet.absoluteFill}>
        <Rect x={22} y={26} width={70} height={52} rx={8} fill={park} />
        <Rect x={196} y={190} width={64} height={60} rx={8} fill={park} />
        <Path d="M-10 110 L290 92 M-10 200 L290 186 M96 -10 L112 290 M196 -10 L184 290" stroke={street} strokeWidth={14} />
        <Path d="M-10 40 L290 150 M40 -10 L28 290 M248 -10 L258 290" stroke={street} strokeWidth={6} />
      </Svg>
      {children}
    </View>
  );
}

function Pin({ color, size = 44 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 40 48">
      <Path d="M20 2 C10 2 3 9 3 18 C3 31 20 46 20 46 C20 46 37 31 37 18 C37 9 30 2 20 2 Z" fill={color} stroke="#FFFFFF" strokeWidth={2.5} />
      <Circle cx={20} cy={18} r={6.5} fill="#FFFFFF" />
    </Svg>
  );
}

function Ripple({ progress, color, size, delay = 0 }: { progress: Animated.Value; color: string; size: number; delay?: number }) {
  const local = Animated.modulo(Animated.add(progress, delay), 1);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        opacity: local.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
        transform: [{ scale: local.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.35] }) }],
      }}
    />
  );
}

function FloatCard({ children, style }: { children: ReactNode; style?: object }) {
  const styles = useStyles();
  return <Animated.View style={[styles.floatCard, style]}>{children}</Animated.View>;
}

/** Guardian 1: a pin drops into a safe zone and a check pops. */
function PinScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const drop = useTimeline(active, (v) => timing(v, 1, 900, 200, Easing.bounce));
  const ripple = useTimeline(active, (v) => Animated.sequence([timing(v, 1, 2200, 0, Easing.out(Easing.quad)), timing(v, 0, 0)]), true);
  const check = useTimeline(active, (v) => timing(v, 1, 450, 1100, Easing.out(Easing.back(2))));

  return (
    <MapTile>
      <View style={stylesStatic.center}>
        <View style={[stylesStatic.zone, { borderColor: colors.brand, backgroundColor: `${colors.brand}22` }]} />
        <Ripple progress={ripple} color={colors.brand} size={150} />
        <Animated.View style={{ transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-120, -22] }) }], opacity: drop.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }) }}>
          <Pin color={colors.primary} size={48} />
        </Animated.View>
      </View>
      <FloatCard style={{ top: 22, right: 18, opacity: check, transform: [{ scale: check }] }}>
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        <Text variant="caption" tone="ink" weight="700">Safe at School</Text>
      </FloatCard>
    </MapTile>
  );
}

/** Guardian 2: a safe-zone circle grows from its centre with a size handle. */
function ZoneScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const grow = useTimeline(active, (v) => timing(v, 1, 1100, 250, Easing.out(Easing.back(1.4))));
  const label = useTimeline(active, (v) => timing(v, 1, 400, 1200));

  return (
    <MapTile>
      <View style={stylesStatic.center}>
        <Animated.View
          style={[
            stylesStatic.zoneBig,
            { borderColor: colors.brand, backgroundColor: `${colors.brand}26`, transform: [{ scale: grow }] },
          ]}
        >
          <View style={[stylesStatic.handle, { backgroundColor: colors.surface, borderColor: colors.primary }]} />
        </Animated.View>
        <View style={[stylesStatic.centerDot, { backgroundColor: colors.primary }]} />
      </View>
      <FloatCard style={{ bottom: 22, left: 18, opacity: label, transform: [{ translateY: label.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Ionicons name="school-outline" size={18} color={colors.primary} />
        <Text variant="caption" tone="ink" weight="700">School · 150 m</Text>
      </FloatCard>
    </MapTile>
  );
}

/** Guardian 3: a red SOS ring pulses and an alert card slides in. */
function SosScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const pulse = useTimeline(active, (v) => Animated.sequence([timing(v, 1, 1400, 0, Easing.out(Easing.quad)), timing(v, 0, 0)]), true);
  const card = useTimeline(active, (v) => timing(v, 1, 500, 500, Easing.out(Easing.back(1.5))));

  return (
    <View style={[stylesStatic.map, { backgroundColor: colors.dangerTint }]}>
      <View style={stylesStatic.center}>
        <Ripple progress={pulse} color={colors.danger} size={200} />
        <Ripple progress={pulse} color={colors.danger} size={200} delay={0.5} />
        <View style={[stylesStatic.sosButton, { backgroundColor: colors.danger }]}>
          <Text variant="title" tone="onDanger" weight="800">SOS</Text>
        </View>
      </View>
      <FloatCard style={{ top: 20, left: 16, right: 16, opacity: card, transform: [{ translateY: card.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }] }}>
        <View style={[stylesStatic.badge, { backgroundColor: colors.danger }]}>
          <Ionicons name="alert" size={14} color={colors.onDanger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="ink" weight="800">Ana needs help</Text>
          <Text variant="caption">Held SOS on her watch · now</Text>
        </View>
      </FloatCard>
    </View>
  );
}

/** Guardian 4: the day's route is revealed left to right, stops pop in. */
function RouteScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const reveal = useTimeline(active, (v) => timing(v, 1, 1800, 200, Easing.inOut(Easing.cubic)));

  return (
    <MapTile>
      <Svg width="100%" height="100%" viewBox="0 0 280 280" style={StyleSheet.absoluteFill}>
        <Path d="M30 236 C60 200 70 170 110 160 C150 150 150 112 186 96 C210 86 230 70 248 46" stroke={colors.brand} strokeWidth={7} fill="none" strokeLinecap="round" />
        <Circle cx={30} cy={236} r={8} fill="#FFFFFF" stroke={colors.forest} strokeWidth={3} />
        <Circle cx={110} cy={160} r={7} fill={colors.warningFill} stroke="#FFFFFF" strokeWidth={2.5} />
        <Circle cx={186} cy={96} r={7} fill={colors.warningFill} stroke="#FFFFFF" strokeWidth={2.5} />
        <Circle cx={248} cy={46} r={10} fill={colors.primary} stroke="#FFFFFF" strokeWidth={3} />
      </Svg>
      {/* A cover that slides away to "draw" the route. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.mapGround, opacity: 0.94, transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, SIZE] }) }] },
        ]}
      />
      <FloatCard style={{ bottom: 18, right: 16, opacity: reveal.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] }) }}>
        <Ionicons name="footsteps-outline" size={17} color={colors.primary} />
        <Text variant="caption" tone="ink" weight="700" tabular>3.4 km · 2 stops</Text>
      </FloatCard>
    </MapTile>
  );
}

/** Guardian 5: notification cards stack under a ringing bell. */
function BellScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const ring = useTimeline(active, (v) => Animated.sequence([timing(v, 1, 120), timing(v, -1, 240), timing(v, 1, 240), timing(v, 0, 120), timing(v, 0, 1400)]), true);
  const cards = useTimeline(active, (v) => timing(v, 1, 900, 300));

  const card = (index: number, icon: "alert-circle" | "enter-outline" | "watch-outline", title: string, color: string) => (
    <Animated.View
      key={title}
      style={{
        opacity: cards.interpolate({ inputRange: [index * 0.25, index * 0.25 + 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
        transform: [{ translateY: cards.interpolate({ inputRange: [index * 0.25, index * 0.25 + 0.4], outputRange: [16, 0], extrapolate: "clamp" }) }],
      }}
    >
      <View style={[stylesStatic.listCard, { backgroundColor: colors.surface }, shadow("light")]}>
        <Ionicons name={icon} size={18} color={color} />
        <Text variant="caption" tone="ink" weight="700">{title}</Text>
      </View>
    </Animated.View>
  );

  return (
    <View style={[stylesStatic.map, { backgroundColor: colors.primaryTint, padding: space.lg, gap: space.sm, justifyContent: "center" }]}>
      <Animated.View style={{ alignSelf: "center", marginBottom: space.md, transform: [{ rotate: ring.interpolate({ inputRange: [-1, 1], outputRange: ["-14deg", "14deg"] }) }] }}>
        <View style={[stylesStatic.bell, { backgroundColor: colors.primary }]}>
          <Ionicons name="notifications" size={34} color={colors.onPrimary} />
        </View>
      </Animated.View>
      {card(0, "alert-circle", "SOS from Ana", colors.danger)}
      {card(1, "enter-outline", "Ana arrived at School", colors.primary)}
      {card(2, "watch-outline", "Watch offline 15 min", colors.warning)}
    </View>
  );
}

/** Child 1: a phone shares its location with the guardian. */
function ShareScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const ripple = useTimeline(active, (v) => Animated.sequence([timing(v, 1, 2000, 0, Easing.out(Easing.quad)), timing(v, 0, 0)]), true);
  const pill = useTimeline(active, (v) => timing(v, 1, 500, 400, Easing.out(Easing.back(1.6))));

  return (
    <MapTile>
      <View style={stylesStatic.center}>
        <Ripple progress={ripple} color={colors.brand} size={170} />
        <Ripple progress={ripple} color={colors.brand} size={170} delay={0.5} />
        <View style={[stylesStatic.me, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
          <Ionicons name="person" size={26} color={colors.onPrimary} />
        </View>
      </View>
      <FloatCard style={{ bottom: 20, alignSelf: "center", left: 40, right: 40, justifyContent: "center", opacity: pill, transform: [{ scale: pill }] }}>
        <View style={[stylesStatic.dot, { backgroundColor: colors.brand }]} />
        <Text variant="caption" tone="ink" weight="700">Sharing with your guardian</Text>
      </FloatCard>
    </MapTile>
  );
}

/** Child 2: a finger holds SOS; the ring fills, then a countdown you can cancel. */
function HoldScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const hold = useTimeline(active, (v) => Animated.sequence([timing(v, 1, 1600, 300, Easing.linear), timing(v, 1, 900), timing(v, 0, 0)]), true);

  return (
    <View style={[stylesStatic.map, { backgroundColor: colors.dangerTint }]}>
      <View style={stylesStatic.center}>
        <View style={[stylesStatic.holdTrack, { borderColor: `${colors.danger}33` }]} />
        <Animated.View
          style={[
            stylesStatic.holdTrack,
            { borderColor: colors.danger, opacity: hold, transform: [{ scale: hold.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }] },
          ]}
        />
        <Animated.View style={[stylesStatic.sosButton, { backgroundColor: colors.danger, transform: [{ scale: hold.interpolate({ inputRange: [0, 0.1, 1], outputRange: [1, 0.94, 0.94] }) }] }]}>
          <Text variant="heading" tone="onDanger" weight="800">HOLD</Text>
        </Animated.View>
      </View>
      <FloatCard style={{ bottom: 18, left: 30, right: 30, justifyContent: "center" }}>
        <Ionicons name="close-circle" size={18} color={colors.danger} />
        <Text variant="caption" tone="ink" weight="700">You can still cancel</Text>
      </FloatCard>
    </View>
  );
}

/** Child 3: the auto-share switch turns on and location dots trail behind. */
function AutoScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const toggle = useTimeline(active, (v) => timing(v, 1, 450, 500, Easing.out(Easing.back(1.4))));
  const dots = useTimeline(active, (v) => timing(v, 1, 1600, 900));

  return (
    <MapTile>
      {[0, 1, 2, 3].map((index) => (
        <Animated.View
          key={index}
          style={[
            stylesStatic.trailDot,
            {
              left: 46 + index * 52,
              top: 196 - index * 34,
              backgroundColor: index === 3 ? colors.primary : colors.brand,
              opacity: dots.interpolate({ inputRange: [index * 0.22, index * 0.22 + 0.2], outputRange: [0, 1], extrapolate: "clamp" }),
              transform: [{ scale: dots.interpolate({ inputRange: [index * 0.22, index * 0.22 + 0.2], outputRange: [0.3, 1], extrapolate: "clamp" }) }],
            },
          ]}
        />
      ))}
      <FloatCard style={{ top: 22, left: 18, right: 18 }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="ink" weight="800">Auto-share</Text>
          <Text variant="caption">Every 5 min or 100 m</Text>
        </View>
        <View style={[stylesStatic.switchTrack, { backgroundColor: colors.ruleStrong }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: colors.primary, opacity: toggle }]} />
          <Animated.View style={[stylesStatic.switchKnob, { transform: [{ translateX: toggle.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }] }]} />
        </View>
      </FloatCard>
    </MapTile>
  );
}

/** Child 4 / done: a big check pops with a burst of dots. */
function DoneScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const pop = useTimeline(active, (v) => timing(v, 1, 600, 200, Easing.out(Easing.back(2.2))));

  return (
    <View style={[stylesStatic.map, { backgroundColor: colors.primaryTint }]}>
      <View style={stylesStatic.center}>
        {Array.from({ length: 10 }, (_, index) => {
          const angle = (index / 10) * Math.PI * 2;
          return (
            <Animated.View
              key={index}
              style={[
                stylesStatic.spark,
                {
                  backgroundColor: index % 3 === 0 ? colors.warningFill : colors.brand,
                  opacity: pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0.9] }),
                  transform: [
                    { translateX: pop.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 100] }) },
                    { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 100] }) },
                  ],
                },
              ]}
            />
          );
        })}
        <Animated.View style={[stylesStatic.checkCircle, { backgroundColor: colors.primary, transform: [{ scale: pop }] }]}>
          <Ionicons name="checkmark" size={64} color={colors.onPrimary} />
        </Animated.View>
      </View>
    </View>
  );
}

export function Scene({ name, active }: { name: SceneName; active: boolean }) {
  switch (name) {
    case "pin":
      return <PinScene active={active} />;
    case "zone":
      return <ZoneScene active={active} />;
    case "sos":
      return <SosScene active={active} />;
    case "route":
      return <RouteScene active={active} />;
    case "bell":
      return <BellScene active={active} />;
    case "share":
      return <ShareScene active={active} />;
    case "hold":
      return <HoldScene active={active} />;
    case "auto":
      return <AutoScene active={active} />;
    default:
      return <DoneScene active={active} />;
  }
}

const useStyles = makeStyles((c, scheme) =>
  StyleSheet.create({
    floatCard: {
      position: "absolute",
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.sm + 2,
      borderRadius: radius.sm,
      backgroundColor: c.surface,
      ...shadow(scheme, "float"),
    },
  }),
);

const stylesStatic = StyleSheet.create({
  map: { width: SIZE, height: SIZE, borderRadius: radius.lg, overflow: "hidden" },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  zone: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderStyle: "dashed" },
  zoneBig: { width: 190, height: 190, borderRadius: 95, borderWidth: 2.5, borderStyle: "dashed", alignItems: "flex-end", justifyContent: "center" },
  handle: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, marginRight: -11 },
  centerDot: { position: "absolute", width: 14, height: 14, borderRadius: 7 },
  sosButton: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  bell: { width: 76, height: 76, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  listCard: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md - 2, borderRadius: radius.sm },
  me: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  holdTrack: { position: "absolute", width: 168, height: 168, borderRadius: 84, borderWidth: 10 },
  trailDot: { position: "absolute", width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: "#FFFFFF" },
  switchTrack: { width: 48, height: 28, borderRadius: 14, justifyContent: "center", overflow: "hidden" },
  switchKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" },
  spark: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  checkCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
});
