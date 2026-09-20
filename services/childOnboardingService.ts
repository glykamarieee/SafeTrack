import { supabase } from "../lib/supabase";

export type TrackingSource = "smartwatch" | "both";

export type CompleteChildRegistrationInput = {
  fullName: string;
  age: number;
  relationship: string;
  trackingSource: TrackingSource;
  watchId: string;
};

export type ChildOnboardingResult = {
  ok: true;
  child: {
    id: string;
    guardian_id: string;
    full_name: string;
    age: number;
    relationship: string;
    tracking_source: TrackingSource;
  };
  device: {
    id: string;
    watch_id: string;
    child_id: string;
    is_active: boolean;
  };
  connectionCode: string;
  expiresAt: string;
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

export async function completeChildRegistration(
  input: CompleteChildRegistrationInput,
): Promise<ChildOnboardingResult> {
  const normalizedWatchId = input.watchId.trim().toUpperCase();

  if (!normalizedWatchId) {
    throw new Error("Enter the registered smartwatch connection ID.");
  }

  const { data, error } = await supabase.functions.invoke(
    "guardian-child-onboarding",
    {
      body: {
        fullName: input.fullName.trim(),
        age: input.age,
        relationship: input.relationship,
        trackingSource: input.trackingSource,
        watchId: normalizedWatchId,
      },
    },
  );

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
        "Unable to complete child registration.",
      ),
    );
  }

  if (!data?.ok || !data?.child?.id || !data?.connectionCode) {
    throw new Error(
      data?.error || "SafeTrack could not finish child/device registration.",
    );
  }

  return data as ChildOnboardingResult;
}
