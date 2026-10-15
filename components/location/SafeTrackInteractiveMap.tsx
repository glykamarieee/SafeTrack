import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "../ui/NativeText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { MapRenderer } from "./MapRenderer";
import { MapSheet, SheetButton, SheetRow, sheetStyles } from "./MapSheet";
import { useMapScrollLock } from "./MapScrollLock";
import { useMapPrefs } from "./mapPrefs";
import { isNightTime } from "./mapStyles";
import { nativeMapMode } from "./mapSupport";
import { PREVIEW_TILES } from "./leafletHtml";
import { useAvatarUrl } from "./useAvatarUrl";
import {
  ZONE_COLORS,
  directionsUrl,
  distanceMeters,
  initialsOf,
  lastSeenLabel,
  spreadOverlapping,
  type BaseMapType,
  type MapCircle,
  type MapEngineHandle,
  type MapMarker,
  type MapPadding,
  type MapPoint,
  type MapPrefs,
  type MapTheme,
  type MapView,
} from "./mapTypes";
import { showAlert } from "../../lib/platformAlert";
import { useAuthStore } from "../../store/authStore";

export type SafeTrackMapMarker = MapMarker;
export type SafeTrackMapCircle = MapCircle;
export type SafeTrackMapState = MapView;

export type SafeTrackMapFocus = {
  latitude: number;
  longitude: number;
  /** Fit this radius around the point instead of a fixed zoom. */
  radiusMeters?: number;
  /** Change it to focus again on the same point. */
  key: string | number;
};

type Props = {
  markers?: MapMarker[];
  circles?: MapCircle[];
  path?: MapPoint[];
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Increment to fit all content again. */
  recenterSignal?: number;
  /** Fly to a point or zone; re-focuses when `key` changes. */
  focus?: SafeTrackMapFocus | null;
  /** Space covered by overlays, kept clear when fitting content. */
  fitPadding?: Partial<MapPadding>;
  /**
   * Android/iOS: insets for overlays drawn over the map. The Google logo and
   * the camera's centre move inside them, so the logo stays visible.
   */
  mapPadding?: Partial<MapPadding>;
  /** Taps choose a point (zone and marker sheets are suppressed). */
  picking?: boolean;
  showMapStyleControl?: boolean;
  showMyLocation?: boolean;
  allowExpand?: boolean;
  onMapPress?: (coordinate: MapPoint) => void;
  onMapStateChange?: (state: SafeTrackMapState) => void;
  /** When given, marker taps go here instead of the built-in details sheet. */
  onMarkerPress?: (id: string) => void;
  onZonePress?: (id: string) => void;
  onZoneAction?: (id: string, action: string) => void;
};

type Me = { latitude: number; longitude: number; accuracy: number };

type Shared = {
  prefs: MapPrefs;
  dark: boolean;
  me: Me | null;
  locating: boolean;
  locateMe(): void;
};

type CoreProps = Props &
  Shared & {
    initialView?: MapView | null;
    expanded: boolean;
    onToggleExpand?: () => void;
    onView(view: MapView): void;
  };

const BASE_PADDING: MapPadding = { top: 60, right: 64, bottom: 60, left: 48 };
const NO_PADDING: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };
const NO_MARKERS: MapMarker[] = [];
const NO_CIRCLES: MapCircle[] = [];
const NO_PATH: MapPoint[] = [];

const NATIVE_MODE = nativeMapMode();

/** Keeps the previous value while the content is identical, so maps skip no-op updates. */
function useStable<T>(value: T): T {
  const ref = useRef<{ json: string; value: T } | null>(null);
  const json = JSON.stringify(value);
  if (!ref.current || ref.current.json !== json) ref.current = { json, value };

  return ref.current.value;
}

function formatRadius(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function openDirections(point: MapPoint) {
  const url = directionsUrl(point);
  Linking.openURL(url).catch(() => showAlert("Directions unavailable", "Google Maps could not be opened on this device."));
}

function MapCore(props: CoreProps) {
  const {
    markers = NO_MARKERS,
    circles = NO_CIRCLES,
    path = NO_PATH,
    recenterSignal,
    focus,
    fitPadding,
    mapPadding,
    picking = false,
    showMapStyleControl = true,
    showMyLocation = true,
    allowExpand = true,
    onMapPress,
    onMarkerPress,
    onZonePress,
    onZoneAction,
    initialView,
    expanded,
    onToggleExpand,
    onView,
    prefs,
    dark,
    me,
    locating,
    locateMe,
  } = props;

  const engine = useRef<MapEngineHandle>(null);
  const touch = useMapScrollLock();
  const guardian = useAuthStore((state) => state.guardian);
  const guardianPhoto = useAvatarUrl(guardian?.avatarPath, guardian?.avatarUrl);
  const updatePrefs = useMapPrefs((state) => state.update);

  const [loaded, setLoaded] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  // Whole zoom levels only: markers are re-spread when the zoom level changes.
  const [zoomLevel, setZoomLevel] = useState(initialView ? Math.round(initialView.zoom) : 14);
  const handleView = useCallback(
    (view: MapView) => {
      setZoomLevel(Math.round(view.zoom));
      onView(view);
    },
    [onView],
  );

  // ---- What the engine draws.
  const visibleCircles = useMemo(
    () => (prefs.zones ? circles : circles.filter((circle) => circle.status === "draft")),
    [circles, prefs.zones],
  );

  const engineMarkers = useStable(
    useMemo(() => {
      const list: MapMarker[] = [];

      visibleCircles.forEach((circle) => {
        if (!circle.label || circle.status === "draft") return;
        const status = circle.status ?? (circle.enabled === false ? "inactive" : "active");
        list.push({
          id: `zone:${circle.id}`,
          latitude: circle.latitude,
          longitude: circle.longitude,
          title: circle.label,
          kind: "zoneCenter",
          tint: ZONE_COLORS[status],
        });
      });

      list.push(...markers);

      if (me && showMyLocation) {
        list.push({
          id: "guardian:me",
          latitude: me.latitude,
          longitude: me.longitude,
          title: guardian?.fullName ? `${guardian.fullName} (you)` : "You",
          kind: "guardian",
          label: "You",
          initials: initialsOf(guardian?.fullName),
          color: "#1A73E8",
          photoUrl: guardianPhoto,
          photoKey: guardian?.avatarPath ?? null,
          ring: "neutral",
          accuracyMeters: me.accuracy,
        });
      }

      // Avatars closer than ~48 px at this zoom are nudged apart.
      const metersPerPixel = (156_543 * Math.cos((14.6 * Math.PI) / 180)) / 2 ** zoomLevel;
      return spreadOverlapping(list, 48 * metersPerPixel);
    }, [markers, visibleCircles, me, showMyLocation, guardian?.fullName, guardian?.avatarPath, guardianPhoto, zoomLevel]),
  );

  const engineCircles = useStable(
    useMemo(() => {
      const accuracy: MapCircle[] = engineMarkers
        .filter((marker) => (marker.kind === "child" || marker.kind === "guardian") && (marker.accuracyMeters ?? 0) > 0)
        .map((marker) => ({
          id: `accuracy:${marker.id}`,
          latitude: marker.latitude,
          longitude: marker.longitude,
          radiusMeters: marker.accuracyMeters!,
          status: "accuracy",
        }));

      return [...accuracy, ...visibleCircles];
    }, [engineMarkers, visibleCircles]),
  );

  const enginePath = useStable(prefs.route ? path : NO_PATH);

  const padding = useStable({ ...BASE_PADDING, ...fitPadding });
  const nativePadding = useStable({ ...NO_PADDING, ...mapPadding });

  // ---- Signals: these props are commands, not state; skip their first value.
  const lastRecenter = useRef(recenterSignal);
  useEffect(() => {
    if (recenterSignal === lastRecenter.current) return;
    lastRecenter.current = recenterSignal;
    engine.current?.fit(true);
  }, [recenterSignal]);

  const focusKey = focus ? `${focus.key}` : null;
  useEffect(() => {
    if (focus && loaded) engine.current?.focus(focus);
    // Refocus only when the key changes (or once the map is ready).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, loaded]);

  // "My location" moves the camera only when the guardian asked for it.
  const wantsMe = useRef(false);
  useEffect(() => {
    if (me && wantsMe.current && loaded) {
      wantsMe.current = false;
      engine.current?.focus({ latitude: me.latitude, longitude: me.longitude, zoom: 16 });
    }
  }, [me, loaded]);

  const handlePress = useCallback(
    (point: MapPoint) => {
      onMapPress?.(point);
      if (picking) return;

      const hits = visibleCircles.filter(
        (circle) => circle.status !== "draft" && distanceMeters(point, circle) <= circle.radiusMeters,
      );
      setSelectedZones(hits.map((circle) => circle.id));
      if (hits.length === 1) onZonePress?.(hits[0]!.id);
    },
    [onMapPress, onZonePress, picking, visibleCircles],
  );

  const handleMarker = useCallback(
    (id: string) => {
      // Choosing a point: a tapped marker picks its own position.
      if (picking) {
        const tapped = engineMarkers.find((item) => item.id === id);
        if (tapped) onMapPress?.({ latitude: tapped.latitude, longitude: tapped.longitude });
        return;
      }
      if (id.startsWith("zone:")) {
        const zoneId = id.slice(5);
        setSelectedZones([zoneId]);
        onZonePress?.(zoneId);
        return;
      }
      if (onMarkerPress && id !== "guardian:me") onMarkerPress(id);
      else setSelectedMarker(id);
    },
    [onMarkerPress, onZonePress, onMapPress, picking, engineMarkers],
  );

  const marker = selectedMarker ? engineMarkers.find((item) => item.id === selectedMarker) ?? null : null;
  const zones = selectedZones
    .map((id) => circles.find((circle) => circle.id === id))
    .filter((circle): circle is MapCircle => Boolean(circle));

  if (Platform.OS !== "web" && NATIVE_MODE === "missing") {
    return <KeyMissing />;
  }

  return (
    <View style={styles.fill} {...touch}>
      <MapRenderer
        ref={engine}
        markers={engineMarkers}
        circles={engineCircles}
        path={enginePath}
        prefs={prefs}
        dark={dark}
        fitPadding={padding}
        mapPadding={nativePadding}
        picking={picking}
        initialView={initialView}
        onReady={() => setLoaded(true)}
        onError={setEngineError}
        onPress={handlePress}
        onMarkerPress={handleMarker}
        onViewChange={handleView}
      />

      {!loaded && !engineError ? (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color="#137A50" />
          <Text style={styles.loadingText}>Loading map</Text>
        </View>
      ) : null}

      {engineError ? (
        <View pointerEvents="none" style={styles.banner}>
          <Ionicons name="alert-circle-outline" size={15} color="#B3261E" />
          <Text style={styles.bannerText}>{engineError}</Text>
        </View>
      ) : null}

      {/* Top-right: layers, fit, full screen. */}
      <View pointerEvents="box-none" style={styles.topRight}>
        <View style={styles.group}>
          {showMapStyleControl ? (
            <ControlButton icon="layers-outline" label="Map layers" active={layersOpen} onPress={() => setLayersOpen(true)} />
          ) : null}
          <ControlButton icon="scan-outline" label="Fit everything" onPress={() => engine.current?.fit(true)} />
          {allowExpand && onToggleExpand ? (
            <ControlButton
              icon={expanded ? "contract-outline" : "expand-outline"}
              label={expanded ? "Close full screen" : "Full screen"}
              onPress={onToggleExpand}
            />
          ) : null}
        </View>
      </View>

      {/* Bottom-right: my location and zoom. */}
      <View pointerEvents="box-none" style={[styles.bottomRight, { bottom: 26 + (mapPadding?.bottom ?? 0) }]}>
        {showMyLocation ? (
          <View style={[styles.group, styles.groupGap]}>
            <ControlButton
              icon="navigate-outline"
              label="Show my location"
              busy={locating}
              onPress={() => {
                wantsMe.current = true;
                if (me) {
                  wantsMe.current = false;
                  engine.current?.focus({ latitude: me.latitude, longitude: me.longitude, zoom: 16 });
                }
                locateMe();
              }}
            />
          </View>
        ) : null}
        <View style={styles.group}>
          <ControlButton icon="add" label="Zoom in" onPress={() => engine.current?.zoomBy(1)} />
          <View style={styles.divider} />
          <ControlButton icon="remove" label="Zoom out" onPress={() => engine.current?.zoomBy(-1)} />
        </View>
      </View>

      <LayersSheet
        visible={layersOpen}
        prefs={prefs}
        hasRoute={path.length > 1}
        hasZones={circles.length > 0}
        onChange={updatePrefs}
        onClose={() => setLayersOpen(false)}
      />

      <MarkerSheet
        marker={marker}
        onClose={() => setSelectedMarker(null)}
        onFocus={(point) => {
          setSelectedMarker(null);
          engine.current?.focus({ ...point, zoom: 17 });
        }}
      />

      <ZoneSheet
        zones={picking ? [] : zones}
        onClose={() => setSelectedZones([])}
        onPick={(id) => setSelectedZones([id])}
        onFocus={(zone) => {
          setSelectedZones([]);
          engine.current?.focus({ latitude: zone.latitude, longitude: zone.longitude, radiusMeters: zone.radiusMeters });
        }}
        onEdit={
          onZoneAction
            ? (zone) => {
                setSelectedZones([]);
                onZoneAction(zone.id, "edit");
              }
            : undefined
        }
      />
    </View>
  );
}

function KeyMissing() {
  return (
    <View style={styles.keyMissing}>
      <Ionicons name="key-outline" size={26} color="#5F6B66" />
      <Text style={styles.keyTitle}>Map token missing</Text>
      <Text style={styles.keyText}>
        Add EXPO_PUBLIC_MAPBOX_TOKEN (your Mapbox public token) to .env and rebuild the app.
      </Text>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  active = false,
  busy = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress(): void;
  active?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, busy }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.control,
        (pressed || hovered) && styles.controlPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#137A50" />
      ) : (
        <Ionicons name={icon} size={19} color={active ? "#137A50" : "#3C4743"} />
      )}
    </Pressable>
  );
}

const MAP_TYPES: { id: BaseMapType; label: string }[] = [
  { id: "standard", label: "Default" },
  { id: "satellite", label: "Satellite" },
  { id: "terrain", label: "Terrain" },
];

const THEMES: { id: MapTheme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
];

// Live traffic comes from Mapbox's vector traffic tiles (phone builds) or Google (Expo Go).
const TRAFFIC_SUPPORTED = Platform.OS !== "web";

function LayersSheet({
  visible,
  prefs,
  hasRoute,
  hasZones,
  onChange,
  onClose,
}: {
  visible: boolean;
  prefs: MapPrefs;
  hasRoute: boolean;
  hasZones: boolean;
  onChange(patch: Partial<MapPrefs>): void;
  onClose(): void;
}) {
  return (
    <MapSheet visible={visible} title="Map layers" onClose={onClose}>
      <Text style={styles.sheetSection}>Map type</Text>
      <View style={styles.typeRow}>
        {MAP_TYPES.map((item) => {
          const selected = prefs.mapType === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} map`}
              accessibilityState={{ selected }}
              onPress={() => onChange({ mapType: item.id })}
              style={styles.typeItem}
            >
              <View style={[styles.thumb, selected && styles.thumbSelected]}>
                <Image source={{ uri: PREVIEW_TILES[item.id] }} style={styles.thumbImage} resizeMode="cover" />
              </View>
              <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sheetSection}>Details</Text>
      <ToggleRow
        icon="car-outline"
        label="Traffic"
        hint={TRAFFIC_SUPPORTED ? undefined : "Phone app only"}
        value={prefs.traffic && TRAFFIC_SUPPORTED}
        disabled={!TRAFFIC_SUPPORTED}
        onChange={(traffic) => onChange({ traffic })}
      />
      <ToggleRow
        icon="text-outline"
        label="Labels on satellite"
        hint={prefs.mapType === "satellite" ? undefined : "Applies to Satellite"}
        value={prefs.labels}
        onChange={(labels) => onChange({ labels })}
      />
      <ToggleRow
        icon="shield-checkmark-outline"
        label="Safe Zones"
        hint={hasZones ? undefined : "None on this map"}
        value={prefs.zones}
        onChange={(zones) => onChange({ zones })}
      />
      <ToggleRow
        icon="git-commit-outline"
        label="Route"
        hint={hasRoute ? undefined : "No route on this map"}
        value={prefs.route}
        onChange={(route) => onChange({ route })}
      />

      <Text style={styles.sheetSection}>Theme</Text>
      <View style={styles.themeRow}>
        {THEMES.map((item) => {
          const selected = prefs.theme === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} theme`}
              accessibilityState={{ selected }}
              onPress={() => onChange({ theme: item.id })}
              style={[styles.themeChip, selected && styles.themeChipSelected]}
            >
              <Text style={[styles.themeText, selected && styles.themeTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={sheetStyles.note}>Auto uses the dark map from 6 pm to 6 am. Themes apply to the Default map.</Text>
    </MapSheet>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  disabled = false,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Ionicons name={icon} size={18} color="#137A50" />
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: "#7FCBA8", false: "#D5DDD9" }}
        thumbColor={value ? "#137A50" : "#FFFFFF"}
      />
    </View>
  );
}

function MarkerSheet({
  marker,
  onClose,
  onFocus,
}: {
  marker: MapMarker | null;
  onClose(): void;
  onFocus(point: MapPoint): void;
}) {
  const person = marker?.kind === "child" || marker?.kind === "guardian";

  return (
    <MapSheet
      visible={Boolean(marker)}
      title={marker?.title ?? ""}
      subtitle={person && marker?.kind === "child" ? lastSeenLabel(marker.recordedAt) : marker?.detail}
      onClose={onClose}
    >
      {marker ? (
        <>
          {person && marker.detail ? <SheetRow icon="location-outline" label="Address" value={marker.detail} /> : null}
          {marker.recordedAt ? <SheetRow icon="time-outline" label="Updated" value={formatTime(marker.recordedAt)} /> : null}
          {marker.source ? (
            <SheetRow
              icon={marker.source === "smartwatch" ? "watch-outline" : "phone-portrait-outline"}
              label="Device"
              value={marker.source === "smartwatch" ? "Smartwatch" : "Phone"}
            />
          ) : null}
          {marker.batteryPercent != null ? (
            <SheetRow icon="battery-half-outline" label="Battery (now)" value={`${Math.round(marker.batteryPercent)}%`} />
          ) : null}
          {marker.networkType ? <SheetRow icon="cellular-outline" label="Network (now)" value={marker.networkType} /> : null}
          {marker.accuracyMeters ? (
            <SheetRow icon="locate-outline" label="Accuracy" value={`±${Math.round(marker.accuracyMeters)} m`} />
          ) : null}
          <SheetRow
            icon="navigate-circle-outline"
            label="Position"
            value={`${marker.latitude.toFixed(5)}, ${marker.longitude.toFixed(5)}`}
          />
          <View style={sheetStyles.actions}>
            <SheetButton icon="locate-outline" label="Focus" onPress={() => onFocus(marker)} />
            {marker.kind !== "guardian" ? (
              <SheetButton icon="navigate-outline" label="Directions" primary onPress={() => openDirections(marker)} />
            ) : null}
          </View>
        </>
      ) : null}
    </MapSheet>
  );
}

const ZONE_STATUS_TEXT: Record<string, string> = {
  inside: "Child inside (last event)",
  outside: "Child outside (last event)",
  active: "Active",
  inactive: "Turned off",
};

function ZoneSheet({
  zones,
  onClose,
  onPick,
  onFocus,
  onEdit,
}: {
  zones: MapCircle[];
  onClose(): void;
  onPick(id: string): void;
  onFocus(zone: MapCircle): void;
  onEdit?: (zone: MapCircle) => void;
}) {
  const zone = zones.length === 1 ? zones[0]! : null;

  return (
    <MapSheet
      visible={zones.length > 0}
      title={zone ? zone.label ?? "Safe Zone" : `${zones.length} Safe Zones here`}
      subtitle={zone ? ZONE_STATUS_TEXT[zone.status ?? "active"] : "Choose a zone"}
      onClose={onClose}
    >
      {zone ? (
        <>
          <SheetRow icon="radio-button-on-outline" label="Radius" value={formatRadius(zone.radiusMeters)} />
          <SheetRow
            icon={zone.lastEventType === "exit" ? "exit-outline" : "enter-outline"}
            label={zone.lastEventType === "exit" ? "Last exit" : zone.lastEventType === "entry" ? "Last entry" : "Last event"}
            value={zone.lastEventAt ? formatTime(zone.lastEventAt) : "None recorded"}
          />
          <SheetRow
            icon="navigate-circle-outline"
            label="Center"
            value={`${zone.latitude.toFixed(5)}, ${zone.longitude.toFixed(5)}`}
          />
          <Text style={sheetStyles.note}>Inside/outside comes from the server's latest entry or exit event for this zone.</Text>
          <View style={sheetStyles.actions}>
            <SheetButton icon="scan-outline" label="Zoom to zone" onPress={() => onFocus(zone)} />
            {onEdit && zone.editable ? <SheetButton icon="create-outline" label="Edit" primary onPress={() => onEdit(zone)} /> : null}
          </View>
        </>
      ) : (
        zones.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onPick(item.id)}
            style={({ pressed }) => [styles.zoneChoice, pressed && styles.controlPressed]}
          >
            <View style={[styles.zoneSwatch, { backgroundColor: ZONE_COLORS[item.status ?? "active"] }]} />
            <Text style={styles.zoneChoiceText}>{item.label ?? "Safe Zone"}</Text>
            <Text style={styles.zoneChoiceMeta}>{formatRadius(item.radiusMeters)}</Text>
          </Pressable>
        ))
      )}
    </MapSheet>
  );
}

/**
 * SafeTrack's map: Google Maps (react-native-maps) on Android and iOS, the
 * Google Maps JavaScript API or a Leaflet fallback on web. Markers, Safe Zones
 * and the route come in as props; controls and sheets are shared.
 */
export function SafeTrackInteractiveMap(props: Props) {
  const { height = 320, style, onMapStateChange } = props;

  const prefs = useMapPrefs((state) => state.prefs);
  const loadPrefs = useMapPrefs((state) => state.load);
  const [expanded, setExpanded] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [locating, setLocating] = useState(false);
  const lastView = useRef<MapView | null>(null);

  // Re-evaluated on each render, so Auto switches at 6 pm without a reload.
  const dark = prefs.theme === "dark" || (prefs.theme === "auto" && isNightTime());

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  // Show the guardian without asking when location access was granted before.
  useEffect(() => {
    if (props.showMyLocation === false) return;
    let active = true;

    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;
        const position = await Location.getLastKnownPositionAsync();
        if (active && position) {
          setMe({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? 0,
          });
        }
      } catch {
        // Location services off: the guardian marker simply isn't shown.
      }
    })();

    return () => {
      active = false;
    };
  }, [props.showMyLocation]);

  const locateMe = useCallback(async () => {
    if (locating) return;
    setLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        showAlert("Location permission needed", "Allow location access to show where you are on the map.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMe({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? 0,
      });
    } catch (reason) {
      showAlert(
        "Location unavailable",
        reason instanceof Error ? reason.message : "Your current location could not be found.",
      );
    } finally {
      setLocating(false);
    }
  }, [locating]);

  const trackView = useCallback(
    (view: MapView) => {
      lastView.current = view;
      onMapStateChange?.(view);
    },
    [onMapStateChange],
  );

  const shared: Shared = { prefs, dark, me, locating, locateMe: () => void locateMe() };

  return (
    <View style={[styles.container, { height }, style]}>
      <MapCore {...props} {...shared} onView={trackView} expanded={false} onToggleExpand={() => setExpanded(true)} />

      {expanded ? (
        <Modal visible animationType="fade" onRequestClose={() => setExpanded(false)}>
          <SafeAreaView style={styles.expanded} edges={["top", "bottom", "left", "right"]}>
            <MapCore
              {...props}
              {...shared}
              // Opens where the inline map was.
              initialView={lastView.current}
              onView={trackView}
              expanded
              onToggleExpand={() => setExpanded(false)}
            />
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", borderRadius: 20, backgroundColor: "#E8ECEA" },
  fill: { flex: 1 },
  expanded: { flex: 1, backgroundColor: "#E8ECEA" },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
    backgroundColor: "#E8ECEA",
  },
  loadingText: { color: "#5F6B66", fontSize: 12.5, fontWeight: "600", textAlign: "center" },
  keyMissing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 24,
    backgroundColor: "#E8ECEA",
  },
  keyTitle: { color: "#1E2B25", fontSize: 15, fontWeight: "800" },
  keyText: { maxWidth: 300, color: "#5F6B66", fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  banner: {
    position: "absolute",
    left: 12,
    right: 64,
    top: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#0F231C",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bannerText: { flex: 1, color: "#5A2420", fontSize: 11.5, lineHeight: 16 },
  topRight: { position: "absolute", top: 12, right: 12 },
  bottomRight: { position: "absolute", right: 12 },
  group: {
    width: 40,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F231C",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  groupGap: { marginBottom: 10 },
  control: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  controlPressed: { backgroundColor: "#EEF3F0" },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 8, backgroundColor: "#D5DDD9" },
  sheetSection: {
    marginTop: 12,
    marginBottom: 8,
    color: "#5F6B66",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  typeRow: { flexDirection: "row", gap: 12 },
  typeItem: { flex: 1, alignItems: "center" },
  thumb: {
    width: "100%",
    aspectRatio: 1.25,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#E8ECEA",
  },
  thumbSelected: { borderColor: "#137A50" },
  thumbImage: { width: "100%", height: "100%" },
  typeLabel: { marginTop: 6, color: "#4A5550", fontSize: 12, fontWeight: "600" },
  typeLabelSelected: { color: "#137A50", fontWeight: "800" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E3E9E6",
  },
  toggleCopy: { flex: 1 },
  toggleLabel: { color: "#1E2B25", fontSize: 13.5, fontWeight: "600" },
  toggleHint: { marginTop: 1, color: "#7A8681", fontSize: 11 },
  themeRow: { flexDirection: "row", gap: 8 },
  themeChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F4F2",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  themeChipSelected: { backgroundColor: "#E3F4EC", borderColor: "#137A50" },
  themeText: { color: "#4A5550", fontSize: 13, fontWeight: "700" },
  themeTextSelected: { color: "#137A50" },
  zoneChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: "#F4F7F5",
  },
  zoneSwatch: { width: 12, height: 12, borderRadius: 6 },
  zoneChoiceText: { flex: 1, color: "#1E2B25", fontSize: 13.5, fontWeight: "700" },
  zoneChoiceMeta: { color: "#66736D", fontSize: 12 },
});


