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
        isValidCoordinate(
          Number(circle.latitude),
          Number(circle.longitude)
        ) && Number(circle.radiusMeters) > 0
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
      isValidCoordinate(
        Number(point.latitude),
        Number(point.longitude)
      )
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
      background: #D7EDF4;
      touch-action: none;
    }

    /*
     * Leaflet's built-in zoom control is hidden because
     * SafeTrack provides its own native + / - controls.
     */
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

    /*
     * SAFETRACK MARKERS
     */

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

    /*
     * Improve touch interaction.
     */

    .leaflet-container {
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
    }

  </style>

</head>

<body>

  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>

    const data = ${mapData};

    /*
     * MAP TILE SOURCES
     */

    const MAP_SOURCES = {

      default: {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      },

      satellite: {
        url:
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19
      }

    };

    /*
     * MAP INITIALIZATION
     *
     * IMPORTANT:
     *
     * touchZoom: true
     *   Enables pinch-to-zoom.
     *
     * doubleClickZoom: true
     *   Enables double-tap zoom on mobile.
     *
     * scrollWheelZoom: true
     *   Enables mouse-wheel zoom where applicable.
     *
     * zoomAnimation: true
     *   Enables smooth zoom animation.
     */

    const map = L.map("map", {

      zoomControl: false,

      attributionControl: true,

      preferCanvas: true,

      minZoom: 4,

      maxZoom: 19,

      touchZoom: true,

      doubleClickZoom: true,

      scrollWheelZoom: true,

      boxZoom: true,

      keyboard: true,

      dragging: true,

      zoomAnimation: true,

      fadeAnimation: true,

      markerZoomAnimation: true,

      zoomAnimationThreshold: 4

    }).setView(

      [
        data.defaultCenter.latitude,
        data.defaultCenter.longitude
      ],

      data.defaultZoom

    );

    /*
     * Make Leaflet use smoother zoom transitions.
     */

    map.options.zoomAnimation = true;

    map.options.fadeAnimation = true;

    map.options.markerZoomAnimation = true;

    let activeLayer = null;

    let activeStyle = "default";

    /*
     * SEND MESSAGE TO REACT NATIVE
     */

    function sendToApp(payload) {

      if (window.ReactNativeWebView) {

        window.ReactNativeWebView.postMessage(
          JSON.stringify(payload)
        );

      }

    }

    /*
     * MARKER SYMBOL
     */

    function markerSymbol(kind) {

      if (kind === "start") {
        return "S";
      }

      if (kind === "end") {
        return "E";
      }

      if (kind === "zone") {
        return "Z";
      }

      if (kind === "sos") {
        return "!";
      }

      return "•";

    }

    /*
     * MAP STYLE
     */

    function setSafeTrackMapStyle(
      nextStyle,
      notify = true
    ) {

      const source =
        MAP_SOURCES[nextStyle] ||
        MAP_SOURCES.default;

      if (activeLayer) {

        map.removeLayer(
          activeLayer
        );

      }

      activeLayer =
        L.tileLayer(
          source.url,
          {
            maxZoom:
              source.maxZoom,

            attribution:
              source.attribution,

            updateWhenZooming:
              true,

            updateWhenIdle:
              false,

            keepBuffer:
              4
          }
        ).addTo(map);

      activeStyle =
        nextStyle;

      if (notify) {

        const center =
          map.getCenter();

        sendToApp({

          type: "map-state",

          style:
            activeStyle,

          zoom:
            map.getZoom(),

          latitude:
            center.lat,

          longitude:
            center.lng

        });

      }

    }

    /*
     * GET ALL CONTENT COORDINATES
     */

    function getAllCoordinates() {

      const coordinates = [];

      data.markers.forEach(
        (marker) => {

          coordinates.push([
            marker.latitude,
            marker.longitude
          ]);

        }
      );

      data.circles.forEach(
        (circle) => {

          coordinates.push([
            circle.latitude,
            circle.longitude
          ]);

        }
      );

      data.path.forEach(
        (point) => {

          coordinates.push([
            point.latitude,
            point.longitude
          ]);

        }
      );

      return coordinates;

    }

    /*
     * RECENTER / FIT CONTENT
     */

    function fitSafeTrackContent() {

      const coordinates =
        getAllCoordinates();

      if (!coordinates.length) {

        map.flyTo(

          [
            data.defaultCenter.latitude,
            data.defaultCenter.longitude
          ],

          data.defaultZoom,

          {
            animate: true,
            duration: 0.65,
            easeLinearity: 0.25
          }

        );

        return;

      }

      if (coordinates.length === 1) {

        map.flyTo(

          coordinates[0],

          15,

          {
            animate: true,
            duration: 0.65,
            easeLinearity: 0.25
          }

        );

        return;

      }

      map.fitBounds(

        coordinates,

        {
          padding: [
            34,
            34
          ],

          maxZoom: 15,

          animate: true,

          duration: 0.65,

          easeLinearity: 0.25
        }

      );

    }

    /*
     * SAFE TRACK ZOOM FUNCTIONS
     */

    function zoomIn() {

      map.setZoom(

        Math.min(
          map.getZoom() + 1,
          map.getMaxZoom()
        ),

        {
          animate: true
        }

      );

    }

    function zoomOut() {

      map.setZoom(

        Math.max(
          map.getZoom() - 1,
          map.getMinZoom()
        ),

        {
          animate: true
        }

      );

    }

    /*
     * Expose functions to React Native.
     */

    window.safeTrackResetMap =
      fitSafeTrackContent;

    window.safeTrackZoomIn =
      zoomIn;

    window.safeTrackZoomOut =
      zoomOut;

    window.safeTrackSetMapStyle =
      function(style) {

        setSafeTrackMapStyle(
          style,
          true
        );

    };

    /*
     * INITIAL MAP STYLE
     */

    setSafeTrackMapStyle(
      "default",
      false
    );

    /*
     * ROUTE / PATH
     */

    if (
      data.path.length > 1
    ) {

      L.polyline(

        data.path,

        {

          color: "#188f5a",

          weight: 4,

          opacity: 0.86,

          lineCap: "round",

          lineJoin: "round",

          smoothFactor: 1.2

        }

      ).addTo(map);

    }

    /*
     * SAFE ZONES
     */

    data.circles.forEach(
      (circle) => {

        const enabled =
          circle.enabled !== false;

        const zoneCircle =
          L.circle(

            [
              circle.latitude,
              circle.longitude
            ],

            {

              radius:
                circle.radiusMeters,

              color:
                enabled
                  ? "#19885a"
                  : "#718178",

              weight: 2,

              opacity: 0.82,

              fillColor:
                enabled
                  ? "#4ecb8d"
                  : "#aab7b1",

              fillOpacity:
                enabled
                  ? 0.18
                  : 0.11

            }

          ).addTo(map);

        zoneCircle.bindPopup(

          '<div class="popup-title">' +

            circle.label +

          '</div>' +

          '<div class="popup-detail">' +

            Math.round(
              circle.radiusMeters
            ) +

            ' meter safe-zone radius</div>'

        );

      }
    );

    /*
     * MARKERS
     */

    data.markers.forEach(
      (marker) => {

        const kind =
          marker.kind ||
          "location";

        const icon =
          L.divIcon({

            className: "",

            html:

              '<div class="safetrack-marker marker-' +

              kind +

              '">' +

                '<div class="marker-inner">' +

                  markerSymbol(
                    kind
                  ) +

                '</div>' +

              '</div>',

            iconSize: [
              44,
              44
            ],

            iconAnchor: [
              22,
              22
            ],

            popupAnchor: [
              0,
              -23
            ]

          });

        const leafletMarker =
          L.marker(

            [
              marker.latitude,
              marker.longitude
            ],

            {
              icon:
                icon
            }

          ).addTo(map);

        leafletMarker.bindPopup(

          '<div class="popup-title">' +

            marker.title +

          '</div>' +

          '<div class="popup-detail">' +

            marker.detail +

          '</div>'

        );

      }
    );

    /*
     * INITIAL VIEW
     */

    fitSafeTrackContent();

    /*
     * MAP STATE
     */

    map.on(
      "moveend",
      function() {

        const center =
          map.getCenter();

        sendToApp({

          type:
            "map-state",

          style:
            activeStyle,

          zoom:
            map.getZoom(),

          latitude:
            center.lat,

          longitude:
            center.lng

        });

      }
    );

    /*
     * MAP PRESS
     */

    map.on(
      "click",
      function(event) {

        sendToApp({

          type:
            "map-press",

          latitude:
            event.latlng.lat,

          longitude:
            event.latlng.lng

        });

      }
    );

    /*
     * Prevent the WebView from treating a pinch
     * as ordinary page scrolling.
     */

    document.addEventListener(
      "gesturestart",
      function(event) {

        event.preventDefault();

      },
      {
        passive: false
      }
    );

    /*
     * Make sure the map gets the correct WebView size.
     */

    setTimeout(
      function() {

        map.invalidateSize(
          false
        );

      },
      350
    );

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

  const webViewRef =
    useRef<WebView>(null);

  const lastRecenterSignal =
    useRef(recenterSignal);

  const [mapStyle, setMapStyle] =
    useState<SafeTrackMapStyle>(
      "default"
    );

  const [showStyleMenu, setShowStyleMenu] =
    useState(false);

  const mapHtml =
    useMemo(
      () =>
        createMapHtml(
          markers,
          circles,
          path,
          defaultCenter,
          defaultZoom
        ),

      [
        markers,
        circles,
        path,
        defaultCenter,
        defaultZoom
      ]
    );

  /*
   * MAP STYLE
   */

  const injectMapStyle =
    useCallback(
      (
        styleToApply:
          SafeTrackMapStyle
      ) => {

        webViewRef.current?.injectJavaScript(`

          if (
            window.safeTrackSetMapStyle
          ) {

            window.safeTrackSetMapStyle(
              ${JSON.stringify(
                styleToApply
              )}
            );

          }

          true;

        `);

      },
      []
    );

  /*
   * ZOOM IN
   */

  const zoomIn =
    useCallback(() => {

      webViewRef.current?.injectJavaScript(`

        if (
          window.safeTrackZoomIn
        ) {

          window.safeTrackZoomIn();

        }

        true;

      `);

    }, []);

  /*
   * ZOOM OUT
   */

  const zoomOut =
    useCallback(() => {

      webViewRef.current?.injectJavaScript(`

        if (
          window.safeTrackZoomOut
        ) {

          window.safeTrackZoomOut();

        }

        true;

      `);

    }, []);

  /*
   * RECENTER
   */

  const recenterMap =
    useCallback(() => {

      webViewRef.current?.injectJavaScript(`

        if (
          window.safeTrackResetMap
        ) {

          window.safeTrackResetMap();

        }

        true;

      `);

    }, []);

  /*
   * RECENTER SIGNAL
   */

  useEffect(() => {

    if (
      lastRecenterSignal.current ===
      recenterSignal
    ) {

      return;

    }

    lastRecenterSignal.current =
      recenterSignal;

    recenterMap();

  }, [
    recenterSignal,
    recenterMap
  ]);

  /*
   * WEBVIEW MESSAGE HANDLER
   */

  const handleMapMessage =
    (
      event: {
        nativeEvent: {
          data: string;
        };
      }
    ) => {

      try {

        const payload =
          JSON.parse(
            event.nativeEvent.data
          ) as {

            type?: string;

            style?:
              SafeTrackMapStyle;

            zoom?: number;

            latitude?: number;

            longitude?: number;

          };

        /*
         * MAP STATE
         */

        if (

          payload.type ===
            "map-state" &&

          payload.style &&

          typeof payload.zoom ===
            "number" &&

          typeof payload.latitude ===
            "number" &&

          typeof payload.longitude ===
            "number"

        ) {

          const nextStyle =
            payload.style ===
            "satellite"
              ? "satellite"
              : "default";

          setMapStyle(
            nextStyle
          );

          onMapStateChange?.({

            style:
              nextStyle,

            zoom:
              Math.round(
                payload.zoom
              ),

            latitude:
              payload.latitude,

            longitude:
              payload.longitude

          });

        }

        /*
         * MAP PRESS
         */

        if (

          payload.type ===
            "map-press" &&

          typeof payload.latitude ===
            "number" &&

          typeof payload.longitude ===
            "number"

        ) {

          onMapPress?.({

            latitude:
              payload.latitude,

            longitude:
              payload.longitude

          });

        }

      } catch {

        /*
         * Ignore malformed
         * WebView messages.
         */

      }

    };

  /*
   * SELECT MAP STYLE
   */

  const selectMapStyle =
    (
      nextStyle:
        SafeTrackMapStyle
    ) => {

      setMapStyle(
        nextStyle
      );

      setShowStyleMenu(
        false
      );

      injectMapStyle(
        nextStyle
      );

    };

  return (

    <View
      style={[
        styles.root,
        {
          height
        },
        style
      ]}
    >

      <WebView
        ref={webViewRef}

        source={{
          html:
            mapHtml
        }}

        originWhitelist={[
          "*"
        ]}

        javaScriptEnabled

        domStorageEnabled

        scrollEnabled={
          false
        }

        showsVerticalScrollIndicator={
          false
        }

        showsHorizontalScrollIndicator={
          false
        }

        mixedContentMode={
          "compatibility"
        }

        bounces={
          false
        }

        overScrollMode={
          "never"
        }

        onMessage={
          handleMapMessage
        }

        onLoadEnd={() => {

          setTimeout(
            () => {

              injectMapStyle(
                mapStyle
              );

            },
            180
          );

        }}

        style={
          styles.webView
        }

      />

      {/*
       * MAP CONTROLS
       */}

      <View
        pointerEvents="box-none"
        style={
          styles.overlay
        }
      >

        {/*
         * MAP STYLE CONTROL
         */}

        {showMapStyleControl ? (

          <View
            style={[
              styles.mapStyleControl,

              {
                top:
                  mapStyleControlTop,

                left:
                  mapStyleControlLeft
              }

            ]}
          >

            <Pressable
              onPress={() =>
                setShowStyleMenu(
                  value =>
                    !value
                )
              }

              style={({
                pressed
              }) => [

                styles.mapStyleButton,

                showStyleMenu &&
                  styles.mapStyleButtonOpen,

                pressed &&
                  styles.pressed

              ]}
            >

              <Ionicons
                name={
                  "layers-outline"
                }

                size={
                  18
                }

                color={
                  showStyleMenu
                    ? colors.white
                    : colors.primaryDark
                }
              />

              <Text
                style={[
                  styles.mapStyleText,

                  showStyleMenu &&
                    styles.mapStyleTextOpen
                ]}
              >
                Map style
              </Text>

              <Ionicons
                name={
                  showStyleMenu
                    ? "chevron-up"
                    : "chevron-down"
                }

                size={
                  16
                }

                color={
                  showStyleMenu
                    ? colors.white
                    : colors.primaryDark
                }
              />

            </Pressable>

            {showStyleMenu ? (

              <View
                style={
                  styles.mapStyleMenu
                }
              >

                {MAP_OPTIONS.map(
                  (
                    option,
                    index
                  ) => {

                    const selected =
                      mapStyle ===
                      option.key;

                    return (

                      <View
                        key={
                          option.key
                        }
                      >

                        {index > 0 ? (
                          <View
                            style={
                              styles.menuDivider
                            }
                          />
                        ) : null}

                        <Pressable
                          onPress={() =>
                            selectMapStyle(
                              option.key
                            )
                          }

                          style={({
                            pressed
                          }) => [

                            styles.mapStyleOption,

                            selected &&
                              styles.mapStyleOptionSelected,

                            pressed &&
                              styles.pressed

                          ]}
                        >

                          <View
                            style={[
                              styles.menuIcon,

                              selected &&
                                styles.menuIconSelected
                            ]}
                          >

                            <Ionicons
                              name={
                                option.icon
                              }

                              size={
                                18
                              }

                              color={
                                selected
                                  ? colors.white
                                  : colors.primaryDark
                              }
                            />

                          </View>

                          <View
                            style={
                              styles.menuCopy
                            }
                          >

                            <Text
                              style={[
                                styles.menuTitle,

                                selected &&
                                  styles.menuTitleSelected
                              ]}
                            >
                              {
                                option.label
                              }
                            </Text>

                            <Text
                              style={
                                styles.menuDescription
                              }
                            >
                              {
                                option.description
                              }
                            </Text>

                          </View>

                          {selected ? (

                            <Ionicons
                              name={
                                "checkmark-circle"
                              }

                              size={
                                20
                              }

                              color={
                                colors.primary
                              }
                            />

                          ) : null}

                        </Pressable>

                      </View>

                    );

                  }
                )}

              </View>

            ) : null}

          </View>

        ) : null}

        {/*
         * ZOOM CONTROLS
         *
         * Positioned on the right side.
         */}

        <View
          style={[
            styles.zoomControls,

            {
              top:
                mapStyleControlTop
            }
          ]}
        >

          {/*
           * PLUS
           */}

          <Pressable
            accessibilityLabel="Zoom in"
            onPress={
              zoomIn
            }

            style={({
              pressed
            }) => [

              styles.zoomButton,

              styles.zoomButtonTop,

              pressed &&
                styles.zoomButtonPressed

            ]}
          >

            <Ionicons
              name="add"
              size={24}
              color={
                colors.primaryDark
              }
            />

          </Pressable>

          {/*
           * DIVIDER
           */}

          <View
            style={
              styles.zoomDivider
            }
          />

          {/*
           * MINUS
           */}

          <Pressable
            accessibilityLabel="Zoom out"
            onPress={
              zoomOut
            }

            style={({
              pressed
            }) => [

              styles.zoomButton,

              styles.zoomButtonBottom,

              pressed &&
                styles.zoomButtonPressed

            ]}
          >

            <Ionicons
              name="remove"
              size={24}
              color={
                colors.primaryDark
              }
            />

          </Pressable>

        </View>

        {/*
         * RECENTER
         */}

        <View
          style={
            styles.recenterControl
          }
        >

          <Pressable
            accessibilityLabel="Recenter map"
            onPress={
              recenterMap
            }

            style={({
              pressed
            }) => [

              styles.recenterButton,

              pressed &&
                styles.recenterButtonPressed

            ]}
          >

            <Ionicons
              name="locate-outline"
              size={23}
              color={
                colors.primaryDark
              }
            />

          </Pressable>

        </View>

      </View>

    </View>

  );

}

const styles =
  StyleSheet.create({

    root: {

      overflow:
        "hidden",

      backgroundColor:
        "#D7EDF4"

    },

    /*
     * IMPORTANT:
     *
     * We intentionally use absoluteFill
     * instead of absoluteFillObject because
     * your React Native version does not expose
     * StyleSheet.absoluteFillObject.
     */

    webView: {

      ...StyleSheet.absoluteFill,

      backgroundColor:
        "#D7EDF4"

    },

    overlay: {

      ...StyleSheet.absoluteFill

    },

    /*
     * MAP STYLE
     */

    mapStyleControl: {

      position:
        "absolute",

      width:
        154

    },

    mapStyleButton: {

      minHeight:
        42,

      paddingHorizontal:
        12,

      borderRadius:
        radius.sm,

      flexDirection:
        "row",

      alignItems:
        "center",

      backgroundColor:
        "rgba(255,255,255,0.96)",

      ...shadow.soft

    },

    mapStyleButtonOpen: {

      backgroundColor:
        colors.primary

    },

    mapStyleText: {

      flex:
        1,

      marginLeft:
        7,

      color:
        colors.primaryDark,

      fontSize:
        12,

      fontWeight:
        "900"

    },

    mapStyleTextOpen: {

      color:
        colors.white

    },

    mapStyleMenu: {

      overflow:
        "hidden",

      marginTop:
        8,

      borderRadius:
        radius.md,

      backgroundColor:
        "rgba(255,255,255,0.98)",

      ...shadow.card

    },

    mapStyleOption: {

      minHeight:
        62,

      paddingHorizontal:
        11,

      flexDirection:
        "row",

      alignItems:
        "center"

    },

    mapStyleOptionSelected: {

      backgroundColor:
        "#F0F8F3"

    },

    menuIcon: {

      width:
        35,

      height:
        35,

      borderRadius:
        12,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        colors.softMint

    },

    menuIconSelected: {

      backgroundColor:
        colors.primary

    },

    menuCopy: {

      flex:
        1,

      marginLeft:
        9

    },

    menuTitle: {

      color:
        colors.ink,

      fontSize:
        12.5,

      fontWeight:
        "900"

    },

    menuTitleSelected: {

      color:
        colors.primaryDark

    },

    menuDescription: {

      color:
        colors.muted,

      fontSize:
        10.5,

      marginTop:
        2

    },

    menuDivider: {

      height:
        1,

      marginLeft:
        56,

      backgroundColor:
        colors.border

    },

    /*
     * ZOOM CONTROLS
     */

    zoomControls: {

      position:
        "absolute",

      right:
        14,

      width:
        44,

      borderRadius:
        13,

      overflow:
        "hidden",

      backgroundColor:
        "rgba(255,255,255,0.97)",

      ...shadow.card

    },

    zoomButton: {

      width:
        44,

      height:
        44,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "rgba(255,255,255,0.97)"

    },

    zoomButtonTop: {

      borderTopLeftRadius:
        13,

      borderTopRightRadius:
        13

    },

    zoomButtonBottom: {

      borderBottomLeftRadius:
        13,

      borderBottomRightRadius:
        13

    },

    zoomDivider: {

      height:
        1,

      marginHorizontal:
        8,

      backgroundColor:
        colors.border

    },

    zoomButtonPressed: {

      backgroundColor:
        "#E8F4ED",

      transform: [
        {
          scale:
            0.94
        }
      ]

    },

    /*
     * RECENTER
     */

    recenterControl: {

      position:
        "absolute",

      right:
        14,

      bottom:
        14

    },

    recenterButton: {

      width:
        48,

      height:
        48,

      borderRadius:
        24,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "rgba(255,255,255,0.97)",

      ...shadow.card

    },

    recenterButtonPressed: {

      backgroundColor:
        "#E8F4ED",

      transform: [
        {
          scale:
            0.94
        }
      ]

    },

    /*
     * GENERAL PRESS STATE
     */

    pressed: {

      opacity:
        0.74,

      transform: [
        {
          scale:
            0.97
        }
      ]

    }

  });