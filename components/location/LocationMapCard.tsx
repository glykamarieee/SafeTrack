import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { LocationLog } from "../../types/safetrack";
import {
  SafeTrackInteractiveMap,
  type SafeTrackMapMarker,
  type SafeTrackMapState,
} from "./SafeTrackInteractiveMap";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";

type LocationMapCardProps = {
  location: LocationLog | null;
  height?: number;
  large?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
};

function formatDateTime(value?: string) {
  if (!value) {
    return "No update recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No update recorded";
  }

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSourceLabel(source: unknown) {
  const normalized = String(source ?? "").toLowerCase();

  if (normalized === "mobile" || normalized === "phone") {
    return "Child mobile phone";
  }

  return "Compatible smartwatch";
}

function hasValidCoordinates(location: LocationLog | null) {
  if (!location) {
    return false;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function formatCoordinate(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return value.toFixed(5);
}

export function LocationMapCard({
  location,
  height = 286,
  large = false,
  loading = false,
  onRefresh,
}: LocationMapCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const [mapState, setMapState] = useState<SafeTrackMapState>({
    style: "default",
    zoom: 12,
    latitude: 10.3157,
    longitude: 123.8854,
  });

  const displayHeight = large ? Math.max(460, height) : height;
  const validLocation = hasValidCoordinates(location);

  const latitude = validLocation ? Number(location?.latitude) : null;
  const longitude = validLocation ? Number(location?.longitude) : null;

  const detail = validLocation
    ? `${getSourceLabel(location?.source)} • ${formatDateTime(
        location?.recordedAt
      )}`
    : "No location record has been received yet.";

  const markers = useMemo<SafeTrackMapMarker[]>(() => {
    if (
      !validLocation ||
      latitude === null ||
      longitude === null ||
      !location
    ) {
      return [];
    }

    return [
      {
        id: String(location.id ?? "latest-location"),
        latitude,
        longitude,
        title: location.locationLabel || "Latest available location",
        detail,
        kind: "location",
      },
    ];
  }, [detail, latitude, location, longitude, validLocation]);

  return (
    <View style={[styles.root, { height: displayHeight }]}>
      <SafeTrackInteractiveMap
        markers={markers}
        height={displayHeight}
        style={StyleSheet.absoluteFill}
        mapStyleControlTop={68}
        mapStyleControlLeft={14}
        recenterSignal={recenterSignal}
        onMapStateChange={setMapState}
      />

      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.mapTop}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Latest available location</Text>
          </View>

          <View style={styles.topActions}>
            {onRefresh ? (
              <Pressable
                onPress={onRefresh}
                style={({ pressed }) => [
                  styles.roundButton,
                  pressed && styles.pressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryDark}
                  />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={21}
                    color={colors.primaryDark}
                  />
                )}
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setRecenterSignal((value) => value + 1)}
              style={({ pressed }) => [
                styles.roundButton,
                styles.locationButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="locate-outline"
                size={20}
                color={colors.primaryDark}
              />
            </Pressable>
          </View>
        </View>

        {!validLocation && !loading ? (
          <View style={styles.emptyMapLabel}>
            <Ionicons
              name="location-outline"
              size={19}
              color={colors.primaryDark}
            />
            <Text style={styles.emptyMapText}>
              Waiting for a stored location record
            </Text>
          </View>
        ) : null}

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetRow}>
            <View style={styles.sheetCopy}>
              <Text style={styles.locationTitle}>
                {location?.locationLabel || "Location monitoring"}
              </Text>

              <Text style={styles.locationDetail}>{detail}</Text>
            </View>

            <Pressable
              onPress={() => setShowDetails((value) => !value)}
              style={({ pressed }) => [
                styles.detailsToggle,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={showDetails ? "chevron-down" : "chevron-up"}
                size={20}
                color={colors.primaryDark}
              />
            </Pressable>
          </View>

          {showDetails ? (
            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Map style</Text>
                <Text style={styles.detailValue}>
                  {mapState.style === "satellite"
                    ? "Satellite"
                    : "Default"}
                </Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Map zoom</Text>
                <Text style={styles.detailValue}>
                  Level {mapState.zoom}
                </Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Device source</Text>
                <Text style={styles.detailValue}>
                  {validLocation
                    ? getSourceLabel(location?.source)
                    : "No stored record"}
                </Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Coordinates</Text>
                <Text style={styles.detailValue}>
                  {validLocation
                    ? `${formatCoordinate(latitude)}, ${formatCoordinate(
                        longitude
                      )}`
                    : "Not available"}
                </Text>
              </View>

              {location?.accuracyMeters != null ? (
                <>
                  <View style={styles.detailDivider} />

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Accuracy</Text>
                    <Text style={styles.detailValue}>
                      Approx. {Math.round(Number(location.accuracyMeters))} m
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: "#D7EDF4",
    ...shadow.card,
  },

  overlay: {
    ...StyleSheet.absoluteFill,
  },

  mapTop: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  topActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.96)",
    ...shadow.soft,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 7,
  },

  liveText: {
    color: colors.primaryDark,
    fontSize: 11.5,
    fontWeight: "900",
  },

  roundButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    ...shadow.soft,
  },

  locationButton: {
    marginLeft: 8,
  },

  emptyMapLabel: {
    position: "absolute",
    top: "43%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.97)",
    ...shadow.soft,
  },

  emptyMapText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 7,
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 16,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.98)",
    ...shadow.soft,
  },

  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 4,
    alignSelf: "center",
    backgroundColor: "#D6E2DC",
    marginBottom: 10,
  },

  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  sheetCopy: {
    flex: 1,
    marginRight: 10,
  },

  locationTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  locationDetail: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },

  detailsToggle: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  details: {
    marginTop: 13,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: "700",
  },

  detailValue: {
    flex: 1.35,
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: "900",
    textAlign: "right",
  },

  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },

  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.97 }],
  },
});