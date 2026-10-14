import { forwardRef } from "react";

import { nativeMapMode } from "./mapSupport";
import type { MapEngineHandle, MapEngineProps } from "./mapTypes";

const MODE = nativeMapMode();

// Required lazily: Expo Go has no Mapbox native code, and a build never needs
// the Expo Go preview renderer.
const Renderer =
  MODE === "mapbox"
    ? (require("./MapboxRenderer") as typeof import("./MapboxRenderer")).MapboxRenderer
    : MODE === "expo-go"
      ? (require("./ExpoGoMapRenderer") as typeof import("./ExpoGoMapRenderer")).ExpoGoMapRenderer
      : null;

/** Android and iOS: Mapbox in builds, react-native-maps in Expo Go. */
export const MapRenderer = forwardRef<MapEngineHandle, MapEngineProps>(function MapRenderer(props, ref) {
  return Renderer ? <Renderer {...props} ref={ref} /> : null;
});
