import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  SafeTrackInteractiveMap,
  type SafeTrackMapMarker,
} from "./SafeTrackInteractiveMap";
import type { LocationLog } from "../../types/safetrack";
import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
} from "../../constants/guardianDesign";

export type LocationMapCardProps = {
  location: LocationLog | null | undefined;
  height?: number;
  loading?: boolean;
  trackingSource?: "mobile" | "smartwatch" | "both";
  onRefresh?: () => void;
};

function relativeTime(value?: string | null) {
  if (!value) return "No update yet";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Latest stored update";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
  return `Updated ${Math.floor(hours / 24)} day${hours < 48 ? "" : "s"} ago`;
}

function sourceLabel(source?: string, trackingSource?: string) {
  if (source === "smartwatch") return "Smartwatch";
  if (source === "mobile" || source === "phone") return "Mobile device";
  if (trackingSource === "both") return "Watch + mobile";
  if (trackingSource === "smartwatch") return "Smartwatch";
  return "Mobile device";
}

export function LocationMapCard({
  location,
  height = 350,
  loading = false,
  trackingSource,
  onRefresh,
}: LocationMapCardProps) {
  const validLocation =
    Boolean(location) &&
    Number.isFinite(location?.latitude) &&
    Number.isFinite(location?.longitude);

  const markers: SafeTrackMapMarker[] = validLocation && location
    ? [
        {
          id: "latest-location",
          latitude: location.latitude,
          longitude: location.longitude,
          title: location.childName ? `${location.childName}'s latest location` : "Latest available location",
          detail: relativeTime(location.recordedAt),
          kind: "location",
        },
      ]
    : [];

  return (
    <View style={[styles.container, { height }]}>
      {validLocation && location ? (
        <>
          <SafeTrackInteractiveMap markers={markers} height={height} mapStyleControlTop={58} mapStyleControlLeft={14} />

          <View pointerEvents="none" style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LATEST AVAILABLE</Text>
          </View>

          <View pointerEvents="none" style={styles.locationGlass}>
            <View style={styles.locationIcon}>
              <Ionicons
                name={location.source === "smartwatch" ? "watch-outline" : "navigate-outline"}
                size={18}
                color={colors.primaryDark}
              />
            </View>
            <View style={styles.locationCopy}>
              <Text numberOfLines={1} style={styles.locationTitle}>
                {location.locationLabel || sourceLabel(location.source, trackingSource)}
              </Text>
              <Text style={styles.locationMeta}>{relativeTime(location.recordedAt)}</Text>
            </View>
            {location.accuracyMeters != null ? (
              <View style={styles.accuracyChip}>
                <Ionicons name="locate-outline" size={12} color={colors.primaryDark} />
                <Text style={styles.accuracyText}>±{Math.round(location.accuracyMeters)}m</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyOrb}>
            <View style={styles.emptyOrbInner}>
              <Ionicons name="navigate-outline" size={31} color={colors.primaryDark} />
            </View>
          </View>

          <Text style={styles.emptyTitle}>{loading ? "Finding the latest update" : "No location received yet"}</Text>
          <Text style={styles.emptyText}>
            {trackingSource === "smartwatch"
              ? "The map will focus automatically after the registered smartwatch sends a location record."
              : trackingSource === "both"
                ? "The map will focus automatically after a registered child device sends a location record."
                : "The map will focus automatically after the registered mobile device sends a location record."}
          </Text>

          {onRefresh ? (
            <Pressable onPress={onRefresh} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
              <Ionicons name="refresh-outline" size={18} color={colors.white} />
              <Text style={styles.refreshText}>Check again</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundAlt,
    ...shadow.card,
  },
  liveBadge: {
    position: "absolute",
    left: 14,
    top: 14,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.86)",
    ...shadow.soft,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
    backgroundColor: colors.primary,
  },
  liveText: {
    color: colors.primaryDeep,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  locationGlass: {
    position: "absolute",
    left: 14,
    right: 76,
    bottom: 14,
    minHeight: 64,
    padding: 9,
    paddingRight: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.9)",
    ...shadow.floating,
  },
  locationIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  locationCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  locationTitle: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
  },
  locationMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "600",
  },
  accuracyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  accuracyText: {
    marginLeft: 3,
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: colors.backgroundAlt,
  },
  emptyOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mintGlow,
  },
  emptyOrbInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    ...shadow.soft,
  },
  emptyTitle: {
    marginTop: 18,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  emptyText: {
    maxWidth: 320,
    marginTop: 7,
    textAlign: "center",
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  refresh: {
    minHeight: 44,
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    ...shadow.soft,
  },
  refreshText: {
    marginLeft: 7,
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
