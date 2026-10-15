import { Image } from "expo-image";
import { Animated, StyleSheet, View } from "react-native";

import { usePulse } from "../../theme/motion";
import { useTheme } from "../../theme/ThemeProvider";
import { stateColor, stateTint, type ChildState } from "../../theme/tokens";
import { Text } from "./Text";

type Props = {
  name: string;
  photoUrl?: string | null;
  state: ChildState;
  size?: number;
  /** Pulses for a fresh location or an active SOS. */
  live?: boolean;
};

const STATE_LABEL: Record<ChildState, string> = {
  inside: "inside a safe zone",
  outside: "outside safe zones",
  offline: "offline",
  sos: "SOS active",
  unknown: "status unknown",
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/**
 * The child's photo or initials inside a ring whose colour is their state,
 * the same colour as their map marker.
 */
export function StateRing({ name, photoUrl, state, size = 56, live = false }: Props) {
  const { colors } = useTheme();
  const color = stateColor(colors, state);
  const pulse = usePulse(live || state === "sos");
  const ring = Math.max(2, Math.round(size / 18));
  const inner = size - ring * 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name}, ${STATE_LABEL[state]}`}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1.3] }) }],
          },
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: color,
          backgroundColor: stateTint(colors, state),
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} contentFit="cover" />
        ) : (
          <Text
            variant="heading"
            weight="800"
            tone={state === "sos" ? "danger" : state === "outside" ? "warning" : state === "inside" ? "primary" : "ink2"}
            style={{ fontSize: Math.round(size * 0.32), lineHeight: Math.round(size * 0.42) }}
          >
            {initials(name)}
          </Text>
        )}
      </View>
    </View>
  );
}
