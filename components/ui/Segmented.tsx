import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { easeOut, nativeDriver } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { hairline, motion, radius, space } from "../../theme/tokens";
import { Text } from "./Text";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/** A segmented control whose indicator slides between options (220 ms). */
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

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width - 4);

  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.track} onLayout={onLayout}>
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: segment, transform: [{ translateX: Animated.multiply(position, segment) }] },
          ]}
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
            <Text variant="label" tone={selected ? "ink" : "muted"} weight={selected ? "600" : "500"} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    track: {
      flexDirection: "row",
      padding: 2,
      borderRadius: radius.pill,
      backgroundColor: c.sunken,
    },
    indicator: {
      position: "absolute",
      top: 2,
      bottom: 2,
      left: 2,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      borderWidth: hairline,
      borderColor: c.rule,
    },
    option: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: space.md,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);
