import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { PixelRatio, Platform, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import MapView, { Circle, Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Camera } from "react-native-maps";

import { MarkerGlyph, glyphBox } from "./MarkerGlyph";
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from "./mapStyles";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZONE_COLORS,
  clampZoom,
  contentPoints,
  distanceMeters,
  zoomFromRegion,
  type MapCircle,
  type MapEngineHandle,
  type MapEngineProps,
  type MapMarker,
} from "./mapTypes";

// Expo Go only: it has no Mapbox native code, but it ships react-native-maps
// with its own Google key on Android (Apple Maps on iOS).
const MODE = Platform.OS === "android" ? "google" : "apple";

// Android's fitToCoordinates takes edge padding in physical pixels.
const PADDING_SCALE = Platform.OS === "android" ? PixelRatio.get() : 1;

/** Expo Go preview renderer: react-native-maps. Builds use MapboxRenderer. */
export const ExpoGoMapRenderer = forwardRef<MapEngineHandle, MapEngineProps>(function ExpoGoMapRenderer(props, ref) {
  const {
    markers,
    circles,
    path,
    prefs,
    dark,
    fitPadding,
    mapPadding,
    initialView,
    onReady,
    onPress,
    onMarkerPress,
    onViewChange,
  } = props;

  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const width = useRef(360);
  // Camera rules: fit once; afterwards only Fit, Focus, Zoom and My location move it.
  const fitted = useRef(Boolean(initialView));
  const targetZoom = useRef<number | null>(null);
  const zoomQueue = useRef<Promise<void>>(Promise.resolve());

  const latest = useRef({ markers, circles, path, fitPadding });
  latest.current = { markers, circles, path, fitPadding };

  const fit = useCallback((animated: boolean) => {
    const view = map.current;
    if (!view) return;
    const { markers, circles, path, fitPadding } = latest.current;
    const points = contentPoints(markers, circles, path);
    if (!points.length) return;

    fitted.current = true;
    targetZoom.current = null;

    const spread = points.reduce((max, point) => Math.max(max, distanceMeters(points[0]!, point)), 0);
    if (spread < 30) {
      view.animateCamera(
        { center: points[0]!, zoom: 16, altitude: 1200, heading: 0, pitch: 0 },
        { duration: animated ? 450 : 0 },
      );
      return;
    }

    view.fitToCoordinates(points, {
      animated,
      edgePadding: {
        top: fitPadding.top * PADDING_SCALE,
        right: fitPadding.right * PADDING_SCALE,
        bottom: fitPadding.bottom * PADDING_SCALE,
        left: fitPadding.left * PADDING_SCALE,
      },
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fit,
      focus(target) {
        const view = map.current;
        if (!view) return;
        fitted.current = true;
        targetZoom.current = null;

        if (target.radiusMeters && target.radiusMeters > 0) {
          const { fitPadding } = latest.current;
          view.fitToCoordinates(
            contentPoints([], [{ id: "focus", ...target, radiusMeters: target.radiusMeters * 1.15 }], []),
            {
              animated: true,
              edgePadding: {
                top: fitPadding.top * PADDING_SCALE,
                right: fitPadding.right * PADDING_SCALE,
                bottom: fitPadding.bottom * PADDING_SCALE,
                left: fitPadding.left * PADDING_SCALE,
              },
            },
          );
          return;
        }

        void view.getCamera().then((camera) => {
          view.animateCamera(
            {
              center: { latitude: target.latitude, longitude: target.longitude },
              zoom: Math.max(camera.zoom ?? 0, target.zoom ?? 16),
              altitude: Math.min(camera.altitude ?? 1200, 1200),
            },
            { duration: 500 },
          );
        });
      },
      zoomBy(delta) {
        // Queued, so fast taps add up instead of reading a mid-animation camera.
        zoomQueue.current = zoomQueue.current.then(async () => {
          const view = map.current;
          if (!view) return;
          let camera: Camera;
          try {
            camera = await view.getCamera();
          } catch {
            return;
          }

          if (camera.zoom != null) {
            const base = targetZoom.current ?? camera.zoom;
            const next = clampZoom(Math.round(base) + delta);
            targetZoom.current = next;
            view.animateCamera({ zoom: next }, { duration: 220 });
          } else if (camera.altitude != null) {
            // Apple Maps: altitude halves per zoom level.
            const next = Math.min(4e7, Math.max(150, camera.altitude / 2 ** delta));
            view.animateCamera({ altitude: next }, { duration: 220 });
          }
        });
      },
    }),
    [fit],
  );

  // The first fit, once the map is ready and there is something to show.
  const hasContent = markers.length > 0 || circles.length > 0 || path.length > 0;
  useEffect(() => {
    if (ready && hasContent && !fitted.current) fit(false);
  }, [ready, hasContent, fit]);

  const onLayout = (event: LayoutChangeEvent) => {
    width.current = event.nativeEvent.layout.width || width.current;
  };

  const mapType =
    prefs.mapType === "satellite" ? (prefs.labels ? "hybrid" : "satellite") : prefs.mapType;
  const styled = mapType === "standard" || mapType === "terrain";

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <MapView
        ref={map}
        style={styles.fill}
        provider={MODE === "google" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        customMapStyle={MODE === "google" && styled ? (dark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE) : undefined}
        userInterfaceStyle={dark ? "dark" : "light"}
        mapType={mapType}
        showsTraffic={prefs.traffic}
        mapPadding={mapPadding}
        initialCamera={
          initialView
            ? {
                center: { latitude: initialView.latitude, longitude: initialView.longitude },
                zoom: initialView.zoom,
                altitude: 591657550.5 / 2 ** initialView.zoom / 2,
                heading: 0,
                pitch: 0,
              }
            : undefined
        }
        minZoomLevel={MIN_ZOOM}
        maxZoomLevel={MAX_ZOOM}
        // Our own controls replace these.
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        showsIndoors={false}
        showsBuildings={false}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled={false}
        onMapReady={() => {
          setReady(true);
          onReady();
        }}
        onPress={(event) => {
          // iOS also reports marker taps here; those carry an action.
          const action = (event.nativeEvent as { action?: string }).action;
          if (action === "marker-press") return;
          onPress(event.nativeEvent.coordinate);
        }}
        onRegionChangeComplete={(region) => {
          targetZoom.current = null;
          onViewChange({
            latitude: region.latitude,
            longitude: region.longitude,
            zoom: zoomFromRegion(region.longitudeDelta, width.current),
          });
        }}
      >
        {circles.map((circle) => (
          <ZoneCircle key={circle.id} circle={circle} />
        ))}

        {path.length > 1 ? (
          <>
            <Polyline coordinates={path} strokeColor="#FFFFFF" strokeWidth={9} lineCap="round" lineJoin="round" zIndex={2} />
            <Polyline coordinates={path} strokeColor="#22B35E" strokeWidth={5} lineCap="round" lineJoin="round" zIndex={3} />
          </>
        ) : null}

        {markers.map((marker) => (
          <NativeMarker key={marker.id} marker={marker} onPress={onMarkerPress} />
        ))}
      </MapView>
    </View>
  );
});

const ZoneCircle = memo(function ZoneCircle({ circle }: { circle: MapCircle }) {
  const status = circle.status ?? (circle.enabled === false ? "inactive" : "active");
  const color = ZONE_COLORS[status];
  const fill =
    status === "accuracy" ? 0.12 : status === "inactive" ? 0.06 : status === "outside" ? 0.1 : status === "draft" ? 0.16 : 0.14;

  return (
    <Circle
      center={{ latitude: circle.latitude, longitude: circle.longitude }}
      radius={circle.radiusMeters}
      strokeColor={status === "accuracy" ? "transparent" : color}
      strokeWidth={status === "accuracy" ? 0 : 2}
      fillColor={hexWithAlpha(color, fill)}
      lineDashPattern={status === "inactive" || status === "draft" ? [8, 8] : undefined}
      zIndex={status === "accuracy" ? 0 : 1}
    />
  );
});

const NativeMarker = memo(function NativeMarker({
  marker,
  onPress,
}: {
  marker: MapMarker;
  onPress(id: string): void;
}) {
  const box = glyphBox(marker);
  const offset = marker.offsetX ?? 0;
  const pulsing = marker.ring === "sos";

  // Custom views are snapshotted into a bitmap: keep re-drawing only until the
  // photo has loaded (or the look changes), then stop for smooth panning.
  const look = `${marker.photoUrl ?? ""}|${marker.ring}|${marker.initials}|${marker.label}|${marker.batteryPercent}|${marker.source}|${marker.tint}|${marker.title}`;
  const [tracking, setTracking] = useState(true);
  const settledLook = useRef<string | null>(null);

  useEffect(() => {
    if (settledLook.current !== look) setTracking(true);
  }, [look]);

  const onSettled = useCallback(() => {
    settledLook.current = look;
    // One more frame so the loaded image is in the snapshot.
    setTimeout(() => setTracking(false), 120);
  }, [look]);

  const simple = !["child", "guardian", "replay"].includes(marker.kind ?? "");
  useEffect(() => {
    if (simple) onSettled();
  }, [simple, onSettled]);

  return (
    <Marker
      identifier={marker.id}
      coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
      anchor={{ x: 0.5 - offset / box.width, y: box.anchorY / box.height }}
      centerOffset={{ x: offset, y: box.height / 2 - box.anchorY }}
      tracksViewChanges={tracking || pulsing}
      zIndex={zIndexFor(marker)}
      tappable={marker.kind !== "replay"}
      stopPropagation
      onPress={() => onPress(marker.id)}
    >
      <View style={{ width: box.width, height: box.height }} collapsable={false}>
        <MarkerGlyph marker={marker} onSettled={onSettled} />
      </View>
    </Marker>
  );
});

function zIndexFor(marker: MapMarker) {
  switch (marker.kind) {
    case "replay":
      return 60;
    case "child":
      return 50;
    case "guardian":
      return 45;
    case "end":
    case "sos":
      return 40;
    case "event":
      return 30;
    case "stop":
      return 20;
    case "start":
      return 15;
    default:
      return 10;
  }
}

function hexWithAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
