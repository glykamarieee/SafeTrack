import { createContext, useContext, useEffect, useState } from "react";

/**
 * The map's rotation (degrees clockwise from north), shared by the engine that
 * reports it and the views drawn on top of it: avatar direction arrows (which
 * are screen-aligned and must subtract it) and the compass button. A tiny
 * subscribe store, so a rotating map never re-renders the whole map tree.
 */
export type BearingStore = {
  get(): number;
  set(bearing: number): void;
  subscribe(listener: (bearing: number) => void): () => void;
};

export function createBearingStore(): BearingStore {
  let value = 0;
  const listeners = new Set<(bearing: number) => void>();
  return {
    get: () => value,
    set(bearing) {
      const next = ((bearing % 360) + 360) % 360;
      if (Math.abs(next - value) < 0.1) return;
      value = next;
      listeners.forEach((listener) => listener(next));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const fallback = createBearingStore();

export const MapBearingContext = createContext<BearingStore>(fallback);

/** The bearing as state, rounded to `step` degrees (for the compass button). */
export function useMapBearing(step = 1) {
  const store = useContext(MapBearingContext);
  const [bearing, setBearing] = useState(() => Math.round(store.get() / step) * step);
  useEffect(() => store.subscribe((value) => setBearing(Math.round(value / step) * step)), [store, step]);
  return bearing;
}

/** `to` moved by whole turns so that it is the nearest angle to `from` (no long spins). */
export function nearestAngle(from: number, to: number) {
  return from + ((((to - from) % 360) + 540) % 360) - 180;
}
