import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import * as XLSX from "npm:xlsx@0.18.5";

import { json, options } from "../_shared/response.ts";
import {
  assertActiveAdmin,
  findAdminProfile,
  requireUser,
} from "../_shared/identity.ts";
import { serviceClient } from "../_shared/supabase.ts";

type ReportFormat = "pdf" | "xlsx";

type ReportRows = {
  locations: any[];
  events: any[];
  sos: any[];
};

const PHILIPPINES_OFFSET = "+08:00";

function validDateText(value: unknown): string | null {
  const text = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00${PHILIPPINES_OFFSET}`);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return text;
}

function startOfPhilippineDay(dateText: string) {
  return new Date(
    `${dateText}T00:00:00.000${PHILIPPINES_OFFSET}`,
  ).toISOString();
}

function endOfPhilippineDay(dateText: string) {
  return new Date(
    `${dateText}T23:59:59.999${PHILIPPINES_OFFSET}`,
  ).toISOString();
}

function safeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function cleanPdfText(value: unknown) {
  return safeCell(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTimestamp(value: unknown) {
  const text = safeCell(value);

  if (!text) return "";

  const date = new Date(text);

  if (!Number.isFinite(date.getTime())) {
    return text;
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function wrapText(text: string, maxChars: number) {
  const words = cleanPdfText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current =
      word.length > maxChars
        ? word.slice(0, maxChars)
        : word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

async function buildPdf(args: {
  title: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  rows: ReportRows;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const ensureSpace = (height: number) => {
    if (y - height < margin) {
      newPage();
    }
  };

  const drawLine = (
    text: string,
    size = 9,
    isBold = false,
    color = rgb(0.09, 0.14, 0.11),
    indent = 0,
  ) => {
    ensureSpace(size + 8);

    page.drawText(cleanPdfText(text), {
      x: margin + indent,
      y,
      size,
      font: isBold ? bold : font,
      color,
      maxWidth: contentWidth - indent,
    });

    y -= size + 7;
  };

  const drawWrapped = (
    text: string,
    size = 8,
    maxChars = 112,
    indent = 0,
  ) => {
    for (const wrapped of wrapText(text, maxChars)) {
      drawLine(wrapped, size, false, rgb(0.17, 0.22, 0.19), indent);
    }
  };

  const section = (title: string, count: number) => {
    ensureSpace(42);
    y -= 7;

    page.drawRectangle({
      x: margin,
      y: y - 2,
      width: contentWidth,
      height: 24,
      color: rgb(0.91, 0.96, 0.93),
    });

    page.drawText(`${title} (${count})`, {
      x: margin + 10,
      y: y + 5,
      size: 10,
      font: bold,
      color: rgb(0.07, 0.36, 0.22),
    });

    y -= 31;
  };

  page.drawText("SAFETRACK", {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: rgb(0.07, 0.45, 0.28),
  });

  y -= 25;

  drawLine(args.title, 18, true, rgb(0.06, 0.16, 0.11));
  drawLine(
    `Selected period: ${args.dateFrom} to ${args.dateTo}`,
    9,
    false,
    rgb(0.36, 0.43, 0.39),
  );
  drawLine(
    `Generated: ${formatTimestamp(args.generatedAt)}`,
    9,
    false,
    rgb(0.36, 0.43, 0.39),
  );

  y -= 8;

  drawLine(
    `Total activity records: ${
      args.rows.locations.length +
      args.rows.events.length +
      args.rows.sos.length
    }`,
    10,
    true,
  );
  drawLine(`Location records: ${args.rows.locations.length}`, 9);
  drawLine(`Safe-zone / safety events: ${args.rows.events.length}`, 9);
  drawLine(`SOS records: ${args.rows.sos.length}`, 9);

  section("LOCATION RECORDS", args.rows.locations.length);

  if (!args.rows.locations.length) {
    drawLine("No location records in the selected period.", 8);
  }

  for (const row of args.rows.locations.slice(0, 5000)) {
    drawWrapped(
      `${formatTimestamp(row.recorded_at)} | ${safeCell(row.source)} | ` +
        `${safeCell(row.latitude)}, ${safeCell(row.longitude)} | ` +
        `accuracy=${safeCell(row.accuracy_meters)}m | ${safeCell(
          row.location_label,
        )}`,
    );
  }

  section("SAFE-ZONE / SAFETY EVENTS", args.rows.events.length);

  if (!args.rows.events.length) {
    drawLine("No safe-zone or safety events in the selected period.", 8);
  }

  for (const row of args.rows.events.slice(0, 5000)) {
    drawWrapped(
      `${formatTimestamp(row.occurred_at)} | ${safeCell(row.event_type)} | ` +
        `${safeCell(row.title)} | ${safeCell(row.details)}`,
    );
  }

  section("SOS RECORDS", args.rows.sos.length);

  if (!args.rows.sos.length) {
    drawLine("No SOS records in the selected period.", 8);
  }

  for (const row of args.rows.sos.slice(0, 5000)) {
    drawWrapped(
      `${formatTimestamp(row.triggered_at)} | status=${safeCell(
        row.status,
      )} | method=${safeCell(row.activation_method)} | ` +
        `acknowledged=${formatTimestamp(row.acknowledged_at) || "No"}`,
    );
  }

  y -= 10;
  drawWrapped(
    "SafeTrack reports summarize successfully stored system records. " +
      "They do not independently confirm danger, an emergency, or a child's exact real-time position.",
    8,
    105,
  );

  return new Uint8Array(await pdf.save());
}

function autoWidth(rows: Record<string, unknown>[]) {
  if (!rows.length) {
    return [];
  }

  const keys = Object.keys(rows[0]);

  return keys.map((key) => {
    const max = rows.reduce((current, row) => {
      const length = safeCell(row[key]).length;
      return Math.max(current, length);
    }, key.length);

    return {
      wch: Math.min(Math.max(max + 2, 12), 42),
    };
  });
}

function appendJsonSheet(
  workbook: XLSX.WorkBook,
  rows: Record<string, unknown>[],
  sheetName: string,
) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = autoWidth(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}

function buildXlsx(args: {
  title: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  rows: ReportRows;
}) {
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ["SafeTrack Activity Report"],
    [],
    ["Report title", args.title],
    ["Selected start date", args.dateFrom],
    ["Selected end date", args.dateTo],
    ["Generated", formatTimestamp(args.generatedAt)],
    [],
    ["Record type", "Total"],
    ["Location Records", args.rows.locations.length],
    ["Safe-Zone / Safety Events", args.rows.events.length],
    ["SOS Records", args.rows.sos.length],
    [
      "Total Activity Records",
      args.rows.locations.length +
        args.rows.events.length +
        args.rows.sos.length,
    ],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 30 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  appendJsonSheet(
    workbook,
    args.rows.locations as Record<string, unknown>[],
    "Location Logs",
  );

  appendJsonSheet(
    workbook,
    args.rows.events as Record<string, unknown>[],
    "Safety Events",
  );

  appendJsonSheet(
    workbook,
    args.rows.sos as Record<string, unknown>[],
    "SOS Alerts",
  );

  const array = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  return new Uint8Array(array);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return options();
  }

  const supabase = serviceClient();
  let createdReportId: string | null = null;

  try {
    const user = await requireUser(supabase, request);
    const admin = await findAdminProfile(supabase, user);

    if (!admin) {
      throw new Error("ADMIN_REQUIRED");
    }

    assertActiveAdmin(admin);

    const body = await request.json();

    const format = String(body.format ?? "pdf").toLowerCase() as ReportFormat;
    const childId = String(body.childId ?? "").trim() || null;

    if (!["pdf", "xlsx"].includes(format)) {
      return json({ error: "format must be pdf or xlsx." }, 400);
    }

    const today = new Date();

    const defaultToDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(today);

    const defaultFromDateObject = new Date(
      `${defaultToDate}T00:00:00${PHILIPPINES_OFFSET}`,
    );
    defaultFromDateObject.setUTCDate(defaultFromDateObject.getUTCDate() - 6);

    const defaultFromDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(defaultFromDateObject);

    const dateFromText = validDateText(
      body.dateFrom ?? defaultFromDate,
    );

    const dateToText = validDateText(
      body.dateTo ?? defaultToDate,
    );

    if (!dateFromText || !dateToText) {
      return json(
        { error: "Use YYYY-MM-DD for both report dates." },
        400,
      );
    }

    if (dateFromText > dateToText) {
      return json(
        { error: "The report start date cannot be later than the end date." },
        400,
      );
    }

    const from = startOfPhilippineDay(dateFromText);
    const to = endOfPhilippineDay(dateToText);

    const rawTitle = String(
      body.reportTitle ?? "SafeTrack Activity Report",
    ).trim();

    const title = (rawTitle || "SafeTrack Activity Report").slice(0, 180);

    let locationQuery = supabase
      .from("location_logs")
      .select(
        "id, child_id, source, latitude, longitude, accuracy_meters, location_label, recorded_at, created_at",
      )
      .gte("recorded_at", from)
      .lte("recorded_at", to)
      .order("recorded_at", { ascending: true })
      .limit(5000);

    let eventQuery = supabase
      .from("geofence_events")
      .select(
        "id, child_id, geofence_id, location_log_id, event_type, title, details, anomaly_score, latitude, longitude, occurred_at, created_at",
      )
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: true })
      .limit(5000);

    let sosQuery = supabase
      .from("sos_alerts")
      .select("*")
      .gte("triggered_at", from)
      .lte("triggered_at", to)
      .order("triggered_at", { ascending: true })
      .limit(5000);

    if (childId) {
      locationQuery = locationQuery.eq("child_id", childId);
      eventQuery = eventQuery.eq("child_id", childId);
      sosQuery = sosQuery.eq("child_id", childId);
    }

    const [locationsResult, eventsResult, sosResult] = await Promise.all([
      locationQuery,
      eventQuery,
      sosQuery,
    ]);

    if (locationsResult.error) {
      throw locationsResult.error;
    }

    if (eventsResult.error) {
      throw eventsResult.error;
    }

    if (sosResult.error) {
      throw sosResult.error;
    }

    const rows: ReportRows = {
      locations: locationsResult.data ?? [],
      events: eventsResult.data ?? [],
      sos: sosResult.data ?? [],
    };

    const recordCount =
      rows.locations.length +
      rows.events.length +
      rows.sos.length;

    if (recordCount === 0) {
      return json(
        {
          error:
            "No stored location, safe-zone, or SOS records are available for the selected period.",
        },
        404,
      );
    }

    const adminId = admin.id;
    const generatedAt = new Date().toISOString();

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
        filters: {
          childId,
          dateFrom: dateFromText,
          dateTo: dateToText,
        },
        record_count: recordCount,
      })
      .select("id")
      .single();

    if (reportInsertError) {
      throw reportInsertError;
    }

    createdReportId = reportRow.id;

    const bytes =
      format === "pdf"
        ? await buildPdf({
            title,
            dateFrom: dateFromText,
            dateTo: dateToText,
            generatedAt,
            rows,
          })
        : buildXlsx({
            title,
            dateFrom: dateFromText,
            dateTo: dateToText,
            generatedAt,
            rows,
          });

    const extension = format === "pdf" ? "pdf" : "xlsx";

    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const filePath = `${adminId}/${reportRow.id}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("activity-reports")
      .upload(filePath, bytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { error: updateError } = await supabase
      .from("activity_reports")
      .update({
        report_status: "completed",
        file_path: filePath,
        generated_at: generatedAt,
        record_count: recordCount,
      })
      .eq("id", reportRow.id);

    if (updateError) {
      throw updateError;
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from("activity-reports")
      .createSignedUrl(filePath, 60 * 60);

    if (signedError) {
      throw signedError;
    }

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

    if (createdReportId) {
      try {
        await supabase
          .from("activity_reports")
          .update({
            report_status: "failed",
          })
          .eq("id", createdReportId);
      } catch (statusError) {
        console.error(
          "[generate-report] could not mark report as failed",
          statusError,
        );
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "Report generation failed.";

    if (["AUTH_REQUIRED", "AUTH_INVALID"].includes(message)) {
      return json(
        { error: "Administrator authentication is required." },
        401,
      );
    }

    if (["ADMIN_REQUIRED", "ADMIN_INACTIVE"].includes(message)) {
      return json(
        { error: "Active Administrator access is required." },
        403,
      );
    }

    return json({ error: message }, 500);
  }
});
