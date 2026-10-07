import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { supabase } from "../lib/supabase";

export type ServerReportFormat = "pdf" | "xlsx";

export type GenerateServerActivityReportInput = {
  format: ServerReportFormat;
  childId?: string;
  dateFrom?: string;
  dateTo?: string;
  reportTitle?: string;
};

export type GeneratedServerActivityReport = {
  ok: true;
  reportId: string;
  format: ServerReportFormat;
  recordCount: number;
  filePath: string;
  generatedAt: string;
  signedUrl: string;
};

function compactDate(value?: string) {
  const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
  return cleaned || "all";
}

function reportFilename(
  format: ServerReportFormat,
  dateFrom?: string,
  dateTo?: string,
) {
  const extension = format === "pdf" ? "pdf" : "xlsx";

  return `SafeTrack_Activity_Report_${compactDate(dateFrom)}_${compactDate(
    dateTo,
  )}.${extension}`;
}

function reportMimeType(format: ServerReportFormat) {
  return format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

async function functionErrorMessage(error: unknown) {
  const fallback =
    error instanceof Error
      ? error.message
      : "SafeTrack could not generate the report.";

  try {
    const context = (error as { context?: any } | null)?.context;

    if (context && typeof context.clone === "function") {
      const payload = await context.clone().json();

      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof (payload as { error?: unknown }).error === "string"
      ) {
        return (payload as { error: string }).error;
      }
    }
  } catch {
    // Keep the Supabase client error as the fallback.
  }

  return fallback;
}

export async function generateServerActivityReport(
  input: GenerateServerActivityReportInput,
): Promise<GeneratedServerActivityReport> {
  const { data, error } = await supabase.functions.invoke("generate-report", {
    body: input,
  });

  if (error) {
    throw new Error(await functionErrorMessage(error));
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  if (!data?.ok || !data?.signedUrl || !data?.reportId) {
    throw new Error("SafeTrack did not return a valid generated report.");
  }

  return data as GeneratedServerActivityReport;
}

async function downloadOnWeb(
  report: GeneratedServerActivityReport,
  filename: string,
) {
  const response = await fetch(report.signedUrl);

  if (!response.ok) {
    throw new Error(
      `SafeTrack could not download the generated report (${response.status}).`,
    );
  }

  const blob = await response.blob();

  const browserDocument = (globalThis as any).document;
  const browserUrlApi = (globalThis as any).URL;

  if (!browserDocument || !browserUrlApi) {
    throw new Error("Browser download APIs are unavailable.");
  }

  const browserUrl = browserUrlApi.createObjectURL(blob);

  try {
    const anchor = browserDocument.createElement("a");
    anchor.href = browserUrl;
    anchor.download = filename;
    anchor.style.display = "none";

    browserDocument.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    browserUrlApi.revokeObjectURL(browserUrl);
  }
}

async function downloadOnNative(
  report: GeneratedServerActivityReport,
  filename: string,
) {
  const cacheDirectory = FileSystem.cacheDirectory;

  if (!cacheDirectory) {
    throw new Error("SafeTrack could not access temporary file storage.");
  }

  const destination = `${cacheDirectory}${filename}`;

  const downloaded = await FileSystem.downloadAsync(
    report.signedUrl,
    destination,
  );

  if (!downloaded?.uri) {
    throw new Error("SafeTrack could not save the generated report.");
  }

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error(
      "The report was generated, but Android file sharing is unavailable on this device.",
    );
  }

  await Sharing.shareAsync(downloaded.uri, {
    mimeType: reportMimeType(report.format),
    dialogTitle:
      report.format === "pdf"
        ? "Save or share SafeTrack PDF report"
        : "Save or share SafeTrack Excel report",
  });
}

export async function downloadGeneratedServerActivityReport(
  report: GeneratedServerActivityReport,
  dateFrom?: string,
  dateTo?: string,
): Promise<void> {
  const filename = reportFilename(report.format, dateFrom, dateTo);

  if (Platform.OS === "web") {
    await downloadOnWeb(report, filename);
    return;
  }

  await downloadOnNative(report, filename);
}
