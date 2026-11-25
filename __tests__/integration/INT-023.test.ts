/**
 * Integration testing: Dashboard Management -> AI-Based Anomaly Detection and Geofencing (live backend).
 * A temporary safe zone "UT Integration Zone" is made at Lapu-Lapu City Hall for the test child
 * phone (UT Child Two); the phone sends a location inside it, then outside, and the safe-zone
 * status returned by the server (the one the dashboard badge shows) follows. The zone is deleted.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordChildPhoneLocation } from "../../services/childMobileService";
import { createGeofence, deleteGeofence, fetchGeofences } from "../../services/geofenceService";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { LAPU, LAPU_NORTH, MODULE } from "./helpers";

const A = accounts as any;
let zoneId = "";
afterAll(async () => {
  // Every "UT Integration Zone" of the test child phone is removed (also one left by an earlier run).
  await signInAs(A.guardianWithChild);
  const guardianId = useAuthStore.getState().guardian?.id;
  if (guardianId) for (const z of await fetchGeofences(guardianId, A.childPhone.childId)) if (z.name === "UT Integration Zone") await deleteGeofence(z.id).catch(() => undefined);
  await signOutLocally();
});

describe("Safe-zone status on the dashboard", () => {
  test("INT-023: The safe-zone status is displayed (inside, then outside)", async () => {
    await signInAs(A.guardianWithChild);
    const guardianId = useAuthStore.getState().guardian!.id;
    const childId = A.childPhone.childId;
    await createGeofence({ guardianId, childId, name: "UT Integration Zone", address: "Lapu-Lapu City Hall", ...LAPU, radiusMeters: 100, isEnabled: true });
    zoneId = (await fetchGeofences(guardianId, childId)).filter((z) => z.name === "UT Integration Zone").pop()!.id;
    await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(A.childPhone));
    const inside: any = (await recordChildPhoneLocation(LAPU.latitude, LAPU.longitude, 8)).safeZoneStatus;
    const outside: any = (await recordChildPhoneLocation(LAPU_NORTH.latitude, LAPU_NORTH.longitude, 8)).safeZoneStatus;
    expect(JSON.stringify(inside)).toMatch(/inside/i);
    expect(JSON.stringify(inside)).toContain("UT Integration Zone");
    expect(JSON.stringify(outside)).toMatch(/outside/i);
    recordActual(MODULE, "INT-023", `At Lapu-Lapu City Hall the safe-zone status was ${JSON.stringify(inside)}; 1.1 km north it was ${JSON.stringify(outside)}.`);
  });
});
