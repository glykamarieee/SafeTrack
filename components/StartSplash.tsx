import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { MapPattern } from "./ui/MapPattern";
import { Text } from "./ui/Text";
import { nativeDriver, useDrift } from "../theme/motion";
import { useTheme } from "../theme/ThemeProvider";

/** The logo's content is 243 of the image's 280 px; the native splash shows it about 122 dp wide. */
const LOGO_SIZE = 140;

/**
 * The start-up screen while SafeTrack restores the session. It picks up
 * exactly where Android's splash ends (same colour, same logo size), then the
 * logo grows a little, radar rings ripple out and the tagline fades in.
 */
export function StartSplash() {
  const { scheme, reduceMotion } = useTheme();
  const intro = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const dots = useRef(new Animated.Value(0)).current;
  const drift = useDrift(16000);

  useEffect(() => {
    if (reduceMotion) {
      intro.setValue(1);
      return;
    }
    Animated.timing(intro, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
    const rings = Animated.loop(
      Animated.timing(ripple, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
    );
    const loader = Animated.loop(
      Animated.timing(dots, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: nativeDriver }),
    );
    rings.start();
    loader.start();
    return () => {
      rings.stop();
      loader.stop();
    };
  }, [dots, intro, reduceMotion, ripple]);

  const ring = (offset: number) => {
    const local = Animated.modulo(Animated.add(ripple, offset), 1);
    return (
      <Animated.View
        key={offset}
        pointerEvents="none"
        style={[
          styles.ring,
          {
            opacity: local.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.35, 0] }),
            transform: [{ scale: local.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] }) }],
          },
        ]}
      />
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: scheme === "dark" ? "#0D2A1E" : "#15803D" }]}>
      <StatusBar style="light" />
      <Animated.View
        style={[StyleSheet.absoluteFill, { right: -40, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }] }]}
      >
        <MapPattern opacity={0.07} />
      </Animated.View>

      <View style={styles.center}>
        {reduceMotion ? null : [0, 0.33, 0.66].map(ring)}
        <Animated.View style={{ transform: [{ scale: intro.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }}>
          <Image source={require("../assets/images/logo.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="SafeTrack" />
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.footer,
          { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <Text variant="legend" style={styles.tagline}>
          Child safety, made calm
        </Text>
        <View style={styles.dots} accessibilityLabel="Loading">
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  opacity: Animated.modulo(Animated.add(dots, index / 3), 1).interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }),
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  footer: { position: "absolute", left: 0, right: 0, bottom: 64, alignItems: "center", gap: 14 },
  tagline: { color: "#D5F0DE" },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
});
