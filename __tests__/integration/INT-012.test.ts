/**
 * Integration testing: Smartwatch and Mobile Location Tracking -> Dashboard Management (live backend).
 * The watch sends a location with its accuracy; the dashboard's latest location for the child
 * carries what the map card shows: position, source, accuracy, update time and the place name.
 */
import { fetchLatestLocationForChild } from "../../services/locationService";
import { placeFor } from "../../lib/places";
import { generateWatchConnectionCode } from "../../services/watchPairingService";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { deviceClient, LAPU, MODULE, pairWatch, watchLocation } from "./helpers";

const A = accounts as any;
afterAll(signOutLocally);

describe("Map location information on the dashboard", () => {
  test("INT-012: The map shows the child's location, source, accuracy, address and update time", async () => {
    await signInAs(A.guardianWithChild);
    const device = deviceClient();
    const code = await generateWatchConnectionCode({ watchId: "ST-WATCH-NFEGJ9K6" });
    const watch = await pairWatch(device, "ST-WATCH-NFEGJ9K6", code.connectionCode);
    expect((await watchLocation(device, watch, LAPU)).error).toBeNull();
    const latest = await fetchLatestLocationForChild(watch.childId, code.childName);
    expect(latest!.latitude).toBeCloseTo(LAPU.latitude, 4);
    expect(latest!.source).toMatch(/watch/i);
    expect(latest!.accuracyMeters).toBe(6);
    expect(Date.now() - Date.parse(latest!.recordedAt)).toBeLessThan(120_000);
    const place = await placeFor(latest!.latitude, latest!.longitude);
    const address = place?.label ?? "";
    expect(address).not.toBe("");
    recordActual(MODULE, "INT-012", `The dashboard's latest location of ${code.childName}: ${latest!.latitude}, ${latest!.longitude}, source "${latest!.source}", ±${latest!.accuracyMeters} m, updated ${latest!.recordedAt}, address "${address}".`);
  });
});
