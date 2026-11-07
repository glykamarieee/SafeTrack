/**
 * Unit testing, AI Anomaly Detection & Geofencing Module: CASE-063, the app
 * side. The AI review itself is covered in
 * supabase/functions/_shared/anomaly_cases_test.ts (asleep / unreachable).
 * Here: location saving, safe-zone events and SOS go through database
 * functions that never call the AI service, so they keep working.
 *
 * This sends a real SOS from UT Child Two's paired phone, which rings any
 * phone signed in as the test guardian, so it only runs when asked:
 *   $env:SOS_TEST=1; npx jest __tests__/geofencing/ai-unavailable.test.ts --forceExit
 * The SOS is acknowledged by the guardian straight away.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { recordChildPhoneLocation, triggerChildPhoneSos } from "../../services/childMobileService";
import { createGeofence, deleteGeofence, fetchGeofenceEvents, fetchGeofences } from "../../services/geofenceService";
import { acknowledgeSosAlert, fetchActiveSosAlerts } from "../../services/sosService";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";

const CHILD = accounts.childPhone.childId;
const CENTER = { latitude: 7.3, longitude: 125.4 };
const run = process.env.SOS_TEST === "1" ? test : test.skip;

describe("AI service unavailable", () => {
  let zoneId: string | null = null;
  let sosId: string | null = null;

  beforeAll(async () => {
    await signInAs(accounts.guardianWithChild, CHILD);
    await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(accounts.childPhone));
  });

  // Inside the describe, so it runs before the shared hook signs out.
  afterAll(async () => {
    if (sosId) await acknowledgeSosAlert(sosId).catch(() => undefined);
    if (zoneId) await deleteGeofence(zoneId).catch(() => undefined);
    await signOutLocally();
  });

  run("CASE-063: AI service is unavailable or asleep (location, safe-zone events and SOS)", async () => {
    const guardianId = useAuthStore.getState().guardian!.id;
    const name = `UT Zone AI ${String(Date.now()).slice(-5)}`;
    await createGeofence({ guardianId, childId: CHILD, name, address: "", ...CENTER, radiusMeters: 100, isEnabled: true });
    zoneId = (await fetchGeofences(guardianId, CHILD)).find((zone) => zone.name === name)!.id;

    // Location saving and a safe-zone entry.
    await recordChildPhoneLocation(7.31, 125.4, 8);
    const saved = await recordChildPhoneLocation(CENTER.latitude, CENTER.longitude, 8);
    expect(saved.location.latitude).toBeCloseTo(CENTER.latitude, 4);
    const events = await fetchGeofenceEvents(CHILD, 10);
    expect(events.some((event) => event.geofenceId === zoneId && event.eventType === "entry")).toBe(true);

    // SOS reaches the guardian.
    const sos = await triggerChildPhoneSos();
    sosId = sos.id;
    const active = await fetchActiveSosAlerts();
    expect(active.some((alert) => alert.id === sosId)).toBe(true);
    await acknowledgeSosAlert(sosId);
    sosId = null;

    recordActual(
      "geofencing",
      "CASE-063 (app)",
      "Location saving, the safe-zone entry event and an SOS from the child phone all worked (the SOS reached the guardian and was acknowledged); none of them call the AI service.",
    );
  });
});
