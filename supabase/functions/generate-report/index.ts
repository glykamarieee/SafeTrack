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

  const date = new Date(
    `${text}T00:00:00${PHILIPPINES_OFFSET}`,
  );

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

function getReportServiceUrl() {
  const rawUrl = String(
    Deno.env.get("REPORT_SERVICE_URL") ?? "",
  ).trim();

  if (!rawUrl) {
    throw new Error("REPORT_SERVICE_URL_NOT_CONFIGURED");
  }

  return rawUrl.replace(/\/+$/, "");
}

function getReportServiceKey() {
  return String(
    Deno.env.get("REPORT_SERVICE_KEY") ?? "",
  ).trim();
}

async function readReportServiceError(
  response: Response,
) {
  const fallback =
    `GemBox report service returned HTTP ${response.status}.`;

  try {
    const contentType =
      response.headers.get("content-type") ?? "";

    if (
      contentType
        .toLowerCase()
        .includes("application/json")
    ) {
      const payload = await response.json();

      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload
      ) {
        return String(
          (payload as { error?: unknown }).error ??
            fallback,
        );
      }

      if (
        payload &&
        typeof payload === "object" &&
        "detail" in payload
      ) {
        return String(
          (payload as { detail?: unknown }).detail ??
            fallback,
        );
      }

      return fallback;
    }

    const text = (await response.text()).trim();

    return text || fallback;
  } catch {
    return fallback;
  }
}

async function generateWithGemBox(args: {
  format: ReportFormat;
  title: string;
  childId: string | null;
  dateFrom: string;
  dateTo: string;
  rows: ReportRows;
}) {
  const reportServiceUrl =
    getReportServiceUrl();

  const reportServiceKey =
    getReportServiceKey();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept:
      args.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  if (reportServiceKey) {
    headers["X-SafeTrack-Report-Key"] =
      reportServiceKey;
  }

  let response: Response;

  try {
    response = await fetch(
      `${reportServiceUrl}/reports/generate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          format: args.format,
          reportTitle: args.title,
          childId: args.childId,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
          locations: args.rows.locations,
          events: args.rows.events,
          sos: args.rows.sos,
        }),
      },
    );
  } catch (error) {
    console.error(
      "[generate-report] GemBox request failed",
      error,
    );

    throw new Error(
      "SafeTrack could not reach the GemBox report service.",
    );
  }

  if (!response.ok) {
    const message =
      await readReportServiceError(response);

    console.error(
      "[generate-report] GemBox service error",
      response.status,
      message,
    );

    throw new Error(message);
  }

  const expectedContentType =
    args.format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const returnedContentType =
    response.headers.get("content-type") ?? "";

  if (
    !returnedContentType
      .toLowerCase()
      .includes(
        expectedContentType.toLowerCase(),
      )
  ) {
    console.warn(
      "[generate-report] Unexpected GemBox content type:",
      returnedContentType,
    );
  }

  const buffer =
    await response.arrayBuffer();

  if (buffer.byteLength === 0) {
    throw new Error(
      "GemBox returned an empty report file.",
    );
  }

  return new Uint8Array(buffer);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return options();
  }

  const supabase = serviceClient();

  let createdReportId: string | null =
    null;

  try {
    //
    // 1. AUTHENTICATE USER
    //
    const user =
      await requireUser(
        supabase,
        request,
      );

    const admin =
      await findAdminProfile(
        supabase,
        user,
      );

    if (!admin) {
      throw new Error(
        "ADMIN_REQUIRED",
      );
    }

    assertActiveAdmin(admin);

    //
    // 2. READ REQUEST
    //
    const body =
      await request.json();

    const format =
      String(
        body.format ?? "pdf",
      ).toLowerCase() as ReportFormat;

    const childId =
      String(
        body.childId ?? "",
      ).trim() || null;

    if (
      !["pdf", "xlsx"].includes(
        format,
      )
    ) {
      return json(
        {
          error:
            "format must be pdf or xlsx.",
        },
        400,
      );
    }

    //
    // 3. DEFAULT REPORT DATE RANGE
    //    Uses Philippine local dates.
    //
    const today =
      new Date();

    const defaultToDate =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      ).format(today);

    const defaultFromDateObject =
      new Date(
        `${defaultToDate}T00:00:00${PHILIPPINES_OFFSET}`,
      );

    defaultFromDateObject.setUTCDate(
      defaultFromDateObject.getUTCDate() -
        6,
    );

    const defaultFromDate =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      ).format(
        defaultFromDateObject,
      );

    const dateFromText =
      validDateText(
        body.dateFrom ??
          defaultFromDate,
      );

    const dateToText =
      validDateText(
        body.dateTo ??
          defaultToDate,
      );

    if (
      !dateFromText ||
      !dateToText
    ) {
      return json(
        {
          error:
            "Use YYYY-MM-DD for both report dates.",
        },
        400,
      );
    }

    if (
      dateFromText >
      dateToText
    ) {
      return json(
        {
          error:
            "The report start date cannot be later than the end date.",
        },
        400,
      );
    }

    const from =
      startOfPhilippineDay(
        dateFromText,
      );

    const to =
      endOfPhilippineDay(
        dateToText,
      );

    const rawTitle =
      String(
        body.reportTitle ??
          "SafeTrack Activity Report",
      ).trim();

    const title =
      (
        rawTitle ||
        "SafeTrack Activity Report"
      ).slice(0, 180);

    //
    // 4. RETRIEVE LOCATION RECORDS
    //
    let locationQuery =
      supabase
        .from(
          "location_logs",
        )
        .select(
          "id, child_id, source, latitude, longitude, accuracy_meters, location_label, recorded_at, created_at",
        )
        .gte(
          "recorded_at",
          from,
        )
        .lte(
          "recorded_at",
          to,
        )
        .order(
          "recorded_at",
          {
            ascending: true,
          },
        )
        .limit(5000);

    //
    // 5. RETRIEVE SAFE-ZONE / SAFETY EVENTS
    //
    let eventQuery =
      supabase
        .from(
          "geofence_events",
        )
        .select(
          "id, child_id, geofence_id, location_log_id, event_type, title, details, anomaly_score, latitude, longitude, occurred_at, created_at",
        )
        .gte(
          "occurred_at",
          from,
        )
        .lte(
          "occurred_at",
          to,
        )
        .order(
          "occurred_at",
          {
            ascending: true,
          },
        )
        .limit(5000);

    //
    // 6. RETRIEVE SOS RECORDS
    //
    let sosQuery =
      supabase
        .from(
          "sos_alerts",
        )
        .select("*")
        .gte(
          "triggered_at",
          from,
        )
        .lte(
          "triggered_at",
          to,
        )
        .order(
          "triggered_at",
          {
            ascending: true,
          },
        )
        .limit(5000);

    //
    // OPTIONAL CHILD FILTER
    //
    if (childId) {
      locationQuery =
        locationQuery.eq(
          "child_id",
          childId,
        );

      eventQuery =
        eventQuery.eq(
          "child_id",
          childId,
        );

      sosQuery =
        sosQuery.eq(
          "child_id",
          childId,
        );
    }

    //
    // 7. EXECUTE DATABASE QUERIES
    //
    const [
      locationsResult,
      eventsResult,
      sosResult,
    ] = await Promise.all([
      locationQuery,
      eventQuery,
      sosQuery,
    ]);

    if (
      locationsResult.error
    ) {
      throw locationsResult.error;
    }

    if (
      eventsResult.error
    ) {
      throw eventsResult.error;
    }

    if (
      sosResult.error
    ) {
      throw sosResult.error;
    }

    const rows: ReportRows = {
      locations:
        locationsResult.data ??
        [],

      events:
        eventsResult.data ??
        [],

      sos:
        sosResult.data ??
        [],
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

    //
    // 8. CREATE ACTIVITY REPORT RECORD
    //
    const adminId =
      admin.id;

    const generatedAt =
      new Date().toISOString();

    const {
      data: reportRow,
      error:
        reportInsertError,
    } = await supabase
      .from(
        "activity_reports",
      )
      .insert({
        created_by_admin_id:
          adminId,

        child_id:
          childId,

        report_title:
          title,

        report_type:
          childId
            ? "child_activity"
            : "system_activity",

        date_from:
          dateFromText,

        date_to:
          dateToText,

        export_format:
          format === "pdf"
            ? "PDF"
            : "Excel",

        report_status:
          "generating",

        filters: {
          childId,
          dateFrom:
            dateFromText,
          dateTo:
            dateToText,
        },

        record_count:
          recordCount,
      })
      .select("id")
      .single();

    if (
      reportInsertError
    ) {
      throw reportInsertError;
    }

    createdReportId =
      reportRow.id;

    //
    // 9. GENERATE THE ACTUAL FILE
    //    USING GEMBOX.
    //
    const bytes =
      await generateWithGemBox({
        format,
        title,
        childId,
        dateFrom:
          dateFromText,
        dateTo:
          dateToText,
        rows,
      });

    //
    // 10. FILE INFORMATION
    //
    const extension =
      format === "pdf"
        ? "pdf"
        : "xlsx";

    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const filePath =
      `${adminId}/${reportRow.id}.${extension}`;

    //
    // 11. UPLOAD GEMBOX FILE
    //     TO EXISTING SUPABASE STORAGE
    //
    const {
      error:
        uploadError,
    } = await supabase.storage
      .from(
        "activity-reports",
      )
      .upload(
        filePath,
        bytes,
        {
          contentType,
          upsert: true,
        },
      );

    if (uploadError) {
      throw uploadError;
    }

    //
    // 12. MARK REPORT COMPLETED
    //
    const {
      error:
        updateError,
    } = await supabase
      .from(
        "activity_reports",
      )
      .update({
        report_status:
          "completed",

        file_path:
          filePath,

        generated_at:
          generatedAt,

        record_count:
          recordCount,
      })
      .eq(
        "id",
        reportRow.id,
      );

    if (updateError) {
      throw updateError;
    }

    //
    // 13. CREATE DOWNLOAD URL
    //
    const {
      data: signed,
      error:
        signedError,
    } = await supabase.storage
      .from(
        "activity-reports",
      )
      .createSignedUrl(
        filePath,
        60 * 60,
      );

    if (signedError) {
      throw signedError;
    }

    //
    // 14. RETURN SAME RESPONSE
    //     EXPECTED BY ADMIN APP
    //
    return json({
      ok: true,
      reportId:
        reportRow.id,
      format,
      recordCount,
      filePath,
      generatedAt,
      signedUrl:
        signed.signedUrl,
    });
  } catch (error) {
    console.error(
      "[generate-report]",
      error,
    );

    //
    // MARK PARTIALLY CREATED REPORT
    // AS FAILED.
    //
    if (createdReportId) {
      try {
        await supabase
          .from(
            "activity_reports",
          )
          .update({
            report_status:
              "failed",
          })
          .eq(
            "id",
            createdReportId,
          );
      } catch (
        statusError
      ) {
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

    //
    // AUTHENTICATION ERRORS
    //
    if (
      [
        "AUTH_REQUIRED",
        "AUTH_INVALID",
      ].includes(message)
    ) {
      return json(
        {
          error:
            "Administrator authentication is required.",
        },
        401,
      );
    }

    //
    // ADMIN AUTHORIZATION ERRORS
    //
    if (
      [
        "ADMIN_REQUIRED",
        "ADMIN_INACTIVE",
      ].includes(message)
    ) {
      return json(
        {
          error:
            "Active Administrator access is required.",
        },
        403,
      );
    }

    //
    // REPORT SERVICE CONFIGURATION ERROR
    //
    if (
      message ===
      "REPORT_SERVICE_URL_NOT_CONFIGURED"
    ) {
      return json(
        {
          error:
            "The SafeTrack report service is not configured.",
        },
        500,
      );
    }

    return json(
      {
        error:
          message,
      },
      500,
    );
  }
});