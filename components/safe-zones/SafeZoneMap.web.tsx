import {
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
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

type Props = {
  initialRegion: SafeZoneMapRegion;
  region: SafeZoneMapRegion;
  zones: SafeZoneMapZone[];
  primaryColor: string;
  style?: object;
  onRegionChangeComplete: (
    region: SafeZoneMapRegion
  ) => void;
  onPressCoordinate: (
    latitude: number,
    longitude: number
  ) => void;
  onZonePress: (zone: SafeZoneMapZone) => void;
  formatRadius: (radiusMeters: number) => string;
};

const SafeZoneMap = forwardRef<SafeZoneMapHandle, Props>(
  function SafeZoneMap(
    {
      region,
      zones,
      primaryColor,
      style,
      onZonePress,
      formatRadius,
    },
    ref
  ) {
    useImperativeHandle(ref, () => ({
      animateToRegion() {
        // Web-safe no-op.
      },
    }));

    return (
      <View style={[styles.container, style]}>
        <View style={styles.background}>
          <View style={styles.gridHorizontalOne} />
          <View style={styles.gridHorizontalTwo} />
          <View style={styles.gridVerticalOne} />
          <View style={styles.gridVerticalTwo} />

          <View style={styles.centerMarker}>
            <Ionicons
              name="location"
              size={32}
              color={primaryColor}
            />
          </View>

          <View style={styles.coordinatesCard}>
            <Text style={styles.coordinatesLabel}>
              MAP CENTER
            </Text>

            <Text style={styles.coordinatesText}>
              {region.latitude.toFixed(6)},{" "}
              {region.longitude.toFixed(6)}
            </Text>
          </View>

          {zones.length > 0 ? (
            <View style={styles.zonePanel}>
              <Text style={styles.zonePanelTitle}>
                Saved safe zones
              </Text>

              {zones.slice(0, 4).map((zone) => (
                <Pressable
                  key={zone.id}
                  onPress={() => onZonePress(zone)}
                  style={({ pressed }) => [
                    styles.zoneRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.zoneDot,
                      {
                        backgroundColor: zone.isEnabled
                          ? primaryColor
                          : "#9AA5A0",
                      },
                    ]}
                  />

                  <View style={styles.zoneCopy}>
                    <Text
                      numberOfLines={1}
                      style={styles.zoneName}
                    >
                      {zone.name}
                    </Text>

                    <Text style={styles.zoneMeta}>
                      {formatRadius(
                        zone.radiusMeters
                      )} ·{" "}
                      {zone.isEnabled
                        ? "Active"
                        : "Paused"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.webNotice}>
            <Ionicons
              name="desktop-outline"
              size={16}
              color="#426454"
            />

            <Text style={styles.webNoticeText}>
              Safe-zone map management is optimized
              for the SafeTrack mobile application.
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

export default SafeZoneMap;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EAF5EF",
  },

  background: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#EDF5F0",
  },

  gridHorizontalOne: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "35%",
    height: 1,
    backgroundColor: "#D6E3DA",
  },

  gridHorizontalTwo: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "68%",
    height: 1,
    backgroundColor: "#D6E3DA",
  },

  gridVerticalOne: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "32%",
    width: 1,
    backgroundColor: "#D6E3DA",
  },

  gridVerticalTwo: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "70%",
    width: 1,
    backgroundColor: "#D6E3DA",
  },

  centerMarker: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
  },

  coordinatesCard: {
    position: "absolute",
    left: 18,
    bottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
  },

  coordinatesLabel: {
    color: "#6C7D74",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },

  coordinatesText: {
    color: "#17251E",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },

  zonePanel: {
    position: "absolute",
    right: 18,
    top: 18,
    width: 210,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
  },

  zonePanelTitle: {
    color: "#17251E",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
  },

  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    borderTopWidth: 1,
    borderTopColor: "#EDF1EE",
  },

  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  zoneCopy: {
    flex: 1,
    marginLeft: 7,
  },

  zoneName: {
    color: "#17251E",
    fontSize: 9.5,
    fontWeight: "800",
  },

  zoneMeta: {
    color: "#78867F",
    fontSize: 8.5,
    marginTop: 1,
  },

  webNotice: {
    position: "absolute",
    left: "50%",
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 390,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.94)",
    transform: [{ translateX: -195 }],
  },

  webNoticeText: {
    flex: 1,
    color: "#426454",
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: "700",
    marginLeft: 6,
  },

  pressed: {
    opacity: 0.72,
  },
});