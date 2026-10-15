import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  /** Colour behind the status bar; matches the screen's header. */
  color: string;
  /** Light icons on a dark/green header, dark icons on a light one. */
  barStyle?: "light" | "dark";
};

/**
 * A fixed strip behind the status bar for screens whose coloured header
 * scrolls away. Without it, scrolled content slides under the clock and
 * battery icons. Also sets the status bar icons while the screen is shown.
 */
export function StatusScrim({ color, barStyle = "light" }: Props) {
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return (
    <>
      {focused ? <StatusBar style={barStyle} /> : null}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: color }}
      />
    </>
  );
}
