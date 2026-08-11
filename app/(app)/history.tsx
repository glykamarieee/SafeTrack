import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import {
  SafeTrackInteractiveMap,
  type SafeTrackMapMarker,
} from "../../components/location/SafeTrackInteractiveMap";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

type LocationPoint = {
  id: string;
  latitude: number;
  longitude: number;
  source: string;
  label: string | null;
  accuracy: number | null;
  recordedAt: string;
};

type HistoryEvent = {
  id: string;
  type: "geofence" | "sos";
  title: string;
  detail: string;
  occurredAt: string;
};

function getDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function moveDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day, 12));

  next.setUTCDate(next.getUTCDate() + days);

  return `${next.getUTCFullYear()}-${String(
    next.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function getDateRange(value: string) {
  const start = new Date(`${value}T00:00:00+08:00`);

  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 86_400_000).toISOString(),
  };
}

function dateLabel(value: string, today: string) {
  if (value === today) {
    return "Today";
  }

  if (value === moveDate(today, -1)) {
    return "Yesterday";
  }

  return new Date(`${value}T12:00:00+08:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function calculateDistance(first: LocationPoint, second: LocationPoint) {
  const radians = (value: number) => (value * Math.PI) / 180;

  const earthRadius = 6_371_000;
  const latitudeDifference = radians(second.latitude - first.latitude);
  const longitudeDifference = radians(second.longitude - first.longitude);

  const calculation =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation));
}

function totalDistance(points: LocationPoint[]) {
  return points.reduce((total, point, index) => {
    if (index === 0) {
      return total;
    }

    return total + calculateDistance(points[index - 1], point);
  }, 0);
}

function distanceLabel(meters: number) {
  if (!meters) {
    return "No route";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

export default function HistoryScreen() {
  const child = useAuthStore((state) => state.linkedChildren[0]);

  const today = useMemo(() => getDateKey(), []);
  const [selectedDate, setSelectedDate] = useState(today);

  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [recenterSignal, setRecenterSignal] = useState(0);

  const loadHistory = useCallback(async () => {
    if (!child?.id) {
      setPoints([]);
      setEvents([]);
      setLoading(false);
      setMessage("No child profile is available.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { start, end } = getDateRange(selectedDate);

      const [locationsResult, geofencesResult, sosResult] = await Promise.all([
        supabase
          .from("location_logs")
          .select(
            "id,latitude,longitude,source,location_label,accuracy_meters,recorded_at"
          )
          .eq("child_id", child.id)
          .gte("recorded_at", start)
          .lt("recorded_at", end)
          .order("recorded_at", { ascending: true }),

        supabase
          .from("geofence_events")
          .select("id,event_type,title,details,occurred_at")
          .eq("child_id", child.id)
          .gte("occurred_at", start)
          .lt("occurred_at", end)
          .order("occurred_at", { ascending: false }),

        supabase
          .from("sos_alerts")
          .select("id,activation_method,status,triggered_at")
          .eq("child_id", child.id)
          .gte("triggered_at", start)
          .lt("triggered_at", end)
          .order("triggered_at", { ascending: false }),
      ]);

      if (locationsResult.error) {
        throw locationsResult.error;
      }

      if (geofencesResult.error) {
        throw geofencesResult.error;
      }

      if (sosResult.error) {
        throw sosResult.error;
      }

      const locationPoints: LocationPoint[] = (locationsResult.data ?? [])
        .map((row) => ({
          id: String(row.id),
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          source: String(row.source ?? "smartwatch"),
          label: row.location_label ? String(row.location_label) : null,
          accuracy:
            row.accuracy_meters === null
              ? null
              : Number(row.accuracy_meters),
          recordedAt: String(row.recorded_at),
        }))
        .filter((point) => validCoordinate(point.latitude, point.longitude));

      const geofenceEvents: HistoryEvent[] = (geofencesResult.data ?? [])
        .filter((row) => String(row.event_type) !== "possible_anomaly")
        .map((row) => ({
          id: String(row.id),
          type: "geofence" as const,
          title: String(row.title ?? "Safe-zone activity"),
          detail: String(
            row.details ?? row.event_type ?? "Safe-zone event"
          ),
          occurredAt: String(row.occurred_at),
        }));

      const sosEvents: HistoryEvent[] = (sosResult.data ?? []).map((row) => ({
        id: String(row.id),
        type: "sos" as const,
        title: "SOS alert",
        detail: `Activation method: ${String(
          row.activation_method ?? "unknown"
        )
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase())}`,
        occurredAt: String(row.triggered_at),
      }));

      setPoints(locationPoints);

      setEvents(
        [...geofenceEvents, ...sosEvents].sort(
          (first, second) =>
            new Date(second.occurredAt).getTime() -
            new Date(first.occurredAt).getTime()
        )
      );
    } catch (reason) {
      setPoints([]);
      setEvents([]);

      setMessage(
        reason instanceof Error
          ? reason.message
          : "Unable to load daily activity history."
      );
    } finally {
      setLoading(false);
    }
  }, [child?.id, selectedDate]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const mapPath = useMemo(
    () =>
      points.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [points]
  );

  const mapMarkers = useMemo<SafeTrackMapMarker[]>(() => {
    if (!points.length) {
      return [];
    }

    const first = points[0];
    const latest = points[points.length - 1];

    if (points.length === 1) {
      return [
        {
          id: first.id,
          latitude: first.latitude,
          longitude: first.longitude,
          title: first.label || "Available location record",
          detail: `Recorded at ${timeLabel(first.recordedAt)}`,
          kind: "location",
        },
      ];
    }

    return [
      {
        id: `${first.id}-start`,
        latitude: first.latitude,
        longitude: first.longitude,
        title: "First available location",
        detail: `Recorded at ${timeLabel(first.recordedAt)}`,
        kind: "start",
      },
      {
        id: `${latest.id}-latest`,
        latitude: latest.latitude,
        longitude: latest.longitude,
        title: latest.label || "Latest available location",
        detail: `Recorded at ${timeLabel(latest.recordedAt)}`,
        kind: "end",
      },
    ];
  }, [points]);

  const firstPoint = points[0];
  const latestPoint = points[points.length - 1];

  const routeDistance = totalDistance(points);

  const recordedSpan =
    firstPoint && latestPoint
      ? Math.max(
          0,
          Math.floor(
            (new Date(latestPoint.recordedAt).getTime() -
              new Date(firstPoint.recordedAt).getTime()) /
              60_000
          )
        )
      : 0;

  const selectedLabel = dateLabel(selectedDate, today);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>DAILY ACTIVITY HISTORY</Text>
        <Text style={styles.heading}>Activity, in one view.</Text>
        <Text style={styles.subtitle}>
          Review available route records and safety activity for{" "}
          {child?.fullName || "your child"}.
        </Text>

        <View style={styles.dateNav}>
          <Pressable
            onPress={() =>
              setSelectedDate((value) => moveDate(value, -1))
            }
            style={({ pressed }) => [
              styles.dateArrow,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={21}
              color={colors.primaryDark}
            />
          </Pressable>

          <View style={styles.dateCopy}>
            <Text style={styles.dateTitle}>{selectedLabel}</Text>
            <Text style={styles.dateSubtitle}>
              Selected activity date
            </Text>
          </View>

          <Pressable
            disabled={selectedDate >= today}
            onPress={() =>
              setSelectedDate((value) => moveDate(value, 1))
            }
            style={({ pressed }) => [
              styles.dateArrow,
              selectedDate >= today && styles.disabled,
              pressed && selectedDate < today && styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.primaryDark}
            />
          </Pressable>
        </View>

        <View style={styles.mapWrap}>
          <SafeTrackInteractiveMap
            markers={mapMarkers}
            path={mapPath}
            height={300}
            recenterSignal={recenterSignal}
            mapStyleControlTop={14}
            mapStyleControlLeft={14}
          />

          {loading ? (
            <View pointerEvents="none" style={styles.mapLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.mapLoadingText}>Loading route...</Text>
            </View>
          ) : null}

          {!loading && !points.length ? (
            <View pointerEvents="none" style={styles.emptyMap}>
              <Ionicons
                name="map-outline"
                size={30}
                color={colors.primary}
              />
              <Text style={styles.emptyMapTitle}>
                No route records for this date
              </Text>
              <Text style={styles.emptyMapText}>
                {message ||
                  "A route appears after the child device successfully sends and stores a location record."}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.mapTools}>
          <Text style={styles.mapToolsText}>
            Pinch to zoom and drag the map to inspect the route.
          </Text>

          <Pressable
            onPress={() => setRecenterSignal((value) => value + 1)}
            style={({ pressed }) => [
              styles.fitButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="scan-outline"
              size={16}
              color={colors.primaryDark}
            />
            <Text style={styles.fitText}>Fit route</Text>
          </Pressable>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{points.length}</Text>
            <Text style={styles.metricLabel}>Location records</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {distanceLabel(routeDistance)}
            </Text>
            <Text style={styles.metricLabel}>Available route</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Text style={styles.metricValue}>{recordedSpan} min</Text>
            <Text style={styles.metricLabel}>Recorded span</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Safety events</Text>

        {events.length ? (
          events.map((event) => (
            <View key={`${event.type}-${event.id}`} style={styles.event}>
              <View
                style={[
                  styles.eventIcon,
                  event.type === "sos" && styles.eventIconDanger,
                ]}
              >
                <Ionicons
                  name={
                    event.type === "sos"
                      ? "warning-outline"
                      : "shield-checkmark-outline"
                  }
                  size={19}
                  color={
                    event.type === "sos"
                      ? colors.danger
                      : colors.primary
                  }
                />
              </View>

              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventText}>
                  {event.detail} • {timeLabel(event.occurredAt)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyEvents}>
            <Ionicons
              name="checkmark-circle-outline"
              size={23}
              color={colors.primary}
            />
            <Text style={styles.emptyEventsText}>
              No safe-zone or SOS event was recorded for this date.
            </Text>
          </View>
        )}

        <View style={styles.note}>
          <Ionicons
            name="information-circle-outline"
            size={19}
            color={colors.primary}
          />
          <Text style={styles.noteText}>
            Route points are based only on successfully stored records. They do
            not confirm a child’s exact route or safety condition.
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

  flex: {
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 42,
    paddingBottom: 38,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  heading: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 5,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 7,
  },

  dateNav: {
    minHeight: 62,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },

  dateArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  dateCopy: {
    flex: 1,
    alignItems: "center",
  },

  dateTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },

  dateSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },

  mapWrap: {
    height: 300,
    overflow: "hidden",
    marginTop: 18,
    borderRadius: radius.lg,
    backgroundColor: "#D7EDF4",
    ...shadow.card,
  },

  mapLoading: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.96)",
  },

  mapLoadingText: {
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: "800",
    marginLeft: 7,
  },

  emptyMap: {
    position: "absolute",
    top: 88,
    left: 25,
    right: 25,
    alignItems: "center",
    padding: 20,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.96)",
    ...shadow.soft,
  },

  emptyMapTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 7,
  },

  emptyMapText: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 3,
  },

  mapTools: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mapToolsText: {
    flex: 1,
    color: colors.muted,
    fontSize: 10.8,
    lineHeight: 15,
    marginRight: 12,
  },

  fitButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
  },

  fitText: {
    color: colors.primaryDark,
    fontSize: 10.5,
    fontWeight: "900",
    marginLeft: 5,
  },

  metrics: {
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  metric: {
    flex: 1,
    alignItems: "center",
  },

  metricValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 3,
  },

  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
  },

  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 24,
    marginBottom: 10,
  },

  event: {
    padding: 13,
    marginBottom: 10,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  eventIconDanger: {
    backgroundColor: colors.dangerSoft,
  },

  eventCopy: {
    flex: 1,
    marginLeft: 11,
  },

  eventTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },

  eventText: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },

  emptyEvents: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.softMint,
  },

  emptyEventsText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 11.5,
    lineHeight: 17,
    marginLeft: 8,
  },

  note: {
    padding: 14,
    marginTop: 22,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.softMint,
  },

  noteText: {
    flex: 1,
    color: "#547067",
    fontSize: 11.5,
    lineHeight: 17,
    marginLeft: 8,
  },

  disabled: {
    opacity: 0.38,
  },

  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.97 }],
  },
});