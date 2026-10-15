import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { useFonts } from "expo-font";
import { createContext, useContext } from "react";
import type { TextStyle } from "react-native";

import { fontFamily, type FontWeightName } from "./tokens";

/**
 * Loads the five Plus Jakarta Sans weights. Never blocks the app: if loading
 * fails, text uses the system font.
 */
export function useLoadAppFonts() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  return { ready: loaded, failed: Boolean(error) };
}

export const FontsReadyContext = createContext(false);

export function useFontsReady() {
  return useContext(FontsReadyContext);
}

const WEIGHT_NAME: Record<string, FontWeightName> = {
  "100": "regular",
  "200": "regular",
  "300": "regular",
  "400": "regular",
  normal: "regular",
  "500": "medium",
  "600": "semibold",
  "700": "bold",
  bold: "bold",
  "800": "extrabold",
  "900": "extrabold",
};

/**
 * The style for a weight: the matching Plus Jakarta Sans family once loaded,
 * otherwise the system font at that weight.
 */
export function fontStyle(weight: TextStyle["fontWeight"] = "400", ready: boolean): TextStyle {
  if (!ready) return { fontWeight: weight };
  return { fontFamily: fontFamily[WEIGHT_NAME[String(weight)] ?? "regular"], fontWeight: undefined };
}
