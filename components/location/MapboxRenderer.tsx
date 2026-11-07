import { forwardRef, memo, type ElementRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Mapbox, {
  Camera,
  CircleLayer,
  FillLayer,
  LineLayer,
  MapView,
  MarkerView,
  ShapeSource,
  VectorSource,
  type MapState,
} from "@rnmapbox/maps";

import { MarkerGlyph, glyphBox } from "./MarkerGlyph";
import { MAPBOX_TOKEN } from "./mapSupport";
import {
  DEFAULT_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  ZONE_COLORS,
  circleBounds,
  circleRing,
  clampZoom,
  contentPoints,
  distanceMeters,
  splitRoute,
  type MapCircle,
  type MapEngineHandle,
  type MapEngineProps,
  type MapMarker,
  type MapPoint,
  type MapPrefs,
} from "./mapTypes";

void Mapbox.setAccessToken(MAPBOX_TOKEN);

function styleUrl(prefs: MapPrefs, dark: boolean) {
  if (prefs.mapType === "satellite") {
    return prefs.labels ? "mapbox://styles/mapbox/satellite-streets-v12" : "mapbox://styles/mapbox/satellite-v9";
  }
  if (prefs.mapType === "terrain") return "mapbox://styles/mapbox/outdoors-v12";

  return dark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12";
}

/** South-west and north-east corners around a set of points, in Mapbox [lng, lat] order. */
function boundsOf(points: MapPoint[]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  points.forEach((point) => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  });

  return { ne: [maxLng, maxLat], sw: [minLng, minLat], center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] };
}

/** Android and iOS builds: Mapbox Maps SDK (@rnmapbox/maps). */
export const MapboxRenderer = forwardRef<MapEngineHandle, MapEngineProps>(function MapboxRenderer(props, ref) {
  const { markers, circles, path, prefs, dark, mapPadding, initialView, onReady, onError, onPress, onMarkerPress, onViewChange } = props;

  const camera = useRef<ElementRef<typeof Camera>>(null);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  // Camera rules: fit once; afterwards only Fit, Focus, Zoom and My location move it.
  const fitted = useRef(Boolean(initialView));
  const currentZoom = useRef(initialView?.zoom ?? DEFAULT_VIEW.zoom);
  const targetZoom = useRef<number | null>(null);

  const latest = useRef(props);
  latest.current = props;

  const size = useRef({ width: 0, height: 0 });

  // Overlays at the bottom (mapPadding) are kept clear when fitting too.
  // Scaled down when it would leave no room for the content, which made
  // Mapbox skip the fit ("combined padding exceeds the map size").
  const padding = () => {
    const { fitPadding, mapPadding } = latest.current;
    const [top, right, bottom, left] = [
      fitPadding.top + mapPadding.top,
      fitPadding.right + mapPadding.right,
      fitPadding.bottom + mapPadding.bottom,
      fitPadding.left + mapPadding.left,
    ];
    const { width, height } = size.current;
    const fitY = height > 0 && top + bottom > height * 0.8 ? (height * 0.8) / (top + bottom) : 1;
    const fitX = width > 0 && left + right > width * 0.8 ? (width * 0.8) / (left + right) : 1;
    return [top * fitY, right * fitX, bottom * fitY, left * fitX];
  };

  const fitPoints = useCallback((points: MapPoint[], animated: boolean) => {
    const cam = camera.current;
    if (!cam || !points.length) return;
    fitted.current = true;
    targetZoom.current = null;

    const spread = points.reduce((max, point) => Math.max(max, distanceMeters(points[0]!, point)), 0);
    const { ne, sw, center } = boundsOf(points);
    // Very small content: a street-level view rather than zooming all the way in.
    if (spread < 150) {
      cam.setCamera({ centerCoordinate: center, zoomLevel: 16, animationDuration: animated ? 450 : 0, animationMode: "easeTo" });
      return;
    }
    cam.fitBounds(ne, sw, padding(), animated ? 600 : 0);
  }, []);

  const fit = useCallback(
    (animated: boolean) => {
      const { markers, circles, path } = latest.current;
      fitPoints(contentPoints(markers, circles, path), animated);
    },
    [fitPoints],
  );

  useImperativeHandle(
    ref,
    () => ({
      fit,
      focus(target) {
        if (target.radiusMeters && target.radiusMeters > 0) {
          fitPoints(circleBounds({ ...target, radiusMeters: target.radiusMeters * 1.15 }), true);
          return;
        }
        fitted.current = true;
        targetZoom.current = null;
        camera.current?.setCamera({
          centerCoordinate: [target.longitude, target.latitude],
          zoomLevel: Math.max(currentZoom.current, target.zoom ?? 16),
          animationDuration: 500,
          animationMode: "easeTo",
        });
      },
      zoomBy(delta) {
        // Fast taps add up: the next step starts from the pending target.
        const base = targetZoom.current ?? currentZoom.current;
        const next = clampZoom(Math.round(base) + delta);
        targetZoom.current = next;
        camera.current?.zoomTo(next, 220);
      },
    }),
    [fit, fitPoints],
  );

  // The first fit, once the map is ready and there is something to show.
  const hasContent = markers.length > 0 || circles.length > 0 || path.length > 0;
  useEffect(() => {
    if (ready && hasContent && !fitted.current) fit(false);
  }, [ready, hasContent, fit]);

  const zoneShape = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: circles.map((circle) => circleFeature(circle)),
    }),
    [circles],
  );

  // Road pieces (solid green) and unknown stretches (dashed grey).
  const routeShape = useMemo(() => {
    if (path.length < 2) return null;
    const { pieces, gaps } = splitRoute(path);
    const feature = (points: MapPoint[], gap: boolean) => ({
      type: "Feature" as const,
      properties: { gap },
      geometry: { type: "LineString" as const, coordinates: points.map((point) => [point.longitude, point.latitude]) },
    });
    return {
      type: "FeatureCollection" as const,
      features: [...pieces.map((piece) => feature(piece, false)), ...gaps.map((gap) => feature(gap, true))],
    };
  }, [path]);

  const stepShape = useMemo(() => {
    const steps = props.footprints ?? [];
    if (!steps.length) return null;
    return {
      type: "FeatureCollection" as const,
      features: steps.map((step) => ({
        type: "Feature" as const,
        properties: { opacity: step.opacity },
        geometry: { type: "Point" as const, coordinates: [step.longitude, step.latitude] },
      })),
    };
  }, [props.footprints]);

  const start = initialView ?? DEFAULT_VIEW;
  const ornamentBottom = 8 + mapPadding.bottom;

  return (
    // MapView keeps onLayout for itself, so the size is measured here.
    <View
      style={styles.fill}
      onLayout={(event) => {
        size.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
      }}
    >
      <MapView
        style={styles.fill}
        styleURL={styleUrl(prefs, dark)}
        // Mapbox's terms: the logo and attribution must stay visible.
        logoPosition={{ bottom: ornamentBottom, left: 8 }}
        attributionPosition={{ bottom: ornamentBottom, left: 92 }}
        scaleBarEnabled={false}
        compassEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // Android: keep drags inside the map even within a ScrollView.
        requestDisallowInterceptTouchEvent
        onDidFinishLoadingMap={() => {
          loaded.current = true;
          setReady(true);
          onReady();
        }}
        // Also fired for a single map tile that failed on a brief network drop,
        // which Mapbox retries by itself. Only a map that never loaded is an error.
        onMapLoadingError={() => {
          if (!loaded.current) onError("The map could not load. Check the internet connection, then reopen this screen.");
        }}
        onPress={(feature) => {
          const [longitude, latitude] = feature.geometry.coordinates;
          onPress({ latitude: latitude!, longitude: longitude! });
        }}
        onCameraChanged={(state: MapState) => {
          currentZoom.current = state.properties.zoom;
        }}
        onMapIdle={(state: MapState) => {
          currentZoom.current = state.properties.zoom;
          targetZoom.current = null;
          const [longitude, latitude] = state.properties.center;
          onViewChange({ latitude: latitude!, longitude: longitude!, zoom: state.properties.zoom });
        }}
      >
        <Camera
          ref={camera}
          defaultSettings={{ centerCoordinate: [start.longitude, start.latitude], zoomLevel: start.zoom }}
          minZoomLevel={MIN_ZOOM}
          maxZoomLevel={MAX_ZOOM}
        />

        {prefs.traffic ? (
          <VectorSource id="st-traffic" url="mapbox://mapbox.mapbox-traffic-v1">
            <LineLayer
              id="st-traffic-line"
              sourceLayerID="traffic"
              style={{
                lineColor: [
                  "match",
                  ["get", "congestion"],
                  "low",
                  "#2DBE84",
                  "moderate",
                  "#F4B400",
                  "heavy",
                  "#E8710A",
                  "severe",
                  "#B42318",
                  "#9AA5A0",
                ],
                lineWidth: 2.5,
                lineCap: "round",
              }}
            />
          </VectorSource>
        ) : null}

        <ShapeSource id="st-zones" shape={zoneShape}>
          <FillLayer id="st-zone-fill" style={{ fillColor: ["get", "color"], fillOpacity: ["get", "opacity"] }} />
          <LineLayer
            id="st-zone-line"
            filter={["==", ["get", "dashed"], false]}
            style={{ lineColor: ["get", "color"], lineWidth: ["get", "width"], lineOpacity: 0.95 }}
          />
          <LineLayer
            id="st-zone-line-dashed"
            filter={["==", ["get", "dashed"], true]}
            style={{ lineColor: ["get", "color"], lineWidth: 2, lineDasharray: [3, 3] }}
          />
        </ShapeSource>

        {routeShape ? (
          <ShapeSource id="st-route" shape={routeShape}>
            <LineLayer
              id="st-route-casing"
              filter={["==", ["get", "gap"], false]}
              style={{ lineColor: "#FFFFFF", lineWidth: 9, lineCap: "round", lineJoin: "round" }}
            />
            <LineLayer
              id="st-route-line"
              filter={["==", ["get", "gap"], false]}
              style={{ lineColor: "#22B35E", lineWidth: 5, lineCap: "round", lineJoin: "round" }}
            />
            <LineLayer
              id="st-route-gap-casing"
              filter={["==", ["get", "gap"], true]}
              style={{ lineColor: "#FFFFFF", lineWidth: 8, lineCap: "round", lineJoin: "round", lineOpacity: 0.9 }}
            />
            <LineLayer
              id="st-route-gap"
              filter={["==", ["get", "gap"], true]}
              style={{ lineColor: "#22B35E", lineWidth: 5, lineDasharray: [1.6, 1.2], lineJoin: "round" }}
            />
          </ShapeSource>
        ) : null}

        {stepShape ? (
          <ShapeSource id="st-steps" shape={stepShape}>
            <CircleLayer
              id="st-steps-dot"
              style={{
                circleRadius: ["interpolate", ["linear"], ["zoom"], 14, 1.6, 17, 3.2, 20, 5.5],
                circleColor: dark ? "#BFE8CF" : "#0D2A1E",
                circleOpacity: ["get", "opacity"],
                circleStrokeColor: dark ? "#0D2A1E" : "#FFFFFF",
                circleStrokeWidth: 1,
                circleStrokeOpacity: ["get", "opacity"],
              }}
            />
          </ShapeSource>
        ) : null}

        {[...markers].sort((first, second) => zIndexFor(first) - zIndexFor(second)).map((marker) => (
          <MapboxMarker key={marker.id} marker={marker} onPress={onMarkerPress} />
        ))}
      </MapView>
    </View>
  );
});

function circleFeature(circle: MapCircle) {
  const status = circle.status ?? (circle.enabled === false ? "inactive" : "active");

  return {
    type: "Feature" as const,
    id: circle.id,
    properties: {
      color: ZONE_COLORS[status],
      opacity:
        status === "accuracy" ? 0.12 : status === "inactive" ? 0.06 : status === "outside" ? 0.1 : status === "draft" ? 0.16 : 0.14,
      width: status === "accuracy" ? 0 : 2,
      dashed: status === "inactive" || status === "draft",
    },
    geometry: { type: "Polygon" as const, coordinates: [circleRing(circle)] },
  };
}

const MapboxMarker = memo(function MapboxMarker({ marker, onPress }: { marker: MapMarker; onPress(id: string): void }) {
  const box = glyphBox(marker);
  const offset = marker.offsetX ?? 0;
  const glyph = (
    <View style={{ width: box.width, height: box.height }}>
      <MarkerGlyph marker={marker} />
    </View>
  );

  return (
    <MarkerView
      coordinate={[marker.longitude, marker.latitude]}
      anchor={{ x: 0.5 - offset / box.width, y: box.anchorY / box.height }}
      allowOverlap
      allowOverlapWithPuck
    >
      {marker.kind === "replay" ? (
        glyph
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={marker.title} onPress={() => onPress(marker.id)}>
          {glyph}
        </Pressable>
      )}
    </MarkerView>
  );
});

function zIndexFor(marker: MapMarker) {
  const order: Record<string, number> = { replay: 60, child: 50, guardian: 45, end: 40, sos: 40, event: 30, stop: 20, start: 15 };

  return order[marker.kind ?? ""] ?? 10;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
