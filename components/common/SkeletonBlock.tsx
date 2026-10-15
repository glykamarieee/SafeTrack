import { useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";
import { colors, radii } from "../../constants/theme";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette } from "../../theme/legacy";

interface SkeletonBlockProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBlock({ width = "100%", height = 16, borderRadius = radii.sm, style }: SkeletonBlockProps) {
  const styles = useStyles();

  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width: width as ViewStyle["width"], height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  return StyleSheet.create({
  block: {
    backgroundColor: colors.border,
  },
});
});
