import { supabase } from "../lib/supabase";

export type WatchConnectionCode = {
  connectionCode: string;
  expiresAt: string;
  watchId: string;
  childId: string;
  childName: string;
};

type FunctionErrorPayload = {
  error?: string;
  message?: string;
};

async function readFunctionError(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;

    if (
      context &&
      typeof context === "object" &&
      "json" in context &&
      typeof (context as { json?: unknown }).json === "function"
    ) {
      try {
        const payload = (await (context as Response).json()) as FunctionErrorPayload;
        const message = payload?.error ?? payload?.message;
        if (message?.trim()) return message.trim();
      } catch {
        // Fall through to the normal error message.
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function generateWatchConnectionCode(args: {
  smartwatchDeviceId?: string;
  watchId?: string;
}): Promise<WatchConnectionCode> {
  const normalizedWatchId = args.watchId?.trim().toUpperCase();

  if (!args.smartwatchDeviceId && !normalizedWatchId) {
    throw new Error("A smartwatch device ID or Watch ID is required.");
  }

  const { data, error } = await supabase.functions.invoke(
    "watch-pairing-code",
    {
      body: {
        smartwatchDeviceId: args.smartwatchDeviceId,
        watchId: normalizedWatchId,
      },
    },
  );

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
        "Unable to generate the smartwatch connection code.",
      ),
    );
  }

  if (!data?.ok || !data?.connectionCode) {
    throw new Error(
      data?.error || "SafeTrack did not return a smartwatch connection code.",
    );
  }

  return data as WatchConnectionCode;
}
