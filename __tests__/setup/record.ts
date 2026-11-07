import fs from "fs";
import path from "path";

/**
 * Saves what really happened in each test case (the text the screen showed,
 * where it navigated), so the "Actual Result" column of the unit testing
 * table is copied from the run, never typed in advance.
 * Output: __tests__/results/<module>.json
 */
const RESULTS = path.join(__dirname, "..", "results");

export function recordActual(module: string, caseId: string, actual: string) {
  fs.mkdirSync(RESULTS, { recursive: true });
  const file = path.join(RESULTS, `${module}.json`);
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  // The local date (Philippine time), written as in the table: MM/DD/YYYY.
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;
  data[caseId] = { actual, date };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
