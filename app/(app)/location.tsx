import { useEffect } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";
import { LocationMapCard } from "../../components/location/LocationMapCard";

import {
  guardianColors as colors,
  guardianSpacing as spacing,
  guardianRadius as radius,
  guardianShadow as shadow,
} from "../../constants/guardianDesign";

function getSourceLabel(source?: string) {
  if (source === "mobile") return "Mobile device";
  if (source === "both") return "Smartwatch + mobile";
  return "Smartwatch";
}

function getSourceIcon(source?: string): keyof typeof Ionicons.glyphMap {
  if (source === "mobile") return "phone-portrait-outline";
  if (source === "both") return "git-compare-outline";
  return "watch-outline";
}

function formatTimestamp(value?: string | null) {
  if (!value) return "No location record yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Latest stored location";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function LocationScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 1040;
  const role = useAuthStore((state) => state.role);
  const child = useAuthStore((state) => state.child);
  const children = useAuthStore((state) => state.linkedChildren);

  const primaryChild = role === "child" ? child : children?.[0] ?? null;

  const location = useLocationStore((state) => state.latest);
  const loading = useLocationStore((state) => state.isLoading);
  const load = useLocationStore((state) => state.loadForChild);

  const trackingSource = primaryChild?.trackingSource ?? "mobile";
  const supportedTrackingSource =
    trackingSource === "mobile" || trackingSource === "both"
      ? trackingSource
      : "smartwatch";

  useEffect(() => {
    if (primaryChild?.id) {
      void load(primaryChild.id);
    }
  }, [primaryChild?.id]);

  const refresh = () => {
    if (primaryChild?.id) {
      void load(primaryChild.id);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>LOCATION TRACKING</Text>
            <Text style={styles.heading}>
              {primaryChild?.fullName ?? "Child"}'s location
            </Text>
            <Text style={styles.subtitle}>
              Latest available position from the registered SafeTrack child device.
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Refresh latest location"
            onPress={refresh}
            style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
          >
            <Ionicons
              name={loading ? "sync-outline" : "refresh-outline"}
              size={20}
              color={colors.primaryDark}
            />
          </Pressable>
        </View>

        <View style={styles.sourceRibbon}>
          <View style={styles.sourceIcon}>
            <Ionicons
              name={getSourceIcon(trackingSource)}
              size={20}
              color={colors.primaryDark}
            />
          </View>

          <View style={styles.sourceCopy}>
            <Text style={styles.sourceLabel}>Tracking source</Text>
            <Text style={styles.sourceValue}>{getSourceLabel(trackingSource)}</Text>
          </View>

          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveChipText}>{location ? "RECEIVED" : "WAITING"}</Text>
          </View>
        </View>

        <View style={styles.mapHeaderRow}>
          <View>
            <Text style={styles.mapTitle}>Explore the latest position</Text>
            <Text style={styles.mapCaption}>Pinch, zoom, switch map style, or recenter.</Text>
          </View>
          <View style={styles.mapHintIcon}>
            <Ionicons name="map-outline" size={18} color={colors.primaryDark} />
          </View>
        </View>

        <LocationMapCard
          location={location}
          height={wide ? 650 : 560}
          loading={loading}
          trackingSource={supportedTrackingSource}
          onRefresh={refresh}
        />

        <View style={styles.metaRail}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={17} color={colors.primaryDark} />
            <View style={styles.metaCopy}>
              <Text style={styles.metaLabel}>Last update</Text>
              <Text numberOfLines={1} style={styles.metaValue}>
                {formatTimestamp(location?.recordedAt)}
              </Text>
            </View>
          </View>

          <View style={styles.metaDivider} />

          <View style={styles.metaItem}>
            <Ionicons name="locate-outline" size={17} color={colors.primaryDark} />
            <View style={styles.metaCopy}>
              <Text style={styles.metaLabel}>Accuracy</Text>
              <Text style={styles.metaValue}>
                {location?.accuracyMeters != null
                  ? `±${Math.round(location.accuracyMeters)} m`
                  : "Not provided"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Ionicons name="information" size={15} color={colors.primaryDark} />
          </View>
          <Text style={styles.noticeText}>
            SafeTrack shows the latest successfully stored device location. GPS/GNSS,
            connectivity, permissions, and device availability can affect when the next
            update appears.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    paddingBottom: 118,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.45,
  },
  heading: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  subtitle: {
    maxWidth: 320,
    marginTop: 6,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  refresh: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  sourceRibbon: {
    minHeight: 70,
    paddingHorizontal: 13,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  sourceIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  sourceCopy: {
    flex: 1,
    marginLeft: 11,
  },
  sourceLabel: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.75,
  },
  sourceValue: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  liveChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    backgroundColor: colors.primary,
  },
  liveChipText: {
    color: colors.primaryDark,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  mapHeaderRow: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  mapCaption: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10.5,
  },
  mapHintIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  metaRail: {
    minHeight: 78,
    marginTop: 14,
    paddingHorizontal: 13,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  metaCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  metaValue: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "800",
  },
  metaDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 10,
    backgroundColor: colors.border,
  },
  notice: {
    marginTop: 18,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noticeIcon: {
    width: 25,
    height: 25,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  noticeText: {
    flex: 1,
    marginLeft: 9,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
