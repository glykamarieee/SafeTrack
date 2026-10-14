import type { Geofence, GeofenceEvent } from "../../types/safetrack";
import type { AvatarRing, MapCircle, ZoneStatus } from "./mapTypes";

/**
 * Safe Zones as map circles. A zone's inside/outside colour comes only from
 * the server's latest `entry`/`exit` geofence event for that zone, never from
 * comparing positions on the client: the map must not become a second,
 * competing geofence engine.
 */
export function toZoneCircles(
  zones: Geofence[],
  events: Pick<GeofenceEvent, "geofenceId" | "eventType" | "occurredAt">[],
  options: { editable?: boolean } = {},
): MapCircle[] {
  const lastEvent = new Map<string, { type: "entry" | "exit"; at: string }>();

  // Newest first; keep the first entry/exit seen for each zone.
  [...events]
    .sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt))
    .forEach((event) => {
      if (
        event.geofenceId &&
        (event.eventType === "entry" || event.eventType === "exit") &&
        !lastEvent.has(event.geofenceId)
      ) {
        lastEvent.set(event.geofenceId, { type: event.eventType, at: event.occurredAt });
      }
    });

  return zones
    .filter(
      (zone) =>
        Number.isFinite(Number(zone.latitude)) &&
        Number.isFinite(Number(zone.longitude)) &&
        Number(zone.radiusMeters) > 0,
    )
    .map((zone) => {
      const event = lastEvent.get(zone.id);

      const status: ZoneStatus = !zone.isEnabled
        ? "inactive"
        : event?.type === "entry"
          ? "inside"
          : event?.type === "exit"
            ? "outside"
            : "active";

      return {
        id: zone.id,
        latitude: Number(zone.latitude),
        longitude: Number(zone.longitude),
        radiusMeters: Number(zone.radiusMeters),
        label: zone.name,
        status,
        editable: options.editable,
        lastEventType: event?.type ?? null,
        lastEventAt: event?.at ?? null,
      };
    });
}

/**
 * The child marker's ring: red for an active SOS, grey when the last update is
 * older than 15 minutes, green inside a zone and amber outside, both taken
 * from the latest server entry/exit events.
 */
export function childRing(
  circles: MapCircle[],
  options: { sosActive?: boolean; freshness?: "fresh" | "stale" | "old" },
): AvatarRing {
  if (options.sosActive) return "sos";
  if (options.freshness && options.freshness !== "fresh") return "stale";

  const enabled = circles.filter((circle) => circle.status === "inside" || circle.status === "outside");
  if (enabled.some((circle) => circle.status === "inside")) return "inside";
  if (enabled.length > 0) return "outside";

  return "neutral";
}
