import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { usePulse } from "../../theme/motion";
import { useTheme } from "../../theme/ThemeProvider";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** True while the hold countdown is running. */
  running: boolean;
  /** Length of the countdown; the ring fills in exactly this time. */
  durationMs: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor: string;
  children: ReactNode;
};

/**
 * A ring that fills clockwise over `durationMs` while `running`, and empties
 * at once when it stops (finger lifted or cancelled). With Reduce Motion the
 * ring is drawn full while running instead of animating.
 */
export function HoldRing({ running, durationMs, size = 240, stroke = 12, color, trackColor, children }: Props) {
  const { reduceMotion } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const idle = usePulse(!running, 2200);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.stopAnimation();
    if (!running) {
      progress.setValue(0);
      return;
    }
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    // strokeDashoffset is an SVG prop, so this runs on the JS driver.
    const animation = Animated.timing(progress, { toValue: 1, duration: durationMs, easing: Easing.linear, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [running, durationMs, reduceMotion, progress]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* A soft breathing halo while waiting for a hold. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: idle.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] }),
            transform: [{ scale: idle.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
          },
        ]}
      />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
