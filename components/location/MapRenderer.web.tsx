import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

import { LEAFLET_HTML } from "./leafletHtml";
import { markerHtml } from "./markerHtml";
import {
  type MapEngineHandle,
  type MapEngineProps,
  type MapMarker,
} from "./mapTypes";

/** Web: Leaflet in an iframe, with Mapbox tiles when EXPO_PUBLIC_MAPBOX_TOKEN is set (Esri otherwise). */
export const MapRenderer = forwardRef<MapEngineHandle, MapEngineProps>(function MapRenderer(props, ref) {
  return <LeafletEngine {...props} ref={ref} />;
});

function zIndexFor(marker: MapMarker) {
  const order: Record<string, number> = { replay: 60, child: 50, guardian: 45, end: 40, sos: 40, event: 30, stop: 20, start: 15 };

  return order[marker.kind ?? ""] ?? 10;
}

// ---------------------------------------------------------------------------
// Leaflet
// ---------------------------------------------------------------------------

const LeafletEngine = forwardRef<MapEngineHandle, MapEngineProps>(function LeafletEngine(props, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  const post = useCallback((message: Record<string, unknown>) => {
    if (!ready.current) return;
    frame.current?.contentWindow?.postMessage({ source: "safetrack-shell", payload: JSON.stringify(message) }, "*");
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fit: () => post({ type: "fit" }),
      focus: (target) => post({ type: "focus", ...target }),
      zoomBy: (delta) => post({ type: "zoomBy", delta }),
    }),
    [post],
  );

  const dataMessage = useCallback(() => {
    const { markers, circles, path } = latest.current;

    return {
      type: "data",
      markers: markers.map((marker) => {
        const box = markerHtml(marker);
        return {
          id: marker.id,
          kind: marker.kind,
          latitude: marker.latitude,
          longitude: marker.longitude,
          html: box.html,
          w: box.width,
          h: box.height,
          ax: box.anchorX,
          ay: box.anchorY,
          z: zIndexFor(marker) * 10,
        };
      }),
      circles,
      path,
    };
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // Only this map's own frame: several maps can be on screen at once.
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "safetrack-map" || typeof data.payload !== "string") return;

      let message: Record<string, any>;
      try {
        message = JSON.parse(data.payload);
      } catch {
        return;
      }

      const current = latest.current;
      switch (message.type) {
        case "ready":
          ready.current = true;
          post({ type: "base", mapType: current.prefs.mapType, labels: current.prefs.labels, dark: current.dark });
          post({ type: "padding", padding: current.fitPadding });
          post({ type: "picking", value: current.picking });
          if (current.initialView) post({ type: "view", ...current.initialView });
          post(dataMessage());
          current.onReady();
          break;
        case "press":
          current.onPress({ latitude: message.latitude, longitude: message.longitude });
          break;
        case "marker":
          current.onMarkerPress(String(message.id));
          break;
        case "state":
          current.onViewChange({ latitude: message.latitude, longitude: message.longitude, zoom: message.zoom });
          break;
        case "tiles":
          if (!message.ok) current.onError("Map tiles are unavailable right now. Check the connection or try another map type.");
          break;
        case "error":
          current.onError(String(message.reason ?? "The map could not load."));
          break;
      }
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [post, dataMessage]);

  useEffect(() => {
    post(dataMessage());
  }, [props.markers, props.circles, props.path, post, dataMessage]);

  useEffect(() => {
    post({ type: "base", mapType: props.prefs.mapType, labels: props.prefs.labels, dark: props.dark });
  }, [props.prefs.mapType, props.prefs.labels, props.dark, post]);

  useEffect(() => {
    post({ type: "picking", value: props.picking });
  }, [props.picking, post]);

  const paddingJson = JSON.stringify(props.fitPadding);
  useEffect(() => {
    post({ type: "padding", padding: JSON.parse(paddingJson) });
  }, [paddingJson, post]);

  return createElement("iframe", {
    ref: frame,
    srcDoc: LEAFLET_HTML,
    title: "SafeTrack map",
    style: { width: "100%", height: "100%", border: 0, display: "block" },
  });
});
