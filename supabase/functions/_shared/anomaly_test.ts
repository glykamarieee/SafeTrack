import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { isInsideSafeZone, reviewAnomaly, thinHistory } from "./anomaly.ts";

// Run: deno test --allow-env --allow-net=jsr.io supabase/functions/_shared/anomaly_test.ts

const HOME = { latitude: 10.27268, longitude: 123.942459, radius_meters: 50 };
const CHILD = "child-1";
const NOW = Date.now();

function history() {
  return Array.from({ length: 120 }, (_, index) => ({
    latitude: 10.28,
    longitude: 123.95,
    accuracy_meters: 20,
    source: "smartwatch",
    recorded_at: new Date(NOW - (index + 1) * 3 * 3_600_000).toISOString(),
  }));
}

/** Just enough of the Supabase query builder for reviewAnomaly. */
function fakeSupabase(args: {
  point: { latitude: number; longitude: number };
  zonesError?: boolean;
}) {
  const inserted: unknown[] = [];
  const rows = history();
  let locationLookups = 0;
  const from = (table: string) => {
    let last: unknown = { data: null, error: null };
    if (table === "geofences") {
      last = args.zonesError
        ? { data: null, error: { message: "down" } }
        : { data: [HOME], error: null };
    } else if (table === "location_logs") {
      last = { data: rows, error: null };
    }
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      lt: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        // The first lookup is the reviewed point, the next the child's oldest.
        if (table === "location_logs" && locationLookups++ === 0) {
          return Promise.resolve({
            data: {
              child_id: CHILD,
              ...args.point,
              accuracy_meters: 20,
              source: "smartwatch",
              recorded_at: new Date(NOW).toISOString(),
            },
            error: null,
          });
        }
        if (table === "location_logs") {
          return Promise.resolve({ data: rows[rows.length - 1], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      insert: (row: unknown) => {
        inserted.push(row);
        return Promise.resolve({ error: null });
      },
      then: (resolve: (value: unknown) => unknown) => resolve(last),
    };
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, inserted };
}

async function review(
  point: { latitude: number; longitude: number },
  zonesError = false,
) {
  Deno.env.set("AI_ENABLED", "true");
  Deno.env.set("AI_SERVICE_URL", "https://ai.test");
  Deno.env.set("AI_SERVICE_KEY", "test-key");

  let aiCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    aiCalls += 1;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          ready: true,
          is_anomaly: true,
          anomaly_score: 0.7,
          reasons: ["large distance from the previous location"],
        }),
      ),
    );
  };

  try {
    const { client, inserted } = fakeSupabase({ point, zonesError });
    await reviewAnomaly({
      supabase: client,
      childId: CHILD,
      locationLogId: "location-1",
    });
    return { aiCalls, notices: inserted.length };
  } finally {
    globalThis.fetch = realFetch;
  }
}

Deno.test("a point inside the radius is inside the safe zone", () => {
  assertEquals(isInsideSafeZone(10.27268, 123.942459, [HOME]), true);
  // About 44 m north of the centre.
  assertEquals(isInsideSafeZone(10.27308, 123.942459, [HOME]), true);
});

Deno.test("a point beyond the radius is outside the safe zone", () => {
  // About 67 m north of the centre.
  assertEquals(isInsideSafeZone(10.27328, 123.942459, [HOME]), false);
  assertEquals(isInsideSafeZone(10.27268, 123.942459, []), false);
});

Deno.test("no AI call and no notice inside a safe zone", async () => {
  const result = await review({ latitude: 10.27268, longitude: 123.942459 });
  assertEquals(result, { aiCalls: 0, notices: 0 });
});

Deno.test("outside a safe zone the AI result creates a notice", async () => {
  const result = await review({ latitude: 10.4, longitude: 124.1 });
  assertEquals(result, { aiCalls: 1, notices: 1 });
});

Deno.test("the review still runs if the zones can't be read", async () => {
  const result = await review(
    { latitude: 10.27268, longitude: 123.942459 },
    true,
  );
  assertEquals(result, { aiCalls: 1, notices: 1 });
});

Deno.test("history is thinned to one point per 3 minutes, oldest first", () => {
  const start = Date.parse("2026-11-01T00:00:00Z");
  // A point every 10 s for 10 minutes, given newest first as the query returns them.
  const rows = Array.from({ length: 60 }, (_, i) => ({ recorded_at: new Date(start + (59 - i) * 10_000).toISOString() }));
  const kept = thinHistory(rows);
  assertEquals(kept.map((row) => (Date.parse(row.recorded_at) - start) / 1000), [0, 180, 360, 540]);
});
