import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { reviewAnomaly } from "./anomaly.ts";

/*
 * Unit testing, AI Anomaly Detection & Geofencing Module: AI Anomaly Review
 * (CASE-058 to CASE-063). The real reviewAnomaly is run; the database and the
 * AI service are stand-ins so each condition (history size, safe zone, recent
 * notice, AI answer, AI asleep) can be set exactly. Actual results are saved
 * to __tests__/results/geofencing.json like the app's tests.
 *
 * Run (from safe-track):
 *   deno test --allow-env --allow-net=jsr.io --allow-read --allow-write=__tests__/results supabase/functions/_shared/anomaly_cases_test.ts
 */

const RESULTS = new URL("../../../__tests__/results/geofencing.json", import.meta.url);
const CHILD = "child-1";
const NOW = Date.now();
const USUAL = { latitude: 10.28, longitude: 123.95 };
const HOME = { latitude: 10.27268, longitude: 123.942459, radius_meters: 50 };
// About 9 km from where the child usually is.
const FAR = { latitude: 10.36, longitude: 123.95 };

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
  Deno.mkdirSync(new URL(".", RESULTS), { recursive: true });
  Deno.writeTextFileSync(RESULTS, JSON.stringify(data, null, 2));
}

/** `points` earlier locations, `hoursApart` hours apart, the newest one just before now. */
function history(points: number, hoursApart: number) {
  return Array.from({ length: points }, (_, index) => ({
    ...USUAL,
    accuracy_meters: 15,
    source: "smartwatch",
    recorded_at: new Date(NOW - (index + 1) * hoursApart * 3_600_000).toISOString(),
  }));
}

type Setup = {
  point: { latitude: number; longitude: number };
  points?: number;
  hoursApart?: number;
  noticeMinutesAgo?: number;
};

/** Just enough of the Supabase query builder for reviewAnomaly. */
function fakeSupabase(setup: Setup) {
  const rows = history(setup.points ?? 120, setup.hoursApart ?? 3);
  const inserted: Record<string, unknown>[] = [];
  let locationLookups = 0;

  const from = (table: string) => {
    let list: unknown = null;
    if (table === "geofences") list = [HOME];
    if (table === "location_logs") list = rows;

    const single = () => {
      if (table === "location_logs") {
        // The first lookup is the reviewed point, the next the child's oldest.
        return locationLookups++ === 0
          ? { child_id: CHILD, ...setup.point, accuracy_meters: 15, source: "smartwatch", recorded_at: new Date(NOW).toISOString() }
          : rows[rows.length - 1];
      }
      if (table === "geofence_events" && setup.noticeMinutesAgo !== undefined) {
        return { id: "notice-1", occurred_at: new Date(NOW - setup.noticeMinutesAgo * 60_000).toISOString() };
      }
      return null;
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      lt: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: single(), error: null }),
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return Promise.resolve({ error: null });
      },
      then: (resolve: (value: unknown) => unknown) => resolve({ data: list, error: null }),
    };
    return builder;
  };

  return { client: { from } as unknown as SupabaseClient, inserted };
}

type AiAnswer =
  | { status: number; body?: unknown }
  | { unreachable: true };

/** Runs the real review against the stand-ins. */
async function review(setup: Setup, answer: AiAnswer) {
  Deno.env.set("AI_ENABLED", "true");
  Deno.env.set("AI_SERVICE_URL", "https://ai.test");
  Deno.env.set("AI_SERVICE_KEY", "test-key");
  Deno.env.delete("AI_MIN_HISTORY_POINTS");
  Deno.env.delete("AI_MIN_BASELINE_DAYS");

  const calls: { url: string; key: string | null; historySent: number }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({
      url: String(input),
      key: new Headers(init?.headers).get("X-SafeTrack-AI-Key"),
      historySent: body.history?.length ?? 0,
    });
    if ("unreachable" in answer) return Promise.reject(new TypeError("error sending request: connection refused"));
    return Promise.resolve(new Response(JSON.stringify(answer.body ?? { detail: "Service Unavailable" }), { status: answer.status }));
  };

  const { client, inserted } = fakeSupabase(setup);
  try {
    await reviewAnomaly({ supabase: client, childId: CHILD, locationLogId: "location-1" });
    return { calls, notices: inserted };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const UNUSUAL = {
  status: 200,
  body: {
    ready: true,
    is_anomaly: true,
    anomaly_score: 0.81,
    reasons: ["large distance from the previous location", "unusually high speed"],
  },
};

const NORMAL = { status: 200, body: { ready: true, is_anomaly: false, anomaly_score: 0.12, reasons: [] } };

Deno.test("CASE-058: Child has fewer than 100 earlier location points or under 14 days of history", async () => {
  // 60 points over 7.5 days, then 120 points over only 5 days.
  const few = await review({ point: FAR, points: 60, hoursApart: 3 }, UNUSUAL);
  const short = await review({ point: FAR, points: 120, hoursApart: 1 }, UNUSUAL);
  assertEquals(few.calls.length + short.calls.length, 0);
  assertEquals(few.notices.length + short.notices.length, 0);
  recordActual(
    "CASE-058",
    "60 earlier points (7.5 days) and 120 points over only 5 days: the AI service was not called and no notice was created in either case.",
  );
});
