import { View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";
import { hairline } from "../../theme/tokens";

/** An ink-thin divider; vertical inside rows such as the stat strip. */
export function Rule({ vertical, inset = 0, style }: { vertical?: boolean; inset?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[
        vertical
          ? { width: hairline, alignSelf: "stretch", marginVertical: inset }
          : { height: hairline, alignSelf: "stretch", marginHorizontal: inset },
        { backgroundColor: colors.rule },
        style,
      ]}
    />
  );
}
