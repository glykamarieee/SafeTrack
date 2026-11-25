/**
 * Integration testing: Administrator Dashboard -> Daily Activity History (live backend).
 * Signed in as the administrator, the system summary report for the last 7 days is generated
 * by the server (generate-report) as PDF and as Excel, from the stored activity records.
 */
import { generateServerActivityReport } from "../../services/adminServerReportService";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { MODULE } from "./helpers";

const A = accounts as any;
afterAll(signOutLocally);
const keyOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

describe("System summary report", () => {
  test("INT-032: The summary report is generated and exported as PDF and Excel", async () => {
    await signInAs(A.admin);
    const dateFrom = keyOf(new Date(Date.now() - 6 * 86400000)), dateTo = keyOf(new Date());
    const pdf = await generateServerActivityReport({ format: "pdf", dateFrom, dateTo });
    const xlsx = await generateServerActivityReport({ format: "xlsx", dateFrom, dateTo });
    for (const r of [pdf, xlsx]) {
      expect(r.ok).toBe(true);
      const file = await fetch(r.signedUrl);
      expect(file.status).toBe(200);
      expect((await file.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    }
    recordActual(MODULE, "INT-032", `For ${dateFrom} to ${dateTo} the server generated the PDF report (${pdf.recordCount} records, ${pdf.filePath}) and the Excel report (${xlsx.recordCount} records, ${xlsx.filePath}); both files downloaded.`);
  }, 120_000);
});
