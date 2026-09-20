import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import * as XLSX from "npm:xlsx@0.18.5";
import { json, options } from "../_shared/response.ts";
import { assertActiveAdmin, findAdminProfile, requireUser } from "../_shared/identity.ts";
import { serviceClient } from "../_shared/supabase.ts";

type ReportFormat = "pdf" | "xlsx";

function dateStart(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function dateEnd(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(`${text}T23:59:59.999Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function buildPdf(args: {
  title: string;
  locations: any[];
  events: any[];
  sos: any[];
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 42;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
  };

  const line = (text: string, size = 9, isBold = false, indent = 0) => {
    if (y < margin + 24) newPage();
    const normalized = text.replace(/[\r\n]+/g, " ").slice(0, 155);
    page.drawText(normalized, {
      x: margin + indent,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.08, 0.08, 0.08),
    });
    y -= size + 6;
  };

  line(args.title, 16, true);
  line(`Generated: ${new Date().toISOString()}`, 9);
  line(`Location records: ${args.locations.length}`, 9);
  line(`Safety events: ${args.events.length}`, 9);
  line(`SOS alerts: ${args.sos.length}`, 9);
  y -= 8;

  line("LOCATION RECORDS", 11, true);
  for (const row of args.locations.slice(0, 1500)) {
    line(
      `${safeCell(row.recorded_at)} | ${safeCell(row.source)} | ` +
        `${safeCell(row.latitude)}, ${safeCell(row.longitude)} | accuracy=${safeCell(row.accuracy_meters)}m`,
      8,
    );
  }

  y -= 5;
  line("SAFETY EVENTS", 11, true);
  for (const row of args.events.slice(0, 1500)) {
    line(
      `${safeCell(row.occurred_at)} | ${safeCell(row.event_type)} | ` +
        `${safeCell(row.title)} | ${safeCell(row.details)}`,
      8,
    );
  }

  y -= 5;
  line("SOS ALERTS", 11, true);
  for (const row of args.sos.slice(0, 1500)) {
    line(
      `${safeCell(row.triggered_at)} | ${safeCell(row.status)} | ` +
        `${safeCell(row.activation_method)} | acknowledged=${safeCell(row.acknowledged_at)}`,
      8,
    );
  }

  return new Uint8Array(await pdf.save());
}

function buildXlsx(args: { locations: any[]; events: any[]; sos: any[] }) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(args.locations),
    "Location Logs",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(args.events),
    "Safety Events",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(args.sos),
    "SOS Alerts",
  );

  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Uint8Array(array);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return options();

  try {
    const supabase = serviceClient();
    const user = await requireUser(supabase, request);
    const admin = await findAdminProfile(supabase, user);
    assertActiveAdmin(admin);

    const body = await request.json();
    const format = String(body.format ?? "pdf").toLowerCase() as ReportFormat;
    const childId = String(body.childId ?? "").trim() || null;

    // The live SafeTrack activity_reports table requires date_from/date_to.
    // If Admin does not provide a range, generate a useful default report for
    // the most recent 7 calendar days (including today).
    const today = new Date();
    const defaultToText = today.toISOString().slice(0, 10);
    const defaultFromDate = new Date(today);
    defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 6);
    const defaultFromText = defaultFromDate.toISOString().slice(0, 10);

    const from = dateStart(body.dateFrom ?? defaultFromText);
    const to = dateEnd(body.dateTo ?? defaultToText);
    const title = String(body.reportTitle ?? "SafeTrack Activity Report").trim().slice(0, 180);

    if (!["pdf", "xlsx"].includes(format)) {
      return json({ error: "format must be pdf or xlsx." }, 400);
    }

    let locationQuery = supabase
      .from("location_logs")
      .select("id, child_id, source, latitude, longitude, accuracy_meters, location_label, recorded_at, created_at")
      .order("recorded_at", { ascending: true })
      .limit(5000);

    let eventQuery = supabase
      .from("geofence_events")
      .select("id, child_id, geofence_id, location_log_id, event_type, title, details, anomaly_score, latitude, longitude, occurred_at, created_at")
      .order("occurred_at", { ascending: true })
      .limit(5000);

    let sosQuery = supabase
      .from("sos_alerts")
      .select("*")
      .order("triggered_at", { ascending: true })
      .limit(5000);

    if (childId) {
      locationQuery = locationQuery.eq("child_id", childId);
      eventQuery = eventQuery.eq("child_id", childId);
      sosQuery = sosQuery.eq("child_id", childId);
    }
    if (from) {
      locationQuery = locationQuery.gte("recorded_at", from);
      eventQuery = eventQuery.gte("occurred_at", from);
      sosQuery = sosQuery.gte("triggered_at", from);
    }
    if (to) {
      locationQuery = locationQuery.lte("recorded_at", to);
      eventQuery = eventQuery.lte("occurred_at", to);
      sosQuery = sosQuery.lte("triggered_at", to);
    }

    const [locationsResult, eventsResult, sosResult] = await Promise.all([
      locationQuery,
      eventQuery,
      sosQuery,
    ]);

    if (locationsResult.error) throw locationsResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (sosResult.error) throw sosResult.error;

    const locations = locationsResult.data ?? [];
    const events = eventsResult.data ?? [];
    const sos = sosResult.data ?? [];
    const recordCount = locations.length + events.length + sos.length;

    const adminId = admin.id;
    const now = new Date();
    const dateFromText = from ? from.slice(0, 10) : null;
    const dateToText = to ? to.slice(0, 10) : null;

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

    const bytes = format === "pdf"
      ? await buildPdf({ title, locations, events, sos })
      : buildXlsx({ locations, events, sos });

    const extension = format === "pdf" ? "pdf" : "xlsx";
    const contentType = format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const filePath = `${adminId}/${reportRow.id}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("activity-reports")
      .upload(filePath, bytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const generatedAt = now.toISOString();
    const { error: updateError } = await supabase
      .from("activity_reports")
      .update({
        report_status: "completed",
        file_path: filePath,
        generated_at: generatedAt,
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
      generatedAt,
      signedUrl: signed.signedUrl,
    });
  } catch (error) {
    console.error("[generate-report]", error);
    const message = error instanceof Error ? error.message : "Report generation failed.";
    if (["AUTH_REQUIRED", "AUTH_INVALID"].includes(message)) {
      return json({ error: "Administrator authentication is required." }, 401);
    }
    if (["ADMIN_REQUIRED", "ADMIN_INACTIVE"].includes(message)) {
      return json({ error: "Active Administrator access is required." }, 403);
    }
    return json({ error: message }, 500);
  }
});
