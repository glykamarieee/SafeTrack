import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { DEFAULT_PREFS, type MapPrefs } from "./mapTypes";

const STORAGE_KEY = "safetrack.mapPrefs.v1";

type MapPrefsState = {
  prefs: MapPrefs;
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<MapPrefs>): void;
};

/** Map type, layers and theme, shared by every map and kept between launches. */
export const useMapPrefs = create<MapPrefsState>((set, get) => ({
  prefs: DEFAULT_PREFS,
  loaded: false,

  async load() {
    if (get().loaded) return;
    set({ loaded: true });

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<MapPrefs>;
      set({ prefs: sanitize({ ...DEFAULT_PREFS, ...parsed }) });
    } catch (reason) {
      // Storage can be unavailable (private browsing); the defaults still work.
      console.warn("[mapPrefs] could not read saved map settings", reason);
    }
  },

  update(patch) {
    const prefs = sanitize({ ...get().prefs, ...patch });
    set({ prefs });

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch((reason) => {
      console.warn("[mapPrefs] could not save map settings", reason);
    });
  },
}));

function sanitize(prefs: MapPrefs): MapPrefs {
  return {
    mapType: ["standard", "satellite", "terrain"].includes(prefs.mapType) ? prefs.mapType : "standard",
    labels: prefs.labels !== false,
    traffic: prefs.traffic === true,
    zones: prefs.zones !== false,
    route: prefs.route !== false,
    theme: ["light", "dark", "auto"].includes(prefs.theme) ? prefs.theme : "light",
  };
}
