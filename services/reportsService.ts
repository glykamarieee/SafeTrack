import { supabase } from "../lib/supabase";
import type { ActivityReport } from "../types/safetrack";

type ReportRow = Record<string, unknown>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const message =
      typeof value.message === "string" ? value.message : "";

    const details =
      typeof value.details === "string" ? value.details : "";

    const hint =
      typeof value.hint === "string" ? value.hint : "";

    const combined = [message, details, hint]
      .filter(Boolean)
      .join(" ");

    if (combined) {
      return combined;
    }
  }

  return fallback;
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function asOptionalString(value: unknown) {
  const result = asString(value);

  return result || undefined;
}

function mapActivityReport(row: ReportRow): ActivityReport {
  const generatedAt =
    asString(row.generated_at) ||
    asString(row.created_at) ||
    new Date().toISOString();

  return {
    id: asString(row.id),
    childId: asString(row.child_id),
    childName:
      asString(row.child_name) ||
      asString(row.child_full_name) ||
      "Child",

    guardianId: asOptionalString(row.guardian_id),

    generatedByAdminId:
      asOptionalString(row.generated_by_admin_id) ||
      asOptionalString(row.admin_id),

    title:
      asString(row.title) ||
      asString(row.report_name) ||
      "Activity Report",

    type:
      asString(row.report_type) ||
      asString(row.type) ||
      "daily_summary",

    status: asString(row.status) || "ready",

    exportFormat:
      asString(row.export_format) ||
      asString(row.file_format) ||
      asString(row.format) ||
      "pdf",

    rangeStart:
      asString(row.range_start) ||
      asString(row.start_date) ||
      generatedAt,

    rangeEnd:
      asString(row.range_end) ||
      asString(row.end_date) ||
      generatedAt,

    generatedAt,
  };
}

function sortNewestFirst(reports: ActivityReport[]) {
  return [...reports].sort((first, second) => {
    const firstTime = new Date(first.generatedAt).getTime();
    const secondTime = new Date(second.generatedAt).getTime();

    return secondTime - firstTime;
  });
}

/*
  Administrator report list.
  Reads all report records allowed by the Admin RLS policy.
*/
export async function fetchAllReports(): Promise<ActivityReport[]> {
  const { data, error } = await supabase
    .from("activity_reports")
    .select("*");

  if (error) {
    throw new Error(
      getErrorMessage(error, "Unable to load SafeTrack reports.")
    );
  }

  return sortNewestFirst(
    (data ?? []).map((row) => mapActivityReport(row as ReportRow))
  );
}

/*
  Guardian report list.
  Uses guardian_id so a Guardian only requests their own report records.
*/
export async function fetchReportsForGuardian(
  guardianId: string
): Promise<ActivityReport[]> {
  const normalizedGuardianId = guardianId.trim();

  if (!normalizedGuardianId) {
    throw new Error("Guardian account ID is required to load reports.");
  }

  const { data, error } = await supabase
    .from("activity_reports")
    .select("*")
    .eq("guardian_id", normalizedGuardianId);

  if (error) {
    throw new Error(
      getErrorMessage(error, "Unable to load Guardian reports.")
    );
  }

  return sortNewestFirst(
    (data ?? []).map((row) => mapActivityReport(row as ReportRow))
  );
}