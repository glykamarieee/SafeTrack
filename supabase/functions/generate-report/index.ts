import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { json, options } from "../_shared/response.ts";
import {
  assertActiveAdmin,
  findAdminProfile,
  requireUser,
} from "../_shared/identity.ts";
import { serviceClient } from "../_shared/supabase.ts";
import {
  buildExcelReport,
  buildPdfReport,
  type ReportData,
  type ReportEvent,
  type ReportLocation,
  type ReportSos,
} from "./render.ts";

type ReportFormat = "pdf" | "xlsx";

const PHILIPPINES_OFFSET = "+08:00";

// PostgREST returns at most 1000 rows per request, so rows are paged.
const PAGE_SIZE = 1000;

// Per record type. Anything beyond is counted and reported as omitted.
const MAX_ROWS = 5000;

const CONTENT_TYPES: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validDateText(value: unknown): string | null {
  const text = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const date = new Date(`${text}T00:00:00${PHILIPPINES_OFFSET}`);

  return Number.isFinite(date.getTime()) ? text : null;
}

function manilaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Reads up to MAX_ROWS rows, a page at a time, and the total that matched.
 * `build` must return a fresh, fully filtered and ordered query each call.
 */
async function fetchRows(
  build: () => any,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const rows: Record<string, unknown>[] = [];
  let total = 0;

  for (let start = 0; start < MAX_ROWS; start += PAGE_SIZE) {
    const end = Math.min(start + PAGE_SIZE, MAX_ROWS) - 1;
    const { data, error, count } = await build().range(start, end);

    if (error) throw error;

    total = count ?? total;
    rows.push(...(data ?? []));

    if (!data || data.length < end - start + 1) break;
  }

  return { rows, total: Math.max(total, rows.length) };
}

// Same cell as location_cell() in migration 20261104 and lib/places.ts.
function cellOf(latitude: number | null, longitude: number | null) {
  return latitude === null || longitude === null ? null : `${Math.floor(latitude * 2000)}:${Math.floor(longitude * 2000)}`;
}

/** Saved addresses (location_places) for the given points; empty before 20261104. */
async function loadPlaces(supabase: SupabaseClient, points: { latitude: number | null; longitude: number | null }[]) {
  const cells = [...new Set(points.map((point) => cellOf(point.latitude, point.longitude)).filter((cell): cell is string => Boolean(cell)))];
  const places = new Map<string, string>();
  for (let index = 0; index < cells.length; index += 200) {
    const { data, error } = await supabase.from("location_places").select("cell, label").in("cell", cells.slice(index, index + 200));
    if (error) return places;
    for (const row of data ?? []) places.set(String(row.cell), String(row.label));
  }
  return places;
}

/**
 * Looks up SOS spots that have no saved address yet (OpenStreetMap Nominatim,
 * at most one request per second, so only a few per report) and saves them.
 */
async function fillSosPlaces(
  supabase: SupabaseClient,
  places: Map<string, string>,
  points: { latitude: number | null; longitude: number | null }[],
) {
  const missing = points.filter((point) => {
    const cell = cellOf(point.latitude, point.longitude);
    return cell !== null && !places.has(cell);
  });
  for (const point of missing.slice(0, 8)) {
    const cell = cellOf(point.latitude, point.longitude)!;
    if (places.has(cell)) continue;
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(point.latitude),
        lon: String(point.longitude),
        zoom: "18",
        addressdetails: "1",
        "accept-language": "en",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { "User-Agent": "SafeTrack/1.0 (child safety capstone app; report export)" },
      });
      if (response.ok) {
        const result = await response.json();
        const a = result.address ?? {};
        const barangay = a.quarter ?? a.suburb ?? a.village ?? a.neighbourhood;
        const parts = [
          result.name && result.name !== a.road ? result.name : null,
          [a.house_number, a.road].filter(Boolean).join(" ") || null,
          barangay ? (/^(barangay|brgy)/i.test(barangay) ? barangay : `Brgy. ${barangay}`) : null,
          a.city ?? a.town ?? a.municipality,
          a.state ?? a.province ?? a.region,
        ].filter((part, index, all) => part && all.indexOf(part) === index);
        if (parts.length) {
          const label = parts.join(", ");
          places.set(cell, label);
          await supabase
            .from("location_places")
            .upsert({ cell, latitude: point.latitude, longitude: point.longitude, label, provider: "osm" });
        }
      }
    } catch {
      // The report still lists the coordinates.
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
}

async function loadNames(supabase: SupabaseClient, ids: string[]) {
  const names = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];

  for (let index = 0; index < unique.length; index += 200) {
    const { data, error } = await supabase
      .from("persons")
      .select("id, full_name")
      .in("id", unique.slice(index, index + 200));

    if (error) throw error;

    for (const person of data ?? []) {
      names.set(person.id, textOrNull(person.full_name) ?? "Unnamed");
    }
  }

  return names;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return options();

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabase = serviceClient();
  let createdReportId: string | null = null;

  try {
    // 1. Only an active administrator may generate reports.
    const user = await requireUser(supabase, request);
    const admin = await findAdminProfile(supabase, user);

    if (!admin) throw new Error("ADMIN_REQUIRED");

    assertActiveAdmin(admin);

    // 2. Request.
    const body = await request.json().catch(() => ({}));
    const format = String(body.format ?? "pdf").toLowerCase() as ReportFormat;
    const childId = String(body.childId ?? "").trim() || null;

    if (format !== "pdf" && format !== "xlsx") {
      return json({ error: "format must be pdf or xlsx." }, 400);
    }

    if (childId && !UUID_PATTERN.test(childId)) {
      return json({ error: "childId is not a valid child." }, 400);
    }

    // Default: the last 7 Philippine calendar days.
    const now = new Date();
    const dateFromText = validDateText(
      body.dateFrom ?? manilaDate(new Date(now.getTime() - 6 * 86_400_000)),
    );
    const dateToText = validDateText(body.dateTo ?? manilaDate(now));

    if (!dateFromText || !dateToText) {
      return json({ error: "Use YYYY-MM-DD for both report dates." }, 400);
    }

    if (dateFromText > dateToText) {
      return json(
        { error: "The report start date cannot be later than the end date." },
        400,
      );
    }

    const from = new Date(`${dateFromText}T00:00:00.000${PHILIPPINES_OFFSET}`).toISOString();
    const to = new Date(`${dateToText}T23:59:59.999${PHILIPPINES_OFFSET}`).toISOString();
    const title = (String(body.reportTitle ?? "").trim() || "SafeTrack Activity Report").slice(0, 180);

    // 3. Records in the period, optionally for one child.
    const forChild = (query: any) => (childId ? query.eq("child_id", childId) : query);

    const [locationResult, eventResult, sosResult] = await Promise.all([
      fetchRows(() =>
        forChild(
          supabase
            .from("location_logs")
            // "*": speed and travel mode exist only after migration 20261104.
            .select("*", { count: "exact" })
            .gte("recorded_at", from)
            .lte("recorded_at", to),
        )
          .order("recorded_at", { ascending: true })
          .order("id", { ascending: true })
      ),
      fetchRows(() =>
        forChild(
          supabase
            .from("geofence_events")
            .select(
              "id, child_id, event_type, title, details, anomaly_score, latitude, longitude, occurred_at",
              { count: "exact" },
            )
            .gte("occurred_at", from)
            .lte("occurred_at", to),
        )
          .order("occurred_at", { ascending: true })
          .order("id", { ascending: true })
      ),
      fetchRows(() =>
        forChild(
          supabase
            .from("sos_alerts")
            .select("*", { count: "exact" })
            .gte("triggered_at", from)
            .lte("triggered_at", to),
        )
          .order("triggered_at", { ascending: true })
          .order("id", { ascending: true })
      ),
    ]);

    const recordCount =
      locationResult.rows.length + eventResult.rows.length + sosResult.rows.length;

    if (recordCount === 0) {
      return json(
        {
          error:
            "No stored location, safe-zone, or SOS records are available for the selected period.",
        },
        404,
      );
    }

    // 4. Names instead of IDs.
    const childIds = [
      ...locationResult.rows,
      ...eventResult.rows,
      ...sosResult.rows,
    ].map((row) => String(row.child_id ?? ""));
    const guardianIds = sosResult.rows.map((row) => String(row.guardian_id ?? ""));
    const names = await loadNames(supabase, [...childIds, ...guardianIds, childId ?? ""]);
    const nameOf = (id: unknown, fallback: string) => names.get(String(id ?? "")) ?? fallback;

    const sosPoints = sosResult.rows.map((row) => ({ latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude) }));
    const places = await loadPlaces(supabase, [
      ...sosPoints,
      ...eventResult.rows.map((row) => ({ latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude) })),
      ...locationResult.rows.map((row) => ({ latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude) })),
    ]);
    await fillSosPlaces(supabase, places, sosPoints);
    const placeOf = (row: Record<string, unknown>) => {
      const cell = cellOf(numberOrNull(row.latitude), numberOrNull(row.longitude));
      return cell ? places.get(cell) ?? null : null;
    };

    const locations: ReportLocation[] = locationResult.rows.map((row) => ({
      childName: nameOf(row.child_id, "Unknown child"),
      source: textOrNull(row.source),
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      accuracyMeters: numberOrNull(row.accuracy_meters),
      label: textOrNull(row.location_label),
      recordedAt: String(row.recorded_at),
      place: placeOf(row),
      speedMps: numberOrNull(row.speed_mps),
      travelMode: textOrNull(row.travel_mode),
    }));

    const events: ReportEvent[] = eventResult.rows.map((row) => ({
      childName: nameOf(row.child_id, "Unknown child"),
      eventType: String(row.event_type ?? ""),
      title: textOrNull(row.title),
      details: textOrNull(row.details),
      anomalyScore: numberOrNull(row.anomaly_score),
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      occurredAt: String(row.occurred_at),
      place: placeOf(row),
    }));

    const sos: ReportSos[] = sosResult.rows.map((row) => ({
      childName: nameOf(row.child_id, "Unknown child"),
      guardianName: nameOf(row.guardian_id, "-"),
      status: String(row.status ?? ""),
      activationMethod: textOrNull(row.activation_method),
      triggeredAt: String(row.triggered_at),
      acknowledgedAt: textOrNull(row.acknowledged_at),
      realertCount: numberOrNull(row.realert_count) ?? 0,
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      place: placeOf(row),
    }));

    const generatedAt = new Date();

    const data: ReportData = {
      title,
      scopeLabel: childId ? nameOf(childId, "Selected child") : "All children",
      dateFrom: dateFromText,
      dateTo: dateToText,
      generatedAt,
      locations,
      events,
      sos,
      omitted: {
        locations: locationResult.total - locations.length,
        events: eventResult.total - events.length,
        sos: sosResult.total - sos.length,
      },
      childrenCovered: new Set(childIds.filter(Boolean)).size,
    };

    // 5. Report record, so the admin has a history of generated files.
    const adminId = admin.id;

    const { data: reportRow, error: reportInsertError } = await supabase
      .from("activity_reports")
      .insert({
        created_by_admin_id: adminId,
        child_id: childId,
        report_title: title,
        report_type: childId ? "child_activity" : "system_activity",
        date_from: dateFromText,
        date_to: dateToText,
        export_format: format === "pdf" ? "PDF" : "Excel",
        report_status: "generating",
        filters: { childId, dateFrom: dateFromText, dateTo: dateToText },
        record_count: recordCount,
      })
      .select("id")
      .single();

    if (reportInsertError) throw reportInsertError;

    createdReportId = reportRow.id;

    // 6. Build the file here; no external report service is needed.
    const bytes = format === "pdf" ? await buildPdfReport(data) : await buildExcelReport(data);

    const filePath = `${adminId}/${reportRow.id}.${format}`;

    const { error: uploadError } = await supabase.storage
      .from("activity-reports")
      .upload(filePath, bytes, { contentType: CONTENT_TYPES[format], upsert: true });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from("activity_reports")
      .update({
        report_status: "completed",
        file_path: filePath,
        generated_at: generatedAt.toISOString(),
        record_count: recordCount,
      })
      .eq("id", reportRow.id);

    if (updateError) throw updateError;

    const { data: signed, error: signedError } = await supabase.storage
      .from("activity-reports")
      .createSignedUrl(filePath, 60 * 60);

    if (signedError) throw signedError;

    return json({
      ok: true,
      reportId: reportRow.id,
      format,
      recordCount,
      filePath,
      generatedAt: generatedAt.toISOString(),
      signedUrl: signed.signedUrl,
    });
  } catch (error) {
    console.error("[generate-report]", error);

    if (createdReportId) {
      const { error: statusError } = await supabase
        .from("activity_reports")
        .update({ report_status: "failed" })
        .eq("id", createdReportId);

      if (statusError) {
        console.error("[generate-report] could not mark report as failed", statusError);
      }
    }

    // supabase-js errors are plain objects, not Error instances.
    const message =
      error instanceof Error
        ? error.message
        : typeof (error as { message?: unknown })?.message === "string"
        ? (error as { message: string }).message
        : "Report generation failed.";

    if (message === "AUTH_REQUIRED" || message === "AUTH_INVALID") {
      return json({ error: "Administrator authentication is required." }, 401);
    }

    if (message === "ADMIN_REQUIRED" || message === "ADMIN_INACTIVE") {
      return json({ error: "Active Administrator access is required." }, 403);
    }

    return json({ error: message }, 500);
  }
});
