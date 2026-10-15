import { useEffect, useRef } from "react";
import { Animated, Easing, Platform } from "react-native";

import { useTheme } from "./ThemeProvider";
import { motion } from "./tokens";

// The native driver isn't available on web; there it falls back to JS.
export const nativeDriver = Platform.OS !== "web";

export const easeOut = Easing.out(Easing.cubic);
export const easeIn = Easing.in(Easing.cubic);

/**
 * Scale-and-dim feedback for anything pressable. Returns handlers for
 * Pressable plus the animated style. With Reduce Motion it only dims.
 */
export function usePressFeedback() {
  const { reduceMotion } = useTheme();
  const value = useRef(new Animated.Value(0)).current;

  const to = (target: number) =>
    Animated.timing(value, {
      toValue: target,
      duration: motion.press,
      easing: easeOut,
      useNativeDriver: nativeDriver,
    }).start();

  return {
    onPressIn: () => to(1),
    onPressOut: () => to(0),
    style: {
      opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
      transform: reduceMotion
        ? []
        : [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, motion.pressScale] }) }],
    },
  };
}

/**
 * First-load entrance: fade plus an 8-px rise, staggered by `index`. Runs
 * once per mount. With Reduce Motion it is a plain short fade.
 */
export function useEntrance(index = 0) {
  const { reduceMotion } = useTheme();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: reduceMotion ? 120 : motion.enter,
      delay: reduceMotion ? 0 : index * motion.stagger,
      easing: easeOut,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
    // Entrance runs once; later preference changes must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    opacity: value,
    transform: reduceMotion
      ? []
      : [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [motion.enterRise, 0] }) }],
  };
}

/**
 * A slow breathing pulse (0 → 1 → 0) for the live-location dot and an active
 * SOS only. Off with Reduce Motion (stays at 0).
 */
export function usePulse(active = true, period = 1600) {
  const { reduceMotion } = useTheme();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reduceMotion) {
      value.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(value, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, period, value]);

  return value;
}
