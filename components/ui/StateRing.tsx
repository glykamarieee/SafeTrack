import { Image } from "expo-image";
import { Animated, StyleSheet, View } from "react-native";

import { usePulse } from "../../theme/motion";
import { useTheme } from "../../theme/ThemeProvider";
import { stateColor, type ChildState } from "../../theme/tokens";
import { Text } from "./Text";

type Props = {
  name: string;
  photoUrl?: string | null;
  state: ChildState;
  size?: number;
  /** Pulses only for live location or an active SOS. */
  live?: boolean;
};

const STATE_LABEL: Record<ChildState, string> = {
  inside: "inside a safe zone",
  outside: "outside safe zones",
  offline: "offline",
  sos: "SOS active",
  unknown: "status unknown",
};

function initials(name: string) {
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
  const ring = Math.max(2, Math.round(size / 20));
  const inner = size - ring * 2 - 4;

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
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
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
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} contentFit="cover" />
        ) : (
          <View
            style={{
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: colors.primaryTint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="heading" tone="primary" style={{ fontSize: Math.round(inner * 0.38), lineHeight: Math.round(inner * 0.5) }}>
              {initials(name)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
