import { json, options } from "../_shared/response.ts";
import { assertActiveAdmin, findAdminProfile, requireUser } from "../_shared/identity.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return options();

  try {
    const supabase = serviceClient();
    const user = await requireUser(supabase, request);
    const admin = await findAdminProfile(supabase, user);
    assertActiveAdmin(admin);

    const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    if (action === "list") {
      const { data: devices, error } = await supabase
        .from("smartwatch_devices")
        .select(
          "id, watch_id, child_id, child_person_id, is_active, paired_at, last_verified_at, last_seen_at, last_location_at, last_battery_percent, last_network_type, device_model, created_at, updated_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const childIds = [...new Set((devices ?? []).map((row: any) => row.child_id).filter(Boolean))];
      let childMap = new Map<string, any>();
      if (childIds.length > 0) {
        const { data: children } = await supabase
          .from("child_profiles")
          .select("id, full_name, age, guardian_id")
          .in("id", childIds);
        childMap = new Map((children ?? []).map((child: any) => [child.id, child]));
      }

      const now = Date.now();
      const disconnectMs = Number(Deno.env.get("WATCH_DISCONNECT_SECONDS") ?? "300") * 1000;

      return json({
        ok: true,
        devices: (devices ?? []).map((device: any) => {
          const child = device.child_id ? childMap.get(device.child_id) : null;
          const lastSeenMs = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
          const connectionStatus = !device.is_active
            ? "disabled"
            : lastSeenMs && now - lastSeenMs <= disconnectMs
              ? "online"
              : "offline";

          return {
            ...device,
            childName: child?.full_name ?? null,
            guardianId: child?.guardian_id ?? null,
            connectionStatus,
          };
        }),
      });
    }

    if (action === "set_status") {
      const deviceId = String(body.deviceId ?? "").trim();
      const isActive = Boolean(body.isActive);
      if (!deviceId) return json({ error: "deviceId is required." }, 400);

      const { data, error } = await supabase
        .from("smartwatch_devices")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", deviceId)
        .select("id, watch_id, child_id, is_active")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Smartwatch device was not found." }, 404);

      // Historical location, geofence, anomaly and SOS records are intentionally
      // untouched. Admin controls only the current device status.
      return json({ ok: true, device: data });
    }

    return json({ error: "Unsupported admin device action." }, 400);
  } catch (error) {
    console.error("[admin-devices]", error);
    const message = error instanceof Error ? error.message : "Admin device operation failed.";
    if (["AUTH_REQUIRED", "AUTH_INVALID"].includes(message)) {
      return json({ error: "Administrator authentication is required." }, 401);
    }
    if (["ADMIN_REQUIRED", "ADMIN_INACTIVE"].includes(message)) {
      return json({ error: "Active Administrator access is required." }, 403);
    }
    return json({ error: message }, 500);
  }
});
