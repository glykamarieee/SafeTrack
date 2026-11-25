/**
 * Integration testing: Dashboard Management -> Smartwatch and Mobile Location Tracking (live backend).
 * The test child phone (UT Child Two) sends a walking location as the child app does; the
 * dashboard's safety status for the child shows the update time, travel mode, place and source.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordChildPhoneLocation } from "../../services/childMobileService";
import { fetchLatestLocationForChild } from "../../services/locationService";
import { placeFor } from "../../lib/places";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { LAPU, MODULE } from "./helpers";

const A = accounts as any;
afterAll(signOutLocally);

describe("Child safety information on the dashboard", () => {
  test("INT-022: The latest safety status shows update time, travel mode, place and source", async () => {
    await signInAs(A.guardianWithChild);
    await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(A.childPhone));
    await recordChildPhoneLocation(LAPU.latitude, LAPU.longitude, 8, { speedMps: 1.3, headingDegrees: 45, mode: "walking", confidence: 0.9 } as any);
    const latest = await fetchLatestLocationForChild(A.childPhone.childId, "UT Child Two");
    expect(latest!.travelMode).toBe("walking");
    expect(latest!.source).toMatch(/phone|mobile/i);
    expect(Date.now() - Date.parse(latest!.recordedAt)).toBeLessThan(120_000);
    const place = await placeFor(latest!.latitude, latest!.longitude);
    expect(place?.label ?? "").not.toBe("");
    recordActual(MODULE, "INT-022", `UT Child Two's dashboard status: updated ${latest!.recordedAt}, travel mode "${latest!.travelMode}", source "${latest!.source}", place "${place!.label}".`);
  });
});
