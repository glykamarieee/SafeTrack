import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { easeOut, nativeDriver } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { motion, radius, shadow, space } from "../../theme/tokens";
import { Text } from "./Text";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/** A pill segmented control whose green indicator slides between options. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const { reduceMotion } = useTheme();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const position = useRef(new Animated.Value(index)).current;
  const segment = width / options.length;

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(index);
      return;
    }
    Animated.timing(position, {
      toValue: index,
      duration: motion.segment,
      easing: easeOut,
      useNativeDriver: nativeDriver,
    }).start();
  }, [index, position, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width - 8);

  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.track} onLayout={onLayout}>
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: segment, transform: [{ translateX: Animated.multiply(position, segment) }] }]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={styles.option}
          >
            <Text variant="label" tone={selected ? "onPrimary" : "ink2"} weight={selected ? "700" : "600"} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c, scheme) =>
  StyleSheet.create({
    track: {
      flexDirection: "row",
      padding: 4,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: scheme === "dark" ? c.rule : "transparent", ...(scheme === "dark" ? {} : shadow(scheme)),
    },
    indicator: {
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: radius.pill,
      backgroundColor: c.primary,
    },
    option: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: space.xs,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);
