import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import type {
  Administrator,
  Child,
  Guardian,
  UserRole,
} from "../types/safetrack";

const AVATAR_BUCKET = "profile-avatars";

export interface ResolvedProfile {
  role: UserRole;
  guardian?: Guardian;
  child?: Child;
  administrator?: Administrator;
}

export type GuardianProfileUpdate = {
  fullName: string;
  email: string;
  avatarPath?: string | null;
};

export type ChildProfileUpdate = {
  fullName: string;
  age: number;
  relationship: string;
  trackingSource: string;
  avatarPath?: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const message =
      typeof value.message === "string"
        ? value.message
        : "";

    const details =
      typeof value.details === "string"
        ? value.details
        : "";

    const hint =
      typeof value.hint === "string"
        ? value.hint
        : "";

    const combined = [message, details, hint]
      .filter(Boolean)
      .join(" ");

    if (combined) {
      return combined;
    }
  }

  return fallback;
}

async function resolveAvatarUrl(path?: string | null) {
  if (!path) {
    return undefined;
  }

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(
      path,
      60 * 60 * 24 * 7
    );

  if (error || !data?.signedUrl) {
    return undefined;
  }

  return data.signedUrl;
}

async function mapGuardian(row: any): Promise<Guardian> {
  return {
    id: row.id,
    userId: row.id,
    fullName: row.full_name,
    email: row.email,
    avatarPath: row.avatar_path ?? undefined,
    avatarUrl: await resolveAvatarUrl(
      row.avatar_path
    ),
    createdAt: row.created_at,
  };
}

async function mapChild(row: any): Promise<Child> {
  return {
    id: row.id,
    guardianId: row.guardian_id,
    fullName: row.full_name,
    age: row.age ?? undefined,
    relationship: row.relationship ?? undefined,
    trackingSource: row.tracking_source ?? undefined,
    avatarPath: row.avatar_path ?? undefined,
    avatarUrl: await resolveAvatarUrl(
      row.avatar_path
    ),
    createdAt: row.created_at,
  };
}

export async function ensureGuardianProfile(
  fullName: string,
  email: string
): Promise<Guardian> {
  const { data: guardianId, error: ensureError } =
    await supabase.rpc(
      "ensure_guardian_profile",
      {
        p_full_name: fullName.trim(),
        p_email: email.trim().toLowerCase(),
      }
    );

  if (ensureError) {
    throw new Error(
      getErrorMessage(
        ensureError,
        "Unable to create the Guardian profile."
      )
    );
  }

  if (
    !guardianId ||
    typeof guardianId !== "string"
  ) {
    throw new Error(
      "SafeTrack did not receive the Guardian profile after login."
    );
  }

  const { data, error } = await supabase
    .from("guardian_profiles")
    .select("*")
    .eq("id", guardianId)
    .single();

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Guardian profile was created but could not be loaded."
      )
    );
  }

  return mapGuardian(data);
}

export async function resolveProfileForUser(
  userId: string
): Promise<ResolvedProfile> {
  const { data, error } = await supabase
    .from("guardian_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Unable to load the Guardian profile."
      )
    );
  }

  if (!data) {
    throw new Error(
      "Guardian profile was not found."
    );
  }

  return {
    role: "guardian",
    guardian: await mapGuardian(data),
  };
}

/**
 * Load all children belonging to the currently
 * authenticated Guardian.
 *
 * IMPORTANT:
 * There is intentionally NO is_active filter
 * because child_profiles does not contain an
 * is_active column.
 *
 * A deleted child must therefore be physically
 * removed from child_profiles.
 */
export async function fetchLinkedChildren(
  guardianId: string
): Promise<Child[]> {
  const { data, error } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("guardian_id", guardianId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Unable to load the Guardian's registered children."
      )
    );
  }

  return Promise.all(
    (data ?? []).map(mapChild)
  );
}

/**
 * Fetch ONE child by ID.
 *
 * This is important for Child Mobile Link.
 * It prevents the application from accidentally
 * using children[0].
 */
export async function fetchChildById(
  guardianId: string,
  childId: string
): Promise<Child | null> {
  const { data, error } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("id", childId)
    .eq("guardian_id", guardianId)
    .maybeSingle();

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Unable to load the selected child profile."
      )
    );
  }

  if (!data) {
    return null;
  }

  return mapChild(data);
}

/**
 * Permanently delete a child profile.
 *
 * This is a real database DELETE, not a UI-only
 * removal. Therefore the child will no longer
 * appear after refreshing/reloading the Guardian
 * account.
 */
export async function deleteChildProfile(
  guardianId: string,
  childId: string
): Promise<void> {
  if (!guardianId) {
    throw new Error(
      "Guardian account could not be identified."
    );
  }

  if (!childId) {
    throw new Error(
      "Child profile could not be identified."
    );
  }

  /*
   * First verify that the child belongs to this
   * Guardian. This prevents deleting another
   * Guardian's child.
   */
  const { data: child, error: lookupError } =
    await supabase
      .from("child_profiles")
      .select("id, guardian_id, full_name")
      .eq("id", childId)
      .eq("guardian_id", guardianId)
      .maybeSingle();

  if (lookupError) {
    throw new Error(
      getErrorMessage(
        lookupError,
        "Unable to verify the child profile."
      )
    );
  }

  if (!child) {
    throw new Error(
      "The selected child profile was not found."
    );
  }

  /*
   * Delete the actual database record.
   *
   * Any related tables must have appropriate
   * ON DELETE CASCADE rules or the database will
   * return a foreign-key error.
   */
  const { error: deleteError } =
    await supabase
      .from("child_profiles")
      .delete()
      .eq("id", childId)
      .eq("guardian_id", guardianId);

  if (deleteError) {
    throw new Error(
      getErrorMessage(
        deleteError,
        `Unable to delete ${child.full_name}'s profile.`
      )
    );
  }
}

export async function updateGuardianProfile(
  guardianId: string,
  input: GuardianProfileUpdate
): Promise<Guardian> {
  const { data, error } = await supabase
    .from("guardian_profiles")
    .update({
      full_name: input.fullName.trim(),
      email: input.email
        .trim()
        .toLowerCase(),
      avatar_path:
        input.avatarPath ?? null,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", guardianId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Unable to update the Guardian profile."
      )
    );
  }

  return mapGuardian(data);
}

export async function updateChildProfile(
  childId: string,
  input: ChildProfileUpdate
): Promise<Child> {
  const { data, error } = await supabase
    .from("child_profiles")
    .update({
      full_name: input.fullName.trim(),
      age: input.age,
      relationship:
        input.relationship.trim(),
      tracking_source:
        input.trackingSource,
      avatar_path:
        input.avatarPath ?? null,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", childId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Unable to update the Child profile."
      )
    );
  }

  return mapChild(data);
}

function extensionFromAsset(
  asset: ImagePicker.ImagePickerAsset
) {
  if (asset.mimeType === "image/png") {
    return "png";
  }

  if (asset.mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

export async function chooseAndUploadProfileAvatar(
  scope: "guardian" | "child",
  ownerId: string
): Promise<{
  path: string;
  url?: string;
}> {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      "Photo permission is required to select a profile picture."
    );
  }

  const result =
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

  if (
    result.canceled ||
    !result.assets[0]
  ) {
    throw new Error(
      "Profile picture selection was cancelled."
    );
  }

  const asset = result.assets[0];

  const response =
    await fetch(asset.uri);

  const fileBody =
    await response.arrayBuffer();

  const path =
    `${scope}/${ownerId}/avatar-${Date.now()}.${extensionFromAsset(asset)}`;

  const { error: uploadError } =
    await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(
        path,
        fileBody,
        {
          contentType:
            asset.mimeType ??
            "image/jpeg",
          upsert: true,
        }
      );

  if (uploadError) {
    throw new Error(
      getErrorMessage(
        uploadError,
        "Unable to upload the profile picture."
      )
    );
  }

  return {
    path,
    url: await resolveAvatarUrl(path),
  };
}