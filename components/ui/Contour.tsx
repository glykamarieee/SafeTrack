import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  /** Where the "summit" of the contour sits, as a fraction of the box. */
  originX?: number;
  originY?: number;
  rings?: number;
  /** Distance between rings in px. */
  step?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The faint topographic contour-line motif, drawn with plain ellipses (no SVG
 * dependency). Decorative: hidden from screen readers, never intercepts touches.
 * Use at most once per screen.
 */
export function Contour({ originX = 0.85, originY = 0.2, rings = 7, step = 34, style }: Props) {
  const { colors } = useTheme();

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }, style]}
    >
      {Array.from({ length: rings }, (_, index) => {
        const width = step * 2 * (index + 1) * 1.35;
        const height = step * 2 * (index + 1);
        // Each ring drifts slightly so the lines read as terrain, not a target.
        const drift = index * 3;

        return (
          <View
            key={index}
            style={{
              position: "absolute",
              left: `${originX * 100}%`,
              top: `${originY * 100}%`,
              width,
              height,
              marginLeft: -width / 2 + drift,
              marginTop: -height / 2 - drift / 2,
              borderRadius: width,
              borderWidth: 1,
              borderColor: colors.contour,
              transform: [{ rotate: `${-12 + index * 2}deg` }],
            }}
          />
        );
      })}
    </View>
  );
}
