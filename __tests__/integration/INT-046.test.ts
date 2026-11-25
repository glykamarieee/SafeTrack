/**
 * Integration testing: Child Device Connection -> AI-Based Anomaly Detection and Geofencing (live backend).
 * UT Child One's test watch sends a location at Lapu-Lapu City Hall, inside one of the child's saved
 * safe zones, through the same database function as the Wear OS app; the reply carries the
 * safe-zone status and zone name the watch shows ("In a safe place · <zone>").
 */
import { fetchGeofences } from "../../services/geofenceService";
import { generateWatchConnectionCode } from "../../services/watchPairingService";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { deviceClient, LAPU, MODULE, pairWatch, watchLocation } from "./helpers";

const A = accounts as any;
afterAll(signOutLocally);

describe("Safe-zone status on the child's watch", () => {
  test("INT-046: The watch shows In a safe place with the zone name", async () => {
    await signInAs(A.guardianWithChild);
    const guardianId = useAuthStore.getState().guardian!.id;
    const device = deviceClient();
    const code = await generateWatchConnectionCode({ watchId: "ST-WATCH-NFEGJ9K6" });
    const watch = await pairWatch(device, "ST-WATCH-NFEGJ9K6", code.connectionCode);
    const zones = (await fetchGeofences(guardianId, watch.childId)).filter((z) => z.isEnabled).map((z) => z.name);
    const reply: any = await watchLocation(device, watch, LAPU);
    expect(reply.error).toBeNull();
    const zone = reply.data.safeZone ?? reply.data.safeZoneStatus;
    expect(JSON.stringify(zone)).toMatch(/inside/i);
    expect(zone.status).toBe("inside");
    expect(zones).toContain(zone.zoneName);
    recordActual(MODULE, "INT-046", `The watch's location reply carried status "${zone.status}" and zone "${zone.zoneName}" (one of ${code.childName}'s safe zones), which the watch shows as "In a safe place · ${zone.zoneName}".`);
  });
});
