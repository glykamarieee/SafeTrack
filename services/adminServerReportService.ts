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

export async function generateServerActivityReport(
  input: GenerateServerActivityReportInput
): Promise<GeneratedServerActivityReport> {
  const { data, error } = await supabase.functions.invoke("generate-report", {
    body: input,
  });

  if (error) {
    throw new Error(error.message || "SafeTrack could not generate the report.");
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  if (!data?.ok || !data?.signedUrl || !data?.reportId) {
    throw new Error("SafeTrack did not return a valid generated report.");
  }

  return data as GeneratedServerActivityReport;
}
