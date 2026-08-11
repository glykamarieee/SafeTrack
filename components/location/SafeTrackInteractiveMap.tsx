import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";

export type SafeTrackMapStyle = "default" | "satellite";

export type SafeTrackMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  detail?: string;
  kind?: "location" | "start" | "end" | "zone" | "sos";
};

export type SafeTrackMapCircle = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  label?: string;
  enabled?: boolean;
};

export type SafeTrackMapState = {
  style: SafeTrackMapStyle;
  zoom: number;
  latitude: number;
  longitude: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type SafeTrackInteractiveMapProps = {
  markers?: SafeTrackMapMarker[];
  circles?: SafeTrackMapCircle[];
  path?: Coordinate[];
  defaultCenter?: Coordinate;
  defaultZoom?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  showMapStyleControl?: boolean;
  mapStyleControlTop?: number;
  mapStyleControlLeft?: number;
  recenterSignal?: number;
  onMapStateChange?: (state: SafeTrackMapState) => void;
  onMapPress?: (coordinate: Coordinate) => void;
};

const CEBU_CENTER: Coordinate = {
  latitude: 10.3157,
  longitude: 123.8854,
};

const MAP_OPTIONS: {
  key: SafeTrackMapStyle;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "default",
    label: "Default",
    description: "Roads and places",
    icon: "map-outline",
  },
  {
    key: "satellite",
    label: "Satellite",
    description: "Aerial imagery",
    icon: "earth-outline",
  },
];

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createMapHtml(
  markers: SafeTrackMapMarker[],
  circles: SafeTrackMapCircle[],
  path: Coordinate[],
  defaultCenter: Coordinate,
  defaultZoom: number
) {
  const cleanMarkers = markers
    .filter((marker) =>
      isValidCoordinate(Number(marker.latitude), Number(marker.longitude))
    )
    .map((marker) => ({
      ...marker,
      latitude: Number(marker.latitude),
      longitude: Number(marker.longitude),
      title: escapeHtml(String(marker.title ?? "SafeTrack location")),
      detail: escapeHtml(String(marker.detail ?? "")),
    }));

  const cleanCircles = circles
    .filter(
      (circle) =>
        isValidCoordinate(Number(circle.latitude), Number(circle.longitude)) &&
        Number(circle.radiusMeters) > 0
    )
    .map((circle) => ({
      ...circle,
      latitude: Number(circle.latitude),
      longitude: Number(circle.longitude),
      radiusMeters: Number(circle.radiusMeters),
      label: escapeHtml(String(circle.label ?? "Safe zone")),
    }));

  const cleanPath = path
    .filter((point) =>
      isValidCoordinate(Number(point.latitude), Number(point.longitude))
    )
    .map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    }));

  const mapData = JSON.stringify({
    markers: cleanMarkers,
    circles: cleanCircles,
    path: cleanPath,
    defaultCenter,
    defaultZoom,
  }).replaceAll("<", "\\u003c");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />

  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />

  <style>
    html,
    body,
    #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #d7edf4;
    }

    .leaflet-control-zoom {
      display: none !important;
    }

    .leaflet-control-attribution {
      font-family: Arial, sans-serif !important;
      font-size: 8px !important;
      padding: 2px 5px !important;
      color: #536e62 !important;
      background: rgba(255,255,255,0.78) !important;
      border-radius: 8px 0 0 0 !important;
    }

    .leaflet-control-attribution a {
      color: #287552 !important;
    }

    .leaflet-popup-content-wrapper {
      border-radius: 15px !important;
      box-shadow: 0 10px 24px rgba(20, 61, 39, 0.20) !important;
    }

    .leaflet-popup-content {
      margin: 12px 14px !important;
      font-family: Arial, sans-serif !important;
    }

    .popup-title {
      color: #153525;
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 4px;
    }

    .popup-detail {
      color: #64766c;
      font-size: 11px;
      line-height: 1.45;
    }

    .safetrack-marker {
      width: 44px;
      height: 44px;
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      color: #ffffff;
      border: 4px solid #ffffff;
      box-shadow: 0 6px 17px rgba(16, 84, 49, 0.30);
      font-family: Arial, sans-serif;
      font-weight: 900;
      font-size: 14px;
    }

    .marker-location {
      background: #19a96a;
    }

    .marker-start {
      background: #2f7250;
    }

    .marker-end {
      background: #17955e;
    }

    .marker-zone {
      background: #276e9f;
    }

    .marker-sos {
      background: #cf4d4d;
    }

    .marker-inner {
      width: 17px;
      height: 17px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.22);
      border: 2px solid rgba(255,255,255,0.92);
      font-size: 9px;
    }
  </style>
</head>

<body>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    const data = ${mapData};

    const MAP_SOURCES = {
      default: {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      },
      satellite: {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19,
      },
    };

    const map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      minZoom: 4,
      maxZoom: 19,
    }).setView(
      [data.defaultCenter.latitude, data.defaultCenter.longitude],
      data.defaultZoom
    );

    let activeLayer = null;
    let activeStyle = "default";

    function sendToApp(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function markerSymbol(kind) {
      if (kind === "start") return "S";
      if (kind === "end") return "E";
      if (kind === "zone") return "Z";
      if (kind === "sos") return "!";
      return "•";
    }

    function setSafeTrackMapStyle(nextStyle, notify = true) {
      const source = MAP_SOURCES[nextStyle] || MAP_SOURCES.default;

      if (activeLayer) {
        map.removeLayer(activeLayer);
      }

      activeLayer = L.tileLayer(source.url, {
        maxZoom: source.maxZoom,
        attribution: source.attribution,
      }).addTo(map);

      activeStyle = nextStyle;

      if (notify) {
        const center = map.getCenter();

        sendToApp({
          type: "map-state",
          style: activeStyle,
          zoom: map.getZoom(),
          latitude: center.lat,
          longitude: center.lng,
        });
      }
    }

    function getAllCoordinates() {
      const coordinates = [];

      data.markers.forEach((marker) => {
        coordinates.push([marker.latitude, marker.longitude]);
      });

      data.circles.forEach((circle) => {
        coordinates.push([circle.latitude, circle.longitude]);
      });

      data.path.forEach((point) => {
        coordinates.push([point.latitude, point.longitude]);
      });

      return coordinates;
    }

    function fitSafeTrackContent() {
      const coordinates = getAllCoordinates();

      if (!coordinates.length) {
        map.flyTo(
          [data.defaultCenter.latitude, data.defaultCenter.longitude],
          data.defaultZoom,
          {
            animate: true,
            duration: 0.65,
          }
        );
        return;
      }

      if (coordinates.length === 1) {
        map.flyTo(coordinates[0], 15, {
          animate: true,
          duration: 0.65,
        });
        return;
      }

      map.fitBounds(coordinates, {
        padding: [34, 34],
        maxZoom: 15,
        animate: true,
      });
    }

    window.safeTrackResetMap = fitSafeTrackContent;

    window.safeTrackSetMapStyle = function (style) {
      setSafeTrackMapStyle(style, true);
    };

    setSafeTrackMapStyle("default", false);

    if (data.path.length > 1) {
      L.polyline(data.path, {
        color: "#188f5a",
        weight: 4,
        opacity: 0.86,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    data.circles.forEach((circle) => {
      const enabled = circle.enabled !== false;

      const zoneCircle = L.circle(
        [circle.latitude, circle.longitude],
        {
          radius: circle.radiusMeters,
          color: enabled ? "#19885a" : "#718178",
          weight: 2,
          opacity: 0.82,
          fillColor: enabled ? "#4ecb8d" : "#aab7b1",
          fillOpacity: enabled ? 0.18 : 0.11,
        }
      ).addTo(map);

      zoneCircle.bindPopup(
        '<div class="popup-title">' +
          circle.label +
        '</div>' +
        '<div class="popup-detail">' +
          Math.round(circle.radiusMeters) +
          ' meter safe-zone radius</div>'
      );
    });

    data.markers.forEach((marker) => {
      const kind = marker.kind || "location";

      const icon = L.divIcon({
        className: "",
        html:
          '<div class="safetrack-marker marker-' +
          kind +
          '"><div class="marker-inner">' +
          markerSymbol(kind) +
          '</div></div>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -23],
      });

      const leafletMarker = L.marker(
        [marker.latitude, marker.longitude],
        { icon: icon }
      ).addTo(map);

      leafletMarker.bindPopup(
        '<div class="popup-title">' +
          marker.title +
        '</div>' +
        '<div class="popup-detail">' +
          marker.detail +
        '</div>'
      );
    });

    fitSafeTrackContent();

    map.on("moveend", function () {
      const center = map.getCenter();

      sendToApp({
        type: "map-state",
        style: activeStyle,
        zoom: map.getZoom(),
        latitude: center.lat,
        longitude: center.lng,
      });
    });

    map.on("click", function (event) {
      sendToApp({
        type: "map-press",
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    });

    setTimeout(function () {
      map.invalidateSize();
    }, 350);
  </script>
</body>
</html>
`;
}

export function SafeTrackInteractiveMap({
  markers = [],
  circles = [],
  path = [],
  defaultCenter = CEBU_CENTER,
  defaultZoom = 12,
  height = 300,
  style,
  showMapStyleControl = true,
  mapStyleControlTop = 14,
  mapStyleControlLeft = 14,
  recenterSignal = 0,
  onMapStateChange,
  onMapPress,
}: SafeTrackInteractiveMapProps) {
  const webViewRef = useRef<WebView>(null);
  const lastRecenterSignal = useRef(recenterSignal);

  const [mapStyle, setMapStyle] = useState<SafeTrackMapStyle>("default");
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const mapHtml = useMemo(
    () =>
      createMapHtml(
        markers,
        circles,
        path,
        defaultCenter,
        defaultZoom
      ),
    [markers, circles, path, defaultCenter, defaultZoom]
  );

  const injectMapStyle = useCallback((styleToApply: SafeTrackMapStyle) => {
    webViewRef.current?.injectJavaScript(`
      if (window.safeTrackSetMapStyle) {
        window.safeTrackSetMapStyle(${JSON.stringify(styleToApply)});
      }
      true;
    `);
  }, []);

  useEffect(() => {
    if (lastRecenterSignal.current === recenterSignal) {
      return;
    }

    lastRecenterSignal.current = recenterSignal;

    webViewRef.current?.injectJavaScript(`
      if (window.safeTrackResetMap) {
        window.safeTrackResetMap();
      }
      true;
    `);
  }, [recenterSignal]);

  const handleMapMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        style?: SafeTrackMapStyle;
        zoom?: number;
        latitude?: number;
        longitude?: number;
      };

      if (
        payload.type === "map-state" &&
        payload.style &&
        typeof payload.zoom === "number" &&
        typeof payload.latitude === "number" &&
        typeof payload.longitude === "number"
      ) {
        const nextStyle =
          payload.style === "satellite" ? "satellite" : "default";

        setMapStyle(nextStyle);

        onMapStateChange?.({
          style: nextStyle,
          zoom: Math.round(payload.zoom),
          latitude: payload.latitude,
          longitude: payload.longitude,
        });
      }

      if (
        payload.type === "map-press" &&
        typeof payload.latitude === "number" &&
        typeof payload.longitude === "number"
      ) {
        onMapPress?.({
          latitude: payload.latitude,
          longitude: payload.longitude,
        });
      }
    } catch {
      // Ignore unexpected WebView messages safely.
    }
  };

  const selectMapStyle = (nextStyle: SafeTrackMapStyle) => {
    setMapStyle(nextStyle);
    setShowStyleMenu(false);
    injectMapStyle(nextStyle);
  };

  return (
    <View style={[styles.root, { height }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        mixedContentMode="compatibility"
        onMessage={handleMapMessage}
        onLoadEnd={() => {
          setTimeout(() => {
            injectMapStyle(mapStyle);
          }, 180);
        }}
        style={styles.webView}
      />

      {showMapStyleControl ? (
        <View pointerEvents="box-none" style={styles.overlay}>
          <View
            style={[
              styles.mapStyleControl,
              {
                top: mapStyleControlTop,
                left: mapStyleControlLeft,
              },
            ]}
          >
            <Pressable
              onPress={() => setShowStyleMenu((value) => !value)}
              style={({ pressed }) => [
                styles.mapStyleButton,
                showStyleMenu && styles.mapStyleButtonOpen,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="layers-outline"
                size={18}
                color={showStyleMenu ? colors.white : colors.primaryDark}
              />

              <Text
                style={[
                  styles.mapStyleText,
                  showStyleMenu && styles.mapStyleTextOpen,
                ]}
              >
                Map style
              </Text>

              <Ionicons
                name={showStyleMenu ? "chevron-up" : "chevron-down"}
                size={16}
                color={showStyleMenu ? colors.white : colors.primaryDark}
              />
            </Pressable>

            {showStyleMenu ? (
              <View style={styles.mapStyleMenu}>
                {MAP_OPTIONS.map((option, index) => {
                  const selected = mapStyle === option.key;

                  return (
                    <View key={option.key}>
                      {index > 0 ? <View style={styles.menuDivider} /> : null}

                      <Pressable
                        onPress={() => selectMapStyle(option.key)}
                        style={({ pressed }) => [
                          styles.mapStyleOption,
                          selected && styles.mapStyleOptionSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.menuIcon,
                            selected && styles.menuIconSelected,
                          ]}
                        >
                          <Ionicons
                            name={option.icon}
                            size={18}
                            color={
                              selected
                                ? colors.white
                                : colors.primaryDark
                            }
                          />
                        </View>

                        <View style={styles.menuCopy}>
                          <Text
                            style={[
                              styles.menuTitle,
                              selected && styles.menuTitleSelected,
                            ]}
                          >
                            {option.label}
                          </Text>

                          <Text style={styles.menuDescription}>
                            {option.description}
                          </Text>
                        </View>

                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={colors.primary}
                          />
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    backgroundColor: "#D7EDF4",
  },

  webView: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#D7EDF4",
  },

  overlay: {
    ...StyleSheet.absoluteFill,
  },

  mapStyleControl: {
    position: "absolute",
    width: 154,
  },

  mapStyleButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    ...shadow.soft,
  },

  mapStyleButtonOpen: {
    backgroundColor: colors.primary,
  },

  mapStyleText: {
    flex: 1,
    marginLeft: 7,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },

  mapStyleTextOpen: {
    color: colors.white,
  },

  mapStyleMenu: {
    overflow: "hidden",
    marginTop: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.98)",
    ...shadow.card,
  },

  mapStyleOption: {
    minHeight: 62,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
  },

  mapStyleOptionSelected: {
    backgroundColor: "#F0F8F3",
  },

  menuIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  menuIconSelected: {
    backgroundColor: colors.primary,
  },

  menuCopy: {
    flex: 1,
    marginLeft: 9,
  },

  menuTitle: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
  },

  menuTitleSelected: {
    color: colors.primaryDark,
  },

  menuDescription: {
    color: colors.muted,
    fontSize: 10.5,
    marginTop: 2,
  },

  menuDivider: {
    height: 1,
    marginLeft: 56,
    backgroundColor: colors.border,
  },

  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.97 }],
  },
});