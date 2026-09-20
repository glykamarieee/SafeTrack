import {
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type SafeZoneMapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type SafeZoneMapZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled: boolean;
};

export type SafeZoneMapHandle = {
  animateToRegion: (
    region: SafeZoneMapRegion,
    duration?: number
  ) => void;
};

export type SafeZoneMapProps = {
  initialRegion: SafeZoneMapRegion;
  region: SafeZoneMapRegion;
  zones: SafeZoneMapZone[];
  primaryColor: string;
  style?: StyleProp<ViewStyle>;

  onRegionChangeComplete: (
    region: SafeZoneMapRegion
  ) => void;

  onPressCoordinate: (
    latitude: number,
    longitude: number
  ) => void;

  onZonePress: (
    zone: SafeZoneMapZone
  ) => void;

  formatRadius: (
    radiusMeters: number
  ) => string;
};

/*
 * Safe fallback implementation.
 *
 * Expo/Metro normally resolves:
 *
 * Android / iOS:
 * SafeZoneMap.native.tsx
 *
 * Web:
 * SafeZoneMap.web.tsx
 *
 * This base file also gives TypeScript a concrete module to resolve,
 * preventing VS Code from reporting the platform-specific import as
 * missing.
 */
const SafeZoneMap = forwardRef<
  SafeZoneMapHandle,
  SafeZoneMapProps
>(function SafeZoneMap(
  {
    region,
    zones,
    primaryColor,
    style,
    formatRadius,
  },
  ref
) {
  useImperativeHandle(ref, () => ({
    animateToRegion() {
      // Safe fallback only.
    },
  }));

  return (
    <View style={[styles.container, style]}>
      <View style={styles.icon}>
        <Ionicons
          name="map-outline"
          size={32}
          color={primaryColor}
        />
      </View>

      <Text style={styles.title}>
        SafeTrack Safe Zones
      </Text>

      <Text style={styles.coordinates}>
        {region.latitude.toFixed(6)},{" "}
        {region.longitude.toFixed(6)}
      </Text>

      <Text style={styles.summary}>
        {zones.length} saved zone
        {zones.length === 1 ? "" : "s"}
      </Text>

      {zones.slice(0, 3).map((zone) => (
        <View
          key={zone.id}
          style={styles.zoneRow}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: zone.isEnabled
                  ? primaryColor
                  : "#9AA5A0",
              },
            ]}
          />

          <Text
            numberOfLines={1}
            style={styles.zoneText}
          >
            {zone.name} ·{" "}
            {formatRadius(zone.radiusMeters)}
          </Text>
        </View>
      ))}
    </View>
  );
});

export default SafeZoneMap;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#EAF5EF",
  },

  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  title: {
    color: "#17251E",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 10,
  },

  coordinates: {
    color: "#607269",
    fontSize: 10,
    marginTop: 4,
  },

  summary: {
    color: "#607269",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 8,
  },

  zoneRow: {
    width: "100%",
    maxWidth: 320,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },

  zoneText: {
    flex: 1,
    color: "#426454",
    fontSize: 9.5,
    fontWeight: "700",
  },
});