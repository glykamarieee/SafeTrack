import { Fraunces_500Medium_Italic } from "@expo-google-fonts/fraunces/500Medium_Italic";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { useFonts } from "expo-font";
import { createContext, useContext } from "react";

/**
 * Loads the two Fraunces weights the headings use. Never blocks the app: if
 * loading fails, headings use the platform serif.
 */
export function useLoadAppFonts() {
  const [loaded, error] = useFonts({ Fraunces_600SemiBold, Fraunces_500Medium_Italic });
  return { ready: loaded, failed: Boolean(error) };
}

export const FontsReadyContext = createContext(false);

export function useFontsReady() {
  return useContext(FontsReadyContext);
}
