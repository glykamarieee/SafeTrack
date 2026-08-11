import { supabase } from "../lib/supabase";

export type TrackingSource = "smartwatch" | "mobile" | "both";

export type ChildRegistrationInput = {
  fullName: string;
  age: number;
  relationship: string;
  trackingSource: TrackingSource;
  watchId?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const databaseError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const message =
      typeof databaseError.message === "string" ? databaseError.message : "";

    const details =
      typeof databaseError.details === "string" ? databaseError.details : "";

    const hint =
      typeof databaseError.hint === "string" ? databaseError.hint : "";

    return [message, details, hint].filter(Boolean).join(" ") || fallback;
  }

  return fallback;
}

export async function completeChildRegistration(
  input: ChildRegistrationInput
) {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      getErrorMessage(
        sessionError,
        "Could not confirm the active Guardian session."
      )
    );
  }

  if (!sessionData.session?.user) {
    throw new Error(
      "Your Guardian session has expired. Please log in again."
    );
  }

  const { data, error } = await supabase.rpc(
    "complete_child_registration",
    {
      p_full_name: input.fullName.trim(),
      p_age: input.age,
      p_relationship: input.relationship,
      p_tracking_source: input.trackingSource,
      p_watch_id: input.watchId?.trim() || null,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Unable to register the child profile."
      )
    );
  }

  if (!data || typeof data !== "string") {
    throw new Error(
      "SafeTrack did not receive the registered child profile."
    );
  }

  return data;
}