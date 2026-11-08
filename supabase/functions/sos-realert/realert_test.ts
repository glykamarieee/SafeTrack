import { assertEquals } from "jsr:@std/assert@1";

/*
 * Unit testing, Tap-and-Shake SOS & Re-Alert Module: Receive SOS Re-Alert
 * (CASE-101, 104, 105). The real sos-realert function is run unchanged: its
 * request handler is captured from Deno.serve, and its database calls are
 * answered from an in-memory sos_alerts table that applies the same filters
 * the database would. Raising realert_count is what makes the database send
 * the guardian the re-alert notification.
 *
 * Run (from safe-track):
 *   deno test --allow-env --allow-net=jsr.io --allow-read --allow-write=__tests__/results supabase/functions/sos-realert/realert_test.ts
 */

const RESULTS = new URL("../../../__tests__/results/sos.json", import.meta.url);
const SECRET = "cron-test-secret";

function recordActual(caseId: string, actual: string) {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(Deno.readTextFileSync(RESULTS));
  } catch {
    // First result of the module.
  }
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;
  data[caseId] = { actual, date };
  Deno.writeTextFileSync(RESULTS, JSON.stringify(data, null, 2));
}

type Row = {
  id: string;
  child_id: string;
  guardian_id: string;
  status: "active" | "acknowledged" | "cancelled";
  realert_count: number;
  last_realert_at: string | null;
  triggered_at: string;
  updated_at?: string;
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function alert(id: string, fields: Partial<Row>): Row {
  return { id, child_id: "child-1", guardian_id: "guardian-1", status: "active", realert_count: 0, last_realert_at: null, triggered_at: minutesAgo(3), ...fields };
}

/** PostgREST filters used by the function: eq.<v> and lt.<n>. */
function matches(row: Row, params: URLSearchParams) {
  for (const [column, filter] of params) {
    if (column === "select") continue;
    const [op, value] = [filter.slice(0, filter.indexOf(".")), filter.slice(filter.indexOf(".") + 1)];
    const actual = String((row as Record<string, unknown>)[column]);
    if (op === "eq" && actual !== value) return false;
    if (op === "lt" && !(Number(actual) < Number(value))) return false;
  }
  return true;
}

let handler: (request: Request) => Promise<Response>;
let table: Row[] = [];

Deno.env.set("SUPABASE_URL", "https://db.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
Deno.env.set("CRON_SECRET", SECRET);
Deno.env.set("SOS_REALERT_SECONDS", "120");
Deno.env.set("SOS_MAX_REALERTS", "10");

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== "https://db.test") return realFetch(input, init);
  const rows = table.filter((row) => matches(row, url.searchParams));
  if (request.method === "GET") return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
  if (request.method === "PATCH") {
    const changes = await request.json();
    for (const row of rows) Object.assign(row, changes);
    return new Response(null, { status: 204 });
  }
  return new Response("unexpected", { status: 500 });
};

// Capture the function's handler instead of starting a server.
(Deno as unknown as { serve: unknown }).serve = (h: typeof handler) => {
  handler = h;
};
await import("./index.ts");

async function runCron() {
  const response = await handler(new Request("https://fn.test/sos-realert", { method: "POST", headers: { "x-cron-secret": SECRET } }));
  return (await response.json()) as { ok: boolean; sent: number };
}

Deno.test("CASE-101: Guardian does not acknowledge an active SOS", async () => {
  table = [
    alert("due", { triggered_at: minutesAgo(3) }),
    alert("again", { realert_count: 2, last_realert_at: minutesAgo(2.5), triggered_at: minutesAgo(9) }),
    alert("recent", { triggered_at: minutesAgo(0.5) }),
  ];
  const result = await runCron();
  assertEquals(result.sent, 2);
  assertEquals(table.find((row) => row.id === "due")!.realert_count, 1);
  assertEquals(table.find((row) => row.id === "again")!.realert_count, 3);
  assertEquals(table.find((row) => row.id === "recent")!.realert_count, 0);
  recordActual(
    "CASE-101",
    "Unacknowledged SOS alerts were re-alerted once 120 seconds had passed (count 0→1 and 2→3, with the re-alert time saved); an SOS only 30 seconds old was not re-alerted yet.",
  );
});

Deno.test("CASE-104: SOS has already been acknowledged or cancelled", async () => {
  table = [
    alert("acknowledged", { status: "acknowledged", triggered_at: minutesAgo(10) }),
    alert("cancelled", { status: "cancelled", triggered_at: minutesAgo(10) }),
  ];
  const result = await runCron();
  assertEquals(result.sent, 0);
  assertEquals(table.map((row) => row.realert_count), [0, 0]);
  recordActual("CASE-104", "Acknowledged and cancelled SOS alerts (10 minutes old) were skipped: no re-alert was sent.");
});

Deno.test("CASE-105: Re-alert count reaches the set maximum", async () => {
  table = [alert("max", { realert_count: 10, last_realert_at: minutesAgo(5), triggered_at: minutesAgo(30) })];
  const result = await runCron();
  assertEquals(result.sent, 0);
  assertEquals(table[0].realert_count, 10);
  recordActual("CASE-105", "An active SOS that had already been re-alerted 10 times (the maximum) received no further re-alert.");
});

Deno.test("re-alert requests without the scheduler secret are refused", async () => {
  const response = await handler(new Request("https://fn.test/sos-realert", { method: "POST" }));
  assertEquals(response.status, 401);
  await response.body?.cancel();
});
