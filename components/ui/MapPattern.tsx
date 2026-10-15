import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

type Props = {
  /** Line colour; white on green headers, the brand colour on light cards. */
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Faint street-map lines behind a header or empty state. Decorative: hidden
 * from screen readers and never intercepts touches. At most once per screen.
 */
export function MapPattern({ color = "#FFFFFF", opacity = 0.08, style }: Props) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }, style]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
        <Path
          d="M-20 70 L420 20 M-20 170 L420 120 M-20 250 L420 215 M80 -10 L120 270 M260 -10 L280 270 M350 -10 L360 270"
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth={9}
        />
        <Path d="M-20 20 L420 140 M30 -10 L20 270" stroke={color} strokeOpacity={opacity * 0.7} strokeWidth={4} />
        <Rect x={140} y={120} width={70} height={40} rx={6} fill={color} fillOpacity={opacity * 0.6} />
        <Rect x={290} y={40} width={60} height={44} rx={6} fill={color} fillOpacity={opacity * 0.6} />
      </Svg>
    </View>
  );
}
