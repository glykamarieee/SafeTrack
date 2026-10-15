import { memo, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { RING_COLORS, type MapMarker } from "./mapTypes";

/** Size and anchor of each marker's view, shared with the native engine. */
export function glyphBox(marker: MapMarker) {
  switch (marker.kind) {
    case "child":
    case "guardian":
    case "replay":
      // Anchor at the pointer tip under the avatar.
      return { width: 64, height: marker.label ? 84 : 66, anchorY: 58 };
    case "start":
      return { width: 22, height: 22, anchorY: 11 };
    case "stop":
      return { width: 28, height: 28, anchorY: 14 };
    case "event":
      return { width: 30, height: 30, anchorY: 15 };
    case "zoneCenter":
      return { width: 150, height: 42, anchorY: 7 };
    case "draft":
      return { width: 22, height: 22, anchorY: 11 };
    default:
      return { width: 30, height: 40, anchorY: 36 };
  }
}

type GlyphProps = {
  marker: MapMarker;
  /** Called once the avatar photo has drawn (or failed), so the native marker can stop tracking. */
  onSettled?: () => void;
};

/** What a marker looks like, drawn with React Native views (Android and iOS). */
export const MarkerGlyph = memo(function MarkerGlyph({ marker, onSettled }: GlyphProps) {
  const box = glyphBox(marker);

  switch (marker.kind) {
    case "child":
    case "guardian":
    case "replay":
      return <AvatarGlyph marker={marker} box={box} onSettled={onSettled} />;
    case "start":
      return <View style={styles.start} />;
    case "stop":
      return (
        <View style={styles.stop}>
          <Text style={styles.stopText}>{marker.label ?? ""}</Text>
        </View>
      );
    case "event":
      return (
        <View style={[styles.event, { backgroundColor: marker.tint ?? "#15803D" }]}>
          <Ionicons name={(marker.icon ?? "ellipse") as keyof typeof Ionicons.glyphMap} size={15} color="#FFFFFF" />
        </View>
      );
    case "zoneCenter":
      return (
        <View style={[styles.zoneBox, { width: box.width }]}>
          <View style={[styles.zoneDot, { backgroundColor: marker.tint ?? "#22B35E" }]} />
          <View style={styles.zoneChip}>
            <Text numberOfLines={1} style={styles.zoneChipText}>
              {marker.title}
            </Text>
          </View>
        </View>
      );
    case "draft":
      return (
        <View style={styles.draft}>
          <View style={styles.draftDot} />
        </View>
      );
    default: {
      const color = marker.kind === "sos" ? "#B42318" : marker.kind === "end" ? "#15803D" : marker.tint ?? "#245E9C";
      return (
        <View style={styles.pinBox}>
          <View style={[styles.pinHead, { backgroundColor: color }]} />
          <View style={styles.pinDot} />
        </View>
      );
    }
  }
});

function AvatarGlyph({
  marker,
  box,
  onSettled,
}: {
  marker: MapMarker;
  box: { width: number; height: number };
  onSettled?: () => void;
}) {
  const ring = RING_COLORS[marker.ring ?? "neutral"];
  const pulse = useRef(new Animated.Value(0)).current;
  const sos = marker.ring === "sos";

  useEffect(() => {
    if (!sos) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sos, pulse]);

  useEffect(() => {
    // Nothing to wait for without a photo.
    if (!marker.photoUrl) onSettled?.();
  }, [marker.photoUrl, onSettled]);

  return (
    <View style={{ width: box.width, height: box.height, alignItems: "center" }}>
      {sos ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              borderColor: ring,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
            },
          ]}
        />
      ) : null}

      <View style={[styles.ring, { borderColor: ring }, marker.kind === "replay" && styles.ringReplay]}>
        {marker.photoUrl ? (
          <Image
            source={{ uri: marker.photoUrl, cacheKey: marker.photoKey ?? undefined }}
            cachePolicy="memory-disk"
            style={styles.photo}
            contentFit="cover"
            transition={0}
            onLoad={onSettled}
            onError={onSettled}
          />
        ) : (
          <View style={[styles.initials, { backgroundColor: marker.color ?? "#15803D" }]}>
            <Text style={styles.initialsText}>{marker.initials ?? "?"}</Text>
          </View>
        )}
      </View>
      <View style={[styles.pointer, { borderTopColor: ring }]} />

      {marker.source ? (
        <View style={styles.sourceBadge}>
          <Ionicons
            name={marker.source === "smartwatch" ? "watch" : "phone-portrait"}
            size={11}
            color="#0E1411"
          />
        </View>
      ) : null}

      {marker.batteryPercent != null ? (
        <View style={[styles.battery, marker.batteryPercent <= 20 && styles.batteryLow]}>
          <Text style={[styles.batteryText, marker.batteryPercent <= 20 && styles.batteryTextLow]}>
            {Math.round(marker.batteryPercent)}%
          </Text>
        </View>
      ) : null}

      {marker.label ? (
        <View style={styles.youChip}>
          <Text style={styles.youText}>{marker.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", top: 3, left: 6, width: 52, height: 52, borderRadius: 26, borderWidth: 4 },
  ring: {
    marginTop: 6,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    padding: 2,
    backgroundColor: "#FFFFFF",
  },
  ringReplay: { opacity: 0.92 },
  photo: { width: "100%", height: "100%", borderRadius: 20 },
  initials: { flex: 1, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  initialsText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  sourceBadge: {
    position: "absolute",
    top: 2,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3E9E5",
  },
  battery: {
    position: "absolute",
    top: 40,
    right: 0,
    paddingHorizontal: 4,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3E9E5",
  },
  batteryLow: { backgroundColor: "#FDECEA", borderColor: "#F6C9C3" },
  batteryText: { fontSize: 9, fontWeight: "800", color: "#0E1411" },
  batteryTextLow: { color: "#B42318" },
  youChip: {
    marginTop: 2,
    paddingHorizontal: 7,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    backgroundColor: "#245E9C",
  },
  youText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  start: {
    marginTop: 2,
    marginLeft: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 4,
    borderColor: "#15803D",
    backgroundColor: "#FFFFFF",
  },
  stop: {
    width: 26,
    height: 26,
    margin: 1,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D2A1E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  stopText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  event: {
    width: 28,
    height: 28,
    margin: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  zoneBox: { height: 42, alignItems: "center" },
  zoneDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: "#FFFFFF" },
  zoneChip: {
    marginTop: 3,
    maxWidth: 146,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "#E3E9E5",
  },
  zoneChipText: { color: "#0E1411", fontSize: 11, fontWeight: "700" },
  draft: {
    width: 20,
    height: 20,
    margin: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30,79,216,0.18)",
    borderWidth: 2,
    borderColor: "#245E9C",
  },
  draftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#245E9C" },
  pinBox: { width: 30, height: 40, alignItems: "center" },
  pinHead: {
    marginTop: 2,
    width: 26,
    height: 26,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 0,
    transform: [{ rotate: "45deg" }],
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pinDot: { position: "absolute", top: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
});
