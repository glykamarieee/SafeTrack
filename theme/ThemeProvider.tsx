import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";

import { setCurrentScheme } from "./currentScheme";
import { palettes, type ColorScheme, type Palette } from "./tokens";

/** What the user picked in Profile → Appearance. */
export type AppearancePreference = "light" | "dark" | "system";

const STORAGE_KEY = "safetrack.appearance";

type ThemeValue = {
  scheme: ColorScheme;
  colors: Palette;
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => void;
  /** True when the system asks for reduced motion: animate instantly or fade only. */
  reduceMotion: boolean;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function isPreference(value: unknown): value is AppearancePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Light by default; a saved choice replaces it once it has been read.
  const [preference, setPreferenceState] = useState<AppearancePreference>("light");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: ColorScheme =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  setCurrentScheme(scheme);

  const value = useMemo<ThemeValue>(
    () => ({ scheme, colors: palettes[scheme], preference, setPreference, reduceMotion }),
    [scheme, preference, setPreference, reduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const fallback: ThemeValue = {
  scheme: "light",
  colors: palettes.light,
  preference: "light",
  setPreference: () => undefined,
  reduceMotion: false,
};

export function useTheme(): ThemeValue {
  // Outside the provider (tests, isolated previews) the light theme applies.
  return useContext(ThemeContext) ?? fallback;
}

/**
 * Styles that depend on the palette, rebuilt only when the scheme changes:
 *
 *   const useStyles = makeStyles((c) => ({ card: { backgroundColor: c.surface } }));
 *   const styles = useStyles();
 */
export function makeStyles<T>(factory: (colors: Palette, scheme: ColorScheme) => T) {
  const cache: Partial<Record<ColorScheme, T>> = {};

  return function useStyles(): T {
    const { scheme, colors } = useTheme();
    return (cache[scheme] ??= factory(colors, scheme));
  };
}
