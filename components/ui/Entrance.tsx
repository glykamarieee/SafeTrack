import type { ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

import { useEntrance } from "../../theme/motion";

/** Fades and lifts its children in on first mount, staggered by `index`. */
export function Entrance({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const entrance = useEntrance(index);
  return <Animated.View style={[entrance, style]}>{children}</Animated.View>;
}
