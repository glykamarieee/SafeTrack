import { supabase } from "../lib/supabase";
import { generateSmartwatchPairingCode } from "./smartwatchPairingService";

export type WatchConnectionCode = {
  connectionCode: string;
  expiresAt: string;
  watchId: string;
  childId: string;
  childName: string;
};

/**
 * Generate a connection code for a watch identified by its device row or
 * Watch ID. The Guardian can only read watches linked to their children.
 */
export async function generateWatchConnectionCode(args: {
  smartwatchDeviceId?: string;
  watchId?: string;
}): Promise<WatchConnectionCode> {
  const normalizedWatchId = args.watchId?.trim().toUpperCase();

  if (!args.smartwatchDeviceId && !normalizedWatchId) {
    throw new Error("A smartwatch device ID or Watch ID is required.");
  }

  let query = supabase
    .from("smartwatch_devices")
    .select("child_id");

  query = args.smartwatchDeviceId
    ? query.eq("id", args.smartwatchDeviceId)
    : query.eq("watch_id", normalizedWatchId!);

  const { data: device, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!device?.child_id) {
    throw new Error(
      "This smartwatch is not linked to one of your children. Add the Watch ID in Edit Child Profile first.",
    );
  }

  const code = await generateSmartwatchPairingCode({
    childId: device.child_id,
  });

  return {
    connectionCode: code.connectionCode,
    expiresAt: code.expiresAt,
    watchId: code.watchId,
    childId: code.childId,
    childName: code.childName,
  };
}
