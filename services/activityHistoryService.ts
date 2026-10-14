import { supabase } from "../lib/supabase";
import { fetchGeofences } from "./geofenceService";
import { acknowledgeSosAlert } from "./sosService";
import type { Geofence } from "../types/safetrack";

export type ActivityLocationPoint = {
  id: string;
  latitude: number;
  longitude: number;
  source: string;
  label: string | null;
  accuracy: number | null;
  recordedAt: string;
};

export type ActivityEventType =
  | "geofence"
  | "sos"
  | "anomaly"
  | "watch_disconnected"
  | "prolonged_inactivity";

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  /** The stored value: `entry`, `exit`, `possible_anomaly`, ... or `sos`. */
  rawType: string;
  title: string;
  detail: string;
  occurredAt: string;
  latitude: number | null;
  longitude: number | null;
  geofenceId: string | null;
  /** SOS only: `active | acknowledged | cancelled`. */
  sosStatus: string | null;
};

/** A safe-zone entry or exit, used for zone colours and time inside zones. */
export type ZoneTransition = {
  geofenceId: string;
  eventType: "entry" | "exit";
  occurredAt: string;
};

export type DailyActivity = {
  points: ActivityLocationPoint[];
  events: ActivityEvent[];
  /** The day's entries/exits plus each zone's last one before the day began. */
  zoneTransitions: ZoneTransition[];
  /** Parts that could not be loaded; the rest of the day is still returned. */
  problems: string[];
};

export type ActivityDay = { records: number; events: number; sos: number };

export type ActivityDays = {
  /** Keyed by `YYYY-MM-DD` (Philippine date). */
  days: Record<string, ActivityDay>;
  /** False when the calendar function is not installed yet. */
  available: boolean;
};

export type ActivityStop = {
  id: string;
  index: number;
  latitude: number;
  longitude: number;
  startedAt: string;
  endedAt: string;
  minutes: number;
  records: number;
  label: string | null;
};

// PostgREST returns at most 1000 rows per request; a watch can log more in a day.
const PAGE_SIZE = 1000;
const MAX_POINTS_PER_DAY = 5000;

const METHOD_LABELS: Record<string, string> = {
  tap_and_hold: "tap and hold",
  tap_hold: "tap and hold",
  manual_button: "button",
  shake: "shake",
};

const SOS_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  acknowledged: "Acknowledged",
  cancelled: "Cancelled",
};

/** Start and end (exclusive) of a Philippine calendar day, as ISO strings. */
export function philippineDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+08:00`);

  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 86_400_000).toISOString(),
  };
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

// supabase-js errors are plain objects, not Error instances.
export function errorMessage(reason: unknown) {
  const message = (reason as { message?: unknown } | null)?.message;

  return typeof message === "string" && message ? message : "Unknown error";
}

async function loadPoints(childId: string, start: string, end: string) {
  const points: ActivityLocationPoint[] = [];

  for (let from = 0; from < MAX_POINTS_PER_DAY; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("location_logs")
      .select("id, latitude, longitude, source, location_label, accuracy_meters, recorded_at")
      .eq("child_id", childId)
      .gte("recorded_at", start)
      .lt("recorded_at", end)
      .order("recorded_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    for (const row of data ?? []) {
      const point: ActivityLocationPoint = {
        id: String(row.id),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        source: String(row.source ?? "smartwatch"),
        label: row.location_label ? String(row.location_label) : null,
        accuracy: nullableNumber(row.accuracy_meters),
        recordedAt: String(row.recorded_at),
      };

      if (validCoordinate(point.latitude, point.longitude)) points.push(point);
    }

    if (!data || data.length < PAGE_SIZE) break;
  }

  return points;
}

// Safe-zone entry/exit, watch disconnected, inactivity and AI notices all live
// in geofence_events (there is no separate safety events table).
async function loadSafetyEvents(childId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("geofence_events")
    .select("id, geofence_id, event_type, title, details, latitude, longitude, occurred_at")
    .eq("child_id", childId)
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row): ActivityEvent => {
    const eventType = String(row.event_type ?? "");

    const type: ActivityEventType =
      eventType === "possible_anomaly"
        ? "anomaly"
        : eventType === "watch_disconnected"
          ? "watch_disconnected"
          : eventType === "prolonged_inactivity"
            ? "prolonged_inactivity"
            : "geofence";

    return {
      id: String(row.id),
      type,
      rawType: eventType,
      title: String(row.title ?? "Safety event"),
      detail: String(row.details ?? eventType.replaceAll("_", " ")),
      occurredAt: String(row.occurred_at),
      latitude: nullableNumber(row.latitude),
      longitude: nullableNumber(row.longitude),
      geofenceId: row.geofence_id ? String(row.geofence_id) : null,
      sosStatus: null,
    };
  });
}

/** Each zone's last entry/exit before the day began, so a stay that started yesterday counts. */
async function loadPriorTransitions(childId: string, start: string) {
  const { data, error } = await supabase
    .from("geofence_events")
    .select("geofence_id, event_type, occurred_at")
    .eq("child_id", childId)
    .in("event_type", ["entry", "exit"])
    .lt("occurred_at", start)
    .not("geofence_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const seen = new Set<string>();
  const transitions: ZoneTransition[] = [];

  for (const row of data ?? []) {
    const geofenceId = String(row.geofence_id);
    if (seen.has(geofenceId)) continue;
    seen.add(geofenceId);
    transitions.push({
      geofenceId,
      eventType: row.event_type === "exit" ? "exit" : "entry",
      occurredAt: String(row.occurred_at),
    });
  }

  return transitions;
}

async function loadSosEvents(childId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("sos_alerts")
    .select("id, status, activation_method, triggered_at, latitude, longitude")
    .eq("child_id", childId)
    .gte("triggered_at", start)
    .lt("triggered_at", end)
    .order("triggered_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row): ActivityEvent => {
    const method = String(row.activation_method ?? "");
    const status = String(row.status ?? "");

    return {
      id: String(row.id),
      type: "sos",
      rawType: "sos",
      title: "SOS Alert",
      detail: [
        `Activated by ${METHOD_LABELS[method] ?? (method.replaceAll("_", " ") || "unknown method")}`,
        SOS_STATUS_LABELS[status],
      ]
        .filter(Boolean)
        .join(" · "),
      occurredAt: String(row.triggered_at),
      latitude: nullableNumber(row.latitude),
      longitude: nullableNumber(row.longitude),
      geofenceId: null,
      sosStatus: status || null,
    };
  });
}

/**
 * Everything recorded for one child on one Philippine calendar day, from every
 * tracking source. A failing part is reported in `problems` instead of hiding
 * the parts that did load.
 */
export async function loadDailyActivity(childId: string, dateKey: string): Promise<DailyActivity> {
  const { start, end } = philippineDayRange(dateKey);

  const [points, safetyEvents, sosEvents, prior] = await Promise.allSettled([
    loadPoints(childId, start, end),
    loadSafetyEvents(childId, start, end),
    loadSosEvents(childId, start, end),
    loadPriorTransitions(childId, start),
  ]);

  const problems: string[] = [];

  const value = <T,>(result: PromiseSettledResult<T[]>, label: string): T[] => {
    if (result.status === "fulfilled") return result.value;

    console.error(`[activityHistory] ${label}`, result.reason);
    problems.push(`${label} could not be loaded (${errorMessage(result.reason)}).`);

    return [];
  };

  const safety = value(safetyEvents, "Safety events");
  const events = [...safety, ...value(sosEvents, "SOS alerts")].sort(
    (first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt),
  );

  const dayTransitions: ZoneTransition[] = safety
    .filter((event) => event.geofenceId && (event.rawType === "entry" || event.rawType === "exit"))
    .map((event) => ({
      geofenceId: event.geofenceId!,
      eventType: event.rawType as "entry" | "exit",
      occurredAt: event.occurredAt,
    }));

  return {
    points: value(points, "Location records"),
    events,
    zoneTransitions: [...value(prior, "Earlier safe-zone events"), ...dayTransitions].sort(
      (first, second) => Date.parse(first.occurredAt) - Date.parse(second.occurredAt),
    ),
    problems,
  };
}

/**
 * Days with records between two Philippine dates (at most 63 days), for the
 * calendar dots. Uses `get_my_child_activity_days`; until that migration is
 * applied the calendar still works, just without dots.
 */
export async function loadActivityDays(childId: string, fromKey: string, toKey: string): Promise<ActivityDays> {
  const { data, error } = await supabase.rpc("get_my_child_activity_days", {
    p_child_id: childId,
    p_from: fromKey,
    p_to: toKey,
  });

  if (error) {
    // PGRST202: the function is not in the schema cache (migration not applied).
    if ((error as { code?: string }).code === "PGRST202") return { days: {}, available: false };
    throw error;
  }

  const days: Record<string, ActivityDay> = {};
  for (const row of (data ?? []) as { day: string; location_count: number; event_count: number; sos_count: number }[]) {
    days[String(row.day)] = {
      records: Number(row.location_count ?? 0),
      events: Number(row.event_count ?? 0),
      sos: Number(row.sos_count ?? 0),
    };
  }

  return { days, available: true };
}

export function loadHistoryZones(guardianId: string, childId: string): Promise<Geofence[]> {
  return fetchGeofences(guardianId, childId);
}

/** Acknowledge an SOS from the history screen (`acknowledge_my_sos_alert`). */
export function acknowledgeHistorySos(alertId: string) {
  return acknowledgeSosAlert(alertId);
}

// ---------------------------------------------------------------------------
// Day statistics. Pure functions over the loaded records.
// ---------------------------------------------------------------------------

export function metersBetween(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(second.latitude - first.latitude);
  const dLng = radians(second.longitude - first.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(dLng / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type RouteDistance = {
  meters: number;
  /** Moves that were added up. */
  counted: number;
  /** Moves smaller than the GPS accuracy (the fix wobbling in place). */
  ignoredSmall: number;
  /** Single records far away at an impossible speed (GPS glitches). */
  ignoredJumps: number;
};

/** Below this, a move is always treated as GPS wobble. */
export const MIN_MOVE_METERS = 15;
/** Faster than this between two records is not a real move (180 km/h). */
export const MAX_SPEED_MPS = 50;

/**
 * Distance travelled, from straight lines between records, without GPS noise:
 * - A move counts only when it is larger than the two records' GPS accuracy
 *   added together (at least 15 m, at most 150 m); smaller moves are the fix
 *   wobbling while the child stands still, so the last counted point is kept.
 * - A record that would need more than 180 km/h is a glitch and is skipped,
 *   unless the next record confirms the new place (then the child really is
 *   there, but the unknown path between is not counted).
 */
export function routeDistance(points: ActivityLocationPoint[]): RouteDistance {
  const result: RouteDistance = { meters: 0, counted: 0, ignoredSmall: 0, ignoredJumps: 0 };
  if (points.length < 2) return result;

  // Two fixes that are each off by their accuracy can be that far apart in sum.
  const noise = (first: ActivityLocationPoint, second: ActivityLocationPoint) =>
    Math.min(150, Math.max(MIN_MOVE_METERS, (first.accuracy ?? 0) + (second.accuracy ?? 0)));
  const speed = (first: ActivityLocationPoint, second: ActivityLocationPoint) => {
    const seconds = Math.max(1, (Date.parse(second.recordedAt) - Date.parse(first.recordedAt)) / 1000);
    return metersBetween(first, second) / seconds;
  };

  let anchor = points[0]!;
  let suspect: ActivityLocationPoint | null = null;

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;

    if (suspect) {
      // Does this record agree with the suspected jump, or with where we were?
      if (
        metersBetween(suspect, point) <= noise(suspect, point) ||
        (speed(suspect, point) <= MAX_SPEED_MPS && metersBetween(anchor, point) > metersBetween(suspect, point))
      ) {
        anchor = suspect; // Confirmed: move there without counting the unknown path.
        suspect = null;
      } else {
        result.ignoredJumps += 1; // The suspect was a glitch.
        suspect = null;
      }
    }

    const moved = metersBetween(anchor, point);
    if (moved <= noise(anchor, point)) {
      result.ignoredSmall += 1;
      continue;
    }
    if (speed(anchor, point) > MAX_SPEED_MPS) {
      suspect = point;
      continue;
    }

    result.meters += moved;
    result.counted += 1;
    anchor = point;
  }
  if (suspect) result.ignoredJumps += 1;

  return result;
}

export const STOP_RADIUS_METERS = 60;
export const STOP_MIN_MINUTES = 5;

/**
 * Likely stops: runs of consecutive records that stay within 60 m of where the
 * run began for at least 5 minutes. An estimate from the records only.
 */
export function estimateStops(points: ActivityLocationPoint[]): ActivityStop[] {
  const stops: ActivityStop[] = [];
  let runStart = 0;

  const close = (endIndex: number) => {
    const run = points.slice(runStart, endIndex + 1);
    if (run.length < 2) return;
    const minutes = (Date.parse(run[run.length - 1]!.recordedAt) - Date.parse(run[0]!.recordedAt)) / 60000;
    if (minutes < STOP_MIN_MINUTES) return;

    const latitude = run.reduce((sum, point) => sum + point.latitude, 0) / run.length;
    const longitude = run.reduce((sum, point) => sum + point.longitude, 0) / run.length;
    stops.push({
      id: `stop-${run[0]!.id}`,
      index: stops.length + 1,
      latitude,
      longitude,
      startedAt: run[0]!.recordedAt,
      endedAt: run[run.length - 1]!.recordedAt,
      minutes: Math.round(minutes),
      records: run.length,
      label: run.find((point) => point.label)?.label ?? null,
    });
  };

  for (let index = 1; index < points.length; index += 1) {
    if (metersBetween(points[runStart]!, points[index]!) > STOP_RADIUS_METERS) {
      close(index - 1);
      runStart = index;
    }
  }
  close(points.length - 1);

  return stops;
}

/**
 * Minutes inside any Safe Zone during the day, from the server's entry/exit
 * events: each entry opens a stay that the zone's next exit closes. Stays that
 * started before the day count from midnight; open stays run to the end of the
 * day (or now, for today). Overlapping zones are counted once.
 */
export function minutesInZones(transitions: ZoneTransition[], dateKey: string, enabledZoneIds?: Set<string>) {
  const { start, end } = philippineDayRange(dateKey);
  const dayStart = Date.parse(start);
  const dayEnd = Math.min(Date.parse(end), Date.now());
  if (dayEnd <= dayStart) return 0;

  const open = new Map<string, number>();
  const intervals: [number, number][] = [];

  for (const transition of transitions) {
    if (enabledZoneIds && !enabledZoneIds.has(transition.geofenceId)) continue;
    const at = Date.parse(transition.occurredAt);
    if (transition.eventType === "entry") {
      if (!open.has(transition.geofenceId)) open.set(transition.geofenceId, at);
    } else {
      const from = open.get(transition.geofenceId);
      if (from !== undefined) intervals.push([from, at]);
      open.delete(transition.geofenceId);
    }
  }
  open.forEach((from) => intervals.push([from, dayEnd]));

  const clipped = intervals
    .map(([from, to]) => [Math.max(from, dayStart), Math.min(to, dayEnd)] as [number, number])
    .filter(([from, to]) => to > from)
    .sort((first, second) => first[0] - second[0]);

  let total = 0;
  let current: [number, number] | null = null;
  for (const interval of clipped) {
    if (!current || interval[0] > current[1]) {
      if (current) total += current[1] - current[0];
      current = [...interval];
    } else {
      current[1] = Math.max(current[1], interval[1]);
    }
  }
  if (current) total += current[1] - current[0];

  return Math.round(total / 60000);
}
