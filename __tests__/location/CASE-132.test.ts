/**
 * Unit testing, Smartwatch and Mobile Location Tracking Module: Transmit Smartwatch/Mobile Location.
 * CASE-132: the watch restarts or reconnects after saving a point and sends that same point again
 * (same recorded time). The live server must keep one record. UT Child One's test watch
 * (ST-WATCH-NFEGJ9K6) calls record_watch_location exactly as the Wear OS app does.
 */
import { supabase } from "../../lib/supabase";
import { generateWatchConnectionCode } from "../../services/watchPairingService";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { deviceClient, pairWatch } from "../integration/helpers";

const A = accounts as any;
afterAll(signOutLocally);

describe("Transmit Smartwatch/Mobile Location", () => {
  test("CASE-132: Watch restarts or reconnects after saving a point", async () => {
    await signInAs(A.guardianWithChild);
    const device = deviceClient();
    const code = await generateWatchConnectionCode({ watchId: "ST-WATCH-NFEGJ9K6" });
    const watch = await pairWatch(device, "ST-WATCH-NFEGJ9K6", code.connectionCode);
    const recordedAt = new Date().toISOString();
    const send = () => device.rpc("record_watch_location", {
      p_watch_id: watch.watchId, p_device_token: watch.deviceToken, p_battery_percent: 80, p_network_type: "wifi",
      p_device_model: "Unit test watch", p_latitude: 10.32646, p_longitude: 123.96523, p_accuracy_meters: 6, p_recorded_at: recordedAt,
    });
    const first = await send();
    const resent = await send();                       // same point after a restart / reconnect
    expect(first.error).toBeNull();
    expect(resent.error).toBeNull();
    const { data } = await supabase.from("location_logs").select("id").eq("child_id", watch.childId).eq("recorded_at", recordedAt);
    expect(data).toHaveLength(1);
    expect((resent.data as any).locationLogId).toBe((first.data as any).locationLogId);
    recordActual("location", "CASE-132", `The watch sent the point recorded at ${recordedAt} twice; SafeTrack kept 1 record (the second send returned the same record).`);
  });
});
