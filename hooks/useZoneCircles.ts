import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";

import { distanceMeters, type MapCircle } from "../components/location/mapTypes";
import { toZoneCircles } from "../components/location/zoneCircles";
import { testLog } from "../lib/testLog";
import { useGeofenceStore } from "../store/geofenceStore";
import { useLocationStore } from "../store/locationStore";
import type { LocationLog } from "../types/safetrack";

/** Server entry/exit events are re-read this often while a map is open. */
const EVENTS_REFRESH_MS = 20_000;
/** The live position decides only while it is this recent and this accurate. */
const LIVE_MAX_AGE_MS = 60_000;
const LIVE_MAX_ACCURACY_M = 100;
/** Readings in a row needed to change inside <-> outside (no flicker at the edge). */
const CONFIRM = 2;

type LiveZone = { status: "inside" | "outside"; since: string; pending: "inside" | "outside" | null; count: number };

/**
 * Safe Zones for the map and the status cards, kept current without a manual
 * refresh (2026-11-08):
 *
 *  - The server's entry/exit events (which also send the guardian's alerts)
 *    are re-read every EVENTS_REFRESH_MS and whenever a new saved location
 *    arrives (the server writes the event with that location).
 *  - While the child's position is live (updates every second), inside or
 *    outside follows that position at once, so the badge changes as the child
 *    crosses the edge instead of minutes later. To avoid flicker at the edge,
 *    the child must be clearly past it (a buffer of half the GPS accuracy,
 *    5-20 m) for CONFIRM readings in a row. Alerts still come only from the
 *    server.
 */
export function useZoneCircles(childId: string | null | undefined, location: LocationLog | null | undefined): MapCircle[] {
  const zones = useGeofenceStore((state) => state.zones);
  const events = useGeofenceStore((state) => state.events);
  const refreshEvents = useGeofenceStore((state) => state.refreshEvents);

  // ---- Server events, kept current.
  useFocusEffect(
    useCallback(() => {
      if (!childId) return;
      const timer = setInterval(() => void refreshEvents(childId), EVENTS_REFRESH_MS);
      return () => clearInterval(timer);
    }, [childId, refreshEvents]),
  );
  const savedAt = useLocationStore((state) =>
    state.history[0]?.childId === childId ? state.history[0]?.recordedAt : undefined,
  );
  useEffect(() => {
    if (childId && savedAt) void refreshEvents(childId);
  }, [childId, savedAt, refreshEvents]);

  const server = useMemo(() => toZoneCircles(zones, events), [zones, events]);

  // ---- Live: inside/outside from the position itself.
  const [live, setLive] = useState<Record<string, LiveZone>>({});
  useEffect(() => setLive({}), [childId]);

  useEffect(() => {
    if (!location || location.childId !== childId) return;
    const age = Date.now() - Date.parse(location.recordedAt);
    const accuracy = location.accuracyMeters ?? 0;
    if (!(age < LIVE_MAX_AGE_MS) || accuracy > LIVE_MAX_ACCURACY_M) return;

    setLive((previous) => {
      let changed = false;
      const next: Record<string, LiveZone> = { ...previous };
      for (const circle of server) {
        if (circle.status === "inactive") continue;
        const distance = distanceMeters(location, circle);
        const margin = Math.min(20, Math.max(5, accuracy / 2), circle.radiusMeters * 0.3);
        const clearlyInside = distance <= circle.radiusMeters - margin;
        const clearlyOutside = distance >= circle.radiusMeters + margin;
        const known = previous[circle.id];
        // First reading: the server's last event, or the position when clear.
        const status = known?.status ?? (circle.status === "inside" ? "inside" : circle.status === "outside" ? "outside" : distance <= circle.radiusMeters ? "inside" : "outside");
        const wants = status === "inside" ? (clearlyOutside ? "outside" : null) : clearlyInside ? "inside" : null;

        let entry: LiveZone = known ?? { status, since: circle.lastEventAt ?? location.recordedAt, pending: null, count: 0 };
        if (!wants) {
          if (entry.pending) entry = { ...entry, pending: null, count: 0 };
        } else {
          const count = entry.pending === wants ? entry.count + 1 : 1;
          // Far past the edge counts at once; near it, CONFIRM readings.
          const far = Math.abs(distance - circle.radiusMeters) > margin * 3;
          if (count >= CONFIRM || far) {
            entry = { status: wants, since: location.recordedAt, pending: null, count: 0 };
            testLog("zone", { zone: circle.label, now: wants, dist: Math.round(distance), r: circle.radiusMeters, acc: accuracy });
          } else {
            entry = { ...entry, pending: wants, count };
          }
        }
        if (entry !== known) {
          next[circle.id] = entry;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [childId, location?.recordedAt, server]);

  return useMemo(
    () =>
      server.map((circle) => {
        const state = live[circle.id];
        if (!state || circle.status === "inactive") return circle;
        // A newer server event wins over the live reading.
        const serverNewer = circle.lastEventAt && Date.parse(circle.lastEventAt) > Date.parse(state.since);
        if (serverNewer) return circle;
        return {
          ...circle,
          status: state.status,
          lastEventType: state.status === "inside" ? "entry" : "exit",
          lastEventAt: state.status === (circle.status === "inside" ? "inside" : "outside") && circle.lastEventAt ? circle.lastEventAt : state.since,
        } satisfies MapCircle;
      }),
    [server, live],
  );
}
