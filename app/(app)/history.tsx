import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Text } from "../../components/ui/NativeText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuthStore } from "../../store/authStore";
import {
  estimateStops,
  loadDailyActivity,
  loadHistoryZones,
  minutesInZones,
  philippineDayRange,
  routeDistance,
  MAX_SPEED_MPS,
  MIN_MOVE_METERS,
  STOP_MIN_MINUTES,
  STOP_RADIUS_METERS,
  errorMessage,
  type ActivityEvent,
  type ActivityLocationPoint,
  type ActivityStop,
  type ZoneTransition,
} from "../../services/activityHistoryService";
import {
  SafeTrackInteractiveMap,
  type SafeTrackMapFocus,
  type SafeTrackMapMarker,
} from "../../components/location/SafeTrackInteractiveMap";
import { MapAwareScrollView } from "../../components/location/MapScrollLock";
import { MapSheet, SheetButton, SheetRow, sheetStyles } from "../../components/location/MapSheet";
import { toZoneCircles } from "../../components/location/zoneCircles";
import { useAvatarUrl } from "../../components/location/useAvatarUrl";
import { colorFor, directionsUrl, initialsOf } from "../../components/location/mapTypes";
import { ReplaySlider } from "../../components/history/ReplaySlider";
import { HistoryCalendar } from "../../components/history/HistoryCalendar";
import { EventSheet } from "../../components/history/EventSheet";
import { EVENT_FILTERS, eventCategory, eventLook, type EventFilter } from "../../components/history/eventLook";
import {
  dateLabel,
  distanceLabel,
  durationLabel,
  moveDate,
  timeLabel,
  todayKey,
} from "../../components/history/dates";
import { showAlert } from "../../lib/platformAlert";
import type { Child, Geofence } from "../../types/safetrack";
import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { guardianPalette } from "../../theme/legacy";

type StatId = "records" | "distance" | "span" | "zones" | "sos";

type PointInfo = { title: string; point: ActivityLocationPoint };

const SPEEDS = [1, 4, 16] as const;
// 1x replays one recorded minute per second.
const TICK_MS = 100;

/** Where the child was at `time`, interpolated between the two nearest records. */
function positionAt(points: ActivityLocationPoint[], time: number) {
  if (!points.length) return null;
  const times = points.map((point) => Date.parse(point.recordedAt));
  if (time <= times[0]!) return { latitude: points[0]!.latitude, longitude: points[0]!.longitude };
  const last = points.length - 1;
  if (time >= times[last]!) return { latitude: points[last]!.latitude, longitude: points[last]!.longitude };

  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (times[middle]! <= time) low = middle;
    else high = middle;
  }
  const span = times[high]! - times[low]! || 1;
  const ratio = (time - times[low]!) / span;

  return {
    latitude: points[low]!.latitude + (points[high]!.latitude - points[low]!.latitude) * ratio,
    longitude: points[low]!.longitude + (points[high]!.longitude - points[low]!.longitude) * ratio,
  };
}

export default function HistoryScreen() {
  const styles = useStyles();
  const colors = guardianPalette(useTheme().colors);

  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1040;

  const guardian = useAuthStore((state) => state.guardian);
  const children = useAuthStore((state) => state.linkedChildren);
  const [childId, setChildId] = useState<string | null>(children[0]?.id ?? null);
  const child: Child | null = children.find((item) => item.id === childId) ?? children[0] ?? null;
  const childPhoto = useAvatarUrl(child?.avatarPath, child?.avatarUrl);

  // Recomputed each render so "Today" stays right if the app stays open past midnight.
  const today = todayKey();
  const [selectedDate, setSelectedDate] = useState(today);

  const [points, setPoints] = useState<ActivityLocationPoint[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [transitions, setTransitions] = useState<ZoneTransition[]>([]);
  const [zones, setZones] = useState<Geofence[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const [recenterSignal, setRecenterSignal] = useState(0);
  const [focus, setFocus] = useState<SafeTrackMapFocus | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [statOpen, setStatOpen] = useState<StatId | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);
  const [pointInfo, setPointInfo] = useState<PointInfo | null>(null);
  const [filter, setFilter] = useState<EventFilter>("all");

  const [replayTime, setReplayTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);

  useEffect(() => {
    if (!childId && children[0]) setChildId(children[0].id);
  }, [childId, children]);

  // Ignore responses for a day or child that is no longer selected.
  const request = useRef(0);

  const loadHistory = useCallback(
    async (isRefresh = false) => {
      const id = ++request.current;

      if (!child?.id) {
        setPoints([]);
        setEvents([]);
        setTransitions([]);
        setProblems([]);
        setLoading(false);
        setLoadError("No child profile is available yet. Register a child to see their history.");
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);

      try {
        const activity = await loadDailyActivity(child.id, selectedDate);
        if (id !== request.current) return;
        setPoints(activity.points);
        setEvents(activity.events);
        setTransitions(activity.zoneTransitions);
        setProblems(activity.problems);
        setLoadedKey(`${child.id}:${selectedDate}`);
      } catch (reason) {
        if (id !== request.current) return;
        setPoints([]);
        setEvents([]);
        setTransitions([]);
        setProblems([]);
        setLoadError(errorMessage(reason));
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [child?.id, selectedDate],
  );

  // The (app) tabs stay mounted, so reload whenever this screen is shown,
  // as well as when the child or date changes.
  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  useEffect(() => {
    if (!guardian?.id || !child?.id) {
      setZones([]);
      return;
    }
    let active = true;
    loadHistoryZones(guardian.id, child.id)
      .then((value) => active && setZones(value))
      .catch((reason) => {
        if (active) setProblems((current) => [...current, `Safe Zones could not be loaded (${errorMessage(reason)}).`]);
      });

    return () => {
      active = false;
    };
  }, [guardian?.id, child?.id]);

  // A new day or child: stop the replay and clear selections.
  useEffect(() => {
    setPlaying(false);
    setReplayTime(null);
    setFilter("all");
  }, [selectedDate, child?.id]);

  // ---- Day statistics.
  const stops = useMemo(() => estimateStops(points), [points]);
  const distance = useMemo(() => routeDistance(points), [points]);
  const firstPoint = points[0] ?? null;
  const latestPoint = points[points.length - 1] ?? null;
  const spanMinutes =
    firstPoint && latestPoint ? Math.max(0, (Date.parse(latestPoint.recordedAt) - Date.parse(firstPoint.recordedAt)) / 60000) : 0;
  const enabledZoneIds = useMemo(() => new Set(zones.filter((zone) => zone.isEnabled).map((zone) => zone.id)), [zones]);
  const zoneMinutes = useMemo(
    () =>
      minutesInZones(
        transitions,
        selectedDate,
        enabledZoneIds,
        firstPoint && latestPoint ? { from: firstPoint.recordedAt, to: latestPoint.recordedAt } : null,
      ),
    [transitions, selectedDate, enabledZoneIds, firstPoint, latestPoint],
  );
  const sosEvents = events.filter((event) => event.type === "sos");
  const activeSos = sosEvents.filter((event) => event.sosStatus === "active").length;
  const sources = Array.from(new Set(points.map((point) => (point.source === "mobile" ? "phone" : "smartwatch"))));

  // ---- Map content (memoized so unrelated renders never reach the map).
  const path = useMemo(() => points.map(({ latitude, longitude }) => ({ latitude, longitude })), [points]);

  const zoneCircles = useMemo(() => toZoneCircles(zones, transitions), [zones, transitions]);

  const staticMarkers = useMemo<SafeTrackMapMarker[]>(() => {
    const list: SafeTrackMapMarker[] = [];
    if (firstPoint) {
      list.push({
        id: "start",
        latitude: firstPoint.latitude,
        longitude: firstPoint.longitude,
        title: "Starting location",
        detail: `Recorded ${timeLabel(firstPoint.recordedAt)}`,
        kind: "start",
      });
    }
    stops.forEach((stop) =>
      list.push({
        id: stop.id,
        latitude: stop.latitude,
        longitude: stop.longitude,
        title: `Stop ${stop.index}`,
        kind: "stop",
        label: String(stop.index),
      }),
    );
    events.forEach((event) => {
      if (event.latitude == null || event.longitude == null) return;
      const look = eventLook(event);
      list.push({
        id: `event:${event.type}:${event.id}`,
        latitude: event.latitude,
        longitude: event.longitude,
        title: event.title,
        kind: "event",
        tint: look.tint,
        icon: look.icon,
      });
    });
    if (latestPoint && points.length > 1) {
      list.push({
        id: "latest",
        latitude: latestPoint.latitude,
        longitude: latestPoint.longitude,
        title: latestPoint.label ?? "Latest location",
        detail: `Recorded ${timeLabel(latestPoint.recordedAt)}`,
        kind: "end",
      });
    }
    return list;
  }, [firstPoint, latestPoint, points.length, stops, events]);

  const replayPosition = replayTime === null ? null : positionAt(points, replayTime);

  const replayMarker = useMemo<SafeTrackMapMarker | null>(
    () =>
      replayPosition
        ? {
            id: "replay",
            latitude: replayPosition.latitude,
            longitude: replayPosition.longitude,
            title: child?.fullName ?? "Replay",
            kind: "replay",
            initials: initialsOf(child?.fullName),
            color: colorFor(child?.fullName),
            photoUrl: childPhoto,
            photoKey: child?.avatarPath ?? null,
            ring: "neutral",
          }
        : null,
    [replayPosition?.latitude, replayPosition?.longitude, child?.fullName, child?.avatarPath, childPhoto],
  );

  const mapMarkers = useMemo(
    () => (replayMarker ? [...staticMarkers, replayMarker] : staticMarkers),
    [staticMarkers, replayMarker],
  );

  // ---- Replay.
  const startTime = firstPoint ? Date.parse(firstPoint.recordedAt) : 0;
  const endTime = latestPoint ? Date.parse(latestPoint.recordedAt) : 0;
  const canReplay = points.length > 1 && endTime > startTime;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setReplayTime((current) => {
        const next = (current ?? startTime) + speed * 60_000 * (TICK_MS / 1000);
        if (next >= endTime) {
          setPlaying(false);
          return endTime;
        }
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [playing, speed, startTime, endTime]);

  const togglePlay = () => {
    if (!canReplay) return;
    if (!playing && (replayTime === null || replayTime >= endTime)) setReplayTime(startTime);
    setPlaying((value) => !value);
  };

  const replayProgress = canReplay && replayTime !== null ? (replayTime - startTime) / (endTime - startTime) : 0;

  // ---- Interactions.
  const focusOn = (point: { latitude: number; longitude: number }, radiusMeters?: number) =>
    setFocus({ latitude: point.latitude, longitude: point.longitude, radiusMeters, key: Date.now() });

  const onMarkerPress = useCallback(
    (id: string) => {
      if (id === "start" && firstPoint) setPointInfo({ title: "Starting location", point: firstPoint });
      else if (id === "latest" && latestPoint) setPointInfo({ title: "Latest location", point: latestPoint });
      else if (id.startsWith("event:")) {
        const eventId = id.split(":").slice(2).join(":");
        const type = id.split(":")[1];
        setSelectedEvent(events.find((event) => event.id === eventId && event.type === type) ?? null);
      } else {
        const stop = stops.find((item) => item.id === id);
        if (stop) focusOn(stop, STOP_RADIUS_METERS * 2);
      }
    },
    [firstPoint, latestPoint, events, stops],
  );

  const visibleEvents = useMemo(
    () => (filter === "all" ? events : events.filter((event) => eventCategory(event) === filter)),
    [events, filter],
  );

  const initialLoad = loading && loadedKey !== `${child?.id}:${selectedDate}`;
  const selectedLabel = dateLabel(selectedDate, today);
  const childName = child?.fullName ?? "Your child";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header: back, title, date stepper. */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            onPress={() => router.navigate("/(app)/home")}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.primaryDeep} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Daily route history</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {childName}'s available records
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fit the whole day"
            onPress={() => setRecenterSignal((value) => value + 1)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="scan-outline" size={19} color={colors.primaryDeep} />
          </Pressable>
        </View>

        {children.length > 1 ? (
          <View style={styles.childRow}>
            {children.map((item) => {
              const selected = item.id === child?.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setChildId(item.id)}
                  style={[styles.childChip, selected && styles.childChipSelected]}
                >
                  <View style={[styles.childDot, { backgroundColor: colorFor(item.fullName) }]}>
                    <Text style={styles.childDotText}>{initialsOf(item.fullName)}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.childChipText, selected && styles.childChipTextSelected]}>
                    {item.fullName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.dateDeck}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => setSelectedDate((value) => moveDate(value, -1))}
            style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primaryDeep} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Selected day ${selectedLabel}. Open calendar`}
            onPress={() => setCalendarOpen(true)}
            style={({ pressed }) => [styles.dateCenter, pressed && styles.pressed]}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.dateTitle}>{selectedLabel}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            disabled={selectedDate >= today}
            onPress={() => setSelectedDate((value) => moveDate(value, 1))}
            style={({ pressed }) => [styles.dateArrow, selectedDate >= today && styles.disabled, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primaryDeep} />
          </Pressable>
        </View>
      </View>

      <MapAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadHistory(true)} tintColor={colors.primary} />
        }
      >
        {/* Map. */}
        <View style={[styles.mapCard, { height: wide ? 520 : 380 }]}>
          <SafeTrackInteractiveMap
            markers={mapMarkers}
            circles={zoneCircles}
            path={path}
            height={wide ? 520 : 380}
            recenterSignal={recenterSignal}
            focus={focus}
            showMyLocation={false}
            onMarkerPress={onMarkerPress}
          />

          {initialLoad ? (
            <View pointerEvents="none" style={styles.mapLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.mapLoadingText}>Loading {selectedLabel.toLowerCase()}</Text>
            </View>
          ) : null}

          {!loading && !loadError && points.length === 0 ? (
            <View pointerEvents="box-none" style={styles.emptyWrap}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="map-outline" size={24} color={colors.primaryDark} />
                </View>
                <Text style={styles.emptyTitle}>No route recorded</Text>
                <Text style={styles.emptyText}>
                  No location records were stored for {childName} on this day.
                  {events.length ? " Safety events are listed below." : ""}
                </Text>
                <Pressable onPress={() => setCalendarOpen(true)} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
                  <Ionicons name="calendar-outline" size={15} color={colors.white} />
                  <Text style={styles.emptyButtonText}>Pick another day</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Replay. */}
        <View style={[styles.replay, !canReplay && styles.replayDisabled]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause replay" : "Play replay"}
            disabled={!canReplay}
            onPress={togglePlay}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
          >
            <Ionicons name={playing ? "pause" : "play"} size={20} color={colors.white} />
          </Pressable>
          <View style={styles.replayMiddle}>
            <ReplaySlider
              accessibilityLabel="Replay position"
              value={replayProgress}
              onSlidingStart={() => setPlaying(false)}
              onChange={(value) => canReplay && setReplayTime(startTime + value * (endTime - startTime))}
            />
            <Text style={styles.replayTime}>
              {canReplay
                ? replayTime === null
                  ? `Replay ${timeLabel(firstPoint!.recordedAt)} – ${timeLabel(latestPoint!.recordedAt)}`
                  : timeLabel(new Date(replayTime).toISOString())
                : "Replay needs at least two records"}
            </Text>
          </View>
          <View style={styles.speeds}>
            {SPEEDS.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Replay speed ${value}x`}
                accessibilityState={{ selected: speed === value }}
                onPress={() => setSpeed(value)}
                style={[styles.speedChip, speed === value && styles.speedChipSelected]}
              >
                <Text style={[styles.speedText, speed === value && styles.speedTextSelected]}>{value}×</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Errors. */}
        {loadError ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.danger} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>History could not be loaded</Text>
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
            {child ? (
              <Pressable onPress={() => void loadHistory()} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {problems.length > 0 ? (
          <View style={styles.problems}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.problemsText}>{problems.join(" ")}</Text>
          </View>
        ) : null}

        {/* Stats. */}
        {initialLoad ? (
          <View style={styles.statsCard}>
            {Array.from({ length: 5 }, (_, index) => (
              <View key={index} style={styles.stat}>
                <View style={[styles.skeleton, styles.skeletonOnForest, { width: 44, height: 16 }]} />
                <View style={[styles.skeleton, styles.skeletonOnForest, { width: 56, height: 10, marginTop: 6 }]} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.statsCard}>
            <Stat id="records" value={String(points.length)} label="Records" onPress={setStatOpen} />
            <Stat id="distance" value={distanceLabel(distance.meters)} label="Distance" onPress={setStatOpen} />
            <Stat id="span" value={durationLabel(spanMinutes, true)} label="Span" onPress={setStatOpen} />
            <Stat id="zones" value={durationLabel(zoneMinutes, true)} label="In zones" onPress={setStatOpen} />
            <Stat id="sos" value={String(sosEvents.length)} label="SOS" danger={activeSos > 0} onPress={setStatOpen} />
          </View>
        )}
        <Text style={styles.statHint}>Tap a number to see how it is worked out.</Text>

        {/* Stops. */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>POSSIBLE RECORDED STOPS</Text>
            <Text style={styles.sectionTitle}>Places {childName} stayed a while</Text>
          </View>
          <View style={styles.countChip}>
            <Text style={styles.countText}>{stops.length}</Text>
          </View>
        </View>
        {initialLoad ? (
          <View style={[styles.skeleton, styles.skeletonCard]} />
        ) : stops.length ? (
          <StopList stops={stops} onFocus={(stop) => focusOn(stop, STOP_RADIUS_METERS * 2)} />
        ) : (
          <Text style={styles.quiet}>
            No stops of {STOP_MIN_MINUTES} minutes or more within {STOP_RADIUS_METERS} m were found in the records.
          </Text>
        )}

        {/* Safety timeline. */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>SAFETY EVENTS</Text>
            <Text style={styles.sectionTitle}>What happened, in order</Text>
          </View>
          <View style={styles.countChip}>
            <Text style={styles.countText}>{events.length}</Text>
          </View>
        </View>
        <View style={styles.filters}>
          {EVENT_FILTERS.map((item) => {
            const count = item.id === "all" ? events.length : events.filter((event) => eventCategory(event) === item.id).length;
            const selected = filter === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(item.id)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {item.label} {count ? `(${count})` : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {initialLoad ? (
          <View style={[styles.skeleton, styles.skeletonCard]} />
        ) : visibleEvents.length ? (
          <Timeline events={visibleEvents} onOpen={setSelectedEvent} />
        ) : (
          <View style={styles.noEvents}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.primaryDark} />
            <Text style={styles.noEventsText}>
              {events.length ? "No events of this kind on this day." : "No safety events were recorded on this day."}
            </Text>
          </View>
        )}

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={17} color={colors.primaryDark} />
          <Text style={styles.noteText}>
            History shows only records that reached SafeTrack, from the smartwatch and the phone. Pull down to refresh.
          </Text>
        </View>
      </MapAwareScrollView>

      <HistoryCalendar
        visible={calendarOpen}
        childId={child?.id ?? null}
        selected={selectedDate}
        today={today}
        onSelect={setSelectedDate}
        onClose={() => setCalendarOpen(false)}
      />

      <EventSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onShowOnMap={(event) => focusOn({ latitude: event.latitude!, longitude: event.longitude! })}
        onAcknowledged={() => {
          showAlert("SOS acknowledged", "The alert is marked as acknowledged.");
          void loadHistory(true);
        }}
      />

      <MapSheet
        visible={Boolean(pointInfo)}
        title={pointInfo?.title ?? ""}
        subtitle={pointInfo ? `Recorded ${timeLabel(pointInfo.point.recordedAt)}` : undefined}
        onClose={() => setPointInfo(null)}
      >
        {pointInfo ? (
          <>
            {pointInfo.point.label ? <SheetRow icon="location-outline" label="Place" value={pointInfo.point.label} /> : null}
            <SheetRow
              icon={pointInfo.point.source === "mobile" ? "phone-portrait-outline" : "watch-outline"}
              label="Device"
              value={pointInfo.point.source === "mobile" ? "Phone" : "Smartwatch"}
            />
            {pointInfo.point.accuracy != null ? (
              <SheetRow icon="locate-outline" label="Accuracy" value={`±${Math.round(pointInfo.point.accuracy)} m`} />
            ) : null}
            <SheetRow
              icon="navigate-circle-outline"
              label="Position"
              value={`${pointInfo.point.latitude.toFixed(5)}, ${pointInfo.point.longitude.toFixed(5)}`}
            />
            <View style={sheetStyles.actions}>
              <SheetButton
                icon="locate-outline"
                label="Focus"
                onPress={() => {
                  focusOn(pointInfo.point);
                  setPointInfo(null);
                }}
              />
              <SheetButton
                icon="navigate-outline"
                label="Directions"
                primary
                onPress={() =>
                  void Linking.openURL(directionsUrl(pointInfo.point)).catch(() =>
                    showAlert("Directions unavailable", "Google Maps could not be opened on this device."),
                  )
                }
              />
            </View>
          </>
        ) : null}
      </MapSheet>

      <MapSheet
        visible={Boolean(statOpen)}
        title={statOpen ? STAT_TITLES[statOpen] : ""}
        onClose={() => setStatOpen(null)}
      >
        <Text style={styles.explain}>
          {statOpen === "records"
            ? `${points.length} location record${points.length === 1 ? "" : "s"} were stored for ${childName} on ${selectedLabel.toLowerCase() === "today" ? "today" : selectedLabel}${sources.length ? `, from the ${sources.join(" and ")}` : ""}. Only records that reached SafeTrack's server are counted; nothing is estimated.`
            : statOpen === "distance"
              ? `Straight lines between records, added up: ${distance.counted} move${distance.counted === 1 ? "" : "s"} counted. ${distance.ignoredSmall} small move${distance.ignoredSmall === 1 ? " was" : "s were"} left out because they were within the GPS accuracy of the two records (at least ${MIN_MOVE_METERS} m), which is the position wobbling while ${childName} stays still.${distance.ignoredJumps ? ` ${distance.ignoredJumps} impossible jump${distance.ignoredJumps === 1 ? " was" : "s were"} skipped (faster than ${Math.round(MAX_SPEED_MPS * 3.6)} km/h).` : ""} Travel along roads is usually a little longer.`
              : statOpen === "span"
                ? firstPoint && latestPoint
                  ? `From the first record at ${timeLabel(firstPoint.recordedAt)} to the latest at ${timeLabel(latestPoint.recordedAt)}. Gaps without records are included.`
                  : "There are no records on this day."
                : statOpen === "zones"
                  ? firstPoint && latestPoint
                    ? `Time inside a Safe Zone between the first record (${timeLabel(firstPoint.recordedAt)}) and the latest (${timeLabel(latestPoint.recordedAt)}), from the server's Safe Zone entry and exit events. Time without records is not counted, so this is never longer than the span. Overlapping zones are counted once, and turned-off zones are left out.`
                    : "There are no records on this day, so no time in Safe Zones can be counted."
                  : `SOS alerts triggered on this day, whatever their status. ${activeSos ? `${activeSos} still active.` : "None is still active."}`}
        </Text>
        <Text style={sheetStyles.note}>Day: {selectedDate}, 00:00 to 24:00 Philippine time.</Text>
      </MapSheet>
    </SafeAreaView>
  );
}

const STAT_TITLES: Record<StatId, string> = {
  records: "Records",
  distance: "Distance",
  span: "Recorded span",
  zones: "Time in Safe Zones",
  sos: "SOS alerts",
};

function Stat({
  id,
  value,
  label,
  danger = false,
  onPress,
}: {
  id: StatId;
  value: string;
  label: string;
  danger?: boolean;
  onPress(id: StatId): void;
}) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. How is this calculated?`}
      onPress={() => onPress(id)}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, danger && styles.statDanger]}>
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const StopList = memo(function StopList({ stops, onFocus }: { stops: ActivityStop[]; onFocus(stop: ActivityStop): void }) {
  const styles = useStyles();
  const colors = guardianPalette(useTheme().colors);
  return (
    <View style={styles.stops}>
      {stops.map((stop) => (
        <Pressable
          key={stop.id}
          accessibilityRole="button"
          accessibilityLabel={`Stop ${stop.index}, ${durationLabel(stop.minutes)}. Show on map`}
          onPress={() => onFocus(stop)}
          style={({ pressed }) => [styles.stopCard, pressed && styles.pressed]}
        >
          <View style={styles.stopBadge}>
            <Text style={styles.stopBadgeText}>{stop.index}</Text>
          </View>
          <View style={styles.stopCopy}>
            <Text numberOfLines={1} style={styles.stopTitle}>
              {stop.label ?? `Stop ${stop.index}`}
            </Text>
            <Text style={styles.stopMeta}>
              {timeLabel(stop.startedAt)} – {timeLabel(stop.endedAt)} · {durationLabel(stop.minutes)} · {stop.records} records
            </Text>
          </View>
          <Ionicons name="locate-outline" size={18} color={colors.primaryDark} />
        </Pressable>
      ))}
    </View>
  );
});

const Timeline = memo(function Timeline({ events, onOpen }: { events: ActivityEvent[]; onOpen(event: ActivityEvent): void }) {
  const styles = useStyles();
  const colors = guardianPalette(useTheme().colors);
  return (
    <View>
      {events.map((event, index) => {
        const look = eventLook(event);
        return (
          <Pressable
            key={`${event.type}-${event.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${event.title} at ${timeLabel(event.occurredAt)}. Open details`}
            onPress={() => onOpen(event)}
            style={({ pressed }) => [styles.timelineItem, pressed && styles.pressed]}
          >
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, { backgroundColor: look.soft, borderColor: look.tint }]}>
                <Ionicons name={look.icon} size={15} color={look.tint} />
              </View>
              {index < events.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.eventBody}>
              <View style={styles.eventTitleRow}>
                <Text numberOfLines={1} style={styles.eventTitle}>
                  {event.title}
                </Text>
                <Text style={styles.eventTime}>{timeLabel(event.occurredAt)}</Text>
              </View>
              <View style={styles.eventMetaRow}>
                <View style={[styles.eventTag, { backgroundColor: look.soft }]}>
                  <Text style={[styles.eventTagText, { color: look.tint }]}>{look.label}</Text>
                </View>
                <Text numberOfLines={2} style={styles.eventText}>
                  {event.detail}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
});

const useStyles = makeStyles((__c) => {
  const colors = guardianPalette(__c);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCopy: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  title: { color: colors.ink, fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { marginTop: 2, color: colors.muted, fontSize: 12.5 },
  childRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  childChip: {
    maxWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 4,
    paddingRight: 12,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  childChipSelected: { borderColor: colors.primary, backgroundColor: colors.softMint },
  childDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  childDotText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "800" },
  childChipText: { flexShrink: 1, color: colors.ink, fontSize: 12.5, fontWeight: "700" },
  childChipTextSelected: { color: colors.primaryDeep },
  dateDeck: {
    marginTop: 12,
    minHeight: 56,
    paddingHorizontal: 7,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  dateArrow: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.softMint },
  dateCenter: { flex: 1, height: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  dateTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.3 },
  content: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: 120,
  },
  mapCard: { borderRadius: radius.xl, overflow: "hidden", ...shadow.card },
  mapLoading: {
    position: "absolute",
    left: 14,
    top: 14,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.glass,
    ...shadow.soft,
  },
  mapLoadingText: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
  emptyWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyCard: {
    maxWidth: 300,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 22,
    alignItems: "center",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.9)",
    ...shadow.floating,
  },
  emptyIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.softMint },
  emptyTitle: { marginTop: 9, color: colors.ink, fontSize: 14.5, fontWeight: "900" },
  emptyText: { marginTop: 4, textAlign: "center", color: colors.muted, fontSize: 11.5, lineHeight: 16 },
  emptyButton: {
    marginTop: 12,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryDark,
  },
  emptyButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  replay: {
    marginTop: 12,
    padding: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replayDisabled: { opacity: 0.6 },
  playButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryDark },
  replayMiddle: { flex: 1, minWidth: 0 },
  replayTime: { marginTop: -4, color: colors.muted, fontSize: 11, fontWeight: "700" },
  speeds: { flexDirection: "row", gap: 4 },
  speedChip: { minWidth: 34, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
  speedChipSelected: { backgroundColor: colors.primaryDark },
  speedText: { color: colors.primaryDark, fontSize: 11.5, fontWeight: "800" },
  speedTextSelected: { color: colors.white },
  errorCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.dangerSoft,
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: colors.dangerDark, fontSize: 13, fontWeight: "800" },
  errorText: { marginTop: 2, color: colors.dangerDark, fontSize: 11.5, lineHeight: 16 },
  retry: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, justifyContent: "center", backgroundColor: colors.white },
  retryText: { color: colors.dangerDark, fontSize: 12, fontWeight: "800" },
  problems: {
    marginTop: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  problemsText: { flex: 1, marginLeft: 8, color: colors.dangerDark, fontSize: 11.5, lineHeight: 16 },
  // The day's summary is the screen's one strong forest card.
  statsCard: {
    marginTop: 12,
    minHeight: 84,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 6,
    backgroundColor: __c.forest,
  },
  stat: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, paddingVertical: 14 },
  statValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  statDanger: { color: "#FF6B5C" },
  statLabel: { marginTop: 4, color: "#9FC3AE", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  statHint: { marginTop: 6, color: colors.muted, fontSize: 10.5, textAlign: "center" },
  skeleton: { borderRadius: 6, backgroundColor: colors.surfaceMuted },
  skeletonOnForest: { backgroundColor: "rgba(255,255,255,0.14)" },
  skeletonCard: { height: 70, borderRadius: 18 },
  sectionHeader: { marginTop: 26, marginBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionEyebrow: { color: colors.primaryDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  sectionTitle: { marginTop: 3, color: colors.ink, fontSize: 16, fontWeight: "900" },
  countChip: { minWidth: 30, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, alignItems: "center", backgroundColor: colors.surfaceMuted },
  countText: { color: colors.primaryDark, fontSize: 11, fontWeight: "900" },
  quiet: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  stops: { gap: 8 },
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 11,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopBadge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#0B5E3E" },
  stopBadgeText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  stopCopy: { flex: 1, minWidth: 0 },
  stopTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  stopMeta: { marginTop: 3, color: colors.muted, fontSize: 11 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterChipSelected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  filterText: { color: colors.ink, fontSize: 11.5, fontWeight: "700" },
  filterTextSelected: { color: colors.white },
  timelineItem: { minHeight: 76, flexDirection: "row", alignItems: "flex-start" },
  timelineRail: { width: 42, alignItems: "center", alignSelf: "stretch" },
  timelineDot: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  timelineLine: { flex: 1, width: 1.5, marginVertical: 4, backgroundColor: colors.border },
  eventBody: { flex: 1, paddingLeft: 8, paddingBottom: 16 },
  eventTitleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  eventTitle: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "900" },
  eventTime: { marginLeft: 10, color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" },
  eventMetaRow: { marginTop: 5 },
  eventTag: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, marginBottom: 4 },
  eventTagText: { fontSize: 10, fontWeight: "800" },
  eventText: { color: colors.muted, fontSize: 11.5, lineHeight: 16 },
  noEvents: { padding: 14, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.softMint },
  noEventsText: { flex: 1, color: colors.primaryDeep, fontSize: 12, lineHeight: 17 },
  note: { marginTop: 22, paddingHorizontal: 4, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noteText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  explain: { color: "#33413B", fontSize: 13.5, lineHeight: 20 },
  pressed: { opacity: 0.82 },
});
});
