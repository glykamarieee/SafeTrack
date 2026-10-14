import Constants, { ExecutionEnvironment } from "expo-constants";

/** Expo Go has no Mapbox native code; it previews maps with react-native-maps. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Mapbox public access token (`pk.…`), inlined at bundle time. Public tokens
 * are meant to ship inside apps; never put a secret (`sk.…`) token here.
 */
export const MAPBOX_TOKEN = (process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "").trim();

export type NativeMapMode = "expo-go" | "mapbox" | "missing";

/**
 * Which native map can render:
 * - Expo Go: react-native-maps (Google on Android with Expo's key, Apple on iOS).
 * - Development and release builds: Mapbox, which needs EXPO_PUBLIC_MAPBOX_TOKEN.
 */
export function nativeMapMode(): NativeMapMode {
  if (isExpoGo) return "expo-go";

  return MAPBOX_TOKEN ? "mapbox" : "missing";
}
