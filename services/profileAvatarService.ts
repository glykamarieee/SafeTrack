import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { supabase, supabaseProjectUrl, supabasePublishableKey } from "../lib/supabase";

const AVATAR_BUCKET = "profile-avatars";

export async function chooseProfileAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo-library access is required to choose a profile picture.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.78,
  });
  return result.canceled ? null : result.assets[0]?.uri ?? null;
}

export async function uploadProfileAvatar(target: "guardian" | "child", ownerId: string, uri: string, previousPath?: string | null) {
  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "webp", "heic"].includes(extension) ? extension : "jpg";
  const contentType = `image/${safeExtension === "jpg" ? "jpeg" : safeExtension}`;
  const path = `${target}/${ownerId}/avatar-${Date.now()}.${safeExtension}`;

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { upsert: false, contentType });
    if (error) throw error;
  } else {
    // React Native cannot build a Blob from file data ("Creating blobs from
    // 'ArrayBuffer' and 'ArrayBufferView' are not supported"), so the phone
    // uploads the picked file straight from disk with the native uploader,
    // using the same Storage endpoint and the signed-in user's token.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Please sign in again before changing the profile picture.");

    const endpoint = `${supabaseProjectUrl}/storage/v1/object/${AVATAR_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
    const result = await FileSystem.uploadAsync(endpoint, uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabasePublishableKey,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
    });

    if (result.status < 200 || result.status >= 300) {
      let message = `The picture could not be uploaded (${result.status}).`;
      try {
        const body = JSON.parse(result.body) as { message?: string; error?: string };
        if (body.message || body.error) message = String(body.message || body.error);
      } catch {
        // Keep the status-based message.
      }
      throw new Error(message);
    }
  }

  if (previousPath && previousPath !== path) {
    // The old picture is only cleanup; a failure here must not fail the save.
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]).catch(() => undefined);
  }
  return path;
}

export async function getProfileAvatarUrl(path?: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("profile-avatars").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
